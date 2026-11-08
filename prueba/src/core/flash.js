// Eventos relámpago: emergencias de pocos segundos en tiempo real. Cada una tiene 1 o 2 pasos, y cada paso es un
// minijuego distinto: cerrar escotillas, encontrar la fuga, girar válvulas, conectar cables o seguir el protocolo.
// Puro y determinista: el azar sale de un hash de la semilla y el día, así no cambia el resto de la partida.
import { MODULES, SCENARIOS } from '../data/catalog.js';

/** Módulos que nunca se pierden: sin ellos no hay misión. */
export const CRITICAL = new Set(['cabina', 'soporte_vital', 'modulo_aterrizaje', 'planta_combustible']);

/** Protocolos reales resumidos (orden de la NASA/ISS). */
export const PROTOCOLS = {
  fuego: ['Ponerse las máscaras de oxígeno', 'Apagar la ventilación', 'Cortar la energía del módulo', 'Usar el extintor de CO₂', 'Medir el aire con el sensor'],
  amoniaco: ['Ponerse las máscaras de oxígeno', 'Ir al segmento seguro', 'Aislar el circuito de refrigeración', 'Encender los filtros de aire', 'Medir amoníaco con el sensor'],
  corto: ['Abrir el disyuntor', 'Buscar humo o chispas', 'Cambiar a la batería de respaldo', 'Avisar a Control de Misión', 'Rearmar el disyuntor'],
  polvo: ['Volver todos a la esclusa', 'Sellar la esclusa', 'Retraer los paneles solares', 'Cambiar a baterías', 'Apagar lo que no hace falta'],
};

/** Sistemas a los que van los cables (para el esquema de conexiones). */
export const CABLE_COLORS = ['rojo', 'azul', 'amarillo', 'verde', 'blanco'];
export const CABLE_SYSTEMS = ['Soporte vital', 'Radio', 'Laboratorio', 'Baterías', 'Calefacción'];

export const FLASH_TYPES = {
  meteorito: {
    icon: '☄️', name: 'Impacto de micrometeorito', where: 'todo', steps: ['doors', 'leak'], hiss: true,
    text: (mod) => `¡Un micrometeorito perforó ${mod}! El aire se escapa: cierren sus escotillas y encuentren el agujero para parcharlo.`,
    ok: (mod) => `Escotillas cerradas y agujero parchado: ${mod} quedó dañado, pero el resto de la nave está a salvo.`,
    partial: (mod) => `Se aisló a medias: ${mod} quedó muy dañado y se perdió algo de aire.`,
    fail: (mod) => `No alcanzó el tiempo: se perdió ${mod} y la tripulación respiró aire muy fino.`,
    okDamage: 35, failCrew: 10, failO2: 30, neighborDamage: 0,
  },
  incendio: {
    icon: '🔥', name: 'Fuego a bordo', where: 'todo', steps: ['protocol:fuego', 'doors'],
    text: (mod) => `¡Fuego en ${mod}! Sigan el protocolo de incendio y cierren las escotillas para ahogarlo sin oxígeno.`,
    ok: (mod) => `El fuego se apagó: ${mod} quedó chamuscado pero se puede reparar.`,
    partial: (mod) => `El fuego se apagó tarde: ${mod} quedó casi destruido y hubo humo en la cabina.`,
    fail: (mod) => `El fuego se comió ${mod} y el humo dañó los módulos de al lado.`,
    okDamage: 30, failCrew: 8, failO2: 0, neighborDamage: 25,
  },
  escombros: {
    icon: '💥', name: 'Choque con basura espacial', where: 'espacio', steps: ['doors', 'cables'], hiss: true,
    text: (mod) => `¡Un pedazo de basura espacial golpeó ${mod} y cortó sus cables! Cierren sus escotillas y vuelvan a conectar cada cable a su sistema.`,
    ok: (mod) => `Escotillas cerradas y cables reconectados: ${mod} quedó muy golpeado, pero sigue en su lugar.`,
    partial: (mod) => `Se perdió ${mod}, pero lo que alcanzaron a hacer salvó al resto de la nave.`,
    fail: (mod) => `Se perdió ${mod} y, con las escotillas abiertas, la tripulación se golpeó y los vecinos se dañaron.`,
    partialLost: true, okDamage: 55, failCrew: 15, failO2: 40, neighborDamage: 30,
  },
  amoniaco: {
    icon: '🧪', name: 'Fuga de amoníaco', where: 'espacio', steps: ['valves', 'protocol:amoniaco'],
    text: (mod) => `¡Alarma de amoníaco en ${mod}! El refrigerante es tóxico: giren las válvulas hasta cerrarlo y sigan el protocolo.`,
    ok: (mod) => `Válvulas cerradas: el amoníaco quedó afuera y ${mod} solo necesita una revisión.`,
    partial: (mod) => `Se cerró tarde: ${mod} quedó contaminado y la tripulación tosió un rato.`,
    fail: (mod) => `El amoníaco llenó ${mod}: hubo que abandonarlo y la tripulación se intoxicó.`,
    okDamage: 20, failCrew: 14, failO2: 10, neighborDamage: 10,
  },
  cortocircuito: {
    icon: '🔌', name: 'Cortocircuito', where: 'todo', steps: ['protocol:corto', 'cables'],
    text: (mod) => `¡Cortocircuito en ${mod}! Corten la energía según el protocolo y reconecten los cables a su sistema.`,
    ok: (mod) => `Energía restablecida: ${mod} tiene cables quemados pero funciona.`,
    partial: (mod) => `Se arregló a medias: ${mod} quedó muy dañado.`,
    fail: (mod) => `El cortocircuito quemó ${mod} y saltaron chispas a los módulos de al lado.`,
    okDamage: 25, failCrew: 5, failO2: 0, neighborDamage: 20,
  },
  polvo: {
    icon: '🌪️', name: 'Tormenta de polvo repentina', where: 'marte', steps: ['protocol:polvo', 'valves'],
    text: (mod) => `¡Una tormenta de polvo llega en minutos! Protejan ${mod}: sigan el protocolo y cierren las válvulas de entrada de aire.`,
    ok: (mod) => `Todo sellado a tiempo: la tormenta pasó y ${mod} solo quedó con polvo.`,
    partial: (mod) => `Se selló a medias: entró polvo y ${mod} quedó muy dañado.`,
    fail: (mod) => `La tormenta llenó de polvo ${mod} y dañó lo que estaba al lado.`,
    okDamage: 15, failCrew: 6, failO2: 10, neighborDamage: 20,
  },
  sello: {
    icon: '🫧', name: 'Falla del sello del hábitat', where: 'suelo', steps: ['leak', 'valves'], hiss: true,
    text: (mod) => `¡El sello de ${mod} cede! Encuentren la fuga y desvíen el aire con las válvulas.`,
    ok: (mod) => `Fuga sellada: ${mod} quedó con un parche y nadie se lastimó.`,
    partial: (mod) => `Se selló tarde: ${mod} quedó muy dañado.`,
    fail: (mod) => `El sello reventó: se perdió ${mod} y mucho aire.`,
    okDamage: 25, failCrew: 10, failO2: 35, neighborDamage: 0,
  },
};

const CHANCE = { facil: 0.012, medio: 0.02, dificil: 0.03 };
const TIME_MULT = { facil: 1.35, medio: 1, dificil: 0.8 };
const LEVEL = { facil: 0, medio: 1, dificil: 2 };
export const WRONG_PENALTY = 2; // segundos que se pierden por un cable o un paso equivocado

/** Número pseudoaleatorio [0,1) a partir de la semilla de la partida y una sal. */
function hash01(seed, salt) {
  let t = ((seed >>> 0) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
/** Mezcla determinista de 0..n-1. */
function shuffle(n, rnd) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd(i) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const neighborsOf = (s, m) => s.modules.filter((o) => o !== m && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) === 1);
export const doorId = (a, b) => [a, b].sort().join('|');
export const modName = (m) => MODULES[m.type]?.name ?? m.type;

/** Dónde está la tripulación: en el espacio (órbita o viaje) o en el suelo de la Luna o Marte. */
export function placeOf(s) {
  const sc = SCENARIOS[s.scenarioId];
  if (!sc || sc.orbital || s.leg === 'ida' || s.leg === 'vuelta') return 'espacio';
  return 'suelo';
}
/** Tipos posibles aquí. */
export function typesFor(s) {
  const place = placeOf(s);
  return Object.keys(FLASH_TYPES).filter((k) => {
    const w = FLASH_TYPES[k].where;
    return w === 'todo' || w === place || (w === 'marte' && place === 'suelo' && s.scenarioId === 'marte');
  });
}
const needsDoors = (type) => FLASH_TYPES[type].steps.includes('doors');

/** Módulos que pueden recibir un evento relámpago de ese tipo. */
export function targets(s, type = 'meteorito') {
  return s.modules.filter((m) => !CRITICAL.has(m.type) && m.health > 0 && (!needsDoors(type) || neighborsOf(s, m).length > 0));
}

/** Arma los datos de un paso (un minijuego). */
function makeStep(spec, s, lvl, rnd) {
  const [kind, arg] = spec.split(':');
  if (kind === 'doors') return { kind };
  if (kind === 'leak') {
    const [w, h] = s.kids ? [3, 2] : [[3, 3], [4, 3], [5, 3]][lvl];
    return { kind, w, h, hole: Math.floor(rnd(11) * w * h), probed: {} };
  }
  if (kind === 'valves') {
    const n = s.kids ? 2 : [3, 4, 5][lvl];
    // Válvulas unidas: al girar una también gira la de al lado (como un engranaje).
    const links = s.kids ? [] : shuffle(n - 1, (i) => rnd(30 + i)).slice(0, lvl).map((i) => [i, i + 1]);
    const target = Array.from({ length: n }, (_, i) => Math.floor(rnd(40 + i) * 4));
    // Se desordena desde la solución con giros hacia atrás: siempre tiene solución.
    let angles = [...target];
    const back = (i) => { for (const j of [i, ...links.filter((l) => l.includes(i)).map((l) => (l[0] === i ? l[1] : l[0]))]) angles[j] = (angles[j] + 3) % 4; };
    for (let k = 0; k < n + lvl * 2; k++) back(Math.floor(rnd(60 + k) * n));
    if (angles.every((a, i) => a === target[i])) back(0);
    return { kind, target, angles, links };
  }
  if (kind === 'cables') {
    const n = s.kids ? 3 : [3, 4, 5][lvl];
    // right[slot] = cable que va en ese borne. Con nivel ≥ 1 los bornes muestran el sistema, no el color: hay que leer el esquema.
    const systems = shuffle(CABLE_SYSTEMS.length, (i) => rnd(70 + i)).slice(0, n).map((k) => CABLE_SYSTEMS[k]);
    return { kind, n, right: shuffle(n, (i) => rnd(80 + i)), systems, chart: !s.kids && lvl >= 1, conn: {} };
  }
  if (kind === 'protocol') {
    const all = PROTOCOLS[arg];
    const len = s.kids ? 3 : [3, 4, 5][lvl];
    return { kind, name: arg, items: all.slice(0, len), order: shuffle(len, (i) => rnd(90 + i)), progress: 0, reshuffle: !s.kids && lvl === 2 };
  }
  throw new Error(`Paso desconocido: ${spec}`);
}

/** Segundos que da cada paso. */
function stepSeconds(st, doors) {
  switch (st.kind) {
    case 'doors': return 4 + 1.5 * doors;
    case 'leak': return 3 + 0.6 * st.w * st.h;
    case 'valves': return 2 + 2 * st.angles.length + 2 * st.links.length;
    case 'cables': return 2 + 1.8 * st.n + (st.chart ? 2 : 0);
    case 'protocol': return 2 + 1.6 * st.items.length;
    default: return 5;
  }
}

/** Crea un evento relámpago concreto (también lo usan las pruebas). */
export function makeFlash(s, type, target) {
  const T = FLASH_TYPES[type];
  const m = s.modules.find((x) => x.id === target);
  const doors = neighborsOf(s, m).map((o) => doorId(m.id, o.id));
  const lvl = LEVEL[s.difficulty] ?? 1;
  const rnd = (k) => hash01((s.seed ?? 1) + s.day * 131, k);
  // En modo niños solo hay un paso.
  const specs = s.kids ? T.steps.slice(0, 1) : T.steps;
  const steps = specs.map((sp) => makeStep(sp, s, lvl, rnd));
  const base = steps.reduce((a, st) => a + stepSeconds(st, doors.length), 0);
  const seconds = Math.round(base * (s.kids ? 2 : TIME_MULT[s.difficulty] ?? 1));
  // closed y conn son objetos (no listas) para que, en línea, dos personas a la vez no se pisen.
  return { type, target, doors: steps.some((x) => x.kind === 'doors') ? doors : [], closed: {}, steps, seconds, penalty: 0, day: s.day };
}

/** Tira el dado del día. No toca s.rng. */
export function rollFlash(state) {
  const s = state;
  if (s.flash || s.pending || s.day < 4 || s.phase !== 'ops') return s;
  const p = (CHANCE[s.difficulty] ?? 0.02) * (s.kids ? 0.6 : 1) * (s.mode === 'demo' ? 2 : 1) * (s.flashBoost ?? 1)
    * Math.min(1, 365 / (s.totalDays || 365)); // misiones largas (Marte): los mismos eventos por misión, no más
  if (hash01(s.seed ?? 1, s.day * 7 + 1) >= p) return s;
  // flashOnly: forzar un tipo (para mostrar el juego: ?relampago=cables en la dirección).
  const types = typesFor(s).filter((t) => targets(s, t).length && (!s.flashOnly || s.flashOnly.includes(t)));
  if (!types.length) return s;
  const type = types[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 2) * types.length)];
  const list = targets(s, type);
  const target = list[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 3) * list.length)].id;
  return { ...s, flash: makeFlash(s, type, target) };
}

// ── Acciones de los minijuegos (todas puras) ──
const withStep = (state, i, fn) => {
  const f = state.flash;
  if (!f?.steps?.[i]) return state;
  const steps = f.steps.map((x, j) => (j === i ? fn(structuredClone(x)) : x));
  return { ...state, flash: { ...f, steps } };
};
const penalize = (state) => ({ ...state, flash: { ...state.flash, penalty: (state.flash.penalty ?? 0) + WRONG_PENALTY } });

/** Cierra una escotilla. */
export function closeDoor(state, id) {
  const f = state.flash;
  if (!f || !f.doors.includes(id) || f.closed?.[id]) return state;
  return { ...state, flash: { ...f, closed: { ...f.closed, [id]: true } } };
}
export const allClosed = (f) => !!f && f.doors.every((d) => f.closed?.[d]);

/** Fuga: qué tan fuerte se oye el silbido en una casilla (0-100). 100 = ahí está el agujero. */
export function leakReading(st, cell) {
  const dx = Math.abs((cell % st.w) - (st.hole % st.w));
  const dy = Math.abs(Math.floor(cell / st.w) - Math.floor(st.hole / st.w));
  const max = st.w + st.h - 2;
  return Math.round(100 * (1 - (dx + dy) / (max + 1)));
}
/** Tocar una casilla del casco: mide la presión; si es el agujero, se parcha. */
export const probeLeak = (state, i, cell) => withStep(state, i, (st) => { st.probed[cell] = true; return st; });

/** Gira una válvula un cuarto de vuelta (y las que están unidas a ella). */
export const turnValve = (state, i, v) => withStep(state, i, (st) => {
  for (const j of [v, ...st.links.filter((l) => l.includes(v)).map((l) => (l[0] === v ? l[1] : l[0]))]) st.angles[j] = (st.angles[j] + 1) % 4;
  return st;
});

/** Conecta el cable `wire` al borne `slot`. Si no corresponde, salta una chispa y se pierde tiempo. */
export function connectCable(state, i, wire, slot) {
  const st = state.flash?.steps?.[i];
  if (!st || st.conn[wire] != null || Object.values(st.conn).includes(slot)) return { state, ok: false };
  if (st.right[slot] !== wire) return { state: penalize(state), ok: false };
  return { state: withStep(state, i, (x) => { x.conn[wire] = slot; return x; }), ok: true };
}

/** Aprieta un paso del protocolo. Si no es el que sigue, se pierde tiempo. */
export function pressProtocol(state, i, item) {
  const st = state.flash?.steps?.[i];
  if (!st || st.progress >= st.items.length) return { state, ok: false };
  if (item !== st.progress) return { state: penalize(state), ok: false };
  return { state: withStep(state, i, (x) => { x.progress++; return x; }), ok: true };
}

/** Orden en que se ven los botones del protocolo (en difícil se mezclan de nuevo tras cada acierto). */
export const protocolOrder = (st, seed = 1) => (st.reshuffle && st.progress
  ? shuffle(st.items.length, (k) => hash01(seed + st.progress * 977, k)) : st.order);

export function stepDone(f, st) {
  switch (st.kind) {
    case 'doors': return allClosed(f);
    case 'leak': return !!st.probed[st.hole];
    case 'valves': return st.angles.every((a, j) => a === st.target[j]);
    case 'cables': return Object.keys(st.conn).length === st.n;
    case 'protocol': return st.progress >= st.items.length;
    default: return true;
  }
}
export const allDone = (f) => !!f && f.steps.every((st) => stepDone(f, st));
/** Segundos que quedan, con la hora límite y los castigos. */
export const flashLeft = (f, now = Date.now()) => (f.deadline ? Math.max(0, (f.deadline - now) / 1000 - (f.penalty ?? 0)) : f.seconds - (f.penalty ?? 0));

/** Resuelve todos los pasos (para bots, pruebas y el balance). */
export function autoSolve(state) {
  let s = state;
  const f = () => s.flash;
  for (const d of f().doors) s = closeDoor(s, d);
  f().steps.forEach((st, i) => {
    if (st.kind === 'leak') s = probeLeak(s, i, st.hole);
    if (st.kind === 'cables') for (let slot = 0; slot < st.n; slot++) s = connectCable(s, i, st.right[slot], slot).state;
    if (st.kind === 'protocol') for (let k = 0; k < st.items.length; k++) s = pressProtocol(s, i, k).state;
    if (st.kind === 'valves') {
      // Búsqueda pequeña: cuántas vueltas a cada válvula (0-3); n ≤ 5 → 4^5 = 1024 casos.
      const n = st.angles.length;
      for (let code = 0; code < 4 ** n; code++) {
        const a = [...st.angles];
        for (let v = 0, c = code; v < n; v++, c = Math.floor(c / 4)) {
          const k = c % 4;
          for (const j of [v, ...st.links.filter((l) => l.includes(v)).map((l) => (l[0] === v ? l[1] : l[0]))]) a[j] = (a[j] + k) % 4;
        }
        if (a.every((x, j) => x === st.target[j])) {
          for (let v = 0, c = code; v < n; v++, c = Math.floor(c / 4)) for (let k = 0; k < c % 4; k++) s = turnValve(s, i, v);
          break;
        }
      }
    }
  });
  return s;
}

/** Quita un módulo de la nave para siempre. */
function loseModule(s, m, cause) {
  s.modules = s.modules.filter((x) => x.id !== m.id);
  s.faults = (s.faults ?? []).filter((f) => f.moduleId !== m.id);
  s.lostModules = [...(s.lostModules ?? []), { type: m.type, day: s.day, cause }];
}

/** Termina el evento según cuántos pasos se completaron. Puro. */
export function resolveFlash(state) {
  const f = state.flash;
  if (!f) return { state, success: false, log: [], lost: [] };
  const s = structuredClone(state);
  s.flash = null;
  const T = FLASH_TYPES[f.type];
  const m = s.modules.find((x) => x.id === f.target);
  if (!m) return { state: s, success: true, log: [], lost: [] };
  const name = modName(m);
  const done = f.steps.filter((st) => stepDone(f, st)).length;
  const result = done === f.steps.length ? 'ok' : done > 0 ? 'partial' : 'fail';
  const lost = [];
  const hurt = (n) => { for (const c of s.crew) if (c.alive && !c.evacuated) c.health = Math.max(1, c.health - n); };
  const damage = (mod, n) => { mod.health = Math.max(0, mod.health - n); if (mod.health === 0) mod.on = false; };
  let line;
  if (result === 'ok') {
    damage(m, T.okDamage);
    s.reputation = (s.reputation ?? 0) + 2 + (f.steps.length > 1 ? 1 : 0);
    line = T.ok(name);
  } else if (result === 'partial') {
    if (T.partialLost && !s.kids) { loseModule(s, m, T.name); lost.push(m.type); } else damage(m, 70);
    hurt(Math.round(T.failCrew / 2));
    if (T.failO2) s.resources.o2 = Math.max(0, s.resources.o2 - T.failO2 / 2);
    line = T.partial(name);
  } else {
    const neigh = neighborsOf(s, m);
    if (s.kids) { m.health = 0; m.on = false; } // en modo niños se rompe, pero se puede reparar
    else { loseModule(s, m, T.name); lost.push(m.type); }
    for (const o of neigh) damage(o, T.neighborDamage);
    hurt(T.failCrew);
    if (T.failO2) s.resources.o2 = Math.max(0, s.resources.o2 - T.failO2);
    line = s.kids ? `No alcanzó el tiempo: ${name} se rompió. Hace falta 🔧 Reparación.` : T.fail(name);
  }
  line = `${T.icon} ${line}`;
  s.flashStats = { ok: (s.flashStats?.ok ?? 0) + (result === 'ok' ? 1 : 0), total: (s.flashStats?.total ?? 0) + 1 };
  s.log = [...(s.log ?? []), { day: s.day, kind: result === 'ok' ? 'bueno' : 'evento', text: line }];
  return { state: s, success: result === 'ok', result, log: [line], lost };
}
