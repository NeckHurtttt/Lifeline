import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadetPoints, rankOf, dailyChallenge, addDestRecord, encodeCadet, decodeCadet, marsDelayMin, compareReal, hashStr } from '../../src/core/cadete.js';

test('rango sube con los puntos', () => {
  assert.equal(rankOf(0).id, 'cadete');
  assert.equal(rankOf(12).id, 'especialista');
  assert.equal(rankOf(100).id, 'comandante');
  assert.equal(rankOf(100).next, null);
  assert.equal(rankOf(5).toNext, 7);
});

test('puntos: estrellas, misiones (tope 2 por destino), logros y alas', () => {
  assert.equal(cadetPoints({ stars: { a: 3, b: 2 }, missions: { luna: 5 }, achievements: 2, wings: true }), 5 + 6 + 2 + 4);
});

test('reto diario: igual para la misma fecha, cambia de destino al día siguiente', () => {
  const a = dailyChallenge('2026-11-14'), b = dailyChallenge('2026-11-14'), c = dailyChallenge('2026-11-15');
  assert.deepEqual(a, b);
  assert.notEqual(a.scenario, c.scenario);
  assert.ok(['facil', 'medio', 'dificil'].includes(a.difficulty));
  assert.equal(typeof hashStr('x'), 'number');
});

test('récords por destino ordenados y con tope', () => {
  let r = {};
  for (const s of [100, 500, 300, 900, 50, 700]) r = addDestRecord(r, 'luna', { score: s });
  assert.deepEqual(r.luna.map((x) => x.score), [900, 700, 500, 300, 100]);
});

test('código del cadete va y vuelve (con tildes)', () => {
  const c = encodeCadet({ name: 'Sofía Ñ', points: 20, stars: { flotar: 3 }, missions: { luna: 1 }, wings: true });
  assert.ok(c.startsWith('CAD1-'));
  const d = decodeCadet(c);
  assert.equal(d.name, 'Sofía Ñ'); assert.equal(d.points, 20); assert.equal(d.wings, true);
  assert.equal(decodeCadet('basura'), null);
});

test('retraso a Marte entre 3 y 23 minutos', () => {
  for (let m = 0; m < 30; m++) {
    const v = marsDelayMin(new Date(Date.UTC(2026, m, 1)));
    assert.ok(v > 3 && v < 23, String(v));
  }
});

test('comparación con misiones reales', () => {
  assert.match(compareReal('estacion', 400).text, /Rubio/);
  assert.equal(compareReal('nada', 3), null);
});
