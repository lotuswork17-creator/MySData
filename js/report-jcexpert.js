// ── report-jcexpert.js — Tab 7: JC Expert × AsiaLine × Market Lean ──

function computeJCExpert(results){
  var FIELDS    = ['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var TIPS      = ['H','D','A','HD','AD'];
  var LINES     = [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];
  var LEAN_KEYS = ['hLean','bal','aLean'];

  function ts(v){
    if(!v) return null;
    var u = String(v).trim().toUpperCase();
    if(u==='H'||u==='1H') return 'H';
    if(u==='D'||u==='1D') return 'D';
    if(u==='A'||u==='1A') return 'A';
    if(u==='B'||u==='1B') return 'B';
    if(u==='S'||u==='1S') return 'S';
    return null;
  }

  function normLine(v){
    if(v===null||v===undefined) return null;
    var r = Math.round(v*4)/4;
    for(var i=0;i<LINES.length;i++){ if(Math.abs(LINES[i]-r)<0.01) return LINES[i]; }
    return null;
  }

  function leanGroup(r){
    if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0) return 'bal';
    var ph=1/r.ASIAH, pa=1/r.ASIAA;
    var hPct=ph/(ph+pa)*100;
    if(hPct>=52) return 'hLean';
    if(hPct<=48) return 'aLean';
    return 'bal';
  }

  function tipMatch(r, field, tip){
    var v = ts(r[field]);
    if(tip==='H')  return v==='H';
    if(tip==='D')  return v==='D';
    if(tip==='A')  return v==='A';
    if(tip==='HD') return v==='H'||v==='D';
    if(tip==='AD') return v==='A'||v==='D';
    return false;
  }

  function roiOf(vals){
    if(!vals.length) return null;
    return Math.round(vals.reduce(function(s,v){return s+v;},0)/vals.length*1000)/10;
  }

  // rows: {field, tip, line, lean, n, hroi, aroi, edge, hpts, apts}
  var rows = [];

  FIELDS.forEach(function(field){
    TIPS.forEach(function(tip){
      var base = results.filter(function(r){ return tipMatch(r,field,tip); });

      function pushRow(sub, line, lean){
        if(sub.length < 10) return;
        var hv=[], av=[];
        sub.forEach(function(r){
          var h=cH(r), a=cA(r);
          if(h!==null) hv.push(h);
          if(a!==null) av.push(a);
        });
        var hr=roiOf(hv), ar=roiOf(av);
        if(hr===null||ar===null) return;
        // running pts for sparkline
        var hrun=0, arun=0, hpts=[], apts=[];
        sub.forEach(function(r){
          var h=cH(r),a=cA(r);
          if(h!==null){hrun=Math.round((hrun+h)*1000)/1000; hpts.push(hrun);}
          if(a!==null){arun=Math.round((arun+a)*1000)/1000; apts.push(arun);}
        });
        rows.push({
          field:field, tip:tip, line:line, lean:lean,
          n:sub.length, hroi:hr, aroi:ar,
          edge:Math.round((hr-ar)*10)/10,
          hpts:hpts, apts:apts
        });
      }

      // All lines × All lean
      pushRow(base, 'All', 'All');

      // All lines × each lean
      LEAN_KEYS.forEach(function(lg){
        pushRow(base.filter(function(r){return leanGroup(r)===lg;}), 'All', lg);
      });

      // Each line × All lean
      LINES.forEach(function(line){
        var ls = base.filter(function(r){return normLine(r.ASIALINE)===line;});
        pushRow(ls, line, 'All');

        // Each line × each lean
        LEAN_KEYS.forEach(function(lg){
          pushRow(ls.filter(function(r){return leanGroup(r)===lg;}), line, lg);
        });
      });
    });
  });

  return { rows: rows };
}

// ════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════
function renderJCExpert(RD){
  var data = RD.jcexpert.rows;

  var FIELDS       = ['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var FIELD_NAMES  = {JCTIPSUM:'JC Tips Sum', JCTIPSID:'JC Tips SID', TIPSIDMAC:'Tips SID Mac', TIPSONID:'Tips On ID'};
  var FIELD_COLORS = {JCTIPSUM:'#4ade80', JCTIPSID:'#60a5fa', TIPSIDMAC:'#f87171', TIPSONID:'#a78bfa'};
  var TIP_COLORS   = {H:'#f87171', D:'#a78bfa', A:'#60a5fa', HD:'#fb923c', AD:'#34d399'};
  var LEAN_LABELS  = {All:'All', hLean:'H Fav ≥52%', bal:'Balance 48–52%', aLean:'A Fav ≤48%'};
  var LINE_LABELS  = {'-1':'-1','-0.75':'-¾','-0.5':'-½','-0.25':'-¼','0':'0','0.25':'+¼','0.5':'+½','0.75':'+¾','1':'+1','All':'All'};

  // ── state
  var selField='all', selTip='all', selLine='all', selLean='all', minN=10, sortCol='edge', sortDir=-1;

  // ── helpers
  function fmt(v){ return (v>0?'+':'')+v.toFixed(1)+'%'; }
  function vcls(v){ return v>0.5?'pos':v<-0.5?'neg':'neu'; }
  function stars(e){ var a=Math.abs(e); return a>=20?'★★★':a>=10?'★★':a>=5?'★':''; }

  function roiBg(v){
    if(v>= 5) return 'rgba(74,222,128,0.15)';
    if(v<=-5) return 'rgba(248,113,113,0.15)';
    return '';
  }

  function edgeBar(edge){
    var MAX=40, pct=Math.min(Math.abs(edge)/MAX*100,100);
    var col=edge>=0?'#f87171':'#60a5fa';
    var left=edge>=0?50:50-pct;
    return '<div style="display:flex;align-items:center;gap:5px">'
      +'<div style="width:70px;height:6px;border-radius:3px;background:#1e293b;position:relative;overflow:hidden;flex-shrink:0">'
        +'<div style="height:6px;position:absolute;left:'+left+'%;width:'+pct+'%;background:'+col+';border-radius:3px"></div>'
      +'</div>'
      +'<span style="font-family:var(--mono);font-size:11px;font-weight:700;min-width:44px" class="'+vcls(edge)+'">'+fmt(edge)+'</span>'
      +'</div>';
  }

  // Mini sparkline SVG
  function spark(hpts, apts){
    var W=80, H=28, pad=2;
    var all = hpts.concat(apts);
    if(!all.length) return '';
    var mn=Math.min.apply(null,all), mx=Math.max.apply(null,all);
    var range=mx-mn||1;
    function py(v){ return pad+(1-(v-mn)/range)*(H-pad*2); }
    function line(pts, col){
      if(!pts.length) return '';
      var d=pts.map(function(v,i){
        var x=pad+i/(pts.length-1||1)*(W-pad*2);
        return (i===0?'M':'L')+x.toFixed(1)+','+py(v).toFixed(1);
      }).join(' ');
      return '<path d="'+d+'" stroke="'+col+'" stroke-width="1.5" fill="none"/>';
    }
    // zero line
    var zy=py(0).toFixed(1);
    return '<svg width="'+W+'" height="'+H+'" style="display:block">'
      +'<line x1="'+pad+'" y1="'+zy+'" x2="'+(W-pad)+'" y2="'+zy+'" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>'
      +line(hpts,'#f87171')+line(apts,'#60a5fa')
      +'</svg>';
  }

  function tipBadge(t){
    var c=TIP_COLORS[t]||'#94a3b8';
    return '<span style="display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;font-family:var(--mono);background:'+c+'22;color:'+c+'">'+t+'</span>';
  }
  function lineBadge(l){
    var s=LINE_LABELS[''+l]||(''+l);
    return '<span style="font-family:var(--mono);font-size:11px;color:#cbd5e1">'+s+'</span>';
  }
  function leanBadge(l){
    var cols={All:'#64748b',hLean:'#f87171',bal:'#fbbf24',aLean:'#60a5fa'};
    var c=cols[l]||'#64748b';
    return '<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;background:'+c+'18;color:'+c+'">'+LEAN_LABELS[l]+'</span>';
  }

  function rowVis(r){
    if(selField!=='all' && r.field!==selField) return false;
    if(selTip!=='all'   && r.tip!==selTip)     return false;
    if(selLine!=='all'){
      var lv = selLine==='All'?'All':parseFloat(selLine);
      if(r.line!==lv) return false;
    }
    if(selLean!=='all' && r.lean!==selLean) return false;
    if(r.n < minN) return false;
    return true;
  }

  // ── Summary cards
  function buildCards(vis){
    var hSig=vis.filter(function(r){return r.hroi>=5;}).length;
    var aSig=vis.filter(function(r){return r.aroi>=5;}).length;
    var strong=vis.filter(function(r){return Math.abs(r.edge)>=20;}).length;
    var bestH=vis.reduce(function(b,r){return r.hroi>b?r.hroi:b;},-999);
    var bestA=vis.reduce(function(b,r){return r.aroi>b?r.aroi:b;},-999);
    return '<div class="rpt-cards">'
      +'<div class="rpt-card"><div class="rpt-card-label">Rows</div><div class="rpt-card-val" id="jce-nvis">'+vis.length+'</div><div class="rpt-card-sub">after filters</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">H ROI ≥+5%</div><div class="rpt-card-val pos" id="jce-hsig">'+hSig+'</div><div class="rpt-card-sub">combos</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">A ROI ≥+5%</div><div class="rpt-card-val" style="color:#60a5fa" id="jce-asig">'+aSig+'</div><div class="rpt-card-sub">combos</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Edge ≥20%</div><div class="rpt-card-val" style="color:#fbbf24" id="jce-strong">'+strong+'</div><div class="rpt-card-sub">strong signal</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Best H ROI</div><div class="rpt-card-val pos" id="jce-besth">'+(bestH>-999?fmt(bestH):'—')+'</div><div class="rpt-card-sub">single combo</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Best A ROI</div><div class="rpt-card-val" style="color:#60a5fa" id="jce-besta">'+(bestA>-999?fmt(bestA):'—')+'</div><div class="rpt-card-sub">single combo</div></div>'
      +'</div>';
  }

  // ── Filter bar
  function btnBar(label, grp, opts){
    var h='<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;margin-bottom:5px">'
      +'<span style="font-size:10px;color:var(--muted);font-family:var(--mono);min-width:52px">'+label+'</span>';
    opts.forEach(function(o){
      h+='<button class="jce-btn" data-g="'+grp+'" data-v="'+o.v+'"'
        +' style="padding:2px 9px;border-radius:4px;border:1px solid var(--border);background:'+(o.active?'#60a5fa':'var(--surface)')+';color:'+(o.active?'#0f172a':'var(--muted)')+';'
        +'font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans)">'+o.t+'</button>';
    });
    return h+'</div>';
  }

  var fieldOpts=[{v:'all',t:'All',active:true}];
  FIELDS.forEach(function(f){fieldOpts.push({v:f,t:FIELD_NAMES[f].replace('Tips ','').replace('JC ','JC'),active:false});});

  var tipOpts=[{v:'all',t:'All',active:true}];
  ['H','D','A','HD','AD'].forEach(function(t){tipOpts.push({v:t,t:t,active:false});});

  var lineOpts=[{v:'all',t:'All',active:true},{v:'All',t:'Combined',active:false}];
  [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1].forEach(function(l){
    lineOpts.push({v:''+l,t:LINE_LABELS[''+l],active:false});
  });

  var leanOpts=[{v:'all',t:'All',active:true},{v:'hLean',t:'H Fav',active:false},{v:'bal',t:'Balance',active:false},{v:'aLean',t:'A Fav',active:false}];
  var nOpts=[{v:'10',t:'N≥10',active:true},{v:'20',t:'N≥20',active:false},{v:'30',t:'N≥30',active:false},{v:'50',t:'N≥50',active:false}];
  var sortOpts=[{v:'edge',t:'Edge',active:true},{v:'hroi',t:'H ROI',active:false},{v:'aroi',t:'A ROI',active:false},{v:'n',t:'Count',active:false}];

  // ── ROI heatmap table (per field)
  function buildHeatmap(field){
    var TIPS_SHOW = ['H','D','A','HD','AD'];
    var LINES_SHOW= [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];

    function getRow(tip,line,lean){
      return data.find(function(r){
        return r.field===field && r.tip===tip && r.line===line && r.lean===lean;
      });
    }

    function heatCell(roi, n){
      if(roi===undefined||roi===null||n<minN)
        return '<td style="color:#334155;text-align:center;font-size:10px">—</td>';
      var bg = roi>=10?'rgba(74,222,128,0.25)':roi>=5?'rgba(74,222,128,0.12)':roi<=-10?'rgba(248,113,113,0.25)':roi<=-5?'rgba(248,113,113,0.12)':'';
      var col = roi>=5?'#4ade80':roi<=-5?'#f87171':'#94a3b8';
      return '<td style="text-align:center;padding:4px 6px;'+(bg?'background:'+bg:'')+';">'
        +'<span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+col+'">'+fmt(roi)+'</span>'
        +'<br><span style="font-size:9px;color:#475569">'+n+'</span>'
        +'</td>';
    }

    var h='<div style="margin-bottom:20px">';
    h+='<div style="font-size:12px;font-weight:700;color:'+FIELD_COLORS[field]+';margin-bottom:8px;padding:6px 10px;background:var(--surface2);border-left:3px solid '+FIELD_COLORS[field]+';border-radius:4px">'+FIELD_NAMES[field]+'</div>';

    // H ROI table
    h+='<div style="font-size:10px;font-weight:700;color:#f87171;margin-bottom:4px;font-family:var(--mono)">H-SIDE ROI</div>';
    h+='<div style="overflow-x:auto;margin-bottom:12px"><table style="border-collapse:collapse;font-size:11px;min-width:100%">';
    h+='<thead><tr><th style="background:#0f172a;color:#64748b;padding:5px 8px;white-space:nowrap;font-size:9px">Tip \\ Line</th>';
    LINES_SHOW.forEach(function(lv){ h+='<th style="background:#0f172a;color:#64748b;padding:5px 6px;text-align:center;font-size:9px;white-space:nowrap">'+LINE_LABELS[''+lv]+'</th>'; });
    h+='<th style="background:#0f172a;color:#64748b;padding:5px 6px;text-align:center;font-size:9px">All Lines</th></tr></thead><tbody>';
    TIPS_SHOW.forEach(function(tip){
      h+='<tr><td style="padding:4px 8px;white-space:nowrap">'+tipBadge(tip)+'</td>';
      LINES_SHOW.forEach(function(lv){
        var r=getRow(tip,lv,'All');
        h+=heatCell(r?r.hroi:null, r?r.n:0);
      });
      var ra=getRow(tip,'All','All');
      h+=heatCell(ra?ra.hroi:null, ra?ra.n:0);
      h+='</tr>';
    });
    h+='</tbody></table></div>';

    // A ROI table
    h+='<div style="font-size:10px;font-weight:700;color:#60a5fa;margin-bottom:4px;font-family:var(--mono)">A-SIDE ROI</div>';
    h+='<div style="overflow-x:auto;margin-bottom:12px"><table style="border-collapse:collapse;font-size:11px;min-width:100%">';
    h+='<thead><tr><th style="background:#0f172a;color:#64748b;padding:5px 8px;white-space:nowrap;font-size:9px">Tip \\ Line</th>';
    LINES_SHOW.forEach(function(lv){ h+='<th style="background:#0f172a;color:#64748b;padding:5px 6px;text-align:center;font-size:9px;white-space:nowrap">'+LINE_LABELS[''+lv]+'</th>'; });
    h+='<th style="background:#0f172a;color:#64748b;padding:5px 6px;text-align:center;font-size:9px">All Lines</th></tr></thead><tbody>';
    TIPS_SHOW.forEach(function(tip){
      h+='<tr><td style="padding:4px 8px;white-space:nowrap">'+tipBadge(tip)+'</td>';
      LINES_SHOW.forEach(function(lv){
        var r=getRow(tip,lv,'All');
        h+=heatCell(r?r.aroi:null, r?r.n:0);
      });
      var ra=getRow(tip,'All','All');
      h+=heatCell(ra?ra.aroi:null, ra?ra.n:0);
      h+='</tr>';
    });
    h+='</tbody></table></div>';

    h+='</div>';
    return h;
  }

  // ── Detail table with sparklines
  function buildTable(){
    var vis = data.filter(rowVis).slice();
    vis.sort(function(a,b){ return (b[sortCol]-a[sortCol])*sortDir; });

    if(!vis.length) return '<div style="padding:16px;color:var(--muted);text-align:center;font-size:12px">No rows match current filters</div>';

    var h='<div class="rpt-table-wrap"><table class="rpt-table">';
    h+='<thead><tr>'
      +'<th>Expert</th><th>Tip</th><th>Line</th><th>Lean</th>'
      +'<th class="num" style="cursor:pointer" onclick="jceSort(\'n\')">N '+(sortCol==='n'?(sortDir>0?'↑':'↓'):'')+'</th>'
      +'<th class="num" style="cursor:pointer;color:#f87171" onclick="jceSort(\'hroi\')">H ROI '+(sortCol==='hroi'?(sortDir>0?'↑':'↓'):'')+'</th>'
      +'<th class="num" style="cursor:pointer;color:#60a5fa" onclick="jceSort(\'aroi\')">A ROI '+(sortCol==='aroi'?(sortDir>0?'↑':'↓'):'')+'</th>'
      +'<th style="cursor:pointer;min-width:130px" onclick="jceSort(\'edge\')">Edge '+(sortCol==='edge'?(sortDir>0?'↑':'↓'):'')+'</th>'
      +'<th>Trend</th><th>★</th>'
      +'</tr></thead><tbody>';

    vis.forEach(function(r){
      var wn=r.n<25?'<span style="color:#fbbf24;font-size:9px;margin-left:2px">!</span>':'';
      h+='<tr>'
        +'<td><span style="font-size:10px;font-weight:700;color:'+FIELD_COLORS[r.field]+'">'+FIELD_NAMES[r.field].replace('Tips ','').replace('JC ','JC ')+'</span></td>'
        +'<td>'+tipBadge(r.tip)+'</td>'
        +'<td>'+lineBadge(r.line)+'</td>'
        +'<td>'+leanBadge(r.lean)+'</td>'
        +'<td class="num">'+r.n+wn+'</td>'
        +'<td class="num" style="'+(roiBg(r.hroi)?'background:'+roiBg(r.hroi):'')+'"><span class="'+vcls(r.hroi)+'" style="font-weight:700">'+fmt(r.hroi)+'</span></td>'
        +'<td class="num" style="'+(roiBg(r.aroi)?'background:'+roiBg(r.aroi):'')+'"><span class="'+vcls(r.aroi)+'" style="font-weight:700">'+fmt(r.aroi)+'</span></td>'
        +'<td>'+edgeBar(r.edge)+'</td>'
        +'<td>'+spark(r.hpts,r.apts)+'</td>'
        +'<td style="color:#fbbf24;font-size:11px">'+stars(r.edge)+'</td>'
        +'</tr>';
    });
    return h+'</tbody></table></div>';
  }

  // ── Build full tab
  function rebuild(){
    var vis=data.filter(rowVis);
    document.getElementById('jce-cards').innerHTML=buildCards(vis);
    document.getElementById('jce-table').innerHTML=buildTable();
  }

  var tab7=document.getElementById('tab7');
  var vis0=data.filter(rowVis);

  tab7.innerHTML=
    '<div class="rpt-title">JC Expert ROI × AsiaLine × Market Lean</div>'
    +'<div class="rpt-sub">H-side and A-side ROI when each expert tips H / D / A, broken down by AsiaLine bracket and market lean. '
    +'<span style="color:#f87171">■ Red</span> = H ROI &nbsp;<span style="color:#60a5fa">■ Blue</span> = A ROI. N≥10. Sparklines show running P&L trend.</div>'

    // Cards
    +'<div id="jce-cards">'+buildCards(vis0)+'</div>'

    // Filter bar
    +'<div id="jce-filters" style="margin-bottom:12px">'
    +btnBar('Expert:','field',fieldOpts)
    +btnBar('Tip:','tip',tipOpts)
    +btnBar('Line:','line',lineOpts)
    +btnBar('Lean:','lean',leanOpts)
    +btnBar('Min N:','minn',nOpts)
    +btnBar('Sort:','sort',sortOpts)
    +'</div>'

    // Heatmap section
    +'<div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text)">ROI Heatmap — Tip × Line (all lean, N≥'+minN+')</div>'
    +'<div id="jce-heatmaps">'
    +FIELDS.map(buildHeatmap).join('')
    +'</div>'

    // Detail table
    +'<div style="margin:16px 0 6px;font-size:12px;font-weight:700;color:var(--text)">Detail Table — click column headers to sort</div>'
    +'<div id="jce-table">'+buildTable()+'</div>';

  // ── Filter button wiring
  tab7.querySelectorAll('.jce-btn').forEach(function(b){
    b.addEventListener('click',function(){
      var g=b.dataset.g, v=b.dataset.v;
      if(g==='field') selField=v;
      else if(g==='tip') selTip=v;
      else if(g==='line') selLine=v;
      else if(g==='lean') selLean=v;
      else if(g==='minn'){ minN=parseInt(v); document.getElementById('jce-heatmaps').innerHTML=FIELDS.map(buildHeatmap).join(''); }
      else if(g==='sort'){ sortCol=v; sortDir=-1; }
      tab7.querySelectorAll('.jce-btn[data-g="'+g+'"]').forEach(function(x){
        var on=x.dataset.v===v;
        x.style.background=on?'#60a5fa':'var(--surface)';
        x.style.borderColor=on?'#60a5fa':'var(--border)';
        x.style.color=on?'#0f172a':'var(--muted)';
      });
      rebuild();
    });
  });

  window.jceSort=function(col){
    if(sortCol===col) sortDir*=-1; else{ sortCol=col; sortDir=-1; }
    document.getElementById('jce-table').innerHTML=buildTable();
  };
}
