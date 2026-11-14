// MONITORES DE CONSOLA en canvas: cohete en wireframe, radar, osciloscopio del pulso, esquema vivo de la base e íconos.
import { tr } from '../i18n/i18n.js';
import { h } from './dom.js';

const css = (v, d) => getComputedStyle(document.body).getPropertyValue(v).trim() || d;
const C = () => ({ fg: css('--crt-fg', '#4dff88'), dim: css('--crt-dim', '#1f8a45'), amber: '#ffc23d', red: '#ff4b4b', bg: '#020a04' });

/** Canvas que se redibuja solo mientras esté en la página. draw(ctx, w, h, t) */
export function liveCanvas(w, hgt, draw, { cls = '' } = {}) {
  const c = h('canvas', { class: `viz ${cls}`, width: w * 2, height: hgt * 2, style: { width: '100%', maxWidth: `${w}px`, aspectRatio: `${w} / ${hgt}` } });
  const ctx = c.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0);
  const t0 = performance.now(); let started = false;
  const loop = (now) => {
    if (started && !c.isConnected) return;
    if (c.isConnected) started = true;
    ctx.clearRect(0, 0, w, hgt); draw(ctx, w, hgt, Math.max(0, (now - t0) / 1000));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return c;
}

// ---------- Cohete en wireframe ----------
export function drawRocket(ctx, w, hgt, t, { lift = 0, firing = false } = {}) {
  const k = C();
  const cx = w / 2, base = hgt - 24 - lift;
  // grilla de fondo
  ctx.strokeStyle = k.dim; ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); }
  for (let y = (t * 30 * (lift > 0 ? 1 : 0)) % 20; y < hgt; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // torre
  if (lift < 60) { ctx.strokeStyle = k.dim; ctx.strokeRect(cx + 26, hgt - 130 + Math.min(lift, 0), 8, 106); for (let y = hgt - 130; y < hgt - 24; y += 10) { ctx.beginPath(); ctx.moveTo(cx + 26, y); ctx.lineTo(cx + 34, y + 10); ctx.stroke(); } }
  ctx.strokeStyle = k.dim; ctx.beginPath(); ctx.moveTo(0, hgt - 22); ctx.lineTo(w, hgt - 22); ctx.stroke();
  // humo / fuego
  if (firing) {
    for (let i = 0; i < 26; i++) {
      const a = (i * 137.5 + t * 400) % 360, r = ((i * 7 + t * 90) % 40);
      ctx.strokeStyle = i % 3 ? k.amber : k.fg; ctx.globalAlpha = 1 - r / 40;
      ctx.beginPath(); ctx.arc(cx + Math.sin(a) * r * 0.7, base + 10 + r * 1.6, 2 + r / 6, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = k.amber; ctx.beginPath(); ctx.moveTo(cx - 8, base); ctx.lineTo(cx, base + 26 + Math.random() * 10); ctx.lineTo(cx + 8, base); ctx.stroke();
  }
  // cuerpo
  ctx.strokeStyle = k.fg; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, base - 110); ctx.quadraticCurveTo(cx + 12, base - 96, cx + 12, base - 80);
  ctx.lineTo(cx + 12, base); ctx.lineTo(cx - 12, base); ctx.lineTo(cx - 12, base - 80);
  ctx.quadraticCurveTo(cx - 12, base - 96, cx, base - 110); ctx.stroke();
  [base - 80, base - 50, base - 20].forEach((y) => { ctx.beginPath(); ctx.moveTo(cx - 12, y); ctx.lineTo(cx + 12, y); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(cx, base - 66, 4, 0, 7); ctx.stroke();
  // aletas e impulsores
  ctx.beginPath(); ctx.moveTo(cx - 12, base - 18); ctx.lineTo(cx - 22, base + 2); ctx.lineTo(cx - 12, base); ctx.moveTo(cx + 12, base - 18); ctx.lineTo(cx + 22, base + 2); ctx.lineTo(cx + 12, base); ctx.stroke();
}

// ---------- Radar ----------
/** blips: [{ang (rad), dist 0-1, label}] que se acercan con el tiempo. */
export function drawRadar(ctx, w, hgt, t, blips = []) {
  const k = C(); const cx = w / 2, cy = hgt / 2, R = Math.min(w, hgt) / 2 - 6;
  ctx.strokeStyle = k.dim; ctx.lineWidth = 1;
  for (let r = R / 4; r <= R; r += R / 4) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  const a = (t * 2.2) % (Math.PI * 2);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(77,255,136,.35)'); g.addColorStop(1, 'rgba(77,255,136,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a - 0.6, a); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = k.fg; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
  for (const b of blips) {
    const d = Math.max(0.05, b.dist - t * (b.speed ?? 0.03));
    const bx = cx + Math.cos(b.ang) * d * R, by = cy + Math.sin(b.ang) * d * R;
    const since = ((a - b.ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    ctx.globalAlpha = Math.max(0.15, 1 - since / 3);
    ctx.fillStyle = d < 0.3 ? k.red : k.amber; ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, 7); ctx.fill();
    if (b.label) { ctx.font = '12px "VT323", monospace'; ctx.fillText(b.label, bx + 6, by - 4); }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = k.fg; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
}
export const radarCanvas = (blips, size = 150) => liveCanvas(size, size, (ctx, w, hh, t) => drawRadar(ctx, w, hh, t, blips), { cls: 'radar' });

// ---------- Osciloscopio del pulso ----------
/** bpm según salud y cansancio; línea plana si murió. */
export function bpmOf(c) {
  if (!c.alive) return 0;
  return Math.round(62 + (100 - (c.health ?? 100)) * 0.5 + (c.fatigue ?? 0) * 0.2 + (100 - (c.morale ?? 80)) * 0.1);
}
export function drawPulse(ctx, w, hgt, t, bpm) {
  const k = C(); const mid = hgt / 2;
  ctx.strokeStyle = k.dim; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = bpm === 0 ? k.red : bpm > 100 ? k.amber : k.fg; ctx.lineWidth = 1.5; ctx.beginPath();
  const period = bpm ? 60 / bpm : 1;
  for (let x = 0; x <= w; x++) {
    const tt = t - (w - x) / 60;
    const ph = bpm ? (((tt % period) + period) % period) / period : 0.5;
    let y = 0;
    if (bpm) { if (ph < 0.08) y = Math.sin(ph / 0.08 * Math.PI) * 3; else if (ph < 0.12) y = -2; else if (ph < 0.16) y = (ph - 0.12) / 0.04 * hgt * 0.42; else if (ph < 0.2) y = -hgt * 0.15; else if (ph < 0.35) y = Math.sin((ph - 0.2) / 0.15 * Math.PI) * 4; }
    x ? ctx.lineTo(x, mid - y) : ctx.moveTo(x, mid - y);
  }
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle; ctx.font = '13px "VT323", monospace'; ctx.fillText(bpm ? tr(`${bpm} LPM`) : tr('SIN PULSO'), 3, 12);
}
export const pulseCanvas = (getCrew) => liveCanvas(140, 34, (ctx, w, hh, t) => drawPulse(ctx, w, hh, t, bpmOf(getCrew())), { cls: 'pulso' });

// ---------- Esquema vivo de la base ----------
/**
 * Módulos en cuadrícula con conexiones, luz de día/noche, astronautas como puntitos que caminan,
 * invernadero que crece y polvo si hay tormenta. info: { modules, crew, night (0-1), dust, day, plants (0-1) }
 */
export function drawBase(ctx, w, hgt, t, info) {
  const k = C();
  const mods = info.modules ?? [];
  if (!mods.length) return;
  const cols = Math.max(...mods.map((m) => m.x)) + 1, rows = Math.max(...mods.map((m) => m.y)) + 1;
  const cw = Math.min(70, (w - 20) / cols), ch = Math.min(46, (hgt - 40) / rows);
  const ox = (w - cols * cw) / 2, oy = 24 + (hgt - 30 - rows * ch) / 2;
  const at = (m) => [ox + m.x * cw + cw / 2, oy + m.y * ch + ch / 2];
  // día y noche
  ctx.fillStyle = `rgba(0,0,0,${0.45 * (info.night ?? 0)})`; ctx.fillRect(0, 0, w, hgt);
  ctx.font = '13px "VT323", monospace'; ctx.fillStyle = k.dim;
  ctx.fillText(tr(`${(info.night ?? 0) > 0.5 ? '☾ NOCHE' : '☀ DÍA'} · DÍA ${info.day ?? 0}`), 6, 14);
  // conexiones
  ctx.strokeStyle = k.dim; ctx.lineWidth = 2;
  for (const a of mods) for (const b of mods) if ((b.x === a.x + 1 && b.y === a.y) || (b.y === a.y + 1 && b.x === a.x)) { const [x1, y1] = at(a), [x2, y2] = at(b); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  // módulos
  const blink = Math.floor(t * 3) % 2 === 0;
  for (const m of mods) {
    const [x, y] = at(m);
    const broken = m.health < 40;
    ctx.fillStyle = k.bg; ctx.fillRect(x - cw / 2 + 4, y - ch / 2 + 4, cw - 8, ch - 8);
    ctx.strokeStyle = broken ? (blink ? k.red : k.amber) : m.on ? k.fg : k.dim; ctx.lineWidth = broken ? 2 : 1.4;
    ctx.strokeRect(x - cw / 2 + 4, y - ch / 2 + 4, cw - 8, ch - 8);
    if (m.on && !broken) { ctx.fillStyle = `rgba(77,255,136,${0.08 + 0.06 * Math.sin(t * 2 + m.x)})`; ctx.fillRect(x - cw / 2 + 5, y - ch / 2 + 5, cw - 10, ch - 10); }
    ctx.fillStyle = ctx.strokeStyle; ctx.font = '12px "VT323", monospace'; ctx.textAlign = 'center';
    ctx.fillText(m.code ?? m.type.slice(0, 4).toUpperCase(), x, y + 4); ctx.textAlign = 'left';
    if (m.type === 'invernadero') {
      const g = info.plants ?? 0.5;
      ctx.strokeStyle = k.fg; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const px = x - cw / 2 + 10 + i * (cw - 20) / 3, hh = 4 + g * 10 + Math.sin(t + i) * 1; ctx.beginPath(); ctx.moveTo(px, y + ch / 2 - 6); ctx.lineTo(px, y + ch / 2 - 6 - hh); ctx.stroke(); ctx.beginPath(); ctx.arc(px + 2, y + ch / 2 - 6 - hh, 2, 0, 7); ctx.stroke(); }
    }
  }
  // tripulación: puntitos que van de un módulo a otro
  const live = (info.crew ?? []).filter((c) => c.alive && !c.evacuated);
  live.forEach((c, i) => {
    const seg = Math.abs(Math.floor(t / 4 + i * 1.7)), f = Math.abs(t / 4 + i * 1.7) % 1;
    const a = mods[(seg * 7 + i * 3) % mods.length], b = mods[((seg + 1) * 7 + i * 3) % mods.length];
    const [x1, y1] = at(a), [x2, y2] = at(b), e = f < 0.6 ? 0 : (f - 0.6) / 0.4;
    ctx.fillStyle = c.health < 50 ? k.amber : '#7fe8ff';
    ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * e + (i - 1.5) * 4, y1 + (y2 - y1) * e + 8, 2.6, 0, 7); ctx.fill();
  });
  // polvo
  if (info.dust) {
    ctx.fillStyle = 'rgba(255,190,90,.5)';
    for (let i = 0; i < 80; i++) { const px = ((i * 53 + t * 120) % (w + 20)) - 10, py = (i * 29 + Math.sin(t + i) * 8) % hgt; ctx.fillRect(px, py, 2, 1); }
    ctx.fillStyle = k.amber; ctx.fillText(tr('⚠ TORMENTA DE POLVO'), w - 120, 14);
  }
}

// ---------- Íconos vectoriales de línea fina ----------
const P = {
  o2: '<circle cx="8" cy="12" r="5"/><circle cx="17" cy="9" r="3"/><circle cx="16" cy="17" r="2"/>',
  water: '<path d="M12 3 C12 3 5 11 5 15 a7 7 0 0 0 14 0 C19 11 12 3 12 3z"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
  meds: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M12 10v6M9 13h6M9 7V4h6v3"/>',
  parts: '<path d="M14 6a4 4 0 0 0-5 5L3 17l3 3 6-6a4 4 0 0 0 5-5l-3 3-2-1-1-2z"/>',
  fuel: '<rect x="5" y="4" width="10" height="16" rx="1"/><path d="M15 9h2l2 3v6a1 1 0 0 1-2 0v-4h-2M8 8h4"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="1"/><path d="M19 10h2v4h-2M6 10v4M9 10v4M12 10v4"/>',
  dataStored: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
};
export function icon(k, size = 22) {
  const span = h('span', { class: 'ico-linea', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[k] ?? '<circle cx="12" cy="12" r="8"/>'}</svg>`;
  return span;
}
