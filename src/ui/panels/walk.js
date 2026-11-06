// Recorrido de la base: un astronauta que se mueve por el pasillo con A/D o flechas y repara a mano.
// Idea del juego "V · Mission Control" del equipo, redibujada como pantalla de consola.
import { h, bar } from '../dom.js';
import { MOD_CODE } from '../art.js';
import { MODULES } from '../../data/catalog.js';
import { repairPuzzle, applyFieldRepair, fieldRepairBlock, FIELD_REPAIRS_PER_DAY } from '../../core/repairs.js';
import { beep } from '../audio.js';

const view = { pos: 0, open: false, answer: null, picked: [], seq: [], msg: '' };

export function walkPanel(app, commit, redraw, setKey) {
  const s = app.state;
  const mods = s.modules.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  view.pos = Math.min(view.pos, mods.length - 1);
  const here = mods[view.pos];
  const done = s.fieldRepairs?.day === s.day ? s.fieldRepairs.count : 0;
  const reset = () => { view.answer = null; view.picked = []; view.seq = []; };
  const step = (d) => { view.pos = Math.max(0, Math.min(mods.length - 1, view.pos + d)); view.open = false; view.msg = ''; reset(); beep(500, 15); redraw(); };
  const tryOpen = () => { const b = fieldRepairBlock(app.state, here.id); if (b) { view.msg = `No se puede: ${b}.`; beep(300, 60); } else { view.open = true; reset(); } redraw(); };
  const submit = (answer) => {
    const r = applyFieldRepair(app.state, here.id, answer);
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
      'data-tramo': m.id, onclick: () => { view.pos = i; view.open = false; view.msg = ''; reset(); redraw(); },
    }, h('div', { class: 'code' }, MOD_CODE[m.type]), bar(m.health / 100), h('div', { class: 'astro' }, i === view.pos ? '@' : ' '))));

  return h('div', { class: 'panel c-violet', id: 'recorrido' },
    h('h2', {}, 'RECORRIDO DE LA BASE'),
    h('div', { class: 'help' }, 'Camina con A / D o las flechas. En un módulo gastado o roto pulsa E para repararlo a mano: el procedimiento está en el panel, sin azar. ',
      `Reparaciones a mano hoy: ${done}/${FIELD_REPAIRS_PER_DAY}. Cada una usa 1 pieza.`),
    corridor,
    h('div', { class: 'row' },
      h('button', { onclick: () => step(-1) }, '< A'),
      h('div', { class: 'grow' }, h('b', {}, `${MOD_CODE[here.type]} · ${MODULES[here.type].name}`), ` · ${Math.round(here.health)} %`, here.on ? '' : ' · APAGADO'),
      h('button', { onclick: () => step(1) }, 'D >'),
      h('button', { id: 'reparar-aqui', class: 'warn', disabled: view.open, onclick: tryOpen }, '[E] REPARAR')),
    view.msg ? h('div', { class: `small ${/No se puede|no quedó/.test(view.msg) ? 'red' : 'green'}` }, view.msg) : null,
    view.open ? puzzleView(repairPuzzle(app.state, here.id), submit, redraw) : null);
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
      } }, out ? 'x' : sick ? '*' : '♣', h('small', {}, ` ${i + 1}`));
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
