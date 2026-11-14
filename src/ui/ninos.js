// VERSIÓN NIÑOS: todo se entiende de una. Barra fija con los 4 pasos del juego + "AHORA:" (qué tocar),
// e inicio con un solo botón. El juego por dentro es el mismo; aquí solo cambia cómo se muestra.
import { runTraining, academyRecord, saveAcademy } from './academy.js';
import { TRAININGS, ACADEMY_ORDER, hasWings } from '../core/academy.js';
import { h, mount } from './dom.js';
import { tr } from '../i18n/i18n.js';
import { say } from './guide.js';
import { beep } from './audio.js';
import { load } from '../core/save.js';
import { crewAvatar } from './avatar.js';
import { SUGGESTED } from './screens/design.js';
import { openArcade } from './arcade.js';
import { openCenter, markPlayed, checkRankUp } from './cadete.js';

export const STEPS = [
  ['ARMA LA NAVE', 'design'],
  ['DESPEGA', 'launch'],
  ['VIVE EN EL ESPACIO', 'ops'],
  ['VUELVE A CASA', 'reentry'],
];
const STEP_OF = { title: -1, design: 0, launch: 1, ops: 2, reentry: 3, report: 4 };
const NOW_DEFAULT = {
  title: 'Entrena en la ACADEMIA y luego toca MISIÓN.',
  design: 'Tu nave ya está lista. Toca el botón LANZAR.',
  launch: 'Mira cómo despega. Si te preguntan, toca CONTINUAR o GO.',
  ops: 'Toca AVANZAR para que pase el tiempo. Cuida que no falte nada.',
  reentry: 'Están volviendo a la Tierra. Toca los botones que te pida Nova.',
  report: '¡Llegaron! Mira cuántas estrellas ganaste.',
};

let bar = null;
let nowEl = null;

/** Pone la barra de pasos para la pantalla actual. */
export function stepBar(screen) {
  if (!bar) {
    bar = h('div', { id: 'pasos-ninos' });
    document.getElementById('barra').after(bar);
  }
  const cur = STEP_OF[screen] ?? -1;
  nowEl = h('div', { class: 'ahora', id: 'ahora' }, h('b', {}, 'AHORA: '), h('span', {}, NOW_DEFAULT[screen] ?? ''));
  bar.replaceChildren(
    h('ol', { class: 'pasos' }, ...STEPS.map(([name], i) => h('li', { class: i < cur ? 'hecho' : i === cur ? 'actual' : '' },
      h('span', { class: 'num' }, i < cur ? '✓' : String(i + 1)), h('span', { class: 'txt' }, ` ${name}`)))),
    nowEl);
}

/** Cambia la línea "AHORA:" (qué tiene que hacer el niño en este momento). */
export function setNow(text, urgent = false) {
  if (!nowEl) return;
  nowEl.className = `ahora ${urgent ? 'urgente' : ''}`;
  nowEl.lastChild.textContent = tr(text);
}

const PLACES = [
  { id: 'estacion', name: 'ESTACIÓN ESPACIAL', level: 'FÁCIL', text: 'Dar vueltas a la Tierra. Llega comida nueva seguido.' },
  { id: 'luna', name: 'LA LUNA', level: 'MEDIO', text: 'Vivir en la Luna. Hay polvo y noches muy largas.' },
  { id: 'marte', name: 'MARTE', level: 'DIFÍCIL', text: 'El viaje más largo. Hay que fabricar combustible para volver.' },
];

/** Inicio para niños: qué es el juego, los 4 pasos, a dónde ir y un botón. */
export function kidsTitle(root, app, go) {
  const saved = load();
  app.scenario = PLACES.some((p) => p.id === app.scenario) ? app.scenario : 'estacion';
  const start = () => {
    Object.assign(app, { mode: 'demo', difficulty: 'facil', kids: true, autoPlan: true, objective: 'ciencia', state: null, lastDesign: null, lastSeed: null,
      reto: null, historica: null, practice: null, simulacro: false, contrarreloj: null, budgetMult: 1, jurado: null });
    beep(990, 80);
    go('design', { design: SUGGESTED(app.scenario, 'facil') });
  };
  const places = () => h('div', { class: 'panel c-pink', id: 'destinos' },
    h('h2', {}, '2. ¿A DÓNDE VAMOS?'),
    h('div', { class: 'lugares' }, ...PLACES.map((p) => h('button', {
      class: `lugar ${app.scenario === p.id ? 'sel' : ''}`, 'data-scn': p.id,
      onclick: () => { app.scenario = p.id; beep(820, 40); draw(); say(`${p.name}: ${p.text}`, { quiet: true, target: '#jugar' }); },
    }, h('div', { class: 'lugar-nombre' }, p.name), h('div', { class: 'lugar-nivel' }, p.level), h('div', { class: 'small lugar-texto' }, p.text)))));
  const academy = () => {
    const rec = academyRecord(), wings = hasWings(rec);
    return h('div', { class: 'panel c-amber', id: 'academia' },
      h('h2', {}, '1. ACADEMIA DE ASTRONAUTAS'),
      h('p', { class: 'small' }, wings ? '¡Ganaste tus ALAS DE ASTRONAUTA! Ya puedes volar a donde quieras.' : 'Entrena como los astronautas de verdad. Con 2 estrellas en todo ganas tus ALAS. Lo que entrenes ayuda en la misión.'),
      wings ? h('div', { class: 'alas' }, '— ★ ALAS DE ASTRONAUTA ★ —') : null,
      h('div', { class: 'acad-lista' }, ...ACADEMY_ORDER.map((id) => {
        const t = TRAININGS[id], st = rec[id] ?? 0;
        return h('button', { class: `acad-carta ${st >= 2 ? 'ok' : ''}`, 'data-acad': id, onclick: async () => {
          beep(820, 40);
          const r = await runTraining(id, { kids: true });
          if (r) { saveAcademy(id, r.stars); markPlayed(); }
          draw(); checkRankUp();
          if (hasWings(academyRecord()) && !wings) say('¡Felicidades! Ganaste tus ALAS DE ASTRONAUTA. Ahora vuela en una MISIÓN.', { mood: 'feliz', target: '#jugar' });
        } }, h('div', { class: 'acad-nombre' }, t.name), h('div', { class: 'acad-st' }, '★'.repeat(st) + '☆'.repeat(3 - st)),
          t.where.length ? h('div', { class: 'small dim' }, `Ayuda en ${{ estacion: 'la Estación', luna: 'la Luna', marte: 'Marte', gateway: 'Gateway' }[t.where[0]]}`) : null);
      })));
  };
  const draw = () => mount(root,
    h('div', { class: 'ninos-titulo' },
      h('div', { class: 'capsule' },
        ...['Ada Sol', 'Leo Mar', 'Iris Luz', 'Tomás Rey'].map((n, i) => crewAvatar({ name: n, role: ['comandante', 'piloto', 'ingeniero', 'medico'][i], alive: true, health: 100, morale: 90, fatigue: 0, radiation: 0, hunger: 0, thirst: 0 }, { size: 70 }))),
      h('h1', {}, 'LIFELINE'),
      h('p', { class: 'mision' }, 'Lleva a 4 astronautas al espacio, cuídalos y tráelos de vuelta a casa.')),
    saved ? h('div', { class: 'panel c-green', style: { textAlign: 'center' } },
      h('button', { class: 'big', id: 'continuar', onclick: () => { app.state = saved; app.difficulty = saved.difficulty; app.mode = saved.mode ?? 'demo'; go(saved.phase === 'reentry' ? 'reentry' : 'ops'); } },
        `SEGUIR MI MISIÓN (DÍA ${saved.day})`)) : null,
    academy(),
    places(),
    h('div', { style: { textAlign: 'center', margin: '1rem 0' } },
      h('button', { class: 'big', id: 'jugar', onclick: start }, '▶ MISIÓN'),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '.6rem' } },
        h('button', { class: 'big arcade-btn', id: 'arcade-btn', onclick: () => openArcade() }, '🕹️ ARCADE'),
        h('button', { id: 'mi-ficha', onclick: () => openCenter(app, go) }, '🧑‍🚀 MI FICHA'))),
    h('div', { class: 'panel c-blue', id: 'como' },
      h('h2', {}, 'ASÍ SE JUEGA'),
      h('ol', { class: 'como-ninos' },
        h('li', {}, h('b', {}, 'ENTRÉNATE. '), 'Juega las pruebas de la ACADEMIA y gana estrellas.'),
        h('li', {}, h('b', {}, 'ARMA LA NAVE. '), 'Nova ya la armó. Solo toca LANZAR.'),
        h('li', {}, h('b', {}, 'DESPEGA. '), 'Mira el cohete subir. Si te preguntan, di GO.'),
        h('li', {}, h('b', {}, 'VIVE EN EL ESPACIO. '), 'Toca AVANZAR. Cuida 3 cosas: SOPORTE VITAL, ENERGÍA y RADIACIÓN. Cuando el Sol lance una llamarada de verdad, decide: ¿refugio o ciencia? Si suena una alarma, arréglala rápido.'),
        h('li', {}, h('b', {}, 'VUELVE A CASA. '), 'Mira cuántas estrellas ganaste.')),
      h('p', { class: 'metas-titulo' }, h('b', {}, 'GANA LAS 3 ESTRELLAS: '), '★ vuelve a casa · ★ elige bien en los problemas · ★ gana las alarmas')),
    h('div', { class: 'small dim', style: { textAlign: 'center' } },
      h('a', { href: '../' }, 'Ir a la versión completa'), ' · Agencia ficticia. Inspirado en datos abiertos de NASA. NASA Space Apps 2026.'),
  );
  draw();
  say(saved ? `Hola otra vez. Tu misión va en el día ${saved.day}. Toca SEGUIR.` : 'Hola, soy Nova, de Control de Misión. Primero entrena en la ACADEMIA y después vuela en una MISIÓN. Yo te ayudo en todo.',
    { mood: 'feliz', target: saved ? '#continuar' : '#academia' });
  return () => {};
}

/** Cómo está un recurso, en palabras. */
export function nivel(days) {
  if (!Number.isFinite(days)) return ['BIEN', 'ok'];
  if (days < 7) return ['¡SE ACABA!', 'bad'];
  if (days < 20) return ['POCO', 'warn'];
  return ['BIEN', 'ok'];
}
