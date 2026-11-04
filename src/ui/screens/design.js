// Pantalla de diseño: cuadrícula de módulos, instrumentos, cohete, órbita, carga y tripulación.
import { h, mount, bar, modal, fmt } from '../dom.js';
import { MODULES, INSTRUMENTS, LAUNCHERS, ORBITS, GRID, DIFFICULTY } from '../../data/catalog.js';
import { ROLES } from '../../data/crew.js';
import { LESSONS } from '../../data/lessons.js';
import { computeDesign, canLaunch } from '../../core/design.js';
import { createMission } from '../../core/mission.js';
import { fetchFlares, flaresToStorms } from '../../core/realdata.js';
import { whoDecides } from '../main.js';
import { beep, alarm } from '../audio.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });

export const SUGGESTED = () => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0),
    mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1)],
  instruments: ['camara_tierra', 'espectrometro'],
  launcher: 'condorH', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90,
});

const EMPTY = () => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0)], instruments: [], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero'], cargoDays: 90,
});

const STORMS_PER_DIFF = { facil: 2, medio: 4, dificil: 7 };

function pickStorms(flares, difficulty) {
  const all = flaresToStorms(flares, difficulty).filter((s) => s.day > 10 && s.day < 360);
  const n = Math.min(STORMS_PER_DIFF[difficulty], all.length);
  return Array.from({ length: n }, (_, i) => all[Math.floor((i + 0.5) * all.length / n)]);
}

function lessonCard(id) {
  const l = LESSONS[id];
  const close = modal(h('div', {},
    h('h2', {}, l.title),
    h('p', {}, h('span', { class: 'amber' }, 'En el espacio: '), l.space),
    h('p', {}, h('span', { class: 'amber' }, 'En la Tierra: '), l.earth),
    h('button', { onclick: () => close() }, 'Cerrar')));
}

export function render(root, app, go, params = {}) {
  const d = structuredClone(params.design ?? app.lastDesign ?? (app.mode === 'demo' ? SUGGESTED() : EMPTY()));
  for (const m of d.modules) { delete m.health; delete m.on; delete m.priority; delete m.offDays; }
  let selected = 'paneles';
  let launching = false;
  const flares = fetchFlares();
  const budgetMult = app.mode === 'libre' ? app.budgetMult : 1;
  const who = (role) => { const n = whoDecides(app, role); return n ? h('span', { class: 'tag' }, `decide ${n}`) : null; };

  const place = (x, y) => {
    const at = d.modules.findIndex((m) => m.x === x && m.y === y);
    if (at >= 0) d.modules.splice(at, 1);
    d.modules.push(mod(selected, x, y));
    beep(620, 40); draw();
  };
  const remove = (x, y) => { d.modules = d.modules.filter((m) => !(m.x === x && m.y === y)); beep(300, 40); draw(); };

  async function launch() {
    const r = computeDesign(d, 'estacion', app.difficulty, budgetMult);
    if (!canLaunch(r) || launching) return;
    launching = true; draw();
    const seed = app.lastSeed ?? Math.floor(Math.random() * 2 ** 31);
    const f = await flares;
    const state = createMission({ design: structuredClone(d), scenarioId: 'estacion', difficulty: app.difficulty, seed });
    state.mode = app.mode;
    state.realStorms = pickStorms(f.flares, app.difficulty);
    state.flareSource = f.source;
    app.lastDesign = structuredClone(d);
    app.lastSeed = seed;
    app.state = state;
    go('launch');
  }

  const draw = () => {
    const r = computeDesign(d, 'estacion', app.difficulty, budgetMult);
    const ok = canLaunch(r);
    const cell = (x, y) => {
      const m = d.modules.find((q) => q.x === x && q.y === y);
      return h('div', {
        class: `cell ${m ? 'full' : ''}`, 'data-x': x, 'data-y': y, title: m ? 'Clic derecho: quitar' : 'Clic: colocar',
        onclick: () => place(x, y), oncontextmenu: (e) => { e.preventDefault(); if (m) remove(x, y); },
      }, m ? [h('b', {}, MODULES[m.type].name), h('div', { class: 'dim' }, `${MODULES[m.type].kw > 0 ? '+' : ''}${MODULES[m.type].kw} kW`)] : h('span', { class: 'muted' }, '+'));
    };
    const row = (label, frac, text, lesson, opts) => h('div', { class: 'res' },
      h('span', {}, label), bar(frac, opts),
      h('span', { class: 'small' }, text, ' ', lesson ? h('button', { class: 'small', style: { padding: '0 .3rem' }, title: 'Explicar', onclick: () => lessonCard(lesson) }, '?') : null));

    const instrSlots = d.modules.filter((m) => m.type === 'laboratorio').length * 3;
    mount(root, 
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h1', { style: { fontSize: '1.6rem' } }, 'Diseño de la misión · Estación espacial'),
        h('div', { class: 'row' },
          h('button', { onclick: () => { Object.assign(d, SUGGESTED()); draw(); } }, 'Cargar diseño sugerido'),
          h('button', { onclick: () => go('title') }, 'Menú'))),
      h('div', { class: 'grid3' },
        h('div', {},
          h('div', { class: 'panel' },
            h('h2', {}, 'Módulos ', who('ingeniero')),
            h('div', { class: 'small dim' }, 'Elige uno y haz clic en la cuadrícula.'),
            h('ul', { class: 'plain', id: 'catalogo' }, ...Object.values(MODULES).map((m) => h('li', {},
              h('button', { class: selected === m.id ? 'sel' : '', 'data-mod': m.id, style: { width: '100%', textAlign: 'left' }, onclick: () => { selected = m.id; draw(); } },
                `${m.name}`, h('span', { class: 'dim small' }, ` ${m.mass} t · ${m.kw > 0 ? '+' : ''}${m.kw} kW · ${m.cost} M${m.required ? ' · obligatorio' : ''}`)))))),
        ),
        h('div', {},
          h('div', { class: 'panel' },
            h('h2', {}, 'Nave ', who('ingeniero')),
            h('div', { class: 'ship', id: 'nave', style: { gridTemplateColumns: `repeat(${GRID.cols}, 1fr)` } },
              ...Array.from({ length: GRID.rows }, (_, y) => Array.from({ length: GRID.cols }, (_, x) => cell(x, y))))),
          h('div', { class: 'panel' },
            h('h2', {}, 'Tablero'),
            row('Masa', r.capacity ? r.mass / r.capacity : 1, `${fmt(r.mass, 1)} / ${fmt(r.capacity, 1)} t`, null, { invert: true, warn: 0.15, danger: 0.0001 }),
            row('Presupuesto', r.cost / r.budget, `${fmt(r.cost)} / ${fmt(r.budget)} M`, null, { invert: true, warn: 0.1, danger: 0.0001 }),
            row('Energía/día', Math.max(0, Math.min(1, 0.5 + r.energyPerDay / 400)), `${fmt(r.energyPerDay)} kWh`, 'paneles_solares', { warn: 0.55, danger: 0.5 }),
            row('Datos/enlace', r.downlinkPerDay ? r.dataPerDay / r.downlinkPerDay : (r.dataPerDay ? 2 : 0), `${fmt(r.dataPerDay)} / ${fmt(r.downlinkPerDay)} GB`, 'satelites_clima', { invert: true, warn: 0.2, danger: 0.0001 }),
            row('Ciencia/día', Math.min(1, r.sciencePerDay / 20), `${fmt(r.sciencePerDay)} pts`, null, { warn: 0, danger: 0 }),
            row('Carga', d.cargoDays / Math.max(1, r.cargoMax), `${d.cargoDays} / ${r.cargoMax} días`, 'racionamiento', { invert: true, warn: 0.1, danger: 0.0001 }),
            h('ul', { class: 'plain', id: 'errores' },
              ...r.errors.map((e) => h('li', { class: 'red' }, '✖ ', e)),
              ...r.warnings.map((w) => h('li', { class: 'amber' }, '⚠ ', w))),
            h('div', { style: { textAlign: 'center', marginTop: '.6rem' } },
              h('button', { class: 'big', id: 'lanzar', disabled: !ok || launching, onclick: launch }, launching ? 'CONSULTANDO CLIMA ESPACIAL…' : 'LANZAR'),
              ' ', who('comandante')))),
        h('div', {},
          h('div', { class: 'panel' },
            h('h2', {}, 'Instrumentos ', who('cientifico')),
            h('div', { class: 'small dim' }, `Van en el laboratorio: ${d.instruments.length}/${instrSlots} ranuras.`),
            ...Object.values(INSTRUMENTS).map((i) => h('label', { class: 'row small', style: { margin: '.2rem 0' } },
              h('input', { type: 'checkbox', 'data-ins': i.id, checked: d.instruments.includes(i.id), onchange: (e) => { d.instruments = e.target.checked ? [...d.instruments, i.id] : d.instruments.filter((x) => x !== i.id); draw(); } }),
              `${i.name}`, h('span', { class: 'dim' }, `${i.sciencePerDay} pts · ${i.dataPerDay} GB · ${i.cost} M`)))),
          h('div', { class: 'panel' },
            h('h2', {}, 'Cohete ', who('comandante')),
            ...Object.values(LAUNCHERS).map((l) => h('label', { class: 'row small' },
              h('input', { type: 'radio', name: 'cohete', 'data-launcher': l.id, checked: d.launcher === l.id, onchange: () => { d.launcher = l.id; draw(); } }),
              l.name, h('span', { class: 'dim' }, `${l.capacity} t · ${l.cost} M · fiabilidad ${Math.round(l.reliability * 100)} %`))),
            h('h2', { style: { marginTop: '.6rem' } }, 'Órbita ', who('comandante')),
            ...Object.values(ORBITS).map((o) => h('label', { class: 'row small' },
              h('input', { type: 'radio', name: 'orbita', 'data-orbit': o.id, checked: d.orbit === o.id, onchange: () => { d.orbit = o.id; draw(); } }),
              o.name, h('span', { class: 'dim' }, o.desc)))),
          h('div', { class: 'panel' },
            h('h2', {}, 'Carga y tripulación ', who('comandante')),
            h('div', { class: 'row small' }, 'Días de carga',
              h('input', { type: 'range', id: 'carga', min: 30, max: 365, step: 5, value: d.cargoDays, oninput: (e) => { d.cargoDays = Number(e.target.value); draw(); } }),
              `${d.cargoDays}`),
            h('div', { class: 'small dim' }, 'Llega una nave de carga cada 60 días (si no explota).'),
            h('div', { class: 'row small', style: { marginTop: '.3rem' } }, ...Object.values(ROLES).map((ro) =>
              h('button', { class: d.crewRoles.includes(ro.id) ? 'sel' : '', 'data-role': ro.id, onclick: () => {
                d.crewRoles = d.crewRoles.includes(ro.id) ? d.crewRoles.filter((x) => x !== ro.id) : [...d.crewRoles, ro.id];
                draw();
              } }, ro.name))),
            h('div', { class: 'small dim' }, `${d.crewRoles.length} tripulante(s). Dificultad ${DIFFICULTY[app.difficulty].name}.`))),
      ),
    );
    if (!ok && r.errors.length) document.getElementById('lanzar').title = r.errors.join('\n');
  };
  draw();
  void alarm;
}
