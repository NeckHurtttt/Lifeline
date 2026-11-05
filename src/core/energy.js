import { MODULES, INSTRUMENTS, ORBITS } from '../data/catalog.js';

const LAST = ['cabina', 'soporte_vital'];

function balance(state, solarFactor, heatKw = 0) {
  const fraction = ORBITS[state.design.orbit].solarFraction;
  let total = -heatKw * 24;
  let labOn = false;
  for (const m of state.modules) {
    if (!m.on) continue;
    const def = MODULES[m.type];
    if (m.type === 'laboratorio') labOn = true;
    let kw = def.kw;
    if (def.solar) kw *= fraction * solarFactor;
    if (m.health < 30) kw *= 0.5;
    total += kw * 24;
  }
  if (labOn) {
    for (const id of state.design.instruments) total += INSTRUMENTS[id].kw * 24;
  }
  return total;
}

// Orden de apagado: prioridad ascendente; cabina y soporte vital después de todo lo demás.
function shedOrder(state) {
  const rank = (m) => (m.type === 'soporte_vital' ? 2 : m.type === 'cabina' ? 1 : 0);
  return state.modules
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.on && MODULES[m.type].kw < 0)
    .sort((a, b) => rank(a.m) - rank(b.m) || a.m.priority - b.m.priority || a.i - b.i)
    .map(({ m }) => m);
}

/**
 * Balance diario de energía. Puro: devuelve {state, shed, log}.
 */
export function applyEnergy(state, { solarFactor = 1, heatKw = 0 } = {}) {
  const s = structuredClone(state);
  const shed = [];
  const log = [];
  let bal = balance(s, solarFactor, heatKw);
  if (s.resources.battery + bal < 0) {
    for (const m of shedOrder(s)) {
      m.on = false;
      shed.push(m.id);
      log.push(`Apagado por falta de energía: ${MODULES[m.type].name}`);
      bal = balance(s, solarFactor, heatKw);
      if (s.resources.battery + bal >= 0) break;
    }
  }
  s.resources.battery = Math.max(0, Math.min(s.resources.batteryMax, s.resources.battery + bal));
  return { state: s, shed, log };
}

export function setPriority(state, moduleId, priority) {
  const s = structuredClone(state);
  const m = s.modules.find((x) => x.id === moduleId);
  if (m) m.priority = priority;
  return s;
}
