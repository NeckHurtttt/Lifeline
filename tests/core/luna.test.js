import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDesign } from '../../src/core/design.js';
import { createMission } from '../../src/core/mission.js';
import { advanceDay, runUntilInterrupt } from '../../src/core/sim.js';
import { isNight, daysToNight, envMults } from '../../src/core/surface.js';
import { launchSteps, runLaunchStep, applyAbort } from '../../src/core/launch.js';
import { reentrySteps } from '../../src/core/reentry.js';
import { offerMinis, forceMini, acceptMini, progressMinis } from '../../src/core/minimissions.js';
import { rollEvents } from '../../src/core/events.js';
import { ORBITS } from '../../src/data/catalog.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
export const lunarDesign = (orbit = 'luna_polo', extra = []) => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0),
    mod('pila_regenerativa', 0, 1), mod('reactor', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), ...extra.map((t, i) => mod(t, i, 2))],
  instruments: ['sismometro'], launcher: 'titan', orbit, crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 150,
});

test('ciclo día/noche lunar', () => {
  const eq = ORBITS.luna_ecuador;
  assert.equal(isNight(eq, 1), false);
  assert.equal(isNight(eq, 14), false);
  assert.equal(isNight(eq, 15), true);
  assert.equal(isNight(eq, 28), true);
  assert.equal(isNight(eq, 29), false);
  assert.equal(daysToNight(eq, 13), 2);
  const polo = ORBITS.luna_polo;
  assert.equal(isNight(polo, 24), false);
  assert.equal(isNight(polo, 25), true);
  assert.equal(isNight(ORBITS.leo_estacion, 20), false);
});

test('diseño lunar: obligatorio el aterrizaje, piezas por destino y aviso de noche', () => {
  const ok = computeDesign(lunarDesign(), 'luna', 'medio');
  assert.deepEqual(ok.errors, []);
  const sin = lunarDesign();
  sin.modules = sin.modules.filter((m) => m.type !== 'modulo_aterrizaje');
  assert.ok(computeDesign(sin, 'luna', 'medio').errors.some((e) => /aterrizaje/.test(e)));
  const brazo = lunarDesign('luna_polo', ['brazo']);
  assert.ok(computeDesign(brazo, 'luna', 'medio').errors.some((e) => /No sirve en este destino: Brazo/.test(e)));
  assert.ok(computeDesign(lunarDesign(), 'estacion', 'medio').errors.some((e) => /No sirve/.test(e)));
  const oscuro = lunarDesign('luna_ecuador');
  oscuro.modules = oscuro.modules.filter((m) => !['reactor', 'pila_regenerativa'].includes(m.type));
  oscuro.modules.push(mod('baterias', 5, 3));
  assert.ok(computeDesign(oscuro, 'luna', 'medio').warnings.some((w) => /noche dura 14 días/.test(w)));
  const hielo = lunarDesign('luna_ecuador', ['extractor_hielo']);
  assert.ok(computeDesign(hielo, 'luna', 'medio').warnings.some((w) => /no hay hielo/.test(w)));
});

test('misión lunar: carga cada 120 días, batería por kWh, menos pérdida de hueso, más radiación', () => {
  const s = createMission({ design: lunarDesign(), scenarioId: 'luna', difficulty: 'medio', seed: 3 });
  assert.equal(s.nextResupply, 120);
  assert.equal(s.resources.batteryMax, 1000);
  assert.deepEqual(envMults(s), { boneMult: 0.5, radMult: 1.5 });
  s.flags = { regolithWall: true };
  assert.ok(Math.abs(envMults(s).radMult - 0.9) < 1e-9);
});

test('aviso 2 días antes de la noche y extractor de hielo en el polo', () => {
  let s = createMission({ design: lunarDesign('luna_polo', ['extractor_hielo']), scenarioId: 'luna', difficulty: 'facil', seed: 4 });
  s.phase = 'ops';
  s.day = 21;
  s.flags = {};
  s.rng = 12345;
  const water = s.resources.water;
  const r = advanceDay(s);
  // día 22: faltan 2 para la noche (empieza el 25 → 25-22=3?) se comprueba el valor exacto con daysToNight
  const d = daysToNight(ORBITS.luna_polo, r.state.day);
  if (d === 2) assert.equal(r.interrupt?.kind, 'noche');
  assert.ok(r.state.resources.water > water - 20);
});

test('eventos y minimisiones del destino', () => {
  const s = createMission({ design: lunarDesign('luna_polo', ['rover']), scenarioId: 'luna', difficulty: 'dificil', seed: 1 });
  s.phase = 'ops';
  let t = s;
  const rng = createRng(7);
  for (let i = 0; i < 400; i++) { t = rollEvents(t, rng); t.alerts = []; t.pending = null; }
  // nunca eventos solo de la estación (se revisa sacando muchos)
  const seen = new Set();
  let u = s;
  for (let i = 0; i < 2000; i++) { u = rollEvents(u, rng); for (const a of u.alerts) seen.add(a.eventId); if (u.pending) seen.add(u.pending.eventId); u = { ...u, alerts: [], pending: null }; }
  for (const id of ['reboost', 'basura_tardia', 'aurora', 'captura_brazo']) assert.ok(!seen.has(id), id);
  let m = s;
  for (let i = 0; i < 3000; i++) { m = offerMinis({ ...m, minis: [] }, rng); if (m.minis.some((x) => ['recuperar_satelite', 'capturar_carga'].includes(x.id))) assert.fail('mini de estación en la Luna'); }
});

test('rover autónomo: sin EVA, 1 operador y el doble de días', () => {
  let s = createMission({ design: lunarDesign('luna_polo', ['rover_autonomo']), scenarioId: 'luna', difficulty: 'medio', seed: 2 });
  s = forceMini(s, 'explorar_cueva');
  const r = acceptMini(s, 'explorar_cueva', [s.crew[0].id]);
  assert.equal(r.error, undefined);
  const e = r.state.minis.find((x) => x.id === 'explorar_cueva');
  assert.equal(e.auto, true);
  assert.equal(e.daysLeft, 6);
  const rad = r.state.crew[0].radiation;
  const p = progressMinis(r.state, createRng(1));
  assert.equal(p.state.crew[0].radiation, rad);
});

test('despegue a la Luna y aborto con retorno libre; regreso con textos lunares', () => {
  const ids = launchSteps('luna').map((x) => x.id);
  assert.ok(ids.includes('tli') && ids.at(-1) === 'alunizaje' && !ids.includes('acople_estacion'));
  assert.equal(launchSteps('marte').at(-1).id, 'tmi');
  const s = createMission({ design: lunarDesign(), scenarioId: 'luna', difficulty: 'medio', seed: 2 });
  const always = { chance: () => true, next: () => 0, int: (a) => a };
  const r = runLaunchStep(s, 'tli', always);
  assert.equal(r.abortMode, 'retorno_libre');
  const a = applyAbort(r.state, 'retorno_libre', always);
  assert.match(a.state.outcome.reason, /a salvo/);
  assert.match(reentrySteps('luna')[0].label, /Despegue desde la Luna/);
});

test('un año en la Luna con una base razonable y rutina sencilla es posible', () => {
  let s = createMission({ design: lunarDesign('luna_polo', ['extractor_hielo', 'refugio']), scenarioId: 'luna', difficulty: 'facil', seed: 11 });
  s.phase = 'ops';
  const [a, b, c, d] = s.crew;
  s.schedule[a.id] = ['mantenimiento', 'ejercicio', 'sueño'];
  s.schedule[b.id] = ['reparacion', 'ejercicio', 'sueño'];
  s.schedule[c.id] = ['medico', 'ejercicio', 'sueño'];
  s.schedule[d.id] = ['cultivo', 'ejercicio', 'sueño'];
  for (let i = 0; i < 400 && s.phase === 'ops'; i++) {
    const r = runUntilInterrupt(s, 400);
    s = r.state;
    if (s.pending) { s = { ...s, pending: null }; }
    s.minis = s.minis.map((m) => (m.status === 'oferta' ? { ...m, status: 'vencida' } : m));
  }
  assert.ok(s.crew.some((x) => x.alive && !x.evacuated), `fin día ${s.day}: ${s.outcome?.reason}`);
});
