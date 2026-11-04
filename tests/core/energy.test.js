import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEnergy, setPriority } from '../../src/core/energy.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const design = (extra = []) => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0), ...extra],
  instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90,
});
const mk = (extra = []) => createMission({ design: design(extra), scenarioId: 'estacion', difficulty: 'medio', seed: 3 });

test('balance positivo: la batería sube hasta batteryMax', () => {
  const s = mk();
  s.resources.battery = 10;
  const r = applyEnergy(s, { solarFactor: 1 });
  assert.equal(r.state.resources.battery, 34); // 10 + (12*0.5*24 - 5*24) = 10 + 24
  assert.deepEqual(r.shed, []);
  s.resources.battery = 50;
  assert.equal(applyEnergy(s, { solarFactor: 1 }).state.resources.battery, s.resources.batteryMax);
  assert.equal(s.resources.battery, 50, 'puro');
});

test('sin sol y batería 60: apaga primero el de prioridad 1', () => {
  const s = mk([mod('taller', 4, 0)]);
  const taller = s.modules.find((m) => m.type === 'taller');
  taller.priority = 1;
  const r = applyEnergy(s, { solarFactor: 0 });
  assert.equal(r.shed[0], taller.id);
  assert.equal(r.state.modules.find((m) => m.id === taller.id).on, false);
  assert.ok(r.log.length > 0);
  assert.match(r.log[0], /Apagado por falta de energía/);
});

test('déficit total con batería vacía: soporte_vital es el último', () => {
  const s = mk([mod('taller', 4, 0)]);
  s.resources.battery = 0;
  s.modules.find((m) => m.type === 'taller').priority = 10;
  s.modules.find((m) => m.type === 'cabina').priority = 1;
  const r = applyEnergy(s, { solarFactor: 0 });
  assert.equal(r.shed[r.shed.length - 1], s.modules.find((m) => m.type === 'soporte_vital').id);
  assert.equal(r.shed[0], s.modules.find((m) => m.type === 'taller').id);
  assert.equal(r.state.resources.battery, 0);
});

test('salud < 30 produce la mitad y setPriority es puro', () => {
  const s = mk();
  s.resources.battery = 0;
  s.modules.find((m) => m.type === 'paneles').health = 20;
  assert.equal(applyEnergy(s, { solarFactor: 1 }).shed.length > 0, true);
  const p = s.modules[0];
  const n = setPriority(s, p.id, 3);
  assert.equal(n.modules[0].priority, 3);
  assert.notEqual(p.priority, 3);
});
