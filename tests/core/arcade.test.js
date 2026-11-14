import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCADE_POOL, roundSeconds, comboMult, scoreRound, nextGame, updateStreak, liveStreak, unlockedPhosphors, rankedUp } from '../../src/core/arcade.js';
import { TRAININGS } from '../../src/core/academy.js';
import { ADVANCED } from '../../src/core/academy2.js';

test('el pool del arcade usa pruebas que existen', () => {
  for (const id of ARCADE_POOL) assert.ok(TRAININGS[id] || ADVANCED[id], id);
});
test('las rondas se acortan pero nunca bajan de 10 s', () => {
  assert.equal(roundSeconds(30, 0), 16);
  assert.ok(roundSeconds(30, 5) < 16);
  assert.equal(roundSeconds(25, 50), 8);
  assert.equal(roundSeconds(12, 0), 12);
});
test('combo: sube con 2+ estrellas, se corta al fallar, multiplica hasta ×4', () => {
  assert.equal(comboMult(0), 1); assert.equal(comboMult(2), 1.5); assert.equal(comboMult(99), 4);
  const a = scoreRound(0.9, { combo: 3, level: 2 });
  assert.equal(a.combo, 4); assert.equal(a.mult, 2); assert.equal(a.points, (300 + 30) * 2); assert.equal(a.loseLife, false);
  const b = scoreRound(0.1, { combo: 5 });
  assert.equal(b.combo, 0); assert.equal(b.loseLife, true); assert.equal(b.points, 0);
  const c = scoreRound(0.4, { combo: 2 }); // 1 estrella: no pierde vida pero no suma combo
  assert.equal(c.combo, 2); assert.equal(c.loseLife, false);
});
test('siguiente prueba distinta de la anterior', () => {
  for (let i = 0; i < 50; i++) assert.notEqual(nextGame(Math.random, 'flotar'), 'flotar');
});
test('racha diaria', () => {
  let r = updateStreak(null, '2026-11-14');
  assert.equal(r.count, 1);
  r = updateStreak(r, '2026-11-14'); assert.equal(r.count, 1);
  r = updateStreak(r, '2026-11-15'); assert.equal(r.count, 2);
  r = updateStreak(r, '2026-12-01'); assert.equal(r.count, 1); assert.equal(r.best, 2);
  assert.equal(liveStreak({ last: '2026-11-14', count: 4 }, '2026-11-15'), 4);
  assert.equal(liveStreak({ last: '2026-11-10', count: 4 }, '2026-11-15'), 0);
});
test('desbloqueos por rango', () => {
  assert.equal(unlockedPhosphors(0).length, 1);
  assert.equal(unlockedPhosphors(3).length, 4);
  assert.ok(rankedUp(0, 1)); assert.ok(!rankedUp(2, 2));
});
