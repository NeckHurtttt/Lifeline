import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeFlash, closeDoor, resolveFlash, rollFlash, targets, CRITICAL, FLASH_TYPES, autoSolve, stepDone, allDone,
  probeLeak, leakReading, turnValve, connectCable, pressProtocol, typesFor, flashLeft, WRONG_PENALTY,
  pressCode, adjustPower, timingPress, stepsFor, rollFlash as roll2,
} from '../../src/core/flash.js';
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
const stepOf = (s, kind) => s.flash.steps.findIndex((x) => x.kind === kind);

test('los módulos críticos nunca son blanco de un evento relámpago', () => {
  const s = mk();
  assert.ok(targets(s).length > 0);
  assert.ok(targets(s).every((m) => !CRITICAL.has(m.type)));
});

test('escotillas = una por cada vecino del módulo afectado', () => {
  const f = makeFlash(mk(), 'meteorito', 'paneles-2-0');
  assert.equal(f.doors.length, 3);
  assert.deepEqual(f.steps.map((x) => x.kind), ['doors', 'leak']);
});

test('todos los tipos, en las tres dificultades, se pueden resolver', () => {
  for (const dif of ['facil', 'medio', 'dificil']) {
    for (const type of Object.keys(FLASH_TYPES)) {
      for (let day = 5; day < 25; day++) {
        const s = mk(dif, { day });
        s.flash = makeFlash(s, type, 'paneles-2-0');
        assert.ok(!allDone(s.flash), `${type} ${dif} ${day} empieza sin resolver`);
        const solved = autoSolve(s);
        assert.ok(allDone(solved.flash), `${type} ${dif} día ${day} se resuelve`);
        assert.equal(resolveFlash(solved).result, 'ok');
      }
    }
  }
});

test('resolver todo salva el módulo; nada lo pierde; un paso solo es a medias', () => {
  const s = mk();
  s.flash = makeFlash(s, 'meteorito', 'paneles-2-0');
  const r1 = resolveFlash(autoSolve(s));
  assert.equal(r1.success, true);
  assert.ok(r1.state.modules.some((m) => m.id === 'paneles-2-0'));
  assert.equal(r1.state.flash, null);
  const r0 = resolveFlash(s);
  assert.equal(r0.result, 'fail');
  assert.ok(!r0.state.modules.some((m) => m.id === 'paneles-2-0'));
  assert.equal(r0.state.lostModules.length, 1);
  let half = s; for (const d of s.flash.doors) half = closeDoor(half, d);
  const rh = resolveFlash(half);
  assert.equal(rh.result, 'partial');
  const m = rh.state.modules.find((x) => x.id === 'paneles-2-0');
  assert.ok(m && m.health <= 30);
});

test('fuga: la lectura sube cerca del agujero y tocarlo lo parcha', () => {
  const s = mk(); s.flash = makeFlash(s, 'meteorito', 'paneles-2-0');
  const i = stepOf(s, 'leak'); const st = s.flash.steps[i];
  assert.equal(leakReading(st, st.hole), 100);
  const far = st.hole === 0 ? st.w * st.h - 1 : 0;
  assert.ok(leakReading(st, far) < 100);
  const t = probeLeak(s, i, st.hole);
  assert.ok(stepDone(t.flash, t.flash.steps[i]));
});

test('válvulas unidas giran juntas', () => {
  const s = mk('dificil'); s.flash = makeFlash(s, 'amoniaco', 'paneles-2-0');
  const i = stepOf(s, 'valves'); const st = s.flash.steps[i];
  assert.equal(st.links.length, 2);
  const [a, b] = st.links[0];
  const t = turnValve(s, i, a).flash.steps[i];
  assert.equal(t.angles[a], (st.angles[a] + 1) % 4);
  assert.equal(t.angles[b], (st.angles[b] + 1) % 4);
});

test('cable equivocado y paso fuera de orden quitan tiempo', () => {
  const s = mk(); s.flash = makeFlash(s, 'cortocircuito', 'paneles-2-0');
  const c = stepOf(s, 'cables'); const st = s.flash.steps[c];
  const wrongWire = (st.right[0] + 1) % st.n;
  const r = connectCable(s, c, wrongWire, 0);
  assert.equal(r.ok, false);
  assert.equal(r.state.flash.penalty, WRONG_PENALTY);
  assert.equal(flashLeft(r.state.flash), s.flash.seconds - WRONG_PENALTY);
  assert.equal(connectCable(s, c, st.right[0], 0).ok, true);
  const p = stepOf(s, 'protocol');
  assert.equal(pressProtocol(s, p, 1).ok, false);
  assert.equal(pressProtocol(s, p, 0).ok, true);
});

test('en el espacio no hay tormentas de polvo; en el suelo de Marte sí, y no hay basura espacial', () => {
  assert.ok(!typesFor(mk()).includes('polvo'));
  assert.ok(typesFor(mk()).includes('escombros'));
  const marte = { ...mk(), scenarioId: 'marte', leg: 'superficie' };
  assert.ok(typesFor(marte).includes('polvo'));
  assert.ok(typesFor(marte).includes('sello'));
  assert.ok(!typesFor(marte).includes('escombros'));
  assert.ok(!typesFor({ ...marte, leg: 'ida' }).includes('polvo'));
  assert.ok(!typesFor({ ...marte, scenarioId: 'luna' }).includes('polvo'));
});

test('dificultad: difícil tiene más piezas y menos tiempo por pieza que fácil', () => {
  const f = makeFlash(mk('facil'), 'cortocircuito', 'paneles-2-0');
  const d = makeFlash(mk('dificil'), 'cortocircuito', 'paneles-2-0');
  assert.ok(d.steps[1].n > f.steps[1].n);
  assert.ok(d.steps[0].items.length > f.steps[0].items.length);
  assert.ok(d.steps[1].chart && !f.steps[1].chart);
});

test('modo niños: un solo paso, más tiempo, y si no alcanza el módulo se rompe pero no se pierde', () => {
  const s = mk('medio', { kids: true });
  s.flash = makeFlash(s, 'incendio', 'paneles-2-0');
  assert.equal(s.flash.steps.length, 1);
  assert.ok(s.flash.seconds >= 14);
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

test('hay 37 emergencias y cada una tiene un paso extra para difícil', () => {
  assert.equal(Object.keys(FLASH_TYPES).length, 37);
  for (const [k, T] of Object.entries(FLASH_TYPES)) {
    assert.ok(T.extra, `${k} sin extra`);
    assert.equal(stepsFor(mk('dificil'), k).length, T.steps.length + 1);
    assert.equal(stepsFor(mk('medio'), k).length, T.steps.length);
  }
});

test('código: un dígito mal vuelve a empezar y quita tiempo', () => {
  const s = mk(); s.flash = makeFlash(s, 'computadora', 'paneles-2-0');
  const i = stepOf(s, 'code'); const st = s.flash.steps[i];
  let t = pressCode(s, i, st.digits[0]).state;
  assert.equal(t.flash.steps[i].progress, 1);
  const r = pressCode(t, i, (st.digits[1] + 1) % 10);
  assert.equal(r.ok, false);
  assert.equal(r.state.flash.steps[i].progress, 0);
  assert.equal(r.state.flash.penalty, WRONG_PENALTY);
  assert.equal(st.digits.length, 5);
  assert.equal(makeFlash(mk('dificil'), 'computadora', 'paneles-2-0').steps[0].digits.length, 6);
});

test('energía: no se puede usar más de lo que hay; en difícil hay que quitar para dar', () => {
  const s = mk('dificil'); s.flash = makeFlash(s, 'termico', 'paneles-2-0');
  const i = stepOf(s, 'power'); const st = s.flash.steps[i];
  assert.equal(st.have.reduce((a, b) => a + b, 0), st.total);
  const j = st.have.findIndex((x, k) => x < st.need[k]);
  assert.deepEqual(adjustPower(s, i, j, 1), s); // ya no queda energía libre
  const f = makeFlash(mk('facil'), 'termico', 'paneles-2-0').steps[0];
  assert.ok(f.have.every((x) => x === 0));
});

test('en el momento justo: fallar quita tiempo; en difícil la zona se mueve', () => {
  const s = mk(); s.flash = makeFlash(s, 'brazo', 'paneles-2-0');
  const i = stepOf(s, 'timing');
  assert.equal(timingPress(s, i, false).state.flash.penalty, WRONG_PENALTY);
  assert.equal(timingPress(s, i, true).state.flash.steps[i].hits, 1);
  const d = makeFlash(mk('dificil'), 'brazo', 'paneles-2-0').steps[0];
  assert.ok(d.zone < s.flash.steps[i].zone);
  assert.ok(new Set(d.centers).size > 1);
});

test('difícil: una escotilla atascada pide dos toques y la fuga tiene ruido', () => {
  const s = mk('dificil'); s.flash = makeFlash(s, 'meteorito', 'paneles-2-0');
  const stuck = Object.keys(s.flash.stuck)[0];
  assert.ok(stuck);
  const once = closeDoor(s, stuck);
  assert.ok(!once.flash.closed[stuck]);
  assert.ok(closeDoor(once, stuck).flash.closed[stuck]);
  assert.ok(s.flash.steps[1].noise > 0);
  assert.equal(makeFlash(mk('medio'), 'meteorito', 'paneles-2-0').steps[1].noise, 0);
});

test('alarma falsa sin revisar: la siguiente emergencia trae menos tiempo', () => {
  const s = mk(); s.flash = makeFlash(s, 'falsa', 'paneles-2-0');
  const r = resolveFlash(s);
  assert.equal(r.state.flashShort, true);
  const a = makeFlash(mk(), 'incendio', 'paneles-2-0').seconds;
  const b = makeFlash({ ...mk(), flashShort: true }, 'incendio', 'paneles-2-0').seconds;
  assert.ok(b < a);
});

test('eventos que no destruyen el módulo (médica, computadora) solo lo dañan', () => {
  for (const type of ['medica', 'computadora', 'planta']) {
    const s = mk(); s.flash = makeFlash(s, type, 'paneles-2-0');
    const r = resolveFlash(s);
    assert.ok(r.state.modules.some((m) => m.id === 'paneles-2-0'), type);
  }
});

test('viaje a Marte: motor, lluvia y rumbo; en la Luna noche y hielo', () => {
  const viaje = { ...mk(), scenarioId: 'marte', leg: 'ida' };
  for (const k of ['motor', 'lluvia', 'rumbo', 'escombros']) assert.ok(typesFor(viaje).includes(k), k);
  assert.ok(!typesFor(mk()).includes('motor'));
  const luna = { ...mk(), scenarioId: 'luna', leg: 'superficie' };
  for (const k of ['noche', 'hielo', 'polvolunar', 'sismo', 'rover']) assert.ok(typesFor(luna).includes(k), k);
  assert.ok(!typesFor(luna).includes('helada'));
  void roll2;
});

test('textos de emergencias: el módulo nunca va solo como sujeto (evita "Paneles solares está")', () => {
  for (const [id, T] of Object.entries(FLASH_TYPES)) {
    for (const fn of ['text', 'ok', 'partial', 'fail']) {
      const txt = T[fn]?.('Paneles solares');
      if (!txt || !txt.includes('Paneles solares')) continue;
      assert.match(txt, /(el|El|del|al) módulo Paneles solares/, `${id}.${fn}: ${txt}`);
    }
  }
});
