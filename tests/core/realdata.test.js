import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFlares, flaresToStorms } from '../../src/core/realdata.js';
import { LESSONS } from '../../src/data/lessons.js';

test('fetch que rechaza -> respaldo con >= 20 fulguraciones', async () => {
  const r = await fetchFlares({ year: 2024, fetchImpl: () => Promise.reject(new Error('x')) });
  assert.equal(r.source, 'respaldo');
  assert.ok(r.flares.length >= 20);
  const f = r.flares.find((x) => x.date === '2024-05-14' && x.cls === 'X8.7');
  assert.equal(f.day, 135);
});

test('fetch que nunca resuelve -> respaldo rápido', async () => {
  const t = Date.now();
  const r = await fetchFlares({ year: 2024, timeoutMs: 50, fetchImpl: () => new Promise(() => {}) });
  assert.equal(r.source, 'respaldo');
  assert.ok(Date.now() - t < 500);
});

test('no-JSON -> respaldo; JSON válido -> donki', async () => {
  const bad = await fetchFlares({ year: 2024, fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('no json'); } }) });
  assert.equal(bad.source, 'respaldo');
  const ok = await fetchFlares({ year: 2024, fetchImpl: async () => ({ ok: true, json: async () => [{ beginTime: '2024-02-01T10:00Z', classType: 'M2.0' }] }) });
  assert.equal(ok.source, 'donki');
  assert.deepEqual(ok.flares, [{ day: 32, cls: 'M2.0', date: '2024-02-01' }]);
});

test('flaresToStorms', () => {
  const s = flaresToStorms([
    { day: 200, cls: 'M6.0', date: 'd' }, { day: 134, cls: 'X1.1', date: '2024-05-14' },
    { day: 5, cls: 'C3.0', date: 'c' }, { day: 9, cls: 'M2.0', date: 'm' },
  ], 'medio');
  assert.deepEqual(s.map((x) => x.severity), ['leve', 'grave', 'media']);
  assert.deepEqual(s.map((x) => x.day), [9, 134, 200]);
});

test('LESSONS', () => {
  const v = Object.values(LESSONS);
  assert.ok(v.length >= 12);
  for (const [k, l] of Object.entries(LESSONS)) {
    assert.equal(l.id, k);
    assert.ok(l.title && l.space && l.earth);
  }
});
