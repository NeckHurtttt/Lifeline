import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAUNCH_STEPS, checkWeather, goNoGoPoll, runLaunchStep, abortModeAt, applyAbort, scrubLaunch, stepRisk } from '../../src/core/launch.js';
import { createMission } from '../../src/core/mission.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (difficulty = 'medio', launcher = 'condor1') => createMission({
  design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0)],
    instruments: [], launcher, orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
  scenarioId: 'estacion', difficulty, seed: 3,
});
const fail = { chance: () => true, next: () => 0, int: (a) => a, pick: (a) => a[0] };
const pass = { chance: () => false, next: () => 0.99, int: (a, b) => b, pick: (a) => a[0] };

test('pasos ordenados por t y con los 18 ids', () => {
  assert.equal(LAUNCH_STEPS.length, 18);
  for (let i = 1; i < LAUNCH_STEPS.length; i++) assert.ok(LAUNCH_STEPS[i - 1].t < LAUNCH_STEPS[i].t);
  assert.equal(LAUNCH_STEPS[0].id, 'cuarentena');
  assert.equal(LAUNCH_STEPS.at(-1).id, 'acople_estacion');
});

test('modos de aborto según t', () => {
  assert.equal(abortModeAt(-6), 'torre_escape');
  assert.equal(abortModeAt(100), 'torre_escape');
  assert.equal(abortModeAt(300), 'amarizaje');
  assert.equal(abortModeAt(500), 'aborto_orbita');
  assert.equal(abortModeAt(700), null);
});

test('go/no-go: un nogo bloquea y queda en holdouts', () => {
  const s = mk();
  const r = goNoGoPoll(s, { comandante: 'go', piloto: 'nogo', ingeniero: 'go', medico: 'go' });
  assert.equal(r.go, false);
  assert.deepEqual(r.holdouts, ['piloto']);
  assert.equal(goNoGoPoll(s, { comandante: 'go', piloto: 'go', ingeniero: 'go', medico: 'go' }).go, true);
  assert.deepEqual(goNoGoPoll(s, { comandante: 'go' }).holdouts, ['piloto', 'ingeniero', 'medico']);
});

test('clima reproducible con semilla fija', () => {
  const a = Array.from({ length: 20 }, (_, i) => checkWeather(createRng(i), 'dificil'));
  const b = Array.from({ length: 20 }, (_, i) => checkWeather(createRng(i), 'dificil'));
  assert.deepEqual(a, b);
  assert.ok(a.some((w) => !w.go && w.reasons.length > 0));
});

test('riesgo escala con fiabilidad y dificultad', () => {
  const step = LAUNCH_STEPS.find((x) => x.id === 'max_q');
  assert.ok(stepRisk(step, mk('facil')) < stepRisk(step, mk('medio')));
  assert.ok(stepRisk(step, mk('medio')) < stepRisk(step, mk('dificil')));
  assert.ok(stepRisk(step, mk('medio', 'condor1')) < stepRisk(step, mk('medio', 'quetzal5')));
});

test('falla en max_q pide torre de escape; en meco aborto a órbita', () => {
  const s = mk();
  const r = runLaunchStep(s, 'max_q', fail);
  assert.equal(r.ok, false);
  assert.equal(r.abortMode, 'torre_escape');
  assert.ok(r.failure);
  assert.equal(runLaunchStep(s, 'meco', fail).abortMode, 'aborto_orbita');
  assert.equal(runLaunchStep(s, 'max_q', pass).ok, true);
});

test('falla de paneles daña un panel sin abortar', () => {
  const s = mk();
  const r = runLaunchStep(s, 'paneles', fail);
  assert.equal(r.ok, true);
  assert.equal(r.state.modules.find((m) => m.type === 'paneles').health, 50);
  assert.equal(s.modules.find((m) => m.type === 'paneles').health, 100);
});

test('aborto antes de la órbita: misión fallida con tripulación viva', () => {
  const { state } = applyAbort(mk(), 'torre_escape', pass);
  assert.deepEqual(state.outcome, { success: false, reason: 'Aborto en el despegue: tripulación a salvo' });
  assert.ok(state.crew.every((c) => c.alive));
  assert.equal(state.phase, 'report');
});

test('aborto a órbita sigue la misión gastando combustible', () => {
  const s = mk();
  const { state } = applyAbort(s, 'aborto_orbita', pass);
  assert.equal(state.outcome, null);
  assert.ok(state.resources.fuel < s.resources.fuel);
});

test('scrub: −1 día de carga y −3 moral', () => {
  const s = mk();
  const { state } = scrubLaunch(s, 'Rayos a menos de 10 millas');
  assert.ok(state.resources.food < s.resources.food);
  assert.equal(state.crew[0].morale, s.crew[0].morale - 3);
});
