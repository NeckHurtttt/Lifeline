import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../../src/data/events.js';
import { rollEvents, tickAlerts, prepareFor, resolveEvent, applyEffects, recommendedOption, resolveResupply } from '../../src/core/events.js';
import { createMission } from '../../src/core/mission.js';
import { createRng } from '../../src/core/rng.js';
import { DIFFICULTY } from '../../src/data/catalog.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const design = (extra = []) => ({
  modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0), ...extra],
  instruments: ['camara_tierra'], launcher: 'condor1', orbit: 'leo_estacion',
  crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90,
});
const mk = (extra = [], difficulty = 'medio') => createMission({ design: design(extra), scenarioId: 'estacion', difficulty, seed: 5 });

const IDS = ['micrometeoritos', 'basura_tardia', 'tormenta_solar', 'carga_a_tiempo', 'carga_explota', 'captura_brazo', 'fuga_amoniaco', 'incendio', 'robot_detecta_fuga', 'fuga_misteriosa', 'experimento_exitoso', 'aurora', 'radio_escuelas', 'falla_bano', 'bacterias', 'nueva_tripulacion', 'reboost', 'tanque_o2', 'choque_carga', 'propulsor_atascado', 'falla_computadora', 'perdida_comunicacion', 'fuga_reciclador', 'sobrecalentamiento', 'falla_bateria', 'panel_danado', 'corto_circuito'];

test('todos los eventos existen con textos y opciones', () => {
  for (const id of IDS) {
    const e = EVENTS[id];
    assert.ok(e, id);
    for (const sev of ['leve', 'media', 'grave']) {
      assert.ok(e.text[sev], `${id}.${sev}`);
      for (const o of e.options) assert.ok(o.effects[sev], `${id}.${o.id}.${sev}`);
    }
    assert.ok(e.options.length >= 1);
    for (const o of e.options) if (o.check) assert.ok(o.failEffects, `${id}.${o.id}.failEffects`);
  }
});

// rng que fuerza: primero chance (disaster) y luego el resto
test('aviso: tormenta_solar etaDays 1 con warningMult 0.5, 3 con radar', () => {
  const forced = (s) => {
    s.difficulty = 'dificil';
    const r = createRng(1);
    // fuerza un rng donde todo lo "chance" falla salvo lo necesario: probamos muchas semillas
    return r;
  };
  void forced;
  for (const extra of [[], [mod('radar', 4, 0)]]) {
    let found = null;
    for (let seed = 1; seed < 4000 && !found; seed++) {
      const s = createMission({ design: design(extra), scenarioId: 'estacion', difficulty: 'dificil', seed });
      const r = rollEvents(s, createRng(seed));
      found = r.alerts.find((a) => a.eventId === 'tormenta_solar');
    }
    assert.ok(found, 'se generó una tormenta');
    assert.equal(found.etaDays, extra.length ? 3 : 1);
  }
});

test('tickAlerts dispara cuando etaDays llega a 0', () => {
  const s = mk();
  s.alerts = [{ eventId: 'tormenta_solar', etaDays: 2, severity: 'media', prepared: [], false: false }];
  const a = tickAlerts(s, createRng(1));
  assert.equal(a.triggered, null);
  assert.equal(a.state.alerts[0].etaDays, 1);
  const b = tickAlerts(a.state, createRng(1));
  assert.deepEqual(b.triggered, { eventId: 'tormenta_solar', severity: 'media', prepared: [] });
  assert.equal(b.state.alerts.length, 0);
  assert.equal(b.state.pending.eventId, 'tormenta_solar');
});

test('falsa alarma no dispara', () => {
  const s = mk();
  s.alerts = [{ eventId: 'tormenta_solar', etaDays: 1, severity: 'media', prepared: [], false: true }];
  const r = tickAlerts(s, createRng(1));
  assert.equal(r.triggered, null);
  assert.equal(r.state.pending, null);
  assert.ok(r.state.log.some((l) => /Falsa alarma/.test(l.text)));
});

test('applyEffects: food -1e9 queda en 0; batería tope; salud clamp', () => {
  const s = mk();
  const r = applyEffects(s, { food: -1e9, battery: 1e9, crewHealth: -1000, crewRadiation: 5 });
  assert.equal(r.resources.food, 0);
  assert.equal(r.resources.battery, r.resources.batteryMax);
  assert.ok(r.crew.every((c) => c.health === 0 && c.radiation === 5));
  assert.equal(s.resources.food > 0, true, 'puro');
});

test('applyEffects: moduleDamage, moduleOff, delayResupply, evacuar', () => {
  const s = mk();
  let r = applyEffects(s, { moduleDamage: { paneles: 150 }, moduleOff: { soporte_vital: 4 }, delayResupply: 30 });
  const p = r.modules.find((m) => m.type === 'paneles');
  assert.equal(p.health, 0);
  assert.equal(p.on, false);
  const sv = r.modules.find((m) => m.type === 'soporte_vital');
  assert.equal(sv.on, false);
  assert.equal(sv.offDays, 4);
  assert.equal(r.nextResupply, 90);
  r = applyEffects(s, { endMission: 'evacuar' });
  assert.equal(r.outcome.success, false);
  assert.match(r.outcome.reason, /Evacuación de emergencia/);
  assert.ok(r.crew.every((c) => c.alive && c.evacuated));
  assert.equal(r.phase, 'report'); // pasa al informe, no se queda en la estación
});

test('resolveEvent aplica opción, limpia pending y recomienda options[0]', () => {
  const s = mk();
  s.pending = { eventId: 'fuga_reciclador', severity: 'leve' };
  const opt = recommendedOption('fuga_reciclador');
  assert.equal(opt, EVENTS.fuga_reciclador.options[0].id);
  const r = resolveEvent(s, 'fuga_reciclador', 'leve', opt, createRng(2));
  assert.equal(r.state.pending, null);
  assert.ok(r.log.length > 0);
  assert.notDeepEqual(r.state.resources, s.resources);
});

test('opción con check: éxito vs fallo según stat', () => {
  const s = mk();
  const ev = EVENTS.fuga_amoniaco;
  const o = ev.options.find((x) => x.check);
  assert.ok(o);
  const hi = structuredClone(s);
  hi.crew.forEach((c) => { c.stats[o.check.stat] = 100; });
  const lo = structuredClone(s);
  lo.crew.forEach((c) => { c.stats[o.check.stat] = 0; });
  const ok = resolveEvent(hi, 'fuga_amoniaco', 'media', o.id, createRng(1));
  const bad = resolveEvent(lo, 'fuga_amoniaco', 'media', o.id, createRng(1));
  assert.match(ok.log.join(' '), /éxito|Éxito/);
  assert.match(bad.log.join(' '), /fall/i);
});

test('refugio preparado baja la gravedad de tormenta_solar', () => {
  const s = mk();
  const base = resolveEvent(s, 'tormenta_solar', 'grave', EVENTS.tormenta_solar.options[0].id, createRng(3)).state;
  const s2 = structuredClone(s);
  s2.pendingPrepared = ['refugio'];
  const prep = resolveEvent(s2, 'tormenta_solar', 'grave', EVENTS.tormenta_solar.options[0].id, createRng(3), ['refugio']).state;
  const rad = (st) => st.crew.reduce((a, c) => a + c.radiation, 0);
  assert.ok(rad(prep) < rad(base));
});

test('cadena: tormenta_solar grave puede generar panel_danado', () => {
  let hit = false;
  for (let seed = 1; seed < 200 && !hit; seed++) {
    const r = resolveEvent(mk(), 'tormenta_solar', 'media', EVENTS.tormenta_solar.options[0].id, createRng(seed));
    hit = r.state.pending?.eventId === 'panel_danado' || r.state.alerts.some((a) => a.eventId === 'panel_danado');
  }
  assert.ok(hit);
});

test('prepareFor agrega la preparación y es puro', () => {
  const s = mk();
  s.alerts = [{ eventId: 'tormenta_solar', etaDays: 2, severity: 'media', prepared: [], false: false }];
  const r = prepareFor(s, 0, 'refugio');
  assert.deepEqual(r.alerts[0].prepared, ['refugio']);
  assert.deepEqual(s.alerts[0].prepared, []);
});

test('misma semilla, misma secuencia de eventos en 30 días', () => {
  const run = () => {
    let s = mk([], 'dificil');
    const rng = createRng(77);
    const seq = [];
    for (let d = 0; d < 30; d++) {
      s = { ...s, day: d };
      s = rollEvents(s, rng);
      const t = tickAlerts(s, rng);
      s = t.state;
      if (t.triggered) seq.push(`${d}:${t.triggered.eventId}:${t.triggered.severity}`);
      if (s.pending) { seq.push(`${d}:p:${s.pending.eventId}`); s.pending = null; }
    }
    return seq;
  };
  assert.deepEqual(run(), run());
});

test('rollEvents: sin pending múltiple y puro', () => {
  const s = mk();
  s.pending = { eventId: 'aurora', severity: 'leve' };
  const copy = structuredClone(s);
  const r = rollEvents(s, createRng(1));
  assert.deepEqual(r.pending, copy.pending);
  assert.deepEqual(s, copy);
});

test('resolveResupply: a tiempo suma 60 días y 20 piezas; explota retrasa 30', () => {
  const s = mk();
  s.nextResupply = 60;
  let on = null, boom = null;
  for (let seed = 1; seed < 100 && !(on && boom); seed++) {
    const r = resolveResupply(s, createRng(seed));
    if (r.event === 'carga_a_tiempo') on = r; else boom = r;
  }
  const crew = 4;
  assert.equal(on.state.nextResupply, 120);
  assert.equal(on.state.resources.parts, s.resources.parts + 20);
  assert.ok(Math.abs(on.state.resources.food - s.resources.food - 60 * crew * 1.8) < 1e-6);
  assert.ok(Math.abs(on.state.resources.o2 - s.resources.o2 - 60 * crew * 0.84) < 1e-6);
  assert.equal(boom.state.nextResupply, 90);
  assert.equal(boom.state.resources.parts, s.resources.parts);
  assert.ok(on.log.length && boom.log.length);
  void DIFFICULTY;
});
