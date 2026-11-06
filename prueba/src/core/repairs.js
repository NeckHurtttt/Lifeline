// Reparación en el lugar (idea del equipo, juego "V · Mission Control"): se camina hasta el módulo y se hace
// el procedimiento técnico a mano. No hay azar: el objetivo se ve en el panel y el resultado se sabe antes.
import { createRng } from './rng.js';
import { MODULES } from '../data/catalog.js';

export const FIELD_REPAIRS_PER_DAY = 2;
export const FIELD_REPAIR_GAIN = 25;
/** Días que hay para arreglar a mano una avería de un evento antes de que empeore. */
export const FAULT_DAYS = { facil: 4, medio: 3, dificil: 2 };
export const FAULT_WORSEN = 15;
/** Bloques de regolito (de Excavar) que pide un parche sinterizado en lugar de 1 pieza. */
export const REGOLITH_PATCH = 3;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const clone = (s) => structuredClone(s);

const ENERGY = new Set(['paneles', 'baterias', 'reactor', 'pila_regenerativa']);
const FLUIDS = new Set(['extractor_hielo', 'planta_combustible', 'enfermeria']);
const RADIO = new Set(['antena', 'radar']);

/** Qué procedimiento pide cada módulo. Determinista por semilla, día y módulo. */
export function repairPuzzle(state, moduleId) {
  const idx = state.modules.findIndex((m) => m.id === moduleId);
  const m = state.modules[idx];
  if (!m) return null;
  const rng = createRng(((state.seed ?? 1) * 7919 + state.day * 131 + idx * 17) >>> 0);
  const t = m.type;
  if (t === 'soporte_vital' || t === 'cabina') {
    const start = 94 + rng.int(0, 4);
    return { kind: 'ajuste', title: 'Presión de cabina', unit: 'kPa', target: 101, start, step: 1, min: 90, max: 110,
      text: 'Lleva la presión de la cabina a 101 kPa, la misma que al nivel del mar (la de la estación espacial).' };
  }
  if (RADIO.has(t)) {
    const target = [2210, 2240, 2265, 2280][rng.int(0, 3)];
    return { kind: 'ajuste', title: 'Sintonía de banda S', unit: 'MHz', target, start: target - 25 - 5 * rng.int(0, 4), step: 5, min: 2180, max: 2300,
      text: `Control de Misión transmite en ${target} MHz. Sintoniza esa frecuencia para recuperar el enlace.` };
  }
  if (t === 'refugio') {
    return { kind: 'ajuste', title: 'Blindaje del refugio', unit: 'cm de agua', target: 20, start: 10, step: 2, min: 0, max: 30,
      text: 'Llena las paredes del refugio con 20 cm de agua: el agua frena la radiación solar.' };
  }
  if (t === 'invernadero') {
    const sick = new Set();
    while (sick.size < 2 + rng.int(0, 1)) sick.add(rng.int(0, 5));
    return { kind: 'plantas', title: 'Plantas con hongos', cells: 6, sick: [...sick].sort((a, b) => a - b),
      text: 'Retira solo las plantas con manchas de hongo (marcadas con *). Si quitas una sana, se pierde.' };
  }
  let steps;
  if (ENERGY.has(t)) steps = rng.chance(0.5) ? ['AISLAR BUS', 'CAMBIAR FUSIBLE', 'CONECTAR', 'PROBAR CARGA'] : ['AISLAR BUS', 'CONECTAR', 'CAMBIAR FUSIBLE', 'PROBAR CARGA'];
  else if (FLUIDS.has(t)) steps = ['CERRAR VÁLVULA', 'PURGAR', 'CAMBIAR FILTRO', 'ABRIR VÁLVULA'];
  else steps = ['APAGAR', 'CAMBIAR PIEZA', 'ENCENDER', 'PROBAR'];
  return { kind: 'secuencia', title: 'Procedimiento', steps,
    text: `Sigue el procedimiento de ${MODULES[t]?.name ?? t} en orden. Un paso fuera de orden obliga a empezar de nuevo.` };
}

/** ¿La respuesta resuelve el procedimiento? */
export function checkRepair(puzzle, answer) {
  if (!puzzle) return false;
  if (puzzle.kind === 'ajuste') return Number(answer) === puzzle.target;
  if (puzzle.kind === 'plantas') return Array.isArray(answer) && answer.length === puzzle.sick.length && [...answer].sort((a, b) => a - b).every((v, i) => v === puzzle.sick[i]);
  if (puzzle.kind === 'secuencia') return Array.isArray(answer) && answer.length === puzzle.steps.length && answer.every((v, i) => v === puzzle.steps[i]);
  return false;
}

/** Los módulos eléctricos y de radio necesitan piezas; el resto acepta un parche de regolito. */
export const acceptsRegolith = (type) => !ENERGY.has(type) && !RADIO.has(type);
export const regolithStock = (s) => s.dig?.stock ?? 0;

/** Anota una avería con plazo (la llama el evento que dañó el módulo). Muta el estado. */
export function addFault(s, m) {
  s.faults ??= [];
  if (s.faults.some((f) => f.moduleId === m.id)) return;
  s.faults.push({ moduleId: m.id, day: s.day, deadline: s.day + (FAULT_DAYS[s.difficulty] ?? 3) });
}
export const faultOf = (s, moduleId) => s.faults?.find((f) => f.moduleId === moduleId) ?? null;

/** Fin del día: las averías vencidas empeoran; las sanadas se borran. Muta el estado y devuelve el registro. */
export function tickFaults(s) {
  const log = [];
  s.faults = (s.faults ?? []).filter((f) => {
    const m = s.modules.find((x) => x.id === f.moduleId);
    if (!m || m.health >= 100) return false;
    if (s.day <= f.deadline) return true;
    m.health = clamp(m.health - FAULT_WORSEN);
    if (m.health <= 0) m.on = false;
    log.push(`La avería de ${MODULES[m.type]?.name ?? m.type} empeoró por no repararla a tiempo (-${FAULT_WORSEN} %).`);
    return false;
  });
  return log;
}

const repairsToday = (s) => (s.fieldRepairs?.day === s.day ? s.fieldRepairs.count : 0);

/** Por qué no se puede reparar en el lugar (o null si se puede). */
export function fieldRepairBlock(state, moduleId, pay = 'parts') {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m) return 'no existe ese módulo';
  if (state.phase !== 'ops') return 'solo durante la misión';
  if (m.health >= 100) return 'está sano';
  if (repairsToday(state) >= FIELD_REPAIRS_PER_DAY) return `ya hicieron ${FIELD_REPAIRS_PER_DAY} reparaciones a mano hoy`;
  if (pay === 'regolito') {
    if (!acceptsRegolith(m.type)) return 'los equipos eléctricos y de radio necesitan piezas, no regolito';
    if (regolithStock(state) < REGOLITH_PATCH) return `hacen falta ${REGOLITH_PATCH} bloques de regolito guardados (sale de Excavar)`;
  } else if ((state.resources.parts ?? 0) < 1) return 'no quedan piezas de repuesto';
  if (!state.crew.some((c) => c.alive && !c.evacuated && c.health >= 30)) return 'nadie está en condiciones';
  return null;
}

/** Aplica la reparación si la respuesta es correcta. Devuelve { state, ok, log }. */
export function applyFieldRepair(state, moduleId, answer, pay = 'parts') {
  const block = fieldRepairBlock(state, moduleId, pay);
  if (block) return { state, ok: false, log: [`No se puede: ${block}.`] };
  const puzzle = repairPuzzle(state, moduleId);
  if (!checkRepair(puzzle, answer)) return { state, ok: false, log: ['El procedimiento no quedó bien. Revisa el panel y prueba de nuevo.'] };
  const s = clone(state);
  const m = s.modules.find((x) => x.id === moduleId);
  const wasBroken = m.health <= 0;
  const taller = s.modules.some((x) => x.type === 'taller' && x.on && x.health > 0);
  m.health = clamp(m.health + FIELD_REPAIR_GAIN + (taller ? 5 : 0));
  if (wasBroken) { m.on = true; m.offDays = 0; }
  if (pay === 'regolito') s.dig.stock -= REGOLITH_PATCH; else s.resources.parts -= 1;
  s.fieldRepairs = { day: s.day, count: repairsToday(state) + 1 };
  const used = pay === 'regolito' ? `un parche de ${REGOLITH_PATCH} bloques de regolito sinterizado` : '1 pieza';
  const log = [`Reparación a mano: ${MODULES[m.type]?.name ?? m.type} al ${Math.round(m.health)} %${wasBroken ? ' y encendido de nuevo' : ''}. Se usó ${used}.`];
  if (faultOf(s, moduleId)) {
    s.faults = s.faults.filter((f) => f.moduleId !== moduleId);
    s.reputation = clamp((s.reputation ?? 50) + 2);
    log.push('Avería resuelta a tiempo: Control de Misión lo nota (+2 fama).');
  }
  s.log = [...(s.log ?? []), { day: s.day, text: log.join(' '), kind: 'bueno' }];
  return { state: s, ok: true, log };
}
