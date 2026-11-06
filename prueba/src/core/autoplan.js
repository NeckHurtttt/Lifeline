// Reparto automático de trabajos (modo niños y botón 🪄): mira qué falta y pone a cada uno donde más sirve.
import { TASKS, normalizeSchedule } from './tasks.js';
import { daysLeft } from './sim.js';

const has = (s, type) => s.modules.some((m) => m.type === type && m.health > 0);
const can = (s, job) => !TASKS[job].needsModule || has(s, TASKS[job].needsModule);
const skill = (c, job) => (TASKS[job].stat ? c.stats?.[TASKS[job].stat] ?? 0 : 0);

/** Lista de trabajos que hacen falta hoy, del más urgente al menos. */
export function needs(s) {
  const alive = s.crew.filter((c) => c.alive);
  const left = daysLeft(s);
  const out = [];
  if (alive.some((c) => c.health < 50)) out.push('medico');
  if (s.modules.some((m) => m.health > 0 && m.health < 60)) out.push('reparacion');
  if (left.water < 30) out.push('produccion');
  if (left.food < 30 && can(s, 'cultivo')) out.push('cultivo');
  if ((s.resources.dataStored ?? 0) > 250) out.push('comunicacion');
  for (const j of ['cultivo', 'produccion', 'experimentos', 'mantenimiento']) if (!out.includes(j) && can(s, j)) out.push(j);
  return out;
}

/** @returns {object} estado con un horario nuevo para cada tripulante vivo */
export function autoAssign(state) {
  const s = structuredClone(state);
  const crew = s.crew.filter((c) => c.alive);
  const morning = {};
  const free = crew.filter((c) => {
    if (c.health < 50 || c.fatigue >= 60) { morning[c.id] = 'descanso'; return false; }
    return true;
  });
  for (const job of needs(s)) {
    if (!free.length) break;
    const pool = job === 'medico' ? free.filter((c) => c.health >= 50) : free;
    if (!pool.length) continue;
    const best = pool.reduce((a, b) => (skill(b, job) > skill(a, job) ? b : a));
    morning[best.id] = job;
    free.splice(free.indexOf(best), 1);
  }
  for (const c of free) morning[c.id] = can(s, 'experimentos') ? 'experimentos' : 'mantenimiento';
  for (const c of crew) {
    const afternoon = c.fatigue >= 45 || c.health < 50 ? 'descanso' : 'ejercicio';
    s.schedule[c.id] = normalizeSchedule([morning[c.id], afternoon]);
  }
  return s;
}
