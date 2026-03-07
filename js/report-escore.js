// ── report-escore.js — Tab 8: Expert Score Band Analysis ──
// Automatically finds optimal expert % thresholds from live data.
// Sections: (A) H% all bands, (B) A% all bands,
//           (C) H-leads exact band, (D) A-leads exact band,
//           (E) H-leads cumulative below XX — contrarian A signal,
//           (F) A-leads cumulative below XX — contrarian H signal,
//           + auto-suggestion cards from best signals.

// ═══════════════════════════════════════════════════════════════
// COMPUTE
// ═══════════════════════════════════════════════════════════════
function computeEScore(results){

  function roiOf2(sub, fn){
    var v = [];
    sub.forEach(function(r){ var x = fn(r); if(x !== null) v.push(x); });
    return v.length >= 5 ? Math.round(v.reduce(function(s,x){return s+x;},0)/v.length*1000)/10 : null;
  }

  function leadOf(e){
    if(!e) return null;
    if(e.h > e.d && e.h > e.a) return 'H';
    if(e.a > e.d && e.a > e.h) return 'A';
    return 'D';
  }

  // A. H% fine bands (5-pt steps) — all records
  var hBands = [];
  for(var lo=0; lo<100; lo+=5){
    (function(lo,hi){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&e.h>=lo&&e.h<hi; });
      hBands.push({lo:lo,hi:hi,label:lo+'\u2013'+(hi-1)+'%',n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(lo, lo+5);
  }

  // B. A% fine bands (5-pt steps) — all records
  var aBands = [];
  for(var lo=0; lo<100; lo+=5){
    (function(lo,hi){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&e.a>=lo&&e.a<hi; });
      aBands.push({lo:lo,hi:hi,label:lo+'\u2013'+(hi-1)+'%',n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(lo, lo+5);
  }

  // C. H leads in exact band
  var hLeadBands = [];
  for(var lo=50; lo<100; lo+=5){
    (function(lo,hi){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&leadOf(e)==='H'&&e.h>=lo&&e.h<hi; });
      hLeadBands.push({lo:lo,hi:hi,label:lo+'\u2013'+(hi===100?'100':hi-1)+'%',n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(lo, lo+5);
  }

  // D. A leads in exact band
  var aLeadBands = [];
  for(var lo=50; lo<100; lo+=5){
    (function(lo,hi){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&leadOf(e)==='A'&&e.a>=lo&&e.a<hi; });
      aLeadBands.push({lo:lo,hi:hi,label:lo+'\u2013'+(hi===100?'100':hi-1)+'%',n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(lo, lo+5);
  }

  // E. H leads but below XX% (cumulative)
  var hLeadBelow = [];
  for(var t=55; t<=95; t+=5){
    (function(t){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&leadOf(e)==='H'&&e.h<t; });
      hLeadBelow.push({thresh:t,n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(t);
  }

  // F. A leads but below XX% (cumulative)
  var aLeadBelow = [];
  for(var t=55; t<=95; t+=5){
    (function(t){
      var sub = results.filter(function(r){ var e=expertScore(r); return e&&leadOf(e)==='A'&&e.a<t; });
      aLeadBelow.push({thresh:t,n:sub.length,hroi:roiOf2(sub,cH),aroi:roiOf2(sub,cA)});
    })(t);
  }

  var MIN_N = 30;
  function bestByRoi(rows, roiKey, minN){
    var best=null;
    rows.forEach(function(r){ if(r.n>=minN&&r[roiKey]!==null&&(!best||r[roiKey]>best[roiKey])) best=r; });
    return best;
  }

  return {
    n:results.length,
    allHroi:roiOf2(results,cH), allAroi:roiOf2(results,cA),
    hBands:hBands, aBands:aBands,
    hLeadBands:hLeadBands, aLeadBands:aLeadBands,
    hLeadBelow:hLeadBelow, aLeadBelow:aLeadBelow,
    suggestHband:   bestByRoi(hLeadBands,  'hroi', MIN_N),
    suggestHcontra: bestByRoi(hLeadBelow,  'aroi', MIN_N),
    suggestAband:   bestByRoi(aLeadBands,  'aroi', MIN_N),
    suggestAcontra: bestByRoi(aLeadBelow,  'hroi', MIN_N),
  };
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function renderEScore(RD){
  var D  = RD.escore;
  var el = document.getElementById('tab8');
  var MIN = 20;  // min n to display row
  var MIN_S = 30; // min n for suggestions

  // ── Format helpers
  function fmtPlain(v){ return v===null?'—':(v>0?'+':'')+v.toFixed(1)+'%'; }
  function fmtColor(v){
    if(v===null||v===undefined) return '<span style="color:#334155">—</span>';
    var c = v>=5?'#4ade80':v<=-5?'#f87171':'#94a3b8';
    return '<span style="color:'+c+';font-weight:700">'+(v>0?'+':'')+v.toFixed(1)+'%</span>';
  }
  function roiBg(v){
    if(v===null) return '';
    if(v>=10)  return 'background:rgba(74,222,128,0.13)';
    if(v>=5)   return 'background:rgba(74,222,128,0.06)';
    if(v<=-10) return 'background:rgba(248,113,113,0.13)';
    if(v<=-5)  return 'background:rgba(248,113,113,0.06)';
    return '';
  }
  function stars(edge, n){
    if(n<MIN_S) return '<span style="color:#334155;font-size:9px">low n</span>';
    if(edge===null) return '';
    if(edge>=20)  return '<span style="color:#fbbf24;font-size:12px">★★★</span>';
    if(edge>=10)  return '<span style="color:#fbbf2499;font-size:12px">★★</span>';
    if(edge>=5)   return '<span style="color:#fbbf2455;font-size:12px">★</span>';
    if(edge<=-20) return '<span style="color:#60a5fa;font-size:12px">★★★</span>';
    if(edge<=-10) return '<span style="color:#60a5fa99;font-size:12px">★★</span>';
    if(edge<=-5)  return '<span style="color:#60a5fa55;font-size:12px">★</span>';
    return '';
  }
  function th(label, color, align){
    return '<th style="background:#0f172a;color:'+(color||'#94a3b8')+';padding:5px 9px;'
      +'text-align:'+(align||'right')+';font-size:9px;font-family:var(--mono);'
      +'white-space:nowrap;border-bottom:1px solid #1e293b">'+label+'</th>';
  }

  // ── Generic band table
  function bandTable(rows){
    var vis = rows.filter(function(r){return r.n>=MIN;});
    if(!vis.length) return '<p style="color:#475569;font-size:11px;font-family:var(--mono)">Insufficient data.</p>';
    return '<table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr>'
      +th('Band','#e2e8f0','left')+th('N','#e2e8f0')+th('H ROI','#f87171')+th('A ROI','#60a5fa')+th('H\u2212A','#fbbf24')+th('\u2605','#fbbf24','center')
      +'</tr></thead><tbody>'
      +vis.map(function(b){
        var edge = b.hroi!==null&&b.aroi!==null ? Math.round((b.hroi-b.aroi)*10)/10 : null;
        return '<tr>'
          +'<td style="padding:4px 9px;font-family:var(--mono);font-weight:700;color:#e2e8f0;text-align:left">'+b.label+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);color:#94a3b8">'+b.n+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(b.hroi)+'">'+fmtColor(b.hroi)+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(b.aroi)+'">'+fmtColor(b.aroi)+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(edge)+'">'+fmtColor(edge)+'</td>'
          +'<td style="padding:4px 6px;text-align:center">'+stars(edge,b.n)+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table>';
  }

  // ── Below-threshold table
  function belowTable(rows, contraKey){
    var vis = rows.filter(function(r){return r.n>=MIN;});
    if(!vis.length) return '<p style="color:#475569;font-size:11px;font-family:var(--mono)">Insufficient data.</p>';
    var contraCol = contraKey==='aroi'?'#60a5fa':'#f87171';
    var contraLabel = contraKey==='aroi'?'Contra A ROI':'Contra H ROI';
    return '<table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr>'
      +th('Lead &lt; XX%','#e2e8f0','left')+th('N','#e2e8f0')+th('H ROI','#f87171')+th('A ROI','#60a5fa')+th('H\u2212A','#fbbf24')+th(contraLabel,contraCol)+th('\u2605','#fbbf24','center')
      +'</tr></thead><tbody>'
      +vis.map(function(r){
        var edge = r.hroi!==null&&r.aroi!==null ? Math.round((r.hroi-r.aroi)*10)/10 : null;
        var contra = r[contraKey];
        return '<tr style="'+(contra!==null&&contra>=5?'background:rgba(74,222,128,0.07)':contra!==null&&contra<=-5?'background:rgba(248,113,113,0.07)':'')+'">'
          +'<td style="padding:4px 9px;font-family:var(--mono);font-weight:700;color:#e2e8f0;text-align:left">&lt;'+r.thresh+'%</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);color:#94a3b8">'+r.n+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(r.hroi)+'">'+fmtColor(r.hroi)+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(r.aroi)+'">'+fmtColor(r.aroi)+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(edge)+'">'+fmtColor(edge)+'</td>'
          +'<td style="padding:4px 9px;text-align:right;font-family:var(--mono);'+roiBg(contra)+'">'+fmtColor(contra)+'</td>'
          +'<td style="padding:4px 6px;text-align:center">'+stars(contra,r.n)+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table>';
  }

  // ── Bar chart
  function barChart(id){ return '<canvas id="'+id+'" style="display:block;width:100%;height:60px;margin-bottom:3px"></canvas>'; }
  function drawBar(id, rows){
    var vis = rows.filter(function(r){return r.n>=MIN;});
    var c = document.getElementById(id); if(!c||!vis.length) return;
    var ctx=c.getContext('2d'), dpr=window.devicePixelRatio||1;
    var W=(c.parentElement.offsetWidth-2)||300, H=60;
    c.width=W*dpr; c.height=H*dpr; c.style.width=W+'px'; c.style.height=H+'px';
    ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
    var pL=2,pR=2,pT=4,pB=14,cw=W-pL-pR,ch=H-pT-pB;
    var allV=[]; vis.forEach(function(b){if(b.hroi!==null)allV.push(b.hroi);if(b.aroi!==null)allV.push(b.aroi);});
    if(!allV.length) return;
    var mn=Math.min(0,Math.min.apply(null,allV)), mx=Math.max(0,Math.max.apply(null,allV)), range=mx-mn||1;
    var slot=cw/vis.length, bw=Math.max(2,(slot-3)/2);
    var zero=pT+(1-(0-mn)/range)*ch;
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(pL,zero); ctx.lineTo(pL+cw,zero); ctx.stroke(); ctx.setLineDash([]);
    vis.forEach(function(b,i){
      var x=pL+i*slot;
      if(b.hroi!==null){
        var y=pT+(1-(b.hroi-mn)/range)*ch, bh=Math.abs(zero-y);
        ctx.fillStyle=b.hroi>=0?'rgba(248,113,113,0.75)':'rgba(248,113,113,0.3)';
        ctx.fillRect(x+1,Math.min(y,zero),bw,Math.max(1,bh));
      }
      if(b.aroi!==null){
        var y=pT+(1-(b.aroi-mn)/range)*ch, bh=Math.abs(zero-y);
        ctx.fillStyle=b.aroi>=0?'rgba(96,165,250,0.75)':'rgba(96,165,250,0.3)';
        ctx.fillRect(x+bw+2,Math.min(y,zero),bw,Math.max(1,bh));
      }
      ctx.font='7px IBM Plex Mono'; ctx.fillStyle='#475569';
      ctx.textAlign='center'; ctx.textBaseline='top';
      if(i%2===0) ctx.fillText(b.lo+'%',x+slot/2,H-pB+2);
    });
  }

  // ── Suggestion card
  function suggCard(accentCol, title, bandLabel, n, roiLabel, roiVal, filterHint){
    var good = roiVal!==null&&roiVal>=3;
    return '<div style="background:#0f172a;border-radius:8px;padding:14px;border-left:3px solid '+accentCol+';'+(good?'box-shadow:0 0 0 1px rgba(74,222,128,0.12)':'')+'">'
      +'<div style="font-size:9px;font-weight:700;color:'+accentCol+';font-family:var(--mono);letter-spacing:.06em;margin-bottom:6px">'+title+'</div>'
      +'<div style="font-size:22px;font-weight:700;color:#e2e8f0;font-family:var(--mono);margin-bottom:4px">'+bandLabel+'</div>'
      +'<div style="font-size:11px;color:#94a3b8;font-family:var(--mono);margin-bottom:8px">'+roiLabel
        +' <b style="color:'+(roiVal!==null&&roiVal>=5?'#4ade80':roiVal!==null&&roiVal<=-5?'#f87171':'#94a3b8')+'">'+fmtPlain(roiVal)+'</b>'
        +' <span style="color:#334155">&nbsp;n='+n+'</span></div>'
      +'<div style="font-size:9px;color:#475569;font-family:var(--mono);padding:5px 8px;background:#070d18;border-radius:4px">'+filterHint+'</div>'
      +'</div>';
  }

  // Build suggestion cards
  var cards = '';
  if(D.suggestHband){
    var b=D.suggestHband;
    cards += suggCard('#f87171','H-SIDE · BEST H ROI (H is max, exact band)',
      'H% '+b.label, b.n, 'H ROI', b.hroi,
      'Filter → Expert Signal: H leads &amp; H score '+b.lo+'–'+(b.hi-1)+'%');
  }
  if(D.suggestHcontra){
    var b=D.suggestHcontra;
    cards += suggCard('#60a5fa','H-LEAD CONTRARIAN · FADE TO A WHEN H LEADS WEAKLY',
      'H-lead &lt;'+b.thresh+'%', b.n, 'A ROI (contrarian)', b.aroi,
      'Filter → Expert Signal: H is max AND H score &lt;'+b.thresh+'% → bet A');
  }
  if(D.suggestAband){
    var b=D.suggestAband;
    cards += suggCard('#60a5fa','A-SIDE · BEST A ROI (A is max, exact band)',
      'A% '+b.label, b.n, 'A ROI', b.aroi,
      'Filter → Expert Signal: A leads &amp; A score '+b.lo+'–'+(b.hi-1)+'%');
  }
  if(D.suggestAcontra){
    var b=D.suggestAcontra;
    cards += suggCard('#f87171','A-LEAD CONTRARIAN · FADE TO H WHEN A LEADS WEAKLY',
      'A-lead &lt;'+b.thresh+'%', b.n, 'H ROI (contrarian)', b.hroi,
      'Filter → Expert Signal: A is max AND A score &lt;'+b.thresh+'% → bet H');
  }

  // ── Section label helper
  function secHead(letter, title, color, note){
    return '<div style="font-size:10px;font-weight:700;color:'+color+';font-family:var(--mono);letter-spacing:.05em;margin-bottom:4px">'+letter+' · '+title+'</div>'
      +(note?'<div style="font-size:9px;color:#64748b;font-family:var(--mono);margin-bottom:7px">'+note+'</div>':'');
  }

  el.innerHTML =
    '<div class="rpt-title">Expert Score Band Analysis</div>'
    +'<div class="rpt-sub" style="margin-bottom:16px">ROI by expert consensus % bands — auto-computed from <b style="color:#e2e8f0">'+D.n+'</b> records. '
    +'Thresholds update automatically as data grows. &nbsp;'
    +'Baseline: <span style="color:#f87171">H ROI '+fmtPlain(D.allHroi)+'</span> &nbsp;'
    +'<span style="color:#60a5fa">A ROI '+fmtPlain(D.allAroi)+'</span> &nbsp;'
    +'<span style="color:#475569;font-size:9px">(min n='+MIN+' to show row, n='+MIN_S+' for suggestions)</span></div>'

    // Suggestion cards
    +'<div style="margin-bottom:22px">'
    +'<div style="font-size:10px;font-weight:700;color:#fbbf24;font-family:var(--mono);letter-spacing:.05em;margin-bottom:10px">'
    +'💡 AUTO-SUGGESTED FILTER VALUES <span style="font-size:9px;color:#64748b;font-weight:400">— recomputed live from all '+D.n+' records</span></div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'+cards+'</div></div>'

    // Row 1: A+B band tables
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px">'
    +'<div>'
    +secHead('A','H EXPERT % — ALL RECORDS','#f87171','Every record where H score falls in band, regardless of who leads')
    +barChart('esb-bar-h')
    +'<div style="font-size:8px;color:#475569;font-family:var(--mono);margin-bottom:6px"><span style="color:#f87171">■</span> H ROI &nbsp;<span style="color:#60a5fa">■</span> A ROI</div>'
    +bandTable(D.hBands)
    +'</div>'
    +'<div>'
    +secHead('B','A EXPERT % — ALL RECORDS','#60a5fa','Every record where A score falls in band, regardless of who leads')
    +barChart('esb-bar-a')
    +'<div style="font-size:8px;color:#475569;font-family:var(--mono);margin-bottom:6px"><span style="color:#f87171">■</span> H ROI &nbsp;<span style="color:#60a5fa">■</span> A ROI</div>'
    +bandTable(D.aBands)
    +'</div>'
    +'</div>'

    // Row 2: C+D lead exact band
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px">'
    +'<div>'
    +secHead('C','H IS MAX — BY EXACT BAND','#f87171','Only matches where H score is highest AND falls in the band')
    +bandTable(D.hLeadBands)
    +'</div>'
    +'<div>'
    +secHead('D','A IS MAX — BY EXACT BAND','#60a5fa','Only matches where A score is highest AND falls in the band')
    +bandTable(D.aLeadBands)
    +'</div>'
    +'</div>'

    // Row 3: E+F cumulative below threshold
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">'
    +'<div>'
    +secHead('E','H IS MAX BUT SCORE &lt; XX%','#f87171','Cumulative: H-lead matches below ceiling — does A become a contrarian edge?')
    +belowTable(D.hLeadBelow,'aroi')
    +'</div>'
    +'<div>'
    +secHead('F','A IS MAX BUT SCORE &lt; XX%','#60a5fa','Cumulative: A-lead matches below ceiling — does H become a contrarian edge?')
    +belowTable(D.aLeadBelow,'hroi')
    +'</div>'
    +'</div>';

  setTimeout(function(){
    drawBar('esb-bar-h', D.hBands);
    drawBar('esb-bar-a', D.aBands);
  }, 80);
}
