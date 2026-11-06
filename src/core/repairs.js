// Reparación en el lugar (idea del equipo, juego "V · Mission Control"): se camina hasta el módulo y se hace
// el procedimiento técnico a mano. No hay azar: el objetivo se ve en el panel y el resultado se sabe antes.
import { createRng } from './rng.js';
import { MODULES } from '../data/catalog.js';

export const FIELD_REPAIRS_PER_DAY = 2;
export const FIELD_REPAIR_GAIN = 25;
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

const repairsToday = (s) => (s.fieldRepairs?.day === s.day ? s.fieldRepairs.count : 0);

/** Por qué no se puede reparar en el lugar (o null si se puede). */
export function fieldRepairBlock(state, moduleId) {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m) return 'no existe ese módulo';
  if (state.phase !== 'ops') return 'solo durante la misión';
  if (m.health >= 100) return 'está sano';
  if (repairsToday(state) >= FIELD_REPAIRS_PER_DAY) return `ya hicieron ${FIELD_REPAIRS_PER_DAY} reparaciones a mano hoy`;
  if ((state.resources.parts ?? 0) < 1) return 'no quedan piezas de repuesto';
  if (!state.crew.some((c) => c.alive && !c.evacuated && c.health >= 30)) return 'nadie está en condiciones';
  return null;
}

/** Aplica la reparación si la respuesta es correcta. Devuelve { state, ok, log }. */
export function applyFieldRepair(state, moduleId, answer) {
  const block = fieldRepairBlock(state, moduleId);
  if (block) return { state, ok: false, log: [`No se puede: ${block}.`] };
  const puzzle = repairPuzzle(state, moduleId);
  if (!checkRepair(puzzle, answer)) return { state, ok: false, log: ['El procedimiento no quedó bien. Revisa el panel y prueba de nuevo.'] };
  const s = clone(state);
  const m = s.modules.find((x) => x.id === moduleId);
  const wasBroken = m.health <= 0;
  const taller = s.modules.some((x) => x.type === 'taller' && x.on && x.health > 0);
  m.health = clamp(m.health + FIELD_REPAIR_GAIN + (taller ? 5 : 0));
  if (wasBroken) { m.on = true; m.offDays = 0; }
  s.resources.parts -= 1;
  s.fieldRepairs = { day: s.day, count: repairsToday(state) + 1 };
  const log = [`Reparación a mano: ${MODULES[m.type]?.name ?? m.type} al ${Math.round(m.health)} %${wasBroken ? ' y encendido de nuevo' : ''}. Se usó 1 pieza.`];
  s.log = [...(s.log ?? []), { day: s.day, text: log[0], kind: 'bueno' }];
  return { state: s, ok: true, log };
}
