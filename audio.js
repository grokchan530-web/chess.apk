/* ===== Synthesised sound effects (no audio files, fully offline) + haptics + Android bridge ===== */
const AB = (typeof window !== 'undefined' && window.Android) ? window.Android : null;
function bridge(fn) {
  try { if (AB && typeof AB[fn] === 'function') return AB[fn].apply(AB, Array.prototype.slice.call(arguments, 1)); } catch (e) {}
  return undefined;
}

const Snd = {
  ctx: null, master: null, noiseBuf: null,
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  tone(freq, dur, type, vol, slideTo, delay) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, freq, q, delay) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.02);
  },
  play(name) {
    if (!S.sound || S.volume <= 0) return;
    this.unlock();
    const c = this.ctx; if (!c) return;
    this.master.gain.value = Math.pow(S.volume / 100, 1.6);
    const th = S.soundTheme;
    const T = {
      wood: {
        move() { Snd.tone(180, 0.09, 'triangle', 0.7, 90); Snd.noise(0.05, 0.5, 1800, 1.2); },
        capture() { Snd.tone(140, 0.16, 'triangle', 0.9, 60); Snd.noise(0.12, 0.8, 1200, 0.9); Snd.noise(0.05, 0.5, 3000, 2, 0.02); },
        select() { Snd.noise(0.03, 0.25, 2600, 2); },
      },
      soft: {
        move() { Snd.tone(330, 0.12, 'sine', 0.5, 240); },
        capture() { Snd.tone(260, 0.2, 'sine', 0.7, 140); Snd.noise(0.08, 0.3, 900, 0.8); },
        select() { Snd.tone(600, 0.04, 'sine', 0.2); },
      },
      retro: {
        move() { Snd.tone(440, 0.07, 'square', 0.22, 330); },
        capture() { Snd.tone(300, 0.12, 'square', 0.28, 90); Snd.tone(180, 0.1, 'square', 0.2, 60, 0.05); },
        select() { Snd.tone(880, 0.03, 'square', 0.12); },
      },
      glass: {
        move() { Snd.tone(1100, 0.14, 'sine', 0.35, 800); Snd.tone(1650, 0.1, 'sine', 0.15, 1200); },
        capture() { Snd.tone(900, 0.22, 'sine', 0.45, 400); Snd.tone(1800, 0.14, 'triangle', 0.2, 600); Snd.noise(0.06, 0.25, 5000, 3); },
        select() { Snd.tone(1500, 0.04, 'sine', 0.15); },
      },
    }[th] || {};
    const base = {
      castle() { (T.move || (() => {}))(); setTimeout(() => (T.move || (() => {}))(), 90); },
      promote() { Snd.tone(523, 0.12, 'triangle', 0.4); Snd.tone(659, 0.12, 'triangle', 0.4, 0, 0.07); Snd.tone(784, 0.2, 'triangle', 0.4, 0, 0.14); },
      check() { Snd.tone(880, 0.12, 'square', 0.18); Snd.tone(880, 0.16, 'square', 0.18, 0, 0.14); },
      illegal() { Snd.tone(120, 0.14, 'sawtooth', 0.22, 80); },
      tick() { Snd.noise(0.025, 0.35, 3500, 3); },
      start() { Snd.tone(392, 0.1, 'triangle', 0.35); Snd.tone(523, 0.16, 'triangle', 0.35, 0, 0.09); },
      win() { [523, 659, 784, 1047].forEach((f, i) => Snd.tone(f, 0.22, 'triangle', 0.4, 0, i * 0.11)); },
      lose() { [392, 330, 262].forEach((f, i) => Snd.tone(f, 0.28, 'triangle', 0.4, 0, i * 0.16)); },
      draw() { Snd.tone(440, 0.2, 'triangle', 0.35); Snd.tone(440, 0.3, 'triangle', 0.3, 0, 0.18); },
      flip() { Snd.noise(0.18, 0.18, 700, 0.6); },
    };
    const fn = T[name] || base[name];
    if (fn) try { fn(); } catch (e) {}
  },
};

function haptic(kind) {
  if (!S.haptics) return;
  const len = Math.round(S.hapticStrength * (kind === 'big' ? 2.2 : kind === 'mid' ? 1.4 : 1));
  if (AB) bridge('vibrate', len);
  else try { if (navigator.vibrate) navigator.vibrate(len); } catch (e) {}
}
