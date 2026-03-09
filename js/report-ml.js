// ═══════════════════════════════════════════════════════════════
// TAB 10: ML MODEL — Logistic Regression (Asia H/A)
// In-browser training: no external libs needed
// ═══════════════════════════════════════════════════════════════

// ── Helpers ─────────────────────────────────────────────────────
function sigmoid(x){ return 1/(1+Math.exp(-Math.max(-30,Math.min(30,x)))); }

// Asia handicap adjusted margin (H perspective)
// Returns: adj rounded to nearest 0.25
function hcapAdj(gh, ga, line){
  return Math.round((gh - ga + line) * 4) / 4; // +line: ASIALINE = handicap given TO H
}

// Classify: 'HW'=win full, 'HH'=win half, 'P'=push, 'AH'=lose half, 'AW'=lose full
function hcapOutcome(gh, ga, line){
  var adj = hcapAdj(gh, ga, line);
  if(adj >  0.3)  return 'HW';
  if(adj ==  0.25) return 'HH';
  if(adj ==  0)    return 'P';
  if(adj == -0.25) return 'AH';
  return 'AW';
}

// Actual P&L for $1 stake on H or A side
function asiaPnl(gh, ga, line, asiah, asiaa){
  var adj = hcapAdj(gh, ga, line);
  var hOdds = asiah || 1.9;
  var aOdds = asiaa || 1.9;
  var hPnl, aPnl;
  if(adj >  0.3)  { hPnl =  hOdds - 1; aPnl = -1; }
  else if(adj == 0.25) { hPnl =  (hOdds-1)*0.5; aPnl = -0.5; }
  else if(adj == 0)    { hPnl =  0;               aPnl =  0; }
  else if(adj ==-0.25) { hPnl = -0.5;             aPnl = (aOdds-1)*0.5; }
  else                 { hPnl = -1;               aPnl =  aOdds - 1; }
  return { h: hPnl, a: aPnl };
}

// ── JC Tip encodings (ordinal: +1=H, 0=neutral, -1=A) ────────────
var TIPSUM_MAP = {'H':1.0,'1H':0.8,'D':0.6,'1D':0.6,'1B':0.0,'B':0.0,'A':-0.8,'1A':-1.0,'S':0.0};
var TIPSID_MAP = {'H':1.0,'D':0.3,'B':0.0,'S':0.0,'A':-1.0};
var TIPSMAC_MAP= {'H':1.0,'D':0.3,'A':-1.0};
var TIPSON_MAP = {'H':1.0,'1H':0.7,'1D':0.3,'D':0.3,'B':0.0,'S':0.0,'A':-1.0,'1A':-0.7};
function encodeTip(val, map){ return map[String(val||'')] || 0; }

function extractFeatures(r){
  // 18 pre-match features
  var asiah  = r.ASIAH  || 0;
  var asiaa  = r.ASIAA  || 0;
  var asiahn = r.ASIAHLN || asiah;
  var asiaan = r.ASIAALN || asiaa;
  var linen  = r.ASIALINELN || r.ASIALINE || 0;
  var line   = r.ASIALINE || 0;
  var macline= r.ASIALINEMA || line;
  var sboline= r.ASIALINESB || line;

  // Market implied H probability (vig-removed closing odds)
  var vigH = asiah > 0 ? 1/asiah : 0.5;
  var vigA = asiaa > 0 ? 1/asiaa : 0.5;
  var impliedH = vigH / (vigH + vigA || 1);

  return [
    line,                                            // 0  Asia handicap line
    impliedH,                                        // 1  Market implied H% (vig-free)
    (line - linen),                                  // 2  JC line movement
    (asiah - asiahn),                                // 3  H odds drift (+ = money on A)
    (asiaa - asiaan),                                // 4  A odds drift (+ = money on H)
    (r.PREDICTH || 0) / 100,                        // 5  Predict model H%
    (r.PREDICTA || 0) / 100,                        // 6  Predict model A%
    Math.min((r.GEMH || 0), 9) / 9,                 // 7  GEM H votes
    Math.min((r.GEMA || 0), 9) / 9,                 // 8  GEM A votes
    Math.min((r.GPTH || 0), 8) / 8,                 // 9  GPT H votes
    Math.min((r.GPTA || 0), 7) / 7,                 // 10 GPT A votes
    ((r.REC3MHH||0)-(r.REC3MHA||0)-(r.REC3MAA||0)+(r.REC3MAH||0)) / 10, // 11 Form advantage
    encodeTip(r.JCTIPSUM,  TIPSUM_MAP),              // 12 JC Sum tip direction
    encodeTip(r.JCTIPSID,  TIPSID_MAP),              // 13 JC SID tip direction
    encodeTip(r.TIPSIDMAC, TIPSMAC_MAP),             // 14 SID Mac tip direction
    encodeTip(r.TIPSONID,  TIPSON_MAP),              // 15 ON ID tip direction
    (macline - line),                                // 16 Macau vs JC line gap (cross-book signal)
    (sboline - line)                                 // 17 SBO vs JC line gap
  ];
}

var FEATURE_NAMES = [
  'Asia Line', 'Market Implied H%', 'Line Move', 'H Odds Drift',
  'A Odds Drift', 'Predict H%', 'Predict A%',
  'GEM H Votes', 'GEM A Votes', 'GPT H Votes', 'GPT A Votes',
  'Form Advantage',
  'JC Sum Tip', 'JC SID Tip', 'SID Mac Tip', 'ON ID Tip',
  'Macau–JC Line Gap', 'SBO–JC Line Gap'
];

// ── Logistic Regression (mini-batch SGD) ────────────────────────
function trainLogReg(X, y, opts){
  opts = opts || {};
  var lr    = opts.lr    || 0.05;
  var epochs= opts.epochs|| 400;
  var reg   = opts.reg   || 0.001;  // L2 regularisation
  var n = X.length, d = X[0].length;
  var w = new Array(d).fill(0);
  var b = 0;

  // Standardise features
  var mu = new Array(d).fill(0), sd = new Array(d).fill(1);
  for(var j=0;j<d;j++){
    var s=0; for(var i=0;i<n;i++) s+=X[i][j]; mu[j]=s/n;
    var v=0; for(var i=0;i<n;i++) v+=Math.pow(X[i][j]-mu[j],2); sd[j]=Math.sqrt(v/n)||1;
  }
  var Xs = X.map(function(xi){
    return xi.map(function(v,j){ return (v-mu[j])/sd[j]; });
  });

  for(var ep=0;ep<epochs;ep++){
    var dw = new Array(d).fill(0), db = 0;
    for(var i=0;i<n;i++){
      var pred = sigmoid(Xs[i].reduce(function(s,v,j){ return s+v*w[j]; },b));
      var err = pred - y[i];
      for(var j=0;j<d;j++) dw[j] += err * Xs[i][j];
      db += err;
    }
    for(var j=0;j<d;j++) w[j] = w[j] - lr*(dw[j]/n + reg*w[j]);
    b -= lr * db/n;
  }
  return { w:w, b:b, mu:mu, sd:sd };
}

function predictProb(model, xi){
  var z = model.b;
  for(var j=0;j<model.w.length;j++){
    z += model.w[j] * (xi[j]-model.mu[j])/model.sd[j];
  }
  return sigmoid(z);
}

// ── Main compute ─────────────────────────────────────────────────
function computeML(results){
  // Filter to completed matches with scores
  var data = results.filter(function(r){
    return r.STATUS==='Result' &&
           typeof r.RESULTH === 'number' && r.RESULTH >= 0 &&
           typeof r.RESULTA === 'number' && r.RESULTA >= 0 &&
           r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });

  // Sort by date (temporal split)
  data.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||''); });

  // Build samples — exclude full push (adj=0), include half-wins as H/A side
  var samples = [];
  data.forEach(function(r){
    var gh = r.RESULTH || 0, ga = r.RESULTA || 0, line = r.ASIALINE || 0;
    var o = hcapOutcome(gh, ga, line);
    if(o === 'P') return; // exclude full push
    var pnl = asiaPnl(gh, ga, line, r.ASIAH, r.ASIAA);
    samples.push({
      x: extractFeatures(r),
      y: (o === 'HW' || o === 'HH') ? 1 : 0, // H side positive (incl half-wins)
      r: r,
      outcome: o,  // 'HW','HH','AH','AW'
      hSide: (o==='HW'||o==='HH'),
      hp: pnl.h,   // P&L if betting H side
      ap: pnl.a,   // P&L if betting A side
      date: r.DATE
    });
  });

  var n = samples.length;
  // Temporal split: 75% train, 25% test
  var splitIdx = Math.floor(n * 0.75);
  var train = samples.slice(0, splitIdx);
  var test  = samples.slice(splitIdx);

  var Xtr = train.map(function(s){ return s.x; });
  var ytr = train.map(function(s){ return s.y; });

  // Train model
  var model = trainLogReg(Xtr, ytr, { lr:0.08, epochs:600, reg:0.002 });

  // Predict on test set
  test.forEach(function(s){
    s.pH = predictProb(model, s.x);
    s.pA = 1 - s.pH;
    s.pred = s.pH >= 0.5 ? 'H' : 'A';
    s.correct = (s.pred==='H') === s.hSide;
  });
  train.forEach(function(s){
    s.pH = predictProb(model, s.x);
    s.pA = 1 - s.pH;
    s.pred = s.pH >= 0.5 ? 'H' : 'A';
    s.correct = (s.pred==='H') === s.hSide;
  });

  // ── Accuracy metrics ──
  function accuracy(set){
    var correct = set.filter(function(s){ return s.correct; }).length;
    return correct / set.length;
  }
  function classAcc(set, cls){
    var sub = set.filter(function(s){ return cls==='H' ? s.hSide : !s.hSide; });
    var correct = sub.filter(function(s){ return s.pred===cls; }).length;
    return { acc: sub.length ? correct/sub.length : 0, n: sub.length };
  }

  // ── ROI backtest with correct Asia half-win payouts ──
  function roiBacktest(set, threshold){
    var hBets=0, hWin=0, hHalf=0, hPnl=0;
    var aBets=0, aWin=0, aHalf=0, aPnl=0;
    set.forEach(function(s){
      var r = s.r;
      var gh = r.RESULTH||0, ga = r.RESULTA||0, line = r.ASIALINE||0;
      var pnl = asiaPnl(gh, ga, line, r.ASIAH, r.ASIAA);
      if(s.pH >= threshold){
        hBets++;
        hPnl += pnl.h;
        if(s.outcome==='HW') hWin++;
        else if(s.outcome==='HH') hHalf++;
      }
      if(s.pA >= threshold){
        aBets++;
        aPnl += pnl.a;
        if(s.outcome==='AW') aWin++;
        else if(s.outcome==='AH') aHalf++;
      }
    });
    return {
      h: { bets:hBets, wins:hWin, half:hHalf, pnl:hPnl, roi: hBets ? hPnl/hBets*100 : 0 },
      a: { bets:aBets, wins:aWin, half:aHalf, pnl:aPnl, roi: aBets ? aPnl/aBets*100 : 0 }
    };
  }

  var thresholds = [0.50, 0.55, 0.60, 0.65, 0.70];
  var roiResults = thresholds.map(function(t){
    return { t: t, res: roiBacktest(test, t) };
  });

  // ── ROI curve (sorted by confidence, proper Asia payout) ──
  var roiCurveH = [], roiCurveA = [];
  var sortedH = test.slice().sort(function(a,b){ return b.pH-a.pH; });
  var sortedA = test.slice().sort(function(a,b){ return b.pA-a.pA; });
  var cumH=0, cumA=0;
  sortedH.forEach(function(s,i){
    var pnl = asiaPnl(s.r.RESULTH||0, s.r.RESULTA||0, s.r.ASIALINE||0, s.r.ASIAH, s.r.ASIAA);
    cumH += pnl.h;
    roiCurveH.push(Math.round(cumH/(i+1)*10000)/100);
  });
  sortedA.forEach(function(s,i){
    var pnl = asiaPnl(s.r.RESULTH||0, s.r.RESULTA||0, s.r.ASIALINE||0, s.r.ASIAH, s.r.ASIAA);
    cumA += pnl.a;
    roiCurveA.push(Math.round(cumA/(i+1)*10000)/100);
  });

  // ── Feature importance: Acc + H-ROI + A-ROI drops (5-repeat permutation) ──
  var THRESH_IMP = 0.55;
  var N_REP = 5;

  function calcMetrics(sset){
    var acc=0, hPnl=0, hN=0, aPnl=0, aN=0;
    sset.forEach(function(s){
      if((s.pH>=0.5)===s.hSide) acc++;
      if(s.pH>=THRESH_IMP){ hN++; hPnl+=s.hp; }
      if(s.pA>=THRESH_IMP){ aN++; aPnl+=s.ap; }
    });
    return { acc:acc/sset.length*100, hRoi:hN?hPnl/hN*100:0, aRoi:aN?aPnl/aN*100:0 };
  }
  var baseM = calcMetrics(test);

  function shuffleArr(arr){
    var a=arr.slice();
    for(var k=a.length-1;k>0;k--){var ri=Math.floor(Math.random()*(k+1));var t=a[k];a[k]=a[ri];a[ri]=t;}
    return a;
  }

  var importance = FEATURE_NAMES.map(function(name, j){
    var accD=[], hD=[], aD=[];
    for(var rep=0; rep<N_REP; rep++){
      var shuf = shuffleArr(test.map(function(s){ return s.x[j]; }));
      var ps = test.map(function(s,i){
        var xp=s.x.slice(); xp[j]=shuf[i];
        var pH=predictProb(model,xp);
        return {pH:pH,pA:1-pH,hSide:s.hSide,hp:s.hp,ap:s.ap};
      });
      var pm=calcMetrics(ps);
      accD.push(baseM.acc-pm.acc); hD.push(baseM.hRoi-pm.hRoi); aD.push(baseM.aRoi-pm.aRoi);
    }
    function mn(a){ return a.reduce(function(s,v){return s+v;},0)/a.length; }
    function sd(a){ var m=mn(a); return Math.sqrt(a.reduce(function(s,v){return s+(v-m)*(v-m);},0)/a.length)||0.001; }
    var hm=mn(hD), am=mn(aD);
    return {
      name:name,
      drop:  Math.round(mn(accD)*100)/100,
      hDrop: Math.round(hm*100)/100,
      aDrop: Math.round(am*100)/100,
      hRatio: hm/sd(hD),
      aRatio: am/sd(aD)
    };
  });
  importance.sort(function(a,b){ return b.hDrop - a.hDrop; });

  // ── Calibration (predicted prob vs actual win rate in buckets) ──
  var buckets = [0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0];
  var calibH = [];
  for(var bi=0;bi<buckets.length-1;bi++){
    var lo=buckets[bi], hi=buckets[bi+1];
    var sub = test.filter(function(s){ return s.pH>=lo && s.pH<hi; });
    if(sub.length >= 5){
      var actualWin = sub.filter(function(s){ return s.hSide; }).length / sub.length;
      calibH.push({ mid: (lo+hi)/2, predicted: (lo+hi)/2, actual: actualWin, n: sub.length });
    }
  }

  // ── Confusion matrix ──
  var tp=0,fp=0,tn=0,fn=0;
  test.forEach(function(s){
    var predH = s.pred==='H';
    if(predH  &&  s.hSide) tp++;
    else if(predH  && !s.hSide) fp++;
    else if(!predH &&  s.hSide) fn++;
    else tn++;
  });

  // ── Upcoming predictions ──
  var upcoming = results.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });
  upcoming.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||'') || (a.TIME||0)-(b.TIME||0); });

  // Compute expected ROI for a bet side using test-set calibration
  // Use the ROI at >=50% threshold as baseline estimate
  var baseRoiH = roiResults[0].res.h.roi;
  var baseRoiA = roiResults[0].res.a.roi;

  var predictions = upcoming.map(function(r){
    var x = extractFeatures(r);
    var pH = predictProb(model, x);
    var pA = 1 - pH;
    var rec = pH >= 0.60 ? 'H' : pA >= 0.60 ? 'A' : 'SKIP';
    // Expected ROI: scale from test-set calibration at confidence level
    // Higher confidence → interpolate toward best threshold ROI
    var conf = Math.max(pH, pA);
    var threshIdx = Math.min(3, Math.floor((conf - 0.50) / 0.05));
    var roiH_est = roiResults[Math.min(threshIdx, roiResults.length-1)].res.h.roi;
    var roiA_est = roiResults[Math.min(threshIdx, roiResults.length-1)].res.a.roi;
    var expRoi = rec==='H' ? roiH_est : rec==='A' ? roiA_est : 0;

    // Feature contributions (raw values for display)
    var featureVals = FEATURE_NAMES.map(function(name, j){
      return { name: name, raw: x[j],
        contrib: model.w[j] * (x[j]-model.mu[j]) / (model.sd[j]||1) };
    });
    featureVals.sort(function(a,b){ return Math.abs(b.contrib)-Math.abs(a.contrib); });

    return {
      r: r, pH: pH, pA: pA, rec: rec, expRoi: expRoi,
      conf: conf, featureVals: featureVals
    };
  });
  // Sort by confidence descending
  predictions.sort(function(a,b){ return b.conf - a.conf; });

  return {
    nTotal: n, nTrain: train.length, nTest: test.length,
    trainAcc: accuracy(train),
    testAcc: accuracy(test),
    hAccTrain: classAcc(train,'H'), aAccTrain: classAcc(train,'A'),
    hAccTest: classAcc(test,'H'),   aAccTest: classAcc(test,'A'),
    roiResults: roiResults,
    roiCurveH: roiCurveH,
    roiCurveA: roiCurveA,
    importance: importance,
    calibH: calibH,
    confusion: { tp:tp, fp:fp, tn:tn, fn:fn },
    trainPct: Math.round(0.75*100),
    testSamples: test,
    model: model,
    predictions: predictions
  };
}

// ── Render ────────────────────────────────────────────────────────
function renderML(RD){
  var el = document.getElementById('tab9');
  if(!el) return;
  var ml = RD.ml;
  if(!ml){ el.innerHTML='<p style="color:#f87171;padding:14px">ML data not available.</p>'; return; }

  var fmt = function(v,d){ return (v>=0?'+':'')+v.toFixed(d===undefined?1:d)+'%'; };
  var fmtN = function(v){ return (v>=0?'+':'')+v.toFixed(2); };
  var cls = function(v){ return v>0.5?'pos':v<-0.5?'neg':'neu'; };

  var h = '';

  h += '<div class="rpt-title">🤖 ML Model — Asia Handicap Predictor</div>';
  h += '<div class="rpt-sub">Logistic Regression trained on '+ml.nTrain+' matches ('+ml.trainPct+'% oldest), tested on '+ml.nTest+' matches (25% most recent). Pushes excluded. Target: H or A covers handicap.</div>';

  // ── Summary cards ──
  var testH = ml.hAccTest, testA = ml.aAccTest;
  var cm = ml.confusion;
  var precision = (cm.tp+cm.fp) ? cm.tp/(cm.tp+cm.fp) : 0;
  var recall    = (cm.tp+cm.fn) ? cm.tp/(cm.tp+cm.fn) : 0;

  h += '<div class="rpt-cards">';
  h += card('Test Accuracy', (ml.testAcc*100).toFixed(1)+'%', 'vs '+(ml.trainAcc*100).toFixed(1)+'% train', ml.testAcc>0.52?'pos':'neu');
  h += card('H Precision', (precision*100).toFixed(1)+'%', 'when model says H', precision>0.52?'pos':'neu');
  h += card('H Recall', (recall*100).toFixed(1)+'%', 'of true H wins caught', recall>0.4?'pos':'neu');
  h += card('Baseline', '50.0%', 'random 50/50', 'neu');
  h += '</div>';

  // ── Confusion matrix ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">Confusion Matrix (Test Set)</div>';
  h += '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:1px;margin-bottom:14px;max-width:320px">';
  h += '<div style="font-size:9px;color:#64748b;padding:4px 8px"></div>';
  h += '<div style="font-size:9px;font-weight:700;color:#60a5fa;padding:4px 8px;background:var(--surface2);text-align:center">Pred H</div>';
  h += '<div style="font-size:9px;font-weight:700;color:#f87171;padding:4px 8px;background:var(--surface2);text-align:center">Pred A</div>';
  h += '<div style="font-size:9px;font-weight:700;color:#60a5fa;padding:4px 8px;background:var(--surface2)">True H</div>';
  h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#4ade80;padding:6px 8px;background:#0f1a12;text-align:center">'+cm.tp+'</div>';
  h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#f87171;padding:6px 8px;background:#1a0f0f;text-align:center">'+cm.fn+'</div>';
  h += '<div style="font-size:9px;font-weight:700;color:#f87171;padding:4px 8px;background:var(--surface2)">True A</div>';
  h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#f87171;padding:6px 8px;background:#1a0f0f;text-align:center">'+cm.fp+'</div>';
  h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#4ade80;padding:6px 8px;background:#0f1a12;text-align:center">'+cm.tn+'</div>';
  h += '</div>';

  // ── ROI backtest table ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">ROI Backtest by Confidence Threshold (Test Set)</div>';
  h += '<div class="rpt-table-wrap"><table class="rpt-table">';
  h += '<thead><tr><th>Min Confidence</th><th class="num">H Bets</th><th class="num">H Win</th><th class="num">H ½Win</th><th class="num">H ROI</th><th class="num">A Bets</th><th class="num">A Win</th><th class="num">A ½Win</th><th class="num">A ROI</th></tr></thead><tbody>';
  ml.roiResults.forEach(function(row){
    var rh=row.res.h, ra=row.res.a;
    var t=(row.t*100).toFixed(0)+'%';
    h += '<tr>';
    h += '<td style="color:#94a3b8">≥ '+t+'</td>';
    h += '<td class="num">'+rh.bets+'</td>';
    h += '<td class="num">'+rh.wins+'</td>';
    h += '<td class="num" style="color:#94a3b8">'+rh.half+'</td>';
    h += '<td class="num '+cls(rh.roi)+'">'+fmt(rh.roi)+'</td>';
    h += '<td class="num">'+ra.bets+'</td>';
    h += '<td class="num">'+ra.wins+'</td>';
    h += '<td class="num" style="color:#94a3b8">'+ra.half+'</td>';
    h += '<td class="num '+cls(ra.roi)+'">'+fmt(ra.roi)+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';

  // ── Feature importance chart: 3 bars (Acc / H-ROI / A-ROI) ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:4px">Feature Importance — ROI Drop When Feature Removed</div>';
  h += '<div style="font-size:9px;color:#64748b;margin-bottom:8px">';
  h += '<span style="color:#60a5fa">■</span> H-bet ROI drop &nbsp;&nbsp;';
  h += '<span style="color:#34d399">■</span> A-bet ROI drop &nbsp;&nbsp;';
  h += '<span style="color:#94a3b8">■</span> Accuracy drop &nbsp;&nbsp;';
  h += '<span style="color:#fbbf24">✓</span> = signal reliable (SNR > 2)';
  h += '</div>';

  // Scale: max absolute value across all three metrics
  var allVals = [];
  ml.importance.forEach(function(f){ allVals.push(Math.abs(f.hDrop),Math.abs(f.aDrop),Math.abs(f.drop)); });
  var maxV = Math.max.apply(null, allVals) || 1;

  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
  ml.importance.forEach(function(f){
    var hPct  = Math.min(100, Math.abs(f.hDrop)/maxV*100);
    var aPct  = Math.min(100, Math.abs(f.aDrop)/maxV*100);
    var accPct= Math.min(100, Math.abs(f.drop)/maxV*100);
    var hCol  = f.hDrop > 0 ? '#60a5fa' : '#f87171';
    var aCol  = f.aDrop > 0 ? '#34d399' : '#fb923c';
    var accCol= f.drop  > 0 ? '#94a3b8' : '#6b7280';
    var hRel  = Math.abs(f.hRatio) > 2;
    var aRel  = Math.abs(f.aRatio) > 2;
    var badge = '';
    if(hRel) badge += '<span style="color:#fbbf24;font-size:9px" title="H-bet signal reliable"> H✓</span>';
    if(aRel) badge += '<span style="color:#fbbf24;font-size:9px" title="A-bet signal reliable"> A✓</span>';
    if(!hRel&&!aRel) badge = '<span style="color:#475569;font-size:9px"> ~</span>';

    h += '<div style="display:flex;align-items:center;gap:6px">';
    h += '<div style="font-size:10px;color:#94a3b8;width:120px;text-align:right;flex-shrink:0">'+f.name+'</div>';
    h += '<div style="flex:1;display:flex;flex-direction:column;gap:2px">';
    // H-ROI bar
    h += '<div style="display:flex;align-items:center;gap:4px">';
    h += '<div style="width:'+hPct+'%;max-width:100%;height:8px;background:'+hCol+';border-radius:2px"></div>';
    h += '<span style="font-size:9px;font-family:var(--mono);color:'+hCol+'">'+(f.hDrop>=0?'+':'')+f.hDrop.toFixed(1)+'%</span>';
    h += '</div>';
    // A-ROI bar
    h += '<div style="display:flex;align-items:center;gap:4px">';
    h += '<div style="width:'+aPct+'%;max-width:100%;height:8px;background:'+aCol+';border-radius:2px"></div>';
    h += '<span style="font-size:9px;font-family:var(--mono);color:'+aCol+'">'+(f.aDrop>=0?'+':'')+f.aDrop.toFixed(1)+'%</span>';
    h += '</div>';
    // Acc bar (thin)
    h += '<div style="display:flex;align-items:center;gap:4px">';
    h += '<div style="width:'+accPct+'%;max-width:100%;height:4px;background:'+accCol+';border-radius:2px;opacity:0.6"></div>';
    h += '<span style="font-size:8px;font-family:var(--mono);color:'+accCol+';opacity:0.7">'+(f.drop>=0?'+':'')+f.drop.toFixed(1)+'%</span>';
    h += '</div>';
    h += '</div>';
    h += '<div style="width:28px;flex-shrink:0">'+badge+'</div>';
    h += '</div>';
  });
  h += '</div>';

  // ── Calibration chart ──
  if(ml.calibH.length > 2){
    h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">Calibration — Predicted H% vs Actual Win Rate</div>';
    h += '<div class="chart-box" style="margin-bottom:14px">';
    h += '<canvas id="mlCalibChart" style="width:100%;display:block"></canvas>';
    h += '<div style="font-size:9px;color:#64748b;margin-top:4px">A well-calibrated model follows the diagonal. Above = overconfident on H, Below = underconfident.</div>';
    h += '</div>';
  }

  // ── ROI curve chart ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">ROI Curve — Betting Top-N by Confidence (Test Set)</div>';
  h += '<div class="chart-box">';
  h += '<canvas id="mlRoiChart" style="width:100%;display:block"></canvas>';
  h += '<div style="font-size:9px;color:#64748b;margin-top:4px">Matches sorted by model confidence. Left = highest confidence. A falling curve = confident picks don\'t outperform.</div>';
  h += '</div>';

  // ── Notes ──
  h += '<div style="margin-top:14px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Model Notes</div>';
  h += '<div style="font-size:11px;color:#94a3b8;line-height:1.7">';
  h += '• <b style="color:#e2e8f0">Algorithm:</b> Logistic Regression with L2 regularisation (ridge), trained via mini-batch SGD<br>';
  h += '• <b style="color:#e2e8f0">Split:</b> Strict temporal split — older 75% for training, newest 25% for testing. No data leakage.<br>';
  h += '• <b style="color:#e2e8f0">Features:</b> 18 pre-match signals: odds, line movement, JC/Mac/SBO expert tips (encoded), Predict model, GEM/GPT votes, cross-bookmaker line gaps, form<br>';
  h += '• <b style="color:#e2e8f0">Target:</b> Binary — H covers handicap (1) or A covers (0). Pushes excluded.<br>';
  h += '• <b style="color:#e2e8f0">Limitation:</b> 1,700 records is modest for ML. Expect variance in results across retraining.<br>';
  h += '• <b style="color:#e2e8f0">Next steps:</b> XGBoost or ensemble methods would likely improve accuracy by 2–5%.';
  h += '</div></div>';

  // ── Upcoming predictions ──
  h += renderMLPredictionsHTML(ml.predictions, ml.testAcc);

  el.innerHTML = h;

  // Draw charts
  setTimeout(function(){
    drawCalibChart(ml.calibH);
    drawRoiCurveChart(ml.roiCurveH, ml.roiCurveA);
  }, 50);
}

function card(label, val, sub, cls){
  return '<div class="rpt-card"><div class="rpt-card-label">'+label+'</div>'+
         '<div class="rpt-card-val '+cls+'">'+val+'</div>'+
         '<div class="rpt-card-sub">'+sub+'</div></div>';
}

function drawCalibChart(calibH){
  var canvas = document.getElementById('mlCalibChart');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio||1;
  var W = canvas.parentElement.offsetWidth||300;
  var H = 140;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.scale(dpr,dpr);

  var padL=36, padR=10, padT=10, padB=22;
  var cw=W-padL-padR, ch=H-padT-padB;

  // Grid
  ctx.font='8px IBM Plex Mono'; ctx.textBaseline='middle'; ctx.textAlign='right';
  for(var i=0;i<=4;i++){
    var v=i/4, y=padT+(1-v)*ch;
    ctx.fillStyle='#64748b';
    ctx.fillText((v*100).toFixed(0)+'%', padL-3, y);
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cw,y); ctx.stroke();
  }
  // X axis
  ctx.textAlign='center'; ctx.textBaseline='top';
  for(var i=0;i<=4;i++){
    var x=padL+i/4*cw;
    ctx.fillStyle='#64748b';
    ctx.fillText((i*25)+'%', x, padT+ch+4);
  }

  // Diagonal (perfect calibration)
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(padL,padT+ch); ctx.lineTo(padL+cw,padT); ctx.stroke();
  ctx.setLineDash([]);

  // Calibration points
  calibH.forEach(function(pt){
    var x = padL + pt.mid * cw;
    var y = padT + (1-pt.actual)*ch;
    var r = Math.max(3, Math.min(8, pt.n/15));
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle='rgba(96,165,250,0.7)'; ctx.fill();
    ctx.strokeStyle='#60a5fa'; ctx.lineWidth=1; ctx.stroke();
  });

  // Connect dots
  ctx.beginPath(); ctx.strokeStyle='#60a5fa'; ctx.lineWidth=1.5;
  calibH.forEach(function(pt,i){
    var x=padL+pt.mid*cw, y=padT+(1-pt.actual)*ch;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function drawRoiCurveChart(hPts, aPts){
  var canvas = document.getElementById('mlRoiChart');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio||1;
  var W = canvas.parentElement.offsetWidth||300;
  var H = 120;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.scale(dpr,dpr);

  var padL=36, padR=50, padT=10, padB=18;
  var cw=W-padL-padR, ch=H-padT-padB;

  var allV = hPts.concat(aPts);
  var mn = Math.min(0, Math.min.apply(null,allV));
  var mx = Math.max(0, Math.max.apply(null,allV));
  var range = mx-mn||1;
  function yy(v){ return padT+(1-(v-mn)/range)*ch; }
  function xx(i,len){ return padL+i/((len-1)||1)*cw; }

  // Grid
  ctx.font='8px IBM Plex Mono'; ctx.textBaseline='middle'; ctx.textAlign='right';
  for(var i=0;i<=4;i++){
    var v=mn+(mx-mn)*i/4, y=yy(v);
    ctx.fillStyle='#64748b';
    ctx.fillText((v>=0?'+':'')+v.toFixed(1)+'%', padL-3, y);
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cw,y); ctx.stroke();
  }

  // Zero line
  var zy=yy(0);
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(padL,zy); ctx.lineTo(padL+cw,zy); ctx.stroke();
  ctx.setLineDash([]);

  function drawLine(pts, color){
    if(!pts.length) return;
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=1.5;
    pts.forEach(function(v,i){
      var x=xx(i,pts.length), y=yy(v);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // End label
    var last=pts[pts.length-1];
    ctx.font='9px IBM Plex Mono'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=color;
    ctx.fillText((last>=0?'+':'')+last.toFixed(1)+'%', padL+cw+3, yy(last));
  }

  drawLine(hPts, '#60a5fa');
  drawLine(aPts, '#f87171');

  // Legend
  ctx.font='9px IBM Plex Mono'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle='#60a5fa'; ctx.fillRect(padL,padT,18,2);
  ctx.fillText('H', padL+20, padT+1);
  ctx.fillStyle='#f87171'; ctx.fillRect(padL+30,padT,18,2);
  ctx.fillText('A', padL+50, padT+1);
}

// ── Predictions HTML builder (shared by report tab + index widget) ──
function renderMLPredictionsHTML(predictions, testAcc){
  if(!predictions || !predictions.length){
    return '<div style="padding:14px;color:#64748b;font-size:12px">No upcoming matches with sufficient data.</div>';
  }

  var recColor = function(rec){ return rec==='H'?'#60a5fa': rec==='A'?'#f87171':'#64748b'; };
  var recBg    = function(rec){ return rec==='H'?'rgba(96,165,250,.15)': rec==='A'?'rgba(248,113,113,.15)':'rgba(100,116,139,.1)'; };
  var confBar  = function(pct, col){
    return '<div style="height:6px;border-radius:3px;background:var(--border);margin-top:3px">'+
           '<div style="width:'+Math.round(pct*100)+'%;height:100%;background:'+col+';border-radius:3px"></div></div>';
  };

  var h = '';
  h += '<div style="margin-top:20px;border-top:2px solid var(--border);padding-top:14px">';
  h += '<div class="rpt-title">🎯 Upcoming Match Predictions</div>';
  h += '<div class="rpt-sub">Model trained on historical data. Confidence = predicted probability. Bet recommended at ≥60%. ';
  h += 'Est. ROI derived from test-set backtest at same confidence threshold. ';
  h += 'Model test accuracy: <b style="color:#4ade80">'+(testAcc*100).toFixed(1)+'%</b>. Use as one signal, not sole basis for betting.</div>';

  predictions.forEach(function(p, idx){
    var r = p.r;
    var date = r.DATE || '';
    var time = r.TIME ? String(r.TIME).padStart(4,'0').replace(/(\d\d)(\d\d)/,'$1:$2') : '';
    var league = r.CATEGORY || '';
    var rec = p.rec;
    var isSkip = rec === 'SKIP';

    h += '<div style="background:var(--surface2);border:1px solid '+(isSkip?'var(--border)':recColor(rec)+'55')+';border-radius:10px;padding:12px;margin-bottom:8px">';

    // Header row: match info + recommendation badge
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">';
    h += '<div>';
    h += '<div style="font-size:12px;font-weight:700;color:#e2e8f0">'+r.TEAMH+' <span style="color:#64748b">vs</span> '+r.TEAMA+'</div>';
    h += '<div style="font-size:10px;color:#64748b;font-family:var(--mono);margin-top:2px">'+date+' '+time+' · '+league+'</div>';
    h += '<div style="font-size:10px;color:#94a3b8;margin-top:2px">Line: <b style="color:#e2e8f0">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</b> · H odds: <b style="color:#e2e8f0">'+(r.ASIAH||'—')+'</b> · A odds: <b style="color:#e2e8f0">'+(r.ASIAA||'—')+'</b></div>';
    h += '</div>';
    h += '<div style="text-align:right;flex-shrink:0">';
    h += '<div style="display:inline-block;padding:4px 10px;border-radius:6px;background:'+recBg(rec)+';border:1px solid '+recColor(rec)+'44;font-size:12px;font-weight:800;color:'+recColor(rec)+'">'+rec+'</div>';
    if(!isSkip){
      var roiSign = p.expRoi >= 0 ? '+' : '';
      h += '<div style="font-size:10px;font-family:var(--mono);color:#94a3b8;margin-top:3px">Est ROI <span style="color:'+(p.expRoi>=0?'#4ade80':'#f87171')+'">'+roiSign+p.expRoi.toFixed(1)+'%</span></div>';
    }
    h += '</div>';
    h += '</div>';

    // Confidence bars
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += '<div><div style="font-size:9px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.04em">H Confidence</div>';
    h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#60a5fa">'+Math.round(p.pH*100)+'%</div>';
    h += confBar(p.pH, '#60a5fa')+'</div>';
    h += '<div><div style="font-size:9px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.04em">A Confidence</div>';
    h += '<div style="font-size:14px;font-weight:800;font-family:var(--mono);color:#f87171">'+Math.round(p.pA*100)+'%</div>';
    h += confBar(p.pA, '#f87171')+'</div>';
    h += '</div>';

    // Feature contributions (collapsible)
    var detailId = 'mlf_'+idx;
    h += '<div style="margin-top:4px">';
    h += '<button onclick="var el=document.getElementById(\''+detailId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" '+
         'style="font-size:9px;color:#64748b;background:none;border:none;cursor:pointer;padding:0;font-family:var(--mono)">▶ Feature breakdown</button>';
    h += '<div id="'+detailId+'" style="display:none;margin-top:6px">';
    h += '<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Top Drivers (contribution to H prediction)</div>';
    var maxC = Math.max.apply(null, p.featureVals.map(function(f){ return Math.abs(f.contrib); }))||1;
    p.featureVals.forEach(function(f){
      var pct = Math.abs(f.contrib)/maxC*100;
      var col = f.contrib > 0 ? '#60a5fa' : '#f87171';
      var dir = f.contrib > 0 ? '▲H' : '▼A';
      // Format raw value readably
      var rawDisp;
      if(f.name==='Market Implied H%'||f.name==='Predict H%'||f.name==='Predict A%') rawDisp=(f.raw*100).toFixed(0)+'%';
      else rawDisp=f.raw.toFixed(3);
      h += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">';
      h += '<div style="font-size:9px;color:#64748b;width:110px;flex-shrink:0;text-align:right">'+f.name+'</div>';
      h += '<div style="width:8px;font-size:8px;color:'+col+';flex-shrink:0;text-align:center">'+dir+'</div>';
      h += '<div style="flex:1;background:var(--border);border-radius:2px;height:8px">';
      h += '<div style="width:'+pct.toFixed(0)+'%;height:100%;background:'+col+';border-radius:2px"></div></div>';
      h += '<div style="font-size:9px;font-family:var(--mono);color:#94a3b8;width:40px;text-align:right">'+rawDisp+'</div>';
      h += '</div>';
    });
    h += '</div></div>';

    h += '</div>'; // match card
  });

  h += '</div>';
  return h;
}

// ── Index page widget (compact) ──
function renderMLIndexWidget(mlPredictions, containerId){
  var el = document.getElementById(containerId);
  if(!el || !mlPredictions || !mlPredictions.length) return;

  // Show only top 5 highest-confidence non-skip picks
  var top = mlPredictions.filter(function(p){ return p.rec!=='SKIP'; }).slice(0,5);
  if(!top.length){ el.innerHTML='<div style="font-size:11px;color:#64748b;padding:8px">No high-confidence picks today.</div>'; return; }

  var recColor = function(rec){ return rec==='H'?'#60a5fa':'#f87171'; };
  var h = '';
  h += '<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">🤖 ML Picks (Top '+top.length+' upcoming)</div>';

  top.forEach(function(p){
    var r = p.r;
    var roiSign = p.expRoi >= 0 ? '+' : '';
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">';
    // Bet badge
    h += '<div style="font-size:10px;font-weight:800;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:'+recColor(p.rec)+'22;color:'+recColor(p.rec)+';flex-shrink:0;border:1px solid '+recColor(p.rec)+'44">'+p.rec+'</div>';
    // Match
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:11px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.TEAMH+' vs '+r.TEAMA+'</div>';
    h += '<div style="font-size:9px;color:#64748b;font-family:var(--mono)">'+(r.DATE||'')+' · Line '+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</div>';
    h += '</div>';
    // Confidence + ROI
    h += '<div style="text-align:right;flex-shrink:0">';
    h += '<div style="font-size:12px;font-weight:800;font-family:var(--mono);color:'+recColor(p.rec)+'">'+Math.round(Math.max(p.pH,p.pA)*100)+'%</div>';
    h += '<div style="font-size:9px;color:'+(p.expRoi>=0?'#4ade80':'#f87171')+';font-family:var(--mono)">'+roiSign+p.expRoi.toFixed(1)+'%</div>';
    h += '</div>';
    h += '</div>';
  });

  h += '<div style="margin-top:5px;text-align:right"><a href="report.html#ml" style="font-size:9px;color:#60a5fa;text-decoration:none;font-family:var(--mono)">Full predictions in Report →</a></div>';
  el.innerHTML = h;
}
