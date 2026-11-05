import test from 'node:test';
import assert from 'node:assert/strict';
import { evaGoNoGo, miniEvaNoGo, isWeekend, expireMeds, exerciseRule } from '../../src/core/protocols.js';
import { applyTasks } from '../../src/core/tasks.js';
import { createMission } from '../../src/core/mission.js';
import { computeDesign } from '../../src/core/design.js';
import { resolveEvent, recommendedOption } from '../../src/core/events.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const design = (cargoDays = 90) => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0)],
  instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero'], cargoDays,
});
const mk = () => {
  const s = createMission({ design: design(), scenarioId: 'estacion', difficulty: 'medio', seed: 9 });
  s.crew.forEach((c) => { c.traits = []; s.schedule[c.id] = ['descanso', 'descanso', 'sueño']; });
  return s;
};

test('EVA: nunca solo, con pre-respiración, sanos y sin tormenta', () => {
  const s = mk();
  const [a, b] = s.crew;
  s.schedule[a.id] = ['eva', 'sueño', 'prerespiracion'];
  let g = evaGoNoGo(s, 0);
  assert.equal(g.go, false);
  assert.equal(g.items.find((i) => i.id === 'pareja').ok, false);
  s.schedule[b.id] = ['eva', 'sueño', 'descanso'];
  g = evaGoNoGo(s, 0);
  assert.equal(g.items.find((i) => i.id === 'pareja').ok, true);
  assert.equal(g.items.find((i) => i.id === 'prerespiracion').ok, false);
  s.schedule[b.id] = ['eva', 'sueño', 'prerespiracion'];
  assert.equal(evaGoNoGo(s, 0).go, true);
  s.alerts.push({ eventId: 'tormenta_solar', etaDays: 1, severity: 'media', prepared: [] });
  assert.equal(evaGoNoGo(s, 0).go, false);
  s.alerts = []; a.fatigue = 80;
  assert.equal(evaGoNoGo(s, 0).go, false);
});

test('una EVA con NO GO no sale: no repara ni recibe radiación', () => {
  const s = mk();
  const a = s.crew[0];
  s.modules.find((m) => m.type === 'paneles').health = 50;
  s.schedule[a.id] = ['eva', 'sueño', 'descanso'];
  const { state, log } = applyTasks(s, createRng(1));
  assert.equal(state.modules.find((m) => m.type === 'paneles').health, 50);
  assert.equal(state.crew[0].radiation, a.radiation);
  assert.ok(log.some((l) => /NO GO/.test(l)));
});

test('minimisión con EVA: NO GO si va uno solo o cansado', () => {
  const s = mk();
  assert.match(miniEvaNoGo(s, [s.crew[0]]), /solo/);
  s.crew[1].fatigue = 90;
  assert.match(miniEvaNoGo(s, [s.crew[0], s.crew[1]]), /cansado/);
  s.crew[1].fatigue = 0;
  assert.equal(miniEvaNoGo(s, [s.crew[0], s.crew[1]]), null);
});

test('fin de semana, medicinas que caducan y regla de ejercicio', () => {
  assert.equal(isWeekend(0), false);
  assert.ok(isWeekend(6) && isWeekend(7) && !isWeekend(8));
  const s = mk();
  s.day = 180; s.resources.meds = 50;
  const log = [];
  expireMeds(s, log);
  assert.equal(s.resources.meds, 30);
  assert.equal(s.medsExpiry, 360);
  s.day = 7; s.reputation = 50; s.flags = { skipped: { [s.crew[0].id]: 2 } };
  exerciseRule(s, new Set(s.crew.slice(1).map((c) => c.id)), log);
  assert.equal(s.reputation, 48);
  assert.ok(log.some((l) => /ejercicio/.test(l)));
});

test('reserva de contingencia y procedimiento de Control de Misión', () => {
  assert.ok(computeDesign(design(60), 'estacion', 'medio').warnings.some((w) => /contingencia/.test(w)));
  assert.ok(!computeDesign(design(90), 'estacion', 'medio').warnings.some((w) => /contingencia/.test(w)));
  const s = mk();
  s.reputation = 50;
  const rec = recommendedOption('reboost', s);
  const other = rec === 'reboost' ? 'esperar' : 'reboost';
  assert.equal(resolveEvent(s, 'reboost', 'leve', rec, createRng(1), []).state.reputation, 51);
  assert.equal(resolveEvent(s, 'reboost', 'leve', other, createRng(1), []).state.reputation <= 49, true);
});
