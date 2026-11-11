// ACADEMIA DE ASTRONAUTAS: los 5 minijuegos de entrenamiento (canvas + botones grandes, sirven en teléfono).
// runTraining(id) abre la prueba en una ventana y devuelve { stars, score } (o null si se salió).
import { h, modal } from './dom.js';
import { beep, clunk, alarm } from './audio.js';
import { tr } from '../i18n/i18n.js';
import { TRAININGS, starsFrom, roverLevel, runRover, ROVER_COLS, ROVER_ROWS } from '../core/academy.js';

const W = 400, H = 300;
const FG = '#4dff88', DIM = '#2fb35c', AMBER = '#ffc23d', RED = '#ff4b4b', BG = '#020a04', LINE = '#1c6b34';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function text(ctx, t, x, y, { color = FG, size = 18, align = 'left' } = {}) {
  ctx.fillStyle = color; ctx.font = `${size}px "VT323", monospace`; ctx.textAlign = align; ctx.fillText(tr(t), x, y);
}

// ---------- Cada prueba: { controls, step(dt, input), draw(ctx), score(), done, time } ----------

function flotar({ kids }) {
  const names = ['llave', 'agua', 'cuchara', 'libro', 'agua', 'tornillo', 'foto', 'agua', 'lápiz', 'pan'];
  const sp = kids ? 45 : 70;
  const items = names.slice(0, kids ? 8 : 10).map((n) => ({ n, x: rand(40, W - 40), y: rand(50, H - 40), vx: rand(-sp, sp), vy: rand(-sp, sp), r: kids ? 24 : 19, got: false, spin: rand(0, 6) }));
  return {
    items, total: items.length,
    tap(x, y) {
      const it = items.find((o) => !o.got && Math.hypot(o.x - x, o.y - y) < o.r + 8);
      if (it) { it.got = true; beep(1100, 50, 'sine'); } else beep(220, 30);
    },
    step(dt) {
      for (const o of items) {
        if (o.got) continue;
        o.x += o.vx * dt; o.y += o.vy * dt; o.spin += dt;
        if (o.x < o.r || o.x > W - o.r) { o.vx *= -1; o.x = clamp(o.x, o.r, W - o.r); }
        if (o.y < 30 + o.r || o.y > H - o.r) { o.vy *= -1; o.y = clamp(o.y, 30 + o.r, H - o.r); }
      }
      if (items.every((o) => o.got)) this.done = true;
    },
    draw(ctx) {
      text(ctx, `ATRAPADOS ${items.filter((o) => o.got).length} / ${items.length}`, 10, 20);
      for (const o of items) {
        if (o.got) continue;
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.spin);
        ctx.strokeStyle = o.n === 'agua' ? '#7fe8ff' : FG; ctx.lineWidth = 2;
        if (o.n === 'agua') { ctx.beginPath(); ctx.arc(0, 0, o.r * 0.7, 0, 7); ctx.stroke(); }
        else ctx.strokeRect(-o.r * 0.6, -o.r * 0.6, o.r * 1.2, o.r * 1.2);
        ctx.restore();
        text(ctx, o.n, o.x, o.y + 4, { size: 15, align: 'center', color: o.n === 'agua' ? '#7fe8ff' : FG });
      }
    },
    score() { return items.filter((o) => o.got).length / items.length; },
    hint: 'Toca cada cosa que flota.',
  };
}

function acople({ kids, seconds }) {
  let x = rand(-70, 70), y = rand(-60, 60), vx = rand(-8, 8), vy = rand(-8, 8), t = 0, errSum = 0, n = 0, final = null;
  const acc = kids ? 34 : 28;
  return {
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right']],
    step(dt, inp) {
      t += dt;
      // Empujes de los propulsores (dirección en la que se mueve la cruz).
      if (inp.left) vx -= acc * dt; if (inp.right) vx += acc * dt;
      if (inp.up) vy -= acc * dt; if (inp.down) vy += acc * dt;
      // Pequeños empujones (gases, el sol); en niños la nave se frena sola un poco.
      vx += rand(-6, 6) * dt; vy += rand(-6, 6) * dt;
      if (kids) { vx *= 1 - 0.6 * dt; vy *= 1 - 0.6 * dt; }
      x = clamp(x + vx * dt, -150, 150); y = clamp(y + vy * dt, -110, 110);
      errSum += Math.hypot(x, y) * dt; n += dt;
      if (t >= seconds) { final = Math.hypot(x, y); this.done = true; clunk(); }
    },
    draw(ctx) {
      const cx = W / 2, cy = H / 2 + 10, k = 0.35 + 0.65 * Math.min(1, t / seconds); // el puerto crece al acercarse
      ctx.strokeStyle = LINE; ctx.lineWidth = 2;
      for (const r of [90, 60, 30]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = DIM; ctx.beginPath(); ctx.moveTo(cx - 100 * k, cy); ctx.lineTo(cx + 100 * k, cy); ctx.moveTo(cx, cy - 100 * k); ctx.lineTo(cx, cy + 100 * k); ctx.stroke();
      const e = Math.hypot(x, y), col = e < 20 ? FG : e < 45 ? AMBER : RED;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(cx + x - 16, cy + y); ctx.lineTo(cx + x + 16, cy + y); ctx.moveTo(cx + x, cy + y - 16); ctx.lineTo(cx + x, cy + y + 16); ctx.stroke();
      const dist = Math.max(0, 30 * (1 - t / seconds));
      text(ctx, `DISTANCIA ${dist.toFixed(1)} m`, 10, 20);
      text(ctx, `DESVÍO ${(e / 20).toFixed(1)} m`, W - 10, 20, { align: 'right', color: col });
      text(ctx, `${(30 / seconds).toFixed(2)} m/s`, 10, H - 10, { color: DIM });
    },
    score() {
      if (final == null) return 0;
      const avg = n ? errSum / n : 99;
      return 0.6 * clamp(1 - final / 50, 0, 1) + 0.4 * clamp(1 - avg / 60, 0, 1);
    },
    hint: 'Usa las flechas (o el teclado). En el espacio nada frena: empuja poquito.',
  };
}

function brazo({ kids }) {
  const tries = 4; let done = 0, caught = 0, phase = 0, clawX = 60, dir = 1, capX = rand(80, W - 80), drop = 0, dropping = false, flash = 0, flashOk = false;
  const tol = kids ? 26 : 16;
  return {
    controls: [['AGARRAR', 'grab', true]],
    step(dt, inp) {
      flash = Math.max(0, flash - dt);
      capX += Math.sin(phase * 0.9) * 10 * dt; phase += dt;
      if (!dropping) {
        const sp = (kids ? 90 : 120) + done * (kids ? 15 : 30);
        clawX += dir * sp * dt;
        if (clawX > W - 30) { clawX = W - 30; dir = -1; } if (clawX < 30) { clawX = 30; dir = 1; }
        if (inp.grab) { dropping = true; inp.grab = false; beep(500, 40); }
      } else {
        inp.grab = false;
        drop += 300 * dt;
        if (drop >= 150) {
          const ok = Math.abs(clawX - capX) < tol;
          if (ok) { caught++; clunk(); } else beep(200, 120, 'sawtooth');
          flash = 0.8; flashOk = ok; done++; dropping = false; drop = 0; capX = rand(80, W - 80);
          if (done >= tries) this.done = true;
        }
      }
    },
    draw(ctx) {
      text(ctx, `ATRAPADAS ${caught} · INTENTOS ${tries - done}`, 10, 20);
      // Riel y brazo.
      ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, 50); ctx.lineTo(W - 20, 50); ctx.stroke();
      ctx.strokeStyle = FG; ctx.beginPath(); ctx.moveTo(clawX, 50); ctx.lineTo(clawX, 80 + drop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(clawX - 14, 92 + drop); ctx.lineTo(clawX - 8, 80 + drop); ctx.lineTo(clawX + 8, 80 + drop); ctx.lineTo(clawX + 14, 92 + drop); ctx.stroke();
      // Nave de carga con su agarradera.
      const cy = 250;
      ctx.strokeStyle = AMBER; ctx.strokeRect(capX - 30, cy - 10, 60, 34);
      ctx.beginPath(); ctx.moveTo(capX, cy - 10); ctx.lineTo(capX, cy - 22); ctx.stroke();
      ctx.beginPath(); ctx.arc(capX, cy - 25, 4, 0, 7); ctx.stroke();
      text(ctx, 'CARGA', capX, cy + 12, { align: 'center', color: AMBER, size: 15 });
      if (flash) text(ctx, flashOk ? '¡ATRAPADA!' : 'FALLÓ', W / 2, 150, { align: 'center', size: 28, color: flashOk ? FG : RED });
    },
    score() { return Math.min(1, caught / 3); },
    hint: 'Toca AGARRAR (o espacio) cuando la pinza esté encima de la agarradera.',
  };
}

function luna({ kids }) {
  const total = 8, speed = kids ? 80 : 100, g = kids ? 100 : 120, jumpV = kids ? -120 : -110;
  const craters = []; let at = 330;
  for (let i = 0; i < total; i++) { const w = kids ? rand(40, 70) : rand(50, 105); craters.push({ x: at, w, passed: false, fell: false }); at += w + rand(kids ? 230 : 190, kids ? 320 : 300); }
  let y = 0, vy = 0, ground = true, passed = 0, fell = 0, scroll = 0, flash = 0;
  const ax = 80, gy = 230;
  return {
    controls: [['SALTAR', 'jump', true]],
    step(dt, inp) {
      flash = Math.max(0, flash - dt);
      scroll += speed * dt;
      if (inp.jump && ground) { vy = jumpV; ground = false; beep(660, 40, 'sine'); }
      inp.jump = false;
      if (!ground) { vy += g * dt; y += vy * dt; if (y >= 0) { y = 0; vy = 0; ground = true; } }
      for (const c of craters) {
        const left = c.x - scroll, right = left + c.w;
        if (!c.passed && !c.fell && ground && ax > left + 4 && ax < right - 4) { c.fell = true; fell++; flash = 0.7; alarm('aviso'); }
        if (!c.passed && !c.fell && ax > right) { c.passed = true; passed++; beep(990, 40, 'sine'); }
        if (c.fell && ax > right) c.passed = true;
      }
      if (craters.every((c) => c.passed)) this.done = true;
    },
    draw(ctx) {
      text(ctx, `CRÁTERES ${passed} / ${total}`, 10, 20);
      ctx.fillStyle = '#0c2a16'; ctx.fillRect(0, gy + 10, W, H - gy - 10);
      ctx.strokeStyle = DIM; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy + 10);
      for (const c of craters) {
        const left = c.x - scroll, right = left + c.w;
        if (right < 0 || left > W) continue;
        ctx.lineTo(left, gy + 10); ctx.lineTo(left + 8, gy + 50); ctx.lineTo(right - 8, gy + 50); ctx.lineTo(right, gy + 10);
      }
      ctx.lineTo(W, gy + 10); ctx.stroke();
      // Tierra en el cielo.
      ctx.strokeStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(W - 50, 60, 14, 0, 7); ctx.stroke();
      // Astronauta.
      const py = gy + y;
      ctx.strokeStyle = flash ? RED : FG; ctx.lineWidth = 2;
      ctx.strokeRect(ax - 8, py - 26, 16, 20); ctx.beginPath(); ctx.arc(ax, py - 32, 7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 5, py - 6); ctx.lineTo(ax - 7, py + 8); ctx.moveTo(ax + 5, py - 6); ctx.lineTo(ax + 7, py + 8); ctx.stroke();
      if (flash) text(ctx, '¡AL CRÁTER! Sigue…', W / 2, 120, { align: 'center', size: 22, color: RED });
    },
    score() { return passed / total; },
    hint: 'Toca SALTAR (o espacio) antes de cada cráter. El salto dura mucho: no saltes muy temprano.',
  };
}

function centrifuga({ kids, seconds }) {
  let t = 0, p = 0.55, inZone = 0;
  const lo = kids ? 0.3 : 0.4, hi = kids ? 0.8 : 0.7;
  const gAt = (tt) => 1 + 2.5 * (1 - Math.cos(Math.min(1, tt / seconds) * Math.PI * 2)) + 0.6 * Math.sin(tt * 2.3);
  return {
    controls: [['TENSAR', 'strain']],
    step(dt, inp) {
      t += dt;
      const G = gAt(t);
      p += (inp.strain ? (kids ? 0.45 : 0.5) : 0) * dt - G * (kids ? 0.045 : 0.055) * dt;
      p = clamp(p, 0, 1);
      if (p >= lo && p <= hi) inZone += dt;
      if (t >= seconds) this.done = true;
      this.G = G;
    },
    draw(ctx) {
      const G = this.G ?? 1;
      text(ctx, `FUERZA ${G.toFixed(1)} G`, 10, 20, { color: G > 4 ? RED : G > 2.5 ? AMBER : FG, size: 18 });
      // Brazo que gira.
      const cx = 110, cy = 165, a = t * (1 + G);
      ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, 7); ctx.stroke();
      ctx.strokeStyle = DIM; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 78, cy + Math.sin(a) * 78); ctx.stroke();
      ctx.strokeStyle = FG; ctx.strokeRect(cx + Math.cos(a) * 78 - 8, cy + Math.sin(a) * 78 - 8, 16, 16);
      // Medidor vertical: arriba = demasiado tenso, abajo = se nubla la vista.
      const mx = 270, top = 50, hgt = 220;
      ctx.strokeStyle = DIM; ctx.strokeRect(mx, top, 40, hgt);
      ctx.fillStyle = 'rgba(77,255,136,.18)'; ctx.fillRect(mx, top + (1 - hi) * hgt, 40, (hi - lo) * hgt);
      const ny = top + (1 - p) * hgt, ok = p >= lo && p <= hi;
      ctx.fillStyle = ok ? FG : RED; ctx.fillRect(mx - 8, ny - 3, 56, 6);
      text(ctx, 'MUY TENSO', mx + 48, top + 10, { size: 15, color: DIM });
      text(ctx, 'VISTA GRIS', mx + 48, top + hgt, { size: 15, color: DIM });
      text(ctx, `EN ZONA ${Math.round(100 * inZone / Math.max(t, 0.01))} %`, 10, H - 10, { color: ok ? FG : AMBER });
      // Visión que se nubla.
      if (p < lo) { ctx.fillStyle = `rgba(40,40,40,${(lo - p) * 1.4})`; ctx.fillRect(0, 0, W, H); }
    },
    score() { return inZone / seconds; },
    hint: 'Mantén apretado TENSAR (o espacio) para subir la aguja. Suelta para que baje.',
  };
}

function rover({ kids }) {
  const total = 3, delay = kids ? 2 : 4, CELL = 44, OX = (W - ROVER_COLS * CELL) / 2, OY = 40;
  const ARROW = { F: '↑', L: '⟲', R: '⟳' };
  let lv = roverLevel(Math.random, 0), got = 0, prog = '', phase = 'plan', timer = 0, run = null, shown = 0, msg = '', msgT = 0, sends = 0;
  const pos = () => (run ? run.path[Math.min(shown, run.path.length - 1)] : lv.rover);
  return {
    controls: [['↑ AVANZAR', 'F', true], ['GIRA IZQ.', 'L', true], ['GIRA DER.', 'R', true], ['BORRAR', 'del', true], ['ENVIAR', 'send', true]],
    step(dt, inp) {
      msgT = Math.max(0, msgT - dt);
      if (phase === 'plan') {
        for (const [k, c] of [['F', 'F'], ['L', 'L'], ['R', 'R']]) if (inp[k]) { inp[k] = false; if (prog.length < 20) { prog += c; beep(700, 25); } }
        if (inp.del) { inp.del = false; prog = prog.slice(0, -1); beep(300, 25); }
        if (inp.send && prog) { inp.send = false; phase = 'signal'; timer = delay; sends++; beep(1200, 60, 'sine'); }
        inp.send = false;
      } else if (phase === 'signal') {
        timer -= dt;
        if (timer <= 0) { run = runRover(lv, prog); shown = 0; timer = 0; phase = 'drive'; }
      } else if (phase === 'drive') {
        timer -= dt;
        if (timer <= 0) {
          timer = 0.35; shown++;
          if (shown >= run.path.length) {
            const at = run.at;
            if (run.reached) { got++; clunk(); msg = '¡MUESTRA TOMADA!'; lv = roverLevel(Math.random, got); if (got >= total) this.done = true; }
            else { msg = run.crashed ? '¡CHOCÓ! Se detuvo antes.' : 'No llegó. Sigue desde ahí.'; if (run.crashed) alarm('aviso'); else beep(330, 80); lv = { ...lv, rover: at }; }
            msgT = 1.8; run = null; prog = ''; phase = 'plan';
          }
        }
        for (const k of ['F', 'L', 'R', 'del', 'send']) inp[k] = false;
      }
    },
    draw(ctx) {
      text(ctx, `MUESTRAS ${got} / ${total}`, 10, 22);
      text(ctx, phase === 'signal' ? `SEÑAL VIAJANDO… ${timer.toFixed(1)} s` : phase === 'drive' ? 'EL ROVER SE MUEVE' : 'ARMA EL PLAN', W - 10, 22, { align: 'right', color: phase === 'plan' ? FG : AMBER });
      if (phase === 'signal') { const f = 1 - timer / delay; ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(20 + f * (W - 40), 32, 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      for (let x = 0; x <= ROVER_COLS; x++) { ctx.beginPath(); ctx.moveTo(OX + x * CELL, OY); ctx.lineTo(OX + x * CELL, OY + ROVER_ROWS * CELL); ctx.stroke(); }
      for (let y = 0; y <= ROVER_ROWS; y++) { ctx.beginPath(); ctx.moveTo(OX, OY + y * CELL); ctx.lineTo(OX + ROVER_COLS * CELL, OY + y * CELL); ctx.stroke(); }
      const c = (p) => [OX + p.x * CELL + CELL / 2, OY + p.y * CELL + CELL / 2];
      ctx.fillStyle = '#8a3b22'; for (const r of lv.rocks) { const [x, y] = c(r); ctx.beginPath(); ctx.arc(x, y, CELL * 0.36, 0, 7); ctx.fill(); }
      { const [x, y] = c(lv.sample); ctx.strokeStyle = AMBER; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.stroke(); }
      if (kids && phase === 'plan' && prog) { // los niños ven el camino planeado
        const pr = runRover(lv, prog); ctx.strokeStyle = pr.crashed ? RED : DIM; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath();
        pr.path.forEach((p, i) => { const [x, y] = c(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
      }
      const p = pos(), [x, y] = c(p), a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][p.dir];
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = FG; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.stroke(); ctx.restore();
      text(ctx, `PLAN: ${prog.split('').map((q) => ARROW[q]).join(' ') || '(vacío)'}`, 10, H - 12, { size: 17, color: prog ? FG : DIM });
      if (msgT) text(ctx, msg, W / 2, OY + ROVER_ROWS * CELL / 2, { align: 'center', size: 26, color: /MUESTRA/.test(msg) ? FG : RED });
    },
    score() { return got / total; },
    hint: `Pon las órdenes y toca ENVIAR. La señal tarda ${delay} s (en la vida real, hasta 24 minutos).`,
  };
}

const GAMES = { flotar, acople, brazo, luna, centrifuga, rover };

/** Abre la prueba `id`. Resuelve { stars, score } al terminar, o null si se cierra antes de empezar. */
export function runTraining(id, { kids = false, intro = '' } = {}) {
  const def = TRAININGS[id];
  const seconds = def.seconds + (kids ? 5 : 0);
  return new Promise((resolve) => {
    const box = h('div', { class: 'academia' });
    const close = modal(box);
    const finish = (res) => { cleanup(); close(); resolve(res); };
    let raf = 0, keyDown = null, keyUp = null;
    const cleanup = () => { cancelAnimationFrame(raf); if (keyDown) { document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); } };

    const introView = () => box.replaceChildren(
      h('h2', {}, `${def.icon} ENTRENAMIENTO: ${def.name.toUpperCase()}`),
      ...(intro ? [h('p', { class: 'dim' }, intro)] : []),
      h('p', { class: 'acad-meta' }, def.goal),
      h('p', { class: 'small dim' }, `Dura ${seconds} segundos. ${def.fact}`),
      h('div', { class: 'acad-botones' },
        h('button', { class: 'big', id: 'acad-empezar', onclick: play }, '▶ EMPEZAR'),
        h('button', { id: 'acad-saltar', onclick: () => finish(null) }, 'Saltar')));

    function play() {
      const g = GAMES[id]({ kids, seconds });
      const input = {};
      const canvas = h('canvas', { class: 'acad-canvas', width: W * 2, height: H * 2 });
      const ctx = canvas.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      const timeEl = h('b', {}, '');
      const ctrl = (g.controls ?? []).map(([label, key, once]) => {
        const on = (e) => { e.preventDefault(); input[key] = true; };
        const off = () => { if (!once) input[key] = false; };
        return h('button', { class: 'big acad-ctrl', 'data-ctrl': key, onpointerdown: on, onpointerup: off, onpointerleave: off, onpointercancel: off, oncontextmenu: (e) => e.preventDefault() }, label);
      });
      const KEYS = { ArrowLeft: ['left', 'L'], a: ['left', 'L'], ArrowRight: ['right', 'R'], d: ['right', 'R'], ArrowUp: ['up', 'F'], w: ['up', 'F'], ArrowDown: 'down', s: 'down', ' ': ['grab', 'jump', 'strain'], Enter: ['grab', 'jump', 'strain', 'send'], Backspace: ['del'] };
      keyDown = (e) => { const k = KEYS[e.key]; if (!k) return; e.preventDefault(); if (e.repeat && !Array.isArray(k)) return; [].concat(k).forEach((q) => { if (!(e.repeat && q !== 'strain')) input[q] = true; }); };
      keyUp = (e) => { const k = KEYS[e.key]; if (!k) return; [].concat(k).forEach((q) => { if (!['grab', 'jump', 'send', 'del', 'F', 'L', 'R'].includes(q)) input[q] = false; }); };
      document.addEventListener('keydown', keyDown); document.addEventListener('keyup', keyUp);
      if (g.tap) canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); g.tap((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height); });

      box.replaceChildren(
        h('div', { class: 'acad-top' }, h('span', {}, `${def.icon} ${def.name}`), timeEl),
        canvas,
        h('p', { class: 'small dim acad-hint' }, g.hint),
        ...(ctrl.length ? [h('div', { class: `acad-ctrls n${ctrl.length}` }, ...ctrl)] : []));

      let left = seconds, last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        left -= dt;
        g.step(dt, input);
        if (id !== 'rover') input.F = input.L = input.R = false;
        ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
        g.draw(ctx);
        timeEl.textContent = `${Math.max(0, Math.ceil(left))} s`;
        if (g.done || left <= 0) { result(g.score()); return; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    function result(score) {
      cleanup();
      const stars = starsFrom(score);
      beep(stars >= 2 ? 990 : 330, 160, 'sine');
      box.replaceChildren(
        h('h2', {}, `${def.icon} ${def.name.toUpperCase()}`),
        h('div', { class: 'acad-estrellas', 'data-estrellas': stars }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
        h('p', { class: 'acad-meta' }, stars === 3 ? '¡Perfecto! Listo para la misión.' : stars === 2 ? '¡Muy bien! Aprobado.' : stars === 1 ? 'Casi. Con práctica sale.' : 'No salió esta vez. ¡Inténtalo otra vez!'),
        h('p', { class: 'small dim' }, def.fact),
        h('div', { class: 'acad-botones' },
          h('button', { class: 'big', id: 'acad-seguir', onclick: () => finish({ stars, score }) }, 'SEGUIR'),
          h('button', { id: 'acad-otra', onclick: () => play() }, 'Otra vez')));
    }

    introView();
  });
}
