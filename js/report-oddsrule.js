// ── report-oddsrule.js — Tab 13: Odds Advantage Rules ──
// Rules combining expert tip direction with HKJC odds advantage/disadvantage
// vs Macau and SBO. All ROI based on HKJC bets only.

var OR_TIP_MAP = {'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0};

var OR_RULES = [
  // JCSUM rules
  { label:'JCSUM→H + Same line + HKJC A well above Macau',
    desc:'JCSUM tips Home but HKJC A odds are >3% above Macau — market pricing Away differently. Bet A.',
    exp:'JCTIPSUM', tip:1, pool:'same',
    oddsKey:'A_vs_mac', oddsDir:1, oddsThresh:0.03,
    bet:'A', roi:11.9, train:13.5, test:6.4, n:196, type:'COUNTER' },
  { label:'JCSUM→A + Same line + HKJC H below Macau',
    desc:'JCSUM tips Away on same line but HKJC H odds 1-3% below Macau — market backing H more. Bet A follows JCSUM.',
    exp:'JCTIPSUM', tip:-1, pool:'same',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:4.3, train:2.1, test:12.5, n:366, type:'WITH' },
  { label:'JCSUM→A + Same line + HKJC H well above SBO',
    desc:'JCSUM tips Away but HKJC H odds >3% above SBO — HKJC gives H better price, bet H.',
    exp:'JCTIPSUM', tip:-1, pool:'same',
    oddsKey:'H_vs_sbo', oddsDir:1, oddsThresh:0.03,
    bet:'H', roi:18.7, train:17.4, test:21.6, n:30, type:'COUNTER' },
  { label:'JCSUM→A + Diff line + HKJC H above Macau',
    desc:'JCSUM tips Away on different line with HKJC H odds 1-3% above Macau. Bet A.',
    exp:'JCTIPSUM', tip:-1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:13.7, train:11.9, test:18.7, n:60, type:'WITH' },
  // JCSID rules
  { label:'JCSID→H + Diff line + HKJC H above Macau',
    desc:'JCSID tips Home on different line but HKJC H odds 1-3% above Macau. Bet A against JCSID.',
    exp:'JCTIPSID', tip:1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:13.0, train:11.9, test:16.0, n:44, type:'COUNTER' },
  { label:'JCSID→H + Diff line + HKJC H below Macau',
    desc:'JCSID tips Home on different line but HKJC H odds 1-3% below Macau — market fading H. Bet A.',
    exp:'JCTIPSID', tip:1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:13.9, train:7.4, test:29.1, n:60, type:'COUNTER' },
  { label:'JCSID→A + Same line + HKJC A well below Macau',
    desc:'JCSID tips Away but HKJC A odds >3% below Macau — market pricing A higher elsewhere. Bet H.',
    exp:'JCTIPSID', tip:-1, pool:'same',
    oddsKey:'A_vs_mac', oddsDir:-1, oddsThresh:0.03,
    bet:'H', roi:8.7, train:4.2, test:24.3, n:192, type:'COUNTER' },
  { label:'JCSID→A + Diff line + HKJC H below Macau',
    desc:'JCSID tips Away on different line with HKJC H 1-3% below Macau. Bet A.',
    exp:'JCTIPSID', tip:-1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:15.1, train:11.1, test:29.8, n:33, type:'WITH' },
  { label:'JCSID→A + Diff line + HKJC H below SBO',
    desc:'JCSID tips Away on different line with HKJC H 1-3% below SBO. Bet A.',
    exp:'JCTIPSID', tip:-1, pool:'diff',
    oddsKey:'H_vs_sbo', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:5.2, train:5.2, test:5.3, n:90, type:'WITH' },
  // MAC rules
  { label:'MAC→H + Same line + HKJC H above Macau',
    desc:'MAC tips Home but HKJC H odds 1-3% above MAC — HKJC offers H better, market shows doubt. Bet A.',
    exp:'TIPSIDMAC', tip:1, pool:'same',
    oddsKey:'H_vs_mac', oddsDir:1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:8.7, train:7.1, test:13.4, n:216, type:'COUNTER' },
  { label:'MAC→H + Same line + HKJC H above SBO',
    desc:'MAC tips Home but HKJC H odds 1-3% above SBO. Market gives H shorter price on MAC/SBO. Bet A.',
    exp:'TIPSIDMAC', tip:1, pool:'same',
    oddsKey:'H_vs_sbo', oddsDir:1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:13.5, train:13.4, test:13.7, n:74, type:'COUNTER' },
  { label:'MAC→H + Diff line + HKJC H below Macau',
    desc:'MAC tips Home on different line with HKJC H 1-3% below MAC — MAC itself prices H higher. Bet A.',
    exp:'TIPSIDMAC', tip:1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:7.7, train:1.0, test:25.5, n:80, type:'COUNTER' },
  { label:'MAC→H + Diff line + HKJC H above SBO',
    desc:'MAC tips Home on different line with HKJC H 1-3% above SBO. Bet A.',
    exp:'TIPSIDMAC', tip:1, pool:'diff',
    oddsKey:'H_vs_sbo', oddsDir:1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:6.3, train:5.0, test:9.1, n:54, type:'COUNTER' },
  { label:'MAC→A + Diff line + HKJC A well above SBO',
    desc:'MAC tips Away on different line and HKJC A odds >3% above SBO — HKJC prices A more generously. Bet H.',
    exp:'TIPSIDMAC', tip:-1, pool:'diff',
    oddsKey:'A_vs_sbo', oddsDir:1, oddsThresh:0.03,
    bet:'H', roi:6.0, train:7.5, test:1.2, n:601, type:'COUNTER' },
  // ONID rules
  { label:'ONID→H + Same line + HKJC H well above Macau',
    desc:'ONID tips Home and HKJC H odds >3% above Macau — HKJC agrees with ONID and offers better H price. Bet H.',
    exp:'TIPSONID', tip:1, pool:'same',
    oddsKey:'H_vs_mac', oddsDir:1, oddsThresh:0.03,
    bet:'H', roi:5.1, train:3.2, test:12.2, n:89, type:'WITH' },
  { label:'ONID→H + Same line + HKJC H below Macau',
    desc:'ONID tips Home but HKJC H odds 1-3% below Macau — market fading H despite ONID tip. Bet A.',
    exp:'TIPSONID', tip:1, pool:'same',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:4.4, train:4.9, test:3.3, n:141, type:'COUNTER' },
  { label:'ONID→A + Same line + HKJC H well above Macau',
    desc:'ONID tips Away but HKJC H odds >3% above Macau — HKJC pricing H generously despite Away tip. Bet A.',
    exp:'TIPSONID', tip:-1, pool:'same',
    oddsKey:'H_vs_mac', oddsDir:1, oddsThresh:0.03,
    bet:'A', roi:3.4, train:5.3, test:0.1, n:99, type:'WITH' },
  { label:'ONID→A + Diff line + HKJC H below Macau',
    desc:'ONID tips Away on different line with HKJC H 1-3% below Macau. Bet H (HKJC underpriced H).',
    exp:'TIPSONID', tip:-1, pool:'diff',
    oddsKey:'H_vs_mac', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'H', roi:5.9, train:5.5, test:6.7, n:27, type:'COUNTER' },
  { label:'ONID→A + Diff line + HKJC H below SBO',
    desc:'ONID tips Away on different line and HKJC H 1-3% below SBO — market strongly fades H. Bet A.',
    exp:'TIPSONID', tip:-1, pool:'diff',
    oddsKey:'H_vs_sbo', oddsDir:-1, oddsThresh:0.01, oddsMax:0.03,
    bet:'A', roi:22.6, train:21.2, test:28.3, n:51, type:'WITH' },
];

function computeOddsRule(results, allRecords){
  var TM = OR_TIP_MAP;

  var all3 = results.filter(function(r){
    return r.STATUS==='Result' &&
      typeof r.RESULTH==='number' && r.RESULTA!=null &&
      r.ASIALINE!=null && r.ASIAH && r.ASIAA &&
      r.ASIALINEMA!=null && r.ASIAHMAC && r.ASIAAMAC &&
      r.ASIALINESB!=null && r.ASIAHSBO && r.ASIAASBO;
  });
  all3.sort(function(a,b){return(a.DATE||'')>(b.DATE||'')?1:-1;});

  var same = all3.filter(function(r){return r.ASIALINE===r.ASIALINEMA&&r.ASIALINE===r.ASIALINESB;});
  var diff = all3.filter(function(r){return!(r.ASIALINE===r.ASIALINEMA&&r.ASIALINE===r.ASIALINESB);});

  var n = all3.length, split = Math.floor(n * 0.75);

  function oddsRatio(r, oddsKey){
    if(oddsKey==='H_vs_mac') return (r.ASIAH-r.ASIAHMAC)/r.ASIAHMAC;
    if(oddsKey==='H_vs_sbo') return (r.ASIAH-r.ASIAHSBO)/r.ASIAHSBO;
    if(oddsKey==='A_vs_mac') return (r.ASIAA-r.ASIAAMAC)/r.ASIAAMAC;
    if(oddsKey==='A_vs_sbo') return (r.ASIAA-r.ASIAASBO)/r.ASIAASBO;
    return 0;
  }

  function matchRule(r, rule){
    var pool = rule.pool==='same' ? same : rule.pool==='diff' ? diff : all3;
    if(pool.indexOf(r)<0) return false; // rough pool check - handled at scan level
    var tv = TM[String(r[rule.exp]||'')];
    if(tv !== rule.tip) return false;
    var ratio = oddsRatio(r, rule.oddsKey);
    if(rule.oddsDir > 0){
      if(ratio < rule.oddsThresh) return false;
      if(rule.oddsMax && ratio > rule.oddsMax) return false;
    } else {
      if(-ratio < rule.oddsThresh) return false;
      if(rule.oddsMax && -ratio > rule.oddsMax) return false;
    }
    return true;
  }

  function adjM(r){ return Math.round((r.RESULTH-r.RESULTA+r.ASIALINE)*4)/4; }
  function pnlH(r){ var m=adjM(r),oh=r.ASIAH; if(!oh||oh<=0)return null; if(m>=0.5)return oh-1; if(m===0.25)return(oh-1)*0.5; if(m===0)return 0; if(m===-0.25)return-0.5; return-1; }
  function pnlA(r){ var m=adjM(r),oa=r.ASIAA; if(!oa||oa<=0)return null; if(m<=-0.5)return oa-1; if(m===-0.25)return(oa-1)*0.5; if(m===0)return 0; if(m===0.25)return-0.5; return-1; }
  function roiOf_(arr){ var v=arr.filter(function(x){return x!==null;}); return v.length?Math.round(v.reduce(function(s,x){return s+x;},0)/v.length*1000)/10:null; }

  // Build pool lookup for each rule
  var ruleSignals = OR_RULES.map(function(rule){
    var pool = rule.pool==='same' ? same : rule.pool==='diff' ? diff : all3;
    var sub = pool.filter(function(r){ return matchRule(r, rule); });
    // For train/test use index within all3
    var all3Map = {}; all3.forEach(function(r,i){ all3Map[i]=r; });
    var idxs = sub.map(function(r){ return all3.indexOf(r); }).filter(function(i){ return i>=0; });
    idxs.sort(function(a,b){return a-b;});
    var tr = idxs.filter(function(i){return i<split;}).map(function(i){return all3[i];});
    var te = idxs.filter(function(i){return i>=split;}).map(function(i){return all3[i];});
    var pnlFn = rule.bet==='H' ? pnlH : pnlA;
    var ruleKey = rule.exp+'|'+rule.tip+'|'+rule.pool+'|'+rule.oddsKey+'|'+rule.oddsDir+'|'+(rule.oddsThresh||0)+'|'+(rule.oddsMax||0)+'|'+rule.bet;
    return { rule:rule, ruleKey:ruleKey, n:sub.length,
      roi:roiOf_(sub.map(pnlFn)), train:roiOf_(tr.map(pnlFn)), test:roiOf_(te.map(pnlFn)) };
  });

  // Scan upcoming
  var upcoming = (allRecords||[]).filter(function(r){
    return r.STATUS==='PREEVE' &&
      r.ASIALINE!=null && r.ASIAH && r.ASIAA &&
      r.ASIALINEMA!=null && r.ASIAHMAC && r.ASIAAMAC &&
      r.ASIALINESB!=null && r.ASIAHSBO && r.ASIAASBO;
  });
  upcoming.sort(function(a,b){return(a.DATE||'').localeCompare(b.DATE||'')||(a.TIME||0)-(b.TIME||0);});

  var upcomingAlerts = [];
  upcoming.forEach(function(r){
    var fired = [];
    ruleSignals.forEach(function(rs){
      // For upcoming, pool check doesn't apply (PREEVE not in same/diff) — just check tip+odds
      var tv = TM[String(r[rs.rule.exp]||'')];
      if(tv !== rs.rule.tip) return;
      var ratio = oddsRatio(r, rs.rule.oddsKey);
      var ok = rs.rule.oddsDir>0
        ? ratio >= rs.rule.oddsThresh && (!rs.rule.oddsMax || ratio <= rs.rule.oddsMax)
        : -ratio >= rs.rule.oddsThresh && (!rs.rule.oddsMax || -ratio <= rs.rule.oddsMax);
      if(ok) fired.push(rs);
    });
    if(fired.length) upcomingAlerts.push({r:r, fired:fired});
  });

  // Past bets (newest first, up to 100)
  var pastBets = [];
  all3.slice().sort(function(a,b){
    var dc=(b.DATE||'').localeCompare(a.DATE||''); return dc!==0?dc:(b.TIME||0)-(a.TIME||0);
  }).forEach(function(r){
    if(pastBets.length>=100) return;
    var fired = [];
    ruleSignals.forEach(function(rs){
      if(matchRule(r, rs.rule)) fired.push(rs);
    });
    if(!fired.length) return;
    var m=adjM(r);
    var outcome=m>0.25?'HW':m===0.25?'HH':m===0?'P':m===-0.25?'AH':'AW';
    var pnl={h:pnlH(r),a:pnlA(r)};
    pastBets.push({r:r,fired:fired,pnl:pnl,outcome:outcome});
  });

  // Per-rule last 20/40
  var dataRev = all3.slice().sort(function(a,b){
    var dc=(b.DATE||'').localeCompare(a.DATE||''); return dc!==0?dc:(b.TIME||0)-(a.TIME||0);
  });
  var ruleROI20={}, ruleROI40={};
  ruleSignals.forEach(function(rs){
    var p20=0,c20=0,p40=0,c40=0;
    for(var i=0;i<dataRev.length&&c40<40;i++){
      var r=dataRev[i];
      if(!matchRule(r,rs.rule)) continue;
      var pnlFn=rs.rule.bet==='H'?pnlH:pnlA;
      var v=pnlFn(r); if(v===null) continue;
      if(c20<20){p20+=v;c20++;}
      p40+=v;c40++;
    }
    ruleROI20[rs.ruleKey]=c20>=5?Math.round(p20/c20*1000)/10:null;
    ruleROI40[rs.ruleKey]=c40>=10?Math.round(p40/c40*1000)/10:null;
  });

  // ── ROI history chart series — sorted chronologically, skip first 300 ──
  var SKIP=300;
  var chronoBets=[];
  // Collect all matched bets in chronological order
  all3.forEach(function(r){
    var fired=[];
    ruleSignals.forEach(function(rs){ if(matchRule(r,rs.rule)) fired.push(rs); });
    if(!fired.length) return;
    var pnlFn=fired[0].rule.bet==='H'?pnlH:pnlA;
    var v=pnlFn(r); if(v===null) return;
    chronoBets.push(v);
  });
  // Build running ROI and moving averages, skip first SKIP
  var roiPts=[], ma50Pts=[], ma100Pts=[];
  var cumPnl=0;
  chronoBets.forEach(function(v,i){
    cumPnl=Math.round((cumPnl+v)*1000)/1000;
    var n=i+1;
    var runRoi=Math.round(cumPnl/n*10000)/100;
    // MA50: avg ROI of last 50 bets
    var ma50=null;
    if(n>=50){ var sl50=chronoBets.slice(n-50,n); var s50=sl50.reduce(function(a,b){return a+b;},0); ma50=Math.round(s50/50*10000)/100; }
    var ma100=null;
    if(n>=100){ var sl100=chronoBets.slice(n-100,n); var s100=sl100.reduce(function(a,b){return a+b;},0); ma100=Math.round(s100/100*10000)/100; }
    if(i>=SKIP){
      roiPts.push(runRoi);
      ma50Pts.push(ma50);
      ma100Pts.push(ma100);
    }
  });

  return{ruleSignals:ruleSignals,upcomingAlerts:upcomingAlerts,pastBets:pastBets,
    ruleROI20:ruleROI20,ruleROI40:ruleROI40,nRecords:n,
    chartData:{roiPts:roiPts,ma50Pts:ma50Pts,ma100Pts:ma100Pts,totalBets:chronoBets.length,skip:SKIP}};
}

function renderOddsRule(RD){
  var el=document.getElementById('tab13'); if(!el) return;
  if(!RD.oddsrule){
    if(typeof computeOddsRule==='function'&&RD.results){
      RD.oddsrule=computeOddsRule(RD.results, RD.records);
    } else {
      el.innerHTML='<div style="padding:24px;color:#f87171">Error: computeOddsRule not available.</div>';
      return;
    }
  }
  var or=RD.oddsrule;
  var h='';

  h+='<div class="rpt-title">💹 Odds Advantage Rules</div>';
  h+='<div class="rpt-sub">Rules combining expert tip direction with HKJC odds advantage vs Macau and SBO. '
    +'When HKJC odds diverge from other books, it reveals market positioning — combined with expert tips this creates edge. '
    +'All ROI is HKJC bets only. Verified on train (75%) + test (25%) temporal splits.</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:14px">Same-match pool: <b style="color:#e2e8f0">'+or.nRecords+'</b> records</div>';

  // ── ROI History Chart ──
  if(or.chartData && or.chartData.roiPts.length){
    var cd=or.chartData;
    h+='<div class="chart-box" style="margin-bottom:16px">'
      +'<div class="chart-box-label">Running ROI% History (first '+cd.skip+' bets hidden · '+cd.totalBets+' total matched bets)</div>'
      +'<div class="chart-legend" id="lgdOrRoi"></div>'
      +'<canvas id="cOrRoi"></canvas>'
      +'</div>';
  }

  // ── Upcoming alerts ──
  h+='<div style="margin-bottom:20px">';
  h+='<div class="rpt-title" style="margin-bottom:4px">🎯 Upcoming Matches — Rules Firing</div>';
  if(!or.upcomingAlerts.length){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently match any odds-advantage rule.</div>';
  } else {
    var alertIdx=0;
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">AH</th><th class="num">AA</th>'
      +'<th class="num">Bet</th><th class="num">Type</th><th>Top Rule</th>'
      +'<th class="num">N</th><th class="num">ROI</th><th class="num">P20</th><th class="num">P40</th>'
      +'</tr></thead><tbody>';
    or.upcomingAlerts.forEach(function(alert){
      var r=alert.r, topRS=alert.fired[0], rule=topRS.rule;
      var betCol=rule.bet==='H'?'#f87171':'#60a5fa';
      var typeCol=rule.type==='COUNTER'?'#fbbf24':'#4ade80';
      var roiCol=topRS.roi>=7?'#4ade80':topRS.roi>=4?'#a3e635':'#94a3b8';
      var multiMark=alert.fired.length>1?' <span style="color:#a78bfa;font-size:8px">+'+(alert.fired.length-1)+'</span>':'';
      var detId='orup_'+alertIdx;
      var hCol=rule.bet==='H'?'#f87171':'#e2e8f0';
      var aCol=rule.bet==='A'?'#60a5fa':'#e2e8f0';
      var p20v=or.ruleROI20[topRS.ruleKey],p40v=or.ruleROI40[topRS.ruleKey];
      var p20s=p20v===null?'<span style="color:#475569;font-size:9px">—</span>':'<span style="font-family:var(--mono);font-weight:700;color:'+(p20v>=0?'#4ade80':'#f87171')+'">'+(p20v>=0?'+':'')+p20v.toFixed(1)+'%</span>';
      var p40s=p40v===null?'<span style="color:#475569;font-size:9px">—</span>':'<span style="font-family:var(--mono);font-weight:700;color:'+(p40v>=0?'#4ade80':'#f87171')+'">'+(p40v>=0?'+':'')+p40v.toFixed(1)+'%</span>';
      h+='<tr style="cursor:pointer" onclick="var el=document.getElementById(\''+detId+'\');el.style.display=el.style.display===\'none\'?\'table-row\':\'none\'">';
      h+=(function(){var dd=(r.DATE||'').slice(5),t=r.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>';})();
      h+='<td style="white-space:nowrap"><div style="font-size:11px;font-weight:600"><span style="color:'+hCol+'">'+r.TEAMH+'</span> <span style="color:#475569;font-weight:400">vs</span> <span style="color:'+aCol+'">'+r.TEAMA+'</span></div>'
        +'<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||r.LEAGUE||'')+'</div></td>';
      // Line arrow
      var _lineNow=parseFloat(r.ASIALINE), _lineLN=r.ASIALINELN;
      var _lineStr=(_lineNow>=0?'+':'')+_lineNow.toFixed(2);
      if(_lineLN!=null&&_lineLN!==_lineNow){
        var _ld=Math.round((_lineNow-_lineLN)*100)/100;
        if(_ld!==0){var _la=Math.abs(_ld),_ln=_la>=1.0?3:_la>=0.5?2:1,_larr=_ld<0?'▼':'▲',_lcol=_ld<0?'#f87171':'#60a5fa';
          _lineStr+=('<span style="color:'+_lcol+';font-size:10px;margin-left:2px">'+_larr.repeat(_ln)+'</span>');}
      }
      function _orOddsArrow(lat,opn){
        if(!opn||opn===0||lat===opn)return lat!=null?String(lat):'—';
        var s=String(lat),n,arr,col;
        if(lat<opn){n=lat<opn*0.9?3:lat<opn*0.95?2:1;arr='▼';col='#f87171';}
        else{n=lat>opn*1.1?3:lat>opn*1.05?2:1;arr='▲';col='#60a5fa';}
        return s+'<span style="color:'+col+';font-size:10px;margin-left:2px">'+arr.repeat(n)+'</span>';
      }
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_lineStr+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_orOddsArrow(r.ASIAH, r.ASIAHLN!=null&&r.ASIAHLN>0?r.ASIAHLN:null)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+_orOddsArrow(r.ASIAA, r.ASIAALN!=null&&r.ASIAALN>0?r.ASIAALN:null)+'</td>';
      h+='<td class="num"><b style="font-size:14px;color:'+betCol+'">'+rule.bet+'</b></td>';
      h+='<td class="num"><span style="color:'+typeCol+';font-size:11px;font-weight:700">'+(rule.type==='COUNTER'?'⚡':'✓')+'</span></td>';
      h+='<td style="font-size:10px;color:#e2e8f0;max-width:200px">'+rule.label+multiMark+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#64748b">'+topRS.n+'</td>';
      h+='<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(topRS.roi>=0?'+':'')+topRS.roi.toFixed(1)+'%</td>';
      h+='<td class="num">'+p20s+'</td><td class="num">'+p40s+'</td>';
      h+='</tr>';

      // Expand detail
      var tipFields=[{key:'JCTIPSUM',label:'JCSUM'},{key:'JCTIPSID',label:'JCSID'},{key:'TIPSIDMAC',label:'MAC'},{key:'TIPSONID',label:'ONID'}];
      var tipBadges=tipFields.map(function(tf){
        var tv=r[tf.key];var c=tv&&tv.indexOf('H')>=0?'#f87171':tv&&tv.indexOf('A')>=0?'#60a5fa':'#475569';
        return '<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+c+'15;border:1px solid '+c+'33;color:'+c+'">'+(tf.label)+': '+(tv||'—')+'</span>';
      }).join(' ');
      var oddsRows='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">'
        +[['HKJC','#f87171',r.ASIALINE,r.ASIAH,r.ASIAA],['Macau','#a78bfa',r.ASIALINEMA,r.ASIAHMAC,r.ASIAAMAC],['SBO','#fb923c',r.ASIALINESB,r.ASIAHSBO,r.ASIAASBO]].map(function(b){
          var dh=b[2]!=null&&b[3]?Math.round((r.ASIAH-b[3])/b[3]*1000)/10:null;
          return '<div style="border:1px solid var(--border);border-radius:6px;padding:6px 8px;border-top:2px solid '+b[1]+'">'
            +'<div style="font-size:9px;font-weight:700;color:'+b[1]+';margin-bottom:4px">'+b[0]+'</div>'
            +'<div style="font-size:9px;font-family:var(--mono);color:#64748b">Line: <b style="color:#e2e8f0">'+(b[2]!=null?(b[2]>=0?'+':'')+b[2]:'—')+'</b></div>'
            +'<div style="font-size:9px;font-family:var(--mono);color:#64748b">H: <b style="color:#f87171">'+(b[3]||'—')+'</b>'+(dh!==null&&b[0]!=='HKJC'?' <span style="font-size:8px;color:'+(dh>0?'#4ade80':'#f87171')+'">'+(dh>0?'+':'')+dh+'%</span>':'')+'</div>'
            +'<div style="font-size:9px;font-family:var(--mono);color:#64748b">A: <b style="color:#60a5fa">'+(b[4]||'—')+'</b></div>'
            +'</div>';
        }).join('')+'</div>';
      var ruleRows=alert.fired.map(function(rs,ri){
        var rc=rs.rule.type==='COUNTER'?'#fbbf24':'#4ade80';
        var bs=ri===0?'border:1px solid '+rc+'44':'border:1px solid var(--border)';
        return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:10px;flex-wrap:wrap;padding:5px 8px;border-radius:5px;margin-bottom:3px;background:rgba(255,255,255,0.02);'+bs+'">'
          +'<span style="color:'+rc+';font-weight:700;font-family:var(--mono);white-space:nowrap">'+(rs.rule.type==='COUNTER'?'⚡ COUNTER':'✓ WITH')+'</span>'
          +'<span style="color:#e2e8f0;flex:1;min-width:120px">'+rs.rule.label+'</span>'
          +'<span style="color:#4ade80;font-family:var(--mono);font-weight:700;white-space:nowrap">'+(rs.roi>=0?'+':'')+rs.roi.toFixed(1)+'% ROI</span>'
          +'<span style="color:#94a3b8;font-family:var(--mono);font-size:9px;white-space:nowrap">n='+rs.n+' tr='+(rs.train>=0?'+':'')+rs.train.toFixed(1)+'% te='+(rs.test>=0?'+':'')+rs.test.toFixed(1)+'%</span>'
          +'</div>';
      }).join('');
      var _orExpertBar=(function(){
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
      var _orPred=(r.PREDICTH||r.PREDICTD||r.PREDICTA)?(function(){
        var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0,pt=ph+pd+pa||1;
        return '<div style="margin-bottom:8px">'
          +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prediction %</div>'
          +'<div style="display:flex;gap:8px;font-size:10px;font-family:var(--mono);margin-bottom:4px"><span style="color:#f87171">H '+ph+'%</span><span style="color:#4ade80">D '+pd+'%</span><span style="color:#60a5fa">A '+pa+'%</span></div>'
          +'<div style="height:6px;border-radius:3px;overflow:hidden;display:flex"><div style="width:'+(ph/pt*100).toFixed(1)+'%;background:#f87171"></div><div style="width:'+(pd/pt*100).toFixed(1)+'%;background:#4ade80"></div><div style="width:'+(pa/pt*100).toFixed(1)+'%;background:#60a5fa"></div></div>'
          +'</div>';
      })():'';
      var _orJcNarrative=(r.JCTIPS1||r.JCTIPS2||r.JCTIPS3)?(function(){
        return '<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)">'
          +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">JC Analysis</div>'
          +(r.JCTIPS1?'<div style="font-size:11px;color:#fbbf24;font-weight:600;margin-bottom:4px">'+r.JCTIPS1+'</div>':'')
          +(r.JCTIPS2?'<div style="font-size:10px;color:#e2e8f0;line-height:1.6;margin-bottom:4px">'+r.JCTIPS2+'</div>':'')
          +(r.JCTIPS3?'<div style="font-size:10px;color:#94a3b8;line-height:1.6">'+r.JCTIPS3+'</div>':'')
          +'</div>';
      })():'';
      var _orMacNarrative=r.TIPSMAC?(function(){
        return '<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)">'
          +'<div style="font-size:9px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">🎰 Macau Tips</div>'
          +'<div style="font-size:10px;color:#e2e8f0;line-height:1.7">'+r.TIPSMAC+'</div>'
          +'</div>';
      })():'';
      h+='<tr id="'+detId+'" style="display:none"><td colspan="12" style="padding:0">'
        +'<div style="padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border)">'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+tipBadges+'</div>'
        +oddsRows+_orExpertBar+_orPred+ruleRows+_orJcNarrative+_orMacNarrative
        +'</div></td></tr>';
      alertIdx++;
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px">⚡=COUNTER · ✓=WITH · Click row to expand · Odds diff% = (HKJC − Other) / Other × 100%</div>';
  }
  h+='</div>';

  // ── Rule summary table ──
  h+='<div style="margin-bottom:20px;border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">✅ All 19 Verified Odds Advantage Rules</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
    +'<th>Rule</th><th class="num">Type</th><th class="num">Bet</th><th class="num">Pool</th>'
    +'<th class="num">n</th><th class="num">ROI</th><th class="num">Train</th><th class="num">Test</th>'
    +'</tr></thead><tbody>';
  or.ruleSignals.slice().sort(function(a,b){return b.roi-a.roi;}).forEach(function(rs){
    var rule=rs.rule;
    var tc=rule.type==='COUNTER'?'#fbbf24':'#4ade80';
    var bc=rule.bet==='H'?'#f87171':'#60a5fa';
    var rc=rs.roi>=10?'#4ade80':rs.roi>=5?'#a3e635':rs.roi>=0?'#fbbf24':'#f87171';
    var trc=rs.train>=0?'#4ade80':'#f87171', tec=rs.test>=0?'#4ade80':'#f87171';
    var poolLabel=rule.pool==='same'?'Same line':rule.pool==='diff'?'Diff line':'All';
    h+='<tr>'
      +'<td><span style="font-size:11px;font-weight:600;color:#e2e8f0">'+rule.label+'</span>'
      +'<br><span style="font-size:9px;color:#475569">'+rule.desc+'</span></td>'
      +'<td class="num"><span style="color:'+tc+';font-size:10px;font-weight:700">'+rule.type+'</span></td>'
      +'<td class="num"><b style="color:'+bc+'">'+rule.bet+'</b></td>'
      +'<td class="num" style="font-size:9px;color:#64748b">'+poolLabel+'</td>'
      +'<td class="num" style="font-family:var(--mono)">'+rs.n+'</td>'
      +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+rc+'">'+(rs.roi>=0?'+':'')+rs.roi.toFixed(1)+'%</td>'
      +'<td class="num" style="font-family:var(--mono);color:'+trc+'">'+(rs.train>=0?'+':'')+rs.train.toFixed(1)+'%</td>'
      +'<td class="num" style="font-family:var(--mono);color:'+tec+'">'+(rs.test>=0?'+':'')+rs.test.toFixed(1)+'%</td>'
      +'</tr>';
  });
  h+='</tbody></table></div></div>';

  // ── Past Bets ──
  var pbLen=or.pastBets.length;
  var _pbRoiLabel='';
  if(pbLen){
    var _pnl=0;
    or.pastBets.slice().reverse().forEach(function(pb){
      var bet=pb.fired[0].rule.bet, v=bet==='H'?pb.pnl.h:pb.pnl.a;
      if(v!==null) _pnl=Math.round((_pnl+v)*1000)/1000;
    });
    var _roi=Math.round(_pnl/pbLen*1000)/10;
    var _col=_roi>=0?'#4ade80':'#f87171';
    var _pb50=or.pastBets.slice(0,50), _pnl50=0;
    _pb50.slice().reverse().forEach(function(pb){
      var bet=pb.fired[0].rule.bet, v=bet==='H'?pb.pnl.h:pb.pnl.a;
      if(v!==null) _pnl50=Math.round((_pnl50+v)*1000)/1000;
    });
    var _roi50=_pb50.length?Math.round(_pnl50/_pb50.length*1000)/10:null;
    var _col50=_roi50!==null?(_roi50>=0?'#4ade80':'#f87171'):'#475569';
    _pbRoiLabel=' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+_col+';margin-left:8px">'+(_roi>=0?'+':'')+_roi+'%</span>'
      +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">L'+pbLen+'</span>'
      +(_roi50!==null?' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+_col50+';margin-left:6px">'+(_roi50>=0?'+':'')+_roi50+'%</span>'
        +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">L50</span>':'');
  }
  h+='<div style="border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;display:flex;align-items:center;gap:2px">📋 Past Bets — Last '+pbLen+' shown'+_pbRoiLabel+'</div>';
  h+='<div class="rpt-sub" style="margin-bottom:10px">Completed matches where at least one odds-advantage rule fired. HKJC bets only.</div>';
  if(!pbLen){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic">No past bets found.</div>';
  } else {
    var _pbPnl=0,_pbN=0;
    var pbRunROI=or.pastBets.slice().reverse().map(function(pb){
      var bet=pb.fired[0].rule.bet, v=bet==='H'?pb.pnl.h:pb.pnl.a;
      if(v!==null){_pbPnl=Math.round((_pbPnl+v)*1000)/1000;_pbN++;}
      return Math.round(_pbPnl/Math.max(_pbN,1)*1000)/10;
    });
    pbRunROI.reverse();
    var pbROI=Math.round(_pbPnl/pbLen*1000)/10, pbColor=pbROI>=0?'#4ade80':'#f87171';

    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th><th class="num">AH</th><th class="num">AA</th>'
      +'<th class="num">Score</th><th class="num">Bet</th><th>Rule</th><th class="num">N</th>'
      +'<th>Outcome</th><th class="num">Hit</th><th class="num">Run ROI</th>'
      +'</tr></thead><tbody>';

    or.pastBets.forEach(function(pb,i){
      var r=pb.r, topRS=pb.fired[0], rule=topRS.rule, bet=rule.bet;
      var betCol=bet==='H'?'#f87171':'#60a5fa';
      var outLabel,predWon;
      if(pb.outcome==='HW'){outLabel='H WIN';predWon=(bet==='H');}
      else if(pb.outcome==='HH'){outLabel='H ½WIN';predWon=(bet==='H');}
      else if(pb.outcome==='P'){outLabel='PUSH';predWon=null;}
      else if(pb.outcome==='AH'){outLabel='A ½WIN';predWon=(bet==='A');}
      else{outLabel='A WIN';predWon=(bet==='A');}
      var outBg=predWon===null?'rgba(148,163,184,0.15)':predWon?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)';
      var outCol=predWon===null?'#94a3b8':predWon?'#4ade80':'#f87171';
      var pfw=(bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW');
      var phw=(bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH');
      var phl=(bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hitHtml=pfw?'✅✅':phw?'✅':pb.outcome==='P'?'⬜':phl?'❌':'❌❌';
      var runRoi=pbRunROI[i], rrc=runRoi>=0?'#4ade80':'#f87171';
      var score=(r.RESULTH!=null&&r.RESULTA!=null)?r.RESULTH+'–'+r.RESULTA:'—';
      var extra=pb.fired.length>1?' <span style="color:#fbbf24;font-size:9px">+'+(pb.fired.length-1)+'</span>':'';
      h+='<tr>';
      h+=(function(){var dd=(r.DATE||'').slice(5),t=r.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>';})();
      h+='<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>=0?'+':'')+r.ASIALINE+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+r.ASIAH+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+r.ASIAA+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+score+'</td>';
      h+='<td class="num"><b style="color:'+betCol+'">'+bet+'</b></td>';
      h+='<td style="font-size:9px;color:#94a3b8;max-width:140px">'+rule.label+extra+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#64748b">'+topRS.n+'</td>';
      h+='<td><span style="background:'+outBg+';color:'+outCol+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+outLabel+'</span></td>';
      h+='<td class="num" style="font-size:13px">'+hitHtml+'</td>';
      h+='<td class="num" style="font-family:var(--mono);font-size:10px;color:'+rrc+'">'+(runRoi>=0?'+':'')+runRoi.toFixed(1)+'%</td>';
      h+='</tr>';
    });
    h+='<tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.03)">'
      +'<td colspan="9" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">'+pbLen+' bets</td>'
      +'<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">ROI</td>'
      +'<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbColor+'">'+(pbROI>=0?'+':'')+pbROI+'%</td>'
      +'<td></td></tr>';
    h+='</tbody></table></div>';
  }
  h+='</div>';

  el.innerHTML=h;

  // Draw ROI history chart
  if(or.chartData && or.chartData.roiPts.length){
    var cd=or.chartData;
    // MA series are already aligned (same length as roiPts, null where not enough history)
    // Replace nulls with the first valid value for chart continuity
    function fillNulls(arr){
      var first=null;
      for(var i=0;i<arr.length;i++){if(arr[i]!==null){first=arr[i];break;}}
      if(first===null) return arr;
      return arr.map(function(v){return v===null?first:v;});
    }
    var lastRoi  = cd.roiPts.length  ? cd.roiPts[cd.roiPts.length-1]   : null;
    var ma50f=fillNulls(cd.ma50Pts);
    var ma100f=fillNulls(cd.ma100Pts);
    var lastMa50  = ma50f.length   ? cd.ma50Pts[cd.ma50Pts.length-1]   : null;
    var lastMa100 = ma100f.length  ? cd.ma100Pts[cd.ma100Pts.length-1] : null;
    function fmtLatest(v){ return v!==null ? ' <b style="font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</b>' : ''; }
    var fullSeries=[
      {label:'Running ROI%'+fmtLatest(lastRoi),   color:'#60a5fa', pts:cd.roiPts},
    ];
    if(ma50f.some(function(v){return v!==null;}))  fullSeries.push({label:'MA 50'+fmtLatest(lastMa50),   color:'#fbbf24', pts:ma50f});
    if(ma100f.some(function(v){return v!==null;})) fullSeries.push({label:'MA 100'+fmtLatest(lastMa100), color:'#4ade80', pts:ma100f});
    makeLegend('lgdOrRoi', fullSeries);
    setTimeout(function(){ drawChart('cOrRoi', fullSeries, RD.monthBounds, 150); }, 30);
  }
}
