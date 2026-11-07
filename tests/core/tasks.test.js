import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTasks, validateSchedule, normalizeSchedule, TASKS } from '../../src/core/tasks.js';
import { createMission } from '../../src/core/mission.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (types = [], difficulty = 'medio') => createMission({
  design: {
    modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), ...types.map((t, i) => mod(t, i, 1))],
    instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion',
    crewRoles: ['ingeniero', 'comandante'], cargoDays: 90,
  },
  scenarioId: 'estacion', difficulty, seed: 5,
});
const idle = (s) => { s.crew.forEach((c) => { c.traits = []; s.schedule[c.id] = ['descanso', 'descanso', 'sueño']; }); return s; };
const rng = () => createRng(1);

test('validateSchedule exige turno de sueño', () => {
  assert.deepEqual(validateSchedule({ c1: ['trabajo', 'trabajo', 'trabajo'] }), ['c1 no tiene turno de sueño']);
  assert.deepEqual(validateSchedule({ c1: ['trabajo', 'trabajo', 'sueño'] }), []);
});

test('trabajo es alias de experimentos', () => {
  assert.deepEqual(TASKS.trabajo, TASKS.experimentos);
});

test('reparacion con taller en medio', () => {
  const s = idle(mk(['taller']));
  const eng = s.crew[0]; eng.stats.tecnica = 8;
  s.schedule[eng.id] = ['reparacion', 'sueño', 'sueño'];
  const m = s.modules.find((x) => x.type === 'taller'); m.health = 40;
  const parts = s.resources.parts;
  const { state } = applyTasks(s, rng());
  assert.ok(Math.abs(state.modules.find((x) => x.type === 'taller').health - (40 + 15 * 1.5 * 8 / 7)) < 1e-9);
  assert.equal(state.resources.parts, parts - 2);
  assert.equal(s.modules.find((x) => x.type === 'taller').health, 40);
});

test('reparacion sin piezas', () => {
  const s = idle(mk());
  s.resources.parts = 1;
  s.modules[0].health = 50;
  s.schedule[s.crew[0].id] = ['reparacion', 'sueño', 'sueño'];
  const { state, log } = applyTasks(s, rng());
  assert.equal(state.modules[0].health, 50);
  assert.ok(log.includes('Faltan piezas para reparar'));
});

test('cultivo cuida el huerto (crece por etapas); sin invernadero no hace nada', () => {
  const s = idle(mk());
  s.schedule[s.crew[0].id] = ['cultivo', 'sueño', 'sueño'];
  assert.equal(applyTasks(s, rng()).state.resources.food, s.resources.food);
  const g = idle(mk(['invernadero']));
  g.crew[0].stats.ciencia = 7; g.crew[0].role = 'cientifico';
  g.schedule[g.crew[0].id] = ['cultivo', 'sueño', 'sueño'];
  const after = applyTasks(g, rng()).state;
  assert.equal(after.resources.food, g.resources.food);
  assert.ok(after.garden.care > 0);
});

test('ejercicio, sueño y refugio en ctx', () => {
  const s = idle(mk(['refugio']));
  s.schedule[s.crew[0].id] = ['ejercicio', 'refugio', 'sueño'];
  s.schedule[s.crew[1].id] = ['refugio', 'descanso', 'sueño'];
  const { ctx } = applyTasks(s, rng());
  assert.ok(ctx.exercised.has(s.crew[0].id));
  assert.ok(ctx.slept.has(s.crew[1].id));
  assert.equal(ctx.sheltered, true);
  assert.equal(ctx.lifeSupportOn, true);
  s.schedule[s.crew[1].id] = ['descanso', 'descanso', 'sueño'];
  assert.equal(applyTasks(s, rng()).ctx.sheltered, false);
});

test('fatiga +10 por turno de trabajo', () => {
  const s = idle(mk());
  const c = s.crew[0]; c.fatigue = 0;
  s.schedule[c.id] = ['mantenimiento', 'produccion', 'sueño'];
  assert.equal(applyTasks(s, rng()).state.crew[0].fatigue, 20);
});

test('experimentos con laboratorio generan datos y ciencia; bajada diaria', () => {
  const s = idle(mk(['laboratorio', 'antena']));
  s.crew[0].role = 'cientifico'; s.crew[0].stats.ciencia = 7;
  s.schedule[s.crew[0].id] = ['experimentos', 'sueño', 'sueño'];
  const { state } = applyTasks(s, rng());
  assert.ok(state.science > 0);
  assert.ok(state.resources.dataStored >= 0);
});

test('datos en exceso se pierden con log', () => {
  const s = idle(mk());
  s.resources.dataStored = 700;
  const { state, log } = applyTasks(s, rng());
  // cabina downlink 10: bajan 10, quedan 690, se pierden 190
  assert.equal(state.resources.dataStored, 500);
  assert.ok(log.includes('Se perdieron 190.0 GB de datos: falta enlace'));
  assert.ok(Math.abs(state.science - 1) < 1e-9);
});

test('comunicacion suma enlace y moral', () => {
  const s = idle(mk());
  s.resources.dataStored = 100;
  s.crew.forEach((c) => { c.morale = 50; });
  s.schedule[s.crew[0].id] = ['comunicacion', 'sueño', 'sueño'];
  const { state } = applyTasks(s, rng());
  assert.equal(state.resources.dataStored, 80);
  assert.equal(state.crew[0].morale, 58);
  assert.equal(state.crew[1].morale, 63); // 2 descansos (+10) + 3
});

test('eva repara externos y da radiacion', () => {
  const s = idle(mk(['paneles']));
  const c = s.crew[0]; c.stats.fuerza = 7; c.stats.temple = 7; c.role = 'piloto';
  const b = s.crew[1]; b.stats.fuerza = 7; b.stats.temple = 7; b.role = 'piloto';
  s.modules.find((m) => m.type === 'paneles').health = 50;
  // Protocolo: en pareja y con pre-respiración en el turno anterior (el de la noche).
  s.schedule[c.id] = ['eva', 'sueño', 'prerespiracion'];
  s.schedule[b.id] = ['eva', 'sueño', 'prerespiracion'];
  const { state } = applyTasks(s, { chance: () => false });
  assert.equal(state.modules.find((m) => m.type === 'paneles').health, 100);
  assert.equal(state.crew[0].radiation, c.radiation + 1);
});

test('medico cura al mas dañado y gasta medicina', () => {
  const s = idle(mk());
  const doc = s.crew[0]; doc.role = 'medico'; doc.stats.medicina = 7;
  s.crew[1].health = 50; s.crew[1].radiation = 10;
  s.schedule[doc.id] = ['medico', 'sueño', 'sueño'];
  const { state } = applyTasks(s, rng());
  assert.equal(state.crew[1].health, 65);
  assert.equal(state.crew[1].radiation, 5);
  assert.equal(state.resources.meds, s.resources.meds - 1);
});

test('solo las minimisiones activas apartan a la tripulación', () => {
  const s = idle(mk());
  const [a, b] = s.crew;
  s.minis.push({ id: 'radio_escuelas', status: 'hecha', crewIds: [a.id], deadline: 9, daysLeft: 0 });
  s.minis.push({ id: 'lanzar_cubesats', status: 'activa', crewIds: [b.id], deadline: 9, daysLeft: 1 });
  const { ctx } = applyTasks(s, rng());
  assert.ok(ctx.slept.has(a.id));
  assert.ok(!ctx.slept.has(b.id));
});

test('turnos automáticos: la noche es sueño y la pre-respiración se pone sola', () => {
  assert.deepEqual(normalizeSchedule(['trabajo', 'ejercicio', 'eva']), ['trabajo', 'ejercicio', 'sueño']);
  // EVA en la mañana: esa noche duermen en la esclusa (campamento).
  assert.deepEqual(normalizeSchedule(['eva', 'ejercicio', 'sueño']), ['eva', 'ejercicio', 'campamento']);
  // EVA en la tarde: la mañana es pre-respiración.
  assert.deepEqual(normalizeSchedule(['mantenimiento', 'eva', 'sueño']), ['prerespiracion', 'eva', 'sueño']);
  // Si deja la EVA, la pre-respiración se quita.
  assert.deepEqual(normalizeSchedule(['prerespiracion', 'descanso', 'sueño']), ['descanso', 'descanso', 'sueño']);
  assert.deepEqual(validateSchedule({ c1: normalizeSchedule(['eva', 'eva', 'eva']) }), []);
});

test('EVA de la mañana con campamento: GO, duermen y queda un turno libre', () => {
  const s = idle(mk(['paneles']));
  const [a, b] = s.crew;
  s.modules.find((m) => m.type === 'paneles').health = 50;
  s.schedule[a.id] = ['eva', 'ejercicio', 'sueño'];
  s.schedule[b.id] = ['eva', 'ejercicio', 'sueño'];
  const { state, ctx, log } = applyTasks(s, { chance: () => false });
  assert.ok(!log.some((l) => l.includes('NO GO')));
  assert.ok(state.modules.find((m) => m.type === 'paneles').health > 50);
  assert.ok(ctx.slept.has(a.id) && ctx.slept.has(b.id));
  assert.ok(ctx.exercised.has(a.id) && ctx.exercised.has(b.id));
});

test('EVA de la tarde: la mañana se usa para pre-respirar y sale con GO', () => {
  const s = idle(mk(['paneles']));
  const [a, b] = s.crew;
  s.modules.find((m) => m.type === 'paneles').health = 50;
  s.schedule[a.id] = ['mantenimiento', 'eva', 'sueño'];
  s.schedule[b.id] = ['descanso', 'eva', 'sueño'];
  const { state, log } = applyTasks(s, { chance: () => false });
  assert.ok(!log.some((l) => l.includes('NO GO')));
  assert.deepEqual(state.schedule[a.id], ['prerespiracion', 'eva', 'sueño']);
});
