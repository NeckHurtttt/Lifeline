import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, INSTRUMENTS, LAUNCHERS, ORBITS, DIFFICULTY, SCENARIOS, GRID, CARGO } from '../../src/data/catalog.js';
import { ROLES, NAMES, TRAITS, STAT_RANGES } from '../../src/data/crew.js';

const nums = (o) => Object.values(o).filter((v) => typeof v === 'number');

test('entradas con id igual a su clave y números finitos', () => {
  for (const tabla of [MODULES, INSTRUMENTS, LAUNCHERS, ORBITS, ROLES, TRAITS]) {
    for (const [k, v] of Object.entries(tabla)) {
      assert.equal(v.id, k);
      assert.equal(typeof v.name, 'string');
      for (const n of nums(v)) assert.ok(Number.isFinite(n), `${k}`);
    }
  }
  assert.equal(Object.keys(MODULES).length, 14);
  assert.equal(Object.keys(INSTRUMENTS).length, 6);
  assert.equal(Object.keys(LAUNCHERS).length, 3);
  assert.equal(Object.keys(ORBITS).length, 3);
});

test('módulos obligatorios y valores clave', () => {
  assert.equal(MODULES.cabina.required, true);
  assert.equal(MODULES.soporte_vital.required, true);
  assert.equal(Object.values(MODULES).filter((m) => m.required).length, 2);
  assert.equal(MODULES.paneles.kw, 12);
  assert.equal(MODULES.baterias.batteryKwh, 60);
  assert.equal(INSTRUMENTS.plantas_microg.foodPerDay, 0.2);
});

test('dificultad', () => {
  assert.deepEqual(Object.keys(DIFFICULTY), ['facil', 'medio', 'dificil']);
  for (const d of Object.values(DIFFICULTY)) {
    const s = d.severityWeights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s - 1) < 1e-9);
  }
  assert.equal(DIFFICULTY.facil.deathAllowed, false);
});

test('escenario, rejilla y carga', () => {
  assert.equal(SCENARIOS.estacion.days, 365);
  assert.deepEqual(GRID, { cols: 6, rows: 4 });
  assert.equal(CARGO.baseDays, 90);
});

test('tripulación', () => {
  assert.deepEqual(Object.keys(ROLES).sort(), ['biologo', 'cientifico', 'comandante', 'ingeniero', 'medico', 'piloto']);
  for (const r of Object.values(ROLES)) assert.ok(['fuerza', 'tecnica', 'ciencia', 'medicina', 'temple'].includes(r.mainStat));
  const t = Object.values(TRAITS);
  assert.equal(t.filter((x) => x.positive === true).length, 6);
  assert.equal(t.filter((x) => x.positive === false).length, 6);
  assert.equal(NAMES.length, 24);
  assert.equal(new Set(NAMES).size, 24);
  assert.deepEqual(STAT_RANGES, { main: [7, 9], other: [2, 6] });
});
