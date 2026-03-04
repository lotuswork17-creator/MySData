// ── report-smart.js — Tab 4: Smart Money Signals ──

var smDefs = [
  {key:'sm1',label:'▲ Rose + H≥67%',    full:'▲ Line Rose + Expert H≥67%',                  side:'H'},
  {key:'sm2',label:'▲ Rose + H≥83%+Vig',full:'▲ Line Rose + Expert H≥83% + Vig<6%',         side:'H'},
  {key:'sm3',label:'▲ Rose + H≥67%+Vig',full:'▲ Line Rose + Expert H≥67% + Vig<6%',         side:'H'},
  {key:'sm4',label:'A≥83%+Flat→H',      full:'Expert A≥83% + Line Unchanged (H bet)',        side:'H'},
  {key:'sm5',label:'A≥83%+Rose→H',      full:'Expert A≥83% + Line Rose (H bet)',             side:'H'},
  {key:'sm6',label:'▼ Drop+A≥50%+Vig',  full:'▼ Line Dropped + Expert A≥50% + Vig<6%',      side:'A'},
  {key:'sm7',label:'H≥83%+Flat→A',      full:'Expert H≥83% + Line Unchanged (A bet)',        side:'A'},
];

function computeSmart(results){
  var table = smDefs.map(function(def){
    var sub  = results.filter(function(r){ return smFilter(r, def.key); });
    var n    = sub.length;
    var fn   = def.side==='H' ? cH : cA;
    var rois = sub.map(fn).filter(function(x){return x!==null;});
    return{key:def.key, label:def.label, full:def.full,
           n:n, roi:roiOf(rois), side:def.side, pts:runPnl(sub,fn)};
  });
  return { table:table };
}

function renderSmart(d){
  var area = document.getElementById('smartChartsArea');
  area.innerHTML = d.smart.table.map(function(sm){
    var col     = sm.side==='H' ? '#f87171' : '#60a5fa';
    var roiNote = ' — ROI: '+fmtRoi(sm.roi);
    var rel     = sm.n>=30 ? '' : sm.n>=15 ? ' ⚠ small sample' : ' ⚠ very small';
    return '<div class="chart-box">'
      +'<div class="chart-box-label">'+sm.full+' (N='+sm.n+')'+roiNote+rel+'</div>'
      +'<div class="chart-legend">'
      +'<span><span class="ld" style="background:'+col+'"></span>'+sm.side+' bet</span>'
      +'</div>'
      +'<canvas id="cSm_'+sm.key+'"></canvas>'
      +'</div>';
  }).join('');
  setTimeout(function(){
    d.smart.table.forEach(function(sm){
      var col = sm.side==='H' ? '#f87171' : '#60a5fa';
      drawChart('cSm_'+sm.key, [{label:sm.side+' bet',color:col,pts:sm.pts}], d.monthBounds, 80);
    });
  }, 30);
  document.getElementById('smartGrid').innerHTML = d.smart.table.map(function(x){
    var rel = x.n>=30?'✅ Reliable':x.n>=15?'⚠ Small sample':'⚠️ Very small';
    return '<div class="sm-card"><div class="sm-card-top">'
      +'<div class="sm-card-label">'+x.full+'</div>'
      +'<div class="sm-card-roi '+posNeg(x.roi)+'">'+fmtRoi(x.roi)+'</div></div>'
      +'<div class="sm-card-meta"><span>N='+x.n+'</span>'
      +'<span><span class="sm-badge '+(x.side==='H'?'sm-h':'sm-a')+'">'+x.side+' bet</span></span>'
      +'<span>'+rel+'</span></div></div>';
  }).join('');
}
