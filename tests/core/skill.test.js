import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillCheck, crewScore } from '../../src/core/skill.js';
import { previewOption, resolveEvent } from '../../src/core/events.js';
import { createMission } from '../../src/core/mission.js';
import { createRng } from '../../src/core/rng.js';
import { EVENTS } from '../../src/data/events.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (extra = []) => createMission({
  design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), ...extra],
    instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero'], cargoDays: 90 },
  scenarioId: 'estacion', difficulty: 'medio', seed: 2,
});

test('sin azar: el mismo estado da siempre el mismo resultado', () => {
  const s = mk();
  const a = skillCheck(s, { stat: 'tecnica', dc: 12 });
  const b = skillCheck(s, { stat: 'tecnica', dc: 12 });
  assert.deepEqual(a, b);
});

test('el taller suma 2 en técnica y el cansancio resta 2', () => {
  const s = mk();
  const c = s.crew[1];
  const base = crewScore(s, c, 'tecnica').total;
  const conTaller = mk([mod('taller', 3, 0)]);
  assert.equal(crewScore(conTaller, conTaller.crew[1], 'tecnica').total, base + 2);
  c.fatigue = 90;
  assert.equal(crewScore(s, c, 'tecnica').total, base - 2);
});

test('elige al mejor y explica el cálculo', () => {
  const s = mk();
  s.crew[0].stats.tecnica = 3; s.crew[1].stats.tecnica = 8;
  const r = skillCheck(s, { stat: 'tecnica', dc: 12 });
  assert.equal(r.who.id, s.crew[1].id);
  assert.equal(r.total, 8 + 5 + (s.crew[1].traits.includes('manos_firmes') ? 2 : 0) - (s.crew[1].fatigue >= 70 ? 2 : 0));
  assert.equal(r.ok, true);
  assert.match(r.text, /hace falta 12/);
});

test('la vista previa coincide con lo que pasa al resolver', () => {
  const s = mk();
  const o = EVENTS.fuga_amoniaco.options.find((x) => x.check);
  s.pending = { eventId: 'fuga_amoniaco', severity: 'media', prepared: [] };
  const pre = previewOption(s, 'fuga_amoniaco', o.id);
  const r = resolveEvent(s, 'fuga_amoniaco', 'media', o.id, createRng(1));
  assert.match(r.log.join(' '), pre.ok ? /éxito/ : /fallo/);
});
