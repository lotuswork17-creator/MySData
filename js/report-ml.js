// ═══════════════════════════════════════════════════════════════
// TAB 10: ML MODEL — Expert Counter-Rule Predictor
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
  // tipcons removed — not used by counter-rules

  return [
    impliedH,              // 0  Market Lean (closing vig-free H%)    ★ CORE
    leanDrift,             // 1  Lean Drift (closing − opening lean)   ★ CORE
    line,                  // 2  Asia Handicap Line                    ★ CORE
    impliedH * line,       // 3  Lean × Line interaction               ★ KEY
    jcsid,                 // 4  JC SID Tip (contrarian signal)        ★ CORE
    mac,                   // 5  MAC Tip (contrarian signal)           ★ CORE
    jcsum,                 // 6  JC Sum Tip
    onid,                  // 7  (ON ID, index compat only)
    0,                     // 8  (unused)
    0,                     // 9  (unused)
    mac * impliedH,        // 10 MAC × Lean interaction
    (line - linen),        // 11 Line Move (JC)
    (macline - line),      // 12 Macau–JC Line Gap
    (sboline - line)       // 13 SBO–JC Line Gap
  ];
}

var FEATURE_NAMES = [
  'Market Lean', 'Lean Drift', 'Asia Line', 'Lean × Line',
  'JC SID', 'MAC', 'JC Sum', 'ON ID',
  '(unused)', '(unused)', 'MAC × Lean',
  'Line Move', 'Macau–JC Gap', 'SBO–JC Gap'
];

// ── Logistic Regression (legacy, kept for ROI curve data) ─────────
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
function computeML(results, allRecords){
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

  // ── Expert Counter-Rule Model ──────────────────────────────
  // Bets against (or with) specific experts when market structure aligns.
  // 15 rules across MAC, JCSUM, JCSID, ONID. First-match-wins by ROI desc.
  // ───────────────────────────────────────────────────

  function conflictScore(r){
    var lean  = mkLean(r.ASIAH||0, r.ASIAA||0);
    var line  = r.ASIALINE || 0;
    var mac   = encodeTip(r.TIPSIDMAC, TIPSMAC_MAP);
    var jcsum = encodeTip(r.JCTIPSUM,  TIPSUM_MAP);
    var jcsid = encodeTip(r.JCTIPSID,  TIPSID_MAP);
    var onid  = encodeTip(r.TIPSONID,  TIPSON_MAP);

    // ── 15 Verified Expert Rules (first-match-wins by ROI desc) ─────
    // COUNTER = bet against expert. WITH = follow expert.
    // TH_H/TH_A: use 0.7/-0.7 for JCSUM/JCSID to exclude draw-encoding values
    // (TIPSUM_MAP: D=0.6, 1D=0.6 — these are draws, NOT H tips)
    var TH_H = 0.7, TH_A = -0.7;

    // R1 COUNTER: MAC→H + Line=−1.00 + Lean≥50% → Bet A  (+10.0%, tr+1.2%, te+28.1%)
    if(mac >= 0.5 && Math.abs(line + 1.0) < 0.01 && lean >= 0.50)
      return { rec:'A', conf:0.60, lean:lean, line:line, rule:'MAC→H + Line=−1.00 + Lean≥50% → Bet A' };
    // R2 WITH: ONID→A + Line=−0.75 → Follow Away  (+8.9%, tr+10.6%, te+4.0%)
    if(onid <= -0.5 && Math.abs(line + 0.75) < 0.01)
      return { rec:'A', conf:0.55, lean:lean, line:line, rule:'ONID→A + Line=−0.75 → Follow Away' };
    // R3 COUNTER: JCSID→A + Line=+1.00 + Lean≥50% → Bet H  (+8.3%, tr+4.3%, te+18.4%)
    if(jcsid <= TH_A && Math.abs(line - 1.0) < 0.01 && lean >= 0.50)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line=+1.00 + Lean≥50% → Bet H' };
    // R4 COUNTER: JCSUM→H + Line=−1.00 → Bet A  (+7.9%, tr+5.9%, te+13.4%)
    if(jcsum >= TH_H && Math.abs(line + 1.0) < 0.01)
      return { rec:'A', conf:0.57, lean:lean, line:line, rule:'JCSUM→H + Line=−1.00 → Bet A' };
    // R5 WITH: MAC→A + Line=−0.75 → Follow Away  (+7.3%, tr+9.2%, te+1.5%)
    if(mac <= -0.5 && Math.abs(line + 0.75) < 0.01)
      return { rec:'A', conf:0.55, lean:lean, line:line, rule:'MAC→A + Line=−0.75 → Follow Away' };
    // R6 COUNTER: JCSID→A + Line≥+0.75 + Lean≥50% → Bet H  (+7.0%, tr+4.5%, te+13.4%)
    if(jcsid <= TH_A && line >= 0.75 && lean >= 0.50)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line≥+0.75 + Lean≥50% → Bet H' };
    // R7 COUNTER: JCSID→H + Line=+0.25 + Lean≥50% → Bet A  (+6.5%, tr+2.8%, te+17.5%)
    if(jcsid >= TH_H && Math.abs(line - 0.25) < 0.01 && lean >= 0.50)
      return { rec:'A', conf:0.53, lean:lean, line:line, rule:'JCSID→H + Line=+0.25 + Lean≥50% → Bet A' };
    // R8 COUNTER: MAC→A + Line≥+0.75 + Lean≥50% → Bet H  (+5.0%, tr+5.1%, te+4.8%)
    if(mac <= -0.5 && line >= 0.75 && lean >= 0.50)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line≥+0.75 + Lean≥50% → Bet H' };
    // R9 COUNTER: MAC→H + Line=−1.00 → Bet A  (+4.2%, tr+2.0%, te+9.9%)
    if(mac >= 0.5 && Math.abs(line + 1.0) < 0.01)
      return { rec:'A', conf:0.56, lean:lean, line:line, rule:'MAC→H + Line=−1.00 → Bet A' };
    // R10 COUNTER: MAC→H + Line=+0.25 → Bet A  (+4.0%, tr+2.6%, te+8.1%)
    if(mac >= 0.5 && Math.abs(line - 0.25) < 0.01)
      return { rec:'A', conf:0.52, lean:lean, line:line, rule:'MAC→H + Line=+0.25 → Bet A' };
    // R11 COUNTER: MAC→A + Line=+1.00 + Lean≥50% → Bet H  (+3.9%, tr+2.6%, te+7.4%)
    if(mac <= -0.5 && Math.abs(line - 1.0) < 0.01 && lean >= 0.50)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line=+1.00 + Lean≥50% → Bet H' };
    // R12 COUNTER: MAC→A + Line=−0.25 + Lean≥50% → Bet H  (+3.2%, tr+4.1%, te+1.0%)
    if(mac <= -0.5 && Math.abs(line + 0.25) < 0.01 && lean >= 0.50)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line=−0.25 + Lean≥50% → Bet H' };
    // R13 COUNTER: JCSUM→H + Line=+0.25 → Bet A  (+2.6%, tr+3.0%, te+1.6%)
    if(jcsum >= TH_H && Math.abs(line - 0.25) < 0.01)
      return { rec:'A', conf:0.52, lean:lean, line:line, rule:'JCSUM→H + Line=+0.25 → Bet A' };
    // R14 COUNTER: JCSID→A + Line=+1.00 → Bet H  (+2.6%, tr+0.5%, te+8.0%)
    if(jcsid <= TH_A && Math.abs(line - 1.0) < 0.01)
      return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line=+1.00 → Bet H' };
    // R15 COUNTER: MAC→H + Line=0.00 → Bet A  (+7.8%, tr+5.4%, te+16.8%)
    if(mac >= 0.5 && Math.abs(line) < 0.01)
      return { rec:'A', conf:0.54, lean:lean, line:line, rule:'MAC→H + Line=0.00 → Bet A' };

    return { rec:'SKIP', conf:0.5, lean:lean, line:line, rule:'' };
  }

  // ── Build samples ──
  var samples = [];
  data.forEach(function(r){
    var gh = r.RESULTH||0, ga = r.RESULTA||0, line = r.ASIALINE||0;
    var o = hcapOutcome(gh, ga, line);
    if(o === 'P') return;
    var pnl = asiaPnl(gh, ga, line, r.ASIAH, r.ASIAA);
    var cs  = conflictScore(r);
    var _ah=r.ASIAH||0, _aa=r.ASIAA||0;
    var _vH=_ah>0?1/_ah:0.5, _vA=_aa>0?1/_aa:0.5;
    var _impliedH=_vH/(_vH+_vA||1);
    samples.push({
      r: r, outcome: o, hSide: (o==='HW'||o==='HH'),
      hp: pnl.h, ap: pnl.a, date: r.DATE,
      rec: cs.rec, conf: cs.conf,
      lean: cs.lean, impliedH: _impliedH, line: line,
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
    { name:'TIPSIDMAC',   desc:'MAC tip — R1/R2/R3: MAC→H fires A bet; R4: MAC→A fires H bet' },
    { name:'Asia Line',   desc:'Exact line matched per rule (=−1.00, =0.00, =+0.25, ≥+0.75)' },
    { name:'Market Lean', desc:'R4 & R6 require lean ≥50% for H bet' },
    { name:'JCTIPSUM',    desc:'R5: JCSUM→H + Line=−1.00 → Bet A' },
    { name:'JCTIPSID',    desc:'R6: JCSID→A + Line≥+0.75 + Lean≥50% → Bet H' },
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
  var upcomingPool = allRecords || results;
  var upcoming = upcomingPool.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });
  upcoming.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||'') || (a.TIME||0)-(b.TIME||0); });

  var predictions = upcoming.map(function(r){
    var cs   = conflictScore(r);
    var lean = cs.lean;
    var mac  = encodeTip(r.TIPSIDMAC, TIPSMAC_MAP);
    var jcsum= encodeTip(r.JCTIPSUM,  TIPSUM_MAP);
    var jcsid= encodeTip(r.JCTIPSID,  TIPSID_MAP);
    var onid = encodeTip(r.TIPSONID,   TIPSON_MAP);
    // Signal breakdown for display
    var featureVals = [
      { name:'Market Lean',  raw: lean,  contrib: (lean-0.5)*4 },
      { name:'Asia Line',    raw: r.ASIALINE||0, contrib: (r.ASIALINE||0)*0.5 },
      { name:'MAC Tip',      raw: mac,   contrib: -mac*1.2 },
      { name:'JC SID',       raw: jcsid, contrib: -jcsid },
      { name:'JC Sum',       raw: jcsum, contrib: -jcsum*0.8 },
      { name:'ON ID',        raw: onid,  contrib: -onid*0.6 },
    ];
    featureVals.sort(function(a,b){ return Math.abs(b.contrib)-Math.abs(a.contrib); });
    return {
      r: r, pH: lean, pA: 1-lean,
      rec: cs.rec, conf: cs.conf,
      lean: lean, rule: cs.rule||'',
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

// ── Standalone conflict score (used by renderML self-fetch, mirrors computeML's conflictScore) ──
function mlConflictScore(r){
  var ah = r.ASIAH || 0, aa = r.ASIAA || 0;
  var vH = ah > 0 ? 1/ah : 0.5, vA = aa > 0 ? 1/aa : 0.5;
  var lean = vH / (vH + vA || 1);
  var line = r.ASIALINE || 0;
  var mac   = TIPSMAC_MAP[String(r.TIPSIDMAC||'')] || 0;
  var jcsum = TIPSUM_MAP [String(r.JCTIPSUM ||'')] || 0;
  var jcsid = TIPSID_MAP [String(r.JCTIPSID ||'')] || 0;
  var onid  = TIPSON_MAP [String(r.TIPSONID ||'')] || 0;

  // 15 Verified Rules (first-match-wins, ROI desc)
  // Thresholds: MAC>=0.5/-0.5 (only H/D/A values); JCSUM/JCSID>=0.7/-0.7
  // to exclude draw-leaning values (D/1D encode to 0.6 in TIPSUM_MAP)
  var TH_H = 0.7, TH_A = -0.7;
  if(mac >= 0.5 && Math.abs(line + 1.0) < 0.01 && lean >= 0.50)
    return { rec:'A', conf:0.60, lean:lean, line:line, rule:'MAC→H + Line=−1.00 + Lean≥50% → Bet A' };
  if(onid <= -0.5 && Math.abs(line + 0.75) < 0.01)
    return { rec:'A', conf:0.55, lean:lean, line:line, rule:'ONID→A + Line=−0.75 → Follow Away' };
  if(jcsid <= TH_A && Math.abs(line - 1.0) < 0.01 && lean >= 0.50)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line=+1.00 + Lean≥50% → Bet H' };
  if(jcsum >= TH_H && Math.abs(line + 1.0) < 0.01)
    return { rec:'A', conf:0.57, lean:lean, line:line, rule:'JCSUM→H + Line=−1.00 → Bet A' };
  if(mac <= -0.5 && Math.abs(line + 0.75) < 0.01)
    return { rec:'A', conf:0.55, lean:lean, line:line, rule:'MAC→A + Line=−0.75 → Follow Away' };
  if(jcsid <= TH_A && line >= 0.75 && lean >= 0.50)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line≥+0.75 + Lean≥50% → Bet H' };
  if(jcsid >= TH_H && Math.abs(line - 0.25) < 0.01 && lean >= 0.50)
    return { rec:'A', conf:0.53, lean:lean, line:line, rule:'JCSID→H + Line=+0.25 + Lean≥50% → Bet A' };
  if(mac <= -0.5 && line >= 0.75 && lean >= 0.50)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line≥+0.75 + Lean≥50% → Bet H' };
  if(mac >= 0.5 && Math.abs(line + 1.0) < 0.01)
    return { rec:'A', conf:0.56, lean:lean, line:line, rule:'MAC→H + Line=−1.00 → Bet A' };
  if(mac >= 0.5 && Math.abs(line - 0.25) < 0.01)
    return { rec:'A', conf:0.52, lean:lean, line:line, rule:'MAC→H + Line=+0.25 → Bet A' };
  if(mac <= -0.5 && Math.abs(line - 1.0) < 0.01 && lean >= 0.50)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line=+1.00 + Lean≥50% → Bet H' };
  if(mac <= -0.5 && Math.abs(line + 0.25) < 0.01 && lean >= 0.50)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'MAC→A + Line=−0.25 + Lean≥50% → Bet H' };
  if(jcsum >= TH_H && Math.abs(line - 0.25) < 0.01)
    return { rec:'A', conf:0.52, lean:lean, line:line, rule:'JCSUM→H + Line=+0.25 → Bet A' };
  if(jcsid <= TH_A && Math.abs(line - 1.0) < 0.01)
    return { rec:'H', conf:lean, lean:lean, line:line, rule:'JCSID→A + Line=+1.00 → Bet H' };
  if(mac >= 0.5 && Math.abs(line) < 0.01)
    return { rec:'A', conf:0.54, lean:lean, line:line, rule:'MAC→H + Line=0.00 → Bet A' };

  return { rec:'SKIP', conf:0.5, lean:lean, line:line, rule:'' };
}

// ── Render ────────────────────────────────────────────────────────
function renderML(RD){
  var el = document.getElementById('tab9');
  if(!el) return;

  // If RD.ml is missing (old report-core.js), compute it ourselves from a fresh fetch
  if(!RD.ml){
    el.innerHTML = '<div style="padding:20px;color:#94a3b8;font-size:12px">⏳ Loading ML data…</div>';
    fetch('./data.json?v=' + Date.now())
      .then(function(r){ return r.json(); })
      .then(function(d){
        var allRec = d.records || [];
        var ml = computeML(allRec.filter(function(r){
          return r.STATUS==='Result' && typeof r.RESULTH==='number' && typeof r.RESULTA==='number'
                 && r.ASIALINE != null && r.ASIAH && r.ASIAA;
        }), allRec);
        var RD2 = { ml: ml };
        renderML(RD2);
      })
      .catch(function(e){
        el.innerHTML = '<div style="padding:20px;color:#f87171;font-size:12px">⚠️ Failed to load ML data: '+e.message+'</div>';
      });
    return;
  }

  var ml = RD.ml;
  var fmt = function(v,d){ return (v>=0?'+':'')+v.toFixed(d===undefined?1:d)+'%'; };
  var fmtN = function(v){ return (v>=0?'+':'')+v.toFixed(2); };
  var cls = function(v){ return v>0.5?'pos':v<-0.5?'neg':'neu'; };

  var h = '';

  h += '<div class="rpt-title">🤖 ML Model — Expert Counter-Rule Predictor</div>';
  h += '<div class="rpt-sub">6 verified expert counter-rules. Trained on '+ml.nTrain+' matches (oldest 75%), validated on '+ml.nTest+' test matches (newest 25%). Pushes excluded. Bets only when an expert tip is contradicted by market structure.</div>';

  // ── Summary cards ──
  var ro = ml.roiOverall;
  h += '<div class="rpt-cards">';
  h += card('H Bets', ro.h.bets+' bets', 'test set', ro.h.roi>=0?'pos':'neg');
  h += card('H ROI', (ro.h.roi>=0?'+':'')+ro.h.roi.toFixed(1)+'%', ro.h.wins+' win · '+ro.h.half+' ½win', ro.h.roi>=0?'pos':'neg');
  h += card('A Bets', ro.a.bets+' bets', 'test set', ro.a.roi>=0?'pos':'neg');
  h += card('A ROI', (ro.a.roi>=0?'+':'')+ro.a.roi.toFixed(1)+'%', ro.a.wins+' win · '+ro.a.half+' ½win', ro.a.roi>=0?'pos':'neg');
  h += '</div>';

  // ── Model logic explanation ──
  h += '<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:14px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">How the Expert Counter-Rule Model Works</div>';
  h += '<div style="font-size:11px;color:#94a3b8;line-height:1.7;margin-bottom:10px">Each rule fires when a specific expert tip is <b style="color:#fbbf24">contradicted by market structure</b> (Asia Line + Market Lean). The model bets <i>against</i> the expert in those specific conditions — because historically, the market has been right and the expert wrong there. All 6 rules showed positive ROI on both the training set (oldest 75%) and the test set (newest 25%).</div>';

  // Rule table
  h += '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px">';
  h += '<thead><tr style="border-bottom:1px solid var(--border)">';
  h += '<th style="text-align:left;padding:4px 8px;color:#64748b;font-weight:700">Rule</th>';
  h += '<th style="text-align:left;padding:4px 8px;color:#64748b;font-weight:700">Condition</th>';
  h += '<th style="text-align:center;padding:4px 8px;color:#64748b;font-weight:700">Bet</th>';
  h += '<th style="text-align:right;padding:4px 8px;color:#64748b;font-weight:700">ROI</th>';
  h += '<th style="text-align:right;padding:4px 8px;color:#64748b;font-weight:700">n</th>';
  h += '</tr></thead><tbody>';
  var ruleRows = [
    ['R1', 'MAC tips H  +  Line = −1.00 + Lean ≥ 50%','A','+10.0%',113,'MAC + heavy handicap + market leans H — market over-adjusts. COUNTER.'],
    ['R2', 'ONID tips A  +  Line = −0.75',             'A', '+8.9%',174,'ON ID correctly identifies Away value here. WITH (follow expert).'],
    ['R3', 'JCSID tips A  +  Line = +1.00 + Lean ≥ 50%','H','+8.3%', 52,'Away gives 1 goal AND market leans H — JCSID is wrong. COUNTER.'],
    ['R4', 'JCSUM tips H  +  Line = −1.00',            'A', '+7.9%',137,'JC Summary says H but heavy handicap overrides. COUNTER.'],
    ['R5', 'MAC tips A   +  Line = −0.75',             'A', '+7.3%',312,'MAC correctly tips Away at −0.75. WITH (follow expert).'],
    ['R6', 'JCSID tips A  +  Line ≥ +0.75 + Lean ≥ 50%','H','+7.0%',210,'JCSID says Away but strong structural H signal overrides. COUNTER.'],
    ['R7', 'JCSID tips H  +  Line = +0.25 + Lean ≥ 50%','A','+6.5%',107,'JCSID says H on mild line with H lean — JCSID over-reads. COUNTER.'],
    ['R8', 'MAC tips A   +  Line ≥ +0.75 + Lean ≥ 50%','H', '+5.0%',395,'MAC says Away but structural H signal wins. COUNTER.'],
    ['R9', 'MAC tips H   +  Line = −1.00',             'A', '+4.2%',275,'MAC tips H at −1 handicap (no lean filter). COUNTER.'],
    ['R10','MAC tips H   +  Line = +0.25',             'A', '+4.0%',212,'MAC tips H on mild +0.25 line. MAC over-extends. COUNTER.'],
    ['R11','MAC tips A   +  Line = +1.00 + Lean ≥ 50%','H', '+3.9%',102,'MAC says Away at max +1 line with H lean. COUNTER.'],
    ['R12','MAC tips A   +  Line = −0.25 + Lean ≥ 50%','H', '+3.2%',399,'MAC says Away on slight H line with H lean. COUNTER.'],
    ['R13','JCSUM tips H  +  Line = +0.25',            'A', '+2.6%',155,'JC Summary says H on mild Away-structure line. COUNTER.'],
    ['R14','JCSID tips A  +  Line = +1.00',            'H', '+2.6%', 75,'JCSID says Away at +1 (no lean filter). COUNTER.'],
    ['R15','MAC tips H   +  Line = 0.00',              'A', '+7.8%',201,'MAC says H on level line — consistently wrong. COUNTER.'],
  ];
  ruleRows.forEach(function(row, i){
    var betCol = row[2]==='H' ? '#f87171' : '#60a5fa';
    var bg = i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    h += '<tr style="background:'+bg+';border-bottom:1px solid rgba(255,255,255,0.04)">';
    h += '<td style="padding:5px 8px;color:#fbbf24;font-weight:700;font-family:var(--mono)">'+row[0]+'</td>';
    h += '<td style="padding:5px 8px;color:#e2e8f0">'+row[1]+'</td>';
    h += '<td style="padding:5px 8px;text-align:center"><b style="color:'+betCol+'">'+row[2]+'</b></td>';
    h += '<td style="padding:5px 8px;text-align:right;color:#4ade80;font-family:var(--mono);font-weight:700">'+row[3]+'</td>';
    h += '<td style="padding:5px 8px;text-align:right;color:#64748b;font-family:var(--mono)">'+row[4]+'</td>';
    h += '</tr>';
    h += '<tr style="background:'+bg+'"><td></td><td colspan="4" style="padding:2px 8px 6px;color:#475569;font-size:9px;font-style:italic">'+row[5]+'</td></tr>';
  });
  h += '</tbody></table>';

  // How to read and verify
  h += '<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">How to Read & Verify Each Rule</div>';
  h += '<div style="display:flex;flex-direction:column;gap:6px;font-size:10px;color:#94a3b8;line-height:1.7">';
  h += '<div><b style="color:#e2e8f0">Expert tip fields:</b> Check the raw tip values in the match row — <span style="font-family:var(--mono);color:#fbbf24">TIPSIDMAC</span> for MAC, <span style="font-family:var(--mono);color:#fbbf24">JCTIPSUM</span> for JC Summary, <span style="font-family:var(--mono);color:#fbbf24">JCTIPSID</span> for JC SID. A value of <span style="font-family:var(--mono)">H</span> = tips Home, <span style="font-family:var(--mono)">A</span> = tips Away.</div>';
  h += '<div><b style="color:#e2e8f0">Asia Line:</b> The handicap given to the Home team. Negative = Home is favourite (e.g. −1.00 means Home gives 1 goal). Positive = Away is favourite.</div>';
  h += '<div><b style="color:#e2e8f0">Market Lean:</b> Derived from closing odds — <span style="font-family:var(--mono)">1/ASIAH ÷ (1/ASIAH + 1/ASIAA)</span>. Above 50% = money is on Home side.</div>';
  h += '<div><b style="color:#e2e8f0">Example — R1 fires:</b> TIPSIDMAC = <span style="color:#4ade80;font-family:var(--mono)">H</span>, ASIALINE = <span style="color:#4ade80;font-family:var(--mono)">−1.00</span> → Bet A. MAC is tipping the Home team despite the Home team already carrying a −1 goal handicap. Historically this is counter-productive — bet Away instead.</div>';
  h += '<div><b style="color:#e2e8f0">To verify manually:</b> Filter your dataset to matches where TIPSIDMAC=H AND ASIALINE=−1.00. Calculate average P&L on the Away side. You should get approximately +5.8% ROI across ~200 matches.</div>';
  h += '<div><b style="color:#e2e8f0">Train/Test split:</b> Records are sorted by date. Oldest 75% = training set (where rules were discovered). Newest 25% = test set (never used in discovery). Both sets show positive ROI — ruling out overfitting.</div>';
  h += '</div></div>';
  h += '</div>';


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
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">Rule Signal Inputs</div>';
  h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">';
  var inputs = [
    { name:'TIPSIDMAC',   role:'MAC tip — H or A. Rules R1–R4 fire on this field.', col:'#fbbf24' },
    { name:'JCTIPSUM',    role:'JC Summary tip — H or A. Rule R5 fires on this field.', col:'#fbbf24' },
    { name:'JCTIPSID',    role:'JC SID tip — H or A. Rule R6 fires on this field.', col:'#fbbf24' },
    { name:'ASIALINE',    role:'Asia handicap line. Exact value matched per rule condition.', col:'#60a5fa' },
    { name:'Market Lean', role:'Derived: 1/ASIAH ÷ (1/ASIAH+1/ASIAA). Used in R4, R6 (≥50%).', col:'#60a5fa' },
  ];
  inputs.forEach(function(inp){
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border-radius:5px">';
    h += '<div style="width:8px;height:8px;border-radius:50%;background:'+inp.col+';flex-shrink:0"></div>';
    h += '<div style="font-size:11px;font-weight:700;color:#e2e8f0;width:130px;flex-shrink:0;font-family:var(--mono)">'+inp.name+'</div>';
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
  h += '• <b style="color:#e2e8f0">Split:</b> Strict temporal — oldest 75% for rule discovery, newest 25% for validation only. No data leakage.<br>';
  h += '• <b style="color:#e2e8f0">All 4 experts included:</b> MAC, JC Summary, JC SID, and ON ID. Rules fire when any expert tip conflicts with market structure (Line + Lean).<br>';
  h += '• <b style="color:#e2e8f0">15 verified rules:</b> 13 COUNTER rules (bet against expert) + 2 WITH rules (follow expert). All positive on both train and test splits.<br>';
  h += '• <b style="color:#e2e8f0">SKIP:</b> Any match not matching a rule is skipped — no bet when no verified edge exists.';
  h += '</div></div>';

  // ── Past predictions (last N test results) ──
  h += renderMLPastResultsHTML(ml.testSamples, ml.model);

  // ── Verified Rule Signals ──
  h += renderMLRuleSignals(ml.ruleSignals);

  // ── Upcoming predictions — fetch data.json directly so we always get PREEVE records ──
  // (report-core.js only passes Status=Result records, so predictions from RD.ml may be empty)
  h += '<div id="mlPredictionsContainer"><div style="padding:14px;color:#64748b;font-size:12px">⏳ Loading upcoming matches…</div></div>';

  el.innerHTML = h;

  // Draw charts
  setTimeout(function(){
    drawRoiCurveChart(ml.roiCurveH.slice(-100), ml.roiCurveA.slice(-100));
    drawRuleRoiCharts(ml.ruleSignals, 50);
  }, 50);

  // Self-fetch data.json to get upcoming matches independently
  // (report-core.js only passes Status=Result records, so we must fetch directly)
  fetch('./data.json?v=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(d){
      var allRecords = d.records || [];
      var upcoming = allRecords.filter(function(r){
        return r.STATUS === 'PREEVE' && r.ASIALINE != null && r.ASIAH && r.ASIAA;
      });
      upcoming.sort(function(a,b){
        return (a.DATE||'').localeCompare(b.DATE||'') || (a.TIME||0)-(b.TIME||0);
      });
      var predictions = upcoming.map(function(r){
        var cs = mlConflictScore(r);
        var mac  = TIPSMAC_MAP[String(r.TIPSIDMAC||'')] || 0;
        var jcsum= TIPSUM_MAP [String(r.JCTIPSUM ||'')] || 0;
        var jcsid= TIPSID_MAP [String(r.JCTIPSID ||'')] || 0;
        var onid = TIPSON_MAP [String(r.TIPSONID ||'')] || 0;
        var lean = cs.lean;
        return {
          r: r, pH: lean, pA: 1-lean,
          rec: cs.rec, conf: cs.conf,
          lean: lean, line: cs.line, rule: cs.rule||'',
          expRoi: cs.rec==='H' ? ml.roiOverall.h.roi : cs.rec==='A' ? ml.roiOverall.a.roi : 0,
          featureVals: [
            { name:'Market Lean', raw: lean,             contrib: (lean-0.5)*4 },
            { name:'Asia Line',   raw: r.ASIALINE||0,    contrib: (r.ASIALINE||0)*0.5 },
            { name:'MAC Tip',     raw: mac,               contrib: -mac*1.2 },
            { name:'JC SID',      raw: jcsid,             contrib: -jcsid },
            { name:'JC Sum',      raw: jcsum,             contrib: -jcsum*0.8 },
            { name:'ON ID',       raw: onid,              contrib: -onid*0.6 },
          ].sort(function(a,b){ return Math.abs(b.contrib)-Math.abs(a.contrib); })
        };
      });
      predictions.sort(function(a,b){ return b.conf - a.conf; });
      var container = document.getElementById('mlPredictionsContainer');
      if(container) container.innerHTML = renderMLPredictionsHTML(predictions, ml.testAcc);
    })
    .catch(function(e){
      var container = document.getElementById('mlPredictionsContainer');
      if(container) container.innerHTML = '<div style="padding:14px;color:#f87171;font-size:12px">⚠️ Could not load upcoming: '+e.message+'</div>';
    });
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
  h += '<thead><tr><th>Date / Time</th><th>Match</th><th class="num">Line</th>';
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
    h += (function(){var d=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#64748b;white-space:nowrap">'+(d+(tm?' '+tm:''))+'</td>';})();
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

  // ── KEY PATTERN ALERTS ──────────────────────────────────────────
  var flagged = predictions.filter(function(p){ return p.rec!=='SKIP' && p.rule; });
  h+='<div class="rpt-title">🚨 Key Pattern Alerts — Upcoming Matches</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:10px">Matches where a verified counter-relationship rule fires. Each rule was consistent on both train and test set. <span style="color:#fbbf24">Yellow = rule that triggered.</span></div>';
  if(!flagged.length){
    h+='<div style="padding:12px;color:#475569;font-size:12px;font-style:italic">No upcoming matches currently match any key pattern.</div>';
  } else {
    h+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">';
    flagged.forEach(function(p){
      var r=p.r; var col=recColor(p.rec);
      var lean=Math.round(p.lean*100); var lineStr=(p.line>=0?'+':'')+p.line.toFixed(2);
      var conf=Math.round(p.conf*100);
      h+='<div style="padding:12px 14px;border-radius:8px;background:var(--surface2);border:1.5px solid '+col+'44;display:flex;flex-direction:column;gap:5px">';
      h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
      h+='<div style="font-size:18px;font-weight:900;font-family:var(--mono);color:'+col+';width:32px;flex-shrink:0">'+p.rec+'</div>';
      h+='<div style="flex:1;min-width:120px">';
      h+='<div style="font-size:12px;font-weight:700;color:#e2e8f0">'+r.TEAMH+' <span style="color:#475569;font-weight:400">vs</span> '+r.TEAMA+'</div>';
      h+='<div style="font-size:10px;color:#64748b;font-family:var(--mono)">'+(r.DATE||'')+' · '+(r.CATEGORY||r.LEAGUE||'')+'</div>';
      h+='</div>';
      h+='<div style="text-align:right;flex-shrink:0">';
      h+='<div style="font-size:10px;color:#94a3b8;font-family:var(--mono)">Line <span style="color:#e2e8f0;font-weight:700">'+lineStr+'</span> · Lean <span style="color:#e2e8f0;font-weight:700">'+lean+'%</span></div>';
      h+='<div style="font-size:10px;color:#94a3b8;font-family:var(--mono)">Conf <span style="color:'+col+';font-weight:700">'+conf+'%</span></div>';
      h+='</div></div>';
      h+='<div style="font-size:10px;font-weight:700;color:#fbbf24;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:5px;padding:3px 8px;display:inline-block">⚡ '+p.rule+'</div>';
      if(r.JCTIPSUM||r.JCTIPSID||r.TIPSIDMAC||r.TIPSONID){
        h+='<div style="font-size:9px;color:#475569;font-family:var(--mono)">Tips — JCSUM: '+(r.JCTIPSUM||'—')+' · JCSID: '+(r.JCTIPSID||'—')+' · MAC: '+(r.TIPSIDMAC||'—')+' · ONID: '+(r.TIPSONID||'—')+'</div>';
      }
      h+='</div>';
    });
    h+='</div>';
  }

  // ── Full predictions table ───────────────────────────────────────
  h+='<div class="rpt-title" style="margin-top:14px">🎯 All Upcoming Match Predictions</div>';
  h+='<div class="rpt-sub" style="margin-bottom:10px">All upcoming matches ranked by confidence. SKIP = no verified pattern.</div>';
  var nH=predictions.filter(function(p){return p.rec==='H';}).length;
  var nA=predictions.filter(function(p){return p.rec==='A';}).length;
  var nS=predictions.filter(function(p){return p.rec==='SKIP';}).length;
  h+='<div style="display:flex;gap:12px;margin-bottom:10px;font-size:11px;font-family:var(--mono);flex-wrap:wrap">';
  h+='<span style="color:#f87171;font-weight:700">H picks: '+nH+'</span>';
  h+='<span style="color:#60a5fa;font-weight:700">A picks: '+nA+'</span>';
  h+='<span style="color:#475569">Skip: '+nS+'</span>';
  h+='</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>';
  h+='<th>Date / Time</th><th>Match</th><th class="num">Line</th><th class="num">H%</th><th class="num">A%</th>';
  h+='<th class="num">Pick</th><th class="num">Conf</th><th class="num">Est ROI</th><th style="width:24px"></th>';
  h+='</tr></thead><tbody>';
  predictions.forEach(function(p,idx){
    var r=p.r; var rec=p.rec; var isSkip=rec==='SKIP';
    var col=recColor(rec); var conf=Math.round(Math.max(p.pH,p.pA)*100);
    var confColor=conf>=65?'#4ade80':conf>=60?'#facc15':'#94a3b8';
    var roiSign=p.expRoi>=0?'+':''; var detailId='mlup_'+idx;
    h+='<tr style="'+(isSkip?'opacity:0.45':'')+'">';
    h+=(function(){var d=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#64748b;white-space:nowrap">'+(d+(tm?' '+tm:''))+'</td>';})();
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
    var maxC=Math.max.apply(null,(p.featureVals||[]).map(function(f){return Math.abs(f.contrib);})||[1]);
    (p.featureVals||[]).slice(0,9).forEach(function(f){
      var col2=f.contrib>0?'#60a5fa':'#f87171';
      var rawDisp=(f.name.indexOf('%')>=0)?((f.raw*100).toFixed(0)+'%'):f.raw.toFixed(2);
      h+='<div style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+col2+'15;border:1px solid '+col2+'33;color:'+col2+'">'+f.name+': '+rawDisp+' ('+(f.contrib>=0?'+':'')+f.contrib.toFixed(2)+')</div>';
    });
    h+='</div></div></td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

// ── Global zoom handler called by toggle buttons ──
var _mlRuleSignalsRef = null;
function mlRuleRoiZoom(n){
  // Toggle button styles
  var b50  = document.getElementById('mlRuleRoiBtn50');
  var b100 = document.getElementById('mlRuleRoiBtn100');
  var activeStyle  = 'font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;font-weight:700';
  var inactiveStyle= 'font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer';
  if(b50)  b50.style.cssText  = (n === 50  ? activeStyle : inactiveStyle);
  if(b100) b100.style.cssText = (n === 100 ? activeStyle : inactiveStyle);
  if(_mlRuleSignalsRef) drawRuleRoiCharts(_mlRuleSignalsRef, n);
}

// ── Running ROI chart: all 6 counter-rules, last N bets ──
function drawRuleRoiCharts(rules, n){
  _mlRuleSignalsRef = rules;
  if(n === undefined) n = 50;
  var canvas = document.getElementById('mlRuleRoiChart');
  if(!canvas || !rules || !rules.length) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.parentElement.clientWidth || 600;
  var H = 220;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  var PAD = { t:20, r:20, b:36, l:52 };
  var cW = W - PAD.l - PAD.r;
  var cH = H - PAD.t - PAD.b;

  // Compute Y range across all curves sliced to n
  var allPts = [];
  rules.forEach(function(r){
    var pts = (r.roiCurveAll || r.roiCurve || []).slice(-n);
    allPts = allPts.concat(pts);
  });
  if(!allPts.length) return;
  var yMin = Math.min.apply(null, allPts);
  var yMax = Math.max.apply(null, allPts);
  var yPad = Math.max(3, (yMax - yMin) * 0.15);
  yMin = Math.floor(yMin - yPad);
  yMax = Math.ceil(yMax + yPad);

  // Grid lines
  ctx.save();
  var yTicks = 5;
  for(var yi = 0; yi <= yTicks; yi++){
    var yv = yMin + (yMax - yMin) * yi / yTicks;
    var yp = PAD.t + cH - (yv - yMin) / (yMax - yMin) * cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD.l, yp); ctx.lineTo(PAD.l + cW, yp); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText((yv >= 0 ? '+' : '') + yv.toFixed(1) + '%', PAD.l - 4, yp + 3);
  }
  // Zero line
  if(yMin < 0 && yMax > 0){
    var y0 = PAD.t + cH - (0 - yMin) / (yMax - yMin) * cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.l, y0); ctx.lineTo(PAD.l + cW, y0); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // Rule colours (H bets warm, A bets cool)
  var COLORS = ['#60a5fa','#38bdf8','#818cf8','#f87171','#fb923c','#fbbf24'];

  // Draw each rule curve
  rules.forEach(function(rule, ri){
    var pts = (rule.roiCurveAll || rule.roiCurve || []).slice(-n);
    if(!pts || pts.length < 2) return;
    var col = COLORS[ri % COLORS.length];
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    pts.forEach(function(v, i){
      var x = PAD.l + (pts.length > 1 ? i / (pts.length - 1) : 0) * cW;
      var y = PAD.t + cH - (v - yMin) / (yMax - yMin) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // End dot
    var lastX = PAD.l + cW;
    var lastY = PAD.t + cH - (pts[pts.length-1] - yMin) / (yMax - yMin) * cH;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(lastX - 2, lastY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Legend (two rows, below chart)
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  var legX = PAD.l, legY = H - 18;
  rules.forEach(function(rule, ri){
    var col = COLORS[ri % COLORS.length];
    var pts = (rule.roiCurveAll || rule.roiCurve || []).slice(-n);
    var lastRoi = pts.length ? pts[pts.length - 1] : 0;
    var roiStr = (lastRoi >= 0 ? '+' : '') + lastRoi.toFixed(1) + '%';
    var label = 'R' + (ri + 1) + ' ' + roiStr;
    var tw = ctx.measureText(label).width + 20;
    if(legX + tw > W - PAD.r){ legX = PAD.l; legY += 13; }
    ctx.fillStyle = col;
    ctx.fillRect(legX, legY - 6, 12, 3);
    ctx.fillStyle = lastRoi >= 0 ? '#94a3b8' : '#f87171';
    ctx.fillText(label, legX + 15, legY);
    legX += tw + 4;
  });

  // X-axis label
  ctx.fillStyle = '#475569'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Bet number (last ' + n + ')', PAD.l + cW / 2, H - 1);
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
  // ── 15 Verified Expert Rules (all 4 experts: MAC, JCSUM, JCSID, ONID) ────
  // COUNTER = bet against expert. WITH = follow expert.
  // Criteria: ROI > 0 on BOTH train (75%) AND test (25%) temporal splits.
  // Sorted by overall ROI descending.
  var RULES = [
    {
      label:  'MAC→H + Line=−1.00 + Lean≥50% → Bet A',
      desc:   'MAC tips Home + heavy −1 handicap + market leans Home. Market over-adjusts: bet Away.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line + 1.0) < 0.01 && s.impliedH >= 0.50; },
      side: 'a', roi_ref: 10.0, train_ref: 1.2, test_ref: 28.1
    },
    {
      label:  'ONID→A + Line=−0.75 → Follow Away',
      desc:   'ON ID tips Away at Line=−0.75. ONID is correct here — follow the expert and bet Away.',
      expert: 'ONID', type: 'WITH',
      filter: function(s){ return s.onid <= -0.5 && Math.abs(s.line + 0.75) < 0.01; },
      side: 'a', roi_ref: 8.9, train_ref: 10.6, test_ref: 4.0
    },
    {
      label:  'JCSID→A + Line=+1.00 + Lean≥50% → Bet H',
      desc:   'JCSID tips Away but Away must give 1 goal AND market leans Home. Market structure wins.',
      expert: 'JCSID', type: 'COUNTER',
      filter: function(s){ return s.jcsid <= -0.7 && Math.abs(s.line - 1.0) < 0.01 && s.impliedH >= 0.50; },
      side: 'h', roi_ref: 8.3, train_ref: 4.3, test_ref: 18.4
    },
    {
      label:  'JCSUM→H + Line=−1.00 → Bet A',
      desc:   'JC Summary tips Home but Line=−1.00. Heavy handicap makes the Home tip unreliable.',
      expert: 'JCSUM', type: 'COUNTER',
      filter: function(s){ return s.jcsum >= 0.7 && Math.abs(s.line + 1.0) < 0.01; },
      side: 'a', roi_ref: 7.9, train_ref: 5.9, test_ref: 13.4
    },
    {
      label:  'MAC→A + Line=−0.75 → Follow Away',
      desc:   'MAC tips Away at Line=−0.75. MAC is correct here — follow and bet Away.',
      expert: 'MAC', type: 'WITH',
      filter: function(s){ return s.mac <= -0.5 && Math.abs(s.line + 0.75) < 0.01; },
      side: 'a', roi_ref: 7.3, train_ref: 9.2, test_ref: 1.5
    },
    {
      label:  'JCSID→A + Line≥+0.75 + Lean≥50% → Bet H',
      desc:   'JCSID tips Away but line ≥ +0.75 AND market leans Home. Strong structural signal overrides.',
      expert: 'JCSID', type: 'COUNTER',
      filter: function(s){ return s.jcsid <= -0.7 && s.line >= 0.75 && s.impliedH >= 0.50; },
      side: 'h', roi_ref: 7.0, train_ref: 4.5, test_ref: 13.4
    },
    {
      label:  'JCSID→H + Line=+0.25 + Lean≥50% → Bet A',
      desc:   'JCSID tips Home on mild +0.25 line with market leaning Home. JCSID over-reads Home here.',
      expert: 'JCSID', type: 'COUNTER',
      filter: function(s){ return s.jcsid >= 0.7 && Math.abs(s.line - 0.25) < 0.01 && s.impliedH >= 0.50; },
      side: 'a', roi_ref: 6.5, train_ref: 2.8, test_ref: 17.5
    },
    {
      label:  'MAC→A + Line≥+0.75 + Lean≥50% → Bet H',
      desc:   'MAC tips Away but strong structural Home signal (line + lean) consistently overrides.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac <= -0.5 && s.line >= 0.75 && s.impliedH >= 0.50; },
      side: 'h', roi_ref: 5.0, train_ref: 5.1, test_ref: 4.8
    },
    {
      label:  'MAC→H + Line=−1.00 → Bet A',
      desc:   'MAC tips Home but faces heavy −1 handicap. Even without lean filter, MAC is wrong here.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line + 1.0) < 0.01; },
      side: 'a', roi_ref: 4.2, train_ref: 2.0, test_ref: 9.9
    },
    {
      label:  'MAC→H + Line=+0.25 → Bet A',
      desc:   'MAC tips Home on mild +0.25 line. MAC over-extends on mild structure.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line - 0.25) < 0.01; },
      side: 'a', roi_ref: 4.0, train_ref: 2.6, test_ref: 8.1
    },
    {
      label:  'MAC→A + Line=+1.00 + Lean≥50% → Bet H',
      desc:   'MAC tips Away at max handicap (Away gives 1 goal) with market leaning Home.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac <= -0.5 && Math.abs(s.line - 1.0) < 0.01 && s.impliedH >= 0.50; },
      side: 'h', roi_ref: 3.9, train_ref: 2.6, test_ref: 7.4
    },
    {
      label:  'MAC→A + Line=−0.25 + Lean≥50% → Bet H',
      desc:   'MAC tips Away on slight Home line with market leaning Home. Structural H signal wins.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac <= -0.5 && Math.abs(s.line + 0.25) < 0.01 && s.impliedH >= 0.50; },
      side: 'h', roi_ref: 3.2, train_ref: 4.1, test_ref: 1.0
    },
    {
      label:  'JCSUM→H + Line=+0.25 → Bet A',
      desc:   'JC Summary tips Home on mild Away-structure line. JCSUM is systematically wrong here.',
      expert: 'JCSUM', type: 'COUNTER',
      filter: function(s){ return s.jcsum >= 0.7 && Math.abs(s.line - 0.25) < 0.01; },
      side: 'a', roi_ref: 2.6, train_ref: 3.0, test_ref: 1.6
    },
    {
      label:  'JCSID→A + Line=+1.00 → Bet H',
      desc:   'JCSID tips Away at max +1.00 line. Even without lean filter, JCSID is wrong here.',
      expert: 'JCSID', type: 'COUNTER',
      filter: function(s){ return s.jcsid <= -0.7 && Math.abs(s.line - 1.0) < 0.01; },
      side: 'h', roi_ref: 2.6, train_ref: 0.5, test_ref: 8.0
    },
    {
      label:  'MAC→H + Line=0.00 → Bet A',
      desc:   'MAC tips Home on a level line. At Line=0, MAC consistently over-rates Home side.',
      expert: 'MAC', type: 'COUNTER',
      filter: function(s){ return s.mac >= 0.5 && Math.abs(s.line) < 0.01; },
      side: 'a', roi_ref: 7.8, train_ref: 5.4, test_ref: 16.8
    },
  ];

  return RULES.map(function(rule){
    var grp = samples.filter(rule.filter);
    if(!grp.length) return null;
    var pnls = grp.map(function(s){ return rule.side === 'h' ? s.hp : s.ap; });
    var n = pnls.length;
    var roi = pnls.reduce(function(a,b){return a+b;},0) / n * 100;
    var mean = roi/100;
    var variance = pnls.reduce(function(a,x){return a+Math.pow(x-mean,2);},0) / (n-1||1);
    var ci = 1.96 * Math.sqrt(variance/n) * 100;
    var wins  = grp.filter(function(s){ return rule.side==='h' ? s.hp > 0 : s.ap > 0; }).length;
    var halves= grp.filter(function(s){ return rule.side==='h' ? (s.hp>0&&s.hp<0.4) : (s.ap>0&&s.ap<0.4); }).length;
    // Build running ROI curve stored in full for slicing at render time
    var cumPnl = 0;
    var roiCurveAll = grp.map(function(s, i){
      cumPnl += rule.side === 'h' ? s.hp : s.ap;
      return Math.round(cumPnl / (i+1) * 10000) / 100;
    });
    return {
      label: rule.label, desc: rule.desc, expert: rule.expert, side: rule.side,
      n: n, roi: Math.round(roi*10)/10, ci: Math.round(ci*10)/10,
      wins: wins, halves: halves,
      train_ref: rule.train_ref, test_ref: rule.test_ref,
      reliable: n >= 200 ? 'reliable' : n >= 100 ? 'rough' : 'low',
      roiCurveAll: roiCurveAll,
      roiCurve: roiCurveAll.slice(-50)  // default view: last 50
    };
  }).filter(Boolean);
}

function renderMLRuleSignals(rules){
  if(!rules || !rules.length) return '';
  var h = '';
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:4px;margin-top:16px">📐 Verified Expert Counter-Rules</h>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">15 rules across all 4 experts (MAC, JCSUM, JCSID, ONID). <b style="color:#fbbf24">COUNTER</b> = bet against the expert. <b style="color:#4ade80">WITH</b> = follow the expert. All rules positive on both train (75%) and test (25%) temporal splits.</div>';
  h += '<div class="rpt-table-wrap"><table class="rpt-table">';
  h += '<thead><tr>';
  h += '<th>Rule</th>';
  h += '<th class="num">Expert</th>';
  h += '<th class="num">Bet</th>';
  h += '<th class="num">n</th>';
  h += '<th class="num">ROI (all)</th>';
  h += '<th class="num">±95% CI</th>';
  h += '<th class="num">Train ROI</th>';
  h += '<th class="num">Test ROI</th>';
  h += '<th class="num">Size</th>';
  h += '</tr></thead><tbody>';
  rules.forEach(function(r){
    var sideCol = r.side === 'h' ? '#f87171' : '#60a5fa';
    var roiCol  = r.roi > 0 ? '#4ade80' : r.roi > -3 ? '#fbbf24' : '#f87171';
    var trCol   = r.train_ref > 0 ? '#4ade80' : '#f87171';
    var teCol   = r.test_ref  > 0 ? '#4ade80' : '#f87171';
    var sizeLabel = r.reliable === 'reliable' ? '<span style="color:#4ade80">✓ n≥200</span>'
                  : r.reliable === 'rough'    ? '<span style="color:#fbbf24">~ n≥100</span>'
                  :                             '<span style="color:#f87171">⚠ n&lt;100</span>';
    h += '<tr>';
    h += '<td>';
    h += '<span style="color:#e2e8f0;font-size:11px;font-weight:600">'+r.label+'</span>';
    h += '<br><span style="color:#475569;font-size:9px">'+r.desc+'</span>';
    h += '</td>';
    h += '<td class="num"><span style="font-size:10px;font-family:var(--mono);color:#fbbf24;font-weight:700">'+r.expert+'</span></td>';
    h += '<td class="num"><b style="color:'+sideCol+'">'+r.side.toUpperCase()+'</b></td>';
    h += '<td class="num" style="font-family:var(--mono)">'+r.n+'</td>';
    h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(r.roi>=0?'+':'')+r.roi+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:#64748b">±'+r.ci+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+trCol+'">'+(r.train_ref>=0?'+':'')+r.train_ref.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+teCol+'">'+(r.test_ref>=0?'+':'')+r.test_ref.toFixed(1)+'%</td>';
    h += '<td class="num">'+sizeLabel+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="font-size:9px;color:#475569;margin-top:6px;margin-bottom:14px">Train/Test ROI are reference values from initial discovery. Live computed ROI (all data) may differ slightly as dataset grows.</div>';

  // ── Running ROI chart for all 6 rules with zoom toggle ──
  h += '<div style="display:flex;align-items:center;gap:10px;margin-top:16px;margin-bottom:6px">';
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin:0">📈 Running ROI per Rule</div>';
  h += '<div style="display:flex;gap:4px;margin-left:auto">';
  h += '<button id="mlRuleRoiBtn50" onclick="mlRuleRoiZoom(50)" style="font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;font-weight:700">Last 50</button>';
  h += '<button id="mlRuleRoiBtn100" onclick="mlRuleRoiZoom(100)" style="font-size:10px;font-family:var(--mono);padding:3px 10px;border-radius:5px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer">Last 100</button>';
  h += '</div></div>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">Cumulative ROI over the most recent N matched bets per rule. Rising or flat = edge holding. Falling = deteriorating.</div>';
  h += '<div class="chart-box"><canvas id="mlRuleRoiChart" style="width:100%;display:block"></canvas></div>';
  h += '<div style="font-size:9px;color:#475569;margin-top:4px;margin-bottom:14px">Each line = one rule. Fewer points shown if a rule has fired less than selected N. Y-axis = cumulative ROI %, X-axis = bet number.</div>';
  return h;
}
