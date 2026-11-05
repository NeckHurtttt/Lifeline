// Pantalla de diseño: cuadrícula de módulos, instrumentos, cohete, órbita, carga y tripulación, con Nova guiando.
import { MOD_CODE } from '../art.js';
import { h, mount, bar, modal, fmt, tabs } from '../dom.js';
import { MODULES, INSTRUMENTS, LAUNCHERS, ORBITS, GRID, DIFFICULTY, SCENARIOS } from '../../data/catalog.js';
import { availableIn } from '../../core/surface.js';
import { loadCampaign, UPGRADES } from '../../core/campaign.js';
import { ROLES } from '../../data/crew.js';
import { LESSONS } from '../../data/lessons.js';
import { computeDesign, canLaunch } from '../../core/design.js';
import { createMission } from '../../core/mission.js';
import { fetchFlares, flaresToStorms } from '../../core/realdata.js';
import { whoDecides } from '../main.js';
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar } from '../avatar.js';
import { candidatesFor, ask, knownAbout, QUESTIONS, QUESTIONS_PER_CANDIDATE } from '../../core/interview.js';
import { TRAITS } from '../../data/crew.js';

const STAT_ICON = { fuerza: '💪', tecnica: '🛠️', ciencia: '🧠', medicina: '❤️‍🩹', temple: '🧘' };
const STAT_NAME = { fuerza: 'Fuerza', tecnica: 'Técnica', ciencia: 'Ciencia', medicina: 'Medicina', temple: 'Calma' };
const MAIN_Q = { temple: 'alarma', fuerza: 'entrenar', tecnica: 'arreglar', medicina: 'herido', ciencia: 'descubrir' };
const fresh = (c) => ({ ...c, alive: true, health: 100, morale: 85, fatigue: 0, radiation: 0, hunger: 0, thirst: 0 });

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const ROLE_ICON = { comandante: '⭐', piloto: '🕹️', ingeniero: '🔧', medico: '🩺', cientifico: '🔬', biologo: '🌿' };
const ROLE_DESC = {
  comandante: 'el jefe: muy tranquilo en los problemas', piloto: 'muy fuerte; maneja el brazo robot', ingeniero: 'arregla todo',
  medico: 'cura a la tripulación', cientifico: 'hace mucha ciencia', biologo: 'experto en plantas',
};

const SUGGESTED_BY = {
  estacion: () => ({
    modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0),
      mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1)],
    instruments: ['camara_tierra', 'espectrometro'],
    launcher: 'condorH', orbit: 'leo_estacion',
    crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90,
  }),
  luna: () => ({
    modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0),
      mod('pila_regenerativa', 0, 1), mod('reactor', 1, 1), mod('laboratorio', 2, 1), mod('bodega', 3, 1), mod('extractor_hielo', 4, 1), mod('rover_autonomo', 5, 1), mod('antena', 0, 2)],
    instruments: ['sismometro', 'georradar'],
    launcher: 'titan', orbit: 'luna_polo',
    crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 150,
  }),
  marte: () => ({
    modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('planta_combustible', 3, 0), mod('paneles', 4, 0), mod('paneles', 5, 0),
      mod('reactor', 0, 1), mod('pila_regenerativa', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1),
      mod('refugio', 0, 2), mod('enfermeria', 1, 2), mod('bodega', 2, 2), mod('antena', 3, 2)],
    instruments: ['buscador_vida', 'analizador_rocas'],
    launcher: 'titan', orbit: 'marte_jezero',
    crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 240,
  }),
};
export const SUGGESTED = (scn = 'estacion') => (SUGGESTED_BY[scn] ?? SUGGESTED_BY.estacion)();

const EMPTY = (scn = 'estacion') => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), ...(scn === 'estacion' ? [] : [mod('modulo_aterrizaje', 2, 0)])], instruments: [],
  launcher: scn === 'estacion' ? 'condor1' : 'titan', orbit: SCENARIOS[scn]?.orbit ?? 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero'], cargoDays: scn === 'marte' ? 240 : scn === 'luna' ? 150 : 90,
});

const TAB_OF = (target) => (/data-mod|#nave/.test(target) ? 'nave' : target === '#instrumentos' ? 'ciencia' : target === '#cohetes' ? 'cohete' : /#tripulantes|#carga|data-hire|data-role/.test(target) ? 'astronautas' : null);

const STORMS_PER_DIFF = { facil: 2, medio: 4, dificil: 7 };

function pickStorms(flares, difficulty) {
  const all = flaresToStorms(flares, difficulty).filter((s) => s.day > 10 && s.day < 360);
  const n = Math.min(STORMS_PER_DIFF[difficulty], all.length);
  return Array.from({ length: n }, (_, i) => all[Math.floor((i + 0.5) * all.length / n)]);
}

function lessonCard(id) {
  const l = LESSONS[id];
  const close = modal(h('div', {},
    h('h2', {}, '🌍 ', l.title),
    h('p', {}, h('b', { class: 'amber' }, 'En el espacio: '), l.space),
    h('p', {}, h('b', { class: 'green' }, 'En la Tierra: '), l.earth),
    h('button', { onclick: () => close() }, 'Cerrar')));
}

/** Qué le falta al diseño, explicado por Nova, y a dónde apuntar. */
function coach(d, r) {
  const has = (t) => d.modules.some((m) => m.type === t);
  if (!has('cabina')) return ['Falta la 🛏️ CABINA: es la casa de los astronautas. Tócala en la lista y luego toca un cuadro vacío de la nave.', 'alerta', '[data-mod="cabina"]'];
  if (!has('soporte_vital')) return ['Falta el 🫁 SOPORTE VITAL: sin él no hay aire. Tócalo y ponlo en la nave.', 'alerta', '[data-mod="soporte_vital"]'];
  const scnOf = ORBITS[d.orbit]?.scenario ?? 'estacion';
  if (scnOf !== 'estacion' && !has('modulo_aterrizaje')) return ['Falta el 🛬 MÓDULO DE ATERRIZAJE: sin él no se puede bajar al suelo ni volver a subir.', 'alerta', '[data-mod="modulo_aterrizaje"]'];
  if (scnOf === 'marte' && !has('planta_combustible')) return ['Falta la ⛽ PLANTA DE COMBUSTIBLE: en Marte hay que fabricar el combustible para volver, con el aire de allá.', 'alerta', '[data-mod="planta_combustible"]'];
  const noSirve = r.errors.find((e) => /No sirve/.test(e));
  if (noSirve) return [`${noSirve}. Quítalo de la nave (clic derecho).`, 'alerta', '#nave'];
  if (r.errors.some((e) => /Elige un lugar/.test(e))) return ['Elige dónde ir en la pestaña 🚀 Cohete.', 'alerta', '#cohetes'];
  if (r.energyPerDay < 0) return [`¡No alcanza la electricidad! Te faltan ${fmt(-r.energyPerDay)} kWh por día. Agrega ☀️ PANELES SOLARES.`, 'alerta', '[data-mod="paneles"]'];
  if (r.mass > r.capacity) return [`Tu nave pesa ${fmt(r.mass, 1)} toneladas y el cohete solo puede subir ${fmt(r.capacity, 1)}. Elige un cohete más grande o quita módulos.`, 'alerta', '#cohetes'];
  if (r.cost > r.budget) return [`Te pasaste del dinero por ${fmt(r.cost - r.budget)} millones. Quita algo o elige un cohete más barato.`, 'alerta', '#tablero'];
  if (r.crewMax < d.crewRoles.length) return ['Hay más astronautas que camas. Cada 🛏️ cabina tiene 4 camas.', 'alerta', '#tripulantes'];
  if (d.crewRoles.length === 0) return ['¡No hay astronautas! Elige al menos uno abajo a la derecha.', 'alerta', '#tripulantes'];
  const sinContratar = d.crewRoles.find((ro) => !d.hires?.[ro]);
  if (sinContratar) return [`Falta contratar al ${ROLES[sinContratar].name.toLowerCase()}. Toca 🎤 ENTREVISTAR: tienes 3 candidatos y 3 preguntas para cada uno.`, 'alerta', `[data-hire="${sinContratar}"]`];
  if (scnOf === 'marte' && !d.crewRoles.includes('piloto')) return ['Consejo: en Marte el aterrizaje lo corrige el 🕹️ PILOTO (fuerza). Sin piloto es fácil que el aterrizaje salga duro.', 'pensando', '[data-role="piloto"]'];
  if (d.instruments.length > d.modules.filter((m) => m.type === 'laboratorio').length * 3) return ['Tienes más instrumentos que espacio. Cada 🔬 laboratorio tiene 3 lugares.', 'alerta', '#instrumentos'];
  if (d.cargoDays > r.cargoMax) return [`No cabe tanta comida. Máximo ${r.cargoMax} días. Agrega una 📦 bodega o baja los días.`, 'alerta', '#carga'];
  const night = r.warnings.find((w) => /noche|De día no sobra/.test(w));
  if (night) return [`⚠️ ${night}.`, 'alerta', has('reactor') ? '[data-mod="pila_regenerativa"]' : '[data-mod="reactor"]'];
  if (!has('baterias') && !has('pila_regenerativa')) return [scnOf === 'estacion' ? 'Consejo: pon 🔋 BATERÍAS. Cada 90 minutos la Tierra tapa el Sol y sin baterías se apaga todo.' : 'Consejo: pon 🔋 BATERÍAS o una 🧪 PILA REGENERATIVA para guardar energía.', 'pensando', '[data-mod="baterias"]'];
  if (!has('laboratorio')) return ['Consejo: sin 🔬 LABORATORIO no harás ciencia (ciencia = puntos). Puedes lanzar igual.', 'pensando', '[data-mod="laboratorio"]'];
  if (has('laboratorio') && d.instruments.length === 0) return ['Tienes laboratorio pero ningún instrumento. Elige alguno a la derecha para hacer ciencia.', 'pensando', '#instrumentos'];
  if (r.warnings.length) {
    const w = r.warnings[0];
    if (/datos/.test(w)) return ['Tus instrumentos juntan más datos de los que puedes mandar. Una 📶 ANTENA ayuda. Puedes lanzar igual.', 'pensando', '[data-mod="antena"]'];
    return [`Consejo: ${w}. Puedes lanzar igual.`, 'pensando', /comida/.test(w) ? '#carga' : '#tablero'];
  }
  return ['La nave cumple todo. Cuando estés conforme, LANZAR.', 'feliz', '#lanzar'];
}

export function render(root, app, go, params = {}) {
  const scn = app.scenario ?? 'estacion';
  const sc = SCENARIOS[scn];
  const prev = app.lastScenario === scn ? app.lastDesign : null;
  const d = structuredClone(params.design ?? prev ?? (app.mode === 'demo' ? SUGGESTED(scn) : EMPTY(scn)));
  for (const m of d.modules) { delete m.health; delete m.on; delete m.priority; delete m.offDays; }
  let selected = 'paneles';
  let launching = false;
  let explain = null; // texto de Nova al elegir algo
  let tab = app.designTab ?? 'nave';
  d.upgrades = app.mode === 'campana' ? loadCampaign().upgrades : [];
  d.hires ??= {};
  d.interviews ??= {};
  d.crewSeed ??= Math.floor(Math.random() * 2 ** 31);
  // Entrevista opcional: cada puesto ya trae a alguien asignado (sin conocerlo). Entrevistar permite elegir mejor.
  const autoHire = () => {
    for (const ro of d.crewRoles) {
      if (d.hires[ro]) continue;
      const cands = candidatesFor(ro, d.crewSeed);
      d.hires[ro] = { ...cands[(d.crewSeed + ro.length) % cands.length], auto: true };
    }
  };
  autoHire();

  /** Entrevista: 3 candidatos por puesto, 3 preguntas a cada uno; luego se contrata a uno. */
  function interview(role) {
    let close = null;
    const cands = candidatesFor(role, d.crewSeed);
    const main = ROLES[role].mainStat;
    const show = () => {
      close?.();
      close = modal(h('div', { class: 'interview' },
        h('h2', {}, `🎤 Entrevista: ${ROLE_ICON[role]} ${ROLES[role].name}`),
        h('div', { class: 'help' }, `Cada candidato tiene tiempo para ${QUESTIONS_PER_CANDIDATE} preguntas. Para ${ROLES[role].name.toLowerCase()} importa sobre todo ${STAT_ICON[main]} ${STAT_NAME[main]}. ¡Ojo con los rasgos malos!`),
        h('div', { class: 'cand-grid' }, ...cands.map((c) => {
          const asked = d.interviews[c.id] ?? [];
          const left = QUESTIONS_PER_CANDIDATE - asked.length;
          const known = knownAbout(c, asked);
          const hired = d.hires[role]?.id === c.id;
          return h('div', { class: `cand ${hired ? 'hired' : ''}`, 'data-cand': c.id },
            h('div', { style: { textAlign: 'center' } }, crewAvatar(fresh(c), { size: 76 }), h('div', { class: 'name' }, c.name)),
            h('button', { class: hired ? 'sel' : '', 'data-contratar': c.id, onclick: () => {
              d.hires[role] = { ...c }; beep(990, 80); close(); draw();
              say(`¡${c.name.split(' ')[0]} es tu nuevo ${ROLES[role].name.toLowerCase()}! 🎉`, { mood: 'feliz' });
            } }, hired ? '✅ Contratado' : '🤝 Contratar'),
            h('div', { class: 'cand-stats' }, ...Object.keys(STAT_ICON).map((k) => h('span', { class: k in known.stats ? '' : 'dim', title: STAT_NAME[k] },
              `${STAT_ICON[k]} ${k in known.stats ? known.stats[k] : '?'}`))),
            h('div', {}, ...known.traits.map((t) => h('span', { class: `chip ${TRAITS[t].positive ? 'ok' : 'bad'}`, title: TRAITS[t].desc }, TRAITS[t].name))),
            h('div', { class: 'charla' }, ...asked.map((qid) => {
              const q = QUESTIONS.find((x) => x.id === qid);
              return h('div', {}, h('div', { class: 'small dim' }, `${q.icon} ${q.q}`), h('div', {}, `— ${ask(c, qid).text}`));
            })),
            h('div', { class: 'small' }, left > 0 ? `⏱️ Te quedan ${left} pregunta(s)` : '⏱️ Se acabó el tiempo de la entrevista'),
            left > 0 ? h('div', { class: 'preguntas' }, ...QUESTIONS.filter((q) => !asked.includes(q.id)).map((q) =>
              h('button', { class: `small ${q.id === MAIN_Q[main] ? 'clave' : ''}`, 'data-q': q.id, onclick: () => { d.interviews[c.id] = [...asked, q.id]; beep(660, 30); show(); } }, `${q.icon} ${q.q}`))) : null);

        })),
        h('div', { style: { textAlign: 'right' } }, h('button', { onclick: () => close() }, 'Cerrar'))));
    };
    show();
    say(`Pregúntales cosas para conocerlos. La pregunta brillante ✨ dice cuánto ${STAT_NAME[main].toLowerCase()} tienen.`, { mood: 'pensando', quiet: true });
  }
  const flares = fetchFlares();
  const budgetMult = app.mode === 'libre' ? app.budgetMult : 1;
  const who = (role) => { const n = whoDecides(app, role); return n ? h('span', { class: 'tag' }, `decide ${n}`) : null; };

  const place = (x, y) => {
    const at = d.modules.findIndex((m) => m.x === x && m.y === y);
    if (at >= 0) d.modules.splice(at, 1);
    d.modules.push(mod(selected, x, y));
    explain = null;
    beep(620, 40); draw();
  };
  const remove = (x, y) => { d.modules = d.modules.filter((m) => !(m.x === x && m.y === y)); explain = null; beep(300, 40); draw(); };

  async function launch() {
    const r = computeDesign(d, scn, app.difficulty, budgetMult);
    if (!canLaunch(r) || launching) return;
    launching = true; draw();
    say('Revisando el clima espacial con datos reales de NASA… ☀️', { mood: 'pensando' });
    const seed = app.lastSeed ?? Math.floor(Math.random() * 2 ** 31);
    const f = await flares;
    const state = createMission({ design: structuredClone(d), scenarioId: scn, difficulty: app.difficulty, seed, demo: app.mode === 'demo' });
    state.mode = app.mode;
    state.realStorms = pickStorms(f.flares, app.difficulty);
    state.flareSource = f.source;
    app.lastDesign = structuredClone(d);
    app.lastScenario = scn;
    app.lastSeed = seed;
    app.state = state;
    go('launch');
  }

  const draw = () => {
    autoHire();
    const r = computeDesign(d, scn, app.difficulty, budgetMult);
    const ok = canLaunch(r);
    const cell = (x, y) => {
      const m = d.modules.find((q) => q.x === x && q.y === y);
      const def = m && MODULES[m.type];
      return h('div', {
        class: `cell ${m ? 'full' : ''}`, 'data-x': x, 'data-y': y, title: m ? `${def.name}. Clic derecho para quitar.` : `Clic para poner: ${MODULES[selected].name}`,
        onclick: () => place(x, y), oncontextmenu: (e) => { e.preventDefault(); if (m) remove(x, y); },
      }, m ? [h('div', { class: 'ico code' }, MOD_CODE[m.type]), h('b', {}, def.name), h('div', { class: 'dim small' }, def.kw > 0 ? `⚡ da ${def.kw}` : def.kw < 0 ? `⚡ usa ${-def.kw}` : '')] : h('span', { class: 'muted', style: { fontSize: '1.4rem' } }, '+'));
    };
    const row = (label, frac, text, lesson, opts) => h('div', { class: 'res' },
      h('span', {}, label), bar(frac, opts),
      h('span', { class: 'small' }, text, ' ', lesson ? h('button', { class: 'small', style: { padding: '0 .4rem' }, title: 'Qué es y para qué sirve en la Tierra', onclick: () => lessonCard(lesson) }, '?') : null));

    const instrSlots = d.modules.filter((m) => m.type === 'laboratorio').length * 3;
    mount(root,
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h1', { style: { fontSize: '1.8rem' } }, `🛠️ Arma tu ${scn === 'estacion' ? 'nave' : 'base'} · ${sc.icon} ${sc.short}`),
        d.upgrades.length ? h('span', { class: 'small', title: d.upgrades.map((u) => UPGRADES[u].name).join(', ') }, `🌳 Mejoras: ${d.upgrades.map((u) => UPGRADES[u].icon).join(' ')}`) : null,
        h('div', { class: 'row' },
          h('button', { onclick: () => { Object.assign(d, SUGGESTED(scn)); explain = null; draw(); say('Te puse un diseño que funciona. ¡Puedes cambiarlo como quieras!', { mood: 'feliz' }); } }, '✨ Usar una nave de ejemplo'),
          h('button', { onclick: () => go('title') }, '🏠 Menú'))),
      h('div', { class: 'design-layout' },
        h('div', {},
          tabs([
            { id: 'nave', label: 'Nave', color: 'c-blue', badge: r.errors.some((e) => /módulo|energía|casilla|cuadrícula/i.test(e)) ? '!' : 0 },
            { id: 'ciencia', label: 'Ciencia', color: 'c-green', badge: r.errors.some((e) => /instrumentos/i.test(e)) ? '!' : 0 },
            { id: 'cohete', label: 'Cohete y destino', color: 'c-pink', badge: r.errors.some((e) => /pesa/i.test(e)) ? '!' : 0 },
            { id: 'astronautas', label: 'Astronautas y comida', color: 'c-cyan', badge: r.errors.some((e) => /tripulantes|Carga/i.test(e)) ? '!' : 0 },
          ], tab, (t) => { tab = t; app.designTab = t; explain = null; beep(760, 30); draw(); }),
          tab === 'nave' ? h('div', { class: 'grid2 nave-tab' },
          h('div', { class: 'panel c-violet' },
            h('h2', {}, '1. Elige una pieza ', who('ingeniero')),
            h('div', { class: 'help' }, 'Toca una pieza y luego un cuadro de tu nave.'),
            h('ul', { class: 'plain', id: 'catalogo' }, ...Object.values(MODULES).filter((m) => availableIn(m, scn)).map((m) => h('li', {},
              h('button', { class: selected === m.id ? 'sel' : '', 'data-mod': m.id, style: { width: '100%', textAlign: 'left' }, onclick: () => {
                selected = m.id; explain = m.id; draw();
                say(`${m.icon} ${m.name}: ${m.desc} Pesa ${m.mass} t y cuesta ${m.cost} millones.`, { quiet: true, target: '#nave' });
              } }, h('span', { class: 'code' }, MOD_CODE[m.id]), ` ${m.name}`, sc.requiredModules.includes(m.id) ? h('span', { class: 'amber small' }, ' (obligatorio)') : null,
              h('div', { class: 'dim small' }, `${m.mass} t · ${m.kw > 0 ? '+' : ''}${m.kw} kW · 💰${m.cost}`)))))),
          h('div', { class: 'panel c-blue' },
            h('h2', {}, '2. Tu nave ', who('ingeniero')),
            h('div', { class: 'ship', id: 'nave', style: { gridTemplateColumns: `repeat(${GRID.cols}, 1fr)` } },
              ...Array.from({ length: GRID.rows }, (_, y) => Array.from({ length: GRID.cols }, (_, x) => cell(x, y)))),
            h('div', { class: 'help', style: { marginTop: '.3rem' } }, 'Clic derecho sobre una pieza para quitarla.'))) : null,
          tab === 'ciencia' ? h('div', { class: 'panel c-green', id: 'instrumentos' },
            h('h2', {}, '3. Instrumentos de ciencia ', who('cientifico')),
            h('div', { class: 'help' }, `Van dentro del 🔬 laboratorio: usas ${d.instruments.length} de ${instrSlots} lugares.`),
            ...Object.values(INSTRUMENTS).filter((i) => availableIn(i, scn)).map((i) => h('label', { class: 'row small', style: { margin: '.25rem 0' }, title: i.desc },
              h('input', { type: 'checkbox', 'data-ins': i.id, checked: d.instruments.includes(i.id), onchange: (e) => {
                d.instruments = e.target.checked ? [...d.instruments, i.id] : d.instruments.filter((x) => x !== i.id);
                explain = i.id; draw(); say(`${i.icon} ${i.name}: ${i.desc} Da ${i.sciencePerDay} de ciencia por día.`, { quiet: true });
              } }),
              `${i.icon} ${i.name}`, h('span', { class: 'dim' }, `🧪${i.sciencePerDay} · 💰${i.cost}`)))) : null,
          tab === 'cohete' ? h('div', { class: 'panel c-pink', id: 'cohetes' },
            h('h2', {}, '4. Cohete ', who('comandante')),
            ...Object.values(LAUNCHERS).map((l) => h('label', { class: 'row small', style: { margin: '.2rem 0' } },
              h('input', { type: 'radio', name: 'cohete', 'data-launcher': l.id, checked: d.launcher === l.id, onchange: () => {
                d.launcher = l.id; explain = l.id; draw();
                say(`${l.name}: ${l.desc} Sube ${l.capacity} t y funciona bien ${Math.round(l.reliability * 100)} de cada 100 veces.`, { quiet: true });
              } }),
              h('b', {}, l.name), h('span', { class: 'dim' }, `${l.capacity} t · 💰${l.cost} · ${Math.round(l.reliability * 100)} % seguro`))),
            h('h2', { style: { marginTop: '.6rem' } }, scn === 'estacion' ? '5. ¿A dónde? (órbita) ' : '5. ¿Dónde aterrizar? ', who('comandante')),
            ...Object.values(ORBITS).filter((o) => o.scenario === scn).map((o) => h('label', { class: 'row small', style: { margin: '.2rem 0' }, title: o.desc },
              h('input', { type: 'radio', name: 'orbita', 'data-orbit': o.id, checked: d.orbit === o.id, onchange: () => { d.orbit = o.id; explain = o.id; draw(); say(`${o.icon} ${o.name}: ${o.desc}`, { quiet: true }); } }),
              `${o.icon} ${o.name}`, h('span', { class: 'dim' }, o.nightDays ? ` · noche de ${o.nightDays} días${o.ice ? ' · hielo' : ''}` : o.ice ? ' · hielo' : ''))),
            h('div', { class: 'help' }, ORBITS[d.orbit]?.desc ?? '')) : null,
          tab === 'astronautas' ? h('div', { class: 'panel c-cyan', id: 'tripulantes' },
            h('h2', {}, '6. Comida y astronautas ', who('comandante')),
            h('div', { class: 'row small' }, '🍎 Comida para',
              h('input', { type: 'range', id: 'carga', min: 30, max: scn === 'marte' ? 400 : 365, step: 5, value: d.cargoDays, oninput: (e) => { d.cargoDays = Number(e.target.value); draw(); } }),
              h('b', {}, `${d.cargoDays} días`)),
            h('div', { class: 'help' }, sc.resupplyEvery ? `📦 Cada ${sc.resupplyEvery} días llega una nave con más comida… si no explota.` : '📦 A Marte no llega ninguna nave de carga: lleva comida para el viaje de ida (210 días) y algo de reserva. Allá te espera la carga enviada antes, y la nave de regreso trae comida para volver.'),
            h('div', { class: 'capsule', style: { margin: '.4rem 0' } }, ...d.crewRoles.map((role, i) => crewAvatar({ name: `${role}-${i}`, role, alive: true, health: 100, morale: 80, fatigue: 0, radiation: 0, hunger: 0, thirst: 0 }, { size: 52 }))),
            h('div', { class: 'row small' }, ...Object.values(ROLES).map((ro) =>
              h('button', { class: d.crewRoles.includes(ro.id) ? 'sel' : '', 'data-role': ro.id, title: ROLE_DESC[ro.id], onclick: () => {
                const adding = !d.crewRoles.includes(ro.id);
                d.crewRoles = adding ? [...d.crewRoles, ro.id] : d.crewRoles.filter((x) => x !== ro.id);
                explain = ro.id; draw();
                say(`${ROLE_ICON[ro.id]} ${ro.name}: ${ROLE_DESC[ro.id]}. ${adding ? '¡Sube a bordo!' : 'Se queda en la Tierra.'}`, { quiet: true });
              } }, `${ROLE_ICON[ro.id]} ${ro.name}`))),
            h('div', { class: 'small dim' }, `${d.crewRoles.length} astronauta(s). Más gente hace más cosas, pero come más.`),
            h('h2', { style: { marginTop: '.8rem' } }, 'Tripulación asignada'),
            h('div', { class: 'help' }, 'La agencia ya asignó a una persona por puesto. Si quieres elegir mejor, entrevista a los candidatos: cada uno responde 3 preguntas.'),
            h('div', { class: 'hire-grid' }, ...d.crewRoles.map((ro) => {
              const c = d.hires[ro];
              const known = c ? knownAbout(c, d.interviews[c.id] ?? []) : null;
              return h('div', { class: `hire ${c ? '' : 'falta'}` },
                c ? crewAvatar(fresh(c), { size: 56 }) : h('div', { class: 'big-ico' }, '❔'),
                h('div', {},
                  h('div', {}, `${ROLE_ICON[ro]} ${ROLES[ro].name}`),
                  c ? h('div', { class: 'name' }, c.name) : h('div', { class: 'small amber' }, 'Sin contratar'),
                  c ? h('div', { class: 'small dim' }, c.auto ? 'Asignado por la agencia: no sabes cómo es.' : Object.entries(known.stats).map(([k, v]) => `${STAT_ICON[k]}${v}`).join(' ') || 'No le preguntaste nada.') : null,
                  h('button', { class: 'small', 'data-hire': ro, onclick: () => interview(ro) }, c?.auto ? 'Entrevistar (opcional)' : 'Cambiar')));
            }))) : null),
        h('div', {},
          h('div', { class: 'panel c-amber', id: 'tablero' },
            h('h2', {}, '¿Puede volar?'),
            row('🏋️ Peso', r.capacity ? r.mass / r.capacity : 1, `${fmt(r.mass, 1)} de ${fmt(r.capacity, 1)} t`, null, { invert: true, warn: 0.15, danger: 0.0001 }),
            row('💰 Dinero', r.cost / r.budget, `${fmt(r.cost)} de ${fmt(r.budget)}`, null, { invert: true, warn: 0.1, danger: 0.0001 }),
            row('⚡ Electricidad', Math.max(0, Math.min(1, 0.5 + r.energyPerDay / 400)), r.energyPerDay >= 0 ? `sobran ${fmt(r.energyPerDay)}` : `faltan ${fmt(-r.energyPerDay)}`, 'paneles_solares', { warn: 0.55, danger: 0.5 }),
            row('📶 Datos', r.downlinkPerDay ? r.dataPerDay / r.downlinkPerDay : (r.dataPerDay ? 2 : 0), `junta ${fmt(r.dataPerDay)}, manda ${fmt(r.downlinkPerDay)}`, 'satelites_clima', { invert: true, warn: 0.2, danger: 0.0001 }),
            row('🧪 Ciencia', Math.min(1, r.sciencePerDay / 20), `${fmt(r.sciencePerDay)} por día`, null, { warn: 0, danger: 0 }),
            ORBITS[d.orbit]?.nightDays ? row('🌑 Noche', r.nightNeed ? Math.min(1, r.storage / r.nightNeed) : 1, `guarda ${fmt(r.storage)} de ${fmt(r.nightNeed)} kWh`, 'baterias', { warn: 0.999, danger: 0.6 }) : null,
            row('🍎 Comida', d.cargoDays / Math.max(1, r.cargoMax), `${d.cargoDays} de ${r.cargoMax} días`, 'racionamiento', { invert: true, warn: 0, danger: 0 }),
            h('ul', { class: 'plain', id: 'errores' },
              ...r.errors.map((e) => h('li', { class: 'red' }, '❌ ', e)),
              ...r.warnings.map((w) => h('li', { class: 'amber' }, '⚠️ ', w))),
            h('div', { style: { textAlign: 'center', marginTop: '.6rem' } },
              h('button', { class: 'big', id: 'lanzar', disabled: !ok || launching, onclick: launch }, launching ? '☀️ MIRANDO EL CLIMA ESPACIAL…' : '🚀 LANZAR'),
              ' ', who('comandante'))))),
    );
    if (!explain) {
      const [text, mood, target] = coach(d, r);
      const where = TAB_OF(target);
      const elsewhere = where && where !== tab;
      say(elsewhere ? `${text} (Toca la pestaña señalada.)` : text, { mood, target: elsewhere ? `[data-tab="${where}"]` : target, quiet: true });
    }
  };
  draw();
}
