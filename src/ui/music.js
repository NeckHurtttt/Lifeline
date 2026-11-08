// Música original del juego, hecha con código (sin grabaciones ni archivos).
// Estilo ambiental espacial: órgano lento con eco largo, un tic-tac como de reloj y una figura de piano
// que va creciendo de a poco. Modos: 'orbit' (estación), 'surface' (Luna/Marte), 'danger' (eventos),
// 'victory' (misión cumplida) y 'tension' (eventos relámpago: tema corto de urgencia que acelera).
const freq = (n) => 440 * 2 ** ((n - 69) / 12);

// Acordes (notas MIDI). Cada acorde dura 2 compases. Progresiones propias.
const SONGS = {
  orbit: { bpm: 64, chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [38, 45, 50, 53, 57], [40, 47, 52, 56, 59]] },
  surface: { bpm: 58, chords: [[40, 47, 52, 55, 59], [36, 43, 48, 52, 55], [38, 45, 50, 53, 57], [35, 42, 47, 50, 54]] },
  danger: { bpm: 74, chords: [[45, 52, 57, 60, 63], [44, 51, 56, 60, 63], [42, 49, 54, 57, 61], [40, 47, 52, 55, 58]] },
  victory: { bpm: 68, chords: [[48, 55, 60, 64, 67], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [41, 48, 53, 57, 65]] },
};
// Figura de piano: qué nota del acorde suena en cada corchea.
const FIGURE = [2, 4, 3, 4, 2, 4, 3, 1];

export class Soundtrack {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.75; this.muted = false; this.mode = 'orbit'; this.step = 0; this.next = 0; this.timer = null; this.voices = []; this.urgency = 0; }

  async start() {
    try {
      if (!this.ctx) {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = c.createGain(); this.master.gain.value = this.volume;
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        this.master.connect(comp).connect(c.destination);
        // Eco largo (reverberación) hecho con ruido que se apaga: da la sensación de espacio enorme.
        this.verb = c.createConvolver(); this.verb.buffer = this.impulse(4.5);
        const wet = c.createGain(); wet.gain.value = 0.55;
        this.verb.connect(wet).connect(this.master);
        this.bus = c.createGain(); this.bus.connect(this.master); this.bus.connect(this.verb);
      }
      await this.ctx.resume();
      if (!this.timer) { this.next = this.ctx.currentTime + 0.1; this.timer = setInterval(() => this.schedule(), 50); }
      return true;
    } catch { return false; }
  }
  impulse(seconds) {
    const c = this.ctx; const len = Math.floor(c.sampleRate * seconds); const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    return buf;
  }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08); }
  toggle() { this.muted = !this.muted; this.setVolume(this.volume); return this.muted; }
  /** Cambia de tema. Entrar o salir de la tensión corta el órgano rápido para que no se mezclen. */
  modeTo(mode) {
    if (mode === this.mode) return;
    const cut = mode === 'tension' || this.mode === 'tension';
    this.mode = mode; this.urgency = 0;
    if (!this.ctx) return;
    this.fadeVoices(cut ? 0.25 : 2.5);
    this.step = 0; this.next = Math.max(this.next, this.ctx.currentTime + (cut ? 0.05 : 0.4));
  }
  /** 0 = recién empezó el relámpago, 1 = se acaba el tiempo. Acelera el tema de tensión. */
  setUrgency(u) { this.urgency = Math.max(0, Math.min(1, u)); }
  fadeVoices(seconds) {
    const t = this.ctx.currentTime;
    for (const v of this.voices) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + seconds); v.oscs.forEach((o) => o.stop(t + seconds + 0.05)); } catch { /* ya terminó */ } }
    this.voices = [];
  }

  /** Órgano: tres osciladores por nota, entrada y salida lentas. */
  organ(n, at, dur, level) {
    const c = this.ctx; const g = c.createGain(); const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    const oscs = [[1, 'sine', 1], [2, 'sine', 0.45], [1.003, 'triangle', 0.35], [0.5, 'sine', 0.3]].map(([m, type, l]) => {
      const o = c.createOscillator(); const og = c.createGain(); o.type = type; o.frequency.value = freq(n) * m; og.gain.value = l;
      o.connect(og).connect(lp); o.start(at); o.stop(at + dur + 3); return o;
    });
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 1.8);
    g.gain.setValueAtTime(level, at + dur); g.gain.linearRampToValueAtTime(0, at + dur + 2.8);
    lp.connect(g).connect(this.bus);
    const v = { g, oscs }; this.voices.push(v);
    oscs[0].onended = () => { this.voices = this.voices.filter((x) => x !== v); };
  }
  /** Piano suave (seno con golpe corto). */
  pluck(n, at, level, len = 1.6) {
    const c = this.ctx; const o = c.createOscillator(); const o2 = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = freq(n); o2.frequency.value = freq(n) * 2;
    const g2 = c.createGain(); g2.gain.value = 0.18; o2.connect(g2).connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, at + len);
    o.connect(g).connect(this.bus); o.start(at); o2.start(at); o.stop(at + len + 0.05); o2.stop(at + len + 0.05);
  }
  /** Tic de reloj. */
  tick(at, level = 0.02, f = 2600) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain(); o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.025);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + 0.04);
  }
  /** Golpe grave (latido). */
  boom(at, level = 0.5, f = 55) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(f * 2, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.08);
    g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + 0.5);
  }
  /** Cuerda tensa (sierra filtrada) para el tema de urgencia. */
  saw(n, at, len, level, cutoff) {
    const c = this.ctx; const o = c.createOscillator(); const lp = c.createBiquadFilter(); const g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq(n); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 6;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.01); g.gain.exponentialRampToValueAtTime(0.001, at + len);
    o.connect(lp).connect(g).connect(this.bus); o.start(at); o.stop(at + len + 0.05);
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.25) {
      const dur = this.mode === 'tension' ? this.tensionStep(this.step, this.next) : this.ambientStep(this.step, this.next);
      this.next += dur; this.step++;
    }
  }

  /** Un paso (semicorchea) del tema ambiental. La intensidad crece cada 8 compases y vuelve a empezar a los 40. */
  ambientStep(step, at) {
    const song = SONGS[this.mode] ?? SONGS.orbit;
    const beat = 60 / song.bpm; const s16 = beat / 4;
    const bar = Math.floor(step / 16); const inBar = step % 16;
    const section = Math.floor((bar % 40) / 8); // 0 solo órgano · 1 tic-tac · 2 piano · 3 piano doble · 4 todo + bajo
    const chord = song.chords[Math.floor(bar / 2) % song.chords.length];
    if (step % 32 === 0) {
      const len = beat * 8;
      chord.forEach((n, i) => this.organ(n, at, len, i === 0 ? 0.08 : 0.052));
      if (section >= 4 || this.mode === 'danger') this.organ(chord[0] - 12, at, len, 0.09);
    }
    if (inBar % 4 === 0 && (section >= 1 || this.mode === 'danger')) this.tick(at, this.mode === 'danger' ? 0.03 : 0.014);
    if (inBar % 2 === 0 && section >= 2) {
      const n = chord[FIGURE[(inBar / 2) % 8]] + 12;
      const lvl = section >= 3 ? 0.1 : 0.07;
      this.pluck(n, at, lvl);
      if (section >= 3 && inBar % 4 === 0) this.pluck(n + 12, at, lvl * 0.5);
    }
    if (this.mode === 'danger' && inBar % 8 === 0) this.boom(at, 0.3, 41);
    return s16;
  }

  /** Tema de urgencia: latido, cuerdas tensas y tic-tac rápido. Acelera y sube de tono con la urgencia. */
  tensionStep(step, at) {
    const u = this.urgency;
    const bpm = 128 + 60 * u; const s16 = 60 / bpm / 4;
    const inBar = step % 16; const bar = Math.floor(step / 16);
    const shift = Math.floor(u * 4); // sube hasta 4 semitonos cuando se acaba el tiempo
    const root = 45 + shift;
    if (inBar === 0 || inBar === 6 || inBar === 10) this.boom(at, 0.55, 49 + shift);
    this.tick(at, inBar % 4 === 0 ? 0.03 : 0.012, inBar % 4 === 0 ? 2200 : 3400);
    // Cuerdas: figura que alterna la raíz con la segunda menor (suena a peligro).
    const figure = [0, 12, 1, 12, 0, 12, 3, 12, 0, 12, 1, 12, 7, 6, 3, 1];
    this.saw(root + 12 + figure[inBar], at, s16 * 1.6, 0.05 + 0.03 * u, 900 + 2600 * u);
    // Cada 2 compases, una nota larga de órgano grave que sostiene todo.
    if (step % 32 === 0) this.organ(root - 12, at, s16 * 30, 0.07);
    if (u > 0.7 && inBar % 2 === 1) this.tick(at, 0.02, 4200); // los últimos segundos: más tic-tac
    void bar;
    return s16;
  }

  effect(kind) {
    if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    const seq = kind === 'craft' ? [60, 67, 72, 79] : kind === 'mine' ? [55, 67] : kind === 'alert' ? [69, 57, 69] : [64, 71];
    seq.forEach((n, i) => this.pluck(n, t + i * 0.065, 0.1, 0.2));
  }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }
}

export const music = new Soundtrack();
