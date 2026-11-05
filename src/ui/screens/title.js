import { h, mount } from '../dom.js';
import { load } from '../../core/save.js';
import { makePlayers, PLAYER_ROLES, updateBar } from '../main.js';
import { DIFFICULTY, SCENARIOS } from '../../data/catalog.js';
import { loadCampaign } from '../../core/campaign.js';

export const PLAYABLE = ['estacion', 'luna', 'marte'];
const SCN_DESC = {
  estacion: 'Un año dando vueltas a la Tierra. Llega carga cada 60 días. La más fácil.',
  luna: 'Un año en la Luna: noches de hasta 14 días sin sol, polvo, sismos y hielo. Carga cada 120 días.',
  marte: '7 meses de viaje, 1 año allá y 7 de vuelta. Sin cargas: hay que fabricar combustible para volver.',
};
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar } from '../avatar.js';

const MODES = {
  campana: { icon: '🗺️', name: 'Campaña', desc: 'Estación → Luna → Marte. Cada misión cumplida abre la siguiente y da puntos para mejoras.' },
  libre: { icon: '🎛️', name: 'Libre', desc: 'Tú eliges la dificultad y cuánto dinero tienes.' },
  demo: { icon: '⚡', name: 'Demo', desc: 'Fácil y rápida, con muchas sorpresas. Unos 10 minutos.' },
};
const DIFF_DESC = {
  facil: 'Nadie muere: si alguien se enferma mucho, vuelve a la Tierra. Avisos con tiempo.',
  medio: 'Puede haber muertes. Te dicen qué opción conviene.',
  dificil: 'Avisos tardíos, más desastres y tú decides los abortos.',
};
const ROLE_DESC = {
  comandante: 'cohete, órbita, comida, lanzamiento y salud',
  comunicaciones: 'antena, datos y ánimo',
  ingeniero: 'módulos, electricidad y reparaciones',
  cientifico: 'instrumentos y experimentos',
};

const TOUR = [
  ['¡Hola! Soy Nova, de Control de Misión. Te voy a acompañar todo el viaje. 🚀', 'feliz'],
  ['Primero DISEÑAS tu nave: pones módulos como piezas de Lego, eliges cohete y cuánta comida llevar.', 'normal'],
  ['Después viene el DESPEGUE, como uno de verdad: cuenta regresiva, clima y todos dicen "GO".', 'normal'],
  ['Luego tu tripulación vive 1 AÑO en el espacio. Tú decides qué hace cada uno: dormir, comer, hacer ciencia, arreglar…', 'pensando'],
  ['Pasarán cosas buenas y malas. Yo te aviso antes y te señalo qué tocar con una flecha 👇.', 'alerta'],
  ['Al final vuelven a la Tierra y ves cómo te fue. ¡Ganas si al menos uno vuelve sano!', 'feliz'],
];

export function render(root, app, go) {
  const saved = load();
  const names = app.players.map((p) => p.name);
  let tour = -1;

  const nextTour = () => {
    tour += 1;
    if (tour >= TOUR.length) { tour = -1; say('¡Listo! Elige cómo jugar y toca NUEVA MISIÓN.', { mood: 'feliz', target: '#nueva' }); return; }
    const [t, mood] = TOUR[tour];
    say(t, { mood, buttons: [{ label: tour === TOUR.length - 1 ? '¡Entendido!' : 'Siguiente ▶', onclick: nextTour }] });
  };

  const draw = () => {
    const camp = loadCampaign();
    if (app.mode === 'campana' && !camp.unlocked.includes(app.scenario ?? 'estacion')) app.scenario = camp.unlocked.at(-1);
    mount(root,
      h('div', { style: { textAlign: 'center', margin: '1rem 0 1.5rem' } },
        h('div', { class: 'capsule', style: { marginBottom: '.4rem' } },
          ...['Ada Sol', 'Leo Mar', 'Iris Luz', 'Tomás Rey'].map((n, i) => crewAvatar({ name: n, role: ['comandante', 'piloto', 'ingeniero', 'medico'][i], alive: true, health: 100, morale: 90, fatigue: 0, radiation: 0, hunger: 0, thirst: 0 }, { size: 70 }))),
        h('h1', {}, 'VENTANA DE LANZAMIENTO'),
        h('div', { class: 'dim', style: { fontSize: '1.1rem' } }, '🛠️ Diseña tu nave · 🚀 Despega · 🛰️ Sobrevive un año en el espacio · 🌊 Vuelve a casa')),
      saved ? h('div', { class: 'panel c-green', style: { textAlign: 'center' } },
        h('button', { class: 'big', id: 'continuar', onclick: () => { app.state = saved; app.difficulty = saved.difficulty; app.mode = saved.mode ?? app.mode; go(saved.phase === 'reentry' ? 'reentry' : 'ops'); } },
          `▶ SEGUIR MI MISIÓN · DÍA ${saved.day}`)) : null,
      h('div', { class: 'grid2' },
        h('div', { class: 'panel c-blue' },
          h('h2', {}, '1. ¿Cómo quieres jugar?'),
          ...Object.entries(MODES).map(([id, m]) => h('div', { class: 'row', style: { margin: '.35rem 0' } },
            h('button', { class: app.mode === id ? 'sel' : '', 'data-mode': id, onclick: () => { app.mode = id; if (id === 'demo') app.difficulty = 'facil'; beep(700, 40); draw(); say(`${m.icon} ${m.name}: ${m.desc}`, { quiet: true, target: '#nueva' }); } }, `${m.icon} ${m.name}`),
            h('span', { class: 'small dim' }, m.desc))),
          h('h2', { style: { marginTop: '1rem' } }, '¿A dónde vamos?'),
          h('div', { class: 'row' }, ...Object.values(SCENARIOS).map((sc) => {
            const ok = PLAYABLE.includes(sc.id) && (app.mode !== 'campana' || camp.unlocked.includes(sc.id));
            return h('button', { class: (app.scenario ?? 'estacion') === sc.id ? 'sel' : '', disabled: !ok, 'data-scn': sc.id,
              onclick: () => { app.scenario = sc.id; beep(820, 40); draw(); say(`${sc.icon} ${sc.short}: ${SCN_DESC[sc.id]}`, { quiet: true, target: '#nueva' }); } },
            `${sc.icon} ${sc.short}${ok ? '' : app.mode === 'campana' ? ' 🔒' : ' · pronto'}`);
          })),
          h('div', { class: 'small dim' }, SCN_DESC[app.scenario ?? 'estacion']),
          app.mode === 'campana' ? h('div', { class: 'row', style: { marginTop: '.4rem' } },
            h('span', { class: 'pill amber' }, `⭐ ${camp.points} puntos · ${camp.upgrades.length} mejora(s)`),
            h('button', { id: 'mejoras', onclick: () => go('arbol') }, '🌳 Árbol de mejoras')) : null,
          h('h2', { style: { marginTop: '1rem' } }, '2. ¿Qué tan difícil?'),
          h('div', { class: 'row' }, ...Object.values(DIFFICULTY).map((d) =>
            h('button', { class: app.difficulty === d.id ? 'sel' : '', disabled: app.mode === 'demo' && d.id !== 'facil', 'data-dif': d.id,
              onclick: () => { app.difficulty = d.id; draw(); say(`${d.name}: ${DIFF_DESC[d.id]}`, { quiet: true, mood: d.id === 'dificil' ? 'alerta' : 'normal' }); } },
            { facil: '🟢 ', medio: '🟠 ', dificil: '🔴 ' }[d.id] + d.name))),
          h('div', { class: 'small dim' }, DIFF_DESC[app.difficulty]),
          h('div', { class: 'small' }, `💰 Dinero para la nave: ${Math.round(DIFFICULTY[app.difficulty].budget * (app.mode === 'libre' ? app.budgetMult : 1))} millones`),
          app.mode === 'libre' ? h('div', { class: 'row', style: { marginTop: '.4rem' } }, 'Más o menos dinero',
            h('input', { type: 'range', min: 50, max: 150, step: 10, value: app.budgetMult * 100, oninput: (e) => { app.budgetMult = e.target.value / 100; draw(); } }),
            `${Math.round(app.budgetMult * 100)} %`) : null),
        h('div', { class: 'panel c-pink' },
          h('h2', {}, '3. ¿Cuántos juegan en esta compu?'),
          h('div', { class: 'row' }, ...[1, 2, 3, 4].map((n) =>
            h('button', { class: app.players.length === n ? 'sel' : '', 'data-players': n, onclick: () => {
              app.players = makePlayers(n, names); updateBar(); draw();
              say(n === 1 ? 'Tú solo decides todo. ¡Eres el jefe de toda la misión!' : `Cada uno tiene un trabajo. Cuando haya que decidir algo, aparecerá el nombre de quien decide.`, { quiet: true, target: '#roles' });
            } }, '🧑‍🚀'.repeat(n)))),
          h('table', { id: 'roles', style: { marginTop: '.5rem' } },
            ...app.players.map((p, i) => h('tr', {},
              h('td', {}, h('input', { value: p.name, size: 12, oninput: (e) => { p.name = e.target.value; names[i] = e.target.value; updateBar(); } })),
              h('td', {}, p.roles.map((r) => h('div', { class: 'small' }, h('b', {}, PLAYER_ROLES[r]), h('span', { class: 'dim' }, `: ${ROLE_DESC[r]}`))))))))),
      h('div', { style: { textAlign: 'center', margin: '1.2rem 0' } },
        h('button', { class: 'big', id: 'nueva', onclick: () => { app.state = null; app.lastDesign = null; app.lastSeed = null; if (app.mode !== 'libre') app.budgetMult = 1; beep(990, 80); go('design'); } }, '🚀 NUEVA MISIÓN'),
        ' ', h('button', { id: 'como', onclick: () => { tour = -1; nextTour(); } }, '❓ ¿Cómo se juega?')),
      h('div', { class: 'small dim', style: { textAlign: 'center' } },
        'Agencia ficticia. Inspirado en procedimientos y datos abiertos de NASA. Hecho para NASA Space Apps 2026 · desafío Space Mission Design Game.'),
    );
  };
  draw();
  say(saved ? `¡Hola otra vez! Tu misión va en el día ${saved.day}. Toca SEGUIR para continuar.` : '¡Hola! Soy Nova, de Control de Misión. ¿Primera vez? Toca "¿Cómo se juega?" y te explico.',
    { mood: 'feliz', target: saved ? '#continuar' : '#como', buttons: saved ? [] : [{ label: 'Explícame', onclick: () => { tour = -1; nextTour(); } }] });
}
