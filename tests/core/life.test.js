import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDailyLife } from '../../src/core/life.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const design = () => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0)],
  instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90,
});
const mk = (difficulty = 'medio') => createMission({ design: design(), scenarioId: 'estacion', difficulty, seed: 3 });
const ctx = (s, o = {}) => ({
  lifeSupportOn: true, sheltered: false,
  exercised: new Set(s.crew.map((c) => c.id)), slept: new Set(s.crew.map((c) => c.id)), ...o,
});
const noTraits = (s) => { s.crew.forEach((c) => { c.traits = []; }); return s; };

test('un dia con soporte vital: comida y agua', () => {
  const s = noTraits(mk());
  const { state, log } = applyDailyLife(s, ctx(s));
  assert.ok(Math.abs(s.resources.food - state.resources.food - 7.2) < 0.01);
  const w = 2.75 * 4 * 0.02 + 0.95 * 4;
  assert.ok(Math.abs(s.resources.water - state.resources.water - w) < 0.01);
  assert.equal(state.resources.o2, s.resources.o2);
  assert.ok(Array.isArray(log));
});

test('no muta el estado de entrada', () => {
  const s = mk();
  const copy = structuredClone(s);
  applyDailyLife(s, ctx(s));
  assert.deepEqual(s, copy);
});

test('comida insuficiente: queda en 0, nunca negativa, hambre sube', () => {
  const s = noTraits(mk());
  s.resources.food = 3;
  s.crew.forEach((c) => { c.hunger = 10; });
  const { state } = applyDailyLife(s, ctx(s));
  assert.equal(state.resources.food, 0);
  state.crew.forEach((c) => assert.equal(c.hunger, 45));
});

test('O2 en 0 y soporte apagado dos dias: salud <= 20', () => {
  let s = noTraits(mk());
  s.resources.o2 = 0;
  for (let i = 0; i < 2; i++) s = applyDailyLife(s, ctx(s, { lifeSupportOn: false })).state;
  s.crew.forEach((c) => assert.ok(c.health <= 20));
  assert.ok(s.resources.o2 >= 0);
});

test('soporte apagado baja el tanque de O2 y no recicla agua', () => {
  const s = noTraits(mk());
  const { state } = applyDailyLife(s, ctx(s, { lifeSupportOn: false }));
  assert.ok(Math.abs(s.resources.o2 - state.resources.o2 - 3.36) < 0.01);
  assert.ok(Math.abs(s.resources.water - state.resources.water - 11) < 0.01);
});

test('sin ejercicio 10 dias: hueso 95', () => {
  let s = noTraits(mk());
  for (let i = 0; i < 10; i++) s = applyDailyLife(s, ctx(s, { exercised: new Set() })).state;
  s.crew.forEach((c) => assert.equal(c.bone, 95));
});

test('facil con salud 1 y O2 0: evacuado, no muerto', () => {
  const s = noTraits(mk('facil'));
  s.resources.o2 = 0;
  s.crew[0].health = 1;
  const { state, log } = applyDailyLife(s, ctx(s, { lifeSupportOn: false }));
  assert.equal(state.crew[0].alive, false);
  assert.equal(state.crew[0].evacuated, true);
  assert.ok(log.some((l) => l.includes('fue evacuado a la Tierra')));
  assert.ok(!log.some((l) => l.includes('ha muerto')));
});

test('medio: muere y se loguea', () => {
  const s = noTraits(mk('medio'));
  s.resources.o2 = 0;
  s.crew[0].health = 1;
  const { state, log } = applyDailyLife(s, ctx(s, { lifeSupportOn: false }));
  assert.equal(state.crew[0].alive, false);
  assert.ok(!state.crew[0].evacuated);
  assert.ok(log.some((l) => l.includes('ha muerto')));
});

test('moral, fatiga y radiacion', () => {
  const s = noTraits(mk());
  s.crew[0].traits = ['claustrofobico'];
  s.crew.forEach((c) => { c.morale = 50; c.fatigue = 50; c.radiation = 0; });
  const { state } = applyDailyLife(s, ctx(s, { sheltered: true }));
  assert.equal(state.crew[0].morale, 50 - 2 + 3);
  assert.equal(state.crew[1].morale, 50 - 1 + 3);
  assert.equal(state.crew[0].fatigue, 15);
  assert.ok(Math.abs(state.crew[0].radiation - 0.1) < 1e-9);
});

test('fatiga >= 80 baja moral; sin dormir sube 40', () => {
  const s = noTraits(mk());
  s.crew.forEach((c) => { c.morale = 50; c.fatigue = 50; });
  const { state } = applyDailyLife(s, ctx(s, { slept: new Set() }));
  assert.equal(state.crew[0].fatigue, 90);
  assert.equal(state.crew[0].morale, 50 - 1 - 5);
});

test('sereno reduce a la mitad las perdidas de moral', () => {
  const s = noTraits(mk());
  s.crew.forEach((c) => { c.morale = 50; c.fatigue = 50; });
  s.crew[0].traits = ['sereno'];
  const { state } = applyDailyLife(s, ctx(s, { slept: new Set() }));
  assert.equal(state.crew[0].morale, 47);
  assert.equal(state.crew[1].morale, 44);
});

test('resistente: radiacion x0.8', () => {
  const s = noTraits(mk());
  s.crew[0].traits = ['resistente'];
  const { state } = applyDailyLife(s, ctx(s));
  assert.ok(Math.abs(state.crew[0].radiation - 0.4) < 1e-9);
});

test('fragil: dano de salud x1.2', () => {
  const s = noTraits(mk());
  s.resources.o2 = 0;
  s.crew[0].traits = ['fragil'];
  const { state } = applyDailyLife(s, ctx(s, { lifeSupportOn: false }));
  assert.ok(Math.abs(state.crew[0].health - 52) < 1e-9);
  assert.equal(state.crew[1].health, 60);
});

test('insomne: duerme -25, sin dormir +50', () => {
  const s = noTraits(mk());
  s.crew.forEach((c) => { c.fatigue = 50; });
  s.crew[0].traits = ['insomne'];
  let r = applyDailyLife(s, ctx(s));
  assert.equal(r.state.crew[0].fatigue, 25);
  assert.equal(r.state.crew[1].fatigue, 15);
  r = applyDailyLife(s, ctx(s, { slept: new Set() }));
  assert.equal(r.state.crew[0].fatigue, 100);
});

test('soporte vital sin agua: la electrolisis sale del tanque de O2', () => {
  const s = noTraits(mk());
  s.resources.water = 0;
  const { state } = applyDailyLife(s, ctx(s));
  assert.ok(Math.abs(s.resources.o2 - state.resources.o2 - 3.36) < 0.01);
  state.crew.forEach((c) => assert.equal(c.health, 100));
});

test('soporte vital sin agua ni O2: salud -40 (x1.2 fragil)', () => {
  const s = noTraits(mk());
  s.resources.water = 0;
  s.resources.o2 = 0;
  s.crew[0].traits = ['fragil'];
  const { state } = applyDailyLife(s, ctx(s));
  assert.ok(Math.abs(state.crew[0].health - 52) < 1e-9);
  assert.equal(state.crew[1].health, 60);
});
