// Book Rules 2 — the 12 base rules from Book Rules, restricted to matches where the
// 6 experts have NO unique majority direction ("tied" expert signal). Empirically, this
// sub-condition consistently boosts the bet-side ROI by removing crowd-confirmed lines.
//
// All helper functions (bcrPnl, bcrLean, bcrExpSignal, etc.) are loaded by report-bookrules.js
// which is included before this file in report.html.

// Two helpers using DIFFERENT signal classifications, each appropriate for its variant:
//
// (1) br2ExpDirection(r) — replicates front-page expertLead() EXACTLY, including the
//     GEM/GPT weighted-vote scoring (GEMH/GPTH etc. raw counts). Used for counter-signal
//     variants. Returns 'H' / 'D' / 'A' (or null if no expert data). Selecting any rule + 
//     "H highest" expert filter on the front page produces the same sample set as the
//     R{n}-ctr variants here.
function br2ExpDirection(r){
  function ts(v){if(!v)return null;var u=String(v).toUpperCase();
    if(u==='H'||u==='1H'||u==='AH')return'H';
    if(u==='D'||u==='1D'||u==='AD')return'D';
    if(u==='A'||u==='1A'||u==='AA')return'A';
    return null;}
  var th=(ts(r.JCTIPSUM)==='H'?1:0)+(ts(r.JCTIPSID)==='H'?1:0)+(ts(r.TIPSIDMAC)==='H'?1:0)+(ts(r.TIPSONID)==='H'?1:0)+(r.GEMH||0)+(r.GPTH||0);
  var td=(ts(r.JCTIPSUM)==='D'?1:0)+(ts(r.JCTIPSID)==='D'?1:0)+(ts(r.TIPSIDMAC)==='D'?1:0)+(ts(r.TIPSONID)==='D'?1:0)+(r.GEMD||0)+(r.GPTD||0);
  var ta=(ts(r.JCTIPSUM)==='A'?1:0)+(ts(r.JCTIPSID)==='A'?1:0)+(ts(r.TIPSIDMAC)==='A'?1:0)+(ts(r.TIPSONID)==='A'?1:0)+(r.GEMA||0)+(r.GPTA||0);
  var tt=th+td+ta;
  if(!tt) return null;
  // ties resolve H, D, A in order (matches helpers.js → expertLead exactly)
  if(th>=td && th>=ta) return 'H';
  if(td>=th && td>=ta) return 'D';
  return 'A';
}

// (2) br2ExpTied(r) — strict-majority-tie via simple 1-vote-per-field counting across the
//     six expert sources (JC Sum/SID/Mac/ON ID + Gem + GPT). Captures the "no clear
//     majority" cases. This is a separate signal definition from the front-page filter
//     and has no direct front-page equivalent — it's used here because the original
//     "tied = boost" finding was based on this counting.
function br2ExpTied(r){
  var keys=['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID','TIPSGEM','TIPSGPT'];
  var h=0,a=0,d=0;
  for(var i=0;i<keys.length;i++){
    var v=String(r[keys[i]]||'').toUpperCase();
    if(v.indexOf('H')>=0) h++;
    else if(v.indexOf('A')>=0) a++;
    else if(v.indexOf('D')>=0||v==='X') d++;
  }
  // returns true when no strict majority direction exists
  return !(h>a&&h>d) && !(a>h&&a>d) && !(d>h&&d>a);
}

// For each base rule, generate TWO separate rules:
//   • base + experts tied (no unique majority)
//   • base + experts counter (majority opposite to rule's bet)
// Both cases isolate matches where the crowd does NOT confirm the rule's bet direction,
// but they capture different sub-populations and have distinct historical performance.
var BR2_RULES = [];
BCR_RULES.forEach(function(rule){
  var opposite = rule.bet==='H' ? 'A' : 'H';
  // Variant 1: tied (strict-majority-tie via 6-field simple counting)
  BR2_RULES.push({
    id: rule.id+'-tied',
    base: rule.id,
    variant: 'tied',
    book: rule.book,
    bet: rule.bet,
    desc: rule.desc + ' • experts tied (no strict majority)',
    cond: function(r){ return rule.cond(r) && br2ExpTied(r); }
  });
  // Variant 2: counter (matches front-page "{opposite} highest" filter exactly)
  BR2_RULES.push({
    id: rule.id+'-ctr',
    base: rule.id,
    variant: 'counter',
    book: rule.book,
    bet: rule.bet,
    desc: rule.desc + ' • experts pick '+opposite+' (counter — matches front-page "'+opposite+' highest")',
    cond: function(r){ return rule.cond(r) && br2ExpDirection(r)===opposite; }
  });
});

// Build a sortable timestamp key from DATE (YYYY-MM-DD) + TIME (numeric, e.g. 700, 1000).
// TIME is zero-padded to 4 digits so '0700' sorts before '1000' (raw concat sorts wrong).
function brSortKey(r){
  var t = r.TIME==null ? '0000' : String(r.TIME);
  while(t.length<4) t = '0'+t;
  return (r.DATE||'') + t;
}

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
    var L50=null, L100=null;
    if(n>=50){
      var last50=rows.slice(n-50);
      var s=0; last50.forEach(function(r){ s+=bcrPnl(r, rule.bet); });
      L50 = (s/50)*100;
    } else if(n>0){
      var s2=0; rows.forEach(function(r){ s2+=bcrPnl(r, rule.bet); });
      L50 = (s2/n)*100;
    }
    if(n>=100){
      var last100=rows.slice(n-100);
      var s100=0; last100.forEach(function(r){ s100+=bcrPnl(r, rule.bet); });
      L100 = (s100/100)*100;
    } else if(n>0){
      var s2b=0; rows.forEach(function(r){ s2b+=bcrPnl(r, rule.bet); });
      L100 = (s2b/n)*100;
    }
    return { rule:rule, n:n, roiBet:roiBet, roiOther:roiOther, L50:L50, L100:L100,
             hcover: n?Math.round(hc/n*100):null, matches:rows };
  });

  function rulesForMatch(r){
    var fired=[];
    BR2_RULES.forEach(function(rule,i){
      if(rule.cond(r)) fired.push({rule:rule, idx:i, roi:perRule[i].roiBet||0, n:perRule[i].n});
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
    var ta=brSortKey(a.r), tb=brSortKey(b.r);
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

  h+='<div class="rpt-title">📚 Book Rules 2 — Rules × Expert Signal Variants</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">Each of the 12 base Book Rules generates <b>two separate variants</b> based on the expert signal (from the 6 experts: JC Sum/SID/Mac/ON ID + Gem + GPT): '
   +'<b>X-tied</b> (no unique majority among experts) and <b>X-ctr</b> (experts pick the opposite direction from the rule). '
   +'These are tracked separately because they capture different sub-populations — "tied" reflects market ambiguity, "counter" reflects active disagreement between book signal and crowd. '
   +'Cases where experts confirm the rule\'s bet or pick D are excluded.</div>';

  function roiBadge(roi, n){
    if(roi==null) return '<span style="color:#cbd5e1">—</span>';
    var col = roi>=4?'#4ade80':roi>=2?'#84cc16':roi>=-1?'#fbbf24':'#f87171';
    return '<span style="color:'+col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
      + ' <span style="color:#cbd5e1;font-size:12px;font-family:var(--mono)">n'+n+'</span>';
  }

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
        var roi=f.roi;
        var roiCol=roi>=0?'#4ade80':'#fca5a5';
        var roiTxt=(roi==null)?'':' <span style="color:'+roiCol+';font-size:12px;font-family:var(--mono)">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
          +(f.n!=null?' <span style="color:#cbd5e1;font-size:10px;font-family:var(--mono)">n'+f.n+'</span>':'');
        return '<span style="display:inline-block;padding:4px 10px;margin:2px 3px;border-radius:4px;font-size:14px;background:'+bgc+';color:'+fgc+';font-weight:700">'+f.rule.id+roiTxt+'</span>';
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
      al.rules.forEach(function(f){ det+='<div style="margin-left:8px;font-size:12px">• <b>'+f.rule.id+'</b>: '+f.rule.desc+' → bet <b>'+f.rule.bet+'</b> (historic '+(f.roi>=0?'+':'')+f.roi.toFixed(1)+'%, n='+(f.n!=null?f.n:'—')+')</div>'; });
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
      // Zoom to last 100 bets (or all if fewer). MA-50 & MA-100 series also sliced
      // to the same recent window for visual alignment.
      var Z = 100;
      function tail(arr, n){ return arr.length>n ? arr.slice(arr.length-n) : arr; }
      var series=[
        {label:'Running ROI%'+fl(br.lastRoi),color:'#fb923c',pts:tail(br.roiPts, Z)},
        {label:'MA-50',color:'#60a5fa',pts:tail(br.ma50.slice(50), Z)},
        {label:'MA-100',color:'#a78bfa',pts:tail(br.ma100.slice(100), Z)}
      ];
      if(typeof makeLegend==='function') makeLegend('lgdBr2Roi',series);
      if(typeof drawChart==='function') drawChart('cBr2Roi',series,null,150);
    },40);
  }
  h+='</div>';

  // Rule Reference table
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:16px">📋 Rule Reference</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:13px"><thead><tr>'
    +'<th>Rule</th><th>Book</th><th>Condition</th><th class="num">Bet</th>'
    +'<th class="num">N</th><th class="num">Bet ROI</th><th class="num" style="color:#facc15">L100 ROI</th><th class="num" style="color:#fbbf24">L50 ROI</th>'
    +'<th class="num">Other ROI</th><th class="num">Edge</th><th class="num">Verdict</th>'
    +'</tr></thead><tbody>';
  br.perRule.forEach(function(pr, ri){
    var rule=pr.rule;
    var detId='br2_rule_'+ri;
    var edge = (pr.roiBet!=null && pr.roiOther!=null) ? pr.roiBet - pr.roiOther : null;
    var verdict;
    if(pr.roiBet==null||pr.n<15) verdict='<span style="color:#cbd5e1">— small sample</span>';
    else if(pr.roiBet>=4) verdict='<span style="color:#4ade80;font-weight:700">⭐ STRONG</span>';
    else if(pr.roiBet>=2) verdict='<span style="color:#84cc16;font-weight:700">✓ profitable</span>';
    else if(pr.roiBet>=-1) verdict='<span style="color:#fbbf24">~ near even</span>';
    else verdict='<span style="color:#f87171">tilt only</span>';
    var bCol=rule.bet==='H'?'#f87171':'#60a5fa';
    var L100cell;
    if(pr.L100==null) L100cell='<span style="color:#cbd5e1">—</span>';
    else {
      var l100col=pr.L100>=0?'#4ade80':pr.L100>=-2?'#facc15':'#f87171';
      var l100N=pr.n>=100?'100':pr.n;
      L100cell='<span style="color:'+l100col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(pr.L100>=0?'+':'')+pr.L100.toFixed(1)+'%</span>'
        +' <span style="color:#cbd5e1;font-size:11px;font-family:var(--mono)">n'+l100N+'</span>';
    }
    var L50cell;
    if(pr.L50==null) L50cell='<span style="color:#cbd5e1">—</span>';
    else {
      var l50col=pr.L50>=0?'#4ade80':pr.L50>=-2?'#fbbf24':'#f87171';
      var l50N=pr.n>=50?'50':pr.n;
      L50cell='<span style="color:'+l50col+';font-weight:700;font-family:var(--mono);font-size:14px">'+(pr.L50>=0?'+':'')+pr.L50.toFixed(1)+'%</span>'
        +' <span style="color:#cbd5e1;font-size:11px;font-family:var(--mono)">n'+l50N+'</span>';
    }
    h+='<tr style="cursor:pointer" onclick="br2Toggle(\''+detId+'\')"><td><b>'+rule.id+'</b> <span style="color:#94a3b8;font-size:11px">▾</span></td>'
      +'<td style="color:#e2e8f0">'+rule.book+'</td>'
      +'<td style="color:#e2e8f0;font-size:12px">'+rule.desc+'</td>'
      +'<td class="num"><b style="color:'+bCol+';font-size:15px">'+rule.bet+'</b></td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1">'+pr.n+'</td>'
      +'<td class="num">'+roiBadge(pr.roiBet, pr.n)+'</td>'
      +'<td class="num">'+L100cell+'</td>'
      +'<td class="num">'+L50cell+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#cbd5e1;font-size:12px">'+(pr.roiOther==null?'—':(pr.roiOther>=0?'+':'')+pr.roiOther.toFixed(1)+'%')+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+(edge==null?'—':'+'+edge.toFixed(1)+'pp')+'</td>'
      +'<td class="num">'+verdict+'</td></tr>';
    // Expanded condition detail row
    var eligDesc;
    if(rule.book==='Mac')      eligDesc='HKJC odds + Macau odds present, HKJC line = Macau line';
    else if(rule.book==='SBO') eligDesc='HKJC odds + SBO odds present, HKJC line = SBO line';
    else                       eligDesc='HKJC + Macau + SBO odds all present, all three lines equal';
    var baseCond = rule.desc.replace(/ • experts tied or opposite$/,'');
    var oppSide = rule.bet==='H' ? 'A' : 'H';
    var det='<div style="font-size:13px;color:#e2e8f0;padding:14px 22px;line-height:1.7">';
    det+='<div style="font-weight:700;color:#fbbf24;font-size:15px;margin-bottom:10px">📋 Full Rule Condition — '+rule.id+'</div>';
    det+='<div style="margin-bottom:6px"><b style="color:#a78bfa">Scope:</b> '+rule.book+' &nbsp;·&nbsp; <b style="color:#a78bfa">Bet side:</b> <b style="color:'+bCol+';font-size:16px">'+rule.bet+'</b></div>';
    det+='<div style="margin-bottom:6px"><b style="color:#a78bfa">Eligibility:</b> '+eligDesc+'</div>';
    det+='<div style="margin:10px 0;padding:8px 12px;background:rgba(15,23,42,0.6);border-left:3px solid #fbbf24;border-radius:4px">';
    det+='<div style="margin-bottom:4px"><b style="color:#fbbf24">① Book-comparison condition:</b></div>';
    det+='<div style="margin-left:14px;font-family:var(--mono);color:#cbd5e1">'+baseCond+'</div></div>';
    det+='<div style="margin:10px 0;padding:8px 12px;background:rgba(15,23,42,0.6);border-left:3px solid #fbbf24;border-radius:4px">';
    det+='<div style="margin-bottom:4px"><b style="color:#fbbf24">② Expert-signal condition:</b></div>';
    det+='<div style="margin-left:14px;color:#cbd5e1">Experts are <b style="color:#a78bfa">tied</b> (no unique majority) OR experts pick <b style="color:'+(oppSide==='H'?'#f87171':'#60a5fa')+'">'+oppSide+'</b> (opposite of rule\'s bet)</div>';
    det+='<div style="margin-left:14px;color:#94a3b8;font-size:11px;margin-top:3px">Excluded: experts confirm the rule\'s bet ('+(rule.bet)+'-majority), or experts pick D-majority.</div></div>';
    det+='<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)"><b style="color:#fbbf24">📊 Historic Performance</b></div>';
    det+='<div style="margin-top:6px;display:flex;gap:24px;flex-wrap:wrap;font-size:13px">';
    det+='<div><b style="color:#a78bfa">Total matches:</b> '+pr.n+'</div>';
    det+='<div><b style="color:#a78bfa">Bet '+rule.bet+' ROI:</b> '+(pr.roiBet==null?'—':((pr.roiBet>=0?'+':'')+pr.roiBet.toFixed(1)+'%'))+'</div>';
    det+='<div><b style="color:#a78bfa">Other side ROI:</b> '+(pr.roiOther==null?'—':((pr.roiOther>=0?'+':'')+pr.roiOther.toFixed(1)+'%'))+'</div>';
    det+='<div><b style="color:#a78bfa">Edge:</b> '+(edge==null?'—':((edge>=0?'+':'')+edge.toFixed(1)+'pp'))+'</div>';
    if(pr.L50!=null) det+='<div><b style="color:#a78bfa">L50 ROI:</b> '+((pr.L50>=0?'+':'')+pr.L50.toFixed(1))+'%</div>';
    if(pr.hcover!=null) det+='<div><b style="color:#a78bfa">H-cover%:</b> '+pr.hcover+'%</div>';
    det+='</div>';
    det+='<div style="margin-top:12px;font-size:11px;color:#94a3b8;font-style:italic">Note: the front-page Smart Money 2 filter applies ONLY the base book-comparison condition (①). The expert-signal layer (②) shown here is added on top in this report. Both conditions together give the ROI displayed above.</div>';
    det+='</div>';
    h+='<tr id="'+detId+'" style="display:none"><td colspan="11" style="background:rgba(15,23,42,0.5);padding:0">'+det+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:11px;color:#cbd5e1;margin-top:4px">⭐ ROI ≥ +4%, ✓ ≥ +2%, ~ ≥ -1%, otherwise tilt only. Edge = Bet ROI − Other ROI.</div>';
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
      var rids=b.rules.map(function(f){
        var roiCol=(f.roi!=null&&f.roi>=0)?'#4ade80':'#fca5a5';
        var roiTxt=(f.roi==null)?'':' <span style="color:'+roiCol+';font-family:var(--mono);font-size:10px">'+(f.roi>=0?'+':'')+f.roi.toFixed(1)+'%</span>';
        return '<span style="white-space:nowrap">'+f.rule.id+roiTxt+'</span>';
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

window.br2Toggle = function(id){
  var row=document.getElementById(id);
  if(!row) return;
  if(row.style.display==='none'){ row.style.display=''; }
  else { row.style.display='none'; }
};
