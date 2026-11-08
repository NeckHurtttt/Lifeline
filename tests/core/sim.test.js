import { test } from 'node:test';
import { autoSolve, resolveFlash } from '../../src/core/flash.js';
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
    if (s.flash) { s = resolveFlash(autoSolve(s)).state; continue; }
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
  const m = mk({ difficulty: 'facil', cargoDays: 365 });
  // sin mantenimiento el soporte vital se gasta y recicla peor el agua: alguien tiene que cuidarlo
  m.schedule.c1 = ['mantenimiento', 'ejercicio', 'sueño'];
  m.schedule.c2 = ['reparacion', 'ejercicio', 'sueño'];
  const s = autoplay(m);
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
  assert.equal(rep.score, rep.breakdown.total);
  assert.deepEqual(rep.breakdown.parts.map((p) => p.id), ['rendimiento', 'ciencia', 'eficiencia', 'decisiones', 'equipo']);
  assert.ok(rep.breakdown.parts.every((p) => p.value >= 0 && p.value <= 100));
  assert.ok(rep.score > 0 && rep.score <= 1000);
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

test('el objetivo cambia qué pesa más en el puntaje', () => {
  const s = mk(); s.outcome = { success: true, reason: 'ok' }; s.day = s.totalDays; s.science = 300;
  s.objective = 'ciencia';
  const sci = buildReport(s);
  s.objective = 'tripulacion';
  const crew = buildReport(s);
  // Poca ciencia y todos vivos: "Todos a salvo" puntúa más que "Máxima ciencia".
  assert.ok(crew.score > sci.score, `${crew.score} > ${sci.score}`);
  assert.equal(crew.breakdown.objective, 'tripulacion');
});

test('puntaje: quedarse sin comida baja el uso de recursos', () => {
  const s = mk(); s.outcome = { success: true, reason: 'ok' };
  const ok = buildReport(s).breakdown.parts.find((p) => p.id === 'eficiencia').value;
  s.log = [...(s.log ?? []), { day: 10, text: 'Se acabó la comida', kind: 'aviso' }];
  const bad = buildReport(s).breakdown.parts.find((p) => p.id === 'eficiencia').value;
  assert.equal(ok - bad, 20);
});

test('valor científico: la meta da 70 y superarla en 50 % da 100', () => {
  const s = mk(); s.outcome = { success: true, reason: 'ok' };
  const sci = (v) => { s.science = v; return buildReport(s).breakdown.parts.find((p) => p.id === 'ciencia').value; };
  const goal = buildReport(s).scienceGoal;
  assert.equal(sci(goal), 70);
  assert.equal(sci(goal * 1.5), 100);
  assert.equal(sci(goal / 2), 35);
});

test('si todos vuelven antes por salud, el informe no dice que se perdieron', () => {
  const s = mk({ difficulty: 'facil' });
  for (const c of s.crew) { c.evacuated = true; c.alive = false; }
  const end = checkEnd(s);
  assert.equal(end.success, false);
  assert.match(end.reason, /nadie se perdió/);
});
