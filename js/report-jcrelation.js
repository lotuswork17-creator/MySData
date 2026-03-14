// ── report-jcrelation.js — Tab 11: JC Expert × Line × Lean Relationship Analysis ──
// Explores counter and positive relationships between JC expert tips,
// Asia Handicap Line, and Market Lean. Surfaces verified betting rules.

// ── Tip encoding maps (mirrors report-ml.js) ──
var JCR_TIPSUM_MAP  = {'H':1.0,'1H':0.8,'D':0.6,'1D':0.4,'B':0.2,'1B':0.0,'1A':-0.8,'A':-1.0};
var JCR_TIPSID_MAP  = {'H':1.0,'D':0.3,'B':0.0,'S':0.0,'A':-1.0};
var JCR_TIPSMAC_MAP = {'H':1.0,'D':0.3,'A':-1.0};
var JCR_TIPSON_MAP  = {'H':1.0,'1H':1.0,'FH':1.0,'A':-1.0,'1A':-1.0,'FA':-1.0,'D':0,'1D':0,'B':0,'1B':0,'S':0,'1S':0,'CB':0,'CS':0,'1b':0};

function jcrEncodeTip(val, map){
  if(val == null) return 0;
  var s = String(val).trim();
  return map.hasOwnProperty(s) ? map[s] : 0;
}

function jcrLean(r){
  var h = parseFloat(r.ASIAH)||0, a = parseFloat(r.ASIAA)||0;
  if(!h || !a) return null;
  var vh = 1/h, va = 1/a;
  return vh/(vh+va);
}

function jcrPnl(r){
  var gh = parseFloat(r.RESULTH)||0, ga = parseFloat(r.RESULTA)||0;
  var line = parseFloat(r.ASIALINE)||0;
  var oh = parseFloat(r.ASIAH)||0, oa = parseFloat(r.ASIAA)||0;
  if(!oh || !oa) return null;
  var adj = gh - ga + line;
  if(Math.abs(adj) < 0.01) return { h:0, a:0 };
  if(adj > 0.5)  return { h: oh-1, a: -1 };
  if(adj > 0.01) return { h: (oh-1)/2, a: -0.5 };
  if(adj < -0.5) return { h: -1, a: oa-1 };
  if(adj < -0.01)return { h: -0.5, a: (oa-1)/2 };
  return { h:0, a:0 };
}

// ── computeJCRelation(results) ──
function computeJCRelation(results, allRecords){
  var TIP_MAP_DIR = {
    'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,
    'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0
  };

  var data = results.filter(function(r){
    return r.STATUS === 'Result' &&
      typeof r.RESULTH === 'number' && r.RESULTA != null &&
      r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });

  var n = data.length;
  var splitIdx = Math.floor(n * 0.75);

  var LINES = [-1.0, -0.75, -0.25, 0.0, 0.25, 0.75, 1.0];
  var EXPERTS = [
    { key:'JCTIPSUM',  label:'JC Summary',  short:'JCSUM' },
    { key:'JCTIPSID',  label:'JC SID',      short:'JCSID' },
    { key:'TIPSIDMAC', label:'MAC',          short:'MAC'   },
    { key:'TIPSONID',  label:'ON ID',        short:'ONID'  },
  ];

  // ── Build full relationship matrix ──
  // For each expert × line × tip direction: ROI betting WITH and AGAINST
  var matrix = [];
  EXPERTS.forEach(function(exp){
    LINES.forEach(function(line_val){
      ['H','A'].forEach(function(tip_label){
        var tip_dir = tip_label === 'H' ? 1 : -1;

        var allGrp = [];
        data.forEach(function(r, i){
          var tv = TIP_MAP_DIR[String(r[exp.key]||'')];
          if(tv == null || tv !== tip_dir) return;
          var lv = parseFloat(r.ASIALINE)||0;
          if(Math.abs(lv - line_val) > 0.01) return;
          var lk = jcrLean(r);
          if(lk == null) return;
          var pnl = jcrPnl(r);
          if(!pnl) return;
          allGrp.push({ hp: pnl.h, ap: pnl.a, lean: lk, idx: i });
        });

        if(allGrp.length < 30) return;

        var train = allGrp.filter(function(g){ return g.idx < splitIdx; });
        var test  = allGrp.filter(function(g){ return g.idx >= splitIdx; });
        if(train.length < 15 || test.length < 10) return;

        function roiWith(grp)  { return !grp.length ? 0 : (grp.reduce(function(s,g){ return s+(tip_dir===1?g.hp:g.ap); }, 0)/grp.length*100); }
        function roiAgainst(grp){ return !grp.length ? 0 : (grp.reduce(function(s,g){ return s+(tip_dir===1?g.ap:g.hp); }, 0)/grp.length*100); }

        var lean_avg = allGrp.reduce(function(s,g){return s+g.lean;},0)/allGrp.length;
        var rw_all  = roiWith(allGrp),   rw_tr = roiWith(train),   rw_te = roiWith(test);
        var ra_all  = roiAgainst(allGrp), ra_tr = roiAgainst(train), ra_te = roiAgainst(test);

        var bet_with    = tip_dir === 1 ? 'H' : 'A';
        var bet_against = tip_dir === 1 ? 'A' : 'H';

        // Verify: both train+test positive
        var with_verified    = rw_tr > 0 && rw_te > 0 && rw_all > 0;
        var against_verified = ra_tr > 0 && ra_te > 0 && ra_all > 0;
        var with_strong      = rw_tr > 0 && rw_te > 0 && rw_all > 3;
        var against_strong   = ra_tr > 0 && ra_te > 0 && ra_all > 3;

        matrix.push({
          exp: exp.key, exp_label: exp.label, exp_short: exp.short,
          line: line_val, tip: tip_label, lean_avg: Math.round(lean_avg*1000)/1000,
          n: allGrp.length, n_train: train.length, n_test: test.length,
          with_bet: bet_with, against_bet: bet_against,
          roi_with:    { all: Math.round(rw_all*10)/10, train: Math.round(rw_tr*10)/10, test: Math.round(rw_te*10)/10 },
          roi_against: { all: Math.round(ra_all*10)/10, train: Math.round(ra_tr*10)/10, test: Math.round(ra_te*10)/10 },
          with_verified: with_verified, against_verified: against_verified,
          with_strong: with_strong, against_strong: against_strong,
        });
      });
    });
  });

  // ── WITH LEAN ≥50% filter for additional rules ──
  var matrixWithLean = [];
  EXPERTS.forEach(function(exp){
    LINES.forEach(function(line_val){
      ['H','A'].forEach(function(tip_label){
        var tip_dir = tip_label === 'H' ? 1 : -1;

        var allGrp = [];
        data.forEach(function(r, i){
          var tv = TIP_MAP_DIR[String(r[exp.key]||'')];
          if(tv == null || tv !== tip_dir) return;
          var lv = parseFloat(r.ASIALINE)||0;
          if(Math.abs(lv - line_val) > 0.01) return;
          var lk = jcrLean(r);
          if(lk == null || lk < 0.50) return;
          var pnl = jcrPnl(r);
          if(!pnl) return;
          allGrp.push({ hp: pnl.h, ap: pnl.a, lean: lk, idx: i });
        });

        if(allGrp.length < 40) return;

        var train = allGrp.filter(function(g){ return g.idx < splitIdx; });
        var test  = allGrp.filter(function(g){ return g.idx >= splitIdx; });
        if(train.length < 15 || test.length < 10) return;

        function roiSide(grp, side){ return !grp.length ? 0 : (grp.reduce(function(s,g){ return s+g[side]; }, 0)/grp.length*100); }

        var ra_all = roiSide(allGrp, tip_dir===1?'ap':'hp');
        var ra_tr  = roiSide(train,  tip_dir===1?'ap':'hp');
        var ra_te  = roiSide(test,   tip_dir===1?'ap':'hp');
        var rw_all = roiSide(allGrp, tip_dir===1?'hp':'ap');
        var rw_tr  = roiSide(train,  tip_dir===1?'hp':'ap');
        var rw_te  = roiSide(test,   tip_dir===1?'hp':'ap');

        var lean_avg = allGrp.reduce(function(s,g){return s+g.lean;},0)/allGrp.length;
        if(ra_tr > 0 && ra_te > 0 && ra_all > 0){
          matrixWithLean.push({
            exp: exp.key, exp_label: exp.label, exp_short: exp.short,
            line: line_val, tip: tip_label, lean_avg: Math.round(lean_avg*1000)/1000,
            lean_filter: 0.50,
            n: allGrp.length, n_train: train.length, n_test: test.length,
            bet: tip_dir===1?'A':'H', type: 'COUNTER',
            roi: { all: Math.round(ra_all*10)/10, train: Math.round(ra_tr*10)/10, test: Math.round(ra_te*10)/10 }
          });
        }
        if(rw_tr > 0 && rw_te > 0 && rw_all > 0){
          matrixWithLean.push({
            exp: exp.key, exp_label: exp.label, exp_short: exp.short,
            line: line_val, tip: tip_label, lean_avg: Math.round(lean_avg*1000)/1000,
            lean_filter: 0.50,
            n: allGrp.length, n_train: train.length, n_test: test.length,
            bet: tip_dir===1?'H':'A', type: 'WITH',
            roi: { all: Math.round(rw_all*10)/10, train: Math.round(rw_tr*10)/10, test: Math.round(rw_te*10)/10 }
          });
        }
      });
    });
  });

  // ── BOTH JC experts agree ──
  var bothJC = [];
  LINES.forEach(function(line_val){
    ['H','A'].forEach(function(tip_label){
      var tip_dir = tip_label === 'H' ? 1 : -1;
      var allGrp = [];
      data.forEach(function(r, i){
        var ts = TIP_MAP_DIR[String(r.JCTIPSUM||'')];
        var td = TIP_MAP_DIR[String(r.JCTIPSID||'')];
        if(ts == null || td == null || ts !== tip_dir || td !== tip_dir) return;
        var lv = parseFloat(r.ASIALINE)||0;
        if(Math.abs(lv - line_val) > 0.01) return;
        var lk = jcrLean(r);
        if(lk == null) return;
        var pnl = jcrPnl(r);
        if(!pnl) return;
        allGrp.push({ hp: pnl.h, ap: pnl.a, lean: lk, idx: i });
      });
      if(allGrp.length < 40) return;
      var train = allGrp.filter(function(g){ return g.idx < splitIdx; });
      var test  = allGrp.filter(function(g){ return g.idx >= splitIdx; });
      if(train.length < 15 || test.length < 10) return;

      ['H','A'].forEach(function(bet){
        var side = bet === 'H' ? 'hp' : 'ap';
        function roi(grp){ return !grp.length ? 0 : grp.reduce(function(s,g){return s+g[side];},0)/grp.length*100; }
        var ra = roi(allGrp), rt = roi(train), rte = roi(test);
        if(rt > 0 && rte > 0 && ra > 3){
          bothJC.push({
            tip: tip_label, line: line_val, bet: bet,
            n: allGrp.length, n_train: train.length, n_test: test.length,
            roi: { all: Math.round(ra*10)/10, train: Math.round(rt*10)/10, test: Math.round(rte*10)/10 }
          });
        }
      });
    });
  });

  // ── Upcoming matches: check which verified rules fire ──
  var upcomingSrc = (allRecords || results);
  var upcoming = upcomingSrc.filter(function(r){
    return r.STATUS === 'PREEVE' && r.ASIALINE != null && r.ASIAH && r.ASIAA;
  });
  upcoming.sort(function(a,b){ return (a.DATE||'').localeCompare(b.DATE||'')||(a.TIME||0)-(b.TIME||0); });

  // Build verified rule list for scanning upcoming
  // Threshold: ROI > 2% on all data, AND both train & test positive
  var MIN_ROI = 2.0;
  var verifiedRules = [];
  var _vrSeen = {};
  function _addRule(rule){
    if(rule.roi <= MIN_ROI) return;
    if(rule.train <= 0 || rule.test <= 0) return;
    var k = rule.exp+'|'+rule.tip_dir+'|'+rule.line+'|'+(rule.lean_min||0)+'|'+rule.bet;
    if(_vrSeen[k]) return;  // dedup: keep first (highest ROI)
    _vrSeen[k] = true;
    verifiedRules.push(rule);
  }
  // From base matrix (no lean filter)
  matrix.forEach(function(m){
    if(m.against_verified){
      _addRule({
        label: m.exp_short+' tips '+m.tip+' + Line='+(m.line>=0?'+':'')+m.line.toFixed(2),
        exp: m.exp, tip_dir: m.tip==='H'?1:-1, line: m.line, lean_min: null,
        bet: m.against_bet,
        roi: m.roi_against.all, train: m.roi_against.train, test: m.roi_against.test,
        n: m.n, type: 'COUNTER'
      });
    }
    if(m.with_verified){
      _addRule({
        label: m.exp_short+' tips '+m.tip+' + Line='+(m.line>=0?'+':'')+m.line.toFixed(2)+' → follow',
        exp: m.exp, tip_dir: m.tip==='H'?1:-1, line: m.line, lean_min: null,
        bet: m.with_bet,
        roi: m.roi_with.all, train: m.roi_with.train, test: m.roi_with.test,
        n: m.n, type: 'WITH'
      });
    }
  });
  // From lean-filtered matrix (includes both COUNTER and WITH)
  matrixWithLean.forEach(function(m){
    _addRule({
      label: m.exp_short+' tips '+m.tip+' + Line='+(m.line>=0?'+':'')+m.line.toFixed(2)+' + Lean≥50%',
      exp: m.exp, tip_dir: m.tip==='H'?1:-1, line: m.line, lean_min: 0.50,
      bet: m.bet,
      roi: m.roi.all, train: m.roi.train, test: m.roi.test,
      n: m.n, type: m.type
    });
  });
  // Sort by ROI desc
  verifiedRules.sort(function(a,b){ return b.roi - a.roi; });

  // Scan upcoming for rule fires
  var TIP_MAP_DIR2 = { 'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0 };
  var upcomingAlerts = [];
  upcoming.forEach(function(r){
    var fired = [];
    verifiedRules.forEach(function(rule){
      var tv = TIP_MAP_DIR2[String(r[rule.exp]||'')];
      if(tv == null || tv !== rule.tip_dir) return;
      var lv = parseFloat(r.ASIALINE)||0;
      if(Math.abs(lv - rule.line) > 0.01) return;
      if(rule.lean_min){
        var lk = jcrLean(r);
        if(lk == null || lk < rule.lean_min) return;
      }
      fired.push(rule);
    });
    if(fired.length){
      var lk = jcrLean(r);
      upcomingAlerts.push({ r: r, rules: fired, lean: lk });
    }
  });

  // ── Past bets: last 50 results where at least one verified rule fired ──
  var TIP_MAP_DIR2 = { 'H':1,'1H':1,'FH':1,'A':-1,'1A':-1,'FA':-1,'D':0,'1D':0,'B':0,'1B':0,'1b':0,'S':0,'1S':0,'CB':0,'CS':0 };
  var pastBets = [];
  data.slice().reverse().forEach(function(r){
    if(pastBets.length >= 50) return;
    var fired = [];
    verifiedRules.forEach(function(rule){
      var tv = TIP_MAP_DIR2[String(r[rule.exp]||'')];
      if(tv == null || tv !== rule.tip_dir) return;
      var lv = parseFloat(r.ASIALINE)||0;
      if(Math.abs(lv - rule.line) > 0.01) return;
      if(rule.lean_min){ var lk2=jcrLean(r); if(lk2==null||lk2<rule.lean_min) return; }
      fired.push(rule);
    });
    if(!fired.length) return;
    var pnl = jcrPnl(r);
    if(!pnl) return;
    var adj2 = Math.round((parseFloat(r.RESULTH)||0 - (parseFloat(r.RESULTA)||0) + (parseFloat(r.ASIALINE)||0)) * 4) / 4;
    var outcome = adj2 > 0.25 ? 'HW' : adj2 === 0.25 ? 'HH' : adj2 === 0 ? 'P' : adj2 === -0.25 ? 'AH' : 'AW';
    pastBets.push({ r: r, rules: fired, pnl: pnl, outcome: outcome });
  });

  return {
    matrix: matrix,
    matrixWithLean: matrixWithLean,
    bothJC: bothJC,
    verifiedRules: verifiedRules,
    upcomingAlerts: upcomingAlerts,
    pastBets: pastBets,
    nRecords: n,
    splitIdx: splitIdx,
  };
}

// ── renderJCRelation(RD) ──
function renderJCRelation(RD){
  var el = document.getElementById('tab11');
  if(!el) return;

  // Auto-compute if not already done
  if(!RD.jcrelation){
    if(typeof computeJCRelation === 'function' && RD.results){
      RD.jcrelation = computeJCRelation(RD.results);
    } else {
      el.innerHTML = '<div style="padding:24px;color:#f87171">Error: computeJCRelation not available.</div>';
      return;
    }
  }

  var jcr = RD.jcrelation;
  var h = '';

  h += '<div class="rpt-title">🔬 JC Expert Relationship Analysis</div>';
  h += '<div class="rpt-sub">How JC expert tips interact with Asia Handicap Line and Market Lean. Counter-relationships = experts are systematically wrong in specific conditions. Positive relationships = follow the expert. All rules verified on both train (75%) and test (25%) splits.</div>';

  // ── SECTION 1: Auto-Apply Rules to Upcoming Matches ──
  h += '<div style="margin-bottom:20px">';
  h += '<div class="rpt-title" style="margin-bottom:4px">🎯 Auto-Apply Rules to Upcoming Matches</div>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:10px">All verified rules automatically scanned against upcoming matches. Rules fire on first-match-wins basis (highest ROI rule listed per match). All 4 experts (MAC / JCSUM / JCSID / ONID) included.</div>';

  if(!jcr.upcomingAlerts.length){
    h += '<div style="padding:14px;color:#475569;font-size:12px;font-style:italic;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">No upcoming matches currently match any verified rule. Check back when new odds are available.</div>';
  } else {
    // ── Quick summary table ──
    h += '<div style="margin-bottom:12px">';
    h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Quick Scan Summary</div>';
    h += '<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
    h += '<th>Date / Time</th><th>Match</th><th class="num">Line</th><th class="num">AH</th><th class="num">AA</th><th class="num">Lean</th>';
    h += '<th class="num">Bet</th><th class="num">Type</th><th>Rule Fired</th><th class="num">N</th><th class="num">Est ROI</th>';
    h += '<th class="num">Tips</th>';
    h += '</tr></thead><tbody>';

    jcr.upcomingAlerts.forEach(function(alert){
      var r = alert.r;
      var topRule = alert.rules[0];
      var betCol  = topRule.bet === 'H' ? '#f87171' : '#60a5fa';
      var typeCol = topRule.type === 'COUNTER' ? '#fbbf24' : '#4ade80';
      var typeLabel = topRule.type === 'COUNTER' ? '⚡' : '✓';
      var leanPct = alert.lean ? Math.round(alert.lean*100)+'%' : '—';
      var lineStr = (parseFloat(r.ASIALINE)>=0?'+':'')+parseFloat(r.ASIALINE).toFixed(2);
      var roiCol  = topRule.roi >= 7 ? '#4ade80' : topRule.roi >= 4 ? '#a3e635' : '#94a3b8';
      var multiMark = alert.rules.length > 1 ? ' <span style="color:#a78bfa;font-size:8px">+'+( alert.rules.length-1)+'</span>' : '';

      // Tips mini-badge
      var tipFields = [{key:'JCTIPSUM',label:'JCS'},{key:'JCTIPSID',label:'SID'},{key:'TIPSIDMAC',label:'MAC'},{key:'TIPSONID',label:'ONI'}];
      var tipStr = tipFields.map(function(tf){
        var tv = r[tf.key];
        if(!tv) return '';
        var isH = String(tv).indexOf('H')>=0, isA = String(tv).indexOf('A')>=0;
        var c = isH ? '#f87171' : isA ? '#60a5fa' : '#475569';
        return '<span style="color:'+c+';font-size:8px;font-family:var(--mono)">'+tf.label+'='+tv+'</span>';
      }).filter(Boolean).join(' ');

      h += '<tr>';
      h += (function(){var d=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#64748b;white-space:nowrap">'+(d+(tm?' '+tm:''))+'</td>';})();
      h += '<td><div style="font-size:11px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">'+r.TEAMH+' vs '+r.TEAMA+'</div>';
      h += '<div style="font-size:9px;color:#475569;font-family:var(--mono)">'+(r.CATEGORY||r.LEAGUE||'')+'</div></td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+lineStr+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH!=null?r.ASIAH:'—')+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA!=null?r.ASIAA:'—')+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#64748b">'+leanPct+'</td>';
      h += '<td class="num"><b style="font-size:14px;color:'+betCol+'">'+topRule.bet+'</b></td>';
      h += '<td class="num"><span style="color:'+typeCol+';font-size:11px;font-weight:700">'+typeLabel+'</span></td>';
      h += '<td style="font-size:10px;color:#e2e8f0;max-width:200px">'+topRule.label+multiMark+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#64748b">'+topRule.n+'</td>';
      h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(topRule.roi>=0?'+':'')+topRule.roi.toFixed(1)+'%</td>';
      h += '<td style="font-size:9px;white-space:nowrap">'+tipStr+'</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<div style="font-size:9px;color:#475569;margin-top:4px">⚡ = COUNTER (bet against expert) · ✓ = WITH (follow expert) · +N = additional rules also fired</div>';
    h += '</div>';

    // ── Detail cards ──
    h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Match Details</div>';
    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    jcr.upcomingAlerts.forEach(function(alert){
      var r = alert.r;
      var topRule = alert.rules[0];
      var betCol = topRule.bet === 'H' ? '#f87171' : '#60a5fa';
      var leanPct = alert.lean ? Math.round(alert.lean*100) : '—';
      var lineStr = (parseFloat(r.ASIALINE)>=0?'+':'')+parseFloat(r.ASIALINE).toFixed(2);

      h += '<div style="padding:12px 14px;border-radius:8px;background:var(--surface2);border:1.5px solid '+betCol+'33">';
      h += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:7px">';
      h += '<div style="font-size:22px;font-weight:900;font-family:var(--mono);color:'+betCol+';width:28px;flex-shrink:0">'+topRule.bet+'</div>';
      h += '<div style="flex:1;min-width:140px">';
      h += '<div style="font-size:12px;font-weight:700;color:#e2e8f0">'+r.TEAMH+' <span style="color:#475569;font-weight:400">vs</span> '+r.TEAMA+'</div>';
      h += '<div style="font-size:10px;color:#64748b;font-family:var(--mono)">'+(r.DATE||'')+' · '+(r.CATEGORY||r.LEAGUE||'')+'</div>';
      h += '</div>';
      h += '<div style="text-align:right;font-size:10px;color:#94a3b8;font-family:var(--mono);flex-shrink:0">';
      h += 'Line <b style="color:#e2e8f0">'+lineStr+'</b> · Lean <b style="color:#e2e8f0">'+leanPct+'%</b>';
      h += '</div></div>';

      // All 4 expert tips
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">';
      var tipFields = [
        { key:'JCTIPSUM', label:'JCSUM' }, { key:'JCTIPSID', label:'JCSID' },
        { key:'TIPSIDMAC', label:'MAC' },  { key:'TIPSONID', label:'ONID' }
      ];
      tipFields.forEach(function(tf){
        var tv = r[tf.key];
        var displayVal = tv || '—';
        var isH = tv && String(tv).indexOf('H')>=0, isA = tv && String(tv).indexOf('A')>=0;
        var c = isH ? '#f87171' : isA ? '#60a5fa' : '#475569';
        h += '<span style="font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:'+c+'15;border:1px solid '+c+'33;color:'+c+'">'+tf.label+': '+displayVal+'</span>';
      });
      h += '</div>';

      // All fired rules for this match
      alert.rules.forEach(function(rule, ri){
        var rc = rule.type === 'COUNTER' ? '#fbbf24' : '#4ade80';
        var typeLabel = rule.type === 'COUNTER' ? '⚡ COUNTER' : '✓ FOLLOW';
        var borderStyle = ri === 0 ? 'border:1px solid '+rc+'44;' : 'border:1px solid var(--border);';
        h += '<div style="display:flex;align-items:flex-start;gap:8px;font-size:10px;flex-wrap:wrap;padding:5px 8px;border-radius:5px;margin-bottom:3px;background:rgba(255,255,255,0.02);'+borderStyle+'">';
        h += '<span style="color:'+rc+';font-weight:700;font-family:var(--mono);white-space:nowrap">'+typeLabel+'</span>';
        h += '<span style="color:#e2e8f0;flex:1;min-width:120px">'+rule.label+'</span>';
        h += '<span style="color:#4ade80;font-family:var(--mono);font-weight:700;white-space:nowrap">'+(rule.roi>=0?'+':'')+rule.roi.toFixed(1)+'% ROI</span>';
        h += '<span style="color:#64748b;font-family:var(--mono);white-space:nowrap">n='+rule.n+' · tr='+(rule.train>=0?'+':'')+rule.train.toFixed(1)+'% te='+(rule.test>=0?'+':'')+rule.test.toFixed(1)+'%</span>';
        h += '</div>';
      });
      h += '</div>';
    });
    h += '</div>';
  }
  h += '</div>';

  // ── SECTION 1b: Past Bets Table ──
  h += '<div style="margin-bottom:20px;border-top:2px solid var(--border);padding-top:14px">';
  h += '<div class="rpt-title" style="margin-bottom:4px">📋 Past Bets — Last '+jcr.pastBets.length+' shown</div>';
  h += '<div class="rpt-sub" style="margin-bottom:10px">Most recent completed matches where at least one verified rule fired. Hit reflects the rule\'s recommended bet side.</div>';
  if(!jcr.pastBets.length){
    h += '<div style="padding:14px;color:#475569;font-size:12px;font-style:italic">No past bets found.</div>';
  } else {
    var pbCumUnits = 0;
    var pbRunUnits = jcr.pastBets.slice().reverse().map(function(pb){
      var bet = pb.rules[0].bet;
      pbCumUnits = Math.round((pbCumUnits + (bet==='H' ? pb.pnl.h : pb.pnl.a)) * 100) / 100;
      return pbCumUnits;
    });
    pbRunUnits.reverse();
    var pbTotal = pbRunUnits[0] || 0;
    var pbROI   = Math.round(pbTotal / jcr.pastBets.length * 1000) / 10;
    var pbColor = pbROI >= 0 ? '#4ade80' : '#f87171';

    h += '<div class="rpt-table-wrap"><table class="rpt-table" style="font-size:11px"><thead><tr>';
    h += '<th>Date / Time</th><th>Match</th>';
    h += '<th class="num">Line</th><th class="num">AH</th><th class="num">AA</th><th class="num">Score</th>';
    h += '<th class="num">Bet</th><th>Rule</th><th class="num">N</th><th>Outcome</th><th class="num">Hit</th><th class="num">Run.Units</th>';
    h += '</tr></thead><tbody>';
    jcr.pastBets.forEach(function(pb, i){
      var r = pb.r, topRule = pb.rules[0], bet = topRule.bet;
      var betCol = bet==='H' ? '#f87171' : '#60a5fa';
      var outLabel, predWon;
      if     (pb.outcome==='HW'){ outLabel='H WIN';  predWon=(bet==='H'); }
      else if(pb.outcome==='HH'){ outLabel='H ½WIN'; predWon=(bet==='H'); }
      else if(pb.outcome==='P') { outLabel='PUSH';   predWon=null; }
      else if(pb.outcome==='AH'){ outLabel='A ½WIN'; predWon=(bet==='A'); }
      else                      { outLabel='A WIN';  predWon=(bet==='A'); }
      var outBg  = predWon===null ? 'rgba(148,163,184,0.15)' : predWon ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)';
      var outCol = predWon===null ? '#94a3b8' : predWon ? '#4ade80' : '#f87171';
      var predFullWin  = (bet==='H'&&pb.outcome==='HW')||(bet==='A'&&pb.outcome==='AW');
      var predHalfWin  = (bet==='H'&&pb.outcome==='HH')||(bet==='A'&&pb.outcome==='AH');
      var predHalfLoss = (bet==='H'&&pb.outcome==='AH')||(bet==='A'&&pb.outcome==='HH');
      var hitHtml = predFullWin ? '<span style="font-size:13px">✅✅</span>'
        : predHalfWin  ? '<span style="font-size:13px">✅</span>'
        : pb.outcome==='P' ? '<span style="font-size:13px">⬜</span>'
        : predHalfLoss ? '<span style="font-size:13px">❌</span>'
        : '<span style="font-size:13px">❌❌</span>';
      var units = pbRunUnits[i];
      var unitCol = units>=0 ? '#4ade80' : '#f87171';
      var score = (r.RESULTH!=null&&r.RESULTA!=null) ? r.RESULTH+'–'+r.RESULTA : '—';
      var ruleExtra = pb.rules.length>1 ? ' <span style="color:#fbbf24;font-size:9px">+' + (pb.rules.length-1)+'</span>' : '';
      h += '<tr>';
      h += (function(){var d=(r.DATE||'').slice(5);var t=r.TIME;var ts=t?String(t).padStart(4,'0'):'';var tm=ts?ts.slice(0,2)+':'+ts.slice(2):'';return '<td style="font-family:var(--mono);font-size:10px;color:#64748b;white-space:nowrap">'+(d+(tm?' '+tm:''))+'</td>';})();
      h += '<td style="max-width:110px;overflow:hidden"><span style="color:#e2e8f0;white-space:nowrap;font-size:10px">'+r.TEAMH+' <span style="color:#475569">vs</span> '+r.TEAMA+'</span></td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIALINE>0?'+':'')+r.ASIALINE+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAH!=null?r.ASIAH:'—')+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+(r.ASIAA!=null?r.ASIAA:'—')+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#e2e8f0">'+score+'</td>';
      h += '<td class="num"><b style="color:'+betCol+'">'+bet+'</b></td>';
      h += '<td style="font-size:9px;color:#94a3b8;max-width:140px">'+topRule.label+ruleExtra+'</td>';
      h += '<td class="num" style="font-family:var(--mono);color:#64748b">'+topRule.n+'</td>';
      h += '<td><span style="background:'+outBg+';color:'+outCol+';font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:var(--mono)">'+outLabel+'</span></td>';
      h += '<td class="num">'+hitHtml+'</td>';
      h += '<td class="num" style="font-family:var(--mono);font-size:10px;color:'+unitCol+'">'+(units>=0?'+':'')+units.toFixed(2)+'</td>';
      h += '</tr>';
    });
    h += '<tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.03)">';
    h += '<td colspan="8" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">'+jcr.pastBets.length+' bets shown</td>';
    h += '<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">ROI</td>';
    h += '<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbColor+'">'+(pbROI>=0?'+':'')+pbROI+'%</td>';
    h += '<td class="num" style="font-size:10px;color:#94a3b8;font-family:var(--mono)">Total</td>';
    h += '<td class="num" style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+pbColor+'">'+(pbTotal>=0?'+':'')+pbTotal.toFixed(2)+' units</td>';
    h += '</tr>';
    h += '</tbody></table></div>';
  }
  h += '</div>';

  // ── SECTION 2: Verified rules summary ──
  h += '<div style="margin-bottom:20px">';
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">✅ All Verified Rules (train + test both positive)</div>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">Sorted by overall ROI. <span style="color:#fbbf24">COUNTER = bet against the expert</span>. <span style="color:#4ade80">WITH = follow the expert</span>. Lean≥50% rules only fire when market also agrees (Home-leaning).</div>';

  h += '<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
  h += '<th>Rule</th>';
  h += '<th class="num">Type</th>';
  h += '<th class="num">Bet</th>';
  h += '<th class="num">n</th>';
  h += '<th class="num">ROI (all)</th>';
  h += '<th class="num">Train</th>';
  h += '<th class="num">Test</th>';
  h += '</tr></thead><tbody>';

  jcr.verifiedRules.forEach(function(rule){
    var typeCol = rule.type === 'COUNTER' ? '#fbbf24' : '#4ade80';
    var betCol  = rule.bet  === 'H'       ? '#f87171' : '#60a5fa';
    var roiCol  = rule.roi  >= 5          ? '#4ade80' : rule.roi >= 2 ? '#a3e635' : '#94a3b8';
    h += '<tr>';
    h += '<td style="color:#e2e8f0;font-size:11px">'+rule.label+'</td>';
    h += '<td class="num"><span style="color:'+typeCol+';font-size:9px;font-weight:700">'+rule.type+'</span></td>';
    h += '<td class="num"><b style="color:'+betCol+'">'+rule.bet+'</b></td>';
    h += '<td class="num" style="font-family:var(--mono);color:#64748b">'+rule.n+'</td>';
    h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+roiCol+'">'+(rule.roi>=0?'+':'')+rule.roi.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+(rule.train>=0?'#4ade80':'#f87171')+'">'+(rule.train>=0?'+':'')+rule.train.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+(rule.test>=0?'#4ade80':'#f87171')+'">'+(rule.test>=0?'+':'')+rule.test.toFixed(1)+'%</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '</div>';

  // ── SECTION 3: Full relationship matrix (heatmap) ──
  h += '<div style="margin-bottom:20px">';
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap">';
  h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin:0">📊 Full Relationship Matrix</div>';
  h += '<div style="display:flex;gap:4px;margin-left:auto" id="jcrExpBtns">';
  ['All','JCSUM','JCSID','MAC','ONID'].forEach(function(label, i){
    var active = i === 0;
    h += '<button onclick="jcrFilterExp(\''+label+'\')" id="jcrBtn_'+label+'" ';
    h += 'style="font-size:10px;font-family:var(--mono);padding:3px 9px;border-radius:5px;cursor:pointer;';
    h += active ? 'border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-weight:700"' : 'border:1px solid #334155;background:transparent;color:#64748b"';
    h += '>'+label+'</button>';
  });
  h += '</div></div>';
  h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">ROI when betting WITH (follow expert) vs AGAINST (counter expert) for each combination. Green = positive ROI, red = negative. ✓ = verified on train+test splits.</div>';

  h += '<div class="rpt-table-wrap"><table class="rpt-table" id="jcrMatrixTable"><thead><tr>';
  h += '<th>Expert</th><th class="num">Line</th><th class="num">Tip</th><th class="num">n</th>';
  h += '<th class="num">Lean</th>';
  h += '<th class="num" style="color:#4ade80">WITH ROI</th><th class="num" style="color:#64748b">Train</th><th class="num" style="color:#64748b">Test</th>';
  h += '<th class="num" style="color:#fbbf24">COUNTER ROI</th><th class="num" style="color:#64748b">Train</th><th class="num" style="color:#64748b">Test</th>';
  h += '</tr></thead><tbody id="jcrMatrixBody">';

  // Sort matrix: verified first, then by counter ROI desc
  var sortedMatrix = jcr.matrix.slice().sort(function(a,b){
    var aScore = (a.against_strong?2:a.against_verified?1:0) + (a.with_strong?1:0);
    var bScore = (b.against_strong?2:b.against_verified?1:0) + (b.with_strong?1:0);
    if(bScore !== aScore) return bScore - aScore;
    return Math.abs(b.roi_against.all) - Math.abs(a.roi_against.all);
  });

  sortedMatrix.forEach(function(m){
    var rwc = m.roi_with.all >= 3 ? '#4ade80' : m.roi_with.all >= 0 ? '#a3e635' : m.roi_with.all > -3 ? '#94a3b8' : '#f87171';
    var rac = m.roi_against.all >= 3 ? '#4ade80' : m.roi_against.all >= 0 ? '#a3e635' : m.roi_against.all > -3 ? '#94a3b8' : '#f87171';
    var wv  = m.with_verified    ? '<span style="color:#4ade80">✓</span>' : '';
    var av  = m.against_verified ? '<span style="color:#4ade80">✓</span>' : '';
    var ws  = m.with_strong      ? '★' : '';
    var as_ = m.against_strong   ? '★' : '';
    var lineStr = (m.line>=0?'+':'')+m.line.toFixed(2);
    var betW = m.with_bet,   betA = m.against_bet;
    var betWc = betW==='H'?'#f87171':'#60a5fa', betAc = betA==='H'?'#f87171':'#60a5fa';
    var trWc  = m.roi_with.train  >= 0 ? '#4ade80' : '#f87171';
    var teWc  = m.roi_with.test   >= 0 ? '#4ade80' : '#f87171';
    var trAc  = m.roi_against.train >= 0 ? '#4ade80' : '#f87171';
    var teAc  = m.roi_against.test  >= 0 ? '#4ade80' : '#f87171';

    h += '<tr class="jcr-row" data-exp="'+m.exp_short+'">';
    h += '<td style="font-size:10px;color:#fbbf24;font-weight:700;font-family:var(--mono)">'+m.exp_short+'</td>';
    h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+lineStr+'</td>';
    h += '<td class="num"><b style="color:'+(m.tip==='H'?'#f87171':'#60a5fa')+'">'+m.tip+'</b></td>';
    h += '<td class="num" style="font-family:var(--mono);color:#475569">'+m.n+'</td>';
    h += '<td class="num" style="font-family:var(--mono);color:#64748b">'+(Math.round(m.lean_avg*1000)/10)+'%</td>';
    // WITH
    h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+rwc+'">';
    h += wv+ws+' <span style="color:'+betWc+'">'+betW+'</span> '+(m.roi_with.all>=0?'+':'')+m.roi_with.all.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+trWc+'">'+(m.roi_with.train>=0?'+':'')+m.roi_with.train.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+teWc+'">'+(m.roi_with.test>=0?'+':'')+m.roi_with.test.toFixed(1)+'%</td>';
    // AGAINST
    h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:'+rac+'">';
    h += av+as_+' <span style="color:'+betAc+'">'+betA+'</span> '+(m.roi_against.all>=0?'+':'')+m.roi_against.all.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+trAc+'">'+(m.roi_against.train>=0?'+':'')+m.roi_against.train.toFixed(1)+'%</td>';
    h += '<td class="num" style="font-family:var(--mono);color:'+teAc+'">'+(m.roi_against.test>=0?'+':'')+m.roi_against.test.toFixed(1)+'%</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="font-size:9px;color:#475569;margin-top:4px">★ = strong rule (ROI>3% all data + both splits positive). ✓ = verified (both splits positive). Lean = avg market lean when this tip+line combo occurs.</div>';
  h += '</div>';

  // ── SECTION 4: When both JC experts agree ──
  if(jcr.bothJC.length){
    h += '<div style="margin-bottom:20px">';
    h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">🤝 When JCSUM + JCSID Both Agree</div>';
    h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">Cases where both JC Summary and JC SID tip the same direction at the same line. Agreement can amplify or create edge.</div>';
    h += '<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
    h += '<th>Both tip</th><th class="num">Line</th><th class="num">Bet</th><th class="num">n</th>';
    h += '<th class="num">ROI</th><th class="num">Train</th><th class="num">Test</th>';
    h += '</tr></thead><tbody>';
    jcr.bothJC.sort(function(a,b){ return b.roi.all - a.roi.all; }).forEach(function(bj){
      var betCol = bj.bet === 'H' ? '#f87171' : '#60a5fa';
      var tipCol = bj.tip === 'H' ? '#f87171' : '#60a5fa';
      var lineStr = (bj.line>=0?'+':'')+bj.line.toFixed(2);
      h += '<tr>';
      h += '<td><b style="color:'+tipCol+'">'+bj.tip+'</b></td>';
      h += '<td class="num" style="font-family:var(--mono);color:#94a3b8">'+lineStr+'</td>';
      h += '<td class="num"><b style="color:'+betCol+'">'+bj.bet+'</b></td>';
      h += '<td class="num" style="font-family:var(--mono);color:#475569">'+bj.n+'</td>';
      h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:#4ade80">'+(bj.roi.all>=0?'+':'')+bj.roi.all.toFixed(1)+'%</td>';
      h += '<td class="num" style="font-family:var(--mono);color:'+(bj.roi.train>=0?'#4ade80':'#f87171')+'">'+(bj.roi.train>=0?'+':'')+bj.roi.train.toFixed(1)+'%</td>';
      h += '<td class="num" style="font-family:var(--mono);color:'+(bj.roi.test>=0?'#4ade80':'#f87171')+'">'+(bj.roi.test>=0?'+':'')+bj.roi.test.toFixed(1)+'%</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div></div>';
  }

  // ── SECTION 5: Rules with Lean ≥50% filter ──
  if(jcr.matrixWithLean.length){
    h += '<div style="margin-bottom:20px">';
    h += '<div class="rpt-sub" style="font-weight:700;color:#cbd5e1;margin-bottom:6px">📐 Rules with Lean ≥50% Filter (Market Confirms H)</div>';
    h += '<div style="font-size:10px;color:#64748b;margin-bottom:8px">These rules only fire when the market is also leaning Home (lean ≥50%). Adding this market confirmation filter improves ROI and reduces noise.</div>';
    h += '<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr>';
    h += '<th>Rule</th><th class="num">Bet</th><th class="num">n</th>';
    h += '<th class="num">ROI</th><th class="num">Train</th><th class="num">Test</th>';
    h += '</tr></thead><tbody>';
    jcr.matrixWithLean.sort(function(a,b){ return b.roi.all - a.roi.all; }).forEach(function(m){
      var betCol = m.bet === 'H' ? '#f87171' : '#60a5fa';
      var lineStr = (m.line>=0?'+':'')+m.line.toFixed(2);
      h += '<tr>';
      h += '<td style="color:#e2e8f0;font-size:11px"><b style="color:#fbbf24">'+m.exp_short+'</b> tips <b style="color:'+(m.tip==='H'?'#f87171':'#60a5fa')+'">'+m.tip+'</b> + Line='+lineStr+' + Lean≥50%</td>';
      h += '<td class="num"><b style="color:'+betCol+'">'+m.bet+'</b></td>';
      h += '<td class="num" style="font-family:var(--mono);color:#475569">'+m.n+'</td>';
      h += '<td class="num" style="font-family:var(--mono);font-weight:700;color:#4ade80">'+(m.roi.all>=0?'+':'')+m.roi.all.toFixed(1)+'%</td>';
      h += '<td class="num" style="font-family:var(--mono);color:'+(m.roi.train>=0?'#4ade80':'#f87171')+'">'+(m.roi.train>=0?'+':'')+m.roi.train.toFixed(1)+'%</td>';
      h += '<td class="num" style="font-family:var(--mono);color:'+(m.roi.test>=0?'#4ade80':'#f87171')+'">'+(m.roi.test>=0?'+':'')+m.roi.test.toFixed(1)+'%</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div></div>';
  }

  // ── SECTION 6: How to read this report ──
  h += '<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:14px">';
  h += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">How to Read This Report</div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px;font-size:10px;color:#94a3b8;line-height:1.7">';
  h += '<div><b style="color:#fbbf24">COUNTER rule:</b> The expert is systematically wrong in this specific condition — bet against their tip. e.g. MAC tips Home at Line=−1.00 → the market consistently over-favours Home at heavy handicap, so bet Away.</div>';
  h += '<div><b style="color:#4ade80">WITH rule:</b> Following the expert in this condition produces positive ROI. e.g. MAC tips Away at Line=−0.75 → MAC is correctly identifying Away-side value here.</div>';
  h += '<div><b style="color:#e2e8f0">Asia Line interpretation:</b> Negative = Home is favourite (gives goals). Positive = Away is favourite. A Line of −1.00 means Home must win by more than 1 goal for a Home handicap win.</div>';
  h += '<div><b style="color:#e2e8f0">Market Lean:</b> Derived from closing odds. Lean >50% = money is on Home side. The lean filter (≥50%) selects only matches where the market also agrees with the structural Home signal.</div>';
  h += '<div><b style="color:#e2e8f0">Train/Test split:</b> Data sorted by date. Oldest 75% = training (rule discovery). Newest 25% = test (out-of-sample validation). A rule must be positive on BOTH to be listed as verified.</div>';
  h += '</div></div>';

  el.innerHTML = h;

  // ── Wire up expert filter buttons ──
  window.jcrFilterExp = function(label){
    var btns = document.querySelectorAll('[id^="jcrBtn_"]');
    btns.forEach(function(b){
      var active = b.id === 'jcrBtn_'+label;
      b.style.cssText = active
        ? 'font-size:10px;font-family:var(--mono);padding:3px 9px;border-radius:5px;cursor:pointer;border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-weight:700'
        : 'font-size:10px;font-family:var(--mono);padding:3px 9px;border-radius:5px;cursor:pointer;border:1px solid #334155;background:transparent;color:#64748b';
    });
    var rows = document.querySelectorAll('.jcr-row');
    rows.forEach(function(row){
      var expAttr = row.getAttribute('data-exp');
      var show = label === 'All' || expAttr === label;
      row.style.display = show ? '' : 'none';
    });
  };
}
