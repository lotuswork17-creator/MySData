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

      renderAsiaStats(ALL);renderBetCalc(ALL);
      $('th-DATE').classList.add('sort-desc');
      applyFilters();

      var t;
      initJCPickFilter();
      updateSmartOptions();
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
      $('smartSelect2').addEventListener('change',function(){pg=1;applyFilters();});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanel();});
    })
    .catch(function(e){
      $('loadingState').style.display='none';
      $('errorState').style.display='flex';
      $('errorMsg').textContent=e.name==='AbortError'?'Request timed out after 10s — check your internet connection and that data.json exists on GitHub.':e.message;
    });
}

// Standalone smart-money condition tester (shared by filter + option greying)
// Strict-majority-tie check: 1 vote per field across the 6 expert sources. Returns
// true when no direction (H/D/A) has a strict majority — i.e., experts are split.
// This is the same definition used by Book Rules 2 R{n}-tied variants, so combining
// any front-page rule filter with "tied" reproduces those samples exactly.
function expertTied(r){
  var keys=['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID','TIPSGEM','TIPSGPT'];
  var h=0,a=0,d=0;
  for(var i=0;i<keys.length;i++){
    var v=String(r[keys[i]]||'').toUpperCase();
    if(v.indexOf('H')>=0) h++;
    else if(v.indexOf('A')>=0) a++;
    else if(v.indexOf('D')>=0||v==='X') d++;
  }
  return !(h>a&&h>d) && !(a>h&&a>d) && !(d>h&&d>a);
}

function smartPass(r, smf){
  if(!smf) return true;
  var sgl=r.ASIALINE, sln=r.ASIALINELN, sh=r.ASIAH, sa=r.ASIAA;
  var hasOpen=r.ASIAHLN>0&&r.ASIAALN>0; // opening odds present = valid opening snapshot (ASIALINELN=0 alone can mean 'missing')
  var sld=(sgl!=null&&hasOpen)?Math.round((sgl-sln)*100)/100:null;
  var se=expertScore(r);
  var sv=sh&&sa&&sh>0&&sa>0?(1/sh+1/sa-1)*100:null;
  if(smf==='sm1') return !(sld===null||sld<=0||!se||se.h<67);
  if(smf==='sm2') return !(sld===null||sld<=0||!se||se.h<83||sv===null||sv>=6);
  if(smf==='sm3') return !(sld===null||sld<=0||!se||se.h<67||sv===null||sv>=6);
  if(smf==='sm4') return !(sld===null||sld!==0||!se||se.a<83);
  if(smf==='sm5') return !(sld===null||sld<=0||!se||se.a<83);
  if(smf==='sm6') return !(sld===null||sld>=0||!se||se.a<50||sv===null||sv>=6);
  if(smf==='sm7') return !(sld===null||sld!==0||!se||se.h<83);
  if(smf==='sm8'||smf==='sm9'||smf==='sm10'||smf==='sm11'||smf==='sm12'){
    var keys=['JCTIPSUM','JCTIPSID','TIPSIDMAC','TIPSONID','TIPSGEM','TIPSGPT'];
    var hc=0,ac=0;
    keys.forEach(function(k){ var v=String(r[k]||'').trim(); if(v==='H'||v==='1H'||v==='FH')hc++; else if(v==='A'||v==='1A'||v==='FA')ac++; });
    var hRatio=(r.ASIAHLN&&r.ASIAHLN>0)?r.ASIAH/r.ASIAHLN:1;
    var aRatio=(r.ASIAALN&&r.ASIAALN>0)?r.ASIAA/r.ASIAALN:1;
    if(smf==='sm8')  return (hc>ac&&hc>=3)&&hRatio>=1.03;
    if(smf==='sm9')  return (hc>ac&&hc>=3)&&aRatio<=0.97;
    if(smf==='sm10') return (hc>ac&&hc>=3)&&sld!==null&&sld<0;
    if(smf==='sm11') return (ac>hc&&ac>=4);
    if(smf==='sm12') return (hc>ac&&hc>=4);
  }
  if(smf==='sm13'||smf==='sm14'){
    // 💀 best-price indicator: HKJC offers the best price on a side vs both Macau & SBO
    // (same handicap line, both books present, strictly beats at least one).
    if(!(r.ASIALINE===r.ASIALINEMA && r.ASIALINE===r.ASIALINESB)) return false;
    var mh=r.ASIAHMAC, sh2=r.ASIAHSBO, ma2=r.ASIAAMAC, sa2=r.ASIAASBO;
    if(smf==='sm13'){ // skull on HOME (HKJC home best price) → study suggests Away
      if(!mh||!sh2||r.ASIAH==null) return false;
      return r.ASIAH>=mh && r.ASIAH>=sh2 && (r.ASIAH>mh || r.ASIAH>sh2);
    }
    if(smf==='sm14'){ // skull on AWAY (HKJC away best price) → study suggests Home
      if(!ma2||!sa2||r.ASIAA==null) return false;
      return r.ASIAA>=ma2 && r.ASIAA>=sa2 && (r.ASIAA>ma2 || r.ASIAA>sa2);
    }
  }
  return true;
}

// Grey out smart-money options with no matching UPCOMING (PREEVE) matches
function updateSmartOptions(){
  var upcoming=(typeof ALL!=='undefined'?ALL:[]).filter(function(r){ return r.STATUS==='PREEVE'; });
  function update(selId, passFn){
    var sel=document.getElementById(selId); if(!sel) return;
    Array.prototype.forEach.call(sel.options, function(opt){
      var v=opt.value;
      if(!v) return;
      var full=0;
      for(var j=0;j<upcoming.length;j++){ if(passFn(upcoming[j], v)) full++; }
      var base=opt.getAttribute('data-base')|| opt.textContent.replace(/\s*\(\d+\)\s*$/,'');
      opt.setAttribute('data-base', base);
      opt.disabled=false;
      opt.style.color = full===0 ? '#475569' : '';
      opt.textContent = base+' ('+full+')';
    });
  }
  update('smartSelect',  smartPass);
  update('smartSelect2', brPass);
}

function brPass(r, br){
  if(!br) return true;
  if(r.ASIAH==null||r.ASIAA==null) return false;
  var L=(1/r.ASIAH)/((1/r.ASIAH)+(1/r.ASIAA));
  var nz=function(v){return v!=null&&v!==0;};
  var mh=r.ASIAHMAC, ma=r.ASIAAMAC, sh=r.ASIAHSBO, sa=r.ASIAASBO;
  var macOk  = nz(mh)&&nz(ma)&&r.ASIALINE===r.ASIALINEMA;
  var sboOk  = nz(sh)&&nz(sa)&&r.ASIALINE===r.ASIALINESB;
  var bothOk = macOk&&sboOk;
  // Effective-line helpers (k=4.78 calibrated from your data). No line-match required —
  // each book just needs its own line and odds. Returns null if data missing.
  var EL_K=4.78;
  function leanFn(h,a){ return (h&&a&&h>0&&a>0)?(1/h)/((1/h)+(1/a)):null; }
  function effFn(line,L){ return (line==null||L==null)?null:(-parseFloat(line))+(L-0.5)*EL_K; }
  var effH = effFn(r.ASIALINE, L);
  var effM = (nz(mh)&&nz(ma)&&r.ASIALINEMA!=null) ? effFn(r.ASIALINEMA, leanFn(mh,ma)) : null;
  var effS = (nz(sh)&&nz(sa)&&r.ASIALINESB!=null) ? effFn(r.ASIALINESB, leanFn(sh,sa)) : null;
  switch(br){
    case 'br1': return macOk  && r.ASIAH>mh && r.ASIAA<ma && L<0.52;
    case 'br2': return macOk  && r.ASIAH<mh && r.ASIAA>ma && L>0.52;
    case 'br3': return macOk  && r.ASIAH>mh && r.ASIAA>ma && L<0.48;
    case 'br4': return macOk  && r.ASIAH>mh && r.ASIAA>ma && L>0.52;
    case 'br5': return sboOk  && r.ASIAH>sh && r.ASIAA<sa && L<0.52;
    case 'br6': return sboOk  && r.ASIAH<sh && r.ASIAA>sa && L>0.52;
    case 'br7': return bothOk && r.ASIAH>mh && r.ASIAH>sh && r.ASIAA<ma && r.ASIAA<sa;
    case 'br8': return bothOk && r.ASIAH<mh && r.ASIAH<sh && r.ASIAA>ma && r.ASIAA>sa && L>0.52;
    case 'br9':  return bothOk && mh>sh && ma<sa && L<0.48;
    case 'br10': return bothOk && mh>sh && ma<sa && L>0.52;
    case 'br11': return bothOk && mh<sh && ma>sa && L<0.48;
    case 'br12': return bothOk && mh<sh && ma>sa && L>0.52;
    // ── Observations from Effective Line tables — no line-match required ──
    // R13: HKJC effLine ≤ -0.10 below Macau effLine → bet H
    case 'br13': return effH!=null && effM!=null && (effH-effM)<=-0.10;
    // R14: HKJC effLine -0.10 to -0.05 below Macau → bet A
    case 'br14': { if(effH==null||effM==null) return false; var d=effH-effM; return d>-0.10 && d<=-0.05; }
    // R15: HKJC effLine within ±0.02 of SBO → bet A
    case 'br15': return effH!=null && effS!=null && Math.abs(effH-effS)<0.02;
  }
  return true;
}

function applyFilters(){
  var s=$('searchInput').value.toLowerCase(),cat=$('catSelect').value,st=$('statusSelect').value;
  var al=$('asialineSelect').value,dr=$('dateRangeSelect').value;
  var pf=$('predictSelect').value,ef=$('expertSelect').value,mf=$('marketSelect').value,vf=$('vigSelect').value;
  var lmf=$('lineMoveSelect').value,hmf=$('hMoveSelect').value,amf=$('aMoveSelect').value,smf=$('smartSelect').value,brf=$('smartSelect2').value;
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
      if(ef==='tied'){if(!expertTied(r))return false;}
      if(ef==='H-max-weak'){if(!e||el!=='H'||e.h>54)return false;}
      if(ef==='H-max-mod'){if(!e||el!=='H'||e.h<55||e.h>59)return false;}
      if(ef==='A-max-weak'){if(!e||el!=='A'||e.a>54)return false;}
      if(ef==='A-max-mod'){if(!e||el!=='A'||e.a<55||e.a>59)return false;}
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
    }
    // Market Lean filter
    if(mf||vf){
      if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0)return false;
      var rh2=1/r.ASIAH,ra2=1/r.ASIAA,vig2=rh2+ra2;
      var fh2=rh2/vig2*100,vigPct2=(vig2-1)*100;
      if(mf==='balanced'&&(fh2<48||fh2>52))return false;
      if(mf==='dead-even'&&(fh2<49||fh2>51))return false;
      if(mf==='h-50to55'&&(fh2<50||fh2>=55))return false;
      if(mf==='h-slight'&&(fh2<52||fh2>=55))return false;
      if(mf==='h-clear'&&fh2<55)return false;
      if(mf==='a-45to50'&&(fh2<45||fh2>=50))return false;
      if(mf==='a-slight'&&(fh2<45||fh2>=48))return false;
      if(mf==='a-clear'&&fh2>=45)return false;
      if(vf==='vig-tight'&&vigPct2>=5)return false;
      if(vf==='vig-normal'&&(vigPct2<5||vigPct2>=6))return false;
      if(vf==='vig-wide'&&(vigPct2<6||vigPct2>=7))return false;
      if(vf==='vig-soft'&&vigPct2<7)return false;
    }
    // Line / H / A movement filters
    if(lmf){
      if(r.ASIALINE==null||!(r.ASIAHLN>0&&r.ASIAALN>0)){return false;} // need a valid opening snapshot
      var ld=r.ASIALINE-(r.ASIALINELN||0),la=Math.abs(ld);
      if(lmf==='up'&&ld<=0)return false;
      if(lmf==='up2'&&ld<0.5)return false;
      if(lmf==='up3'&&ld<1.0)return false;
      if(lmf==='down'&&ld>=0)return false;
      if(lmf==='down2'&&ld>-0.5)return false;
      if(lmf==='down3'&&ld>-1.0)return false;
      if(lmf==='flat'&&ld!==0)return false;
    }
    if(hmf){
      if(r.ASIAH==null||!(r.ASIAHLN>0)){return false;} // opening H odds missing (stored as 0)
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
      if(r.ASIAA==null||!(r.ASIAALN>0)){return false;} // opening A odds missing (stored as 0)
      var ad=r.ASIAA-r.ASIAALN;
      if(amf==='short'&&ad>=0)return false;
      if(amf==='short2'&&(ad>=0||r.ASIAA>r.ASIAALN*0.95))return false;
      if(amf==='short3'&&(ad>=0||r.ASIAA>r.ASIAALN*0.90))return false;
      if(amf==='drift'&&ad<=0)return false;
      if(amf==='drift2'&&(ad<=0||r.ASIAA<r.ASIAALN*1.05))return false;
      if(amf==='drift3'&&(ad<=0||r.ASIAA<r.ASIAALN*1.10))return false;
      if(amf==='flat'&&ad!==0)return false;
    }
    // JC Expert Pick filter
    if(!applyJCPickFilter(r)) return false;
    // Smart Money filter
    if(smf){
      var sgl=r.ASIALINE,sln=r.ASIALINELN,sh=r.ASIAH,sa=r.ASIAA;
      if(!smartPass(r, smf)) return false;
    }
    // Smart Money 2 (Book Rules) — runs independently of Smart Money 1
    if(brf){
      if(!brPass(r, brf)) return false;
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

function toggleMainFilters(){
  var panel=document.getElementById('filtersMain');
  var arrow=document.getElementById('mainFilterArrow');
  var lbl=document.getElementById('mainFilterLabel');
  var collapsed=panel.classList.toggle('collapsed');
  if(arrow) arrow.style.transform=collapsed?'rotate(-90deg)':'rotate(0deg)';
  if(lbl) lbl.textContent=collapsed?'Show Filters':'Hide Filters';
}

function toggleFilters(){
  var panel=document.getElementById('filtersPanel');
  var arrow=document.getElementById('secFilterArrow');
  var lbl=document.getElementById('filterToggleLabel');
  var collapsed=panel.classList.toggle('collapsed');
  if(arrow) arrow.style.transform=collapsed?'rotate(-90deg)':'rotate(0deg)';
  if(lbl) lbl.textContent=collapsed?'More Filters':'Less Filters';
}

function clearFilters(){
  $('searchInput').value='';$('catSelect').value='';$('statusSelect').value='';$('asialineSelect').value='';
  $('dateRangeSelect').value='';$('predictSelect').value='';$('expertSelect').value='';$('marketSelect').value='';$('vigSelect').value='';$('lineMoveSelect').value='';$('hMoveSelect').value='';$('aMoveSelect').value='';$('smartSelect').value='';$('smartSelect2').value='';
  clearJCPick();
  pg=1;applyFilters();
}
// ═══════════════════════════════════════════════
// JC EXPERT PICK FILTER
// ═══════════════════════════════════════════════
var JC_EXPERTS = [
  { key:'JCTIPSUM',  label:'JC Sum',  color:'#4ade80' },
  { key:'JCTIPSID',  label:'JC SID',  color:'#60a5fa' },
  { key:'TIPSIDMAC', label:'SID Mac', color:'#f87171' },
  { key:'TIPSONID',  label:'ON ID',   color:'#a78bfa' },
  { key:'TIPSGEM',   label:'Gem AI',  color:'#fbbf24' },
  { key:'TIPSGPT',   label:'GPT AI',  color:'#e879f9' }
];
var JC_TIPS = ['H','D','A'];

// State: { JCTIPSUM: 'H'|'D'|'A'|null, ... }  null = no filter
var jcPickState = {};
JC_EXPERTS.forEach(function(e){ jcPickState[e.key] = null; });

// AND mode: all set experts must match; OR mode: any set expert matches
var jcPickMode = 'AND';
// Count-based preset: null | 'H2' | 'H3plus' | 'A2' | 'A3plus'
var jcCountMode = null;

var jcPickPanelOpen = false;

function initJCPickFilter(){
  renderJCPickFilter();
}

function toggleJCPickPanel(){
  jcPickPanelOpen = !jcPickPanelOpen;
  var wrap  = document.getElementById('jcPickFilter');
  var arrow = document.getElementById('jcPickArrow');
  if(wrap){
    wrap.style.display = jcPickPanelOpen ? 'flex' : 'none';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '5px';
  }
  if(arrow) arrow.style.transform = jcPickPanelOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function renderJCPickFilter(){
  var wrap = document.getElementById('jcPickFilter');
  if(!wrap) return;

  // Count preset buttons
  var countPresets = [
    { v:'H2pure',  label:'H≥2 pure',  desc:'2+ experts tip H, none tip D or A' },
    { v:'H3plus',  label:'H≥3',       desc:'3+ experts tip H (D/A allowed)' },
    { v:'A2pure',  label:'A≥2 pure',  desc:'2+ experts tip A, none tip D or H' },
    { v:'A3plus',  label:'A≥3',       desc:'3+ experts tip A (D/H allowed)' },
  ];
  var countRow = '<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1e293b">'
    +'<div style="font-size:9px;color:#e2e8f0;font-family:monospace;margin-bottom:4px">COUNT PRESETS (pure signal — no mixed picks):</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px">'
    + countPresets.map(function(p){
        var on = jcCountMode===p.v;
        var col = p.v[0]==='H'?'#f87171':'#60a5fa';
        return '<button onclick="setJCCount(\''+p.v+'\')" title="'+p.desc+'" style="'
          +'padding:3px 10px;border-radius:4px;border:1px solid '+(on?col:'#1e293b')+';'
          +'background:'+(on?col+'22':'#0f172a')+';color:'+(on?col:'#cbd5e1')+';'
          +'font-size:10px;font-weight:700;cursor:pointer;font-family:monospace">'+p.label+'</button>';
      }).join('')
    +'</div></div>';

  // Mode toggle row (only relevant when using individual picks below)
  var modeRow = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
    +'<span style="font-size:9px;color:#e2e8f0;font-family:monospace;min-width:36px">Logic:</span>'
    +['AND','OR'].map(function(m){
      var on = jcPickMode===m;
      return '<button onclick="setJCMode(\''+m+'\')" style="padding:1px 8px;border-radius:3px;border:1px solid '+(on?'#60a5fa':'#1e293b')+';background:'+(on?'#60a5fa22':'#0f172a')+';color:'+(on?'#60a5fa':'#cbd5e1')+';font-size:10px;font-weight:700;cursor:pointer;font-family:monospace">'+m+'</button>';
    }).join('')
    +'<span style="font-size:9px;color:#cbd5e1;margin-left:4px">'+(jcPickMode==='AND'?'All selected must match':'Any selected matches')+'</span>'
    +'</div>';

  // One row per expert
  var rows = JC_EXPERTS.map(function(e){
    var sel = jcPickState[e.key];
    var btnStyle = function(tip){
      var on = sel===tip;
      var tipColor = tip==='H'?'#f87171':tip==='D'?'#a78bfa':'#60a5fa';
      return 'padding:2px 10px;border-radius:4px;border:1px solid '+(on?tipColor:'#1e293b')+';background:'+(on?tipColor+'22':'#0f172a')+';color:'+(on?tipColor:'#cbd5e1')+';font-size:11px;font-weight:700;cursor:pointer;font-family:monospace';
    };
    return '<div style="display:flex;align-items:center;gap:6px">'
      +'<span style="font-size:10px;font-weight:700;min-width:52px;color:'+e.color+';font-family:monospace">'+e.label+'</span>'
      +JC_TIPS.map(function(tip){
        return '<button onclick="toggleJCPick(\''+e.key+'\',\''+tip+'\')" style="'+btnStyle(tip)+'">'+tip+'</button>';
      }).join('')
      +(sel?'<button onclick="toggleJCPick(\''+e.key+'\',null)" style="padding:2px 6px;border-radius:3px;border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;font-size:9px;cursor:pointer">&#x2715;</button>':'')
      +'</div>';
  }).join('');

  wrap.innerHTML = countRow + modeRow + rows;
}

function setJCCount(preset){
  // Toggle off if already active
  jcCountMode = (jcCountMode===preset) ? null : preset;
  // Clear individual picks when using a count preset
  if(jcCountMode){
    JC_EXPERTS.forEach(function(e){ jcPickState[e.key]=null; });
  }
  renderJCPickFilter();
  pg=1; applyFilters();
}

function toggleJCPick(expertKey, tip){
  jcCountMode = null; // clear count preset when using individual picks
  jcPickState[expertKey] = (jcPickState[expertKey]===tip) ? null : tip;
  renderJCPickFilter();
  pg=1; applyFilters();
}

function setJCMode(mode){
  jcPickMode = mode;
  renderJCPickFilter();
  pg=1; applyFilters();
}

function clearJCPick(){
  JC_EXPERTS.forEach(function(e){ jcPickState[e.key]=null; });
  jcPickMode='AND';
  jcCountMode=null;
  renderJCPickFilter();
}

function applyJCPickFilter(r){
  function ts(v){
    if(!v) return null;
    var u=String(v).trim().toUpperCase();
    if(u==='H'||u==='1H') return 'H';
    if(u==='D'||u==='1D') return 'D';
    if(u==='A'||u==='1A') return 'A';
    return null;
  }

  // For Gem/GPT, derive the pick from the raw count fields (GEMH/GEMD/GEMA, GPTH/GPTD/GPTA)
  // since the TIPSGEM/TIPSGPT string fields are sparse (mostly empty). If the AI gave
  // no votes at all, fall back to the string field.
  function pick(key){
    if(key==='TIPSGEM'){
      var h=r.GEMH||0, d=r.GEMD||0, a=r.GEMA||0;
      if(h||d||a){
        if(h>d && h>a) return 'H';
        if(a>h && a>d) return 'A';
        if(d>h && d>a) return 'D';
        return null; // tied — no clear pick
      }
      return ts(r.TIPSGEM);
    }
    if(key==='TIPSGPT'){
      var h2=r.GPTH||0, d2=r.GPTD||0, a2=r.GPTA||0;
      if(h2||d2||a2){
        if(h2>d2 && h2>a2) return 'H';
        if(a2>h2 && a2>d2) return 'A';
        if(d2>h2 && d2>a2) return 'D';
        return null;
      }
      return ts(r.TIPSGPT);
    }
    return ts(r[key]);
  }

  // Count-based preset filter
  if(jcCountMode){
    var tips = JC_EXPERTS.map(function(e){ return pick(e.key); });
    var nH = tips.filter(function(t){return t==='H';}).length;
    var nD = tips.filter(function(t){return t==='D';}).length;
    var nA = tips.filter(function(t){return t==='A';}).length;
    if(jcCountMode==='H2pure') return nH>=2 && nD===0 && nA===0;
    if(jcCountMode==='H3plus') return nH>=3;
    if(jcCountMode==='A2pure') return nA>=2 && nD===0 && nH===0;
    if(jcCountMode==='A3plus') return nA>=3;
    return true;
  }

  // Individual pick filter
  var active = JC_EXPERTS.filter(function(e){ return jcPickState[e.key]!==null; });
  if(!active.length) return true;

  if(jcPickMode==='AND'){
    return active.every(function(e){ return pick(e.key)===jcPickState[e.key]; });
  } else {
    return active.some(function(e){ return pick(e.key)===jcPickState[e.key]; });
  }
}
