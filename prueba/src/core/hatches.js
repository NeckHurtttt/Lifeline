// Puzle de escotillas (despresurización): la tripulación cierra escotillas módulo por módulo hasta aislar la fuga.
// Determinista: la fuga está en un módulo que sale de la semilla y el día. Cada escotilla mal cerrada gasta tiempo de reserva.
import { MODULES } from '../data/catalog.js';
import { resolveEvent, applyEffects } from './events.js';

export const WRONG_COST_S = 8; // segundos de reserva que se pierden por cada intento fallido

/** Módulo donde está la fuga (nunca la cabina: ahí se refugia la tripulación). */
export function leakModule(state) {
  const cand = state.modules.filter((m) => m.type !== 'cabina' && m.health > 0);
  if (!cand.length) return null;
  return cand[(state.seed + state.day * 7) % cand.length];
}

/** Pista del sensor: en qué mitad de la nave se oye el silbido del aire. */
export function hatchClue(state) {
  const leak = leakModule(state);
  if (!leak) return null;
  const xs = state.modules.map((m) => m.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const lado = leak.x < mid ? 'izquierda' : leak.x > mid ? 'derecha' : 'centro';
  const fila = leak.y === 0 ? 'de arriba' : `de la fila ${leak.y + 1}`;
  return { lado, text: `El sensor de presión marca la caída más rápida hacia la ${lado === 'centro' ? 'parte central' : lado} de la nave, en los módulos ${fila}.` };
}

/** Prueba cerrar la escotilla de un módulo. */
export function tryHatch(state, moduleId) {
  const leak = leakModule(state);
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m || !leak) return { found: false, text: 'No hay escotilla ahí.' };
  if (m.id === leak.id) return { found: true, text: `Escotilla de ${MODULES[m.type].name} cerrada: la presión se estabiliza. ¡Fuga aislada!` };
  return { found: false, text: `Escotilla de ${MODULES[m.type].name} cerrada: la presión sigue bajando. No era ahí (−${WRONG_COST_S} s).` };
}

/** Resuelve la despresurización por el puzle: fuga aislada a tiempo, o se acabó la reserva. */
export function resolveHatches(state, found, rng) {
  const p = state.pending;
  if (!found) return resolveEvent(state, 'despresurizacion', p.severity, 'tarde', rng);
  const leak = leakModule(state);
  const r = resolveEvent(state, 'despresurizacion', p.severity, 'aislado', rng);
  const s = applyEffects(r.state, { moduleOff: { [leak.type]: 4 } });
  return { state: s, log: [...r.log, `${MODULES[leak.type].name} queda sellado 4 días mientras se repara.`] };
}
