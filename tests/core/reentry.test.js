import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REENTRY_STEPS, runReentryStep, heatShieldRisk } from '../../src/core/reentry.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (difficulty = 'medio') => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0)],
      instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
    scenarioId: 'estacion', difficulty, seed: 4,
  });
  s.phase = 'reentry'; s.day = 365;
  return s;
};
const cabin = (s) => s.modules.find((m) => m.type === 'cabina');
const fail = { chance: () => true, next: () => 0, int: (a) => a, pick: (a) => a[0] };
const pass = { chance: () => false, next: () => 0.99, int: (a, b) => b, pick: (a) => a[0] };

test('pasos en el orden real', () => {
  assert.deepEqual(REENTRY_STEPS.map((s) => s.id), ['desacople', 'encendido_salida', 'sep_modulo_servicio', 'interfaz_entrada',
    'apagon_plasma', 'escudo_termico', 'paracaidas_freno', 'paracaidas_principales', 'amerizaje', 'recuperacion']);
});

test('riesgo del escudo según salud de la cabina', () => {
  const s = mk();
  assert.equal(heatShieldRisk(s), 0);
  cabin(s).health = 40;
  assert.ok(Math.abs(heatShieldRisk(s) - 0.3) < 1e-9);
});

test('sin combustible no hay encendido de salida y se pierde un día', () => {
  const s = mk(); s.resources.fuel = 5;
  const r = runReentryStep(s, 'encendido_salida', pass);
  assert.equal(r.ok, false);
  assert.ok(r.log.join(' ').includes('combustible'));
  assert.equal(r.state.day, 366);
  const ok = runReentryStep(mk(), 'encendido_salida', pass);
  assert.equal(ok.ok, true);
  assert.equal(ok.state.resources.fuel, 90);
});

test('falla grave del escudo: todos mueren', () => {
  const s = mk('dificil'); cabin(s).health = 0;
  const r = runReentryStep(s, 'escudo_termico', { ...fail, next: () => 0.99 });
  assert.ok(r.state.crew.every((c) => !c.alive));
  assert.deepEqual(r.state.outcome, { success: false, reason: 'Falla del escudo térmico en la reentrada' });
});

test('paracaídas principal fallido: amerizaje duro −20 salud', () => {
  const s = mk();
  const r = runReentryStep(s, 'paracaidas_principales', fail);
  assert.equal(r.ok, true);
  assert.equal(r.state.crew[0].health, s.crew[0].health - 20);
});

test('entrada rasante con rebote añade un día', () => {
  const r = runReentryStep(mk('dificil'), 'interfaz_entrada', fail, 'rasante');
  assert.equal(r.state.day, 366);
  assert.ok(r.log.join(' ').includes('rebota'));
});

test('recuperación cierra la misión con éxito si hay vivos', () => {
  const r = runReentryStep(mk(), 'recuperacion', pass);
  assert.equal(r.state.phase, 'report');
  assert.equal(r.state.outcome.success, true);
});
