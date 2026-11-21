// Run: NODE_PATH=... node tests/features.test.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || '/tmp/shots';
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + extra : '')); if (!cond) fails++; };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/chess.html'));
  await page.waitForTimeout(500);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // helper: play a SAN-less sequence by uci strings through the controller
  const playUci = async (list, wait = 40) => {
    for (const u of list) {
      await ev(u => { const from = Chess.nameSq(u.slice(0, 2)), to = Chess.nameSq(u.slice(2, 4)); const pr = u[4] ? 'nbrq'.indexOf(u[4]) >= 0 ? { n: 2, b: 3, r: 4, q: 5 }[u[4]] : 0 : 0;
        const m = G.pos.findMove(from, to, pr, G.legal); if (!m) throw new Error('illegal ' + u); commitMove(m, { instant: true, noAI: true }); }, u);
      await page.waitForTimeout(wait);
    }
  };

  // ---- 2 players, face to face ----
  await ev(() => { S.mode = '2p'; S.twoPView = 'facing'; S.clock = '3+2'; S.animSpeed = 200; saveSettings(); UI.closeAllDialogs(); newGame(); });
  await page.waitForTimeout(300);
  ok('2p: facing flag', await ev(() => R.facing === true));
  ok('2p: clock on 3:00', await ev(() => G.clock.on && G.clock.t[0] === 180));
  await playUci(['e2e4', 'd7d5']);
  await page.waitForTimeout(500);
  await ev(() => { const m = G.pos.findMove(Chess.nameSq('e4'), Chess.nameSq('d5'), 0, G.legal); commitMove(m, { noAI: true }); });
  await page.waitForTimeout(120);
  await page.screenshot({ path: OUT + '/10-2p-capture-fx.png' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/11-2p-facing.png' });
  ok('capture recorded', await ev(() => G.captured[0].length === 1));
  ok('increment applied (white moved twice, +2s each)', await ev(() => G.clock.t[0] > 180 && G.clock.t[0] <= 184.1), await ev(() => G.clock.t[0].toFixed(2)));

  // ---- 2 players, flip mode rotates the board ----
  await ev(() => { S.twoPView = 'flip'; S.clock = 'none'; saveSettings(); applyKeys(new Set(['twoPView'])); newGame(); });
  await page.waitForTimeout(200);
  await ev(() => { const m = G.pos.findMove(Chess.nameSq('e2'), Chess.nameSq('e4'), 0, G.legal); commitMove(m, { noAI: true }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/12-flip-mid-rotation.png' });
  await page.waitForTimeout(900);
  ok('flip: board rotated to black', await ev(() => R.view.flipped === true && Math.abs(R.view.angle - Math.PI) < 0.01), await ev(() => R.view.angle.toFixed(3)));
  // hit test while rotated: tap e7 (black pawn) must select it
  await page.waitForTimeout(100);
  const p = await ev(() => { const s = Chess.nameSq('e7'); const [x, y] = (() => { const [sx, sy] = (function () { const a = R.view.angle, cx = R.side / 2, cy = R.side / 2; const px = R.bx + (s & 7) * R.cs + R.cs / 2, py = R.by + (7 - (s >> 4)) * R.cs + R.cs / 2; const dx = px - cx, dy = py - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; })(); const r = R.cv.getBoundingClientRect(); return [r.left + sx * r.width / R.side, r.top + sy * r.height / R.side]; })(); return { x, y }; });
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(150);
  ok('flip: tapping rotated e7 selects it', await ev(() => R.sel === Chess.nameSq('e7')), await ev(() => R.sel));
  await page.screenshot({ path: OUT + '/13-flipped-selected.png' });

  // ---- special rules via real game flow ----
  await ev(() => { S.mode = '2p'; S.twoPView = 'none'; S.autoQueen = false; saveSettings(); newGame(); });
  // castling both sides, en passant, promotion
  await playUci(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']);
  ok('kingside castle moved rook', await ev(() => G.pos.board[Chess.nameSq('f1')] === 4 && G.pos.board[Chess.nameSq('g1')] === 6));
  await ev(() => newGame());
  await playUci(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
  ok('en passant removes pawn', await ev(() => G.pos.board[Chess.nameSq('d5')] === 0 && G.pos.board[Chess.nameSq('d6')] === 1));
  ok('en passant SAN', await ev(() => G.sans[4] === 'exd6'), await ev(() => G.sans[4]));
  await ev(() => { G.startFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'; G.pos.setFen(G.startFen); G.moves = []; G.sans = []; G.reps = [G.pos.repKey()]; G.legal = G.pos.legalMoves(); R.syncDisp(); UI.update(); });
  await page.waitForTimeout(100);
  // promotion dialog appears on a tap move
  const tapSq = async n => { const q = await ev(n => { const s = Chess.nameSq(n); const r = R.cv.getBoundingClientRect(); return { x: r.left + (R.bx + (s & 7) * R.cs + R.cs / 2) * r.width / R.side, y: r.top + (R.by + (7 - (s >> 4)) * R.cs + R.cs / 2) * r.height / R.side }; }, n); await page.mouse.click(q.x, q.y); await page.waitForTimeout(100); };
  await tapSq('a7'); await tapSq('a8');
  await page.waitForTimeout(200);
  ok('promotion dialog shown', await ev(() => !!document.querySelector('.promo')));
  await page.screenshot({ path: OUT + '/14-promotion.png' });
  await page.locator('.promo button').nth(1).click(); // rook
  await page.waitForTimeout(500);
  ok('promoted to rook', await ev(() => (G.pos.board[Chess.nameSq('a8')] & 7) === 4), await ev(() => G.sans.join(' ')));

  // ---- checkmate -> game over dialog ----
  await ev(() => newGame());
  await playUci(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  await page.waitForTimeout(1600);
  ok('checkmate detected', await ev(() => G.over && G.reason === 'checkmate' && G.result === '0-1'));
  ok('game over dialog', await ev(() => document.querySelector('.card h2') && /wins/.test(document.querySelector('.card h2').textContent)), await ev(() => document.querySelector('.card h2') && document.querySelector('.card h2').textContent));
  await page.screenshot({ path: OUT + '/15-gameover.png' });
  await ev(() => UI.closeAllDialogs());

  // ---- threefold repetition ----
  await ev(() => newGame());
  await playUci(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
  ok('threefold repetition draw', await ev(() => G.over && G.reason === 'threefold repetition'), await ev(() => G.reason));
  await ev(() => UI.closeAllDialogs());

  // ---- time out ----
  await ev(() => { S.clock = 'custom'; S.clockMin = 1; saveSettings(); newGame(); });
  await playUci(['e2e4']);
  await ev(() => { G.clock.t[1] = 0.15; });
  await page.waitForTimeout(700);
  ok('time out ends game', await ev(() => G.over && G.reason === 'time out' && G.result === '1-0'), await ev(() => G.reason));
  await ev(() => { UI.closeAllDialogs(); S.clock = 'none'; saveSettings(); });

  // ---- save / continue ----
  await ev(() => { S.mode = 'ai'; S.playerColor = 'white'; S.autoSave = true; newGame(); });
  await playUci(['e2e4']);
  await page.waitForFunction(() => !G.thinking, null, { timeout: 15000 });
  const n1 = await ev(() => G.moves.length);
  await page.reload(); await page.waitForTimeout(600);
  ok('save exists after reload', await ev(() => hasSave()));
  await page.getByText('Continue game').click(); await page.waitForTimeout(400);
  await page.waitForTimeout(1500);
  ok('continue restores game (AI resumes its turn)', await ev(n => G.moves.length >= n && G.sans[0] === 'e4', n1), n1 + ' -> ' + await ev(() => G.moves.length));

  // ---- play as black: AI moves first, board flipped ----
  await ev(() => { S.mode = 'ai'; S.playerColor = 'black'; saveSettings(); newGame(); });
  await page.waitForFunction(() => G.moves.length === 1, null, { timeout: 15000 });
  ok('black: view flipped + AI opened', await ev(() => R.view.flipped && G.moves.length === 1));

  // ---- every difficulty preset returns legal move quickly ----
  for (const lv of ['beginner', 'casual', 'club', 'strong', 'master']) {
    const t0 = Date.now();
    const r = await ev(async lv => { S.level = lv; setValue(DEFBY.level, lv); const o = { depth: S.aiDepth, time: Math.min(S.aiTime, 1500), blunder: S.aiBlunder, random: S.aiRandom, aggr: S.aiAggr }; const pos = new Chess.Position(); const res = await AI.search(START_FEN, [], o); return pos.legalMoves().includes(res.move) ? res.depth : -1; }, lv);
    ok('AI level ' + lv + ' legal move', r >= 0, 'depth ' + r + ' in ' + (Date.now() - t0) + 'ms');
  }

  // ---- stress: toggle every setting through every option, expect no exceptions ----
  const before = errors.length;
  await ev(() => { UI.closeAllDialogs(); newGame(true); });
  const count = await ev(async () => {
    let n = 0;
    for (const d of DEFS) {
      if (!d.key || d.key === 'orientation') continue;
      let vals = [];
      if (d.type === 'toggle') vals = [true, false];
      else if (d.type === 'slider') vals = [d.min, d.max, d.def];
      else if (d.type === 'seg' || d.type === 'chips') vals = d.opts.map(o => o[0]);
      else if (d.type === 'color') vals = ['#ff00aa', '#123456', d.def];
      for (const v of vals) { setValue(d, v); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); n++; }
    }
    return n;
  });
  console.log('stress applied', count, 'setting changes');
  await ev(() => { Object.assign(S, DEFAULTS); applyKeys(new Set(Object.keys(DEFBY))); newGame(true); });
  ok('no errors during settings stress', errors.length === before, errors.slice(before).join(' | '));

  // ---- fps cap respected ----
  await ev(() => { Object.assign(S, DEFAULTS); S.fpsCap = 30; S.bgType = 'animated'; applyKeys(new Set(['fpsCap'])); newGame(true); R.confetti(400); });
  const frames = await ev(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  const drawn = await ev(() => new Promise(res => { R.frames = 0; R.fpsT = performance.now(); setTimeout(() => res(R.fps), 1300); }));
  console.log('fps cap 30 -> measured renderer fps', drawn, '(raf ran', frames + '/s)');
  ok('fps cap limits renderer', drawn > 0 && drawn <= 34, 'fps=' + drawn);

  console.log('ERRORS:', errors.length ? errors : 'none');
  console.log(fails ? 'FAILURES: ' + fails : 'ALL FEATURE TESTS PASSED');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
