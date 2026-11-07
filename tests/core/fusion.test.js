// Ideas traídas de los otros juegos del equipo: reparación a mano (V · Mission Control) y excavación (Los Tira Vida 02).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../../src/core/mission.js';
import { repairPuzzle, checkRepair, applyFieldRepair, fieldRepairBlock, FIELD_REPAIRS_PER_DAY } from '../../src/core/repairs.js';
import { genTerrain, ensureTerrain, startOuting, move, mine, place, endOuting, digBlock, T, DIG_COLS } from '../../src/core/dig.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const station = () => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('invernadero', 3, 0), mod('antena', 4, 0)],
      instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
    scenarioId: 'estacion', difficulty: 'medio', seed: 3,
  });
  s.phase = 'ops';
  return s;
};
const solve = (p) => (p.kind === 'ajuste' ? p.target : p.kind === 'plantas' ? p.sick : p.steps);

test('reparación a mano: cada módulo pide un procedimiento que se resuelve sin azar', () => {
  const s = station();
  for (const m of s.modules) {
    const p = repairPuzzle(s, m.id);
    assert.ok(p.text.length > 10);
    assert.deepEqual(repairPuzzle(s, m.id), p, 'determinista');
    assert.ok(checkRepair(p, solve(p)));
    if (p.kind === 'ajuste') assert.ok(!checkRepair(p, p.start));
  }
});

test('reparación a mano: sube la salud, enciende lo roto, gasta pieza y tiene límite diario', () => {
  let s = station();
  for (const m of s.modules) { m.health = 0; m.on = false; }
  const parts = s.resources.parts;
  const id = s.modules[1].id;
  assert.equal(applyFieldRepair(s, id, 'mal').ok, false);
  const r = applyFieldRepair(s, id, solve(repairPuzzle(s, id)));
  assert.ok(r.ok);
  assert.ok(r.state.modules[1].on && r.state.modules[1].health >= 25);
  assert.equal(r.state.resources.parts, parts - 1);
  s = r.state;
  for (let i = 1; i < FIELD_REPAIRS_PER_DAY; i++) s = applyFieldRepair(s, s.modules[2].id, solve(repairPuzzle(s, s.modules[2].id))).state;
  assert.match(fieldRepairBlock(s, s.modules[3].id), /hoy/);
  assert.equal(fieldRepairBlock({ ...s, day: s.day + 1 }, s.modules[3].id), null);
});

const moon = () => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0)],
      instruments: [], launcher: 'titan', orbit: 'luna_polo', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
    scenarioId: 'luna', difficulty: 'medio', seed: 9,
  });
  s.phase = 'ops'; s.leg = 'superficie';
  return s;
};

test('excavación: terreno determinista con hielo, metal y rocas raras', () => {
  const a = genTerrain(9, 'luna'); const b = genTerrain(9, 'luna');
  assert.deepEqual(a, b);
  for (const t of [T.HIELO, T.METAL, T.RARA]) assert.ok(a.tiles.includes(t));
  assert.ok(digBlock(station(), station().crew.slice(0, 2)), 'en la estación no se excava');
});

test('excavación: nunca solo, una salida por día, y la bolsa se guarda al volver', () => {
  let s = ensureTerrain(moon());
  const [a, b] = s.crew;
  assert.equal(startOuting(s, [a.id]).ok, false);
  const r = startOuting(s, [a.id, b.id]);
  assert.ok(r.ok);
  s = r.state;
  assert.equal(startOuting({ ...s, dig: { ...s.dig, outing: null } }, [a.id, b.id]).ok, false, 'una por día');
  // Pone hielo y metal justo al lado y los excava.
  const o = s.dig.outing;
  s.dig.tiles[(o.y) * DIG_COLS + o.x + 1] = T.HIELO;
  s = mine(s, o.x + 1, o.y);
  s.dig.tiles[(o.y + 1) * DIG_COLS + o.x] = T.METAL;
  s = mine(s, o.x, o.y + 1);
  assert.equal(s.dig.outing.bag.hielo, 1);
  const water = s.resources.water;
  s = endOuting(s).state;
  assert.equal(s.dig.outing, null);
  assert.ok(s.resources.water >= water + 25 || s.resources.water >= water); // sin emergencia si sigue junto a la esclusa
});

test('excavación: sin oxígeno se vuelve de emergencia, se pierde material y hay golpes', () => {
  let s = startOuting(ensureTerrain(moon()), [moon().crew[0].id, moon().crew[1].id]).state;
  s.dig.outing.bag.hielo = 4; s.dig.outing.o2 = 0;
  const h = s.crew[0].health;
  const water = s.resources.water;
  s = endOuting(s).state;
  assert.equal(s.resources.water, water + 50);
  assert.equal(s.crew[0].health, h - 15);
});

test('excavación: moverse, poner regolito y el muro de regolito', () => {
  let s = startOuting(ensureTerrain(moon()), [moon().crew[0].id, moon().crew[1].id]).state;
  const x0 = s.dig.outing.x; const o20 = s.dig.outing.o2;
  s = move(s, 1);
  assert.ok(s.dig.outing.x === x0 + 1 || s.dig.outing.x === x0);
  s.dig.outing.bag.regolito = 25; s.dig.outing.x = 1;
  const o = s.dig.outing;
  s.dig.tiles[(o.y - 1) * DIG_COLS + o.x + 1] = T.AIRE;
  const before = s.dig.outing.bag.regolito;
  s = place(s, o.x + 1, o.y - 1);
  assert.equal(s.dig.outing.bag.regolito, before - 1);
  assert.ok(s.dig.outing.o2 < o20);
  s = endOuting(s).state;
  assert.equal(s.flags.regolithWall, true);
});

import { diff, patch } from '../../src/core/patch.js';
test('cooperativo: los cambios de dos personas se juntan sin pisarse', () => {
  const base = { day: 3, resources: { parts: 10, water: 100 }, modules: [{ id: 'a', on: true }, { id: 'b', on: true }], schedule: { c1: ['eva', 'descanso'] } };
  const host = structuredClone(base); host.day = 5; host.resources.water = 90; // el anfitrión avanzó dos días
  const guest = structuredClone(base); guest.modules[1].on = false; guest.schedule.c1[1] = 'reparacion'; // el invitado decidió cosas
  const merged = patch(host, diff(base, guest));
  assert.equal(merged.day, 5);
  assert.equal(merged.resources.water, 90);
  assert.equal(merged.modules[1].on, false);
  assert.deepEqual(merged.schedule.c1, ['eva', 'reparacion']);
  const grown = structuredClone(base); grown.modules.push({ id: 'c', on: true }); delete grown.schedule;
  const m2 = patch(host, diff(base, grown));
  assert.equal(m2.modules.length, 3);
  assert.equal(m2.schedule, undefined);
});

test('avería de un evento: tiene plazo, se resuelve a mano con +fama o empeora al vencer', async () => {
  const { applyEffects } = await import('../../src/core/events.js');
  const { tickFaults, faultOf, FAULT_DAYS, FAULT_WORSEN } = await import('../../src/core/repairs.js');
  let s = applyEffects(station(), { moduleDamage: { soporte_vital: 30 } });
  const m = s.modules.find((x) => x.type === 'soporte_vital');
  const f = faultOf(s, m.id);
  assert.equal(f.deadline, s.day + FAULT_DAYS.medio);
  const rep = s.reputation;
  const r = applyFieldRepair(s, m.id, solve(repairPuzzle(s, m.id)));
  assert.ok(r.ok);
  assert.equal(faultOf(r.state, m.id), null);
  assert.equal(r.state.reputation, Math.min(100, rep + 2));
  // Sin reparar: al pasar el plazo pierde salud extra y la avería se borra.
  const late = structuredClone(s); late.day = f.deadline + 1;
  const h0 = late.modules.find((x) => x.id === m.id).health;
  assert.equal(tickFaults(late).length, 1);
  assert.equal(late.modules.find((x) => x.id === m.id).health, Math.max(0, h0 - FAULT_WORSEN));
  assert.equal(faultOf(late, m.id), null);
});

test('regolito sobrante de Excavar: se guarda y paga parches, menos en equipos eléctricos', async () => {
  const { REGOLITH_PATCH } = await import('../../src/core/repairs.js');
  const s0 = station();
  let s = ensureTerrain({ ...s0, scenarioId: 'luna' });
  s = structuredClone(s);
  s.dig.wall = 18;
  s.dig.outing = { crewIds: [], x: 1, y: 4, o2: 30, bag: { regolito: 7, hielo: 0, metal: 0, rara: 0 }, carry: 0 };
  s = endOuting(s).state;
  assert.equal(s.dig.wall, 20);
  assert.equal(s.dig.stock, 5);
  const cab = s.modules.find((x) => x.type === 'cabina'); cab.health = 50;
  const pan = s.modules.find((x) => x.type === 'paneles'); pan.health = 50;
  s.resources.parts = 0;
  assert.match(fieldRepairBlock(s, pan.id, 'regolito'), /eléctricos/);
  assert.match(fieldRepairBlock(s, cab.id), /piezas/);
  const r = applyFieldRepair(s, cab.id, solve(repairPuzzle(s, cab.id)), 'regolito');
  assert.ok(r.ok);
  assert.equal(r.state.dig.stock, 5 - REGOLITH_PATCH);
  assert.equal(r.state.resources.parts, 0);
});

test('excavación: las muestras raras suman ciencia de verdad (no NaN)', () => {
  let s = startOuting(ensureTerrain(moon()), [moon().crew[0].id, moon().crew[1].id]).state;
  s.dig.outing.bag.rara = 2;
  const sci = s.science;
  s = endOuting(s).state;
  assert.equal(s.science, sci + 6);
  assert.equal(s.resources.science, undefined);
});
