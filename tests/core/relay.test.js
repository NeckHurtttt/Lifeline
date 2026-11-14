import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RelayConn } from '../../src/ui/relay.js';

// "Broker" falso que entrega todo al revés, para probar que los trozos se rearman.
function link(to) {
  const queue = [];
  const from = new RelayConn({ publish: (_t, s) => queue.push(s) }, 'h', 'g1', 'host');
  const flush = () => { for (const s of queue.splice(0).reverse()) { const m = JSON.parse(s); if (m.k === 'd') to.receive(m); else if (m.k === 'x') to.closed(); } };
  return { from, flush };
}

test('relevo: un mensaje grande se parte y se rearma igual aunque llegue en desorden', () => {
  const b = new RelayConn({ publish() {} }, 'g', 'host', 'g1');
  const got = []; b.on('data', (d) => got.push(d));
  const { from, flush } = link(b);
  const big = JSON.stringify({ type: 'estado', state: { log: Array.from({ length: 4000 }, (_, i) => `día ${i} ñandú ✓`) } });
  assert.ok(big.length > 60000);
  from.send(big); from.send('{"type":"latido"}');
  flush();
  assert.deepEqual(got.sort((x, y) => x.length - y.length), ['{"type":"latido"}', big]);
});

test('relevo: cerrar avisa una sola vez y ya no envía', () => {
  const b = new RelayConn({ publish() {} }, 'g', 'host', 'g1');
  let closes = 0; b.on('close', () => closes++);
  const { from, flush } = link(b);
  from.close(); flush(); b.close();
  assert.equal(closes, 1); assert.equal(from.open, false);
});
