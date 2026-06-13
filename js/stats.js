// stats.js
var _bcData = null;
var _bcOddsMode = 'latest'; // 'latest' or 'opening'

function setOddsMode(mode){
  _bcOddsMode = mode;
  var activeStyle   = 'font-size:10px;font-family:var(--mono);padding:2px 9px;border-radius:5px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;font-weight:700';
  var inactiveStyle = 'font-size:10px;font-family:var(--mono);padding:2px 9px;border-radius:5px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer';
  var bL = document.getElementById('oddsToggleLatest');
  var bO = document.getElementById('oddsToggleOpening');
  if(bL) bL.style.cssText = mode === 'latest'  ? activeStyle : inactiveStyle;
  if(bO) bO.style.cssText = mode === 'opening' ? activeStyle : inactiveStyle;
  var lbl = document.getElementById('oddsModeLabel');
  if(lbl) lbl.textContent = mode === 'latest' ? 'Results Only' : 'Results Only · Opening Odds';
  if(_bcData) renderBetCalc(_bcData);
}

function renderBetCalc(data){
  _bcData = data;
  var el=document.getElementById('betCalc');
  var useOpening = _bcOddsMode === 'opening';
  // For opening odds: require ASIAHLN/ASIAALN to be present and non-zero
  var results=data.filter(function(r){
    if(r.STATUS!=='Result'||r.ASIALINE==null||r.RESULTH==null||r.RESULTA==null) return false;
    if(useOpening) return r.ASIAHLN&&r.ASIAHLN>0&&r.ASIAALN&&r.ASIAALN>0;
    return r.ASIAH!=null&&r.ASIAA!=null;
  });
  if(!results.length){el.style.display='none';return;}
  el.style.display='block';

  // Sort by date ascending for chart
  var sorted=results.slice().sort(function(a,b){return(a.DATE||'') < (b.DATE||'')?-1:1;});

  var hPnl=0,aPnl=0,hRunning=[],aRunning=[],hPnls=[],aPnls=[];
  sorted.forEach(function(r){
    var outcome=asiaOutcome(r);
    var oh=useOpening ? r.ASIAHLN : r.ASIAH;
    var oa=useOpening ? r.ASIAALN : r.ASIAA;
    var hp=0,ap=0;
    if(outcome==='ww'){hp=oh-1;ap=-1;}
    else if(outcome==='wh'){hp=(oh-1)*0.5;ap=-0.5;}
    else if(outcome==='dd'){hp=0;ap=0;}
    else if(outcome==='lh'){hp=-0.5;ap=(oa-1)*0.5;}
    else if(outcome==='lw'){hp=-1;ap=oa-1;}
    hPnl+=hp;aPnl+=ap;
    hPnls.push(hp);aPnls.push(ap);
    hRunning.push(Math.round(hPnl*100)/100);
    aRunning.push(Math.round(aPnl*100)/100);
  });

  var n=results.length;
  function fmt(v){return(v>=0?'+':'')+v.toFixed(2);}
  function cls(v){return v>=0?'bc-pos':'bc-neg';}

  $('bc-h-bets').textContent=n;
  $('bc-h-staked').textContent='$'+n+'.00';
  $('bc-h-return').textContent='$'+(n+hPnl).toFixed(2);
  $('bc-h-pnl').innerHTML='<span class="'+cls(hPnl)+'">'+fmt(hPnl)+'</span>';
  $('bc-h-roi').innerHTML='<span class="'+cls(hPnl)+'">'+fmt(hPnl/n*100)+'%</span>';

  $('bc-a-bets').textContent=n;
  $('bc-a-staked').textContent='$'+n+'.00';
  $('bc-a-return').textContent='$'+(n+aPnl).toFixed(2);
  $('bc-a-pnl').innerHTML='<span class="'+cls(aPnl)+'">'+fmt(aPnl)+'</span>';
  $('bc-a-roi').innerHTML='<span class="'+cls(aPnl)+'">'+fmt(aPnl/n*100)+'%</span>';

  // Last 100 points of overall running ROI, plus a 50-bet moving-average ROI for each side.
  var WINDOW = 100;
  var MA_WIN = 50;
  var start = Math.max(0, sorted.length - WINDOW);
  var hRoiPts = [], aRoiPts = [], hMa50 = [], aMa50 = [];
  for(var i = start; i < sorted.length; i++){
    hRoiPts.push(Math.round(hRunning[i] / (i+1) * 10000) / 100);
    aRoiPts.push(Math.round(aRunning[i] / (i+1) * 10000) / 100);
    // MA-50: mean PnL of the last 50 bets up to position i, expressed as ROI%
    var maStart = Math.max(0, i - MA_WIN + 1);
    var hSum = 0, aSum = 0, cnt = 0;
    for(var j = maStart; j <= i; j++){ hSum += hPnls[j]; aSum += aPnls[j]; cnt++; }
    hMa50.push(Math.round(hSum / cnt * 10000) / 100);
    aMa50.push(Math.round(aSum / cnt * 10000) / 100);
  }

  // ── Single panel, shared Y-axis ROI chart
  var wrap=document.querySelector('.bc-chart-wrap');
  wrap.style.height='auto';

  var hLast = hRoiPts[hRoiPts.length-1];
  var aLast = aRoiPts[aRoiPts.length-1];
  var hMaLast = hMa50[hMa50.length-1];
  var aMaLast = aMa50[aMa50.length-1];
  function _pct(v){ return (v>=0?'+':'')+v.toFixed(1)+'%'; }
  function _col(v){ return v>=0 ? '#4ade80' : '#f87171'; }

  wrap.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:18px;font-size:13px;margin-bottom:10px;padding:10px 14px;background:rgba(15,23,42,0.5);border:1px solid var(--border);border-radius:6px">'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="display:inline-block;width:18px;height:3px;background:#f87171;border-radius:1px"></span>'
        +'<b style="color:#f87171">H ROI</b>'
        +'<span style="color:'+_col(hLast)+';font-weight:700;font-family:var(--mono);font-size:15px">'+_pct(hLast)+'</span>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="display:inline-block;width:18px;height:2px;border-top:2px dotted #f87171"></span>'
        +'<b style="color:#f87171;opacity:.85">H MA-50</b>'
        +'<span style="color:'+_col(hMaLast)+';font-weight:700;font-family:var(--mono);font-size:15px">'+_pct(hMaLast)+'</span>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="display:inline-block;width:18px;height:3px;background:#60a5fa;border-radius:1px"></span>'
        +'<b style="color:#60a5fa">A ROI</b>'
        +'<span style="color:'+_col(aLast)+';font-weight:700;font-family:var(--mono);font-size:15px">'+_pct(aLast)+'</span>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="display:inline-block;width:18px;height:2px;border-top:2px dotted #60a5fa"></span>'
        +'<b style="color:#60a5fa;opacity:.85">A MA-50</b>'
        +'<span style="color:'+_col(aMaLast)+';font-weight:700;font-family:var(--mono);font-size:15px">'+_pct(aMaLast)+'</span>'
      +'</div>'
    +'</div>'
    +'<canvas id="betChart" style="display:block;width:100%"></canvas>';

  var hFinal = hRoiPts[hRoiPts.length-1];
  var aFinal = aRoiPts[aRoiPts.length-1];
  var hWinLabel = (hFinal>=0?'+':'')+hFinal.toFixed(1)+'%';
  var aWinLabel = (aFinal>=0?'+':'')+aFinal.toFixed(1)+'%';
  drawRoiPanel('betChart', hRoiPts, aRoiPts, hWinLabel, aWinLabel, WINDOW, sorted.length, hMa50, aMa50);
}

function drawRoiPanel(canvasId, hPts, aPts, hLabel, aLabel, winSize, total, hMaPts, aMaPts){
  var canvas=document.getElementById(canvasId);
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var w=canvas.parentElement.offsetWidth||300;
  var H=100;
  canvas.width=w*dpr; canvas.height=H*dpr;
  canvas.style.width=w+'px'; canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,H);

  var padL=36, padR=8, padT=8, padB=16;
  var cw=w-padL-padR, ch=H-padT-padB;

  // Single shared scale across both series (and MA series if provided)
  var allV=hPts.concat(aPts);
  if(hMaPts && hMaPts.length) allV=allV.concat(hMaPts);
  if(aMaPts && aMaPts.length) allV=allV.concat(aMaPts);
  var dataMn=Math.min.apply(null,allV), dataMx=Math.max.apply(null,allV);
  var pad=(dataMx-dataMn)*0.15||0.1;  // 15% padding each side
  var mn=dataMn-pad;
  var mx=dataMx+pad;
  var range=mx-mn||1;
  function yy(v){return padT+(1-(v-mn)/range)*ch;}
  function xx(i,len){return padL+i/((len||1)-1||1)*cw;}

  // Gridlines + Y-axis labels (single left axis)
  var ticks=4;
  ctx.font='8px IBM Plex Mono'; ctx.textBaseline='middle'; ctx.textAlign='right';
  for(var i=0;i<=ticks;i++){
    var v=mn+(mx-mn)*i/ticks;
    var y=yy(v);
    ctx.fillStyle='#cbd5e1';
    ctx.fillText((v>=0?'+':'')+v.toFixed(1)+'%', padL-3, y);
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cw,y); ctx.stroke();
  }

  // Zero line (shared, single)
  var zy=yy(0);
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(padL,zy); ctx.lineTo(padL+cw,zy); ctx.stroke();
  ctx.setLineDash([]);

  // Draw series — primary (solid + filled) or MA-50 (dotted, no fill, no end-dot)
  function drawSeries(pts, col, isMA){
    if(!pts.length) return;
    if(!isMA){
      var ri=parseInt(col.slice(1,3),16),gi=parseInt(col.slice(3,5),16),bi=parseInt(col.slice(5,7),16);
      var lastV=pts[pts.length-1];

      // Gradient fill between line and zero (primary series only)
      var grad=ctx.createLinearGradient(0,padT,0,padT+ch);
      if(lastV>=0){
        grad.addColorStop(0,'rgba('+ri+','+gi+','+bi+',0.15)');
        grad.addColorStop(1,'rgba('+ri+','+gi+','+bi+',0.01)');
      } else {
        grad.addColorStop(0,'rgba('+ri+','+gi+','+bi+',0.01)');
        grad.addColorStop(1,'rgba('+ri+','+gi+','+bi+',0.15)');
      }
      ctx.beginPath();
      pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i,pts.length),yy(v)):ctx.lineTo(xx(i,pts.length),yy(v));});
      ctx.lineTo(xx(pts.length-1,pts.length),zy);
      ctx.lineTo(xx(0,pts.length),zy);
      ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    }

    // Line — solid for primary, dotted for MA-50
    ctx.strokeStyle=col; ctx.lineWidth=isMA?1.2:1.8; ctx.lineJoin='round';
    ctx.setLineDash(isMA?[3,3]:[]);
    ctx.beginPath();
    pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i,pts.length),yy(v)):ctx.lineTo(xx(i,pts.length),yy(v));});
    ctx.stroke();
    ctx.setLineDash([]);

    if(!isMA){
      // End dot on primary series only
      var ex=xx(pts.length-1,pts.length), ey=yy(pts[pts.length-1]);
      ctx.beginPath(); ctx.arc(ex,ey,2.5,0,Math.PI*2);
      ctx.fillStyle=col; ctx.fill();
    }
  }

  // Draw MA-50 underneath the primary lines so the primary lines stay on top
  if(hMaPts && hMaPts.length) drawSeries(hMaPts,'#f87171', true);
  if(aMaPts && aMaPts.length) drawSeries(aMaPts,'#60a5fa', true);
  drawSeries(hPts,'#f87171', false);
  drawSeries(aPts,'#60a5fa', false);

  // Axis label (brightened from grey to slate so it's readable on dark bg).
  // The four ROI values are now shown in the labels row above the chart.
  ctx.font='9px IBM Plex Mono'; ctx.fillStyle='#cbd5e1'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText('Running ROI% (solid) + MA-50 (dotted) — last '+(winSize||hPts.length)+' of '+(total||hPts.length)+' bets', padL+2, H-4);
}

function renderAsiaStats(data){
  var counts={ww:0,wh:0,dd:0,lh:0,lw:0};
  data.forEach(function(r){var o=asiaOutcome(r);if(o)counts[o]++;});
  var total=counts.ww+counts.wh+counts.dd+counts.lh+counts.lw;
  if(!total){document.getElementById('asiaStats').style.display='none';return;}
  document.getElementById('asiaStats').style.display='block';
  var keys=['ww','wh','dd','lh','lw'];
  keys.forEach(function(k){
    var pct=(counts[k]/total*100).toFixed(1);
    document.getElementById('as-'+k).textContent=counts[k].toLocaleString();
    document.getElementById('as-'+k+'-p').textContent=pct+'%';
  });
  var bar=document.getElementById('as-bar');
  bar.innerHTML=keys.map(function(k){
    var w=(counts[k]/total*100).toFixed(2);
    return'<div class="as-bar-'+k+'" style="width:'+w+'%;transition:width .4s ease" title="'+k+': '+counts[k]+'"></div>';
  }).join('');
}
