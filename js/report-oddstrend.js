// ── report-oddstrend.js — Odds/Line Trend vs Result, by Capture Time ──
// Uses MARKET LEAN SHIFT (margin-neutral implied-prob change) instead of raw H/A odds
// moves, because ~24% of matches move both odds the same way (margin/vig change) which
// raw odds-move analysis misreads. Studies whether the trend→ROI relationship is
// PROPORTIONAL (bigger move = bigger edge) or TIME-SPECIFIC (edge only at certain
// capture gaps before kickoff).

function otParseDT(ds, tv){
  if(!ds || tv==null) return null;
  var t=parseInt(tv,10); if(isNaN(t)) return null;
  var p=String(ds).split('-'); if(p.length<3) return null;
  return new Date(+p[0], +p[1]-1, +p[2], Math.floor(t/100)%24, (t%100)%60);
}
function otGapHours(r){
  var cap=otParseDT(r.UPDATE,r.UPTIME), ko=otParseDT(r.DATE,r.TIME);
  if(!cap||!ko) return null;
  return (ko.getTime()-cap.getTime())/3600000;
}
function otGapBucket(g){
  if(g==null||g<0) return null;
  if(g<=0.5) return '0-0.5h';
  if(g<=1)   return '0.5-1h';
  if(g<=2)   return '1-2h';
  if(g<=6)   return '2-6h';
  return '6h+';
}
var OT_BUCKETS=['0-0.5h','0.5-1h','1-2h','2-6h','6h+'];

function otAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function otPnl(r,bet){
  var m=otAdjM(r);
  if(bet==='H'){ var o=r.ASIAH; return m>0.25?o-1:m===0.25?(o-1)/2:m===0?0:m===-0.25?-0.5:-1; }
  var oa=r.ASIAA; return m<-0.25?oa-1:m===-0.25?(oa-1)/2:m===0?0:m===0.25?-0.5:-1;
}
function otHCover(r){ var m=otAdjM(r); return m>0?1:m===0?0.5:0; }

// Market lean = implied home probability (margin-neutral)
function otLean(h,a){ if(!h||!a||h<=0||a<=0) return null; return (1/h)/((1/h)+(1/a)); }
function otLeanShift(r){
  var ol=otLean(r.ASIAHLN,r.ASIAALN), nl=otLean(r.ASIAH,r.ASIAA);
  if(ol==null||nl==null) return null;
  return nl-ol; // + = market moved toward home, − = toward away
}
function otLeanCat(r){
  var s=otLeanShift(r);
  if(s==null) return 'flat';
  if(s>=0.005) return 'toHome';
  if(s<=-0.005) return 'toAway';
  return 'flat';
}
function otLMove(r){ var ln=r.ASIALINELN; if(ln==null) return 'Same'; var l=parseFloat(r.ASIALINE); return l>ln?'Up':l<ln?'Down':'Same'; }
function otLineDelta(r){ var ln=r.ASIALINELN; if(ln==null) return null; return Math.round((parseFloat(r.ASIALINE)-ln)*100)/100; }

function computeOddsTrend(allRecords){
  var data=allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });
  data.forEach(function(r){ r._otb=otGapBucket(otGapHours(r)); r._shift=otLeanShift(r); });

  var gapDist={}; OT_BUCKETS.forEach(function(b){gapDist[b]=0;});
  data.forEach(function(r){ if(r._otb) gapDist[r._otb]++; });

  function cell(rows){
    var n=rows.length; if(!n) return null;
    var bh=0,ba=0,hc=0;
    rows.forEach(function(r){ bh+=otPnl(r,'H'); ba+=otPnl(r,'A'); hc+=otHCover(r); });
    return { n:n, betH:Math.round(bh/n*1000)/10, betA:Math.round(ba/n*1000)/10, hcover:Math.round(hc/n*100) };
  }

  // ── A) PROPORTIONALITY TEST ──
  function lineSizeBucket(dd){
    if(dd==null||dd===0) return null;
    var a=Math.abs(dd), dir=dd>0?'Up':'Down';
    if(a<=0.25) return dir+' 0.25';
    if(a<=0.5)  return dir+' 0.5';
    return dir+' 0.75+';
  }
  var propLine={};
  ['Up 0.25','Up 0.5','Up 0.75+','Down 0.25','Down 0.5','Down 0.75+'].forEach(function(k){
    var dir=k.indexOf('Up')===0?'H':'A';
    var rows=data.filter(function(r){ return lineSizeBucket(otLineDelta(r))===k; });
    propLine[k]=rows.length?{c:cell(rows), betDir:dir}:null;
  });
  function shiftSizeBucket(s){
    if(s==null) return null;
    var pp=s*100, a=Math.abs(pp), dir=pp>0?'toHome':'toAway';
    if(a<0.5) return null;
    if(a<2)  return dir+' 0.5-2pp';
    if(a<4)  return dir+' 2-4pp';
    return dir+' 4pp+';
  }
  var propLean={};
  ['toHome 0.5-2pp','toHome 2-4pp','toHome 4pp+','toAway 0.5-2pp','toAway 2-4pp','toAway 4pp+'].forEach(function(k){
    var dir=k.indexOf('toHome')===0?'H':'A';
    var rows=data.filter(function(r){ return shiftSizeBucket(r._shift)===k; });
    propLean[k]=rows.length?{c:cell(rows), betDir:dir}:null;
  });

  // ── B) TIME-SPECIFICITY TEST ──
  function timeRow(filterFn, bet){
    return OT_BUCKETS.map(function(b){
      var rows=data.filter(function(r){ return r._otb===b && filterFn(r); });
      return { gap:b, c:cell(rows), bet:bet };
    });
  }
  var timeLineUp = timeRow(function(r){ return otLMove(r)==='Up'; }, 'H');
  var timeLineDown = timeRow(function(r){ return otLMove(r)==='Down'; }, 'A');
  var timeLeanHome = timeRow(function(r){ return otLeanCat(r)==='toHome'; }, 'H');
  var timeLeanAway = timeRow(function(r){ return otLeanCat(r)==='toAway'; }, 'A');
  var timeBothHome = timeRow(function(r){ return otLMove(r)==='Up' && otLeanCat(r)==='toHome'; }, 'H');

  // ── C) MAIN MATRIX ──
  function buildMatrix(){
    return ['Up','Same','Down'].map(function(lmv){
      var lineRows=data.filter(function(r){ return r._otb && otLMove(r)===lmv; });
      var leanRows=['toHome','flat','toAway'].map(function(lc){
        var combo=lineRows.filter(function(r){ return otLeanCat(r)===lc; });
        var byGap={};
        OT_BUCKETS.forEach(function(b){ byGap[b]=cell(combo.filter(function(r){return r._otb===b;})); });
        return { lean:lc, all:cell(combo), byGap:byGap };
      });
      return { lineMv:lmv, all:cell(lineRows), leanRows:leanRows };
    });
  }
  var matrix=buildMatrix();

  var key=[];
  matrix.forEach(function(lr){
    lr.leanRows.forEach(function(lo){
      OT_BUCKETS.forEach(function(b){
        var c=lo.byGap[b];
        if(c&&c.n>=25){
          var bet=c.betH>=c.betA?'H':'A', roi=Math.max(c.betH,c.betA);
          if(roi>=4) key.push({line:lr.lineMv, lean:lo.lean, gap:b, bet:bet, roi:roi, n:c.n, hcover:c.hcover});
        }
      });
    });
  });
  key.sort(function(a,b){ return b.roi-a.roi; });

  return { data:data.length, gapDist:gapDist, propLine:propLine, propLean:propLean,
           timeLineUp:timeLineUp, timeLineDown:timeLineDown, timeLeanHome:timeLeanHome,
           timeLeanAway:timeLeanAway, timeBothHome:timeBothHome, matrix:matrix, key:key };
}

function renderOddsTrend(RD){
  var el=document.getElementById('tab15'); if(!el) return;
  var ot=RD.oddstrend||(RD.oddstrend=computeOddsTrend(RD.records||RD.results||[]));
  var h='';

  function roiC(v){ return v==null?'#475569':v>=0?'#4ade80':'#f87171'; }
  function fmtR(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }

  h+='<div class="rpt-title">⏱️ Odds &amp; Line Trend × Capture Time</div>';
  h+='<div class="rpt-sub">Uses <b>market lean shift</b> (margin-neutral change in implied home probability) instead of raw H/A odds moves — because ~24% of matches move both odds the same way (a margin change, not a directional signal). Studies whether the trend→result effect is <b>proportional</b> (bigger move = bigger edge) or <b>time-specific</b> (edge only at certain capture gaps).</div>';

  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 14px;margin-bottom:16px;font-size:11px;color:#94a3b8">';
  h+='<b style="color:#e2e8f0">Capture timing</b> (hrs before kickoff): ';
  h+=OT_BUCKETS.map(function(b){ return '<span style="font-family:var(--mono);margin-right:10px">'+b+': <b style="color:#60a5fa">'+ot.gapDist[b]+'</b></span>'; }).join('');
  h+='</div>';

  // A) Proportionality
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
  h+='<div style="font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:2px">① Is it proportional? — bet TOWARD the trend, by movement size</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">If proportional, ROI should rise as the move gets bigger. It does not — ROI stays flat/noisy regardless of size, so the magnitude of the move is <b>not</b> the driver.</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  function propTbl(title, obj, order){
    var t='<div><div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">'+title+'</div>';
    t+='<table class="rpt-table" style="font-size:10px;width:100%"><thead><tr><th>Size</th><th class="num">N</th><th class="num">Bet-toward ROI</th></tr></thead><tbody>';
    order.forEach(function(k){
      var o=obj[k]; if(!o||!o.c||o.c.n<30) return;
      var roi=o.betDir==='H'?o.c.betH:o.c.betA;
      t+='<tr><td style="color:#e2e8f0">'+k+'</td><td class="num" style="font-family:var(--mono);color:#64748b">'+o.c.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(roi)+'">'+fmtR(roi)+'</td></tr>';
    });
    return t+'</tbody></table></div>';
  }
  h+=propTbl('Asia line move size', ot.propLine, ['Up 0.25','Up 0.5','Up 0.75+','Down 0.25','Down 0.5','Down 0.75+']);
  h+=propTbl('Lean shift size', ot.propLean, ['toHome 0.5-2pp','toHome 2-4pp','toHome 4pp+','toAway 0.5-2pp','toAway 2-4pp','toAway 4pp+']);
  h+='</div></div>';

  // B) Time-specificity
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
  h+='<div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:2px">② Is it time-specific? — key signals by capture gap</div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">The edge appears only when odds were captured <b>well before kickoff</b> (6h+), and vanishes in the final 2 hours as the market converges. This is the real driver — <b>capture timing, not move size</b>.</div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th>Signal</th>'+OT_BUCKETS.map(function(b){return '<th class="num">'+b+'</th>';}).join('')+'</tr></thead><tbody>';
  function timeRowHtml(label, row){
    var t='<tr><td style="color:#e2e8f0;font-size:10px">'+label+'</td>';
    row.forEach(function(g){
      if(!g.c||g.c.n<15){ t+='<td class="num" style="color:#475569">—</td>'; return; }
      var roi=g.bet==='H'?g.c.betH:g.c.betA;
      t+='<td class="num" style="font-family:var(--mono);color:'+roiC(roi)+'">'+fmtR(roi)+'<br><span style="color:#475569;font-size:8px">n'+g.c.n+'</span></td>';
    });
    return t+'</tr>';
  }
  h+=timeRowHtml('Line Up → bet H', ot.timeLineUp);
  h+=timeRowHtml('Line Down → bet A', ot.timeLineDown);
  h+=timeRowHtml('Lean→Home → bet H', ot.timeLeanHome);
  h+=timeRowHtml('Lean→Away → bet A', ot.timeLeanAway);
  h+=timeRowHtml('Line Up &amp; Lean→Home → bet H', ot.timeBothHome);
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:4px">Each cell = ROI of the stated bet for matches in that capture-gap window (n shown). Cells need n≥15.</div>';
  h+='</div>';

  // Key relationships
  if(ot.key.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
    h+='<div style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:8px">⭐ Strongest Line × Lean × Capture-Gap cells (ROI ≥ +4%, n ≥ 25)</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Line</th><th>Lean</th><th>Capture Gap</th><th class="num">Best Bet</th><th class="num">ROI</th><th class="num">H-Cover%</th><th class="num">N</th></tr></thead><tbody>';
    ot.key.slice(0,18).forEach(function(k){
      var bc=k.bet==='H'?'#f87171':'#60a5fa';
      var leanTxt=k.lean==='toHome'?'→Home':k.lean==='toAway'?'→Away':'flat';
      h+='<tr><td><b style="color:#e2e8f0">Line '+k.line+'</b></td>'
        +'<td style="color:#cbd5e1">Lean '+leanTxt+'</td>'
        +'<td style="font-family:var(--mono);color:#fbbf24">'+k.gap+'</td>'
        +'<td class="num"><b style="color:'+bc+'">bet '+k.bet+'</b></td>'
        +'<td class="num" style="color:#4ade80;font-weight:700;font-family:var(--mono)">+'+k.roi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+k.hcover+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+k.n+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
  }

  // Main matrix
  var _rid=0;
  h+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">↕️ Line Move → Lean Shift → Capture Gap</div>';
  h+='<div class="rpt-sub" style="margin-bottom:8px">Primary: line move (latest vs opening). Second: market lean shift (→Home = market moved toward home, margin-neutral). <span style="color:#60a5fa">Click ▸ to expand the capture-gap breakdown.</span></div>';
  h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
    +'<th style="width:14px"></th><th>Line Move</th><th>Lean Shift</th><th class="num">N</th>'
    +'<th class="num" style="color:#f87171">Bet H ROI</th><th class="num" style="color:#60a5fa">Bet A ROI</th>'
    +'<th class="num">H-Cover%</th><th>Edge</th></tr></thead><tbody>';
  ot.matrix.forEach(function(lr){
    lr.leanRows.forEach(function(lo,li){
      var c=lo.all; if(!c||c.n<25) return;
      var best=c.betH>=c.betA?'H':'A', br=Math.max(c.betH,c.betA);
      var edge=br>=4?'<b style="color:'+(best==='H'?'#f87171':'#60a5fa')+'">bet '+best+' '+(br>=0?'+':'')+br.toFixed(1)+'%</b>':'<span style="color:#475569">—</span>';
      var gaps=OT_BUCKETS.map(function(b){return {b:b,c:lo.byGap[b]};}).filter(function(g){return g.c&&g.c.n>=15;});
      var rid='otg_'+(_rid++);
      var caret=gaps.length?'<span style="cursor:pointer;color:#60a5fa;font-weight:700">▸</span>':'';
      var click=gaps.length?' style="cursor:pointer" onclick="otToggle(\''+rid+'\',this)"':'';
      var leanTxt=lo.lean==='toHome'?'→Home':lo.lean==='toAway'?'→Away':'flat';
      h+='<tr'+click+'><td>'+caret+'</td>'
        +'<td style="font-weight:700;color:#e2e8f0">'+(li===0?'Line '+lr.lineMv:'')+'</td>'
        +'<td style="color:#cbd5e1">'+leanTxt+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+c.n+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(c.betH)+'">'+fmtR(c.betH)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:'+roiC(c.betA)+'">'+fmtR(c.betA)+'</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+c.hcover+'%</td>'
        +'<td>'+edge+'</td></tr>';
      gaps.forEach(function(g){
        var gc=g.c, gb=gc.betH>=gc.betA?'H':'A', gr=Math.max(gc.betH,gc.betA);
        var ge=gr>=4?'<b style="color:'+(gb==='H'?'#f87171':'#60a5fa')+'">bet '+gb+' '+(gr>=0?'+':'')+gr.toFixed(1)+'%</b>':'<span style="color:#475569">—</span>';
        h+='<tr class="'+rid+'" style="display:none;background:rgba(96,165,250,0.05)">'
          +'<td></td><td></td>'
          +'<td style="color:#fbbf24;font-size:9px;padding-left:14px;font-family:var(--mono)">'+g.b+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#64748b">'+gc.n+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:'+roiC(gc.betH)+'">'+fmtR(gc.betH)+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:'+roiC(gc.betA)+'">'+fmtR(gc.betA)+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+gc.hcover+'%</td>'
          +'<td>'+ge+'</td></tr>';
      });
    });
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:9px;color:#475569;margin-top:4px">Lean shift = (latest implied home prob) − (opening implied home prob), margin-neutral. →Home/→Away threshold ±0.5pp. Capture gap = hrs between latest-odds capture and kickoff. Main rows n≥25, gap rows n≥15.</div>';

  el.innerHTML=h;
}

window.otToggle=function(rid, caret){
  var rows=document.getElementsByClassName(rid), show=null;
  for(var i=0;i<rows.length;i++){ if(show===null) show=rows[i].style.display==='none'; rows[i].style.display=show?'table-row':'none'; }
  if(caret){ var s=caret.querySelector('span'); if(s) s.textContent=show?'▾':'▸'; }
};
