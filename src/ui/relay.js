// Relevo por MQTT público (sin cuenta): si la conexión directa WebRTC no abre (WARP, wifi de la U, datos del celular),
// los mensajes del cooperativo pasan por un broker MQTT gratis sobre WebSocket seguro.
// Imita lo que coop.js usa de una conexión de PeerJS: peer, open, send(texto), on('data'|'close'), close().
// Los datos de la partida no son privados: cualquiera que conozca el tema podría leerlos.

const MQTT_JS = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const ROOT = 'lifeline-vdl/v1/';
const CHUNK = 30000; // los mensajes grandes (el estado) se parten en trozos
const rid = () => Math.random().toString(36).slice(2, 10);
const dec = new TextDecoder();

function loadMqtt() {
  if (globalThis.mqtt) return Promise.resolve(globalThis.mqtt);
  return new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = MQTT_JS; sc.onload = () => ok(globalThis.mqtt); sc.onerror = () => fail(new Error('No se pudo cargar el relevo'));
    document.head.append(sc);
  });
}

function connect(mqtt, url) {
  return new Promise((res) => {
    const c = mqtt.connect(url, { clientId: 'lf' + rid(), clean: true, connectTimeout: 6000, reconnectPeriod: 3000, keepalive: 20 });
    const t = setTimeout(() => { c.end(true); res(null); }, 7000);
    c.once('connect', () => { clearTimeout(t); res(c); });
  });
}

const topics = (code) => ({ host: `${ROOT}${code}/h`, guest: (id) => `${ROOT}${code}/g/${id}` });

export class RelayConn {
  constructor(client, out, me, peer) { Object.assign(this, { client, out, me, peer, open: true, h: {}, parts: new Map() }); }
  on(ev, fn) { (this.h[ev] ??= []).push(fn); }
  emit(ev, x) { for (const fn of this.h[ev] ?? []) { try { fn(x); } catch (e) { console.error(e); } } }
  pub(obj) { try { this.client.publish(this.out, JSON.stringify({ f: this.me, ...obj })); } catch (e) { console.error(e); } }
  send(text) {
    if (!this.open) return;
    const id = rid(); const n = Math.max(1, Math.ceil(text.length / CHUNK));
    for (let i = 0; i < n; i++) this.pub({ k: 'd', id, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) });
  }
  receive(m) {
    if (m.n === 1) { this.emit('data', m.d); return; }
    const p = this.parts.get(m.id) ?? { got: 0, d: [] };
    if (p.d[m.i] === undefined) { p.d[m.i] = m.d; p.got++; }
    this.parts.set(m.id, p);
    if (p.got === m.n) { this.parts.delete(m.id); this.emit('data', p.d.join('')); }
    if (this.parts.size > 20) this.parts.delete(this.parts.keys().next().value); // trozos perdidos
  }
  closed() { if (!this.open) return; this.open = false; this.emit('close'); this.onGone?.(); }
  close() { if (this.open) this.pub({ k: 'x' }); this.closed(); }
}

/** El anfitrión escucha en todos los brokers que respondan. onConnection recibe cada invitado que llega por relevo. */
export async function relayHost(code, onConnection) {
  const mqtt = await loadMqtt();
  const t = topics(code.toLowerCase());
  const me = 'host';
  const conns = new Map();
  const clients = [];
  const listen = (c) => {
    if (!c) return;
    clients.push(c);
    c.subscribe(t.host);
    c.on('message', (_topic, buf) => {
      let m; try { m = JSON.parse(dec.decode(buf)); } catch { return; }
      if (!m || typeof m.f !== 'string' || m.f === me) return;
      if (m.k === 'hola') {
        conns.get(m.f)?.closed();
        const conn = new RelayConn(c, t.guest(m.f), me, 'relevo-' + m.f);
        conn.onGone = () => { if (conns.get(m.f) === conn) conns.delete(m.f); };
        conns.set(m.f, conn);
        conn.pub({ k: 'ok' });
        onConnection(conn);
      } else if (m.k === 'd') conns.get(m.f)?.receive(m);
      else if (m.k === 'x') conns.get(m.f)?.closed();
    });
  };
  // Cada broker escucha apenas conecta (no se espera al más lento).
  await Promise.race([Promise.all(BROKERS.map((u) => connect(mqtt, u).then(listen))), new Promise((r) => setTimeout(r, 8000))]);
  return {
    get brokers() { return clients.length; },
    close() { for (const c of [...conns.values()]) c.close(); setTimeout(() => clients.forEach((c) => c.end(true)), 300); },
  };
}

/** El invitado prueba los brokers en orden hasta que el anfitrión conteste. Devuelve la conexión ya abierta. */
export async function relayJoin(code) {
  const mqtt = await loadMqtt();
  const t = topics(code.toLowerCase());
  const me = rid();
  for (const url of BROKERS) {
    const c = await connect(mqtt, url);
    if (!c) continue;
    const conn = new RelayConn(c, t.host, me, 'host');
    const ok = await new Promise((res) => {
      const timer = setTimeout(() => res(false), 6000);
      c.on('message', (_topic, buf) => {
        let m; try { m = JSON.parse(dec.decode(buf)); } catch { return; }
        if (m?.f !== 'host') return;
        if (m.k === 'ok') { clearTimeout(timer); res(true); } else if (m.k === 'd') conn.receive(m); else if (m.k === 'x') conn.closed();
      });
      c.subscribe(t.guest(me), () => conn.pub({ k: 'hola' }));
    });
    if (ok) { conn.onGone = () => setTimeout(() => c.end(true), 300); return conn; }
    c.end(true);
  }
  throw new Error('La sala no responde. Revisa el código.');
}
