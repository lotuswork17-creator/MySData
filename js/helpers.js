// helpers.js

var ALL=[],filtered=[],sortCol='DATE',sortDir=-1,pg=1,PG=30,selIdx=null;
var isMobile=window.innerWidth<600;
if(isMobile) PG=20;

function $(id){return document.getElementById(id);}


function expertScore(r){
  function ts(v){if(!v)return null;var u=String(v).toUpperCase();
    if(u==='H'||u==='1H'||u==='AH')return'H';
    if(u==='D'||u==='1D'||u==='AD')return'D';
    if(u==='A'||u==='1A'||u==='AA')return'A';
    return null;}
  var th=(ts(r.JCTIPSUM)==='H'?1:0)+(ts(r.JCTIPSID)==='H'?1:0)+(ts(r.TIPSIDMAC)==='H'?1:0)+(ts(r.TIPSONID)==='H'?1:0)+(r.GEMH||0)+(r.GPTH||0);
  var td=(ts(r.JCTIPSUM)==='D'?1:0)+(ts(r.JCTIPSID)==='D'?1:0)+(ts(r.TIPSIDMAC)==='D'?1:0)+(ts(r.TIPSONID)==='D'?1:0)+(r.GEMD||0)+(r.GPTD||0);
  var ta=(ts(r.JCTIPSUM)==='A'?1:0)+(ts(r.JCTIPSID)==='A'?1:0)+(ts(r.TIPSIDMAC)==='A'?1:0)+(ts(r.TIPSONID)==='A'?1:0)+(r.GEMA||0)+(r.GPTA||0);
  var tt=th+td+ta;
  if(!tt)return null;
  return{h:Math.round(th*100/tt),d:Math.round(td*100/tt),a:Math.round(ta*100/tt)};
}

function lowConfidence(r){
  function ts(v){if(!v)return null;var u=String(v).toUpperCase();
    if(u==='H'||u==='1H'||u==='AH')return'H';
    if(u==='D'||u==='1D'||u==='AD')return'D';
    if(u==='A'||u==='1A'||u==='AA')return'A';
    return null;}
  var tipCount=[r.JCTIPSUM,r.JCTIPSID,r.TIPSIDMAC,r.TIPSONID].filter(function(v){return ts(v)!==null;}).length;
  var gemGptTotal=(r.GEMH||0)+(r.GEMD||0)+(r.GEMA||0)+(r.GPTH||0)+(r.GPTD||0)+(r.GPTA||0);
  return tipCount<2||gemGptTotal<3;
}

function asiaOutcome(r){
  if(r.STATUS!=='Result'||r.ASIALINE==null||r.RESULTH==null||r.RESULTA==null)return null;
  var margin=Math.round((r.RESULTH-r.RESULTA+r.ASIALINE)*4)/4;
  if(margin>=0.5)return'ww';
  if(margin===0.25)return'wh';
  if(margin===0)return'dd';
  if(margin===-0.25)return'lh';
  return'lw';
}

function predictLead(r){
  var ph=r.PREDICTH||0,pd=r.PREDICTD||0,pa=r.PREDICTA||0;
  if(!ph&&!pd&&!pa)return null;
  if(ph>=pd&&ph>=pa)return'H';
  if(pd>=ph&&pd>=pa)return'D';
  return'A';
}

function expertLead(r){
  var e=expertScore(r);if(!e)return null;
  if(e.h>=e.d&&e.h>=e.a)return'H';
  if(e.d>=e.h&&e.d>=e.a)return'D';
  return'A';
}

function asiaLineArrows(val,ln,noData){
  if(val==null)return'—';
  var s=String(val);
  if(noData||ln==null||ln===val)return s;
  var diff=Math.round((val-ln)*100)/100;
  if(diff===0)return s;
  var abs=Math.abs(diff);
  var n=abs>=1.0?3:abs>=0.5?2:1;
  var arrow=diff<0?'▼':'▲';
  var color=diff<0?'#f87171':'#60a5fa';
  var arrows=arrow.repeat(n);
  return s+'<span style="color:'+color+';font-size:10px;margin-left:2px">'+arrows+'</span>';
}

function asiaOddsArrows(lat,opn){
  if(lat==null||opn==null||opn===0||lat===0||lat===opn)return lat!=null?String(lat):'—';
  var s=String(lat);
  var n,arr,col;
  if(lat<opn){n=lat<opn*0.9?3:lat<opn*0.95?2:1;arr='▼';col='#f87171';}
  else{n=lat>opn*1.1?3:lat>opn*1.05?2:1;arr='▲';col='#60a5fa';}
  return s+'<span style="color:'+col+';font-size:10px;margin-left:2px">'+arr.repeat(n)+'</span>';
}

function vigSymbol(r){
  if(!r.ASIAH||!r.ASIAA||r.ASIAH<=0||r.ASIAA<=0)return '';
  var v=(1/r.ASIAH+1/r.ASIAA-1)*100;
  if(v<5)return '<span title="Tight vig &lt;5%" style="font-size:10px;opacity:.8">💎</span>';
  if(v<6)return '';
  if(v<7)return '<span title="Wide vig 6-7%" style="font-size:10px;opacity:.8">💎💎</span>';
  return '<span title="Soft vig ≥7%" style="font-size:10px;opacity:.8">💎💎💎</span>';
}

function fmtTime(t){var s=String(t).padStart(4,'0');return s.slice(0,-2)+':'+s.slice(-2);}

function hl(text,q){if(!q)return text;var i=text.toLowerCase().indexOf(q.toLowerCase());if(i===-1)return text;return text.slice(0,i)+'<mark>'+text.slice(i,i+q.length)+'</mark>'+text.slice(i+q.length);}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}