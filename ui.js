/* ===== UI: plates, moves, dialogs, settings sheet, theme/background, layout ===== */
const $ = id => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const DEFBY = {}; for (const d of DEFS) if (d.key) DEFBY[d.key] = d;
const NEWGAME_KEYS = new Set(['mode', 'playerColor', 'clock', 'clockMin', 'clockInc']);
const BG_KEY = 'chess.bgimg.v1';
const ICON = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5V15h8v-1.5A6 6 0 0012 3z"/>',
  flip: '<path d="M4 12a8 8 0 0114-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
};
function icon(name) { return '<svg viewBox="0 0 24 24">' + ICON[name] + '</svg>'; }

const UI = {
  modals: [], sheetOpen: false, pendingNew: false, tab: 'Game', lastKey: '',
  modalOpen() { return this.modals.length > 0 || this.sheetOpen; },
  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), 1900);
  },
  setThinking(b) { $('plateTop').classList.toggle('thinking', b && G.aiColor === UI.topColor()); $('plateBot').classList.toggle('thinking', b && G.aiColor === UI.botColor()); },
  botColor() { return R.view.flipped ? 1 : 0; },
  topColor() { return R.view.flipped ? 0 : 1; },
};

// ---------- dialogs ----------
UI.dialog = function (o) {
  const ov = el('div', 'overlay'); if (o.id) ov.id = o.id;
  const card = el('div', 'card');
  if (o.title) card.appendChild(el('h2', '', o.title));
  if (o.sub) card.appendChild(el('div', 'sub2', o.sub));
  let entry = null;
  const ctl = { close() { UI.closeDialog(entry); }, el: card };
  if (o.body) { const b = el('div'); card.appendChild(b); o.body(b, ctl); }
  const btns = el('div', 'cbtns' + (o.row ? ' row2' : ''));
  (o.buttons || []).forEach(bd => {
    const b = el('button', 'cbtn' + (bd.cls ? ' ' + bd.cls : ''), bd.label);
    b.onclick = () => { if (bd.keep !== true) ctl.close(); if (bd.fn) bd.fn(); };
    btns.appendChild(b);
  });
  if (o.buttons && o.buttons.length) card.appendChild(btns);
  ov.appendChild(card);
  if (o.dismiss !== false) ov.addEventListener('pointerdown', e => { if (e.target === ov) { ctl.close(); if (o.onDismiss) o.onDismiss(); } });
  $('overlays').appendChild(ov);
  entry = { ov, o, ctl };
  UI.modals.push(entry);
  return ctl;
};
UI.closeDialog = function (entry) {
  const i = UI.modals.indexOf(entry); if (i < 0) return;
  UI.modals.splice(i, 1); entry.ov.remove();
};
UI.closeAllDialogs = function () { while (UI.modals.length) UI.closeDialog(UI.modals[UI.modals.length - 1]); };

UI.askPromotion = function (color) {
  return new Promise(resolve => {
    let done = false;
    UI.dialog({
      title: 'Promote to…', onDismiss: () => { if (!done) { done = true; resolve(0); } },
      body(b, ctl) {
        const row = el('div', 'promo');
        [Chess.Q, Chess.R, Chess.B, Chess.N].forEach(t => {
          const btn = el('button'); const cv = el('canvas');
          R.drawIcon(cv, (color << 3) | t, Math.round(64 * (window.devicePixelRatio || 1)));
          btn.appendChild(cv);
          btn.onclick = () => { done = true; ctl.close(); resolve(t); };
          row.appendChild(btn);
        });
        b.appendChild(row);
      },
    });
  });
};

function resultText() {
  const r = G.result, why = G.reason;
  if (r === '1/2-1/2') return ['Draw', 'by ' + why];
  const w = r === '1-0' ? 0 : 1;
  if (G.mode === 'ai') return [w === G.human ? 'You win!' : 'You lose', 'by ' + why];
  return [(w === 0 ? 'White' : 'Black') + ' wins', 'by ' + why];
}
UI.showGameOver = function () {
  if (!G.over || UI.gameOverShown === G.moves.length + ':' + G.result) return;
  UI.gameOverShown = G.moves.length + ':' + G.result;
  const [t, s] = resultText();
  UI.dialog({
    title: t, sub: s.charAt(0).toUpperCase() + s.slice(1) + ' · ' + Math.ceil(G.moves.length / 2) + ' moves',
    buttons: [
      { label: 'Rematch', cls: 'pri', fn: () => newGame() },
      { label: 'New game…', fn: () => UI.newGameDialog() },
      { label: 'Share PGN', fn: () => doAction('sharePgn'), keep: true },
      { label: 'View board' },
    ],
  });
};

UI.newGameDialog = function () {
  UI.dialog({
    title: 'New game',
    buttons: [{ label: 'Start', cls: 'pri', fn: () => { UI.closeAllDialogs(); closeSheet(); newGame(); } }, { label: 'Cancel' }],
    body(b) {
      const keys = ['mode', 'playerColor', 'twoPView', 'level', 'clock', 'clockMin', 'clockInc'];
      const render = () => {
        b.innerHTML = '';
        for (const k of keys) { const d = DEFBY[k]; if (d.show && !d.show(S)) continue; b.appendChild(buildControl(d, onChange)); }
        const lvl = el('div', 'sub2', S.mode === 'ai' ? 'Fine-tune depth, mistakes and speed in Settings → Game.' : '');
        b.appendChild(lvl);
      };
      const onChange = (d, v) => { setValue(d, v); render(); };
      render();
    },
  });
};

UI.menuDialog = function () {
  const btns = [{ label: 'Resume', cls: 'pri' }, { label: 'New game…', fn: () => UI.newGameDialog() }];
  if (!G.over && G.moves.length) {
    btns.push({ label: 'Resign', cls: 'danger', fn: () => { if (S.confirmResign) UI.confirm('Resign this game?', 'Resign', resign); else resign(); } });
    if (G.mode === '2p') btns.push({ label: 'Agree a draw', fn: () => UI.confirm('Both players agree to a draw?', 'Draw', agreeDraw) });
  }
  btns.push({ label: 'Share PGN', fn: () => doAction('sharePgn'), keep: true });
  btns.push({ label: 'Settings', fn: () => openSheet() });
  btns.push({ label: 'Home', fn: () => UI.homeDialog() });
  UI.dialog({ title: 'Menu', buttons: btns });
};
UI.confirm = function (msg, yes, fn) {
  UI.dialog({ title: msg, row: true, buttons: [{ label: 'Cancel' }, { label: yes, cls: 'pri', fn }] });
};

UI.homeDialog = function () {
  UI.closeAllDialogs();
  const btns = [];
  if (hasSave()) btns.push({ label: 'Continue game', cls: 'pri', fn: () => { if (!loadSave()) UI.toast('Could not load the saved game'); } });
  btns.push({ label: 'Play vs Computer', cls: hasSave() ? '' : 'pri', fn: () => { S.mode = 'ai'; saveSettings(); UI.newGameDialog(); } });
  btns.push({ label: '2 Players · 1 phone', fn: () => { S.mode = '2p'; saveSettings(); UI.newGameDialog(); } });
  btns.push({ label: 'Settings', fn: () => openSheet() });
  const ctl = UI.dialog({
    id: 'home', dismiss: false, buttons: btns,
    body(b) {
      const cv = el('canvas', 'logo'); cv.width = cv.height = 220;
      R.drawIcon(cv, (0 << 3) | Chess.K, 220);
      b.appendChild(cv);
      b.appendChild(el('h1', '', 'CHESS'));
      b.appendChild(el('div', 'tag', 'Offline · Customisable · Fast'));
    },
  });
};

// ---------- plates, moves, actions ----------
UI.update = function () {
  const bot = UI.botColor(), top = bot ^ 1;
  fillPlate($('plateTop'), top, true);
  fillPlate($('plateBot'), bot, false);
  buildMoves();
  updateActions();
  UI.drawClocks(true);
};
function nameFor(c) {
  if (G.mode === 'ai') return c === G.human ? 'You' : 'Computer';
  return c === 0 ? 'Player 1' : 'Player 2';
}
function fillPlate(p, c, isTop) {
  const key = c + '|' + G.captured[c].length + '|' + G.moves.length + '|' + G.mode + G.human + G.levelName + (R.facing ? 'f' : '');
  p.classList.toggle('rot180', isTop && R.facing);
  p.classList.toggle('active', !G.over && G.pos.turn === c);
  p.classList.toggle('noclock', !G.clock.on);
  if (p._key === key) return;
  p._key = key;
  p.innerHTML = '';
  const who = el('div', 'who');
  const nm = el('div', 'name');
  const dot = el('span', 'dot'); dot.style.background = c ? S.blackColor : S.whiteColor;
  nm.appendChild(dot); nm.appendChild(document.createTextNode(nameFor(c)));
  const th = el('span', 'think'); th.innerHTML = '<i></i><i></i><i></i>'; nm.appendChild(th);
  who.appendChild(nm);
  who.appendChild(el('div', 'sub', (c ? 'Black' : 'White') + (G.mode === 'ai' && c === G.aiColor ? ' · ' + G.levelName : '')));
  p.appendChild(who);
  const cw = el('div', 'capw');
  const caps = G.captured[c].slice().sort((a, b) => (b & 7) - (a & 7));
  const px = Math.round(20 * (window.devicePixelRatio || 1));
  for (const pc of caps) { const cv = el('canvas'); R.drawIcon(cv, pc, px); cw.appendChild(cv); }
  const diff = material() * (c === 0 ? 1 : -1);
  if (diff > 0) cw.appendChild(el('span', 'adv', '+' + diff));
  p.appendChild(cw);
  const clk = el('div', 'clk', '0:00'); p.appendChild(clk);
}
UI.drawClocks = function (force) {
  for (const [id, c] of [['plateTop', UI.topColor()], ['plateBot', UI.botColor()]]) {
    const p = $(id), clk = p.querySelector('.clk'); if (!clk) continue;
    const t = G.clock.on ? Math.max(0, G.clock.t[c]) : 0;
    const txt = t < 20 ? t.toFixed(1) : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    if (clk.textContent !== txt) clk.textContent = txt;
    p.classList.toggle('low', G.clock.on && t < 10);
    p.classList.toggle('active', !G.over && G.pos.turn === c);
  }
};
function buildMoves() {
  const m = $('moves'); m.innerHTML = '';
  const s = G.sans;
  for (let i = 0; i < s.length; i += 2) {
    const sp = el('span', 'mv');
    sp.appendChild(el('span', 'n', (i / 2 + 1) + '.'));
    const a = el('span', i === s.length - 1 ? 'last' : '', s[i]); sp.appendChild(a);
    if (s[i + 1]) { sp.appendChild(document.createTextNode(' ')); sp.appendChild(el('span', i + 1 === s.length - 1 ? 'last' : '', s[i + 1])); }
    m.appendChild(sp);
  }
  if (!s.length) m.appendChild(el('span', 'n', 'Game start — make your move'));
  m.scrollLeft = m.scrollWidth; m.scrollTop = m.scrollHeight;
}
const ACTS = [
  ['undo', 'Undo', () => undo()], ['redo', 'Redo', () => redo()], ['hint', 'Hint', () => hint()],
  ['flip', 'Flip', () => flipBoard()], ['menu', 'Menu', () => UI.menuDialog()], ['gear', 'Settings', () => openSheet()],
];
function buildActions() {
  const a = $('actions'); a.innerHTML = '';
  for (const [ic, label, fn] of ACTS) {
    const b = el('button', 'btn'); b.id = 'a-' + ic; b.innerHTML = icon(ic) + '<span>' + label + '</span>';
    b.onclick = () => { Snd.unlock(); fn(); };
    a.appendChild(b);
  }
}
function updateActions() {
  $('a-undo').classList.toggle('hide', !S.allowUndo); $('a-redo').classList.toggle('hide', !S.allowUndo);
  $('a-undo').disabled = !G.moves.length; $('a-redo').disabled = !G.redo.length || G.over;
  $('a-hint').disabled = G.over || G.thinking || (G.mode === 'ai' && G.pos.turn !== G.human);
}

// ---------- controls ----------
function buildControl(d, onChange) {
  if (d.type === 'head') { const h = el('div', 'head', d.label); return h; }
  const row = el('div', 'row');
  if (d.type === 'action') {
    const b = el('button', 'abtn' + (d.danger ? ' danger' : ''), d.label);
    b.onclick = () => doAction(d.action); row.appendChild(b); return row;
  }
  const top = el('div', 'rtop'); top.appendChild(el('span', 'lab', d.label)); row.appendChild(top);
  const v = S[d.key];
  if (d.type === 'toggle') {
    const sw = el('button', 'switch' + (v ? ' on' : '')); sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', v);
    sw.onclick = () => onChange(d, !S[d.key]); top.appendChild(sw);
  } else if (d.type === 'slider') {
    const val = el('span', 'val', fmt(d, v)); top.appendChild(val);
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = v;
    inp.addEventListener('input', () => { const nv = +inp.value; val.textContent = fmt(d, nv); setValue(d, nv); });
    inp.addEventListener('change', () => onChange(d, +inp.value));
    row.appendChild(inp);
  } else if (d.type === 'seg' || d.type === 'chips') {
    const box = el('div', d.type);
    for (const [val, label] of d.opts) {
      const b = el('button', String(val) === String(v) ? 'on' : '', label);
      b.onclick = () => onChange(d, val); box.appendChild(b);
    }
    row.appendChild(box);
  } else if (d.type === 'color') {
    const c = el('div', 'crow'); const inp = document.createElement('input'); inp.type = 'color'; inp.value = v.length === 4 ? '#' + v.slice(1).split('').map(x => x + x).join('') : v;
    const hex = el('span', 'val', v);
    inp.addEventListener('input', () => { hex.textContent = inp.value; setValue(d, inp.value); });
    inp.addEventListener('change', () => onChange(d, inp.value));
    top.appendChild(hex); top.appendChild(inp);
  }
  return row;
}
function fmt(d, v) { return (Math.round(v * 100) / 100) + d.unit; }

let pendingKeys = new Set(), applyQueued = false;
function setValue(d, v) {
  const changed = new Set([d.key]);
  S[d.key] = v;
  if (d.custom && S[d.custom] !== 'custom') { S[d.custom] = 'custom'; changed.add(d.custom); }
  if (d.presets && v !== 'custom' && d.presets[v]) for (const k in d.presets[v]) { S[k] = d.presets[v][k]; changed.add(k); }
  saveSettings();
  changed.forEach(k => pendingKeys.add(k));
  if (!applyQueued) { applyQueued = true; requestAnimationFrame(() => { applyQueued = false; const k = pendingKeys; pendingKeys = new Set(); applyKeys(k); }); }
}

// ---------- applying settings ----------
function applyKeys(keys) {
  let rebuild = false, resize = false, theme = false, layoutNeeded = false, ng = false;
  for (const k of keys) {
    const d = DEFBY[k]; if (!d) continue;
    if (d.tab === 'Board' || d.tab === 'Pieces') rebuild = true;
    if (k === 'accent' || k === 'uiScale' || k === 'panelOpacity' || k.startsWith('bg')) theme = true;
    if (k === 'uiScale' || k === 'leftHanded') layoutNeeded = true;
    if (k === 'quality') resize = true;
    if (NEWGAME_KEYS.has(k)) ng = true;
    if (k === 'orientation') applyOrientation();
    if (k === 'immersive') bridge('setImmersive', !!S.immersive);
    if (k === 'keepAwake') applyKeepAwake();
    if (k === 'highRefresh' || k === 'fpsCap') bridge('setHighRefresh', !!S.highRefresh, +S.fpsCap || 0);
    if (k === 'showFps') $('fps').style.display = S.showFps ? 'block' : 'none';
    if (k === 'showCaptured') document.body.classList.toggle('nocap', !S.showCaptured);
    if (k === 'showMoves') { document.body.classList.toggle('nomoves', !S.showMoves); layoutNeeded = true; }
    if (k === 'twoPView' && G.mode === '2p') { R.facing = S.twoPView === 'facing'; forceView(S.twoPView === 'flip' && G.pos.turn === 1); UI.update(); }
    if (k === 'allowUndo') updateActions();
  }
  if (theme) applyTheme();
  if (layoutNeeded) { applyLayoutClasses(); doLayout(true); }
  if (resize) R.resize(R.side);
  else if (rebuild) { R.rebuild(); UI.update(); }
  R.needs = true;
  if (ng && !UI.sheetOpen === false && G.moves.length && !G.over) { UI.pendingNew = true; renderSheetBanner(); }
}
function applyOrientation() {
  bridge('setOrientation', S.orientation);
  try {
    if (screen.orientation && screen.orientation.lock) {
      if (S.orientation === 'portrait') screen.orientation.lock('portrait').catch(() => {});
      else if (S.orientation === 'landscape') screen.orientation.lock('landscape').catch(() => {});
      else if (screen.orientation.unlock) screen.orientation.unlock();
    }
  } catch (e) {}
}
let wakeLock = null;
function applyKeepAwake() {
  bridge('setKeepAwake', !!S.keepAwake);
  try {
    if (S.keepAwake && navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; }).catch(() => {});
    else if (wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
function applyTheme() {
  const root = document.documentElement.style;
  root.setProperty('--ui', S.uiScale / 100);
  root.setProperty('--accent', S.accent);
  root.setProperty('--bgspeed', S.bgSpeed + 's');
  const a = S.panelOpacity / 100;
  const avg = S.bgType === 'solid' ? lum(S.bgColor1) : S.bgType === 'image' ? 0.1 : (lum(S.bgColor1) + lum(S.bgColor2)) / 2;
  const light = avg > 0.62;
  document.body.classList.toggle('lightbg', light);
  root.setProperty('--panel', light ? 'rgba(255,255,255,' + a + ')' : 'rgba(16,20,32,' + a + ')');
  root.setProperty('--sheet', light ? 'rgba(250,250,253,' + Math.max(.94, a) + ')' : 'rgba(14,17,28,' + Math.max(.94, a) + ')');
  const bg = $('bg');
  bg.className = ''; bg.style.cssText = '';
  if (S.bgType === 'solid') bg.style.background = S.bgColor1;
  else if (S.bgType === 'gradient') bg.style.background = 'linear-gradient(' + S.bgAngle + 'deg,' + S.bgColor1 + ',' + S.bgColor2 + ')';
  else if (S.bgType === 'animated') {
    bg.classList.add('anim');
    bg.style.backgroundImage = 'linear-gradient(120deg,' + S.bgColor1 + ',' + S.bgColor2 + ',' + S.bgColor1 + ',' + S.bgColor2 + ')';
  } else {
    const img = LS.get(BG_KEY);
    if (img) { bg.style.backgroundImage = 'url("' + img + '")'; bg.style.backgroundSize = 'cover'; bg.style.backgroundPosition = 'center'; }
    else bg.style.background = 'linear-gradient(135deg,#232526,#414345)';
  }
  bg.style.filter = S.bgBlur ? 'blur(' + S.bgBlur + 'px)' : '';
  $('bgdim').style.background = 'rgba(0,0,0,' + (S.bgDim / 100) + ')';
}
function applyLayoutClasses() { $('game').classList.toggle('lefty', !!S.leftHanded); $('sheet').classList.toggle('lefty', !S.leftHanded === false ? true : false); }

// ---------- background image ----------
function initBgPicker() {
  $('bgfile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const max = 1280, sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let data = cv.toDataURL('image/jpeg', 0.82);
      if (data.length > 2.2e6) data = cv.toDataURL('image/jpeg', 0.6);
      if (LS.set(BG_KEY, data)) { S.bgType = 'image'; saveSettings(); applyTheme(); renderSheet(); UI.toast('Background set'); }
      else UI.toast('Image too large to store');
    };
    img.onerror = () => UI.toast('Could not read that image');
    img.src = url; e.target.value = '';
  });
}

// ---------- actions ----------
function copyText(text, msg) {
  if (AB && typeof AB.copy === 'function') { bridge('copy', text); UI.toast(msg); return; }
  try { navigator.clipboard.writeText(text).then(() => UI.toast(msg), () => UI.toast('Copy failed')); } catch (e) { UI.toast('Copy failed'); }
}
function doAction(a) {
  if (a === 'pickBg') $('bgfile').click();
  else if (a === 'clearBg') { LS.del(BG_KEY); applyTheme(); UI.toast('Background removed'); renderSheet(); }
  else if (a === 'sharePgn') {
    const pgn = buildPgn();
    if (AB && typeof AB.share === 'function') bridge('share', pgn);
    else if (navigator.share) navigator.share({ text: pgn }).catch(() => {});
    else copyText(pgn, 'PGN copied');
  }
  else if (a === 'copyFen') copyText(G.pos.fen(), 'FEN copied');
  else if (a === 'copySettings') copyText(JSON.stringify(S), 'Settings copied');
  else if (a === 'importSettings') {
    UI.dialog({
      title: 'Import settings', sub: 'Paste settings JSON exported from this app.',
      body(b) { const t = document.createElement('textarea'); t.id = 'impText'; b.appendChild(t); },
      buttons: [{ label: 'Import', cls: 'pri', fn: () => {
        try { sanitizeInto(S, JSON.parse($('impText').value)); saveSettings(); applyKeys(new Set(Object.keys(DEFBY))); renderSheet(); UI.toast('Settings imported'); }
        catch (e) { UI.toast('Invalid settings text'); }
      } }, { label: 'Cancel' }],
    });
  }
  else if (a === 'resetAll') UI.confirm('Reset all settings to defaults?', 'Reset', () => {
    Object.assign(S, DEFAULTS); LS.del(SETTINGS_KEY); LS.del(BG_KEY);
    applyKeys(new Set(Object.keys(DEFBY))); renderSheet(); UI.toast('Settings reset');
  });
}

// ---------- settings sheet ----------
function openSheet() {
  UI.sheetOpen = true; UI.pendingNew = false; renderSheet();
  requestAnimationFrame(() => $('sheet').classList.add('open'));
}
function closeSheet() {
  if (!UI.sheetOpen) return;
  UI.sheetOpen = false; $('sheet').classList.remove('open'); $('sheet').classList.remove('peek');
  applyKeys(new Set(['twoPView']));
}
function renderSheetBanner() {
  const old = document.querySelector('#sheet .banner'); if (old) old.remove();
  if (!UI.pendingNew || !UI.sheetOpen) return;
  const b = el('div', 'banner'); b.appendChild(el('span', '', 'Mode / colour / clock changes apply to a new game.'));
  const btn = el('button', 'sbtn pri', 'Start now'); btn.onclick = () => { closeSheet(); newGame(); }; b.appendChild(btn);
  const body = document.querySelector('#sheet .sbody'); if (body) body.prepend(b);
}
function renderSheet() {
  const sh = $('sheet'), prev = sh.querySelector('.sbody'), st = prev ? prev.scrollTop : 0;
  sh.innerHTML = '';
  const head = el('div', 'shead'); head.appendChild(el('h2', '', 'Settings'));
  const peek = el('button', 'sbtn', 'Hold: preview');
  const up = () => { sh.classList.remove('peek'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  peek.addEventListener('pointerdown', () => { sh.classList.add('peek'); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); });
  head.appendChild(peek);
  const close = el('button', 'sbtn pri', 'Done'); close.onclick = () => closeSheet(); head.appendChild(close);
  sh.appendChild(head);
  const tabs = el('div', 'tabs');
  for (const t of TABS) { const b = el('button', 'tab' + (t === UI.tab ? ' on' : ''), t); b.onclick = () => { UI.tab = t; renderSheet(); const bd = sh.querySelector('.sbody'); if (bd) bd.scrollTop = 0; }; tabs.appendChild(b); }
  sh.appendChild(tabs);
  const body = el('div', 'sbody');
  const onChange = (d, v) => { setValue(d, v); renderSheet(); };
  for (const d of DEFS) {
    if (d.tab !== UI.tab) continue;
    if (d.show && !d.show(S)) continue;
    body.appendChild(buildControl(d, onChange));
  }
  sh.appendChild(body);
  body.scrollTop = st;
  const act = tabs.querySelector('.tab.on'); if (act) tabs.scrollLeft = act.offsetLeft - (tabs.clientWidth - act.offsetWidth) / 2;
  renderSheetBanner();
}
if (!DEFS.some(d => d.action === 'copySettings')) {
  const i = DEFS.findIndex(d => d.action === 'resetAll');
  DEFS.splice(i, 0, { tab: 'More', type: 'action', label: 'Copy settings (backup)', action: 'copySettings' }, { tab: 'More', type: 'action', label: 'Import settings…', action: 'importSettings' });
}

// ---------- layout ----------
let lastLand = null, rotTimer = 0;
function doLayout(force) {
  const w = window.innerWidth, h = window.innerHeight, land = w > h * 1.1;
  const game = $('game');
  if (lastLand !== null && land !== lastLand && S.flipBlur && S.motionBlur > 0) {
    game.style.setProperty('transition', 'none'); game.classList.add('rotating');
    clearTimeout(rotTimer);
    rotTimer = setTimeout(() => { game.style.removeProperty('transition'); game.classList.remove('rotating'); }, 60);
  }
  lastLand = land;
  game.classList.toggle('land', land);
  const wrap = $('boardwrap');
  const side = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
  if (side > 40 && (force || side !== R.side)) R.resize(side);
}
UI.layout = doLayout;
window.__back = function () {
  if (UI.modals.length) {
    const top = UI.modals[UI.modals.length - 1];
    if (top.ov.id === 'home') return false;
    UI.closeDialog(top); return true;
  }
  if (UI.sheetOpen) { closeSheet(); return true; }
  UI.menuDialog(); return true;
};
