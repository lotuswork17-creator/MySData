// ── report-expert.js — Tab 3: Expert Signal Accuracy ──

function computeExpert(results){
  var perThresh = [];
  var table     = [];

  ['H','A'].forEach(function(side){
    [50,67,83].forEach(function(thresh){
      var sk  = side.toLowerCase();
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&e[sk]>=thresh; });
      var n   = sub.length; if(!n) return;
      var hr  = sub.map(cH).filter(function(x){return x!==null;});
      var ar  = sub.map(cA).filter(function(x){return x!==null;});
      var wh  = sub.filter(function(r){return['ww','wh'].indexOf(ao(r))>=0;}).length;
      var wa  = sub.filter(function(r){return['lw','lh'].indexOf(ao(r))>=0;}).length;
      table.push({side:side, thresh:thresh, n:n,
        hroi:roiOf(hr), aroi:roiOf(ar),
        hwin:Math.round(wh/n*1000)/10, awin:Math.round(wa/n*1000)/10});
      perThresh.push({
        side:side, thresh:thresh, n:n,
        label:'Expert '+side+' ≥'+thresh+'%',
        hroi:roiOf(hr), aroi:roiOf(ar),
        seriesH:{label:'H bet',color:'#f87171',pts:runPnl(sub,cH)},
        seriesA:{label:'A bet',color:'#60a5fa',pts:runPnl(sub,cA)},
      });
    });
  });

  // Close-call segments: |H% - A%| ≤ gap
  [5,10,15].forEach(function(gap){
    var sub = results.filter(function(r){ var e=expertScore(r); return e&&Math.abs(e.h-e.a)<=gap; });
    var n   = sub.length; if(!n) return;
    var hr  = sub.map(cH).filter(function(x){return x!==null;});
    var ar  = sub.map(cA).filter(function(x){return x!==null;});
    perThresh.push({
      side:'~', thresh:gap, n:n,
      label:'H/A Close (≤'+gap+'pts)',
      hroi:roiOf(hr), aroi:roiOf(ar),
      seriesH:{label:'H bet',color:'#f87171',pts:runPnl(sub,cH)},
      seriesA:{label:'A bet',color:'#60a5fa',pts:runPnl(sub,cA)},
    });
  });

  return { perThresh:perThresh, table:table };
}

function renderExpert(d){
  var area = document.getElementById('expertChartsArea');
  area.innerHTML = d.expert.perThresh.map(function(ep){
    var id       = 'cExp_'+(ep.side==='~'?'close':ep.side)+ep.thresh;
    var roiNote  = ' — H bet: '+fmtRoi(ep.hroi)+'  A bet: '+fmtRoi(ep.aroi);
    var bestSide = ep.hroi>ep.aroi
      ? '<span class="pos">H bet leads</span>'
      : '<span class="neg">A bet leads</span>';
    return '<div class="chart-box">'
      +'<div class="chart-box-label">'+ep.label+' (N='+ep.n+')'+roiNote+'</div>'
      +'<div class="chart-legend">'
      +'<span><span class="ld" style="background:#f87171"></span>H bet</span>'
      +'<span><span class="ld" style="background:#60a5fa"></span>A bet</span>'
      +'<span style="margin-left:6px">'+bestSide+'</span>'
      +'</div>'
      +'<canvas id="'+id+'"></canvas>'
      +'</div>';
  }).join('');

  setTimeout(function(){
    d.expert.perThresh.forEach(function(ep){
      var id = 'cExp_'+(ep.side==='~'?'close':ep.side)+ep.thresh;
      drawChart(id, [ep.seriesH, ep.seriesA], d.monthBounds, 100);
    });
  }, 30);

  // Verdict cards
  document.getElementById('expertGrid').innerHTML = d.expert.perThresh.map(function(ep){
    var vH,vcH; if(ep.hroi>=5){vH='✅ Suitable';vcH='verdict-ok';}else if(ep.hroi>=0){vH='⚠ Marginal';vcH='verdict-caution';}else{vH='❌ Avoid';vcH='verdict-avoid';}
    var vA,vcA; if(ep.aroi>=5){vA='✅ Suitable';vcA='verdict-ok';}else if(ep.aroi>=0){vA='⚠ Marginal';vcA='verdict-caution';}else{vA='❌ Avoid';vcA='verdict-avoid';}
    return '<div class="exp-card"><div class="exp-card-top">'+ep.label+' · N='+ep.n+'</div>'
      +'<div style="display:flex;gap:10px;margin-bottom:4px">'
      +'<div><div style="font-size:9px;color:#f87171;font-weight:700;margin-bottom:2px">H BET</div>'
      +'<div class="exp-card-roi '+posNeg(ep.hroi)+'">'+fmtRoi(ep.hroi)+'</div>'
      +'<div class="exp-verdict '+vcH+'">'+vH+'</div></div>'
      +'<div><div style="font-size:9px;color:#60a5fa;font-weight:700;margin-bottom:2px">A BET</div>'
      +'<div class="exp-card-roi '+posNeg(ep.aroi)+'">'+fmtRoi(ep.aroi)+'</div>'
      +'<div class="exp-verdict '+vcA+'">'+vA+'</div></div>'
      +'</div></div>';
  }).join('');

  // Verdict table
  document.getElementById('expertVerdict').innerHTML =
    '<div class="rpt-table-wrap"><table class="rpt-table">'
    +'<thead><tr><th>Signal</th><th class="num">N</th>'
    +'<th class="num">H Bet ROI</th><th>H Verdict</th>'
    +'<th class="num">A Bet ROI</th><th>A Verdict</th></tr></thead><tbody>'
    +d.expert.perThresh.map(function(ep){
      var vH,vcH; if(ep.hroi>=5){vH='✅ Suitable';vcH='verdict-ok';}else if(ep.hroi>=0){vH='⚠ Marginal';vcH='verdict-caution';}else{vH='❌ Avoid';vcH='verdict-avoid';}
      var vA,vcA; if(ep.aroi>=5){vA='✅ Suitable';vcA='verdict-ok';}else if(ep.aroi>=0){vA='⚠ Marginal';vcA='verdict-caution';}else{vA='❌ Avoid';vcA='verdict-avoid';}
      return '<tr><td>'+ep.label+'</td><td class="num">'+ep.n+'</td>'
        +'<td class="num '+posNeg(ep.hroi)+'">'+fmtRoi(ep.hroi)+'</td>'
        +'<td><span class="exp-verdict '+vcH+'">'+vH+'</span></td>'
        +'<td class="num '+posNeg(ep.aroi)+'">'+fmtRoi(ep.aroi)+'</td>'
        +'<td><span class="exp-verdict '+vcA+'">'+vA+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
}
