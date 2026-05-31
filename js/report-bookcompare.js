// Toggle helper for the mutex-row lean sub-rows in Book Compare
window.pmxToggle = function(id){
  var row = document.getElementById(id);
  if(!row) return;
  var ind = document.getElementById(id+'_ind');
  if(row.style.display==='none'){ row.style.display=''; if(ind) ind.textContent='▼'; }
  else { row.style.display='none'; if(ind) ind.textContent='▶'; }
};

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
    // both modes need Macau & SBO present and all three lines equal
    return bcNz(r,F.mh)&&bcNz(r,F.ma)&&bcNz(r,F.sh)&&bcNz(r,F.sa)&&bcLineMatch(r);
  }
  // The 'subject' lean (whose deviation we bucket) and the 'benchmark' lean it's measured against.
  // consensus mode: subject = HKJC, benchmark = avg(Macau, SBO)
  // macau mode:     subject = Macau, benchmark = avg(HKJC, SBO)  ← Macau vs the rest of the field
  function subjectLean(r, F, mode){
    if(mode==='macau') return bcLean(r[F.mh],r[F.ma]);
    if(mode==='sbo')   return bcLean(r[F.sh],r[F.sa]);
    return bcLean(r[F.oh],r[F.oa]); // consensus mode: subject = HKJC
  }
  function benchLean(r, F, mode){
    var lh=bcLean(r[F.oh],r[F.oa]), lm=bcLean(r[F.mh],r[F.ma]), ls=bcLean(r[F.sh],r[F.sa]);
    var a,b;
    if(mode==='macau'){ a=lh; b=ls; }       // Macau vs (HKJC+SBO)
    else if(mode==='sbo'){ a=lh; b=lm; }     // SBO vs (HKJC+Macau)
    else { a=lm; b=ls; }                     // HKJC vs (Macau+SBO)
    if(a==null||b==null) return null;
    return (a+b)/2;
  }

  // diff bucket: HKJC home lean − consensus(Mac,SBO) home lean, in pp
  function diffLabels(subj){
    return [subj+' lean ≥2pp below field','1–2pp below field','0.3–1pp below field','within ±0.3pp of field','0.3–1pp above field','1–2pp above field',subj+' lean ≥2pp above field'];
  }
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
    var SUBJ=mode==='macau'?'Macau':mode==='sbo'?'SBO':'HKJC';
    var LABELS=diffLabels(SUBJ);
    var rows=LABELS.map(function(){ return {betH:0,betA:0,hc:0,n:0}; });
    var elig=0;
    data.forEach(function(r){
      if(!eligible(r,F,mode)) return;
      var sl=subjectLean(r,F,mode), bl=benchLean(r,F,mode);
      if(sl==null||bl==null) return;
      elig++;
      var pp=(sl-bl)*100;
      var b=diffBucket(pp), o=rows[b];
      o.betH+=bcPnl(r,'H',r.ASIALINE,r[F.oh],r[F.oa]);
      o.betA+=bcPnl(r,'A',r.ASIALINE,r[F.oh],r[F.oa]);
      o.hc+=bcHCover(r,r.ASIALINE); o.n++;
    });
    return { elig:elig, subj:SUBJ, rows:LABELS.map(function(lab,i){
      var o=rows[i];
      return { label:lab, n:o.n,
        betH:o.n?Math.round(o.betH/o.n*1000)/10:null,
        betA:o.n?Math.round(o.betA/o.n*1000)/10:null,
        hcover:o.n?Math.round(o.hc/o.n*100):null };
    }) };
  }

  // Actual odds preference: HKJC offers the (strictly) best price on a side → bet that side
  function priceStudy(F, mode){
    // Mutually exclusive categories based on HKJC's actual odds vs the comparison book(s) on BOTH sides:
    //   tiltH: HKJC strictly better on home, strictly worse on away (HKJC tilts to home value)
    //   tiltA: HKJC strictly worse on home, strictly better on away (HKJC tilts to away value)
    //   bothBetter: HKJC strictly better on both (HKJC has lower margin → cheaper across the board)
    //   bothWorse:  HKJC strictly worse on both (higher margin)
    //   mixed: any tie on either side, or partial mix
    var tiltH={h:0,a:0,n:0}, tiltA={h:0,a:0,n:0}, bothBetter={h:0,a:0,n:0}, bothWorse={h:0,a:0,n:0}, mixed={h:0,a:0,n:0};
    data.forEach(function(r){
      // Per-mode eligibility: only require the books actually being compared.
      // Macau mode → only Macau needed; SBO mode → only SBO needed; consensus → all three.
      if(!bcNz(r,F.oh)||!bcNz(r,F.oa)) return;
      if(mode==='macau'){
        if(!bcNz(r,F.mh)||!bcNz(r,F.ma)||r.ASIALINE!==r.ASIALINEMA) return;
      } else if(mode==='sbo'){
        if(!bcNz(r,F.sh)||!bcNz(r,F.sa)||r.ASIALINE!==r.ASIALINESB) return;
      } else {
        if(!bcNz(r,F.mh)||!bcNz(r,F.ma)||!bcNz(r,F.sh)||!bcNz(r,F.sa)||!bcLineMatch(r)) return;
      }
      var ph=bcPnl(r,'H',r.ASIALINE,r[F.oh],r[F.oa]);
      var pa=bcPnl(r,'A',r.ASIALINE,r[F.oh],r[F.oa]);
      var hBetter, hWorse, aBetter, aWorse;
      if(mode==='macau'){
        hBetter=r[F.oh]>r[F.mh]; hWorse=r[F.oh]<r[F.mh];
        aBetter=r[F.oa]>r[F.ma]; aWorse=r[F.oa]<r[F.ma];
      } else if(mode==='sbo'){
        hBetter=r[F.oh]>r[F.sh]; hWorse=r[F.oh]<r[F.sh];
        aBetter=r[F.oa]>r[F.sa]; aWorse=r[F.oa]<r[F.sa];
      } else {
        // consensus: 'better' means strictly higher than BOTH other books
        hBetter=r[F.oh]>r[F.mh]&&r[F.oh]>r[F.sh]; hWorse=r[F.oh]<r[F.mh]&&r[F.oh]<r[F.sh];
        aBetter=r[F.oa]>r[F.ma]&&r[F.oa]>r[F.sa]; aWorse=r[F.oa]<r[F.ma]&&r[F.oa]<r[F.sa];
      }
      var bin;
      if     (hBetter && aWorse)  bin=tiltH;
      else if(hWorse  && aBetter) bin=tiltA;
      else if(hBetter && aBetter) bin=bothBetter;
      else if(hWorse  && aWorse)  bin=bothWorse;
      else                        bin=mixed;
      bin.h+=ph; bin.a+=pa; bin.n++;
      // also bucket by HKJC market lean for the expandable sub-rows
      var lean=bcLean(r[F.oh],r[F.oa]);
      if(lean!=null){
        var li = lean<0.45?0 : lean<0.48?1 : lean<0.52?2 : lean<0.55?3 : 4;
        if(!bin.lean) bin.lean=[{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0}];
        bin.lean[li].h+=ph; bin.lean[li].a+=pa; bin.lean[li].n++;
      }
    });
    function finL(arr){
      if(!arr) return null;
      return arr.map(function(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null}; });
    }
    function fin(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null, lean:finL(o.lean)}; }
    return { tiltH:fin(tiltH), tiltA:fin(tiltA), bothBetter:fin(bothBetter), bothWorse:fin(bothWorse), mixed:fin(mixed) };
  }

  // SBO price-position study: is SBO offering the highest odds on a side, or not?
  // "Not highest" = SBO prices that side shorter than at least one other book → SBO favors it.
  function sboPosition(F){
    function mk(){ return {h:0,a:0,n:0,hc:0}; }
    var homeNotHi=mk(), awayNotHi=mk(), homeHi=mk(), awayHi=mk();
    data.forEach(function(r){
      if(!eligible(r,F,'sbo')) return;
      var ph=bcPnl(r,'H',r.ASIALINE,r[F.oh],r[F.oa]);
      var pa=bcPnl(r,'A',r.ASIALINE,r[F.oh],r[F.oa]);
      var hc=bcHCover(r,r.ASIALINE);
      var hHighest = r[F.sh]>=Math.max(r[F.oh],r[F.mh]);
      var aHighest = r[F.sa]>=Math.max(r[F.oa],r[F.ma]);
      var t = hHighest?homeHi:homeNotHi; t.h+=ph; t.a+=pa; t.hc+=hc; t.n++;
      var t2 = aHighest?awayHi:awayNotHi; t2.h+=ph; t2.a+=pa; t2.hc+=hc; t2.n++;
    });
    function fin(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null, hcover:o.n?Math.round(o.hc/o.n*100):null}; }
    return { homeNotHi:fin(homeNotHi), awayNotHi:fin(awayNotHi), homeHi:fin(homeHi), awayHi:fin(awayHi) };
  }

  // "Book offers the lowest odds on a side" = shortest price = that book most confident in the side.
  // book: 'macau' (compare vs HKJC & SBO) or 'sbo' (compare vs HKJC & Macau). ROI at HKJC odds.
  function lowestStudy(book){
    function mk(){ return {h:0,a:0,n:0,hc:0}; }
    var homeLow=mk(), awayLow=mk();
    data.forEach(function(r){
      if(!eligible(r, BC_PHASES.latest, book)) return;
      var bh = book==='macau'? r.ASIAHMAC : r.ASIAHSBO;
      var ba = book==='macau'? r.ASIAAMAC : r.ASIAASBO;
      var o1h = r.ASIAH, o2h = book==='macau'? r.ASIAHSBO : r.ASIAHMAC; // the other two books' home
      var o1a = r.ASIAA, o2a = book==='macau'? r.ASIAASBO : r.ASIAAMAC; // the other two books' away
      var ph=bcPnl(r,'H',r.ASIALINE,r.ASIAH,r.ASIAA);
      var pa=bcPnl(r,'A',r.ASIALINE,r.ASIAH,r.ASIAA);
      var hc=bcHCover(r,r.ASIALINE);
      // home lowest: book home <= both others & strictly < at least one
      if(bh<=o1h && bh<=o2h && (bh<o1h || bh<o2h)){ homeLow.h+=ph; homeLow.a+=pa; homeLow.hc+=hc; homeLow.n++; }
      if(ba<=o1a && ba<=o2a && (ba<o1a || ba<o2a)){ awayLow.h+=ph; awayLow.a+=pa; awayLow.hc+=hc; awayLow.n++; }
    });
    function fin(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null, hcover:o.n?Math.round(o.hc/o.n*100):null}; }
    return { homeLow:fin(homeLow), awayLow:fin(awayLow) };
  }

  // ⑩ Macau vs SBO opposite-direction comparison (bet at HKJC).
  // C1: Macau h > SBO h AND Macau a < SBO a (Macau leans Away, SBO leans Home)
  // C2: Macau h < SBO h AND Macau a > SBO a (Macau leans Home, SBO leans Away)
  // Eligibility: same as other tables (all 3 books non-null, all 3 lines equal).
  function macauVsSbo(){
    function mk(){ return {h:0,a:0,n:0,hc:0,lean:[{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0},{h:0,a:0,n:0}]}; }
    var c1=mk(), c2=mk();
    data.forEach(function(r){
      if(!eligible(r, BC_PHASES.latest, 'consensus')) return;
      var ph=bcPnl(r,'H',r.ASIALINE,r.ASIAH,r.ASIAA);
      var pa=bcPnl(r,'A',r.ASIALINE,r.ASIAH,r.ASIAA);
      var hc=bcHCover(r,r.ASIALINE);
      var mh=r.ASIAHMAC, ma=r.ASIAAMAC, sh=r.ASIAHSBO, sa=r.ASIAASBO;
      var bin=null;
      if(mh>sh && ma<sa) bin=c1;
      else if(mh<sh && ma>sa) bin=c2;
      if(!bin) return;
      bin.h+=ph; bin.a+=pa; bin.hc+=hc; bin.n++;
      var lean=bcLean(r.ASIAH,r.ASIAA);
      if(lean!=null){
        var li = lean<0.45?0 : lean<0.48?1 : lean<0.52?2 : lean<0.55?3 : 4;
        bin.lean[li].h+=ph; bin.lean[li].a+=pa; bin.lean[li].n++;
      }
    });
    function finL(arr){ return arr.map(function(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null}; }); }
    function fin(o){ return {n:o.n, roiH:o.n?Math.round(o.h/o.n*1000)/10:null, roiA:o.n?Math.round(o.a/o.n*1000)/10:null, hcover:o.n?Math.round(o.hc/o.n*100):null, lean:finL(o.lean)}; }
    return { c1:fin(c1), c2:fin(c2) };
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
    openingPriceM: priceStudy(BC_PHASES.opening,'macau'),
    latestLeanS: leanStudy(BC_PHASES.latest,'sbo'),
    latestPriceS: priceStudy(BC_PHASES.latest,'sbo'),
    sboPos: sboPosition(BC_PHASES.latest),
    macauLowest: lowestStudy('macau'),
    sboLowest: lowestStudy('sbo'),
    macSbo: macauVsSbo()
  };
}

function renderBookCompare(RD){
  var el=document.getElementById('tab16'); if(!el) return;
  var bc=RD.bookcompare||(RD.bookcompare=computeBookCompare(RD.records||RD.results||[]));
  var h='';
  function roiC(v){ return v==null?'#475569':v>=0?'#4ade80':'#f87171'; }
  function fmtR(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }

  h+='<div class="rpt-title">🏦 HKJC vs Macau vs SBO — Odds Comparison</div>';
  h+='<div class="rpt-sub">You bet at <b>HKJC</b>. This studies whether comparing HKJC\'s <b>latest</b> prices against Macau and SBO predicts the result. (Opening odds are excluded because the three books capture their opening lines at different times, so they aren\'t comparable.) Primary measure is <b>market lean</b> = a book\'s margin-neutral implied probability that home covers, computed from its two odds. A <b>lower</b> lean means longer (higher) home odds. "Below/above field" compares a book\'s home lean to the average of the other books. Condition: Macau &amp; SBO odds non-null and all three handicap lines equal. ROI computed at HKJC odds.</div>';

  function leanTable(title, sub, study, benchName){
    var t='<div style="margin-bottom:18px">';
    t+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">'+title+'</div>';
    t+='<div class="rpt-sub" style="margin-bottom:6px">'+sub+' <span style="color:#64748b">Eligible matches: '+study.elig+'.</span></div>';
    t+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
      +'<th>'+benchName+'</th><th class="num">N</th>'
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

  var LEAN_LABELS_BC=['HKJC lean <45% (away fav.)','45–48%','48–52% (close to even)','52–55%','HKJC lean ≥55% (home fav.)'];
  var pmxRowCounter=0;
  function priceMutexRows(st, vsLabel){
    // Five mutually exclusive parent rows, each expandable to show HKJC-lean breakdown.
    function leanSubRows(arr){
      if(!arr) return '';
      var s='';
      for(var i=0;i<arr.length;i++){
        var o=arr[i];
        if(!o||o.n<10) continue;
        s+='<tr style="background:rgba(15,23,42,0.4)">'
          +'<td style="padding-left:24px;color:#94a3b8;font-size:9px">↳ '+LEAN_LABELS_BC[i]+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#64748b;font-size:9px">'+o.n+'</td>'
          +'<td class="num" style="font-family:var(--mono);font-size:9px;color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
          +'<td class="num" style="font-family:var(--mono);font-size:9px;color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
          +'<td style="color:#475569;font-size:9px"></td></tr>';
      }
      if(!s) s='<tr style="background:rgba(15,23,42,0.4)"><td colspan="5" style="padding-left:24px;color:#64748b;font-size:9px">(no lean sub-bucket has n≥10)</td></tr>';
      return s;
    }
    function row(lab, o, hint){
      if(!o||o.n<30) return '';
      pmxRowCounter++;
      var rid='pmxr_'+pmxRowCounter;
      return '<tr style="cursor:pointer" onclick="pmxToggle(\''+rid+'\')">'
        +'<td style="color:#e2e8f0"><span id="'+rid+'_ind" style="display:inline-block;width:10px;color:#64748b">▶</span> '+lab+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
        +'<td style="color:#475569;font-size:9px">'+hint+'</td></tr>'
        +'<tr id="'+rid+'" style="display:none"><td colspan="5" style="padding:0">'
        +'<table style="width:100%;border-collapse:collapse"><tbody>'+leanSubRows(o.lean)+'</tbody></table>'
        +'</td></tr>';
    }
    var t='';
    t+=row('HKJC home > '+vsLabel+' AND HKJC away < '+vsLabel, st.tiltH, 'HKJC tilts to home (relative home value)');
    t+=row('HKJC home < '+vsLabel+' AND HKJC away > '+vsLabel, st.tiltA, 'HKJC tilts to away (relative away value)');
    t+=row('HKJC home > '+vsLabel+' AND HKJC away > '+vsLabel, st.bothBetter, 'HKJC better both (lower margin)');
    t+=row('HKJC home < '+vsLabel+' AND HKJC away < '+vsLabel, st.bothWorse, 'HKJC worse both (higher margin)');
    t+=row('Mixed / ties', st.mixed, 'any side equal, or partial mix');
    return t;
  }

    function lowestTable(title, sub, study, book){
    var t='<div style="margin-bottom:18px">';
    t+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">'+title+'</div>';
    t+='<div class="rpt-sub" style="margin-bottom:6px">'+sub+'</div>';
    t+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
      +'<th>Condition</th><th class="num">N</th>'
      +'<th class="num" style="color:#f87171">Bet H ROI</th>'
      +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
      +'<th class="num">H-Cover%</th></tr></thead><tbody>';
    function row(lab,o){
      if(!o||o.n<30) return '';
      return '<tr><td style="color:#e2e8f0">'+lab+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(o.hcover==null?'—':o.hcover+'%')+'</td></tr>';
    }
    t+=row(book+' home lowest (most confident home)', study.homeLow);
    t+=row(book+' away lowest (most confident away)', study.awayLow);
    t+='</tbody></table></div>';
    t+='<div style="font-size:9px;color:#475569;margin-top:3px">"'+book+' home lowest" = '+book+' offers the shortest home price of the three books (so '+book+' is most confident home). Both bet sides shown; ROI at HKJC odds. Rows need n≥30.</div></div>';
    return t;
  }

  h+=leanTable('① HKJC lean vs Macau+SBO consensus (latest odds)',
    'Latest prices. When HKJC rates home <b>lower</b> than the Macau+SBO consensus (HKJC home odds longer), home is relatively cheap at HKJC; when higher, away is the value side.',
    bc.latestLean, 'HKJC home lean vs field (Macau+SBO)');

  // Actual odds preference
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">② Actual Odds Preference — does HKJC\'s best price predict? (latest odds)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">When HKJC offers the best price on a side vs both Macau &amp; SBO, does betting that side at HKJC pay off?</div>';

  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition (mutually exclusive)</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th>Interpretation</th></tr></thead><tbody>';
  h+=priceMutexRows(bc.latestPrice, 'both');
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px;margin-bottom:8px">Rows partition the data — every match falls into exactly one bucket. "HKJC home > both" means HKJC home odds strictly higher than BOTH Macau and SBO. "Mixed / ties" captures any case with a tie or partial agreement.</div></div>';

  // ═══ MACAU-ONLY COMPARISON ═══
  h+='<div style="border-top:2px solid var(--border);margin:22px 0 14px"></div>';
  h+='<div class="rpt-title" style="font-size:15px;color:#fbbf24">🀄 Macau as the Main Comparison</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">Here <b>Macau</b> is the subject: each bucket measures how Macau prices home relative to the field consensus (HKJC + SBO). The idea is to treat Macau as the lead/sharp book and see whether its deviation from the field predicts the result. You still bet at HKJC (ROI at HKJC odds). Condition: all three books non-null and lines equal. Latest odds only.</div>';

  h+=leanTable('③ Macau lean vs field consensus (latest odds)',
    'Buckets by Macau\'s <b>market lean</b> on home minus the field\'s (HKJC+SBO average). "Macau lean below field" = Macau gives home a lower win chance than the others (so Macau\'s home odds are longer). Treats Macau as the lead book; you still bet at HKJC, ROI at HKJC odds.',
    bc.latestLeanM, 'Macau home lean vs field (HKJC+SBO)');

  // Macau price preference
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">④ Actual Odds Preference vs Macau (latest odds)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">When HKJC offers a better price than Macau on a side, does betting that side at HKJC pay off? Both sides shown; bold = the side HKJC prices better.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition (mutually exclusive)</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th>Interpretation</th></tr></thead><tbody>';
  h+=priceMutexRows(bc.latestPriceM, 'Macau');
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px">Rows partition the data — every match falls into exactly one bucket. "Mixed / ties" captures any record with a tie on either side or a partial mix.</div></div>';

  h+=lowestTable('⑤ Macau Lowest Odds — when Macau is most confident',
    'When Macau offers the shortest price on a side (lowest odds of the three), does that side cover? Tests whether following Macau\'s confidence pays.',
    bc.macauLowest, 'Macau');

  // ═══ SBO-ONLY COMPARISON ═══
  h+='<div style="border-top:2px solid var(--border);margin:22px 0 14px"></div>';
  h+='<div class="rpt-title" style="font-size:15px;color:#34d399">📊 SBO as the Main Comparison</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">Here <b>SBO</b> is the subject: each bucket measures how SBO prices home relative to the field consensus (HKJC + Macau). Treats SBO as the lead/sharp book and tests whether its deviation from the field predicts the result. You still bet at HKJC (ROI at HKJC odds). Condition: all three books non-null and lines equal. Latest odds only.</div>';

  h+=leanTable('⑥ SBO lean vs field consensus (latest odds)',
    'Buckets by SBO\'s <b>market lean</b> on home minus the field\'s (HKJC+Macau average). "SBO lean below field" = SBO gives home a lower win chance than the others (so SBO\'s home odds are longer). You still bet at HKJC, ROI at HKJC odds.',
    bc.latestLeanS, 'SBO home lean vs field (HKJC+Macau)');

  // SBO price preference
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">⑦ Actual Odds Preference vs SBO (latest odds)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">When HKJC offers a better price than SBO on a side, does betting that side at HKJC pay off? Both sides shown; bold = the side HKJC prices better.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition (mutually exclusive)</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th>Interpretation</th></tr></thead><tbody>';
  h+=priceMutexRows(bc.latestPriceS, 'SBO');
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px">Rows partition the data — every match falls into exactly one bucket. "Mixed / ties" captures any record with a tie on either side or a partial mix.</div></div>';

  // ⑦ SBO price-position table
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">⑧ SBO Price Position — when SBO is NOT the highest odds</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">"SBO home not highest" = SBO prices home shorter than at least one other book (HKJC/Macau), i.e. SBO favours home on that side. Does the side SBO favours then cover? Both bet sides shown (ROI at HKJC odds); bold = the side SBO favours.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Condition</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th class="num">H-Cover%</th></tr></thead><tbody>';
  function posRow(lab, o, fav){
    if(!o||o.n<30) return '';
    var hS=fav==='H'?'font-weight:700':'', aS=fav==='A'?'font-weight:700':'';
    return '<tr><td style="color:#e2e8f0">'+lab+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
      +'<td class="num" style="font-family:var(--mono);'+hS+';color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
      +'<td class="num" style="font-family:var(--mono);'+aS+';color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
      +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(o.hcover==null?'—':o.hcover+'%')+'</td></tr>';
  }
  h+=posRow('SBO home NOT highest (SBO favours home)', bc.sboPos.homeNotHi, 'H');
  h+=posRow('SBO away NOT highest (SBO favours away)', bc.sboPos.awayNotHi, 'A');
  h+='<tr><td colspan="5" style="border-top:1px solid var(--border);padding-top:4px;color:#475569;font-size:9px">— for contrast: when SBO IS the highest —</td></tr>';
  h+=posRow('SBO home IS highest (SBO bearish home)', bc.sboPos.homeHi, 'A');
  h+=posRow('SBO away IS highest (SBO bearish away)', bc.sboPos.awayHi, 'H');
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px">"Highest" compares SBO\'s odds for a side against HKJC and Macau for the same side. Bold = the side SBO favours (when not highest) / the contrarian side (when highest). Rows need n≥30.</div></div>';

  h+=lowestTable('⑨ SBO Lowest Odds — when SBO is most confident',
    'When SBO offers the shortest price on a side (lowest odds of the three), does that side cover? Tests whether following SBO\'s confidence pays.',
    bc.sboLowest, 'SBO');

  // ⑩ Macau vs SBO disagreement (HKJC not used in the criterion; bet still at HKJC)
  h+='<div style="border-top:2px solid var(--border);margin:22px 0 14px"></div>';
  h+='<div class="rpt-title" style="font-size:15px;color:#f97316">🆚 Macau vs SBO Comparison (bet at HKJC)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">When <b>Macau and SBO disagree in opposite directions</b> on a match (one prices home shorter while the other prices home longer), what happens? HKJC is not used in the criterion here — the comparison is purely between Macau and SBO — but the bet is still placed at HKJC odds. Same handicap line required across all three books.</div>';
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">⑩ Macau vs SBO Opposite Lean (latest odds)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">Click a row to expand the HKJC-lean breakdown.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
    +'<th>Condition</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th>'
    +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th class="num">H-Cover%</th><th>Interpretation</th></tr></thead><tbody>';

  (function(){
    function leanSubRows(arr){
      if(!arr) return '';
      var s='';
      for(var i=0;i<arr.length;i++){
        var o=arr[i];
        if(!o||o.n<10) continue;
        s+='<tr style="background:rgba(15,23,42,0.4)">'
          +'<td style="padding-left:24px;color:#94a3b8;font-size:9px">↳ '+LEAN_LABELS_BC[i]+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#64748b;font-size:9px">'+o.n+'</td>'
          +'<td class="num" style="font-family:var(--mono);font-size:9px;color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
          +'<td class="num" style="font-family:var(--mono);font-size:9px;color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
          +'<td colspan="2"></td></tr>';
      }
      if(!s) s='<tr style="background:rgba(15,23,42,0.4)"><td colspan="6" style="padding-left:24px;color:#64748b;font-size:9px">(no lean sub-bucket has n≥10)</td></tr>';
      return s;
    }
    function row(lab, o, hint){
      if(!o||o.n<30) return '';
      pmxRowCounter++;
      var rid='pmxr_'+pmxRowCounter;
      return '<tr style="cursor:pointer" onclick="pmxToggle(\''+rid+'\')">'
        +'<td style="color:#e2e8f0"><span id="'+rid+'_ind" style="display:inline-block;width:10px;color:#64748b">▶</span> '+lab+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+o.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiH)+'">'+fmtR(o.roiH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(o.roiA)+'">'+fmtR(o.roiA)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(o.hcover==null?'—':o.hcover+'%')+'</td>'
        +'<td style="color:#475569;font-size:9px">'+hint+'</td></tr>'
        +'<tr id="'+rid+'" style="display:none"><td colspan="6" style="padding:0">'
        +'<table style="width:100%;border-collapse:collapse"><tbody>'+leanSubRows(o.lean)+'</tbody></table>'
        +'</td></tr>';
    }
    h+=row('Macau h > SBO h AND Macau a < SBO a', bc.macSbo.c1, 'Macau leans away, SBO leans home');
    h+=row('Macau h < SBO h AND Macau a > SBO a', bc.macSbo.c2, 'Macau leans home, SBO leans away');
  })();

  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:3px">Only matches where Macau and SBO disagree in opposite directions on home vs away. HKJC line must equal Macau line and SBO line. Bet is at HKJC odds.</div></div>';

  h+='<div style="font-size:9px;color:#475569;margin-top:4px">Market lean = (1/oddsH)/((1/oddsH)+(1/oddsA)), margin-neutral. Consensus = average of Macau &amp; SBO lean; the Macau section benchmarks against Macau alone. All ROI at HKJC odds, settling on the HKJC handicap line. Rows need n≥30.</div>';

  el.innerHTML=h;
}
