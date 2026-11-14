import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED, ADVANCED_ORDER, wireToCut, MANUAL, PROTOCOLS, TRIAGE, TRAINING_QUIZ, NATO, RADIO_WORDS, inZone } from '../../src/core/academy2.js';
import { TRAININGS } from '../../src/core/academy.js';

test('academia avanzada: 8 pruebas, ninguna choca con la básica', () => {
  assert.equal(ADVANCED_ORDER.length, 8);
  assert.deepEqual([...ADVANCED_ORDER].sort(), Object.keys(ADVANCED).sort());
  for (const id of ADVANCED_ORDER) assert.ok(!TRAININGS[id], id);
});

test('reglas del manual de cables', () => {
  assert.equal(MANUAL.length, 5);
  assert.equal(wireToCut(['azul', 'blanco', 'amarillo']), 2); // sin rojo → último
  assert.equal(wireToCut(['rojo', 'azul', 'azul', 'blanco']), 2); // 2 azules → último azul
  assert.equal(wireToCut(['amarillo', 'rojo', 'blanco', 'blanco']), 0); // primero amarillo
  assert.equal(wireToCut(['rojo', 'blanco', 'rojo']), 1); // un blanco
  assert.equal(wireToCut(['rojo', 'rojo', 'azul']), 1); // segundo
});

test('protocolos, triage, radio y quiz completos', () => {
  for (const p of Object.values(PROTOCOLS)) assert.equal(p.steps.length, 5);
  for (const t of TRIAGE) assert.equal(t.bad.length, 2);
  for (const w of RADIO_WORDS) for (const ch of w) assert.ok(NATO[ch], ch);
  for (const id of [...ADVANCED_ORDER, ...Object.keys(TRAININGS)]) assert.ok(TRAINING_QUIZ[id]?.length, id);
  assert.ok(inZone(0.5)); assert.ok(!inZone(0.9));
});
