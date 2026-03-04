// ── report-month.js — Tab 1: Overall Performance over Time ──

function computeMonth(results, allHpts, allApts){
  var mMap = {};
  results.forEach(function(r){ var ym=r.DATE.slice(0,7); if(!mMap[ym])mMap[ym]=[]; mMap[ym].push(r); });
  return {
    allHpts : allHpts,
    allApts : allApts,
    table   : Object.keys(mMap).sort().map(function(ym){
      var v=mMap[ym], n=v.length;
      return{ym:ym, n:n,
        hroi:roiOf(v.map(cH).filter(function(x){return x!==null;})),
        aroi:roiOf(v.map(cA).filter(function(x){return x!==null;}))};
    }),
  };
}

function renderMonth(d){
  var totH = d.month.allHpts[d.month.allHpts.length-1]||0;
  var totA = d.month.allApts[d.month.allApts.length-1]||0;
  var n    = d.month.table.reduce(function(s,m){return s+m.n;},0);
  document.getElementById('monthCards').innerHTML =
    '<div class="rpt-card"><div class="rpt-card-label">Matches</div><div class="rpt-card-val neu">'+n+'</div></div>'
    +'<div class="rpt-card"><div class="rpt-card-label">H Total P&L</div><div class="rpt-card-val '+posNeg(totH)+'">$'+fmtPnl(totH)+'</div></div>'
    +'<div class="rpt-card"><div class="rpt-card-label">A Total P&L</div><div class="rpt-card-val '+posNeg(totA)+'">$'+fmtPnl(totA)+'</div></div>';
  document.getElementById('tbMonth').innerHTML = d.month.table.map(function(x){
    return '<tr><td>'+x.ym+'</td><td class="num">'+x.n+'</td>'
      +'<td class="num '+posNeg(x.hroi)+'">'+fmtRoi(x.hroi)+'</td>'
      +'<td class="num '+posNeg(x.aroi)+'">'+fmtRoi(x.aroi)+'</td>'
      +'<td>'+(x.hroi>x.aroi?'<span class="pos">H</span>':'<span class="neg">A</span>')+'</td></tr>';
  }).join('');
  setTimeout(function(){
    drawChart('cMonth',
      [{label:'H Bet',color:'#f87171',pts:d.month.allHpts},{label:'A Bet',color:'#60a5fa',pts:d.month.allApts}],
      d.monthBounds, 120);
  }, 30);
}
