// 💀 indicator: HKJC offers the best (highest) price on a side vs both Macau & SBO.
// Per the Book Compare study, the best-priced side tends to UNDERperform — i.e. fade it.
// Requires Macau & SBO present and all three lines equal (valid comparison).
// Head-to-head (H2H) strip: Recent meetings + past-1-year meetings between the
// two teams, from the HOME team's perspective (H = home team won, D = draw, A = away won).
// Rendered as count chips + a proportional segment bar in the standard H/D/A colours.
// Rows with no data are hidden entirely.
// Compact single-line H2H for the desktop Match cell: Rec 4-3-1 · 1Yr 1-1-1
// Numbers coloured by side (H red / D green / A blue). Hidden when no data.
// AI vote-count cell: Gem + GPT as two mini segmented bars (H red / D green / A blue)
// with the counts printed on the segments — same style as the H2H bars.
// 3-month team form (W-D-L) as a tiny inline segmented bar.
// Uses the SAME colour language as all other bars on the page: W red / D green / L blue.
function formBarInline(w,d,l){
  w=w||0; d=d||0; l=l||0;
  var tot=w+d+l;
  if(!tot) return '';
  function seg(n,col){
    if(!n) return '';
    return '<div style="flex:'+n+' 1 0;min-width:12px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:9px">'+n+'</div>';
  }
  return '<span style="display:inline-flex;height:12px;border-radius:3px;overflow:hidden;width:60px;background:var(--border);vertical-align:middle;margin-left:5px;font-family:var(--mono)">'
    +seg(w,'#f87171')+seg(d,'#4ade80')+seg(l,'#60a5fa')
    +'</span>';
}

// Mobile: labelled 3M form rows for the card strip
function formStripMobile(r){
  function row(label, w, d, l){
    w=w||0; d=d||0; l=l||0;
    var tot=w+d+l;
    if(!tot) return '';
    function seg(n,col){
      if(!n) return '';
      return '<div style="flex:'+n+' 1 0;min-width:16px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:11px;font-family:var(--mono)">'+n+'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:3px">'
      +'<span style="font-size:10px;color:var(--muted);font-family:var(--mono);min-width:88px">'+label+'</span>'
      +'<div style="height:14px;border-radius:4px;display:flex;overflow:hidden;flex:1;max-width:180px;background:var(--border)">'
        +seg(w,'#f87171')+seg(d,'#4ade80')+seg(l,'#60a5fa')
      +'</div>'
      +'<span style="font-size:9px;color:var(--muted);font-family:var(--mono)">'+tot+' games</span>'
      +'</div>';
  }
  var home=row('3M Home', r.REC3MHH, r.REC3MHD, r.REC3MHA);
  var away=row('3M Away', r.REC3MAH, r.REC3MAD, r.REC3MAA);
  if(!home && !away) return '';
  return '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">'
    +'<div style="font-size:9px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px">3M Team Form <span style="opacity:.7">(W-D-L, last 3 months)</span></div>'
    +home+away
    +'</div>';
}

function aiVotesMobile(r){
  function bar(label,labelCol,h,d,a){
    h=h||0;d=d||0;a=a||0;
    var tot=h+d+a;
    if(!tot) return '';
    function seg(n,col){
      if(!n) return '';
      return '<div style="flex:'+n+' 1 0;min-width:16px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:11px;font-family:var(--mono)">'+n+'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:3px">'
      +'<span style="color:'+labelCol+';font-size:10px;font-weight:700;font-family:var(--mono);min-width:28px">'+label+'</span>'
      +'<div style="height:14px;border-radius:4px;display:flex;overflow:hidden;flex:1;max-width:180px;background:var(--border)">'
        +seg(h,'#f87171')+seg(d,'#4ade80')+seg(a,'#60a5fa')
      +'</div>'
      +'</div>';
  }
  var g=bar('GEM','#fbbf24', r.GEMH, r.GEMD, r.GEMA);
  var p=bar('GPT','#e879f9', r.GPTH, r.GPTD, r.GPTA);
  if(!g && !p) return '';
  return '<div style="margin-top:4px">'+g+p+'</div>';
}

function aiVotesCell(r){
  function bar(label,labelCol,h,d,a){
    h=h||0;d=d||0;a=a||0;
    var tot=h+d+a;
    if(!tot) return '';
    function seg(n,col){
      if(!n) return '';
      return '<div style="flex:'+n+' 1 0;min-width:13px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:9px">'+n+'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:4px;margin:1px 0">'
      +'<span style="color:'+labelCol+';font-size:9px;font-weight:700;min-width:24px">'+label+'</span>'
      +'<div style="height:12px;border-radius:3px;display:flex;overflow:hidden;width:78px;background:var(--border)">'
        +seg(h,'#f87171')+seg(d,'#4ade80')+seg(a,'#60a5fa')
      +'</div>'
      +'</div>';
  }
  var g=bar('GEM','#fbbf24', r.GEMH, r.GEMD, r.GEMA);
  var p=bar('GPT','#e879f9', r.GPTH, r.GPTD, r.GPTA);
  if(!g && !p) return '<span style="color:var(--muted)">\u2014</span>';
  return '<div style="font-family:var(--mono);display:inline-block;text-align:left">'+g+p+'</div>';
}

function h2hInline(r){
  function bar(label,h,d,a){
    h=h||0;d=d||0;a=a||0;
    var tot=h+d+a;
    if(!tot) return '';
    function seg(n,col){
      if(!n) return '';
      return '<div style="flex:'+n+' 1 0;min-width:13px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:9px">'+n+'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:4px;margin-top:2px">'
      +'<span style="color:var(--muted);font-size:9px;min-width:22px">'+label+'</span>'
      +'<div style="height:12px;border-radius:3px;display:flex;overflow:hidden;width:90px;background:var(--border)">'
        +seg(h,'#f87171')+seg(d,'#4ade80')+seg(a,'#60a5fa')
      +'</div>'
      +'</div>';
  }
  var rec=bar('Rec', r.RECENTH, r.RECENTD, r.RECENTA);
  var yr =bar('1Yr', r.REC1YRH, r.REC1YRD, r.REC1YRA);
  if(!rec && !yr) return '';
  return '<div style="font-family:var(--mono)">'+rec+yr+'</div>';
}

function h2hStrip(r){
  function row(label, h, d, a){
    h=h||0; d=d||0; a=a||0;
    var tot=h+d+a;
    if(!tot) return '';
    function seg(n,col){
      if(!n) return '';
      return '<div style="flex:'+n+' 1 0;min-width:16px;background:'+col+';display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:11px;font-family:var(--mono)">'+n+'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">'
      +'<span style="font-size:10px;color:var(--muted);font-family:var(--mono);min-width:88px">'+label+'</span>'
      +'<div style="height:16px;border-radius:4px;background:var(--border);display:flex;overflow:hidden;flex:1">'
        +seg(h,'#f87171')+seg(d,'#4ade80')+seg(a,'#60a5fa')
      +'</div>'
      +'<span style="font-size:9px;color:var(--muted);font-family:var(--mono);min-width:52px;text-align:right">'+tot+' games</span>'
      +'</div>';
  }
  var recent=row('Recent (last 8)', r.RECENTH, r.RECENTD, r.RECENTA);
  var oneYr =row('1-Year', r.REC1YRH, r.REC1YRD, r.REC1YRA);
  if(!recent && !oneYr) return '';
  return '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">'
    +'<div style="font-size:9px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px">H2H Record <span style="opacity:.7">(home view: W-D-L)</span></div>'
    +recent+oneYr
    +'</div>';
}

function hkjcBestPriceSkull(r, side){
  var hk  = side==='H' ? r.ASIAH    : r.ASIAA;
  var mac = side==='H' ? r.ASIAHMAC : r.ASIAAMAC;
  var sbo = side==='H' ? r.ASIAHSBO : r.ASIAASBO;
  if(hk==null||!mac||!sbo) return '';
  if(!(r.ASIALINE===r.ASIALINEMA && r.ASIALINE===r.ASIALINESB)) return '';
  // best-or-tied AND strictly beats at least one (exclude pure three-way ties)
  if(hk>=mac && hk>=sbo && (hk>mac || hk>sbo)){
    return '<span title="HKJC offers the best price here vs Macau & SBO — per the study this side tends to underperform (consider the opposite)" style="cursor:help">💀</span>';
  }
  return '';
}

// render.js
function renderTable(){
  var body=$('tableBody'),start=(pg-1)*PG,rows=filtered.slice(start,start+PG),s=$('searchInput').value;
  $('emptyState').style.display=rows.length?'none':'block';
  $('mainTable').style.display=rows.length?'':'none';
  if(isMobile){
    body.innerHTML=rows.map(function(r,i){
      var gi=start+i;
      var sc=r.STATUS==='Result'?'s-result':r.STATUS==='PREEVE'?'s-preeve':'s-cancel';
      var sl=r.STATUS==='PREEVE'?'Upcoming':(r.STATUS||'—');
      var time=r.TIME?fmtTime(r.TIME):'';

      // Score colour: red=home win, green=draw, blue=away win
      var scoreHtml;
      if(r.STATUS==='Result'){
        var rh=Number(r.RESULTH),ra=Number(r.RESULTA);
        var scoreColor=rh>ra?'#f87171':rh===ra?'#4ade80':'#60a5fa';
        scoreHtml='<span style="font-family:var(--mono);font-size:18px;font-weight:800;color:'+scoreColor+'">'+rh+' – '+ra+'</span>';
      } else {
        scoreHtml='';
      }

      // League cell colour: (HomeScore - AwayScore + AsiaLine) vs ±0.25
      var catStyle='font-size:11px;margin-bottom:5px;';
      if(r.STATUS==='Result' && r.ASIALINE!=null){
        var margin=Number(r.RESULTH)-Number(r.RESULTA)+Number(r.ASIALINE);
        if(margin>0.25)        catStyle+='background:rgba(248,113,113,0.18);color:#fca5a5;padding:1px 5px;border-radius:4px;';
        else if(margin===0.25) catStyle+='color:#f87171;';
        else if(margin===-0.25)catStyle+='color:#60a5fa;';
        else if(margin<-0.25)  catStyle+='background:rgba(96,165,250,0.18);color:#93c5fd;padding:1px 5px;border-radius:4px;';
      }

      return '<tr onclick="openDetail('+gi+')" '+(selIdx===gi?'class="selected"':'')+'>'
        +'<td colspan="10">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        +'<div style="flex:1;margin-right:70px">'
        +'<div style="font-size:11px;font-family:var(--mono);margin-bottom:3px"><span style="color:#94a3b8">'+esc(r.DATE||'')+'</span>'+(time?'<span style="color:#e2e8f0;font-weight:600;margin-left:5px">'+time+'</span>':'')+'</div>'
        +'<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:2px">'+'<span style="'+catStyle+'margin-bottom:0;flex-shrink:0">'+hl(esc(r.CATEGORY||''),s)+'</span>'+'<span style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4">'+hl(esc(r.TEAMH||'?'),s)+'<span style="color:var(--muted);font-weight:400;font-size:11px;margin:0 5px">vs</span>'+hl(esc(r.TEAMA||'?'),s)+' '+vigSymbol(r)+'</span>'+'</div>'
        +'</div>'
        +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">'
        +'<span class="status-badge '+sc+'">'+sl+'</span>'
        +scoreHtml
        +'</div></div>'
        +'<div style="margin-top:8px;font-family:var(--mono);font-size:10px">'
        +'<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;color:var(--muted);font-size:9px;margin-bottom:3px;padding-bottom:2px;border-bottom:1px solid var(--border)">'
        +'<span>LINE</span><span>H</span><span>A</span></div>'
        +(r.ASIALINE!=null||r.ASIAH!=null||r.ASIAA!=null?
          '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;align-items:center;margin-bottom:2px">'
          +'<span style="color:var(--muted)"><span style="font-size:9px">G </span>'+asiaLineArrows(r.ASIALINE,r.ASIALINELN,r.ASIAHLN===0)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAH,r.ASIAHLN)+hkjcBestPriceSkull(r,'H')+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAA,r.ASIAALN)+hkjcBestPriceSkull(r,'A')+'</span>'
          +'</div>':'') 
        +(r.ASIALINEMA!=null||r.ASIAHMAC!=null||r.ASIAAMAC!=null?
          '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;align-items:center;margin-bottom:2px">'
          +'<span style="color:#a78bfa"><span style="font-size:9px">M </span>'+asiaLineArrows(r.ASIALINEMA,r.ASIALINEM2,r.ASIAHMACLN===0)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAHMAC,r.ASIAHMACLN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAAMAC,r.ASIAAMACLN)+'</span>'
          +'</div>':'') 
        +(r.ASIALINESB!=null||r.ASIAHSBO!=null||r.ASIAASBO!=null?
          '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;align-items:center">'
          +'<span style="color:#fb923c"><span style="font-size:9px">S </span>'+asiaLineArrows(r.ASIALINESB,r.ASIALINES2,r.ASIAHSBOLN===0)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAHSBO,r.ASIAHSBOLN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAASBO,r.ASIAASBOLN)+'</span>'
          +'</div>':'') 
        +'</div>'
        +'<div style="display:flex;gap:10px;margin-top:6px;font-family:var(--mono);font-size:10px;flex-wrap:wrap">'
        +'<span style="color:var(--muted)">Sum:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSUM)
        +' <span style="color:var(--muted)">SID:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSID)
        +' <span style="color:var(--muted)">Mac:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSIDMAC)
        +' <span style="color:var(--muted)">ON:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSONID)
        +' <span style="color:#fbbf24">Gem:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSGEM)
        +' <span style="color:#e879f9">GPT:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSGPT)
        +'</div>'
        +aiVotesMobile(r)
        +(r.PREDICTH||r.PREDICTD||r.PREDICTA?'<div style="margin-top:8px">'
          +(lowConfidence(r)?'<div style="font-size:9px;color:var(--warn);opacity:.8;font-family:var(--mono);margin-bottom:4px">⚠ Low confidence</div>':'')
          +'<div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);margin-bottom:3px'+(lowConfidence(r)?';opacity:.5':'')+'">'
          +'<span style="color:#f87171">H '+(r.PREDICTH||0)+'%</span><span style="color:#4ade80">D '+(r.PREDICTD||0)+'%</span><span style="color:#60a5fa">A '+(r.PREDICTA||0)+'%</span></div>'
          +(lowConfidence(r)
            ?'<div style="height:6px;border-radius:3px;background:var(--border);display:flex;overflow:hidden;opacity:.4">'
              +'<div style="width:'+(r.PREDICTH||0)+'%;background:repeating-linear-gradient(90deg,#f87171 0 3px,transparent 3px 6px)"></div>'
              +'<div style="width:'+(r.PREDICTD||0)+'%;background:repeating-linear-gradient(90deg,#4ade80 0 3px,transparent 3px 6px)"></div>'
              +'<div style="width:'+(r.PREDICTA||0)+'%;background:repeating-linear-gradient(90deg,#60a5fa 0 3px,transparent 3px 6px)"></div>'
              +'</div>'
            :'<div style="height:6px;border-radius:3px;background:var(--border);display:flex;overflow:hidden">'
              +'<div style="width:'+(r.PREDICTH||0)+'%;background:#f87171"></div>'
              +'<div style="width:'+(r.PREDICTD||0)+'%;background:#4ade80"></div>'
              +'<div style="width:'+(r.PREDICTA||0)+'%;background:#60a5fa"></div>'
              +'</div>')
          +'</div>':'')
        +(function(){
          var e=expertScore(r);if(!e)return'';
          var lc=lowConfidence(r);
          return'<div style="margin-top:6px">'
            +'<div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);margin-bottom:3px'+(lc?';opacity:.5':'')+'">'
            +'<span style="color:#f87171">Expert H '+e.h+'%</span><span style="color:#4ade80">D '+e.d+'%</span><span style="color:#60a5fa">A '+e.a+'%</span></div>'
            +(lc
              ?'<div style="height:12px;border-radius:4px;background:var(--border);display:flex;overflow:hidden;opacity:.4">'
                +'<div style="width:'+e.h+'%;background:repeating-linear-gradient(90deg,rgba(248,113,113,.9) 0 4px,transparent 4px 8px)"></div>'
                +'<div style="width:'+e.d+'%;background:repeating-linear-gradient(90deg,rgba(74,222,128,.9) 0 4px,transparent 4px 8px)"></div>'
                +'<div style="width:'+e.a+'%;background:repeating-linear-gradient(90deg,rgba(96,165,250,.9) 0 4px,transparent 4px 8px)"></div>'
                +'</div>'
              :'<div style="height:12px;border-radius:4px;background:var(--border);display:flex;overflow:hidden">'
                +'<div style="width:'+e.h+'%;background:#f87171"></div>'
                +'<div style="width:'+e.d+'%;background:#4ade80"></div>'
                +'<div style="width:'+e.a+'%;background:#60a5fa"></div>'
                +'</div>')
            +'</div>';
        })()
        +h2hStrip(r)+formStripMobile(r)
        +'</td></tr>';
    }).join('');
  } else {
    body.innerHTML=rows.map(function(r,i){
      var gi=start+i;
      var sc=r.STATUS==='Result'?'s-result':r.STATUS==='PREEVE'?'s-preeve':'s-cancel';
      var sl=r.STATUS==='PREEVE'?'Upcoming':(r.STATUS||'—');

      // Score colour: red=home win, green=draw, blue=away win
      var scoreHtml;
      if(r.STATUS==='Result'){
        var rh=Number(r.RESULTH),ra=Number(r.RESULTA);
        var scoreColor=rh>ra?'#f87171':rh===ra?'#4ade80':'#60a5fa';
        scoreHtml='<span style="font-weight:700;color:'+scoreColor+'">'+rh+' – '+ra+'</span>';
      } else {
        scoreHtml='<span style="color:var(--muted)">—</span>';
      }

      // League cell colour based on: (HomeScore - AwayScore + AsiaLine) vs ±0.25
      var leagueCellStyle='';
      if(r.STATUS==='Result' && r.ASIALINE!=null){
        var margin=Number(r.RESULTH)-Number(r.RESULTA)+Number(r.ASIALINE);
        if(margin>0.25)       leagueCellStyle='background:rgba(248,113,113,0.18);color:#fca5a5;';
        else if(margin===0.25) leagueCellStyle='color:#f87171;';
        else if(margin===-0.25)leagueCellStyle='color:#60a5fa;';
        else if(margin<-0.25)  leagueCellStyle='background:rgba(96,165,250,0.18);color:#93c5fd;';
      }

      return '<tr onclick="openDetail('+gi+')" '+(selIdx===gi?'class="selected"':'')+'>'
        +'<td><div style="color:#94a3b8">'+esc(r.DATE||'—')+'</div><div style="color:#e2e8f0;font-size:11px;font-weight:600">'+(r.TIME?fmtTime(r.TIME):'')+'</div></td>'
        +'<td class="ccell" title="'+esc(r.CATEGORY||'')+'" style="'+leagueCellStyle+'">'+hl(esc(r.CATEGORY||'—'),s)+'</td>'
        +'<td class="tcell" style="white-space:normal;max-width:220px"><span style="font-weight:600">'+hl(esc(r.TEAMH||'—'),s)+'</span>'+formBarInline(r.REC3MHH,r.REC3MHD,r.REC3MHA)+'<span style="color:var(--muted);font-size:10px;margin:0 5px">vs</span><span style="font-weight:600">'+hl(esc(r.TEAMA||'—'),s)+'</span>'+formBarInline(r.REC3MAH,r.REC3MAD,r.REC3MAA)+vigSymbol(r)+h2hInline(r)+'</td>'
        +'<td>'+(function(){
          var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0;
          var e=expertScore(r);
          var lc=lowConfidence(r);
          var html='';
          if(ph||pd||pa){
            html+='<div style="min-width:100px">'
              +'<div style="display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);margin-bottom:2px'+(lc?';opacity:.5':'')+'">'
              +'<span style="color:#f87171">'+ph+'%</span><span style="color:#4ade80">'+pd+'%</span><span style="color:#60a5fa">'+pa+'%</span></div>'
              +(lc
                ?'<div style="height:4px;border-radius:2px;background:var(--border);display:flex;overflow:hidden;opacity:.4">'
                  +'<div style="width:'+ph+'%;background:repeating-linear-gradient(90deg,#f87171 0 3px,transparent 3px 6px)"></div>'
                  +'<div style="width:'+pd+'%;background:repeating-linear-gradient(90deg,#4ade80 0 3px,transparent 3px 6px)"></div>'
                  +'<div style="width:'+pa+'%;background:repeating-linear-gradient(90deg,#60a5fa 0 3px,transparent 3px 6px)"></div>'
                  +'</div>'
                :'<div style="height:4px;border-radius:2px;background:var(--border);display:flex;overflow:hidden">'
                  +'<div style="width:'+ph+'%;background:#f87171"></div>'
                  +'<div style="width:'+pd+'%;background:#4ade80"></div>'
                  +'<div style="width:'+pa+'%;background:#60a5fa"></div>'
                  +'</div>')
              +'</div>';
          }
          if(e){
            html+='<div style="min-width:100px;margin-top:3px">'
              +'<div style="display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);margin-bottom:2px'+(lc?';opacity:.5':'')+'">'
              +'<span style="color:#f87171;opacity:.7">E'+e.h+'%</span><span style="color:#4ade80;opacity:.7">'+e.d+'%</span><span style="color:#60a5fa;opacity:.7">'+e.a+'%</span></div>'
              +(lc
                ?'<div style="height:8px;border-radius:3px;background:var(--border);display:flex;overflow:hidden;opacity:.4">'
                  +'<div style="width:'+e.h+'%;background:repeating-linear-gradient(90deg,rgba(248,113,113,.9) 0 4px,transparent 4px 8px)"></div>'
                  +'<div style="width:'+e.d+'%;background:repeating-linear-gradient(90deg,rgba(74,222,128,.9) 0 4px,transparent 4px 8px)"></div>'
                  +'<div style="width:'+e.a+'%;background:repeating-linear-gradient(90deg,rgba(96,165,250,.9) 0 4px,transparent 4px 8px)"></div>'
                  +'</div>'
                :'<div style="height:8px;border-radius:3px;background:var(--border);display:flex;overflow:hidden">'
                  +'<div style="width:'+e.h+'%;background:rgba(248,113,113,.6)"></div>'
                  +'<div style="width:'+e.d+'%;background:rgba(74,222,128,.6)"></div>'
                  +'<div style="width:'+e.a+'%;background:rgba(96,165,250,.6)"></div>'
                  +'</div>')
              +'</div>';
          }
          return html||'<span style="color:var(--muted)">—</span>';
        })()
        +'<td class="oc" style="line-height:1.7">'
        +(r.ASIALINE!=null?'<div><span style="color:var(--muted);font-size:9px">G </span>'+asiaLineArrows(r.ASIALINE,r.ASIALINELN,r.ASIAHLN===0)+'</div>':'')
        +(r.ASIALINEMA!=null?'<div><span style="color:#a78bfa;font-size:9px">M </span>'+asiaLineArrows(r.ASIALINEMA,r.ASIALINEM2,r.ASIAHMACLN===0)+'</div>':'')
        +(r.ASIALINESB!=null?'<div><span style="color:#fb923c;font-size:9px">S </span>'+asiaLineArrows(r.ASIALINESB,r.ASIALINES2,r.ASIAHSBOLN===0)+'</div>':'')
        +'</td>'
        +'<td class="oc" style="line-height:1.7">'
        +(r.ASIAH!=null?'<div>'+asiaOddsArrows(r.ASIAH,r.ASIAHLN)+hkjcBestPriceSkull(r,'H')+'</div>':'')
        +(r.ASIAHMAC!=null?'<div>'+asiaOddsArrows(r.ASIAHMAC,r.ASIAHMACLN)+'</div>':'')
        +(r.ASIAHSBO!=null?'<div>'+asiaOddsArrows(r.ASIAHSBO,r.ASIAHSBOLN)+'</div>':'')
        +'</td>'
        +'<td class="oc" style="line-height:1.7">'
        +(r.ASIAA!=null?'<div>'+asiaOddsArrows(r.ASIAA,r.ASIAALN)+hkjcBestPriceSkull(r,'A')+'</div>':'')
        +(r.ASIAAMAC!=null?'<div>'+asiaOddsArrows(r.ASIAAMAC,r.ASIAAMACLN)+'</div>':'')
        +(r.ASIAASBO!=null?'<div>'+asiaOddsArrows(r.ASIAASBO,r.ASIAASBOLN)+'</div>':'')
        +'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSUM)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSID)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSIDMAC)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSONID)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSGEM)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSGPT)+'</td>'
        +'<td class="oc" style="text-align:center">'+aiVotesCell(r)+'</td>'
        +'<td>'+scoreHtml+'</td>'
        +'<td><span class="status-badge '+sc+'">'+sl+'</span></td>'
        +'</tr>';
    }).join('');
  }
}

function renderPagination(){
  var total=Math.ceil(filtered.length/PG),el=$('pagination');
  if(total<=1){el.innerHTML='';el.classList.remove('pg-visible');return;}
  el.classList.add('pg-visible');
  var range=[];for(var p=1;p<=total;p++)if(p===1||p===total||Math.abs(p-pg)<=2)range.push(p);
  var html='<button class="pg-btn" '+(pg<=1?'disabled':'')+' onclick="goPage('+(pg-1)+')">‹</button>';
  var prev=0;
  range.forEach(function(p){if(p-prev>1)html+='<span style="color:var(--muted);padding:0 2px">…</span>';html+='<button class="pg-btn '+(p===pg?'active':'')+'" onclick="goPage('+p+')">'+p+'</button>';prev=p;});
  html+='<button class="pg-btn" '+(pg>=total?'disabled':'')+' onclick="goPage('+(pg+1)+')">›</button>';
  html+='<span class="pg-info">'+pg+' / '+total+'</span>';
  html+='<input class="pg-input" type="number" min="1" max="'+total+'" value="'+pg+'" onchange="goPage(Math.min('+total+',Math.max(1,parseInt(this.value)||1)))" title="Jump to page"/>';
  el.innerHTML=html;
}

function goPage(p){pg=p;renderTable();renderPagination();$('tableArea').scrollTop=0;}