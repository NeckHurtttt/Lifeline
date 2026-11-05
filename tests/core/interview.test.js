import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFor, ask, knownAbout, QUESTIONS, CANDIDATES_PER_ROLE } from '../../src/core/interview.js';
import { createMission } from '../../src/core/mission.js';
import { computeDesign } from '../../src/core/design.js';
import { ROLES } from '../../src/data/crew.js';

test('candidatos deterministas, sin nombres repetidos entre puestos', () => {
  assert.deepEqual(candidatesFor('ingeniero', 42), candidatesFor('ingeniero', 42));
  const all = Object.keys(ROLES).flatMap((r) => candidatesFor(r, 42));
  assert.equal(all.length, Object.keys(ROLES).length * CANDIDATES_PER_ROLE);
  assert.equal(new Set(all.map((c) => c.name)).size, all.length);
  for (const c of candidatesFor('ingeniero', 7)) assert.ok(c.stats.tecnica >= 7);
});

test('las respuestas revelan habilidad y rasgos de verdad', () => {
  const c = { stats: { fuerza: 2, tecnica: 9, ciencia: 5, medicina: 3, temple: 6 }, traits: ['manos_firmes', 'insomne'] };
  const r = ask(c, 'arreglar');
  assert.deepEqual(r.reveals, { stats: ['tecnica'], traits: ['manos_firmes'] });
  assert.match(r.text, /mejor que nuevo/);
  assert.deepEqual(ask(c, 'comer').reveals.traits, []);
  assert.ok(ask(c, 'dormir').text.includes('dormir'));
  const k = knownAbout(c, ['arreglar', 'dormir']);
  assert.deepEqual(k, { stats: { tecnica: 9 }, traits: ['manos_firmes', 'insomne'] });
  for (const q of QUESTIONS) assert.ok(ask(c, q.id).text.length > 0);
});

test('el contratado viaja y sin contratar no se puede lanzar', () => {
  const design = {
    modules: [{ id: 'm1', type: 'cabina', x: 0, y: 0 }, { id: 'm2', type: 'soporte_vital', x: 1, y: 0 }, { id: 'm3', type: 'paneles', x: 2, y: 0 }],
    instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero'], cargoDays: 90, hires: {},
  };
  assert.ok(computeDesign(design, 'estacion', 'medio').errors.some((e) => /contratar/.test(e)));
  const [ing] = candidatesFor('ingeniero', 5);
  const [com] = candidatesFor('comandante', 5);
  design.hires = { ingeniero: ing, comandante: com };
  assert.ok(!computeDesign(design, 'estacion', 'medio').errors.some((e) => /contratar/.test(e)));
  const s = createMission({ design, scenarioId: 'estacion', difficulty: 'medio', seed: 1 });
  const c = s.crew.find((x) => x.role === 'ingeniero');
  assert.equal(c.name, ing.name);
  assert.deepEqual(c.stats, ing.stats);
  assert.deepEqual(c.traits, ing.traits);
});
