/* ===== Canvas renderer: board, pieces, motion blur, particles, effects ===== */
const PADF = 1.3;
const TAU = Math.PI * 2;

function rrPath(x, y, w, h, r) {
  return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) +
    'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) +
    'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Z';
}
function circPath(cx, cy, r) {
  return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z';
}
function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  if (r <= 0.01) { g.rect(x, y, w, h); return; }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- Vector piece art on a 100x100 grid ----
const ART = {};
function defArt(t, parts, details) {
  ART[t] = { parts: parts.map(p => new Path2D(p)), details: (details || []).map(d => ({ p: new Path2D(d.p), fill: !!d.fill, w: d.w || 2.4 })) };
}
const baseP = w => rrPath(50 - w / 2, 78, w, 9, 4);
defArt(1, [circPath(50, 30, 12), rrPath(35, 43, 30, 7, 3.5), 'M40 50Q43 65 34 78L66 78Q57 65 60 50Z', baseP(44)]);
defArt(4, ['M28 16H40V26H45V16H55V26H60V16H72V38H28Z', 'M33 38H67L64 70H36Z', rrPath(28, 69, 44, 9, 3), baseP(52)], [{ p: 'M32 38H68', w: 2 }]);
defArt(3, [circPath(50, 15, 6), 'M50 21C69 34 68 52 58 60H42C32 52 31 34 50 21Z', rrPath(36, 59, 28, 7, 3), 'M42 66H58L62 78H38Z', baseP(48)], [{ p: 'M44 34L56 46', w: 3 }]);
defArt(2, ['M30 80C30 64 36 56 44 48L30 52C24 52 20 48 22 44L38 24L40 14L48 20C70 20 78 44 74 80Z', baseP(52)],
  [{ p: circPath(41, 32, 2.8), fill: true }, { p: circPath(26, 45, 1.7), fill: true }, { p: 'M52 26C62 30 68 42 68 56', w: 2 }]);
defArt(5, ['M34 64L20 32L36 50L35 20L46 48L50 12L54 48L65 20L64 50L80 32L66 64Z',
  circPath(20, 30, 4.2), circPath(35, 18, 4.2), circPath(50, 10, 4.2), circPath(65, 18, 4.2), circPath(80, 30, 4.2),
  rrPath(33, 63, 34, 7, 3), 'M38 70H62L66 78H34Z', baseP(52)]);
defArt(6, [rrPath(46, 5, 8, 26, 2), rrPath(38, 12, 24, 8, 2), 'M50 30C70 30 80 46 74 62H26C20 46 30 30 50 30Z',
  rrPath(29, 61, 42, 8, 3), 'M36 69H64L68 78H32Z', baseP(52)]);
const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

// ---- Renderer state ----
const R = {
  cv: null, ctx: null, side: 0, scale: 1, bx: 0, by: 0, bsz: 0, cs: 0, bw: 0, labelM: 0,
  boardLayer: null, sprites: {},
  disp: new Int8Array(128),
  anims: [], parts: [], rings: [], trails: [], shake: null,
  view: { angle: 0, from: 0, to: 0, t0: 0, dur: 0, flipped: false },
  sel: -1, targets: [], caps: [], last: [-1, -1], lastT0: 0, checkSq: -1, checkT0: 0,
  hint: null, drag: null, facing: false,
  needs: true, lastTs: 0, lastNow: 0, frames: 0, fpsT: 0, fps: 0, fpsEl: null,
  getBoard: null,
};

function easeFn(t) {
  switch (S.animEase) {
    case 'linear': return t;
    case 'snap': return 1 - Math.pow(1 - t, 4);
    case 'overshoot': { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    default: return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}

R.init = function (cv, fpsEl) {
  R.cv = cv; R.ctx = cv.getContext('2d'); R.fpsEl = fpsEl;
  requestAnimationFrame(rLoop);
};
R.markDirty = function () { R.needs = true; };

R.resize = function (side) {
  R.side = side;
  const dpr = window.devicePixelRatio || 1;
  R.scale = Math.max(0.5, Math.min(3, dpr * S.quality / 100));
  R.cv.width = Math.max(1, Math.round(side * R.scale)); R.cv.height = R.cv.width;
  R.cv.style.width = side + 'px'; R.cv.style.height = side + 'px';
  R.rebuild();
};
R.rebuild = function () {
  if (!R.side) return;
  const side = R.side;
  R.bw = S.borderWidth;
  R.labelM = S.coords === 'outside' ? S.coordSize * 1.7 : 0;
  const pad = S.boardShadow ? 6 : 2;
  const avail = side - 2 * (R.bw + R.labelM + pad);
  R.bsz = Math.max(80, Math.floor(avail * S.boardScale / 100 / 8) * 8);
  R.cs = R.bsz / 8;
  R.bx = Math.round((side - R.bsz) / 2); R.by = R.bx;
  buildBoardLayer(); buildSprites();
  R.needs = true;
};

function cellOrigin(sq) { return [R.bx + (sq & 7) * R.cs, R.by + (7 - (sq >> 4)) * R.cs]; }

function buildBoardLayer() {
  const c = R.boardLayer || (R.boardLayer = document.createElement('canvas'));
  c.width = c.height = Math.max(1, Math.round(R.side * R.scale));
  const g = c.getContext('2d');
  g.setTransform(R.scale, 0, 0, R.scale, 0, 0);
  g.clearRect(0, 0, R.side, R.side);
  const { bx, by, bsz, cs, bw } = R;
  const rad = S.squareRadius / 100 * cs / 2;
  const frameR = Math.min(bw, 12) * 0.6 + rad * 0.4;
  if (S.boardShadow) {
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = Math.max(6, cs * 0.28) * R.scale; g.shadowOffsetY = cs * 0.08 * R.scale;
    g.fillStyle = bw > 0 ? S.borderColor : shade(S.darkColor, -0.35);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // shadow offsets are in device px; draw rect in device space
    rrect(g, (bx - bw) * R.scale, (by - bw) * R.scale, (bsz + 2 * bw) * R.scale, (bsz + 2 * bw) * R.scale, frameR * R.scale);
    g.fill(); g.restore();
    g.setTransform(R.scale, 0, 0, R.scale, 0, 0);
  }
  if (bw > 0) {
    rrect(g, bx - bw, by - bw, bsz + 2 * bw, bsz + 2 * bw, frameR);
    g.fillStyle = S.borderColor; g.fill();
    // bevel
    const gr = g.createLinearGradient(bx - bw, by - bw, bx + bsz + bw, by + bsz + bw);
    gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr; g.fill();
  }
  // plate under squares (visible through gaps / transparency)
  rrect(g, bx, by, bsz, bsz, Math.max(0, rad * 0.5));
  g.fillStyle = shade(S.darkColor, -0.4); g.fill();
  const gap = S.squareGap / 2;
  g.globalAlpha = S.boardOpacity / 100;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const dark = ((f + r) & 1) === 0;
    const x = bx + f * cs + gap, y = by + (7 - r) * cs + gap, w = cs - 2 * gap;
    drawSquare(g, x, y, w, dark ? S.darkColor : S.lightColor, S.squareStyle, rad);
  }
  g.globalAlpha = 1;
  if (S.showGrid) {
    g.save();
    g.strokeStyle = rgba(S.gridColor, S.gridOpacity / 100);
    g.lineWidth = S.gridWidth;
    if (S.gridDashed) g.setLineDash([cs * 0.12, cs * 0.09]);
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      g.moveTo(bx + i * cs, by); g.lineTo(bx + i * cs, by + bsz);
      g.moveTo(bx, by + i * cs); g.lineTo(bx + bsz, by + i * cs);
    }
    g.stroke(); g.restore();
  }
}
function drawSquare(g, x, y, w, color, style, rad) {
  rrect(g, x, y, w, w, rad);
  if (style === 'glass') {
    g.fillStyle = rgba(color, 0.55); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.stroke();
    return;
  }
  g.fillStyle = color; g.fill();
  if (style === 'gloss') {
    const gr = g.createLinearGradient(x, y, x, y + w);
    gr.addColorStop(0, 'rgba(255,255,255,.24)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.14)');
    g.fillStyle = gr; g.fill();
  } else if (style === 'inset') {
    const gr = g.createLinearGradient(x, y, x + w, y + w);
    gr.addColorStop(0, 'rgba(0,0,0,.3)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.22)');
    g.fillStyle = gr; g.fill();
  }
}

// ---- Sprites ----
function buildSprites() {
  R.sprites = {};
  for (const c of [0, 1]) for (let t = 1; t <= 6; t++) R.sprites[(c << 3) | t] = makeSprite((c << 3) | t);
}
function makeSprite(piece) {
  const t = piece & 7, black = (piece >> 3) === 1;
  const size = Math.max(8, Math.ceil(R.cs * R.scale * PADF));
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const fill = black ? S.blackColor : S.whiteColor, line = S.outlineColor;
  const unit = (R.cs * R.scale * S.pieceScale / 100) / 100;
  g.translate(size / 2, size / 2); g.scale(unit, unit); g.translate(-50, -50);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const shadowOn = S.pieceShadow;
  const setShadow = (col, blur, oy) => { g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetX = 0; g.shadowOffsetY = oy; };
  const clearShadow = () => { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; };
  const px = R.cs * R.scale; // device px per cell
  const detailCol = lum(fill) < 0.4 ? shade(fill, 0.6) : line;
  const fillStyle = () => {
    if (!S.pieceShine) return fill;
    const gr = g.createLinearGradient(18, 8, 84, 94);
    gr.addColorStop(0, shade(fill, 0.5)); gr.addColorStop(0.45, fill); gr.addColorStop(1, shade(fill, -0.42));
    return gr;
  };

  if (S.pieceSet === 'glyph') {
    g.font = '92px "Noto Sans Symbols 2","Noto Sans Symbols","Segoe UI Symbol","DejaVu Sans","Arial Unicode MS",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const ch = GLYPH[t] + '︎';
    if (shadowOn) setShadow('rgba(0,0,0,.45)', px * 0.05, px * 0.03);
    if (S.outlineWidth > 0) { g.strokeStyle = line; g.lineWidth = S.outlineWidth * 1.6; g.strokeText(ch, 50, 82); }
    clearShadow();
    g.fillStyle = fillStyle(); g.fillText(ch, 50, 82);
    return c;
  }
  const art = ART[t];
  if (S.pieceSet === 'neon') {
    setShadow(fill, px * 0.14, 0);
    g.strokeStyle = fill; g.lineWidth = 3.4;
    for (const p of art.parts) g.stroke(p);
    clearShadow();
    g.fillStyle = rgba(fill, 0.16);
    for (const p of art.parts) g.fill(p);
    g.strokeStyle = shade(fill, 0.75); g.lineWidth = 1.3;
    for (const p of art.parts) g.stroke(p);
    g.strokeStyle = shade(fill, 0.5); g.fillStyle = shade(fill, 0.5);
    for (const d of art.details) { g.lineWidth = d.w * 0.7; if (d.fill) g.fill(d.p); else g.stroke(d.p); }
    return c;
  }
  if (S.pieceSet === 'outline') {
    if (shadowOn) setShadow('rgba(0,0,0,.4)', px * 0.05, px * 0.03);
    g.strokeStyle = fill; g.lineWidth = Math.max(2, S.outlineWidth + 1.5);
    for (const p of art.parts) g.stroke(p);
    clearShadow();
    g.fillStyle = rgba(fill, 0.3);
    for (const p of art.parts) g.fill(p);
    g.strokeStyle = fill; g.fillStyle = fill;
    for (const d of art.details) { g.lineWidth = d.w; if (d.fill) g.fill(d.p); else g.stroke(d.p); }
    return c;
  }
  // classic / flat: unified silhouette (outline stroke under fill)
  const ow = S.pieceSet === 'flat' ? 0 : S.outlineWidth;
  if (shadowOn) setShadow('rgba(0,0,0,.5)', px * 0.06, px * 0.035);
  if (ow > 0) {
    g.strokeStyle = line; g.lineWidth = ow * 2;
    for (const p of art.parts) g.stroke(p);
  } else {
    g.fillStyle = fill;
    for (const p of art.parts) g.fill(p);
  }
  clearShadow();
  g.fillStyle = fillStyle();
  for (const p of art.parts) g.fill(p);
  g.strokeStyle = detailCol; g.fillStyle = detailCol;
  for (const d of art.details) { g.lineWidth = d.w; if (d.fill) g.fill(d.p); else g.stroke(d.p); }
  return c;
}
R.drawIcon = function (canvas, piece, px) {
  const spr = R.sprites[piece]; if (!spr) return;
  canvas.width = canvas.height = px;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, px, px);
  const w = px * PADF * 0.92;
  g.drawImage(spr, (px - w) / 2, (px - w) / 2, w, w);
};

// ---- Geometry ----
function toScreen(x, y) {
  const a = R.view.angle;
  if (!a) return [x, y];
  const cx = R.side / 2, cy = R.side / 2, dx = x - cx, dy = y - cy, c = Math.cos(a), s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}
function sqXY(sq) {
  return toScreen(R.bx + (sq & 7) * R.cs + R.cs / 2, R.by + (7 - (sq >> 4)) * R.cs + R.cs / 2);
}
R.hit = function (clientX, clientY) {
  const r = R.cv.getBoundingClientRect();
  let x = (clientX - r.left) * (R.side / r.width), y = (clientY - r.top) * (R.side / r.height);
  const a = R.view.angle;
  if (a) {
    const cx = R.side / 2, cy = R.side / 2, dx = x - cx, dy = y - cy, c = Math.cos(a), s = Math.sin(a);
    x = cx + dx * c + dy * s; y = cy - dx * s + dy * c;
  }
  const f = Math.floor((x - R.bx) / R.cs), rr = Math.floor((y - R.by) / R.cs);
  if (f < 0 || f > 7 || rr < 0 || rr > 7) return -1;
  return (7 - rr) * 16 + f;
};
R.pointerXY = function (clientX, clientY) {
  const r = R.cv.getBoundingClientRect();
  return [(clientX - r.left) * (R.side / r.width), (clientY - r.top) * (R.side / r.height)];
};

// ---- State setters used by the game ----
R.syncDisp = function () { if (R.getBoard) R.disp.set(R.getBoard()); R.needs = true; };
R.setSelection = function (sq, targets, caps) { R.sel = sq; R.targets = targets || []; R.caps = caps || []; R.needs = true; };
R.setLast = function (from, to) { R.last = [from, to]; R.lastT0 = performance.now(); R.needs = true; };
R.setCheck = function (sq) { R.checkSq = sq; R.checkT0 = performance.now(); R.needs = true; };
R.setHint = function (from, to) { R.hint = from >= 0 ? { from, to, until: performance.now() + 3500 } : null; R.needs = true; };
R.cancelAnims = function () { R.anims.length = 0; R.parts.length = 0; R.rings.length = 0; R.trails.length = 0; R.shake = null; R.needs = true; };
R.setFlip = function (flipped, animate) {
  const v = R.view;
  if (v.flipped === flipped) return;
  v.flipped = flipped;
  if (animate && S.animSpeed > 0) {
    const from = ((v.angle % TAU) + TAU) % TAU;
    let to = flipped ? Math.PI : 0;
    while (to <= from + 1e-3) to += TAU;
    v.from = from; v.to = to; v.t0 = performance.now(); v.dur = Math.max(320, S.animSpeed * 2);
  } else { v.angle = flipped ? Math.PI : 0; v.dur = 0; R.cv.style.filter = ''; }
  R.needs = true;
};
R.animateMove = function (info) {
  const dur = info.instant ? 0 : S.animSpeed;
  if (dur <= 0) {
    R.syncDisp();
    R.landFx(info);
    return;
  }
  R.disp[info.from] = 0;
  const now = performance.now();
  const done = () => { R.syncDisp(); R.landFx(info); };
  R.anims.push({ p: info.piece, fsq: info.from, tsq: info.to, t0: now, dur, onDone: done });
  if (info.rook) {
    R.disp[info.rook.from] = 0;
    R.anims.push({ p: info.rook.piece, fsq: info.rook.from, tsq: info.rook.to, t0: now, dur, onDone: null, small: true });
  }
  if (S.trail !== 'none') {
    R.trails.push({ from: info.from, to: info.to, t0: now, dur: 600, piece: info.piece });
  }
  R.needs = true;
};
R.busy = function () { return R.anims.length > 0; };

R.landFx = function (info) {
  if (info.onLand) info.onLand();
  const [x, y] = sqXY(info.to);
  const accent = S.accent;
  const k = S.particles / 100;
  if (S.shockwave) R.rings.push({ x, y, t0: performance.now(), dur: 480, color: accent, big: !!info.cap });
  if (info.cap && k > 0) {
    const capSq = info.capSq >= 0 ? info.capSq : info.to;
    const [cx, cy] = sqXY(capSq);
    const capBlack = (info.cap >> 3) === 1;
    burst(cx, cy, capBlack ? S.blackColor : S.whiteColor, k);
  }
  if (info.cap && S.shake > 0) R.shake = { amp: S.shake / 100 * R.cs * 0.22, t0: performance.now(), dur: 320 };
  R.needs = true;
};
function burst(x, y, color, k) {
  const style = S.particleStyle, cs = R.cs, acc = S.accent, outline = S.outlineColor;
  const add = p => R.parts.push(p);
  if (style === 'sparks') {
    const n = Math.round(22 * k) + 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = cs * (2 + Math.random() * 5);
      add({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0.35 + Math.random() * 0.4, max: 0.75, size: 1.5 + Math.random() * 2.2, color: Math.random() < 0.5 ? shade(acc, 0.5) : '#ffffff', rot: 0, vr: 0 });
    }
  } else if (style === 'shatter') {
    const n = Math.round(16 * k) + 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = cs * (1 + Math.random() * 3.6);
      add({ t: 'sq', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cs * 1.2, g: cs * 9, life: 0.6 + Math.random() * 0.5, max: 1.1, size: cs * (0.05 + Math.random() * 0.09), color: Math.random() < 0.7 ? color : outline, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14 });
    }
  } else if (style === 'dust') {
    const n = Math.round(12 * k) + 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = cs * (0.2 + Math.random() * 1.1);
      add({ t: 'puff', x: x + (Math.random() - 0.5) * cs * 0.4, y: y + (Math.random() - 0.5) * cs * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cs * 0.3, g: 0, life: 0.5 + Math.random() * 0.5, max: 1, size: cs * (0.12 + Math.random() * 0.14), color: '#c9c4bb', rot: 0, vr: 0 });
    }
  } else {
    const n = Math.round(26 * k) + 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = cs * (1 + Math.random() * 4);
      add({ t: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cs * 1.5, g: cs * 7, life: 0.8 + Math.random() * 0.7, max: 1.5, size: cs * (0.06 + Math.random() * 0.07), color: 'hsl(' + Math.floor(Math.random() * 360) + ',90%,60%)', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 16 });
    }
  }
}
R.confetti = function (amount) {
  const k = Math.max(0.2, S.particles / 100);
  const n = Math.round(amount * k);
  for (let i = 0; i < n; i++) {
    R.parts.push({ t: 'conf', x: Math.random() * R.side, y: -10 - Math.random() * R.side * 0.3, vx: (Math.random() - 0.5) * R.cs * 2, vy: R.cs * (1 + Math.random() * 3), g: R.cs * 2.5, life: 2.2 + Math.random() * 2, max: 4, size: R.cs * (0.06 + Math.random() * 0.08), color: 'hsl(' + Math.floor(Math.random() * 360) + ',90%,60%)', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12 });
  }
  R.needs = true;
};

// ---- Update + draw ----
function animating(now) {
  return R.anims.length > 0 || R.parts.length > 0 || R.rings.length > 0 || R.trails.length > 0 || !!R.shake || R.view.dur > 0 ||
    (R.hint && R.hint.until > now) ||
    (R.checkSq >= 0 && S.checkFlash && now - R.checkT0 < 1800) ||
    (S.lastMovePulse && R.last[0] >= 0 && now - R.lastT0 < 900);
}
function rUpdate(now, dt) {
  // view rotation
  const v = R.view;
  if (v.dur > 0) {
    const p = (now - v.t0) / v.dur;
    const prev = v.angle;
    if (p >= 1) { v.angle = (v.to % TAU + TAU) % TAU; v.dur = 0; R.cv.style.filter = ''; }
    else {
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      v.angle = v.from + (v.to - v.from) * e;
      if (S.flipBlur && S.motionBlur > 0 && dt > 0) {
        const speed = Math.abs(v.angle - prev) / dt; // rad/s
        const px = Math.min(7, speed * 0.9 * S.motionBlur / 100);
        R.cv.style.filter = px > 0.4 ? 'blur(' + px.toFixed(1) + 'px)' : '';
      }
    }
  }
  // animations
  if (R.anims.length) {
    const finished = [];
    for (let i = R.anims.length - 1; i >= 0; i--) {
      if (now - R.anims[i].t0 >= R.anims[i].dur) finished.push(R.anims.splice(i, 1)[0]);
    }
    for (const an of finished) if (an.onDone) an.onDone();
  }
  // particles
  for (let i = R.parts.length - 1; i >= 0; i--) {
    const p = R.parts[i];
    p.life -= dt;
    if (p.life <= 0) { R.parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.t === 'puff') { p.vx *= 0.96; p.vy *= 0.96; }
  }
  for (let i = R.rings.length - 1; i >= 0; i--) if (now - R.rings[i].t0 > R.rings[i].dur) R.rings.splice(i, 1);
  for (let i = R.trails.length - 1; i >= 0; i--) if (now - R.trails[i].t0 > R.trails[i].dur) R.trails.splice(i, 1);
  if (R.hint && R.hint.until <= now) { R.hint = null; }
}

function rDraw(now, dt) {
  const g = R.ctx, sc = R.scale;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, R.cv.width, R.cv.height);
  g.setTransform(sc, 0, 0, sc, 0, 0);
  if (R.shake) {
    const p = (now - R.shake.t0) / R.shake.dur;
    if (p >= 1) R.shake = null;
    else { const a = R.shake.amp * (1 - p) * (1 - p); g.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a); }
  }
  const ang = R.view.angle;
  g.save();
  if (ang) { g.translate(R.side / 2, R.side / 2); g.rotate(ang); g.translate(-R.side / 2, -R.side / 2); }
  g.drawImage(R.boardLayer, 0, 0, R.side, R.side);
  drawHighlights(g, now);
  g.restore();
  drawCoords(g, now);
  drawTrails(g, now);
  drawPieces(g, now);
  g.save();
  if (ang) { g.translate(R.side / 2, R.side / 2); g.rotate(ang); g.translate(-R.side / 2, -R.side / 2); }
  drawMarkers(g, now);
  g.restore();
  drawFx(g, now);
}

function hlSquare(g, sq, color, alpha) {
  const [x, y] = cellOrigin(sq), gap = S.squareGap / 2, cs = R.cs;
  rrect(g, x + gap, y + gap, cs - 2 * gap, cs - 2 * gap, S.squareRadius / 100 * cs / 2);
  g.globalAlpha = alpha; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
}
function drawHighlights(g, now) {
  const cs = R.cs;
  if (S.showLastMove && R.last[0] >= 0) {
    let a = 0.38;
    if (S.lastMovePulse && now - R.lastT0 < 900) a += 0.3 * Math.max(0, Math.sin((now - R.lastT0) / 900 * Math.PI * 2.2));
    hlSquare(g, R.last[0], S.lastMoveColor, a);
    hlSquare(g, R.last[1], S.lastMoveColor, a + 0.08);
  }
  if (R.sel >= 0) {
    hlSquare(g, R.sel, S.selectColor, 0.55);
    if (S.selectGlow) {
      const [x, y] = cellOrigin(R.sel);
      g.save();
      g.shadowColor = S.selectColor; g.shadowBlur = cs * 0.45 * R.scale;
      g.strokeStyle = S.selectColor; g.lineWidth = Math.max(2, cs * 0.05);
      rrect(g, x + 2, y + 2, cs - 4, cs - 4, S.squareRadius / 100 * cs / 2);
      g.stroke(); g.restore();
    }
  }
  if (R.checkSq >= 0) {
    const [x, y] = cellOrigin(R.checkSq);
    const cx = x + cs / 2, cy = y + cs / 2;
    let a = 0.7;
    if (S.checkFlash && now - R.checkT0 < 1800) a = 0.5 + 0.5 * Math.abs(Math.sin((now - R.checkT0) / 160));
    const gr = g.createRadialGradient(cx, cy, cs * 0.05, cx, cy, cs * 0.78);
    gr.addColorStop(0, rgba(S.checkColor, 0.95 * a)); gr.addColorStop(0.6, rgba(S.checkColor, 0.5 * a)); gr.addColorStop(1, rgba(S.checkColor, 0));
    g.fillStyle = gr; g.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
  }
}
function drawMarkers(g, now) {
  if (!S.showLegal || R.sel < 0 || S.markerStyle === 'none') return;
  const cs = R.cs, col = S.markerColor;
  for (const sq of R.targets) {
    const [x, y] = cellOrigin(sq);
    const cx = x + cs / 2, cy = y + cs / 2;
    const isCap = R.caps.indexOf(sq) >= 0;
    if (S.markerStyle === 'square') { hlSquare(g, sq, col, isCap ? 0.4 : 0.28); continue; }
    if (S.markerStyle === 'ring' || isCap) {
      g.strokeStyle = rgba(col, 0.55); g.lineWidth = Math.max(2, cs * 0.075);
      g.beginPath(); g.arc(cx, cy, cs * (isCap ? 0.43 : 0.3), 0, TAU); g.stroke();
    } else {
      g.fillStyle = rgba(col, 0.5);
      g.beginPath(); g.arc(cx, cy, cs * S.markerSize / 200, 0, TAU); g.fill();
    }
  }
}
function drawCoords(g, now) {
  if (S.coords === 'off') return;
  const a = R.view.angle, cs = R.cs, fl = Math.cos(a) < 0;
  const alpha = Math.abs(Math.cos(a));
  if (alpha < 0.05) return;
  g.save(); g.globalAlpha = alpha;
  g.font = '700 ' + S.coordSize + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const files = 'abcdefgh';
  if (S.coords === 'inside') {
    for (let i = 0; i < 8; i++) {
      // rank labels on left column (screen col 0), file labels on bottom row (screen row 7)
      const rankNum = fl ? i + 1 : 8 - i;
      const fileCh = files[fl ? 7 - i : i];
      const darkL = ((0 + 7 - i) & 1) === 0; // screen col 0, screen row i → f+r parity with r=7-i
      const darkB = ((i + 0) & 1) === 0;     // screen col i, screen row 7 → r=0
      const x0 = R.bx, y0 = R.by + i * cs, x1 = R.bx + i * cs, y1 = R.by + 7 * cs;
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = S.coordAuto ? (darkL ? S.lightColor : S.darkColor) : S.coordColor;
      g.fillText(String(rankNum), x0 + 3 + S.squareGap / 2, y0 + 2 + S.squareGap / 2);
      g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillStyle = S.coordAuto ? (darkB ? S.lightColor : S.darkColor) : S.coordColor;
      g.fillText(fileCh, x1 + cs - 3 - S.squareGap / 2, y1 + cs - 2 - S.squareGap / 2);
    }
  } else {
    g.fillStyle = S.coordColor; g.textAlign = 'center'; g.textBaseline = 'middle';
    const m = R.bw + R.labelM / 2;
    for (let i = 0; i < 8; i++) {
      const rankNum = fl ? i + 1 : 8 - i;
      const fileCh = files[fl ? 7 - i : i];
      g.fillText(String(rankNum), R.bx - m, R.by + i * cs + cs / 2);
      g.fillText(fileCh, R.bx + i * cs + cs / 2, R.by + R.bsz + m);
    }
  }
  g.restore();
}
function spriteRot(p) { return R.facing && (p >> 3) === 1 ? Math.PI : 0; }
function drawSprite(g, p, x, y, alpha, scale, rot) {
  const spr = R.sprites[p]; if (!spr) return;
  const w = R.cs * PADF * (scale || 1);
  g.globalAlpha = alpha;
  if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(spr, -w / 2, -w / 2, w, w); g.restore(); }
  else g.drawImage(spr, x - w / 2, y - w / 2, w, w);
  g.globalAlpha = 1;
}
function drawPieces(g, now) {
  const drag = R.drag && R.drag.moved ? R.drag : null;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = R.disp[sq];
    if (!p) continue;
    if (drag && drag.sq === sq) continue;
    const [x, y] = sqXY(sq);
    drawSprite(g, p, x, y, 1, 1, spriteRot(p));
  }
  const blur = S.motionBlur / 100;
  for (const an of R.anims) {
    const t = Math.min(1, (now - an.t0) / an.dur);
    const e = easeFn(t);
    const [x0, y0] = sqXY(an.fsq), [x1, y1] = sqXY(an.tsq);
    const rot = spriteRot(an.p);
    if (blur > 0 && !an.small) {
      const N = 2 + Math.round(blur * 8), win = blur * 0.34;
      for (let k = N; k >= 1; k--) {
        const tk = t - win * (k / N);
        if (tk <= 0) continue;
        const ek = easeFn(Math.max(0, Math.min(1, tk)));
        drawSprite(g, an.p, x0 + (x1 - x0) * ek, y0 + (y1 - y0) * ek, 0.5 * (1 - k / (N + 1)) * Math.min(1, blur * 1.6), 1, rot);
      }
    }
    const lift = an.small ? 1 : 1 + 0.14 * Math.sin(Math.PI * t);
    drawSprite(g, an.p, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, 1, lift, rot);
  }
  if (drag) {
    drawSprite(g, drag.piece, drag.x, drag.y - R.cs * 0.35, 1, 1.18, spriteRot(drag.piece));
  }
}
function drawTrails(g, now) {
  for (const tr of R.trails) {
    const p = (now - tr.t0) / tr.dur, a = (1 - p);
    const [x0, y0] = sqXY(tr.from), [x1, y1] = sqXY(tr.to);
    if (S.trail === 'line') {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba(S.accent, 0)); gr.addColorStop(1, rgba(S.accent, 0.55 * a));
      g.strokeStyle = gr; g.lineWidth = R.cs * 0.3 * (0.4 + 0.6 * a); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    } else if (S.trail === 'ghost') {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const f = i / n;
        drawSprite(g, tr.piece, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0.28 * a * (0.4 + f), 1, spriteRot(tr.piece));
      }
    }
  }
}
function drawFx(g, now) {
  const cs = R.cs;
  for (const r of R.rings) {
    const p = (now - r.t0) / r.dur, e = 1 - Math.pow(1 - p, 3);
    g.strokeStyle = rgba(r.color, 0.85 * (1 - p)); g.lineWidth = Math.max(1, cs * (r.big ? 0.12 : 0.07) * (1 - p));
    g.beginPath(); g.arc(r.x, r.y, cs * (0.2 + (r.big ? 1.1 : 0.8) * e), 0, TAU); g.stroke();
  }
  for (const p of R.parts) {
    const a = Math.max(0, Math.min(1, p.life / Math.min(p.max, 0.6)));
    g.globalAlpha = a;
    if (p.t === 'spark') {
      g.strokeStyle = p.color; g.lineWidth = p.size; g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
    } else if (p.t === 'puff') {
      g.fillStyle = p.color; g.globalAlpha = a * 0.5;
      g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU); g.fill();
    } else {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
      g.fillRect(-p.size, -p.size * (p.t === 'conf' ? 0.55 : 1), p.size * 2, p.size * (p.t === 'conf' ? 1.1 : 2));
      g.restore();
    }
  }
  g.globalAlpha = 1;
  if (R.hint) {
    const [x0, y0] = sqXY(R.hint.from), [x1, y1] = sqXY(R.hint.to);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const w = cs * 0.15, hl = cs * 0.38, fade = Math.min(1, (R.hint.until - now) / 500);
    g.save(); g.globalAlpha = 0.8 * fade; g.fillStyle = S.accent; g.strokeStyle = S.accent;
    g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0 + ux * cs * 0.25, y0 + uy * cs * 0.25); g.lineTo(x1 - ux * hl, y1 - uy * hl); g.stroke();
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * hl - uy * hl * 0.55, y1 - uy * hl + ux * hl * 0.55); g.lineTo(x1 - ux * hl + uy * hl * 0.55, y1 - uy * hl - ux * hl * 0.55); g.closePath(); g.fill();
    g.restore();
  }
}

function rLoop(ts) {
  requestAnimationFrame(rLoop);
  const cap = S.fpsCap;
  const minDt = cap > 0 ? 1000 / cap - 1.5 : 0;
  if (R.lastTs && ts - R.lastTs < minDt) return;
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - (R.lastNow || now)) / 1000));
  R.lastTs = ts; R.lastNow = now;
  if (!R.cv || !R.boardLayer) return;
  const act = animating(now);
  if (!R.needs && !act && !S.showFps) return;
  rUpdate(now, dt);
  rDraw(now, dt);
  R.needs = false;
  R.frames++;
  if (now - R.fpsT >= 1000) {
    R.fps = Math.round(R.frames * 1000 / (now - R.fpsT)); R.frames = 0; R.fpsT = now;
    if (S.showFps && R.fpsEl) R.fpsEl.textContent = R.fps + ' fps';
  }
}
