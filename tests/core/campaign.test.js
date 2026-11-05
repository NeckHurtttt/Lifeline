import test from 'node:test';
import assert from 'node:assert/strict';
import { newCampaign, recordResult, canPlay, canBuy, buyUpgrade, UPGRADES, pointsFor, loadCampaign, saveCampaign } from '../../src/core/campaign.js';
import { computeDesign } from '../../src/core/design.js';
import { createMission } from '../../src/core/mission.js';
import { genMap, startExpedition, ensureMap, previewExpedition, tripDays, canExplore, NODE_TYPES } from '../../src/core/explore.js';
import { advanceDay } from '../../src/core/sim.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });

test('campaña: desbloquea en orden y suma puntos una sola vez', () => {
  let c = newCampaign();
  assert.ok(canPlay(c, 'estacion') && !canPlay(c, 'luna'));
  const rep = { success: true, medal: 'plata', science: 400, score: 5000 };
  const r = recordResult(c, 'a', 'estacion', rep);
  c = r.camp;
  assert.equal(r.unlockedNow, 'luna');
  assert.equal(c.points, pointsFor(rep));
  assert.equal(recordResult(c, 'a', 'estacion', rep).points, 0);
  const fail = recordResult(c, 'b', 'luna', { success: false, science: 80, score: 10 });
  assert.equal(fail.unlockedNow, null);
  assert.ok(!canPlay(fail.camp, 'marte'));
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  saveCampaign(c, st);
  assert.deepEqual(loadCampaign(st).unlocked, ['estacion', 'luna']);
});

test('árbol: requisitos y costo', () => {
  let c = { ...newCampaign(), points: 200 };
  assert.equal(canBuy(c, 'reciclador_99'), false);
  c = buyUpgrade(c, 'paneles_eficientes');
  assert.equal(c.points, 200 - UPGRADES.paneles_eficientes.cost);
  assert.equal(canBuy(c, 'reciclador_99'), true);
  for (const u of Object.values(UPGRADES)) if (u.req) assert.ok(UPGRADES[u.req], u.id);
});

test('las mejoras cambian el diseño', () => {
  const d = { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0)], instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante'], cargoDays: 90 };
  const base = computeDesign(d, 'estacion', 'medio');
  const up = computeDesign({ ...d, upgrades: ['paneles_eficientes', 'modulos_ligeros', 'cohete_reutilizable'] }, 'estacion', 'medio');
  assert.ok(up.powerNet > base.powerNet);
  assert.ok(up.mass < base.mass);
  assert.ok(up.cost < base.cost);
  const s = createMission({ design: { ...d, upgrades: ['impresion_3d'] }, scenarioId: 'estacion', difficulty: 'medio', seed: 1 });
  assert.equal(s.resources.parts, 45);
});

test('mapa de exploración: determinista, con niebla y tipos según el sitio', () => {
  assert.deepEqual(genMap(5, 'luna_polo'), genMap(5, 'luna_polo'));
  const m = genMap(5, 'luna_ecuador');
  assert.equal(m.length, 9);
  assert.equal(m.filter((n) => n.known).length, 5);
  assert.ok(!m.some((n) => n.type === 'crater_hielo'));
  for (const n of m) for (const l of n.links) assert.ok(m.find((x) => x.id === l).links.includes(n.id), `${n.id}-${l}`);
});

test('expedición: en pareja con rover presurizado, revela vecinos al terminar', () => {
  const design = { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('rover', 3, 0), mod('reactor', 4, 0), mod('pila_regenerativa', 5, 0)],
    instruments: [], launcher: 'titan', orbit: 'luna_polo', crewRoles: ['comandante', 'piloto', 'ingeniero'], cargoDays: 150 };
  let s = ensureMap(createMission({ design, scenarioId: 'luna', difficulty: 'facil', seed: 8 }));
  s.phase = 'ops';
  assert.ok(canExplore(s));
  const [a, b] = s.crew;
  assert.match(startExpedition(s, 'n1', [a.id]).error, /solo/);
  assert.match(startExpedition(s, 'n5', [a.id, b.id]).error, /no se puede/);
  const r = startExpedition(s, 'n1', [a.id, b.id]);
  assert.equal(r.error, undefined);
  s = r.state;
  assert.equal(s.expedition.daysLeft, tripDays(s.map.find((n) => n.id === 'n1'), false));
  assert.equal(typeof previewExpedition(s, 'n1', [a.id, b.id]).ok, 'boolean');
  let out = null;
  for (let i = 0; i < 6 && !out; i++) {
    s.pending = null; s.alerts = [];
    const step = advanceDay(s);
    s = step.state;
    if (step.interrupt?.kind === 'expedicion') out = step.interrupt.data;
  }
  assert.ok(out, 'la expedición terminó');
  assert.equal(s.map.find((n) => n.id === 'n1').done, true);
  assert.equal(s.map.find((n) => n.id === 'n5').known, true);
  assert.equal(s.expedition, null);
  assert.ok(Object.keys(NODE_TYPES).length >= 8);
});
