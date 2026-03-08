// stats.js
function renderBetCalc(data){
  var el=document.getElementById('betCalc');
  var results=data.filter(function(r){
    return r.STATUS==='Result'&&r.ASIALINE!=null&&r.RESULTH!=null&&r.RESULTA!=null&&r.ASIAH!=null&&r.ASIAA!=null;
  });
  if(!results.length){el.style.display='none';return;}
  el.style.display='block';

  // Sort by date ascending for chart
  var sorted=results.slice().sort(function(a,b){return(a.DATE||'') < (b.DATE||'')?-1:1;});

  var hPnl=0,aPnl=0,hRunning=[],aRunning=[];
  sorted.forEach(function(r){
    var outcome=asiaOutcome(r);
    var oh=r.ASIAH,oa=r.ASIAA;
    var hp=0,ap=0;
    if(outcome==='ww'){hp=oh-1;ap=-1;}
    else if(outcome==='wh'){hp=(oh-1)*0.5;ap=-0.5;}
    else if(outcome==='dd'){hp=0;ap=0;}
    else if(outcome==='lh'){hp=-0.5;ap=(oa-1)*0.5;}
    else if(outcome==='lw'){hp=-1;ap=oa-1;}
    hPnl+=hp;aPnl+=ap;
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

  // Show only the last 100 bets for clear trend reading
  var WINDOW = 100;
  var hRoiPts=[], aRoiPts=[];
  var start = Math.max(0, sorted.length - WINDOW);
  var winCount=0, hWinPnl=0, aWinPnl=0;
  sorted.forEach(function(r,i){
    if(i < start) return;
    winCount++;
    hWinPnl += hRunning[i] - (i > 0 ? hRunning[i-1] : 0);
    aWinPnl += aRunning[i] - (i > 0 ? aRunning[i-1] : 0);
    // ROI% over the window only so Y-axis fits last 100 values
    hRoiPts.push(Math.round(hWinPnl/winCount*10000)/100);
    aRoiPts.push(Math.round(aWinPnl/winCount*10000)/100);
  });

  // ── Single panel, shared Y-axis ROI chart
  var wrap=document.querySelector('.bc-chart-wrap');
  wrap.style.height='auto';
  wrap.innerHTML='<canvas id="betChart" style="display:block;width:100%"></canvas>';

  drawRoiPanel('betChart', hRoiPts, aRoiPts, fmt(hPnl/n*100)+'%', fmt(aPnl/n*100)+'%', WINDOW, sorted.length);
}

function drawRoiPanel(canvasId, hPts, aPts, hLabel, aLabel, window, total){
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

  // Single shared scale across both series
  var allV=hPts.concat(aPts);
  var mn=Math.min(0,Math.min.apply(null,allV));
  var mx=Math.max(0,Math.max.apply(null,allV));
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

  // Draw series with fill
  function drawSeries(pts, col){
    if(!pts.length) return;
    var ri=parseInt(col.slice(1,3),16),gi=parseInt(col.slice(3,5),16),bi=parseInt(col.slice(5,7),16);
    var lastV=pts[pts.length-1];

    // Gradient fill between line and zero
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

    // Line
    ctx.strokeStyle=col; ctx.lineWidth=1.8; ctx.lineJoin='round';
    ctx.beginPath();
    pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i,pts.length),yy(v)):ctx.lineTo(xx(i,pts.length),yy(v));});
    ctx.stroke();

    // End dot
    var ex=xx(pts.length-1,pts.length), ey=yy(lastV);
    ctx.beginPath(); ctx.arc(ex,ey,2.5,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
  }

  drawSeries(hPts,'#f87171');
  drawSeries(aPts,'#60a5fa');

  // End labels (nudge apart if overlapping)
  var hLastY=yy(hPts[hPts.length-1]);
  var aLastY=yy(aPts[aPts.length-1]);
  if(Math.abs(hLastY-aLastY)<12){ hLastY-=6; aLastY+=6; }
  ctx.font='bold 9px IBM Plex Mono'; ctx.textBaseline='middle'; ctx.textAlign='right';
  ctx.fillStyle=hPts[hPts.length-1]>=0?'#4ade80':'#f87171';
  ctx.fillText('H '+hLabel, padL+cw-2, hLastY-6);
  ctx.fillStyle=aPts[aPts.length-1]>=0?'#4ade80':'#60a5fa';
  ctx.fillText('A '+aLabel, padL+cw-2, aLastY+6);

  // Axis label
  ctx.font='7px IBM Plex Mono'; ctx.fillStyle='#64748b'; ctx.textAlign='left';
  ctx.fillText('ROI %  (last '+(window||hPts.length)+' of '+(total||hPts.length)+' bets)', padL+2, H-4);
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
