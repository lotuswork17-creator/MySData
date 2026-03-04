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
      var side = ex[0], fn = side==='H' ? cH : cA;
      var rois = sub.map(fn).filter(function(x){return x!==null;});
      lmTable.push({lm:lmP[1], expert:ex[0]+' '+ex[2], side:side, n:n, roi:roiOf(rois)});
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
  document.getElementById('tbLm').innerHTML = d.lm.table.map(function(x){
    var rc  = x.roi>=10?'roi-high':x.roi>=0?'roi-mid':'roi-low';
    var sig = x.roi>=10?'🔥 Strong':x.roi>=0?'👍 Positive':'❌ Negative';
    return '<tr><td>'+x.lm+'</td><td>'+x.expert+'</td><td class="num">'+x.n+'</td>'
      +'<td class="num '+rc+'">'+fmtRoi(x.roi)+'</td>'
      +'<td><span class="sm-badge '+(x.side==='H'?'sm-h':'sm-a')+'">'+x.side+'</span></td>'
      +'<td>'+sig+'</td></tr>';
  }).join('');
}
