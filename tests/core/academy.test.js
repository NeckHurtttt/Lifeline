import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAININGS, ACADEMY_ORDER, trainingFor, starsFrom, trainingBonus, applyTraining, hasWings } from '../../src/core/academy.js';
import { crewScore } from '../../src/core/skill.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = () => createMission({
  design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0)],
    instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
  scenarioId: 'estacion', difficulty: 'facil', seed: 3,
});

test('cada destino tiene su prueba y la academia las tiene todas', () => {
  assert.equal(trainingFor('estacion'), 'acople');
  assert.equal(trainingFor('gateway'), 'brazo');
  assert.equal(trainingFor('luna'), 'luna');
  assert.equal(trainingFor('marte'), 'rover');
  assert.equal(trainingFor('otro'), 'acople');
  assert.deepEqual([...ACADEMY_ORDER].sort(), Object.keys(TRAININGS).sort());
});

test('estrellas y ayuda', () => {
  assert.deepEqual([0, 0.3, 0.6, 0.85, 1, 2, NaN].map(starsFrom), [0, 1, 2, 3, 3, 3, 0]);
  assert.deepEqual([0, 1, 2, 3].map(trainingBonus), [0, 0, 1, 2]);
});

test('entrenar suma a las habilidades y al ánimo sin tocar el estado original', () => {
  const s = mk();
  const c = s.crew[0];
  const t = applyTraining(s, 'acople', 3);
  assert.equal(s.training, undefined);
  assert.deepEqual(t.training, { id: 'acople', stars: 3, bonus: 2 });
  assert.equal(crewScore(t, t.crew[0], 'tecnica').total, crewScore(s, c, 'tecnica').total + 2);
  assert.ok(t.crew[0].morale >= c.morale);
  assert.equal(applyTraining(s, 'acople', 1).crew, s.crew);
});

test('alas con 2 estrellas en todo', () => {
  assert.equal(hasWings({}), false);
  assert.equal(hasWings(Object.fromEntries(ACADEMY_ORDER.map((id) => [id, 2]))), true);
  assert.equal(hasWings({ ...Object.fromEntries(ACADEMY_ORDER.map((id) => [id, 3])), luna: 1 }), false);
});

import { roverLevel, runRover, roverDistance } from '../../src/core/academy.js';
test('rover: los niveles siempre tienen camino y el programa se ejecuta', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 50; i++) {
    const lv = roverLevel(rnd, i % 3);
    assert.ok(roverDistance(lv.rocks, lv.rover, lv.sample) >= 6);
  }
  const lv = { rover: { x: 0, y: 0, dir: 0 }, sample: { x: 2, y: 1 }, rocks: [{ x: 1, y: 1 }] };
  assert.equal(runRover(lv, 'FFRF').reached, true);
  assert.equal(runRover(lv, 'FRF').crashed, true);
  assert.equal(runRover(lv, 'LF').crashed, true); // borde
  const r = runRover(lv, 'FF');
  assert.deepEqual([r.reached, r.crashed, r.at], [false, false, { x: 2, y: 0, dir: 0 }]);
});
