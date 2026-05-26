// ── report-oddstrend.js — Odds Trend vs Capture Time study ──
// Studies the Asian Handicap bet result against the movement (opening→latest) of
// Asia line, HKJC H odds, and HKJC A odds, sliced by how long before kickoff the
// latest odds were captured (UPDATE+UPTIME vs DATE+TIME).
// Goal: reveal whether the odds TREND predicts the result, and how capture timing changes it.

function otParseDT(ds, tv){
  if(!ds || tv==null) return null;
  var t=parseInt(tv,10); if(isNaN(t)) return null;
  var hh=Math.floor(t/100)%24, mm=(t%100)%60;
  var parts=String(ds).split('-');
  if(parts.length<3) return null;
  return new Date(+parts[0], +parts[1]-1, +parts[2], hh, mm);
}
function otGapHours(r){
  var cap=otParseDT(r.UPDATE, r.UPTIME), ko=otParseDT(r.DATE, r.TIME);
  if(!cap||!ko) return null;
  return (ko.getTime()-cap.getTime())/3600000;
}
function otGapBucket(g){
  if(g==null||g<0) return null;
  if(g<=2) return '0-2h';
  if(g<=6) return '2-6h';
  if(g<=12) return '6-12h';
  return '12h+';
}
var OT_BUCKETS=['0-2h','2-6h','6-12h','12h+'];

function otAdjM(r){ return (r.RESULTH-r.RESULTA)+parseFloat(r.ASIALINE); }
function otPnl(r,bet){
  var m=otAdjM(r);
  if(bet==='H'){ var o=r.ASIAH; return m>0.25?o-1:m===0.25?(o-1)/2:m===0?0:m===-0.25?-0.5:-1; }
  var oa=r.ASIAA; return m<-0.25?oa-1:m===-0.25?(oa-1)/2:m===0?0:m===0.25?-0.5:-1;
}
function otHCover(r){ var m=otAdjM(r); return m>0?1:m===0?0.5:0; }

function otHMove(r){ var o=r.ASIAHLN; if(!o||o<=0) return 'flat'; var rr=r.ASIAH/o; return rr<=0.97?'short':rr>=1.03?'drift':'flat'; }
function otAMove(r){ var o=r.ASIAALN; if(!o||o<=0) return 'flat'; var rr=r.ASIAA/o; return rr<=0.97?'short':rr>=1.03?'drift':'flat'; }
function otLMove(r){ var ln=r.ASIALINELN; if(ln==null) return 'flat'; var dd=parseFloat(r.ASIALINE)-ln; return dd>0.01?'up':dd<-0.01?'down':'flat'; }

function computeOddsTrend(allRecords){
  var data=allRecords.filter(function(r){
    return r.STATUS==='Result' && r.RESULTH!=null && r.ASIAH && r.ASIAA && r.ASIALINE!=null;
  });
  data.forEach(function(r){ r._otb=otGapBucket(otGapHours(r)); });

  // capture-gap distribution
  var gapDist={}; OT_BUCKETS.forEach(function(b){gapDist[b]=0;});
  var noGap=0;
  data.forEach(function(r){ if(r._otb) gapDist[r._otb]++; else noGap++; });

  function cell(rows){
    var n=rows.length; if(!n) return null;
    var bh=0,ba=0,hc=0;
    rows.forEach(function(r){ bh+=otPnl(r,'H'); ba+=otPnl(r,'A'); hc+=otHCover(r); });
    return { n:n, betH:Math.round(bh/n*1000)/10, betA:Math.round(ba/n*1000)/10, hcover:Math.round(hc/n*100) };
  }

  function buildDim(fn, order){
    return order.map(function(mv){
      var byGap={};
      OT_BUCKETS.forEach(function(b){
        var rows=data.filter(function(r){ return r._otb===b && fn(r)===mv; });
        byGap[b]=cell(rows);
      });
      // overall (all gaps) for this movement
      var allRows=data.filter(function(r){ return r._otb && fn(r)===mv; });
      return { mv:mv, byGap:byGap, all:cell(allRows) };
    });
  }

  var dimHMove=buildDim(otHMove, ['short','flat','drift']);
  var dimAMove=buildDim(otAMove, ['short','flat','drift']);
  var dimLMove=buildDim(otLMove, ['up','flat','down']);

  // Key relationships: strongest |best-bet ROI| cells with n>=25
  var key=[];
  [['H odds',dimHMove],['A odds',dimAMove],['Line',dimLMove]].forEach(function(pair){
    var dname=pair[0];
    pair[1].forEach(function(row){
      OT_BUCKETS.forEach(function(b){
        var c=row.byGap[b];
        if(c && c.n>=25){
          var bestBet=c.betH>=c.betA?'H':'A', bestRoi=Math.max(c.betH,c.betA);
          if(bestRoi>=4) key.push({dim:dname, mv:row.mv, gap:b, bet:bestBet, roi:bestRoi, n:c.n, hcover:c.hcover});
        }
      });
    });
  });
  key.sort(function(a,b){ return b.roi-a.roi; });

  return { data:data.length, gapDist:gapDist, noGap:noGap,
           dimHMove:dimHMove, dimAMove:dimAMove, dimLMove:dimLMove, key:key };
}

function renderOddsTrend(RD){
  var el=document.getElementById('tab15'); if(!el) return;
  var ot=RD.oddstrend||(RD.oddstrend=computeOddsTrend(RD.records||RD.results||[]));
  var h='';

  h+='<div class="rpt-title">⏱️ Odds Trend × Capture Time</div>';
  h+='<div class="rpt-sub">Asian Handicap bet result vs the movement (opening→latest) of Asia line, HKJC H odds, and HKJC A odds — '
    +'sliced by how many hours before kickoff the latest odds were captured. '
    +'Reveals whether the odds <b>trend</b> predicts the result, and how capture timing changes the edge.</div>';

  // ── Capture gap distribution ──
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 14px;margin-bottom:16px;font-size:11px;color:#94a3b8">';
  h+='<b style="color:#e2e8f0">Capture timing distribution</b> (latest odds before kickoff): ';
  h+=OT_BUCKETS.map(function(b){ return '<span style="font-family:var(--mono);margin-right:10px">'+b+': <b style="color:#60a5fa">'+ot.gapDist[b]+'</b></span>'; }).join('');
  h+='</div>';

  function roiC(v){ if(v==null) return '#475569'; return v>=0?'#4ade80':'#f87171'; }
  function fmtRoi(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }

  // ── Key relationships ──
  if(ot.key.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px">';
    h+='<div style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:8px">⭐ Strongest Trend→Result Relationships (best-bet ROI ≥ +4%, n ≥ 25)</div>';
    h+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>'
      +'<th>Movement</th><th>Capture Gap</th><th class="num">Best Bet</th><th class="num">ROI</th><th class="num">H-Cover%</th><th class="num">N</th></tr></thead><tbody>';
    ot.key.slice(0,18).forEach(function(k){
      var bc=k.bet==='H'?'#f87171':'#60a5fa';
      h+='<tr>'
        +'<td style="font-size:10px"><span style="color:#94a3b8">'+k.dim+':</span> <b style="color:#e2e8f0">'+k.mv+'</b></td>'
        +'<td style="font-family:var(--mono);color:#fbbf24">'+k.gap+'</td>'
        +'<td class="num"><b style="color:'+bc+'">bet '+k.bet+'</b></td>'
        +'<td class="num" style="color:#4ade80;font-weight:700;font-family:var(--mono)">+'+k.roi.toFixed(1)+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+k.hcover+'%</td>'
        +'<td class="num" style="font-family:var(--mono);color:#64748b">'+k.n+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
  }

  // ── Dimension matrices ──
  function dimTable(title, subtitle, rows){
    var t='<div style="margin-bottom:18px">';
    t+='<div class="rpt-title" style="font-size:13px;margin-bottom:2px">'+title+'</div>';
    t+='<div class="rpt-sub" style="margin-bottom:8px">'+subtitle+'</div>';
    t+='<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:10px"><thead><tr>'
      +'<th>Move</th><th>Capture Gap</th><th class="num">N</th>'
      +'<th class="num" style="color:#f87171">Bet H ROI</th>'
      +'<th class="num" style="color:#60a5fa">Bet A ROI</th>'
      +'<th class="num">H-Cover%</th><th>Edge</th></tr></thead><tbody>';
    rows.forEach(function(row){
      OT_BUCKETS.forEach(function(b,bi){
        var c=row.byGap[b];
        if(!c||c.n<25) return;
        var best=c.betH>=c.betA?'H':'A', bestRoi=Math.max(c.betH,c.betA);
        var edge=bestRoi>=4?'<b style="color:'+(best==='H'?'#f87171':'#60a5fa')+'">bet '+best+' '+(bestRoi>=0?'+':'')+bestRoi.toFixed(1)+'%</b>':'<span style="color:#475569">—</span>';
        t+='<tr>'
          +'<td style="font-weight:700;color:#e2e8f0">'+(bi===0?row.mv:'')+'</td>'
          +'<td style="font-family:var(--mono);color:#fbbf24">'+b+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#64748b">'+c.n+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:'+roiC(c.betH)+'">'+fmtRoi(c.betH)+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:'+roiC(c.betA)+'">'+fmtRoi(c.betA)+'</td>'
          +'<td class="num" style="font-family:var(--mono);color:#94a3b8">'+c.hcover+'%</td>'
          +'<td>'+edge+'</td></tr>';
      });
    });
    t+='</tbody></table></div></div>';
    return t;
  }

  h+=dimTable('📈 HKJC H Odds Movement', 'How H odds moved from opening to the captured latest price. short = H shortened (money on home), drift = H drifted (money off home).', ot.dimHMove);
  h+=dimTable('📉 HKJC A Odds Movement', 'How A odds moved from opening to latest. short = A shortened (money on away), drift = A drifted.', ot.dimAMove);
  h+=dimTable('↕️ Asia Line Movement', 'How the HKJC handicap line moved from opening to latest. up = line rose (home handicap eased), down = line dropped (home handicap strengthened).', ot.dimLMove);

  h+='<div style="font-size:9px;color:#475569;margin-top:4px">Capture gap = hours between latest-odds capture (UPDATE+UPTIME) and kickoff (DATE+TIME). short/drift threshold ±3%. Cells need n≥25 to show. H-Cover% = share of matches where the home side covered the handicap (½ credit on push).</div>';

  el.innerHTML=h;
}
