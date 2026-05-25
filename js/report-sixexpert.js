// ── report-sixexpert.js — Six Expert Strategy Study ──
// Studies the 4 HKJC experts (JC Sum, JC SID, SID Mac, ON ID) plus 2 AI experts
// (Gem AI, GPT AI) for meaningful betting edges, broken down by:
//   • Asia line bucket
//   • Asia line movement (opening → latest)
//   • HKJC H odds movement (opening → latest)
//   • HKJC A odds movement (opening → latest)
// For each cell it reports both FOLLOW (bet the tip) and FADE (bet opposite) ROI.

var SIXEXP_LIST = [
  { key:'JCTIPSUM',  label:'JC Sum',  color:'#4ade80' },
  { key:'JCTIPSID',  label:'JC SID',  color:'#60a5fa' },
  { key:'TIPSIDMAC', label:'SID Mac', color:'#f87171' },
  { key:'TIPSONID',  label:'ON ID',   color:'#a78bfa' },
  { key:'TIPSGEM',   label:'Gem AI',  color:'#fbbf24' },
  { key:'TIPSGPT',   label:'GPT AI',  color:'#e879f9' },
];

// Consensus-fade rules (discovered via the study below). Each scans for an edge.
var SIXEXP_RULES = [
  { id:'CF1', label:'3+ Experts H + H odds drift',  majDir:'H', minAgree:3, cond:'hdrift', bet:'A', roi:14.5 },
  { id:'CF2', label:'3+ Experts H + A odds short',  majDir:'H', minAgree:3, cond:'ashort', bet:'A', roi:13.0 },
  { id:'CF3', label:'3+ Experts H + Line dropped',  majDir:'H', minAgree:3, cond:'linedown', bet:'A', roi:6.5 },
  { id:'CF4', label:'4+ Experts A consensus',       majDir:'A', minAgree:4, cond:null, bet:'H', roi:5.6 },
  { id:'CF5', label:'4+ Experts H consensus',       majDir:'H', minAgree:4, cond:null, bet:'A', roi:3.2 },
];

function seVotes(r){
  var keys=['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID','TIPSGEM','TIPSGPT'];
  var h=0,a=0;
  keys.forEach(function(k){ var t=seTipDir(r[k]); if(t==='H')h++; else if(t==='A')a++; });
  return {h:h,a:a};
}
function seRuleFires(r, rule){
  var v=seVotes(r);
  var maj = v.h>v.a ? 'H' : v.a>v.h ? 'A' : null;
  if(maj!==rule.majDir) return false;
  var agree = Math.max(v.h,v.a);
  if(agree < rule.minAgree) return false;
  if(rule.cond==='hdrift'){ var hr=(r.ASIAHLN&&r.ASIAHLN>0)?r.ASIAH/r.ASIAHLN:1; if(hr<1.03) return false; }
  else if(rule.cond==='ashort'){ var ar=(r.ASIAALN&&r.ASIAALN>0)?r.ASIAA/r.ASIAALN:1; if(ar>0.97) return false; }
  else if(rule.cond==='linedown'){ var ln=r.ASIALINELN; if(ln==null) return false; var d=Math.round((parseFloat(r.ASIALINE)-ln)*100)/100; if(d>=0) return false; }
  return true;
}

function seTipDir(v){
  var s=String(v||'').trim();
  if(s==='H'||s==='1H'||s==='FH') return 'H';
  if(s==='A'||s==='1A'||s==='FA') return 'A';
  if(s==='D'||s==='1D'||s==='B'||s==='1B'||s==='1b'||s==='S'||s==='1S'||s==='CB'||s==='CS') return 'D';
  return null;
}
function seAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function sePnl(r,bet){
  var m=seAdjM(r);
  if(bet==='H'){ var o=r.ASIAH;
    return m>0.25?o-1:m===0.25?(o-1)/2:m===0?0:m===-0.25?-0.5:-1; }
  var oa=r.ASIAA;
  return m<-0.25?oa-1:m===-0.25?(oa-1)/2:m===0?0:m===0.25?-0.5:-1;
}
function seLineMove(r){
  var ln=r.ASIALINELN;
  if(!ln) return 'flat';
  var dd=parseFloat(r.ASIALINE)-ln;
  return dd>0.01?'up':dd<-0.01?'down':'flat';
}
function seOddsMove(r,hk,lk){
  var opn=r[lk];
  if(!opn||opn<=0) return 'flat';
  var ratio=r[hk]/opn;
  return ratio<=0.97?'short':ratio>=1.03?'drift':'flat';
}
function seLean(r){
  var h=r.ASIAH,a=r.ASIAA;
  if(!h||!a) return 'even';
  var vh=(1/h)/((1/h)+(1/a));
  if(vh>=0.58) return 'H fav';
  if(vh<=0.42) return 'A fav';
  return 'even';
}
function seLineBucket(r){
  var l=parseFloat(r.ASIALINE);
  if(l<=-1)   return 'H -1+';
  if(l<=-0.75)return 'H -0.75';
  if(l<=-0.25)return 'H -0.25';
  if(l===0)   return 'Level';
  if(l<=0.25) return 'A +0.25';
  if(l<=0.75) return 'A +0.75';
  return 'A +1+';
}

function computeSixExpert(allRecords){
  var data=allRecords.filter(function(r){
    return r.STATUS==='Result' && r.ASIALINE!=null && r.ASIAH && r.ASIAA && r.RESULTH!=null;
  });
  // Upcoming matches (PREEVE) that fire any consensus-fade rule
  var upcoming=allRecords.filter(function(r){ return r.STATUS==='PREEVE' && r.ASIALINE!=null && r.ASIAH && r.ASIAA; });
  var upcomingAlerts=[];
  upcoming.forEach(function(r){
    var fired=SIXEXP_RULES.filter(function(rule){ return seRuleFires(r,rule); });
    if(fired.length){
      var v=seVotes(r);
      // consensus bet = the bet from highest-ROI fired rule
      fired.sort(function(a,b){return b.roi-a.roi;});
      upcomingAlerts.push({r:r, fired:fired, votes:v, bet:fired[0].bet});
    }
  });
  upcomingAlerts.sort(function(a,b){
    return (a.r.DATE||'').localeCompare(b.r.DATE||'') || (a.r.TIME||0)-(b.r.TIME||0);
  });

  function roiCell(rows, bet){
    var tot=0,n=0,w=0;
    rows.forEach(function(r){ var p=sePnl(r,bet); tot+=p; n++; if(p>0)w++; });
    return n?{roi:Math.round(tot/n*1000)/10, n:n, win:Math.round(w/n*100)}:{roi:null,n:0,win:0};
  }

  var experts=SIXEXP_LIST.map(function(ex){
    // All records where this expert tipped H or A
    var tipped=data.filter(function(r){ var t=seTipDir(r[ex.key]); return t==='H'||t==='A'; });
    // overall follow & fade
    function followFade(rows){
      var fTot=0,faTot=0,n=0,fw=0,faw=0;
      rows.forEach(function(r){
        var t=seTipDir(r[ex.key]);
        var fp=sePnl(r,t), fap=sePnl(r,t==='H'?'A':'H');
        fTot+=fp; faTot+=fap; n++; if(fp>0)fw++; if(fap>0)faw++;
      });
      return n?{
        follow:{roi:Math.round(fTot/n*1000)/10,n:n,win:Math.round(fw/n*100)},
        fade:{roi:Math.round(faTot/n*1000)/10,n:n,win:Math.round(faw/n*100)}
      }:{follow:{roi:null,n:0,win:0},fade:{roi:null,n:0,win:0}};
    }

    var overall=followFade(tipped);

    // Breakdown by each dimension
    function breakdown(fn, order){
      var groups={};
      tipped.forEach(function(r){
        var g=fn(r); if(!groups[g])groups[g]=[];
        groups[g].push(r);
      });
      return order.filter(function(g){return groups[g]&&groups[g].length;}).map(function(g){
        var ff=followFade(groups[g]);
        return {label:g, follow:ff.follow, fade:ff.fade};
      });
    }

    var byLine=breakdown(seLineBucket,['H -1+','H -0.75','H -0.25','Level','A +0.25','A +0.75','A +1+']);
    var byLineMove=breakdown(seLineMove,['up','flat','down']);
    var byHMove=breakdown(function(r){return seOddsMove(r,'ASIAH','ASIAHLN');},['short','flat','drift']);
    var byAMove=breakdown(function(r){return seOddsMove(r,'ASIAA','ASIAALN');},['short','flat','drift']);

    return { ex:ex, total:tipped.length, overall:overall,
             byLine:byLine, byLineMove:byLineMove, byHMove:byHMove, byAMove:byAMove };
  });

  // Best pockets: combine tip×Hmove×Amove, both follow/fade, |ROI|≥6, n≥50
  var pockets=[];
  SIXEXP_LIST.forEach(function(ex){
    var cells={};
    data.forEach(function(r){
      var t=seTipDir(r[ex.key]); if(t!=='H'&&t!=='A') return;
      var hm=seOddsMove(r,'ASIAH','ASIAHLN'), am=seOddsMove(r,'ASIAA','ASIAALN');
      var lm=seLineMove(r);
      ['follow','fade'].forEach(function(act){
        var bet=act==='follow'?t:(t==='H'?'A':'H');
        var k=ex.label+'|'+t+'|L'+lm+'|H'+hm+'|A'+am+'|'+act;
        if(!cells[k])cells[k]={tot:0,n:0,w:0,ex:ex,t:t,lm:lm,hm:hm,am:am,act:act};
        var p=sePnl(r,bet); cells[k].tot+=p; cells[k].n++; if(p>0)cells[k].w++;
      });
    });
    Object.keys(cells).forEach(function(k){
      var c=cells[k];
      if(c.n>=50){
        var roi=Math.round(c.tot/c.n*1000)/10;
        if(roi>=6) pockets.push({ex:c.ex,tip:c.t,lm:c.lm,hm:c.hm,am:c.am,act:c.act,
                                  roi:roi,n:c.n,win:Math.round(c.w/c.n*100)});
      }
    });
  });
  pockets.sort(function(a,b){return b.roi-a.roi;});

  // ── Consensus fade study ──
  // Count H/A votes among all 6 experts per match; group by majority direction & margin.
  var EXP_KEYS=SIXEXP_LIST.map(function(e){return e.key;});
  var consensus={}; // key = maj+'|'+margin
  data.forEach(function(r){
    var hv=0,av=0;
    EXP_KEYS.forEach(function(k){ var t=seTipDir(r[k]); if(t==='H')hv++; else if(t==='A')av++; });
    if(hv===av) return; // tie or no votes
    var maj=hv>av?'H':'A', margin=Math.max(hv,av), opp=maj==='H'?'A':'H';
    var key=maj+'|'+margin;
    if(!consensus[key]) consensus[key]={maj:maj,margin:margin,folTot:0,fadTot:0,n:0,folW:0,fadW:0};
    var c=consensus[key];
    var fp=sePnl(r,maj), fap=sePnl(r,opp);
    c.folTot+=fp; c.fadTot+=fap; c.n++; if(fp>0)c.folW++; if(fap>0)c.fadW++;
  });
  var consensusRows=Object.keys(consensus).map(function(k){
    var c=consensus[k];
    return { maj:c.maj, margin:c.margin, n:c.n,
             folRoi:Math.round(c.folTot/c.n*1000)/10, fadRoi:Math.round(c.fadTot/c.n*1000)/10,
             folWin:Math.round(c.folW/c.n*100), fadWin:Math.round(c.fadW/c.n*100) };
  }).sort(function(a,b){ return a.maj===b.maj ? a.margin-b.margin : (a.maj==='H'?-1:1); });

  // ── Consensus (margin>=3) fade × each condition dimension ──
  var DIMS=[
    {name:'Asia Line', fn:seLineBucket, order:['H -1+','H -0.75','H -0.25','Level','A +0.25','A +0.75','A +1+']},
    {name:'Market Lean', fn:seLean, order:['H fav','even','A fav']},
    {name:'Line Move', fn:seLineMove, order:['up','flat','down']},
    {name:'H Odds Move', fn:function(r){return seOddsMove(r,'ASIAH','ASIAHLN');}, order:['short','flat','drift']},
    {name:'A Odds Move', fn:function(r){return seOddsMove(r,'ASIAA','ASIAALN');}, order:['short','flat','drift']}
  ];
  var comboDims=DIMS.map(function(dim){
    var cells={};
    data.forEach(function(r){
      var hv=0,av=0;
      EXP_KEYS.forEach(function(k){ var t=seTipDir(r[k]); if(t==='H')hv++; else if(t==='A')av++; });
      if(hv===av||Math.max(hv,av)<3) return; // strong consensus only
      var maj=hv>av?'H':'A', opp=maj==='H'?'A':'H';
      var dv=dim.fn(r);
      var key=maj+'|'+dv;
      if(!cells[key]) cells[key]={maj:maj,dv:dv,fadTot:0,folTot:0,n:0,fadW:0};
      cells[key].fadTot+=sePnl(r,opp); cells[key].folTot+=sePnl(r,maj); cells[key].n++;
      if(sePnl(r,opp)>0) cells[key].fadW++;
    });
    var rows=[];
    ['H','A'].forEach(function(maj){
      dim.order.forEach(function(dv){
        var c=cells[maj+'|'+dv];
        if(c&&c.n>=30){
          rows.push({maj:maj,dv:dv,n:c.n,
            fadRoi:Math.round(c.fadTot/c.n*1000)/10,
            folRoi:Math.round(c.folTot/c.n*1000)/10,
            fadWin:Math.round(c.fadW/c.n*100)});
        }
      });
    });
    return {name:dim.name, rows:rows};
  });

  // Top combined fade pockets across all dims
  var comboPockets=[];
  comboDims.forEach(function(dim){
    dim.rows.forEach(function(row){
      if(row.fadRoi>=5) comboPockets.push({dim:dim.name,maj:row.maj,dv:row.dv,roi:row.fadRoi,n:row.n,win:row.fadWin});
    });
  });
  comboPockets.sort(function(a,b){return b.roi-a.roi;});

  return { experts:experts, pockets:pockets, consensusRows:consensusRows, comboDims:comboDims, comboPockets:comboPockets, upcomingAlerts:upcomingAlerts, totalData:data.length,
           hasAI: data.some(function(r){return seTipDir(r.TIPSGEM)||seTipDir(r.TIPSGPT);}) };
}

function renderSixExpert(RD){
  var el=document.getElementById('tab8'); if(!el) return;
  var se=RD.sixexpert||(RD.sixexpert=computeSixExpert(RD.records||RD.results||[]));
  var h='';

  h+='<div class="rpt-title">🎓 Six Expert Strategy Study</div>';
  h+='<div class="rpt-sub">Performance of the 4 HKJC experts (JC Sum / JC SID / SID Mac / ON ID) plus 2 AI experts (Gem / GPT), '
    +'broken down by Asia line, line movement, and HKJC H/A odds movement. '
    +'<b style="color:#4ade80">FOLLOW</b> = bet the tip · <b style="color:#fbbf24">FADE</b> = bet the opposite. ROI on flat stakes.</div>';

  function roiTxt(c){
    if(!c||c.roi===null) return '<span style="color:#475569">—</span>';
    var col=c.roi>=0?'#4ade80':'#f87171';
    return '<span style="color:'+col+';font-weight:700;font-family:var(--mono)">'+(c.roi>=0?'+':'')+c.roi.toFixed(1)+'%</span>'
      +' <span style="color:#475569;font-size:9px;font-family:var(--mono)">n'+c.n+'</span>';
  }

  // ── Upcoming Matches firing consensus-fade rules ──
  h+='<div style="margin-bottom:18px">';
  h+='<div class="rpt-title" style="margin-bottom:4px;font-size:14px">🎯 Upcoming Matches — Consensus Fade Alerts</div>';
  if(!se.upcomingAlerts || !se.upcomingAlerts.length){
    h+='<div style="padding:12px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently fire any consensus-fade rule.</div>';
  } else {
    var aIdx=0;
    h+='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
      +'<th>Date/Time</th><th>Match</th><th class="num">Line</th>'
      +'<th class="num">AH</th><th class="num">AA</th>'
      +'<th class="num">Votes</th><th class="num">Bet</th><th>Rules Fired</th>'
      +'</tr></thead><tbody>';
    se.upcomingAlerts.forEach(function(al){
      var r=al.r, detId='se_up_'+aIdx;
      var bCol=al.bet==='H'?'#f87171':'#60a5fa';
      // movement arrows
      function lineStr(r){
        var l=parseFloat(r.ASIALINE)||0,ln=r.ASIALINELN;
        var s=(l>=0?'+':'')+l.toFixed(2);
        if(ln&&ln!==l){var d=Math.round((l-ln)*100)/100,a=Math.abs(d),n=a>=1?3:a>=0.5?2:1,ar=d<0?'▼':'▲',c=d<0?'#f87171':'#60a5fa';s+='<span style="color:'+c+';font-size:10px">'+ar.repeat(n)+'</span>';}
        return s;
      }
      function oddsStr(v,opn){
        var s=String(v||'—');
        if(opn&&opn>0&&v&&Math.abs(v-opn)/opn>0.001){var r2=v/opn,n=r2<0.9?3:r2<0.97?2:1,ar=r2<1?'▼':'▲',c=r2<1?'#f87171':'#60a5fa';s=String(v)+'<span style="color:'+c+';font-size:10px">'+ar.repeat(n)+'</span>';}
        return s;
      }
      var ruleLines=al.fired.map(function(rule){
        return '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#fb923c22;border:1px solid #fb923c55;color:#fb923c;white-space:nowrap">'+rule.id+'</span> '
          +'<span style="font-size:9px;color:#94a3b8">'+rule.label+'</span> '
          +'<span style="font-size:9px;font-family:var(--mono);color:#4ade80">+'+rule.roi.toFixed(1)+'%</span>';
      }).join('<br>');
      var dd=(r.DATE||'').slice(5),t=r.TIME,ts2=t?String(t).padStart(4,'0'):'',tm=ts2?ts2.slice(0,2)+':'+ts2.slice(2):'';
      h+='<tr style="cursor:pointer" onclick="var e=document.getElementById(\''+detId+'\');e.style.display=e.style.display===\'none\'?\'table-row\':\'none\'">';
      h+='<td style="font-family:var(--mono);font-size:10px;color:#e2e8f0;white-space:nowrap">'+(dd+(tm?' '+tm:''))+'</td>';
      h+='<td style="white-space:nowrap"><div style="font-size:11px;font-weight:600;color:#e2e8f0">'+r.TEAMH+' <span style="color:#475569;font-weight:400">vs</span> '+r.TEAMA+'</div>'
        +'<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||r.LEAGUE||'')+'</div></td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+lineStr(r)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+oddsStr(r.ASIAH,r.ASIAHLN)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);color:#94a3b8">'+oddsStr(r.ASIAA,r.ASIAALN)+'</td>';
      h+='<td class="num" style="font-family:var(--mono);font-size:10px"><span style="color:#f87171">'+al.votes.h+'H</span>/<span style="color:#60a5fa">'+al.votes.a+'A</span></td>';
      h+='<td class="num"><b style="color:'+bCol+';font-size:13px">'+al.bet+'</b></td>';
      h+='<td style="font-size:10px;max-width:260px">'+ruleLines+'</td>';
      h+='</tr>';
      // Expand: show all six expert tips
      var tipFields=[['JC Sum','JCTIPSUM'],['JC SID','JCTIPSID'],['SID Mac','TIPSIDMAC'],['ON ID','TIPSONID'],['Gem','TIPSGEM'],['GPT','TIPSGPT']];
      var tipBadges=tipFields.map(function(tf){
        var v=r[tf[1]];var c=!v?'#475569':(String(v).indexOf('H')>=0?'#f87171':String(v).indexOf('A')>=0?'#60a5fa':'#4ade80');
        return '<span style="font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:4px;background:'+c+'22;border:1px solid '+c+'44"><span style="color:#64748b;font-size:9px">'+tf[0]+':</span> <span style="color:'+c+';font-weight:700">'+(v||'—')+'</span></span>';
      }).join(' ');
      h+='<tr id="'+detId+'" style="display:none"><td colspan="8" style="padding:0">'
        +'<div style="padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border)">'
        +'<div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Six Expert Tips</div>'
        +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">'+tipBadges+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">Consensus: <b style="color:#f87171">'+al.votes.h+' H</b> vs <b style="color:#60a5fa">'+al.votes.a+' A</b> → fade the majority, <b style="color:'+bCol+'">bet '+al.bet+'</b></div>'
        +'</div></td></tr>';
      aIdx++;
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px">Rules fire on opening→latest odds movement. CF1/CF2 (consensus contradicted by odds movement) are the strongest. Click a row for the six expert tips.</div>';
  }
  h+='</div>';

  // ── Best pockets highlight ──
  if(se.pockets.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
    h+='<div style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:8px">⭐ Strongest Edges (ROI ≥ +6%, n ≥ 50)</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Expert</th><th>Tip</th><th>Action</th><th>Line Move</th><th>H Odds</th><th>A Odds</th>'
      +'<th class="num">ROI</th><th class="num">Win%</th><th class="num">N</th></tr></thead><tbody>';
    se.pockets.slice(0,20).forEach(function(p){
      var actCol=p.act==='follow'?'#4ade80':'#fbbf24';
      var betDir=p.act==='follow'?p.tip:(p.tip==='H'?'A':'H');
      h+='<tr>'
        +'<td style="color:'+p.ex.color+';font-weight:700">'+p.ex.label+'</td>'
        +'<td class="num"><b style="color:'+(p.tip==='H'?'#f87171':'#60a5fa')+'">'+p.tip+'</b></td>'
        +'<td><span style="color:'+actCol+';font-weight:700;font-size:10px">'+p.act.toUpperCase()+'</span> <span style="font-size:9px;color:#94a3b8">→bet '+betDir+'</span></td>'
        +'<td style="font-size:10px;color:#94a3b8">'+p.lm+'</td>'
        +'<td style="font-size:10px;color:#94a3b8">'+p.hm+'</td>'
        +'<td style="font-size:10px;color:#94a3b8">'+p.am+'</td>'
        +'<td class="num" style="color:#4ade80;font-weight:700;font-family:var(--mono)">+'+p.roi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+p.win+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+p.n+'</td>'
        +'</tr>';
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px">H Odds / A Odds movement: short = odds shortened (≤−3%), drift = odds drifted (≥+3%), flat = within ±3%. Line move from opening HKJC line.</div>';
    h+='</div>';
  }

  // ── Consensus Fade table ──
  if(se.consensusRows && se.consensusRows.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
    h+='<div style="font-size:11px;font-weight:700;color:#60a5fa;margin-bottom:4px">🔄 Consensus Fade Study — bet AGAINST the majority</div>';
    h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">For each match, count how many of the 6 experts pick H vs A. When a majority agrees, compare betting WITH them (Follow) vs AGAINST them (Fade). Higher agreement = stronger contrarian signal.</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Majority</th><th class="num"># Agree</th><th class="num">Matches</th>'
      +'<th class="num" style="color:#4ade80">Follow ROI</th>'
      +'<th class="num" style="color:#fbbf24">Fade ROI</th>'
      +'<th class="num">Fade Win%</th><th>Verdict</th></tr></thead><tbody>';
    se.consensusRows.forEach(function(c){
      if(c.n<20) return; // hide tiny samples
      var majCol=c.maj==='H'?'#f87171':'#60a5fa';
      var folCol=c.folRoi>=0?'#4ade80':'#f87171';
      var fadCol=c.fadRoi>=0?'#4ade80':'#f87171';
      var betDir=c.maj==='H'?'A':'H';
      var verdict=c.fadRoi>=5?'<span style="color:#4ade80;font-weight:700">✓ FADE bet '+betDir+'</span>'
                 :c.fadRoi>=0?'<span style="color:#94a3b8">~ marginal</span>'
                 :'<span style="color:#64748b">✗ no edge</span>';
      h+='<tr>'
        +'<td><b style="color:'+majCol+'">'+c.maj+' majority</b></td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700">'+c.margin+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+c.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+folCol+'">'+(c.folRoi>=0?'+':'')+c.folRoi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+fadCol+'">'+(c.fadRoi>=0?'+':'')+c.fadRoi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+c.fadWin+'%</td>'
        +'<td>'+verdict+'</td>'
        +'</tr>';
    });
    h+='</tbody></table></div>';
    h+='<div style="font-size:9px;color:#475569;margin-top:4px">"# Agree" = number of experts (out of 6) on the majority side. Draw/no-tip experts are ignored. Rows with fewer than 20 matches hidden. Fade = bet the opposite side of the majority.</div>';
    h+='</div>';
  }

  // ── Consensus + Conditions combined fade ──
  if(se.comboPockets && se.comboPockets.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
    h+='<div style="font-size:11px;font-weight:700;color:#fb923c;margin-bottom:4px">🎯 Strong Consensus (3+ agree) Fade × Conditions</div>';
    h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">When 3+ experts agree, fade ROI broken down by Asia line, market lean, line move, and H/A odds move. Top fade edges (ROI ≥ +5%, n ≥ 30):</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px;margin-bottom:10px"><thead><tr>'
      +'<th>Condition</th><th>Majority</th><th class="num">Fade ROI</th><th class="num">Win%</th><th class="num">N</th></tr></thead><tbody>';
    se.comboPockets.slice(0,15).forEach(function(p){
      var majCol=p.maj==='H'?'#f87171':'#60a5fa';var betDir=p.maj==='H'?'A':'H';
      h+='<tr>'
        +'<td style="font-size:10px"><span style="color:#94a3b8">'+p.dim+':</span> <b style="color:#e2e8f0">'+p.dv+'</b></td>'
        +'<td><b style="color:'+majCol+'">'+p.maj+' maj</b> <span style="font-size:9px;color:#94a3b8">→bet '+betDir+'</span></td>'
        +'<td class="num" style="color:#4ade80;font-weight:700;font-family:var(--mono)">+'+p.roi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+p.win+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+p.n+'</td></tr>';
    });
    h+='</tbody></table></div>';

    // Full breakdown per dimension
    h+='<details style="margin-top:6px"><summary style="cursor:pointer;font-size:10px;color:#60a5fa;font-weight:700">▸ Full breakdown by each condition</summary>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:8px">';
    se.comboDims.forEach(function(dim){
      h+='<div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">'+dim.name+'</div>';
      h+='<table class="rpt-table" style="font-size:10px;width:100%"><thead><tr>'
        +'<th style="font-size:9px">Maj</th><th style="font-size:9px">Cond</th>'
        +'<th class="num" style="font-size:9px;color:#fbbf24">Fade</th>'
        +'<th class="num" style="font-size:9px;color:#4ade80">Follow</th>'
        +'<th class="num" style="font-size:9px">N</th></tr></thead><tbody>';
      if(!dim.rows.length){
        h+='<tr><td colspan="5" style="color:#475569;font-size:9px;font-style:italic">No cells with n≥30</td></tr>';
      }
      dim.rows.forEach(function(row){
        var majCol=row.maj==='H'?'#f87171':'#60a5fa';
        var fadCol=row.fadRoi>=0?'#4ade80':'#f87171';
        var folCol=row.folRoi>=0?'#4ade80':'#f87171';
        h+='<tr><td><b style="color:'+majCol+'">'+row.maj+'</b></td>'
          +'<td style="font-size:9px;color:#e2e8f0">'+row.dv+'</td>'
          +'<td class="num" style="font-family:var(--mono);font-weight:700;color:'+fadCol+'">'+(row.fadRoi>=0?'+':'')+row.fadRoi.toFixed(1)+'%</td>'
          +'<td class="num" style="font-family:var(--mono);color:'+folCol+'">'+(row.folRoi>=0?'+':'')+row.folRoi.toFixed(1)+'%</td>'
          +'<td class="num" style="font-family:var(--mono);color:#64748b">'+row.n+'</td></tr>';
      });
      h+='</tbody></table></div>';
    });
    h+='</div></details>';
    h+='<div style="font-size:9px;color:#475569;margin-top:6px">Strong consensus = 3+ of the 6 experts agree on a side. Fade = bet the opposite. Cells need n≥30 to show.</div>';
    h+='</div>';
  }

  if(!se.hasAI){
    h+='<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px 12px;margin-bottom:16px;font-size:11px;color:#fbbf24">'
      +'ℹ️ Gem AI and GPT AI tips currently appear only on upcoming matches — no settled results yet, so their historical ROI is empty. Their rows will populate automatically once their matches finish.</div>';
  }

  // ── Per-expert detail ──
  se.experts.forEach(function(E){
    h+='<div style="margin-bottom:18px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    h+='<div style="background:var(--surface2);padding:8px 12px;border-left:3px solid '+E.ex.color+';display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<span style="font-weight:700;color:'+E.ex.color+';font-size:13px">'+E.ex.label+'</span>'
      +'<span style="font-size:10px;color:#64748b">'+E.total+' H/A tips</span>';
    if(E.total){
      h+='<span style="font-size:10px;color:#94a3b8">Follow: '+roiTxt(E.overall.follow)+'</span>'
        +'<span style="font-size:10px;color:#94a3b8">Fade: '+roiTxt(E.overall.fade)+'</span>';
    }
    h+='</div>';

    if(!E.total){
      h+='<div style="padding:12px;font-size:11px;color:#475569;font-style:italic">No settled H/A tips yet.</div></div>';
      return;
    }

    h+='<div style="padding:10px 12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">';
    function dimTable(title, rows){
      var t='<div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">'+title+'</div>';
      t+='<table class="rpt-table" style="font-size:10px;width:100%"><thead><tr>'
        +'<th style="font-size:9px">Bucket</th><th class="num" style="font-size:9px;color:#4ade80">Follow</th><th class="num" style="font-size:9px;color:#fbbf24">Fade</th></tr></thead><tbody>';
      rows.forEach(function(row){
        t+='<tr><td style="font-size:10px;color:#e2e8f0">'+row.label+'</td>'
          +'<td class="num">'+roiTxt(row.follow)+'</td>'
          +'<td class="num">'+roiTxt(row.fade)+'</td></tr>';
      });
      return t+'</tbody></table></div>';
    }
    h+=dimTable('By Asia Line', E.byLine);
    h+=dimTable('By Line Movement', E.byLineMove);
    h+=dimTable('By HKJC H Odds Move', E.byHMove);
    h+=dimTable('By HKJC A Odds Move', E.byAMove);
    h+='</div></div>';
  });

  el.innerHTML=h;
}
