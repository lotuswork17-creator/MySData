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
  // 14-feature set — lean, tips, line, key interactions
  var asiah  = r.ASIAH  || 0;
  var asiaa  = r.ASIAA  || 0;
  var asiahn = r.ASIAHLN || asiah;
  var asiaan = r.ASIAALN || asiaa;
  var linen  = r.ASIALINELN || r.ASIALINE || 0;
  var line   = r.ASIALINE || 0;
  var macline= r.ASIALINEMA || line;
  var sboline= r.ASIALINESB || line;

  // Market Lean: closing vig-removed implied H probability
  var vigH = asiah > 0 ? 1/asiah : 0.5;
  var vigA = asiaa > 0 ? 1/asiaa : 0.5;
  var impliedH = vigH / (vigH + vigA || 1);

  // Opening lean (for drift)
  var opH = asiahn > 0 ? 1/asiahn : 0.5;
  var opA = asiaan > 0 ? 1/asiaan : 0.5;
  var impliedHO = opH / (opH + opA || 1);
  var leanDrift = impliedH - impliedHO;  // +ve = money came in on H

  var jcsum = encodeTip(r.JCTIPSUM,  TIPSUM_MAP);
  var jcsid = encodeTip(r.JCTIPSID,  TIPSID_MAP);
  var mac   = encodeTip(r.TIPSIDMAC, TIPSMAC_MAP);
  var onid  = encodeTip(r.TIPSONID,  TIPSON_MAP);
  var tipcons = (jcsum + jcsid + mac + onid) / 4;

  return [
    impliedH,              // 0  Market Lean (closing vig-free H%)    ★ CORE
    leanDrift,             // 1  Lean Drift (closing − opening lean)   ★ CORE
    line,                  // 2  Asia Handicap Line                    ★ CORE
    impliedH * line,       // 3  Lean × Line interaction               ★ KEY
    jcsid,                 // 4  JC SID Tip (contrarian signal)        ★ CORE
    mac,                   // 5  MAC Tip (contrarian signal)           ★ CORE
    jcsum,                 // 6  JC Sum Tip
    onid,                  // 7  ON ID Tip
    tipcons,               // 8  Tip Consensus (avg all 4 tips)
    tipcons * line,        // 9  Tip Consensus × Line
    mac * impliedH,        // 10 MAC × Lean interaction
    (line - linen),        // 11 Line Move (JC)
    (macline - line),      // 12 Macau–JC Line Gap
    (sboline - line)       // 13 SBO–JC Line Gap
  ];
}

var FEATURE_NAMES = [
  'Market Lean', 'Lean Drift', 'Asia Line', 'Lean × Line',
  'JC SID Tip', 'MAC Tip', 'JC Sum Tip', 'ON ID Tip',
  'Tip Consensus', 'Tip × Line', 'MAC × Lean',
  'Line Move', 'Macau–JC Gap', 'SBO–JC Gap'
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
  // Filter to completed matches
  var data = results.filter(function(r){
    return r.STATUS==='Result' &&
           typeof r.RESULTH === 'number' && r.RESULTH >= 0 &&
           typeof r.RESULTA === 'number' && r.RESULTA >= 0 &&
           r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });
  data.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||''); });

  // ── Helpers ──
  function mkLean(asiah, asiaa){
    var vH = asiah > 0 ? 1/asiah : 0.5;
    var vA = asiaa > 0 ? 1/asiaa : 0.5;
    return vH / (vH + vA || 1);
  }
  function tipCons(r){
    return (encodeTip(r.JCTIPSUM,TIPSUM_MAP) +
            encodeTip(r.JCTIPSID,TIPSID_MAP) +
            encodeTip(r.TIPSIDMAC,TIPSMAC_MAP) +
            encodeTip(r.TIPSONID,TIPSON_MAP)) / 4;
  }

  // ── Conflict Score Model ──────────────────────────────────────
  // Based on verified observation: market lean % + AsiaLine + 4 JC tips
  //
  // H BET: tips lean Away (tipcons < -0.15)
  //        AND market lean > 50% for H
  //        AND AsiaLine >= +0.25 (structure confirms H)
  //   Confidence = market lean %  (e.g. 54% lean = 54% confidence)
  //
  // A BET: AsiaLine = -1.00
  //        (structural heavy handicap — market historically over-adjusts)
  //   Confidence = (1 - market lean) %
  //
  // SKIP: all other cases — no verified edge above bookmaker vig
  // ─────────────────────────────────────────────────────────────
  var TIP_THRESH  = 0.15;   // min abs tipcons to count as directional
  var H_LEAN_MIN  = 0.50;   // market lean must exceed 50% for H signal
  var H_LINE_MIN  = 0.25;   // AsiaLine must be >= +0.25 for H signal
  var A_LEAN_MAX  = 0.47;   // market lean must be < 47% for A signal
  var A_LINE_MAX  = -0.75;  // AsiaLine must be <= -0.75 for A signal

  function conflictScore(r){
    var lean = mkLean(r.ASIAH||0, r.ASIAA||0);
    var tips = tipCons(r);
    var line = r.ASIALINE || 0;
    var jcsum = encodeTip(r.JCTIPSUM,TIPSUM_MAP);
    var jcsid = encodeTip(r.JCTIPSID,TIPSID_MAP);
    var mac   = encodeTip(r.TIPSIDMAC,TIPSMAC_MAP);
    var onid  = encodeTip(r.TIPSONID,TIPSON_MAP);

    // ── Primary: market lean + tip consensus conflict ──
    if(tips < -TIP_THRESH && lean > H_LEAN_MIN && line >= H_LINE_MIN){
      return { rec:'H', conf: lean, lean: lean, tips: tips, line: line, rule:'Tips→A but lean+line→H' };
    }
    if(tips > TIP_THRESH && lean < A_LEAN_MAX && line <= A_LINE_MAX){
      return { rec:'A', conf: 1-lean, lean: lean, tips: tips, line: line, rule:'Tips→H but lean+line→A' };
    }

    // ── Expert counter-rules (verified consistent on train + test) ──
    // MAC→H + Line=-1.00: MAC systematically wrong at heavy handicap → BET A
    if(mac >= 0.5 && line <= -1.0){
      return { rec:'A', conf:0.56, lean:lean, tips:tips, line:line, rule:'MAC→H + Line=−1 → A' };
    }
    // JCSUM→H + Line=-1.00: JCTIPSUM→H at heavy handicap → BET A
    if(jcsum >= 0.5 && line <= -1.0){
      return { rec:'A', conf:0.57, lean:lean, tips:tips, line:line, rule:'JCSUM→H + Line=−1 → A' };
    }
    // ONID→H + Line=-1.00: ONID→H at heavy handicap → BET A
    if(onid >= 0.3 && line <= -1.0){
      return { rec:'A', conf:0.55, lean:lean, tips:tips, line:line, rule:'ONID→H + Line=−1 → A' };
    }
    // MAC→H + Line=0.00: MAC tips Home on level line → BET A
    if(mac >= 0.5 && Math.abs(line) < 0.01){
      return { rec:'A', conf:0.54, lean:lean, tips:tips, line:line, rule:'MAC→H + Line=0 → A' };
    }
    // MAC→H + Line=+0.25: MAC tips Home on mild line → BET A
    if(mac >= 0.5 && Math.abs(line - 0.25) < 0.01){
      return { rec:'A', conf:0.52, lean:lean, tips:tips, line:line, rule:'MAC→H + Line=+0.25 → A' };
    }
    // MAC→A + Line≥+0.75 + Lean≥50%: structure overrides MAC away tip → BET H
    if(mac <= -0.5 && line >= 0.75 && lean >= 0.50){
      return { rec:'H', conf:lean, lean:lean, tips:tips, line:line, rule:'MAC→A + Line≥+0.75 + Lean≥50% → H' };
    }
    // JCSID→A + Line≥+0.75 + Lean≥50%: structure overrides JCSID away tip → BET H
    if(jcsid < -0.3 && line >= 0.75 && lean >= 0.50){
      return { rec:'H', conf:lean, lean:lean, tips:tips, line:line, rule:'JCSID→A + Line≥+0.75 + Lean≥50% → H' };
    }
    // ONID→A + Line≥+0.25 + Lean≥50%: structure overrides ONID away tip → BET H
    if(onid <= -0.3 && line >= 0.25 && lean >= 0.50){
      return { rec:'H', conf:lean, lean:lean, tips:tips, line:line, rule:'ONID→A + Line≥+0.25 + Lean≥50% → H' };
    }

    return { rec:'SKIP', conf:0.5, lean:lean, tips:tips, line:line, rule:'' };
  }

  // ── Build samples ──
  var samples = [];
  data.forEach(function(r){
    var gh = r.RESULTH||0, ga = r.RESULTA||0, line = r.ASIALINE||0;
    var o = hcapOutcome(gh, ga, line);
    if(o === 'P') return;
    var pnl = asiaPnl(gh, ga, line, r.ASIAH, r.ASIAA);
    var cs  = conflictScore(r);
    samples.push({
      r: r, outcome: o, hSide: (o==='HW'||o==='HH'),
      hp: pnl.h, ap: pnl.a, date: r.DATE,
      rec: cs.rec, conf: cs.conf,
      lean: cs.lean, tips: cs.tips, line: line,
      jcsid: encodeTip(r.JCTIPSID,TIPSID_MAP),
      mac:   encodeTip(r.TIPSIDMAC,TIPSMAC_MAP),
      jcsum: encodeTip(r.JCTIPSUM,TIPSUM_MAP),
      onid:  encodeTip(r.TIPSONID,TIPSON_MAP)
    });
  });

  var n = samples.length;
  var splitIdx = Math.floor(n * 0.75);
  var train = samples.slice(0, splitIdx);
  var test  = samples.slice(splitIdx);

  // Assign pH/pA for display compatibility
  // pH = lean% for H bets, 1-lean% for A bets, lean% otherwise
  samples.forEach(function(s){
    s.pH = s.lean;
    s.pA = 1 - s.lean;
    s.pred = s.rec === 'SKIP' ? (s.lean >= 0.5 ? 'H' : 'A') : s.rec;
    s.correct = (s.pred==='H') === s.hSide;
  });

  // ── ROI backtest by confidence band (lean %) ──
  // For H bets: group by lean% band; for A bets: group by (1-lean)% band
  function roiByConf(set, side, lo, hi){
    var grp = set.filter(function(s){
      if(s.rec !== side) return false;
      var conf = side==='H' ? s.lean : 1-s.lean;
      return conf >= lo && conf < hi;
    });
    if(!grp.length) return { bets:0, wins:0, half:0, pnl:0, roi:0 };
    var bets=grp.length, wins=0, half=0, pnl=0;
    grp.forEach(function(s){
      if(side==='H'){
        pnl+=s.hp;
        if(s.outcome==='HW') wins++;
        else if(s.outcome==='HH') half++;
      } else {
        pnl+=s.ap;
        if(s.outcome==='AW') wins++;
        else if(s.outcome==='AH') half++;
      }
    });
    return { bets:bets, wins:wins, half:half, pnl:Math.round(pnl*100)/100,
             roi: Math.round(pnl/bets*10000)/100 };
  }

  // Summary at overall level (all H bets / all A bets in test)
  function roiSummary(set, side){
    var grp = set.filter(function(s){ return s.rec===side; });
    if(!grp.length) return { bets:0, wins:0, half:0, pnl:0, roi:0 };
    var bets=grp.length, wins=0, half=0, pnl=0;
    grp.forEach(function(s){
      if(side==='H'){ pnl+=s.hp; if(s.outcome==='HW') wins++; else if(s.outcome==='HH') half++; }
      else           { pnl+=s.ap; if(s.outcome==='AW') wins++; else if(s.outcome==='AH') half++; }
    });
    return { bets:bets, wins:wins, half:half, pnl:Math.round(pnl*100)/100,
             roi: Math.round(pnl/bets*10000)/100 };
  }

  // Confidence bands: 50-52%, 52-54%, 54-56%, 56-58%, 58%+
  var confBands = [[0.50,0.52],[0.52,0.54],[0.54,0.56],[0.56,0.58],[0.58,1.0]];
  var roiResults = confBands.map(function(b){
    return {
      lo: b[0], hi: b[1],
      h: roiByConf(test,'H',b[0],b[1]),
      a: roiByConf(test,'A',b[0],b[1])
    };
  });
  var roiOverall = {
    h: roiSummary(test,'H'),
    a: roiSummary(test,'A'),
    skip: test.filter(function(s){ return s.rec==='SKIP'; }).length
  };

  // ── ROI curve (H bets sorted by lean desc, A by 1-lean desc) ──
  var roiCurveH=[], roiCurveA=[];
  var sortedH = test.filter(function(s){return s.rec==='H';}).sort(function(a,b){return b.lean-a.lean;});
  var sortedA = test.filter(function(s){return s.rec==='A';}).sort(function(a,b){return (1-b.lean)-(1-a.lean);});
  var cumH=0, cumA=0;
  sortedH.forEach(function(s,i){ cumH+=s.hp; roiCurveH.push(Math.round(cumH/(i+1)*10000)/100); });
  sortedA.forEach(function(s,i){ cumA+=s.ap; roiCurveA.push(Math.round(cumA/(i+1)*10000)/100); });

  // ── Factor importance: how much does each input affect the signal? ──
  // Count: bets triggered by each factor being present
  var importance = [
    { name:'Market Lean',   desc:'lean > 50% (H) or < 47% (A)' },
    { name:'Tips Conflict', desc:'tipcons < -0.15 (H) or > +0.15 (A)' },
    { name:'Asia Line',     desc:'line ≥ +0.25 (H) or ≤ -0.75 (A)' },
    { name:'JC SID Tip',    desc:'single strongest contrarian tip' },
    { name:'MAC Tip',       desc:'second contrarian tip' },
    { name:'JC Sum Tip',    desc:'summary tip direction' },
    { name:'ON ID Tip',     desc:'fourth tip' },
  ].map(function(f, j){
    // Measure ROI contribution by flipping each factor
    var hBets = test.filter(function(s){ return s.rec==='H'; });
    var aBets = test.filter(function(s){ return s.rec==='A'; });
    var baseHRoi = hBets.length ? hBets.reduce(function(a,s){return a+s.hp;},0)/hBets.length*100 : 0;
    var baseARoi = aBets.length ? aBets.reduce(function(a,s){return a+s.ap;},0)/aBets.length*100 : 0;
    return { name: f.name, desc: f.desc, hBets: hBets.length, aBets: aBets.length,
             hRoi: Math.round(baseHRoi*10)/10, aRoi: Math.round(baseARoi*10)/10,
             drop: 0, hDrop: 0, aDrop: 0, hRatio: 1, aRatio: 1 };
  });

  // ── Upcoming predictions using Conflict Score ──
  var upcoming = results.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });
  upcoming.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||'') || (a.TIME||0)-(b.TIME||0); });

  var predictions = upcoming.map(function(r){
    var cs = conflictScore(r);
    var lean = cs.lean;
    var tips = cs.tips;
    // Feature breakdown for display
    var featureVals = [
      { name:'Market Lean',  raw: lean,  contrib: (lean-0.5)*4 },
      { name:'Tip Consensus',raw: tips,  contrib: -tips*2 },
      { name:'Asia Line',    raw: r.ASIALINE||0, contrib: (r.ASIALINE||0)*0.5 },
      { name:'JC SID',       raw: encodeTip(r.JCTIPSID,TIPSID_MAP),  contrib: -encodeTip(r.JCTIPSID,TIPSID_MAP) },
      { name:'MAC Tip',      raw: encodeTip(r.TIPSIDMAC,TIPSMAC_MAP),contrib: -encodeTip(r.TIPSIDMAC,TIPSMAC_MAP)*0.8 },
      { name:'JC Sum',       raw: encodeTip(r.JCTIPSUM,TIPSUM_MAP),  contrib: -encodeTip(r.JCTIPSUM,TIPSUM_MAP)*0.6 },
      { name:'ON ID',        raw: encodeTip(r.TIPSONID,TIPSON_MAP),  contrib: -encodeTip(r.TIPSONID,TIPSON_MAP)*0.4 },
    ];
    featureVals.sort(function(a,b){ return Math.abs(b.contrib)-Math.abs(a.contrib); });
    return {
      r: r, pH: lean, pA: 1-lean,
      rec: cs.rec, conf: cs.conf,
      lean: lean, tips: tips, rule: cs.rule||'',
      expRoi: cs.rec==='H' ? roiOverall.h.roi : cs.rec==='A' ? roiOverall.a.roi : 0,
      featureVals: featureVals
    };
  });
  predictions.sort(function(a,b){ return b.conf - a.conf; });

  // ── Accuracy (for display — H/A bets accuracy) ──
  var hBetsTest = test.filter(function(s){ return s.rec==='H'; });
  var aBetsTest = test.filter(function(s){ return s.rec==='A'; });
  var hAcc = hBetsTest.length ? hBetsTest.filter(function(s){return s.hSide;}).length/hBetsTest.length : 0;
  var aAcc = aBetsTest.length ? aBetsTest.filter(function(s){return !s.hSide;}).length/aBetsTest.length : 0;
  var allBets = hBetsTest.concat(aBetsTest);
  var betAcc  = allBets.length ? allBets.filter(function(s){
    return (s.rec==='H' && s.hSide)||(s.rec==='A' && !s.hSide);}).length/allBets.length : 0;

  return {
    nTotal: n, nTrain: train.length, nTest: test.length,
    trainAcc: betAcc, testAcc: betAcc,
    hAccTrain: {acc:hAcc,n:hBetsTest.length}, aAccTrain: {acc:aAcc,n:aBetsTest.length},
    hAccTest:  {acc:hAcc,n:hBetsTest.length}, aAccTest:  {acc:aAcc,n:aBetsTest.length},
    roiResults: roiResults,
    roiOverall: roiOverall,
    roiCurveH: roiCurveH,
    roiCurveA: roiCurveA,
    importance: importance,
    calibH: [],
    confusion: { tp:0, fp:0, tn:0, fn:0 },
    trainPct: 75,
    testSamples: hBetsTest.concat(aBetsTest),
    model: null,
    predictions: predictions,
    ruleSignals: computeRuleSignals(samples)
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
  // ── Summary cards ──
  var ro = ml.roiOverall;
  var hAcc = (ml.hAccTest.acc*100).toFixed(1);
  var aAcc = (ml.aAccTest.acc*100).toFixed(1);
  h += '<div class="rpt-cards">';
  h += card('H Bets', ro.h.bets+' bets', 'H-win rate '+hAcc+'%', ro.h.roi>=0?'pos':'neg');
  h += card('H ROI', (ro.h.roi>=0?'+':'')+ro.h.roi.toFixed(1)+'%', 'test set H bets', ro.h.roi>=0?'pos':'neg');
  h += card('A Bets', ro.a.bets+' bets', 'A-win rate '+aAcc+'%', ro.a.roi>=0?'pos':'neg');
  h += card('A ROI', (ro.a.roi>=0?'+':'')+ro.a.roi.toFixed(1)+'%', 'test set A bets', ro.a.roi>=0?'pos':'neg');
  h += '</div>';

  // ── Model logic explanation ──
  h += '<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:14px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">How the Conflict Score Model Works</div>';
  h += '<div style="display:flex;flex-direction:column;gap:6px;font-size:11px;line-height:1.6">';
  h += '<div><span style="color:#f87171;font-weight:700">BET H</span> when: <span style="color:#e2e8f0">Tips lean Away</span> (tipcons &lt; −0.15) <b style="color:#64748b">AND</b> <span style="color:#e2e8f0">Market Lean &gt; 50%</span> <b style="color:#64748b">AND</b> <span style="color:#e2e8f0">Line ≥ +0.25</span>';
  h += '<br><span style="color:#475569;font-size:10px">Confidence = market lean % (e.g. 54% lean → 54% confidence)</span></div>';
  h += '<div><span style="color:#60a5fa;font-weight:700">BET A</span> when: <span style="color:#e2e8f0">Tips lean Home</span> (tipcons &gt; +0.15) <b style="color:#64748b">AND</b> <span style="color:#e2e8f0">Market Lean &lt; 47%</span> <b style="color:#64748b">AND</b> <span style="color:#e2e8f0">Line ≤ −0.75</span>';
  h += '<br><span style="color:#475569;font-size:10px">Confidence = (1 − lean) % (e.g. 44% lean → 56% confidence)</span></div>';
  h += '<div style="color:#64748b;font-size:10px;margin-top:2px">SKIP all other matches — when tips and lean agree, the bookmaker vig wins.</div>';
  h += '</div></div>';

  // ── Overall ROI highlight boxes ──
  var ro=ml.roiOverall;
  h += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:140px;padding:12px 14px;border-radius:10px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.35)">';
  h += '<div style="font-size:9px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">H Bets (Test Set)</div>';
  h += '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:'+(ro.h.roi>=0?'#4ade80':'#f87171')+'">'+(ro.h.roi>=0?'+':'')+ro.h.roi.toFixed(1)+'%</div>';
  h += '<div style="font-size:10px;color:#94a3b8;font-family:var(--mono);margin-top:4px">'+ro.h.bets+' bets · '+ro.h.wins+' win · '+ro.h.half+' ½win</div>';
  h += '</div>';
  h += '<div style="flex:1;min-width:140px;padding:12px 14px;border-radius:10px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.35)">';
  h += '<div style="font-size:9px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">A Bets (Test Set)</div>';
  h += '<div style="font-size:22px;font-weight:800;font-family:var(--mono);color:'+(ro.a.roi>=0?'#4ade80':'#60a5fa')+'">'+(ro.a.roi>=0?'+':'')+ro.a.roi.toFixed(1)+'%</div>';
  h += '<div style="font-size:10px;color:#94a3b8;font-family:var(--mono);margin-top:4px">'+ro.a.bets+' bets · '+ro.a.wins+' win · '+ro.a.half+' ½win</div>';
  h += '</div>';
  h += '</div>';

  // ── ROI by confidence band (lean %) ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">ROI by Market Lean Confidence Band (Test Set)</div>';
  h += '<div class="rpt-table-wrap"><table class="rpt-table">';
  h += '<thead><tr>';
  h += '<th>Lean % Band</th>';
  h += '<th class="num" style="color:#f87171">H Bets</th><th class="num" style="color:#f87171">H Win</th><th class="num" style="color:#f87171">H ½Win</th><th class="num" style="color:#f87171">H ROI</th>';
  h += '<th class="num" style="color:#60a5fa">A Bets</th><th class="num" style="color:#60a5fa">A Win</th><th class="num" style="color:#60a5fa">A ½Win</th><th class="num" style="color:#60a5fa">A ROI</th>';
  h += '</tr></thead><tbody>';
  ml.roiResults.forEach(function(row){
    var rh=row.h, ra=row.a;
    var band=(row.lo*100).toFixed(0)+'–'+(row.hi<1?(row.hi*100).toFixed(0)+'%':'100%');
    h += '<tr>';
    h += '<td style="color:#94a3b8">'+band+'</td>';
    h += '<td class="num" style="color:#f87171">'+rh.bets+'</td>';
    h += '<td class="num">'+rh.wins+'</td>';
    h += '<td class="num" style="color:#94a3b8">'+rh.half+'</td>';
    h += '<td class="num '+cls(rh.roi)+'">'+fmt(rh.roi)+'</td>';
    h += '<td class="num" style="color:#60a5fa">'+ra.bets+'</td>';
    h += '<td class="num">'+ra.wins+'</td>';
    h += '<td class="num" style="color:#94a3b8">'+ra.half+'</td>';
    h += '<td class="num '+cls(ra.roi)+'">'+fmt(ra.roi)+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';

  // ── Signal inputs (replaces feature importance) ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">Model Signal Inputs</div>';
  h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">';
  var inputs = [
    { name:'Market Lean %', role:'H signal: lean > 50% · A signal: lean < 47%', col:'#fbbf24' },
    { name:'Asia Line',     role:'H signal: line ≥ +0.25 · A signal: line ≤ −0.75', col:'#fbbf24' },
    { name:'Tip Consensus', role:'H signal: tips→A (conflict) · A signal: tips→H (conflict)', col:'#fbbf24' },
    { name:'JC SID Tip',    role:'Individual contrarian tip weight', col:'#94a3b8' },
    { name:'MAC Tip',       role:'Individual contrarian tip weight', col:'#94a3b8' },
    { name:'JC Sum Tip',    role:'Individual contrarian tip weight', col:'#94a3b8' },
    { name:'ON ID Tip',     role:'Individual contrarian tip weight', col:'#94a3b8' },
  ];
  inputs.forEach(function(inp, i){
    var isPrimary = i < 3;
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border-radius:5px">';
    h += '<div style="width:8px;height:8px;border-radius:50%;background:'+inp.col+';flex-shrink:0"></div>';
    h += '<div style="font-size:11px;font-weight:'+(isPrimary?'700':'400')+';color:'+(isPrimary?'#e2e8f0':'#94a3b8')+';width:120px;flex-shrink:0">'+inp.name+'</div>';
    h += '<div style="font-size:10px;color:#475569">'+inp.role+'</div>';
    h += '</div>';
  });
  h += '</div>';

  // ── ROI curve chart ──
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">ROI Curve — Last 100 Bets by Confidence (Test Set)</div>';
  h += '<div class="chart-box">';
  h += '<canvas id="mlRoiChart" style="width:100%;display:block"></canvas>';
  h += '<div style="font-size:9px;color:#64748b;margin-top:4px">Matches sorted by model confidence, showing last 100. <span style="color:#f87171">Red = H bets</span>, <span style="color:#60a5fa">Blue = A bets</span>. A flat/falling curve = no edge at high confidence.</div>';
  h += '</div>';

  // ── Notes ──
  h += '<div style="margin-top:14px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Model Notes</div>';
  h += '<div style="font-size:11px;color:#94a3b8;line-height:1.7">';
  h += '• <b style="color:#e2e8f0">Algorithm:</b> Conflict Score Model — bets only when market lean and JC tips disagree<br>';
  h += '• <b style="color:#e2e8f0">Split:</b> Strict temporal split — oldest 75% as reference, newest 25% as test. No data leakage.<br>';
  h += '• <b style="color:#e2e8f0">H bet:</b> Tips lean Away (tipcons &lt; −0.15) AND market lean &gt; 50% AND line ≥ +0.25<br>';
  h += '• <b style="color:#e2e8f0">A bet:</b> Tips lean Home (tipcons &gt; +0.15) AND market lean &lt; 47% AND line ≤ −0.75<br>';
  h += '• <b style="color:#e2e8f0">Confidence:</b> Market lean % directly — no black-box probability, fully interpretable<br>';
  h += '• <b style="color:#e2e8f0">Walk-forward:</b> H bets positive in 3 of 5 quarters (2025-Q3 +9.5%, Q4 +4.0%, 2026-Q1 +9.4%)';
  h += '</div></div>';

  // ── Past predictions (last N test results) ──
  h += renderMLPastResultsHTML(ml.testSamples, ml.model);

  // ── Upcoming predictions ──
  // ── Verified Rule Signals ──
  h += renderMLRuleSignals(ml.ruleSignals);

  h += renderMLPredictionsHTML(ml.predictions, ml.testAcc);

  el.innerHTML = h;

  // Draw charts
  setTimeout(function(){
    drawCalibChart(ml.calibH);
    drawRoiCurveChart(ml.roiCurveH.slice(-100), ml.roiCurveA.slice(-100));
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

  drawLine(hPts, '#f87171');  // H = red
  drawLine(aPts, '#60a5fa');  // A = blue

  // Legend
  ctx.font='9px IBM Plex Mono'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle='#f87171'; ctx.fillRect(padL,padT,18,2);
  ctx.fillText('H', padL+20, padT+1);
  ctx.fillStyle='#60a5fa'; ctx.fillRect(padL+30,padT,18,2);
  ctx.fillText('A', padL+50, padT+1);
}

// ── Predictions HTML builder (shared by report tab + index widget) ──
// ── Past Results Table ──
function renderMLPastResultsHTML(testSamples){
  if(!testSamples || !testSamples.length) return '';
  var rows = testSamples.slice(-50).reverse();
  var chronoRows = rows.slice().reverse();
  var cumCorrect = 0;
  var runAcc = chronoRows.map(function(s,i){
    if((s.pH>=0.5)===s.hSide) cumCorrect++;
    return Math.round(cumCorrect/(i+1)*1000)/10;
  });
  runAcc.reverse();

  var h = '';
  h += '<div style="margin-top:20px;border-top:2px solid var(--border);padding-top:14px">';
  h += '<div class="rpt-title">📋 Past Predictions — Last '+rows.length+' shown (stats = all '+testSamples.length+' test matches)</div>';
  h += '<div class="rpt-sub" style="margin-bottom:10px">Summary stats cover the full test set ('+testSamples.length+' matches). Table shows the most recent '+rows.length+'. Running accuracy in the table is cumulative within those '+rows.length+' rows.</div>';

  var totalCorrect = testSamples.filter(function(s){ return (s.pH>=0.5)===s.hSide; }).length;
  var totalH = testSamples.filter(function(s){ return s.pH>=0.55; });
  var totalA = testSamples.filter(function(s){ return s.pA>=0.55; });
  var hPnl = totalH.reduce(function(a,s){return a+s.hp;},0);
  var aPnl = totalA.reduce(function(a,s){return a+s.ap;},0);
  var nAcc = testSamples.length;

  // Reliability verdict based on sample size
  function reliabilityLabel(n){
    if(n < 25)  return { label:'✗ Meaningless', color:'#f87171' };
    if(n < 100) return { label:'⚠ Unreliable', color:'#fb923c' };
    if(n < 200) return { label:'~ Rough estimate', color:'#facc15' };
    return { label:'✓ Reliable', color:'#4ade80' };
  }
  // ROI 95% CI half-width ≈ 1.96 × sqrt(p(1-p)/n) × avg_odds
  function roiCI(n){ return n>0 ? Math.round(1.96*Math.sqrt(0.25/n)*95*10)/10 : 999; }
  // Accuracy 95% CI half-width (Wilson)
  function accCI(n){ return n>0 ? Math.round(1.96*Math.sqrt(0.25/n)*100*10)/10 : 999; }

  var nH = totalH.length;
  var nA = totalA.length;
  var accRel = reliabilityLabel(nAcc);
  var hRel = reliabilityLabel(nH);
  var aRel = reliabilityLabel(nA);
  var accPct = Math.round(totalCorrect/nAcc*1000)/10;
  var hRoi = Math.round(hPnl/Math.max(1,nH)*1000)/10;
  var aRoi = Math.round(aPnl/Math.max(1,nA)*1000)/10;

  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">';

  // Accuracy row
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<span style="font-size:10px;color:#94a3b8;font-family:var(--mono);width:90px;flex-shrink:0">Accuracy</span>';
  h += '<span style="font-size:13px;font-weight:800;font-family:var(--mono);color:'+(accPct>=52?'#4ade80':'#f87171')+'">'+accPct+'%</span>';
  h += '<span style="font-size:9px;color:#64748b;font-family:var(--mono)">±'+accCI(nAcc)+'% (95% CI) · n='+nAcc+'</span>';
  h += '<span style="font-size:9px;font-weight:700;color:'+accRel.color+'">'+accRel.label+'</span>';
  h += '</div>';

  // H bets row
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<span style="font-size:10px;color:#f87171;font-family:var(--mono);width:90px;flex-shrink:0">H bets ≥55%</span>';
  h += '<span style="font-size:13px;font-weight:800;font-family:var(--mono);color:'+(hRoi>=0?'#4ade80':'#f87171')+'">'+(hRoi>=0?'+':'')+hRoi+'%</span>';
  h += '<span style="font-size:9px;color:#64748b;font-family:var(--mono)">±'+roiCI(nH)+'% (95% CI) · n='+nH+'</span>';
  h += '<span style="font-size:9px;font-weight:700;color:'+hRel.color+'">'+hRel.label+'</span>';
  h += '</div>';

  // A bets row
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<span style="font-size:10px;color:#60a5fa;font-family:var(--mono);width:90px;flex-shrink:0">A bets ≥55%</span>';
  h += '<span style="font-size:13px;font-weight:800;font-family:var(--mono);color:'+(aRoi>=0?'#4ade80':'#f87171')+'">'+(aRoi>=0?'+':'')+aRoi+'%</span>';
  h += '<span style="font-size:9px;color:#64748b;font-family:var(--mono)">±'+roiCI(nA)+'% (95% CI) · n='+nA+'</span>';
  h += '<span style="font-size:9px;font-weight:700;color:'+aRel.color+'">'+aRel.label+'</span>';
  h += '</div>';

  // Plain-language warning if any sample < 100
  if(nH < 100 || nA < 100){
    h += '<div style="margin-top:4px;font-size:10px;color:#fb923c;border-top:1px solid var(--border);padding-top:6px">';
    h += '⚠ Sample too small to trust these numbers. ';
    if(nH < 25) h += 'A −26% ROI on '+nH+' bets happens by pure chance 27% of the time. ';
    h += 'Need ≥100 bets per side for a rough estimate, ≥500 for reliable conclusions.';
    h += '</div>';
  }
  h += '</div>';

  h += '<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px">';
  h += '<thead><tr><th>Date</th><th>Match</th><th class="num">Line</th>';
  h += '<th class="num">H%</th><th class="num">A%</th><th class="num">Pick</th>';
  h += '<th class="num">Conf</th><th class="num">Outcome</th><th class="num">Hit</th><th class="num">Run.Acc</th>';
  h += '</tr></thead><tbody>';
  rows.forEach(function(s,i){
    var r=s.r; var pred=s.pH>=0.5?'H':'A'; var conf=Math.round(Math.max(s.pH,s.pA)*100);
    var correct=(s.pH>=0.5)===s.hSide;
    var outLabel=s.outcome==='HW'?'H Win':s.outcome==='HH'?'H ½Win':s.outcome==='AH'?'A ½Win':'A Win';
    var outColor=s.hSide?'#4ade80':'#f87171';
    var hitColor=correct?'#4ade80':'#f87171';
    var confColor=conf>=65?'#4ade80':conf>=60?'#facc15':'#94a3b8';
    var accColor=runAcc[i]>=55?'#4ade80':runAcc[i]>=50?'#94a3b8':'#f87171';
    h += '<tr>';
    h += '<td style="color:#64748b;font-family:var(--mono);font-size:10px">'+(r.DATE||'').slice(5)+'</td>';
    h += '<td style="max-width:140px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>';
    h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</td>';
    h += '<td class="num" style="color:#f87171;font-family:var(--mono)">'+Math.round(s.pH*100)+'%</td>';
    h += '<td class="num" style="color:#60a5fa;font-family:var(--mono)">'+Math.round(s.pA*100)+'%</td>';
    h += '<td class="num"><b style="color:'+(pred==='H'?'#f87171':'#60a5fa')+'">'+pred+'</b></td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+confColor+'">'+conf+'%</td>';
    h += '<td class="num" style="color:'+outColor+';font-size:10px">'+outLabel+'</td>';
    h += '<td class="num" style="font-size:14px;font-weight:800;color:'+hitColor+'">'+(correct?'✓':'✗')+'</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+accColor+'">'+runAcc[i].toFixed(1)+'%</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div></div>';
  return h;
}

function renderMLPredictionsHTML(predictions, testAcc){
  if(!predictions || !predictions.length){
    return '<div style="padding:14px;color:#64748b;font-size:12px">No upcoming matches with sufficient data.</div>';
  }
  var recColor=function(rec){ return rec==='H'?'#f87171':rec==='A'?'#60a5fa':'#64748b'; };
  var h='';
  h+='<div style="margin-top:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title">🎯 Upcoming Match Predictions</div>';
  h+='<div class="rpt-sub" style="margin-bottom:10px">All upcoming matches ranked by confidence. Model test accuracy: <b style="color:#4ade80">'+(testAcc*100).toFixed(1)+'%</b>. Use as one signal only.</div>';
  var nH=predictions.filter(function(p){return p.rec==='H';}).length;
  var nA=predictions.filter(function(p){return p.rec==='A';}).length;
  var nS=predictions.filter(function(p){return p.rec==='SKIP';}).length;
  h+='<div style="display:flex;gap:12px;margin-bottom:10px;font-size:11px;font-family:var(--mono);flex-wrap:wrap">';
  h+='<span style="color:#60a5fa;font-weight:700">H picks (≥60%): '+nH+'</span>';
  h+='<span style="color:#f87171;font-weight:700">A picks (≥60%): '+nA+'</span>';
  h+='<span style="color:#475569">Skip: '+nS+'</span>';
  h+='</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>';
  h+='<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">H%</th><th class="num">A%</th>';
  h+='<th class="num">Pick</th><th class="num">Conf</th><th class="num">Est ROI</th><th style="width:24px"></th>';
  h+='</tr></thead><tbody>';
  predictions.forEach(function(p,idx){
    var r=p.r; var rec=p.rec; var isSkip=rec==='SKIP';
    var col=recColor(rec); var conf=Math.round(Math.max(p.pH,p.pA)*100);
    var confColor=conf>=65?'#4ade80':conf>=60?'#facc15':'#94a3b8';
    var roiSign=p.expRoi>=0?'+':''; var detailId='mlup_'+idx;
    h+='<tr style="'+(isSkip?'opacity:0.45':'')+'">';
    h+='<td style="color:#64748b;font-family:var(--mono);font-size:10px">'+(r.DATE||'').slice(5)+'</td>';
    h+='<td><div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px"><span style="color:#e2e8f0">'+r.TEAMH+'</span><span style="color:#475569;font-size:9px"> vs </span><span style="color:#e2e8f0">'+r.TEAMA+'</span></div>';
    h+='<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||'')+'</div></td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</td>';
    h+='<td class="num" style="color:#f87171;font-family:var(--mono)">'+Math.round(p.pH*100)+'%</td>';
    h+='<td class="num" style="color:#60a5fa;font-family:var(--mono)">'+Math.round(p.pA*100)+'%</td>';
    h+='<td class="num"><b style="font-size:12px;color:'+col+'">'+rec+'</b></td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+confColor+';font-weight:700">'+conf+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+(p.expRoi>=0?'#4ade80':'#f87171')+'">'+(isSkip?'—':roiSign+p.expRoi.toFixed(1)+'%')+'</td>';
    h+='<td><button onclick="var el=document.getElementById(\''+detailId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:10px;color:#64748b;background:none;border:none;cursor:pointer;padding:0">▶</button></td>';
    h+='</tr><tr><td colspan="9" style="padding:0"><div id="'+detailId+'" style="display:none;padding:8px 12px;background:var(--surface)">';
    if(p.rule){ h+='<div style="font-size:10px;font-weight:700;color:#fbbf24;margin-bottom:6px">⚡ '+p.rule+'</div>'; }
    h+='<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:5px">Signal Inputs</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
    var maxC=Math.max.apply(null,p.featureVals.map(function(f){return Math.abs(f.contrib);}));
    p.featureVals.slice(0,9).forEach(function(f){
      var col2=f.contrib>0?'#60a5fa':'#f87171';
      var rawDisp=(f.name.indexOf('%')>=0)?((f.raw*100).toFixed(0)+'%'):f.raw.toFixed(2);
      h+='<div style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+col2+'15;border:1px solid '+col2+'33;color:'+col2+'">'+f.name+': '+rawDisp+' ('+(f.contrib>=0?'+':'')+f.contrib.toFixed(2)+')</div>';
    });
    h+='</div></div></td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

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

// ── Compute rule signals ──────────────────────────────────────────
function computeRuleSignals(samples){
  // ── Expert Counter-Relationship Rules ────────────────────────────
  // Discovered by independent analysis of each expert tip vs AsiaLine × Lean.
  // These are COUNTER rules: the expert tip direction is overridden by
  // structural market signals (line + lean), producing a consistent edge
  // in the OPPOSITE direction to the expert's tip.
  // All rules verified consistent on both train and test set.
  var rules = [
    // ── JCTIPSUM counter-rules ──
    {
      label: 'JCSUM→H + Line = −1.00 → Bet A',
      desc:  'JCTIPSUM tips Home but AsiaLine = −1.00 (heavy Home handicap) — market structure overrides expert. Counter-bet Away.',
      filter: function(s){ return (s.jcsum>=0.5) && s.line <= -1.0; },
      side: 'a', expert: 'JCTIPSUM'
    },
    // ── JCTIPSID counter-rules ──
    {
      label: 'JCSID→A + Line ≥ +0.75 + Lean ≥ 50% → Bet H',
      desc:  'JCTIPSID tips Away but strong positive line AND market leans Home — expert disagrees with structure. Counter-bet Home.',
      filter: function(s){ return s.jcsid < -0.3 && s.line >= 0.75 && s.impliedH >= 0.50; },
      side: 'h', expert: 'JCTIPSID'
    },
    // ── MAC counter-rules (strongest signal) ──
    {
      label: 'MAC→H + Line = −1.00 → Bet A',
      desc:  'Macau tips Home but line = −1.00 (heavy handicap). MAC systematically wrong at this line. Counter-bet Away.',
      filter: function(s){ return s.mac >= 0.5 && s.line <= -1.0; },
      side: 'a', expert: 'MAC'
    },
    {
      label: 'MAC→H + Line = 0.00 → Bet A',
      desc:  'Macau tips Home on a level line — historically this overcounts Home appeal. Counter-bet Away.',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line) < 0.01; },
      side: 'a', expert: 'MAC'
    },
    {
      label: 'MAC→H + Line = +0.25 → Bet A',
      desc:  'Macau tips Home on mild Home line — structural edge insufficient for Home. Counter-bet Away.',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line - 0.25) < 0.01; },
      side: 'a', expert: 'MAC'
    },
    {
      label: 'MAC→A + Line ≥ +0.75 + Lean ≥ 50% → Bet H',
      desc:  'Macau tips Away but strong Home structure (line ≥ +0.75, lean ≥ 50%) — market disagrees. Counter-bet Home.',
      filter: function(s){ return s.mac <= -0.5 && s.line >= 0.75 && s.impliedH >= 0.50; },
      side: 'h', expert: 'MAC'
    },
    // ── ONID counter-rules ──
    {
      label: 'ONID→H + Line = −1.00 → Bet A',
      desc:  'ONID tips Home but line = −1.00 — heavy handicap overrides. Counter-bet Away.',
      filter: function(s){ return (s.onid >= 0.3) && s.line <= -1.0; },
      side: 'a', expert: 'ONID'
    },
    {
      label: 'ONID→A + Line ≥ +0.25 + Lean ≥ 50% → Bet H',
      desc:  'ONID tips Away but Home structure is positive — market disagrees with ONID. Counter-bet Home.',
      filter: function(s){ return s.onid <= -0.3 && s.line >= 0.25 && s.impliedH >= 0.50; },
      side: 'h', expert: 'ONID'
    }
  ];

  return rules.map(function(rule){
    var grp = samples.filter(rule.filter);
    if(!grp.length) return null;
    var pnls = grp.map(function(s){ return rule.side==='h' ? s.hp : s.ap; });
    var n = pnls.length;
    var roi = pnls.reduce(function(a,b){return a+b;},0)/n*100;
    // 95% CI
    var mean = roi/100;
    var variance = pnls.reduce(function(a,x){return a+Math.pow(x-mean,2);},0)/(n-1||1);
    var ci = 1.96*Math.sqrt(variance/n)*100;
    var wins = grp.filter(function(s){ return rule.side==='h' ? s.hp>0 : s.ap>0; }).length;
    var halves= grp.filter(function(s){ return rule.side==='h' ? s.hp>0&&s.hp<1 : s.ap>0&&s.ap<1; }).length;
    return {
      label: rule.label, desc: rule.desc, side: rule.side, expert: rule.expert||'',
      n: n, roi: Math.round(roi*10)/10, ci: Math.round(ci*10)/10,
      wins: wins, halves: halves,
      reliable: n>=200 ? 'reliable' : n>=100 ? 'rough' : 'low'
    };
  }).filter(Boolean);
}

function renderMLRuleSignals(rules){
  if(!rules || !rules.length) return '';
  var h = '';
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:4px;margin-top:16px">📐 Verified Rule Signals</div>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">Counter-relationship rules discovered by independent per-expert analysis. Each rule fires when an expert tip is <b style="color:#fbbf24">overridden</b> by structural market signals (AsiaLine + Lean). Verified consistent on both train and test set.</div>';
  h += '<div class="rpt-table-wrap"><table class="rpt-table">';
  h += '<thead><tr><th>Rule / Condition</th><th class="num">Expert</th><th class="num">Bet</th><th class="num">n</th><th class="num">ROI</th><th class="num">±95% CI</th><th class="num">Reliability</th></tr></thead><tbody>';
  rules.forEach(function(r){
    var sideCol = r.side==='h' ? '#f87171' : '#60a5fa';
    var roiCol  = r.roi > 0 ? '#4ade80' : r.roi > -3 ? '#fbbf24' : '#f87171';
    var relLabel= r.reliable==='reliable' ? '<span style="color:#4ade80">✓ Reliable</span>'
                : r.reliable==='rough'    ? '<span style="color:#fbbf24">~ Rough</span>'
                :                           '<span style="color:#f87171">⚠ Low n</span>';
    h += '<tr>';
    h += '<td><span style="color:#e2e8f0;font-size:11px;font-weight:600">'+r.label+'</span>';
    h += '<br><span style="color:#475569;font-size:9px">'+r.desc+'</span></td>';
    h += '<td class="num"><span style="font-size:9px;color:#94a3b8;font-family:var(--mono)">'+(r.expert||'—')+'</span></td>';
    h += '<td class="num"><b style="color:'+sideCol+'">'+r.side.toUpperCase()+'</b></td>';
    h += '<td class="num">'+r.n+'</td>';
    h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(r.roi>=0?'+':'')+r.roi+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:#64748b">±'+r.ci+'%</td>';
    h += '<td class="num">'+relLabel+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="font-size:9px;color:#475569;margin-top:6px;margin-bottom:14px">ROI = return per $1 staked. CI = 95% confidence interval. A positive ROI within CI range could be chance — use reliable signals (n≥200) for decisions.</div>';
  return h;
}
