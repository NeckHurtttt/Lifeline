import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMission, decodeMission } from '../../src/core/share.js';

const design = {
  modules: [{ id: 'cabina-0-0', type: 'cabina', x: 0, y: 0 }, { id: 'paneles-1-0', type: 'paneles', x: 1, y: 0 }],
  instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero'], cargoDays: 90, crewSeed: 42,
  hires: { comandante: { name: 'Ñandú Pérez' } },
};

test('código de misión: ida y vuelta', () => {
  const code = encodeMission({ design, scenarioId: 'estacion', difficulty: 'medio', objective: 'ciencia', seed: 123 });
  assert.match(code, /^VDL1-[A-Za-z0-9_-]+$/);
  const m = decodeMission(code);
  assert.equal(m.scenarioId, 'estacion');
  assert.equal(m.difficulty, 'medio');
  assert.equal(m.objective, 'ciencia');
  assert.equal(m.seed, 123);
  assert.deepEqual(m.design.modules, design.modules);
  assert.deepEqual(m.design.instruments, design.instruments);
  assert.equal(m.design.crewSeed, 42);
  assert.equal(m.design.hires, undefined); // no viaja: cada equipo contrata a los suyos
});

test('código de misión: textos inválidos devuelven null', () => {
  for (const bad of ['', 'hola', 'VDL1-%%%', 'VDL1-e30', null]) assert.equal(decodeMission(bad), null);
});
