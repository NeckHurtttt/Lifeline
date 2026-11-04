import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../src/core/rng.js';
import { generateCrew, createMission } from '../../src/core/mission.js';
import { NAMES, ROLES, TRAITS, STAT_RANGES } from '../../src/data/crew.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const design = (days = 90) => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0), mod('baterias', 4, 0)],
  instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: days,
});
const mk = (difficulty = 'medio', seed = 7, d = design()) => createMission({ design: d, scenarioId: 'estacion', difficulty, seed });

test('misma semilla, mismos nombres', () => {
  const a = generateCrew(design().crewRoles, createRng(5)).map((c) => c.name);
  const b = generateCrew(design().crewRoles, createRng(5)).map((c) => c.name);
  assert.deepEqual(a, b);
});

test('4 roles -> 4 tripulantes con nombres distintos y rasgos', () => {
  const crew = generateCrew(design().crewRoles, createRng(1));
  assert.equal(crew.length, 4);
  assert.equal(new Set(crew.map((c) => c.name)).size, 4);
  crew.forEach((c, i) => {
    assert.equal(c.id, `c${i + 1}`);
    assert.ok(NAMES.includes(c.name));
    assert.equal(c.traits.length, 2);
    assert.equal(TRAITS[c.traits[0]].positive, true);
    assert.equal(TRAITS[c.traits[1]].positive, false);
    const main = ROLES[c.role].mainStat;
    for (const [k, v] of Object.entries(c.stats)) {
      const [lo, hi] = k === main ? STAT_RANGES.main : STAT_RANGES.other;
      assert.ok(v >= lo && v <= hi);
    }
    assert.equal(c.alive, true);
    assert.equal(c.onEva, false);
    assert.equal(c.health, 100);
    assert.equal(c.fatigue, 0);
    assert.equal(c.radiation, 0);
  });
});

test('comida medio 90 días 4 tripulantes', () => {
  const m = mk();
  assert.ok(Math.abs(m.resources.food - 90 * 1.8 * 4 * 1.2) < 0.01);
  assert.ok(Math.abs(m.resources.o2 - 90 * 0.84 * 4 * 1.2) < 0.01);
});

test('agua inicial con O2 desde agua y colchón de 500 L', () => {
  const m = mk();
  const esperado = (2.75 * 0.02 + 0.95) * 4 * 90 * 1.2 + 500;
  assert.ok(Math.abs(m.resources.water - esperado) < 0.01);
});

test('facil da más comida que dificil', () => {
  assert.ok(mk('facil').resources.food > mk('dificil').resources.food);
});

test('estado inicial', () => {
  const m = mk();
  assert.equal(m.phase, 'launch');
  assert.equal(m.day, 0);
  assert.equal(m.totalDays, 365);
  assert.deepEqual(m.schedule.c1, ['trabajo', 'ejercicio', 'sueño']);
  assert.ok(m.schedule.c1.includes('sueño'));
  assert.equal(m.rations.c1, 'completa');
  assert.equal(m.resources.batteryMax, 120);
  assert.equal(m.resources.battery, 120);
  assert.equal(m.resources.meds, 80);
  assert.equal(m.resources.parts, 30);
  assert.equal(m.resources.fuel, 100);
  assert.equal(m.resources.dataStored, 0);
  assert.equal(m.nextResupply, 60);
  assert.equal(m.reputation, 50);
  assert.equal(m.outcome, null);
  assert.equal(m.pending, null);
  assert.deepEqual(m.alerts, []);
  assert.equal(typeof m.rng, 'number');
  const cab = m.modules.find((x) => x.type === 'cabina');
  assert.equal(cab.health, 100);
  assert.equal(cab.on, true);
  assert.equal(cab.priority, 10);
  assert.equal(m.modules.find((x) => x.type === 'soporte_vital').priority, 9);
  assert.equal(m.modules.find((x) => x.type === 'paneles').priority, 5);
  assert.deepEqual(m.design.instruments, ['camara_tierra']);
});

test('determinista', () => {
  assert.deepEqual(mk('medio', 3), mk('medio', 3));
});
