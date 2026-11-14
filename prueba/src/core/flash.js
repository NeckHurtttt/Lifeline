// Eventos relámpago: emergencias de pocos segundos en tiempo real. Cada una junta minijuegos:
// escotillas, fuga, válvulas, cables, protocolo, código de memoria, reparto de energía y "en el momento justo".
// Todo se complica con la dificultad (más piezas, menos tiempo, trampas) y en difícil se suma un paso extra.
// Puro y determinista: el azar sale de un hash de la semilla y el día, así no cambia el resto de la partida.
import { MODULES, SCENARIOS } from '../data/catalog.js';
import { FLASH_TYPES, PROTOCOLS, CABLE_COLORS, CABLE_SYSTEMS, POWER_SYSTEMS } from '../data/flashes.js';

export { FLASH_TYPES, PROTOCOLS, CABLE_COLORS, CABLE_SYSTEMS, POWER_SYSTEMS };

/** Módulos que nunca se pierden: sin ellos no hay misión. */
export const CRITICAL = new Set(['cabina', 'soporte_vital', 'modulo_aterrizaje', 'planta_combustible']);

const CHANCE = { facil: 0.012, medio: 0.02, dificil: 0.03 };
const TIME_MULT = { facil: 1.35, medio: 1, dificil: 0.8 };
const LEVEL = { facil: 0, medio: 1, dificil: 2 };
export const WRONG_PENALTY = 2; // segundos que se pierden por un error

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

/** Dónde está la tripulación: 'viaje' (camino a Marte), 'espacio' (órbita) o 'suelo' (Luna o Marte). */
export function placeOf(s) {
  if (s.leg === 'ida' || s.leg === 'vuelta') return 'viaje';
  const sc = SCENARIOS[s.scenarioId];
  if (!sc || sc.orbital) return 'espacio';
  return 'suelo';
}
/** Tipos posibles aquí. */
export function typesFor(s) {
  const place = placeOf(s);
  return Object.keys(FLASH_TYPES).filter((k) => {
    const w = FLASH_TYPES[k].where;
    if (w === 'todo' || w === place) return true;
    if (w === 'espacio') return place === 'viaje';
    if (w === 'luna' || w === 'marte') return place === 'suelo' && s.scenarioId === w;
    return false;
  });
}
/** Pasos del evento según la dificultad (difícil suma el extra; niños, solo el primero). */
export function stepsFor(s, type) {
  const T = FLASH_TYPES[type];
  if (s.kids) return T.steps.slice(0, 1);
  return s.difficulty === 'dificil' && T.extra ? [...T.steps, T.extra] : T.steps;
}
const needsDoors = (s, type) => stepsFor(s, type).includes('doors');

/** Módulos que pueden recibir un evento relámpago de ese tipo. */
export function targets(s, type = 'meteorito') {
  const T = FLASH_TYPES[type];
  if (T.prefer) {
    const pref = s.modules.filter((m) => m.type === T.prefer && m.health > 0 && (!needsDoors(s, type) || neighborsOf(s, m).length));
    if (pref.length) return pref;
  }
  return s.modules.filter((m) => !CRITICAL.has(m.type) && m.health > 0 && (!needsDoors(s, type) || neighborsOf(s, m).length > 0));
}

/** Arma los datos de un paso (un minijuego). */
function makeStep(spec, s, lvl, rnd) {
  const [kind, arg] = spec.split(':');
  const kid = !!s.kids;
  if (kind === 'doors') return { kind };
  if (kind === 'leak') {
    const [w, h] = kid ? [3, 2] : [[3, 3], [4, 3], [5, 3]][lvl];
    // En difícil los sensores tienen ruido: las lecturas mienten un poco (menos el agujero).
    return { kind, w, h, hole: Math.floor(rnd(11) * w * h), probed: {}, blind: arg === 'ciego', noise: !kid && lvl === 2 ? 12 : 0, salt: Math.floor(rnd(12) * 1000) };
  }
  if (kind === 'valves') {
    const n = kid ? 2 : [3, 4, 5][lvl];
    // Válvulas unidas: al girar una también gira la de al lado (como un engranaje).
    const links = kid ? [] : shuffle(n - 1, (i) => rnd(30 + i)).slice(0, lvl).map((i) => [i, i + 1]);
    const target = Array.from({ length: n }, (_, i) => Math.floor(rnd(40 + i) * 4));
    // Se desordena desde la solución con giros hacia atrás: siempre tiene solución.
    const angles = [...target];
    const back = (i) => { for (const j of [i, ...links.filter((l) => l.includes(i)).map((l) => (l[0] === i ? l[1] : l[0]))]) angles[j] = (angles[j] + 3) % 4; };
    for (let k = 0; k < n + lvl * 2; k++) back(Math.floor(rnd(60 + k) * n));
    if (angles.every((a, i) => a === target[i])) back(0);
    return { kind, target, angles, links };
  }
  if (kind === 'cables') {
    const n = kid ? 3 : [3, 4, 5][lvl];
    // right[slot] = cable que va en ese borne. Con nivel ≥ 1 los bornes muestran el sistema, no el color: hay que leer el esquema.
    const systems = shuffle(CABLE_SYSTEMS.length, (i) => rnd(70 + i)).slice(0, n).map((k) => CABLE_SYSTEMS[k]);
    return { kind, n, right: shuffle(n, (i) => rnd(80 + i)), systems, chart: !kid && lvl >= 1, conn: {} };
  }
  if (kind === 'protocol') {
    const len = kid ? 3 : [3, 4, 5][lvl];
    return { kind, name: arg, items: PROTOCOLS[arg].slice(0, len), order: shuffle(len, (i) => rnd(90 + i)), progress: 0, reshuffle: !kid && lvl === 2 };
  }
  if (kind === 'code') {
    const n = kid ? 3 : [4, 5, 6][lvl];
    // Se muestra unos segundos y después hay que teclearlo de memoria. En difícil el teclado está desordenado.
    return { kind, digits: Array.from({ length: n }, (_, i) => Math.floor(rnd(100 + i) * 10)), progress: 0,
      show: kid ? 7 : [5, 4, 3][lvl], pad: !kid && lvl === 2 ? shuffle(10, (i) => rnd(120 + i)) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] };
  }
  if (kind === 'power') {
    const m = kid ? 2 : [3, 4, 5][lvl];
    const names = shuffle(POWER_SYSTEMS.length, (i) => rnd(130 + i)).slice(0, m).map((k) => POWER_SYSTEMS[k]);
    const need = Array.from({ length: m }, (_, i) => 1 + Math.floor(rnd(140 + i) * 4));
    const total = need.reduce((a, b) => a + b, 0);
    let have;
    if (kid || lvl === 0) have = need.map(() => 0); // fácil: solo sumar
    else if (lvl === 1) { // medio: casi todos cortos y uno con de más (hay que quitarle)
      const over = Math.floor(rnd(150) * m);
      have = need.map((x, j) => (j === over ? x + 1 : Math.max(0, x - 1 - Math.floor(rnd(151 + j) * 2))));
    } else { // difícil: toda la energía está repartida mal, hay que quitar a unos para dar a otros
      have = [...need];
      for (let k = 0; k < m + 1; k++) { const a = Math.floor(rnd(160 + k) * m); const b = (a + 1 + Math.floor(rnd(170 + k) * (m - 1))) % m; if (have[a] > 0) { have[a]--; have[b]++; } }
    }
    if (have.reduce((p, q) => p + q, 0) > total || have.every((x, j) => x === need[j])) have = need.map(() => 0);
    // En medio y difícil se muestra en kW: hay que calcular cuántas barras son.
    return { kind, names, need, have, total, unit: kid ? 1 : [1, 0.5, 1.5][lvl] };
  }
  if (kind === 'timing') {
    const need = kid ? 2 : [2, 3, 4][lvl];
    // En difícil la zona cambia de lugar después de cada acierto.
    const centers = Array.from({ length: need }, (_, i) => (lvl === 2 && !kid ? 0.2 + rnd(180 + i) * 0.6 : 0.5));
    return { kind, need, hits: 0, speed: kid ? 0.55 : [0.7, 1, 1.3][lvl], zone: kid ? 0.34 : [0.3, 0.22, 0.16][lvl], centers };
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
    case 'code': return st.show + 2 + 1.1 * st.digits.length;
    case 'power': return 3 + 2 * st.names.length;
    case 'timing': return 2 + 2.6 * st.need;
    default: return 5;
  }
}

/** Crea un evento relámpago concreto (también lo usan las pruebas). */
export function makeFlash(s, type, target) {
  const m = s.modules.find((x) => x.id === target);
  const doors = neighborsOf(s, m).map((o) => doorId(m.id, o.id));
  const lvl = LEVEL[s.difficulty] ?? 1;
  const steps = stepsFor(s, type).map((sp, k) => makeStep(sp, s, lvl, (j) => hash01((s.seed ?? 1) + s.day * 131 + k * 7919, j)));
  const base = steps.reduce((a, st) => a + stepSeconds(st, doors.length), 0);
  const seconds = Math.round(base * (s.kids ? 2 : TIME_MULT[s.difficulty] ?? 1) * (s.flashShort ? 0.75 : 1));
  const hasDoors = steps.some((x) => x.kind === 'doors');
  // En difícil una escotilla está atascada: hay que tocarla dos veces.
  const stuck = hasDoors && lvl === 2 && !s.kids && doors.length ? { [doors[Math.floor(hash01(s.seed ?? 1, s.day * 13 + 5) * doors.length)]]: true } : {};
  // closed y conn son objetos (no listas) para que, en línea, dos personas a la vez no se pisen.
  return { type, target, doors: hasDoors ? doors : [], closed: {}, stuck, half: {}, steps, seconds, penalty: 0, day: s.day };
}

/** Tira el dado del día. No toca s.rng. */
export function rollFlash(state) {
  const s = state;
  if (s.flash || s.pending || s.day < 4 || s.phase !== 'ops') return s;
  const p = (CHANCE[s.difficulty] ?? 0.02) * (s.kids ? 0.6 : 1) * (s.mode === 'demo' ? 2 : 1) * (s.flashBoost ?? 1)
    * Math.min(1, 365 / (s.totalDays || 365)); // misiones largas (Marte): los mismos eventos por misión, no más
  if (hash01(s.seed ?? 1, s.day * 7 + 1) >= p) return s;
  // flashOnly: forzar tipos (para mostrar el juego: ?relampago=incendio,motor en la dirección).
  const types = typesFor(s).filter((t) => targets(s, t).length && (!s.flashOnly || s.flashOnly.includes(t)));
  if (!types.length) return s;
  const type = types[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 2) * types.length)];
  const list = targets(s, type);
  const target = list[Math.floor(hash01(s.seed ?? 1, s.day * 7 + 3) * list.length)].id;
  return { ...s, flash: makeFlash(s, type, target), flashShort: false };
}

// ── Acciones de los minijuegos (todas puras) ──
const withStep = (state, i, fn) => {
  const f = state.flash;
  if (!f?.steps?.[i]) return state;
  const steps = f.steps.map((x, j) => (j === i ? fn(structuredClone(x)) : x));
  return { ...state, flash: { ...f, steps } };
};
const penalize = (state) => ({ ...state, flash: { ...state.flash, penalty: (state.flash.penalty ?? 0) + WRONG_PENALTY } });

/** Cierra una escotilla (la atascada necesita dos toques). */
export function closeDoor(state, id) {
  const f = state.flash;
  if (!f || !f.doors.includes(id) || f.closed?.[id]) return state;
  if (f.stuck?.[id] && !f.half?.[id]) return { ...state, flash: { ...f, half: { ...f.half, [id]: true } } };
  return { ...state, flash: { ...f, closed: { ...f.closed, [id]: true } } };
}
export const allClosed = (f) => !!f && f.doors.every((d) => f.closed?.[d]);

/** Fuga: qué tan fuerte se oye el silbido en una casilla (0-100). 100 = ahí está el agujero. */
export function leakReading(st, cell) {
  if (cell === st.hole) return 100;
  const dx = Math.abs((cell % st.w) - (st.hole % st.w));
  const dy = Math.abs(Math.floor(cell / st.w) - Math.floor(st.hole / st.w));
  const max = st.w + st.h - 2;
  const base = 100 * (1 - (dx + dy) / (max + 1));
  const noise = st.noise ? (hash01(st.salt ?? 1, cell) * 2 - 1) * st.noise : 0;
  return Math.max(0, Math.min(95, Math.round(base + noise)));
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

/** Teclea un dígito del código. Si se equivoca, vuelve a empezar y pierde tiempo. */
export function pressCode(state, i, d) {
  const st = state.flash?.steps?.[i];
  if (!st || st.progress >= st.digits.length) return { state, ok: false };
  if (d !== st.digits[st.progress]) return { state: withStep(penalize(state), i, (x) => { x.progress = 0; return x; }), ok: false };
  return { state: withStep(state, i, (x) => { x.progress++; return x; }), ok: true };
}
/** Volver a mirar el código cuesta tiempo. */
export const peekCode = (state) => penalize(state);

/** Energía: sube o baja una barra de un sistema. No se puede usar más de lo que hay. */
export function adjustPower(state, i, j, delta) {
  const st = state.flash?.steps?.[i];
  if (!st) return state;
  const used = st.have.reduce((a, b) => a + b, 0);
  if (delta > 0 && used >= st.total) return state;
  if (delta < 0 && st.have[j] <= 0) return state;
  return withStep(state, i, (x) => { x.have[j] += delta > 0 ? 1 : -1; return x; });
}

/** En el momento justo: la pantalla decide si la marca estaba en la zona. Fallar cuesta tiempo. */
export function timingPress(state, i, hit) {
  const st = state.flash?.steps?.[i];
  if (!st || st.hits >= st.need) return { state, ok: false };
  if (!hit) return { state: penalize(state), ok: false };
  return { state: withStep(state, i, (x) => { x.hits++; return x; }), ok: true };
}
/** Posición de la marca (0-1) en el segundo t: va y vuelve. */
export function timingPos(st, t) {
  const ph = (t * st.speed / 1.6) % 2;
  return ph < 1 ? ph : 2 - ph;
}
export const timingZone = (st) => st.centers[Math.min(st.hits, st.need - 1)];

export function stepDone(f, st) {
  switch (st.kind) {
    case 'doors': return allClosed(f);
    case 'leak': return !!st.probed[st.hole];
    case 'valves': return st.angles.every((a, j) => a === st.target[j]);
    case 'cables': return Object.keys(st.conn).length === st.n;
    case 'protocol': return st.progress >= st.items.length;
    case 'code': return st.progress >= st.digits.length;
    case 'power': return st.have.every((x, j) => x === st.need[j]);
    case 'timing': return st.hits >= st.need;
    default: return true;
  }
}
export const allDone = (f) => !!f && f.steps.every((st) => stepDone(f, st));
/** Segundos que quedan, con la hora límite y los castigos. */
export const flashLeft = (f, now = Date.now()) => (f.deadline ? Math.max(0, (f.deadline - now) / 1000 - (f.penalty ?? 0)) : f.seconds - (f.penalty ?? 0));

/** Resuelve todos los pasos (para bots, pruebas y el balance). */
export function autoSolve(state) {
  let s = state;
  for (const d of s.flash.doors) { s = closeDoor(s, d); s = closeDoor(s, d); }
  s.flash.steps.forEach((st, i) => {
    if (st.kind === 'leak') s = probeLeak(s, i, st.hole);
    if (st.kind === 'cables') for (let slot = 0; slot < st.n; slot++) s = connectCable(s, i, st.right[slot], slot).state;
    if (st.kind === 'protocol') for (let k = 0; k < st.items.length; k++) s = pressProtocol(s, i, k).state;
    if (st.kind === 'code') for (const d of st.digits) s = pressCode(s, i, d).state;
    if (st.kind === 'timing') for (let k = 0; k < st.need; k++) s = timingPress(s, i, true).state;
    if (st.kind === 'power') {
      st.have.forEach((x, j) => { for (let k = st.need[j]; k < x; k++) s = adjustPower(s, i, j, -1); });
      st.need.forEach((n, j) => { for (let k = s.flash.steps[i].have[j]; k < n; k++) s = adjustPower(s, i, j, 1); });
    }
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
  if (result === 'ok') {
    damage(m, T.okDamage);
    s.reputation = (s.reputation ?? 0) + 1 + f.steps.length;
  } else if (result === 'partial') {
    if (T.partialLost && !s.kids) { loseModule(s, m, T.name); lost.push(m.type); } else damage(m, T.noLose ? 45 : 70);
    hurt(Math.round(T.failCrew / 2));
    if (T.failO2) s.resources.o2 = Math.max(0, s.resources.o2 - T.failO2 / 2);
  } else {
    const neigh = neighborsOf(s, m);
    if (s.kids || T.noLose) damage(m, s.kids ? 100 : 70); // en modo niños se rompe, pero se puede reparar
    else { loseModule(s, m, T.name); lost.push(m.type); }
    for (const o of neigh) damage(o, T.neighborDamage);
    hurt(T.failCrew);
    if (T.failO2) s.resources.o2 = Math.max(0, s.resources.o2 - T.failO2);
  }
  if (result !== 'ok' && T.shortNext) s.flashShort = true;
  let line;
  if (result === 'ok') line = T.ok(name);
  else if (result === 'partial') line = T.partial(name);
  else line = s.kids && !T.noLose ? `No alcanzó el tiempo: el módulo ${name} se rompió. Hace falta 🔧 Reparación.` : T.fail(name);
  line = `${T.icon} ${line}`;
  // Modo jurado: una sola emergencia y se pasa al siguiente paso del recorrido.
  if (s.jurado) { s.juradoFlash = result; s.flashBoost = 0; }
  s.flashStats = { ok: (s.flashStats?.ok ?? 0) + (result === 'ok' ? 1 : 0), total: (s.flashStats?.total ?? 0) + 1 };
  s.log = [...(s.log ?? []), { day: s.day, kind: result === 'ok' ? 'bueno' : 'evento', text: line }];
  return { state: s, success: result === 'ok', result, log: [line], lost };
}
