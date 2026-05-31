// Book Compare Rules — 8 price-pattern rules combining HKJC vs Macau/SBO actual-odds
// comparison with HKJC market lean. ROI computed at HKJC odds. Latest odds only.

// ── Helpers ───────────────────────────────────────────────────────────────
function bcrNz(r,k){ var v=r[k]; return v!=null && v!==0; }
function bcrLean(r){ var h=r.ASIAH, a=r.ASIAA; if(!h||!a||h<=0||a<=0) return null; return (1/h)/((1/h)+(1/a)); }
function bcrAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function bcrPnl(r,bet){
  var m=bcrAdjM(r);
  if(bet==='H'){ var o=r.ASIAH; if(m>0.25) return o-1; if(m===0.25) return (o-1)/2; if(m===0) return 0; if(m===-0.25) return -0.5; return -1; }
  var o2=r.ASIAA; if(m<-0.25) return o2-1; if(m===-0.25) return (o2-1)/2; if(m===0) return 0; if(m===0.25) return -0.5; return -1;
}
function bcrHCover(r){ var m=bcrAdjM(r); return m>0?1:m===0?0.5:0; }

// Eligibility for line match per rule's book scope
function bcrMacauOk(r){ return bcrNz(r,'ASIAHMAC')&&bcrNz(r,'ASIAAMAC')&&r.ASIALINE===r.ASIALINEMA; }
function bcrSboOk(r){ return bcrNz(r,'ASIAHSBO')&&bcrNz(r,'ASIAASBO')&&r.ASIALINE===r.ASIALINESB; }
function bcrBothOk(r){ return bcrMacauOk(r)&&bcrSboOk(r); }

// ── Rule definitions ──────────────────────────────────────────────────────
var BCR_RULES = [
  { id:'R1', book:'Mac',  bet:'A',
    desc:'HKJC h > Mac, a < Mac AND lean < 52%',
    cond:function(r){ if(!bcrMacauOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH>r.ASIAHMAC && r.ASIAA<r.ASIAAMAC && L<0.52; } },
  { id:'R2', book:'Mac',  bet:'H',
    desc:'HKJC h < Mac, a > Mac AND lean > 52%',
    cond:function(r){ if(!bcrMacauOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH<r.ASIAHMAC && r.ASIAA>r.ASIAAMAC && L>0.52; } },
  { id:'R3', book:'Mac',  bet:'A',
    desc:'HKJC h > Mac, a > Mac AND lean < 48%',
    cond:function(r){ if(!bcrMacauOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH>r.ASIAHMAC && r.ASIAA>r.ASIAAMAC && L<0.48; } },
  { id:'R4', book:'Mac',  bet:'H',
    desc:'HKJC h > Mac, a > Mac AND lean > 52%',
    cond:function(r){ if(!bcrMacauOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH>r.ASIAHMAC && r.ASIAA>r.ASIAAMAC && L>0.52; } },
  { id:'R5', book:'SBO',  bet:'A',
    desc:'HKJC h > SBO, a < SBO AND lean < 52%',
    cond:function(r){ if(!bcrSboOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH>r.ASIAHSBO && r.ASIAA<r.ASIAASBO && L<0.52; } },
  { id:'R6', book:'SBO',  bet:'H',
    desc:'HKJC h < SBO, a > SBO AND lean > 52%',
    cond:function(r){ if(!bcrSboOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH<r.ASIAHSBO && r.ASIAA>r.ASIAASBO && L>0.52; } },
  { id:'R7', book:'Both', bet:'A',
    desc:'HKJC h > both, a < both (any lean)',
    cond:function(r){ if(!bcrBothOk(r)) return false;
      return r.ASIAH>r.ASIAHMAC && r.ASIAH>r.ASIAHSBO && r.ASIAA<r.ASIAAMAC && r.ASIAA<r.ASIAASBO; } },
  { id:'R8', book:'Both', bet:'H',
    desc:'HKJC h < both, a > both AND lean > 52%',
    cond:function(r){ if(!bcrBothOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAH<r.ASIAHMAC && r.ASIAH<r.ASIAHSBO && r.ASIAA>r.ASIAAMAC && r.ASIAA>r.ASIAASBO && L>0.52; } },
  { id:'R9',  book:'Mac vs SBO', bet:'A',
    desc:'Macau h > SBO h, Macau a < SBO a AND lean < 48%',
    cond:function(r){ if(!bcrBothOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAHMAC>r.ASIAHSBO && r.ASIAAMAC<r.ASIAASBO && L<0.48; } },
  { id:'R10', book:'Mac vs SBO', bet:'H',
    desc:'Macau h > SBO h, Macau a < SBO a AND lean > 52%',
    cond:function(r){ if(!bcrBothOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAHMAC>r.ASIAHSBO && r.ASIAAMAC<r.ASIAASBO && L>0.52; } },
  { id:'R11', book:'Mac vs SBO', bet:'A',
    desc:'Macau h < SBO h, Macau a > SBO a AND lean < 48%',
    cond:function(r){ if(!bcrBothOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAHMAC<r.ASIAHSBO && r.ASIAAMAC>r.ASIAASBO && L<0.48; } },
  { id:'R12', book:'Mac vs SBO', bet:'H',
    desc:'Macau h < SBO h, Macau a > SBO a AND lean > 52%',
    cond:function(r){ if(!bcrBothOk(r)) return false; var L=bcrLean(r); if(L==null) return false;
      return r.ASIAHMAC<r.ASIAHSBO && r.ASIAAMAC>r.ASIAASBO && L>0.52; } }
];

// ── Compute ───────────────────────────────────────────────────────────────
function computeBookRules(allRecords){
  var settled=allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });
  var upcoming=allRecords.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });

  // Per-rule performance on settled
  var perRule = BCR_RULES.map(function(rule){
    var rows=settled.filter(rule.cond);
    // chronological order for L50
    rows.sort(function(a,b){
      var ta=(a.DATE||'')+(a.TIME||''), tb=(b.DATE||'')+(b.TIME||'');
      return ta<tb?-1:ta>tb?1:0;
    });
    var pH=0,pA=0,hc=0,n=rows.length;
    rows.forEach(function(r){ pH+=bcrPnl(r,'H'); pA+=bcrPnl(r,'A'); hc+=bcrHCover(r); });
    var roiBet = n? (rule.bet==='H'?pH:pA)/n*100 : null;
    var roiOther = n? (rule.bet==='H'?pA:pH)/n*100 : null;
    // L50: last 50 chronologically, bet-side ROI
    var L50=null;
    if(n>=50){
      var last50=rows.slice(n-50);
      var s=0; last50.forEach(function(r){ s+=bcrPnl(r, rule.bet); });
      L50 = (s/50)*100;
    } else if(n>0){
      var s2=0; rows.forEach(function(r){ s2+=bcrPnl(r, rule.bet); });
      L50 = (s2/n)*100; // fallback: all available if <50
    }
    return { rule:rule, n:n, roiBet:roiBet, roiOther:roiOther, L50:L50,
             hcover: n?Math.round(hc/n*100):null,
             matches: rows };
  });

  // Strongest-rule-per-match map for combined performance
  // If multiple rules fire on a settled match, take the one with highest historic roiBet.
  // (Bets should agree by construction, but in case of conflict the strongest wins.)
  function rulesForMatch(r){
    var fired=[];
    BCR_RULES.forEach(function(rule, i){
      if(rule.cond(r)) fired.push({rule:rule, idx:i, roi:perRule[i].roiBet||0});
    });
    return fired;
  }

  // Build chronological combined history (each unique match that fires ≥1 rule)
  var combined=[];
  settled.forEach(function(r){
    var fired=rulesForMatch(r);
    if(!fired.length) return;
    fired.sort(function(a,b){ return (b.roi||-99)-(a.roi||-99); });
    var best=fired[0].rule;
    combined.push({ r:r, rules:fired, bet:best.bet,
      pnl: bcrPnl(r, best.bet),
      otherPnl: bcrPnl(r, best.bet==='H'?'A':'H'),
      ts:(r.DATE||'')+' '+(r.TIME||'') });
  });
  combined.sort(function(a,b){ return a.ts<b.ts?-1:a.ts>b.ts?1:0; });

  // Running ROI and moving averages
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

  // Upcoming alerts
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
    perRule: perRule,
    combined: combined,
    roiPts: roiPts, ma50:ma50, ma100:ma100,
    lastRoi: roiPts.length? roiPts[roiPts.length-1] : null,
    L50: lastN(50), L100: lastN(100), L200: lastN(200),
    upcomingAlerts: upcomingAlerts,
    settledCount: settled.length,
    upcomingCount: upcoming.length
  };
}

// ── Render ────────────────────────────────────────────────────────────────
function renderBookRules(RD){
  var el=document.getElementById('tab17'); if(!el) return;
  var br = RD.bookrules || (RD.bookrules = computeBookRules(RD.records||RD.results||[]));
  var h='';

  h+='<div class="rpt-title">📚 Book Compare Rules</div>';
  h+='<div class="rpt-sub">Eight price-pattern rules combining HKJC\'s actual odds vs Macau / SBO with HKJC\'s market lean. '
   +'Each rule prescribes a bet side (HKJC odds). Latest odds only; lines must match across the relevant books. '
   +'Click a row in the upcoming alerts to expand details. ROI on flat stakes.</div>';

  function roiBadge(roi, n){
    if(roi==null) return '<span style="color:#475569">—</span>';
    var col = roi>=0?'#4ade80':roi>=-2?'#fbbf24':'#f87171';
    return '<span style="color:'+col+';font-weight:700;font-family:var(--mono);font-size:13px">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
      + ' <span style="color:#475569;font-size:11px;font-family:var(--mono)">n'+n+'</span>';
  }

  // ── Rule reference table ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📋 Rule Reference</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
    +'<th>Rule</th><th>Book Scope</th><th>Condition</th><th class="num">Bet</th>'
    +'<th class="num">N</th><th class="num">Bet ROI</th><th class="num" style="color:#fbbf24">L50 ROI</th>'
    +'<th class="num">Other ROI</th><th class="num">Edge</th><th class="num">Verdict</th>'
    +'</tr></thead><tbody>';
  br.perRule.forEach(function(pr){
    var rule=pr.rule;
    var edge = (pr.roiBet!=null && pr.roiOther!=null) ? pr.roiBet - pr.roiOther : null;
    var verdict;
    if(pr.roiBet==null) verdict = '<span style="color:#475569">—</span>';
    else if(pr.roiBet>=2) verdict = '<span style="color:#4ade80;font-weight:700">✓ PROFITABLE</span>';
    else if(pr.roiBet>=-1) verdict = '<span style="color:#fbbf24">~ NEAR EVEN</span>';
    else verdict = '<span style="color:#f87171">~ tilt only</span>';
    var bCol = rule.bet==='H'?'#f87171':'#60a5fa';
    // L50 cell coloured by sign
    var L50cell;
    if(pr.L50==null) L50cell = '<span style="color:#475569">—</span>';
    else {
      var l50col = pr.L50>=0?'#4ade80':pr.L50>=-2?'#fbbf24':'#f87171';
      var l50N = pr.n>=50?'50':pr.n;
      L50cell = '<span style="color:'+l50col+';font-weight:700;font-family:var(--mono)">'+(pr.L50>=0?'+':'')+pr.L50.toFixed(1)+'%</span>'
        + ' <span style="color:#475569;font-size:10px;font-family:var(--mono)">n'+l50N+'</span>';
    }
    h+='<tr><td><b>'+rule.id+'</b></td>'
      +'<td style="color:#94a3b8">'+rule.book+'</td>'
      +'<td style="color:#e2e8f0;font-size:12px">'+rule.desc+'</td>'
      +'<td class="num"><b style="color:'+bCol+';font-size:15px">'+rule.bet+'</b></td>'
      +'<td class="num" style="font-family:var(--mono);color:#64748b">'+pr.n+'</td>'
      +'<td class="num">'+roiBadge(pr.roiBet, pr.n)+'</td>'
      +'<td class="num">'+L50cell+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#64748b;font-size:12px">'+(pr.roiOther==null?'—':(pr.roiOther>=0?'+':'')+pr.roiOther.toFixed(1)+'%')+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(edge==null?'—':'+'+edge.toFixed(1)+'pp')+'</td>'
      +'<td class="num">'+verdict+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:11px;color:#475569;margin-top:4px">Edge = Bet ROI − Other-side ROI. ✓ PROFITABLE = ≥+2%. ~ NEAR EVEN = −1% to +2%. Lower = directional tilt only.</div>';
  h+='</div>';

  // ── Upcoming alerts ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">🎯 Upcoming Matches — Rule Alerts</div>';
  if(!br.upcomingAlerts.length){
    h+='<div style="padding:12px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently fire any rule.</div>';
  } else {
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">HKJC H/A</th><th class="num">Lean</th>'
      +'<th class="num">Bet</th><th>Rules Fired</th>'
      +'</tr></thead><tbody>';
    br.upcomingAlerts.forEach(function(al, ai){
      var r=al.r, detId='br_up_'+ai;
      var bCol=al.bet==='H'?'#f87171':'#60a5fa';
      var teamH = al.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':r.TEAMH;
      var teamA = al.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':r.TEAMA;
      var lean=bcrLean(r);
      var l=parseFloat(r.ASIALINE)||0;
      var lineStr=(l>=0?'+':'')+l.toFixed(2);
      var ruleBadges=al.rules.map(function(f){
        var bgc = f.rule.bet==='H'?'rgba(248,113,113,0.15)':'rgba(96,165,250,0.15)';
        var fgc = f.rule.bet==='H'?'#f87171':'#60a5fa';
        return '<span style="display:inline-block;padding:2px 7px;margin:1px 2px;border-radius:3px;font-size:11px;background:'+bgc+';color:'+fgc+';font-weight:700">'+f.rule.id+'</span>';
      }).join('');
      h+='<tr style="cursor:pointer" onclick="brToggle(\''+detId+'\')">'
        +'<td style="color:#94a3b8;font-size:12px">'+(r.DATE||'—')+' '+(r.TIME||'')+'</td>'
        +'<td style="font-size:13px">'+teamH+' vs '+teamA+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:13px">'+lineStr+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:12px">'+r.ASIAH.toFixed(2)+' / '+r.ASIAA.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8;font-size:12px">'+(lean==null?'—':(lean*100).toFixed(1)+'%')+'</td>'
        +'<td class="num"><b style="color:'+bCol+';font-size:17px">'+al.bet+'</b></td>'
        +'<td>'+ruleBadges+'</td></tr>';
      // Expanded details: 6 expert picks + signal bar + book odds + rules fired
      var tipFields=[['JC Sum','JCTIPSUM'],['JC SID','JCTIPSID'],['SID Mac','TIPSIDMAC'],['ON ID','TIPSONID'],['Gem','TIPSGEM'],['GPT','TIPSGPT']];
      var tipBadges=tipFields.map(function(tf){
        var v=r[tf[1]];
        var c=!v?'#475569':(String(v).indexOf('H')>=0?'#f87171':String(v).indexOf('A')>=0?'#60a5fa':'#4ade80');
        return '<span style="font-size:11px;font-family:var(--mono);padding:3px 9px;border-radius:4px;background:'+c+'22;border:1px solid '+c+'44"><span style="color:#64748b;font-size:10px">'+tf[0]+':</span> <span style="color:'+c+';font-weight:700">'+(v||'—')+'</span></span>';
      }).join(' ');
      // Signal bar from expertScore — H% / D% / A% stacked
      var es = (typeof expertScore==='function') ? expertScore(r) : null;
      var signalBar='';
      if(es){
        signalBar = '<div style="margin-top:8px;margin-bottom:4px">'
          +'<div style="font-size:10px;color:#94a3b8;margin-bottom:3px">Expert Signal: '
          +'<span style="color:#f87171;font-weight:700">H '+es.h+'%</span> · '
          +'<span style="color:#4ade80;font-weight:700">D '+es.d+'%</span> · '
          +'<span style="color:#60a5fa;font-weight:700">A '+es.a+'%</span></div>'
          +'<div style="display:flex;height:10px;width:100%;border-radius:3px;overflow:hidden;background:#1e293b">'
          +(es.h>0?'<div style="width:'+es.h+'%;background:#f87171"></div>':'')
          +(es.d>0?'<div style="width:'+es.d+'%;background:#4ade80"></div>':'')
          +(es.a>0?'<div style="width:'+es.a+'%;background:#60a5fa"></div>':'')
          +'</div></div>';
      }
      var det='<div style="font-size:12px;color:#94a3b8;padding:10px 14px">';
      det+='<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Six Expert Picks</div>';
      det+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">'+tipBadges+'</div>';
      det+=signalBar;
      det+='<div style="margin-top:10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">Book Odds</div>';
      det+='<div style="font-size:12px"><b>HKJC:</b> H '+r.ASIAH.toFixed(2)+' / A '+r.ASIAA.toFixed(2)+'</div>';
      if(bcrNz(r,'ASIAHMAC')) det+='<div style="font-size:12px"><b>Macau:</b> H '+r.ASIAHMAC.toFixed(2)+' / A '+r.ASIAAMAC.toFixed(2)+'</div>';
      if(bcrNz(r,'ASIAHSBO')) det+='<div style="font-size:12px"><b>SBO:</b> H '+r.ASIAHSBO.toFixed(2)+' / A '+r.ASIAASBO.toFixed(2)+'</div>';
      det+='<div style="margin-top:10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">Rules Fired</div>';
      al.rules.forEach(function(f){ det+='<div style="margin-left:8px;font-size:12px">• <b>'+f.rule.id+'</b>: '+f.rule.desc+' → bet <b>'+f.rule.bet+'</b> (historic '+f.roi.toFixed(1)+'%)</div>'; });
      det+='</div>';
      h+='<tr id="'+detId+'" style="display:none"><td colspan="7" style="background:rgba(15,23,42,0.5);padding:0">'+det+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';

  // ── Historic Performance: ROI chart ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📈 Historic Performance — Combined (any rule fires)</div>';
  if(br.combined.length<20){
    h+='<div style="padding:12px;color:#475569;font-size:12px;font-style:italic">Not enough settled history to chart.</div>';
  } else {
    function fl(v){ if(v==null) return ''; return ' <span style="color:'+(v>=0?'#4ade80':'#f87171')+';font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:10px;font-size:13px">'
      +'<span style="color:#94a3b8">L200:'+fl(br.L200)+'</span>'
      +'<span style="color:#94a3b8">L100:'+fl(br.L100)+'</span>'
      +'<span style="color:#94a3b8">L50:'+fl(br.L50)+'</span>'
      +'<span style="color:#94a3b8">All-time:'+fl(br.lastRoi)+'</span>'
      +'<span style="color:#475569">| Total bets: '+br.combined.length+'</span>'
      +'</div>';
    h+='<div id="lgdBrRoi" style="font-size:12px;margin-bottom:6px"></div>';
    h+='<canvas id="cBrRoi" style="width:100%;height:150px"></canvas>';
    setTimeout(function(){
      var series=[
        {label:'Running ROI%'+fl(br.lastRoi),color:'#fb923c',pts:br.roiPts},
        {label:'MA-50',color:'#60a5fa',pts:br.ma50.slice(50)},
        {label:'MA-100',color:'#a78bfa',pts:br.ma100.slice(100)}
      ];
      if(typeof makeLegend==='function') makeLegend('lgdBrRoi',series);
      if(typeof drawChart==='function') drawChart('cBrRoi',series,null,150);
    },40);
  }
  h+='</div>';

  // ── Past bets table (last 200) ──
  if(br.combined.length){
    h+='<div style="margin-bottom:18px">';
    function rb(v){ if(v==null) return '<span style="color:#475569">—</span>'; var c=v>=0?'#4ade80':'#f87171'; return '<span style="color:'+c+';font-weight:700;font-family:var(--mono)">'+(v>=0?'+':'')+v.toFixed(1)+'%</span>'; }
    h+='<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:14px;margin-bottom:4px">'
      +'<div class="rpt-title" style="font-size:16px;margin:0">📜 Past Bets (most recent 200)</div>'
      +'<span style="font-size:13px;color:#94a3b8">All-time: '+rb(br.lastRoi)+'</span>'
      +'<span style="font-size:13px;color:#94a3b8">L200: '+rb(br.L200)+'</span>'
      +'<span style="font-size:13px;color:#94a3b8">L100: '+rb(br.L100)+'</span>'
      +'<span style="font-size:13px;color:#94a3b8">L50: '+rb(br.L50)+'</span>'
      +'</div>';
    h+='<div class="rpt-sub" style="margin-bottom:6px">Settled matches that fired any rule. Bet = direction from highest-ROI rule for that match.</div>';
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
      var teamH = b.bet==='H'?'<b style="color:#f87171">'+(r.TEAMH||'')+'</b>':r.TEAMH;
      var teamA = b.bet==='A'?'<b style="color:#60a5fa">'+(r.TEAMA||'')+'</b>':r.TEAMA;
      var rids = b.rules.map(function(f){ return f.rule.id; }).join(',');
      var l=parseFloat(r.ASIALINE)||0;
      h+='<tr>'
        +'<td style="color:#94a3b8;font-size:11px">'+(r.DATE||'')+'</td>'
        +'<td style="font-size:12px">'+teamH+' vs '+teamA+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:11px">'+(l>=0?'+':'')+l.toFixed(2)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:11px;color:#94a3b8">'+r.RESULTH+'-'+r.RESULTA+'</td>'
        +'<td class="num"><b style="color:'+bCol+';font-size:14px">'+b.bet+'</b></td>'
        +'<td style="font-size:11px;color:#94a3b8">'+rids+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:12px;color:'+(b.pnl>=0?'#4ade80':'#f87171')+'">'+(b.pnl>=0?'+':'')+b.pnl.toFixed(2)+'</td>'
        +'<td class="num" style="font-size:14px">'+hit+'</td></tr>';
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:11px;color:#475569;margin-top:4px">Hit: ✅✅ win · ✅ half-win · ⬜ push · ❌ half-loss · ❌❌ loss.</div>';
    h+='</div>';
  }

  el.innerHTML = h;
}

// Expand/collapse helper for the upcoming alerts
window.brToggle = function(id){
  var row=document.getElementById(id);
  if(!row) return;
  // Use the computed/inline display — empty string means expanded (default flow), 'none' means hidden.
  if(row.style.display==='none'){ row.style.display=''; }
  else { row.style.display='none'; }
};
