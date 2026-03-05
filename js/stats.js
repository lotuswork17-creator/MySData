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

    // Store series for redraw when panel is revealed
  window._betChartData = { hRunning: hRunning, aRunning: aRunning, hPnl: hPnl, aPnl: aPnl };
  drawBetChart();
}

function drawBetChart(){
  var cd = window._betChartData;
  if(!cd) return;
  var hRunning=cd.hRunning, aRunning=cd.aRunning, hPnl=cd.hPnl, aPnl=cd.aPnl;
  function fmt(v){return(v>=0?'+':'')+v.toFixed(2);}

  // Draw chart
  var canvas=document.getElementById('betChart');
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var w=canvas.parentElement.offsetWidth||300, h=80;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);

  var all=hRunning.concat(aRunning);
  var mn=Math.min(0,Math.min.apply(null,all)),mx=Math.max(0,Math.max.apply(null,all));
  var range=mx-mn||1;
  var pad=8;
  function yx(v){return pad+(1-(v-mn)/range)*(h-pad*2);}
  function xx(i){return i/(hRunning.length-1||1)*(w-pad*2)+pad;}

  // Zero line
  ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad,yx(0));ctx.lineTo(w-pad,yx(0));ctx.stroke();

  // Draw line for H and A
  [[hRunning,'#f87171'],[aRunning,'#60a5fa']].forEach(function(pair){
    var pts=pair[0],col=pair[1];
    ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();
    pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i),yx(v)):ctx.lineTo(xx(i),yx(v));});
    ctx.stroke();
    // Fill under line
    ctx.beginPath();
    pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i),yx(v)):ctx.lineTo(xx(i),yx(v));});
    ctx.lineTo(xx(pts.length-1),yx(0));ctx.lineTo(pad,yx(0));ctx.closePath();
    ctx.fillStyle=col.replace(')',',0.08)').replace('rgb','rgba');ctx.fill();
  });

  // Labels
  ctx.font='9px IBM Plex Mono';ctx.textBaseline='middle';
  ctx.fillStyle='#f87171';ctx.fillText('H '+fmt(hPnl),pad+2,yx(hRunning[hRunning.length-1])-8);
  ctx.fillStyle='#60a5fa';ctx.fillText('A '+fmt(aPnl),pad+2,yx(aRunning[aRunning.length-1])+8);
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
