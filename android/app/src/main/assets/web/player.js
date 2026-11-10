(function () {
  'use strict';
  var X = FIX, THEMES = FIXTHEMES;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  var WIRE_CSS = { RED: '#e5392c', BLUE: '#2f6fe0', YELLOW: '#f5c518', WHITE: '#f4f4f4', BLACK: '#141414' };
  var LAMP_CSS = { GREEN: '#35c66f', AMBER: '#ffb000', RED: '#e5392c', BLUE: '#3fa0ff' };
  var ORDER = ['ce', 'ee', 'cpe', 'me'];

  var ID = store.get('fx-id');
  if (!ID) { ID = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('fx-id', ID); }
  var session = null;
  try { session = JSON.parse(store.get('fx-session') || 'null'); } catch (e) { }
  var pick = (session && session.program) || store.get('fx-program') || '';

  var es = null, view = null, offset = 0, T = null, R = null, screen = '', bodyKey = '', muted = false, endArm = 0;
  var local = null; // operator's own module progress for the current machine
  var lastPhaseKey = '';

  function now() { return Date.now() + offset; }
  function show(id) {
    if (screen === id) return;
    screen = id;
    ['sJoin', 'sLobby', 'sPlay', 'sOver'].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function act(type, extra) {
    var b = { room: session.room, id: ID, type: type };
    for (var k in extra || {}) b[k] = extra[k];
    return post('/api/act', b).catch(function () { });
  }
  function svg(i) { return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + T.symbols[i] + '</svg>'; }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function applyTheme(prog) {
    T = THEMES[prog] || null;
    var c = T ? T.colors : { bg: '#14161a', plate: '#20242b', plate2: '#2a2f37', edge: '#3d444e', ink: '#eef0f2', dim: '#a0a8b2', accent: '#ffc21a', accentInk: '#1a1400', accent2: '#7fd3ff' };
    var st = document.documentElement.style;
    for (var k in c) st.setProperty('--' + k, c[k]);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', c.bg);
  }

  // ------------------------------------------------------------ sound, buzz, toast, wake
  var actx = null;
  function audioInit() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
  function tone(f, d, type, vol, when) {
    if (muted || !actx) return;
    try {
      var t0 = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + d + 0.03);
    } catch (e) { }
  }
  function sfx(k) {
    if (k === 'click') tone(900, .04, 'square', .03);
    if (k === 'good') tone(1046, .12, 'triangle', .09);
    if (k === 'fault') tone(180, .35, 'sawtooth', .08);
    if (k === 'win') { tone(523, .1, 'triangle', .09); tone(659, .1, 'triangle', .09, .12); tone(784, .3, 'triangle', .09, .24); }
    if (k === 'lose') { tone(320, .3, 'sawtooth', .08); tone(220, .5, 'sawtooth', .08, .3); }
    if (k === 'tick') tone(1400, .03, 'square', .03);
    if (k === 'start') { tone(440, .08, 'square', .05); tone(660, .12, 'square', .05, .1); }
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } }
  var toastTimer = 0;
  function toast(type, text) {
    var t = $('toast'); t.className = 'toast show ' + type; t.textContent = text;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast ' + type; }, 2200);
  }
  var lock = null;
  function wake() { try { if (navigator.wakeLock && !lock) navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () { }); } catch (e) { } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && session) wake(); });

  // ------------------------------------------------------------ join
  function renderPrograms() {
    $('jPrograms').innerHTML = ORDER.map(function (p) {
      var t = THEMES[p];
      return '<button type="button" data-p="' + p + '" class="' + (pick === p ? 'sel' : '') + '" style="--pc:' + t.colors.accent + '"><i></i><b>' + esc(t.title) + '</b><span>' + esc(t.program) + '</span></button>';
    }).join('');
  }
  $('jPrograms').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-p]'); if (!b) return;
    pick = b.dataset.p; store.set('fx-program', pick); renderPrograms();
  });
  $('jTeam').addEventListener('input', function () { var v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v !== this.value) this.value = v; });
  $('joinForm').addEventListener('submit', function (e) {
    e.preventDefault(); audioInit();
    join($('jName').value.trim(), $('jTeam').value.trim(), pick);
  });
  function join(name, team, program) {
    $('jErr').textContent = '';
    if (!program) { $('jErr').textContent = 'Pick your program.'; show('sJoin'); return; }
    if (!name) { $('jErr').textContent = 'Type your name.'; show('sJoin'); return; }
    if (team.length < 2) { $('jErr').textContent = 'Type a team code (at least 2 letters or numbers).'; show('sJoin'); return; }
    $('jBtn').disabled = true;
    post('/api/join', { id: ID, name: name, team: team, program: program }).then(function (r) {
      $('jBtn').disabled = false;
      if (!r.ok) { $('jErr').textContent = r.error || 'Could not join.'; show('sJoin'); return; }
      session = { room: r.room, name: name, team: team, program: r.program };
      store.set('fx-session', JSON.stringify(session)); store.set('fx-name', name); store.set('fx-team', team);
      if (r.program !== program) toast('warn', 'Team ' + r.room + ' is playing ' + THEMES[r.program].title + '.');
      connect();
    }).catch(function () {
      $('jBtn').disabled = false;
      $('jErr').textContent = 'Can\'t reach the host phone. Check you\'re on its hotspot or the same Wi-Fi.';
      show('sJoin');
    });
  }
  function toJoin(msg) {
    if (es) { es.close(); es = null; }
    session = null; store.del('fx-session'); view = null; bodyKey = '';
    applyTheme(null); renderPrograms(); show('sJoin');
    $('jErr').textContent = msg || '';
  }

  // ------------------------------------------------------------ live connection
  function connect() {
    if (es) es.close();
    es = new EventSource('/events?room=' + encodeURIComponent(session.room) + '&id=' + encodeURIComponent(ID));
    es.onmessage = function (e) {
      $('conn').hidden = true;
      var v; try { v = JSON.parse(e.data); } catch (err) { return; }
      offset = v.now - Date.now(); view = v;
      render();
    };
    es.addEventListener('gone', function () {
      // the host app restarted or you were removed: rejoin quietly with the same details
      if (session) { var s = session; es.close(); es = null; join(s.name, s.team, s.program); }
    });
    es.addEventListener('closed', function () { toJoin('Your teacher closed this team. Join again with a team code.'); });
    es.onerror = function () { $('conn').hidden = false; };
  }

  // ------------------------------------------------------------ render
  function render() {
    var r = view.room;
    if (!T || T.id !== r.program) applyTheme(r.program);
    if (r.state === 'lobby') return renderLobby();
    if (r.state === 'over') return renderOver();
    renderPlay();
  }

  function renderLobby() {
    var r = view.room;
    show('sLobby');
    $('lProg').textContent = 'Team · ' + T.title + ' · ' + T.program;
    $('lTeam').textContent = r.key;
    $('lTag').textContent = T.tagline;
    var online = r.players.filter(function (p) { return p.online; }).length;
    $('lCount').textContent = online + ' online';
    $('lRoster').innerHTML = r.players.map(function (p) {
      var me = p.station === view.me.station;
      return '<div class="crew"><span class="nm">' + esc(p.name) + (me ? ' <span class="label">(you)</span>' : '') + '</span><span class="tag ' + (p.online ? 'on' : 'off') + '">' + (p.online ? 'ready' : 'offline') + '</span></div>';
    }).join('');
    $('lStart').disabled = online < 2;
    $('lNote').textContent = online < 2 ? 'Waiting for teammates. They join with team code ' + r.key + ' on the same Wi-Fi or hotspot.'
      : 'Best with 3 to 6. Start when everyone is in. Anyone on the team can press Start.';
  }
  $('lStart').addEventListener('click', function () { audioInit(); wake(); act('start'); });
  $('lLeave').addEventListener('click', function () { act('leave'); toJoin(''); });

  function round() {
    var r = view.room;
    if (!R || R.k !== r.k || R._seed !== r.seed) { R = X.buildRound(T, r.key, r.n, r.seed, r.round, r.k); R._seed = r.seed; }
    return R;
  }
  function localState() {
    var r = view.room, key = 'fx-op-' + r.key + '-' + r.seed + '-' + r.k;
    if (!local || local.key !== key) {
      try { local = JSON.parse(store.get(key) || 'null'); } catch (e) { local = null; }
      if (!local) {
        local = { key: key, cut: {}, keys: {}, proc: {}, sw: {}, done: {}, faults: 0 };
        R.modules.forEach(function (m, i) { if (m.type === 'switches') local.sw[i] = m.init.slice(); });
      }
    }
    return local;
  }
  function saveLocal() { if (local) store.set(local.key, JSON.stringify(local)); }

  function renderPlay() {
    var r = view.room, me = view.me;
    show('sPlay');
    round();
    var opIdx = r.operator, isOp = me.station === opIdx;
    var opName = (r.players.filter(function (p) { return p.station === opIdx; })[0] || {}).name || ('Station ' + (opIdx + 1));
    $('pTitle').textContent = T.title;
    $('pStn').textContent = 'Stn ' + (me.station + 1) + '/' + r.n;
    $('pRound').innerHTML = '<small>' + esc(T.machine) + '</small>Round ' + r.round;
    var lv = ''; for (var i = 0; i < X.LIVES; i++) lv += '<i class="' + (i < r.lives ? '' : 'lost') + '"></i>';
    $('pLives').innerHTML = lv;
    $('pMates').innerHTML = r.players.map(function (p) {
      return '<span class="mate' + (p.online ? '' : ' off') + (p.station === opIdx ? ' op' : '') + (p.station === me.station ? ' me' : '') + '"><i></i>' + (p.station + 1) + ' · ' + esc(p.name) + (p.station === opIdx ? ' (operator)' : '') + '</span>';
    }).join('');

    // cues when the phase changes
    var pk = r.k + ':' + r.phase;
    if (pk !== lastPhaseKey) {
      if (lastPhaseKey) {
        if (r.phase === 'repair') { sfx('start'); buzz(60); }
        if (r.phase === 'result') { if (r.result === 'ok') { sfx('win'); buzz([60, 60, 60]); } else { sfx('lose'); buzz([200, 80, 200]); } }
        if (r.phase === 'brief' && isOp) { toast('warn', 'You\'re the operator now!'); buzz([100, 60, 100]); }
      }
      lastPhaseKey = pk;
    }

    var key;
    if (isOp) {
      var L = localState();
      key = ['op', r.k, r.phase, r.faults, JSON.stringify(r.solved), JSON.stringify(L.cut), JSON.stringify(L.keys), JSON.stringify(L.proc), JSON.stringify(L.sw), JSON.stringify(L.done)].join('|');
    } else key = ['rd', r.k, r.phase, r.faults, JSON.stringify(r.solved), opName].join('|');
    if (key !== bodyKey) { bodyKey = key; $('pBody').innerHTML = isOp ? operatorHTML() : readerHTML(opName); }
  }

  // ------------------------------------------------------------ operator
  function isDone(i) { return view.room.solved.indexOf(i) >= 0 || !!(local && local.done[i]); }
  function modHTML(m, i) {
    var L = local, name = T.mods[m.type], body = '';
    if (m.type === 'wires') {
      body = '<div class="wires">' + m.wires.map(function (c, j) {
        var cut = L.cut[i] && L.cut[i][j];
        return '<button class="wire' + (cut ? ' cut' : '') + '" data-act="cut" data-m="' + i + '" data-w="' + j + '" aria-label="' + c + ' wire ' + (j + 1) + '"><span class="term"></span><span class="w" style="background:' + WIRE_CSS[c] + (c === 'BLACK' ? ';box-shadow:0 0 0 1px #555' : '') + '"><em' + (c === 'BLACK' ? ' style="color:#aaa"' : '') + '>' + c + '</em></span><span class="term"></span></button>';
      }).join('') + '</div>';
    }
    if (m.type === 'gauge') {
      body = '<div class="gwrap"><span class="gtag">' + esc(m.tag) + '</span><div class="lcd">' + m.value + '<small>' + esc(T.gaugeUnit) + '</small></div></div><div class="pos">' +
        [1, 2, 3, 4].map(function (p) { return '<button data-act="pos" data-m="' + i + '" data-v="' + p + '"><small>' + esc(T.posWord) + '</small>' + p + '</button>'; }).join('') + '</div>';
    }
    if (m.type === 'keypad') {
      var got = L.keys[i] || [];
      body = '<div class="keys">' + m.shown.map(function (s) { return '<button class="key' + (got.indexOf(s) >= 0 ? ' ok' : '') + '" data-act="key" data-m="' + i + '" data-v="' + s + '">' + svg(s) + '</button>'; }).join('') + '</div>';
    }
    if (m.type === 'switches') {
      var st = L.sw[i];
      body = '<div class="fcode">' + esc(m.code) + '</div><div class="sws">' + st.map(function (on, j) {
        return '<button class="sw' + (on ? ' on' : '') + '" data-act="sw" data-m="' + i + '" data-v="' + j + '"><span>' + (j + 1) + '</span><span class="knob"></span><span>' + (on ? 'ON' : 'OFF') + '</span></button>';
      }).join('') + '</div><button class="btn ghost confirm" data-act="swok" data-m="' + i + '">Confirm switches</button>';
    }
    if (m.type === 'procedure') {
      var n = L.proc[i] || 0;
      body = '<div class="lamp"><i style="background:' + LAMP_CSS[m.lamp] + ';color:' + LAMP_CSS[m.lamp] + '"></i>Status lamp: ' + m.lamp + '</div><div class="steps">' +
        m.buttons.map(function (b) { var ok = m.answer.indexOf(b) < n; return '<button class="' + (ok ? 'ok' : '') + '" data-act="step" data-m="' + i + '" data-v="' + esc(b) + '">' + esc(b) + '</button>'; }).join('') +
        '</div><div class="prog">' + [0, 1, 2, 3].map(function (j) { return '<i class="' + (j < n ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    }
    return '<div class="mod' + (isDone(i) ? ' done' : '') + '"><div class="mh"><h3>' + esc(name) + '</h3><span class="led"></span></div><div class="mb">' + body + '</div></div>';
  }
  function resultHTML(withButton) {
    var r = view.room, ok = r.result === 'ok';
    var title = ok ? 'Fixed!' : 'Failed';
    var sub = ok ? 'Round ' + r.round + ' done. Next round has more modules.' : (r.why || 'Machine failed') + '. This costs one spare part.' + (r.lives <= 1 ? ' It was your last one.' : '');
    return '<div class="result ' + (ok ? 'ok' : 'fail') + '"><span class="label">' + (ok ? 'Machine running' : esc(r.why || '')) + '</span><h2>' + title + '</h2><p>' + esc(sub) + '</p>' +
      (withButton ? '<button class="btn" data-act="next">Next round</button>' : '') + '<p class="note" style="margin:0">Next round starts by itself in a few seconds.</p></div>';
  }
  function operatorHTML() {
    var r = view.room, L = localState();
    if (r.phase === 'result') return resultHTML(true);
    if (r.phase === 'brief') {
      return '<div class="role"><span class="label">Round ' + r.round + '</span><h2>You\'re the operator</h2>' +
        '<p>Your phone shows the broken ' + esc(T.machine) + '. You <b>can\'t</b> see the manual. Your teammates each hold different pages of it.</p>' +
        '<p>Describe what you see. Let them tell you what to do. You get <b>' + mmss(R.time) + '</b> and <b>' + (X.MAX_FAULTS - 1) + ' mistakes</b>; the third one fails the round.</p>' +
        '<p>This machine has <b>' + R.modules.length + ' module' + (R.modules.length > 1 ? 's' : '') + '</b>.</p>' +
        '<button class="btn" data-act="repair">Start repair</button></div>';
    }
    var f = Math.max(r.faults, L.faults);
    return '<div class="bar"><div class="timer" id="tmr"></div><div class="faults">' + [0, 1, 2].map(function (j) { return '<i class="' + (j < f ? 'on' : '') + '"></i>'; }).join('') + '</div><div class="tbar"><i id="tbar"></i></div></div>' +
      '<div class="plate"><span>' + esc(T.machine) + ' · Serial No.</span><b>' + esc(R.serial) + '</b></div>' +
      '<div class="mods">' + R.modules.map(modHTML).join('') + '</div>';
  }
  function solved(i) {
    local.done[i] = true; saveLocal(); sfx('good'); buzz(40);
    if (R.modules.some(function (m, j) { return !isDone(j); })) toast('good', '✓ ' + T.mods[R.modules[i].type] + ' fixed');
    act('solve', { k: view.room.k, i: i });
    bodyKey = ''; renderPlay();
  }
  function fault(msg) {
    local.faults = Math.max(local.faults, view.room.faults) + 1; saveLocal();
    sfx('fault'); buzz([150, 60, 150]);
    if (local.faults < X.MAX_FAULTS) toast('bad', (msg || 'Mistake!') + ' ' + local.faults + '/' + X.MAX_FAULTS);
    act('fault', { k: view.room.k });
    bodyKey = ''; renderPlay();
  }
  $('pBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !view) return;
    var r = view.room, a = b.dataset.act;
    if (a === 'next') { act('next', { k: r.k }); return; }
    if (a === 'repair') { audioInit(); wake(); act('repair', { k: r.k, total: R.modules.length, timeMs: R.time }); return; }
    if (r.phase !== 'repair' || r.operator !== view.me.station) return;
    var i = +b.dataset.m, m = R.modules[i], L = local;
    if (!m || isDone(i)) return;
    sfx('click'); buzz(10);
    if (a === 'cut') {
      var w = +b.dataset.w; L.cut[i] = L.cut[i] || {};
      if (L.cut[i][w]) return;
      L.cut[i][w] = true; saveLocal();
      if (w === m.answer) solved(i); else fault('Wrong wire!');
    }
    if (a === 'pos') { if (+b.dataset.v === m.answer) solved(i); else fault('Wrong ' + T.posWord.toLowerCase() + '!'); }
    if (a === 'key') {
      var s = +b.dataset.v, got = L.keys[i] = L.keys[i] || [];
      if (got.indexOf(s) >= 0) return;
      if (s === m.answer[got.length]) { got.push(s); saveLocal(); if (got.length === 4) solved(i); else { bodyKey = ''; renderPlay(); } }
      else fault('Wrong symbol!');
    }
    if (a === 'sw') { var j = +b.dataset.v; L.sw[i][j] = !L.sw[i][j]; saveLocal(); bodyKey = ''; renderPlay(); }
    if (a === 'swok') { if (L.sw[i].join() === m.answer.join()) solved(i); else fault('Wrong switches!'); }
    if (a === 'step') {
      var n = L.proc[i] || 0;
      if (b.dataset.v === m.answer[n]) { L.proc[i] = n + 1; saveLocal(); if (n + 1 === 4) solved(i); else { bodyKey = ''; renderPlay(); } }
      else { L.proc[i] = 0; fault('Wrong order! Sequence reset.'); }
    }
  });

  // ------------------------------------------------------------ manual holders
  var LOOK = function (ty) {
    return {
      wires: 'Colored wires running across the module (3 to 6 of them).',
      gauge: 'A tag like ' + T.gaugePrefix + '-00, a number readout, and buttons 1 to 4.',
      keypad: 'Four buttons, each with a symbol on it.',
      switches: 'Five ON/OFF switches and a fault code like E-123.',
      procedure: 'A colored status lamp and four named buttons.'
    }[ty];
  };
  function pageHTML(ty) {
    var p = R.pages[ty], h = '';
    if (ty === 'wires') {
      var man = X.wiresManual(p);
      h += '<p>Count the wires from the <b>top</b>. Find the section for the number of wires.</p>';
      for (var n = 3; n <= 6; n++) h += '<h4>' + n + ' wires</h4><ol>' + man[n].map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>';
    }
    if (ty === 'gauge') {
      h += '<p>Find the tag. Compare the reading, then press that ' + esc(T.posWord.toLowerCase()) + ' button.</p><div class="tblw"><table><thead><tr><th>Tag</th><th>Below</th><th>Between</th><th>Above</th></tr></thead><tbody>' +
        p.rows.map(function (r) { return '<tr><td>' + esc(r.tag) + '</td><td>&lt; ' + r.lo + ': <b>' + r.pos[0] + '</b></td><td>' + r.lo + '–' + r.hi + ': <b>' + r.pos[1] + '</b></td><td>&gt; ' + r.hi + ': <b>' + r.pos[2] + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
      var tw = X.gaugeTwistText(p.twist); if (tw) h += '<div class="tw">' + esc(tw) + '</div>';
    }
    if (ty === 'keypad') {
      h += '<p>Exactly one column has all four of the operator\'s symbols. In that column, press them in order from <b>top to bottom</b>.</p><div class="kcols">' +
        p.cols.map(function (c, j) { return '<div class="kcol"><b>' + 'ABCD'[j] + '</b>' + c.map(svg).join('') + '</div>'; }).join('') + '</div>';
    }
    if (ty === 'switches') {
      h += '<p>Find the fault code. Set switches 1 to 5 to match, then press Confirm.</p><div class="tblw"><table><thead><tr><th>Code</th><th>Switches 1 → 5</th></tr></thead><tbody>' +
        p.rows.map(function (r) { return '<tr><td>' + esc(r.code) + '</td><td class="pat">' + r.pattern.map(function (b) { return b ? 'ON' : 'off'; }).join(' · ') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      if (p.twist) h += '<div class="tw">If the serial number ends in an even digit, read the pattern from right to left (switch 5 → 1).</div>';
    }
    if (ty === 'procedure') {
      h += '<p>Check the status lamp color. Press the four buttons in this order. A wrong press restarts the sequence.</p>' +
        p.rows.map(function (r) { return '<h4><span class="lampdot" style="background:' + LAMP_CSS[r.lamp] + '"></span>' + r.lamp + ' lamp</h4><ol>' + r.order.map(function (k) { return '<li>' + esc(p.steps[k]) + '</li>'; }).join('') + '</ol>'; }).join('') +
        '<p style="margin-top:8px;font-size:13px">Any other lamp color: it isn\'t on this page.</p>';
    }
    return '<div class="page"><div class="ph"><h3>' + esc(T.mods[ty]) + '</h3><span>' + esc(T.machine) + ' manual</span></div><p class="look">Looks like: ' + esc(LOOK(ty)) + '</p>' + h + '</div>';
  }
  function readerHTML(opName) {
    var r = view.room, me = view.me;
    var mine = X.TYPES.filter(function (ty) { return R.holder[ty] === me.station; });
    var top;
    if (r.phase === 'result') top = resultHTML(true);
    else {
      var live = r.phase === 'brief'
        ? '<span class="note" style="margin:0">Waiting for ' + esc(opName) + ' to start the repair. Say which pages you hold.</span>'
        : '<div class="live"><span class="timer" id="tmr"></span><span class="faults">' + [0, 1, 2].map(function (j) { return '<i class="' + (j < r.faults ? 'on' : '') + '"></i>'; }).join('') + '</span><span class="mcount">' + r.solved.length + '/' + r.modules + ' fixed</span></div>';
      top = '<div class="who"><span class="label">Operator this round</span><b>' + esc(opName) + '</b>' + live + '</div>';
    }
    return top + (mine.length ? mine.map(pageHTML).join('') : '<p class="note">You have no manual pages this round. Help your team keep track of time and what\'s been fixed.</p>') +
      (mine.length ? '<p class="note">Some pages may be for modules this machine doesn\'t have.</p>' : '');
  }

  // ------------------------------------------------------------ report
  function statusText(r) { return r.ended === 'out' ? 'out of spare parts' : 'ended'; }
  function fields() {
    var r = view.room;
    return { title: T.title, code: r.key, N: r.n, s: view.me.station + 1, runNo: r.seed, fixed: r.fixed, attempts: r.k, lives: r.lives, status: statusText(r) };
  }
  function logText() {
    var f = fields(), r = view.room;
    return [T.title + ' · ' + T.program,
      'Team: ' + f.code + ' · Station ' + f.s + ' of ' + f.N + ' · Game ' + f.runNo + ' · Players: ' + r.players.map(function (p) { return p.name; }).join(', '),
      'Machines fixed: ' + f.fixed,
      'Status: ' + f.status,
      'Attempts: ' + f.attempts + ' · Spare parts left: ' + f.lives,
      'Rounds: ' + (r.hist.map(function (h) { return 'R' + h.r + '/S' + h.op + (h.res === 'ok' ? '✓' : h.res === 'skip' ? '–' : '✗'); }).join(' ') || 'none'),
      'Check: ' + X.checkCode(f)].join('\n');
  }
  function renderOver() {
    var r = view.room, f = fields();
    show('sOver');
    $('oKick').textContent = r.ended === 'out' ? 'Out of spare parts' : 'Game ended';
    $('oTitle').textContent = 'Machines fixed: ' + r.fixed;
    $('oSub').textContent = 'Everyone on your team sees this same report. Screenshot it or copy the log.';
    var rows = r.hist.map(function (h) {
      var nm = (r.players.filter(function (p) { return p.station === h.op - 1; })[0] || {}).name || ('Station ' + h.op);
      return '<dt>Round ' + h.r + ' · ' + esc(nm) + '</dt><dd>' + (h.res === 'ok' ? 'fixed' : h.res === 'skip' ? 'skipped' : 'failed') + '</dd>';
    }).join('');
    $('cert').innerHTML =
      '<div class="ct"><b>' + esc(T.title) + '</b><span>' + esc(T.program) + '</span></div>' +
      '<div class="hero"><b>' + r.fixed + '</b><span>Machines fixed<small>' + (r.ended === 'out' ? 'Stopped at round ' + r.round + ', out of spare parts' : 'Ended at round ' + r.round) + '</small></span></div>' +
      '<dl><dt>Team</dt><dd>' + esc(r.key) + ' · ' + r.n + ' players</dd>' +
      '<dt>Crew</dt><dd>' + esc(r.players.map(function (p) { return p.name; }).join(', ')) + '</dd>' +
      '<dt>Game ID</dt><dd>' + r.seed + '</dd>' +
      '<dt>Spare parts left</dt><dd>' + r.lives + ' of ' + X.LIVES + '</dd>' + rows + '</dl>' +
      '<div class="chk"><span>Check code</span><b>' + X.checkCode(f) + '</b></div>';
    $('oLog').value = logText();
  }
  $('oCopy').addEventListener('click', function () {
    var txt = logText(), box = $('oLog'), btn = this;
    box.value = txt;
    function fallback() { box.hidden = false; box.focus(); box.select(); btn.textContent = 'Log selected — copy it'; }
    try { navigator.clipboard.writeText(txt).then(function () { btn.textContent = 'Copied ✓ — paste it in your chat'; box.hidden = false; }, fallback); } catch (e) { fallback(); }
    setTimeout(function () { btn.textContent = 'Copy log for submission'; }, 3500);
  });
  $('oAgain').addEventListener('click', function () { act('lobby'); });
  $('oLeave').addEventListener('click', function () { act('leave'); toJoin(''); });
  $('pMute').addEventListener('click', function () { muted = !muted; this.textContent = muted ? 'Sound off' : 'Sound on'; if (!muted) audioInit(); });
  $('pEnd').addEventListener('click', function () {
    if (Date.now() - endArm < 3000) { act('end'); return; }
    endArm = Date.now(); this.textContent = 'Sure?'; this.classList.add('arm');
    var self = this; setTimeout(function () { self.textContent = 'End'; self.classList.remove('arm'); }, 3000);
  });

  // ------------------------------------------------------------ timer loop
  var lastSec = -1;
  function frame() {
    if (view && view.room.state === 'playing' && view.room.phase === 'repair') {
      var r = view.room, left = r.timeMs - (now() - r.repairStart);
      var t = $('tmr'), tb = $('tbar');
      if (t) { t.textContent = mmss(left); t.classList.toggle('low', left < 30000); }
      if (tb) tb.style.width = Math.max(0, left / r.timeMs * 100) + '%';
      var sec = Math.ceil(left / 1000);
      if (sec !== lastSec) { lastSec = sec; if (sec <= 10 && sec > 0 && r.operator === view.me.station) sfx('tick'); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // read-only hook for automated tests
  window.__fixit = { view: function () { return view; }, local: function () { return local; } };

  // ------------------------------------------------------------ boot
  $('jName').value = (session && session.name) || store.get('fx-name') || '';
  $('jTeam').value = (session && session.team) || store.get('fx-team') || '';
  renderPrograms();
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') $('hostLink').hidden = false;
  if (session) join(session.name, session.team, session.program);
  else show('sJoin');
})();
