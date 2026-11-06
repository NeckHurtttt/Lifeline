import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../../src/core/mission.js';
import { advanceDay, runUntilInterrupt } from '../../src/core/sim.js';
import { cleanPanels, replaceBatteries, batteryTick, batteryHealth, gardenTick, autoRationTick, dustTick, CARGO_PLANS } from '../../src/core/extras.js';
import { resolveEvent, resolveResupply, tickDelayed } from '../../src/core/events.js';
import { checkAchievements, addRecord, recordKey } from '../../src/core/achievements.js';
import { computeDesign } from '../../src/core/design.js';
import { createRng } from '../../src/core/rng.js';
import { availableIn } from '../../src/core/surface.js';
import { MODULES, SCENARIOS } from '../../src/data/catalog.js';
import { HISTORICAS } from '../../src/data/historicas.js';
import { EVENTS } from '../../src/data/events.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (extra = [], scenarioId = 'estacion', orbit = 'leo_estacion') => createMission({
  design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 4, 0), ...extra],
    instruments: [], launcher: 'titan', orbit, crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
  scenarioId, difficulty: 'medio', seed: 5,
});
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };

test('baterías envejecen y se cambian con piezas', () => {
  const s = mk();
  for (let i = 0; i < 365; i++) batteryTick(s);
  assert.ok(batteryHealth(s) < 0.95 && batteryHealth(s) > 0.9);
  const r = replaceBatteries(s);
  assert.equal(r.error, null);
  assert.equal(batteryHealth(r.state), 1);
  assert.equal(r.state.resources.parts, s.resources.parts - 8);
});

test('polvo en Marte: se acumula en la superficie y se limpia con 2 tripulantes', () => {
  const s = mk([], 'marte', 'marte_jezero');
  s.leg = 'superficie'; s.day = 300;
  for (let i = 0; i < 100; i++) dustTick(s);
  assert.ok(s.dust > 0.2);
  assert.ok(cleanPanels(s, [s.crew[0].id]).error);
  const r = cleanPanels(s, [s.crew[0].id, s.crew[1].id]);
  assert.equal(r.error, null);
  assert.equal(r.state.dust, 0);
  assert.ok(cleanPanels(r.state, [s.crew[2].id, s.crew[3].id]).error, 'una vez por día');
});

test('huerto: crece con cuidado y cosecha 45 kg al 100 %', () => {
  const s = mk([mod('invernadero', 0, 1)]);
  const food = s.resources.food;
  s.garden = { growth: 97, harvests: 0, care: 1 };
  const log = gardenTick(s);
  assert.equal(s.garden.harvests, 1);
  assert.equal(s.resources.food, food + 45);
  assert.ok(log.length);
});

test('racionamiento automático baja a media ración con poca reserva', () => {
  const s = mk();
  s.autoRation = true;
  s.resources.food = 10;
  autoRationTick(s);
  assert.ok(Object.values(s.rations).every((r) => r === 'media'));
});

test('plan de carga: más piezas trae 40 piezas', () => {
  const s = mk();
  s.cargoPlan = 'piezas'; s.resources.food = 10; s.resources.water = 10; s.nextResupply = 60;
  for (let seed = 1; seed < 50; seed++) {
    const r = resolveResupply(s, createRng(seed));
    if (r.event !== 'carga_a_tiempo') continue;
    assert.equal(r.state.resources.parts, s.resources.parts + CARGO_PLANS.piezas.parts);
    return;
  }
  assert.fail('ninguna carga llegó');
});

test('decisión con consecuencia atrasada: llega días después', () => {
  const s = mk();
  const r = resolveEvent(s, 'incendio', 'media', 'sellar', createRng(1));
  assert.equal(r.state.delayed.length, 1);
  const later = { ...r.state, day: r.state.delayed[0].day };
  const o2 = later.resources.o2;
  const after = tickDelayed(later);
  assert.equal(after.delayed.length, 0);
  assert.ok(after.resources.o2 < o2);
});

test('módulos nuevos: impresora come menos y centrífuga protege huesos', () => {
  for (const id of ['centrifuga', 'impresora_comida', 'escudo_agua']) assert.ok(MODULES[id]);
  const a = mk(); const b = mk([mod('impresora_comida', 0, 1), mod('centrifuga', 1, 1)]);
  const ra = advanceDay({ ...a, phase: 'ops' }).state; const rb = advanceDay({ ...b, phase: 'ops' }).state;
  assert.ok(a.resources.food - ra.resources.food > b.resources.food - rb.resources.food);
});

test('Gateway: destino en órbita lunar con nave de ejemplo válida y sin módulo de aterrizaje', () => {
  assert.ok(SCENARIOS.gateway.orbital);
  assert.ok(availableIn(MODULES.brazo, 'gateway'));
  const d = { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1)],
    instruments: ['dosimetro', 'espectrometro'], launcher: 'titan', orbit: 'nrho', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 210, hires: {} };
  const r = computeDesign(d, 'gateway', 'medio');
  assert.deepEqual(r.errors.filter((e) => !/contratar/.test(e)), []);
});

test('misiones históricas: eventos programados y cargas que fallan', () => {
  for (const m of HISTORICAS) for (const sc of m.scripted ?? []) assert.ok(EVENTS[sc.eventId], sc.eventId);
  const s = { ...mk(), phase: 'ops', scripted: [{ day: 1, eventId: 'tanque_o2', severity: 'grave' }] };
  const r = runUntilInterrupt(s);
  assert.equal(r.state.pending?.eventId, 'tanque_o2');
  const b = { ...mk(), forceBoom: 1 };
  assert.equal(resolveResupply(b, createRng(1)).event, 'carga_explota');
});

test('logros y récords se guardan', () => {
  const st = mem();
  const s = { ...mk(), garden: { harvests: 3 } };
  const fresh = checkAchievements(s, { success: true, medal: 'oro', breakdown: { parts: [] } }, st);
  assert.ok(fresh.some((a) => a.id === 'huerto') && fresh.some((a) => a.id === 'oro'));
  assert.equal(checkAchievements(s, { success: true, medal: 'oro', breakdown: { parts: [] } }, st).length, 0);
  addRecord('VDL1-abc', { id: 'a', score: 500 }, st);
  const list = addRecord('VDL1-abc', { id: 'b', score: 700 }, st);
  assert.deepEqual(list.map((r) => r.score), [700, 500]);
  assert.notEqual(recordKey('VDL1-abc'), recordKey('VDL1-abd'));
});
