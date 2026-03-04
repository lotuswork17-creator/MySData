// ── report-league.js — Tab 0: ROI by League ──

function computeLeague(results, monthBounds){
  var lMap = {};
  results.forEach(function(r){ var c=r.CATEGORY||'?'; if(!lMap[c])lMap[c]=[]; lMap[c].push(r); });
  var sorted = Object.keys(lMap).sort(function(a,b){ return lMap[b].length-lMap[a].length; });
  var top5   = sorted.slice(0,5);
  return {
    seriesH  : top5.map(function(cat,i){ return{label:cat,color:COLS[i],pts:runPnl(lMap[cat],cH)}; }),
    seriesA  : top5.map(function(cat,i){ return{label:cat,color:COLS[i],pts:runPnl(lMap[cat],cA)}; }),
    table    : sorted.map(function(cat){
      var v=lMap[cat], n=v.length;
      return{cat:cat,n:n,
        hroi:roiOf(v.map(cH).filter(function(x){return x!==null;})),
        aroi:roiOf(v.map(cA).filter(function(x){return x!==null;}))};
    }),
  };
}

function renderLeague(d){
  var q    = d.league.table.filter(function(x){return x.n>=20;});
  var best = q.slice().sort(function(a,b){return Math.max(b.hroi,b.aroi)-Math.max(a.hroi,a.aroi);})[0];
  var worst= q.slice().sort(function(a,b){return Math.min(a.hroi,a.aroi)-Math.min(b.hroi,b.aroi);})[0];
  document.getElementById('leagueCards').innerHTML =
    '<div class="rpt-card"><div class="rpt-card-label">Leagues</div><div class="rpt-card-val neu">'+d.league.table.length+'</div></div>'
    +(best ?'<div class="rpt-card"><div class="rpt-card-label">Best ≥20</div><div class="rpt-card-val pos" style="font-size:12px">'+best.cat+'</div><div class="rpt-card-sub">'+fmtRoi(Math.max(best.hroi,best.aroi))+'</div></div>':'')
    +(worst?'<div class="rpt-card"><div class="rpt-card-label">Worst ≥20</div><div class="rpt-card-val neg" style="font-size:12px">'+worst.cat+'</div><div class="rpt-card-sub">'+fmtRoi(Math.min(worst.hroi,worst.aroi))+'</div></div>':'');
  makeLegend('lgdLeagueH', d.league.seriesH);
  makeLegend('lgdLeagueA', d.league.seriesA);
  document.getElementById('tbLeague').innerHTML = d.league.table.map(function(x){
    return '<tr><td>'+x.cat+'</td><td class="num">'+x.n+'</td>'
      +'<td class="num '+posNeg(x.hroi)+'">'+fmtRoi(x.hroi)+'</td>'
      +'<td class="num '+posNeg(x.aroi)+'">'+fmtRoi(x.aroi)+'</td>'
      +'<td>'+(x.hroi>x.aroi?'<span class="pos">H</span>':'<span class="neg">A</span>')+'</td></tr>';
  }).join('');
  setTimeout(function(){
    drawChart('cLeagueH', d.league.seriesH, d.monthBounds, 110);
    drawChart('cLeagueA', d.league.seriesA, d.monthBounds, 110);
  }, 30);
}
