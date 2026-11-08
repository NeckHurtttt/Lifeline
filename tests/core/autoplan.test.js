import { test } from 'node:test';
import { closeDoor, resolveFlash } from '../../src/core/flash.js';
import assert from 'node:assert/strict';
import { autoAssign, needs } from '../../src/core/autoplan.js';
import { createMission } from '../../src/core/mission.js';
import { runUntilInterrupt } from '../../src/core/sim.js';
import { validateSchedule } from '../../src/core/tasks.js';
import { resolveEvent, recommendedOption } from '../../src/core/events.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = () => {
  const s = createMission({
    design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 4, 0), mod('invernadero', 5, 0), mod('laboratorio', 6, 0)],
      instruments: [], launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
    scenarioId: 'estacion', difficulty: 'facil', seed: 3,
  });
  s.phase = 'ops';
  return s;
};

test('reparto automático: horario válido, todos duermen', () => {
  const s = autoAssign(mk());
  assert.deepEqual(validateSchedule(s.schedule), []);
  for (const c of s.crew) assert.equal(s.schedule[c.id][2], 'sueño');
});

test('reparto automático: si alguien está enfermo, otro lo atiende y él descansa', () => {
  const s0 = mk();
  s0.crew[0].health = 30;
  const s = autoAssign(s0);
  assert.equal(s.schedule[s0.crew[0].id][0], 'descanso');
  assert.ok(Object.values(s.schedule).some((d) => d[0] === 'medico'));
});

test('reparto automático: con poca agua, alguien produce agua', () => {
  const s0 = mk();
  s0.resources.water = 1;
  assert.equal(needs(s0)[0], 'produccion');
  assert.ok(Object.values(autoAssign(s0).schedule).some((d) => d[0] === 'produccion'));
});

test('reparto automático: una misión fácil jugada solo con él llega al final', () => {
  let s = mk();
  for (let i = 0; i < 3000 && s.phase === 'ops'; i++) {
    if (s.flash) { for (const d of s.flash.doors) s = closeDoor(s, d); s = resolveFlash(s).state; continue; }
    if (s.pending) { s = resolveEvent(s, s.pending.eventId, s.pending.severity, recommendedOption(s.pending.eventId), { int: () => 5, chance: () => false, next: () => 0.5 }).state; continue; }
    s = runUntilInterrupt(s, 365, autoAssign).state;
  }
  assert.ok(s.crew.some((c) => c.alive), 'alguien sobrevive');
  assert.notEqual(s.phase, 'ops');
});
