import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flareRank, strongestFlare, stormDose, stormOptions, optionEffects, limitShare, ARCHIVED_FLARE, HEALTH_FINDINGS } from '../../src/core/spaceweather.js';

test('clase de llamarada a intensidad', () => {
  assert.ok(flareRank('X1.0') > flareRank('M9.9'));
  assert.ok(flareRank('M1.0') > flareRank('C9.0'));
  assert.equal(flareRank('basura'), 0);
});
test('la más fuerte de DONKI', () => {
  const f = strongestFlare([{ classType: 'M2.1', beginTime: '2026-11-02T10:00Z' }, { classType: 'X1.2', beginTime: '2026-11-07T03:00Z' }, { classType: 'C5' }]);
  assert.deepEqual(f, { cls: 'X1.2', date: '2026-11-07', source: 'donki' });
  assert.equal(strongestFlare([]), null);
});
test('dosis: más fuerte da más; la órbita baja protege', () => {
  assert.ok(stormDose('X8.7', 'luna') > stormDose('M1', 'luna'));
  assert.ok(stormDose('X8.7', 'estacion') < stormDose('X8.7', 'gateway'));
});
test('ninguna opción es gratis', () => {
  for (const o of stormOptions(ARCHIVED_FLARE.cls, 'luna')) {
    const costs = [o.dose > 0, o.science < 0, o.battery < 0].filter(Boolean).length;
    assert.ok(costs >= 1, o.id);
  }
  const [ref, , seg] = stormOptions('X2', 'marte');
  assert.ok(ref.dose < seg.dose && ref.science < seg.science);
  assert.deepEqual(Object.keys(optionEffects(ref)), ['crewRadiation', 'science', 'battery']);
  assert.ok(limitShare(60) === 0.1);
  assert.ok(HEALTH_FINDINGS.length >= 4);
});

import { strongestFlares, stormDays, stormIndexDue, ARCHIVED_FLARES, osdUrl } from '../../src/core/spaceweather.js';
test('3 decisiones por misión y las 3 llamaradas más fuertes', () => {
  assert.deepEqual(stormDays(60), [1, 20, 40]);
  assert.equal(stormIndexDue(0, 60, 0), -1);
  assert.equal(stormIndexDue(1, 60, 0), 0);
  assert.equal(stormIndexDue(5, 60, 1), -1);
  assert.equal(stormIndexDue(25, 60, 1), 1);
  assert.equal(stormIndexDue(59, 60, 3), -1);
  const top = strongestFlares([{ classType: 'M1', beginTime: '2026-11-01T00:00Z' }, { classType: 'X1', beginTime: '2026-11-02T00:00Z' }, { classType: 'X2', beginTime: '2026-11-02T05:00Z' }, { classType: 'C3', beginTime: '2026-11-03' }], 3);
  assert.deepEqual(top.map((f) => f.cls), ['X2', 'M1', 'C3']); // misma fecha no se repite
  assert.equal(ARCHIVED_FLARES.length, 3);
  assert.match(osdUrl('OSD-342'), /osdr\.nasa\.gov.*OSD-342/);
});
