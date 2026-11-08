// Sonidos generados con WebAudio. Nada se carga de archivos.
let ctx = null;
let muted = false;
let humNode = null;

function ac() {
  if (muted) return null;
  // No crear sonido antes de que la persona toque algo (el navegador lo bloquea).
  if (!ctx && globalThis.navigator?.userActivation && !navigator.userActivation.hasBeenActive) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

export function setMuted(m) { muted = m; if (m) hum(false); }
export function isMuted() { return muted; }

export function beep(freq = 880, ms = 80, type = 'square', vol = 0.05) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g).connect(a.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000); o.stop(a.currentTime + ms / 1000 + 0.02);
}

export function alarm(kind = 'aviso') {
  if (kind === 'emergencia') [0, 250, 500].forEach((d) => setTimeout(() => { beep(1200, 160, 'sawtooth', 0.06); setTimeout(() => beep(800, 160, 'sawtooth', 0.06), 120); }, d));
  else [0, 180].forEach((d) => setTimeout(() => beep(660, 120, 'triangle', 0.06), d));
}

export function radio() {
  const a = ac(); if (!a) return;
  const len = a.sampleRate * 0.12;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); const g = a.createGain(); const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; g.gain.value = 0.08;
  src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
  setTimeout(() => beep(1400, 50, 'sine', 0.03), 130);
}

export function hum(on) {
  if (!on) { humNode?.o.stop(); humNode = null; return; }
  const a = ac(); if (!a || humNode) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = 'sine'; o.frequency.value = 55; g.gain.value = 0.015;
  o.connect(g).connect(a.destination); o.start();
  humNode = { o };
}

// ── Sonidos de los eventos relámpago ──
function noise(a, seconds) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
let hissNode = null;
/** Silbido de aire que se escapa (sigue hasta apagarlo). */
export function hiss(on) {
  if (!on) { try { hissNode?.src.stop(); } catch { /* ya parado */ } hissNode = null; return; }
  const a = ac(); if (!a || hissNode) return;
  const src = a.createBufferSource(); const f = a.createBiquadFilter(); const g = a.createGain();
  src.buffer = noise(a, 2); src.loop = true; f.type = 'highpass'; f.frequency.value = 3500; g.gain.value = 0.014;
  src.connect(f).connect(g).connect(a.destination); src.start();
  hissNode = { src };
}
/** El silbido se corta: fuga encontrada. */
export function hissHit() { hiss(false); beep(1500, 90, 'sine', 0.05); setTimeout(() => beep(1900, 120, 'sine', 0.05), 90); }
/** Chispa: algo salió mal. */
export function spark() {
  const a = ac(); if (!a) return;
  const src = a.createBufferSource(); const f = a.createBiquadFilter(); const g = a.createGain();
  src.buffer = noise(a, 0.18); f.type = 'bandpass'; f.frequency.value = 2400; g.gain.value = 0.12;
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
  src.connect(f).connect(g).connect(a.destination); src.start();
  beep(90, 160, 'sawtooth', 0.05);
}
/** Escotilla que se cierra: golpe metálico. */
export function clunk() { beep(140, 90, 'square', 0.07); setTimeout(() => beep(70, 160, 'square', 0.06), 40); }
/** Válvula que gira: chirrido corto. */
export function squeak() { beep(700, 40, 'sawtooth', 0.025); setTimeout(() => beep(520, 50, 'sawtooth', 0.025), 35); }
/** Cable conectado: zumbido eléctrico. */
export function zap() { beep(120, 120, 'sawtooth', 0.04); beep(1800, 40, 'square', 0.02); }
