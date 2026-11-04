import { h, mount } from '../dom.js';
import { load } from '../../core/save.js';
import { makePlayers, PLAYER_ROLES, updateBar } from '../main.js';
import { DIFFICULTY } from '../../data/catalog.js';
import { beep } from '../audio.js';

const MODES = {
  campana: { name: 'Campaña', desc: 'Misiones en orden. En esta versión: la estación espacial.' },
  libre: { name: 'Libre', desc: 'Eliges dificultad y presupuesto (±50 %).' },
  demo: { name: 'Demo', desc: 'Estación en fácil, con más avisos y eventos. Una partida en ~10 min.' },
};

export function render(root, app, go) {
  const saved = load();
  const names = app.players.map((p) => p.name);

  const draw = () => {
    mount(root, 
      h('div', { style: { textAlign: 'center', margin: '1.5rem 0' } },
        h('h1', {}, 'VENTANA DE LANZAMIENTO'),
        h('div', { class: 'dim' }, 'Diseña la misión, lanza, sobrevive un año en órbita y vuelve a casa.')),
      saved ? h('div', { class: 'panel', style: { textAlign: 'center' } },
        h('button', { class: 'big', id: 'continuar', onclick: () => { app.state = saved; app.difficulty = saved.difficulty; app.mode = saved.mode ?? app.mode; go(saved.phase === 'reentry' ? 'reentry' : 'ops'); } },
          `CONTINUAR · DÍA ${saved.day}`)) : null,
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' },
          h('h2', {}, 'Modo'),
          ...Object.entries(MODES).map(([id, m]) => h('div', { class: 'row', style: { margin: '.3rem 0' } },
            h('button', { class: app.mode === id ? 'sel' : '', 'data-mode': id, onclick: () => { app.mode = id; if (id === 'demo') app.difficulty = 'facil'; beep(700, 40); draw(); } }, m.name),
            h('span', { class: 'small dim' }, m.desc))),
          h('div', { class: 'small', style: { marginTop: '.5rem' } },
            h('span', { class: 'tag' }, 'Luna · Próximamente'), ' ', h('span', { class: 'tag' }, 'Marte · Próximamente')),
          h('h2', { style: { marginTop: '1rem' } }, 'Dificultad'),
          h('div', { class: 'row' }, ...Object.values(DIFFICULTY).map((d) =>
            h('button', { class: app.difficulty === d.id ? 'sel' : '', disabled: app.mode === 'demo' && d.id !== 'facil', 'data-dif': d.id, onclick: () => { app.difficulty = d.id; draw(); } }, d.name))),
          h('div', { class: 'small dim' }, `Presupuesto ${DIFFICULTY[app.difficulty].budget * (app.mode === 'libre' ? app.budgetMult : 1)} M · despegue ${DIFFICULTY[app.difficulty].launchMode}`),
          app.mode === 'libre' ? h('div', { class: 'row', style: { marginTop: '.4rem' } }, 'Presupuesto',
            h('input', { type: 'range', min: 50, max: 150, step: 10, value: app.budgetMult * 100, oninput: (e) => { app.budgetMult = e.target.value / 100; draw(); } }),
            `${Math.round(app.budgetMult * 100)} %`) : null),
        h('div', { class: 'panel' },
          h('h2', {}, 'Jugadores (cooperativo local)'),
          h('div', { class: 'row' }, ...[1, 2, 3, 4].map((n) =>
            h('button', { class: app.players.length === n ? 'sel' : '', 'data-players': n, onclick: () => { app.players = makePlayers(n, names); updateBar(); draw(); } }, String(n)))),
          h('table', { id: 'roles', style: { marginTop: '.5rem' } },
            ...app.players.map((p, i) => h('tr', {},
              h('td', {}, h('input', { value: p.name, size: 12, oninput: (e) => { p.name = e.target.value; names[i] = e.target.value; updateBar(); } })),
              h('td', {}, p.roles.map((r) => PLAYER_ROLES[r]).join(' + '))))),
          h('div', { class: 'small dim', style: { marginTop: '.4rem' } },
            'Ingeniería decide módulos, energía y reparaciones. Ciencia: instrumentos y experimentos. Comunicaciones: antena, datos y moral. Comandante: cohete, órbita, carga, lanzamiento y decisiones médicas.'))),
      h('div', { style: { textAlign: 'center', margin: '1rem 0' } },
        h('button', { class: 'big', id: 'nueva', onclick: () => { app.state = null; app.lastDesign = null; app.lastSeed = null; if (app.mode !== 'libre') app.budgetMult = 1; beep(990, 80); go('design'); } }, 'NUEVA MISIÓN')),
      h('div', { class: 'small dim', style: { textAlign: 'center' } },
        'Agencia ficticia. Inspirado en procedimientos y datos abiertos de NASA. Hecho para NASA Space Apps 2026 · desafío Space Mission Design Game.'),
    );
  };
  draw();
}
