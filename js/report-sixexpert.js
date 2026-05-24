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

function computeSixExpert(results){
  var data=results.filter(function(r){
    return r.STATUS==='Result' && r.ASIALINE!=null && r.ASIAH && r.ASIAA && r.RESULTH!=null;
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

  return { experts:experts, pockets:pockets, totalData:data.length,
           hasAI: data.some(function(r){return seTipDir(r.TIPSGEM)||seTipDir(r.TIPSGPT);}) };
}

function renderSixExpert(RD){
  var el=document.getElementById('tab8'); if(!el) return;
  var se=RD.sixexpert||(RD.sixexpert=computeSixExpert(RD.results||RD.records||[]));
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
