import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDesign, canLaunch } from '../../src/core/design.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y, health: 100, on: true, priority: 1 });
const base = () => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 4, 0), mod('baterias', 3, 0)],
  instruments: [], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['a', 'b', 'c', 'd'], cargoDays: 90,
});

test('diseño mínimo válido', () => {
  const r = computeDesign(base(), 'estacion', 'medio');
  assert.deepEqual(r.errors, []);
  assert.equal(canLaunch(r), true);
  assert.equal(r.capacity, 25);
  // 2 paneles al 50 % de sol con 90 % de rendimiento, menos cabina+soporte (5 kW) y 4 astronautas (0,4 kW c/u)
  assert.ok(Math.abs(r.powerNet - (2 * 12 * 0.5 * 0.9 - 5 - 4 * 0.4)) < 1e-9);
  assert.equal(r.energyPerDay, r.powerNet * 24);
  assert.equal(r.cargoMax, 90);
  assert.equal(r.crewMax, 4);
  assert.equal(r.budget, 1100);
});

test('sin cabina', () => {
  const d = base(); d.modules.shift();
  const r = computeDesign(d, 'estacion', 'medio');
  assert.ok(r.errors.includes('Falta el módulo obligatorio: cabina'));
  assert.equal(canLaunch(r), false);
});

test('sin soporte vital con acento', () => {
  const d = base(); d.modules.splice(1, 1);
  assert.ok(computeDesign(d, 'estacion', 'medio').errors.includes('Falta el módulo obligatorio: soporte vital'));
});

test('masa excede capacidad', () => {
  const d = base(); d.launcher = 'quetzal5'; d.orbit = 'geo';
  d.modules.push(mod('bodega', 4, 0)); d.modules.push(mod('taller', 5, 0));
  for (let i = 0; i < 4; i++) d.modules.push(mod('refugio', i, 1));
  const r = computeDesign(d, 'estacion', 'dificil');
  assert.ok(r.errors.some((e) => e.includes('35.0 t')), r.errors.join('|'));
});

test('instrumentos sin laboratorio', () => {
  const d = base(); d.instruments = ['camara_tierra', 'espectrometro', 'cristales'];
  assert.ok(computeDesign(d, 'estacion', 'medio').errors.includes('Hay más instrumentos que ranuras de laboratorio'));
});

test('datos superan enlace: aviso', () => {
  const d = base(); d.modules.push(mod('laboratorio', 4, 0)); d.instruments = ['camara_tierra', 'camara_tierra'];
  const r = computeDesign(d, 'estacion', 'medio');
  assert.deepEqual(r.warnings, ['Los datos generados (40.0 GB/día) superan el enlace (10.0 GB/día): se perderá ciencia']);
  assert.equal(r.dataPerDay, 40);
  assert.equal(r.sciencePerDay, 4);
});

test('misma casilla y fuera de cuadrícula', () => {
  const d = base(); d.modules.push(mod('radar', 0, 0), mod('antena', 6, 0));
  const r = computeDesign(d, 'estacion', 'medio');
  assert.ok(r.errors.includes('Dos módulos en la misma casilla'));
  assert.ok(r.errors.includes('Módulo fuera de la cuadrícula'));
});

test('presupuesto, energía, tripulación y carga', () => {
  const d = base(); d.modules = [mod('cabina', 0, 0), mod('soporte_vital', 1, 0)];
  for (let i = 0; i < 12; i++) d.modules.push(mod('refugio', i % 6, 1 + Math.floor(i / 6)));
  d.crewRoles = ['a', 'b', 'c', 'd', 'e']; d.cargoDays = 100; d.launcher = 'quetzal5';
  const r = computeDesign(d, 'estacion', 'dificil');
  assert.ok(r.errors.some((e) => e.startsWith('Te pasas del presupuesto por ') && e.endsWith(' M')));
  assert.ok(r.errors.includes('La energía no alcanza: déficit de 312.0 kWh por día'));
  assert.ok(r.errors.includes('Más tripulantes que camas (máx. 4 por cabina)'));
  assert.ok(r.errors.includes('Carga de 100 días supera la bodega (máx. 90)'));
});
