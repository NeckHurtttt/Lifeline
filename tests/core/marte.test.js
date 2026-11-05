import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDesign } from '../../src/core/design.js';
import { createMission } from '../../src/core/mission.js';
import { advanceDay, runUntilInterrupt } from '../../src/core/sim.js';
import { legOf, phaseDue, resolvePhase, previewPhase, inBlackout, radioDelayMin, ASCENT_FUEL, LANDING_DAY, ASCENT_DAY, CONJUNCTION } from '../../src/core/mars.js';
import { envMults } from '../../src/core/surface.js';
import { rollEvents, resolveEvent } from '../../src/core/events.js';
import { offerMinis } from '../../src/core/minimissions.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const marsDesign = (orbit = 'marte_jezero') => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('planta_combustible', 3, 0), mod('paneles', 4, 0), mod('paneles', 5, 0),
    mod('reactor', 0, 1), mod('pila_regenerativa', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1),
    mod('refugio', 0, 2), mod('enfermeria', 1, 2), mod('bodega', 2, 2)],
  instruments: ['buscador_vida', 'analizador_rocas'], launcher: 'titan', orbit, crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 240,
});
const mk = (difficulty = 'medio', seed = 3) => createMission({ design: marsDesign(), scenarioId: 'marte', difficulty, seed });

test('el diseño de ejemplo de Marte es válido y exige la planta de combustible', () => {
  const r = computeDesign(marsDesign(), 'marte', 'medio');
  assert.deepEqual(r.errors, []);
  const d = marsDesign(); d.modules = d.modules.filter((m) => m.type !== 'planta_combustible');
  assert.ok(computeDesign(d, 'marte', 'medio').errors.some((e) => /planta_combustible|combustible/.test(e)));
});

test('785 días: ida, superficie y vuelta; sin cargas', () => {
  const s = mk();
  assert.equal(s.totalDays, 785);
  assert.equal(s.nextResupply, Infinity);
  assert.equal(legOf(s, 100), 'ida');
  s.flags = { landed: true };
  assert.equal(legOf(s, 300), 'superficie');
  s.flags.ascended = true;
  assert.equal(legOf(s, 600), 'vuelta');
  s.leg = 'ida';
  assert.deepEqual(envMults(s), { boneMult: 1, radMult: 2 });
});

test('aterrizaje: la carga previa espera en la superficie', () => {
  let s = mk();
  s.day = LANDING_DAY; s.flags = {};
  assert.equal(phaseDue(s), 'edl');
  const food = s.resources.food;
  const r = resolvePhase(s, 'edl');
  assert.equal(r.state.flags.landed, true);
  assert.ok(r.state.resources.food > food + 1000);
  assert.equal(phaseDue(r.state), null);
  assert.equal(typeof previewPhase(s, 'edl').ok, 'boolean');
});

test('despegue: sin combustible quedan varados; con combustible vuelven con comida', () => {
  const s = mk();
  s.day = ASCENT_DAY; s.flags = { landed: true };
  s.resources.fuel = ASCENT_FUEL - 1;
  assert.equal(previewPhase(s, 'ascenso').ok, false);
  const bad = resolvePhase(s, 'ascenso');
  assert.equal(bad.state.outcome.success, false);
  s.resources.fuel = ASCENT_FUEL + 5;
  const good = resolvePhase(s, 'ascenso');
  assert.equal(good.state.flags.ascended, true);
  assert.equal(good.state.leg, 'vuelta');
  assert.equal(good.state.resources.fuel, 5);
});

test('conjunción solar: sin radio y sin consejo de Control de Misión', () => {
  const s = mk();
  assert.equal(inBlackout(s, CONJUNCTION.start), true);
  assert.equal(inBlackout(s, CONJUNCTION.end + 1), false);
  assert.ok(radioDelayMin(s, CONJUNCTION.start) >= 20 && radioDelayMin(s, CONJUNCTION.start + 390) <= 6);
  s.day = CONJUNCTION.start + 1; s.reputation = 50;
  const r = resolveEvent(s, 'reboost', 'leve', 'esperar', createRng(1), []);
  assert.equal(r.state.reputation, 49); // solo el efecto del evento, sin ±1 de procedimiento
});

test('en el viaje no hay eventos ni minimisiones de superficie', () => {
  let s = mk('dificil'); s.leg = 'ida'; s.phase = 'ops';
  const rng = createRng(5);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) { s = rollEvents(s, rng); for (const a of s.alerts) seen.add(a.eventId); if (s.pending) seen.add(s.pending.eventId); s = { ...s, alerts: [], pending: null }; }
  for (const id of ['sismo', 'tormenta_polvo', 'roca_rara', 'muestra_contaminada']) assert.ok(!seen.has(id), id);
  assert.ok(seen.has('aislamiento') || seen.has('particulas_profundas'));
  let m = s;
  for (let i = 0; i < 2000; i++) { m = offerMinis({ ...m, minis: [] }, rng); assert.ok(!m.minis.some((x) => ['perforacion_profunda', 'vuelo_helicoptero', 'explorar_cueva'].includes(x.id))); }
});

test('una misión completa a Marte con la base de ejemplo es posible', () => {
  let s = mk('facil', 21);
  s.phase = 'ops';
  const [a, b, c, d] = s.crew;
  s.schedule[a.id] = ['mantenimiento', 'ejercicio', 'sueño'];
  s.schedule[b.id] = ['reparacion', 'ejercicio', 'sueño'];
  s.schedule[c.id] = ['medico', 'ejercicio', 'sueño'];
  s.schedule[d.id] = ['cultivo', 'ejercicio', 'sueño'];
  for (let i = 0; i < 2000 && s.phase === 'ops'; i++) {
    const r = runUntilInterrupt(s, 800);
    s = r.state;
    if (r.interrupt?.kind === 'fase') s = resolvePhase(s, r.interrupt.data.phase).state;
    if (s.pending) s = { ...s, pending: null };
    s.minis = s.minis.map((m) => (m.status === 'oferta' ? { ...m, status: 'vencida' } : m));
  }
  assert.ok(s.crew.some((x) => x.alive && !x.evacuated), `fin día ${s.day}: ${s.outcome?.reason} combustible ${s.resources.fuel}`);
  assert.equal(s.phase, 'reentry');
});
