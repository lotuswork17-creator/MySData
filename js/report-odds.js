// ── report-odds.js — Tab 6: H vs A Bet — Odds Analysis ──
// Segments: Market Lean, Vig, Line Bucket, Expert×Market, Line Move×Vig
// All show H bet (red) vs A bet (blue) per segment chart

// ── Odds helpers ──
function mktH(r){
  var h=r.ASIAH, a=r.ASIAA;
  if(!h||!a||h<=0||a<=0) return null;
  return Math.round((1/h)/(1/h+1/a)*1000)/10;  // H implied % of total book
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

// ── Segment definitions ──
// Each segment: { key, label, group, fn }
var oddsDefs = [

  // GROUP 1: Market Lean (implied H% from odds)
  { key:'mkt_h_strong', group:'Market Lean',
    label:'H Strong Fav (H implied >60%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>60; } },
  { key:'mkt_h_slight', group:'Market Lean',
    label:'H Slight Fav (55–60%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>55 && m<=60; } },
  { key:'mkt_balanced', group:'Market Lean',
    label:'Balanced (45–55%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>=45 && m<=55; } },
  { key:'mkt_a_slight', group:'Market Lean',
    label:'A Slight Fav (40–45%)',
    fn: function(r){ var m=mktH(r); return m!==null && m>=40 && m<45; } },
  { key:'mkt_a_strong', group:'Market Lean',
    label:'A Strong Fav (H implied <40%)',
    fn: function(r){ var m=mktH(r); return m!==null && m<40; } },

  // GROUP 2: Vig (book margin)
  { key:'vig_low',  group:'Vig (Book Margin)',
    label:'Low Vig (<5%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v<5; } },
  { key:'vig_mid',  group:'Vig (Book Margin)',
    label:'Mid Vig (5–8%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v>=5 && v<=8; } },
  { key:'vig_high', group:'Vig (Book Margin)',
    label:'High Vig (>8%)',
    fn: function(r){ var v=vigPct(r); return v!==null && v>8; } },

  // GROUP 3: Asia Line bucket
  { key:'line_neg',  group:'Asia Line',
    label:'Negative Line (<0, A favored)',
    fn: function(r){ return r.ASIALINE!=null && r.ASIALINE<0; } },
  { key:'line_zero', group:'Asia Line',
    label:'Level Line (0)',
    fn: function(r){ return r.ASIALINE===0; } },
  { key:'line_low',  group:'Asia Line',
    label:'Low Line (0 – 0.5, H slight fav)',
    fn: function(r){ return r.ASIALINE!=null && r.ASIALINE>0 && r.ASIALINE<=0.5; } },
  { key:'line_high', group:'Asia Line',
    label:'High Line (>0.5, H clear fav)',
    fn: function(r){ return r.ASIALINE!=null && r.ASIALINE>0.5; } },

  // GROUP 4: Line Movement
  { key:'lm_rose',    group:'Line Movement',
    label:'Line Rose (H handicap grew → market backing H)',
    fn: function(r){ var d=lineDelta(r); return d!==null && d>0; } },
  { key:'lm_flat',    group:'Line Movement',
    label:'Line Flat (no change)',
    fn: function(r){ var d=lineDelta(r); return d!==null && d===0; } },
  { key:'lm_dropped', group:'Line Movement',
    label:'Line Dropped (H handicap shrunk → market backing A)',
    fn: function(r){ var d=lineDelta(r); return d!==null && d<0; } },

  // GROUP 5: H odds drift (price movement without line change)
  { key:'odds_h_short', group:'Odds Drift',
    label:'H Odds Shortened >5pts (money on H)',
    fn: function(r){ var d=hOddsDelta(r); return d!==null && d>0.05; } },
  { key:'odds_stable',  group:'Odds Drift',
    label:'Odds Stable (within 5pts)',
    fn: function(r){ var d=hOddsDelta(r); return d!==null && Math.abs(d)<=0.05; } },
  { key:'odds_h_drift', group:'Odds Drift',
    label:'H Odds Drifted >5pts (money on A)',
    fn: function(r){ var d=hOddsDelta(r); return d!==null && d<-0.05; } },

  // GROUP 6: Expert × Market combos (high-signal intersections)
  { key:'exp_h_mkt_h', group:'Expert × Market',
    label:'Expert H≥67% + Market H-favored',
    fn: function(r){ var e=expertScore(r),m=mktH(r); return e&&e.h>=67&&m!==null&&m>55; } },
  { key:'exp_h_mkt_b', group:'Expert × Market',
    label:'Expert H≥67% + Market Balanced',
    fn: function(r){ var e=expertScore(r),m=mktH(r); return e&&e.h>=67&&m!==null&&m>=45&&m<=55; } },
  { key:'exp_a_mkt_h', group:'Expert × Market',
    label:'Expert A≥67% + Market H-favored (contrarian)',
    fn: function(r){ var e=expertScore(r),m=mktH(r); return e&&e.a>=67&&m!==null&&m>55; } },
  { key:'exp_a_mkt_b', group:'Expert × Market',
    label:'Expert A≥67% + Market Balanced',
    fn: function(r){ var e=expertScore(r),m=mktH(r); return e&&e.a>=67&&m!==null&&m>=45&&m<=55; } },

  // GROUP 7: Vig × Line Move (sharp money signals)
  { key:'vig_low_rose',    group:'Vig × Line Move',
    label:'Low Vig + Line Rose',
    fn: function(r){ var v=vigPct(r),d=lineDelta(r); return v!==null&&v<5&&d!==null&&d>0; } },
  { key:'vig_low_flat',    group:'Vig × Line Move',
    label:'Low Vig + Line Flat',
    fn: function(r){ var v=vigPct(r),d=lineDelta(r); return v!==null&&v<5&&d!==null&&d===0; } },
  { key:'vig_low_dropped', group:'Vig × Line Move',
    label:'Low Vig + Line Dropped',
    fn: function(r){ var v=vigPct(r),d=lineDelta(r); return v!==null&&v<5&&d!==null&&d<0; } },
];

function computeOdds(results){
  var groups = {};  // group label → [{seg data}]
  oddsDefs.forEach(function(def){
    var sub = results.filter(def.fn);
    var n   = sub.length;
    var hr  = sub.map(cH).filter(function(x){return x!==null;});
    var ar  = sub.map(cA).filter(function(x){return x!==null;});
    var seg = {
      key   : def.key,
      label : def.label,
      group : def.group,
      n     : n,
      hroi  : roiOf(hr),
      aroi  : roiOf(ar),
      seriesH : {label:'H bet', color:'#f87171', pts: runPnl(sub, cH)},
      seriesA : {label:'A bet', color:'#60a5fa', pts: runPnl(sub, cA)},
    };
    if(!groups[def.group]) groups[def.group]=[];
    groups[def.group].push(seg);
  });
  return { groups: groups, groupOrder: Object.keys(groups) };
}

function renderOdds(d){
  var area = document.getElementById('oddsChartsArea');
  var html  = '';

  d.odds.groupOrder.forEach(function(gname){
    html += '<div class="rpt-title" style="margin-top:8px;margin-bottom:8px">'+gname+'</div>';
    d.odds.groups[gname].forEach(function(seg){
      if(seg.n < 10){ return; }  // skip tiny samples
      var id      = 'cOdds_'+seg.key;
      var best    = seg.hroi > seg.aroi
        ? '<span class="pos">H bet leads +'+Math.abs(seg.hroi-seg.aroi).toFixed(1)+'%</span>'
        : '<span class="neg">A bet leads +'+Math.abs(seg.hroi-seg.aroi).toFixed(1)+'%</span>';
      var roiNote = ' — H: '+fmtRoi(seg.hroi)+'  A: '+fmtRoi(seg.aroi);
      html += '<div class="chart-box">'
        +'<div class="chart-box-label">'+seg.label+' (N='+seg.n+')'+roiNote+'</div>'
        +'<div class="chart-legend">'
        +'<span><span class="ld" style="background:#f87171"></span>H bet</span>'
        +'<span><span class="ld" style="background:#60a5fa"></span>A bet</span>'
        +'<span style="margin-left:6px">'+best+'</span>'
        +'</div>'
        +'<canvas id="'+id+'"></canvas>'
        +'</div>';
    });
  });

  area.innerHTML = html;

  setTimeout(function(){
    d.odds.groupOrder.forEach(function(gname){
      d.odds.groups[gname].forEach(function(seg){
        if(seg.n < 10) return;
        drawChart('cOdds_'+seg.key, [seg.seriesH, seg.seriesA], d.monthBounds, 90);
      });
    });
  }, 30);

  // Summary table — one row per segment, all groups
  var rows = '';
  d.odds.groupOrder.forEach(function(gname){
    d.odds.groups[gname].forEach(function(seg){
      var edge = seg.hroi - seg.aroi;
      var edgeCls = edge>5?'roi-high':edge<-5?'roi-low':'roi-mid';
      var verdict = edge>10?'🔴 Bet H':edge>3?'↗ H edge':edge<-10?'🔵 Bet A':edge<-3?'↙ A edge':'— Neutral';
      rows += '<tr>'
        +'<td style="color:#94a3b8;font-size:9px">'+gname+'</td>'
        +'<td>'+seg.label+'</td>'
        +'<td class="num">'+seg.n+'</td>'
        +'<td class="num '+posNeg(seg.hroi)+'">'+fmtRoi(seg.hroi)+'</td>'
        +'<td class="num '+posNeg(seg.aroi)+'">'+fmtRoi(seg.aroi)+'</td>'
        +'<td class="num '+edgeCls+'">'+fmtRoi(edge)+'</td>'
        +'<td>'+verdict+'</td>'
        +'</tr>';
    });
  });

  document.getElementById('tbOdds').innerHTML = rows;
}
