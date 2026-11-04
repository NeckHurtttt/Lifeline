import test from 'node:test'; import assert from 'node:assert/strict';
import { createRng, restoreRng } from '../../src/core/rng.js';
test('misma semilla, misma secuencia', () => {
  const a = createRng(42), b = createRng(42);
  assert.deepEqual([a.next(), a.next(), a.int(1, 6)], [b.next(), b.next(), b.int(1, 6)]);
});
test('int dentro del rango inclusive', () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r.int(3, 5); assert.ok(v >= 3 && v <= 5); }
});
test('restoreRng continúa la secuencia', () => {
  const a = createRng(7); a.next(); const s = a.state();
  const b = restoreRng(s); assert.equal(a.next(), b.next());
});
