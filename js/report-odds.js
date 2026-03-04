// ── report-odds.js — Tab 6: H vs A Bet — Odds Analysis ──
// Primary axis: AsiaLine value
// Cross-tabs: Market Lean, Expert Signal, Line Movement, Vig
// All segments require N >= MIN_N to be shown

var ODDS_MIN_N = 30;

// ── Helpers ──
function mktH(r){
  var h=r.ASIAH, a=r.ASIAA;
  if(!h||!a||h<=0||a<=0) return null;
  return Math.round((1/h)/(1/h+1/a)*1000)/10;
}
function vigPct(r){
  var h=r.ASIAH, a=r.ASIAA;
  if(!h||!a||h<=0||a<=0) return null;
  return Math.round((1/h+1/a-1)*1000)/10;
}
function lineDelta(r){
  var g=r.ASIALINE, l=r.ASIALINELN;
  if(g==null||l==null) return null;
  return Math.round((g-l)*100)/100;
}
function hOddsDelta(r){
  var g=r.ASIAH, l=r.ASIAHLN;
  if(!g||!l||g<=0||l<=0) return null;
  return Math.round((g-l)*1000)/1000;
}
function lineFmt(v){ return (v>0?'+':'')+v; }

// ── Cross-tab filter definitions ──
// For each AsiaLine value, these sub-filters are applied
var oddsSubFilters = [

  // A: Market Lean
  { key:'mkt_h',  group:'Market Lean',  label:'H-favored (implied >55%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>55; } },
  { key:'mkt_bal',group:'Market Lean',  label:'Balanced (45–55%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>=45 && m<=55; } },
  { key:'mkt_a',  group:'Market Lean',  label:'A-favored (implied <45%)',
    fn: function(r){ var m=mktH(r); return m!==null && m<45; } },

  // B: Expert Signal
  { key:'exp_h67',group:'Expert Signal', label:'Expert H ≥67%',
    fn: function(r){ var e=expertScore(r); return e&&e.h>=67; } },
  { key:'exp_h50',group:'Expert Signal', label:'Expert H ≥50%',
    fn: function(r){ var e=expertScore(r); return e&&e.h>=50; } },
  { key:'exp_a50',group:'Expert Signal', label:'Expert A ≥50%',
    fn: function(r){ var e=expertScore(r); return e&&e.a>=50; } },
  { key:'exp_a67',group:'Expert Signal', label:'Expert A ≥67%',
    fn: function(r){ var e=expertScore(r); return e&&e.a>=67; } },

  // C: Line Movement
  { key:'lm_rose',   group:'Line Movement', label:'Line Rose (market backed H)',
    fn: function(r){ var d=lineDelta(r); return d!==null && d>0; } },
  { key:'lm_flat',   group:'Line Movement', label:'Line Flat',
    fn: function(r){ var d=lineDelta(r); return d!==null && d===0; } },
  { key:'lm_drop',   group:'Line Movement', label:'Line Dropped (market backed A)',
    fn: function(r){ var d=lineDelta(r); return d!==null && d<0; } },

  // D: Vig
  { key:'vig_low', group:'Vig', label:'Low Vig (<5%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v<5; } },
  { key:'vig_mid', group:'Vig', label:'Mid Vig (5–8%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v>=5 && v<=8; } },
  { key:'vig_high',group:'Vig', label:'High Vig (>8%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v>8; } },

  // E: Odds Drift (H price movement)
  { key:'drift_h', group:'Odds Drift', label:'H odds shortened (money on H)',
    fn: function(r){ var d=hOddsDelta(r); return d!==null && d>0.05; } },
  { key:'drift_a', group:'Odds Drift', label:'H odds drifted (money on A)',
    fn: function(r){ var d=hOddsDelta(r); return d!==null && d<-0.05; } },
];

function makeSeg(sub, key, group, lineVal, label, monthBounds){
  var n   = sub.length;
  var hr  = sub.map(cH).filter(function(x){return x!==null;});
  var ar  = sub.map(cA).filter(function(x){return x!==null;});
  var hroi = roiOf(hr);
  var aroi = roiOf(ar);
  return {
    key      : key,
    group    : group,
    lineVal  : lineVal,
    label    : label,
    n        : n,
    hroi     : hroi,
    aroi     : aroi,
    seriesH  : {label:'H bet', color:'#f87171', pts: runPnl(sub, cH)},
    seriesA  : {label:'A bet', color:'#60a5fa', pts: runPnl(sub, cA)},
  };
}

function computeOdds(results){
  // Lines with enough data to be useful
  var lineGroups = [];
  var allLines = [];
  results.forEach(function(r){ if(r.ASIALINE!=null && allLines.indexOf(r.ASIALINE)<0) allLines.push(r.ASIALINE); });
  allLines.sort(function(a,b){return a-b;});

  allLines.forEach(function(line){
    var lineSub = results.filter(function(r){ return r.ASIALINE===line; });
    if(lineSub.length < ODDS_MIN_N) return;  // skip thin lines

    // Overall segment for this line
    var overall = makeSeg(lineSub, 'overall', 'Overall', line, 'All matches');

    // Cross-tab segments — only include if N >= MIN_N
    var crossSegs = [];
    oddsSubFilters.forEach(function(sf){
      var sub2 = lineSub.filter(sf.fn);
      if(sub2.length < ODDS_MIN_N) return;
      crossSegs.push(makeSeg(sub2, sf.key, sf.group, line, sf.label));
    });

    // Group cross-segs by group label
    var groups = {};
    var groupOrder = [];
    crossSegs.forEach(function(s){
      if(!groups[s.group]){ groups[s.group]=[]; groupOrder.push(s.group); }
      groups[s.group].push(s);
    });

    lineGroups.push({
      line      : line,
      label     : lineFmt(line),
      n         : lineSub.length,
      overall   : overall,
      groups    : groups,
      groupOrder: groupOrder,
    });
  });

  return { lineGroups: lineGroups };
}

// ── Render ──
function renderOdds(d){
  var area = document.getElementById('oddsChartsArea');
  var html = '';

  d.odds.lineGroups.forEach(function(lg){
    // Section header for this AsiaLine
    html += '<div class="odds-line-header">Asia Line '
      + lg.label
      + ' <span class="odds-line-n">N='+lg.n+'</span>'
      + ' <span class="odds-line-roi">'
      + 'H: <span class="'+posNeg(lg.overall.hroi)+'">'+fmtRoi(lg.overall.hroi)+'</span>'
      + '  A: <span class="'+posNeg(lg.overall.aroi)+'">'+fmtRoi(lg.overall.aroi)+'</span>'
      + '</span>'
      + '</div>';

    // Overall chart for this line
    html += chartBox('cOdds_'+lg.line+'_overall', lg.overall);

    // Cross-tab groups
    lg.groupOrder.forEach(function(gname){
      html += '<div class="odds-group-label">'+gname+'</div>';
      lg.groups[gname].forEach(function(seg){
        html += chartBox('cOdds_'+lg.line+'_'+seg.key, seg);
      });
    });
  });

  area.innerHTML = html;

  // Draw all charts
  setTimeout(function(){
    d.odds.lineGroups.forEach(function(lg){
      drawOddsChart('cOdds_'+lg.line+'_overall', lg.overall, d.monthBounds);
      lg.groupOrder.forEach(function(gname){
        lg.groups[gname].forEach(function(seg){
          drawOddsChart('cOdds_'+lg.line+'_'+seg.key, seg, d.monthBounds);
        });
      });
    });
  }, 30);

  // Summary table
  var rows = '';
  d.odds.lineGroups.forEach(function(lg){
    // Overall row
    rows += tableRow(lg.label, 'Overall', lg.overall, true);
    // Cross-tab rows
    lg.groupOrder.forEach(function(gname){
      lg.groups[gname].forEach(function(seg){
        rows += tableRow(lg.label, gname+': '+seg.label, seg, false);
      });
    });
  });
  document.getElementById('tbOdds').innerHTML = rows;
}

function chartBox(id, seg){
  var edge    = seg.hroi - seg.aroi;
  var bestSide = edge>0
    ? '<span class="pos">H leads +'+Math.abs(edge).toFixed(1)+'%</span>'
    : '<span class="neg">A leads +'+Math.abs(edge).toFixed(1)+'%</span>';
  return '<div class="chart-box">'
    +'<div class="chart-box-label">'+seg.label
    +' (N='+seg.n+')'
    +' — H: '+fmtRoi(seg.hroi)+'  A: '+fmtRoi(seg.aroi)
    +'</div>'
    +'<div class="chart-legend">'
    +'<span><span class="ld" style="background:#f87171"></span>H bet</span>'
    +'<span><span class="ld" style="background:#60a5fa"></span>A bet</span>'
    +'<span style="margin-left:6px">'+bestSide+'</span>'
    +'</div>'
    +'<canvas id="'+id+'"></canvas>'
    +'</div>';
}

function drawOddsChart(id, seg, monthBounds){
  drawChart(id, [seg.seriesH, seg.seriesA], monthBounds, 90);
}

function tableRow(lineLabel, segLabel, seg, isOverall){
  var edge    = seg.hroi - seg.aroi;
  var edgeCls = edge>5?'roi-high':edge<-5?'roi-low':'roi-mid';
  var signal  = edge>10?'🔴 Bet H':edge>3?'↗ H edge':edge<-10?'🔵 Bet A':edge<-3?'↙ A edge':'— Neutral';
  return '<tr'+(isOverall?' style="background:rgba(255,255,255,0.03)"':'')+'>'
    +'<td style="font-weight:'+(isOverall?'700':'400')+'">'+lineLabel+'</td>'
    +'<td style="color:'+(isOverall?'var(--text)':'#94a3b8')+'">'+segLabel+'</td>'
    +'<td class="num">'+seg.n+'</td>'
    +'<td class="num '+posNeg(seg.hroi)+'">'+fmtRoi(seg.hroi)+'</td>'
    +'<td class="num '+posNeg(seg.aroi)+'">'+fmtRoi(seg.aroi)+'</td>'
    +'<td class="num '+edgeCls+'">'+fmtRoi(edge)+'</td>'
    +'<td>'+signal+'</td>'
    +'</tr>';
}
