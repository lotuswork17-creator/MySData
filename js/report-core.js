// ── report-core.js ──
// Shared by all report tab modules.
// Contains: helpers, chart engine, outcome calculators, computeReport()

// ── Inlined from helpers.js (no external dependency) ──
function expertScore(r){
  function ts(v){if(!v)return null;var u=String(v).toUpperCase();
    if(u==='H'||u==='1H'||u==='AH')return'H';
    if(u==='D'||u==='1D'||u==='AD')return'D';
    if(u==='A'||u==='1A'||u==='AA')return'A';
    return null;}
  var th=(ts(r.JCTIPSUM)==='H'?1:0)+(ts(r.JCTIPSID)==='H'?1:0)+(ts(r.TIPSIDMAC)==='H'?1:0)+(ts(r.TIPSONID)==='H'?1:0)+(r.GEMH||0)+(r.GPTH||0);
  var td=(ts(r.JCTIPSUM)==='D'?1:0)+(ts(r.JCTIPSID)==='D'?1:0)+(ts(r.TIPSIDMAC)==='D'?1:0)+(ts(r.TIPSONID)==='D'?1:0)+(r.GEMD||0)+(r.GPTD||0);
  var ta=(ts(r.JCTIPSUM)==='A'?1:0)+(ts(r.JCTIPSID)==='A'?1:0)+(ts(r.TIPSIDMAC)==='A'?1:0)+(ts(r.TIPSONID)==='A'?1:0)+(r.GEMA||0)+(r.GPTA||0);
  var tt=th+td+ta; if(!tt) return null;
  return{h:Math.round(th*100/tt),d:Math.round(td*100/tt),a:Math.round(ta*100/tt)};
}

// ── Global state ──
var RD    = null;   // computed report data, set after loadReport()
var drawn = [];     // drawn[i] = true once tab i has rendered its charts

// ── Palette ──
var COLS = ['#f87171','#60a5fa','#4ade80','#fbbf24','#a78bfa','#fb923c','#34d399','#e879f9'];

// ── Format helpers ──
function fmtPnl(v){ return (v>=0?'+':'')+v.toFixed(2); }
function fmtRoi(v){ return (v>=0?'+':'')+v.toFixed(1)+'%'; }
function posNeg(v){ return v>=0 ? 'pos' : 'neg'; }
function roiOf(arr){
  if(!arr.length) return 0;
  return Math.round(arr.reduce(function(s,v){return s+v;},0)/arr.length*1000)/10;
}

// ── Outcome helpers ──
function ao(r){
  if(r.STATUS!=='Result'||r.ASIALINE==null||r.RESULTH==null||r.RESULTA==null) return null;
  var m=Math.round((r.RESULTH-r.RESULTA+r.ASIALINE)*4)/4;
  if(m>=0.5)return'ww'; if(m===0.25)return'wh'; if(m===0)return'dd'; if(m===-0.25)return'lh'; return'lw';
}
function cH(r){
  var o=ao(r); if(!o) return null;
  var od=r.ASIAH; if(!od||od<=0) return null;
  if(o==='ww')return od-1; if(o==='wh')return(od-1)*0.5; if(o==='dd')return 0; if(o==='lh')return-0.5; return-1;
}
function cA(r){
  var o=ao(r); if(!o) return null;
  var od=r.ASIAA; if(!od||od<=0) return null;
  if(o==='lw')return od-1; if(o==='lh')return(od-1)*0.5; if(o==='dd')return 0; if(o==='wh')return-0.5; return-1;
}

// ── Running ROI% ──
function runPnl(subset, fn){
  var pnl=0, n=0, pts=[];
  subset.forEach(function(r){ var v=fn(r); if(v!==null){ pnl=Math.round((pnl+v)*1000)/1000; n++; pts.push(Math.round(pnl/n*1000)/10); } });
  return pts;
}

// ── Chart engine — matches stats.js front page style exactly ──
function drawChart(canvasId, series, monthBoundaries, chartH){
  chartH = chartH || 100;
  var el = document.getElementById(canvasId);
  if(!el) return;
  var ctx = el.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var w = el.parentElement.offsetWidth - 20 || 300;
  var h = chartH + 18;
  el.width = w*dpr; el.height = h*dpr;
  el.style.width = w+'px'; el.style.height = h+'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  var pad = 8;
  var chartTop = pad;
  var chartBot = h - 18;
  var chartH2  = chartBot - chartTop;

  var all = [];
  series.forEach(function(s){ s.pts.forEach(function(v){ all.push(v); }); });
  if(!all.length) return;
  var mn = Math.min(0, Math.min.apply(null, all));
  var mx = Math.max(0, Math.max.apply(null, all));
  var range = mx - mn || 1;

  var nPts = 0;
  series.forEach(function(s){ if(s.pts.length > nPts) nPts = s.pts.length; });
  if(!nPts) return;

  function yy(v){ return chartTop + (1-(v-mn)/range)*chartH2; }

  // Zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, yy(0)); ctx.lineTo(w-pad, yy(0)); ctx.stroke();

  // Month boundary ticks
  if(monthBoundaries && monthBoundaries.length){
    ctx.fillStyle  = '#e2e8f0';
    ctx.font       = '9px IBM Plex Mono';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'bottom';
    monthBoundaries.forEach(function(mb){
      var x = pad + mb.xFrac * (w - pad*2);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(x, chartTop); ctx.lineTo(x, chartBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(mb.label, x, h-2);
    });
  }

  // Series lines
  series.forEach(function(s){
    if(!s.pts.length) return;
    var col = s.color;
    var pts = s.pts;
    var thisPts = pts.length;
    function xi(i){ return pad + i/(nPts-1||1) * (w-pad*2); }

    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach(function(v,i){ i===0 ? ctx.moveTo(xi(i),yy(v)) : ctx.lineTo(xi(i),yy(v)); });
    ctx.stroke();

    ctx.beginPath();
    pts.forEach(function(v,i){ i===0 ? ctx.moveTo(xi(i),yy(v)) : ctx.lineTo(xi(i),yy(v)); });
    ctx.lineTo(xi(thisPts-1), yy(0)); ctx.lineTo(xi(0), yy(0)); ctx.closePath();
    var r=parseInt(col.slice(1,3),16), g=parseInt(col.slice(3,5),16), b=parseInt(col.slice(5,7),16);
    ctx.fillStyle = 'rgba('+r+','+g+','+b+',0.08)'; ctx.fill();

    var lastV = pts[pts.length-1];
    ctx.font = '9px IBM Plex Mono'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.textAlign = 'left';
    var lx = xi(thisPts-1)+3, ly = yy(lastV);
    if(lx > w-36) lx = xi(thisPts-1)-40;
    ctx.fillText(fmtRoi(lastV), lx, ly);
  });
}

// ── Legend helper ──
function makeLegend(elId, series){
  var el = document.getElementById(elId); if(!el) return;
  el.innerHTML = series.map(function(s){
    return '<span><span class="ld" style="background:'+s.color+'"></span>'+s.label+'</span>';
  }).join('');
}

// ── Smart Money filter ──
function smFilter(r, key){
  var gl=r.ASIALINE, ln=r.ASIALINELN, sh=r.ASIAH, sa=r.ASIAA;
  var sld = gl!=null&&ln!=null ? Math.round((gl-ln)*100)/100 : null;
  var e   = expertScore(r);
  var sv  = sh&&sa&&sh>0&&sa>0 ? (1/sh+1/sa-1)*100 : null;
  if(key==='sm1') return sld!==null&&sld>0&&e&&e.h>=67;
  if(key==='sm2') return sld!==null&&sld>0&&e&&e.h>=83&&sv!==null&&sv<6;
  if(key==='sm3') return sld!==null&&sld>0&&e&&e.h>=67&&sv!==null&&sv<6;
  if(key==='sm4') return sld!==null&&sld===0&&e&&e.a>=83;
  if(key==='sm5') return sld!==null&&sld>0&&e&&e.a>=83;
  if(key==='sm6') return sld!==null&&sld<0&&e&&e.a>=50&&sv!==null&&sv<6;
  if(key==='sm7') return sld!==null&&sld===0&&e&&e.h>=83;
  return false;
}

// ── computeReport(records) → RD ──
// Called once on load. Returns the full data object used by all render functions.
// To add a new tab: add a new section here and return it in the object at the bottom.
function computeReport(records){
  var results = records.filter(function(r){ return ao(r) && r.DATE && r.DATE.length>=7; });
  results.sort(function(a,b){ return a.DATE < b.DATE ? -1 : 1; });
  var N = results.length;

  // Month boundaries for x-axis ticks (shared by all charts)
  var monthBounds = [], seen = {};
  results.forEach(function(r,i){
    var ym = r.DATE.slice(0,7);
    if(!seen[ym]){ seen[ym]=true; monthBounds.push({label:ym.slice(2), xFrac:i/(N-1||1)}); }
  });

  // All-match P&L baselines (shared)
  var allHpts = runPnl(results, cH);
  var allApts = runPnl(results, cA);

  // ── Each tab's compute is delegated to its own module ──
  // (compute functions are defined in report-*.js and called here)
  return {
    monthBounds : monthBounds,
    allHpts     : allHpts,
    allApts     : allApts,
    results     : results,      // raw sorted results — available to all tab computes
    league      : computeLeague(results, monthBounds),
    month       : computeMonth(results, allHpts, allApts),
    line        : computeLine(results),
    expert      : computeExpert(results),
    smart       : computeSmart(results, allHpts, allApts),
    lm          : computeLM(results, allHpts, allApts),
    odds        : computeOdds(results),
    jcexpert    : computeJCExpert(results),
    escore      : computeEScore(results),
    ml          : computeML(results, records),
    jcrelation  : computeJCRelation(results, records),
  };
}
