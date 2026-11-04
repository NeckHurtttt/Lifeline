import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIMISSIONS } from '../../src/data/minimissions.js';
import { offerMinis, acceptMini, progressMinis, forceMini } from '../../src/core/minimissions.js';
import { createMission } from '../../src/core/mission.js';
import { createRng } from '../../src/core/rng.js';

const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const mk = (extra = [], instruments = ['camara_tierra']) => createMission({
  design: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('baterias', 3, 0), ...extra],
    instruments, launcher: 'condor1', orbit: 'leo_estacion', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 90 },
  scenarioId: 'estacion', difficulty: 'medio', seed: 5,
});
const stubRng = (roll) => ({ int: () => roll, chance: () => true, pick: (a) => a[0], next: () => 0.5 });
const entry = (id, extra = {}) => ({ id, status: 'oferta', offeredDay: 0, deadline: 9, crewIds: [], daysLeft: MINIMISSIONS[id].days, ...extra });

test('catálogo con los 10 ids', () => {
  for (const id of ['lanzar_cubesats', 'recuperar_satelite', 'retirar_basura', 'capturar_carga', 'experimento_externo', 'cambiar_panel', 'fotografiar_desastre', 'radio_escuelas', 'cultivo_microg', 'prueba_nave_comercial'])
    assert.equal(MINIMISSIONS[id].id, id);
  assert.ok(MINIMISSIONS.capturar_carga.mandatory);
});

test('aceptar sin brazo: Falta el módulo: brazo', () => {
  const s = mk(); s.minis.push(entry('recuperar_satelite'));
  const r = acceptMini(s, 'recuperar_satelite', ['c1', 'c3']);
  assert.equal(r.error, 'Falta el módulo: brazo');
});

test('errores: tripulantes, instrumento, sin oferta', () => {
  const s = mk([mod('brazo', 4, 0)]); s.minis.push(entry('recuperar_satelite'), entry('cultivo_microg'));
  assert.equal(acceptMini(s, 'recuperar_satelite', ['c1']).error, 'Faltan tripulantes');
  assert.equal(acceptMini(s, 'cultivo_microg', ['c1']).error, 'Falta el instrumento: plantas_microg');
  assert.equal(acceptMini(s, 'radio_escuelas', ['c1']).error, 'No hay oferta de esa minimisión');
});

// rng que siempre ofrece y elige la opción cuyo id es `want`
const pickOnly = (want) => ({ ...stubRng(5), pick: (a) => a.find((d) => d.id === want) ?? a[0] });

test('recuperar_satelite no se ofrece antes de retirar_basura', () => {
  const ids = (s) => s.minis.map((m) => m.id);
  const s0 = mk();
  const rng = createRng(11);
  let s = s0;
  for (let d = 0; d < 600; d++) { s.day = d; s = offerMinis(s, rng); s.minis.forEach((m) => { if (m.status === 'oferta') m.status = 'fallida'; }); }
  assert.ok(!ids(s).includes('recuperar_satelite'));
  const t = mk(); t.minis.push(entry('retirar_basura', { status: 'hecha' }));
  assert.equal(offerMinis(t, pickOnly('recuperar_satelite')).minis.at(-1).id, 'recuperar_satelite');
});

test('una minimisión hecha no se vuelve a ofrecer', () => {
  const s = mk(); s.minis.push(entry('retirar_basura', { status: 'hecha' }), entry('recuperar_satelite', { status: 'hecha' }));
  for (let i = 0; i < 50; i++) {
    const r = offerMinis(s, pickOnly('recuperar_satelite'));
    assert.ok(!r.minis.some((m) => m.id === 'recuperar_satelite' && m.status === 'oferta'));
  }
});

test('aceptar una oferta vencida falla y la marca vencida', () => {
  const s = mk([mod('antena', 5, 0)]); s.minis.push(entry('radio_escuelas', { deadline: 5 })); s.day = 5;
  const r = acceptMini(s, 'radio_escuelas', ['c1']);
  assert.equal(r.error, 'No hay oferta de esa minimisión');
  assert.equal(r.state.minis[0].status, 'vencida');
});

test('máx. 2 ofertas abiertas y nunca ofrece capturar_carga', () => {
  let s = mk(); const rng = createRng(3);
  for (let d = 0; d < 400; d++) { s.day = d; s = offerMinis(s, rng); assert.ok(s.minis.filter((m) => m.status === 'oferta').length <= 2); s.minis = s.minis.filter((m) => m.status !== 'oferta' || d % 7); }
  assert.ok(!s.minis.some((m) => m.id === 'capturar_carga'));
});

test('éxito aplica reward y cost al aceptar; fallo aplica failure', () => {
  let s = mk([mod('antena', 5, 0)]); s.minis.push(entry('radio_escuelas')); s.crew.forEach((c) => { c.morale = 50; });
  s = acceptMini(s, 'radio_escuelas', ['c1']).state;
  const rep = s.reputation;
  const r = progressMinis(s, stubRng(10));
  assert.equal(r.state.minis[0].status, 'hecha');
  assert.equal(r.state.reputation, rep + 4);
  assert.equal(r.state.crew[0].morale, 58);
  s.crew.forEach((c) => { c.stats.temple = 0; c.fatigue = 80; }); // 0 + 5 − 2 = 3 < 6
  const g = progressMinis(s, stubRng(10));
  assert.equal(g.state.minis[0].status, 'fallida');
  assert.equal(g.state.crew[0].morale, 48);
});

test('cost se aplica al aceptar', () => {
  let s = mk(); s.minis.push(entry('experimento_externo'));
  const parts = s.resources.parts;
  s = acceptMini(s, 'experimento_externo', ['c1', 'c3']).state;
  assert.equal(s.resources.parts, parts - 2);
  assert.equal(s.minis[0].status, 'activa');
});

test('deadline vencido sin aceptar: desaparece de ofertas', () => {
  let s = mk(); s.minis.push(entry('radio_escuelas', { deadline: 5 })); s.day = 5;
  s = offerMinis(s, { ...stubRng(1), chance: () => false });
  assert.equal(s.minis[0].status, 'vencida');
  assert.equal(s.minis.filter((m) => m.status === 'oferta').length, 0);
});

test('retirar_basura: debrisCleared; experimento: ciencia/día; panel: salud 100', () => {
  let s = mk([mod('brazo', 4, 0)]); s.minis.push(entry('retirar_basura'));
  s = acceptMini(s, 'retirar_basura', ['c1']).state;
  s = progressMinis(s, stubRng(10)).state; s = progressMinis(s, stubRng(10)).state;
  assert.equal(s.flags.debrisCleared, true);
  s.minis.push(entry('experimento_externo'), entry('cambiar_panel'));
  s.crew.forEach((c) => { c.stats.tecnica = 9; });
  s.modules.find((m) => m.type === 'paneles').health = 40;
  s = acceptMini(s, 'experimento_externo', ['c1', 'c2']).state;
  s = acceptMini(s, 'cambiar_panel', ['c3', 'c4']).state;
  const rad = s.crew.map((c) => c.radiation);
  s = progressMinis(s, stubRng(10)).state;
  assert.equal(s.crew[0].radiation, rad[0] + 1);
  s = progressMinis(s, stubRng(10)).state;
  assert.equal(s.flags.extraSciencePerDay, 2);
  assert.equal(s.modules.find((m) => m.type === 'paneles').health, 100);
});

test('forceMini y carga perdida', () => {
  let s = mk([mod('brazo', 4, 0)]); s.day = 10;
  s = forceMini(s, 'capturar_carga');
  assert.equal(s.minis[0].deadline, 11);
  const v = progressMinis({ ...s, day: 11 }, stubRng(1));
  assert.equal(v.state.minis[0].status, 'vencida');
  assert.equal(v.state.flags.lastCargoLost, true);
  s.crew.forEach((c) => { c.stats.fuerza = 1; });
  s = acceptMini(s, 'capturar_carga', ['c2']).state;
  s = progressMinis(s, stubRng(1)).state;
  assert.equal(s.minis[0].status, 'fallida');
  assert.equal(s.flags.lastCargoLost, true);
});
