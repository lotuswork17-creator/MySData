// ── report-line.js — Tab 2: Bookmaker Line Prediction Accuracy ──
// Compares HKJC, Macau and SBO line accuracy on the same matches.
// "Accuracy" = when lines diverge, whose line was closest to the actual handicap result.

function computeLine(results){
  var BOOKS = [
    { key:'hkjc', label:'HKJC',  lk:'ASIALINE',   hk:'ASIAH',    ak:'ASIAA',    color:'#f87171' },
    { key:'mac',  label:'Macau', lk:'ASIALINEMA', hk:'ASIAHMAC', ak:'ASIAAMAC', color:'#a78bfa' },
    { key:'sbo',  label:'SBO',   lk:'ASIALINESB', hk:'ASIAHSBO', ak:'ASIAASBO', color:'#fb923c' },
  ];

  function adjMargin(r, lk){
    var line=r[lk]; if(line==null) return null;
    return Math.round((r.RESULTH - r.RESULTA + line) * 4) / 4;
  }
  function outcomeFor(r, lk){
    var m=adjMargin(r,lk); if(m==null) return null;
    if(m>=0.5) return 'ww'; if(m===0.25) return 'wh';
    if(m===0) return 'dd'; if(m===-0.25) return 'lh'; return 'lw';
  }
  function pnlH(r, lk, hk){
    var o=outcomeFor(r,lk), oh=r[hk];
    if(!o||!oh||oh<=0) return null;
    if(o==='ww') return oh-1; if(o==='wh') return (oh-1)*0.5;
    if(o==='dd') return 0; if(o==='lh') return -0.5; return -1;
  }
  function pnlA(r, lk, ak){
    var o=outcomeFor(r,lk), oa=r[ak];
    if(!o||!oa||oa<=0) return null;
    if(o==='lw') return oa-1; if(o==='lh') return (oa-1)*0.5;
    if(o==='dd') return 0; if(o==='wh') return -0.5; return -1;
  }
  function roiArr(arr){ return roiOf(arr.filter(function(v){return v!==null;})); }

  var all3 = results.filter(function(r){
    return r.ASIALINE!=null && r.ASIALINEMA!=null && r.ASIALINESB!=null;
  });
  var diverged = all3.filter(function(r){
    return !(r.ASIALINE===r.ASIALINEMA && r.ASIALINE===r.ASIALINESB);
  });

  function winner(r){
    var m={ hkjc:Math.abs(adjMargin(r,'ASIALINE')), mac:Math.abs(adjMargin(r,'ASIALINEMA')), sbo:Math.abs(adjMargin(r,'ASIALINESB')) };
    var minM=Math.min(m.hkjc, m.mac, m.sbo);
    var best=Object.keys(m).filter(function(k){ return m[k]===minM; });
    return best.length===1 ? best[0] : 'tie';
  }

  // Overall accuracy
  var accWins={hkjc:0,mac:0,sbo:0,tie:0};
  diverged.forEach(function(r){ accWins[winner(r)]++; });

  // Running accuracy series
  var hkjcRun=[],macRun=[],sboRun=[]; var hw=0,mw=0,sw=0,nn=0;
  diverged.forEach(function(r){
    var w=winner(r);
    if(w==='hkjc') hw++; else if(w==='mac') mw++; else if(w==='sbo') sw++;
    nn++;
    hkjcRun.push(Math.round(hw/nn*1000)/10);
    macRun.push(Math.round(mw/nn*1000)/10);
    sboRun.push(Math.round(sw/nn*1000)/10);
  });

  // ROI on diverged per book
  var divStats = BOOKS.map(function(b){
    var sub=diverged.filter(function(r){ return r[b.hk]&&r[b.hk]>0&&r[b.ak]&&r[b.ak]>0; });
    return { key:b.key, label:b.label, color:b.color, n:sub.length,
      hroi:roiArr(sub.map(function(r){ return pnlH(r,b.lk,b.hk); })),
      aroi:roiArr(sub.map(function(r){ return pnlA(r,b.lk,b.ak); })) };
  });

  // Pairwise conflict: when HKJC vs Macau differ, who had better ROI?
  function conflictStats(sub, la, ha, aa, lb, hb, ab){
    var sa=sub.filter(function(r){ return r[ha]&&r[ha]>0&&r[aa]&&r[aa]>0; });
    var sb=sub.filter(function(r){ return r[hb]&&r[hb]>0&&r[ab]&&r[ab]>0; });
    return {
      n:sub.length,
      a:{ n:sa.length, hroi:roiArr(sa.map(function(r){return pnlH(r,la,ha);})), aroi:roiArr(sa.map(function(r){return pnlA(r,la,aa);})) },
      b:{ n:sb.length, hroi:roiArr(sb.map(function(r){return pnlH(r,lb,hb);})), aroi:roiArr(sb.map(function(r){return pnlA(r,lb,ab);})) },
    };
  }
  var hkjcHiMac = all3.filter(function(r){return r.ASIALINE>r.ASIALINEMA;});
  var hkjcLoMac = all3.filter(function(r){return r.ASIALINE<r.ASIALINEMA;});
  var hkjcHiSBO = all3.filter(function(r){return r.ASIALINE>r.ASIALINESB;});
  var hkjcLoSBO = all3.filter(function(r){return r.ASIALINE<r.ASIALINESB;});

  var conflicts = [
    { label:'HKJC line > Macau', desc:'HKJC handicaps H more than Macau',
      aLabel:'HKJC', aColor:'#f87171', bLabel:'Macau', bColor:'#a78bfa',
      data: conflictStats(hkjcHiMac,'ASIALINE','ASIAH','ASIAA','ASIALINEMA','ASIAHMAC','ASIAAMAC') },
    { label:'Macau line > HKJC', desc:'Macau handicaps H more than HKJC',
      aLabel:'HKJC', aColor:'#f87171', bLabel:'Macau', bColor:'#a78bfa',
      data: conflictStats(hkjcLoMac,'ASIALINE','ASIAH','ASIAA','ASIALINEMA','ASIAHMAC','ASIAAMAC') },
    { label:'HKJC line > SBO',   desc:'HKJC handicaps H more than SBO',
      aLabel:'HKJC', aColor:'#f87171', bLabel:'SBO', bColor:'#fb923c',
      data: conflictStats(hkjcHiSBO,'ASIALINE','ASIAH','ASIAA','ASIALINESB','ASIAHSBO','ASIAASBO') },
    { label:'SBO line > HKJC',   desc:'SBO handicaps H more than HKJC',
      aLabel:'HKJC', aColor:'#f87171', bLabel:'SBO', bColor:'#fb923c',
      data: conflictStats(hkjcLoSBO,'ASIALINE','ASIAH','ASIAA','ASIALINESB','ASIAHSBO','ASIAASBO') },
  ];

  // Monthly accuracy
  var monthMap={};
  diverged.forEach(function(r){ var ym=(r.DATE||'').slice(0,7); if(!ym) return; if(!monthMap[ym])monthMap[ym]=[]; monthMap[ym].push(r); });
  var monthTable=Object.keys(monthMap).sort().map(function(ym){
    var sub=monthMap[ym], w={hkjc:0,mac:0,sbo:0,tie:0};
    sub.forEach(function(r){ w[winner(r)]++; });
    var t=sub.length, bk=['hkjc','mac','sbo'].reduce(function(a,b){return w[a]>w[b]?a:b;});
    return { ym:ym, n:t, hkjc:w.hkjc, mac:w.mac, sbo:w.sbo, tie:w.tie,
      hPct:Math.round(w.hkjc/t*1000)/10, mPct:Math.round(w.mac/t*1000)/10,
      sPct:Math.round(w.sbo/t*1000)/10, tPct:Math.round(w.tie/t*1000)/10, best:bk };
  });

  return { BOOKS:BOOKS, all3n:all3.length, divergedN:diverged.length,
    accWins:accWins, divStats:divStats, conflicts:conflicts,
    monthTable:monthTable, hkjcRun:hkjcRun, macRun:macRun, sboRun:sboRun };
}

function renderLine(d){
  var ld=d.line, aw=ld.accWins, t=ld.divergedN;
  var C={hkjc:'#f87171',mac:'#a78bfa',sbo:'#fb923c'}, L={hkjc:'HKJC',mac:'Macau',sbo:'SBO'};
  var bestKey=['hkjc','mac','sbo'].reduce(function(a,b){return aw[a]>aw[b]?a:b;});

  // Cards
  document.getElementById('lineCards').innerHTML =
    '<div class="rpt-card"><div class="rpt-card-label">Same-match pool</div><div class="rpt-card-val neu">'+ld.all3n+'</div></div>'
   +'<div class="rpt-card"><div class="rpt-card-label">Lines diverged</div><div class="rpt-card-val neu">'+t+'</div><div class="rpt-card-sub">'+Math.round(t/ld.all3n*100)+'% of matches</div></div>'
   +'<div class="rpt-card" style="border-top:3px solid '+C[bestKey]+'"><div class="rpt-card-label">Most accurate</div><div class="rpt-card-val pos" style="color:'+C[bestKey]+'">'+L[bestKey]+'</div><div class="rpt-card-sub">'+Math.round(aw[bestKey]/t*100)+'% of diverged</div></div>'
   +['hkjc','mac','sbo'].map(function(k){
     var pct=Math.round(aw[k]/t*1000)/10;
     return '<div class="rpt-card" style="border-top:3px solid '+C[k]+'"><div class="rpt-card-label">'+L[k]+'</div>'
       +'<div class="rpt-card-val '+(k===bestKey?'pos':'neu')+'" style="color:'+C[k]+'">'+pct+'%</div>'
       +'<div class="rpt-card-sub">'+aw[k]+' matches</div></div>';
   }).join('');

  // Chart
  var area=document.getElementById('lineChartsArea');
  area.innerHTML='<div class="chart-box">'
    +'<div class="chart-box-label">Running Line Accuracy % (on diverged matches, closest adjusted margin to 0 wins)</div>'
    +'<div class="chart-legend" id="lgdAcc"></div><canvas id="cAcc"></canvas></div>';
  var accSeries=[
    {label:'HKJC', color:'#f87171', pts:ld.hkjcRun},
    {label:'Macau',color:'#a78bfa', pts:ld.macRun},
    {label:'SBO',  color:'#fb923c', pts:ld.sboRun},
  ];
  makeLegend('lgdAcc', accSeries);
  setTimeout(function(){ drawChart('cAcc', accSeries, d.monthBounds, 130); }, 30);

  // Conflict grid
  var cfHtml='<div style="margin:14px 0 6px;font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:.05em">When Books Disagree — ROI Comparison</div>'
    +'<div style="font-size:10px;color:#475569;margin-bottom:10px">Lower absolute ROI on the H side = that book\'s higher line was harder to beat = closer to the true handicap.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';

  ld.conflicts.forEach(function(cf){
    var ad=cf.data.a, bd=cf.data.b;
    // Which book had lower abs(hroi)? = more accurate line
    var aWins=Math.abs(ad.hroi)<Math.abs(bd.hroi);
    var winnerLabel=aWins?cf.aLabel:cf.bLabel;
    var winnerColor=aWins?cf.aColor:cf.bColor;
    function bookDiv(label, col, stat, isWinner){
      var hc=stat.hroi>=0?'#4ade80':'#f87171', ac=stat.aroi>=0?'#4ade80':'#f87171';
      return '<div style="border-left:3px solid '+col+(isWinner?';background:rgba(255,255,255,0.03)':'')+';padding:5px 8px;border-radius:0 4px 4px 0">'
        +'<div style="font-size:9px;color:'+col+';font-weight:700;margin-bottom:4px">'+label+' (N='+stat.n+')'+(isWinner?' ✓':'')+'</div>'
        +'<div style="font-size:11px;font-family:var(--mono)">H: <b style="color:'+hc+'">'+fmtRoi(stat.hroi)+'</b></div>'
        +'<div style="font-size:11px;font-family:var(--mono)">A: <b style="color:'+ac+'">'+fmtRoi(stat.aroi)+'</b></div>'
        +'</div>';
    }
    cfHtml+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div><div style="font-size:11px;font-weight:700;color:#e2e8f0">'+cf.label+'</div>'
      +'<div style="font-size:9px;color:#475569">'+cf.desc+' · N='+cf.data.n+'</div></div>'
      +'<div style="font-size:10px;font-weight:700;color:'+winnerColor+'">'+winnerLabel+' more accurate</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      +bookDiv(cf.aLabel, cf.aColor, ad, aWins)
      +bookDiv(cf.bLabel, cf.bColor, bd, !aWins)
      +'</div></div>';
  });
  cfHtml+='</div>';

  // Monthly table
  var tHead='<tr><th>Month</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">HKJC%</th>'
    +'<th class="num" style="color:#a78bfa">Macau%</th>'
    +'<th class="num" style="color:#fb923c">SBO%</th>'
    +'<th class="num" style="color:#475569">Tie%</th>'
    +'<th>Winner</th></tr>';

  var tBody=ld.monthTable.map(function(row){
    function cell(pct, key){
      var bold=key===row.best?'font-weight:800':'', col=key===row.best?C[key]:'#64748b';
      return '<td class="num" style="font-family:var(--mono);color:'+col+';'+bold+'">'+pct.toFixed(1)+'%</td>';
    }
    return '<tr><td style="font-family:var(--mono);font-size:11px">'+row.ym+'</td>'
      +'<td class="num" style="color:#475569;font-family:var(--mono)">'+row.n+'</td>'
      +cell(row.hPct,'hkjc')+cell(row.mPct,'mac')+cell(row.sPct,'sbo')
      +'<td class="num" style="color:#334155;font-family:var(--mono)">'+row.tPct.toFixed(1)+'%</td>'
      +'<td><span style="color:'+C[row.best]+';font-weight:700">'+L[row.best]+'</span></td>'
      +'</tr>';
  }).join('');

  var methHtml='<div style="margin-top:12px;font-size:10px;color:#475569;line-height:1.7;padding:10px 12px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">'
    +'<b style="color:#94a3b8">📖 Methodology:</b> For each match where books carry different lines, the adjusted margin '
    +'(Score H − Score A + Line) is computed per book. The book whose |adjusted margin| is <b style="color:#e2e8f0">closest to zero</b> '
    +'set the most accurate handicap — perfectly splitting the match. '
    +'In the conflict analysis, lower absolute H ROI indicates the book\'s higher line was tighter and harder to beat.'
    +'</div>';

  // Inject
  document.getElementById('tbLine').innerHTML = tBody;
  var table=document.getElementById('tbLine').closest('table');
  if(table) table.querySelector('thead').innerHTML = tHead;
  var wrap=document.getElementById('tbLine').closest('.rpt-table-wrap');
  if(wrap){
    var div=document.createElement('div');
    div.innerHTML=cfHtml+methHtml;
    wrap.parentElement.insertBefore(div, wrap);
  }
}
