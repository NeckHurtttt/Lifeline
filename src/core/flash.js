// Eventos relámpago: emergencias de pocos segundos en tiempo real. Hay que cerrar las escotillas del módulo
// afectado antes de que se acabe el tiempo; si no, el módulo se pierde (y a veces daña a los vecinos).
// Puro y determinista: el azar sale de un hash de la semilla y el día, así no cambia el resto de la partida.
import { MODULES } from '../data/catalog.js';

/** Módulos que nunca se pierden: sin ellos no hay misión. */
export const CRITICAL = new Set(['cabina', 'soporte_vital', 'modulo_aterrizaje', 'planta_combustible']);

export const FLASH_TYPES = {
  meteorito: {
    icon: '☄️', name: 'Impacto de micrometeorito',
    text: (mod) => `¡Un micrometeorito perforó ${mod}! El aire se escapa: cierren sus escotillas antes de que se vacíe todo.`,
    ok: (mod) => `Escotillas cerradas a tiempo: ${mod} quedó dañado, pero el resto de la nave está a salvo.`,
    fail: (mod) => `No alcanzó el tiempo: se perdió ${mod} y la tripulación respiró aire muy fino.`,
    okDamage: 40, failCrew: 10, failO2: 30, neighborDamage: 0,
  },
  incendio: {
    icon: '🔥', name: 'Fuego a bordo',
    text: (mod) => `¡Fuego en ${mod}! Cierren sus escotillas para ahogarlo sin oxígeno.`,
    ok: (mod) => `El fuego se apagó solo sin oxígeno: ${mod} quedó chamuscado pero se puede reparar.`,
    fail: (mod) => `El fuego se comió ${mod} y el humo dañó los módulos de al lado.`,
    okDamage: 30, failCrew: 8, failO2: 0, neighborDamage: 25,
  },
  escombros: {
    icon: '💥', name: 'Choque con basura espacial',
    text: (mod) => `¡Un pedazo de basura espacial arrancó ${mod}! Ese módulo ya no se salva: cierren sus escotillas para que no se lleve el aire de todos.`,
    ok: (mod) => `Se perdió ${mod}, pero las escotillas cerradas salvaron al resto de la nave.`,
    fail: (mod) => `Se perdió ${mod} y, con las escotillas abiertas, la tripulación se golpeó y los vecinos se dañaron.`,
    alwaysLost: true, okDamage: 0, failCrew: 15, failO2: 40, neighborDamage: 30,
  },
};

const CHANCE = { facil: 0.012, medio: 0.02, dificil: 0.03 };
const SECONDS = { facil: 14, medio: 10, dificil: 7 };
const KIDS_SECONDS = 20;

/** Número pseudoaleatorio [0,1) a partir de la semilla de la partida y una sal. */
function hash01(seed, salt) {
  let t = ((seed >>> 0) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

export const neighborsOf = (s, m) => s.modules.filter((o) => o !== m && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) === 1);
export const doorId = (a, b) => [a, b].sort().join('|');
export const modName = (m) => MODULES[m.type]?.name ?? m.type;

/** Módulos que pueden recibir un evento relámpago. */
export function targets(s) {
  return s.modules.filter((m) => !CRITICAL.has(m.type) && m.health > 0 && neighborsOf(s, m).length > 0);
}

/** Crea un evento relámpago concreto (también lo usan las pruebas y la práctica). */
export function makeFlash(s, type, target) {
  const m = s.modules.find((x) => x.id === target);
  const doors = neighborsOf(s, m).map((o) => doorId(m.id, o.id));
  const base = s.kids ? KIDS_SECONDS : SECONDS[s.difficulty] ?? 10;
  // Cada escotilla de más da un poco más de tiempo.
  const seconds = base + Math.max(0, doors.length - 2) * 2;
  // closed es un objeto (no una lista) para que, en línea, dos personas cerrando a la vez no se pisen.
  return { type, target, doors, closed: {}, seconds, day: s.day };
}

/** Tira el dado del día. No toca s.rng. */
export function rollFlash(state) {
  const s = state;
  if (s.flash || s.pending || s.day < 4 || s.phase !== 'ops') return s;
  const p = (CHANCE[s.difficulty] ?? 0.02) * (s.kids ? 0.6 : 1) * (s.mode === 'demo' ? 2 : 1) * (s.flashBoost ?? 1)
    * Math.min(1, 365 / (s.totalDays || 365)); // misiones largas (Marte): los mismos eventos por misión, no más
  if (hash01(s.seed ?? 1, s.day * 7 + 1) >= p) return s;
  const list = targets(s);
  if (!list.length) return s;
  const types = Object.keys(FLASH_TYPES);
  const type = types[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 2) * types.length)];
  const target = list[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 3) * list.length)].id;
  return { ...s, flash: makeFlash(s, type, target) };
}

/** Cierra una escotilla. */
export function closeDoor(state, id) {
  const f = state.flash;
  if (!f || !f.doors.includes(id) || f.closed?.[id]) return state;
  return { ...state, flash: { ...f, closed: { ...f.closed, [id]: true } } };
}

export const allClosed = (f) => !!f && f.doors.every((d) => f.closed?.[d]);

/** Quita un módulo de la nave para siempre. */
function loseModule(s, m, cause) {
  s.modules = s.modules.filter((x) => x.id !== m.id);
  s.faults = (s.faults ?? []).filter((f) => f.moduleId !== m.id);
  s.lostModules = [...(s.lostModules ?? []), { type: m.type, day: s.day, cause }];
}

/** Termina el evento: con todas las escotillas cerradas sale bien. Puro. */
export function resolveFlash(state) {
  const f = state.flash;
  if (!f) return { state, success: false, log: [], lost: [] };
  const s = structuredClone(state);
  s.flash = null;
  const T = FLASH_TYPES[f.type];
  const m = s.modules.find((x) => x.id === f.target);
  if (!m) return { state: s, success: true, log: [], lost: [] };
  const name = modName(m);
  const success = allClosed(f);
  const lost = [];
  const hurt = (n) => { for (const c of s.crew) if (c.alive && !c.evacuated) c.health = Math.max(1, c.health - n); };
  if (success) {
    if (T.alwaysLost) { loseModule(s, m, T.name); lost.push(m.type); }
    else { m.health = Math.max(0, m.health - T.okDamage); if (m.health === 0) m.on = false; }
    s.reputation = (s.reputation ?? 0) + 2;
  } else {
    const neigh = neighborsOf(s, m);
    if (s.kids && !T.alwaysLost) { m.health = 0; m.on = false; } // en modo niños se rompe, pero se puede reparar
    else { loseModule(s, m, T.name); lost.push(m.type); }
    for (const o of neigh) { o.health = Math.max(0, o.health - T.neighborDamage); if (o.health === 0) o.on = false; }
    hurt(T.failCrew);
    if (T.failO2) s.resources.o2 = Math.max(0, s.resources.o2 - T.failO2);
  }
  const line = `${T.icon} ${success ? T.ok(name) : s.kids && !T.alwaysLost ? `No alcanzó el tiempo: ${name} se rompió. Hace falta 🔧 Reparación.` : T.fail(name)}`;
  s.log = [...(s.log ?? []), { day: s.day, kind: success ? 'bueno' : 'evento', text: line }];
  return { state: s, success, log: [line], lost };
}
