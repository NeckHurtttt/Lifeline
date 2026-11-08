import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFlash, closeDoor, resolveFlash, rollFlash, targets, CRITICAL } from '../../src/core/flash.js';
import { advanceDay } from '../../src/core/sim.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (difficulty = 'medio', extra = {}) => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('laboratorio', 3, 0), mod('baterias', 2, 1)],
      launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero'], cargoDays: 90 },
    scenarioId: 'estacion', difficulty, seed: 7,
  });
  return { ...s, phase: 'ops', day: 10, ...extra };
};

test('los módulos críticos nunca son blanco de un evento relámpago', () => {
  const s = mk();
  assert.ok(targets(s).length > 0);
  assert.ok(targets(s).every((m) => !CRITICAL.has(m.type)));
});

test('escotillas = una por cada vecino del módulo afectado', () => {
  const s = mk();
  const f = makeFlash(s, 'meteorito', 'paneles-2-0');
  assert.equal(f.doors.length, 3); // soporte vital, laboratorio y baterías
});

test('cerrar todo a tiempo salva el módulo; no cerrar lo pierde', () => {
  let s = mk();
  s.flash = makeFlash(s, 'meteorito', 'paneles-2-0');
  let ok = s;
  for (const d of s.flash.doors) ok = closeDoor(ok, d);
  const r1 = resolveFlash(ok);
  assert.equal(r1.success, true);
  assert.ok(r1.state.modules.some((m) => m.id === 'paneles-2-0'));
  assert.equal(r1.state.flash, null);
  const r2 = resolveFlash(closeDoor(s, s.flash.doors[0]));
  assert.equal(r2.success, false);
  assert.ok(!r2.state.modules.some((m) => m.id === 'paneles-2-0'));
  assert.equal(r2.state.lostModules.length, 1);
});

test('choque de escombros: el módulo se pierde siempre, cerrar protege al resto', () => {
  const s = mk();
  s.flash = makeFlash(s, 'escombros', 'laboratorio-3-0');
  let ok = s; for (const d of s.flash.doors) ok = closeDoor(ok, d);
  const r = resolveFlash(ok);
  assert.ok(!r.state.modules.some((m) => m.type === 'laboratorio'));
  assert.ok(r.state.crew.every((c, i) => c.health === s.crew[i].health));
});

test('modo niños: si no alcanza, el módulo se rompe pero no se pierde, y hay más tiempo', () => {
  const s = mk('medio', { kids: true });
  s.flash = makeFlash(s, 'incendio', 'paneles-2-0');
  assert.ok(s.flash.seconds >= 20);
  const r = resolveFlash(s);
  const m = r.state.modules.find((x) => x.id === 'paneles-2-0');
  assert.equal(m.health, 0);
});

test('el dado es determinista y no toca el generador de la partida', () => {
  let found = null;
  for (let d = 4; d < 400 && !found; d++) { const r = rollFlash(mk('dificil', { day: d })); if (r.flash) found = r; }
  assert.ok(found, 'en 400 días sale al menos uno');
  assert.equal(found.rng, mk().rng);
  assert.deepEqual(rollFlash({ ...found, flash: null }).flash, found.flash);
});

test('con un evento relámpago abierto, el día no avanza', () => {
  const s = mk(); s.flash = makeFlash(s, 'meteorito', 'paneles-2-0');
  const r = advanceDay(s);
  assert.equal(r.interrupt.kind, 'flash');
  assert.equal(r.state.day, s.day);
});
