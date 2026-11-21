/* ===== Settings schema, presets and persistence ===== */
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// ---- colour helpers ----
function hex2rgb(h) {
  h = (h || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function shade(h, f) { // f>0 mix with white, f<0 mix with black
  const [r, g, b] = hex2rgb(h), t = f < 0 ? 0 : 255, a = Math.abs(f);
  return rgb2hex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}
function lum(h) { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
function isHex(s) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s); }

// ---- presets ----
const LEVELS = {
  beginner: { aiDepth: 1, aiTime: 200, aiBlunder: 45, aiRandom: 80, aiAggr: 0, aiDelay: 450 },
  casual:   { aiDepth: 2, aiTime: 400, aiBlunder: 25, aiRandom: 50, aiAggr: 10, aiDelay: 350 },
  club:     { aiDepth: 3, aiTime: 1000, aiBlunder: 8, aiRandom: 20, aiAggr: 20, aiDelay: 200 },
  strong:   { aiDepth: 5, aiTime: 2500, aiBlunder: 0, aiRandom: 5, aiAggr: 30, aiDelay: 100 },
  master:   { aiDepth: 8, aiTime: 6000, aiBlunder: 0, aiRandom: 0, aiAggr: 30, aiDelay: 0 },
};
const BOARD_THEMES = {
  classic:  { lightColor: '#f0d9b5', darkColor: '#b58863', borderColor: '#5b3f2a', gridColor: '#000000' },
  green:    { lightColor: '#eeeed2', darkColor: '#769656', borderColor: '#3b4a2a', gridColor: '#000000' },
  ocean:    { lightColor: '#dbe7ee', darkColor: '#6f93ad', borderColor: '#274157', gridColor: '#0b2233' },
  midnight: { lightColor: '#8793b3', darkColor: '#3a4468', borderColor: '#151a2e', gridColor: '#0a0d1a' },
  neon:     { lightColor: '#1b1f3a', darkColor: '#0f1226', borderColor: '#00e5ff', gridColor: '#00e5ff' },
  rose:     { lightColor: '#fde7ec', darkColor: '#d98ca0', borderColor: '#7a3b4b', gridColor: '#5a2433' },
  paper:    { lightColor: '#f4efe4', darkColor: '#c8bda3', borderColor: '#7d7358', gridColor: '#4a4330' },
  candy:    { lightColor: '#ffe9f3', darkColor: '#a98bff', borderColor: '#5a3fa0', gridColor: '#3b2a78' },
  slate:    { lightColor: '#d9d9d9', darkColor: '#7a7a7a', borderColor: '#333333', gridColor: '#111111' },
  lava:     { lightColor: '#ffd9a8', darkColor: '#c0432a', borderColor: '#4a1a10', gridColor: '#2a0a05' },
};
const PIECE_THEMES = {
  ivory:  { whiteColor: '#f7f3e8', blackColor: '#3a3a44', outlineColor: '#14141a' },
  gold:   { whiteColor: '#ffe08a', blackColor: '#8d96a6', outlineColor: '#1b1b22' },
  ruby:   { whiteColor: '#ff7a8f', blackColor: '#4d7cff', outlineColor: '#10101a' },
  mint:   { whiteColor: '#8dffd6', blackColor: '#8b5cf6', outlineColor: '#0d0d18' },
  neon:   { whiteColor: '#00f5d4', blackColor: '#ff3d9a', outlineColor: '#05050a' },
  ghost:  { whiteColor: '#ffffff', blackColor: '#1d1d24', outlineColor: '#7d7d8c' },
};
const BG_PRESETS = {
  night:  { bgColor1: '#0d0f14', bgColor2: '#1c2333' },
  aurora: { bgColor1: '#0f2027', bgColor2: '#2c5364' },
  sunset: { bgColor1: '#2b1055', bgColor2: '#d53369' },
  forest: { bgColor1: '#0b3d2e', bgColor2: '#1b7f5c' },
  ember:  { bgColor1: '#200122', bgColor2: '#6f0000' },
  paper:  { bgColor1: '#e9e4d8', bgColor2: '#c9c2b0' },
};

const isAI = s => s.mode === 'ai';
const is2P = s => s.mode === '2p';
const clockCustom = s => s.clock === 'custom';

const DEFS = [];
function head(tab, label) { DEFS.push({ tab, type: 'head', label }); }
function tg(tab, key, label, def, x) { DEFS.push(Object.assign({ tab, key, label, type: 'toggle', def }, x)); }
function sl(tab, key, label, min, max, step, def, unit, x) { DEFS.push(Object.assign({ tab, key, label, type: 'slider', min, max, step, def, unit: unit || '' }, x)); }
function sg(tab, key, label, def, opts, x) { DEFS.push(Object.assign({ tab, key, label, type: 'seg', def, opts }, x)); }
function ch(tab, key, label, def, opts, x) { DEFS.push(Object.assign({ tab, key, label, type: 'chips', def, opts }, x)); }
function co(tab, key, label, def, x) { DEFS.push(Object.assign({ tab, key, label, type: 'color', def }, x)); }
function ac(tab, label, action, x) { DEFS.push(Object.assign({ tab, type: 'action', label, action }, x)); }

// ---------- GAME ----------
head('Game', 'Mode');
sg('Game', 'mode', 'Game mode', 'ai', [['ai', 'vs Computer'], ['2p', '2 Players · 1 phone']]);
sg('Game', 'playerColor', 'Play as', 'white', [['white', 'White'], ['black', 'Black'], ['random', 'Random']], { show: isAI });
sg('Game', 'twoPView', '2-player view', 'facing', [['none', 'Fixed'], ['flip', 'Flip board'], ['facing', 'Face to face']], { show: is2P });
head('Game', 'Difficulty');
ch('Game', 'level', 'Preset', 'club', [['beginner', 'Beginner'], ['casual', 'Casual'], ['club', 'Club'], ['strong', 'Strong'], ['master', 'Master'], ['custom', 'Custom']], { show: isAI, presets: LEVELS });
sl('Game', 'aiDepth', 'Search depth', 1, 8, 1, 3, '', { show: isAI, custom: 'level' });
sl('Game', 'aiTime', 'Max think time', 100, 15000, 100, 1000, ' ms', { show: isAI, custom: 'level' });
sl('Game', 'aiBlunder', 'Mistake chance', 0, 60, 1, 8, '%', { show: isAI, custom: 'level' });
sl('Game', 'aiRandom', 'Move variety', 0, 100, 1, 20, '', { show: isAI, custom: 'level' });
sl('Game', 'aiAggr', 'Aggression', 0, 100, 1, 20, '', { show: isAI, custom: 'level' });
sl('Game', 'aiDelay', 'Minimum reply delay', 0, 2000, 50, 200, ' ms', { show: isAI, custom: 'level' });
head('Game', 'Clock');
ch('Game', 'clock', 'Time control', 'none', [['none', 'Off'], ['1+0', '1 min'], ['3+0', '3 min'], ['3+2', '3 | 2'], ['5+0', '5 min'], ['10+0', '10 min'], ['custom', 'Custom']]);
sl('Game', 'clockMin', 'Minutes per side', 1, 60, 1, 5, ' min', { show: clockCustom });
sl('Game', 'clockInc', 'Increment per move', 0, 30, 1, 0, ' s', { show: clockCustom });
head('Game', 'Rules & assists');
tg('Game', 'autoQueen', 'Always promote to queen', false);
tg('Game', 'allowUndo', 'Allow undo / redo', true);
tg('Game', 'confirmResign', 'Confirm before resigning', true);

// ---------- BOARD ----------
head('Board', 'Colours');
ch('Board', 'boardTheme', 'Theme', 'classic', [['classic', 'Classic'], ['green', 'Green'], ['ocean', 'Ocean'], ['midnight', 'Midnight'], ['neon', 'Neon'], ['rose', 'Rose'], ['paper', 'Paper'], ['candy', 'Candy'], ['slate', 'Slate'], ['lava', 'Lava'], ['custom', 'Custom']], { presets: BOARD_THEMES });
co('Board', 'lightColor', 'Light squares', '#f0d9b5', { custom: 'boardTheme' });
co('Board', 'darkColor', 'Dark squares', '#b58863', { custom: 'boardTheme' });
sg('Board', 'squareStyle', 'Square style', 'gloss', [['flat', 'Flat'], ['gloss', 'Gloss'], ['inset', 'Inset'], ['glass', 'Glass']]);
sl('Board', 'squareRadius', 'Corner roundness', 0, 50, 1, 0, '%');
sl('Board', 'squareGap', 'Gap between squares', 0, 10, 1, 0, ' px');
head('Board', 'Size & frame');
sl('Board', 'boardScale', 'Board size', 70, 100, 1, 100, '%');
sl('Board', 'boardOpacity', 'Square opacity', 20, 100, 1, 100, '%');
sl('Board', 'borderWidth', 'Border width', 0, 24, 1, 8, ' px');
co('Board', 'borderColor', 'Border colour', '#5b3f2a', { custom: 'boardTheme' });
tg('Board', 'boardShadow', 'Board shadow', true);
head('Board', 'Grid');
tg('Board', 'showGrid', 'Show grid lines', false);
co('Board', 'gridColor', 'Grid colour', '#000000');
sl('Board', 'gridWidth', 'Grid thickness', 0.5, 4, 0.5, 1, ' px');
sl('Board', 'gridOpacity', 'Grid opacity', 5, 100, 1, 35, '%');
tg('Board', 'gridDashed', 'Dashed grid', false);
head('Board', 'Coordinates');
sg('Board', 'coords', 'Labels', 'inside', [['off', 'Off'], ['inside', 'Inside'], ['outside', 'Outside']]);
sl('Board', 'coordSize', 'Label size', 8, 18, 1, 11, ' px', { show: s => s.coords !== 'off' });
tg('Board', 'coordAuto', 'Auto label colour', true, { show: s => s.coords === 'inside' });
co('Board', 'coordColor', 'Label colour', '#ffffff', { show: s => s.coords === 'outside' || (s.coords === 'inside' && !s.coordAuto) });
head('Board', 'Highlights');
co('Board', 'selectColor', 'Selected square', '#ffd54a');
co('Board', 'lastMoveColor', 'Last move', '#7ad8ff');
co('Board', 'checkColor', 'Check warning', '#ff3b3b');
sg('Board', 'markerStyle', 'Move hints', 'dot', [['dot', 'Dots'], ['ring', 'Rings'], ['square', 'Tint'], ['none', 'None']]);
co('Board', 'markerColor', 'Hint colour', '#1c1c1c', { show: s => s.markerStyle !== 'none' });
sl('Board', 'markerSize', 'Hint size', 10, 60, 1, 30, '%', { show: s => s.markerStyle === 'dot' });

// ---------- PIECES ----------
head('Pieces', 'Style');
ch('Pieces', 'pieceSet', 'Piece set', 'classic', [['classic', 'Classic'], ['flat', 'Flat'], ['outline', 'Outline'], ['neon', 'Neon'], ['glyph', 'Glyph']]);
sl('Pieces', 'pieceScale', 'Piece size', 60, 110, 1, 92, '%');
sl('Pieces', 'outlineWidth', 'Outline thickness', 0, 8, 0.5, 3, '', { show: s => s.pieceSet !== 'flat' });
tg('Pieces', 'pieceShine', 'Shaded / glossy finish', true);
tg('Pieces', 'pieceShadow', 'Drop shadow', true);
head('Pieces', 'Colours');
ch('Pieces', 'pieceTheme', 'Theme', 'ivory', [['ivory', 'Ivory/Ebony'], ['gold', 'Gold/Steel'], ['ruby', 'Ruby/Sapphire'], ['mint', 'Mint/Violet'], ['neon', 'Neon'], ['ghost', 'Ghost'], ['custom', 'Custom']], { presets: PIECE_THEMES });
co('Pieces', 'whiteColor', 'White pieces', '#f7f3e8', { custom: 'pieceTheme' });
co('Pieces', 'blackColor', 'Black pieces', '#3a3a44', { custom: 'pieceTheme' });
co('Pieces', 'outlineColor', 'Outline colour', '#14141a', { custom: 'pieceTheme' });

// ---------- EFFECTS ----------
head('Effects', 'Movement');
sl('Effects', 'animSpeed', 'Move duration (0 = instant)', 0, 800, 10, 200, ' ms');
sg('Effects', 'animEase', 'Easing', 'smooth', [['linear', 'Linear'], ['smooth', 'Smooth'], ['snap', 'Snap'], ['overshoot', 'Bounce']]);
sl('Effects', 'motionBlur', 'Motion blur', 0, 100, 1, 60, '%');
sg('Effects', 'trail', 'Move trail', 'line', [['none', 'None'], ['line', 'Streak'], ['ghost', 'Ghost']]);
tg('Effects', 'flipBlur', 'Blur while board rotates', true);
head('Effects', 'Impact');
sl('Effects', 'particles', 'Particles', 0, 100, 1, 60, '%');
ch('Effects', 'particleStyle', 'Capture style', 'sparks', [['sparks', 'Sparks'], ['shatter', 'Shatter'], ['dust', 'Dust'], ['confetti', 'Confetti']]);
tg('Effects', 'shockwave', 'Landing shockwave', true);
sl('Effects', 'shake', 'Screen shake', 0, 100, 1, 35, '%');
tg('Effects', 'checkFlash', 'Check flash & pulse', true);
tg('Effects', 'selectGlow', 'Selection glow', true);
tg('Effects', 'lastMovePulse', 'Pulse last move', true);
tg('Effects', 'winConfetti', 'Victory confetti', true);
co('Effects', 'accent', 'Accent / effect colour', '#4cc9f0');

// ---------- DISPLAY ----------
head('Display', 'Background');
ch('Display', 'bgType', 'Type', 'gradient', [['solid', 'Solid'], ['gradient', 'Gradient'], ['animated', 'Animated'], ['image', 'Image']]);
ch('Display', 'bgPreset', 'Preset', 'night', [['night', 'Night'], ['aurora', 'Aurora'], ['sunset', 'Sunset'], ['forest', 'Forest'], ['ember', 'Ember'], ['paper', 'Paper'], ['custom', 'Custom']], { presets: BG_PRESETS, show: s => s.bgType !== 'image' });
co('Display', 'bgColor1', 'Colour 1', '#0d0f14', { custom: 'bgPreset', show: s => s.bgType !== 'image' });
co('Display', 'bgColor2', 'Colour 2', '#1c2333', { custom: 'bgPreset', show: s => s.bgType === 'gradient' || s.bgType === 'animated' });
sl('Display', 'bgAngle', 'Gradient angle', 0, 360, 5, 135, '°', { show: s => s.bgType === 'gradient' });
sl('Display', 'bgSpeed', 'Animation duration', 4, 60, 1, 18, ' s', { show: s => s.bgType === 'animated' });
ac('Display', 'Choose background image…', 'pickBg', { show: s => s.bgType === 'image' });
ac('Display', 'Remove background image', 'clearBg', { show: s => s.bgType === 'image' });
sl('Display', 'bgBlur', 'Background blur', 0, 30, 1, 0, ' px');
sl('Display', 'bgDim', 'Background dimming', 0, 90, 1, 0, '%');
head('Display', 'Performance');
ch('Display', 'fpsCap', 'Frame rate limit', 60, [[30, '30'], [60, '60'], [90, '90'], [120, '120'], [0, 'Max']]);
tg('Display', 'highRefresh', 'Request highest screen refresh rate', true);
sl('Display', 'quality', 'Render resolution', 50, 150, 5, 100, '%');
tg('Display', 'showFps', 'Show FPS counter', false);
head('Display', 'Screen');
ch('Display', 'orientation', 'Rotation', 'auto', [['auto', 'Auto-rotate'], ['system', 'Follow system'], ['portrait', 'Portrait'], ['landscape', 'Landscape']]);
tg('Display', 'immersive', 'Hide status & nav bars', true);
tg('Display', 'keepAwake', 'Keep screen on', true);
sl('Display', 'uiScale', 'Interface size', 80, 130, 5, 100, '%');
sl('Display', 'panelOpacity', 'Panel opacity', 30, 100, 1, 72, '%');
tg('Display', 'leftHanded', 'Left-handed layout', false);

// ---------- SOUND ----------
head('Sound', 'Audio');
tg('Sound', 'sound', 'Sound effects', true);
sl('Sound', 'volume', 'Volume', 0, 100, 1, 70, '%', { show: s => s.sound });
ch('Sound', 'soundTheme', 'Sound theme', 'wood', [['wood', 'Wood'], ['soft', 'Soft'], ['retro', 'Retro'], ['glass', 'Glass']], { show: s => s.sound });
tg('Sound', 'lowTimeTick', 'Low-time warning ticks', true, { show: s => s.sound });
head('Sound', 'Haptics');
tg('Sound', 'haptics', 'Vibration', true);
sl('Sound', 'hapticStrength', 'Vibration length', 5, 60, 5, 20, ' ms', { show: s => s.haptics });

// ---------- CONTROLS ----------
head('Controls', 'Input');
sg('Controls', 'inputMode', 'Move input', 'both', [['tap', 'Tap'], ['drag', 'Drag'], ['both', 'Both']]);
tg('Controls', 'showLegal', 'Show legal moves', true);
tg('Controls', 'showLastMove', 'Highlight last move', true);
head('Controls', 'Interface');
tg('Controls', 'showCaptured', 'Show captured pieces', true);
tg('Controls', 'showMoves', 'Show move list', true);
tg('Controls', 'autoSave', 'Auto-save game', true);

// ---------- MORE ----------
head('More', 'Game');
ac('More', 'Share / copy PGN', 'sharePgn');
ac('More', 'Copy current position (FEN)', 'copyFen');
head('More', 'Settings');
ac('More', 'Reset all settings', 'resetAll', { danger: true });

const DEFAULTS = {};
for (const d of DEFS) if (d.key) DEFAULTS[d.key] = d.def;
const TABS = ['Game', 'Board', 'Pieces', 'Effects', 'Display', 'Sound', 'Controls', 'More'];
const SETTINGS_KEY = 'chess.settings.v1';

function sanitizeInto(target, o) {
  for (const d of DEFS) {
    if (!d.key || !(d.key in o)) continue;
    const v = o[d.key];
    if (d.type === 'toggle' && typeof v === 'boolean') target[d.key] = v;
    else if (d.type === 'slider' && typeof v === 'number' && isFinite(v)) target[d.key] = Math.max(d.min, Math.min(d.max, v));
    else if (d.type === 'color' && typeof v === 'string' && isHex(v)) target[d.key] = v;
    else if ((d.type === 'seg' || d.type === 'chips')) {
      const hit = d.opts.find(o2 => String(o2[0]) === String(v));
      if (hit) target[d.key] = hit[0];
    }
  }
  return target;
}
function loadSettings() {
  const s = Object.assign({}, DEFAULTS);
  try { const raw = LS.get(SETTINGS_KEY); if (raw) sanitizeInto(s, JSON.parse(raw)); } catch (e) {}
  return s;
}
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => LS.set(SETTINGS_KEY, JSON.stringify(S)), 250);
}
const S = loadSettings();
