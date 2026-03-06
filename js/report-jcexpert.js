// ── report-jcexpert.js — Tab 7: Expert Combination × AsiaLine × Market Lean ──

// ════════════════════════════════════════════════════════════
// COMPUTE
// ════════════════════════════════════════════════════════════
function computeJCExpert(results){
  var EXPERTS = ['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var TIPS    = ['H','D','A','HD','AD'];
  var LINES   = [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];
  var LEANS   = ['hLean','bal','aLean'];

  function ts(v){
    if(!v) return null;
    var u=String(v).trim().toUpperCase();
    if(u==='H'||u==='1H') return 'H';
    if(u==='D'||u==='1D') return 'D';
    if(u==='A'||u==='1A') return 'A';
    return null;
  }

  function normLine(v){
    if(v==null) return null;
    var r=Math.round(v*4)/4;
    for(var i=0;i<LINES.length;i++){ if(Math.abs(LINES[i]-r)<0.01) return LINES[i]; }
    return null;
  }

  function leanOf(r){
    if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0) return null;
    var ph=1/r.ASIAH, pa=1/r.ASIAA, hp=ph/(ph+pa)*100;
    if(hp>=52) return 'hLean';
    if(hp<=48) return 'aLean';
    return 'bal';
  }

  function matchCombo(r, combo, tip){
    for(var i=0;i<combo.length;i++){
      var t=ts(r[combo[i]]);
      if(tip==='H'  && t!=='H') return false;
      if(tip==='D'  && t!=='D') return false;
      if(tip==='A'  && t!=='A') return false;
      if(tip==='HD' && t!=='H' && t!=='D') return false;
      if(tip==='AD' && t!=='A' && t!=='D') return false;
    }
    return true;
  }

  function roiOf(vals){
    if(!vals.length) return null;
    return Math.round(vals.reduce(function(s,v){return s+v;},0)/vals.length*1000)/10;
  }

  function runPts(sub, fn){
    var pnl=0, pts=[];
    sub.forEach(function(r){ var v=fn(r); if(v!==null){pnl=Math.round((pnl+v)*1000)/1000; pts.push(pnl);} });
    return pts;
  }

  var annotated = results.map(function(r){
    return { r:r, line:normLine(r.ASIALINE), lean:leanOf(r) };
  });

  function getCombos(){
    var out=[], N=EXPERTS.length;
    for(var i=0;i<N;i++) out.push([EXPERTS[i]]);
    for(var i=0;i<N;i++) for(var j=i+1;j<N;j++) out.push([EXPERTS[i],EXPERTS[j]]);
    for(var i=0;i<N;i++) for(var j=i+1;j<N;j++) for(var k=j+1;k<N;k++) out.push([EXPERTS[i],EXPERTS[j],EXPERTS[k]]);
    out.push(EXPERTS.slice());
    return out;
  }

  var rows=[];
  var combos=getCombos();
  combos.forEach(function(combo){
    var ck=combo.slice().sort().join(',');
    TIPS.forEach(function(tip){
      var base=annotated.filter(function(a){ return matchCombo(a.r,combo,tip); });
      if(!base.length) return;

      function pushRow(sub, line, lean){
        if(sub.length<10) return;
        var hv=[], av=[];
        sub.forEach(function(a){ var h=cH(a.r),a2=cA(a.r); if(h!==null)hv.push(h); if(a2!==null)av.push(a2); });
        var hr=roiOf(hv), ar=roiOf(av);
        if(hr===null||ar===null) return;
        rows.push({
          comboKey:ck, tip:tip, line:line, lean:lean,
          n:sub.length, hroi:hr, aroi:ar, edge:Math.round((hr-ar)*10)/10,
          hpts:runPts(sub.map(function(a){return a.r;}),cH),
          apts:runPts(sub.map(function(a){return a.r;}),cA)
        });
      }

      pushRow(base,'All','All');
      LEANS.forEach(function(lg){ pushRow(base.filter(function(a){return a.lean===lg;}),'All',lg); });
      LINES.forEach(function(line){
        var ls=base.filter(function(a){return a.line===line;});
        pushRow(ls,line,'All');
        LEANS.forEach(function(lg){ pushRow(ls.filter(function(a){return a.lean===lg;}),line,lg); });
      });
    });
  });

  return { rows:rows };
}

// ════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════
function renderJCExpert(RD){
  var allRows=RD.jcexpert.rows;

  var EXPERTS    =['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var EXP_SHORT  ={JCTIPSUM:'JC Sum',JCTIPSID:'JC SID',TIPSIDMAC:'SID Mac',TIPSONID:'ON ID'};
  var EXP_COLOR  ={JCTIPSUM:'#4ade80',JCTIPSID:'#60a5fa',TIPSIDMAC:'#f87171',TIPSONID:'#a78bfa'};
  var TIP_COLOR  ={H:'#f87171',D:'#a78bfa',A:'#60a5fa',HD:'#fb923c',AD:'#34d399'};
  var LEAN_LABEL ={All:'All',hLean:'H Fav ≥52%',bal:'Balance 48–52%',aLean:'A Fav ≤48%'};
  var LINE_LABEL ={'-1':'-1','-0.75':'-0.75','-0.5':'-0.5','-0.25':'-0.25','0':'0','0.25':'+0.25','0.5':'+0.5','0.75':'+0.75','1':'+1','All':'All'};
  var LINES_ALL  =[-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];

  var selExperts =EXPERTS.slice();
  var selTip     ='all';
  var selLine    ='all';
  var selLean    ='all';
  var minN       =10;
  var sortCol    ='edge';
  var sortDir    =-1;
  var viewMode   ='heatmap';

  var tab7=document.getElementById('tab7');

  function fmt(v){ return (v>0?'+':'')+v.toFixed(1)+'%'; }
  function vcls(v){ return v>=5?'pos':v<=-5?'neg':'neu'; }
  function roiBg(v){ return v>=10?'rgba(74,222,128,0.22)':v>=5?'rgba(74,222,128,0.1)':v<=-10?'rgba(248,113,113,0.22)':v<=-5?'rgba(248,113,113,0.1)':''; }
  function stars(e){ var a=Math.abs(e); return a>=20?'★★★':a>=10?'★★':a>=5?'★':''; }
  function comboKey(arr){ return arr.slice().sort().join(','); }
  function selKey(){ return comboKey(selExperts); }

  function rowVis(r){
    if(r.comboKey!==selKey()) return false;
    if(selTip!=='all' && r.tip!==selTip) return false;
    if(selLine!=='all'){ var lv=selLine==='All'?'All':parseFloat(selLine); if(r.line!==lv) return false; }
    if(selLean!=='all' && r.lean!==selLean) return false;
    if(r.n<minN) return false;
    return true;
  }

  // ── Expert selector
  function expertSelectorHTML(){
    var h='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:10px">'
      +'<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:8px;font-family:var(--mono)">SELECT EXPERTS — AND logic (all selected must agree on pick)</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
    EXPERTS.forEach(function(e){
      var on=selExperts.indexOf(e)>=0, c=EXP_COLOR[e];
      h+='<button class="jce-exp-btn" data-e="'+e+'" style="padding:6px 14px;border-radius:6px;border:2px solid '+(on?c:'var(--border)')+';background:'+(on?c+'22':'var(--surface)')+';color:'+(on?c:'var(--muted)')+';font-size:12px;font-weight:700;cursor:pointer;font-family:var(--sans)">'+EXP_SHORT[e]+'</button>';
    });
    h+='</div><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding-top:6px;border-top:1px solid var(--border)">'
      +'<span style="font-size:9px;color:var(--muted);font-family:var(--mono);margin-right:4px">PRESETS:</span>';
    [{label:'All 4',v:EXPERTS.slice()},{label:'JC Only',v:['JCTIPSUM','JCTIPSID']},{label:'SID+Mac',v:['JCTIPSID','TIPSIDMAC']},{label:'Sum+Mac',v:['JCTIPSUM','TIPSIDMAC']},{label:'Sum+ON',v:['JCTIPSUM','TIPSONID']},{label:'Mac+ON',v:['TIPSIDMAC','TIPSONID']}].forEach(function(p){
      var on=comboKey(p.v)===selKey();
      h+='<button class="jce-preset-btn" data-v="'+p.v.join('|')+'" style="padding:3px 9px;border-radius:4px;border:1px solid '+(on?'#60a5fa':'var(--border)')+';background:'+(on?'#60a5fa22':'var(--surface)')+';color:'+(on?'#60a5fa':'var(--muted)')+';font-size:10px;font-weight:600;cursor:pointer;font-family:var(--sans)">'+p.label+'</button>';
    });
    h+='</div><div style="margin-top:7px;font-size:11px;color:var(--muted);font-family:var(--mono)">Active: '
      +selExperts.map(function(e){return '<span style="color:'+EXP_COLOR[e]+';font-weight:700">'+EXP_SHORT[e]+'</span>';}).join(' <span style="color:#475569">AND</span> ')
      +'</div></div>';
    return h;
  }

  // ── Filter bar
  function filterBar(){
    function grp(label, g, opts){
      var h='<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-bottom:5px">'
        +'<span style="font-size:10px;color:#e2e8f0;font-family:var(--mono);min-width:44px">'+label+'</span>';
      opts.forEach(function(o){
        var on=o.a;
        h+='<button class="jce-filter-btn" data-g="'+g+'" data-v="'+o.v+'" style="padding:2px 9px;border-radius:4px;border:1px solid '+(on?'#60a5fa':'var(--border)')+';background:'+(on?'#60a5fa22':'var(--surface)')+';color:'+(on?'#60a5fa':'var(--muted)')+';font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans)">'+o.t+'</button>';
      });
      return h+'</div>';
    }
    var tA=[{v:'all',t:'All',a:selTip==='all'}].concat(['H','D','A','HD','AD'].map(function(t){return{v:t,t:t,a:selTip===t};}));
    var lnA=[{v:'all',t:'Any',a:selLine==='all'},{v:'All',t:'Combined',a:selLine==='All'}].concat(LINES_ALL.map(function(l){return{v:''+l,t:LINE_LABEL[''+l],a:selLine===''+l};}));
    var leA=[{v:'all',t:'Any',a:selLean==='all'},{v:'hLean',t:'H Fav',a:selLean==='hLean'},{v:'bal',t:'Balance',a:selLean==='bal'},{v:'aLean',t:'A Fav',a:selLean==='aLean'}];
    var nA=[10,15,20,30,50].map(function(n){return{v:''+n,t:'N≥'+n,a:minN===n};});
    var sA=[{v:'edge',t:'Edge',a:sortCol==='edge'},{v:'hroi',t:'H ROI',a:sortCol==='hroi'},{v:'aroi',t:'A ROI',a:sortCol==='aroi'},{v:'n',t:'Count',a:sortCol==='n'}];
    var vA=[{v:'heatmap',t:'⬛ Heatmap',a:viewMode==='heatmap'},{v:'table',t:'📋 Table',a:viewMode==='table'},{v:'chart',t:'📈 Charts',a:viewMode==='chart'}];
    return '<div id="jce-filters">'
      +grp('Tip:','tip',tA)+grp('Line:','line',lnA)+grp('Lean:','lean',leA)
      +grp('Min N:','minn',nA)+grp('Sort:','sort',sA)+grp('View:','view',vA)
      +'</div>';
  }

  // ── Heatmap
  function buildHeatmap(){
    var ck=selKey();
    var leanKey=selLean==='all'?'All':selLean;
    var TIPS_SHOW=['H','D','A','HD','AD'];

    function cell(tip,line,rk){
      var r=allRows.find(function(x){return x.comboKey===ck&&x.tip===tip&&x.line===line&&x.lean===leanKey;});
      if(!r||r.n<minN) return '<td style="color:#1e293b;text-align:center;font-size:10px;padding:4px 6px">—</td>';
      var v=r[rk], bg=roiBg(v), col=v>=5?'#4ade80':v<=-5?'#f87171':'#94a3b8';
      return '<td style="text-align:center;padding:4px 6px;'+(bg?'background:'+bg:'')+'"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+col+'">'+fmt(v)+'</div><div style="font-size:9px;color:#475569">n='+r.n+'</div></td>';
    }

    function tbl(rk,col,lbl){
      var h='<div style="margin-bottom:16px"><div style="font-size:10px;font-weight:700;color:'+col+';margin-bottom:5px;font-family:var(--mono)">'+lbl+'</div>'
        +'<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px;min-width:100%"><thead><tr>'
        +'<th style="background:#0f172a;color:#e2e8f0;padding:5px 8px;font-size:9px;text-align:left;white-space:nowrap">Tip</th>';
      LINES_ALL.forEach(function(l){h+='<th style="background:#0f172a;color:#e2e8f0;padding:5px 6px;text-align:center;font-size:9px;white-space:nowrap">'+LINE_LABEL[''+l]+'</th>';});
      h+='<th style="background:#0f172a;color:#e2e8f0;padding:5px 6px;text-align:center;font-size:9px">All</th></tr></thead><tbody>';
      TIPS_SHOW.forEach(function(tip){
        var c=TIP_COLOR[tip];
        h+='<tr><td style="padding:4px 8px;white-space:nowrap"><span style="display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;font-family:var(--mono);background:'+c+'22;color:'+c+'">'+tip+'</span></td>';
        LINES_ALL.forEach(function(l){h+=cell(tip,l,rk);});
        h+=cell(tip,'All',rk);
        h+='</tr>';
      });
      return h+'</tbody></table></div></div>';
    }

    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      +'<div>'+tbl('hroi','#f87171','H-SIDE ROI')+'</div>'
      +'<div>'+tbl('aroi','#60a5fa','A-SIDE ROI')+'</div>'
      +'</div>';
  }

  // ── Table
  function buildTable(){
    var vis=allRows.filter(rowVis).slice();
    vis.sort(function(a,b){return (b[sortCol]-a[sortCol])*sortDir;});
    if(!vis.length) return '<div style="padding:20px;color:var(--muted);text-align:center">No rows — try lowering Min N or changing filters</div>';

    function tb(t){ var c=TIP_COLOR[t]; return '<span style="display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;font-family:var(--mono);background:'+c+'22;color:'+c+'">'+t+'</span>'; }
    function lb(l){ return '<span style="font-family:var(--mono);font-size:11px;color:#cbd5e1">'+(LINE_LABEL[''+l]||l)+'</span>'; }
    function lnb(l){ var cs={All:'#64748b',hLean:'#f87171',bal:'#fbbf24',aLean:'#60a5fa'}; var c=cs[l]||'#64748b'; return '<span style="padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;background:'+c+'18;color:'+c+'">'+LEAN_LABEL[l]+'</span>'; }
    function ebar(e){ var MAX=40,pct=Math.min(Math.abs(e)/MAX*100,100),col=e>=0?'#f87171':'#60a5fa',left=e>=0?50:50-pct;
      return '<div style="display:flex;align-items:center;gap:5px"><div style="width:70px;height:6px;border-radius:3px;background:#1e293b;position:relative;overflow:hidden;flex-shrink:0"><div style="height:6px;position:absolute;left:'+left+'%;width:'+pct+'%;background:'+col+';border-radius:3px"></div></div><span style="font-family:var(--mono);font-size:11px;font-weight:700;min-width:44px" class="'+vcls(e)+'">'+fmt(e)+'</span></div>'; }
    function spk(hp,ap){ var W=80,H=26,p=2,all=hp.concat(ap); if(!all.length) return '';
      var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),range=mx-mn||1;
      function py(v){return p+(1-(v-mn)/range)*(H-p*2);}
      function ln(pts,col){if(!pts.length)return'';var d=pts.map(function(v,i){var x=p+i/(pts.length-1||1)*(W-p*2);return(i===0?'M':'L')+x.toFixed(1)+','+py(v).toFixed(1);}).join(' ');return'<path d="'+d+'" stroke="'+col+'" stroke-width="1.5" fill="none"/>';}
      var zy=py(0).toFixed(1);
      return '<svg width="'+W+'" height="'+H+'" style="display:block"><line x1="'+p+'" y1="'+zy+'" x2="'+(W-p)+'" y2="'+zy+'" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>'+ln(hp,'#f87171')+ln(ap,'#60a5fa')+'</svg>'; }

    var h='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
      +'<th>Tip</th><th>Line</th><th>Lean</th>'
      +'<th class="num" onclick="jceSort(\'n\')" style="cursor:pointer">N '+(sortCol==='n'?sortDir>0?'↑':'↓':'')+'</th>'
      +'<th class="num" onclick="jceSort(\'hroi\')" style="cursor:pointer;color:#f87171">H ROI '+(sortCol==='hroi'?sortDir>0?'↑':'↓':'')+'</th>'
      +'<th class="num" onclick="jceSort(\'aroi\')" style="cursor:pointer;color:#60a5fa">A ROI '+(sortCol==='aroi'?sortDir>0?'↑':'↓':'')+'</th>'
      +'<th onclick="jceSort(\'edge\')" style="cursor:pointer;min-width:130px">Edge '+(sortCol==='edge'?sortDir>0?'↑':'↓':'')+'</th>'
      +'<th>Trend</th><th>★</th></tr></thead><tbody>';
    vis.forEach(function(r){
      var warn=r.n<25?'<span style="color:#fbbf24;font-size:9px"> !</span>':'';
      h+='<tr><td>'+tb(r.tip)+'</td><td>'+lb(r.line)+'</td><td>'+lnb(r.lean)+'</td>'
        +'<td class="num">'+r.n+warn+'</td>'
        +'<td class="num" style="'+(roiBg(r.hroi)?'background:'+roiBg(r.hroi):'')+'"><span class="'+vcls(r.hroi)+'" style="font-weight:700">'+fmt(r.hroi)+'</span></td>'
        +'<td class="num" style="'+(roiBg(r.aroi)?'background:'+roiBg(r.aroi):'')+'"><span class="'+vcls(r.aroi)+'" style="font-weight:700">'+fmt(r.aroi)+'</span></td>'
        +'<td>'+ebar(r.edge)+'</td><td>'+spk(r.hpts,r.apts)+'</td>'
        +'<td style="color:#fbbf24;font-size:11px">'+stars(r.edge)+'</td></tr>';
    });
    return h+'</tbody></table></div>';
  }

  // ── Charts
  function buildCharts(){
    var ck=selKey();
    var TIPS_SHOW=selTip==='all'?['H','D','A','HD','AD']:[selTip];
    var lean=selLean==='all'?'All':selLean;
    var line=selLine==='all'?'All':selLine==='All'?'All':parseFloat(selLine);
    var drawn2=[];
    var h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
    TIPS_SHOW.forEach(function(tip){
      var r=allRows.find(function(x){return x.comboKey===ck&&x.tip===tip&&x.line===line&&x.lean===lean;});
      if(!r||r.n<minN) return;
      var cid='jce-chart-'+tip;
      drawn2.push({cid:cid,r:r});
      var c=TIP_COLOR[tip];
      h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
        +'<span style="font-size:11px;font-weight:700;font-family:var(--mono);color:'+c+'">Tip: '+tip+'</span>'
        +'<span style="font-size:9px;color:var(--muted);font-family:var(--mono)">n='+r.n
        +' &nbsp;<span style="color:#f87171">H:'+fmt(r.hroi)+'</span>'
        +' <span style="color:#60a5fa">A:'+fmt(r.aroi)+'</span></span></div>'
        +'<canvas id="'+cid+'" style="display:block;width:100%"></canvas></div>';
    });
    if(!drawn2.length) return '<div style="padding:20px;color:var(--muted);text-align:center">No data — try "All" for line and lean</div>';
    h+='</div>';
    setTimeout(function(){ drawn2.forEach(function(d){ drawJCEChart(d.cid,d.r.hpts,d.r.apts); }); },60);
    return h;
  }

  function drawJCEChart(cid,hpts,apts){
    var canvas=document.getElementById(cid); if(!canvas) return;
    var ctx=canvas.getContext('2d');
    var dpr=window.devicePixelRatio||1;
    var w=canvas.parentElement.offsetWidth||320, H=84;
    canvas.width=w*dpr; canvas.height=H*dpr;
    canvas.style.width=w+'px'; canvas.style.height=H+'px';
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,w,H);
    var pL=34,pR=38,pT=6,pB=6, cw=w-pL-pR, ch=H-pT-pB;
    function scl(pts){ var mn=Math.min(0,Math.min.apply(null,pts)),mx=Math.max(0,Math.max.apply(null,pts)),range=mx-mn||1; return{mn:mn,range:range,y:function(v){return pT+(1-(v-mn)/range)*ch;}}; }
    var hs=scl(hpts),as=scl(apts);
    function xx(i,n){return pL+i/((n||1)-1||1)*cw;}
    // axis ticks
    ctx.font='8px IBM Plex Mono'; ctx.textBaseline='middle';
    [0,0.5,1].forEach(function(t){
      var hv=hs.mn+hs.range*t, av=as.mn+as.range*t, y=hs.y(hv);
      ctx.fillStyle='#f8717155'; ctx.textAlign='right'; ctx.fillText((hv>=0?'+':'')+hv.toFixed(0),pL-3,y);
      ctx.fillStyle='#60a5fa55'; ctx.textAlign='left'; ctx.fillText((av>=0?'+':'')+av.toFixed(0),pL+cw+3,y);
      if(t===0.5){ ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+cw,y); ctx.stroke(); }
    });
    function drawZ(sc,col){ var y=sc.y(0); ctx.strokeStyle=col+'44'; ctx.lineWidth=1; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+cw,y); ctx.stroke(); ctx.setLineDash([]); }
    drawZ(hs,'#f87171'); drawZ(as,'#60a5fa');
    function ser(pts,sc,col){
      if(!pts.length) return;
      var ri=parseInt(col.slice(1,3),16),gi=parseInt(col.slice(3,5),16),bi=parseInt(col.slice(5,7),16);
      var lastV=pts[pts.length-1];
      var grad=ctx.createLinearGradient(0,pT,0,pT+ch);
      grad.addColorStop(lastV>=0?0:1,'rgba('+ri+','+gi+','+bi+',0.18)');
      grad.addColorStop(lastV>=0?1:0,'rgba('+ri+','+gi+','+bi+',0.01)');
      ctx.beginPath(); pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i,pts.length),sc.y(v)):ctx.lineTo(xx(i,pts.length),sc.y(v));}); ctx.lineTo(xx(pts.length-1,pts.length),sc.y(0)); ctx.lineTo(xx(0,pts.length),sc.y(0)); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.beginPath(); pts.forEach(function(v,i){i===0?ctx.moveTo(xx(i,pts.length),sc.y(v)):ctx.lineTo(xx(i,pts.length),sc.y(v));}); ctx.stroke();
      var ex=xx(pts.length-1,pts.length),ey=sc.y(lastV); ctx.beginPath(); ctx.arc(ex,ey,2.5,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
    }
    ser(hpts,hs,'#f87171'); ser(apts,as,'#60a5fa');
    // legend
    ctx.font='7px IBM Plex Mono'; ctx.textBaseline='middle';
    ctx.fillStyle='#f87171aa'; ctx.textAlign='center'; ctx.fillText('H',pL/2,H-4);
    ctx.fillStyle='#60a5faaa'; ctx.fillText('A',w-pR/2,H-4);
  }

  // ── Cards
  function buildCards(){
    var vis=allRows.filter(rowVis);
    var hSig=vis.filter(function(r){return r.hroi>=5;}).length;
    var aSig=vis.filter(function(r){return r.aroi>=5;}).length;
    var strong=vis.filter(function(r){return Math.abs(r.edge)>=20;}).length;
    var bestH=vis.length?vis.reduce(function(b,r){return r.hroi>b?r.hroi:b;},-999):-999;
    var bestA=vis.length?vis.reduce(function(b,r){return r.aroi>b?r.aroi:b;},-999):-999;
    return '<div class="rpt-cards">'
      +'<div class="rpt-card"><div class="rpt-card-label">Rows</div><div class="rpt-card-val">'+vis.length+'</div><div class="rpt-card-sub">shown</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">H ROI ≥+5%</div><div class="rpt-card-val pos">'+hSig+'</div><div class="rpt-card-sub">combos</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">A ROI ≥+5%</div><div class="rpt-card-val" style="color:#60a5fa">'+aSig+'</div><div class="rpt-card-sub">combos</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Edge ≥20%</div><div class="rpt-card-val" style="color:#fbbf24">'+strong+'</div><div class="rpt-card-sub">strong signal</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Best H ROI</div><div class="rpt-card-val pos">'+(bestH>-999?fmt(bestH):'—')+'</div><div class="rpt-card-sub">single combo</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Best A ROI</div><div class="rpt-card-val" style="color:#60a5fa">'+(bestA>-999?fmt(bestA):'—')+'</div><div class="rpt-card-sub">single combo</div></div>'
      +'</div>';
  }

  function buildContent(){
    var ck=selKey();
    if(!allRows.some(function(r){return r.comboKey===ck;}))
      return '<div style="padding:20px;color:var(--muted);text-align:center;font-style:italic">No data for this combination (N<10)</div>';
    if(viewMode==='heatmap') return buildHeatmap();
    if(viewMode==='chart')   return buildCharts();
    return buildTable();
  }

  function doRender(full){
    if(full){
      tab7.innerHTML=
        '<div class="rpt-title">Expert ROI Analysis — H-Side &amp; A-Side</div>'
        +'<div class="rpt-sub">Select one or more experts — the analysis shows H ROI and A ROI for matches where ALL selected experts agree on the tip direction. '
        +'Breakdowns by AsiaLine bracket and market lean. '
        +'<span style="color:#f87171">■</span> H ROI &nbsp;<span style="color:#60a5fa">■</span> A ROI</div>'
        +'<div id="jce-exp-sel">'+expertSelectorHTML()+'</div>'
        +'<div id="jce-cards">'+buildCards()+'</div>'
        +'<div id="jce-fbar">'+filterBar()+'</div>'
        +'<div id="jce-content">'+buildContent()+'</div>';
      wire();
    } else {
      document.getElementById('jce-exp-sel').innerHTML=expertSelectorHTML();
      document.getElementById('jce-cards').innerHTML=buildCards();
      document.getElementById('jce-fbar').innerHTML=filterBar();
      document.getElementById('jce-content').innerHTML=buildContent();
      wire();
    }
  }

  function wire(){
    tab7.querySelectorAll('.jce-exp-btn').forEach(function(b){
      b.addEventListener('click',function(){
        var e=b.dataset.e, idx=selExperts.indexOf(e);
        if(idx>=0){ if(selExperts.length>1) selExperts.splice(idx,1); }
        else selExperts.push(e);
        doRender(false);
      });
    });
    tab7.querySelectorAll('.jce-preset-btn').forEach(function(b){
      b.addEventListener('click',function(){ selExperts=b.dataset.v.split('|'); doRender(false); });
    });
    tab7.querySelectorAll('.jce-filter-btn').forEach(function(b){
      b.addEventListener('click',function(){
        var g=b.dataset.g, v=b.dataset.v;
        if(g==='tip') selTip=v;
        else if(g==='line') selLine=v;
        else if(g==='lean') selLean=v;
        else if(g==='minn') minN=parseInt(v);
        else if(g==='sort'){ sortCol=v; sortDir=-1; }
        else if(g==='view') viewMode=v;
        document.getElementById('jce-cards').innerHTML=buildCards();
        document.getElementById('jce-fbar').innerHTML=filterBar();
        document.getElementById('jce-content').innerHTML=buildContent();
        wire();
      });
    });
  }

  window.jceSort=function(col){
    if(sortCol===col) sortDir*=-1; else{ sortCol=col; sortDir=-1; }
    document.getElementById('jce-content').innerHTML=buildTable();
  };

  doRender(true);
}
