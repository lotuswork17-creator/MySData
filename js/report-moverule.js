// ── report-moverule.js — Market Movement Rule Analysis ──
// Rules based on expert tips × line movement × odds movement (opening→latest)
// All rules verified on train (75%) and test (25%) temporal splits.

// ── Helpers ──
function mrLean(r){
  var h=parseFloat(r.ASIAH)||0, a=parseFloat(r.ASIAA)||0;
  if(!h||!a) return null;
  var vh=1/h, va=1/a;
  return vh/(vh+va);
}

function mrLineMoveDir(r){
  var ln=r.ASIALINELN;
  if(ln==null) return null;
  var diff=Math.round((parseFloat(r.ASIALINE)-ln)*100)/100;
  if(diff>0.01) return 'up';
  if(diff<-0.01) return 'down';
  return 'flat';
}

function mrHOddsMove(r){
  var opn=r.ASIAHLN;
  if(!opn||opn===0) return null;
  var ratio=parseFloat(r.ASIAH)/opn;
  if(ratio<=0.97) return 'short';
  if(ratio>=1.03) return 'drift';
  return 'flat';
}

function mrAOddsMove(r){
  var opn=r.ASIAALN;
  if(!opn||opn===0) return null;
  var ratio=parseFloat(r.ASIAA)/opn;
  if(ratio<=0.97) return 'short';
  if(ratio>=1.03) return 'drift';
  return 'flat';
}

function mrPnl(r){
  var gh=parseFloat(r.RESULTH)||0, ga=parseFloat(r.RESULTA)||0;
  var line=parseFloat(r.ASIALINE)||0;
  var oh=parseFloat(r.ASIAH)||0, oa=parseFloat(r.ASIAA)||0;
  if(!oh||!oa) return null;
  var adj=Math.round((gh-ga+line)*4)/4;
  if(Math.abs(adj)<0.01) return {h:0,a:0};
  if(adj>0.25)  return {h:oh-1, a:-1};
  if(adj>0)     return {h:(oh-1)*0.5, a:-0.5};
  if(adj<-0.25) return {h:-1, a:oa-1};
  if(adj<0)     return {h:-0.5, a:(oa-1)*0.5};
  return {h:0,a:0};
}

function mrRoiOf(arr){ return !arr.length?0:Math.round(arr.reduce(function(s,v){return s+v;},0)/arr.length*1000)/10; }

// ── Verified Rules ──
var MR_TIP_MAP = {'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0};

var MR_RULES = [
  // ── MAC rules (strongest signals, re-verified on 9,792 records) ──
  {
    label:'MAC→H + Line↓ + H drift + A short → Bet A',
    desc: 'MAC tips H but line shortened + H drifting + A shortened. Triple market signal against MAC — strongest counter.',
    exp:'TIPSIDMAC', tip_dir:1, bet:'A', lm:'down', hom:'drift', aom:'short',
    roi:9.7, train:5.7, test:21.0, type:'COUNTER'
  },
  {
    label:'MAC→H + Line↓ + H drift → Bet A',
    desc: 'MAC tips H but line shortened and H odds drifting — market fading MAC on two dimensions.',
    exp:'TIPSIDMAC', tip_dir:1, bet:'A', lm:'down', hom:'drift', aom:null,
    roi:9.4, train:6.4, test:18.2, type:'COUNTER'
  },
  {
    label:'MAC→H + Line↓ → Bet A',
    desc: 'MAC tips H but line shortened (H handicap grew). Market structurally disagrees with MAC.',
    exp:'TIPSIDMAC', tip_dir:1, bet:'A', lm:'down', hom:null, aom:null,
    roi:6.2, train:6.0, test:6.8, type:'COUNTER'
  },
  {
    label:'MAC→H + H drift → Bet A',
    desc: 'MAC tips H but H odds drifting outward — market money leaving H side. Fade MAC.',
    exp:'TIPSIDMAC', tip_dir:1, bet:'A', lm:null, hom:'drift', aom:null,
    roi:6.6, train:5.9, test:8.9, type:'COUNTER'
  },
  {
    label:'MAC→H + Line flat + H drift → Bet A',
    desc: 'MAC tips H, line unchanged, but H odds drifting. Pure odds signal against MAC→H.',
    exp:'TIPSIDMAC', tip_dir:1, bet:'A', lm:'flat', hom:'drift', aom:null,
    roi:6.5, train:6.5, test:6.7, type:'COUNTER'
  },
  {
    label:'MAC→A + Line↑ + H short + A drift → Bet H',
    desc: 'MAC tips A but line lengthened + H shortened + A drifted. Full structural reversal — bet H.',
    exp:'TIPSIDMAC', tip_dir:-1, bet:'H', lm:'up', hom:'short', aom:'drift',
    roi:6.0, train:4.3, test:14.1, type:'COUNTER'
  },
  {
    label:'MAC→A + Line↑ + H short → Bet H',
    desc: 'MAC tips A but line moved longer (H favored more) + H odds shortened. Market backs H.',
    exp:'TIPSIDMAC', tip_dir:-1, bet:'H', lm:'up', hom:'short', aom:null,
    roi:6.0, train:4.3, test:14.1, type:'COUNTER'
  },
  {
    label:'MAC→A + Line↑ + A drift → Bet H',
    desc: 'MAC tips A but line up and A odds drifting — double signal that market prefers H.',
    exp:'TIPSIDMAC', tip_dir:-1, bet:'H', lm:'up', hom:null, aom:'drift',
    roi:4.5, train:4.1, test:6.3, type:'COUNTER'
  },
  {
    label:'MAC→A + Line↑ → Bet H',
    desc: 'MAC tips A but line moved up (H handicap grew). Market structure contradicts MAC.',
    exp:'TIPSIDMAC', tip_dir:-1, bet:'H', lm:'up', hom:null, aom:null,
    roi:3.9, train:3.9, test:4.1, type:'COUNTER'
  },
  // ── JCSID rules ──
  {
    label:'JCSID→H + Line flat + H drift + A short → Bet A',
    desc: 'JCSID tips H on flat line but H drifting + A shortening — odds movement strongly against JCSID.',
    exp:'JCTIPSID', tip_dir:1, bet:'A', lm:'flat', hom:'drift', aom:'short',
    roi:5.7, train:4.1, test:11.1, type:'COUNTER'
  },
  {
    label:'JCSID→H + Line flat + A short → Bet A',
    desc: 'JCSID tips H on flat line but A odds shortening — market backing Away.',
    exp:'JCTIPSID', tip_dir:1, bet:'A', lm:'flat', hom:null, aom:'short',
    roi:5.2, train:4.0, test:9.3, type:'COUNTER'
  },
  {
    label:'JCSID→H + H drift + A short → Bet A',
    desc: 'JCSID tips H but H drifting + A shortening — both odds signals say Away.',
    exp:'JCTIPSID', tip_dir:1, bet:'A', lm:null, hom:'drift', aom:'short',
    roi:4.8, train:2.0, test:13.4, type:'COUNTER'
  },
  {
    label:'JCSID→H + A short → Bet A',
    desc: 'JCSID tips H but Away odds shortening — market money flowing contrary to JCSID.',
    exp:'JCTIPSID', tip_dir:1, bet:'A', lm:null, hom:null, aom:'short',
    roi:4.5, train:2.0, test:12.2, type:'COUNTER'
  },
  {
    label:'JCSID→A + Line↓ + H drift → Bet H',
    desc: 'JCSID tips A but line shortened + H drifting. Mixed signal favors H.',
    exp:'JCTIPSID', tip_dir:-1, bet:'H', lm:'down', hom:'drift', aom:null,
    roi:5.2, train:3.7, test:9.9, type:'COUNTER'
  },
  // ── ONID rules ──
  {
    label:'ONID→H + Line flat + H drift + A short → Bet A',
    desc: 'ONID tips H on flat line but H drifting + A shortening. Strongest ONID counter signal.',
    exp:'TIPSONID', tip_dir:1, bet:'A', lm:'flat', hom:'drift', aom:'short',
    roi:9.9, train:12.9, test:1.7, type:'COUNTER'
  },
  {
    label:'ONID→H + Line flat + A short → Bet A',
    desc: 'ONID tips H on flat line but A odds shortening — market backing Away against ONID.',
    exp:'TIPSONID', tip_dir:1, bet:'A', lm:'flat', hom:null, aom:'short',
    roi:9.4, train:12.2, test:1.7, type:'COUNTER'
  },
  {
    label:'ONID→H + H drift → Bet A',
    desc: 'ONID tips H but H odds drifting — market fading ONID→H signal.',
    exp:'TIPSONID', tip_dir:1, bet:'A', lm:null, hom:'drift', aom:null,
    roi:5.4, train:6.2, test:2.7, type:'COUNTER'
  },
  {
    label:'ONID→A + Line↓ + A short → Bet A',
    desc: 'ONID tips A, line shortened, A odds shortening — market confirms ONID. Follow ONID.',
    exp:'TIPSONID', tip_dir:-1, bet:'A', lm:'down', hom:null, aom:'short',
    roi:3.9, train:2.1, test:9.4, type:'WITH'
  },
];

// ── computeMoveRule ──
function computeMoveRule(results, allRecords){
  var TM = MR_TIP_MAP;

  // Filter: need opening odds
  var data = results.filter(function(r){
    return r.STATUS==='Result' &&
      typeof r.RESULTH==='number' && r.RESULTA!=null &&
      r.ASIALINE!=null && r.ASIAH && r.ASIAA &&
      r.ASIAHLN && r.ASIAHLN>0 && r.ASIAALN && r.ASIAALN>0 && r.ASIALINELN!=null;
  });
  data.sort(function(a,b){ return (a.DATE||'')>(b.DATE||'')?1:-1; });

  var n = data.length;
  var splitIdx = Math.floor(n * 0.75);

  function matchRule(r, rule){
    var tv = TM[String(r[rule.exp]||'')];
    if(tv==null||tv!==rule.tip_dir) return false;
    if(rule.lm  && mrLineMoveDir(r)!==rule.lm)  return false;
    if(rule.hom && mrHOddsMove(r)!==rule.hom)   return false;
    if(rule.aom && mrAOddsMove(r)!==rule.aom)   return false;
    return true;
  }

  // Compute live stats per rule
  var ruleSignals = MR_RULES.map(function(rule){
    var key = rule.exp+'|'+rule.tip_dir+'|'+(rule.lm||'*')+'|'+(rule.hom||'*')+'|'+(rule.aom||'*')+'|'+rule.bet;
    var all   = data.filter(function(r){ return matchRule(r,rule); });
    var train = all.filter(function(r,i){ return all.indexOf(r) < splitIdx; });
    // better: use index in data
    var allIdx = [];
    data.forEach(function(r,i){ if(matchRule(r,rule)) allIdx.push({r:r,i:i}); });
    var trainGrp = allIdx.filter(function(x){ return x.i < splitIdx; }).map(function(x){ return x.r; });
    var testGrp  = allIdx.filter(function(x){ return x.i >= splitIdx; }).map(function(x){ return x.r; });

    var pnlFn = rule.bet==='H' ? function(r){ var p=mrPnl(r); return p?p.h:null; }
                                : function(r){ var p=mrPnl(r); return p?p.a:null; };
    var roiAll   = mrRoiOf(allIdx.map(function(x){ return pnlFn(x.r); }).filter(function(v){ return v!==null; }));
    var roiTrain = mrRoiOf(trainGrp.map(pnlFn).filter(function(v){ return v!==null; }));
    var roiTest  = mrRoiOf(testGrp.map(pnlFn).filter(function(v){ return v!==null; }));

    return {
      rule: rule, ruleKey: key,
      n: allIdx.length,
      roi: roiAll, train: roiTrain, test: roiTest,
    };
  });

  // Scan upcoming
  var upcoming = (allRecords||results).filter(function(r){
    return r.STATUS==='PREEVE' && r.ASIALINE!=null && r.ASIAH && r.ASIAA &&
      r.ASIAHLN && r.ASIAHLN>0 && r.ASIAALN && r.ASIAALN>0 && r.ASIALINELN!=null;
  });
  upcoming.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||'')||(a.TIME||0)-(b.TIME||0); });

  var upcomingAlerts = [];
  upcoming.forEach(function(r){
    var fired = [];
    ruleSignals.forEach(function(rs){
      if(matchRule(r, rs.rule)) fired.push(rs);
    });
    if(fired.length) upcomingAlerts.push({r:r, fired:fired, lean:mrLean(r)});
  });

  // Past bets (last 100, newest first)
  var pastBets = [];
  data.slice().sort(function(a,b){
    var dc=(b.DATE||'').localeCompare(a.DATE||'');
    return dc!==0?dc:(b.TIME||0)-(a.TIME||0);
  }).forEach(function(r){
    if(pastBets.length>=100) return;
    var fired = [];
    ruleSignals.forEach(function(rs){ if(matchRule(r,rs.rule)) fired.push(rs); });
    if(!fired.length) return;
    var pnl = mrPnl(r);
    if(!pnl) return;
    var adj = Math.round(((parseFloat(r.RESULTH)||0)-(parseFloat(r.RESULTA)||0)+(parseFloat(r.ASIALINE)||0))*4)/4;
    var outcome = adj>0.25?'HW':adj===0.25?'HH':adj===0?'P':adj===-0.25?'AH':'AW';
    pastBets.push({r:r, fired:fired, pnl:pnl, outcome:outcome});
  });

  // Per-rule last-20 and last-40 ROI
  var dataRev = data.slice().sort(function(a,b){
    var dc=(b.DATE||'').localeCompare(a.DATE||''); return dc!==0?dc:(b.TIME||0)-(a.TIME||0);
  });
  var ruleROI20={}, ruleROI40={};
  ruleSignals.forEach(function(rs){
    var key=rs.ruleKey;
    var pnl20=0,cnt20=0,pnl40=0,cnt40=0;
    for(var di=0;di<dataRev.length&&cnt40<40;di++){
      var r=dataRev[di];
      if(!matchRule(r,rs.rule)) continue;
      var pnlFn = rs.rule.bet==='H' ? function(r){ var p=mrPnl(r); return p?p.h:null; }
                                     : function(r){ var p=mrPnl(r); return p?p.a:null; };
      var v=pnlFn(r); if(v===null) continue;
      if(cnt20<20){pnl20+=v;cnt20++;}
      pnl40+=v;cnt40++;
    }
    ruleROI20[key]=cnt20>=5?Math.round(pnl20/cnt20*1000)/10:null;
    ruleROI40[key]=cnt40>=10?Math.round(pnl40/cnt40*1000)/10:null;
  });

  // ── ROI history chart data ──
  var _mrSkip=300;
  var _mrBets=[];
  data.slice().sort(function(a,b){return(a.DATE||'')>(b.DATE||'')?1:-1;}).forEach(function(r){
    var fired=[];
    ruleSignals.forEach(function(rs){if(matchRule(r,rs.rule))fired.push(rs);});
    if(!fired.length)return;
    var p=mrPnl(r); if(!p)return;
    var bet=fired[0].rule.bet, v=bet==='H'?p.h:p.a;
    if(v!==null)_mrBets.push(v);
  });
  var _mrRoi=[],_mrMa50=[],_mrMa100=[],_mrCum=0;
  _mrBets.forEach(function(v,i){
    _mrCum=Math.round((_mrCum+v)*1000)/1000;
    var n=i+1, rr=Math.round(_mrCum/n*10000)/100;
    var m50=n>=50?Math.round(_mrBets.slice(n-50,n).reduce(function(s,x){return s+x;},0)/50*10000)/100:null;
    var m100=n>=100?Math.round(_mrBets.slice(n-100,n).reduce(function(s,x){return s+x;},0)/100*10000)/100:null;
    if(i>=_mrSkip){_mrRoi.push(rr);_mrMa50.push(m50);_mrMa100.push(m100);}
  });

  return {ruleSignals:ruleSignals, upcomingAlerts:upcomingAlerts, pastBets:pastBets,
          ruleROI20:ruleROI20, ruleROI40:ruleROI40, nRecords:n, splitIdx:splitIdx,
          chartData:{roiPts:_mrRoi,ma50Pts:_mrMa50,ma100Pts:_mrMa100,totalBets:_mrBets.length,skip:_mrSkip}};
}

// ── renderMoveRule ──
function renderMoveRule(RD){
  var el=document.getElementById('tab12');
  if(!el) return;
  if(!RD.moverule){
    if(typeof computeMoveRule==='function'&&RD.results){
      RD.moverule=computeMoveRule(RD.results, RD.records||RD.results);
    } else {
      el.innerHTML='<div style="padding:24px;color:#f87171">Error: computeMoveRule not available.</div>';
      return;
    }
  }
  var mr=RD.moverule;
  var h='';
  h+='<div class="rpt-title">📡 Market Movement Rule Analysis</div>';
  h+='<div class="rpt-sub">Rules discovered from expert tips × opening→latest odds movements (line, H odds, A odds). '
    +'H odds <b style="color:#f87171">shortening</b> = market backing Home. H odds <b style="color:#60a5fa">drifting</b> = market fading Home. '
    +'All rules verified on train (75%) and test (25%) temporal splits. Requires opening odds data (ASIAHLN/ASIAALN).</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:14px">Dataset with opening odds: <b style="color:#e2e8f0">'+mr.nRecords+'</b> records</div>';

  // ── SECTION 1: Upcoming alerts ──
  h+='<div style="margin-bottom:20px">';
  // ── ROI History Chart ──
  if(mr.chartData && mr.chartData.roiPts.length){
    var _mcd=mr.chartData;
    function _mrFill(arr){var f=null;for(var i=0;i<arr.length;i++){if(arr[i]!==null){f=arr[i];break;}}if(f===null)return arr;return arr.map(function(v){return v===null?f:v;});}
    var _mrLastRoi=_mcd.roiPts[_mcd.roiPts.length-1];
    var _mrF50=_mrFill(_mcd.ma50Pts), _mrF100=_mrFill(_mcd.ma100Pts);
    var _mrLast50=_mcd.ma50Pts[_mcd.ma50Pts.length-1], _mrLast100=_mcd.ma100Pts[_mcd.ma100Pts.length-1];
    function _mrFmtL(v){return v!==null?' <b style="font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</b>':'';}
    var _mrSeries=[{label:'Running ROI%'+_mrFmtL(_mrLastRoi),color:'#60a5fa',pts:_mcd.roiPts}];
    if(_mrF50.some(function(v){return v!==null;}))  _mrSeries.push({label:'MA 50'+_mrFmtL(_mrLast50),  color:'#fbbf24',pts:_mrF50});
    if(_mrF100.some(function(v){return v!==null;})) _mrSeries.push({label:'MA 100'+_mrFmtL(_mrLast100),color:'#4ade80',pts:_mrF100});
    h+='<div class="chart-box" style="margin-bottom:16px">'
      +'<div class="chart-box-label">ROI% History — All Verified Rules (first '+_mcd.skip+' bets hidden · '+_mcd.totalBets+' total)</div>'
      +'<div class="chart-legend" id="lgdMrRoi"></div>'
      +'<canvas id="cMrRoi"></canvas>'
      +'</div>';
    setTimeout(function(){
      makeLegend('lgdMrRoi', _mrSeries);
      drawChart('cMrRoi', _mrSeries, null, 150);
    }, 30);
  }

  h+='<div class="rpt-title" style="margin-bottom:4px">🎯 Upcoming Matches — Rules Firing</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:10px">Upcoming matches where at least one movement rule fires. Requires opening odds to be available.</div>';

  if(!mr.upcomingAlerts.length){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently match any movement rule. Opening odds may not yet be available.</div>';
  } else {
    var alertIdx=0;
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
    h+='<th>Date / Time</th><th>Match</th>';
    h+='<th class="num">Line</th><th class="num">AH</th><th class="num">AA</th>';
    h+='<th class="num">Bet</th><th class="num">Type</th><th>Top Rule</th>';
    h+='<th class="num">N</th><th class="num">ROI</th><th class="num">Past 20</th><th class="num">Past 40</th>';
    h+='</tr></thead><tbody>';

    mr.upcomingAlerts.forEach(function(alert){
      var r=alert.r, topRS=alert.fired[0], rule=topRS.rule;
      var betCol=rule.bet==='H'?'#f87171':'#60a5fa';
      var typeCol=rule.type==='COUNTER'?'#fbbf24':'#4ade80';
      var typeLabel=rule.type==='COUNTER'?'⚡':'✓';
      var roiCol=topRS.roi>=7?'#4ade80':topRS.roi>=4?'#a3e635':'#94a3b8';
      var multiMark=alert.fired.length>1?' <span style="color:#a78bfa;font-size:8px">+'+(alert.fired.length-1)+'</span>':'';
      var detId='mrup_'+alertIdx;

      // Line arrows
      var _lineNow=parseFloat(r.ASIALINE), _lineLN=r.ASIALINELN;
      var _lineStr=(_lineNow>=0?'+':'')+_lineNow.toFixed(2);
      if(_lineLN!=null&&_lineLN!==_lineNow){
        var _ld=Math.round((_lineNow-_lineLN)*100)/100;
        if(_ld!==0){var _la=Math.abs(_ld),_ln=_la>=1?3:_la>=0.5?2:1,_larr=_ld<0?'▼':'▲',_lcol=_ld<0?'#f87171':'#60a5fa';
          _lineStr+=('<span style="color:'+_lcol+';font-size:10px;margin-left:2px">'+_larr.repeat(_ln)+'</span>');}
      }
      function _oddsArrow(lat,opn){
        if(!opn||opn===0||lat===opn) return lat!=null?String(lat):'—';
        var s=String(lat),n,arr,col;
        if(lat<opn){n=lat<opn*0.9?3:lat<opn*0.95?2:1;arr='▼';col='#f87171';}
        else{n=lat>opn*1.1?3:lat>opn*1.05?2:1;arr='▲';col='#60a5fa';}
        return s+'<span style="color:'+col+';font-size:10px;margin-left:2px">'+arr.repeat(n)+'</span>';
      }

      var p20val=mr.ruleROI20[topRS.ruleKey];
      var p20col=p20val===null?'#475569':p20val>=0?'#4ade80':'#f87171';
      var p20str=p20val===null?'<span style="color:#475569;font-size:9px">—</span>':'<span style="font-family:var(--mono);font-weight:700;color:'+p20col+'">'+(p20val>=0?'+':'')+p20val.toFixed(1)+'%</span>';
      var p40val=mr.ruleROI40[topRS.ruleKey];
      var p40col=p40val===null?'#475569':p40val>=0?'#4ade80':'#f87171';
      var p40str=p40val===null?'<span style="color:#475569;font-size:9px">—</span>':'<span style="font-family:var(--mono);font-weight:700;color:'+p40col+'">'+(p40val>=0?'+':'')+p40val.toFixed(1)+'%</span>';

      h+='<tr style="cursor:pointer" onclick="var el=document.getElementById(\''+detId+'\');el.style.display=el.style.display===\'none\'?\'table-row\':\'none\'">';
      h+=(function(){var d=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(d+(tm?' '+tm:''))+'</td>';})();
      var _hCol=rule.bet==='H'?'#f87171':'#e2e8f0';
      var _aCol=rule.bet==='A'?'#60a5fa':'#e2e8f0';
      h+='<td style="white-space:nowrap">'
        +'<div style="font-size:11px;font-weight:600">'
        +'<span style="color:'+_hCol+'">'+r.TEAMH+'</span>'
        +' <span style="color:#475569;font-weight:400">vs</span> '
        +'<span style="color:'+_aCol+'">'+r.TEAMA+'</span>'
        +'</div>'
        +'<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||r.LEAGUE||'')+'</div>'
        +'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_lineStr+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_oddsArrow(r.ASIAH,r.ASIAHLN)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_oddsArrow(r.ASIAA,r.ASIAALN)+'</td>';
      h+='<td class="num"><b style="font-size:14px;color:'+betCol+'">'+rule.bet+'</b></td>';
      h+='<td class="num"><span style="color:'+typeCol+';font-size:11px;font-weight:700">'+typeLabel+'</span></td>';
      h+='<td style="font-size:10px;color:#e2e8f0;max-width:200px">'+rule.label+multiMark+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#64748b">'+topRS.n+'</td>';
      h+='<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(topRS.roi>=0?'+':'')+topRS.roi.toFixed(1)+'%</td>';
      h+='<td class="num">'+p20str+'</td>';
      h+='<td class="num">'+p40str+'</td>';
      h+='</tr>';
      alertIdx++;

      // Expand row
      var lmDir=mrLineMoveDir(r), homDir=mrHOddsMove(r), aomDir=mrAOddsMove(r);
      var lmLabel=lmDir==='up'?'▲ Rose':lmDir==='down'?'▼ Dropped':'— Flat';
      var homLabel=homDir==='short'?'▼ Shortened':homDir==='drift'?'▲ Drifted':'— Flat';
      var aomLabel=aomDir==='short'?'▼ Shortened':aomDir==='drift'?'▲ Drifted':'— Flat';
      var lmCol=lmDir==='up'?'#60a5fa':lmDir==='down'?'#f87171':'#475569';
      var homCol=homDir==='short'?'#f87171':homDir==='drift'?'#60a5fa':'#475569';
      var aomCol=aomDir==='short'?'#f87171':aomDir==='drift'?'#60a5fa':'#475569';

      var tipFields=[{key:'JCTIPSUM',label:'JCSUM'},{key:'JCTIPSID',label:'JCSID'},{key:'TIPSIDMAC',label:'MAC'},{key:'TIPSONID',label:'ONID'}];
      var tipBadges=tipFields.map(function(tf){
        var tv=r[tf.key];var dv=tv||'—';
        var isH=tv&&String(tv).indexOf('H')>=0,isA=tv&&String(tv).indexOf('A')>=0;
        var c=isH?'#f87171':isA?'#60a5fa':'#475569';
        return '<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+c+'15;border:1px solid '+c+'33;color:'+c+'">'+tf.label+': '+dv+'</span>';
      }).join(' ');

      var ruleRows=alert.fired.map(function(rs,ri){
        var rc2=rs.rule.type==='COUNTER'?'#fbbf24':'#4ade80';
        var tl2=rs.rule.type==='COUNTER'?'⚡ COUNTER':'✓ FOLLOW';
        var bs=ri===0?'border:1px solid '+rc2+'44':'border:1px solid var(--border)';
        return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:10px;flex-wrap:wrap;padding:5px 8px;border-radius:5px;margin-bottom:3px;background:rgba(255,255,255,0.02);'+bs+'">'
          +'<span style="color:'+rc2+';font-weight:700;font-family:var(--mono);white-space:nowrap">'+tl2+'</span>'
          +'<span style="color:#e2e8f0;flex:1;min-width:120px">'+rs.rule.label+'</span>'
          +'<span style="color:#4ade80;font-family:var(--mono);font-weight:700;white-space:nowrap">'+(rs.roi>=0?'+':'')+rs.roi.toFixed(1)+'% ROI</span>'
          +'<span style="color:#e2e8f0;font-family:var(--mono);white-space:nowrap">n='+rs.n+' · tr='+(rs.train>=0?'+':'')+rs.train.toFixed(1)+'% te='+(rs.test>=0?'+':'')+rs.test.toFixed(1)+'%</span>'
          +'</div>';
      }).join('');

      var expertBar=(function(){
        if(typeof expertScore!=='function') return '';
        var e=expertScore(r); if(!e) return '';
        var et=e.h+e.d+e.a||1;
        return '<div style="margin-bottom:8px">'
          +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Expert Signal</div>'
          +'<div style="display:flex;gap:8px;font-size:10px;font-family:var(--mono);margin-bottom:4px">'
          +'<span style="color:#f87171">H '+e.h+'%</span><span style="color:#4ade80">D '+e.d+'%</span><span style="color:#60a5fa">A '+e.a+'%</span></div>'
          +'<div style="height:6px;border-radius:3px;overflow:hidden;display:flex">'
          +'<div style="width:'+(e.h/et*100).toFixed(1)+'%;background:#f87171"></div>'
          +'<div style="width:'+(e.d/et*100).toFixed(1)+'%;background:#4ade80"></div>'
          +'<div style="width:'+(e.a/et*100).toFixed(1)+'%;background:#60a5fa"></div>'
          +'</div></div>';
      })();

      var jcNarrative=(r.JCTIPS1||r.JCTIPS2||r.JCTIPS3)?(function(){
        return '<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)">'
          +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">JC Analysis</div>'
          +(r.JCTIPS1?'<div style="font-size:11px;color:#fbbf24;font-weight:600;margin-bottom:4px">'+r.JCTIPS1+'</div>':'')
          +(r.JCTIPS2?'<div style="font-size:10px;color:#e2e8f0;line-height:1.6;margin-bottom:4px">'+r.JCTIPS2+'</div>':'')
          +(r.JCTIPS3?'<div style="font-size:10px;color:#94a3b8;line-height:1.6">'+r.JCTIPS3+'</div>':'')
          +'</div>';
      })():'';

      var macNarrative=r.TIPSMAC?(function(){
        return '<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)">'
          +'<div style="font-size:9px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">🎰 Macau Tips</div>'
          +'<div style="font-size:10px;color:#e2e8f0;line-height:1.7">'+r.TIPSMAC+'</div>'
          +'</div>';
      })():'';

      h+='<tr id="'+detId+'" style="display:none"><td colspan="12" style="padding:0">'
        +'<div style="padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border)">'
        // Movement summary
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
        +'<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+lmCol+'15;border:1px solid '+lmCol+'33;color:'+lmCol+'">Line: '+lmLabel+'</span>'
        +'<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+homCol+'15;border:1px solid '+homCol+'33;color:'+homCol+'">H odds: '+homLabel+'</span>'
        +'<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+aomCol+'15;border:1px solid '+aomCol+'33;color:'+aomCol+'">A odds: '+aomLabel+'</span>'
        +'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+tipBadges+'</div>'

      var _pred1x2=(r.PREDICTH||r.PREDICTD||r.PREDICTA)?(function(){
        var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0,pt=ph+pd+pa||1;
        return '<div style="margin-bottom:8px">'
          +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prediction %</div>'
          +'<div style="display:flex;gap:8px;font-size:10px;font-family:var(--mono);margin-bottom:4px"><span style="color:#f87171">H '+ph+'%</span><span style="color:#4ade80">D '+pd+'%</span><span style="color:#60a5fa">A '+pa+'%</span></div>'
          +'<div style="height:6px;border-radius:3px;overflow:hidden;display:flex"><div style="width:'+(ph/pt*100).toFixed(1)+'%;background:#f87171"></div><div style="width:'+(pd/pt*100).toFixed(1)+'%;background:#4ade80"></div><div style="width:'+(pa/pt*100).toFixed(1)+'%;background:#60a5fa"></div></div>'
          +'</div>';
      })():'';
        +expertBar+_pred1x2+ruleRows+jcNarrative+macNarrative
        +'</div></td></tr>';
    });

    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px">⚡ = COUNTER · ✓ = WITH · Click row to expand · Short ▼ = odds shortened (market backing that side) · Drift ▲ = odds lengthened</div>';
  }
  h+='</div>';

  // ── SECTION 2: Rule summary table ──
  h+='<div style="margin-bottom:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">✅ All Verified Movement Rules (train + test both positive)</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">Sorted by overall ROI. <span style="color:#fbbf24">COUNTER = bet against the expert tip direction</span>. <span style="color:#4ade80">WITH = follow the expert</span>. Movement thresholds: ±3% for odds (short/drift), any change for line.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
  h+='<th>Rule</th><th class="num">Type</th><th class="num">Bet</th><th class="num">n</th>';
  h+='<th class="num">ROI (all)</th><th class="num">Train</th><th class="num">Test</th>';
  h+='</tr></thead><tbody>';

  mr.ruleSignals.slice().sort(function(a,b){ return b.roi-a.roi; }).forEach(function(rs){
    var rule=rs.rule;
    var typeCol=rule.type==='COUNTER'?'#fbbf24':'#4ade80';
    var betCol=rule.bet==='H'?'#f87171':'#60a5fa';
    var roiCol=rs.roi>=10?'#4ade80':rs.roi>=5?'#a3e635':rs.roi>=0?'#fbbf24':'#f87171';
    var trCol=rs.train>=0?'#4ade80':'#f87171';
    var teCol=rs.test>=0?'#4ade80':'#f87171';
    h+='<tr>';
    h+='<td><span style="color:#e2e8f0;font-size:11px;font-weight:600">'+rule.label+'</span>'
      +'<br><span style="color:#475569;font-size:9px">'+rule.desc+'</span></td>';
    h+='<td class="num"><span style="color:'+typeCol+';font-size:10px;font-weight:700">'+rule.type+'</span></td>';
    h+='<td class="num"><b style="color:'+betCol+'">'+rule.bet+'</b></td>';
    h+='<td class="num" style="font-family:var(--mono)">'+rs.n+'</td>';
    h+='<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(rs.roi>=0?'+':'')+rs.roi.toFixed(1)+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+trCol+'">'+(rs.train>=0?'+':'')+rs.train.toFixed(1)+'%</td>';
    h+='<td class="num" style="font-family:var(--mono);color:'+teCol+'">'+(rs.test>=0?'+':'')+rs.test.toFixed(1)+'%</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  h+='</div>';

  // ── SECTION 3: Past Bets ──
  var pbLen=mr.pastBets.length;
  var _pbRoiLabel='';
  if(pbLen){
    var _pbPnlPre=0;
    mr.pastBets.slice().reverse().forEach(function(pb){
      var bet=pb.fired[0].rule.bet;
      _pbPnlPre=Math.round((_pbPnlPre+(bet==='H'?pb.pnl.h:pb.pnl.a))*1000)/1000;
    });
    var _pbRoiPre=Math.round(_pbPnlPre/pbLen*1000)/10;
    var _pbColPre=_pbRoiPre>=0?'#4ade80':'#f87171';
    var _pb50=mr.pastBets.slice(0,50);
    var _pbPnl50=0;
    _pb50.slice().reverse().forEach(function(pb){
      var bet=pb.fired[0].rule.bet;
      _pbPnl50=Math.round((_pbPnl50+(bet==='H'?pb.pnl.h:pb.pnl.a))*1000)/1000;
    });
    var _pbRoi50=_pb50.length?Math.round(_pbPnl50/_pb50.length*1000)/10:null;
    var _pbCol50=_pbRoi50!==null?(_pbRoi50>=0?'#4ade80':'#f87171'):'#475569';
    _pbRoiLabel=' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+_pbColPre+';margin-left:8px">'+(_pbRoiPre>=0?'+':'')+_pbRoiPre+'%</span>'
      +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">L'+pbLen+'</span>'
      +(_pbRoi50!==null?' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+_pbCol50+';margin-left:6px">'+(_pbRoi50>=0?'+':'')+_pbRoi50+'%</span>'
        +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">L50</span>':'');
  }
  h+='<div style="margin-bottom:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;display:flex;align-items:center;gap:2px">📋 Past Bets — Last '+pbLen+' shown'+_pbRoiLabel+'</div>';
  if(mr.pastBets.length){
    h+='<span id="mr-pb-roi-lbl"></span>';
    var _B='<div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px">';
    _B+='<button class="mr-fb" data-key="all" onclick="mrFB(\'all\')" style="font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;margin:2px;font-weight:700">All Rules</button>';
    mr.ruleSignals.forEach(function(rs){
      var rl=rs.rule,tc=rl.type==='COUNTER'?'#fbbf24':'#4ade80';
      _B+='<button class="mr-fb" data-key="'+rs.ruleKey+'" onclick="mrFB(\''+rs.ruleKey+'\')" style="font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer;margin:2px">'
        +'<span style="color:'+tc+';margin-right:2px">'+(rl.type==='COUNTER'?'⚡':'✓')+'</span>'+rl.label+'</button>';
    });
    _B+='</div>';
    h+=_B;
  }
  h+='<div class="rpt-sub" style="margin-bottom:10px">Most recent results where at least one movement rule fired. Hit reflects the rule\'s recommended bet side.</div>';

  if(!pbLen){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic">No past bets found.</div>';
  } else {
    var _pbPnl=0,_pbN=0;
    var pbRunROI=mr.pastBets.slice().reverse().map(function(pb){
      var bet=pb.fired[0].rule.bet;
      _pbPnl=Math.round((_pbPnl+(bet==='H'?pb.pnl.h:pb.pnl.a))*1000)/1000;
      _pbN++;
      return Math.round(_pbPnl/_pbN*1000)/10;
    });
    pbRunROI.reverse();
    var pbTotal=_pbPnl;
    var pbROI=Math.round(pbTotal/pbLen*1000)/10;
    var pbColor=pbROI>=0?'#4ade80':'#f87171';

    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>';
    h+='<th>Date / Time</th><th>Match</th>';
    h+='<th class="num">Line</th><th class="num">AH</th><th class="num">AA</th><th class="num">Score</th>';
    h+='<th class="num">Bet</th><th>Rule</th><th class="num">N</th><th>Outcome</th><th class="num">Hit</th><th class="num">Run ROI</th>';
    h+='</tr></thead><tbody id="mr-pb-tbody">';

    mr.pastBets.forEach(function(pb,i){
      var r=pb.r, topRS=pb.fired[0], rule=topRS.rule, bet=rule.bet;
      var betCol=bet==='H'?'#f87171':'#60a5fa';
      var outLabel,predWon;
      if(pb.outcome==='HW'){outLabel='H WIN'; predWon=(bet==='H');}
      else if(pb.outcome==='HH'){outLabel='H ½WIN';predWon=(bet==='H');}
      else if(pb.outcome==='P'){outLabel='PUSH'; predWon=null;}
      else if(pb.outcome==='AH'){outLabel='A ½WIN';predWon=(bet==='A');}
      else{outLabel='A WIN'; predWon=(bet==='A');}
      var outBg=predWon===null?'rgba(148,163,184,0.15)':predWon?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)';
      var outCol=predWon===null?'#94a3b8':predWon?'#4ade80':'#f87171';
      var predFullWin=(bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW');
      var predHalfWin=(bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH');
      var predHalfLoss=(bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hitHtml=predFullWin?'<span style="font-size:13px">✅✅</span>'
        :predHalfWin?'<span style="font-size:13px">✅</span>'
        :pb.outcome==='P'?'<span style="font-size:13px">⬜</span>'
        :predHalfLoss?'<span style="font-size:13px">❌</span>'
        :'<span style="font-size:13px">❌❌</span>';
      var runRoi=pbRunROI[i];
      var runRoiCol=runRoi>=0?'#4ade80':'#f87171';
      var score=(r.RESULTH!=null&&r.RESULTA!=null)?r.RESULTH+'–'+r.RESULTA:'—';
      var ruleExtra=pb.fired.length>1?' <span style="color:#fbbf24;font-size:9px">+'+(pb.fired.length-1)+'</span>':'';

      h+='<tr>';
      h+=(function(){var dd=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>';})();
      h+='<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(parseFloat(r.ASIALINE)>=0?'+':'')+r.ASIALINE+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH!=null?r.ASIAH:'—')+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA!=null?r.ASIAA:'—')+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+score+'</td>';
      var _mrTypeIcon=rule.type==='COUNTER'?'<span style="color:#fbbf24;font-weight:700;font-family:var(--mono);margin-right:3px">⚡</span>':'<span style="color:#4ade80;font-weight:700;font-family:var(--mono);margin-right:3px">✓</span>';
      h+='<td class="num"><b style="color:'+betCol+'">'+bet+'</b></td>';
      h+='<td style="font-size:9px;color:#94a3b8;max-width:140px">'+_mrTypeIcon+rule.label+ruleExtra+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#64748b">'+topRS.n+'</td>';
      h+='<td><span style="background:'+outBg+';color:'+outCol+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+outLabel+'</span></td>';
      h+='<td class="num">'+hitHtml+'</td>';
      h+='<td class="num" style="font-family:var(--mono);font-size:10px;color:'+runRoiCol+'">'+(runRoi>=0?'+':'')+runRoi.toFixed(1)+'%</td>';
      h+='</tr>';
    });

    h+='<tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.03)">';
    h+='<td colspan="9" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">'+pbLen+' bets shown</td>';
    h+='<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">ROI</td>';
    h+='<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbColor+'">'+(pbROI>=0?'+':'')+pbROI+'%</td>';
    h+='<td></td>';
    h+='</tr>';
    h+='</tbody></table></div>';
  }
  h+='</div>';

  // ── SECTION 4: Methodology ──
  h+='<div style="margin-bottom:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:8px">📖 How This Report Works</div>';
  h+='<div style="font-size:10px;color:#94a3b8;line-height:1.7">';
  h+='<div><b style="color:#e2e8f0">Movement signals:</b> Each match has opening odds (ASIAHLN, ASIAALN, ASIALINELN) and latest odds (ASIAH, ASIAA, ASIALINE). '
    +'H odds <span style="color:#f87171">shortening ≥3%</span> = market backing Home. H odds <span style="color:#60a5fa">drifting ≥3%</span> = market fading Home. Same logic for A odds and line.</div>'
  +'<div style="margin-top:6px"><b style="color:#e2e8f0">Rule discovery:</b> All 4 expert tips (JCSUM, JCSID, MAC, ONID) × tip direction × line move × H odds move × A odds move combinations were tested. '
    +'Rules shown passed: ROI>3% overall, both train (oldest 75%) and test (newest 25%) positive, N≥25.</div>'
  +'<div style="margin-top:6px"><b style="color:#e2e8f0">Key insight:</b> When MAC tips Home but Away odds are shortening, market money is flowing contrary to MAC — the market is usually right in this conflict.</div>'
  +'</div>';
  h+='</div>';

  el.innerHTML=h;

  var _mrAPb=mr.pastBets.slice();
  window.mrFB=function(key){
    var f=key==='all'?_mrAPb:_mrAPb.filter(function(pb){return pb.fired.some(function(rs){return rs.ruleKey===key;});});
    var pnl=0,n=0;
    f.slice().reverse().forEach(function(pb){var bet=pb.fired[0].rule.bet,v=bet==='H'?pb.pnl.h:pb.pnl.a;if(v!==null){pnl=Math.round((pnl+v)*1000)/1000;n++;}});
    var r2=n?Math.round(pnl/n*1000)/10:null,c2=r2!==null?(r2>=0?'#4ade80':'#f87171'):null;
    var roiEl=document.getElementById('mr-pb-roi-lbl');
    if(roiEl)roiEl.innerHTML=r2!==null?' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+c2+'">'+(r2>=0?'+':'')+r2.toFixed(1)+'%</span><span style="font-size:9px;color:#475569;font-family:var(--mono)"> L'+n+'</span>':'';
    document.querySelectorAll('.mr-fb').forEach(function(b){var a=b.getAttribute('data-key')===key;b.style.cssText=a?'font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;cursor:pointer;margin:2px;font-weight:700':'font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;border:1px solid #334155;background:transparent;color:#64748b;cursor:pointer;margin:2px';});
    var tbody=document.getElementById('mr-pb-tbody');if(!tbody)return;
    var rrs=[],rp=0,rn=0;
    f.slice().reverse().forEach(function(pb){var bet=pb.fired[0].rule.bet,v=bet==='H'?pb.pnl.h:pb.pnl.a;if(v!==null){rp=Math.round((rp+v)*1000)/1000;rn++;}rrs.push(Math.round(rp/Math.max(rn,1)*1000)/10);});
    rrs.reverse();
    var rows='';
    f.forEach(function(pb,i){
      var rec=pb.r,topRule=pb.fired[0].rule,bet=topRule.bet,bCol=bet==='H'?'#f87171':'#60a5fa';
      var oL,pW;if(pb.outcome==='HW'){oL='H WIN';pW=bet==='H';}else if(pb.outcome==='HH'){oL='H ½WIN';pW=bet==='H';}else if(pb.outcome==='P'){oL='PUSH';pW=null;}else if(pb.outcome==='AH'){oL='A ½WIN';pW=bet==='A';}else{oL='A WIN';pW=bet==='A';}
      var oBg=pW===null?'rgba(148,163,184,0.15)':pW?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)',oCl=pW===null?'#94a3b8':pW?'#4ade80':'#f87171';
      var pfw=(bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW'),phw=(bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH'),phl=(bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hit=pfw?'✅✅':phw?'✅':pb.outcome==='P'?'⬜':phl?'❌':'❌❌',rr=rrs[i]||0,rrc=rr>=0?'#4ade80':'#f87171';
      var sc=(rec.RESULTH!=null&&rec.RESULTA!=null)?rec.RESULTH+'–'+rec.RESULTA:'—';
      var ex=pb.fired.length>1?' <span style="color:#fbbf24;font-size:9px">+'+(pb.fired.length-1)+'</span>':'';
      var ti=topRule.type==='COUNTER'?'<span style="color:#fbbf24;font-weight:700;font-family:var(--mono);margin-right:3px">⚡</span>':'<span style="color:#4ade80;font-weight:700;font-family:var(--mono);margin-right:3px">✓</span>';
      var dd=(rec.DATE||'').slice(5),t=rec.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';
      rows+='<tr>'
        +'<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>'
        +'<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;font-size:10px;white-space:nowrap">'+rec.TEAMH+' <span style="color:#475569">vs</span> '+rec.TEAMA+'</span></td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(rec.ASIALINE>=0?'+':'')+rec.ASIALINE+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(rec.ASIAH||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(rec.ASIAA||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+sc+'</td>'
        +'<td class="num"><b style="color:'+bCol+'">'+bet+'</b></td>'
        +'<td style="font-size:9px;color:#94a3b8;max-width:140px">'+ti+topRule.label+ex+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+topRule.n+'</td>'
        +'<td><span style="background:'+oBg+';color:'+oCl+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+oL+'</span></td>'
        +'<td class="num" style="font-size:13px">'+hit+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:10px;color:'+rrc+'">'+(rr>=0?'+':'')+rr.toFixed(1)+'%</td>'
        +'</tr>';
    });
    tbody.innerHTML=rows||'<tr><td colspan="12" style="color:#475569;font-size:11px;padding:12px;text-align:center;font-style:italic">No bets for this rule.</td></tr>';
  };

}
