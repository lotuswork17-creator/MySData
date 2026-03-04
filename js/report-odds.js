// ── report-odds.js — Tab 6: AsiaLine × Expert Signal Analysis ──
// Base unit: every Line × Expert combination (always shown, small N flagged)
// Sub-filters (Market Lean, Line Movement, Vig) layer on top when N >= ODDS_MIN_N

var ODDS_MIN_N = 30;  // threshold for sub-filter segments only

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

// ── Expert filters — always included ──
var oddsExpertFilters = [
  { key:'h67', label:'Expert H ≥67%', fn: function(r){ var e=expertScore(r); return e&&e.h>=67; } },
  { key:'h50', label:'Expert H ≥50%', fn: function(r){ var e=expertScore(r); return e&&e.h>=50; } },
  { key:'a50', label:'Expert A ≥50%', fn: function(r){ var e=expertScore(r); return e&&e.a>=50; } },
  { key:'a67', label:'Expert A ≥67%', fn: function(r){ var e=expertScore(r); return e&&e.a>=67; } },
];

// ── Sub-filters — only shown when Line×Expert base N >= ODDS_MIN_N ──
var oddsSubFilters = [
  { key:'mkt_h',  group:'Market Lean',   label:'Market H-favored (>55%)',
    fn: function(r){ var m=mktH(r); return m!==null&&m>55; } },
  { key:'mkt_bal',group:'Market Lean',   label:'Market Balanced (45–55%)',
    fn: function(r){ var m=mktH(r); return m!==null&&m>=45&&m<=55; } },
  { key:'mkt_a',  group:'Market Lean',   label:'Market A-favored (<45%)',
    fn: function(r){ var m=mktH(r); return m!==null&&m<45; } },
  { key:'lm_rose',group:'Line Movement', label:'Line Rose',
    fn: function(r){ var d=lineDelta(r); return d!==null&&d>0; } },
  { key:'lm_flat',group:'Line Movement', label:'Line Flat',
    fn: function(r){ var d=lineDelta(r); return d!==null&&d===0; } },
  { key:'lm_drop',group:'Line Movement', label:'Line Dropped',
    fn: function(r){ var d=lineDelta(r); return d!==null&&d<0; } },
  { key:'vig_low',group:'Vig',           label:'Low Vig (<5%)',
    fn: function(r){ var v=vigPct(r); return v!==null&&v<5; } },
  { key:'vig_hi', group:'Vig',           label:'High Vig (>8%)',
    fn: function(r){ var v=vigPct(r); return v!==null&&v>8; } },
  { key:'drift_h',group:'Odds Drift',    label:'H odds shortened',
    fn: function(r){ var d=hOddsDelta(r); return d!==null&&d>0.05; } },
  { key:'drift_a',group:'Odds Drift',    label:'H odds drifted',
    fn: function(r){ var d=hOddsDelta(r); return d!==null&&d<-0.05; } },
];

// ── Build a segment data object ──
function makeSeg(sub, key, label){
  var n    = sub.length;
  var hroi = n>0 ? roiOf(sub.map(cH).filter(function(x){return x!==null;})) : 0;
  var aroi = n>0 ? roiOf(sub.map(cA).filter(function(x){return x!==null;})) : 0;
  return {
    key     : key,
    label   : label,
    n       : n,
    hroi    : hroi,
    aroi    : aroi,
    seriesH : {label:'H bet', color:'#f87171', pts: n>0 ? runPnl(sub,cH) : []},
    seriesA : {label:'A bet', color:'#60a5fa', pts: n>0 ? runPnl(sub,cA) : []},
  };
}

// ── computeOdds ──
// Structure: lineGroups[ { line, expertPairs[ { expLabel, base, subGroups } ] } ]
function computeOdds(results){
  var allLines = [];
  results.forEach(function(r){
    if(r.ASIALINE!=null && allLines.indexOf(r.ASIALINE)<0) allLines.push(r.ASIALINE);
  });
  allLines.sort(function(a,b){return a-b;});

  var lineGroups = [];

  allLines.forEach(function(line){
    var lineSub = results.filter(function(r){return r.ASIALINE===line;});
    if(lineSub.length < ODDS_MIN_N) return;  // skip lines with too few matches

    var expertPairs = [];

    oddsExpertFilters.forEach(function(ef){
      // Base: Line × Expert (always included)
      var baseSub = lineSub.filter(ef.fn);
      var base    = makeSeg(baseSub, ef.key, ef.label);

      // Sub-filters on top of Line × Expert — only when base N >= ODDS_MIN_N
      var subGroups = {};
      var subGroupOrder = [];

      if(base.n >= ODDS_MIN_N){
        oddsSubFilters.forEach(function(sf){
          var sub3 = baseSub.filter(sf.fn);
          if(sub3.length < ODDS_MIN_N) return;
          if(!subGroups[sf.group]){ subGroups[sf.group]=[]; subGroupOrder.push(sf.group); }
          subGroups[sf.group].push(makeSeg(sub3, ef.key+'_'+sf.key, sf.label));
        });
      }

      expertPairs.push({
        expKey        : ef.key,
        expLabel      : ef.label,
        base          : base,
        subGroups     : subGroups,
        subGroupOrder : subGroupOrder,
      });
    });

    lineGroups.push({
      line        : line,
      label       : lineFmt(line),
      n           : lineSub.length,
      expertPairs : expertPairs,
    });
  });

  return { lineGroups: lineGroups };
}

// ── renderOdds ──
function renderOdds(d){
  var area = document.getElementById('oddsChartsArea');
  var html = '';

  d.odds.lineGroups.forEach(function(lg){
    // Line section header
    html += '<div class="odds-line-header">'
      + 'Asia Line ' + lg.label
      + ' <span class="odds-line-n">N='+lg.n+'</span>'
      + '</div>';

    lg.expertPairs.forEach(function(ep){
      // Line × Expert header
      html += '<div class="odds-group-label">'+ep.expLabel+'</div>';

      // Base chart: Line × Expert
      var baseId = 'cOdds_'+lg.line+'_'+ep.expKey;
      html += chartBox(baseId, ep.base);

      // Sub-filter charts
      ep.subGroupOrder.forEach(function(gname){
        html += '<div class="odds-sub-label">'+gname+'</div>';
        ep.subGroups[gname].forEach(function(seg){
          var subId = 'cOdds_'+lg.line+'_'+seg.key;
          html += chartBox(subId, seg);
        });
      });
    });
  });

  area.innerHTML = html;

  setTimeout(function(){
    d.odds.lineGroups.forEach(function(lg){
      lg.expertPairs.forEach(function(ep){
        if(ep.base.n > 0)
          drawChart('cOdds_'+lg.line+'_'+ep.expKey, [ep.base.seriesH, ep.base.seriesA], d.monthBounds, 90);
        ep.subGroupOrder.forEach(function(gname){
          ep.subGroups[gname].forEach(function(seg){
            drawChart('cOdds_'+lg.line+'_'+seg.key, [seg.seriesH, seg.seriesA], d.monthBounds, 80);
          });
        });
      });
    });
  }, 30);

  // Summary table
  var rows = '';
  d.odds.lineGroups.forEach(function(lg){
    lg.expertPairs.forEach(function(ep){
      rows += tableRow(lg.label, ep.expLabel, ep.base, true);
      ep.subGroupOrder.forEach(function(gname){
        ep.subGroups[gname].forEach(function(seg){
          rows += tableRow(lg.label, ep.expLabel+' + '+gname+': '+seg.label, seg, false);
        });
      });
    });
  });
  document.getElementById('tbOdds').innerHTML = rows;
}

// ── UI helpers ──
function chartBox(id, seg){
  var small   = seg.n < ODDS_MIN_N;
  var edge    = seg.hroi - seg.aroi;
  var bestSide = edge>0
    ? '<span class="pos">H leads +'+Math.abs(edge).toFixed(1)+'%</span>'
    : '<span class="neg">A leads +'+Math.abs(edge).toFixed(1)+'%</span>';
  var warn = small ? ' <span style="color:#fbbf24;font-size:9px">⚠ small sample</span>' : '';
  var body = seg.n > 0
    ? '<div class="chart-legend">'
      +'<span><span class="ld" style="background:#f87171"></span>H bet</span>'
      +'<span><span class="ld" style="background:#60a5fa"></span>A bet</span>'
      +'<span style="margin-left:6px">'+bestSide+'</span>'
      +'</div>'
      +'<canvas id="'+id+'"></canvas>'
    : '<div style="color:#64748b;font-size:10px;padding:6px 0">No data for this combination</div>';
  return '<div class="chart-box">'
    +'<div class="chart-box-label">'+seg.label
    +' (N='+seg.n+')'+warn
    +(seg.n>0 ? ' — H: '+fmtRoi(seg.hroi)+'  A: '+fmtRoi(seg.aroi) : '')
    +'</div>'
    +body
    +'</div>';
}

function tableRow(lineLabel, segLabel, seg, isBase){
  var edge    = seg.hroi - seg.aroi;
  var edgeCls = edge>5?'roi-high':edge<-5?'roi-low':'roi-mid';
  var signal  = edge>10?'🔴 Bet H':edge>3?'↗ H edge':edge<-10?'🔵 Bet A':edge<-3?'↙ A edge':'— Neutral';
  var small   = seg.n < ODDS_MIN_N ? ' ⚠' : '';
  return '<tr'+(isBase?' style="background:rgba(255,255,255,0.03)"':'')+'>'
    +'<td style="font-weight:'+(isBase?'700':'400')+'">'+lineLabel+'</td>'
    +'<td style="color:'+(isBase?'var(--text)':'#94a3b8')+'">'+segLabel+small+'</td>'
    +'<td class="num">'+seg.n+'</td>'
    +'<td class="num '+posNeg(seg.hroi)+'">'+fmtRoi(seg.hroi)+'</td>'
    +'<td class="num '+posNeg(seg.aroi)+'">'+fmtRoi(seg.aroi)+'</td>'
    +'<td class="num '+edgeCls+'">'+fmtRoi(edge)+'</td>'
    +'<td>'+(seg.n>0?signal:'—')+'</td>'
    +'</tr>';
}
