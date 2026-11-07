// Recorrido de la base: un astronauta que se mueve por el pasillo con A/D o flechas y repara a mano.
// Idea del juego "V · Mission Control" del equipo, redibujada como pantalla de consola.
import { h, bar } from '../dom.js';
import { MOD_CODE } from '../art.js';
import { MODULES } from '../../data/catalog.js';
import { repairPuzzle, applyFieldRepair, fieldRepairBlock, FIELD_REPAIRS_PER_DAY, faultOf, acceptsRegolith, regolithStock, REGOLITH_PATCH } from '../../core/repairs.js';
import { beep } from '../audio.js';

const view = { pos: 0, prev: 0, facing: 1, open: false, pay: 'parts', answer: null, picked: [], seq: [], msg: '' };

import { SPRITE } from '../sprite.js';

function walker(name) {
  const el = h('div', { class: 'caminante', id: 'caminante' }, h('div', { class: 'nombre code' }, name));
  const fig = document.createElement('div');
  fig.className = 'figura';
  fig.innerHTML = SPRITE;
  el.prepend(fig);
  return el;
}

export function walkPanel(app, commit, redraw, setKey) {
  const s = app.state;
  const mods = s.modules.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  view.pos = Math.min(view.pos, mods.length - 1);
  const here = mods[view.pos];
  const done = s.fieldRepairs?.day === s.day ? s.fieldRepairs.count : 0;
  const reset = () => { view.answer = null; view.picked = []; view.seq = []; };
  const step = (d) => { view.facing = d < 0 ? -1 : 1; view.pos = Math.max(0, Math.min(mods.length - 1, view.pos + d)); view.open = false; view.msg = ''; reset(); beep(500, 15); redraw(); };
  const tryOpen = (pay = 'parts') => { const b = fieldRepairBlock(app.state, here.id, pay); if (b) { view.msg = `No se puede: ${b}.`; beep(300, 60); } else { view.open = true; view.pay = pay; reset(); } redraw(); };
  const submit = (answer) => {
    const r = applyFieldRepair(app.state, here.id, answer, view.pay);
    view.msg = r.log.join(' ');
    if (r.ok) { commit(r.state); view.open = false; reset(); beep(1100, 120); } else { reset(); beep(300, 100); }
    redraw();
  };
  setKey((e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { e.preventDefault(); step(-1); }
    else if (k === 'd' || k === 'arrowright') { e.preventDefault(); step(1); }
    else if ((k === 'e' || k === 'enter') && !view.open) { e.preventDefault(); tryOpen(); }
  });

  const corridor = h('div', { class: 'pasillo', id: 'pasillo' },
    ...mods.map((m, i) => h('div', {
      class: `tramo ${i === view.pos ? 'aqui' : ''} ${m.health <= 0 ? 'roto' : m.health < 60 ? 'gastado' : ''} ${m.on ? '' : 'off'}`,
      'data-tramo': m.id, onclick: () => { if (i !== view.pos) view.facing = i < view.pos ? -1 : 1; view.pos = i; view.open = false; view.msg = ''; reset(); redraw(); },
    }, h('div', { class: 'code' }, MOD_CODE[m.type]), bar(m.health / 100), faultTag(s, m), h('div', { class: 'piso' }))));
  // Quien camina: el tripulante con más técnica que pueda trabajar.
  const tech = s.crew.filter((c) => c.alive && !c.evacuated).sort((a, b) => (b.stats?.tecnica ?? 0) - (a.stats?.tecnica ?? 0))[0];
  const who = walker(tech ? tech.name.split(' ')[0].toUpperCase() : 'EVA');
  corridor.append(who);
  const from = view.prev; const to = view.pos; view.prev = to;
  const place = (i) => { const t = corridor.children[i]; if (t) who.style.left = `${t.offsetLeft + t.offsetWidth / 2}px`; };
  who.style.setProperty('--dir', view.facing);
  requestAnimationFrame(() => {
    who.style.transition = 'none'; place(from);
    const ct = corridor.children[to]; if (ct) corridor.scrollLeft = Math.max(0, ct.offsetLeft - corridor.clientWidth / 2);
    requestAnimationFrame(() => {
      who.style.transition = '';
      if (from !== to) { who.classList.add('anda'); setTimeout(() => who.classList.remove('anda'), 120 + 260 * Math.abs(to - from)); who.style.transitionDuration = `${0.26 * Math.abs(to - from)}s`; }
      place(to);
    });
  });

  return h('div', { class: 'panel c-violet', id: 'recorrido' },
    h('h2', {}, 'RECORRIDO DE LA BASE'),
    h('div', { class: 'help' }, 'Camina con A / D o las flechas. En un módulo gastado o roto pulsa E para repararlo a mano: el procedimiento está en el panel, sin azar. ',
      `Reparaciones a mano hoy: ${done}/${FIELD_REPAIRS_PER_DAY}. Cada una usa 1 pieza`,
      s.dig ? ` o ${REGOLITH_PATCH} bloques de regolito (guardados: ${regolithStock(s)}; no sirve en equipos eléctricos ni de radio)` : '',
      '. Las averías marcadas con ! vienen de un evento: si no se arreglan a mano antes del plazo, empeoran.'),
    s.faults?.length ? h('div', { class: 'small red', id: 'averias' }, `AVERÍAS: ${s.faults.map((f) => { const m = s.modules.find((x) => x.id === f.moduleId); return `${MOD_CODE[m?.type] ?? '?'} ${daysLeft(s, f)}`; }).join(' · ')}`) : null,
    corridor,
    h('div', { class: 'row' },
      h('button', { onclick: () => step(-1) }, '< A'),
      h('div', { class: 'grow' }, h('b', {}, `${MOD_CODE[here.type]} · ${MODULES[here.type].name}`), ` · ${Math.round(here.health)} %`, here.on ? '' : ' · APAGADO'),
      h('button', { onclick: () => step(1) }, 'D >'),
      h('button', { id: 'reparar-aqui', class: 'warn', disabled: view.open, onclick: () => tryOpen('parts') }, '[E] REPARAR'),
      s.dig && acceptsRegolith(here.type) ? h('button', { id: 'parche-regolito', disabled: view.open, onclick: () => tryOpen('regolito') }, `PARCHE (${REGOLITH_PATCH} ░)`) : null),
    view.msg ? h('div', { class: `small ${/No se puede|no quedó/.test(view.msg) ? 'red' : 'green'}` }, view.msg) : null,
    view.open ? puzzleView(repairPuzzle(app.state, here.id), submit, redraw) : null);
}

const daysLeft = (s, f) => { const d = f.deadline - s.day; return d <= 0 ? 'vence hoy' : `${d} día${d === 1 ? '' : 's'}`; };
function faultTag(s, m) {
  const f = faultOf(s, m.id);
  return f ? h('div', { class: 'code red', title: `Avería: plazo ${daysLeft(s, f)}` }, `! ${Math.max(0, f.deadline - s.day)}d`) : null;
}

function puzzleView(p, submit, redraw) {
  const box = (...kids) => h('div', { class: 'consola-tarea', id: 'tarea' }, h('div', { class: 'code amber' }, `> ${p.title.toUpperCase()}`), h('p', {}, p.text), ...kids);
  if (p.kind === 'ajuste') {
    view.answer ??= p.start;
    const set = (d) => { view.answer = Math.max(p.min, Math.min(p.max, view.answer + d)); beep(600 + (view.answer - p.min) * 4, 20); redraw(); };
    return box(
      h('div', { class: 'lectura' }, h('b', { id: 'lectura' }, String(view.answer)), ` ${p.unit}`, h('span', { class: 'dim' }, `  objetivo ${p.target}`)),
      h('div', { class: 'row' }, h('button', { onclick: () => set(-p.step) }, `- ${p.step}`), h('button', { onclick: () => set(p.step) }, `+ ${p.step}`),
        h('button', { id: 'confirmar', class: 'big', onclick: () => submit(view.answer) }, 'CONFIRMAR')));
  }
  if (p.kind === 'plantas') {
    return box(h('div', { class: 'plantas' }, ...Array.from({ length: p.cells }, (_, i) => {
      const sick = p.sick.includes(i); const out = view.picked.includes(i);
      return h('button', { class: `planta ${out ? 'fuera' : ''}`, 'data-planta': i, disabled: out, onclick: () => {
        if (!sick) { view.picked = []; beep(300, 80); redraw(); return; }
        view.picked = [...view.picked, i]; beep(900, 30);
        if (view.picked.length === p.sick.length) submit(view.picked); else redraw();
      } }, out ? 'x' : sick ? '*' : 'ψ', h('small', {}, ` ${i + 1}`));
    })));
  }
  const options = [...p.steps].sort();
  return box(
    h('ol', { class: 'pasos' }, ...p.steps.map((st, i) => h('li', { class: i < view.seq.length ? 'green' : '' }, st))),
    h('div', { class: 'row' }, ...options.map((st) => h('button', { 'data-paso': st, onclick: () => {
      const next = [...view.seq, st];
      if (p.steps[next.length - 1] !== st) { view.seq = []; beep(300, 80); redraw(); return; }
      view.seq = next; beep(900, 30);
      if (next.length === p.steps.length) submit(next); else redraw();
    } }, st))));
}
