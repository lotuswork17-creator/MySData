// ── report-bookcompare.js — HKJC vs Macau vs SBO odds comparison ──
// HKJC is the default betting company. Studies whether comparing HKJC's prices against
// Macau (MAC) and SBO reveals an edge — at OPENING odds and at LATEST odds separately.
// Primary measure: MARKET LEAN (margin-neutral implied home prob). Also studies the
// ACTUAL ODDS preference (does HKJC offering the best price on a side predict the result?).
// Condition: Macau AND SBO odds must be non-null, and the three handicap lines must match.

function bcLean(h,a){ if(!h||!a||h<=0||a<=0) return null; return (1/h)/((1/h)+(1/a)); }
function bcNz(r,k){ var v=r[k]; return v!=null && v!==0; }
function bcLineMatch(r){ return r.ASIALINE===r.ASIALINEMA && r.ASIALINE===r.ASIALINESB; }
function bcAdjM(r,line){ return (r.RESULTH-r.RESULTA)+parseFloat(line); }
function bcPnl(r,bet,line,oh,oa){
  var m=bcAdjM(r,line);
  if(bet==='H') return m>0.25?oh-1:m===0.25?(oh-1)/2:m===0?0:m===-0.25?-0.5:-1;
  return m<-0.25?oa-1:m===-0.25?(oa-1)/2:m===0?0:m===0.25?-0.5:-1;
}
function bcHCover(r,line){ var m=bcAdjM(r,line); return m>0?1:m===0?0.5:0; }

// Field sets for each phase
var BC_PHASES={
  latest:  { oh:'ASIAH',   oa:'ASIAA',   mh:'ASIAHMAC',   ma:'ASIAAMAC',   sh:'ASIAHSBO',   sa:'ASIAASBO'   },
  opening: { oh:'ASIAHLN', oa:'ASIAALN', mh:'ASIAHMACLN', ma:'ASIAAMACLN', sh:'ASIAHSBOLN', sa:'ASIAASBOLN' }
};

function computeBookCompare(allRecords){
  var data=allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });

  function eligible(r, F, mode){
    if(!bcNz(r,F.oh)||!bcNz(r,F.oa)) return false;
    if(mode==='macau'){
      return bcNz(r,F.mh)&&bcNz(r,F.ma)&&(r.ASIALINE===r.ASIALINEMA);
    }
    // consensus: need both Macau & SBO and all three lines equal
    return bcNz(r,F.mh)&&bcNz(r,F.ma)&&bcNz(r,F.sh)&&bcNz(r,F.sa)&&bcLineMatch(r);
  }
  // Benchmark home lean for a record under a mode
  function benchLean(r, F, mode){
    var lm=bcLean(r[F.mh],r[F.ma]);
    if(mode==='macau') return lm;
    var ls=bcLean(r[F.sh],r[F.sa]);
    if(lm==null||ls==null) return null;
    return (lm+ls)/2;
  }

  // diff bucket: HKJC home lean − consensus(Mac,SBO) home lean, in pp
  var DIFF_LABELS=['HKJC home ≪ cons (≤−2pp)','−2 to −1pp','−1 to −0.3pp','≈ equal (±0.3pp)','+0.3 to +1pp','+1 to +2pp','HKJC home ≫ cons (≥+2pp)'];
  function diffBucket(pp){
    if(pp<=-2) return 0;
    if(pp<=-1) return 1;
    if(pp<-0.3) return 2;
    if(pp<0.3) return 3;
    if(pp<1) return 4;
    if(pp<2) return 5;
    return 6;
  }

  function leanStudy(F, mode){
    var rows=DIFF_LABELS.map(function(){ return {betH:0,betA:0,hc:0,n:0}; });
    var elig=0;
    data.forEach(function(r){
      if(!eligible(r,F,mode)) return;
      var lh=bcLean(r[F.oh],r[F.oa]), bl=benchLean(r,F,mode);
      if(lh==null||bl==null) return;
      elig++;
      var pp=(lh-bl)*100;
      var b=diffBucket(pp), o=rows[b];
      o.betH+=bcPnl(r,'H',r.ASIALINE,r[F.oh],r[F.oa]);
      o.betA+=bcPnl(r,'A',r.ASIALINE,r[F.oh],r[F.oa]);
      o.hc+=bcHCover(r,r.ASIALINE); o.n++;
    });
    return { elig:elig, rows:DIFF_LABELS.map(function(lab,i){
      var o=rows[i];
      return { label:lab, n:o.n,
        betH:o.n?Math.round(o.betH/o.n*1000)/10:null,
        betA:o.n?Math.round(o.betA/o.n*1000)/10:null,
        hcover:o.n?Math.round(o.hc/o.n*100):null };
    }) };
  }

  // Actual odds preference: HKJC offers the (strictly) best price on a side → bet that side
  function priceStudy(F, mode){
    // each condition tracks BOTH bet-H and bet-A pnl. In 'macau' mode compare HKJC vs Macau only.
    var hBest={h:0,a:0,n:0}, aBest={h:0,a:0,n:0}, hOnly={h:0,a:0,n:0}, aOnly={h:0,a:0,n:0};
    data.forEach(function(r){
      if(!eligible(r,F,mode)) return;
      var ph=bcPnl(r,'H',r.ASIALINE,r[F.oh],r[F.oa]);
      var pa=bcPnl(r,'A',r.ASIALINE,r[F.oh],r[F.oa]);
      var hb,ab,hs,as2;
      if(mode==='macau'){
        hb=r[F.oh]>=r[F.mh]; ab=r[F.oa]>=r[F.ma];
        hs=r[F.oh]>r[F.mh];  as2=r[F.oa]>r[F.ma];
      } else {
        hb=r[F.oh]>=r[F.mh]&&r[F.oh]>=r[F.sh]; ab=r[F.oa]>=r[F.ma]&&r[F.oa]>=r[F.sa];
        hs=r[F.oh]>r[F.mh]&&r[F.oh]>r[F.sh];   as2=r[F.oa]>r[F.ma]&&r[F.oa]>r[F.sa];
      }
      if(hb){ hBest.h+=ph; hBest.a+=pa; hBest.n++; }
      if(ab){ aBest.h+=ph; aBest.a+=pa; aBest.n++; }
      if(hs&&!as2){ hOnly.h+=ph; hOnly.a+=pa; hOnly.n++; }
      if(as2&&!hs){ aOnly.h+=ph; aOnly.a+=pa; aOnly.n++; }
    });
    function fin(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null}; }
    return { hBest:fin(hBest), aBest:fin(aBest), hOnly:fin(hOnly), aOnly:fin(aOnly) };
  }

  return {
    total:data.length,
    latestLean: leanStudy(BC_PHASES.latest,'consensus'),
    openingLean: leanStudy(BC_PHASES.opening,'consensus'),
    latestPrice: priceStudy(BC_PHASES.latest,'consensus'),
    openingPrice: priceStudy(BC_PHASES.opening,'consensus'),
    latestLeanM: leanStudy(BC_PHASES.latest,'macau'),
    openingLeanM: leanStudy(BC_PHASES.opening,'macau'),
    latestPriceM: priceStudy(BC_PHASES.latest,'macau'),
    openingPriceM: priceStudy(BC_PHASES.opening,'macau')
  };
}

function renderBookCompare(RD){
  var el=document.getElementById('tab16'); if(!el) return;
  var bc=RD.bookcompare||(RD.bookcompare=computeBookCompare(RD.records||RD.results||[]));
  var h='';
  function roiC(v){ return v==null?'#475569':v>=0?'#4ade80':'#f87171'; }
  function fmtR(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }

  h+='<div class="rpt-title">🏦 HKJC vs Macau vs SBO — Odds Comparison</div>';
  h+='<div class="rpt-sub">You bet at <b>HKJC</b>. This studies whether comparing HKJC\'s prices against Macau and SBO predicts the result — at <b>opening</b> and <b>latest</b> odds. Primary measure is <b>market lean</b> (margin-neutral implied home prob); the actual-odds preference is studied separately. Condition: Macau &amp; SBO odds non-null and all three handicap lines equal. ROI computed at HKJC odds.</div>';

  function leanTable(title, sub, study, benchName){
    var t='<div style="margin-bottom:18px">';
    t+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">'+title+'</div>';
    t+='<div class="rpt-sub" style="margin-bottom:6px">'+sub+' <span style="color:#64748b">Eligible matches: '+study.elig+'.</span></div>';
    t+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
      +'<th>HKJC home lean vs '+benchName+'</th><th class="num">N</th>'
      +'<th class="num" style="color:#f87171">Bet H ROI</th><th class="num" style="color:#60a5fa">Bet A ROI</th>'
      +'<th class="num">H-Cover%</th><th>Read</th></tr></thead><tbody>';
    study.rows.forEach(function(row){
      if(row.n<30) return;
      // value read: negative diff (HKJC home cheap) favors H, positive favors A
      var read='';
      if(row.betH!=null&&row.betA!=null){
        if(row.betH>row.betA+2) read='<span style="color:#f87171">home value</span>';
        else if(row.betA>row.betH+2) read='<span style="color:#60a5fa">away value</span>';
        else read='<span style="color:#475569">no edge</span>';
      }
      t+='<tr><td style="color:#e2e8f0">'+row.label+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+row.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(row.betH)+'">'+fmtR(row.betH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(row.betA)+'">'+fmtR(row.betA)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(row.hcover==null?'—':row.hcover+'%')+'</td>'
        +'<td style="font-size:10px">'+read+'</td></tr>';
    });
    t+='</tbody></table></div></div>';
    return t;
  }

  h+=leanTable('① Opening Odds — HKJC lean vs Macau+SBO consensus',
    'Comparing the opening prices. When HKJC rates home <b>lower</b> than the Macau+SBO consensus (HKJC home odds are longer), home is relatively cheap at HKJC.',
    bc.openingLean, 'Macau+SBO consensus');
  h+=leanTable('② Latest Odds — HKJC lean vs Macau+SBO consensus',
    'Comparing the latest prices. By kickoff the books have usually converged, so the discrepancy edge is typically smaller.',
    bc.latestLean, 'Macau+SBO consensus');

  // Actual odds preference
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">③ Actual Odds Preference — does HKJC\'s best price predict?</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">When HKJC offers the best price on a side vs both Macau &amp; SBO, does betting that side at HKJC pay off?</div>';
  function priceRows(label, st){
    function row(lab2, o, fav){
      if(!o||o.n<30) return '';
      // highlight the side that the condition favours (price-best side)
      var hStyle=fav==='H'?'font-weight:700':'';
      var aStyle=fav==='A'?'font-weight:700':'';
      return '<tr><td style="color:#e2e8f0">'+lab2+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);'+hStyle+';color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);'+aStyle+';color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td></tr>';
    }
    var t='';
    t+=row(label+': HKJC home ≥ both', st.hBest, 'H');
    t+=row(label+': HKJC home strictly best', st.hOnly, 'H');
    t+=row(label+': HKJC away ≥ both', st.aBest, 'A');
    t+=row(label+': HKJC away strictly best', st.aOnly, 'A');
    return t;
  }
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th></tr></thead><tbody>';
  h+=priceRows('Opening', bc.openingPrice);
  h+=priceRows('Latest', bc.latestPrice);
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px;margin-bottom:8px">Bold = the side HKJC prices best (the condition\'s side). Showing both sides lets you check whether the price-best side actually outperforms the other.</div></div>';

  // ═══ MACAU-ONLY COMPARISON ═══
  h+='<div style="border-top:2px solid var(--border);margin:22px 0 14px"></div>';
  h+='<div class="rpt-title" style="font-size:15px;color:#fbbf24">🀄 Macau as the Main Comparison</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">Same idea, but benchmarking HKJC against <b>Macau alone</b> (not the Macau+SBO consensus). You still bet at HKJC. Condition here: Macau odds non-null and HKJC line = Macau line (SBO not required), which gives a larger sample.</div>';

  h+=leanTable('④ Opening Odds — HKJC lean vs Macau',
    'When HKJC rates home <b>lower</b> than Macau (HKJC home odds longer), home is relatively cheap at HKJC; when HKJC rates home <b>higher</b> than Macau, away is the value side.',
    bc.openingLeanM, 'Macau');
  h+=leanTable('⑤ Latest Odds — HKJC lean vs Macau',
    'Latest prices benchmarked against Macau alone.',
    bc.latestLeanM, 'Macau');

  // Macau price preference
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">⑥ Actual Odds Preference vs Macau</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">When HKJC offers a better price than Macau on a side, does betting that side at HKJC pay off? Both sides shown; bold = the side HKJC prices better.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th></tr></thead><tbody>';
  function priceRowsM(label, st){
    function row(lab2, o, fav){
      if(!o||o.n<30) return '';
      var hStyle=fav==='H'?'font-weight:700':'', aStyle=fav==='A'?'font-weight:700':'';
      return '<tr><td style="color:#e2e8f0">'+lab2+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);'+hStyle+';color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);'+aStyle+';color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td></tr>';
    }
    var t='';
    t+=row(label+': HKJC home ≥ Macau', st.hBest, 'H');
    t+=row(label+': HKJC home > Macau (strict)', st.hOnly, 'H');
    t+=row(label+': HKJC away ≥ Macau', st.aBest, 'A');
    t+=row(label+': HKJC away > Macau (strict)', st.aOnly, 'A');
    return t;
  }
  h+=priceRowsM('Opening', bc.openingPriceM);
  h+=priceRowsM('Latest', bc.latestPriceM);
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px">Bold = the side HKJC prices better than Macau. Strict = HKJC price strictly higher than Macau on that side.</div></div>';

  h+='<div style="font-size:9px;color:#475569;margin-top:4px">Market lean = (1/oddsH)/((1/oddsH)+(1/oddsA)), margin-neutral. Consensus = average of Macau &amp; SBO lean; the Macau section benchmarks against Macau alone. All ROI at HKJC odds, settling on the HKJC handicap line. Rows need n≥30.</div>';

  el.innerHTML=h;
}
