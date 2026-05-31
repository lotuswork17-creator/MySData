// Book Rules 2 — the 12 base rules from Book Rules, restricted to matches where the
// 6 experts have NO unique majority direction ("tied" expert signal). Empirically, this
// sub-condition consistently boosts the bet-side ROI by removing crowd-confirmed lines.
//
// All helper functions (bcrPnl, bcrLean, bcrExpSignal, etc.) are loaded by report-bookrules.js
// which is included before this file in report.html.

// Local helper — define our own copy so this file doesn't depend on bcrExpSignal
// being present in report-bookrules.js (handles older versions of that file).
function br2ExpSignal(r){
  var keys=['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID','TIPSGEM','TIPSGPT'];
  var h=0,a=0,d=0;
  for(var i=0;i<keys.length;i++){
    var v=String(r[keys[i]]||'').toUpperCase();
    if(v.indexOf('H')>=0) h++;
    else if(v.indexOf('A')>=0) a++;
    else if(v.indexOf('D')>=0||v==='X') d++;
  }
  if(h>a&&h>d) return 'H';
  if(a>h&&a>d) return 'A';
  if(d>h&&d>a) return 'D';
  return 'tied';
}

// Reuse the 12 rule conditions but ADD a "crowd doesn't confirm the rule" requirement —
// expert signal is either 'tied' (no majority) OR 'counter' (majority opposite to rule's bet).
// These are jointly the cases where the public-line crowd is NOT validating the rule's direction,
// which leaves the book-comparison signal cleaner and historically boosts bet-side ROI.
var BR2_RULES = BCR_RULES.map(function(rule){
  var opposite = rule.bet==='H' ? 'A' : 'H';
  return {
    id: rule.id,
    book: rule.book,
    bet: rule.bet,
    desc: rule.desc + ' • experts tied or opposite',
    cond: function(r){
      if(!rule.cond(r)) return false;
      var s = br2ExpSignal(r);
      return s==='tied' || s===opposite;
    }
  };
});

function computeBookRules2(allRecords){
  var settled = allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });
  var upcoming = allRecords.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });

  var perRule = BR2_RULES.map(function(rule){
    var rows = settled.filter(rule.cond);
    rows.sort(function(a,b){
      var ta=(a.DATE||'')+(a.TIME||''), tb=(b.DATE||'')+(b.TIME||'');
      return ta<tb?-1:ta>tb?1:0;
    });
    var pH=0,pA=0,hc=0,n=rows.length;
    rows.forEach(function(r){ pH+=bcrPnl(r,'H'); pA+=bcrPnl(r,'A'); hc+=bcrHCover(r); });
    var roiBet = n? (rule.bet==='H'?pH:pA)/n*100 : null;
    var roiOther = n? (rule.bet==='H'?pA:pH)/n*100 : null;
    var L50=null;
    if(n>=50){
      var last50=rows.slice(n-50);
      var s=0; last50.forEach(function(r){ s+=bcrPnl(r, rule.bet); });
      L50 = (s/50)*100;
    } else if(n>0){
      var s2=0; rows.forEach(function(r){ s2+=bcrPnl(r, rule.bet); });
      L50 = (s2/n)*100;
    }
    return { rule:rule, n:n, roiBet:roiBet, roiOther:roiOther, L50:L50,
             hcover: n?Math.round(hc/n*100):null, matches:rows };
  });

  function rulesForMatch(r){
    var fired=[];
    BR2_RULES.forEach(function(rule,i){
      if(rule.cond(r)) fired.push({rule:rule, idx:i, roi:perRule[i].roiBet||0});
    });
    return fired;
  }

  var combined=[];
  settled.forEach(function(r){
    var fired=rulesForMatch(r);
    if(!fired.length) return;
    fired.sort(function(a,b){ return (b.roi||-99)-(a.roi||-99); });
    var best=fired[0].rule;
    combined.push({ r:r, rules:fired, bet:best.bet,
      pnl: bcrPnl(r, best.bet),
      ts:(r.DATE||'')+' '+(r.TIME||'') });
  });
  combined.sort(function(a,b){ return a.ts<b.ts?-1:a.ts>b.ts?1:0; });

  var roiPts=[], ma50=[], ma100=[], cumP=0;
  combined.forEach(function(b,i){
    cumP+=b.pnl;
    roiPts.push((cumP/(i+1))*100);
    var s50=0, c50=Math.min(50,i+1);
    for(var j=i-c50+1;j<=i;j++) s50+=combined[j].pnl;
    ma50.push((s50/c50)*100);
    var s100=0, c100=Math.min(100,i+1);
    for(var k=i-c100+1;k<=i;k++) s100+=combined[k].pnl;
    ma100.push((s100/c100)*100);
  });
  function lastN(n){
    if(combined.length<n) return null;
    var slice=combined.slice(combined.length-n);
    var s=0; slice.forEach(function(x){ s+=x.pnl; });
    return (s/n)*100;
  }

  var upcomingAlerts=[];
  upcoming.forEach(function(r){
    var fired=rulesForMatch(r);
    if(!fired.length) return;
    fired.sort(function(a,b){ return (b.roi||-99)-(a.roi||-99); });
    upcomingAlerts.push({ r:r, rules:fired, bet:fired[0].rule.bet });
  });
  upcomingAlerts.sort(function(a,b){
    var ta=(a.r.DATE||'')+(a.r.TIME||''), tb=(b.r.DATE||'')+(b.r.TIME||'');
    return ta<tb?-1:ta>tb?1:0;
  });

  return {
    perRule:perRule, combined:combined,
    roiPts:roiPts, ma50:ma50, ma100:ma100,
    lastRoi: roiPts.length? roiPts[roiPts.length-1] : null,
    L50:lastN(50), L100:lastN(100), L200:lastN(200),
    upcomingAlerts:upcomingAlerts,
    settledCount: settled.length,
    upcomingCount: upcoming.length
  };
}

function renderBookRules2(RD){
  var el=document.getElementById('tabBR2'); if(!el) return;
  var br = RD.bookrules2 || (RD.bookrules2 = computeBookRules2(RD.records||RD.results||[]));
  var h='';

  h+='<div class="rpt-title">📚 Book Rules 2 — Rules × Non-Confirming Experts</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">The 12 base Book Rules with an extra filter: the 6 experts (JC Sum/SID/Mac/ON ID + Gem + GPT) must <b>NOT confirm the rule\'s direction</b>. '
   +'Two sub-cases qualify: <b>tied</b> (no unique majority) or <b>counter-signal</b> (experts pick the opposite side from the rule). '
   +'Cases where experts confirm the rule\'s bet (e.g. rule says H + experts pick H) are excluded — those are the noisy ones. '
   +'Cases where experts pick D are also excluded (D-dominated samples are consistently disastrous). '
   +'This filter isolates matches where the public-line crowd is NOT validating the rule\'s direction, leaving the book-comparison signal cleaner.</div>';

  function roiBadge(roi, n){
    if(roi==null) return '<span style="color:#cbd5e1">—</span>';
    var col = roi>=4?'#4ade80':roi>=2?'#84cc16':roi>=-1?'#fbbf24':'#f87171';
    return '<span style="color:'+col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
      + ' <span style="color:#cbd5e1;font-size:12px;font-family:var(--mono)">n'+n+'</span>';
  }

  // Rule Reference table
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📋 Rule Reference</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
    +'<th>Rule</th><th>Book</th><th>Condition</th><th class="num">Bet</th>'
    +'<th class="num">N</th><th class="num">Bet ROI</th><th class="num" style="color:#fbbf24">L50 ROI</th>'
    +'<th class="num">Other ROI</th><th class="num">Edge</th><th class="num">Verdict</th>'
    +'</tr></thead><tbody>';
  br.perRule.forEach(function(pr){
    var rule=pr.rule;
    var edge = (pr.roiBet!=null && pr.roiOther!=null) ? pr.roiBet - pr.roiOther : null;
    var verdict;
    if(pr.roiBet==null||pr.n<20) verdict='<span style="color:#cbd5e1">— small sample</span>';
    else if(pr.roiBet>=4) verdict='<span style="color:#4ade80;font-weight:700">⭐ STRONG</span>';
    else if(pr.roiBet>=2) verdict='<span style="color:#84cc16;font-weight:700">✓ profitable</span>';
    else if(pr.roiBet>=-1) verdict='<span style="color:#fbbf24">~ near even</span>';
    else verdict='<span style="color:#f87171">tilt only</span>';
    var bCol=rule.bet==='H'?'#f87171':'#60a5fa';
    var L50cell;
    if(pr.L50==null) L50cell='<span style="color:#cbd5e1">—</span>';
    else {
      var l50col=pr.L50>=0?'#4ade80':pr.L50>=-2?'#fbbf24':'#f87171';
      var l50N=pr.n>=50?'50':pr.n;
      L50cell='<span style="color:'+l50col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(pr.L50>=0?'+':'')+pr.L50.toFixed(1)+'%</span>'
        +' <span style="color:#cbd5e1;font-size:11px;font-family:var(--mono)">n'+l50N+'</span>';
    }
    h+='<tr><td><b>'+rule.id+'</b></td>'
      +'<td style="color:#e2e8f0">'+rule.book+'</td>'
      +'<td style="color:#e2e8f0;font-size:12px">'+rule.desc+'</td>'
      +'<td class="num"><b style="color:'+bCol+';font-size:15px">'+rule.bet+'</b></td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1">'+pr.n+'</td>'
      +'<td class="num">'+roiBadge(pr.roiBet, pr.n)+'</td>'
      +'<td class="num">'+L50cell+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1;font-size:12px">'+(pr.roiOther==null?'—':(pr.roiOther>=0?'+':'')+pr.roiOther.toFixed(1)+'%')+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+(edge==null?'—':'+'+edge.toFixed(1)+'pp')+'</td>'
      +'<td class="num">'+verdict+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:11px;color:#cbd5e1;margin-top:4px">⭐ ROI ≥ +4%, ✓ ≥ +2%, ~ ≥ -1%, otherwise tilt only. Edge = Bet ROI − Other ROI.</div>';
  h+='</div>';

  // Upcoming alerts
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">🎯 Upcoming Matches — Rule Alerts</div>';
  if(!br.upcomingAlerts.length){
    h+='<div style="padding:12px;color:#cbd5e1;font-size:13px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently fire any of these rule + tied-experts conditions.</div>';
  } else {
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">HKJC H/A</th><th class="num">Lean</th>'
      +'<th class="num">Bet</th><th>Rules Fired</th>'
      +'</tr></thead><tbody>';
    br.upcomingAlerts.forEach(function(al, ai){
      var r=al.r, detId='br2_up_'+ai;
      var bCol=al.bet==='H'?'#f87171':'#60a5fa';
      var teamH=al.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':r.TEAMH;
      var teamA=al.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':r.TEAMA;
      var lean=bcrLean(r);
      var l=parseFloat(r.ASIALINE)||0;
      var ruleBadges=al.rules.map(function(f){
        var bgc=f.rule.bet==='H'?'rgba(248,113,113,0.15)':'rgba(96,165,250,0.15)';
        var fgc=f.rule.bet==='H'?'#f87171':'#60a5fa';
        return '<span style="display:inline-block;padding:2px 7px;margin:1px 2px;border-radius:3px;font-size:11px;background:'+bgc+';color:'+fgc+';font-weight:700">'+f.rule.id+'</span>';
      }).join('');
      h+='<tr style="cursor:pointer" onclick="br2Toggle(\''+detId+'\')">'
        +'<td style="color:#e2e8f0;font-size:12px">'+(r.DATE||'—')+' '+(r.TIME||'')+'</td>'
        +'<td style="font-size:13px">'+teamH+' vs '+teamA+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:13px">'+(l>=0?'+':'')+l.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:12px">'+r.ASIAH.toFixed(2)+' / '+r.ASIAA.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0;font-size:12px">'+(lean==null?'—':(lean*100).toFixed(1)+'%')+'</td>'
        +'<td class="num"><b style="color:'+bCol+';font-size:17px">'+al.bet+'</b></td>'
        +'<td>'+ruleBadges+'</td></tr>';
      // Expanded details
      var tipFields=[['JC Sum','JCTIPSUM'],['JC SID','JCTIPSID'],['SID Mac','TIPSIDMAC'],['ON ID','TIPSONID'],['Gem','TIPSGEM'],['GPT','TIPSGPT']];
      var tipBadges=tipFields.map(function(tf){
        var v=r[tf[1]];
        var c=!v?'#94a3b8':(String(v).indexOf('H')>=0?'#f87171':String(v).indexOf('A')>=0?'#60a5fa':'#4ade80');
        return '<span style="font-size:11px;font-family:var(--mono);padding:3px 9px;border-radius:4px;background:'+c+'22;border:1px solid '+c+'44"><span style="color:#cbd5e1;font-size:10px">'+tf[0]+':</span> <span style="color:'+c+';font-weight:700">'+(v||'—')+'</span></span>';
      }).join(' ');
      var es=(typeof expertScore==='function')?expertScore(r):null;
      var signalBar='';
      if(es){
        signalBar='<div style="margin-top:8px;margin-bottom:4px"><div style="font-size:11px;color:#e2e8f0;margin-bottom:3px">Expert Signal: '
          +'<span style="color:#f87171;font-weight:700">H '+es.h+'%</span> · '
          +'<span style="color:#4ade80;font-weight:700">D '+es.d+'%</span> · '
          +'<span style="color:#60a5fa;font-weight:700">A '+es.a+'%</span></div>'
          +'<div style="display:flex;height:10px;width:100%;border-radius:3px;overflow:hidden;background:#1e293b">'
          +(es.h>0?'<div style="width:'+es.h+'%;background:#f87171"></div>':'')
          +(es.d>0?'<div style="width:'+es.d+'%;background:#4ade80"></div>':'')
          +(es.a>0?'<div style="width:'+es.a+'%;background:#60a5fa"></div>':'')
          +'</div></div>';
      }
      var det='<div style="font-size:12px;color:#e2e8f0;padding:10px 14px">';
      det+='<div style="font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;margin-bottom:6px">Six Expert Picks</div>';
      det+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">'+tipBadges+'</div>'+signalBar;
      det+='<div style="margin-top:10px;font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;margin-bottom:4px">Book Odds</div>';
      det+='<div style="font-size:12px"><b>HKJC:</b> H '+r.ASIAH.toFixed(2)+' / A '+r.ASIAA.toFixed(2)+'</div>';
      if(bcrNz(r,'ASIAHMAC')) det+='<div style="font-size:12px"><b>Macau:</b> H '+r.ASIAHMAC.toFixed(2)+' / A '+r.ASIAAMAC.toFixed(2)+'</div>';
      if(bcrNz(r,'ASIAHSBO')) det+='<div style="font-size:12px"><b>SBO:</b> H '+r.ASIAHSBO.toFixed(2)+' / A '+r.ASIAASBO.toFixed(2)+'</div>';
      det+='<div style="margin-top:10px;font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;margin-bottom:4px">Rules Fired</div>';
      al.rules.forEach(function(f){ det+='<div style="margin-left:8px;font-size:12px">• <b>'+f.rule.id+'</b>: '+f.rule.desc+' → bet <b>'+f.rule.bet+'</b> (historic '+f.roi.toFixed(1)+'%)</div>'; });
      det+='</div>';
      h+='<tr id="'+detId+'" style="display:none"><td colspan="7" style="background:rgba(15,23,42,0.5);padding:0">'+det+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';

  // Historic Performance
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📈 Historic Performance — Combined (any rule + tied experts)</div>';
  if(br.combined.length<20){
    h+='<div style="padding:12px;color:#cbd5e1;font-size:13px;font-style:italic">Not enough settled history to chart.</div>';
  } else {
    function fl(v){ if(v==null) return ''; return ' <span style="color:'+(v>=0?'#4ade80':'#f87171')+';font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:10px;font-size:13px">'
      +'<span style="color:#e2e8f0">L200:'+fl(br.L200)+'</span>'
      +'<span style="color:#e2e8f0">L100:'+fl(br.L100)+'</span>'
      +'<span style="color:#e2e8f0">L50:'+fl(br.L50)+'</span>'
      +'<span style="color:#e2e8f0">All-time:'+fl(br.lastRoi)+'</span>'
      +'<span style="color:#cbd5e1">| Total bets: '+br.combined.length+'</span>'
      +'</div>';
    h+='<div id="lgdBr2Roi" style="font-size:12px;margin-bottom:6px"></div>';
    h+='<canvas id="cBr2Roi" style="width:100%;height:150px"></canvas>';
    setTimeout(function(){
      var series=[
        {label:'Running ROI%'+fl(br.lastRoi),color:'#fb923c',pts:br.roiPts},
        {label:'MA-50',color:'#60a5fa',pts:br.ma50.slice(50)},
        {label:'MA-100',color:'#a78bfa',pts:br.ma100.slice(100)}
      ];
      if(typeof makeLegend==='function') makeLegend('lgdBr2Roi',series);
      if(typeof drawChart==='function') drawChart('cBr2Roi',series,null,150);
    },40);
  }
  h+='</div>';

  // Past bets
  if(br.combined.length){
    function rb(v){ if(v==null) return '<span style="color:#cbd5e1">—</span>'; var c=v>=0?'#4ade80':'#f87171'; return '<span style="color:'+c+';font-weight:700;font-family:var(--mono)">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="margin-bottom:18px">';
    h+='<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:14px;margin-bottom:4px">'
      +'<div class="rpt-title" style="font-size:16px;margin:0">📜 Past Bets (most recent 200)</div>'
      +'<span style="font-size:13px;color:#e2e8f0">All-time: '+rb(br.lastRoi)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L200: '+rb(br.L200)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L100: '+rb(br.L100)+'</span>'
      +'<span style="font-size:13px;color:#e2e8f0">L50: '+rb(br.L50)+'</span>'
      +'</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:12px"><thead><tr>'
      +'<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">Result</th>'
      +'<th class="num">Bet</th><th>Rules</th><th class="num">PnL</th><th class="num">Hit</th>'
      +'</tr></thead><tbody>';
    var recent=br.combined.slice(-200).reverse();
    recent.forEach(function(b){
      var r=b.r, m=bcrAdjM(r);
      var pfw=(b.bet==='H'&&m>0.25)||(b.bet==='A'&&m<-0.25);
      var phw=(b.bet==='H'&&m===0.25)||(b.bet==='A'&&m===-0.25);
      var phl=(b.bet==='H'&&m===-0.25)||(b.bet==='A'&&m===0.25);
      var hit=pfw?'✅✅':phw?'✅':m===0?'⬜':phl?'❌':'❌❌';
      var bCol=b.bet==='H'?'#f87171':'#60a5fa';
      var teamH=b.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':r.TEAMH;
      var teamA=b.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':r.TEAMA;
      var rids=b.rules.map(function(f){ return f.rule.id; }).join(',');
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

window.br2Toggle = function(id){
  var row=document.getElementById(id);
  if(!row) return;
  if(row.style.display==='none'){ row.style.display=''; }
  else { row.style.display='none'; }
};
