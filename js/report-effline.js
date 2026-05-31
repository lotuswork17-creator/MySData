// Effective Line Comparison — combines each book's line and market lean into one
// "home bullishness" number, eliminating the need for same-line eligibility. This
// recovers the ~50% of matches normally excluded because books quote different lines
// (e.g. HKJC's structural avoidance of ±0.5 → ±0.75 substitution).
//
//   effective_line = −line + (lean − 0.5) × K
//
// K is calibrated empirically from your own HKJC vs Macau pairs at -0.75 vs -0.5:
// a 0.25 line shift produces ~5.23pp lean shift → K ≈ 4.78.

var EL_K = 4.78;

function elNz(r,k){ var v=r[k]; return v!=null && v!==0; }
function elLean(h,a){ if(!h||!a||h<=0||a<=0) return null; return (1/h)/((1/h)+(1/a)); }
function elEff(line, lean){
  if(line==null||lean==null) return null;
  return (-parseFloat(line)) + (lean-0.5)*EL_K;
}
function elAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function elPnl(r,bet){
  var m=elAdjM(r);
  if(bet==='H'){ var o=r.ASIAH; if(m>0.25) return o-1; if(m===0.25) return (o-1)/2; if(m===0) return 0; if(m===-0.25) return -0.5; return -1; }
  var o2=r.ASIAA; if(m<-0.25) return o2-1; if(m===-0.25) return (o2-1)/2; if(m===0) return 0; if(m===0.25) return -0.5; return -1;
}
function elHCov(r){ var m=elAdjM(r); return m>0?1:m===0?0.5:0; }

// Diff buckets in line-equivalent units. 0.10 ≈ 2pp lean, 0.05 ≈ 1pp, 0.02 ≈ 0.4pp.
var EL_BUCKETS = [
  { lo:-Infinity, hi:-0.10, lab:'HKJC effLine ≤ −0.10 below field (home much cheaper at HKJC)' },
  { lo:-0.10,     hi:-0.05, lab:'−0.10 to −0.05 below field' },
  { lo:-0.05,     hi:-0.02, lab:'−0.05 to −0.02 below field' },
  { lo:-0.02,     hi: 0.02, lab:'within ±0.02 of field (essentially equal)' },
  { lo: 0.02,     hi: 0.05, lab:'+0.02 to +0.05 above field' },
  { lo: 0.05,     hi: 0.10, lab:'+0.05 to +0.10 above field' },
  { lo: 0.10,     hi: Infinity, lab:'HKJC effLine ≥ +0.10 above field (away much cheaper at HKJC)' }
];
function elBucket(d){ for(var i=0;i<EL_BUCKETS.length;i++){ if(d<EL_BUCKETS[i].hi) return i; } return EL_BUCKETS.length-1; }

function computeEffLine(allRecords){
  var settled = allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });

  // Three studies: HKJC vs (Mac+SBO consensus), vs Macau only, vs SBO only
  function studyVs(mode){
    var rows = EL_BUCKETS.map(function(){ return {betH:0,betA:0,hc:0,n:0}; });
    var elig = 0;
    settled.forEach(function(r){
      // mode-specific eligibility: just need odds present, NO line match required
      if(!elNz(r,'ASIAH')||!elNz(r,'ASIAA')) return;
      var lhk=elLean(r.ASIAH,r.ASIAA);
      if(lhk==null) return;
      var effH=elEff(r.ASIALINE, lhk);
      var bench;
      if(mode==='macau'){
        if(!elNz(r,'ASIAHMAC')||!elNz(r,'ASIAAMAC')||r.ASIALINEMA==null) return;
        var lm=elLean(r.ASIAHMAC,r.ASIAAMAC); if(lm==null) return;
        bench=elEff(r.ASIALINEMA, lm);
      } else if(mode==='sbo'){
        if(!elNz(r,'ASIAHSBO')||!elNz(r,'ASIAASBO')||r.ASIALINESB==null) return;
        var ls=elLean(r.ASIAHSBO,r.ASIAASBO); if(ls==null) return;
        bench=elEff(r.ASIALINESB, ls);
      } else {
        // consensus: need both
        if(!elNz(r,'ASIAHMAC')||!elNz(r,'ASIAAMAC')||r.ASIALINEMA==null) return;
        if(!elNz(r,'ASIAHSBO')||!elNz(r,'ASIAASBO')||r.ASIALINESB==null) return;
        var lm2=elLean(r.ASIAHMAC,r.ASIAAMAC), ls2=elLean(r.ASIAHSBO,r.ASIAASBO);
        if(lm2==null||ls2==null) return;
        var em=elEff(r.ASIALINEMA, lm2), es=elEff(r.ASIALINESB, ls2);
        bench=(em+es)/2;
      }
      if(bench==null) return;
      elig++;
      var diff = effH - bench;
      var bi = elBucket(diff);
      var o = rows[bi];
      o.betH += elPnl(r,'H'); o.betA += elPnl(r,'A'); o.hc += elHCov(r); o.n++;
    });
    return { elig:elig, rows: rows.map(function(o,i){ return {
      label: EL_BUCKETS[i].lab,
      n:o.n, hcover: o.n?Math.round(o.hc/o.n*100):null,
      betH: o.n?Math.round(o.betH/o.n*1000)/10:null,
      betA: o.n?Math.round(o.betA/o.n*1000)/10:null
    }; }) };
  }

  // For coverage comparison: how many matches would the line-match approach have included?
  var hasAllThreeOdds=0, hasAllThreeLinesMatch=0;
  settled.forEach(function(r){
    var ok3 = elNz(r,'ASIAHMAC')&&elNz(r,'ASIAAMAC')&&elNz(r,'ASIAHSBO')&&elNz(r,'ASIAASBO');
    if(ok3){
      hasAllThreeOdds++;
      if(r.ASIALINE===r.ASIALINEMA && r.ASIALINE===r.ASIALINESB) hasAllThreeLinesMatch++;
    }
  });

  return {
    consensus: studyVs('consensus'),
    macau:     studyVs('macau'),
    sbo:       studyVs('sbo'),
    settledCount: settled.length,
    hasAllThreeOdds: hasAllThreeOdds,
    hasAllThreeLinesMatch: hasAllThreeLinesMatch
  };
}

function renderEffLine(RD){
  var el=document.getElementById('tabEL'); if(!el) return;
  var bc = RD.effline || (RD.effline = computeEffLine(RD.records||RD.results||[]));

  function roiC(v){ if(v==null) return '#475569'; return v>=0?'#4ade80':v>=-2?'#fbbf24':'#f87171'; }
  function fmtR(v){ if(v==null) return '<span style="color:#475569">—</span>'; return (v>=0?'+':'')+v.toFixed(1)+'%'; }

  var h='';
  h+='<div class="rpt-title">📏 Effective Line Comparison</div>';
  h+='<div class="rpt-sub" style="margin-bottom:14px">'
    +'Combines each book\'s <b>line</b> and <b>market lean</b> into a single "home bullishness" number: '
    +'<code style="background:var(--surface2);padding:1px 6px;border-radius:3px">effective_line = −line + (lean − 0.5) × K</code>. '
    +'This unifies the two ways books express their opinion (the handicap and the odds), '
    +'so matches are comparable <b>even when the books quote different lines</b>. '
    +'Higher effective_line = book more bullish on home.'
    +'</div>';

  // Calibration card
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">'
    +'<div style="font-weight:700;color:#fbbf24;margin-bottom:4px">📐 Calibration (from your data)</div>'
    +'<div style="color:#94a3b8">'
    +'K = <b style="color:#e2e8f0;font-family:var(--mono);font-size:14px">'+EL_K+'</b> '
    +'<span style="color:#64748b">— empirically derived from HKJC -0.75 vs Macau -0.5 pairs (n=869): a 0.25 line shift corresponds to ~5.23pp lean shift, so K = 0.25 ÷ 0.0523 ≈ 4.78.</span></div></div>';

  // Coverage card
  var pct = bc.hasAllThreeOdds ? Math.round(bc.hasAllThreeLinesMatch/bc.hasAllThreeOdds*100) : 0;
  var gain = bc.hasAllThreeOdds - bc.hasAllThreeLinesMatch;
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:18px;font-size:12px">'
    +'<div style="font-weight:700;color:#4ade80;margin-bottom:4px">📊 Coverage</div>'
    +'<div style="color:#94a3b8">'
    +'Matches with all 3 books\' odds present: <b style="color:#e2e8f0;font-family:var(--mono)">'+bc.hasAllThreeOdds+'</b><br>'
    +'…of which lines also match (old approach): <b style="color:#e2e8f0;font-family:var(--mono)">'+bc.hasAllThreeLinesMatch+'</b> (~'+pct+'%)<br>'
    +'<b style="color:#4ade80">Newly usable by effective-line approach: '+gain+' matches</b> — roughly doubles the sample for cross-book comparison.'
    +'</div></div>';

  function bucketTable(title, sub, study){
    var t='<div style="margin-bottom:22px">';
    t+='<div class="rpt-title" style="font-size:14px;margin-bottom:2px">'+title+'</div>';
    t+='<div class="rpt-sub" style="margin-bottom:6px">'+sub+'</div>';
    t+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Bucket (HKJC effLine − field effLine)</th>'
      +'<th class="num">N</th>'
      +'<th class="num" style="color:#f87171">Bet H ROI</th>'
      +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
      +'<th class="num">H-Cover%</th></tr></thead><tbody>';
    study.rows.forEach(function(r){
      if(r.n<30){
        t+='<tr style="opacity:.4"><td>'+r.label+'</td><td class="num" style="font-family:var(--mono);color:#475569">'+r.n+'</td><td colspan="3" class="num" style="color:#475569">(n<30)</td></tr>';
        return;
      }
      t+='<tr><td style="color:#e2e8f0">'+r.label+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+r.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(r.betH)+'">'+fmtR(r.betH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(r.betA)+'">'+fmtR(r.betA)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.hcover==null?'—':r.hcover+'%')+'</td></tr>';
    });
    t+='</tbody></table></div>';
    t+='<div style="font-size:9px;color:#475569;margin-top:3px">Eligible: '+study.elig+' matches. Buckets are mutually exclusive and span the full range. Rows need n≥30 for ROI display.</div>';
    t+='</div>';
    return t;
  }

  h+=bucketTable(
    '① HKJC effLine vs Macau+SBO consensus',
    'When HKJC\'s effective line is <b>below</b> the field (more cautious on home), home is relatively cheap at HKJC; <b>above</b> the field, away is the value side. Field = average of Macau and SBO effective lines.',
    bc.consensus
  );
  h+=bucketTable(
    '② HKJC effLine vs Macau',
    'HKJC benchmarked against Macau alone (larger sample — only requires Macau odds).',
    bc.macau
  );
  h+=bucketTable(
    '③ HKJC effLine vs SBO',
    'HKJC benchmarked against SBO alone.',
    bc.sbo
  );

  h+='<div style="font-size:10px;color:#475569;margin-top:10px;padding:8px 12px;background:rgba(15,23,42,0.4);border-radius:6px;border:1px solid var(--border)">'
    +'<b>How to read these tables:</b> "effLine ≤ −0.10 below field" means HKJC\'s effective line is at least 0.10 (line-equivalents) lower than the field — HKJC is significantly more cautious on home. Conventional Asian Handicap intuition: in such cases home odds at HKJC are relatively long (cheap to back). The bet ROIs tell you whether this opinion gap is exploitable. '
    +'<br><br>Because effective_line absorbs HKJC\'s structural line-shift (e.g. -0.5 → -0.75 substitution), books quoting different lines are now comparable in one unified space.'
    +'</div>';

  el.innerHTML=h;
}
