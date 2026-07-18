// ── report-consline.js — Consensus × Line (Confirmed-Favourite Fade) ──
// Discovered pattern: when the 6-expert consensus points at the SAME side the Asian
// line already favours, that side is over-bet and fading it at HKJC is profitable.
// When experts oppose the line favourite, the signal is noise.
// Reuses seTipDir/seVotes from report-sixexpert.js (loaded before this file).

var CL_RULES = [
  { id:'CL1', label:'4+ Experts A + line ≥ +0.25 (away fav confirmed)', bet:'H',
    cond:function(r){ var v=seVotes(r); return v.a>=4 && parseFloat(r.ASIALINE)>=0.25; } },
  { id:'CL2', label:'4+ Experts H + line ≤ −0.25 (home fav confirmed)', bet:'A',
    cond:function(r){ var v=seVotes(r); return v.h>=4 && parseFloat(r.ASIALINE)<=-0.25; } },
  { id:'CL3', label:'3+ Experts H + line ≤ −0.5 (home strong fav confirmed)', bet:'A',
    cond:function(r){ var v=seVotes(r); return v.h>=3 && parseFloat(r.ASIALINE)<=-0.5; } },
  { id:'CL4', label:'3+ Experts A + line ≥ +0.25 (away fav confirmed)', bet:'H',
    cond:function(r){ var v=seVotes(r); return v.a>=3 && parseFloat(r.ASIALINE)>=0.25; } }
];

function clAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function clPnl(r,bet){
  var m=clAdjM(r);
  if(bet==='H'){ var o=r.ASIAH; if(m>0.25) return o-1; if(m===0.25) return (o-1)/2; if(m===0) return 0; if(m===-0.25) return -0.5; return -1; }
  var o2=r.ASIAA; if(m<-0.25) return o2-1; if(m===-0.25) return (o2-1)/2; if(m===0) return 0; if(m===0.25) return -0.5; return -1;
}
function clSortKey(r){
  var t = r.TIME==null ? '0000' : String(r.TIME);
  while(t.length<4) t='0'+t;
  return (r.DATE||'')+t;
}

function computeConsLine(allRecords){
  var settled = allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });
  var upcoming = allRecords.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });

  var perRule = CL_RULES.map(function(rule){
    var rows = settled.filter(rule.cond);
    rows.sort(function(a,b){ var ta=clSortKey(a), tb=clSortKey(b); return ta<tb?-1:ta>tb?1:0; });
    var pB=0, pO=0, n=rows.length;
    rows.forEach(function(r){ pB+=clPnl(r,rule.bet); pO+=clPnl(r, rule.bet==='H'?'A':'H'); });
    function lastN(k){
      if(!n) return null;
      var m=Math.min(k,n), s=0;
      for(var i=n-m;i<n;i++) s+=clPnl(rows[i], rule.bet);
      return (s/m)*100;
    }
    return { rule:rule, n:n,
      roiBet: n?pB/n*100:null, roiOther: n?pO/n*100:null,
      L50:lastN(50), L100:lastN(100), matches:rows };
  });

  // Combined portfolio: any rule fires → bet by the highest-ROI rule that fired
  function firedRules(r){
    var f=[];
    CL_RULES.forEach(function(rule,i){ if(rule.cond(r)) f.push({rule:rule, roi:perRule[i].roiBet||0, n:perRule[i].n}); });
    f.sort(function(a,b){ return (b.roi||-99)-(a.roi||-99); });
    return f;
  }
  var combined=[];
  settled.forEach(function(r){
    var f=firedRules(r);
    if(!f.length) return;
    combined.push({ r:r, rules:f, bet:f[0].rule.bet, pnl:clPnl(r,f[0].rule.bet), ts:clSortKey(r) });
  });
  combined.sort(function(a,b){ return a.ts<b.ts?-1:a.ts>b.ts?1:0; });

  var roiPts=[], ma50=[], ma100=[], cumP=0;
  combined.forEach(function(b,i){
    cumP+=b.pnl;
    roiPts.push((cumP/(i+1))*100);
    var s=0,c=Math.min(50,i+1); for(var j=i-c+1;j<=i;j++) s+=combined[j].pnl; ma50.push((s/c)*100);
    var s2=0,c2=Math.min(100,i+1); for(var k=i-c2+1;k<=i;k++) s2+=combined[k].pnl; ma100.push((s2/c2)*100);
  });
  function pLastN(k){
    if(combined.length<k) return null;
    var s=0; combined.slice(combined.length-k).forEach(function(x){ s+=x.pnl; });
    return (s/k)*100;
  }

  var upcomingAlerts=[];
  upcoming.forEach(function(r){
    var f=firedRules(r);
    if(!f.length) return;
    upcomingAlerts.push({ r:r, rules:f, bet:f[0].rule.bet });
  });
  upcomingAlerts.sort(function(a,b){ var ta=clSortKey(a.r), tb=clSortKey(b.r); return ta<tb?-1:ta>tb?1:0; });

  return { perRule:perRule, combined:combined, roiPts:roiPts, ma50:ma50, ma100:ma100,
    lastRoi: roiPts.length?roiPts[roiPts.length-1]:null,
    L50:pLastN(50), L100:pLastN(100), L200:pLastN(200),
    upcomingAlerts:upcomingAlerts };
}

function renderConsLine(RD){
  var el=document.getElementById('tabCL'); if(!el) return;
  var cl = RD.consline || (RD.consline = computeConsLine(RD.records||RD.results||[]));
  var h='';

  h+='<div class="rpt-title">🧭 Consensus × Line — Confirmed-Favourite Fade</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">When the 6-expert consensus points at the <b>same side the Asian line already favours</b> '
    +'(experts H + home giving handicap, or experts A + away giving handicap), that side is over-bet and <b>fading it at HKJC is profitable</b> — '
    +'the handicap and public consensus double-count the same information, leaving the other side underpriced. '
    +'When experts oppose the line favourite, the signal is noise (excluded here). '
    +'Static-line companion to the odds-movement CF rules in the Six Expert tab: lower per-bet edge, ~4× the betting volume.</div>';

  // ── Upcoming alerts ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">🎯 Upcoming Matches — Fade Alerts</div>';
  if(!cl.upcomingAlerts.length){
    h+='<div style="padding:12px;color:#cbd5e1;font-size:13px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently fire any Consensus × Line rule.</div>';
  } else {
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th><th class="num">HKJC H/A</th>'
      +'<th class="num">Votes H/A</th><th class="num">Bet</th><th>Rules Fired</th></tr></thead><tbody>';
    cl.upcomingAlerts.forEach(function(al, ai){
      var r=al.r, detId='cl_up_'+ai;
      var bCol=al.bet==='H'?'#f87171':'#60a5fa';
      var teamH=al.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':(r.TEAMH||'');
      var teamA=al.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':(r.TEAMA||'');
      var v=seVotes(r);
      var l=parseFloat(r.ASIALINE)||0;
      var badges=al.rules.map(function(f){
        var bg=f.rule.bet==='H'?'rgba(248,113,113,0.15)':'rgba(96,165,250,0.15)';
        var fg=f.rule.bet==='H'?'#f87171':'#60a5fa';
        var rc=(f.roi!=null&&f.roi>=0)?'#4ade80':'#fca5a5';
        var rt=(f.roi==null)?'':' <span style="color:'+rc+';font-size:12px;font-family:var(--mono)">'+(f.roi>=0?'+':'')+f.roi.toFixed(1)+'%</span>'
          +(f.n!=null?' <span style="color:#cbd5e1;font-size:10px;font-family:var(--mono)">n'+f.n+'</span>':'');
        return '<span style="display:inline-block;padding:4px 10px;margin:2px 3px;border-radius:4px;font-size:14px;background:'+bg+';color:'+fg+';font-weight:700">'+f.rule.id+rt+'</span>';
      }).join('');
      h+='<tr style="cursor:pointer" onclick="clToggle(\''+detId+'\')">'
        +'<td style="color:#e2e8f0;font-size:12px">'+(r.DATE||'—')+' '+(r.TIME||'')+'</td>'
        +'<td style="font-size:13px">'+teamH+' vs '+teamA+'</td>'
        +'<td class="num" style="font-family:var(--mono)">'+(l>=0?'+':'')+l.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:12px">'+r.ASIAH.toFixed(2)+' / '+r.ASIAA.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono)"><span style="color:#f87171">'+v.h+'</span> / <span style="color:#60a5fa">'+v.a+'</span></td>'
        +'<td class="num"><b style="color:'+bCol+';font-size:17px">'+al.bet+'</b></td>'
        +'<td>'+badges+'</td></tr>';
      // Expanded: six expert tips
      var tips=SIXEXP_LIST.map(function(e){
        var t=r[e.key];
        var c=!t?'#94a3b8':(seTipDir(t)==='H'?'#f87171':seTipDir(t)==='A'?'#60a5fa':'#4ade80');
        return '<span style="font-size:11px;font-family:var(--mono);padding:3px 9px;border-radius:4px;background:'+c+'22;border:1px solid '+c+'44"><span style="color:#cbd5e1;font-size:10px">'+e.label+':</span> <span style="color:'+c+';font-weight:700">'+(t||'—')+'</span></span>';
      }).join(' ');
      var det='<div style="font-size:12px;color:#e2e8f0;padding:10px 14px">'
        +'<div style="font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;margin-bottom:6px">Six Expert Picks</div>'
        +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">'+tips+'</div>';
      al.rules.forEach(function(f){ det+='<div style="margin-left:4px;font-size:12px">• <b>'+f.rule.id+'</b>: '+f.rule.label+' → bet <b>'+f.rule.bet+'</b> (historic '+(f.roi>=0?'+':'')+f.roi.toFixed(1)+'%)</div>'; });
      det+='</div>';
      h+='<tr id="'+detId+'" style="display:none"><td colspan="7" style="background:rgba(15,23,42,0.5);padding:0">'+det+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';

  // ── Historic Performance chart ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📈 Historic Performance — Combined (any rule)</div>';
  if(cl.combined.length<20){
    h+='<div style="padding:12px;color:#cbd5e1;font-size:13px;font-style:italic">Not enough settled history to chart.</div>';
  } else {
    function fl(v){ if(v==null) return ''; return ' <span style="color:'+(v>=0?'#4ade80':'#f87171')+';font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:10px;font-size:13px">'
      +'<span style="color:#e2e8f0">L200:'+fl(cl.L200)+'</span>'
      +'<span style="color:#e2e8f0">L100:'+fl(cl.L100)+'</span>'
      +'<span style="color:#e2e8f0">L50:'+fl(cl.L50)+'</span>'
      +'<span style="color:#e2e8f0">All-time:'+fl(cl.lastRoi)+'</span>'
      +'<span style="color:#cbd5e1">| Total bets: '+cl.combined.length+'</span>'
      +'</div>';
    h+='<div id="lgdClRoi" style="font-size:12px;margin-bottom:6px"></div>';
    h+='<canvas id="cClRoi" style="width:100%;height:150px"></canvas>';
    setTimeout(function(){
      var Z=200;
      function tail(arr,n){ return arr.length>n?arr.slice(arr.length-n):arr; }
      var series=[
        {label:'Running ROI%'+fl(cl.lastRoi),color:'#fb923c',pts:tail(cl.roiPts,Z)},
        {label:'MA-50',color:'#60a5fa',pts:tail(cl.ma50.slice(50),Z)},
        {label:'MA-100',color:'#a78bfa',pts:tail(cl.ma100.slice(100),Z)}
      ];
      if(typeof makeLegend==='function') makeLegend('lgdClRoi',series);
      if(typeof drawChart==='function') drawChart('cClRoi',series,null,150);
    },40);
  }
  h+='</div>';

  // ── Rule Reference ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📋 Rule Reference</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
    +'<th>Rule</th><th>Condition</th><th class="num">Bet</th><th class="num">N</th>'
    +'<th class="num">Bet ROI</th><th class="num" style="color:#facc15">L100 ROI</th><th class="num" style="color:#fbbf24">L50 ROI</th>'
    +'<th class="num">Other ROI</th><th class="num">Edge</th></tr></thead><tbody>';
  cl.perRule.forEach(function(pr){
    var rule=pr.rule;
    var edge=(pr.roiBet!=null&&pr.roiOther!=null)?pr.roiBet-pr.roiOther:null;
    var bCol=rule.bet==='H'?'#f87171':'#60a5fa';
    function cell(v,nBadge){
      if(v==null) return '<span style="color:#cbd5e1">—</span>';
      var col=v>=0?'#4ade80':v>=-2?'#fbbf24':'#f87171';
      return '<span style="color:'+col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'
        +(nBadge?' <span style="color:#cbd5e1;font-size:11px;font-family:var(--mono)">'+nBadge+'</span>':'');
    }
    h+='<tr><td><b>'+rule.id+'</b></td>'
      +'<td style="color:#e2e8f0;font-size:12px">'+rule.label+'</td>'
      +'<td class="num"><b style="color:'+bCol+';font-size:15px">'+rule.bet+'</b></td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1">'+pr.n+'</td>'
      +'<td class="num">'+cell(pr.roiBet)+'</td>'
      +'<td class="num">'+cell(pr.L100,'n'+Math.min(100,pr.n))+'</td>'
      +'<td class="num">'+cell(pr.L50,'n'+Math.min(50,pr.n))+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1;font-size:12px">'+(pr.roiOther==null?'—':(pr.roiOther>=0?'+':'')+pr.roiOther.toFixed(1)+'%')+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+(edge==null?'—':'+'+edge.toFixed(1)+'pp')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:12px;color:#cbd5e1;margin-top:4px">CL1/CL2 (4+ experts) are the sharper signals; CL3/CL4 (3+ experts) trade edge for volume. Rules overlap: a 4+ match also fires its 3+ counterpart — the combined portfolio bets each match once using the highest-ROI rule fired. "Other" = following the confirmed favourite, consistently disastrous.</div>';
  h+='</div>';

  // ── Past Bets ──
  if(cl.combined.length){
    function rb(v){ if(v==null) return '<span style="color:#cbd5e1">—</span>'; var c=v>=0?'#4ade80':'#f87171'; return '<span style="color:'+c+';font-weight:700;font-family:var(--mono)">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="margin-bottom:18px">';
    h+='<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:14px;margin-bottom:4px">'
      +'<div class="rpt-title" style="font-size:16px;margin:0">📜 Past Bets (most recent 200)</div>'
      +'<span style="font-size:13px;color:#e2e8f0">All-time: '+rb(cl.lastRoi)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L200: '+rb(cl.L200)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L100: '+rb(cl.L100)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L50: '+rb(cl.L50)+'</span>'
      +'</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:12px"><thead><tr>'
      +'<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">Result</th>'
      +'<th class="num">Bet</th><th>Rules</th><th class="num">PnL</th><th class="num">Hit</th></tr></thead><tbody>';
    cl.combined.slice(-200).reverse().forEach(function(b){
      var r=b.r, m=clAdjM(r);
      var pfw=(b.bet==='H'&&m>0.25)||(b.bet==='A'&&m<-0.25);
      var phw=(b.bet==='H'&&m===0.25)||(b.bet==='A'&&m===-0.25);
      var phl=(b.bet==='H'&&m===-0.25)||(b.bet==='A'&&m===0.25);
      var hit=pfw?'✅✅':phw?'✅':m===0?'⬜':phl?'❌':'❌❌';
      var bCol=b.bet==='H'?'#f87171':'#60a5fa';
      var teamH=b.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':(r.TEAMH||'');
      var teamA=b.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':(r.TEAMA||'');
      var rids=b.rules.map(function(f){
        var rc=(f.roi!=null&&f.roi>=0)?'#4ade80':'#fca5a5';
        var rt=(f.roi==null)?'':' <span style="color:'+rc+';font-family:var(--mono);font-size:10px">'+(f.roi>=0?'+':'')+f.roi.toFixed(1)+'%</span>'
          +(f.n!=null?' <span style="color:#cbd5e1;font-family:var(--mono);font-size:9px">n'+f.n+'</span>':'');
        return '<span style="white-space:nowrap">'+f.rule.id+rt+'</span>';
      }).join(', ');
      var l=parseFloat(r.ASIALINE)||0;
      h+='<tr>'
        +'<td style="color:#e2e8f0;font-size:11px">'+(r.DATE||'')+'</td>'
        +'<td style="font-size:12px">'+teamH+' vs '+teamA+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:11px">'+(l>=0?'+':'')+l.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:11px;color:#e2e8f0">'+r.RESULTH+'-'+r.RESULTA+'</td>'
        +'<td class="num"><b style="color:'+bCol+';font-size:14px">'+b.bet+'</b></td>'
        +'<td style="font-size:11px;color:#e2e8f0">'+rids+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:12px;color:'+(b.pnl>=0?'#4ade80':'#f87171')+'">'+(b.pnl>=0?'+':'')+b.pnl.toFixed(2)+'</td>'
        +'<td class="num" style="font-size:14px">'+hit+'</td></tr>';
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:11px;color:#cbd5e1;margin-top:4px">Hit: ✅✅ win · ✅ half-win · ⬜ push · ❌ half-loss · ❌❌ loss.</div>';
    h+='</div>';
  }

  el.innerHTML=h;
}

window.clToggle = function(id){
  var row=document.getElementById(id);
  if(!row) return;
  if(row.style.display==='none'){ row.style.display=''; }
  else { row.style.display='none'; }
};
