import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fastForward, juradoStep } from '../../src/core/jurado.js';
import { rollFlash, autoSolve, resolveFlash } from '../../src/core/flash.js';
import { advanceDay } from '../../src/core/sim.js';
import { createMission } from '../../src/core/mission.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const DESIGNS = {
  estacion: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1), mod('paneles', 4, 0)],
    instruments: ['camara_tierra', 'espectrometro'], launcher: 'condorH', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90 },
  luna: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0), mod('pila_regenerativa', 0, 1), mod('reactor', 1, 1), mod('laboratorio', 2, 1), mod('bodega', 3, 1), mod('extractor_hielo', 4, 1), mod('rover_autonomo', 5, 1), mod('antena', 0, 2)],
    instruments: ['sismometro', 'georradar'], launcher: 'titan', orbit: 'luna_polo', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 150 },
  marte: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('planta_combustible', 3, 0), mod('paneles', 4, 0), mod('paneles', 5, 0), mod('reactor', 0, 1), mod('pila_regenerativa', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1), mod('refugio', 0, 2), mod('enfermeria', 1, 2), mod('bodega', 2, 2), mod('antena', 3, 2), mod('paneles', 4, 2)],
    instruments: ['buscador_vida', 'analizador_rocas'], launcher: 'titan', orbit: 'marte_jezero', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 240 },
};

const mk = (scn = 'estacion', seed = 11) => {
  const s = createMission({ design: structuredClone(DESIGNS[scn]), scenarioId: scn, difficulty: 'facil', seed, demo: true });
  return { ...s, phase: 'ops', jurado: true, flashBoost: 1000, flashOnly: ['meteorito'] };
};

test('modo jurado: el micrometeorito sale seguro en cuanto se puede (día 4)', () => {
  let s = mk();
  for (let i = 0; i < 10 && !s.flash; i++) { s = advanceDay(s).state; if (s.pending) s = { ...s, pending: null }; }
  assert.ok(s.flash, 'debió salir la emergencia');
  assert.equal(s.flash.type, 'meteorito');
  assert.ok(s.day <= 5);
  assert.equal(juradoStep(s, 'ops'), 3);
});

test('modo jurado: después de la emergencia no salen más y pasa al paso 4', () => {
  let s = mk();
  s = rollFlash({ ...s, day: 4 });
  s = resolveFlash(autoSolve(s)).state;
  assert.equal(s.juradoFlash, 'ok');
  assert.equal(s.flashBoost, 0);
  assert.equal(juradoStep(s, 'ops'), 4);
});

for (const scn of ['estacion', 'luna', 'marte']) {
  test(`fastForward termina la misión (${scn}) sin tocar el estado original`, () => {
    const s0 = { ...mk(scn), juradoFlash: 'ok', flashBoost: 0 };
    const before = JSON.stringify(s0);
    const end = fastForward(s0);
    assert.equal(JSON.stringify(s0), before);
    assert.notEqual(end.phase, 'ops');
    assert.ok(['reentry', 'report'].includes(end.phase));
  });
}
