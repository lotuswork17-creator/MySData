// ═══════════════════════════════════════════════════════════════
// GEM/GPT ML REPORT — Separate analysis using GEM+GPT era data
// Only trains on records where GEM votes are available
// Adds: lean drift, lean×line interaction, GEM/GPT as real features
// ═══════════════════════════════════════════════════════════════

// ── Helpers (self-contained, no dependency on report-ml.js) ─────
function gemSigmoid(x){ return 1/(1+Math.exp(-Math.max(-30,Math.min(30,x)))); }

function gemHcapAdj(gh,ga,line){
  return Math.round((gh-ga+line)*4)/4;
}
function gemHcapOutcome(gh,ga,line){
  var adj=gemHcapAdj(gh,ga,line);
  if(adj> 0.3) return 'HW';
  if(adj==0.25) return 'HH';
  if(adj==0)    return 'P';
  if(adj==-0.25)return 'AH';
  return 'AW';
}
function gemAsiaPnl(gh,ga,line,asiah,asiaa){
  var adj=gemHcapAdj(gh,ga,line);
  var ho=asiah||1.9, ao=asiaa||1.9;
  if(adj> 0.3)  return {h:ho-1,    a:-1};
  if(adj==0.25) return {h:(ho-1)*.5,a:-.5};
  if(adj==0)    return {h:0,        a:0};
  if(adj==-0.25)return {h:-.5,      a:(ao-1)*.5};
  return           {h:-1,           a:ao-1};
}

var GEM_TIPSUM_MAP ={'H':1.0,'1H':0.8,'D':0.6,'1D':0.6,'1B':0.0,'B':0.0,'A':-0.8,'1A':-1.0,'S':0.0};
var GEM_TIPSID_MAP ={'H':1.0,'D':0.3,'B':0.0,'S':0.0,'A':-1.0};
var GEM_TIPSMAC_MAP={'H':1.0,'D':0.3,'A':-1.0};
var GEM_TIPSON_MAP ={'H':1.0,'1H':0.7,'1D':0.3,'D':0.3,'B':0.0,'S':0.0,'A':-1.0,'1A':-0.7};
function gemEncodeTip(val,map){ return map[String(val||'')]||0; }

var GEM_FEATURE_NAMES = [
  'Asia Line','Market Implied H%','Lean Drift','Lean × Line',
  'JC Line Move','H Odds Drift','A Odds Drift',
  'JC Sum Tip','JC SID Tip','MAC Tip','ON Tip',
  'GEM H Votes','GEM A Votes','GPT H Votes','GPT A Votes',
  'GEM Net','GPT Net','GEM×Line','GPT×Line'
];

function gemExtractFeatures(r){
  var asiah  = r.ASIAH  || 0;
  var asiaa  = r.ASIAA  || 0;
  var asiahn = (r.ASIAHLN && r.ASIAHLN>0) ? r.ASIAHLN : asiah;
  var asiaan = (r.ASIAALN && r.ASIAALN>0) ? r.ASIAALN : asiaa;
  var linen  = r.ASIALINELN || r.ASIALINE || 0;
  var line   = r.ASIALINE || 0;

  var vigH   = asiah>0 ? 1/asiah : 0.5;
  var vigA   = asiaa>0 ? 1/asiaa : 0.5;
  var impliedH = vigH/(vigH+vigA||1);

  // Opening implied H% (skip if opening odds not available)
  var openH=0, openA=0, openImpl=impliedH;
  if(asiahn>0 && asiaan>0){
    openH = 1/asiahn; openA = 1/asiaan;
    openImpl = openH/(openH+openA||1);
  }
  var leanDrift = impliedH - openImpl;  // + = money moved toward H

  // GEM / GPT (normalised to 0-1 range)
  var gemH = Math.min(r.GEMH||0, 9)/9;
  var gemA = Math.min(r.GEMA||0, 9)/9;
  var gptH = Math.min(r.GPTH||0, 8)/8;
  var gptA = Math.min(r.GPTA||0, 7)/7;
  var gemNet = gemH - gemA;   // net GEM lean
  var gptNet = gptH - gptA;   // net GPT lean

  return [
    line,                                     //  0 Asia handicap line
    impliedH,                                 //  1 Market implied H% (closing)
    leanDrift,                                //  2 Lean drift (closing - opening)
    impliedH * line,                          //  3 Lean × Line interaction
    (line - linen),                           //  4 JC line movement
    (asiah - asiahn),                         //  5 H odds drift
    (asiaa - asiaan),                         //  6 A odds drift
    gemEncodeTip(r.JCTIPSUM,  GEM_TIPSUM_MAP),//  7 JC Sum tip
    gemEncodeTip(r.JCTIPSID,  GEM_TIPSID_MAP),//  8 JC SID tip
    gemEncodeTip(r.TIPSIDMAC, GEM_TIPSMAC_MAP),// 9 MAC tip
    gemEncodeTip(r.TIPSONID,  GEM_TIPSON_MAP),// 10 ON tip
    gemH,                                     // 11 GEM H votes (norm)
    gemA,                                     // 12 GEM A votes (norm)
    gptH,                                     // 13 GPT H votes (norm)
    gptA,                                     // 14 GPT A votes (norm)
    gemNet,                                   // 15 GEM net (H-A)
    gptNet,                                   // 16 GPT net (H-A)
    gemNet * line,                            // 17 GEM net × Line interaction
    gptNet * line                             // 18 GPT net × Line interaction
  ];
}

// ── Logistic Regression (Fisher-Yates shuffle for perm importance) ─
function gemStandardize(X){
  var d=X[0].length, n=X.length;
  var mu=[],sd=[];
  for(var j=0;j<d;j++){
    var col=X.map(function(r){return r[j];});
    var m=col.reduce(function(a,b){return a+b;},0)/n; mu.push(m);
    var v=col.reduce(function(a,x){return a+(x-m)*(x-m);},0)/n;
    sd.push(Math.sqrt(v)||1);
  }
  return {
    Xs: X.map(function(row){return row.map(function(x,j){return (x-mu[j])/sd[j];});}),
    mu:mu, sd:sd
  };
}
function gemApplyStd(X,mu,sd){
  return X.map(function(row){return row.map(function(x,j){return (x-mu[j])/(sd[j]||1);});});
}
function gemTrainLR(X,y,epochs,lr){
  epochs=epochs||600; lr=lr||0.05;
  var n=X.length, d=X[0].length;
  var w=new Array(d).fill(0), b=0;
  for(var ep=0;ep<epochs;ep++){
    var gw=new Array(d).fill(0), gb=0;
    for(var i=0;i<n;i++){
      var p=gemSigmoid(X[i].reduce(function(s,x,j){return s+w[j]*x;},0)+b);
      var e=p-y[i];
      for(var j=0;j<d;j++) gw[j]+=e*X[i][j];
      gb+=e;
    }
    for(var j=0;j<d;j++) w[j]-=lr*gw[j]/n;
    b-=lr*gb/n;
  }
  return {w:w,b:b};
}
function gemPredict(model,x){
  return gemSigmoid(x.reduce(function(s,v,j){return s+model.w[j]*v;},0)+model.b);
}

// ── Main compute function ─────────────────────────────────────────
function computeGEM(results){
  // Filter: must have GEM votes AND valid Asia odds AND result
  var samples = results.filter(function(r){
    return r.STATUS==='Result'
      && r.ASIALINE!=null
      && r.RESULTH!=null && r.RESULTA!=null
      && r.ASIAH && r.ASIAA
      && ((r.GEMH||0)+(r.GEMA||0)>0);   // must have GEM data
  });

  if(samples.length < 100) return null;

  // Build sample objects
  var data = [];
  samples.forEach(function(r){
    var o=gemHcapOutcome(r.RESULTH,r.RESULTA,r.ASIALINE);
    if(o==='P') return; // skip pushes
    var pnl=gemAsiaPnl(r.RESULTH,r.RESULTA,r.ASIALINE,r.ASIAH,r.ASIAA);
    var x=gemExtractFeatures(r);
    var hSide=(o==='HW'||o==='HH');
    data.push({r:r,x:x,outcome:o,hSide:hSide,hp:pnl.h,ap:pnl.a});
  });

  // Sort by date (temporal split)
  data.sort(function(a,b){
    var da=a.r.DATE||''; var db=b.r.DATE||'';
    return da<db?-1:da>db?1:0;
  });

  var n=data.length;
  var splitIdx=Math.floor(n*0.75);
  var train=data.slice(0,splitIdx);
  var test =data.slice(splitIdx);

  var Xtr=train.map(function(s){return s.x;});
  var ytr=train.map(function(s){return s.hSide?1:0;});
  var std=gemStandardize(Xtr);
  var Xtr_s=std.Xs;
  var model=gemTrainLR(Xtr_s,ytr,700,0.05);
  model.mu=std.mu; model.sd=std.sd;

  // Score test set
  var Xte_s=gemApplyStd(test.map(function(s){return s.x;}),std.mu,std.sd);
  test.forEach(function(s,i){
    s.pH=gemPredict(model,Xte_s[i]);
    s.pA=1-s.pH;
  });

  // Accuracy
  var correct=test.filter(function(s){return (s.pH>=0.5)===s.hSide;}).length;
  var testAcc=correct/test.length;

  // ROI at thresholds
  var THRESH=[0.50,0.52,0.55,0.58,0.60];
  var roiResults=THRESH.map(function(th){
    var hb=0,hw=0,hh=0,hpnl=0, ab=0,aw=0,ah=0,apnl=0;
    test.forEach(function(s){
      if(s.pH>=th){ hb++; if(s.outcome==='HW') hw++; if(s.outcome==='HH') hh++; hpnl+=s.hp; }
      if(s.pA>=th){ ab++; if(s.outcome==='AW') aw++; if(s.outcome==='AH') ah++; apnl+=s.ap; }
    });
    return {th:th, res:{
      h:{bets:hb,wins:hw,half:hh,pnl:hpnl,roi:hb?hpnl/hb*100:0},
      a:{bets:ab,wins:aw,half:ah,pnl:apnl,roi:ab?apnl/ab*100:0}
    }};
  });

  // ROI curve (top-N by confidence)
  var sortedH=test.slice().sort(function(a,b){return b.pH-a.pH;});
  var sortedA=test.slice().sort(function(a,b){return b.pA-a.pA;});
  var cumH=0,cumA=0;
  var roiCurveH=sortedH.map(function(s,i){cumH+=s.hp;return Math.round(cumH/(i+1)*10000)/100;});
  var roiCurveA=sortedA.map(function(s,i){cumA+=s.ap;return Math.round(cumA/(i+1)*10000)/100;});

  // Permutation importance (5 repeats, H-ROI + A-ROI drop)
  var PERM_THRESH=0.55, REPEATS=5;
  var baseH=0,baseA=0,baseHn=0,baseAn=0;
  test.forEach(function(s){
    if(s.pH>=PERM_THRESH){baseHn++;baseH+=s.hp;}
    if(s.pA>=PERM_THRESH){baseAn++;baseA+=s.ap;}
  });
  var baseHroi=baseHn?baseH/baseHn*100:0;
  var baseAroi=baseAn?baseA/baseAn*100:0;

  function shuffle(arr){
    for(var i=arr.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=arr[i];arr[i]=arr[j];arr[j]=t;
    }
    return arr;
  }

  var importance=GEM_FEATURE_NAMES.map(function(name,fi){
    var hDrops=[],aDrops=[];
    for(var rep=0;rep<REPEATS;rep++){
      var perm=Xte_s.map(function(x){return x.slice();});
      var col=perm.map(function(x){return x[fi];});
      shuffle(col);
      perm.forEach(function(x,i){x[fi]=col[i];});
      var hb=0,hpnl=0,ab=0,apnl=0;
      test.forEach(function(s,i){
        var ph=gemPredict(model,perm[i]), pa=1-ph;
        if(ph>=PERM_THRESH){hb++;hpnl+=s.hp;}
        if(pa>=PERM_THRESH){ab++;apnl+=s.ap;}
      });
      hDrops.push(baseHroi-(hb?hpnl/hb*100:0));
      aDrops.push(baseAroi-(ab?apnl/ab*100:0));
    }
    var hMean=hDrops.reduce(function(a,b){return a+b;},0)/REPEATS;
    var aMean=aDrops.reduce(function(a,b){return a+b;},0)/REPEATS;
    var hStd=Math.sqrt(hDrops.reduce(function(a,d){return a+(d-hMean)*(d-hMean);},0)/REPEATS)||0.01;
    var aStd=Math.sqrt(aDrops.reduce(function(a,d){return a+(d-aMean)*(d-aMean);},0)/REPEATS)||0.01;
    return {name:name,hDrop:hMean,aDrop:aMean,hSNR:hMean/hStd,aSNR:aMean/aStd};
  });
  importance.sort(function(a,b){return b.hDrop-a.hDrop;});

  // Upcoming predictions
  var upcoming=results.filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIALINE!=null && r.ASIAH && r.ASIAA
      && ((r.GEMH||0)+(r.GEMA||0)>0);
  });
  upcoming.sort(function(a,b){return (a.DATE||'').localeCompare(b.DATE||'')||(a.TIME||0)-(b.TIME||0);});

  var predictions=upcoming.map(function(r){
    var x=gemExtractFeatures(r);
    var xs=x.map(function(v,j){return (v-model.mu[j])/(model.sd[j]||1);});
    var pH=gemPredict(model,xs), pA=1-pH;
    var rec=pH>=0.60?'H':pA>=0.60?'A':'SKIP';
    var conf=Math.max(pH,pA);
    var thIdx=Math.min(4,Math.floor((conf-0.50)/0.025));
    var ri=roiResults[Math.min(thIdx,roiResults.length-1)];
    var expRoi=rec==='H'?ri.res.h.roi:rec==='A'?ri.res.a.roi:0;
    var fv=GEM_FEATURE_NAMES.map(function(nm,j){
      return {name:nm,raw:x[j],contrib:model.w[j]*(x[j]-model.mu[j])/(model.sd[j]||1)};
    });
    fv.sort(function(a,b){return Math.abs(b.contrib)-Math.abs(a.contrib);});
    return {r:r,pH:pH,pA:pA,rec:rec,conf:conf,expRoi:expRoi,featureVals:fv};
  });
  predictions.sort(function(a,b){return b.conf-a.conf;});

  // Data coverage stats
  var withGPT=results.filter(function(r){return r.STATUS==='Result'&&((r.GPTH||0)+(r.GPTA||0)>0);}).length;
  var dateStart=data[0]?data[0].r.DATE:'';
  var dateEnd  =data[n-1]?data[n-1].r.DATE:'';

  return {
    nTotal:n, nTrain:train.length, nTest:test.length,
    testAcc:testAcc,
    roiResults:roiResults,
    roiCurveH:roiCurveH, roiCurveA:roiCurveA,
    importance:importance,
    testSamples:test,
    predictions:predictions,
    model:model,
    dateStart:dateStart, dateEnd:dateEnd,
    withGPT:withGPT
  };
}

// ── Render ────────────────────────────────────────────────────────
function renderGEM(RD){
  var el=document.getElementById('tab10');
  if(!el) return;

  var ml=computeGEM(RD.results||RD);
  if(!ml){
    el.innerHTML='<div style="padding:20px;color:#64748b">Insufficient GEM data (need ≥100 matches with GEM votes).</div>';
    return;
  }

  var h='';

  // ── Header cards ──
  h+='<div class="rpt-cards">';
  h+=gemCard('GEM-Era Records',ml.nTotal,'Used for training + testing');
  h+=gemCard('Training Set',ml.nTrain,'75% oldest (temporal split)');
  h+=gemCard('Test Set',ml.nTest,'25% most recent');
  h+=gemCard('Test Accuracy',(ml.testAcc*100).toFixed(1)+'%',ml.testAcc>=0.53?'pos':'neg');
  h+='</div>';

  // ── Date range + GPT coverage ──
  h+='<div style="font-size:10px;color:#64748b;font-family:var(--mono);margin-bottom:12px">';
  h+='Data range: <b style="color:#94a3b8">'+ml.dateStart+' → '+ml.dateEnd+'</b>';
  h+=' · GPT records: <b style="color:#94a3b8">'+ml.withGPT+'</b>';
  h+='</div>';

  // ── Feature set explanation ──
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:14px">';
  h+='<div style="font-size:10px;font-weight:700;color:#cbd5e1;margin-bottom:6px">19 Features (vs 18 in Main Model)</div>';
  h+='<div style="font-size:10px;color:#64748b;line-height:1.6">';
  h+='<b style="color:#4ade80">New vs main model:</b> Lean Drift (closing − opening implied H%), ';
  h+='Lean×Line interaction, GEM H/A votes, GPT H/A votes, GEM net×Line, GPT net×Line. ';
  h+='GEM/GPT are real values here (not zero-filled) since only GEM-era records are used.';
  h+='</div></div>';

  // ── ROI table ──
  h+='<div class="rpt-title">📊 ROI by Confidence Threshold (Test Set)</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
  h+='<th>Threshold</th><th class="num">H Bets</th><th class="num">H Win</th><th class="num">H ½Win</th><th class="num" style="color:#f87171">H ROI</th>';
  h+='<th class="num">A Bets</th><th class="num">A Win</th><th class="num">A ½Win</th><th class="num" style="color:#60a5fa">A ROI</th>';
  h+='</tr></thead><tbody>';
  ml.roiResults.forEach(function(rr){
    var rh=rr.res.h, ra=rr.res.a;
    h+='<tr>';
    h+='<td style="font-family:var(--mono);font-weight:700">≥'+(rr.th*100).toFixed(0)+'%</td>';
    h+='<td class="num">'+rh.bets+'</td><td class="num">'+rh.wins+'</td><td class="num">'+rh.half+'</td>';
    h+='<td class="num '+(rh.roi>=0?'pos':'neg')+'">'+(rh.roi>=0?'+':'')+rh.roi.toFixed(1)+'%</td>';
    h+='<td class="num">'+ra.bets+'</td><td class="num">'+ra.wins+'</td><td class="num">'+ra.half+'</td>';
    h+='<td class="num '+(ra.roi>=0?'pos':'neg')+'">'+(ra.roi>=0?'+':'')+ra.roi.toFixed(1)+'%</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';

  // ── ROI Curve ──
  h+='<div class="chart-box">';
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">ROI Curve — Last 100 Bets by Confidence (Test Set)</div>';
  h+='<canvas id="gemRoiChart" style="width:100%;display:block"></canvas>';
  h+='<div style="font-size:9px;color:#64748b;margin-top:4px"><span style="color:#f87171">Red = H bets</span>, <span style="color:#60a5fa">Blue = A bets</span>. Sorted highest confidence first.</div>';
  h+='</div>';

  // ── Feature Importance ──
  h+='<div class="rpt-title" style="margin-top:14px">🔬 Feature Importance (Permutation, Test Set)</div>';
  h+='<div class="rpt-sub">Drop in ROI when feature is shuffled. Larger drop = more important. ✓ = SNR > 2 (reliable).</div>';
  h+='<div class="chart-box"><canvas id="gemImportChart" style="width:100%;display:block"></canvas></div>';

  // ── Past Results ──
  h+=gemRenderPastResults(ml.testSamples);

  // ── Upcoming Predictions ──
  h+=gemRenderPredictions(ml.predictions, ml.testAcc);

  el.innerHTML=h;

  setTimeout(function(){
    gemDrawRoiCurve(ml.roiCurveH.slice(-100), ml.roiCurveA.slice(-100));
    gemDrawImportance(ml.importance);
  },50);
}

function gemCard(label,val,sub){
  var isPos=(sub==='pos'), isNeg=(sub==='neg');
  var col=isPos?'#4ade80':isNeg?'#f87171':'var(--text)';
  return '<div class="rpt-card">'+
    '<div class="rpt-card-label">'+label+'</div>'+
    '<div class="rpt-card-val" style="color:'+col+'">'+val+'</div>'+
    ((!isPos&&!isNeg&&sub)?'<div class="rpt-card-sub">'+sub+'</div>':'')+
    '</div>';
}

// ── Past Results Table ────────────────────────────────────────────
function gemRenderPastResults(testSamples){
  if(!testSamples||!testSamples.length) return '';
  var rows=testSamples.slice(-50).reverse();
  var chrono=rows.slice().reverse();
  var cumC=0;
  var runAcc=chrono.map(function(s,i){
    if((s.pH>=0.5)===s.hSide) cumC++;
    return Math.round(cumC/(i+1)*1000)/10;
  });
  runAcc.reverse();

  var totalCorrect=testSamples.filter(function(s){return (s.pH>=0.5)===s.hSide;}).length;
  var totalH=testSamples.filter(function(s){return s.pH>=0.55;});
  var totalA=testSamples.filter(function(s){return s.pA>=0.55;});
  var hPnl=totalH.reduce(function(a,s){return a+s.hp;},0);
  var aPnl=totalA.reduce(function(a,s){return a+s.ap;},0);
  var nAcc=testSamples.length, nH=totalH.length, nA=totalA.length;

  function rel(n){ return n<25?{l:'✗ Meaningless',c:'#f87171'}:n<100?{l:'⚠ Unreliable',c:'#fb923c'}:n<200?{l:'~ Rough',c:'#facc15'}:{l:'✓ Reliable',c:'#4ade80'}; }
  function ci(n){ return n>0?Math.round(1.96*Math.sqrt(0.25/n)*100*10)/10:999; }
  function rci(n){ return n>0?Math.round(1.96*Math.sqrt(0.25/n)*95*10)/10:999; }

  var accPct=Math.round(totalCorrect/nAcc*1000)/10;
  var hRoi=Math.round(hPnl/Math.max(1,nH)*1000)/10;
  var aRoi=Math.round(aPnl/Math.max(1,nA)*1000)/10;
  var ar=rel(nAcc), hr=rel(nH), arr=rel(nA);

  var h='<div style="margin-top:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title">📋 Past Predictions — Last '+rows.length+' shown (stats = all '+nAcc+' test matches)</div>';
  h+='<div class="rpt-sub" style="margin-bottom:10px">GEM-era test set results. Summary covers all '+nAcc+' test matches.</div>';

  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">';
  function statRow(label,col,val,ciW,n,rel){
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
      '<span style="font-size:10px;color:'+col+';font-family:var(--mono);width:90px;flex-shrink:0">'+label+'</span>'+
      '<span style="font-size:13px;font-weight:800;font-family:var(--mono);color:'+val.startsWith('-')?'#f87171':'#4ade80'+'">'+val+'</span>'+
      '<span style="font-size:9px;color:#64748b;font-family:var(--mono)">±'+ciW+'% (95% CI) · n='+n+'</span>'+
      '<span style="font-size:9px;font-weight:700;color:'+rel.c+'">'+rel.l+'</span>'+
      '</div>';
  }
  h+=statRow('Accuracy','#94a3b8',accPct+'%',ci(nAcc),nAcc,ar);
  h+=statRow('H bets ≥55%','#f87171',(hRoi>=0?'+':'')+hRoi+'%',rci(nH),nH,hr);
  h+=statRow('A bets ≥55%','#60a5fa',(aRoi>=0?'+':'')+aRoi+'%',rci(nA),nA,arr);
  if(nH<100||nA<100){
    h+='<div style="margin-top:4px;font-size:10px;color:#fb923c;border-top:1px solid var(--border);padding-top:6px">';
    h+='⚠ Sample too small for reliable conclusions. Need ≥100 bets per side. GEM data only available from late 2025.';
    h+='</div>';
  }
  h+='</div>';

  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px">';
  h+='<thead><tr><th>Date</th><th>Match</th><th class="num">Line</th>';
  h+='<th class="num">H%</th><th class="num">A%</th><th class="num">Pick</th>';
  h+='<th class="num">Conf</th><th class="num">Outcome</th><th class="num">Hit</th><th class="num">Run.Acc</th>';
  h+='</tr></thead><tbody>';
  rows.forEach(function(s,i){
    var r=s.r, pred=s.pH>=0.5?'H':'A', conf=Math.round(Math.max(s.pH,s.pA)*100);
    var correct=(s.pH>=0.5)===s.hSide;
    var outLabel=s.outcome==='HW'?'H Win':s.outcome==='HH'?'H ½Win':s.outcome==='AH'?'A ½Win':'A Win';
    var outColor=s.hSide?'#4ade80':'#f87171';
    var hitColor=correct?'#4ade80':'#f87171';
    var confColor=conf>=65?'#4ade80':conf>=60?'#facc15':'#94a3b8';
    var accColor=runAcc[i]>=55?'#4ade80':runAcc[i]>=50?'#94a3b8':'#f87171';
    h+='<tr>';
    h+='<td style="color:#64748b;font-family:var(--mono);font-size:10px">'+(r.DATE||'').slice(5)+'</td>';
    h+='<td style="max-width:140px;overflow:hidden"><span style="color:#e2e8f0;font-size:10px;white-space:nowrap">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</td>';
    h+='<td class="num" style="color:#f87171;font-family:var(--mono)">'+Math.round(s.pH*100)+'%</td>';
    h+='<td class="num" style="color:#60a5fa;font-family:var(--mono)">'+Math.round(s.pA*100)+'%</td>';
    h+='<td class="num"><b style="color:'+(pred==='H'?'#f87171':'#60a5fa')+'">'+pred+'</b></td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+confColor+'">'+conf+'%</td>';
    h+='<td class="num" style="color:'+outColor+';font-size:10px">'+outLabel+'</td>';
    h+='<td class="num" style="font-size:14px;font-weight:800;color:'+hitColor+'">'+(correct?'✓':'✗')+'</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+accColor+'">'+runAcc[i].toFixed(1)+'%</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

// ── Upcoming Predictions Table ────────────────────────────────────
function gemRenderPredictions(predictions, testAcc){
  if(!predictions||!predictions.length){
    return '<div style="padding:14px;color:#64748b;font-size:12px">No upcoming GEM matches found.</div>';
  }
  var recColor=function(r){return r==='H'?'#f87171':r==='A'?'#60a5fa':'#64748b';};
  var nH=predictions.filter(function(p){return p.rec==='H';}).length;
  var nA=predictions.filter(function(p){return p.rec==='A';}).length;
  var nS=predictions.filter(function(p){return p.rec==='SKIP';}).length;

  var h='<div style="margin-top:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title">🎯 Upcoming GEM Match Predictions</div>';
  h+='<div class="rpt-sub" style="margin-bottom:10px">Only matches with GEM votes. Test accuracy: <b style="color:#4ade80">'+(testAcc*100).toFixed(1)+'%</b>. Use as one signal only.</div>';
  h+='<div style="display:flex;gap:12px;margin-bottom:10px;font-size:11px;font-family:var(--mono);flex-wrap:wrap">';
  h+='<span style="color:#f87171;font-weight:700">H picks (≥60%): '+nH+'</span>';
  h+='<span style="color:#60a5fa;font-weight:700">A picks (≥60%): '+nA+'</span>';
  h+='<span style="color:#475569">Skip: '+nS+'</span>';
  h+='</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>';
  h+='<th>Date</th><th>Match</th><th class="num">Line</th><th class="num">H%</th><th class="num">A%</th>';
  h+='<th class="num">GEM</th><th class="num">GPT</th>';
  h+='<th class="num">Pick</th><th class="num">Conf</th><th class="num">Est ROI</th><th style="width:24px"></th>';
  h+='</tr></thead><tbody>';
  predictions.forEach(function(p,idx){
    var r=p.r, rec=p.rec, isSkip=rec==='SKIP';
    var col=recColor(rec), conf=Math.round(Math.max(p.pH,p.pA)*100);
    var confColor=conf>=65?'#4ade80':conf>=60?'#facc15':'#94a3b8';
    var roiSign=p.expRoi>=0?'+':''; var did='gup_'+idx;
    var gemNet=(r.GEMH||0)-(r.GEMA||0), gptNet=(r.GPTH||0)-(r.GPTA||0);
    var gemColor=gemNet>0?'#f87171':gemNet<0?'#60a5fa':'#64748b';
    var gptColor=gptNet>0?'#f87171':gptNet<0?'#60a5fa':'#64748b';
    h+='<tr style="'+(isSkip?'opacity:0.45':'')+'">';
    h+='<td style="color:#64748b;font-family:var(--mono);font-size:10px">'+(r.DATE||'').slice(5)+'</td>';
    h+='<td><div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px"><span style="color:#e2e8f0">'+r.TEAMH+'</span><span style="color:#475569;font-size:9px"> vs </span><span style="color:#e2e8f0">'+r.TEAMA+'</span></div></td>';
    h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</td>';
    h+='<td class="num" style="color:#f87171;font-family:var(--mono)">'+Math.round(p.pH*100)+'%</td>';
    h+='<td class="num" style="color:#60a5fa;font-family:var(--mono)">'+Math.round(p.pA*100)+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+gemColor+';font-size:10px">'+(r.GEMH||0)+'H/'+(r.GEMA||0)+'A</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+gptColor+';font-size:10px">'+(r.GPTH||0)+'H/'+(r.GPTA||0)+'A</td>';
    h+='<td class="num"><b style="font-size:12px;color:'+col+'">'+rec+'</b></td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+confColor+';font-weight:700">'+conf+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+(p.expRoi>=0?'#4ade80':'#f87171')+'">'+(isSkip?'—':roiSign+p.expRoi.toFixed(1)+'%')+'</td>';
    h+='<td><button onclick="var el=document.getElementById(\''+did+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:10px;color:#64748b;background:none;border:none;cursor:pointer;padding:0">▶</button></td>';
    h+='</tr><tr><td colspan="11" style="padding:0"><div id="'+did+'" style="display:none;padding:8px 12px;background:var(--surface)">';
    h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
    var maxC=Math.max.apply(null,p.featureVals.map(function(f){return Math.abs(f.contrib);}));
    p.featureVals.slice(0,9).forEach(function(f){
      var c2=f.contrib>0?'#f87171':'#60a5fa';
      var rd=(f.name.indexOf('%')>=0)?((f.raw*100).toFixed(0)+'%'):f.raw.toFixed(2);
      h+='<div style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+c2+'15;border:1px solid '+c2+'33;color:'+c2+'">'+f.name+': '+rd+' ('+(f.contrib>=0?'+':'')+f.contrib.toFixed(2)+')</div>';
    });
    h+='</div></div></td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

// ── Canvas Charts ─────────────────────────────────────────────────
function gemDrawRoiCurve(hPts,aPts){
  var canvas=document.getElementById('gemRoiChart');
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.offsetWidth||300, H=120;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);
  var pL=36,pR=50,pT=10,pB=18,cw=W-pL-pR,ch=H-pT-pB;
  var all=hPts.concat(aPts);
  var mn=Math.min(0,Math.min.apply(null,all)), mx=Math.max(0,Math.max.apply(null,all));
  var range=mx-mn||1;
  function yy(v){return pT+(1-(v-mn)/range)*ch;}
  function xx(i,len){return pL+i/((len-1)||1)*cw;}
  ctx.font='8px IBM Plex Mono'; ctx.textBaseline='middle'; ctx.textAlign='right';
  for(var i=0;i<=4;i++){
    var v=mn+(mx-mn)*i/4, y=yy(v);
    ctx.fillStyle='#64748b'; ctx.fillText((v>=0?'+':'')+v.toFixed(1)+'%',pL-3,y);
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+cw,y); ctx.stroke();
  }
  var zy=yy(0);
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(pL,zy); ctx.lineTo(pL+cw,zy); ctx.stroke();
  ctx.setLineDash([]);
  function drawLine(pts,color){
    if(!pts.length) return;
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=1.5;
    pts.forEach(function(v,i){var x=xx(i,pts.length),y=yy(v);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
    var last=pts[pts.length-1];
    ctx.font='9px IBM Plex Mono'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=color;
    ctx.fillText((last>=0?'+':'')+last.toFixed(1)+'%',pL+cw+3,yy(last));
  }
  drawLine(hPts,'#f87171'); drawLine(aPts,'#60a5fa');
  ctx.font='9px IBM Plex Mono'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle='#f87171'; ctx.fillRect(pL,pT,18,2); ctx.fillText('H',pL+20,pT+1);
  ctx.fillStyle='#60a5fa'; ctx.fillRect(pL+30,pT,18,2); ctx.fillText('A',pL+50,pT+1);
}

function gemDrawImportance(importance){
  var canvas=document.getElementById('gemImportChart');
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var N=importance.length;
  var ROW=22, W=canvas.parentElement.offsetWidth||400;
  var H=(N+1)*ROW+20;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);
  var labelW=130, barArea=W-labelW-60, midX=labelW+barArea/2;
  var maxDrop=Math.max.apply(null,importance.map(function(f){return Math.max(Math.abs(f.hDrop),Math.abs(f.aDrop));}));
  var scale=maxDrop>0?(barArea/2)/maxDrop:1;
  ctx.font='8px IBM Plex Mono';
  // Legend
  ctx.fillStyle='#f87171'; ctx.fillRect(labelW,4,16,4); ctx.fillStyle='#94a3b8'; ctx.fillText('H-ROI drop',labelW+20,8);
  ctx.fillStyle='#60a5fa'; ctx.fillRect(labelW+90,4,16,4); ctx.fillText('A-ROI drop',labelW+110,8);
  importance.forEach(function(f,i){
    var y=20+i*ROW;
    ctx.fillStyle='#64748b'; ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText(f.name,labelW-4,y+ROW/2);
    // H drop bar
    var hw=Math.abs(f.hDrop)*scale;
    ctx.fillStyle='#f87171'; ctx.globalAlpha=0.8;
    ctx.fillRect(midX-(f.hDrop>0?hw:0),y+2,hw,8);
    // A drop bar
    var aw=Math.abs(f.aDrop)*scale;
    ctx.fillStyle='#60a5fa';
    ctx.fillRect(midX-(f.aDrop>0?aw:0),y+12,aw,8);
    ctx.globalAlpha=1;
    // SNR badge
    if(Math.abs(f.hSNR)>2||Math.abs(f.aSNR)>2){
      ctx.fillStyle='#4ade80'; ctx.textAlign='left';
      ctx.fillText('✓',midX+barArea/2+4,y+ROW/2);
    }
  });
  // Zero line
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(midX,16); ctx.lineTo(midX,H-4); ctx.stroke();
}
