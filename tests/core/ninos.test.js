import test from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../../src/core/mission.js';
import { advanceDay } from '../../src/core/sim.js';
import { resolveEvent, recommendedOption } from '../../src/core/events.js';
import { EVENTS } from '../../src/data/events.js';
import { autoSolve, resolveFlash } from '../../src/core/flash.js';
import { runReentryStep } from '../../src/core/reentry.js';
import { restoreRng, createRng } from '../../src/core/rng.js';
import { autoAssign } from '../../src/core/autoplan.js';
import { buildReport } from '../../src/core/report.js';
import { kidStars, kidReason, kidsEventMult, kidsFlashDay, KIDS_MAX_PROBLEMS } from '../../src/core/ninos.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
// La nave sugerida de la estación (la misma que arma Nova en la versión niños).
const estacion = () => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0),
    mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1)],
  instruments: ['camara_tierra', 'espectrometro'], launcher: 'condorH', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90,
});
const kidsMission = (seed) => {
  const s = createMission({ design: estacion(), scenarioId: 'estacion', difficulty: 'facil', seed, demo: true });
  return { ...s, mode: 'demo', kids: true, phase: 'ops' };
};

/** Juega la parte de la misión: elige con `pick` en los problemas y gana o pierde las alarmas. */
function play(seed, { pick = 'recomendado', winAlarms = true } = {}) {
  let s = kidsMission(seed);
  const seen = { ventanas: 0, buenosConVentana: 0, buenosSolos: 0 };
  for (let i = 0; i < 2000 && s.phase === 'ops'; i++) {
    if (s.pending) {
      const ev = EVENTS[s.pending.eventId];
      seen.ventanas++;
      if (ev.kind === '+') seen.buenosConVentana++;
      const vis = ev.options.filter((o) => !o.hidden);
      const rec = recommendedOption(ev.id, s);
      const opt = pick === 'recomendado' ? rec : (vis.find((o) => o.id !== rec) ?? vis[0]).id;
      const rng = restoreRng(s.rng);
      s = { ...resolveEvent(s, ev.id, s.pending.severity, opt, rng).state, rng: rng.state() };
      continue;
    }
    if (s.flash) { seen.ventanas++; s = resolveFlash(winAlarms ? autoSolve(s) : s).state; continue; }
    const r = advanceDay(autoAssign(s));
    s = r.state;
    if (r.interrupt?.kind === 'bueno') seen.buenosSolos++;
  }
  return { s, seen };
}

test('niños: suenan 3 alarmas por partida, repartidas', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { s } = play(seed);
    assert.equal(s.flashStats?.total, 3, `semilla ${seed}`);
  }
  const s = kidsMission(1);
  assert.deepEqual([0, 1, 2].map((n) => kidsFlashDay({ ...s, kidsFlashes: n })), [13, 30, 47]);
  assert.equal(kidsFlashDay({ ...s, kidsFlashes: 3 }), null);
});

test('niños: lo bueno pasa solo (sin ventana) y hay pocas ventanas de problemas', () => {
  let solos = 0; let ventanas = 0;
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
    const { seen } = play(seed);
    assert.equal(seen.buenosConVentana, 0, `semilla ${seed}: un evento bueno abrió ventana`);
    assert.ok(seen.ventanas <= KIDS_MAX_PROBLEMS + 3, `semilla ${seed}: ${seen.ventanas} ventanas`);
    solos += seen.buenosSolos; ventanas += seen.ventanas;
  }
  assert.ok(solos > 0, 'nunca pasó nada bueno');
  assert.ok(ventanas / 8 <= 8, `demasiadas ventanas por partida: ${ventanas / 8}`);
  assert.equal(kidsEventMult({ totalDays: 120 }), 0.5);
  assert.equal(kidsEventMult({ totalDays: 60 }), 1);
});

test('niños: las estrellas premian elegir bien y ganar las alarmas', () => {
  const bien = play(21);
  const repBien = { success: true, reason: '' };
  assert.equal(kidStars(bien.s, repBien).stars, 3);
  const mal = play(21, { pick: 'otra', winAlarms: false });
  const r = kidStars(mal.s, repBien);
  assert.ok(r.stars <= 2, `con malas decisiones y alarmas perdidas dio ${r.stars} estrellas`);
  assert.equal(r.goals.find((g) => g.id === 'alarmas').ok, false);
  // Sin volver a casa no hay estrellas, y se dice por qué en palabras simples.
  assert.equal(kidStars(bien.s, { success: false, reason: 'x' }).stars, 0);
  assert.match(kidReason({ reason: 'No alcanzó el combustible para despegar de Marte (130 de 180): la tripulación espera un rescate' }), /combustible para salir de Marte/);
});

test('niños: el informe no dice que volvieron si se quedaron en Marte', () => {
  const s = kidsMission(3);
  for (const c of s.crew) c.evacuated = true;
  s.outcome = { success: false, reason: 'No alcanzó el combustible para despegar de Marte (130 de 180): la tripulación espera un rescate' };
  const rep = buildReport(s);
  assert.equal(rep.success, false);
  assert.equal(kidStars(s, rep).stars, 0);
});

test('niños: el escudo térmico se puede dañar, pero no se pierde la cápsula', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const s = kidsMission(seed);
    s.phase = 'reentry';
    s.modules.find((m) => m.type === 'cabina').health = 0; // el peor caso
    const r = runReentryStep(s, 'escudo_termico', createRng(seed));
    assert.ok(!r.state.outcome, `semilla ${seed}: ${r.state.outcome?.reason}`);
    assert.ok(r.state.crew.every((c) => c.alive));
  }
});
