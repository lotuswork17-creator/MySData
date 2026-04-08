// ── report-line.js — Tab 2: Bookmaker Line Accuracy × Expert Tips ──
// Compares HKJC, Macau, SBO line accuracy on diverged matches,
// broken down by each of the 4 JC expert tip providers.

function computeLine(results){
  var TM={'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0};
  var EXPERTS=[{key:'JCTIPSUM',label:'JC Sum'},{key:'JCTIPSID',label:'JC SID'},
               {key:'TIPSIDMAC',label:'SID Mac'},{key:'TIPSONID',label:'ONID'}];
  var BOOKS=[{key:'hkjc',label:'HKJC',lk:'ASIALINE',hk:'ASIAH',ak:'ASIAA',color:'#f87171'},
             {key:'mac',label:'Macau',lk:'ASIALINEMA',hk:'ASIAHMAC',ak:'ASIAAMAC',color:'#a78bfa'},
             {key:'sbo',label:'SBO',lk:'ASIALINESB',hk:'ASIAHSBO',ak:'ASIAASBO',color:'#fb923c'}];

  function adjM(r,lk){ return Math.round((r.RESULTH-r.RESULTA+r[lk])*4)/4; }
  function winner(r){
    var m={hkjc:Math.abs(adjM(r,'ASIALINE')),mac:Math.abs(adjM(r,'ASIALINEMA')),sbo:Math.abs(adjM(r,'ASIALINESB'))};
    var minM=Math.min(m.hkjc,m.mac,m.sbo);
    var best=Object.keys(m).filter(function(k){return m[k]===minM;});
    return best.length===1?best[0]:'tie';
  }
  function pnlH(r,lk,hk){
    var m=adjM(r,lk),oh=r[hk]; if(!oh||oh<=0) return null;
    if(m>=0.5) return oh-1; if(m===0.25) return (oh-1)*0.5;
    if(m===0) return 0; if(m===-0.25) return -0.5; return -1;
  }
  function pnlA(r,lk,ak){
    var m=adjM(r,lk),oa=r[ak]; if(!oa||oa<=0) return null;
    if(m<=-0.5) return oa-1; if(m===-0.25) return (oa-1)*0.5;
    if(m===0) return 0; if(m===0.25) return -0.5; return -1;
  }
  function roi(arr){
    var v=arr.filter(function(x){return x!==null;});
    return v.length?Math.round(v.reduce(function(s,x){return s+x;},0)/v.length*1000)/10:null;
  }
  function accOf(sub){
    var w={hkjc:0,mac:0,sbo:0,tie:0};
    sub.forEach(function(r){w[winner(r)]++;});
    return w;
  }

  var all3=results.filter(function(r){
    return r.ASIALINE!=null&&r.ASIALINEMA!=null&&r.ASIALINESB!=null;
  });
  var diverged=all3.filter(function(r){
    return !(r.ASIALINE===r.ASIALINEMA&&r.ASIALINE===r.ASIALINESB);
  });

  // ── Overall accuracy ──
  var overallWins=accOf(diverged);
  var hkjcRun=[],macRun=[],sboRun=[]; var hw=0,mw=0,sw=0,nn=0;
  diverged.forEach(function(r){
    var w=winner(r);
    if(w==='hkjc')hw++; else if(w==='mac')mw++; else if(w==='sbo')sw++;
    nn++;
    hkjcRun.push(Math.round(hw/nn*1000)/10);
    macRun.push(Math.round(mw/nn*1000)/10);
    sboRun.push(Math.round(sw/nn*1000)/10);
  });

  // ── Per-expert breakdown ──
  // For each expert × tip direction: accuracy + ROI per book
  var expertRows=[];
  EXPERTS.forEach(function(exp){
    [{dir:1,label:'H'},{dir:-1,label:'A'}].forEach(function(tip){
      var sub=diverged.filter(function(r){return TM[String(r[exp.key]||'')]===tip.dir;});
      if(sub.length<20) return;
      var w=accOf(sub); var t=sub.length;
      var bookData=BOOKS.map(function(b){
        var s=sub.filter(function(r){return r[b.hk]&&r[b.hk]>0&&r[b.ak]&&r[b.ak]>0;});
        return {key:b.key,label:b.label,color:b.color,n:s.length,
          hroi:roi(s.map(function(r){return pnlH(r,b.lk,b.hk);})),
          aroi:roi(s.map(function(r){return pnlA(r,b.lk,b.ak);})),
          accPct:Math.round(w[b.key]/t*1000)/10};
      });
      var bestAccKey=BOOKS.map(function(b){return b.key;}).reduce(function(a,b){return w[a]>w[b]?a:b;});
      expertRows.push({expKey:exp.key,expLabel:exp.label,tipDir:tip.dir,tipLabel:tip.label,
        n:t,wins:w,bookData:bookData,bestAccKey:bestAccKey,tiePct:Math.round(w.tie/t*1000)/10});
    });
  });

  // ── Pairwise: HKJC vs Macau when they differ, per expert tip ──
  var pairRows=[];
  EXPERTS.forEach(function(exp){
    [{dir:1,label:'H'},{dir:-1,label:'A'}].forEach(function(tip){
      // HKJC higher = HKJC thinks H is stronger
      var hkjcHi=diverged.filter(function(r){
        return TM[String(r[exp.key]||'')]===tip.dir && r.ASIALINE>r.ASIALINEMA;
      });
      var macHi=diverged.filter(function(r){
        return TM[String(r[exp.key]||'')]===tip.dir && r.ASIALINE<r.ASIALINEMA;
      });
      [
        {sub:hkjcHi,hiBook:'HKJC',hiColor:'#f87171',loBook:'Macau',loColor:'#a78bfa',
         hiLk:'ASIALINE',hiHk:'ASIAH',hiAk:'ASIAA',loLk:'ASIALINEMA',loHk:'ASIAHMAC',loAk:'ASIAAMAC'},
        {sub:macHi,hiBook:'Macau',hiColor:'#a78bfa',loBook:'HKJC',loColor:'#f87171',
         hiLk:'ASIALINEMA',hiHk:'ASIAHMAC',hiAk:'ASIAAMAC',loLk:'ASIALINE',loHk:'ASIAH',loAk:'ASIAA'},
      ].forEach(function(pair){
        if(pair.sub.length<15) return;
        var s=pair.sub;
        var hiH=roi(s.filter(function(r){return r[pair.hiHk]&&r[pair.hiAk];}).map(function(r){return pnlH(r,pair.hiLk,pair.hiHk);}));
        var loH=roi(s.filter(function(r){return r[pair.loHk]&&r[pair.loAk];}).map(function(r){return pnlH(r,pair.loLk,pair.loHk);}));
        var hiKey=pair.hiBook==='HKJC'?'hkjc':pair.hiBook==='Macau'?'mac':'sbo';
        var loKey=pair.loBook==='HKJC'?'hkjc':pair.loBook==='Macau'?'mac':'sbo';
        var w=accOf(s);
        // agree = expert tips same direction as book's higher line
        // If tip=H and hiBook has HIGHER line = they both think H is stronger = AGREE
        var agree=tip.dir===1;
        pairRows.push({expLabel:exp.expLabel||exp.label,tipLabel:tip.label,tipDir:tip.dir,
          hiBook:pair.hiBook,hiColor:pair.hiColor,loBook:pair.loBook,loColor:pair.loColor,
          n:s.length,hiHroi:hiH,loHroi:loH,
          hiAcc:Math.round(w[hiKey]/s.length*1000)/10,
          loAcc:Math.round(w[loKey]/s.length*1000)/10,
          agree:agree});
      });
    });
  });

  // Monthly overall
  var monthMap={};
  diverged.forEach(function(r){var ym=(r.DATE||'').slice(0,7);if(!ym)return;if(!monthMap[ym])monthMap[ym]=[];monthMap[ym].push(r);});
  var monthTable=Object.keys(monthMap).sort().map(function(ym){
    var sub=monthMap[ym],w=accOf(sub),t=sub.length;
    var bk=['hkjc','mac','sbo'].reduce(function(a,b){return w[a]>w[b]?a:b;});
    return{ym:ym,n:t,hPct:Math.round(w.hkjc/t*1000)/10,mPct:Math.round(w.mac/t*1000)/10,
      sPct:Math.round(w.sbo/t*1000)/10,tPct:Math.round(w.tie/t*1000)/10,best:bk};
  });

  return{BOOKS:BOOKS,EXPERTS:EXPERTS,all3n:all3.length,divergedN:diverged.length,
    overallWins:overallWins,hkjcRun:hkjcRun,macRun:macRun,sboRun:sboRun,
    expertRows:expertRows,pairRows:pairRows,monthTable:monthTable,
    oddsData:computeLineOdds(results)};
}

function renderLine(d){
  var ld=d.line, aw=ld.overallWins, t=ld.divergedN;
  var C={hkjc:'#f87171',mac:'#a78bfa',sbo:'#fb923c'}, L={hkjc:'HKJC',mac:'Macau',sbo:'SBO'};
  var bestKey=['hkjc','mac','sbo'].reduce(function(a,b){return aw[a]>aw[b]?a:b;});

  // ── Cards ──
  document.getElementById('lineCards').innerHTML=
    '<div class="rpt-card"><div class="rpt-card-label">Same-match pool</div><div class="rpt-card-val neu">'+ld.all3n+'</div></div>'
   +'<div class="rpt-card"><div class="rpt-card-label">Lines diverged</div><div class="rpt-card-val neu">'+t+'</div><div class="rpt-card-sub">'+Math.round(t/ld.all3n*100)+'% of matches</div></div>'
   +'<div class="rpt-card" style="border-top:3px solid '+C[bestKey]+'"><div class="rpt-card-label">Most accurate</div><div class="rpt-card-val pos" style="color:'+C[bestKey]+'">'+L[bestKey]+'</div><div class="rpt-card-sub">'+Math.round(aw[bestKey]/t*100)+'% of diverged</div></div>'
   +['hkjc','mac','sbo'].map(function(k){
     return '<div class="rpt-card" style="border-top:3px solid '+C[k]+'">'
       +'<div class="rpt-card-label">'+L[k]+'</div>'
       +'<div class="rpt-card-val '+(k===bestKey?'pos':'neu')+'" style="color:'+C[k]+'">'+Math.round(aw[k]/t*10)/10+'%</div>'
       +'<div class="rpt-card-sub">'+aw[k]+' wins</div></div>';
   }).join('');

  // ── Running accuracy chart ──
  var area=document.getElementById('lineChartsArea');
  area.innerHTML='<div class="chart-box">'
    +'<div class="chart-box-label">Running Line Accuracy % — all diverged matches (closer adjusted margin to 0 = wins)</div>'
    +'<div class="chart-legend" id="lgdAcc"></div><canvas id="cAcc"></canvas></div>';
  var accSeries=[
    {label:'HKJC',color:'#f87171',pts:ld.hkjcRun},
    {label:'Macau',color:'#a78bfa',pts:ld.macRun},
    {label:'SBO',color:'#fb923c',pts:ld.sboRun},
  ];
  makeLegend('lgdAcc',accSeries);
  setTimeout(function(){drawChart('cAcc',accSeries,d.monthBounds,130);},30);

  // ── Expert breakdown table ──
  var expHtml='<div style="margin:14px 0 6px;font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:.05em">Line Accuracy × Expert Tip Direction</div>'
    +'<div style="font-size:10px;color:#64748b;margin-bottom:10px">For each expert tip provider and direction, which bookmaker\'s line was most accurate on diverged matches? Also shows H bet ROI using each book\'s own line and odds.</div>'
    +'<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
    +'<th>Expert</th><th class="num">Tip</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">HKJC Acc%</th><th class="num" style="color:#f87171">H ROI</th>'
    +'<th class="num" style="color:#a78bfa">Macau Acc%</th><th class="num" style="color:#a78bfa">H ROI</th>'
    +'<th class="num" style="color:#fb923c">SBO Acc%</th><th class="num" style="color:#fb923c">H ROI</th>'
    +'<th class="num" style="color:#475569">Tie%</th><th>Best Acc</th>'
    +'</tr></thead><tbody>';

  ld.expertRows.forEach(function(row){
    var bk=row.bookData;
    function bCol(val){ return val>=0?'#4ade80':'#f87171'; }
    function accCell(bd){ return '<td class="num" style="font-family:var(--mono);color:'+(bd.key===row.bestAccKey?C[bd.key]:'#64748b')+';'+(bd.key===row.bestAccKey?'font-weight:800':'')+'">'+(bd.accPct||0).toFixed(1)+'%</td>'; }
    function roiCell(bd){ var v=bd.hroi; return v===null?'<td class="num" style="color:#475569">—</td>':'<td class="num" style="font-family:var(--mono);color:'+bCol(v)+'">'+(v>=0?'+':'')+v.toFixed(1)+'%</td>'; }
    expHtml+='<tr>'
      +'<td style="font-weight:600;color:#e2e8f0">'+row.expLabel+'</td>'
      +'<td class="num"><span style="font-weight:700;color:'+(row.tipDir===1?'#f87171':'#60a5fa')+'">'+row.tipLabel+'</span></td>'
      +'<td class="num" style="color:#64748b;font-family:var(--mono)">'+row.n+'</td>'
      +accCell(bk[0])+roiCell(bk[0])
      +accCell(bk[1])+roiCell(bk[1])
      +accCell(bk[2])+roiCell(bk[2])
      +'<td class="num" style="color:#334155;font-family:var(--mono)">'+row.tiePct.toFixed(1)+'%</td>'
      +'<td><span style="color:'+C[row.bestAccKey]+';font-weight:700">'+L[row.bestAccKey]+'</span></td>'
      +'</tr>';
  });
  expHtml+='</tbody></table></div>';

  // ── Pairwise conflict by expert ──
  var pfHtml='<div style="margin:16px 0 6px;font-size:10px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:.05em">HKJC vs Macau Line Conflict × Expert Tips</div>'
    +'<div style="font-size:10px;color:#64748b;margin-bottom:10px">When HKJC and Macau carry different lines on the same match, filtered by expert tip direction. Lower |H ROI| on the higher-line book = that book\'s handicap was harder to beat = more accurate.</div>'
    +'<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
    +'<th>Expert</th><th>Tip</th><th class="num">N</th>'
    +'<th>Higher Line Book</th><th class="num">Acc%</th><th class="num">H ROI</th>'
    +'<th>Lower Line Book</th><th class="num">Acc%</th><th class="num">H ROI</th>'
    +'<th>Agreement</th><th>More Accurate</th>'
    +'</tr></thead><tbody>';

  ld.pairRows.forEach(function(row){
    var hiWins=row.hiAcc>row.loAcc;
    var hiRoiCol=row.hiHroi!==null?(row.hiHroi>=0?'#4ade80':'#f87171'):'#475569';
    var loRoiCol=row.loHroi!==null?(row.loHroi>=0?'#4ade80':'#f87171'):'#475569';
    pfHtml+='<tr>'
      +'<td style="font-weight:600;color:#e2e8f0">'+row.expLabel+'</td>'
      +'<td><span style="font-weight:700;color:'+(row.tipDir===1?'#f87171':'#60a5fa')+'">'+row.tipLabel+'</span></td>'
      +'<td class="num" style="color:#64748b;font-family:var(--mono)">'+row.n+'</td>'
      +'<td><span style="color:'+row.hiColor+';font-weight:700">'+row.hiBook+'</span></td>'
      +'<td class="num" style="font-family:var(--mono);color:'+(hiWins?row.hiColor:'#64748b')+';'+(hiWins?'font-weight:800':'')+'">'+(row.hiAcc||0).toFixed(1)+'%</td>'
      +'<td class="num" style="font-family:var(--mono);color:'+hiRoiCol+'">'+(row.hiHroi!==null?(row.hiHroi>=0?'+':'')+row.hiHroi.toFixed(1)+'%':'—')+'</td>'
      +'<td><span style="color:'+row.loColor+';font-weight:700">'+row.loBook+'</span></td>'
      +'<td class="num" style="font-family:var(--mono);color:'+(!hiWins?row.loColor:'#64748b')+';'+(!hiWins?'font-weight:800':'')+'">'+(row.loAcc||0).toFixed(1)+'%</td>'
      +'<td class="num" style="font-family:var(--mono);color:'+loRoiCol+'">'+(row.loHroi!==null?(row.loHroi>=0?'+':'')+row.loHroi.toFixed(1)+'%':'—')+'</td>'
      +'<td><span style="font-size:10px;font-weight:700;color:'+(row.agree?'#4ade80':'#fbbf24')+'">'+(row.agree?'✓ AGREE':'⚡ DISAGREE')+'</span></td>'
      +'<td><span style="color:'+(hiWins?row.hiColor:row.loColor)+';font-weight:700">'+(hiWins?row.hiBook:row.loBook)+'</span></td>'
      +'</tr>';
  });
  pfHtml+='</tbody></table></div>';

  // ── Monthly table ──
  var tHead='<tr><th>Month</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">HKJC%</th>'
    +'<th class="num" style="color:#a78bfa">Macau%</th>'
    +'<th class="num" style="color:#fb923c">SBO%</th>'
    +'<th class="num" style="color:#475569">Tie%</th><th>Winner</th></tr>';

  var tBody=ld.monthTable.map(function(row){
    function cell(pct,key){
      return '<td class="num" style="font-family:var(--mono);color:'+(key===row.best?C[key]:'#64748b')+';'+(key===row.best?'font-weight:800':'')+'">'+(pct||0).toFixed(1)+'%</td>';
    }
    return '<tr><td style="font-family:var(--mono);font-size:11px">'+row.ym+'</td>'
      +'<td class="num" style="color:#475569;font-family:var(--mono)">'+row.n+'</td>'
      +cell(row.hPct,'hkjc')+cell(row.mPct,'mac')+cell(row.sPct,'sbo')
      +'<td class="num" style="color:#334155;font-family:var(--mono)">'+(row.tPct||0).toFixed(1)+'%</td>'
      +'<td><span style="color:'+C[row.best]+';font-weight:700">'+L[row.best]+'</span></td></tr>';
  }).join('');

  var methHtml='<div style="margin-top:12px;font-size:10px;color:#475569;line-height:1.7;padding:10px 12px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">'
    +'<b style="color:#94a3b8">📖 Methodology:</b> '
    +'<b style="color:#e2e8f0">Line accuracy</b> — for each match where books differ, the book whose |Score H − Score A + Line| is closest to zero set the most accurate handicap. '
    +'<b style="color:#e2e8f0">Expert tip filter</b> — each row filters the diverged pool to matches where that expert tipped H or A, then measures accuracy and ROI within that subset. '
    +'<b style="color:#e2e8f0">Agreement</b> — ✓ AGREE = the expert tipped the same team the higher-line book handicapped more (both expect the same side to be stronger).'
    +'</div>';

  // Inject all into page
  document.getElementById('tbLine').innerHTML=tBody;
  var table=document.getElementById('tbLine').closest('table');
  if(table) table.querySelector('thead').innerHTML=tHead;
  var wrap=document.getElementById('tbLine').closest('.rpt-table-wrap');
  if(wrap){
    var div=document.createElement('div');
    div.innerHTML=expHtml+pfHtml+methHtml;
    wrap.parentElement.insertBefore(div,wrap);
  }
  // Odds comparison section
  if(ld.oddsData) renderLineOdds(d, ld.oddsData);
}

// ── Odds comparison extension ──
function computeLineOdds(results){
  var BOOKS=[
    {key:'hkjc',label:'HKJC',lk:'ASIALINE',hk:'ASIAH',ak:'ASIAA',color:'#f87171'},
    {key:'mac',label:'Macau',lk:'ASIALINEMA',hk:'ASIAHMAC',ak:'ASIAAMAC',color:'#a78bfa'},
    {key:'sbo',label:'SBO',lk:'ASIALINESB',hk:'ASIAHSBO',ak:'ASIAASBO',color:'#fb923c'},
  ];
  var PAIRS=[
    {other:'mac',oLabel:'Macau',oColor:'#a78bfa',lk2:'ASIALINEMA',hk2:'ASIAHMAC',ak2:'ASIAAMAC'},
    {other:'sbo',oLabel:'SBO',  oColor:'#fb923c',lk2:'ASIALINESB',hk2:'ASIAHSBO',ak2:'ASIAASBO'},
  ];
  var THRESHOLDS=[
    {label:'HKJC well above (>3%)', fn:function(d){return d>0.03;},  color:'#4ade80'},
    {label:'HKJC above (1–3%)',     fn:function(d){return d>0.01&&d<=0.03;}, color:'#a3e635'},
    {label:'Similar (≤1%)',         fn:function(d){return Math.abs(d)<=0.01;}, color:'#94a3b8'},
    {label:'HKJC below (1–3%)',     fn:function(d){return d<-0.01&&d>=-0.03;},color:'#fbbf24'},
    {label:'HKJC well below (>3%)', fn:function(d){return d<-0.03;}, color:'#f87171'},
  ];

  function adjM(r,lk){return Math.round((r.RESULTH-r.RESULTA+r[lk])*4)/4;}
  function pnlH(r,lk,hk){var m=adjM(r,lk),oh=r[hk];if(!oh||oh<=0)return null;if(m>=0.5)return oh-1;if(m===0.25)return(oh-1)*0.5;if(m===0)return 0;if(m===-0.25)return-0.5;return-1;}
  function pnlA(r,lk,ak){var m=adjM(r,lk),oa=r[ak];if(!oa||oa<=0)return null;if(m<=-0.5)return oa-1;if(m===-0.25)return(oa-1)*0.5;if(m===0)return 0;if(m===0.25)return-0.5;return-1;}
  function roi(arr){var v=arr.filter(function(x){return x!==null;});return v.length?Math.round(v.reduce(function(s,x){return s+x;},0)/v.length*1000)/10:null;}
  function avg(arr){var v=arr.filter(function(x){return x!==null;});return v.length?Math.round(v.reduce(function(s,x){return s+x;},0)/v.length*10000)/10000:null;}
  function vig(r,hk,ak){return(r[hk]&&r[ak]&&r[hk]>0&&r[ak]>0)?(1/r[hk]+1/r[ak]-1)*100:null;}

  var all3=results.filter(function(r){
    return r.ASIALINE!=null&&r.ASIAH&&r.ASIAA&&
      r.ASIALINEMA!=null&&r.ASIAHMAC&&r.ASIAAMAC&&
      r.ASIALINESB!=null&&r.ASIAHSBO&&r.ASIAASBO;
  });
  var same=all3.filter(function(r){return r.ASIALINE===r.ASIALINEMA&&r.ASIALINE===r.ASIALINESB;});
  var diff=all3.filter(function(r){return!(r.ASIALINE===r.ASIALINEMA&&r.ASIALINE===r.ASIALINESB);});

  // Per-book averages and vig
  function bookStats(pool){
    return BOOKS.map(function(b){
      var s=pool.filter(function(r){return r[b.hk]&&r[b.ak];});
      return{key:b.key,label:b.label,color:b.color,n:s.length,
        avgH:avg(s.map(function(r){return r[b.hk];})),
        avgA:avg(s.map(function(r){return r[b.ak];})),
        avgVig:avg(s.map(function(r){return vig(r,b.hk,b.ak);})),
        hroi:roi(s.map(function(r){return pnlH(r,b.lk,b.hk);})),
        aroi:roi(s.map(function(r){return pnlA(r,b.lk,b.ak);})),
      };
    });
  }

  // HKJC odds advantage analysis vs each other book
  // For each threshold band, compute ROI for HKJC and other book on H and A
  function oddsAdvantage(pool, pair, side){
    // side = 'H' or 'A', dk = which odds to diff
    var hk2=pair.hk2, ak2=pair.ak2, lk2=pair.lk2;
    var diffKey = side==='H' ? function(r){return(r.ASIAH-r[hk2])/r[hk2];} : function(r){return(r.ASIAA-r[ak2])/r[ak2];};
    var sub=pool.filter(function(r){return r.ASIAH&&r[hk2]&&r.ASIAA&&r[ak2];});
    return THRESHOLDS.map(function(th){
      var s=sub.filter(function(r){return th.fn(diffKey(r));});
      if(s.length<15) return null;
      var avgD=avg(s.map(function(r){return diffKey(r)*100;}));
      return{label:th.label,color:th.color,n:s.length,avgDiff:avgD,
        hkjcH:roi(s.map(function(r){return pnlH(r,'ASIALINE','ASIAH');})),
        hkjcA:roi(s.map(function(r){return pnlA(r,'ASIALINE','ASIAA');})),
        otherH:roi(s.map(function(r){return pnlH(r,lk2,hk2);})),
        otherA:roi(s.map(function(r){return pnlA(r,lk2,ak2);})),
      };
    }).filter(Boolean);
  }

  // Build full analysis per pair × line scenario × side
  var pairAnalysis=PAIRS.map(function(pair){
    return{oLabel:pair.oLabel,oColor:pair.oColor,
      same:{
        H:oddsAdvantage(same,pair,'H'),
        A:oddsAdvantage(same,pair,'A'),
      },
      diff:{
        H:oddsAdvantage(diff,pair,'H'),
        A:oddsAdvantage(diff,pair,'A'),
      },
    };
  });

  // Best-price ROI
  var bestHRoi=[],hkjcHRoi=[];
  same.forEach(function(r){
    var opts=[r.ASIAH||0,r.ASIAHMAC||0,r.ASIAHSBO||0];
    var lks=['ASIALINE','ASIALINEMA','ASIALINESB'],hks=['ASIAH','ASIAHMAC','ASIAHSBO'];
    var bi=0;opts.forEach(function(v,i){if(v>opts[bi])bi=i;});
    bestHRoi.push(pnlH(r,lks[bi],hks[bi]));
    hkjcHRoi.push(pnlH(r,'ASIALINE','ASIAH'));
  });

  // Monthly vig
  var monthMap={};
  all3.forEach(function(r){
    var ym=(r.DATE||'').slice(0,7); if(!ym)return;
    if(!monthMap[ym])monthMap[ym]={hkjc:[],mac:[],sbo:[]};
    var vh=vig(r,'ASIAH','ASIAA'),vm=vig(r,'ASIAHMAC','ASIAAMAC'),vs=vig(r,'ASIAHSBO','ASIAASBO');
    if(vh)monthMap[ym].hkjc.push(vh);if(vm)monthMap[ym].mac.push(vm);if(vs)monthMap[ym].sbo.push(vs);
  });
  var vigMonths=Object.keys(monthMap).sort().map(function(ym){
    function ma(arr){return arr.length?Math.round(arr.reduce(function(s,x){return s+x;},0)/arr.length*1000)/1000:null;}
    var mv=monthMap[ym];return{ym:ym,hkjc:ma(mv.hkjc),mac:ma(mv.mac),sbo:ma(mv.sbo)};
  });

  return{all3n:all3.length,sameN:same.length,diffN:diff.length,
    sameSummary:bookStats(same),diffSummary:bookStats(diff),
    pairAnalysis:pairAnalysis,
    bestHroi:roi(bestHRoi),hkjcHroi:roi(hkjcHRoi),
    bestHgain:roi(bestHRoi)!==null&&roi(hkjcHRoi)!==null?Math.round((roi(bestHRoi)-roi(hkjcHRoi))*10)/10:null,
    vigMonths:vigMonths};
}

function renderLineOdds(d, od){
  var C={hkjc:'#f87171',mac:'#a78bfa',sbo:'#fb923c'};
  var container=document.getElementById('lineChartsArea');
  var wrap=document.createElement('div');
  wrap.style.cssText='margin-top:20px;border-top:2px solid var(--border);padding-top:14px';

  var html='<div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:4px">📊 Odds Comparison — HKJC vs Macau vs SBO</div>';
  html+='<div style="font-size:11px;color:#64748b;margin-bottom:12px">'
    +'Same-match pool (all 3 books): <b style="color:#e2e8f0">'+od.all3n+'</b> · '
    +'Same line: <b style="color:#e2e8f0">'+od.sameN+'</b> · '
    +'Different line: <b style="color:#e2e8f0">'+od.diffN+'</b></div>';

  // Line shopping callout
  if(od.bestHgain!==null){
    var gc=od.bestHgain>=0?'#4ade80':'#f87171';
    html+='<div style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">'
      +'<div><div style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Line Shopping Edge (same line pool)</div>'
      +'<div style="font-size:22px;font-weight:900;font-family:var(--mono);color:'+gc+'">'+(od.bestHgain>=0?'+':'')+od.bestHgain+'%</div>'
      +'<div style="font-size:10px;color:#64748b">Best H odds across 3 books vs always HKJC</div></div>'
      +'<div style="font-size:11px;color:#94a3b8;flex:1;min-width:180px">'
      +'Best price: <b style="color:#e2e8f0">'+fmtRoi(od.bestHroi)+'</b> · HKJC only: <b style="color:#e2e8f0">'+fmtRoi(od.hkjcHroi)+'</b></div></div>';
  }

  // Book summary tables
  function bookTable(summary, title){
    var t='<div style="font-size:11px;font-weight:700;color:#cbd5e1;margin-bottom:5px">'+title+'</div>'
      +'<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Book</th><th class="num">N</th><th class="num">Avg H</th><th class="num">Avg A</th>'
      +'<th class="num">Vig%</th><th class="num">H ROI%</th><th class="num">A ROI%</th>'
      +'</tr></thead><tbody>';
    summary.forEach(function(b){
      var vc=b.avgVig<4?'#4ade80':b.avgVig<6?'#fbbf24':'#f87171';
      var hc=b.hroi>=0?'#4ade80':'#f87171', ac=b.aroi>=0?'#4ade80':'#f87171';
      t+='<tr><td><b style="color:'+b.color+'">'+b.label+'</b></td>'
        +'<td class="num" style="color:#64748b;font-family:var(--mono)">'+b.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+b.avgH+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+b.avgA+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+vc+'">'+(b.avgVig||0).toFixed(3)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+hc+'">'+fmtRoi(b.hroi)+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+ac+'">'+fmtRoi(b.aroi)+'</td>'
        +'</tr>';
    });
    return t+'</tbody></table></div>';
  }
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div>'+bookTable(od.sameSummary,'Same Line (N='+od.sameN+')')+'</div>'
    +'<div>'+bookTable(od.diffSummary,'Different Line (N='+od.diffN+')')+'</div>'
    +'</div>';

  // Advantage/disadvantage tables
  function advTable(rows, oLabel, oColor, side, lineLabel){
    if(!rows||!rows.length) return '<div style="color:#475569;font-size:10px;font-style:italic">Insufficient data</div>';
    var t='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
      +'<th>HKJC '+side+' vs <span style="color:'+oColor+'">'+oLabel+'</span> '+side+'</th>'
      +'<th class="num">N</th><th class="num">Avg Diff</th>'
      +'<th class="num" style="color:#f87171">HKJC H ROI</th>'
      +'<th class="num" style="color:#f87171">HKJC A ROI</th>'
      +'<th class="num" style="color:'+oColor+'">'+oLabel+' H ROI</th>'
      +'<th class="num" style="color:'+oColor+'">'+oLabel+' A ROI</th>'
      +'</tr></thead><tbody>';
    rows.forEach(function(row){
      var hc=row.hkjcH!==null?(row.hkjcH>=0?'#4ade80':'#f87171'):'#475569';
      var ac=row.hkjcA!==null?(row.hkjcA>=0?'#4ade80':'#f87171'):'#475569';
      var ohc=row.otherH!==null?(row.otherH>=0?'#4ade80':'#f87171'):'#475569';
      var oac=row.otherA!==null?(row.otherA>=0?'#4ade80':'#f87171'):'#475569';
      var dc=row.avgDiff>0?'#4ade80':row.avgDiff<0?'#f87171':'#64748b';
      t+='<tr>'
        +'<td><span style="color:'+row.color+';font-size:10px;font-weight:600">'+row.label+'</span></td>'
        +'<td class="num" style="color:#64748b;font-family:var(--mono)">'+row.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+dc+'">'+(row.avgDiff>=0?'+':'')+row.avgDiff.toFixed(2)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+hc+'">'+(row.hkjcH!==null?fmtRoi(row.hkjcH):'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+ac+'">'+(row.hkjcA!==null?fmtRoi(row.hkjcA):'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+ohc+'">'+(row.otherH!==null?fmtRoi(row.otherH):'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+oac+'">'+(row.otherA!==null?fmtRoi(row.otherA):'—')+'</td>'
        +'</tr>';
    });
    return t+'</tbody></table></div>';
  }

  od.pairAnalysis.forEach(function(pair){
    html+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">';
    html+='<div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:8px">'
      +'🔴 HKJC vs <span style="color:'+pair.oColor+'">'+pair.oLabel+'</span> — Odds Advantage Analysis</div>';

    // 2x2 grid: same/diff line × H/A odds side
    html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    [['Same Line','same'],['Different Line','diff']].forEach(function(sc){
      ['H','A'].forEach(function(side){
        html+='<div>'
          +'<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:5px">'+sc[0]+' · '+side+' Odds Diff</div>'
          +advTable(pair[sc[1]][side],pair.oLabel,pair.oColor,side,sc[0])
          +'</div>';
      });
    });
    html+='</div></div>';
  });

  // Monthly vig
  html+='<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">';
  html+='<div style="font-size:11px;font-weight:700;color:#cbd5e1;margin-bottom:6px">Monthly Avg Vig %</div>'
    +'<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
    +'<th>Month</th><th class="num" style="color:#f87171">HKJC</th>'
    +'<th class="num" style="color:#a78bfa">Macau</th>'
    +'<th class="num" style="color:#fb923c">SBO</th>'
    +'<th>Tightest</th></tr></thead><tbody>';
  od.vigMonths.forEach(function(row){
    var keys=['hkjc','mac','sbo'],Labels={hkjc:'HKJC',mac:'Macau',sbo:'SBO'};
    var valid=keys.filter(function(k){return row[k]!==null;});
    var tk=valid.length?valid.reduce(function(a,b){return row[a]<row[b]?a:b;}):null;
    function vc(v,k){return v===null?'<td class="num" style="color:#475569">—</td>'
      :'<td class="num" style="font-family:var(--mono);color:'+(v<4?'#4ade80':v<6?'#fbbf24':'#f87171')+';'+(k===tk?'font-weight:800':'')+'">'+v.toFixed(3)+'%</td>';}
    html+='<tr><td style="font-family:var(--mono);font-size:11px">'+row.ym+'</td>'
      +vc(row.hkjc,'hkjc')+vc(row.mac,'mac')+vc(row.sbo,'sbo')
      +'<td>'+(tk?'<span style="color:'+C[tk]+';font-weight:700">'+Labels[tk]+'</span>':'—')+'</td></tr>';
  });
  html+='</tbody></table></div></div>';

  html+='<div style="margin-top:10px;font-size:10px;color:#475569;padding:8px 12px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">'
    +'<b style="color:#94a3b8">📖 Avg Diff</b> = (HKJC odds − Other odds) / Other odds × 100%. '
    +'Positive = HKJC offers higher odds on that side. '
    +'Each row shows ROI for <b style="color:#f87171">HKJC</b> and the comparison book using their own respective lines and odds, on the same filtered match pool.'
    +'</div>';

  wrap.innerHTML=html;
  container.parentElement.appendChild(wrap);
}
