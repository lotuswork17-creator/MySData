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

var _lmRef = null;
var _lmZoom = 50;

function lmZoomSet(n){
  _lmZoom = n;
  var activeStyle   = 'font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;font-weight:700';
  var inactiveStyle = 'font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer';
  var b50  = document.getElementById('lmZoomBtn50');
  var b100 = document.getElementById('lmZoomBtn100');
  if(b50)  b50.style.cssText  = (n === 50  ? activeStyle : inactiveStyle);
  if(b100) b100.style.cssText = (n === 100 ? activeStyle : inactiveStyle);
  redrawLMCharts(n);
}

function redrawLMCharts(n){
  if(!_lmRef) return;
  var sliceH = _lmRef.seriesH.map(function(s){ return {label:s.label, color:s.color, pts:s.pts.slice(-n)}; });
  var sliceA = _lmRef.seriesA.map(function(s){ return {label:s.label, color:s.color, pts:s.pts.slice(-n)}; });
  drawChart('cLmH', sliceH, _lmRef.monthBounds, 120);
  drawChart('cLmA', sliceA, _lmRef.monthBounds, 120);
}

function renderLM(d){
  _lmRef = { seriesH: d.lm.seriesH, seriesA: d.lm.seriesA, monthBounds: d.monthBounds };
  _lmZoom = 50;

  // Inject zoom bar before first chart-box in tab5
  var tab5 = document.getElementById('tab5');
  if(tab5){
    var existingBar = document.getElementById('lmZoomBarDiv');
    if(existingBar) existingBar.remove();
    var zoomDiv = document.createElement('div');
    zoomDiv.id = 'lmZoomBarDiv';
    zoomDiv.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px';
    zoomDiv.innerHTML = '<span style="font-size:10px;color:#64748b;font-family:var(--mono)">Zoom:</span>'
      + '<button id="lmZoomBtn50"  onclick="lmZoomSet(50)"  style="font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;font-weight:700">Last 50</button>'
      + '<button id="lmZoomBtn100" onclick="lmZoomSet(100)" style="font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer">Last 100</button>';
    var firstChart = tab5.querySelector('.chart-box');
    if(firstChart) tab5.insertBefore(zoomDiv, firstChart);
    else tab5.insertBefore(zoomDiv, tab5.firstChild);
  }

  makeLegend('lgdLmH', d.lm.seriesH);
  makeLegend('lgdLmA', d.lm.seriesA);
  setTimeout(function(){ redrawLMCharts(_lmZoom); }, 30);
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
