import { h, mount, modal } from '../dom.js';
import { secretCalmButton } from '../easter-egg.js';
import { HISTORICAS } from '../../data/historicas.js';
import { ACHIEVEMENTS, loadAchievements } from '../../core/achievements.js';
import { SUGGESTED } from './design.js';
import { load } from '../../core/save.js';
import { makePlayers, PLAYER_ROLES, updateBar } from '../main.js';
import { hostRoom, joinRoom, leaveRoom, coopInfo, onCoopChange, normalizeCode } from '../coop.js';
import { DIFFICULTY, SCENARIOS } from '../../data/catalog.js';
import { loadCampaign } from '../../core/campaign.js';

export const PLAYABLE = ['estacion', 'gateway', 'luna', 'marte'];
const SCN_DESC = {
  estacion: 'Un año dando vueltas a la Tierra. Llega carga cada 60 días. La más fácil.',
  gateway: 'Estación en órbita de la Luna, como el Gateway real: más radiación y carga solo cada 180 días. Solo en modo Libre o Demo.',
  luna: 'Un año en la Luna: noches de hasta 14 días sin sol, polvo, sismos y hielo. Carga cada 120 días.',
  marte: '7 meses de viaje, 1 año allá y 7 de vuelta. Sin cargas: hay que fabricar combustible para volver.',
};
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar } from '../avatar.js';
import { decodeMission } from '../../core/share.js';
import { TRAININGS, ACADEMY_ORDER, hasWings } from '../../core/academy.js';
import { runTraining, academyRecord, saveAcademy } from '../academy.js';
import { openCenter, openAcademy as openAcademyCenter, startDaily, attractDemo, profile } from '../cadete.js';
import { openArcade, arcadeBest } from '../arcade.js';
import { dailyChallenge } from '../../core/cadete.js';

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
  ['Soy Nova, de Control de Misión. Voy a estar en la radio todo el viaje.', 'feliz'],
  ['Primero se arma la nave: módulo por módulo, el cohete, la comida y la gente que va. Cada astronauta se elige por entrevista.', 'normal'],
  ['Después viene el despegue, igual que uno real: cuenta regresiva, clima y cada equipo dice si está listo.', 'normal'],
  ['Allá arriba tú repartes el trabajo de cada turno: dormir, reparar, hacer ciencia, curar.', 'pensando'],
  ['Si algo se rompe, puedes ir caminando en Recorrido y repararlo a mano siguiendo el procedimiento.', 'normal'],
  ['En la Luna y Marte, en Excavar salen dos con el traje a sacar hielo, hierro y rocas. Vuelvan antes de quedarse sin oxígeno.', 'pensando'],
  ['Van a pasar cosas. Casi siempre aviso antes y te marco qué tocar.', 'alerta'],
  ['Pueden jugar juntos en una compu o en línea, cada uno desde la suya, con el código de sala.', 'feliz'],
  ['Al final vuelven a la Tierra y vemos qué salió bien y qué no. La misión vale si vuelve al menos uno sano.', 'feliz'],
];

const online = { name: '', code: '', msg: '', busy: false };

function onlinePanel() {
  const c = coopInfo();
  const run = async (fn) => {
    online.busy = true; online.msg = 'Conectando...'; redrawTitle();
    try { await fn(); online.msg = ''; } catch (e) { online.msg = e.message; }
    online.busy = false; redrawTitle();
  };
  return h('div', { class: 'panel c-cyan', id: 'en-linea' },
    h('h2', {}, 'EN LÍNEA: CADA UNO DESDE SU COMPU'),
    h('div', { class: 'help' }, 'De 2 a 4 personas, cada una en su navegador. Quien crea la sala comparte el código de 6 letras; las demás lo escriben. Los roles se reparten como arriba y todos ven la misma misión. Necesita internet.'),
    c.role
      ? h('div', {},
        h('div', { class: 'lectura code' }, `SALA ${c.code}`),
        h('div', { class: 'small' }, c.role === 'host' ? 'Eres el anfitrión: deja esta pestaña abierta.' : 'Conectado como invitado.'),
        h('div', { class: 'small' }, 'En la sala: ', c.players.map((p) => (p.away ? `${p.name} (desconectado)` : p.name)).join(' · ') || '...'),
        h('button', { onclick: () => { leaveRoom(); redrawTitle(); } }, 'SALIR DE LA SALA'))
      : h('div', { class: 'row' },
        h('input', { placeholder: 'Tu nombre', value: online.name, size: 12, maxlength: 16, oninput: (e) => { online.name = e.target.value; } }),
        h('button', { id: 'crear-sala', disabled: online.busy, onclick: () => run(() => hostRoom(online.name)) }, 'CREAR SALA'),
        h('input', { placeholder: 'CÓDIGO', value: online.code, size: 7, maxlength: 6, oninput: (e) => { online.code = normalizeCode(e.target.value); e.target.value = online.code; } }),
        h('button', { id: 'unirse', disabled: online.busy, onclick: () => run(() => joinRoom(online.code, online.name)) }, 'UNIRSE')),
    c.status ? h('div', { class: 'small' }, c.status) : null,
    online.msg ? h('div', { class: 'small amber' }, online.msg) : null);
}
let redrawTitle = () => {};

/** Modo jurado: todo listo para mostrar el juego en 3 minutos. */
export function startJurado(app, go) {
  Object.assign(app, { mode: 'demo', scenario: 'estacion', difficulty: 'facil', objective: 'ciencia', historica: null, reto: null, practice: null,
    state: null, lastDesign: null, lastSeed: null, budgetMult: 1, simulacro: false, kids: false, contrarreloj: null, jurado: Date.now() });
  app.players = makePlayers(1); updateBar();
  beep(990, 80); go('design', { design: SUGGESTED('estacion') });
  say('🏛️ Modo jurado. Paso 1 de 5: la nave ya está armada por módulos, dentro del presupuesto y el peso del cohete. Miren el tablero y toquen 🚀 LANZAR.', { mood: 'feliz', target: '#lanzar' });
}

export function render(root, app, go) {
  const saved = load();
  const names = app.players.map((p) => p.name);
  let tour = -1;

  const nextTour = () => {
    tour += 1;
    if (tour >= TOUR.length) { tour = -1; say('Elige cómo jugar y toca NUEVA MISIÓN cuando quieras.', { mood: 'feliz', target: '#nueva' }); return; }
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
        h('h1', {}, 'LIFELINE'),
        h('div', { class: 'dim', style: { fontSize: '1.1rem' } }, '🛠️ Diseña tu nave · 🚀 Despega · 🛰️ Sobrevive un año en el espacio · 🌊 Vuelve a casa'),
        h('div', { class: 'rapido', style: { marginTop: '1rem' } },
          h('button', { class: 'big arcade-btn', id: 'arcade-btn', onclick: () => openArcade() }, `🕹️ ARCADE · récord ${arcadeBest().best}`),
          h('button', { class: 'big', id: 'expres', title: 'Misión completa en 5 minutos reales, con más emergencias. Ideal para clase.', onclick: () => {
            Object.assign(app, { mode: 'demo', scenario: app.scenario ?? 'estacion', difficulty: 'facil', objective: 'ciencia', historica: null, reto: null, practice: null, state: null, lastDesign: null, lastSeed: null, budgetMult: 1, expres: true });
            beep(990, 80); go('design', { design: SUGGESTED(app.scenario) });
            say('⏱️ Misión exprés: 5 minutos reales y más emergencias. La nave ya está lista: toca 🚀 LANZAR y pongan el tiempo en 12×.', { mood: 'alerta', target: '#lanzar' });
          } }, '⏱️ MISIÓN EXPRÉS · 5 min'))),
      saved ? h('div', { class: 'panel c-green', style: { textAlign: 'center' } },
        h('button', { class: 'big', id: 'continuar', onclick: () => { app.state = saved; app.difficulty = saved.difficulty; app.mode = saved.mode ?? app.mode; go(saved.phase === 'reentry' ? 'reentry' : 'ops'); } },
          `▶ SEGUIR MI MISIÓN · DÍA ${saved.day}`)) : null,
      h('div', { class: 'panel c-green', id: 'modo-ninos', style: { textAlign: 'center' } },
        h('button', { class: `big ${app.kids ? 'sel' : ''}`, onclick: () => {
          app.kids = !app.kids; app.autoPlan = true;
          if (app.kids) app.difficulty = 'facil';
          try { localStorage.setItem('vdl-ninos', app.kids ? '1' : '0'); } catch { /* sin almacenamiento */ }
          beep(app.kids ? 1000 : 500, 60); draw();
          say(app.kids ? '🧒 Modo niños: fácil, menos botones y yo reparto los trabajos cada día. ¡Tú cuidas a la tripulación!' : 'Modo completo: tú decides todo.', { quiet: true, mood: 'feliz', target: '#nueva' });
        } }, app.kids ? '🧒 MODO NIÑOS: ENCENDIDO' : '🧒 Modo niños (más fácil)'),
        h('div', { class: 'small dim' }, app.kids ? 'Nova reparte los trabajos, menos números y energía en una barra.' : 'Para jugar sin tantos detalles.')),
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
            h('button', { class: app.difficulty === d.id ? 'sel' : '', disabled: (app.mode === 'demo' || app.kids) && d.id !== 'facil', 'data-dif': d.id,
              onclick: () => { app.difficulty = d.id; draw(); say(`${d.name}: ${DIFF_DESC[d.id]}`, { quiet: true, mood: d.id === 'dificil' ? 'alerta' : 'normal' }); } },
            { facil: '🟢 ', medio: '🟠 ', dificil: '🔴 ' }[d.id] + d.name))),
          h('div', { class: 'small dim' }, DIFF_DESC[app.difficulty]),
          h('div', { class: 'row', id: 'contrarreloj', style: { marginTop: '.4rem' } }, '⏱️ Contrarreloj:',
            ...[[0, 'No'], [10, '10 min'], [20, '20 min'], [30, '30 min']].map(([m, t]) => h('button', { class: `small ${(app.contrarreloj ?? 0) === m ? 'sel' : ''}`, 'data-contra': m,
              onclick: () => { app.contrarreloj = m || null; draw(); if (m) say(`Contrarreloj de ${m} minutos reales: cuando se acabe el tiempo, la misión termina y gana el equipo con más puntaje. ¡Ideal para competir en clase!`, { quiet: true }); } }, t))),
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
            } }, `${n} ${n === 1 ? 'JUGADOR' : 'JUGADORES'}`))),
          h('table', { id: 'roles', style: { marginTop: '.5rem' } },
            ...app.players.map((p, i) => h('tr', {},
              h('td', {}, h('input', { value: p.name, size: 12, oninput: (e) => { p.name = e.target.value; names[i] = e.target.value; updateBar(); } })),
              h('td', {}, p.roles.map((r) => h('div', { class: 'small' }, h('b', {}, PLAYER_ROLES[r]), h('span', { class: 'dim' }, `: ${ROLE_DESC[r]}`))))))))),
      onlinePanel(),
      h('div', { style: { textAlign: 'center', margin: '1.2rem 0' } },
        coopInfo().role === 'guest' ? h('div', { class: 'small amber' }, 'Estás en la sala de otra persona: el anfitrión empieza la misión y tu pantalla lo sigue.') : null,
        h('button', { class: 'big', id: 'nueva', disabled: coopInfo().role === 'guest', onclick: () => { app.state = null; app.lastDesign = null; app.lastSeed = null; app.objective = null; app.reto = null; app.historica = null; app.practice = null; if (app.mode !== 'libre') app.budgetMult = 1; beep(990, 80); go('design'); } }, '🚀 NUEVA MISIÓN'),
        ' ', h('button', { id: 'reto', title: 'Pega el código que te pasó otro equipo: jugarán la misma misión y compararán puntajes.', onclick: () => {
          const code = prompt('Pega el código de misión (empieza con VDL1-):');
          if (code === null) return;
          const m = decodeMission(code);
          if (!m || !SCENARIOS[m.scenarioId] || !DIFFICULTY[m.difficulty]) { say('Ese código no sirve. Revisa que esté completo y empiece con VDL1-.', { mood: 'alerta' }); beep(300, 120); return; }
          Object.assign(app, { mode: 'libre', budgetMult: 1, scenario: m.scenarioId, difficulty: m.difficulty, objective: m.objective, state: null,
            lastDesign: m.design, lastScenario: m.scenarioId, lastSeed: m.seed, reto: code.trim(), historica: null, practice: null });
          beep(990, 80);
          say('🏁 Reto cargado: misma nave, mismo destino y mismo clima espacial. Pueden cambiar la nave si quieren. ¡A ver quién saca más puntaje!', { mood: 'feliz' });
          go('design', { design: m.design });
        } }, '🏁 Jugar un reto'),
        ' ', h('button', { id: 'como', onclick: () => { tour = -1; nextTour(); } }, '❓ ¿Cómo se juega?'),
        ' ', h('button', { id: 'practica', title: 'Una misión corta y fácil con Nova explicando cada parte.', onclick: () => {
          Object.assign(app, { mode: 'demo', scenario: 'estacion', difficulty: 'facil', objective: 'ciencia', historica: null, reto: null, practice: 0, state: null, lastDesign: null, lastSeed: null, budgetMult: 1 });
          beep(990, 80); go('design', { design: SUGGESTED('estacion') });
          say('🎓 Práctica guiada: la nave ya está armada. Toca 🚀 LANZAR y te explico todo en la misión.', { mood: 'feliz', target: '#lanzar' });
        } }, '🎓 Práctica guiada'),
        ' ', h('button', { id: 'academia', title: 'Las 6 pruebas de entrenamiento de astronauta. Con 2 estrellas en todas ganas tus alas.', onclick: () => openAcademyCenter(app, go) }, '🎓 Academia de astronautas'),
        ' ', h('button', { id: 'jurado', title: 'Recorrido de 3 minutos por lo principal: nave, despegue, una emergencia y el informe.', onclick: () => startJurado(app, go) }, '🏛️ Modo jurado (3 min)'),
        ' ', h('button', { id: 'simulacro', title: 'Misión fácil con muchas emergencias relámpago para practicar los minijuegos.', onclick: () => {
          Object.assign(app, { mode: 'demo', scenario: 'estacion', difficulty: 'facil', objective: 'ciencia', historica: null, reto: null, practice: null, state: null, lastDesign: null, lastSeed: null, budgetMult: 1, simulacro: true });
          beep(990, 80); go('design', { design: SUGGESTED('estacion') });
          say('⚡ Simulacro de emergencias: van a saltar muchas alarmas. Cierren escotillas, giren válvulas, conecten cables y sigan los protocolos contra reloj.', { mood: 'alerta', target: '#lanzar' });
        } }, '⚡ Simulacro de emergencias'),
        ' ', h('button', { id: 'historicas', onclick: () => {
          const close = modal(h('div', {}, h('h2', {}, '📜 Misiones históricas'),
            h('div', { class: 'small dim' }, 'Problemas que pasaron de verdad. ¿Tu equipo lo haría mejor?'),
            ...HISTORICAS.map((m) => h('div', { class: 'lesson', style: { margin: '.5rem 0' } },
              h('b', {}, `${m.icon} ${m.name} (${m.year})`), h('div', { class: 'small' }, m.story),
              h('button', { 'data-historica': m.id, onclick: () => {
                close();
                Object.assign(app, { mode: 'libre', budgetMult: 1, scenario: m.scenarioId, difficulty: m.difficulty, objective: m.objective, historica: m, reto: null, practice: null, state: null, lastDesign: null, lastSeed: null });
                beep(990, 80); go('design', { design: SUGGESTED(m.scenarioId) });
                say(`📜 ${m.name}. Te dejé una nave de ejemplo: cámbiala si quieres y lanza cuando estén listos.`, { mood: 'pensando', target: '#lanzar' });
              } }, '▶ Jugar esta misión'))),
            h('button', { onclick: () => close() }, 'Cerrar')));
        } }, '📜 Misiones históricas'),
        ' ', h('button', { id: 'centro', class: 'warn', onclick: () => openCenter(app, go) }, (() => { const p = profile(); return `🧑‍🚀 Mi ficha · ${p.rank.name}${p.streak.now ? ` · 🔥${p.streak.now}` : ''}`; })()),
        ' ', h('button', { id: 'diario', title: 'La misma misión para todos hoy: comparen puntajes.', onclick: () => startDaily(app, go, SUGGESTED) }, `📅 Reto diario · ${{ estacion: 'Estación', gateway: 'Gateway', luna: 'Luna', marte: 'Marte' }[dailyChallenge().scenario]}`),
        ' ', h('button', { id: 'datos-nasa', onclick: () => openCenter(app, go, 'data') }, '📡 Datos NASA en vivo'),
        ' ', h('button', { id: 'escuelas', onclick: () => openCenter(app, go, 'clase') }, '🏫 Para escuelas'),
        ' ', h('button', { id: 'demo-auto-btn', title: 'Presentación sola de 60 segundos (para el stand).', onclick: () => attractDemo() }, '🎬 Demo automática'),
        ' ', h('button', { id: 'ver-logros', onclick: () => openCenter(app, go, 'parches') }, '🎖️ Parches y récords')),
      h('div', { class: 'small dim', style: { textAlign: 'center' } },
        'Agencia ficticia. Inspirado en procedimientos y datos abiertos de NASA. Hecho para NASA Space Apps 2026 · desafío Junior Astronaut Mission Trainer.',
        secretCalmButton()),
    );
  };
  // ACADEMIA: las 6 pruebas sueltas; guarda las mejores estrellas y da las alas con 2+ en todas.
  const WHERE = { estacion: 'la Estación', luna: 'la Luna', marte: 'Marte', gateway: 'Gateway' };
  const openAcademy = () => {
    const rec = academyRecord(), wings = hasWings(rec);
    const close = modal(h('div', { id: 'academia-lista' }, h('h2', {}, '🎓 Academia de astronautas'),
      h('p', { class: 'small' }, wings ? '¡Ganaste tus ALAS DE ASTRONAUTA!' : 'Entrena como los astronautas de verdad. Con 2 estrellas en cada prueba ganas tus ALAS. Antes de cada misión, la prueba de su destino ayuda a la tripulación.'),
      wings ? h('div', { class: 'alas' }, '— ★ ALAS DE ASTRONAUTA ★ —') : null,
      h('div', { class: 'acad-lista' }, ...ACADEMY_ORDER.map((id) => {
        const t = TRAININGS[id], st = rec[id] ?? 0;
        return h('button', { class: `acad-carta ${st >= 2 ? 'ok' : ''}`, 'data-acad': id, onclick: async () => {
          beep(820, 40); close();
          const r = await runTraining(id);
          if (r) saveAcademy(id, r.stars);
          openAcademy();
          if (hasWings(academyRecord()) && !wings) say('¡Felicidades! Ganaste tus ALAS DE ASTRONAUTA.', { mood: 'feliz' });
        } }, h('div', { class: 'acad-nombre' }, h('span', {}, t.icon), ' ', h('span', {}, t.name)), h('div', { class: 'acad-st' }, '★'.repeat(st) + '☆'.repeat(3 - st)),
          t.where.length ? h('div', { class: 'small dim' }, `Ayuda en ${WHERE[t.where[0]]}`) : null);
      })),
      h('button', { onclick: () => close() }, 'Cerrar')));
  };
  redrawTitle = draw;
  app.suggested = SUGGESTED;
  // ?jurado en la dirección: entra directo al recorrido de 3 minutos (para el link del jurado).
  if (new URLSearchParams(location.search).has('jurado') && !app.juradoAuto && !coopInfo().role) { app.juradoAuto = true; startJurado(app, go); return () => {}; }
  app.jurado = null;
  const offCoop = onCoopChange(() => draw());
  draw();
  say(saved ? `¡Hola otra vez! Tu misión va en el día ${saved.day}. Toca SEGUIR para continuar.` : 'Aquí Nova, Control de Misión. Si es tu primera vez, toca "¿Cómo se juega?".',
    { mood: 'feliz', target: saved ? '#continuar' : '#como', buttons: saved ? [] : [{ label: 'Explícame', onclick: () => { tour = -1; nextTour(); } }] });
  return () => { offCoop(); redrawTitle = () => {}; };
}
