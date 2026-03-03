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
          +'<span style="color:var(--muted)"><span style="font-size:9px">G </span>'+asiaLineArrows(r.ASIALINE,r.ASIALINELN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAH,r.ASIAHLN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAA,r.ASIAALN)+'</span>'
          +'</div>':'') 
        +(r.ASIALINEMA!=null||r.ASIAHMAC!=null||r.ASIAAMAC!=null?
          '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;align-items:center;margin-bottom:2px">'
          +'<span style="color:#a78bfa"><span style="font-size:9px">M </span>'+asiaLineArrows(r.ASIALINEMA,r.ASIALINEM2)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAHMAC,r.ASIAHMACLN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAAMAC,r.ASIAAMACLN)+'</span>'
          +'</div>':'') 
        +(r.ASIALINESB!=null||r.ASIAHSBO!=null||r.ASIAASBO!=null?
          '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:4px;align-items:center">'
          +'<span style="color:#fb923c"><span style="font-size:9px">S </span>'+asiaLineArrows(r.ASIALINESB,r.ASIALINES2)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAHSBO,r.ASIAHSBOLN)+'</span>'
          +'<span style="color:#94a3b8">'+asiaOddsArrows(r.ASIAASBO,r.ASIAASBOLN)+'</span>'
          +'</div>':'') 
        +'</div>'
        +'<div style="display:flex;gap:10px;margin-top:6px;font-family:var(--mono);font-size:10px;flex-wrap:wrap">'
        +'<span style="color:var(--muted)">Sum:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSUM)
        +' <span style="color:var(--muted)">SID:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSID)
        +' <span style="color:var(--muted)">Mac:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSIDMAC)
        +' <span style="color:var(--muted)">ON:</span> '+(function(v){if(!v)return'<span style="color:var(--muted)">—</span>';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSONID)
        +'</div>'
        +'<div style="display:flex;gap:10px;margin-top:4px;font-family:var(--mono);font-size:10px;color:#94a3b8">'
        +'<span>Gem: '+(r.GEMH!=null?r.GEMH:'\u2014')+' / '+(r.GEMD!=null?r.GEMD:'\u2014')+' / '+(r.GEMA!=null?r.GEMA:'\u2014')+'</span>'
        +'<span style="margin-left:8px">Gpt: '+(r.GPTH!=null?r.GPTH:'\u2014')+' / '+(r.GPTD!=null?r.GPTD:'\u2014')+' / '+(r.GPTA!=null?r.GPTA:'\u2014')+'</span>'
        +'</div>'
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
        +'<td class="tcell" style="white-space:normal;max-width:180px"><span style="font-weight:600">'+hl(esc(r.TEAMH||'—'),s)+'</span><span style="color:var(--muted);font-size:10px;margin:0 5px">vs</span><span style="font-weight:600">'+hl(esc(r.TEAMA||'—'),s)+'</span>'+vigSymbol(r)+'</td>'
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
        +(r.ASIALINE!=null?'<div><span style="color:var(--muted);font-size:9px">G </span>'+asiaLineArrows(r.ASIALINE,r.ASIALINELN)+'</div>':'')
        +(r.ASIALINEMA!=null?'<div><span style="color:#a78bfa;font-size:9px">M </span>'+asiaLineArrows(r.ASIALINEMA,r.ASIALINEM2)+'</div>':'')
        +(r.ASIALINESB!=null?'<div><span style="color:#fb923c;font-size:9px">S </span>'+asiaLineArrows(r.ASIALINESB,r.ASIALINES2)+'</div>':'')
        +'</td>'
        +'<td class="oc" style="line-height:1.7">'
        +(r.ASIAH!=null?'<div>'+asiaOddsArrows(r.ASIAH,r.ASIAHLN)+'</div>':'')
        +(r.ASIAHMAC!=null?'<div>'+asiaOddsArrows(r.ASIAHMAC,r.ASIAHMACLN)+'</div>':'')
        +(r.ASIAHSBO!=null?'<div>'+asiaOddsArrows(r.ASIAHSBO,r.ASIAHSBOLN)+'</div>':'')
        +'</td>'
        +'<td class="oc" style="line-height:1.7">'
        +(r.ASIAA!=null?'<div>'+asiaOddsArrows(r.ASIAA,r.ASIAALN)+'</div>':'')
        +(r.ASIAAMAC!=null?'<div>'+asiaOddsArrows(r.ASIAAMAC,r.ASIAAMACLN)+'</div>':'')
        +(r.ASIAASBO!=null?'<div>'+asiaOddsArrows(r.ASIAASBO,r.ASIAASBOLN)+'</div>':'')
        +'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSUM)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSID)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSIDMAC)+'</td>'
        +'<td class="oc">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSONID)+'</td>'
        +'<td class="oc">'+(r.GEMH!=null?r.GEMH:'\u2014')+'</td>'
        +'<td class="oc">'+(r.GEMD!=null?r.GEMD:'\u2014')+'</td>'
        +'<td class="oc">'+(r.GEMA!=null?r.GEMA:'\u2014')+'</td>'
        +'<td class="oc">'+(r.GPTH!=null?r.GPTH:'\u2014')+'</td>'
        +'<td class="oc">'+(r.GPTD!=null?r.GPTD:'\u2014')+'</td>'
        +'<td class="oc">'+(r.GPTA!=null?r.GPTA:'\u2014')+'</td>'
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
