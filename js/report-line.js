// ── report-line.js — Tab 2: Bookmaker Odds Comparison (HKJC vs Macau vs SBO) ──
// Replaces old "ROI by Line" report.
// Each bookmaker uses its own line and odds — outcomes computed independently.

function computeLine(results){
  var BOOKS = [
    { key:'hkjc',  label:'HKJC',  lk:'ASIALINE',   hk:'ASIAH',    ak:'ASIAA',    color:'#f87171', colorA:'#60a5fa' },
    { key:'mac',   label:'Macau', lk:'ASIALINEMA', hk:'ASIAHMAC', ak:'ASIAAMAC', color:'#a78bfa', colorA:'#c084fc' },
    { key:'sbo',   label:'SBO',   lk:'ASIALINESB', hk:'ASIAHSBO', ak:'ASIAASBO', color:'#fb923c', colorA:'#fbbf24' },
  ];

  function outcomeFor(r, lk){
    var line = r[lk];
    if(line==null) return null;
    var m = Math.round((r.RESULTH - r.RESULTA + line) * 4) / 4;
    if(m >= 0.5)  return 'ww';
    if(m === 0.25) return 'wh';
    if(m === 0)    return 'dd';
    if(m ===-0.25) return 'lh';
    return 'lw';
  }

  function cHfor(r, lk, hk){
    var o = outcomeFor(r, lk);
    var oh = r[hk];
    if(!o || !oh || oh<=0) return null;
    if(o==='ww') return oh-1;
    if(o==='wh') return (oh-1)*0.5;
    if(o==='dd') return 0;
    if(o==='lh') return -0.5;
    return -1;
  }

  function cAfor(r, lk, ak){
    var o = outcomeFor(r, lk);
    var oa = r[ak];
    if(!o || !oa || oa<=0) return null;
    if(o==='lw') return oa-1;
    if(o==='lh') return (oa-1)*0.5;
    if(o==='dd') return 0;
    if(o==='wh') return -0.5;
    return -1;
  }

  // Per-bookmaker overall stats
  var bookStats = BOOKS.map(function(b){
    var sub = results.filter(function(r){
      return r[b.lk]!=null && r[b.hk] && r[b.hk]>0 && r[b.ak] && r[b.ak]>0;
    });
    var hVals = sub.map(function(r){ return cHfor(r, b.lk, b.hk); }).filter(function(v){ return v!==null; });
    var aVals = sub.map(function(r){ return cAfor(r, b.lk, b.ak); }).filter(function(v){ return v!==null; });
    return {
      key: b.key, label: b.label, color: b.color, colorA: b.colorA,
      n: sub.length,
      hroi: roiOf(hVals), aroi: roiOf(aVals),
      hpnl: Math.round(hVals.reduce(function(s,v){return s+v;},0)*100)/100,
      apnl: Math.round(aVals.reduce(function(s,v){return s+v;},0)*100)/100,
      hSeries: { label: b.label+' H', color: b.color,  pts: runPnl(sub, function(r){ return cHfor(r,b.lk,b.hk); }) },
      aSeries: { label: b.label+' A', color: b.colorA, pts: runPnl(sub, function(r){ return cAfor(r,b.lk,b.ak); }) },
    };
  });

  // Monthly breakdown
  var monthMap = {};
  results.forEach(function(r){
    var ym = (r.DATE||'').slice(0,7); if(!ym) return;
    if(!monthMap[ym]) monthMap[ym] = [];
    monthMap[ym].push(r);
  });
  var months = Object.keys(monthMap).sort();
  var monthTable = months.map(function(ym){
    var row = { ym: ym };
    BOOKS.forEach(function(b){
      var sub = monthMap[ym].filter(function(r){
        return r[b.lk]!=null && r[b.hk]>0 && r[b.ak]>0;
      });
      var hv = sub.map(function(r){ return cHfor(r,b.lk,b.hk); }).filter(function(v){ return v!==null; });
      var av = sub.map(function(r){ return cAfor(r,b.lk,b.ak); }).filter(function(v){ return v!==null; });
      row[b.key+'_n']    = sub.length;
      row[b.key+'_hroi'] = roiOf(hv);
      row[b.key+'_aroi'] = roiOf(av);
    });
    return row;
  });

  return { bookStats: bookStats, monthTable: monthTable, books: BOOKS };
}

function renderLine(d){
  var data = d.line;
  var books = data.bookStats;

  // ── Cards ──
  var best = books.slice().sort(function(a,b){ return Math.max(b.hroi,b.aroi)-Math.max(a.hroi,a.aroi); })[0];
  document.getElementById('lineCards').innerHTML = books.map(function(b){
    var hc = b.hroi>=0?'pos':'neg', ac = b.aroi>=0?'pos':'neg';
    return '<div class="rpt-card" style="border-top:3px solid '+b.color+'">'
      +'<div class="rpt-card-label" style="color:'+b.color+';font-weight:700">'+b.label+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-bottom:4px">N='+b.n+'</div>'
      +'<div style="display:flex;gap:12px">'
      +'<div><div style="font-size:9px;color:#f87171;font-weight:700;margin-bottom:2px">H BET</div>'
      +'<div class="rpt-card-val '+hc+'">'+fmtRoi(b.hroi)+'</div></div>'
      +'<div><div style="font-size:9px;color:#60a5fa;font-weight:700;margin-bottom:2px">A BET</div>'
      +'<div class="rpt-card-val '+ac+'">'+fmtRoi(b.aroi)+'</div></div>'
      +'</div></div>';
  }).join('');

  // ── Charts ──
  var area = document.getElementById('lineChartsArea');
  area.innerHTML =
    '<div class="chart-box">'
    +'<div class="chart-box-label">H Bet — Running ROI% by Bookmaker</div>'
    +'<div class="chart-legend" id="lgdBooksH"></div>'
    +'<canvas id="cBooksH"></canvas>'
    +'</div>'
    +'<div class="chart-box">'
    +'<div class="chart-box-label">A Bet — Running ROI% by Bookmaker</div>'
    +'<div class="chart-legend" id="lgdBooksA"></div>'
    +'<canvas id="cBooksA"></canvas>'
    +'</div>';

  var hSeries = books.map(function(b){ return b.hSeries; });
  var aSeries = books.map(function(b){ return b.aSeries; });
  makeLegend('lgdBooksH', hSeries);
  makeLegend('lgdBooksA', aSeries);
  setTimeout(function(){
    drawChart('cBooksH', hSeries, d.monthBounds, 120);
    drawChart('cBooksA', aSeries, d.monthBounds, 120);
  }, 30);

  // ── Monthly table ──
  var bk = data.books;
  var thead = '<tr><th>Month</th>';
  bk.forEach(function(b){
    thead += '<th class="num" style="color:'+b.color+'">'+b.label+' N</th>'
      +'<th class="num" style="color:'+b.color+'">H ROI%</th>'
      +'<th class="num" style="color:'+b.color+'">A ROI%</th>';
  });
  thead += '<th>Best H</th></tr>';

  document.getElementById('tbLine').innerHTML = data.monthTable.map(function(row){
    // find best H ROI bookmaker this month
    var bestH = bk.slice().sort(function(a,b){ return row[b.key+'_hroi']-row[a.key+'_hroi']; })[0];
    var tr = '<tr><td style="font-family:var(--mono);font-size:11px">'+row.ym+'</td>';
    bk.forEach(function(b){
      var hr = row[b.key+'_hroi'], ar = row[b.key+'_aroi'], n = row[b.key+'_n'];
      var hc = hr>=0?'#4ade80':'#f87171', ac = ar>=0?'#4ade80':'#f87171';
      tr += '<td class="num" style="color:#64748b;font-family:var(--mono)">'+n+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+hc+'">'+fmtRoi(hr)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+ac+'">'+fmtRoi(ar)+'</td>';
    });
    tr += '<td><span style="color:'+bestH.color+';font-weight:700;font-size:11px">'+bestH.label+'</span></td>';
    tr += '</tr>';
    return tr;
  }).join('');

  // Update thead
  var table = document.getElementById('tbLine').parentElement;
  table.querySelector('thead').innerHTML = thead;
}
