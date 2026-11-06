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
