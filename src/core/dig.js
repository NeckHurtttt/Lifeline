// EVA de excavación en vista lateral (idea del equipo, juego "Los Tira Vida 02"): terreno de bloques que se
// excava y se construye. Se sale de la esclusa con el traje, se junta material y se vuelve antes de quedarse
// sin oxígeno. Todo determinista: el terreno sale de la semilla y cada acción cuesta lo mismo siempre.
import { createRng } from './rng.js';
import { miniEvaNoGo } from './protocols.js';

export const DIG_COLS = 36;
export const DIG_ROWS = 14;
export const T = { AIRE: 0, REGOLITO: 1, ROCA: 2, HIELO: 3, METAL: 4, RARA: 5, BASE: 6 };
export const TILE_INFO = {
  [T.REGOLITO]: { name: 'Regolito', code: '░', cost: 1, bag: 'regolito' },
  [T.ROCA]: { name: 'Roca dura', code: '▓', cost: 3, bag: null },
  [T.HIELO]: { name: 'Hielo', code: '≈', cost: 2, bag: 'hielo' },
  [T.METAL]: { name: 'Mineral de hierro', code: '◆', cost: 2, bag: 'metal' },
  [T.RARA]: { name: 'Roca rara', code: '✶', cost: 2, bag: 'rara' },
  [T.BASE]: { name: 'Base', code: '█', cost: Infinity, bag: null },
};
/** Lo que vale cada material al volver a la base. */
export const DIG_REWARD = {
  hielo: { water: 25, label: '25 L de agua por bloque (se derrite y se filtra)' },
  metal: { parts: 0.5, label: '1 pieza cada 2 bloques (la impresora 3D la funde)' },
  rara: { science: 3, label: '3 de ciencia por muestra' },
  regolito: { wall: 1, label: '20 bloques levantan el muro de regolito (-40 % radiación)' },
};
export const WALL_BLOCKS = 20;
const SUIT_O2 = { facil: 80, medio: 60, dificil: 45 };
const AIRLOCK_X = 1;

export const canDigHere = (s) => ['luna', 'marte'].includes(s.scenarioId) && !['ida', 'vuelta'].includes(s.leg);
const idx = (x, y) => y * DIG_COLS + x;

/** Genera el terreno del sitio (uno por misión). */
export function genTerrain(seed, scenarioId) {
  const rng = createRng(((seed ?? 1) ^ 0x2545f491) >>> 0);
  const tiles = new Array(DIG_COLS * DIG_ROWS).fill(T.AIRE);
  const surface = [];
  let h = 5;
  for (let x = 0; x < DIG_COLS; x++) {
    if (x > 3) h = Math.max(4, Math.min(7, h + rng.int(-1, 1)));
    surface[x] = x <= 3 ? 5 : h;
    for (let y = surface[x]; y < DIG_ROWS; y++) tiles[idx(x, y)] = y >= DIG_ROWS - 1 ? T.BASE : y < surface[x] + 2 ? T.REGOLITO : T.ROCA;
  }
  const veins = [[T.HIELO, scenarioId === 'luna' ? 7 : 5], [T.METAL, 6], [T.RARA, 4]];
  for (const [type, n] of veins) {
    for (let i = 0; i < n; i++) {
      const x = rng.int(5, DIG_COLS - 2);
      const y = rng.int(surface[x] + 1, DIG_ROWS - 2);
      tiles[idx(x, y)] = type;
      if (rng.chance(0.6) && x + 1 < DIG_COLS) tiles[idx(x + 1, y)] = type;
    }
  }
  for (let y = 0; y < surface[0]; y++) tiles[idx(0, y)] = T.BASE; // pared de la base, la esclusa está al lado
  return { tiles, surface };
}

/** Prepara el estado de la excavación si no existe. Devuelve un estado nuevo. */
export function ensureTerrain(state) {
  if (state.dig) return state;
  const s = structuredClone(state);
  const t = genTerrain(s.seed, s.scenarioId);
  s.dig = { tiles: t.tiles, lastDay: -1, wall: 0, outing: null };
  return s;
}

/** Por qué no se puede salir hoy (o null). */
export function digBlock(state, crew) {
  if (!canDigHere(state)) return 'solo en la superficie de la Luna o Marte';
  if (state.phase !== 'ops') return 'solo durante la misión';
  if (state.dig?.lastDay === state.day) return 'ya hubo una salida de excavación hoy';
  return miniEvaNoGo(state, crew);
}

const groundY = (tiles, x, fromY) => { let y = fromY; while (y + 1 < DIG_ROWS && tiles[idx(x, y + 1)] === T.AIRE) y++; return y; };

/** Empieza una salida con 2 tripulantes. Devuelve { state, ok, log }. */
export function startOuting(state, crewIds) {
  let s = ensureTerrain(state);
  const crew = s.crew.filter((c) => crewIds.includes(c.id) && c.alive && !c.evacuated);
  const block = digBlock(s, crew);
  if (block) return { state, ok: false, log: [`NO GO: ${block}.`] };
  s = structuredClone(s);
  const y = groundY(s.dig.tiles, AIRLOCK_X, 0);
  s.dig.outing = { crewIds: crew.map((c) => c.id), x: AIRLOCK_X, y, o2: SUIT_O2[s.difficulty] ?? 60, bag: { regolito: 0, hielo: 0, metal: 0, rara: 0 }, carry: 0 };
  s.dig.lastDay = s.day;
  return { state: s, ok: true, log: ['GO para la EVA de excavación. Salen por la esclusa.'] };
}

function settle(d) { d.outing.y = groundY(d.tiles, d.outing.x, d.outing.y); }

/** Moverse un paso (dx = -1 o 1). Sube escalones de un bloque. */
export function move(state, dx) {
  const s = structuredClone(state); const d = s.dig; const o = d.outing;
  if (!o) return s;
  const nx = o.x + dx;
  if (nx < 0 || nx >= DIG_COLS) return s;
  if (d.tiles[idx(nx, o.y)] === T.AIRE) o.x = nx;
  else if (o.y > 0 && d.tiles[idx(nx, o.y - 1)] === T.AIRE && d.tiles[idx(o.x, o.y - 1)] === T.AIRE) { o.x = nx; o.y -= 1; }
  else return s;
  o.o2 -= 1;
  settle(d);
  return s;
}

const near = (o, x, y) => Math.abs(x - o.x) <= 1 && Math.abs(y - o.y) <= 1 && !(x === o.x && y === o.y);

/** Excavar un bloque vecino. Cuesta oxígeno según la dureza. */
export function mine(state, x, y) {
  const s = structuredClone(state); const d = s.dig; const o = d.outing;
  if (!o || x < 0 || y < 0 || x >= DIG_COLS || y >= DIG_ROWS || !near(o, x, y)) return s;
  const info = TILE_INFO[d.tiles[idx(x, y)]];
  if (!info || !Number.isFinite(info.cost)) return s;
  o.o2 -= info.cost;
  d.tiles[idx(x, y)] = T.AIRE;
  if (info.bag) o.bag[info.bag] += 1;
  settle(d);
  return s;
}

/** Poner un bloque de regolito de la bolsa en un hueco vecino (escalón o techo). */
export function place(state, x, y) {
  const s = structuredClone(state); const d = s.dig; const o = d.outing;
  if (!o || !near(o, x, y) || x < 0 || y < 0 || x >= DIG_COLS || y >= DIG_ROWS) return s;
  if (d.tiles[idx(x, y)] !== T.AIRE || o.bag.regolito < 1) return s;
  d.tiles[idx(x, y)] = T.REGOLITO;
  o.bag.regolito -= 1;
  o.o2 -= 1;
  return s;
}

export const atAirlock = (state) => state.dig?.outing && state.dig.outing.x <= AIRLOCK_X + 1;

/** Lo que daría la bolsa al volver. */
export function bagValue(bag, wallNow = 0) {
  const wall = Math.min(WALL_BLOCKS, wallNow + bag.regolito);
  return { water: bag.hielo * DIG_REWARD.hielo.water, parts: Math.floor(bag.metal * DIG_REWARD.metal.parts), science: bag.rara * DIG_REWARD.rara.science, wall };
}

/**
 * Termina la salida. En la esclusa se guarda todo; si se acabó el oxígeno, vuelven de emergencia,
 * pierden la mitad de la bolsa y los dos tripulantes se lastiman.
 */
export function endOuting(state) {
  const s = structuredClone(state); const d = s.dig; const o = d.outing;
  if (!o) return { state, log: [] };
  const emergency = o.o2 <= 0 || !atAirlock(s);
  const bag = { ...o.bag };
  if (emergency) for (const k of Object.keys(bag)) bag[k] = Math.floor(bag[k] / 2);
  const v = bagValue(bag, d.wall);
  s.resources.water += v.water;
  s.resources.parts += v.parts;
  s.resources.science += v.science;
  d.wall = v.wall;
  const log = [];
  if (d.wall >= WALL_BLOCKS && !s.flags?.regolithWall) { s.flags = { ...(s.flags ?? {}), regolithWall: true }; log.push('Muro de regolito terminado: la radiación en la base baja 40 %.'); }
  if (emergency) {
    for (const c of s.crew) if (o.crewIds.includes(c.id)) c.health = Math.max(1, c.health - 15);
    log.unshift('Regreso de emergencia: se acabó el oxígeno del traje o no llegaron a la esclusa. Se perdió la mitad del material y hubo golpes.');
  }
  log.push(`Material guardado: +${v.water} L de agua, +${v.parts} piezas, +${v.science} de ciencia, muro ${d.wall}/${WALL_BLOCKS}.`);
  d.outing = null;
  s.log = [...(s.log ?? []), { day: s.day, text: log.join(' '), kind: emergency ? 'evento' : 'bueno' }];
  return { state: s, log };
}
