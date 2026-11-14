// EFECTOS DE CONSOLA: CRT, arranque "LIFELINE OS", transiciones con estática y "¿Sabías que…?", números que cuentan,
// glitch con daño, bips por recurso, ambiente por destino, voz de Control y silencio antes de una emergencia.
import { beep, isMuted } from './audio.js';
import { music } from './music.js';
import { FACTS } from '../data/nasa.js';
import { h } from './dom.js';

const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin espacio */ } };
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const randomFact = () => FACTS[Math.floor(Math.random() * FACTS.length)];

// ---------- CRT ----------
export function crt(on = pref('vdl-crt', '1') === '1') {
  document.body.classList.toggle('crt', on);
  if (on && !document.getElementById('crt-capa')) document.body.append(h('div', { id: 'crt-capa', 'aria-hidden': 'true' }));
  if (!on) document.getElementById('crt-capa')?.remove();
  setPref('vdl-crt', on ? '1' : '0');
  return on;
}

// ---------- Arranque ----------
const BOOT = [
  ['LIFELINE OS v2.6 · CONTROL DE MISIÓN', ''],
  ['MEMORIA ........................ 640K OK', ''],
  ['SOPORTE VITAL .................. OK', 'ok'],
  ['O₂ / CO₂ ....................... 21,0 % / 0,3 %', 'ok'],
  ['ENLACE CON LA RED DE ESPACIO PROFUNDO ... OK', 'ok'],
  ['DATOS NASA (DONKI, APOD, ISS) ... LISTO', 'ok'],
  ['ACADEMIA DE ASTRONAUTAS ........ ABIERTA', 'ok'],
  ['', ''],
  ['> BIENVENIDO, CADETE.', 'big'],
];
/** Pantalla de encendido (una vez por sesión; se salta con cualquier tecla o toque). */
export function boot() {
  let seen = false; try { seen = sessionStorage.getItem('vdl-boot') === '1'; } catch { /* nada */ }
  if (seen || new URLSearchParams(location.search).has('jurado') || navigator.webdriver) return Promise.resolve();
  try { sessionStorage.setItem('vdl-boot', '1'); } catch { /* nada */ }
  return new Promise((res) => {
    const pre = h('pre', { class: 'boot-txt' });
    const fact = h('div', { class: 'boot-fact' }, `¿Sabías que…? ${randomFact()}`);
    const el = h('div', { id: 'arranque', role: 'status' }, pre, fact, h('div', { class: 'boot-skip' }, 'toca o presiona una tecla para saltar'));
    document.body.append(el);
    let line = 0, ch = 0, done = false, timer;
    const end = () => { if (done) return; done = true; clearTimeout(timer); el.classList.add('fuera'); setTimeout(() => el.remove(), 450); window.removeEventListener('keydown', end, true); el.removeEventListener('pointerdown', end); res(); };
    window.addEventListener('keydown', end, true); el.addEventListener('pointerdown', end);
    const tick = () => {
      if (done) return;
      if (line >= BOOT.length) { timer = setTimeout(end, 900); return; }
      const [txt, cls] = BOOT[line];
      if (ch === 0) pre.append(h('div', { class: `bl ${cls}` }, ''));
      const row = pre.lastChild; ch = Math.min(txt.length, ch + 3); row.textContent = txt.slice(0, ch);
      if (ch % 6 === 0 && !isMuted()) beep(1600 + Math.random() * 400, 6, 'square', 0.012);
      if (ch >= txt.length) { line++; ch = 0; timer = setTimeout(tick, cls === 'ok' ? 110 : 160); } else timer = setTimeout(tick, 14);
    };
    tick();
  });
}

// ---------- Transición entre pantallas ----------
let lastFact = 0;
export function transition(name) {
  if (reduced()) return;
  const showFact = ['design', 'ops', 'report'].includes(name) && Date.now() - lastFact > 45000;
  if (showFact) lastFact = Date.now();
  const el = h('div', { class: `trans ${showFact ? 'con-dato' : ''}`, 'aria-hidden': 'true' },
    showFact ? h('div', { class: 'trans-dato' }, h('b', {}, '¿SABÍAS QUE…?'), h('div', {}, randomFact())) : null);
  document.body.append(el);
  if (!isMuted()) beep(180, 50, 'sawtooth', 0.015);
  setTimeout(() => el.remove(), showFact ? 1500 : 420);
}

// ---------- Glitch ----------
export function glitch(ms = 380) {
  if (reduced()) return;
  document.body.classList.remove('glitch'); void document.body.offsetWidth;
  document.body.classList.add('glitch');
  setTimeout(() => document.body.classList.remove('glitch'), ms);
}

// ---------- Silencio dramático: baja la música 1 s ----------
export function hush(ms = 1000) {
  try { music.setVolume(0.02); setTimeout(() => music.setVolume(0.75), ms); } catch { /* sin música */ }
}

// ---------- Voz de Control ----------
let voiceOn = pref('vdl-voz', '1') === '1';
export const voiceEnabled = () => voiceOn;
export function setVoice(on) { voiceOn = on; setPref('vdl-voz', on ? '1' : '0'); if (!on) window.speechSynthesis?.cancel(); }
export function speak(text, { rate = 1.05, pitch = 0.9, interrupt = false } = {}) {
  const ss = window.speechSynthesis;
  if (!voiceOn || isMuted() || !ss || !text) return;
  if (interrupt) ss.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/[^\p{L}\p{N}\s.,;:¡!¿?%-]/gu, ''));
  const lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  const v = ss.getVoices().find((x) => x.lang?.toLowerCase().startsWith(lang));
  if (v) u.voice = v;
  u.lang = lang === 'en' ? 'en-US' : 'es-ES'; u.rate = rate; u.pitch = pitch; u.volume = 0.9;
  ss.speak(u);
}

// ---------- Lectura en voz alta de lo que dice Nova (para quien lee despacio) ----------
let readOn = pref('vdl-leer', '0') === '1';
export const readAloud = () => readOn;
export function setReadAloud(on) { readOn = on; setPref('vdl-leer', on ? '1' : '0'); if (!on) window.speechSynthesis?.cancel(); }

// ---------- Ambiente por destino (ruido filtrado muy bajo) ----------
let amb = null;
export function ambient(scenario) {
  if (amb?.scenario === scenario) return;
  stopAmbient();
  if (!scenario || isMuted() || pref('vdl-ambiente', '1') !== '1') return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const a = new AC();
  const out = a.createGain(); out.gain.value = 0; out.connect(a.destination);
  const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter();
  const nodes = [src];
  if (scenario === 'marte') {
    // Viento: ruido pasabanda que sube y baja.
    f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.7;
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 250;
    lfo.connect(lg).connect(f.frequency); lfo.start(); nodes.push(lfo);
    src.connect(f).connect(out); out.gain.linearRampToValueAtTime(0.05, a.currentTime + 2);
  } else {
    // Estación / Gateway: zumbido de ventiladores. Luna: casi silencio con un latido grave.
    f.type = 'lowpass'; f.frequency.value = scenario === 'luna' ? 120 : 260;
    src.connect(f).connect(out);
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = scenario === 'luna' ? 38 : 60;
    const og = a.createGain(); og.gain.value = scenario === 'luna' ? 0.25 : 0.12; o.connect(og).connect(out); o.start(); nodes.push(o);
    out.gain.linearRampToValueAtTime(scenario === 'luna' ? 0.03 : 0.04, a.currentTime + 2);
  }
  src.start();
  amb = { scenario, a, nodes };
}
export function stopAmbient() {
  if (!amb) return;
  const { a, nodes } = amb; amb = null;
  try { nodes.forEach((n) => n.stop()); a.close(); } catch { /* ya cerrado */ }
}
export const ambientOn = () => pref('vdl-ambiente', '1') === '1';
export function setAmbient(on, scenario) { setPref('vdl-ambiente', on ? '1' : '0'); if (on) ambient(scenario); else stopAmbient(); }

// ---------- Observador: números que cuentan, bips por recurso bajo, glitch con alarma ----------
const prev = new Map();
const lowSeen = new Set();
const LOW_TONE = {
  o2: () => [0, 110, 220].forEach((d) => setTimeout(() => beep(1500, 60, 'square', 0.035), d)),
  water: () => [0, 160].forEach((d) => setTimeout(() => beep(900, 90, 'sine', 0.04), d)),
  food: () => beep(420, 220, 'triangle', 0.05),
  battery: () => [880, 660, 440].forEach((f, k) => setTimeout(() => beep(f, 90, 'square', 0.03), k * 110)),
};
const RES_KEY = { 'Oxígeno': 'o2', 'Agua': 'water', 'Comida': 'food', 'Batería': 'battery', 'Oxygen': 'o2', 'Water': 'water', 'Food': 'food', 'Battery': 'battery' };

function countUp(el, from, to, suffix) {
  const t0 = performance.now(), dur = 600;
  const dec = Number.isInteger(to) ? 0 : 1;
  el.classList.add(to < from ? 'baja' : 'sube');
  const stepF = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    el.firstChild.textContent = (from + (to - from) * e).toFixed(dec) + suffix;
    if (k < 1) requestAnimationFrame(stepF); else setTimeout(() => el.classList.remove('baja', 'sube'), 300);
  };
  requestAnimationFrame(stepF);
}

function scan() {
  for (const card of document.querySelectorAll('#app .res-card')) {
    const key = card.getAttribute('title') ?? '';
    const val = card.querySelector('.res-val');
    if (val && val.firstChild?.nodeType === 3) {
      const m = val.firstChild.textContent.match(/^(-?\d+(?:[.,]\d+)?)(.*)$/s);
      if (m) {
        const n = Number(m[1].replace(',', '.'));
        const old = prev.get(key);
        prev.set(key, n);
        if (old != null && old !== n && Math.abs(old - n) < 1e6 && !reduced()) countUp(val, old, n, m[2]);
      }
    }
    const rk = RES_KEY[key];
    if (rk) {
      const low = card.classList.contains('low');
      if (low && !lowSeen.has(rk)) { lowSeen.add(rk); if (!isMuted()) LOW_TONE[rk]?.(); }
      if (!low) lowSeen.delete(rk);
    }
  }
}

let alarmWas = false, modalWas = false;
function watchBody() {
  const red = document.body.classList.contains('alarma-roja');
  const grave = !!document.querySelector('.modal.grave, #evento');
  if ((red && !alarmWas) || (grave && !modalWas)) { glitch(); }
  if (red && !alarmWas) hush(1000);
  alarmWas = red; modalWas = grave;
}

export function initFx() {
  crt();
  const app = document.getElementById('app');
  let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; scan(); }); }).observe(app, { childList: true, subtree: true, characterData: false });
  new MutationObserver(watchBody).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
}
