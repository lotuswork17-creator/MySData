// ── report-h2hrule.js — Provisional H2H / Line Rules ──
// Static pre-match statistic rules (no odds movement involved):
//   R1: H2H home dominance ≥70% (min 3 meetings)  → Bet A
//   R2: Deep home favourite (Asialine ≤ −1)        → Bet A
// Both are "fade the strong home team" rules found in the H2H/form study
// (Jul 2026). Train/test (75%/25% temporal split) recomputed live.
// PROVISIONAL: overall ROI is positive in both splits but the 95% CI
// still straddles zero — smaller evidence base than the Move Rules.
// Requires the rebuilt RECENT* H2H fields (VFP rebuild_rec.prg, Jul 2026).

function hrH2HShare(r){
  var h=r.RECENTH, d=r.RECENTD, a=r.RECENTA;
  if(h==null||d==null||a==null) return null;
  var n=h+d+a;
  if(n<=0) return null;
  return { share:h/n, n:n };
}

var HR_RULES=[
  { id:'hr1', bet:'A', type:'COUNTER',
    label:'H2H home dominance \u226570% (\u22652 meetings) \u2192 Bet A',
    desc:'Home team won \u226570% of the last (\u22648) head-to-head meetings, minimum 2 meetings. Public overbets the historically dominant home side.',
    match:function(r){ var s=hrH2HShare(r); return !!(s && s.n>=2 && s.share>=0.7); } },
  { id:'hr3', bet:'A', type:'COUNTER',
    label:'H2H home dominance \u226565% (\u22652 meetings) \u2192 Bet A',
    desc:'Looser variant of the 70% rule, tracked side-by-side. Adds the share = 2/3 band (e.g. 2-1-0, 4-2-0 records).',
    match:function(r){ var s=hrH2HShare(r); return !!(s && s.n>=2 && s.share>=0.65); } },
  { id:'hr2', bet:'A', type:'COUNTER',
    label:'Deep home favourite (line \u2264 \u22121) \u2192 Bet A',
    desc:'Home team gives a full goal or more. Heavy home favourites cover only ~43% \u2014 the away side holds the value.',
    match:function(r){ return r.ASIALINE!=null && r.ASIALINE<=-1; } },
];

// Quarter-line-aware unit payout {h,a} for the settled match.
function hrPnl(r){
  var gh=r.RESULTH, ga=r.RESULTA, line=r.ASIALINE, oh=r.ASIAH, oa=r.ASIAA;
  if(gh==null||ga==null||line==null||!oh||!oa) return null;
  var adj=Math.round((gh-ga+line)*4)/4;
  if(Math.abs(adj)<0.01) return {h:0,a:0,adj:adj};
  if(adj>0.25)  return {h:oh-1,      a:-1,          adj:adj};
  if(adj>0)     return {h:(oh-1)*0.5,a:-0.5,        adj:adj};
  if(adj<-0.25) return {h:-1,        a:oa-1,        adj:adj};
  return {h:-0.5, a:(oa-1)*0.5, adj:adj};
}

function computeH2HRule(results, records){
  var data=(records||results).filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.RESULTA!=null &&
           r.ASIALINE!=null && r.ASIAH>0 && r.ASIAA>0;
  });
  data.sort(function(a,b){
    var dc=(a.DATE||'').localeCompare(b.DATE||'');
    return dc!==0?dc:(a.TIME||0)-(b.TIME||0);
  });
  var splitIdx=Math.floor(data.length*0.75);

  function roiOf(vals){
    if(!vals.length) return 0;
    var s=0; vals.forEach(function(v){ s+=v; });
    return Math.round(s/vals.length*1000)/10;
  }

  var ruleSignals=HR_RULES.map(function(rule){
    var allV=[], trV=[], teV=[];
    data.forEach(function(r,i){
      if(!rule.match(r)) return;
      var p=hrPnl(r); if(!p) return;
      var v=rule.bet==='H'?p.h:p.a;
      allV.push(v);
      if(i<splitIdx) trV.push(v); else teV.push(v);
    });
    // last-20 / last-40 ROI: independent full-dataset scan, newest first
    var recent=[];
    for(var i=data.length-1;i>=0 && recent.length<40;i--){
      var r=data[i];
      if(!rule.match(r)) continue;
      var p=hrPnl(r); if(!p) continue;
      recent.push(rule.bet==='H'?p.h:p.a);
    }
    var roi20=recent.length>=20?roiOf(recent.slice(0,20)):null;
    var roi40=recent.length>=40?roiOf(recent.slice(0,40)):null;
    var roi=roiOf(allV), train=roiOf(trV), test=roiOf(teV);
    return { rule:rule, n:allV.length, roi:roi, train:train, test:test,
             roi20:roi20, roi40:roi40, valid:train>0&&test>0 };
  });

  function hrSortFired(fired){
    fired.sort(function(a,b){
      if(a.valid!==b.valid) return a.valid?-1:1;
      return b.roi-a.roi;
    });
    return fired;
  }

  // Upcoming alerts: PREEVE matches from today onward
  // (needs rebuilt RECENT* H2H fields on PREEVE records)
  var hrToday=new Date().toISOString().slice(0,10);
  var upcoming=(records||[]).filter(function(r){
    return r.STATUS==='PREEVE' && (r.DATE||'')>=hrToday &&
           r.ASIALINE!=null && r.ASIAH>0 && r.ASIAA>0;
  });
  var upcomingAlerts=[];
  upcoming.forEach(function(r){
    var fired=[];
    ruleSignals.forEach(function(rs){ if(rs.rule.match(r)) fired.push(rs); });
    if(fired.length){ hrSortFired(fired); upcomingAlerts.push({r:r,fired:fired}); }
  });
  upcomingAlerts.sort(function(a,b){
    var dc=(a.r.DATE||'').localeCompare(b.r.DATE||'');
    return dc!==0?dc:(a.r.TIME||0)-(b.r.TIME||0);
  });

  // Past bets: newest 50 settled matches where any rule fired (dedup per match)
  var pastBets=[];
  for(var i=data.length-1;i>=0 && pastBets.length<50;i--){
    var r=data[i], fired=[];
    ruleSignals.forEach(function(rs){ if(rs.rule.match(r)) fired.push(rs); });
    if(!fired.length) continue;
    var p=hrPnl(r); if(!p) continue;
    hrSortFired(fired);
    var bet=fired[0].rule.bet, v=bet==='H'?p.h:p.a;
    var outcome=Math.abs(p.adj)<0.01?'P':p.adj>0.25?'HW':p.adj>0?'HH':p.adj<-0.25?'AW':'AH';
    pastBets.push({r:r,fired:fired,pnl:v,outcome:outcome});
  }
  // Combined recent ROI over deduped bets (chronological full scan)
  var combined=[];
  data.forEach(function(r){
    var fired=[];
    ruleSignals.forEach(function(rs){ if(rs.rule.match(r)) fired.push(rs); });
    if(!fired.length) return;
    var p=hrPnl(r); if(!p) return;
    hrSortFired(fired);
    combined.push(fired[0].rule.bet==='H'?p.h:p.a);
  });
  function lastRoi(nWin){
    if(combined.length<nWin) return null;
    return roiOf(combined.slice(combined.length-nWin));
  }
  return { ruleSignals:ruleSignals, upcomingAlerts:upcomingAlerts, pastBets:pastBets,
           nRecords:data.length, splitIdx:splitIdx, splitDate:splitIdx<data.length?data[splitIdx].DATE:'',
           totalBets:combined.length, roiAllBets:roiOf(combined),
           roiL50:lastRoi(50), roiL100:lastRoi(100), roiL200:lastRoi(200) };
}

function renderH2HRule(RD){
  var el=document.getElementById('tabH2H');
  if(!el) return;
  if(!RD.h2hrule){
    if(typeof computeH2HRule==='function'&&RD.results){
      RD.h2hrule=computeH2HRule(RD.results, RD.records||RD.results);
    } else {
      el.innerHTML='<div style="padding:24px;color:#f87171">Error: computeH2HRule not available.</div>';
      return;
    }
  }
  var hr=RD.h2hrule;
  var h='';
  h+='<div class="rpt-title">\u2694\uFE0F H2H / Line Rules (Provisional)</div>';
  h+='<div class="rpt-sub">Static pre-match "fade the strong home team" rules from the H2H/form study. '
    +'No odds movement involved \u2014 signals are the rebuilt head-to-head record and the Asia line itself. '
    +'Train (75%) / test (25%) recomputed live. <b style="color:#fbbf24">PROVISIONAL</b>: both rules pass train/test '
    +'but their confidence intervals still straddle zero \u2014 weaker evidence than the Move Rules. Watch Last-20/40.</div>';

  // summary badges
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 14px 0">';
  function badge(lab,val,col){
    return '<div style="background:rgba(30,41,59,0.6);border:1px solid #334155;border-radius:8px;padding:6px 12px">'
      +'<div style="font-size:9px;color:#64748b">'+lab+'</div>'
      +'<div style="font-family:var(--mono);font-size:15px;font-weight:700;color:'+col+'">'+val+'</div></div>';
  }
  var rc=hr.roiAllBets>=0?'#4ade80':'#f87171';
  h+=badge('Total bets (dedup)', hr.totalBets, '#e2e8f0');
  h+=badge('ROI all bets', (hr.roiAllBets>=0?'+':'')+hr.roiAllBets+'%', rc);
  h+=badge('Train/test split', hr.splitDate, '#94a3b8');
  h+='</div>';

  // rules table
  h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
  h+='<th>Rule</th><th class="num">Bet</th><th class="num">n</th><th class="num">ROI (all)</th>';
  h+='<th class="num">Train</th><th class="num">Test</th><th class="num">Last 20</th><th class="num">Last 40</th><th class="num">Status</th>';
  h+='</tr></thead><tbody>';
  hr.ruleSignals.slice().sort(function(a,b){
    if(a.valid!==b.valid) return a.valid?-1:1;
    return b.roi-a.roi;
  }).forEach(function(rs){
    var rule=rs.rule;
    var roiCol=rs.roi>=10?'#4ade80':rs.roi>=5?'#a3e635':rs.roi>=0?'#fbbf24':'#f87171';
    var trCol=rs.train>=0?'#4ade80':'#f87171', teCol=rs.test>=0?'#4ade80':'#f87171';
    function rcell(v){
      if(v==null) return '<td class="num" style="color:#475569;font-family:var(--mono)">\u2014</td>';
      var c=v>=0?'#4ade80':'#f87171';
      return '<td class="num" style="font-family:var(--mono);color:'+c+'">'+(v>=0?'+':'')+v.toFixed(1)+'%</td>';
    }
    var statusHtml=rs.valid
      ?'<span style="color:#4ade80;font-size:9px;font-weight:700">VALID</span>'
      :'<span style="color:#f87171;font-size:9px;font-weight:700;border:1px solid #f87171;border-radius:3px;padding:0 3px" title="Live train/test no longer both positive">PROB</span>';
    h+='<tr'+(rs.valid?'':' style="opacity:0.55"')+'>';
    h+='<td><span style="color:#e2e8f0;font-size:11px;font-weight:600">'+rule.label+'</span>'
      +'<br><span style="color:#475569;font-size:9px">'+rule.desc+'</span></td>';
    h+='<td class="num"><b style="color:'+(rule.bet==='H'?'#f87171':'#60a5fa')+'">'+rule.bet+'</b></td>';
    h+='<td class="num" style="font-family:var(--mono)">'+rs.n+'</td>';
    h+='<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(rs.roi>=0?'+':'')+rs.roi.toFixed(1)+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+trCol+'">'+(rs.train>=0?'+':'')+rs.train.toFixed(1)+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+teCol+'">'+(rs.test>=0?'+':'')+rs.test.toFixed(1)+'%</td>';
    h+=rcell(rs.roi20)+rcell(rs.roi40);
    h+='<td class="num">'+statusHtml+'</td></tr>';
  });
  h+='</tbody></table></div>';

  // upcoming alerts
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin:16px 0 6px 0">\uD83D\uDCE3 Upcoming Matches \u2014 Rule Fired ('+hr.upcomingAlerts.length+')</div>';
  if(!hr.upcomingAlerts.length){
    h+='<div style="color:#475569;font-size:11px;font-style:italic;padding:8px 0">No upcoming matches currently trigger a rule.</div>';
  } else {
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
    h+='<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">H</th><th class="num">A</th>';
    h+='<th class="num">H2H (H-D-A)</th><th class="num">Bet</th><th>Rule</th></tr></thead><tbody>';
    hr.upcomingAlerts.forEach(function(al){
      var r=al.r, top=al.fired[0];
      var prob=top.valid?'':' <span style="color:#f87171;font-size:8px;font-weight:700;border:1px solid #f87171;border-radius:3px;padding:0 3px">PROB</span>';
      var ex=al.fired.length>1?' <span style="color:#fbbf24;font-size:11px">+'+(al.fired.length-1)+'</span>':'';
      var t=r.TIME, ts=t?String(t).padStart(4,'0'):'', tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';
      var h2h=(r.RECENTH!=null&&r.RECENTD!=null&&r.RECENTA!=null)?r.RECENTH+'-'+r.RECENTD+'-'+r.RECENTA:'\u2014';
      var hCol=top.rule.bet==='H'?'#f87171':'#94a3b8', aCol=top.rule.bet==='A'?'#60a5fa':'#94a3b8';
      var hWt=top.rule.bet==='H'?'700':'400', aWt=top.rule.bet==='A'?'700':'400';
      h+='<tr>';
      h+='<td style="font-family:var(--mono);font-size:12px;color:#e2e8f0;white-space:nowrap">'+(r.DATE||'').slice(5)+(tm?' '+tm:'')+'</td>';
      h+='<td><span style="font-size:13px;white-space:nowrap"><span style="color:'+hCol+';font-weight:'+hWt+'">'+r.TEAMH+'</span> <span style="color:#94a3b8">vs</span> <span style="color:'+aCol+';font-weight:'+aWt+'">'+r.TEAMA+'</span></span></td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>=0?'+':'')+r.ASIALINE+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH||'\u2014')+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA||'\u2014')+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+h2h+'</td>';
      h+='<td class="num"><b style="color:'+(top.rule.bet==='H'?'#f87171':'#60a5fa')+'">'+top.rule.bet+'</b></td>';
      var roiCol2=(top.roi!=null&&top.roi>=0)?'#4ade80':'#fca5a5';
      var roiTxt2=(top.roi==null)?'':' <span style="color:'+roiCol2+';font-family:var(--mono);font-size:12px;font-weight:700">'+(top.roi>=0?'+':'')+top.roi.toFixed(1)+'%</span>'
        +(top.n!=null?' <span style="color:#cbd5e1;font-family:var(--mono);font-size:11px">n'+top.n+'</span>':'');
      h+='<td style="font-size:12px;color:#e2e8f0;max-width:260px">'+top.rule.label+roiTxt2+ex+prob+'</td>';
      h+='</tr>';
    });
    h+='</tbody></table></div>';
  }

  // past bets
  function capRoi(lab,v){
    if(v==null) return '';
    var c=v>=0?'#4ade80':'#f87171';
    return '<span style="font-weight:400;color:#64748b;font-size:10px;margin-left:10px">'+lab
      +' <span style="font-family:var(--mono);font-weight:700;color:'+c+'">'+(v>=0?'+':'')+v+'%</span></span>';
  }
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin:16px 0 6px 0">\uD83D\uDCDC Past Bets \u2014 Last '+hr.pastBets.length+' (newest first)'
    +capRoi('L50 ROI',hr.roiL50)+capRoi('L100 ROI',hr.roiL100)+capRoi('L200 ROI',hr.roiL200)+'</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
  h+='<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">H</th><th class="num">A</th>';
  h+='<th class="num">Score</th><th class="num">Bet</th><th>Rule</th><th>Outcome</th><th class="num">Hit</th><th class="num">P&amp;L</th></tr></thead><tbody>';
  hr.pastBets.forEach(function(pb){
    var r=pb.r, top=pb.fired[0], bet=top.rule.bet;
    var oL, pW;
    if(pb.outcome==='HW'){oL='H WIN';pW=bet==='H';}
    else if(pb.outcome==='HH'){oL='H \u00BDWIN';pW=bet==='H';}
    else if(pb.outcome==='P'){oL='PUSH';pW=null;}
    else if(pb.outcome==='AH'){oL='A \u00BDWIN';pW=bet==='A';}
    else {oL='A WIN';pW=bet==='A';}
    var oBg=pW===null?'rgba(148,163,184,0.15)':pW?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)';
    var oCl=pW===null?'#94a3b8':pW?'#4ade80':'#f87171';
    var full=Math.abs(pb.pnl)>0.55, hit=pW===null?'\u2B1C':pW?(full?'\u2705\u2705':'\u2705'):(full?'\u274C\u274C':'\u274C');
    var pc=pb.pnl>0?'#4ade80':pb.pnl<0?'#f87171':'#94a3b8';
    var t=r.TIME, ts=t?String(t).padStart(4,'0'):'', tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';
    var ex=pb.fired.length>1?' <span style="color:#fbbf24;font-size:9px">+'+(pb.fired.length-1)+'</span>':'';
    var hCol=bet==='H'?'#f87171':'#94a3b8', aCol=bet==='A'?'#60a5fa':'#94a3b8';
    var hWt=bet==='H'?'700':'400', aWt=bet==='A'?'700':'400';
    h+='<tr>';
    h+='<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(r.DATE||'').slice(5)+(tm?' '+tm:'')+'</td>';
    h+='<td style="max-width:120px;overflow:hidden"><span style="font-size:10px;white-space:nowrap"><span style="color:'+hCol+';font-weight:'+hWt+'">'+r.TEAMH+'</span> <span style="color:#475569">vs</span> <span style="color:'+aCol+';font-weight:'+aWt+'">'+r.TEAMA+'</span></span></td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>=0?'+':'')+r.ASIALINE+'</td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH||'\u2014')+'</td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA||'\u2014')+'</td>';
    h+='<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+r.RESULTH+'\u2013'+r.RESULTA+'</td>';
    h+='<td class="num"><b style="color:'+(bet==='H'?'#f87171':'#60a5fa')+'">'+bet+'</b></td>';
    h+='<td style="font-size:9px;color:#94a3b8;max-width:170px">'+top.rule.label+ex+'</td>';
    h+='<td><span style="background:'+oBg+';color:'+oCl+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+oL+'</span></td>';
    h+='<td class="num" style="font-size:13px">'+hit+'</td>';
    h+='<td class="num" style="font-family:var(--mono);font-size:10px;color:'+pc+'">'+(pb.pnl>=0?'+':'')+pb.pnl.toFixed(2)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';

  el.innerHTML=h;
}
