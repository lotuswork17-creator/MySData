// detail.js
function openDetail(idx){
  selIdx=idx;var r=filtered[idx];
  document.querySelectorAll('tbody tr').forEach(function(tr,i){tr.classList.toggle('selected',(pg-1)*PG+i===idx);});
  $('panelTitle').innerHTML=esc((r.TEAMH||'?')+' vs '+(r.TEAMA||'?'))+' '+vigSymbol(r);
  $('panelMeta').textContent=(r.DATE||'')+(r.TIME?' '+fmtTime(r.TIME):'')+' · '+(r.CATEGORY||'')+' · '+(r.STATUS||'');
  var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0,pt=ph+pd+pa||1;
  var res='';
  if(r.STATUS==='Result'){
    var hw=r.RESULTH>r.RESULTA,aw=r.RESULTA>r.RESULTH;
    res='<div class="dc full"><h3>⚽ Match Result</h3>'
      +'<div class="sd"><div class="st"><div class="stn">'+esc(r.TEAMH||'Home')+'</div><div class="ssc" style="color:'+(hw?'var(--accent)':'var(--text)')+'">'+r.RESULTH+'</div></div>'
      +'<div class="sdiv">—</div>'
      +'<div class="st"><div class="stn">'+esc(r.TEAMA||'Away')+'</div><div class="ssc" style="color:'+(aw?'var(--accent)':'var(--text)')+'">'+r.RESULTA+'</div></div></div>'
      +(r.RESULTFH!=null?'<div class="hts">Half-time: '+r.RESULTFH+' – '+r.RESULTFA+'</div>':'')+'</div>';
  }
  $('panelBody').innerHTML=res
    +'<div class="dc full"><h3>💡 Tips Summary</h3><div class="tg">'
    +'<div class="ti"><div class="tl">JC Tips Sum</div><div class="tv">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSUM)+'</div></div>'
    +'<div class="ti"><div class="tl">JC Tips SID</div><div class="tv">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.JCTIPSID)+'</div></div>'
    +'<div class="ti"><div class="tl">Tips SID MAC</div><div class="tv">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSIDMAC)+'</div></div>'
    +'<div class="ti"><div class="tl">Tips ON ID</div><div class="tv">'+(function(v){if(!v)return'—';var c=v.includes('H')?'#f87171':v.includes('D')?'#4ade80':v.includes('A')?'#60a5fa':'var(--text)';return'<span style="color:'+c+';font-weight:700">'+v+'</span>';})(r.TIPSONID)+'</div></div>'
    +'</div><div class="tg2">'
    +'<div class="ti"><div class="tl">GEM H/D/A</div><div class="tv" style="font-family:var(--mono);font-size:12px"><span style="color:#f87171">'+( r.GEMH!=null?r.GEMH:'—')+'</span> / <span style="color:#4ade80">'+( r.GEMD!=null?r.GEMD:'—')+'</span> / <span style="color:#60a5fa">'+( r.GEMA!=null?r.GEMA:'—')+'</span></div></div>'
    +'<div class="ti"><div class="tl">GPT H/D/A</div><div class="tv" style="font-family:var(--mono);font-size:12px"><span style="color:#f87171">'+( r.GPTH!=null?r.GPTH:'—')+'</span> / <span style="color:#4ade80">'+( r.GPTD!=null?r.GPTD:'—')+'</span> / <span style="color:#60a5fa">'+( r.GPTA!=null?r.GPTA:'—')+'</span></div></div>'
    +'</div></div>'
    +(r.JCTIPS1?'<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">'
      +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">JC Tips Analysis</div>'
      +(r.JCTIPS1?'<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:6px">'+r.JCTIPS1+'</div>':'')
      +(r.JCTIPS2?'<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:6px">'+r.JCTIPS2+'</div>':'')
      +(r.JCTIPS3?'<div style="font-size:11px;color:var(--muted);line-height:1.6">'+r.JCTIPS3+'</div>':'')
      +'</div>':'')
    +(r.TIPSMAC?'<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">'
      +'<div style="font-size:10px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">🎰 Macau Tips</div>'
      +'<div style="font-size:11px;color:var(--text);line-height:1.7">'+r.TIPSMAC+'</div>'
      +'</div>':'')
    +'</div>'
    +'<div class="dc"><h3>📊 Prediction %</h3>'
    +'<div class="pl"><span style="color:var(--accent2)">H '+ph+'%</span><span style="color:#a78bfa">D '+pd+'%</span><span style="color:var(--warn)">A '+pa+'%</span></div>'
    +'<div class="pbar"><div class="ph2" style="width:'+(ph/pt*100).toFixed(1)+'%"></div><div class="pd2" style="width:'+(pd/pt*100).toFixed(1)+'%"></div><div class="pa2" style="width:'+(pa/pt*100).toFixed(1)+'%"></div></div>'
    +(function(){
      var e=expertScore(r);
      if(!e)return '';
      var et=e.h+e.d+e.a||1;
      var lc=lowConfidence(r);
      return '<div style="margin-top:8px">'
        +'<div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Expert Signal</div>'
        +'<div class="pl"><span style="color:#f87171">H '+e.h+'%</span><span style="color:#4ade80">D '+e.d+'%</span><span style="color:#60a5fa">A '+e.a+'%</span></div>'
        +(lc
          ?'<div class="pbar" style="opacity:.45"><div style="width:'+e.h+'%;background:repeating-linear-gradient(90deg,#f87171 0 3px,transparent 3px 6px);height:100%"></div><div style="width:'+e.d+'%;background:repeating-linear-gradient(90deg,#4ade80 0 3px,transparent 3px 6px);height:100%"></div><div style="width:'+e.a+'%;background:repeating-linear-gradient(90deg,#60a5fa 0 3px,transparent 3px 6px);height:100%"></div></div>'
          :'<div class="pbar"><div style="width:'+e.h+'%;background:#f87171;height:100%"></div><div style="width:'+e.d+'%;background:#4ade80;height:100%"></div><div style="width:'+e.a+'%;background:#60a5fa;height:100%"></div></div>')
        +(lc?'<div style="font-size:9px;color:var(--warn);margin-top:3px">⚠ Low confidence</div>':'')
        +'</div>';
    })()
    +'<div style="margin-top:10px">'
    +'<div class="dr"><span class="dk">Recent H/D/A</span><span class="dv">'+r.RECENTH+' / '+r.RECENTD+' / '+r.RECENTA+'</span></div>'
    +'<div class="dr"><span class="dk">1-Year H/D/A</span><span class="dv">'+r.REC1YRH+' / '+r.REC1YRD+' / '+r.REC1YRA+'</span></div>'
    +'<div class="dr"><span class="dk">3M Home W/D/L</span><span class="dv">'+r.REC3MHH+' / '+r.REC3MHD+' / '+r.REC3MHA+'</span></div>'
    +'<div class="dr"><span class="dk">3M Away W/D/L</span><span class="dv">'+r.REC3MAH+' / '+r.REC3MAD+' / '+r.REC3MAA+'</span></div>'
    +'</div></div>'
    +'<div class="dc full"><h3>📈 1X2 Odds</h3>'
    +'<table class="ot"><thead><tr><th></th><th>Home</th><th>Draw</th><th>Away</th></tr></thead><tbody>'
    +'<tr><td class="ol">Opening</td><td>'+(r.ODDSHLN!=null?r.ODDSHLN:'\u2014')+'</td><td>'+(r.ODDSDLN!=null?r.ODDSDLN:'\u2014')+'</td><td>'+(r.ODDSALN!=null?r.ODDSALN:'\u2014')+'</td></tr>'
    +'<tr><td class="ol">Latest</td>'+'<td>'+asiaOddsArrows(r.ODDSH,r.ODDSHLN)+'</td>'+'<td>'+asiaOddsArrows(r.ODDSD,r.ODDSDLN)+'</td>'+'<td>'+asiaOddsArrows(r.ODDSA,r.ODDSALN)+'</td>'+'</tr>'
    +'</tbody></table></div>'
    +'<div class="dc full"><h3>📈 Asian Handicap</h3>'
    +(function(){
      function ahVal(v){return v!=null?String(v):'—';}
      // Line diff: absolute movement, skip if open==0
      function ahDiff(latest,open){
        if(latest==null||open==null||latest===open)return'';
        var d=Math.round((latest-open)*100)/100;
        if(d===0)return'';
        var abs=Math.abs(d);
        var n=abs>=1.0?3:abs>=0.5?2:1;
        var arr=d>0?'▲':'▼';
        var col=d>0?'#60a5fa':'#f87171';
        return '<span style="color:'+col+';font-size:9px;margin-left:3px">'+arr.repeat(n)+'</span>';
      }
      // Odds diff: percentage-based for Asia H / Asia A
      function ahOddsDiff(lat,opn){
        if(lat==null||opn==null||opn===0||lat===0)return'';
        if(lat===opn)return'';
        var n,arr,col;
        if(lat<opn){
          // dropped
          n=lat<opn*0.9?3:lat<opn*0.95?2:1;
          arr='▼';col='#f87171';
        } else {
          // rose
          n=lat>opn*1.1?3:lat>opn*1.05?2:1;
          arr='▲';col='#60a5fa';
        }
        return '<span style="color:'+col+';font-size:9px;margin-left:3px">'+arr.repeat(n)+'</span>';
      }
      function ahRow(label,color,openLine,openH,openA,latLine,latH,latA){
        return '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 12px;margin-bottom:7px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          +'<span style="font-size:10px;font-weight:700;color:'+color+';text-transform:uppercase;letter-spacing:.05em">'+label+'</span>'
          +'<span style="font-size:9px;color:var(--muted);font-family:var(--mono)">Open → Latest</span></div>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">'
          +'<div style="text-align:center"><div style="font-size:9px;color:var(--muted);margin-bottom:3px">LINE</div>'
          +'<div style="font-size:11px;font-family:var(--mono);color:var(--muted)">'+ahVal(openLine)+'</div>'
          +'<div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--text)">'+ahVal(latLine)+ahDiff(latLine,openLine)+'</div></div>'
          +'<div style="text-align:center"><div style="font-size:9px;color:var(--muted);margin-bottom:3px">ASIA H</div>'
          +'<div style="font-size:11px;font-family:var(--mono);color:var(--muted)">'+ahVal(openH)+'</div>'
          +'<div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--text)">'+ahVal(latH)+ahOddsDiff(latH,openH)+'</div></div>'
          +'<div style="text-align:center"><div style="font-size:9px;color:var(--muted);margin-bottom:3px">ASIA A</div>'
          +'<div style="font-size:11px;font-family:var(--mono);color:var(--muted)">'+ahVal(openA)+'</div>'
          +'<div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--text)">'+ahVal(latA)+ahOddsDiff(latA,openA)+'</div></div>'
          +'</div></div>';
      }
      return ahRow('General','var(--muted)',r.ASIALINELN,r.ASIAHLN,r.ASIAALN,r.ASIALINE,r.ASIAH,r.ASIAA)
        +ahRow('Macau','#a78bfa',r.ASIALINEM2,r.ASIAHMACLN,r.ASIAAMACLN,r.ASIALINEMA,r.ASIAHMAC,r.ASIAAMAC)
        +ahRow('SBO','#fb923c',r.ASIALINES2,r.ASIAHSBOLN,r.ASIAASBOLN,r.ASIALINESB,r.ASIAHSBO,r.ASIAASBO);
    })()
    +'</div>'
    +'<div class="dc"><h3>ℹ️ Info</h3>'
    
    +'<div class="dr"><span class="dk">Match ID</span><span class="dv" style="font-size:10px">'+(r.MATCHID||'—')+'</span></div>'
    +'</div>';
  $('panelOverlay').classList.add('open');
}

function closePanelBg(e){if(e.target===$('panelOverlay'))closePanel();}

function closePanel(){$('panelOverlay').classList.remove('open');}