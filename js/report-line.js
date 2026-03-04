// ── report-line.js — Tab 2: ROI by Asia Line ──

function computeLine(results){
  var liMap = {};
  results.forEach(function(r){
    if(r.ASIALINE==null) return;
    var k=String(r.ASIALINE); if(!liMap[k])liMap[k]=[]; liMap[k].push(r);
  });
  var keys = Object.keys(liMap).sort(function(a,b){ return parseFloat(a)-parseFloat(b); });
  var perLine = keys.map(function(k){
    var lv=parseFloat(k), lbl=(lv>=0?'+':'')+k;
    var v=liMap[k], n=v.length;
    var hroi=roiOf(v.map(cH).filter(function(x){return x!==null;}));
    var aroi=roiOf(v.map(cA).filter(function(x){return x!==null;}));
    return{
      key:k, label:lbl, n:n, hroi:hroi, aroi:aroi,
      seriesH:{label:'H bet',color:'#f87171',pts:runPnl(liMap[k],cH)},
      seriesA:{label:'A bet',color:'#60a5fa',pts:runPnl(liMap[k],cA)},
    };
  });
  return {
    perLine : perLine,
    table   : perLine.map(function(d){ return{line:parseFloat(d.key),n:d.n,hroi:d.hroi,aroi:d.aroi}; }),
  };
}

function renderLine(d){
  var q     = d.line.table.filter(function(x){return x.n>=20;});
  var best  = q.slice().sort(function(a,b){return Math.max(b.hroi,b.aroi)-Math.max(a.hroi,a.aroi);})[0];
  var worst = q.slice().sort(function(a,b){return Math.min(a.hroi,a.aroi)-Math.min(b.hroi,b.aroi);})[0];
  document.getElementById('lineCards').innerHTML =
    '<div class="rpt-card"><div class="rpt-card-label">Lines</div><div class="rpt-card-val neu">'+d.line.table.length+'</div></div>'
    +(best ?'<div class="rpt-card"><div class="rpt-card-label">Best Line (N≥20)</div><div class="rpt-card-val pos">'+(best.line>=0?'+':'')+best.line+'</div><div class="rpt-card-sub">'+fmtRoi(Math.max(best.hroi,best.aroi))+'</div></div>':'')
    +(worst&&(!best||worst.line!==best.line)?'<div class="rpt-card"><div class="rpt-card-label">Worst Line (N≥20)</div><div class="rpt-card-val neg">'+(worst.line>=0?'+':'')+worst.line+'</div><div class="rpt-card-sub">'+fmtRoi(Math.min(worst.hroi,worst.aroi))+'</div></div>':'');

  var area = document.getElementById('lineChartsArea');
  area.innerHTML = d.line.perLine.map(function(ln){
    var id = 'cLine_'+ln.key.replace('.','_').replace('-','m');
    var roiNote = ' — H: '+fmtRoi(ln.hroi)+'  A: '+fmtRoi(ln.aroi);
    return '<div class="chart-box">'
      +'<div class="chart-box-label">Line '+ln.label+' (N='+ln.n+')'+roiNote+'</div>'
      +'<div class="chart-legend">'
      +'<span><span class="ld" style="background:#f87171"></span>H bet</span>'
      +'<span><span class="ld" style="background:#60a5fa"></span>A bet</span>'
      +'</div>'
      +'<canvas id="'+id+'"></canvas>'
      +'</div>';
  }).join('');
  setTimeout(function(){
    d.line.perLine.forEach(function(ln){
      var id = 'cLine_'+ln.key.replace('.','_').replace('-','m');
      drawChart(id, [ln.seriesH, ln.seriesA], d.monthBounds, 100);
    });
  }, 30);

  document.getElementById('tbLine').innerHTML = d.line.table.map(function(x){
    var best = x.hroi>x.aroi
      ? '<span class="pos">H '+fmtRoi(x.hroi)+'</span>'
      : '<span class="neg">A '+fmtRoi(x.aroi)+'</span>';
    return '<tr><td>'+(x.line>=0?'+':'')+x.line+'</td><td class="num">'+x.n+'</td>'
      +'<td class="num '+posNeg(x.hroi)+'">'+fmtRoi(x.hroi)+'</td>'
      +'<td class="num '+posNeg(x.aroi)+'">'+fmtRoi(x.aroi)+'</td>'
      +'<td>'+best+'</td></tr>';
  }).join('');
}
