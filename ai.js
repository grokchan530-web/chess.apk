/* ===== Chess AI: iterative deepening alpha-beta with custom difficulty ===== */
(function (C) {
'use strict';
const { Position, P, N, B, R, Q, K, mFrom, mTo, mPromo, mFlags } = C;

const VAL = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];
const INF = 31000, MATE = 30000, MATE_BOUND = 29000, MAX_PLY = 96;

// Piece-square tables (visual order: rank 8 first, from White's view)
const T = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
const KEG = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

// PST[color][type][sq0x88]
const PST = [[], []];
const KEGT = [new Int16Array(128), new Int16Array(128)];
for (let t = 1; t <= 6; t++) {
  PST[0][t] = new Int16Array(128); PST[1][t] = new Int16Array(128);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = r * 16 + f;
    PST[0][t][sq] = T[t][(7 - r) * 8 + f];
    PST[1][t][sq] = T[t][r * 8 + f];
    if (t === 6) { KEGT[0][sq] = KEG[(7 - r) * 8 + f]; KEGT[1][sq] = KEG[r * 8 + f]; }
  }
}
const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];

let aggrWeight = 0;

function evaluate(pos) {
  const b = pos.board;
  let score = 0, phase = 0, kmg = 0, keg = 0;
  let wBish = 0, bBish = 0;
  const wPawns = new Int8Array(8), bPawns = new Int8Array(8);
  const bHigh = new Int8Array(8).fill(-1), wLow = new Int8Array(8).fill(8);
  const wk = pos.king[0], bk = pos.king[1];
  let tropism = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7, c = p >> 3, f = sq & 7, r = sq >> 4;
    if (t === K) {
      if (c) { kmg -= PST[1][6][sq]; keg -= KEGT[1][sq]; }
      else { kmg += PST[0][6][sq]; keg += KEGT[0][sq]; }
      continue;
    }
    phase += PHASE[t];
    if (c === 0) {
      score += VAL[t] + PST[0][t][sq];
      if (t === P) { wPawns[f]++; if (r < wLow[f]) wLow[f] = r; }
      else if (t === B) wBish++;
      if (aggrWeight && t !== P) { const d = Math.max(Math.abs(r - (bk >> 4)), Math.abs(f - (bk & 7))); tropism += (7 - d) * aggrWeight; }
    } else {
      score -= VAL[t] + PST[1][t][sq];
      if (t === P) { bPawns[f]++; if (r > bHigh[f]) bHigh[f] = r; }
      else if (t === B) bBish++;
      if (aggrWeight && t !== P) { const d = Math.max(Math.abs(r - (wk >> 4)), Math.abs(f - (wk & 7))); tropism -= (7 - d) * aggrWeight; }
    }
  }
  const ph = Math.min(24, phase);
  score += (kmg * ph + keg * (24 - ph)) / 24;
  if (wBish >= 2) score += 30;
  if (bBish >= 2) score -= 30;
  // pawn structure
  for (let f = 0; f < 8; f++) {
    if (wPawns[f] > 1) score -= 12 * (wPawns[f] - 1);
    if (bPawns[f] > 1) score += 12 * (bPawns[f] - 1);
  }
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if ((p & 7) !== P) continue;
    const f = sq & 7, r = sq >> 4;
    if (p === P) {
      let passed = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (bHigh[g] > r) { passed = false; break; }
      if (passed) score += PASSED[r];
    } else {
      let passed = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (wLow[g] < r) { passed = false; break; }
      if (passed) score -= PASSED[7 - r];
    }
  }
  score += tropism;
  return pos.turn ? -score : score;
}

// ---- Search state ----
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
const bufs = [], scs = [];
for (let i = 0; i < MAX_PLY + 4; i++) { bufs.push(new Int32Array(256)); scs.push(new Int32Array(256)); }
const killers = new Int32Array((MAX_PLY + 4) * 2);
const hist = new Int32Array(2 * 128 * 128);
let nodes = 0, deadline = 0, stopped = false;

function scoreMoves(pos, buf, sc, n, ply, ttm) {
  const b = pos.board, us = pos.turn;
  for (let i = 0; i < n; i++) {
    const m = buf[i], to = mTo(m), fl = mFlags(m), from = mFrom(m);
    let s;
    if (m === ttm) s = 2000000;
    else if (fl & 1) {
      const victim = (fl & 2) ? P : (b[to] & 7);
      s = 1000000 + VAL[victim] * 10 - VAL[b[from] & 7] / 10 + (mPromo(m) ? 800 : 0);
    } else if (mPromo(m)) s = 900000 + VAL[mPromo(m)];
    else if (m === killers[ply * 2]) s = 800000;
    else if (m === killers[ply * 2 + 1]) s = 700000;
    else s = hist[(us << 14) | (from << 7) | to];
    sc[i] = s;
  }
}
function pickMove(buf, sc, n, i) {
  let bi = i, bs = sc[i];
  for (let j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
  if (bi !== i) { const tm = buf[i]; buf[i] = buf[bi]; buf[bi] = tm; const ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts; }
}
function hasNonPawn(pos) {
  const b = pos.board, us = pos.turn;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s];
    if (p && (p >> 3) === us) { const t = p & 7; if (t >= N && t <= Q) return true; }
  }
  return false;
}

function quiesce(pos, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) stopped = true;
  if (stopped) return 0;
  const stand = evaluate(pos);
  if (ply >= MAX_PLY) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const buf = bufs[ply], sc = scs[ply];
  const n = pos.genMoves(buf, true);
  scoreMoves(pos, buf, sc, n, ply, 0);
  const us = pos.turn;
  for (let i = 0; i < n; i++) {
    pickMove(buf, sc, n, i);
    pos.make(buf[i]);
    if (pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
    const s = -quiesce(pos, -beta, -alpha, ply + 1);
    pos.unmake();
    if (stopped) return 0;
    if (s >= beta) return s;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply, nullOk) {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) stopped = true;
  if (stopped) return 0;
  if (ply > 0) {
    if (pos.half >= 100 || pos.isRepetition()) return 0;
    if (ply >= MAX_PLY) return evaluate(pos);
    // mate distance pruning
    if (alpha < -MATE + ply) alpha = -MATE + ply;
    if (beta > MATE - ply - 1) beta = MATE - ply - 1;
    if (alpha >= beta) return alpha;
  }
  const us = pos.turn;
  const inChk = pos.inCheck();
  if (inChk) depth++;
  if (depth <= 0) return quiesce(pos, alpha, beta, ply);

  const idx = pos.hash & TT_MASK;
  let ttm = 0;
  const alpha0 = alpha;
  if (ttKey[idx] === pos.hash && ttFlag[idx]) {
    ttm = ttMove[idx];
    if (ply > 0 && ttDepth[idx] >= depth) {
      let s = ttScore[idx];
      if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
      const fl = ttFlag[idx];
      if (fl === 1) return s;
      if (fl === 2 && s > alpha) alpha = s;
      else if (fl === 3 && s < beta) beta = s;
      if (alpha >= beta) return s;
    }
  }
  const pvNode = beta - alpha > 1;
  if (nullOk && !pvNode && !inChk && depth >= 3 && ply > 0 && hasNonPawn(pos)) {
    pos.makeNull();
    const s = -negamax(pos, depth - 3, -beta, -beta + 1, ply + 1, false);
    pos.unmakeNull();
    if (stopped) return 0;
    if (s >= beta) return s >= MATE_BOUND ? beta : s;
  }
  const buf = bufs[ply], sc = scs[ply];
  const n = pos.genMoves(buf, false);
  scoreMoves(pos, buf, sc, n, ply, ttm);
  let best = -INF, bestMove = 0, legal = 0;
  for (let i = 0; i < n; i++) {
    pickMove(buf, sc, n, i);
    const m = buf[i];
    pos.make(m);
    if (pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
    const quiet = !(mFlags(m) & 1) && !mPromo(m);
    let s;
    if (legal === 0) s = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
    else {
      let red = 0;
      if (depth >= 3 && legal >= 4 && quiet && !inChk) { red = 1; if (legal >= 10 && depth >= 5) red = 2; }
      s = -negamax(pos, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
      if (s > alpha && (red > 0 || s < beta)) s = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
    }
    pos.unmake();
    legal++;
    if (stopped) return 0;
    if (s > best) { best = s; bestMove = m; }
    if (s > alpha) {
      alpha = s;
      if (alpha >= beta) {
        if (quiet) {
          if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
          const hi = (us << 14) | (mFrom(m) << 7) | mTo(m);
          hist[hi] = Math.min(600000, hist[hi] + depth * depth);
        }
        break;
      }
    }
  }
  if (legal === 0) return inChk ? -MATE + ply : 0;
  // store
  let st = best;
  if (st > MATE_BOUND) st += ply; else if (st < -MATE_BOUND) st -= ply;
  ttKey[idx] = pos.hash; ttMove[idx] = bestMove; ttScore[idx] = st; ttDepth[idx] = Math.min(depth, 100);
  ttFlag[idx] = best <= alpha0 ? 3 : (best >= beta ? 2 : 1);
  return best;
}

function rand01() { return Math.random(); }

function search(pos, opts) {
  opts = Object.assign({ depth: 4, time: 1000, blunder: 0, random: 0, aggr: 0 }, opts || {});
  aggrWeight = Math.max(0, Math.min(100, opts.aggr)) * 0.04;
  const root = pos.legalMoves();
  if (root.length === 0) return { move: 0, score: 0, depth: 0, nodes: 0 };
  if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };
  ttKey.fill(0); ttFlag.fill(0); killers.fill(0); hist.fill(0);
  nodes = 0; stopped = false;
  deadline = Date.now() + Math.max(50, opts.time);
  let best = root[0], bestScore = 0, done = 0;
  const us = pos.turn;
  for (let d = 1; d <= opts.depth; d++) {
    let alpha = -INF, iterBest = 0, iterScore = -INF;
    const order = root.slice();
    const bi = order.indexOf(best);
    if (bi > 0) { order.splice(bi, 1); order.unshift(best); }
    for (let i = 0; i < order.length; i++) {
      const m = order[i];
      pos.make(m);
      let s;
      if (i === 0) s = -negamax(pos, d - 1, -INF, -alpha, 1, true);
      else {
        s = -negamax(pos, d - 1, -alpha - 1, -alpha, 1, true);
        if (!stopped && s > alpha) s = -negamax(pos, d - 1, -INF, -alpha, 1, true);
      }
      pos.unmake();
      if (stopped) break;
      if (s > iterScore) { iterScore = s; iterBest = m; }
      if (s > alpha) alpha = s;
    }
    if (stopped) { if (d === 1 && !iterBest) iterBest = best; else break; }
    best = iterBest || best; bestScore = iterScore; done = d;
    root.splice(0, root.length, ...order);
    if (Math.abs(bestScore) >= MATE_BOUND) break;
    if (Date.now() > deadline) break;
  }
  let chosen = best;
  const wantVariety = (opts.blunder > 0 || opts.random > 0) && Math.abs(bestScore) < MATE - 10;
  if (wantVariety) {
    // Score every root move with a full window at modest depth, then pick a human-like move
    stopped = false; deadline = Date.now() + Math.max(300, opts.time);
    const dv = Math.max(1, Math.min(opts.depth - 1, 3));
    const list = [];
    for (const m of root) {
      pos.make(m);
      const s = -negamax(pos, dv - 1 + (dv > 1 ? 0 : 0), -INF, INF, 1, true);
      pos.unmake();
      if (stopped) break;
      list.push({ m, s });
    }
    if (list.length > 1 && !stopped) {
      list.sort((a, b) => b.s - a.s);
      const top = list[0].s;
      if (rand01() * 100 < opts.blunder) {
        const pool = list.filter((x, i) => i > 0 && x.s <= top - 40 && x.s >= top - 450);
        if (pool.length) chosen = pool[Math.floor(rand01() * pool.length)].m;
        else chosen = list[Math.min(1, list.length - 1)].m;
      } else if (opts.random > 0) {
        const margin = opts.random * 1.5;
        const pool = list.filter(x => x.s >= top - margin);
        chosen = pool[Math.floor(rand01() * pool.length)].m;
      }
    }
  }
  return { move: chosen, score: bestScore, depth: done, nodes };
}

C.search = search;
C.evaluate = evaluate;
})(Chess);
