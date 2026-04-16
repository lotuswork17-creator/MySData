// ── report-combined.js — Tab 14: Combined Rules ──
// Aggregates upcoming alerts and past bets from JC Relations, Move Rules, and Odds Rules.
// Shows which report(s) each recommendation comes from and flags cross-report conflicts.

var COMBINED_REPORTS = [
  { key:'jcrelation', label:'JC Relations', short:'JCR', color:'#60a5fa',
    getAlerts: function(RD){ return RD.jcrelation ? RD.jcrelation.upcomingAlerts : []; },
    getPastBets: function(RD){ return RD.jcrelation ? RD.jcrelation.pastBets : []; },
    getTopBet: function(alert){ return alert.rules && alert.rules[0] ? alert.rules[0].bet : null; },
    getPbBet: function(pb){ return pb.rules && pb.rules[0] ? pb.rules[0].bet : null; },
    getPbConflict: function(pb){ return pb.conflict||false; },
    getPbRoi: function(pb){ var b=pb.rules&&pb.rules[0]?pb.rules[0].bet:null; return b==='H'?pb.pnl.h:pb.pnl.a; },
    getTopRule: function(alert){ return alert.rules && alert.rules[0] ? alert.rules[0] : null; },
    getPbTopRule: function(pb){ return pb.rules && pb.rules[0] ? pb.rules[0] : null; },
    getRuleLabel: function(rule){ return rule.label; },
    getRuleRoi: function(rule){ return rule.roi ? rule.roi.all : null; },
    getRuleN: function(rule){ return rule.n; },
    getRuleType: function(rule){ return rule.type; },
  },
  { key:'moverule', label:'Move Rules', short:'MR', color:'#a78bfa',
    getAlerts: function(RD){ return RD.moverule ? RD.moverule.upcomingAlerts : []; },
    getPastBets: function(RD){ return RD.moverule ? RD.moverule.pastBets : []; },
    getTopBet: function(alert){ return alert.fired && alert.fired[0] ? alert.fired[0].rule.bet : null; },
    getPbBet: function(pb){ return pb.fired && pb.fired[0] ? pb.fired[0].rule.bet : null; },
    getPbConflict: function(pb){ return pb.conflict||false; },
    getPbRoi: function(pb){ var b=pb.fired&&pb.fired[0]?pb.fired[0].rule.bet:null; return b==='H'?pb.pnl.h:pb.pnl.a; },
    getTopRule: function(alert){ return alert.fired && alert.fired[0] ? alert.fired[0] : null; },
    getPbTopRule: function(pb){ return pb.fired && pb.fired[0] ? pb.fired[0] : null; },
    getRuleLabel: function(rs){ return rs.rule ? rs.rule.label : rs.label||''; },
    getRuleRoi: function(rs){ return rs.roi!=null ? rs.roi : (rs.rule&&rs.rule.roi!=null?rs.rule.roi:null); },
    getRuleN: function(rs){ return rs.n!=null ? rs.n : (rs.rule?rs.rule.n:null); },
    getRuleType: function(rs){ return rs.rule ? rs.rule.type : rs.type||''; },
  },
  { key:'oddsrule', label:'Odds Rules', short:'OR', color:'#fb923c',
    getAlerts: function(RD){ return RD.oddsrule ? RD.oddsrule.upcomingAlerts : []; },
    getPastBets: function(RD){ return RD.oddsrule ? RD.oddsrule.pastBets : []; },
    getTopBet: function(alert){ return alert.fired && alert.fired[0] ? alert.fired[0].rule.bet : null; },
    getPbBet: function(pb){ return pb.fired && pb.fired[0] ? pb.fired[0].rule.bet : null; },
    getPbConflict: function(pb){ return pb.conflict||false; },
    getPbRoi: function(pb){ var b=pb.fired&&pb.fired[0]?pb.fired[0].rule.bet:null; return b==='H'?pb.pnl.h:pb.pnl.a; },
    getTopRule: function(alert){ return alert.fired && alert.fired[0] ? alert.fired[0] : null; },
    getPbTopRule: function(pb){ return pb.fired && pb.fired[0] ? pb.fired[0] : null; },
    getRuleLabel: function(rs){ return rs.rule ? rs.rule.label : rs.label||''; },
    getRuleRoi: function(rs){ return rs.roi!=null ? rs.roi : (rs.rule&&rs.rule.roi!=null?rs.rule.roi:null); },
    getRuleN: function(rs){ return rs.n!=null ? rs.n : (rs.rule?rs.rule.n:null); },
    getRuleType: function(rs){ return rs.rule ? rs.rule.type : rs.type||''; },
  },
];

function computeCombined(RD){
  // ── Merge upcoming alerts ──
  var matchMap = {};
  function matchKey(r){ return (r.DATE||'')+'|'+(r.TEAMH||'')+'|'+(r.TEAMA||''); }

  COMBINED_REPORTS.forEach(function(rpt){
    rpt.getAlerts(RD).forEach(function(alert){
      var k = matchKey(alert.r);
      if(!matchMap[k]) matchMap[k] = { r:alert.r, sources:[] };
      var topBet = rpt.getTopBet(alert);
      var topRule = rpt.getTopRule(alert);
      matchMap[k].sources.push({
        rpt:rpt, alert:alert, bet:topBet, topRule:topRule,
        intraConflict: alert.conflict||false,
      });
    });
  });

  var upcomingAlerts = Object.keys(matchMap).map(function(k){
    var m = matchMap[k];
    var bets = m.sources.map(function(s){return s.bet;}).filter(Boolean);
    var hCount = bets.filter(function(b){return b==='H';}).length;
    var aCount = bets.filter(function(b){return b==='A';}).length;
    var crossConflict = hCount>0 && aCount>0;
    var consensusBet = crossConflict ? (hCount>=aCount?'H':'A') : (hCount>0?'H':aCount>0?'A':null);
    var multiReport = m.sources.length > 1;
    return { r:m.r, sources:m.sources, consensusBet:consensusBet,
             crossConflict:crossConflict, multiReport:multiReport,
             hCount:hCount, aCount:aCount };
  });
  upcomingAlerts.sort(function(a,b){
    return (a.r.DATE||'').localeCompare(b.r.DATE||'') || (a.r.TIME||0)-(b.r.TIME||0);
  });

  // ── Merge past bets ──
  var pbMap = {};
  COMBINED_REPORTS.forEach(function(rpt){
    rpt.getPastBets(RD).forEach(function(pb){
      var k = matchKey(pb.r);
      if(!pbMap[k]) pbMap[k] = { r:pb.r, sources:[], outcome:pb.outcome };
      var bet = rpt.getPbBet(pb);
      var topRule = rpt.getPbTopRule(pb);
      var pnlVal = rpt.getPbRoi(pb);
      pbMap[k].sources.push({
        rpt:rpt, pb:pb, bet:bet, topRule:topRule, pnlVal:pnlVal,
        intraConflict: rpt.getPbConflict(pb),
      });
    });
  });

  var pastBets = Object.keys(pbMap).map(function(k){
    var m = pbMap[k];
    var bets = m.sources.map(function(s){return s.bet;}).filter(Boolean);
    var hCount = bets.filter(function(b){return b==='H';}).length;
    var aCount = bets.filter(function(b){return b==='A';}).length;
    var crossConflict = hCount>0 && aCount>0;
    var consensusBet = crossConflict ? (hCount>=aCount?'H':'A') : (hCount>0?'H':aCount>0?'A':null);
    // For consensus ROI: use pnl from sources matching consensusBet, average
    var consensusPnl = null;
    if(consensusBet){
      var vals = m.sources.filter(function(s){return s.bet===consensusBet&&s.pnlVal!==null&&s.pnlVal!==undefined;});
      if(vals.length) consensusPnl = vals[0].pnlVal; // take first matching source's pnl
    }
    return { r:m.r, sources:m.sources, outcome:m.outcome,
             consensusBet:consensusBet, crossConflict:crossConflict,
             hCount:hCount, aCount:aCount, pnl:consensusPnl,
             multiReport:m.sources.length>1 };
  });
  pastBets.sort(function(a,b){
    return (b.r.DATE||'').localeCompare(a.r.DATE||'') || (b.r.TIME||0)-(a.r.TIME||0);
  });
  pastBets = pastBets.slice(0,200);

  // ── ROI chart (chronological, skip first 100) ──
  var chronoAll = pastBets.slice().reverse();
  var chartPts=[],chartMa50=[],chartMa100=[],cum=0,skip=100;
  var allPnls=[];
  chronoAll.forEach(function(pb){ if(pb.pnl!==null&&pb.pnl!==undefined) allPnls.push(pb.pnl); });
  allPnls.forEach(function(v,i){
    cum=Math.round((cum+v)*1000)/1000;
    var n=i+1,rr=Math.round(cum/n*10000)/100;
    var m50=n>=50?Math.round(allPnls.slice(n-50,n).reduce(function(s,x){return s+x;},0)/50*10000)/100:null;
    var m100=n>=100?Math.round(allPnls.slice(n-100,n).reduce(function(s,x){return s+x;},0)/100*10000)/100:null;
    if(i>=skip){chartPts.push(rr);chartMa50.push(m50);chartMa100.push(m100);}
  });

  return { upcomingAlerts:upcomingAlerts, pastBets:pastBets,
           chartData:{roiPts:chartPts,ma50Pts:chartMa50,ma100Pts:chartMa100,
                      totalBets:allPnls.length,skip:skip} };
}

function renderCombined(RD){
  var el=document.getElementById('tab14'); if(!el) return;
  if(!RD.combined) RD.combined=computeCombined(RD);
  var cb=RD.combined;
  var h='';

  h+='<div class="rpt-title">🔀 Combined Rules</div>';
  h+='<div class="rpt-sub">Upcoming matches and past bets aggregated from '
    +'<span style="color:#60a5fa">JC Relations</span>, '
    +'<span style="color:#a78bfa">Move Rules</span>, and '
    +'<span style="color:#fb923c">Odds Rules</span>. '
    +'Matches appearing in multiple reports are highlighted. Cross-report conflicts flagged ⚠️.</div>';

  // ── Report source badge helper ──
  function rptBadge(rpt,size){
    size=size||'9px';
    return '<span style="font-size:'+size+';font-weight:700;padding:1px 5px;border-radius:3px;background:'+rpt.color+'22;border:1px solid '+rpt.color+'55;color:'+rpt.color+'">'+rpt.short+'</span>';
  }
  function betBadge(bet,size){
    size=size||'13px';
    var c=bet==='H'?'#f87171':'#60a5fa';
    return '<b style="color:'+c+';font-size:'+size+'">'+bet+'</b>';
  }
  function typeIcon(type){
    return type==='COUNTER'
      ?'<span style="color:#fbbf24;font-weight:700;font-family:var(--mono);margin-right:2px">⚡</span>'
      :'<span style="color:#4ade80;font-weight:700;font-family:var(--mono);margin-right:2px">✓</span>';
  }

  // ── ROI Chart ──
  if(cb.chartData && cb.chartData.roiPts.length){
    var cd=cb.chartData;
    function fillNulls(arr){var f=null;for(var i=0;i<arr.length;i++){if(arr[i]!==null){f=arr[i];break;}}if(f===null)return arr;return arr.map(function(v){return v===null?f:v;});}
    var lastRoi=cd.roiPts[cd.roiPts.length-1];
    var f50=fillNulls(cd.ma50Pts),f100=fillNulls(cd.ma100Pts);
    var last50=cd.ma50Pts[cd.ma50Pts.length-1],last100=cd.ma100Pts[cd.ma100Pts.length-1];
    function fmtL(v){return v!==null?' <b style="font-weight:700">'+(v>=0?'+':'')+v.toFixed(1)+'%</b>':'';}
    var cbSeries=[{label:'Running ROI%'+fmtL(lastRoi),color:'#60a5fa',pts:cd.roiPts}];
    if(f50.some(function(v){return v!==null;})) cbSeries.push({label:'MA 50'+fmtL(last50),color:'#fbbf24',pts:f50});
    if(f100.some(function(v){return v!==null;})) cbSeries.push({label:'MA 100'+fmtL(last100),color:'#4ade80',pts:f100});
    h+='<div class="chart-box" style="margin-bottom:16px">'
      +'<div class="chart-box-label">Combined ROI% History — all three reports (first '+cd.skip+' bets hidden · '+cd.totalBets+' total)</div>'
      +'<div class="chart-legend" id="lgdCbRoi"></div>'
      +'<canvas id="cCbRoi"></canvas></div>';
    setTimeout(function(){
      makeLegend('lgdCbRoi',cbSeries);
      drawChart('cCbRoi',cbSeries,null,150);
    },30);
  }

  // ── Upcoming Alerts ──
  h+='<div style="margin-bottom:20px">';
  h+='<div class="rpt-title" style="margin-bottom:4px">🎯 Upcoming Matches — Combined Alerts</div>';

  if(!cb.upcomingAlerts.length){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently match any rule across all three reports.</div>';
  } else {
    var alertIdx=0;
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">AH</th><th class="num">AA</th>'
      +'<th>Sources</th><th class="num">Bet</th><th>Top Rules</th>'
      +'</tr></thead><tbody>';

    cb.upcomingAlerts.forEach(function(alert){
      var r=alert.r;
      var detId='cb_up_'+alertIdx;
      var betCol=alert.consensusBet==='H'?'#f87171':'#60a5fa';
      var conflictTag=alert.crossConflict?'<span style="color:#f59e0b;font-size:11px;margin-left:3px" title="Cross-report conflict: reports disagree on bet direction">⚠️</span>':'';
      var multiTag=alert.multiReport?'<span style="color:#4ade80;font-size:8px;margin-left:3px">✦</span>':'';
      var hCol=alert.consensusBet==='H'?'#f87171':'#e2e8f0';
      var aCol=alert.consensusBet==='A'?'#60a5fa':'#e2e8f0';

      // Source badges
      var srcBadges=alert.sources.map(function(s){
        return rptBadge(s.rpt,'9px')+(s.intraConflict?'<span style="color:#f59e0b;font-size:8px">⚠</span>':'');
      }).join(' ');

      // Top rule per source (one line each)
      var ruleLines=alert.sources.map(function(s){
        if(!s.topRule) return '';
        var rl=s.rpt.getRuleLabel(s.topRule);
        var roi=s.rpt.getRuleRoi(s.topRule);
        var rtype=s.rpt.getRuleType(s.topRule);
        return typeIcon(rtype)+rptBadge(s.rpt,'8px')+' <span style="font-size:9px;color:#94a3b8">'+rl+'</span>'
          +(roi!=null?' <span style="font-size:9px;font-family:var(--mono);color:'+(roi>=0?'#4ade80':'#f87171')+'">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>':'');
      }).filter(Boolean).join('<br>');

      // Line/odds with arrows
      function lineStr(r){
        var l=parseFloat(r.ASIALINE)||0,ln=r.ASIALINELN;
        var s=(l>=0?'+':'')+l.toFixed(2);
        if(ln!=null&&ln!==l){var d=Math.round((l-ln)*100)/100,a=Math.abs(d),n=a>=1?3:a>=0.5?2:1,ar=d<0?'▼':'▲',c=d<0?'#f87171':'#60a5fa';s+='<span style="color:'+c+';font-size:10px">'+ar.repeat(n)+'</span>';}
        return s;
      }
      function oddsStr(v,opn){
        var s=String(v||'—');
        if(opn&&opn>0&&v&&Math.abs(v-opn)/opn>0.001){var r2=v/opn,n=r2<0.9?3:r2<0.97?2:1,ar=r2<1?'▼':'▲',c=r2<1?'#f87171':'#60a5fa';s=String(v)+'<span style="color:'+c+';font-size:10px">'+ar.repeat(n)+'</span>';}
        return s;
      }

      h+='<tr style="cursor:pointer'+(alert.multiReport?';background:rgba(74,222,128,0.04)':'')+'" onclick="var e=document.getElementById(\''+detId+'\');e.style.display=e.style.display===\'none\'?\'table-row\':\'none\'">';
      var dd=(r.DATE||'').slice(5),t=r.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';
      h+='<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>';
      h+='<td style="white-space:nowrap"><div style="font-size:11px;font-weight:600"><span style="color:'+hCol+'">'+r.TEAMH+'</span> <span style="color:#475569;font-weight:400">vs</span> <span style="color:'+aCol+'">'+r.TEAMA+'</span></div>'
        +'<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||r.LEAGUE||'')+'</div></td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+lineStr(r)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+oddsStr(r.ASIAH,r.ASIAHLN)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+oddsStr(r.ASIAA,r.ASIAALN)+'</td>';
      h+='<td>'+srcBadges+multiTag+'</td>';
      h+='<td class="num">'+betBadge(alert.consensusBet||'?')+conflictTag+'</td>';
      h+='<td style="font-size:10px;max-width:260px">'+ruleLines+'</td>';
      h+='</tr>';

      // ── Expand detail ──
      var tipFields=[{key:'JCTIPSUM',label:'JCSUM'},{key:'JCTIPSID',label:'JCSID'},{key:'TIPSIDMAC',label:'MAC'},{key:'TIPSONID',label:'ONID'}];
      var tipBadges=tipFields.map(function(tf){
        var tv=r[tf.key];var c=tv&&(tv.indexOf('H')>=0||tv==='1H'||tv==='FH')?'#f87171':tv&&(tv.indexOf('A')>=0||tv==='1A'||tv==='FA')?'#60a5fa':'#475569';
        return '<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+c+'15;border:1px solid '+c+'33;color:'+c+'">'+tf.label+': '+(tv||'—')+'</span>';
      }).join(' ');

      var expertBar=(typeof expertScore==='function')?(function(){
        var e=expertScore(r); if(!e) return '';
        var et=e.h+e.d+e.a||1;
        return '<div style="margin-bottom:8px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Expert Signal</div>'
          +'<div style="display:flex;gap:8px;font-size:10px;font-family:var(--mono);margin-bottom:4px"><span style="color:#f87171">H '+e.h+'%</span><span style="color:#4ade80">D '+e.d+'%</span><span style="color:#60a5fa">A '+e.a+'%</span></div>'
          +'<div style="height:6px;border-radius:3px;overflow:hidden;display:flex"><div style="width:'+(e.h/et*100).toFixed(1)+'%;background:#f87171"></div><div style="width:'+(e.d/et*100).toFixed(1)+'%;background:#4ade80"></div><div style="width:'+(e.a/et*100).toFixed(1)+'%;background:#60a5fa"></div></div></div>';
      })():'';

      var pred1x2=(r.PREDICTH||r.PREDICTD||r.PREDICTA)?(function(){
        var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0,pt=ph+pd+pa||1;
        return '<div style="margin-bottom:8px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prediction %</div>'
          +'<div style="display:flex;gap:8px;font-size:10px;font-family:var(--mono);margin-bottom:4px"><span style="color:#f87171">H '+ph+'%</span><span style="color:#4ade80">D '+pd+'%</span><span style="color:#60a5fa">A '+pa+'%</span></div>'
          +'<div style="height:6px;border-radius:3px;overflow:hidden;display:flex"><div style="width:'+(ph/pt*100).toFixed(1)+'%;background:#f87171"></div><div style="width:'+(pd/pt*100).toFixed(1)+'%;background:#4ade80"></div><div style="width:'+(pa/pt*100).toFixed(1)+'%;background:#60a5fa"></div></div></div>';
      })():'';

      var jcNarr=(r.JCTIPS1||r.JCTIPS2||r.JCTIPS3)
        ?'<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">JC Analysis</div>'
          +(r.JCTIPS1?'<div style="font-size:11px;color:#fbbf24;font-weight:600;margin-bottom:4px">'+r.JCTIPS1+'</div>':'')
          +(r.JCTIPS2?'<div style="font-size:10px;color:#e2e8f0;line-height:1.6;margin-bottom:4px">'+r.JCTIPS2+'</div>':'')
          +(r.JCTIPS3?'<div style="font-size:10px;color:#94a3b8;line-height:1.6">'+r.JCTIPS3+'</div>':'')
          +'</div>':'';

      var macNarr=r.TIPSMAC
        ?'<div style="margin-bottom:8px;padding-top:7px;border-top:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">🎰 Macau Tips</div>'
          +'<div style="font-size:10px;color:#e2e8f0;line-height:1.7">'+r.TIPSMAC+'</div></div>':'';

      // All rules across all sources
      var allRuleRows=alert.sources.map(function(s){
        if(!s.topRule) return '';
        var rl=s.rpt.getRuleLabel(s.topRule);
        var roi=s.rpt.getRuleRoi(s.topRule);
        var rtype=s.rpt.getRuleType(s.topRule);
        var n=s.rpt.getRuleN(s.topRule);
        var rc=rtype==='COUNTER'?'#fbbf24':'#4ade80';
        return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:10px;flex-wrap:wrap;padding:5px 8px;border-radius:5px;margin-bottom:3px;background:rgba(255,255,255,0.02);border:1px solid var(--border)">'
          +typeIcon(rtype)+rptBadge(s.rpt,'9px')
          +' <span style="color:#e2e8f0;flex:1;min-width:120px">'+rl+'</span>'
          +(roi!=null?'<span style="color:#4ade80;font-family:var(--mono);font-weight:700;white-space:nowrap">'+(roi>=0?'+':'')+roi.toFixed(1)+'% ROI</span>':'')
          +(n!=null?'<span style="color:#64748b;font-family:var(--mono);font-size:9px;white-space:nowrap"> n='+n+'</span>':'')
          +'<span style="color:'+(s.bet==='H'?'#f87171':'#60a5fa')+';font-weight:700;font-family:var(--mono)"> Bet '+s.bet+'</span>'
          +(s.intraConflict?'<span style="color:#f59e0b;font-size:9px"> ⚠️intra</span>':'')
          +'</div>';
      }).join('');

      if(alert.crossConflict){
        allRuleRows='<div style="font-size:10px;color:#f59e0b;padding:4px 8px;background:rgba(245,158,11,0.1);border-radius:4px;margin-bottom:6px">⚠️ Cross-report conflict: '+alert.hCount+' source(s) recommend H, '+alert.aCount+' recommend A. Showing majority bet. Use filter buttons in individual reports for detail.</div>'+allRuleRows;
      }

      h+='<tr id="'+detId+'" style="display:none"><td colspan="8" style="padding:0">'
        +'<div style="padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border)">'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+tipBadges+'</div>'
        +expertBar+pred1x2+allRuleRows+jcNarr+macNarr
        +'</div></td></tr>';
      alertIdx++;
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px"><span style="color:#4ade80">✦</span>=multi-report match · ⚠️=cross-report conflict · ⚡=COUNTER · ✓=WITH · Click row to expand</div>';
  }
  h+='</div>';

  // ── Past Bets ──
  var pbLen=cb.pastBets.length;
  function _cbRoiOf(bets, n){
    var sl=bets.slice(0,n); var pnl=0,cnt=0;
    sl.slice().reverse().forEach(function(pb){
      if(pb.pnl!==null&&pb.pnl!==undefined){pnl=Math.round((pnl+pb.pnl)*1000)/1000;cnt++;}
    });
    return cnt?Math.round(pnl/cnt*1000)/10:null;
  }
  function _cbRoiSpan(roi,label){
    if(roi===null) return '';
    var c=roi>=0?'#4ade80':'#f87171';
    return ' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+c+'">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
      +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">'+label+'</span>';
  }
  var _roi200=_cbRoiOf(cb.pastBets,200);
  var _roi100=_cbRoiOf(cb.pastBets,100);
  var _roi50 =_cbRoiOf(cb.pastBets,50);
  var _roiLabel=_cbRoiSpan(_roi200,'L200')+_cbRoiSpan(_roi100,'L100')+_cbRoiSpan(_roi50,'L50');

  h+='<div style="border-top:2px solid var(--border);padding-top:14px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;display:flex;align-items:center;gap:2px">📋 Past Bets — Last '+pbLen+' shown<span id="cb-pb-roi-lbl">'+_roiLabel+'</span></div>';
  h+='<div class="rpt-sub" style="margin-bottom:6px">Combined past bets across all three reports. Consensus bet used for ROI. ⚠️=cross-report conflict.</div>';
  // ── Filter panel ──
  var _cbBtnBase='font-size:9px;font-family:var(--mono);padding:2px 9px;border-radius:4px;cursor:pointer;margin:2px';
  var _cbBtnOn =_cbBtnBase+';border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-weight:700';
  var _cbBtnOff=_cbBtnBase+';border:1px solid #334155;background:transparent;color:#64748b';

  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:10px">';

  // Row 1: Source count
  h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  h+='<span style="font-size:9px;color:#64748b;font-weight:700;min-width:80px">SOURCE COUNT</span>';
  h+='<button class="cb-src-btn" data-src="all" onclick="cbApplyFilter()" style="'+_cbBtnOn+'">All</button>';
  h+='<button class="cb-src-btn" data-src="3"   onclick="cbApplyFilter()" style="'+_cbBtnOff+'"><span style="color:#4ade80">✦✦✦</span> 3 Sources</button>';
  h+='<button class="cb-src-btn" data-src="2"   onclick="cbApplyFilter()" style="'+_cbBtnOff+'"><span style="color:#a78bfa">✦✦</span> 2 Sources</button>';
  h+='<button class="cb-src-btn" data-src="1"   onclick="cbApplyFilter()" style="'+_cbBtnOff+'">✦ 1 Source</button>';
  h+='</div>';

  // Row 2: Report include/exclude/only — each cycles through 3 states
  h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  h+='<span style="font-size:9px;color:#64748b;font-weight:700;min-width:80px">REPORT</span>';
  [['jcrelation','JCR','#60a5fa'],['moverule','MR','#a78bfa'],['oddsrule','OR','#fb923c']].forEach(function(rp){
    h+='<button class="cb-rpt-btn" data-rpt="'+rp[0]+'" data-state="include" onclick="cbCycleRpt(this)" '
      +'style="'+_cbBtnBase+';border:1px solid '+rp[2]+';background:'+rp[2]+'33;color:'+rp[2]+';font-weight:700">'
      +'✓ '+rp[1]+'</button>';
  });
  h+='<span style="font-size:9px;color:#475569;margin-left:4px">click to cycle: ✓ include → ✗ exclude → ◉ only</span>';
  h+='</div>';

  // Row 3: Contradiction filter
  h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
  h+='<span style="font-size:9px;color:#64748b;font-weight:700;min-width:80px">CONFLICT</span>';
  h+='<button class="cb-con-btn" data-con="all"      onclick="cbApplyFilter()" style="'+_cbBtnOn+'">All</button>';
  h+='<button class="cb-con-btn" data-con="conflict"  onclick="cbApplyFilter()" style="'+_cbBtnOff+'"><span style="color:#f59e0b">⚠️</span> Conflict only</button>';
  h+='<button class="cb-con-btn" data-con="clean"     onclick="cbApplyFilter()" style="'+_cbBtnOff+'">✓ No conflict</button>';
  h+='</div>';

  h+='</div>';

  if(!pbLen){
    h+='<div style="padding:14px;color:#475569;font-size:12px;font-style:italic">No past bets found.</div>';
  } else {
    var pbRunROI=[],rp=0,rn=0;
    cb.pastBets.slice().reverse().forEach(function(pb){
      if(pb.pnl!==null&&pb.pnl!==undefined){rp=Math.round((rp+pb.pnl)*1000)/1000;rn++;}
      pbRunROI.push(Math.round(rp/Math.max(rn,1)*1000)/10);
    });
    pbRunROI.reverse();

    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">AH</th><th class="num">AA</th>'
      +'<th class="num">Score</th>'
      +'<th>Sources</th><th class="num">Bet</th>'
      +'<th>Top Rule</th>'
      +'<th>Outcome</th><th class="num">Hit</th><th class="num">Run ROI</th>'
      +'</tr></thead><tbody id="cb-pb-tbody">';

    cb.pastBets.forEach(function(pb,i){
      var r=pb.r,bet=pb.consensusBet,bCol=bet==='H'?'#f87171':'#60a5fa';
      var conflictTag=pb.crossConflict?'<span style="color:#f59e0b;font-size:10px;margin-left:2px" title="Cross-report conflict">⚠️</span>':'';
      var multiTag=pb.multiReport?'<span style="color:#4ade80;font-size:8px;margin-left:2px">✦</span>':'';
      var oL,pW;
      if(pb.outcome==='HW'){oL='H WIN';pW=(bet==='H');}
      else if(pb.outcome==='HH'){oL='H ½WIN';pW=(bet==='H');}
      else if(pb.outcome==='P'){oL='PUSH';pW=null;}
      else if(pb.outcome==='AH'){oL='A ½WIN';pW=(bet==='A');}
      else{oL='A WIN';pW=(bet==='A');}
      var oBg=pW===null?'rgba(148,163,184,0.15)':pW?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)';
      var oCl=pW===null?'#94a3b8':pW?'#4ade80':'#f87171';
      var pfw=(bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW');
      var phw=(bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH');
      var phl=(bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hit=pfw?'✅✅':phw?'✅':pb.outcome==='P'?'⬜':phl?'❌':'❌❌';
      var rr=pbRunROI[i]||0,rrc=rr>=0?'#4ade80':'#f87171';
      var sc=(r.RESULTH!=null&&r.RESULTA!=null)?r.RESULTH+'–'+r.RESULTA:'—';
      var srcBadges=pb.sources.map(function(s){return rptBadge(s.rpt,'8px');}).join(' ');
      var _srcMark=pb.sources.length>=3?'<span style="color:#4ade80;font-size:8px;margin-left:2px">✦✦✦</span>':pb.sources.length===2?'<span style="color:#a78bfa;font-size:8px;margin-left:2px">✦✦</span>':'<span style="color:#64748b;font-size:8px;margin-left:2px">✦</span>';
      srcBadges+=_srcMark;
      var topS=pb.sources[0];
      var topRuleLabel=topS&&topS.topRule?topS.rpt.getRuleLabel(topS.topRule):'—';
      var topRuleType=topS&&topS.topRule?topS.rpt.getRuleType(topS.topRule):'';
      var dd=(r.DATE||'').slice(5),t=r.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';

      h+='<tr'+(pb.multiReport?' style="background:rgba(74,222,128,0.03)"':'')+'>'
        +'<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>'
        +'<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>=0?'+':'')+r.ASIALINE+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+sc+'</td>'
        +'<td>'+srcBadges+multiTag+'</td>'
        +'<td class="num">'+betBadge(bet||'?')+conflictTag+'</td>'
        +'<td style="font-size:9px;color:#94a3b8;max-width:140px">'+typeIcon(topRuleType)+topRuleLabel+'</td>'
        +'<td><span style="background:'+oBg+';color:'+oCl+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+oL+'</span></td>'
        +'<td class="num" style="font-size:13px">'+hit+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:10px;color:'+rrc+'">'+(rr>=0?'+':'')+rr.toFixed(1)+'%</td>'
        +'</tr>';
    });

    var pbRoi=_roi200||0,pbC=pbRoi>=0?'#4ade80':'#f87171';
    h+='<tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.03)">'
      +'<td colspan="10" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">'+pbLen+' combined bets</td>'
      +'<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">ROI</td>'
      +'<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbC+'">'+(pbRoi>=0?'+':'')+pbRoi.toFixed(1)+'%</td></tr>';
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px"><span style="color:#4ade80">✦</span>=match appeared in multiple reports · ⚠️=cross-report conflict · Consensus bet = majority direction across sources</div>';
  }
  h+='</div>';

  el.innerHTML=h;

  // ── Source count filter ──
  var _cbAllPb = cb.pastBets.slice();
  // Cycle report button through include → exclude → only
  window.cbCycleRpt = function(btn){
    var states=['include','exclude','only'];
    var rpt=btn.getAttribute('data-rpt');
    var cur=btn.getAttribute('data-state');
    var next=states[(states.indexOf(cur)+1)%3];
    btn.setAttribute('data-state',next);
    var colors={'jcrelation':'#60a5fa','moverule':'#a78bfa','oddsrule':'#fb923c'};
    var labels={'jcrelation':'JCR','moverule':'MR','oddsrule':'OR'};
    var c=colors[rpt], l=labels[rpt];
    var base='font-size:9px;font-family:var(--mono);padding:2px 9px;border-radius:4px;cursor:pointer;margin:2px;font-weight:700';
    if(next==='include'){btn.style.cssText=base+';border:1px solid '+c+';background:'+c+'33;color:'+c;btn.innerHTML='✓ '+l;}
    else if(next==='exclude'){btn.style.cssText=base+';border:1px solid #334155;background:#1e293b;color:#475569;text-decoration:line-through';btn.innerHTML='✗ '+l;}
    else{btn.style.cssText=base+';border:1px solid '+c+';background:'+c+';color:#000';btn.innerHTML='◉ '+l;}
    cbApplyFilter();
  };

  window.cbApplyFilter = function(){
    // Read source count
    var srcBtn=document.querySelector('.cb-src-btn[style*="background:#3b82f6"]');
    if(!srcBtn){ // find active by class check — use data-active workaround
      document.querySelectorAll('.cb-src-btn').forEach(function(b){
        if(b.style.background==='rgb(59, 130, 246)'||b.style.cssText.indexOf('background:#3b82f6')>=0) srcBtn=b;
      });
    }
    var src=srcBtn?srcBtn.getAttribute('data-src'):'all';

    // Read report states
    var rptStates={};
    document.querySelectorAll('.cb-rpt-btn').forEach(function(b){
      rptStates[b.getAttribute('data-rpt')]=b.getAttribute('data-state');
    });

    // Read conflict state
    var conBtn=null;
    document.querySelectorAll('.cb-con-btn').forEach(function(b){
      if(b.style.cssText.indexOf('background:#3b82f6')>=0) conBtn=b;
    });
    var con=conBtn?conBtn.getAttribute('data-con'):'all';

    // Update source count button styles
    document.querySelectorAll('.cb-src-btn').forEach(function(b){
      var active=b===srcBtn;
      var bBase='font-size:9px;font-family:var(--mono);padding:2px 9px;border-radius:4px;cursor:pointer;margin:2px';
      b.style.cssText=active?(bBase+';border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-weight:700'):(bBase+';border:1px solid #334155;background:transparent;color:#64748b');
    });
    // Update conflict button styles
    document.querySelectorAll('.cb-con-btn').forEach(function(b){
      var active=b===conBtn;
      var bBase='font-size:9px;font-family:var(--mono);padding:2px 9px;border-radius:4px;cursor:pointer;margin:2px';
      b.style.cssText=active?(bBase+';border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-weight:700'):(bBase+';border:1px solid #334155;background:transparent;color:#64748b');
    });

    // Filter
    var filtered=_cbAllPb.filter(function(pb){
      // Source count
      if(src!=='all'&&pb.sources.length!==parseInt(src)) return false;
      // Report include/exclude/only
      var hasOnly=Object.values?Object.values(rptStates).some(function(s){return s==='only';}):false;
      if(!hasOnly){
        // Check 'only' manually for older JS compat
        for(var k in rptStates){if(rptStates[k]==='only'){hasOnly=true;break;}}
      }
      for(var rk in rptStates){
        var st=rptStates[rk];
        var hasSrc=pb.sources.some(function(s){return s.rpt.key===rk;});
        if(st==='exclude'&&hasSrc) return false;
        if(st==='only'&&!hasSrc) return false;
        // include: no filtering
      }
      // Conflict
      if(con==='conflict'&&!pb.crossConflict) return false;
      if(con==='clean'&&pb.crossConflict) return false;
      return true;
    });

    // Recompute ROI labels
    function roiOf(bets,n){
      var sl=bets.slice(0,n),pnl=0,cnt=0;
      sl.slice().reverse().forEach(function(pb){
        if(pb.pnl!==null&&pb.pnl!==undefined){pnl=Math.round((pnl+pb.pnl)*1000)/1000;cnt++;}
      });
      return cnt?Math.round(pnl/cnt*1000)/10:null;
    }
    function roiSpan(roi,label){
      if(roi===null) return '';
      var c=roi>=0?'#4ade80':'#f87171';
      return ' <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+c+'">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</span>'
        +' <span style="font-size:9px;color:#475569;font-family:var(--mono)">'+label+'</span>';
    }
    var lbl=document.getElementById('cb-pb-roi-lbl');
    if(lbl) lbl.innerHTML=roiSpan(roiOf(filtered,200),'L200')+roiSpan(roiOf(filtered,100),'L100')+roiSpan(roiOf(filtered,50),'L50');

    // Re-render tbody
    var tbody=document.getElementById('cb-pb-tbody'); if(!tbody) return;
    var pbRunROI=[],rp=0,rn=0;
    filtered.slice().reverse().forEach(function(pb){
      if(pb.pnl!==null&&pb.pnl!==undefined){rp=Math.round((rp+pb.pnl)*1000)/1000;rn++;}
      pbRunROI.push(Math.round(rp/Math.max(rn,1)*1000)/10);
    });
    pbRunROI.reverse();

    function rptBadge(rpt){return '<span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;background:'+rpt.color+'22;border:1px solid '+rpt.color+'55;color:'+rpt.color+'">'+rpt.short+'</span>';}
    function typeIcon(type){return type==='COUNTER'?'<span style="color:#fbbf24;font-weight:700;font-family:var(--mono);margin-right:2px">⚡</span>':'<span style="color:#4ade80;font-weight:700;font-family:var(--mono);margin-right:2px">✓</span>';}

    var rows='';
    filtered.forEach(function(pb,i){
      var r=pb.r,bet=pb.consensusBet,bCol=bet==='H'?'#f87171':'#60a5fa';
      var conflictTag=pb.crossConflict?'<span style="color:#f59e0b;font-size:10px;margin-left:2px" title="Cross-report conflict">⚠️</span>':'';
      var multiTag=pb.multiReport?'<span style="color:'+(pb.sources.length>=3?'#4ade80':'#a78bfa')+';font-size:8px;margin-left:2px">'+( pb.sources.length>=3?'✦✦✦':pb.sources.length===2?'✦✦':'✦')+'</span>':'<span style="color:#64748b;font-size:8px;margin-left:2px">✦</span>';
      var oL,pW;
      if(pb.outcome==='HW'){oL='H WIN';pW=(bet==='H');}
      else if(pb.outcome==='HH'){oL='H ½WIN';pW=(bet==='H');}
      else if(pb.outcome==='P'){oL='PUSH';pW=null;}
      else if(pb.outcome==='AH'){oL='A ½WIN';pW=(bet==='A');}
      else{oL='A WIN';pW=(bet==='A');}
      var oBg=pW===null?'rgba(148,163,184,0.15)':pW?'rgba(74,222,128,0.18)':'rgba(248,113,113,0.18)';
      var oCl=pW===null?'#94a3b8':pW?'#4ade80':'#f87171';
      var pfw=(bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW');
      var phw=(bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH');
      var phl=(bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hit=pfw?'✅✅':phw?'✅':pb.outcome==='P'?'⬜':phl?'❌':'❌❌';
      var rr=pbRunROI[i]||0,rrc=rr>=0?'#4ade80':'#f87171';
      var sc=(r.RESULTH!=null&&r.RESULTA!=null)?r.RESULTH+'–'+r.RESULTA:'—';
      var srcBadges=pb.sources.map(function(s){return rptBadge(s.rpt);}).join(' ');
      var topS=pb.sources[0];
      var topRuleLabel=topS&&topS.topRule?topS.rpt.getRuleLabel(topS.topRule):'—';
      var topRuleType=topS&&topS.topRule?topS.rpt.getRuleType(topS.topRule):'';
      var dd=(r.DATE||'').slice(5),t=r.TIME,ts=t?String(t).padStart(4,'0'):'',tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';
      rows+='<tr'+(pb.multiReport?' style="background:rgba(74,222,128,0.03)"':'')+'>'
        +'<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>'
        +'<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>=0?'+':'')+r.ASIALINE+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA||'—')+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+sc+'</td>'
        +'<td>'+srcBadges+multiTag+'</td>'
        +'<td class="num"><b style="color:'+bCol+'">'+bet+'</b>'+conflictTag+'</td>'
        +'<td style="font-size:9px;color:#94a3b8;max-width:140px">'+typeIcon(topRuleType)+topRuleLabel+'</td>'
        +'<td><span style="background:'+oBg+';color:'+oCl+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+oL+'</span></td>'
        +'<td class="num" style="font-size:13px">'+hit+'</td>'
        +'<td class="num" style="font-family:var(--mono);font-size:10px;color:'+rrc+'">'+(rr>=0?'+':'')+rr.toFixed(1)+'%</td>'
        +'</tr>';
    });

    var pbRoi=roiOf(filtered,200)||0,pbC=pbRoi>=0?'#4ade80':'#f87171';
    rows+='<tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.03)">'
      +'<td colspan="10" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">'+filtered.length+' combined bets</td>'
      +'<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">ROI</td>'
      +'<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbC+'">'+(pbRoi>=0?'+':'')+pbRoi.toFixed(1)+'%</td></tr>';

    tbody.innerHTML=rows||'<tr><td colspan="12" style="color:#475569;font-size:11px;padding:12px;text-align:center;font-style:italic">No bets found.</td></tr>';
  };
}
