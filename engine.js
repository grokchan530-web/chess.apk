/* ===== Chess engine: 0x88 board, legal move generation, SAN, draw rules ===== */
const Chess = (function () {
'use strict';

const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const KNIGHT_D = [33, 31, 18, 14, -14, -18, -31, -33];
const KING_D = [1, -1, 16, -16, 17, 15, -15, -17];
const BISHOP_D = [17, 15, -15, -17];
const ROOK_D = [1, -1, 16, -16];
const FILES = 'abcdefgh';
const PCH = '.PNBRQK';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function sqName(s) { return FILES[s & 7] + ((s >> 4) + 1); }
function nameSq(n) { return (n.charCodeAt(0) - 97) + (parseInt(n[1], 10) - 1) * 16; }
function mFrom(m) { return m & 127; }
function mTo(m) { return (m >> 7) & 127; }
function mPromo(m) { return (m >> 14) & 7; }
function mFlags(m) { return m >> 17; }
function mk(from, to, promo, flags) { return from | (to << 7) | ((promo || 0) << 14) | ((flags || 0) << 17); }

// ---- Zobrist ----
let seed = 0x9e3779b9;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
const Z_PIECE = [];
for (let p = 0; p < 16; p++) { const a = new Int32Array(128); for (let s = 0; s < 128; s++) a[s] = rnd(); Z_PIECE.push(a); }
const Z_CASTLE = new Int32Array(16); for (let i = 0; i < 16; i++) Z_CASTLE[i] = rnd();
const Z_EP = new Int32Array(8); for (let i = 0; i < 8; i++) Z_EP[i] = rnd();
const Z_SIDE = rnd();

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[4] = 12; CASTLE_MASK[0] = 13; CASTLE_MASK[7] = 14;
CASTLE_MASK[116] = 3; CASTLE_MASK[112] = 7; CASTLE_MASK[119] = 11;

class Position {
  constructor() {
    this.board = new Int8Array(128);
    this.turn = 0; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1;
    this.king = [4, 116]; this.hash = 0;
    this.sp = 0;
    this.sCap = []; this.sCas = []; this.sEp = []; this.sHalf = []; this.sHash = []; this.sMove = [];
    this.setFen(START_FEN);
  }

  setFen(fen) {
    const parts = fen.trim().split(/\s+/);
    this.board.fill(0);
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      const row = rows[7 - r]; let f = 0;
      for (const ch of row) {
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const lower = ch.toLowerCase();
        const t = PCH.indexOf(lower.toUpperCase());
        const c = ch === lower ? 8 : 0;
        const sq = r * 16 + f;
        this.board[sq] = c | t;
        if (t === K) this.king[c ? 1 : 0] = sq;
        f++;
      }
    }
    this.turn = parts[1] === 'b' ? 1 : 0;
    this.castle = 0;
    const cs = parts[2] || '-';
    if (cs.includes('K')) this.castle |= 1;
    if (cs.includes('Q')) this.castle |= 2;
    if (cs.includes('k')) this.castle |= 4;
    if (cs.includes('q')) this.castle |= 8;
    this.ep = parts[3] && parts[3] !== '-' ? nameSq(parts[3]) : -1;
    this.half = parseInt(parts[4] || '0', 10) || 0;
    this.full = parseInt(parts[5] || '1', 10) || 1;
    this.sp = 0;
    this.hash = this.computeHash();
  }

  fen() {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const ch = PCH[p & 7];
        s += (p >> 3) ? ch.toLowerCase() : ch;
      }
      if (e) s += e;
      if (r) s += '/';
    }
    let c = '';
    if (this.castle & 1) c += 'K';
    if (this.castle & 2) c += 'Q';
    if (this.castle & 4) c += 'k';
    if (this.castle & 8) c += 'q';
    return s + ' ' + (this.turn ? 'b' : 'w') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  }

  // position key for repetition detection (placement + side + castling + ep only if capturable)
  repKey() {
    const f = this.fen().split(' ');
    let ep = '-';
    if (this.ep >= 0) {
      const dir = this.turn === 0 ? -16 : 16; // pawns that could capture sit behind ep square from mover's view
      const mine = this.turn === 0 ? P : (8 | P);
      for (const d of [dir - 1, dir + 1]) {
        const s = this.ep + d;
        if (!(s & 0x88) && this.board[s] === mine) ep = f[3];
      }
    }
    return f[0] + ' ' + f[1] + ' ' + f[2] + ' ' + ep;
  }

  computeHash() {
    let h = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s];
      if (p) h ^= Z_PIECE[p][s];
    }
    h ^= Z_CASTLE[this.castle];
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    if (this.turn) h ^= Z_SIDE;
    return h | 0;
  }

  isAttacked(sq, by) {
    const b = this.board, cb = by << 3;
    let s;
    if (by === 0) {
      s = sq - 15; if (!(s & 0x88) && b[s] === P) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === P) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === (8 | P)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (8 | P)) return true;
    }
    const kn = cb | N, kg = cb | K;
    for (let i = 0; i < 8; i++) {
      s = sq + KNIGHT_D[i]; if (!(s & 0x88) && b[s] === kn) return true;
      s = sq + KING_D[i]; if (!(s & 0x88) && b[s] === kg) return true;
    }
    const bi = cb | B, ro = cb | R, qu = cb | Q;
    for (let i = 0; i < 4; i++) {
      let d = BISHOP_D[i]; s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === bi || p === qu) return true; break; } s += d; }
      d = ROOK_D[i]; s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === ro || p === qu) return true; break; } s += d; }
    }
    return false;
  }

  inCheck() { return this.isAttacked(this.king[this.turn], this.turn ^ 1); }

  // Pseudo-legal move generation into buf; returns count
  genMoves(buf, capsOnly) {
    let n = 0;
    const b = this.board, us = this.turn, them = us ^ 1;
    const PROMOS = [Q, R, B, N];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      const t = p & 7;
      if (t === P) {
        const dir = us === 0 ? 16 : -16;
        const startRank = us === 0 ? 1 : 6, promoRank = us === 0 ? 6 : 1;
        const r = sq >> 4;
        const to1 = sq + dir;
        if (!(to1 & 0x88) && b[to1] === 0) {
          if (r === promoRank) { for (let k = 0; k < 4; k++) buf[n++] = mk(sq, to1, PROMOS[k], 0); }
          else if (!capsOnly) {
            buf[n++] = mk(sq, to1, 0, 0);
            if (r === startRank) { const to2 = sq + 2 * dir; if (b[to2] === 0) buf[n++] = mk(sq, to2, 0, 4); }
          }
        }
        for (let k = 0; k < 2; k++) {
          const to = sq + dir + (k ? 1 : -1);
          if (to & 0x88) continue;
          const c = b[to];
          if (c && (c >> 3) === them) {
            if (r === promoRank) { for (let j = 0; j < 4; j++) buf[n++] = mk(sq, to, PROMOS[j], 1); }
            else buf[n++] = mk(sq, to, 0, 1);
          } else if (!c && to === this.ep) {
            buf[n++] = mk(sq, to, 0, 3);
          }
        }
      } else if (t === N || t === K) {
        const D = t === N ? KNIGHT_D : KING_D;
        for (let i = 0; i < 8; i++) {
          const to = sq + D[i];
          if (to & 0x88) continue;
          const c = b[to];
          if (!c) { if (!capsOnly) buf[n++] = mk(sq, to, 0, 0); }
          else if ((c >> 3) === them) buf[n++] = mk(sq, to, 0, 1);
        }
      } else {
        const D = t === B ? BISHOP_D : t === R ? ROOK_D : KING_D;
        const cnt = t === Q ? 8 : 4;
        for (let i = 0; i < cnt; i++) {
          const d = D[i]; let to = sq + d;
          while (!(to & 0x88)) {
            const c = b[to];
            if (!c) { if (!capsOnly) buf[n++] = mk(sq, to, 0, 0); }
            else { if ((c >> 3) === them) buf[n++] = mk(sq, to, 0, 1); break; }
            to += d;
          }
        }
      }
    }
    if (!capsOnly && this.castle) {
      const base = us === 0 ? 0 : 112;
      const ks = us === 0 ? 1 : 4, qs = us === 0 ? 2 : 8;
      if (b[base + 4] === (us << 3 | K) && !this.isAttacked(base + 4, them)) {
        if ((this.castle & ks) && !b[base + 5] && !b[base + 6] && b[base + 7] === (us << 3 | R) &&
            !this.isAttacked(base + 5, them) && !this.isAttacked(base + 6, them)) {
          buf[n++] = mk(base + 4, base + 6, 0, 8);
        }
        if ((this.castle & qs) && !b[base + 3] && !b[base + 2] && !b[base + 1] && b[base] === (us << 3 | R) &&
            !this.isAttacked(base + 3, them) && !this.isAttacked(base + 2, them)) {
          buf[n++] = mk(base + 4, base + 2, 0, 16);
        }
      }
    }
    return n;
  }

  make(m) {
    const b = this.board, from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17;
    const piece = b[from], us = this.turn;
    let cap = b[to];
    const i = this.sp++;
    this.sCas[i] = this.castle; this.sEp[i] = this.ep; this.sHalf[i] = this.half; this.sHash[i] = this.hash; this.sMove[i] = m;
    let h = this.hash;
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    h ^= Z_PIECE[piece][from];
    b[from] = 0;
    if (fl & 2) {
      const cs = to + (us === 0 ? -16 : 16);
      cap = b[cs]; h ^= Z_PIECE[cap][cs]; b[cs] = 0;
    } else if (cap) {
      h ^= Z_PIECE[cap][to];
    }
    this.sCap[i] = cap;
    const placed = promo ? ((us << 3) | promo) : piece;
    b[to] = placed; h ^= Z_PIECE[placed][to];
    if (fl & 8) {
      const rf = to + 1, rt = to - 1, r = b[rf];
      b[rf] = 0; b[rt] = r; h ^= Z_PIECE[r][rf] ^ Z_PIECE[r][rt];
    } else if (fl & 16) {
      const rf = to - 2, rt = to + 1, r = b[rf];
      b[rf] = 0; b[rt] = r; h ^= Z_PIECE[r][rf] ^ Z_PIECE[r][rt];
    }
    if ((piece & 7) === K) this.king[us] = to;
    h ^= Z_CASTLE[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    h ^= Z_CASTLE[this.castle];
    this.ep = (fl & 4) ? (from + to) >> 1 : -1;
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    this.half = ((piece & 7) === P || cap) ? 0 : this.half + 1;
    if (us === 1) this.full++;
    this.turn = us ^ 1; h ^= Z_SIDE;
    this.hash = h | 0;
  }

  unmake() {
    const i = --this.sp, m = this.sMove[i];
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17;
    const b = this.board, us = this.turn ^ 1;
    this.turn = us;
    let piece = b[to];
    if (promo) piece = (us << 3) | P;
    b[from] = piece;
    const cap = this.sCap[i];
    if (fl & 2) { b[to] = 0; b[to + (us === 0 ? -16 : 16)] = cap; }
    else b[to] = cap;
    if (fl & 8) { const rf = to + 1, rt = to - 1; b[rf] = b[rt]; b[rt] = 0; }
    else if (fl & 16) { const rf = to - 2, rt = to + 1; b[rf] = b[rt]; b[rt] = 0; }
    if ((piece & 7) === K) this.king[us] = from;
    this.castle = this.sCas[i]; this.ep = this.sEp[i]; this.half = this.sHalf[i]; this.hash = this.sHash[i];
    if (us === 1) this.full--;
  }

  makeNull() {
    const i = this.sp++;
    this.sCas[i] = this.castle; this.sEp[i] = this.ep; this.sHalf[i] = this.half; this.sHash[i] = this.hash; this.sMove[i] = 0; this.sCap[i] = 0;
    let h = this.hash;
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    this.ep = -1; h ^= Z_SIDE;
    this.hash = h | 0; this.turn ^= 1; this.half++;
  }
  unmakeNull() {
    const i = --this.sp;
    this.turn ^= 1;
    this.castle = this.sCas[i]; this.ep = this.sEp[i]; this.half = this.sHalf[i]; this.hash = this.sHash[i];
  }

  isRepetition() {
    const lim = Math.max(0, this.sp - this.half);
    for (let j = this.sp - 2; j >= lim; j -= 2) if (this.sHash[j] === this.hash) return true;
    return false;
  }

  legalMoves() {
    const buf = new Int32Array(256);
    const n = this.genMoves(buf, false);
    const out = [], us = this.turn;
    for (let i = 0; i < n; i++) {
      this.make(buf[i]);
      if (!this.isAttacked(this.king[us], us ^ 1)) out.push(buf[i]);
      this.unmake();
    }
    return out;
  }

  findMove(from, to, promo, legal) {
    legal = legal || this.legalMoves();
    for (const m of legal) {
      if (mFrom(m) === from && mTo(m) === to && (mPromo(m) || 0) === (promo || 0)) return m;
    }
    return 0;
  }

  uci(m) {
    return sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? PCH[mPromo(m)].toLowerCase() : '');
  }

  san(m, legal) {
    const from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlags(m);
    const piece = this.board[from], t = piece & 7;
    legal = legal || this.legalMoves();
    let s = '';
    if (fl & 8) s = 'O-O';
    else if (fl & 16) s = 'O-O-O';
    else {
      const capture = (fl & 1) !== 0;
      if (t !== P) {
        s += PCH[t];
        let sameFile = false, sameRank = false, amb = false;
        for (const o of legal) {
          if (o === m) continue;
          const of = mFrom(o);
          if (mTo(o) === to && (this.board[of] & 7) === t && of !== from) {
            amb = true;
            if ((of & 7) === (from & 7)) sameFile = true;
            if ((of >> 4) === (from >> 4)) sameRank = true;
          }
        }
        if (amb) {
          if (!sameFile) s += FILES[from & 7];
          else if (!sameRank) s += ((from >> 4) + 1);
          else s += sqName(from);
        }
      } else if (capture) s += FILES[from & 7];
      if (capture) s += 'x';
      s += sqName(to);
      if (promo) s += '=' + PCH[promo];
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length === 0 ? '#' : '+';
    this.unmake();
    return s;
  }

  insufficient() {
    const minors = [];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s]; if (!p) continue;
      const t = p & 7;
      if (t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors.push({ t, c: ((s & 7) + (s >> 4)) & 1 });
    }
    if (minors.length <= 1) return true;
    return minors.every(x => x.t === B && x.c === minors[0].c);
  }

  // Basic status (no threefold; the game controller tracks repetitions)
  status() {
    const legal = this.legalMoves();
    if (legal.length === 0) {
      if (this.inCheck()) return { over: true, result: this.turn ? '1-0' : '0-1', reason: 'checkmate' };
      return { over: true, result: '1/2-1/2', reason: 'stalemate' };
    }
    if (this.insufficient()) return { over: true, result: '1/2-1/2', reason: 'insufficient material' };
    if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty-move rule' };
    return { over: false, result: '*', reason: '' };
  }

  perft(depth) {
    if (depth === 0) return 1;
    const buf = new Int32Array(256);
    const n = this.genMoves(buf, false);
    let c = 0; const us = this.turn;
    for (let i = 0; i < n; i++) {
      this.make(buf[i]);
      if (!this.isAttacked(this.king[us], us ^ 1)) c += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return c;
  }
}

return { Position, P, N, B, R, Q, K, FILES, PCH, START_FEN, sqName, nameSq, mFrom, mTo, mPromo, mFlags, mk };
})();
