// Modo jurado: un recorrido de ~3 minutos por lo más fuerte del juego (nave lista, despegue,
// una emergencia relámpago) y luego se adelanta el resto del año como lo jugaría alguien atento.
import { advanceDay } from './sim.js';
import { autoAssign } from './autoplan.js';
import { autoSolve, resolveFlash } from './flash.js';
import { resolveEvent, recommendedOption } from './events.js';
import { phaseDue, resolvePhase } from './mars.js';
import { restoreRng } from './rng.js';

/** Paso del recorrido (1 diseño, 2 despegue, 3 emergencia, 4 adelantar, 5 informe). */
export function juradoStep(s, screen) {
  if (!s || screen === 'design') return 1;
  if (screen === 'launch') return 2;
  if (screen === 'report') return 5;
  if (!s.juradoFlash) return 3;
  return 4;
}

/** Corre el resto de la misión decidiendo lo recomendado. Puro (no toca `state`). */
export function fastForward(state, maxDays = 2000) {
  let s = structuredClone(state);
  for (let i = 0; i < maxDays && s.phase === 'ops'; i++) {
    const due = phaseDue(s);
    if (due) { s = resolvePhase(s, due).state; continue; }
    if (s.flash) { s = resolveFlash(autoSolve(s)).state; continue; }
    if (s.pending) {
      const rng = restoreRng(s.rng);
      const opt = recommendedOption(s.pending.eventId, s);
      s = { ...resolveEvent(s, s.pending.eventId, s.pending.severity, opt, rng).state, rng: rng.state() };
      continue;
    }
    s.minis = (s.minis ?? []).map((m) => (m.status === 'oferta' ? { ...m, status: 'vencida' } : m));
    s = advanceDay(autoAssign(s)).state;
  }
  return s;
}
