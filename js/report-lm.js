// ── report-lm.js — Tab 5: Line Movement × Expert ──

function computeLM(results, allHpts, allApts){
  var lmTable   = [];
  var lmHSeries = [{label:'Baseline (all H)',color:'#94a3b8',pts:allHpts}];
  var lmASeries = [{label:'Baseline (all A)',color:'#94a3b8',pts:allApts}];
  var lmHCols   = ['#60a5fa','#a78bfa','#4ade80','#fbbf24'];
  var lmACols   = ['#f87171','#fb923c','#fbbf24'];
  var hi=0, ai=0;

  [['up','▲ Rose'],['down','▼ Dropped'],['flat','— Flat']].forEach(function(lmP){
    [['H',67,'H≥67%'],['H',83,'H≥83%'],['A',50,'A≥50%'],['A',67,'A≥67%']].forEach(function(ex){
      var sub = results.filter(function(r){
        var gl=r.ASIALINE, ln=r.ASIALINELN; if(gl==null||ln==null) return false;
        var ld = Math.round((gl-ln)*100)/100;
        if(lmP[0]==='up'   && ld<=0) return false;
        if(lmP[0]==='down' && ld>=0) return false;
        if(lmP[0]==='flat' && ld!==0) return false;
        var e = expertScore(r); if(!e) return false;
        if(ex[0]==='H' && e.h<ex[1]) return false;
        if(ex[0]==='A' && e.a<ex[1]) return false;
        return true;
      });
      var n = sub.length; if(n<5) return;
      var side = ex[0], fn = side==='H' ? cH : cA, fnOther = side==='H' ? cA : cH;
      var rois = sub.map(fn).filter(function(x){return x!==null;});
      var roisOther = sub.map(fnOther).filter(function(x){return x!==null;});
      lmTable.push({lm:lmP[1], expert:ex[0]+' '+ex[2], side:side, n:n, roi:roiOf(rois), roiOther:roiOf(roisOther)});
      if(lmP[0]==='up' && side==='H' && hi<4)
        lmHSeries.push({label:lmP[1]+' '+ex[2], color:lmHCols[hi++], pts:runPnl(sub,cH)});
      if((lmP[0]==='flat'||lmP[0]==='down') && side==='A' && ai<3)
        lmASeries.push({label:lmP[1]+' '+ex[2], color:lmACols[ai++], pts:runPnl(sub,cA)});
    });
  });

  return { table:lmTable, seriesH:lmHSeries, seriesA:lmASeries };
}

function renderLM(d){
  makeLegend('lgdLmH', d.lm.seriesH);
  makeLegend('lgdLmA', d.lm.seriesA);
  setTimeout(function(){
    drawChart('cLmH', d.lm.seriesH, d.monthBounds, 120);
    drawChart('cLmA', d.lm.seriesA, d.monthBounds, 120);
  }, 30);
  // Update table header to include both-side columns
  var tbLm = document.getElementById('tbLm');
  if(tbLm && tbLm.parentElement){
    var thead = tbLm.parentElement.querySelector('thead tr');
    if(thead) thead.innerHTML = '<th>Line Move</th><th>Expert</th><th class="num">N</th><th class="num">Bet</th><th class="num">ROI%</th><th class="num">Other</th><th class="num">ROI%</th><th>Signal</th>';
  }
  document.getElementById('tbLm').innerHTML = d.lm.table.map(function(x){
    var edge    = x.roi - x.roiOther;
    var betCol  = x.side==='H' ? '#f87171' : '#60a5fa';
    var oBetCol = x.side==='H' ? '#60a5fa' : '#f87171';
    var otherSide = x.side==='H' ? 'A' : 'H';
    var roiCol  = x.roi>=10?'#4ade80':x.roi>=5?'#a3e635':x.roi>=0?'#fbbf24':'#f87171';
    var roiOCol = x.roiOther>=10?'#4ade80':x.roiOther>=5?'#a3e635':x.roiOther>=0?'#94a3b8':'#f87171';
    var betW    = edge >= 5 ? '800' : '600';
    var oBetW   = edge <= -5 ? '800' : '400';
    var sig = x.roi>=10?'🔥 Strong':x.roi>=5?'✅ Good':x.roi>=0?'👍 Positive':'❌ Negative';
    return '<tr><td>'+x.lm+'</td><td>'+x.expert+'</td><td class="num">'+x.n+'</td>'      +'<td class="num" style="font-family:var(--mono);color:'+betCol+';font-weight:'+betW+'">'+x.side+'</td>'      +'<td class="num" style="font-family:var(--mono);color:'+roiCol+';font-weight:'+betW+'">'+fmtRoi(x.roi)+'</td>'      +'<td class="num" style="font-family:var(--mono);color:'+oBetCol+';font-weight:'+oBetW+'">'+otherSide+'</td>'      +'<td class="num" style="font-family:var(--mono);color:'+roiOCol+';font-weight:'+oBetW+'">'+fmtRoi(x.roiOther)+'</td>'      +'<td>'+sig+'</td></tr>';
  }).join('');
}
