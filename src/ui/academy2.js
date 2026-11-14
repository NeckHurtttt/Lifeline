// ACADEMIA AVANZADA: los 8 minijuegos nuevos. Se registran en GAMES de academy.js y se abren con runTraining(id).
import { beep, clunk, alarm } from './audio.js';
import { GAMES, W, H, FG, DIM, AMBER, RED, LINE, rand, clamp, text } from './academy.js';
import { EVA_ORDER, PROTOCOLS, TRIAGE, NATO, RADIO_WORDS, WIRE_COLORS, wireToCut, MANUAL, inZone } from '../core/academy2.js';

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Cajas tocables: devuelve el índice de la caja bajo (x, y). */
function boxes(n, { top = 110, cols = 1, h = 34, gap = 8 } = {}) {
  const bw = (W - 20 - gap * (cols - 1)) / cols;
  return Array.from({ length: n }, (_, i) => ({ x: 10 + (i % cols) * (bw + gap), y: top + Math.floor(i / cols) * (h + gap), w: bw, h }));
}
const hit = (bs, x, y) => bs.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
function drawBox(ctx, b, label, { color = FG, fill = null, size = 16 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(b.x, b.y, b.w, b.h); }
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
  text(ctx, label, b.x + b.w / 2, b.y + b.h / 2 + 5, { align: 'center', size, color });
}
function wrap(ctx, t, x, y, maxW, opt = {}) {
  const words = t.split(' '); let line = '', yy = y;
  ctx.font = `${opt.size ?? 18}px "VT323", monospace`;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { text(ctx, line, x, yy, opt); line = w; yy += (opt.size ?? 18) + 2; } else line = test;
  }
  if (line) text(ctx, line, x, yy, opt);
}

/** Preguntas de opción múltiple con rondas (auxilios, radio). */
function choiceGame(rounds, { hint, header }) {
  let i = 0, good = 0, flash = 0, last = null;
  const cur = () => rounds[i];
  return {
    tap(x, y) {
      if (this.done || flash > 0) return;
      const r = cur(); const k = hit(boxes(r.options.length, { top: 150 }), x, y);
      if (k < 0) return;
      last = k === r.ok; if (last) { good++; beep(1100, 70, 'sine'); } else { beep(220, 120); }
      flash = 0.7;
    },
    step(dt) { if (flash > 0) { flash -= dt; if (flash <= 0) { i++; if (i >= rounds.length) this.done = true; } } },
    draw(ctx) {
      if (i >= rounds.length) return;
      const r = cur();
      text(ctx, `${header} ${i + 1} / ${rounds.length} · ACIERTOS ${good}`, 10, 20, { color: DIM });
      wrap(ctx, r.prompt, 12, 52, W - 24, { size: 20 });
      boxes(r.options.length, { top: 150 }).forEach((b, k) => drawBox(ctx, b, r.options[k],
        { color: flash > 0 && k === r.ok ? FG : flash > 0 && !last ? RED : FG, fill: flash > 0 && k === r.ok ? '#0c3b1c' : null }));
    },
    score() { return good / rounds.length; },
    hint,
  };
}

/** Tocar en orden (traje EVA, protocolos). */
function orderGame(sets, { hint, cols = 1 }) {
  let si = 0, next = 0, errors = 0, bad = 0, total = sets.reduce((a, s) => a + s.steps.length, 0), done = 0;
  let order = shuffle(sets[0].steps.map((_, k) => k));
  return {
    tap(x, y) {
      if (this.done) return;
      const set = sets[si];
      const bs = boxes(set.steps.length, { top: 62, cols, h: cols > 1 ? 40 : 32, gap: 6 });
      const k = hit(bs, x, y); if (k < 0) return;
      const step = order[k];
      if (step < next) return;
      if (step === next) { next++; done++; beep(900 + next * 60, 60, 'sine'); if (next >= set.steps.length) { si++; next = 0; clunk(); if (si >= sets.length) this.done = true; else order = shuffle(sets[si].steps.map((_, q) => q)); } }
      else { errors++; bad = 0.35; alarm('aviso'); }
    },
    step(dt) { bad = Math.max(0, bad - dt); },
    draw(ctx) {
      if (si >= sets.length) return;
      const set = sets[si];
      text(ctx, set.name, 10, 22, { color: AMBER, size: 20 });
      text(ctx, `PASO ${next + 1} DE ${set.steps.length} · ERRORES ${errors}`, 10, 44, { color: bad > 0 ? RED : DIM, size: 16 });
      boxes(set.steps.length, { top: 62, cols, h: cols > 1 ? 40 : 32, gap: 6 }).forEach((b, k) => {
        const st = order[k], ok = st < next;
        drawBox(ctx, b, ok ? `✔ ${st + 1}. ${set.steps[st]}` : set.steps[st], { color: ok ? DIM : FG, fill: ok ? '#08240f' : null, size: cols > 1 ? 15 : 16 });
      });
    },
    score() { return clamp((done / total) - errors * 0.08, 0, 1); },
    hint,
  };
}

function eva() { return orderGame([{ name: 'TRAJE EVA: ¿qué va primero?', steps: EVA_ORDER }], { cols: 2, hint: 'Toca las piezas en orden: de adentro hacia afuera y al final revisar todo.' }); }
function protocolo({ short } = {}) { return orderGame(shuffle(Object.values(PROTOCOLS)).slice(0, short ? 1 : 3), { hint: 'Toca los pasos en el orden del manual. Un error en una emergencia cuesta caro.' }); }

function auxilios({ short } = {}) {
  const rounds = shuffle(TRIAGE).slice(0, short ? 3 : 5).map((t) => { const options = shuffle([t.ok, ...t.bad]); return { prompt: `${t.who}: ${t.sym}.`, options, ok: options.indexOf(t.ok) }; });
  return choiceGame(rounds, { header: 'PACIENTE', hint: 'Lee el problema y toca el tratamiento correcto.' });
}

function radio({ short } = {}) {
  const words = shuffle(RADIO_WORDS).filter((w) => !short || w.length <= 4).slice(0, short ? 1 : 2);
  const all = Object.values(NATO);
  const rounds = words.join('').split('').map((ch, k) => {
    const right = NATO[ch];
    const options = shuffle([right, ...shuffle(all.filter((w) => w !== right)).slice(0, 2)]);
    return { prompt: `📻 Control deletrea "${words.join(' · ')}". Letra ${k + 1}: ¿cómo se dice "${ch}" por radio?`, options, ok: options.indexOf(right) };
  });
  return choiceGame(rounds, { header: 'LETRA', hint: 'Alfabeto fonético: A = Alfa, B = Bravo, C = Charlie…' });
}

function soldadura({ kids }) {
  let t = 0, y = H / 2, on = 0, total = 0, sparks = [];
  const seam = (tt) => H / 2 + Math.sin(tt * 1.3) * 70 + Math.sin(tt * 3.1) * (kids ? 10 : 22);
  const tol = kids ? 18 : 12;
  return {
    controls: [['↑', 'up'], ['↓', 'down']],
    step(dt, inp) {
      t += dt; total += dt;
      y = clamp(y + ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * 160 * dt, 30, H - 10);
      const ok = Math.abs(y - seam(t)) < tol;
      if (ok) { on += dt; if (Math.random() < 0.6) sparks.push({ x: 120, y, vx: rand(-60, 60), vy: rand(-90, 20), l: 0.4 }); }
      sparks = sparks.filter((s) => (s.l -= dt) > 0); sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; });
    },
    draw(ctx) {
      text(ctx, `SOLDADO ${Math.round((on / Math.max(1, total)) * 100)} %`, 10, 20);
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 30); ctx.lineTo(gx, H); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.strokeStyle = RED; ctx.beginPath();
      for (let x = 120; x <= W; x += 6) { const yy = seam(t + (x - 120) / 120) + (x % 12 ? 2 : -2); x === 120 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
      ctx.strokeStyle = FG; ctx.beginPath();
      for (let x = 0; x <= 120; x += 6) { const yy = seam(t - (120 - x) / 120); x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
      ctx.fillStyle = AMBER; sparks.forEach((s) => ctx.fillRect(s.x, s.y, 2, 2));
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(120, y, 7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(60, y - 30); ctx.lineTo(114, y - 4); ctx.stroke();
    },
    score() { return on / Math.max(1, total) / 0.9; },
    hint: 'Usa ↑ ↓ (o W S) para seguir la grieta roja con el soplete.',
  };
}

function cultivo({ kids }) {
  let water = 0.6, light = 0.6, t = 0, zone = 0, grow = 0, night = false, nt = 4;
  const dec = kids ? 0.06 : 0.09;
  return {
    controls: [['💧 AGUA', 'water', true], ['💡 LUZ', 'light', true]],
    step(dt, inp) {
      t += dt; nt -= dt; if (nt <= 0) { night = !night; nt = rand(3, 6); }
      water -= dec * dt; light -= (night ? dec * 2 : dec * 0.6) * dt;
      if (inp.water) { water += 0.16; inp.water = false; beep(500, 40, 'sine'); }
      if (inp.light) { light += 0.16; inp.light = false; beep(900, 40, 'sine'); }
      water = clamp(water, 0, 1); light = clamp(light, 0, 1);
      if (inZone(water) && inZone(light)) { zone += dt; grow += dt; }
    },
    draw(ctx) {
      text(ctx, `${night ? '🌑 SOMBRA' : '☀️ LUZ'} · LECHUGA ${Math.min(100, Math.round(grow * 4))} %`, 10, 20);
      const bar = (x, v, lbl) => {
        ctx.strokeStyle = FG; ctx.strokeRect(x, 50, 26, 200);
        ctx.fillStyle = '#0c3b1c'; ctx.fillRect(x + 1, 50 + 200 * 0.2, 24, 200 * 0.4);
        ctx.fillStyle = inZone(v) ? FG : RED; ctx.fillRect(x + 4, 50 + 200 * (1 - v), 18, 200 * v);
        text(ctx, lbl, x + 13, 270, { align: 'center', size: 16 });
      };
      bar(20, water, 'AGUA'); bar(66, light, 'LUZ');
      const g = Math.min(1, grow / 25); const cx = 260, base = 250;
      ctx.strokeStyle = DIM; ctx.strokeRect(180, base, 160, 20);
      ctx.strokeStyle = FG; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, base - 30 - 110 * g); ctx.stroke();
      for (let k = 0; k < Math.floor(2 + g * 8); k++) {
        const yy = base - 20 - k * 13 * (0.5 + g), s = k % 2 ? 1 : -1, len = 20 + 30 * g;
        ctx.beginPath(); ctx.ellipse(cx + s * len / 2, yy, len / 2, 6 + 4 * g, s * 0.4, 0, 7); ctx.stroke();
      }
    },
    score() { return zone / Math.max(1, t) / 0.85; },
    hint: 'Toca AGUA y LUZ para mantener las dos barras en la zona verde.',
  };
}

function estrellas({ kids, short }) {
  const stars = Array.from({ length: 45 }, () => ({ x: rand(15, W - 15), y: rand(40, H - 15), r: rand(0.8, 2) }));
  const NAMES = ['Sirio', 'Vega', 'Polaris', 'Canopus', 'Antares', 'Rigel'];
  let cx = W / 2, cy = H / 2, round = 0, found = 0, msg = '', msgT = 0;
  const targets = shuffle(stars).slice(0, short ? 3 : 5).map((s, k) => { s.r = 3; s.name = NAMES[k]; return s; });
  const R = kids ? 16 : 11;
  return {
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['🎯 FIJAR', 'grab', true]],
    step(dt, inp) {
      const sp = 150;
      cx = clamp(cx + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * sp * dt, 0, W);
      cy = clamp(cy + ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * sp * dt, 30, H);
      msgT = Math.max(0, msgT - dt);
      if (inp.grab) {
        inp.grab = false;
        const tg = targets[round];
        if (Math.hypot(tg.x - cx, tg.y - cy) < R) { found++; msg = `✔ ${tg.name} fijada`; beep(1200, 80, 'sine'); }
        else { msg = '✖ Esa no era'; beep(220, 100); }
        msgT = 1; round++; if (round >= targets.length) this.done = true;
      }
    },
    tap(x, y) { cx = x; cy = y; },
    draw(ctx) {
      const tg = targets[Math.min(round, targets.length - 1)];
      text(ctx, `BUSCA: ${tg.name.toUpperCase()} (la que parpadea) · ${found}/${targets.length}`, 10, 20);
      const blink = (performance.now() / 300) % 2 < 1;
      for (const s of stars) {
        const isT = s === tg && round < targets.length;
        ctx.fillStyle = isT ? (blink ? AMBER : FG) : DIM;
        ctx.beginPath(); ctx.arc(s.x, s.y, isT ? 3 : s.r, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = FG; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + R + 8, cy);
      ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + R + 8); ctx.stroke();
      if (msgT) text(ctx, msg, W / 2, H - 14, { align: 'center', size: 22, color: msg.startsWith('✔') ? FG : RED });
    },
    score() { return found / targets.length; },
    hint: 'Mueve la mira con las flechas (o toca el cielo) y toca FIJAR sobre la estrella que parpadea.',
  };
}

const HEX = { rojo: '#ff4b4b', azul: '#4fc3ff', amarillo: '#ffc23d', blanco: '#e8f0ff' };
function equipo() {
  const N = 5;
  const mk = () => Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => WIRE_COLORS[Math.floor(Math.random() * 4)]);
  let round = 0, good = 0, wires = mk(), flash = 0, lastOk = null, showManual = false;
  const ys = () => wires.map((_, k) => 70 + k * (180 / wires.length));
  return {
    controls: [['📖 MANUAL (mantener)', 'manual']],
    tap(x, y) {
      if (showManual || flash > 0 || this.done) return;
      const k = ys().findIndex((yy) => Math.abs(y - yy) < 16 && x > 60 && x < 340);
      if (k < 0) return;
      lastOk = k === wireToCut(wires); if (lastOk) { good++; clunk(); } else alarm('aviso');
      flash = 0.8;
    },
    step(dt, inp) {
      showManual = !!inp.manual;
      if (flash > 0) { flash -= dt; if (flash <= 0) { round++; if (round >= N) this.done = true; else wires = mk(); } }
    },
    draw(ctx) {
      if (showManual) {
        text(ctx, '📖 MANUAL DE CABLES (léelo en voz alta)', 10, 24, { color: AMBER, size: 20 });
        MANUAL.forEach((m, k) => wrap(ctx, `${k + 1}. ${m}`, 14, 60 + k * 44, W - 28, { size: 18 }));
        text(ctx, 'Las reglas se revisan en este orden.', 10, H - 12, { color: DIM, size: 15 });
        return;
      }
      text(ctx, `PANEL ${round + 1} / ${N} · BIEN ${good}`, 10, 20);
      text(ctx, 'Quien corta NO mira el manual: pregunta al compañero.', 10, 42, { color: DIM, size: 15 });
      ys().forEach((yy, k) => {
        ctx.strokeStyle = HEX[wires[k]]; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(60, yy); ctx.bezierCurveTo(150, yy - 14, 250, yy + 14, 340, yy); ctx.stroke();
        text(ctx, String(k + 1), 40, yy + 6, { size: 18 });
      });
      ctx.strokeStyle = DIM; ctx.lineWidth = 2; ctx.strokeRect(50, 55, 300, 200);
      if (flash > 0) text(ctx, lastOk ? '✔ BIEN CORTADO' : '✖ ESE NO ERA', W / 2, H - 14, { align: 'center', size: 24, color: lastOk ? FG : RED });
    },
    score() { return good / N; },
    hint: 'Persona 1 mantiene MANUAL y lee. Persona 2 toca el cable a cortar. Jugando solo también se puede.',
  };
}

Object.assign(GAMES, { eva, soldadura, auxilios, cultivo, radio, estrellas, protocolo, equipo });
