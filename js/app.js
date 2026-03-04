// app.js
function loadData(){
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},10000);
  fetch('https://lotuswork17-creator.github.io/MySData/data.json?v='+Date.now(),{signal:controller.signal})
    .then(function(r){
      clearTimeout(timer);
      if(!r.ok) throw new Error('HTTP '+r.status+' — make sure data.json is in the same folder as index.html');
      return r.json();
    })
    .then(function(d){
      ALL=d.records||[];
      var m=d.meta||{};
      $('hResult').textContent=ALL.filter(function(r){return r.STATUS==='Result';}).length.toLocaleString();
      $('hPreeve').textContent=ALL.filter(function(r){return r.STATUS==='PREEVE';}).length.toLocaleString();
      if(m.generated_at){
        var dt=new Date(m.generated_at);
        $('updatedAt').textContent='Updated '+dt.toLocaleDateString()+' '+dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      }
      var cats=Array.from(new Set(ALL.map(function(r){return r.CATEGORY;}).filter(Boolean))).sort();
      var sel=$('catSelect');
      cats.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);});

      $('loadingState').style.display='none';
      $('tableArea').style.display='block';
      $('pagination').classList.add('pg-visible');
      $('resultsInline').style.display='inline';

      renderAsiaStats(ALL);renderBetCalc(ALL);
      $('th-DATE').classList.add('sort-desc');
      applyFilters();

      var t;
      $('searchInput').addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){pg=1;applyFilters();},300);});
      // Populate asialine dropdown
      var lines=Array.from(new Set(ALL.map(function(r){return r.ASIALINE;}).filter(function(v){return v!=null;}))).sort(function(a,b){return a-b;});
      var alsel=$('asialineSelect');
      // Add group options first
      var grpSep=document.createElement('option');grpSep.disabled=true;grpSep.textContent='──────────';alsel.appendChild(grpSep);
      var grpA=document.createElement('option');grpA.value='away-quarter';grpA.textContent='Away Quarter (-0.25 & -0.75)';alsel.appendChild(grpA);
      var grpH=document.createElement('option');grpH.value='home-quarter';grpH.textContent='Home Quarter (+0.25 & +0.75)';alsel.appendChild(grpH);
      var grpSep2=document.createElement('option');grpSep2.disabled=true;grpSep2.textContent='──────────';alsel.appendChild(grpSep2);
      lines.forEach(function(l){var o=document.createElement('option');o.value=String(l);o.textContent=l;alsel.appendChild(o);});
      $('catSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('statusSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('asialineSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('dateRangeSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('predictSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('expertSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('marketSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('vigSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('lineMoveSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('hMoveSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('aMoveSelect').addEventListener('change',function(){pg=1;applyFilters();});
      $('smartSelect').addEventListener('change',function(){pg=1;applyFilters();});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanel();});
    })
    .catch(function(e){
      $('loadingState').style.display='none';
      $('errorState').style.display='flex';
      $('errorMsg').textContent=e.name==='AbortError'?'Request timed out after 10s — check your internet connection and that data.json exists on GitHub.':e.message;
    });
}

function applyFilters(){
  var s=$('searchInput').value.toLowerCase(),cat=$('catSelect').value,st=$('statusSelect').value;
  var al=$('asialineSelect').value,dr=$('dateRangeSelect').value;
  var pf=$('predictSelect').value,ef=$('expertSelect').value,mf=$('marketSelect').value,vf=$('vigSelect').value;
  var lmf=$('lineMoveSelect').value,hmf=$('hMoveSelect').value,amf=$('aMoveSelect').value,smf=$('smartSelect').value;
  // Date range cutoff
  var cutoff=null;
  if(dr){
    var d=new Date();d.setMonth(d.getMonth()-parseInt(dr));
    cutoff=d.toISOString().slice(0,10);
  }
  filtered=ALL.filter(function(r){
    if(s&&!((r.TEAMH||'').toLowerCase().includes(s)||(r.TEAMA||'').toLowerCase().includes(s)))return false;
    if(cat&&r.CATEGORY!==cat)return false;
    if(st&&r.STATUS!==st)return false;
    if(cutoff&&r.DATE&&r.DATE<cutoff)return false;
    if(al){
      if(al==='away-quarter'){if(r.ASIALINE!=-0.25&&r.ASIALINE!=-0.75)return false;}
      else if(al==='home-quarter'){if(r.ASIALINE!=0.25&&r.ASIALINE!=0.75)return false;}
      else if(String(r.ASIALINE)!==al)return false;
    }
    // Predict filter
    if(pf){
      var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0;
      var pl=predictLead(r);
      if(pf==='H-lead'&&pl!=='H')return false;
      if(pf==='D-lead'&&pl!=='D')return false;
      if(pf==='A-lead'&&pl!=='A')return false;
      if(pf==='H-weak'&&(pl!=='H'||ph>=50))return false;
      if(pf==='H-strong'&&ph<50)return false;
      if(pf==='H-vstrong'&&ph<70)return false;
      if(pf==='A-weak'&&(pl!=='A'||pa>=50))return false;
      if(pf==='A-strong'&&pa<50)return false;
      if(pf==='A-vstrong'&&pa<70)return false;
      if(pf==='ha-close5'&&Math.abs(ph-pa)>5)return false;
      if(pf==='ha-close10'&&Math.abs(ph-pa)>10)return false;
      if(pf==='ha-close15'&&Math.abs(ph-pa)>15)return false;
    }
    // Expert filter
    if(ef){
      var e=expertScore(r);
      var el=expertLead(r);
      var lc=lowConfidence(r);
      if(ef==='H-dom'){if(!e||el!=='H')return false;}
      if(ef==='H-strong-e'){if(!e||e.h<50)return false;}
      if(ef==='H-vstrong-e'){if(!e||e.h<67)return false;}
      if(ef==='H-ultra-e'){if(!e||e.h<83)return false;}
      if(ef==='A-dom'){if(!e||el!=='A')return false;}
      if(ef==='A-strong-e'){if(!e||e.a<50)return false;}
      if(ef==='A-vstrong-e'){if(!e||e.a<67)return false;}
      if(ef==='A-ultra-e'){if(!e||e.a<83)return false;}
      if(ef==='agree'){if(!e||predictLead(r)!==el)return false;}
      if(ef==='disagree'){if(!e||predictLead(r)===el||!predictLead(r))return false;}
      if(ef==='split10'){if(!e||Math.abs(e.h-e.a)>10)return false;}
      if(ef==='split20'){if(!e||Math.abs(e.h-e.a)>20)return false;}
      if(ef==='high-conf'&&lc)return false;
      if(ef==='high-conf-H'){if(lc||!e||el!=='H')return false;}
      if(ef==='high-conf-H50'){if(lc||!e||e.h<50)return false;}
      if(ef==='high-conf-H70'){if(lc||!e||e.h<67)return false;}
      if(ef==='high-conf-H90'){if(lc||!e||e.h<83)return false;}
      if(ef==='high-conf-A'){if(lc||!e||el!=='A')return false;}
      if(ef==='high-conf-A50'){if(lc||!e||e.a<50)return false;}
      if(ef==='high-conf-A70'){if(lc||!e||e.a<67)return false;}
      if(ef==='high-conf-A90'){if(lc||!e||e.a<83)return false;}
      if(ef==='low-conf'&&!lc)return false;
      if(ef==='low-conf-H'){if(!lc||!e||el!=='H')return false;}
      if(ef==='low-conf-H50'){if(!lc||!e||e.h<50)return false;}
      if(ef==='low-conf-H70'){if(!lc||!e||e.h<67)return false;}
      if(ef==='low-conf-H90'){if(!lc||!e||e.h<83)return false;}
      if(ef==='low-conf-A'){if(!lc||!e||el!=='A')return false;}
      if(ef==='low-conf-A50'){if(!lc||!e||e.a<50)return false;}
      if(ef==='low-conf-A70'){if(!lc||!e||e.a<67)return false;}
      if(ef==='low-conf-A90'){if(!lc||!e||e.a<83)return false;}
      if(ef==='exp-ha-close5'){if(!e||Math.abs(e.h-e.a)>5)return false;}
      if(ef==='exp-ha-close10'){if(!e||Math.abs(e.h-e.a)>10)return false;}
      if(ef==='exp-ha-close15'){if(!e||Math.abs(e.h-e.a)>15)return false;}
    }
    // Market Lean filter
    if(mf||vf){
      if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0)return false;
      var rh2=1/r.ASIAH,ra2=1/r.ASIAA,vig2=rh2+ra2;
      var fh2=rh2/vig2*100,vigPct2=(vig2-1)*100;
      if(mf==='balanced'&&(fh2<48||fh2>52))return false;
      if(mf==='dead-even'&&(fh2<49||fh2>51))return false;
      if(mf==='h-slight'&&(fh2<52||fh2>=55))return false;
      if(mf==='h-clear'&&fh2<55)return false;
      if(mf==='a-slight'&&(fh2<45||fh2>=48))return false;
      if(mf==='a-clear'&&fh2>=45)return false;
      if(vf==='vig-tight'&&vigPct2>=5)return false;
      if(vf==='vig-normal'&&(vigPct2<5||vigPct2>=6))return false;
      if(vf==='vig-wide'&&(vigPct2<6||vigPct2>=7))return false;
      if(vf==='vig-soft'&&vigPct2<7)return false;
    }
    // Line / H / A movement filters
    if(lmf){
      if(r.ASIALINE==null||r.ASIALINELN==null){return false;}
      var ld=r.ASIALINE-r.ASIALINELN,la=Math.abs(ld);
      if(lmf==='up'&&ld<=0)return false;
      if(lmf==='up2'&&ld<0.5)return false;
      if(lmf==='up3'&&ld<1.0)return false;
      if(lmf==='down'&&ld>=0)return false;
      if(lmf==='down2'&&ld>-0.5)return false;
      if(lmf==='down3'&&ld>-1.0)return false;
      if(lmf==='flat'&&ld!==0)return false;
    }
    if(hmf){
      if(r.ASIAH==null||r.ASIAHLN==null){return false;}
      var hd=r.ASIAH-r.ASIAHLN;
      if(hmf==='short'&&hd>=0)return false;
      if(hmf==='short2'&&(hd>=0||r.ASIAH>r.ASIAHLN*0.95))return false;
      if(hmf==='short3'&&(hd>=0||r.ASIAH>r.ASIAHLN*0.90))return false;
      if(hmf==='drift'&&hd<=0)return false;
      if(hmf==='drift2'&&(hd<=0||r.ASIAH<r.ASIAHLN*1.05))return false;
      if(hmf==='drift3'&&(hd<=0||r.ASIAH<r.ASIAHLN*1.10))return false;
      if(hmf==='flat'&&hd!==0)return false;
    }
    if(amf){
      if(r.ASIAA==null||r.ASIAALN==null){return false;}
      var ad=r.ASIAA-r.ASIAALN;
      if(amf==='short'&&ad>=0)return false;
      if(amf==='short2'&&(ad>=0||r.ASIAA>r.ASIAALN*0.95))return false;
      if(amf==='short3'&&(ad>=0||r.ASIAA>r.ASIAALN*0.90))return false;
      if(amf==='drift'&&ad<=0)return false;
      if(amf==='drift2'&&(ad<=0||r.ASIAA<r.ASIAALN*1.05))return false;
      if(amf==='drift3'&&(ad<=0||r.ASIAA<r.ASIAALN*1.10))return false;
      if(amf==='flat'&&ad!==0)return false;
    }
    // Smart Money filter
    if(smf){
      var sgl=r.ASIALINE,sln=r.ASIALINELN,sh=r.ASIAH,sa=r.ASIAA;
      var sld=sgl!=null&&sln!=null?Math.round((sgl-sln)*100)/100:null;
      var se=expertScore(r);
      var sv=sh&&sa&&sh>0&&sa>0?(1/sh+1/sa-1)*100:null;
      if(smf==='sm1'){if(sld===null||sld<=0||!se||se.h<67)return false;}
      else if(smf==='sm2'){if(sld===null||sld<=0||!se||se.h<83||sv===null||sv>=6)return false;}
      else if(smf==='sm3'){if(sld===null||sld<=0||!se||se.h<67||sv===null||sv>=6)return false;}
      else if(smf==='sm4'){if(sld===null||sld!==0||!se||se.a<83)return false;}
      else if(smf==='sm5'){if(sld===null||sld<=0||!se||se.a<83)return false;}
      else if(smf==='sm6'){if(sld===null||sld>=0||!se||se.a<50||sv===null||sv>=6)return false;}
      else if(smf==='sm7'){if(sld===null||sld!==0||!se||se.h<83)return false;}
    }
    return true;
  });
  filtered.sort(function(a,b){var av=a[sortCol],bv=b[sortCol];if(av==null)return 1;if(bv==null)return-1;return(av<bv?-1:av>bv?1:0)*sortDir;});
  $('showCount').textContent=filtered.length.toLocaleString();
  $('totalCount').textContent=ALL.length.toLocaleString();
  renderAsiaStats(filtered);renderBetCalc(filtered);
  renderTable();renderPagination();
}

function sortBy(col){
  if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=-1;}
  pg=1;
  document.querySelectorAll('thead th').forEach(function(th){th.classList.remove('sort-asc','sort-desc');});
  var th=$('th-'+col);if(th)th.classList.add(sortDir===1?'sort-asc':'sort-desc');
  applyFilters();
}

function toggleBetCalc(){
  var body=document.getElementById('betCalcBody');
  var btn=document.getElementById('betCalcToggle');
  var lbl=document.getElementById('betCalcLabel');
  var hidden=body.style.display==='none';
  body.style.display=hidden?'flex':'none';
  btn.classList.toggle('active',hidden);
  lbl.textContent=hidden?'Hide':'Show';
  var arrow=btn.querySelector('.ft-arrow');
  if(arrow)arrow.style.transform=hidden?'':' rotate(-90deg)';
}

function toggleFilters(){
  var panel=document.getElementById('filtersPanel');
  var btn=document.getElementById('filterToggle');
  var lbl=document.getElementById('filterToggleLabel');
  var collapsed=panel.classList.toggle('collapsed');
  btn.classList.toggle('collapsed',collapsed);
  btn.classList.toggle('active',!collapsed);
  lbl.textContent=collapsed?'Show Filters':'Hide Filters';
}

function clearFilters(){
  $('searchInput').value='';$('catSelect').value='';$('statusSelect').value='';$('asialineSelect').value='';
  $('dateRangeSelect').value='';$('predictSelect').value='';$('expertSelect').value='';$('marketSelect').value='';$('vigSelect').value='';$('lineMoveSelect').value='';$('hMoveSelect').value='';$('aMoveSelect').value='';$('smartSelect').value='';
  pg=1;applyFilters();
}
