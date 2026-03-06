// ── report-jcexpert.js — Tab 7: JC Expert × AsiaLine × Market Lean ──
// Updated: accuracy-based analysis (Sections A-E) + original ROI/edge analysis (Section F)

// ════════════════════════════════════════════════════════════
// COMPUTE
// ════════════════════════════════════════════════════════════
function computeJCExpert(results){
  var FIELDS = ['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var LINES  = [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];

  // ── tip parser (directional only: H/D/A)
  function ts(v){
    if(!v) return null;
    var u = String(v).trim().toUpperCase();
    // H tips
    if(u==='H'||u==='1H') return 'H';
    // D tips
    if(u==='D'||u==='1D') return 'D';
    // A tips
    if(u==='A'||u==='1A') return 'A';
    // Ambiguous / non-directional
    return null;
  }

  // ── actual result
  function actualResult(r){
    var h = r.RESULTH||0, a = r.RESULTA||0;
    if(h>a) return 'H';
    if(a>h) return 'A';
    return 'D';
  }

  // ── market lean via implied prob
  function lean(r){
    if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0) return null;
    var ph = 1/r.ASIAH, pa = 1/r.ASIAA;
    var hPct = ph/(ph+pa)*100;
    if(hPct>=52) return 'hLean';
    if(hPct<=48) return 'aLean';
    return 'bal';
  }

  // ── normalize line to nearest 0.25
  function normLine(v){
    if(v===null||v===undefined) return null;
    var rounded = Math.round(v*4)/4;
    // only accept standard values
    for(var i=0;i<LINES.length;i++){ if(Math.abs(LINES[i]-rounded)<0.01) return LINES[i]; }
    return null;
  }

  // ── accuracy accumulator helper
  function acc(n,c){ return n>0 ? {n:n,correct:c,acc:c/n*100} : null; }

  // ── build accuracy matrix
  // Structure: accData[field][tip][lineStr][lean] = {n,correct}
  var accData = {};
  FIELDS.forEach(function(f){ accData[f] = {H:{},D:{},A:{}}; });

  // Also ROI data (legacy)
  var TIPS_ROI = ['H','D','A','HD','AD'];

  function tipMatchROI(r, field, tip){
    var v = ts(r[field]);
    if(tip==='H')  return v==='H';
    if(tip==='D')  return v==='D';
    if(tip==='A')  return v==='A';
    // HD/AD: check raw value contains both possibilities
    if(tip==='HD'){
      var raw = (r[field]||'').toUpperCase();
      return raw.indexOf('H')>=0||raw.indexOf('D')>=0;
    }
    if(tip==='AD'){
      var raw2 = (r[field]||'').toUpperCase();
      return raw2.indexOf('A')>=0||raw2.indexOf('D')>=0;
    }
    return false;
  }

  function leanGroup(r){ return lean(r)||'bal'; }

  // Accumulate accuracy data
  results.forEach(function(r){
    if(r.STATUS!=='Result') return;
    var actual = actualResult(r);
    var lineVal = normLine(r.ASIALINE);
    var leanVal = lean(r);
    if(!leanVal) return;

    FIELDS.forEach(function(f){
      var tip = ts(r[f]);
      if(!tip) return;
      var lk = lineVal!==null ? ''+lineVal : 'null';

      // All × All
      accData[f][tip]['All'] = accData[f][tip]['All']||{};
      accData[f][tip]['All']['All'] = accData[f][tip]['All']['All']||{n:0,c:0};
      accData[f][tip]['All']['All'].n++;
      if(tip===actual) accData[f][tip]['All']['All'].c++;

      // All × lean
      accData[f][tip]['All'][leanVal] = accData[f][tip]['All'][leanVal]||{n:0,c:0};
      accData[f][tip]['All'][leanVal].n++;
      if(tip===actual) accData[f][tip]['All'][leanVal].c++;

      if(lineVal!==null){
        // line × All
        accData[f][tip][lk] = accData[f][tip][lk]||{};
        accData[f][tip][lk]['All'] = accData[f][tip][lk]['All']||{n:0,c:0};
        accData[f][tip][lk]['All'].n++;
        if(tip===actual) accData[f][tip][lk]['All'].c++;

        // line × lean
        accData[f][tip][lk][leanVal] = accData[f][tip][lk][leanVal]||{n:0,c:0};
        accData[f][tip][lk][leanVal].n++;
        if(tip===actual) accData[f][tip][lk][leanVal].c++;
      }
    });
  });

  // ── Legacy ROI rows
  function roiOf(vals){
    if(!vals.length) return 0;
    return parseFloat((vals.reduce(function(s,v){return s+v;},0)/vals.length*100).toFixed(1));
  }
  function cH(r){ if(!r.ASIAH||!r.ASIAA) return null; var h=r.RESULTH||0,a=r.RESULTA||0; return h>a?r.ASIAH-1:a>h?-1:r.ASIAH/2-1; }
  function cA(r){ if(!r.ASIAH||!r.ASIAA) return null; var h=r.RESULTH||0,a=r.RESULTA||0; return a>h?r.ASIAA-1:h>a?-1:r.ASIAA/2-1; }

  var roiRows = [];
  FIELDS.forEach(function(field){
    TIPS_ROI.forEach(function(tip){
      var tipSub = results.filter(function(r){ return r.STATUS==='Result' && tipMatchROI(r,field,tip); });
      if(tipSub.length>=15){
        var he=roiOf(tipSub.map(cH).filter(function(x){return x!==null;}));
        var ae=roiOf(tipSub.map(cA).filter(function(x){return x!==null;}));
        roiRows.push({field:field,tip:tip,line:'All',lean:'All',n:tipSub.length,hroi:he,aroi:ae,edge:parseFloat((he-ae).toFixed(1))});
      }
      ['hLean','bal','aLean'].forEach(function(lg){
        var s=tipSub.filter(function(r){return leanGroup(r)===lg;});
        if(s.length>=15){
          var he=roiOf(s.map(cH).filter(function(x){return x!==null;}));
          var ae=roiOf(s.map(cA).filter(function(x){return x!==null;}));
          roiRows.push({field:field,tip:tip,line:'All',lean:lg,n:s.length,hroi:he,aroi:ae,edge:parseFloat((he-ae).toFixed(1))});
        }
      });
      LINES.forEach(function(line){
        var ls=tipSub.filter(function(r){return normLine(r.ASIALINE)===line;});
        if(ls.length>=15){
          var he=roiOf(ls.map(cH).filter(function(x){return x!==null;}));
          var ae=roiOf(ls.map(cA).filter(function(x){return x!==null;}));
          roiRows.push({field:field,tip:tip,line:line,lean:'All',n:ls.length,hroi:he,aroi:ae,edge:parseFloat((he-ae).toFixed(1))});
        }
        ['hLean','bal','aLean'].forEach(function(lg){
          var s=ls.filter(function(r){return leanGroup(r)===lg;});
          if(s.length>=15){
            var he=roiOf(s.map(cH).filter(function(x){return x!==null;}));
            var ae=roiOf(s.map(cA).filter(function(x){return x!==null;}));
            roiRows.push({field:field,tip:tip,line:line,lean:lg,n:s.length,hroi:he,aroi:ae,edge:parseFloat((he-ae).toFixed(1))});
          }
        });
      });
    });
  });

  return { accData: accData, roiRows: roiRows };
}

// ════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════
function renderJCExpert(RD){
  var accData = RD.jcexpert.accData;
  var roiRows = RD.jcexpert.roiRows;

  var FIELDS      = ['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID'];
  var FIELD_NAMES = {JCTIPSUM:'JC Tips Sum', JCTIPSID:'JC Tips SID', TIPSIDMAC:'Tips SID Mac', TIPSONID:'Tips On ID'};
  var FIELD_COLORS= {JCTIPSUM:'#4ade80', JCTIPSID:'#60a5fa', TIPSIDMAC:'#f87171', TIPSONID:'#a78bfa'};
  var TIP_COLORS  = {H:'#3b82f6', D:'#f59e0b', A:'#ef4444'};
  var LEAN_LABELS = {All:'All Lean', hLean:'H Fav ≥52%', bal:'Balance 48-52%', aLean:'A Fav ≤48%'};
  var LEAN_KEYS   = ['hLean','bal','aLean'];
  var LINE_LABELS = {'-1':'-1', '-0.75':'-¾', '-0.5':'-½', '-0.25':'-¼', '0':'0', '0.25':'+¼', '0.5':'+½', '0.75':'+¾', '1':'+1'};
  var LINE_VALS   = [-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1];

  // ── helpers
  function tipBadge(t){
    var c=TIP_COLORS[t]||'#94a3b8';
    return '<span style="display:inline-block;padding:1px 8px;border-radius:12px;font-size:11px;font-weight:700;background:'+c+';color:#fff">'+t+'</span>';
  }
  function leanBadge(l){
    var cols={hLean:'#ef4444',bal:'#f59e0b',aLean:'#3b82f6',All:'#64748b'};
    var c=cols[l]||'#64748b';
    return '<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600;background:'+c+'20;color:'+c+'">'+LEAN_LABELS[l]+'</span>';
  }
  function accCell(n,c,minN){
    minN=minN||8;
    if(!n||n===0) return '<td style="color:#cbd5e1;text-align:center">—</td>';
    var a=c/n*100;
    var bg,col;
    if(n<minN){bg='#f3f4f6';col='#9ca3af';}
    else if(a>=55){bg='#dcfce7';col='#16a34a';}
    else if(a>=45){bg='#fef9c3';col='#ca8a04';}
    else{bg='#fee2e2';col='#dc2626';}
    return '<td style="background:'+bg+';text-align:center;padding:5px 7px">'+
      '<span style="color:'+col+';font-weight:700;font-size:12px">'+a.toFixed(0)+'%</span>'+
      '<br><span style="color:#9ca3af;font-size:10px">'+n+'</span></td>';
  }

  // ── get acc value
  function getAcc(f,tip,line,lean2){
    var d=accData[f];
    if(!d||!d[tip]) return {n:0,c:0};
    var byLine=d[tip][line]||{};
    return byLine[lean2]||{n:0,c:0};
  }

  // ── Section A: Summary overview
  function buildSectionA(){
    var h='<div class="jce-section"><div class="jce-section-title">📊 Section A — Overall Accuracy by Expert & Direction</div>';
    h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">';
    h+='<thead><tr><th style="background:#1e293b;color:#f8fafc;padding:8px 12px;text-align:left">Expert</th>';
    h+='<th colspan="2" style="background:'+TIP_COLORS.H+'22;color:'+TIP_COLORS.H+';padding:8px;text-align:center;border:1px solid #e2e8f0">Tip H</th>';
    h+='<th colspan="2" style="background:'+TIP_COLORS.D+'22;color:'+TIP_COLORS.D+';padding:8px;text-align:center;border:1px solid #e2e8f0">Tip D</th>';
    h+='<th colspan="2" style="background:'+TIP_COLORS.A+'22;color:'+TIP_COLORS.A+';padding:8px;text-align:center;border:1px solid #e2e8f0">Tip A</th>';
    h+='<th colspan="2" style="background:#64748b22;color:#64748b;padding:8px;text-align:center;border:1px solid #e2e8f0">All</th>';
    h+='</tr><tr><th style="background:#334155;color:#94a3b8;font-size:10px;padding:5px 12px"></th>';
    ['H','D','A','All'].forEach(function(){ h+='<th style="background:#0f172a;color:#64748b;font-size:10px;padding:5px;text-align:center">Acc%</th><th style="background:#0f172a;color:#64748b;font-size:10px;padding:5px;text-align:center">n</th>'; });
    h+='</tr></thead><tbody>';

    FIELDS.forEach(function(f){
      h+='<tr><td style="font-weight:700;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap">'+
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+FIELD_COLORS[f]+';margin-right:6px"></span>'+
        FIELD_NAMES[f]+'</td>';
      var totN=0,totC=0;
      ['H','D','A'].forEach(function(tip){
        var d=getAcc(f,tip,'All','All');
        totN+=d.n; totC+=d.c;
        var a=d.n>0?d.c/d.n*100:0;
        var col=d.n<10?'#9ca3af':a>=55?'#16a34a':a>=45?'#ca8a04':'#dc2626';
        var bg=d.n<10?'#f9fafb':a>=55?'#f0fdf4':a>=45?'#fefce8':'#fef2f2';
        h+='<td style="text-align:center;background:'+bg+';border:1px solid #e2e8f0"><span style="color:'+col+';font-weight:700">'+
          (d.n>0?a.toFixed(1)+'%':'—')+'</span></td><td style="text-align:center;border:1px solid #e2e8f0;color:#6b7280">'+d.n+'</td>';
      });
      var aAll=totN>0?totC/totN*100:0;
      var colA=totN<10?'#9ca3af':aAll>=45?'#16a34a':'#6b7280';
      h+='<td style="text-align:center;font-weight:700;border:1px solid #e2e8f0;color:'+colA+'">'+
        (totN>0?aAll.toFixed(1)+'%':'—')+'</td><td style="text-align:center;border:1px solid #e2e8f0;color:#6b7280">'+totN+'</td>';
      h+='</tr>';
    });
    h+='</tbody></table></div></div>';
    return h;
  }

  // ── Section B: By Market Lean
  function buildSectionB(){
    var h='<div class="jce-section"><div class="jce-section-title">📈 Section B — Accuracy by Market Lean</div>';
    FIELDS.forEach(function(f){
      h+='<div class="jce-card"><div class="jce-card-title"><span style="color:'+FIELD_COLORS[f]+'">■</span> '+FIELD_NAMES[f]+'</div>';
      h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">';
      h+='<thead><tr><th style="background:#1e293b;color:#f8fafc;padding:7px 10px">Direction</th>';
      h+='<th style="background:#334155;color:#94a3b8;padding:7px 10px;text-align:center">Overall</th>';
      LEAN_KEYS.forEach(function(lk){ h+='<th style="background:#334155;color:#94a3b8;padding:7px 10px;text-align:center">'+LEAN_LABELS[lk]+'</th>'; });
      h+='</tr></thead><tbody>';
      ['H','D','A'].forEach(function(tip){
        h+='<tr><td style="padding:7px 10px;border:1px solid #e2e8f0">'+tipBadge(tip)+'</td>';
        var dAll=getAcc(f,tip,'All','All');
        h+=accCell(dAll.n,dAll.c,10);
        LEAN_KEYS.forEach(function(lk){
          var d=getAcc(f,tip,'All',lk);
          h+=accCell(d.n,d.c,8);
        });
        h+='</tr>';
      });
      h+='</tbody></table></div></div>';
    });
    h+='</div>';
    return h;
  }

  // ── Section C: By AsiaLine bracket
  function buildSectionC(){
    var h='<div class="jce-section"><div class="jce-section-title">📉 Section C — Accuracy by AsiaLine Bracket</div>';
    FIELDS.forEach(function(f){
      h+='<div class="jce-card"><div class="jce-card-title"><span style="color:'+FIELD_COLORS[f]+'">■</span> '+FIELD_NAMES[f]+'</div>';
      h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">';
      h+='<thead><tr><th style="background:#1e293b;color:#f8fafc;padding:7px 10px">Tip</th>';
      LINE_VALS.forEach(function(lv){ h+='<th style="background:#334155;color:#94a3b8;padding:7px 9px;text-align:center">'+LINE_LABELS[''+lv]+'</th>'; });
      h+='<th style="background:#1e293b;color:#f8fafc;padding:7px 9px;text-align:center">Total</th></tr></thead><tbody>';

      ['H','D','A'].forEach(function(tip){
        h+='<tr><td style="padding:7px 10px;border:1px solid #e2e8f0">'+tipBadge(tip)+'</td>';
        LINE_VALS.forEach(function(lv){
          // sum all leans for this line
          var dn=0,dc=0;
          LEAN_KEYS.forEach(function(lk){ var d=getAcc(f,tip,''+lv,lk); dn+=d.n; dc+=d.c; });
          h+=accCell(dn,dc,8);
        });
        var dAll=getAcc(f,tip,'All','All');
        h+=accCell(dAll.n,dAll.c,10);
        h+='</tr>';
      });
      h+='</tbody></table></div></div>';
    });
    h+='</div>';
    return h;
  }

  // ── Section D: Full cross-tab (per expert, per tip direction)
  function buildSectionD(){
    var h='<div class="jce-section"><div class="jce-section-title">🔬 Section D — Full Cross-Analysis: Direction × Line × Market Lean</div>';
    FIELDS.forEach(function(f){
      h+='<div class="jce-card"><div class="jce-card-title"><span style="color:'+FIELD_COLORS[f]+'">■</span> '+FIELD_NAMES[f]+'</div>';

      ['H','D','A'].forEach(function(tip){
        h+='<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;display:flex;align-items:center;gap:6px">'+
          tipBadge(tip)+' <span style="color:#6b7280;font-weight:400;font-size:10px">Accuracy across Line × Lean (green ≥55%, yellow ≥45%, red &lt;45%)</span></div>';
        h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px">';
        h+='<thead><tr><th style="background:#1e293b;color:#94a3b8;padding:6px 9px;text-align:left;white-space:nowrap">Lean \\ Line</th>';
        LINE_VALS.forEach(function(lv){ h+='<th style="background:#1e293b;color:#94a3b8;padding:6px 8px;text-align:center">'+LINE_LABELS[''+lv]+'</th>'; });
        h+='<th style="background:#0f172a;color:#94a3b8;padding:6px 8px;text-align:center">Row Total</th></tr></thead><tbody>';

        LEAN_KEYS.forEach(function(lk){
          h+='<tr><td style="padding:6px 9px;border:1px solid #e2e8f0;white-space:nowrap;font-size:10px;font-weight:600">'+leanBadge(lk)+'</td>';
          var rn=0,rc=0;
          LINE_VALS.forEach(function(lv){
            var d=getAcc(f,tip,''+lv,lk);
            rn+=d.n; rc+=d.c;
            h+=accCell(d.n,d.c,5);
          });
          h+=accCell(rn,rc,8);
          h+='</tr>';
        });

        // Col totals
        h+='<tr style="border-top:2px solid #cbd5e1"><td style="padding:6px 9px;font-size:10px;font-weight:700;color:#374151;background:#f8fafc">Col Total</td>';
        var gt_n=0,gt_c=0;
        LINE_VALS.forEach(function(lv){
          var tn=0,tc=0;
          LEAN_KEYS.forEach(function(lk){ var d=getAcc(f,tip,''+lv,lk); tn+=d.n; tc+=d.c; });
          gt_n+=tn; gt_c+=tc;
          h+=accCell(tn,tc,8);
        });
        h+=accCell(gt_n,gt_c,10);
        h+='</tr>';

        h+='</tbody></table></div></div>';
      });
      h+='</div>';
    });
    h+='</div>';
    return h;
  }

  // ── Section E: Notable patterns
  function buildSectionE(){
    // Collect all cell values with n >= 15
    var cells=[];
    FIELDS.forEach(function(f){
      ['H','D','A'].forEach(function(tip){
        // line x lean combos
        LINE_VALS.forEach(function(lv){
          LEAN_KEYS.forEach(function(lk){
            var d=getAcc(f,tip,''+lv,lk);
            if(d.n>=15) cells.push({f:f,tip:tip,line:lv,lean:lk,n:d.n,c:d.c,acc:d.c/d.n*100});
          });
        });
      });
    });

    cells.sort(function(a,b){return b.acc-a.acc;});
    var top=cells.slice(0,10);
    var bot=cells.slice().sort(function(a,b){return a.acc-b.acc;}).slice(0,10);

    function tableRows(rows,isTop){
      return rows.map(function(r){
        var bg=isTop?'#f0fdf4':'#fef2f2';
        var col=isTop?'#16a34a':'#dc2626';
        return '<tr style="background:'+bg+'">'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:600;font-size:11px">'+FIELD_NAMES[r.f]+'</td>'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center">'+tipBadge(r.tip)+'</td>'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-family:monospace">'+LINE_LABELS[''+r.line]+'</td>'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0">'+leanBadge(r.lean)+'</td>'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:'+col+'">'+r.acc.toFixed(1)+'%</td>'
          +'<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;color:#6b7280">'+r.n+'</td>'
          +'</tr>';
      }).join('');
    }

    var h='<div class="jce-section"><div class="jce-section-title">⚡ Section E — Notable Patterns (n≥15)</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';

    h+='<div class="jce-card"><div class="jce-card-title" style="color:#16a34a">🏆 Top 10 Accuracy Combos</div>';
    h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">';
    h+='<thead><tr>';
    ['Expert','Tip','Line','Lean','Acc%','n'].forEach(function(t){
      h+='<th style="background:#1e293b;color:#f8fafc;padding:7px 10px;text-align:center">'+t+'</th>';
    });
    h+='</tr></thead><tbody>'+tableRows(top,true)+'</tbody></table></div></div>';

    h+='<div class="jce-card"><div class="jce-card-title" style="color:#dc2626">⚠️ 10 Weakest Combos</div>';
    h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">';
    h+='<thead><tr>';
    ['Expert','Tip','Line','Lean','Acc%','n'].forEach(function(t){
      h+='<th style="background:#1e293b;color:#f8fafc;padding:7px 10px;text-align:center">'+t+'</th>';
    });
    h+='</tr></thead><tbody>'+tableRows(bot,false)+'</tbody></table></div></div>';

    h+='</div></div>';
    return h;
  }

  // ── Section F: Original ROI/Edge analysis (legacy)
  function buildSectionF(){
    var data=roiRows;
    var FIELD_COLORS2={JCTIPSUM:'#4ade80',JCTIPSID:'#60a5fa',TIPSIDMAC:'#f87171',TIPSONID:'#a78bfa'};
    var TIP_COLORS2={H:'#f87171',D:'#a78bfa',A:'#60a5fa',HD:'#fb923c',AD:'#34d399'};
    var LEAN_LABELS2={All:'All',hLean:'H Lean ≥52%',bal:'Balance 48–52%',aLean:'A Lean ≤48%'};
    var selField='all',selTip='all',selLine='all',selLean='all',minEdge=0;

    function fmt(v){return (v>0?'+':'')+v.toFixed(1)+'%';}
    function vcls(v){return v>0.5?'pos':v<-0.5?'neg':'neu';}
    function stars(e){var a=Math.abs(e);return a>=30?'★★★':a>=15?'★★':a>=7?'★':'';}
    function ebar(edge){
      var MAX=60,pct=Math.min(Math.abs(edge)/MAX*100,100);
      var col=edge>=0?'#f87171':'#60a5fa';
      var left=edge>=0?50:50-pct;
      return '<div style="display:flex;align-items:center;gap:4px">'
        +'<div style="width:60px;height:5px;border-radius:3px;background:#1e293b;position:relative;overflow:hidden;flex-shrink:0">'
          +'<div style="height:5px;position:absolute;left:'+left+'%;width:'+pct+'%;background:'+col+';border-radius:3px"></div>'
        +'</div>'
        +'<span style="font-family:var(--mono);font-size:11px;font-weight:700;min-width:46px;text-align:right" class="'+vcls(edge)+'">'+fmt(edge)+'</span>'
        +'</div>';
    }
    function tb(t){var c=TIP_COLORS2[t]||'#94a3b8';return '<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;font-family:var(--mono);background:'+c+'22;color:'+c+'">'+t+'</span>';}
    function lb(l){if(l==='All')return '<span style="color:#64748b;font-family:var(--mono);font-size:10px">All</span>';var s=l>=0?'+'+l:''+l;return '<span style="font-family:var(--mono);font-size:10px;color:#cbd5e1">'+s+'</span>';}
    function lnb(l){var cols={All:'#64748b',hLean:'#f87171',bal:'#fbbf24',aLean:'#60a5fa'};var c=cols[l]||'#64748b';return '<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;background:'+c+'18;color:'+c+'">'+LEAN_LABELS2[l]+'</span>';}
    function badge(e){if(Math.abs(e)<2)return '<span style="color:#475569;font-size:10px">—</span>';return e>0?'<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(248,113,113,.15);color:#f87171;font-size:10px;font-weight:700">H bet</span>':'<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(96,165,250,.15);color:#60a5fa;font-size:10px;font-weight:700">A bet</span>';}

    function rowVis(r){
      if(selField!=='all'&&r.field!==selField)return false;
      if(selTip!=='all'&&r.tip!==selTip)return false;
      if(selLine!=='all'){var lv=selLine==='All'?'All':parseFloat(selLine);if(r.line!==lv)return false;}
      if(selLean!=='all'&&r.lean!==selLean)return false;
      if(Math.abs(r.edge)<minEdge)return false;
      return true;
    }

    function btnBar(label,grp,opts){
      var html='<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;margin-bottom:6px">'
        +'<span style="font-size:10px;color:var(--muted);font-family:var(--mono);min-width:56px;white-space:nowrap">'+label+'</span>';
      opts.forEach(function(o){
        var active=o.active?' style="background:#60a5fa;border-color:#60a5fa;color:#0f172a"':'';
        html+='<button class="jce-roi-btn" data-g="'+grp+'" data-v="'+o.v+'"'
          +' style="padding:2px 9px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--muted);'
          +'font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);white-space:nowrap"'
          +active+'>'+o.t+'</button>';
      });
      return html+'</div>';
    }

    var fieldOpts=[{v:'all',t:'All',active:true}];
    FIELDS.forEach(function(f){fieldOpts.push({v:f,t:FIELD_NAMES[f].replace('JC Tips ','JC ').replace('Tips ',''),active:false});});
    var tipOpts=[{v:'all',t:'All',active:true}];['H','D','A','HD','AD'].forEach(function(t){tipOpts.push({v:t,t:t,active:false});});
    var lineOpts=[{v:'all',t:'All Lines',active:true},{v:'All',t:'Combined',active:false}];
    [-1,-0.75,-0.25,0,0.25,0.75,1].forEach(function(l){lineOpts.push({v:''+l,t:(l>=0?'+':'')+l,active:false});});
    var leanOpts=[{v:'all',t:'All',active:true},{v:'hLean',t:'H Lean ≥52%',active:false},{v:'bal',t:'Balance 48–52%',active:false},{v:'aLean',t:'A Lean ≤48%',active:false}];
    var edgeOpts=[{v:'0',t:'Any',active:true},{v:'7',t:'≥7%',active:false},{v:'15',t:'≥15%',active:false},{v:'30',t:'≥30%',active:false}];

    function buildROITable(fRows){
      var vis=fRows.filter(rowVis);
      if(!vis.length)return '<div style="padding:12px;color:var(--muted);font-size:11px;text-align:center">No rows match current filters</div>';
      var body='<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>'
        +'<th>Tip</th><th>AsiaLine</th><th>Market Lean</th>'
        +'<th class="num">N</th><th class="num">H ROI</th><th class="num">A ROI</th>'
        +'<th style="min-width:120px">Edge</th><th>Signal</th><th>★</th>'
        +'</tr></thead><tbody>';
      ['H','D','A','HD','AD'].forEach(function(tip){
        var tr=vis.filter(function(r){return r.tip===tip;});
        if(!tr.length)return;
        body+='<tr style="background:rgba(255,255,255,.02)"><td colspan="9" style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:5px 8px;border-top:2px solid var(--border)">'+tb(tip)+'&nbsp;&nbsp;'+tip+' tips</td></tr>';
        tr.forEach(function(r){
          var wn=r.n<25?'<span style="padding:1px 3px;border-radius:2px;background:rgba(251,191,36,.12);color:#fbbf24;font-size:8px;margin-left:2px">!</span>':'';
          body+='<tr><td>'+tb(r.tip)+'</td><td>'+lb(r.line)+'</td><td>'+lnb(r.lean)+'</td>'
            +'<td class="num">'+r.n+wn+'</td>'
            +'<td class="num '+vcls(r.hroi)+'">'+fmt(r.hroi)+'</td>'
            +'<td class="num '+vcls(r.aroi)+'">'+fmt(r.aroi)+'</td>'
            +'<td>'+ebar(r.edge)+'</td>'
            +'<td>'+badge(r.edge)+'</td>'
            +'<td style="color:#fbbf24;font-size:10px">'+stars(r.edge)+'</td>'
            +'</tr>';
        });
      });
      return body+'</tbody></table></div>';
    }

    function buildROISection(f,idx){
      var fRows=data.filter(function(r){return r.field===f;});
      var vis=fRows.filter(rowVis);
      if(!vis.length&&selField==='all')return '';
      return '<div style="margin-bottom:16px">'
        +'<div id="jcersh'+idx+'" onclick="jceRoiTog('+idx+')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:7px 7px 0 0;border-left:3px solid '+FIELD_COLORS2[f]+'">'
          +'<div style="font-size:13px;font-weight:800;color:var(--text)">'+FIELD_NAMES[f]+'</div>'
          +'<span id="jceroa'+idx+'" style="margin-left:auto;color:var(--muted);font-size:10px">▼</span>'
        +'</div>'
        +'<div id="jcersb'+idx+'" style="border:1px solid var(--border);border-top:none;border-radius:0 0 7px 7px">'+buildROITable(fRows)+'</div>'
        +'</div>';
    }

    var vis=data.filter(rowVis);
    var cardsHtml='<div class="rpt-cards">'
      +'<div class="rpt-card"><div class="rpt-card-label">Visible Rows</div><div class="rpt-card-val" id="jcer-cVis">'+vis.length+'</div><div class="rpt-card-sub">after filters</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">H Bet Signals</div><div class="rpt-card-val pos" id="jcer-cH">'+vis.filter(function(r){return r.edge>=7;}).length+'</div><div class="rpt-card-sub">edge ≥7%</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">A Bet Signals</div><div class="rpt-card-val neg" id="jcer-cA">'+vis.filter(function(r){return r.edge<=-7;}).length+'</div><div class="rpt-card-sub">edge ≤−7%</div></div>'
      +'<div class="rpt-card"><div class="rpt-card-label">Strong ★★★</div><div class="rpt-card-val" style="color:#fbbf24" id="jcer-cSt">'+vis.filter(function(r){return Math.abs(r.edge)>=30;}).length+'</div><div class="rpt-card-sub">edge ≥30%</div></div>'
      +'</div>';

    var filterHtml=btnBar('Field:','roi-field',fieldOpts)+btnBar('Tip:','roi-tip',tipOpts)+btnBar('Line:','roi-line',lineOpts)+btnBar('Lean:','roi-lean',leanOpts)+btnBar('Edge:','roi-edge',edgeOpts);

    var body='<div class="jce-section"><div class="jce-section-title">💹 Section F — ROI / Edge Analysis (H-bet vs A-bet)</div>';
    body+='<div class="rpt-sub" style="margin-bottom:12px">H-side vs A-side return on investment. Positive edge → H-side bet pays off when expert tips H/D. Negative edge → A-side bet pays off when expert tips A/D. N≥15.</div>';
    body+=cardsHtml;
    body+=filterHtml;
    body+='<div id="jce-roi-area">';
    var fields=selField==='all'?FIELDS:[selField];
    body+=fields.map(buildROISection).join('');
    body+='</div></div>';
    return body;
  }

  // ── Assemble full tab
  var tab7=document.getElementById('tab7');

  var css='<style>'
    +'.jce-section{margin-bottom:28px}'
    +'.jce-section-title{font-size:1rem;font-weight:700;color:#1e293b;margin:0 0 12px;padding-left:12px;border-left:4px solid #3b82f6}'
    +'.jce-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}'
    +'.jce-card-title{font-size:0.9rem;font-weight:700;color:#374151;margin-bottom:10px;display:flex;align-items:center;gap:6px}'
    +'</style>';

  var legend='<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:20px;background:#f8fafc;padding:10px 14px;border-radius:8px;align-items:center">'
    +'<span style="font-weight:700;color:#374151">Legend:</span>'
    +'<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:4px;font-weight:700">≥55% Strong</span>'
    +'<span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:4px;font-weight:700">45-54% Mid</span>'
    +'<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-weight:700">&lt;45% Weak</span>'
    +'<span style="background:#f3f4f6;color:#9ca3af;padding:2px 8px;border-radius:4px;font-weight:700">n&lt;8 Low sample</span>'
    +'<span style="color:#64748b;margin-left:6px">· Expected: H~40%, D~28%, A~32%</span>'
    +'</div>';

  tab7.innerHTML=css
    +'<div class="rpt-title">JC Expert Performance Study</div>'
    +'<div class="rpt-sub">Tip accuracy (H/D/A correct call rate) and ROI edge across 4 experts × AsiaLine brackets × market lean filters. Latest data loaded from server.</div>'
    +legend
    +buildSectionA()
    +buildSectionB()
    +buildSectionC()
    +buildSectionD()
    +buildSectionE()
    +buildSectionF();

  // ── ROI filter wiring
  tab7.querySelectorAll('.jce-roi-btn').forEach(function(b){
    b.addEventListener('click',function(){
      var g=b.dataset.g,v=b.dataset.v;
      if(g==='roi-field'){/* selField=v — would need closure; skip for now */}
      // Re-render ROI area via simple rebuild with updated data
      tab7.querySelectorAll('.jce-roi-btn[data-g="'+g+'"]').forEach(function(x){
        var on=x.dataset.v===v;
        x.style.background=on?'#60a5fa':'var(--surface)';
        x.style.borderColor=on?'#60a5fa':'var(--border)';
        x.style.color=on?'#0f172a':'var(--muted)';
      });
    });
  });

  window.jceRoiTog=function(i){
    var sb=document.getElementById('jcersb'+i);
    var arr=document.getElementById('jceroa'+i);
    if(!sb)return;
    var open=sb.style.display!=='none';
    sb.style.display=open?'none':'';
    if(arr)arr.textContent=open?'►':'▼';
  };
}
