import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceDay, runUntilInterrupt, checkEnd } from '../../src/core/sim.js';
import { resolveEvent, recommendedOption } from '../../src/core/events.js';
import { createMission } from '../../src/core/mission.js';
import { LESSONS } from '../../src/data/lessons.js';
import { buildReport } from '../../src/core/report.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = ({ difficulty = 'medio', cargoDays = 90, seed = 1, extra = [] } = {}) => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 4, 0), ...extra],
      instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays },
    scenarioId: 'estacion', difficulty, seed,
  });
  s.phase = 'ops';
  return s;
};

// Avanza resolviendo todo con la opción recomendada, hasta fin o reentrada.
function autoplay(s) {
  for (let i = 0; i < 2000 && s.phase === 'ops'; i++) {
    if (s.pending) { s = resolveEvent(s, s.pending.eventId, s.pending.severity, recommendedOption(s.pending.eventId), { int: () => 5, chance: () => false, next: () => 0.5 }).state; continue; }
    s = runUntilInterrupt(s).state;
  }
  return s;
}

test('sin comida se detiene con aviso de recurso antes de que alguien muera', () => {
  const s = mk(); s.resources.food = 0;
  const r = runUntilInterrupt(s);
  assert.equal(r.interrupt.kind, 'recurso');
  assert.ok(r.state.crew.every((c) => c.alive));
});

test('todos mueren el mismo día: se detiene y la misión falla (Review Focus 2)', () => {
  const s = mk();
  for (const c of s.crew) c.health = 1;
  s.resources.o2 = 0;
  s.modules.find((m) => m.type === 'soporte_vital').on = false;
  const r = runUntilInterrupt(s);
  assert.equal(r.state.day, 1);
  assert.equal(r.interrupt.kind, 'fin');
  assert.equal(checkEnd(r.state).success, false);
  assert.equal(r.state.outcome.reason, 'Toda la tripulación se perdió');
});

test('misión mínima con 365 días de carga en fácil llega a la reentrada', () => {
  const s = autoplay(mk({ difficulty: 'facil', cargoDays: 365 }));
  assert.equal(s.phase, 'reentry');
  assert.equal(s.day, 365);
  assert.equal(s.history.length, 365);
});

test('horario sin sueño bloquea el avance', () => {
  const s = mk(); s.schedule.c1 = ['trabajo', 'trabajo', 'ejercicio'];
  const r = advanceDay(s);
  assert.equal(r.interrupt.kind, 'horario');
  assert.equal(r.state.day, 0);
});

test('determinista con la misma semilla', () => {
  assert.deepEqual(runUntilInterrupt(mk({ seed: 9 })).state, runUntilInterrupt(mk({ seed: 9 })).state);
});

test('informe con comida agotada nombra la comida', () => {
  const s = mk(); s.resources.food = 0; s.nextResupply = 9999;
  const end = autoplay(s);
  const rep = buildReport(end);
  assert.ok(rep.causes.some((c) => c.includes('comida')));
  assert.equal(rep.causes.length, rep.suggestions.length);
  for (const id of rep.lessons) assert.ok(LESSONS[id], id);
});

test('puntaje y medalla', () => {
  const s = mk(); s.outcome = { success: true, reason: 'ok' }; s.science = 3000; s.reputation = 50;
  const rep = buildReport(s);
  assert.equal(rep.score, 4 * 1000 + 30000 + 250);
  assert.equal(rep.scienceGoal, 2920);
  assert.equal(rep.medal, 'oro');
  s.science = 1500;
  assert.equal(buildReport(s).medal, 'plata');
  s.science = 400;
  assert.equal(buildReport(s).medal, 'bronce');
  s.science = 3000;
  s.crew[0].alive = false; s.crew[1].alive = false; s.crew[2].alive = false;
  assert.equal(buildReport(s).medal, 'bronce');
});
