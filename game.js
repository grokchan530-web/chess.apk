/* ===== Game controller: rules flow, AI worker, clocks, undo/redo, save/load ===== */
const { mFrom, mTo, mPromo, mFlags } = Chess;
const START_FEN = Chess.START_FEN;
const PIECE_VAL = [0, 1, 3, 3, 5, 9, 0];
const SAVE_KEY = 'chess.save.v1';

const G = {
  pos: new Chess.Position(), startFen: START_FEN,
  moves: [], sans: [], snaps: [], reps: [], redo: [], captured: [[], []],
  mode: 'ai', human: 0, aiColor: 1, levelName: 'Club',
  over: false, result: '*', reason: '',
  clock: { on: false, base: 0, inc: 0, t: [0, 0], side: 0, running: false, last: 0 },
  thinking: false, searchId: 0, legal: [], lastTickSec: -1,
};
R.getBoard = () => G.pos.board;

// ---------- AI (Web Worker with main-thread fallback) ----------
const WORKER_GLUE = 'self.onmessage=function(e){var d=e.data;var pos=new Chess.Position();pos.setFen(d.startFen);' +
  'for(var i=0;i<d.moves.length;i++)pos.make(d.moves[i]);var r=Chess.search(pos,d.opts);' +
  'self.postMessage({id:d.id,move:r.move,score:r.score,depth:r.depth});};';
const AI = {
  worker: null, ok: true, pending: new Map(), nid: 0,
  init() {
    try {
      const src = document.getElementById('engine-src').textContent;
      const blob = new Blob([src + '\n' + WORKER_GLUE], { type: 'text/javascript' });
      const w = new Worker(URL.createObjectURL(blob));
      w.onmessage = e => { const d = e.data; const p = AI.pending.get(d.id); if (p) { AI.pending.delete(d.id); p.res(d); } };
      w.onerror = () => AI.fallback();
      this.worker = w; this.ok = true;
    } catch (e) { this.ok = false; this.worker = null; }
  },
  fallback() {
    this.ok = false;
    if (this.worker) { try { this.worker.terminate(); } catch (e) {} this.worker = null; }
    const items = Array.from(this.pending.values()); this.pending.clear();
    items.forEach(p => this.runLocal(p));
  },
  runLocal(p) {
    setTimeout(() => {
      const pos = new Chess.Position(); pos.setFen(p.startFen);
      for (const m of p.moves) pos.make(m);
      const r = Chess.search(pos, p.opts);
      p.res({ id: p.id, move: r.move, score: r.score, depth: r.depth });
    }, 30);
  },
  search(startFen, moves, opts) {
    return new Promise(res => {
      const id = ++this.nid, p = { id, res, startFen, moves, opts };
      if (this.ok && this.worker) {
        this.pending.set(id, p);
        try { this.worker.postMessage({ id, startFen, moves, opts }); } catch (e) { this.fallback(); }
      } else this.runLocal(p);
    });
  },
  cancel() {
    this.pending.clear();
    if (this.worker) { try { this.worker.terminate(); } catch (e) {} this.worker = null; if (this.ok) this.init(); }
  },
};

function whenIdle(fn) { if (!R.busy()) fn(); else setTimeout(() => whenIdle(fn), 30); }

// ---------- helpers ----------
function parseClock() {
  const c = S.clock;
  if (c === 'none') return [0, 0];
  if (c === 'custom') return [S.clockMin * 60, S.clockInc];
  const p = c.split('+').map(Number);
  return [p[0] * 60, p[1] || 0];
}
function forceView(flipped) {
  R.view.flipped = flipped; R.view.angle = flipped ? Math.PI : 0; R.view.dur = 0;
  if (R.cv) R.cv.style.filter = '';
  R.needs = true;
}
function lastMoveSquares() {
  if (!G.moves.length) return [-1, -1];
  const m = G.moves[G.moves.length - 1];
  return [mFrom(m), mTo(m)];
}
function refreshMarks() {
  const lm = lastMoveSquares();
  R.setSelection(-1); R.setLast(lm[0], lm[1]);
  R.setCheck(G.legal.length >= 0 && G.pos.inCheck() ? G.pos.king[G.pos.turn] : -1);
  R.setHint(-1);
}
function material() {
  let w = 0, b = 0;
  for (const p of G.captured[0]) w += PIECE_VAL[p & 7];
  for (const p of G.captured[1]) b += PIECE_VAL[p & 7];
  return w - b;
}

// ---------- new game ----------
function newGame(silent) {
  AI.cancel(); G.searchId++; G.thinking = false; R.cancelAnims(); R.drag = null;
  G.mode = S.mode;
  if (G.mode === 'ai') {
    let pc = S.playerColor;
    if (pc === 'random') pc = Math.random() < 0.5 ? 'white' : 'black';
    G.human = pc === 'white' ? 0 : 1; G.aiColor = G.human ^ 1;
    G.levelName = S.level === 'custom' ? 'Custom' : S.level.charAt(0).toUpperCase() + S.level.slice(1);
  } else { G.human = 0; G.aiColor = -1; }
  G.startFen = START_FEN; G.pos.setFen(START_FEN);
  G.moves = []; G.sans = []; G.snaps = []; G.redo = []; G.captured = [[], []];
  G.reps = [G.pos.repKey()];
  G.over = false; G.result = '*'; G.reason = '';
  const [base, inc] = parseClock();
  G.clock = { on: base > 0, base, inc, t: [base, base], side: 0, running: false, last: performance.now() };
  G.legal = G.pos.legalMoves();
  R.facing = G.mode === '2p' && S.twoPView === 'facing';
  forceView(G.mode === 'ai' && G.human === 1);
  R.syncDisp(); refreshMarks();
  UI.update();
  if (!silent) { Snd.play('start'); maybeAI(); }
}

// ---------- AI turn ----------
function maybeAI() {
  if (G.over || G.mode !== 'ai' || G.pos.turn !== G.aiColor || G.thinking || !G.legal.length) return;
  const id = ++G.searchId;
  G.thinking = true; UI.setThinking(true); UI.update();
  const opts = { depth: S.aiDepth, time: S.aiTime, blunder: S.aiBlunder, random: S.aiRandom, aggr: S.aiAggr };
  const t0 = performance.now();
  AI.search(G.startFen, G.moves.slice(), opts).then(res => {
    if (id !== G.searchId) return;
    const wait = Math.max(0, S.aiDelay - (performance.now() - t0));
    setTimeout(() => {
      if (id !== G.searchId) return;
      whenIdle(() => {
        if (id !== G.searchId) return;
        G.thinking = false; UI.setThinking(false);
        if (res.move && G.legal.includes(res.move)) commitMove(res.move, {});
        else UI.update();
      });
    }, wait);
  });
}

// ---------- clock ----------
function tickClock() {
  const c = G.clock, now = performance.now();
  if (!c.on || !c.running || G.over) { c.last = now; return; }
  if (UI.modalOpen()) { c.last = now; return; }
  const el = Math.min(0.5, (now - c.last) / 1000);
  c.last = now;
  c.t[c.side] -= el;
  if (S.lowTimeTick && c.t[c.side] < 10 && c.t[c.side] > 0) {
    const sec = Math.ceil(c.t[c.side]);
    if (sec !== G.lastTickSec) { G.lastTickSec = sec; Snd.play('tick'); }
  }
  if (c.t[c.side] <= 0) {
    c.t[c.side] = 0;
    // insufficient material for the opponent means a draw rather than a loss
    endGame({ over: true, result: c.side === 0 ? '0-1' : '1-0', reason: 'time out' });
  }
}
setInterval(() => { tickClock(); UI.drawClocks(); }, 100);

// ---------- moves ----------
function commitMove(m, opt) {
  opt = opt || {};
  const pos = G.pos, legal = G.legal;
  if (!legal.includes(m)) return false;
  const from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlags(m);
  const piece = pos.board[from], us = pos.turn;
  const san = pos.san(m, legal);
  let cap = pos.board[to], capSq = to;
  if (fl & 2) { capSq = to + (us === 0 ? -16 : 16); cap = pos.board[capSq]; }
  const info = { piece, from, to, cap, capSq: cap ? capSq : -1, promo: promo ? ((us << 3) | promo) : 0, rook: null, instant: !!opt.instant };
  if (fl & 8) info.rook = { piece: (us << 3) | Chess.R, from: to + 1, to: to - 1 };
  else if (fl & 16) info.rook = { piece: (us << 3) | Chess.R, from: to - 2, to: to + 1 };

  tickClock();
  pos.make(m);
  G.moves.push(m); G.sans.push(san);
  if (cap) G.captured[us].push(cap);
  if (!opt.fromRedo) G.redo.length = 0;
  const c = G.clock;
  if (c.on) {
    if (c.running) c.t[us] += c.inc; else c.running = true;
    c.side = us ^ 1; c.last = performance.now(); G.lastTickSec = -1;
  }
  G.snaps.push([c.t[0], c.t[1]]);

  G.legal = pos.legalMoves();
  const key = pos.repKey(); G.reps.push(key);
  const reps = G.reps.filter(k => k === key).length;
  const inChk = pos.inCheck();
  let st = { over: false };
  if (!G.legal.length) st = inChk ? { over: true, result: us === 0 ? '1-0' : '0-1', reason: 'checkmate' } : { over: true, result: '1/2-1/2', reason: 'stalemate' };
  else if (pos.insufficient()) st = { over: true, result: '1/2-1/2', reason: 'insufficient material' };
  else if (reps >= 3) st = { over: true, result: '1/2-1/2', reason: 'threefold repetition' };
  else if (pos.half >= 100) st = { over: true, result: '1/2-1/2', reason: 'fifty-move rule' };

  R.setSelection(-1); R.setLast(from, to); R.setCheck(inChk ? pos.king[pos.turn] : -1); R.setHint(-1);
  info.onLand = () => {
    if (st.over && st.reason === 'checkmate') { /* end sound handled in endGame */ }
    else if (inChk) Snd.play('check');
    else if (promo) Snd.play('promote');
    else if (fl & 24) Snd.play('castle');
    else Snd.play(cap ? 'capture' : 'move');
    haptic(cap || inChk ? 'mid' : 'light');
    if (G.mode === '2p' && S.twoPView === 'flip' && !st.over && !opt.noFlip) { R.setFlip(pos.turn === 1, true); UI.update(); }
    if (st.over) endGame(st);
  };
  R.animateMove(info);
  UI.update(); saveGame();
  if (!st.over && !opt.noAI) maybeAI();
  return true;
}

function endGame(st) {
  if (G.over) return;
  G.over = true; G.result = st.result; G.reason = st.reason; G.clock.running = false;
  G.searchId++; G.thinking = false; UI.setThinking(false); AI.cancel();
  const draw = st.result === '1/2-1/2';
  const humanWon = G.mode === 'ai' ? ((st.result === '1-0' && G.human === 0) || (st.result === '0-1' && G.human === 1)) : true;
  Snd.play(draw ? 'draw' : (G.mode === 'ai' && !humanWon ? 'lose' : 'win'));
  haptic('big');
  if (!draw && humanWon && S.winConfetti) R.confetti(150);
  LS.del(SAVE_KEY);
  UI.update();
  setTimeout(() => UI.showGameOver(), 900);
}
function resign() {
  if (G.over || !G.moves.length && G.mode === 'ai' && false) return;
  const loser = G.mode === 'ai' ? G.human : G.pos.turn;
  endGame({ over: true, result: loser === 0 ? '0-1' : '1-0', reason: 'resignation' });
}
function agreeDraw() { if (!G.over) endGame({ over: true, result: '1/2-1/2', reason: 'agreement' }); }

// ---------- replay / undo / redo ----------
function replay(moves) {
  G.pos.setFen(G.startFen);
  G.moves = []; G.sans = []; G.captured = [[], []]; G.reps = [G.pos.repKey()];
  for (const m of moves) {
    const legal = G.pos.legalMoves();
    if (!legal.includes(m)) return false;
    const us = G.pos.turn, fl = mFlags(m);
    let cap = G.pos.board[mTo(m)];
    if (fl & 2) cap = G.pos.board[mTo(m) + (us === 0 ? -16 : 16)];
    G.sans.push(G.pos.san(m, legal));
    G.pos.make(m); G.moves.push(m);
    if (cap) G.captured[us].push(cap);
    G.reps.push(G.pos.repKey());
  }
  G.legal = G.pos.legalMoves();
  return true;
}
function rewind(n) {
  const keep = G.moves.slice(0, G.moves.length - n), removed = G.moves.slice(G.moves.length - n);
  AI.cancel(); G.searchId++; G.thinking = false; UI.setThinking(false); R.cancelAnims(); R.drag = null;
  for (let i = removed.length - 1; i >= 0; i--) G.redo.push(removed[i]);
  replay(keep);
  G.over = false; G.result = '*'; G.reason = '';
  G.snaps.length = keep.length;
  const c = G.clock;
  if (c.on) {
    const sn = keep.length ? G.snaps[keep.length - 1] : [c.base, c.base];
    c.t = [sn[0], sn[1]]; c.side = G.pos.turn; c.last = performance.now(); c.running = keep.length > 0;
  }
  R.syncDisp(); refreshMarks();
  UI.update(); Snd.play('select'); saveGame();
  maybeAI();
}
function undo() {
  if (!S.allowUndo || !G.moves.length) return;
  let n = 1;
  if (G.mode === 'ai') {
    if (G.pos.turn === G.human && !G.over) n = Math.min(2, G.moves.length);
    else if (G.over) n = (G.pos.turn === G.human) ? Math.min(2, G.moves.length) : 1;
    if (G.moves.length - n < 0) n = G.moves.length;
    if (G.human === 1 && G.moves.length - n === 0 && G.aiColor === 0 && n === 1 && !G.thinking && G.pos.turn === G.human) { UI.toast('Nothing to undo yet'); return; }
  }
  rewind(n);
}
function redo() {
  if (!S.allowUndo || !G.redo.length || R.busy() || G.over) return;
  let n = G.mode === 'ai' ? 2 : 1;
  while (n > 0 && G.redo.length) {
    const m = G.redo.pop(); n--;
    G.legal = G.pos.legalMoves();
    if (!G.legal.includes(m)) { G.redo.length = 0; break; }
    commitMove(m, { fromRedo: true, instant: true, noAI: n > 0 && G.redo.length > 0, noFlip: false });
  }
}

// ---------- save / load ----------
function saveGame() {
  if (!S.autoSave) return;
  if (G.over || !G.moves.length) { if (G.over) LS.del(SAVE_KEY); return; }
  LS.set(SAVE_KEY, JSON.stringify({
    startFen: G.startFen, moves: G.moves, mode: G.mode, human: G.human, level: G.levelName,
    clock: { on: G.clock.on, base: G.clock.base, inc: G.clock.inc, t: G.clock.t }, snaps: G.snaps,
    flipped: R.view.flipped, facing: R.facing,
  }));
}
function hasSave() { return !!LS.get(SAVE_KEY); }
function loadSave() {
  try {
    const o = JSON.parse(LS.get(SAVE_KEY));
    AI.cancel(); G.searchId++; G.thinking = false; R.cancelAnims(); R.drag = null;
    G.mode = o.mode; G.human = o.human; G.aiColor = o.mode === 'ai' ? (o.human ^ 1) : -1; G.levelName = o.level || 'Club';
    G.startFen = o.startFen;
    if (!replay(o.moves)) return false;
    G.redo = []; G.over = false; G.result = '*';
    G.clock = { on: o.clock.on, base: o.clock.base, inc: o.clock.inc, t: o.clock.t.slice(), side: G.pos.turn, running: o.clock.on && o.moves.length > 0, last: performance.now() };
    G.snaps = o.snaps || [];
    R.facing = !!o.facing; forceView(!!o.flipped);
    R.syncDisp(); refreshMarks();
    UI.update(); maybeAI();
    return true;
  } catch (e) { return false; }
}

// ---------- hint ----------
function hint() {
  if (G.over || G.thinking || R.busy()) return;
  if (G.mode === 'ai' && G.pos.turn !== G.human) return;
  const n = G.moves.length;
  UI.toast('Finding a good move…');
  AI.search(G.startFen, G.moves.slice(), { depth: 5, time: 1200, blunder: 0, random: 0, aggr: 0 }).then(r => {
    if (r.move && !G.over && G.moves.length === n) { R.setHint(mFrom(r.move), mTo(r.move)); }
  });
}
function flipBoard() { R.setFlip(!R.view.flipped, true); Snd.play('flip'); UI.update(); }

// ---------- input ----------
function canMove() {
  return !G.over && !R.busy() && !G.thinking && !UI.modalOpen() && (G.mode === '2p' || G.pos.turn === G.human);
}
function selectSquare(sq) {
  const tg = [], caps = [];
  for (const m of G.legal) {
    if (mFrom(m) === sq) { const t = mTo(m); if (tg.indexOf(t) < 0) tg.push(t); if (mFlags(m) & 1) caps.push(t); }
  }
  R.setSelection(sq, tg, caps);
  Snd.play('select'); haptic('light');
}
function tryMove(from, to, opt) {
  const cands = G.legal.filter(m => mFrom(m) === from && mTo(m) === to);
  if (!cands.length) return;
  if (cands.length === 1) { commitMove(cands[0], opt); return; }
  if (S.autoQueen) { commitMove(cands.find(m => mPromo(m) === Chess.Q) || cands[0], opt); return; }
  UI.askPromotion(G.pos.turn).then(pr => {
    if (!pr) return;
    const m = cands.find(x => mPromo(x) === pr);
    if (m) commitMove(m, opt);
  });
}
function onDown(sq, px, py) {
  Snd.unlock();
  if (!canMove()) return;
  if (sq < 0) { R.setSelection(-1); return; }
  if (R.sel >= 0 && S.inputMode !== 'drag' && R.targets.indexOf(sq) >= 0) { tryMove(R.sel, sq, {}); return; }
  const p = G.pos.board[sq];
  if (p && (p >> 3) === G.pos.turn) {
    selectSquare(sq);
    if (S.inputMode !== 'tap') R.drag = { sq, piece: p, x: px, y: py, sx: px, sy: py, moved: false };
  } else R.setSelection(-1);
}
function onMove(px, py) {
  const d = R.drag; if (!d) return;
  d.x = px; d.y = py;
  if (!d.moved && Math.hypot(px - d.sx, py - d.sy) > R.cs * 0.18) d.moved = true;
  R.needs = true;
}
function onUp(sq) {
  const d = R.drag; R.drag = null; R.needs = true;
  if (!d || !d.moved) return;
  if (sq >= 0 && sq !== d.sq && R.targets.indexOf(sq) >= 0) tryMove(d.sq, sq, { instant: true });
  else if (sq >= 0 && sq !== d.sq) Snd.play('illegal');
}

// ---------- PGN ----------
function buildPgn() {
  const d = new Date();
  const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  const white = G.mode === 'ai' ? (G.human === 0 ? 'Player' : 'Computer') : 'Player 1';
  const black = G.mode === 'ai' ? (G.human === 1 ? 'Player' : 'Computer') : 'Player 2';
  const res = G.over ? G.result : '*';
  let out = '[Event "Casual game"]\n[Site "Chess app"]\n[Date "' + date + '"]\n[White "' + white + '"]\n[Black "' + black + '"]\n[Result "' + res + '"]\n';
  if (G.startFen !== START_FEN) out += '[FEN "' + G.startFen + '"]\n';
  out += '\n';
  const parts = [];
  G.sans.forEach((s, i) => { parts.push((i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s); });
  return out + parts.join(' ') + (parts.length ? ' ' : '') + res + '\n';
}
