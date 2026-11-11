// ---------------------------------------------------------------------------
// FIX-IT CORE — deterministic rounds, no network.
// Every phone builds the same round from (game, team code, team size, run #,
// round, attempt counter). The operator's phone judges the repair; the
// others only show manual pages. Phones stay in step by typing the 4-digit
// code the operator's phone shows at the end of each attempt.
// ---------------------------------------------------------------------------
var FIX = (function () {
  'use strict';
  var LIVES = 3, MAX_FAULTS = 3;
  var COLORS = ['RED', 'BLUE', 'YELLOW', 'WHITE', 'BLACK'];
  var ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  var LETTERS = 'ABCDEFGHJKLMNPRSTUVWXZ';
  var TYPES = ['wires', 'gauge', 'keypad', 'switches', 'procedure'];
  var LAMPS = ['GREEN', 'AMBER', 'RED', 'BLUE'];

  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function rng(str) {
    var a = hash(str) >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function tools(rnd) {
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    var randInt = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    return { pick: pick, randInt: randInt, shuffle: shuffle };
  }

  function roundSpec(r) {
    var t = [null, [1, 180], [2, 210], [2, 180], [3, 240], [3, 210], [4, 270], [4, 240], [5, 300]];
    if (r < t.length) return { mods: t[r][0], time: t[r][1] * 1000 };
    return { mods: 5, time: Math.max(180, 300 - 20 * (r - 8)) * 1000 };
  }
  function facts(sn) {
    var d = sn.replace(/[^0-9]/g, ''), last = +d[d.length - 1];
    return { odd: last % 2 === 1, even: last % 2 === 0, vowel: /[AEU]/.test(sn) };
  }

  // ------------------------------------------------ wires
  function wireCondOk(c, w, F) {
    var cnt = w.filter(function (x) { return x === c.c; }).length, ok;
    if (c.t === 'none') ok = cnt === 0;
    else if (c.t === 'one') ok = cnt === 1;
    else if (c.t === 'many') ok = cnt > 1;
    else if (c.t === 'last') ok = w[w.length - 1] === c.c;
    else ok = w[0] === c.c;
    if (ok && c.serial) ok = c.serial === 'odd' ? F.odd : F.even;
    return ok;
  }
  function wireAct(a, w) {
    if (a.a === 'pos') return a.k;
    if (a.a === 'last') return w.length - 1;
    if (a.a === 'lastOf') return w.lastIndexOf(a.c);
    return w.indexOf(a.c);
  }
  function wireSolve(rules, w, F) {
    for (var i = 0; i < rules.length; i++) if (!rules[i].cond || wireCondOk(rules[i].cond, w, F)) return { idx: i, cut: wireAct(rules[i].act, w) };
  }
  function wireCondText(c) {
    var s = { none: 'there are no ' + c.c + ' wires', one: 'there is exactly one ' + c.c + ' wire', many: 'there is more than one ' + c.c + ' wire',
      last: 'the last wire is ' + c.c, first: 'the first wire is ' + c.c }[c.t];
    if (c.serial) s += ' and the serial number ends in an ' + c.serial + ' digit';
    return s;
  }
  function wireActText(a) {
    if (a.a === 'pos') return 'cut the ' + ORD[a.k] + ' wire';
    if (a.a === 'last') return 'cut the last wire';
    if (a.a === 'lastOf') return 'cut the last ' + a.c + ' wire';
    return 'cut the first ' + a.c + ' wire';
  }
  function genWires(t, r, isPresent) {
    var tables = {};
    for (var n = 3; n <= 6; n++) {
      var rules = [], k = n <= 4 ? 2 : 3;
      for (var i = 0; i < k; i++) {
        var ty = t.pick(['none', 'one', 'many', 'last', 'first']), c = t.pick(COLORS), cond = { t: ty, c: c };
        if (r >= 3 && t.pick([0, 0, 1])) cond.serial = t.pick(['odd', 'even']);
        var acts = [{ a: 'pos', k: t.randInt(0, n - 1) }, { a: 'last' }];
        if (ty !== 'none') { acts.push({ a: 'lastOf', c: c }); acts.push({ a: 'firstOf', c: c }); }
        rules.push({ cond: cond, act: t.pick(acts) });
      }
      rules.push({ cond: null, act: { a: 'pos', k: t.randInt(0, n - 1) } });
      tables[n] = rules;
    }
    var page = { type: 'wires', tables: tables };
    return page;
  }
  function wiresInstance(t, page, r, F) {
    var maxN = r <= 2 ? 4 : r <= 4 ? 5 : 6, n = t.randInt(3, maxN), rules = page.tables[n];
    var want = t.randInt(0, rules.length - 1), best = null;
    for (var tries = 0; tries < 60; tries++) {
      var w = []; for (var i = 0; i < n; i++) w.push(t.pick(COLORS));
      var s = wireSolve(rules, w, F);
      best = { wires: w, cut: s.cut };
      if (s.idx === want) break;
    }
    return { type: 'wires', wires: best.wires, answer: best.cut };
  }

  // ------------------------------------------------ gauge table
  function genGauge(t, r, T) {
    var rows = [], used = {};
    while (rows.length < 6) {
      var tag = T.gaugePrefix + '-' + t.randInt(10, 99); if (used[tag]) continue; used[tag] = 1;
      var lo = t.randInt(20, 42), hi = t.randInt(55, 80), pos = t.shuffle([1, 2, 3, 4]).slice(0, 3);
      rows.push({ tag: tag, lo: lo, hi: hi, pos: pos });
    }
    var twist = r >= 2 ? t.pick([{ t: 'vowelUp' }, { t: 'evenDown' }, { t: 'oddUp' }]) : null;
    return { type: 'gauge', rows: rows, twist: twist };
  }
  function gaugeTwistText(tw) {
    if (!tw) return '';
    if (tw.t === 'vowelUp') return 'If the serial number contains a vowel (A, E or U), use one position HIGHER (4 stays 4).';
    if (tw.t === 'evenDown') return 'If the serial number ends in an even digit, use one position LOWER (1 stays 1).';
    return 'If the serial number ends in an odd digit, use one position HIGHER (4 stays 4).';
  }
  function gaugeInstance(t, page, F) {
    var row = t.pick(page.rows), v;
    do { v = t.randInt(5, 95); } while (v === row.lo || v === row.hi);
    var a = v < row.lo ? row.pos[0] : v <= row.hi ? row.pos[1] : row.pos[2];
    var tw = page.twist;
    if (tw && tw.t === 'vowelUp' && F.vowel) a = Math.min(4, a + 1);
    if (tw && tw.t === 'evenDown' && F.even) a = Math.max(1, a - 1);
    if (tw && tw.t === 'oddUp' && F.odd) a = Math.min(4, a + 1);
    return { type: 'gauge', tag: row.tag, value: v, answer: a };
  }

  // ------------------------------------------------ symbol keypad
  function genKeypad(t, T) {
    var ids = []; for (var i = 0; i < T.symbols.length; i++) ids.push(i);
    var cols = [];
    for (var c = 0; c < 4; c++) cols.push(t.shuffle(ids.slice()).slice(0, 6));
    return { type: 'keypad', cols: cols };
  }
  function keypadInstance(t, page) {
    for (var tries = 0; tries < 400; tries++) {
      var ci = t.randInt(0, 3), col = page.cols[ci], four = t.shuffle(col.slice()).slice(0, 4);
      var others = page.cols.filter(function (c, j) { return j !== ci && four.every(function (s) { return c.indexOf(s) >= 0; }); });
      if (others.length) continue;
      var order = four.slice().sort(function (a, b) { return col.indexOf(a) - col.indexOf(b); });
      return { type: 'keypad', shown: t.shuffle(four.slice()), answer: order };
    }
    // fallback (practically never): use the whole first 4 of column 0
    var c0 = page.cols[0].slice(0, 4);
    return { type: 'keypad', shown: t.shuffle(c0.slice()), answer: c0 };
  }

  // ------------------------------------------------ switch bank
  function genSwitches(t, r) {
    var rows = [], used = {};
    while (rows.length < 8) {
      var code = 'E-' + t.randInt(100, 999); if (used[code]) continue; used[code] = 1;
      var p; do { p = [0, 0, 0, 0, 0].map(function () { return t.pick([true, false]); }); } while (p.every(function (x) { return x === p[0]; }));
      rows.push({ code: code, pattern: p });
    }
    var twist = r >= 3 && t.pick([0, 1, 1]) ? { t: 'evenReverse' } : null;
    return { type: 'switches', rows: rows, twist: twist };
  }
  function switchesInstance(t, page, F) {
    var row = t.pick(page.rows), ans = row.pattern.slice();
    if (page.twist && F.even) ans.reverse();
    var init; do { init = [0, 0, 0, 0, 0].map(function () { return t.pick([true, false]); }); } while (init.join() === ans.join());
    return { type: 'switches', code: row.code, init: init, answer: ans };
  }

  // ------------------------------------------------ procedure
  function genProcedure(t, T) {
    var steps = t.shuffle(T.steps.slice()).slice(0, 4), lamps = t.shuffle(LAMPS.slice()).slice(0, 3), rows = [], seen = {};
    lamps.forEach(function (l) {
      var o; do { o = t.shuffle([0, 1, 2, 3]); } while (seen[o.join()]);
      seen[o.join()] = 1; rows.push({ lamp: l, order: o });
    });
    return { type: 'procedure', steps: steps, rows: rows };
  }
  function procedureInstance(t, page) {
    var row = t.pick(page.rows);
    return { type: 'procedure', lamp: row.lamp, buttons: t.shuffle(page.steps.slice()), answer: row.order.map(function (i) { return page.steps[i]; }) };
  }

  // ------------------------------------------------ round
  function operatorOf(N, k) { return k % N; }
  function buildRound(T, code, N, runNo, r, k) {
    var rnd = rng(['fix', T.id, code, N, runNo, r, k].join('|')), t = tools(rnd);
    var spec = roundSpec(r);
    var serial = t.pick(LETTERS.split('')) + t.pick(LETTERS.split('')) + t.randInt(0, 9) + '-' + t.randInt(0, 9) + t.pick(LETTERS.split('')) + t.randInt(0, 9);
    var F = facts(serial);
    var pages = {
      wires: genWires(t, r), gauge: genGauge(t, r, T), keypad: genKeypad(t, T),
      switches: genSwitches(t, r), procedure: genProcedure(t, T)
    };
    var types = r === 1 ? [t.pick(['switches', 'gauge'])] : t.shuffle(TYPES.slice()).slice(0, spec.mods);
    var modules = types.map(function (ty) {
      if (ty === 'wires') return wiresInstance(t, pages.wires, r, F);
      if (ty === 'gauge') return gaugeInstance(t, pages.gauge, F);
      if (ty === 'keypad') return keypadInstance(t, pages.keypad);
      if (ty === 'switches') return switchesInstance(t, pages.switches, F);
      return procedureInstance(t, pages.procedure);
    });
    var op = operatorOf(N, k), readers = [];
    for (var s = 0; s < N; s++) if (s !== op) readers.push(s);
    var holder = {};
    TYPES.forEach(function (ty, p) { holder[ty] = readers.length ? readers[(p + k) % readers.length] : op; });
    var ok = codeFor(T, code, N, runNo, k, 'ok'), fail = codeFor(T, code, N, runNo, k, 'fail');
    return { r: r, k: k, time: spec.time, serial: serial, facts: F, types: types, modules: modules, pages: pages, op: op, holder: holder, okCode: ok, failCode: fail };
  }
  function codeFor(T, code, N, runNo, k, kind) {
    var c = String(1000 + hash(['code', T.id, code, N, runNo, k, kind].join('|')) % 9000);
    if (kind === 'fail' && c === codeFor(T, code, N, runNo, k, 'ok')) c = String(1000 + (+c - 999) % 9000);
    return c;
  }

  // ------------------------------------------------ text helpers for the manual
  function wiresManual(page) {
    var out = {};
    for (var n = 3; n <= 6; n++) {
      out[n] = page.tables[n].map(function (rule, i) {
        if (!rule.cond) return 'Otherwise, ' + wireActText(rule.act) + '.';
        return (i === 0 ? 'If ' : 'Otherwise, if ') + wireCondText(rule.cond) + ', ' + wireActText(rule.act) + '.';
      });
    }
    return out;
  }

  var FA = ['AMBER', 'BLUE', 'CORAL', 'DUSK', 'EMBER', 'FERN', 'GOLD', 'IRON', 'JADE', 'LIME', 'MINT', 'NAVY', 'OCHRE', 'PLUM', 'RUST', 'SAGE', 'TEAL', 'UMBER', 'VIOLET', 'WHEAT'];
  var FN = ['OWL', 'FOX', 'CRAB', 'HAWK', 'IBIS', 'KOI', 'LYNX', 'MOTH', 'NEWT', 'ORCA', 'PUMA', 'QUAIL', 'RAVEN', 'SEAL', 'TAPIR', 'VOLE', 'WREN', 'YAK', 'ZEBU', 'BISON'];
  function fingerprint(T, code, N, runNo) {
    var h = hash('fp|' + T.id + '|' + code + '|' + N + '|' + runNo);
    return FA[h % 20] + ' ' + FN[Math.floor(h / 20) % 20] + ' ' + (10 + Math.floor(h / 400) % 90);
  }
  var AL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function checkCode(f) {
    var str = ['fx1', f.title, f.code, f.N, f.s, f.runNo, f.fixed, f.attempts, f.lives, f.status].join('|');
    var h = hash('ntu-fixit-26|' + str), out = '';
    for (var i = 0; i < 6; i++) { out += AL[h % AL.length]; h = Math.floor(h / AL.length); }
    return out;
  }

  // ------------------------------------------------ teacher: check and rank pasted logs
  function points(rank) { return rank === 1 ? 100 : rank <= 3 ? 95 : rank <= 6 ? 90 : 80; }
  function parseLog(t) {
    function m(re) { var r = t.match(re); return r ? r[1].trim() : null; }
    var f = { title: m(/^\s*([A-Z][A-Z ]+?)\s*·/m), code: m(/Team:\s*([A-Z0-9]+)/), N: m(/Station\s+\d+\s+of\s+(\d+)/), s: m(/Station\s+(\d+)\s+of/),
      runNo: m(/Game\s+(\d+)/), fixed: m(/Machines fixed:\s*(\d+)/), attempts: m(/Attempts:\s*(\d+)/), lives: m(/Spare parts left:\s*(\d+)/), status: m(/Status:\s*([a-z0-9 #]+)/) };
    var code = m(/Check:\s*([A-Z0-9]+)/), players = m(/Players:\s*(.+)$/m);
    if (Object.keys(f).some(function (k) { return f[k] === null; }) || !code) return { ok: false, why: 'incomplete', team: f.code };
    ['N', 's', 'runNo', 'fixed', 'attempts', 'lives'].forEach(function (k) { f[k] = +f[k]; });
    var ok = checkCode(f) === code, race = f.status.match(/in (\d+)s/);
    return { ok: ok, why: ok ? '' : 'edited', f: f, team: f.code, players: players || '', finished: /^finished/.test(f.status), raceSec: race ? +race[1] : null };
  }
  function rankLogs(text) {
    var starts = [], re = /^[ \t]*[A-Z][A-Z ]+ · [^\n]*$/gm, x;
    while ((x = re.exec(text))) starts.push(x.index);
    var blocks = starts.map(function (st, i) { return text.slice(st, i + 1 < starts.length ? starts[i + 1] : text.length); });
    var teams = {}, problems = [], checked = 0;
    blocks.forEach(function (b) {
      var L = parseLog(b);
      if (!L.ok) { problems.push({ team: L.team || '?', why: L.why }); return; }
      checked++;
      var who = L.players.split(',').map(function (n) { return n.trim().toLowerCase(); }).sort().join(',');
      var key = L.f.title + '|' + L.f.code + '|' + who, cur = teams[key];
      var better = !cur || (L.finished && (!cur.finished || L.raceSec < cur.raceSec)) || (!L.finished && !cur.finished && L.f.fixed > cur.fixed);
      if (better) teams[key] = { title: L.f.title, team: L.f.code, players: L.players, finished: L.finished, raceSec: L.raceSec, fixed: L.f.fixed, game: L.f.runNo };
    });
    var list = Object.keys(teams).map(function (k) { return teams[k]; });
    list.sort(function (a, b) { if (a.finished !== b.finished) return a.finished ? -1 : 1; if (a.finished) return a.raceSec - b.raceSec; return b.fixed - a.fixed; });
    var place = 0;
    list.forEach(function (t) { if (t.finished) { place++; t.place = place; t.points = points(place); } else { t.place = null; t.points = 80; } });
    return { rows: list, problems: problems, checked: checked };
  }

  return { points: points, rankLogs: rankLogs, parseLog: parseLog, LIVES: LIVES, MAX_FAULTS: MAX_FAULTS, TYPES: TYPES, COLORS: COLORS, buildRound: buildRound, roundSpec: roundSpec,
    wiresManual: wiresManual, gaugeTwistText: gaugeTwistText, fingerprint: fingerprint, checkCode: checkCode, hash: hash, wireSolve: wireSolve, facts: facts };
})();
if (typeof module !== 'undefined') module.exports = FIX;
