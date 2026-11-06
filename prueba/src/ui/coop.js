// Cooperativo en línea de 2 a 4 personas (idea del juego "V · Mission Control" del equipo).
// Conexión directa entre navegadores (WebRTC con PeerJS). Quien crea la sala es el anfitrión: guarda la partida
// buena y la reparte. Cada cambio que alguien hace se manda al anfitrión, que lo reenvía a todos.
// No necesita servidor propio, pero sí internet. PeerJS se carga solo cuando se usa.
import { onSave, save } from '../core/save.js';
import { diff, patch } from '../core/patch.js';

const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'vdl-sala-';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const COOP_MAX = 4;

const coop = { base: null, role: null, code: '', name: '', peer: null, conns: [], hostConn: null, players: [], ver: 0, applying: false, status: '', listeners: new Set() };
let hooks = { getApp: null, rerender: null };

export const coopInfo = () => ({ name: coop.name, role: coop.role, code: coop.code, players: coop.players.slice(), status: coop.status });
export const inCoop = () => !!coop.role;
export const isGuest = () => coop.role === 'guest';
/** En línea: ¿le toca a esta compu decidir lo de `who` (nombre del jugador)? Sin conexión siempre sí. */
export const mine = (who) => !coop.role || !who || who === coop.name;
export function onCoopChange(fn) { coop.listeners.add(fn); return () => coop.listeners.delete(fn); }
const changed = () => coop.listeners.forEach((fn) => fn(coopInfo()));
const setStatus = (t) => { coop.status = t; changed(); };

/** Conecta el módulo con la app (se llama una vez desde main.js). */
export function initCoop(getApp, rerender) { hooks = { getApp, rerender }; }

function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  return new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = PEERJS; sc.onload = () => ok(globalThis.Peer); sc.onerror = () => fail(new Error('No se pudo cargar la conexión (¿hay internet?)'));
    document.head.append(sc);
  });
}

const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const normalizeCode = (v) => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function snapshot() {
  const app = hooks.getApp();
  return { type: 'estado', ver: coop.ver, screen: app.screen, state: app.state, meta: { difficulty: app.difficulty, mode: app.mode, objective: app.objective }, players: coop.players };
}

function apply(msg) {
  const app = hooks.getApp();
  if (msg.players) { coop.players = msg.players; changed(); }
  if (typeof msg.ver === 'number') coop.ver = Math.max(coop.ver, msg.ver);
  if (msg.meta) Object.assign(app, msg.meta);
  coop.applying = true;
  try {
    if (msg.state !== undefined) { app.state = msg.state; coop.base = msg.state ? structuredClone(msg.state) : null; if (msg.state) save(msg.state); }
  } finally { coop.applying = false; }
  hooks.rerender(msg.screen && msg.screen !== app.screen ? msg.screen : null);
}

function broadcast(msg, except = null) { for (const c of coop.conns) if (c !== except && c.open) c.send(msg); }

// Cada guardado local (cualquier decisión) se comparte.
onSave((state) => {
  if (!coop.role || coop.applying) return;
  if (coop.role === 'host') { coop.ver++; broadcast(snapshot()); }
  else if (coop.hostConn?.open) {
    // Solo se manda lo que cambió desde el último estado recibido: el anfitrión lo junta con el suyo.
    const changes = coop.base ? diff(coop.base, state) : [[[], state]];
    coop.base = structuredClone(state);
    if (changes.length) coop.hostConn.send({ type: 'cambio', changes });
  }
});

/** Avisa a los demás que el anfitrión cambió de pantalla (diseño → despegue, etc.). */
export function coopScreen() {
  if (coop.role === 'host' && !coop.applying) { coop.ver++; broadcast(snapshot()); }
}

/** Crea una sala. Devuelve el código. */
export async function hostRoom(name) {
  const Peer = await loadPeer();
  leaveRoom();
  coop.name = name || 'Anfitrión';
  for (let intento = 0; intento < 3; intento++) {
    const code = newCode();
    const peer = new Peer(PREFIX + code.toLowerCase());
    const ok = await new Promise((res) => { peer.on('open', () => res(true)); peer.on('error', () => res(false)); });
    if (!ok) { peer.destroy(); continue; }
    Object.assign(coop, { role: 'host', code, peer, conns: [], players: [{ id: peer.id, name: coop.name }], ver: 0 });
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => {
        if (msg?.type === 'hola') {
          if (coop.players.length >= COOP_MAX) { conn.send({ type: 'llena' }); setTimeout(() => conn.close(), 300); return; }
          coop.conns.push(conn);
          let nm = String(msg.name || 'Jugador').trim().slice(0, 16) || 'Jugador';
          for (let n = 2; coop.players.some((p) => p.name === nm); n++) nm = `${String(msg.name || 'Jugador').slice(0, 13)} ${n}`;
          coop.players.push({ id: conn.peer, name: nm });
          conn.send({ type: 'nombre', name: nm });
          syncPlayers();
          coop.ver++; broadcast(snapshot());
        } else if (msg?.type === 'cambio' && Array.isArray(msg.changes) && hooks.getApp().state) {
          let next;
          try { next = patch(hooks.getApp().state, msg.changes.filter((c) => Array.isArray(c?.[0]) && c[0].length)); } catch { return; }
          coop.ver++;
          apply({ state: next, ver: coop.ver });
          broadcast(snapshot(), null);
        }
      });
      conn.on('close', () => { coop.conns = coop.conns.filter((c) => c !== conn); coop.players = coop.players.filter((p) => p.id !== conn.peer); syncPlayers(); broadcast(snapshot()); });
    });
    peer.on('disconnected', () => setStatus('Sin conexión con el directorio; la sala sigue para quien ya entró.'));
    setStatus(`Sala ${code} abierta. Comparte el código.`);
    syncPlayers();
    return code;
  }
  throw new Error('No se pudo abrir la sala. Prueba otra vez.');
}

/** Entra a una sala con su código. */
export async function joinRoom(rawCode, name) {
  const code = normalizeCode(rawCode);
  if (code.length !== 6) throw new Error('El código tiene 6 letras o números.');
  const Peer = await loadPeer();
  leaveRoom();
  const peer = new Peer();
  await new Promise((res, rej) => { peer.on('open', res); peer.on('error', (e) => rej(new Error(`No se pudo conectar: ${e.type ?? e}`))); });
  const conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('La sala no responde. Revisa el código.')), 12000);
    conn.on('open', () => { clearTimeout(t); res(); });
    peer.on('error', (e) => { clearTimeout(t); rej(new Error(e.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : `Error: ${e.type ?? e}`)); });
  });
  Object.assign(coop, { role: 'guest', code, peer, hostConn: conn, name: name || 'Jugador' });
  conn.on('data', (msg) => {
    if (msg?.type === 'estado') apply(msg);
    else if (msg?.type === 'nombre') { coop.name = msg.name; changed(); }
    else if (msg?.type === 'llena') { setStatus('La sala está llena (máximo 4).'); leaveRoom(); }
  });
  conn.on('close', () => { setStatus('El anfitrión cerró la sala. La partida sigue en esta compu, sin conexión.'); coop.role = null; changed(); hooks.rerender(null); });
  conn.send({ type: 'hola', name: coop.name });
  setStatus(`Conectado a la sala ${code}.`);
}

export function leaveRoom() {
  try { coop.peer?.destroy(); } catch { /* ya cerrada */ }
  Object.assign(coop, { role: null, code: '', peer: null, conns: [], hostConn: null, players: [], ver: 0 });
  changed();
}

// Reparte los roles de la misión entre las personas conectadas (como el modo de una sola compu).
function syncPlayers() {
  changed();
}
