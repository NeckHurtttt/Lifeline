import { test } from 'node:test';
import assert from 'node:assert/strict';
import { save, load, clearSave } from '../../src/core/save.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

test('guardar y cargar devuelven el mismo estado', () => {
  const st = mem();
  const s = { day: 12, crew: [{ id: 'c1', alive: true }], resources: { food: 3.5 } };
  save(s, st);
  assert.deepEqual(load(st), s);
  clearSave(st);
  assert.equal(load(st), null);
});

test('JSON roto: null y se borra la clave (Review Focus 5)', () => {
  const st = mem(); st.setItem('vdl.save.ninos', '{roto');
  assert.equal(load(st), null);
  assert.equal(st.m.has('vdl.save.ninos'), false);
});

test('otra versión: null', () => {
  const st = mem(); st.setItem('vdl.save.ninos', JSON.stringify({ v: 0, state: { day: 1 } }));
  assert.equal(load(st), null);
});
