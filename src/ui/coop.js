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
// Versión del protocolo: si alguien entra con la página vieja (caché), se avisa que recargue.
const COOP_VERSION = 5;

const coop = { base: null, role: null, code: '', name: '', peer: null, conns: [], hostConn: null, players: [], ver: 0, applying: false, status: '', listeners: new Set() };
let hooks = { getApp: null, rerender: null };

export const coopInfo = () => ({ name: coop.name, role: coop.role, code: coop.code, players: coop.players.slice(), status: coop.status });
export const inCoop = () => !!coop.role;
export const isGuest = () => coop.role === 'guest';
/** En línea: ¿le toca a esta compu decidir lo de `who` (nombre del jugador)? Sin conexión siempre sí. */
export const mine = (who) => !coop.role || !who || who === coop.name;
// Borradores compartidos (diseño de la nave, sondeo Go/No-Go, radio del despegue) y acciones que pide un invitado.
const drafts = {};
const draftFns = new Set();
const actionFns = new Set();
export const getDraft = (k) => drafts[k];
export const allDrafts = () => ({ ...drafts });
// Chat rápido con frases fijas.
const chatFns = new Set();
export function onChat(fn) { chatFns.add(fn); return () => chatFns.delete(fn); }
const gotChat = (from, text) => chatFns.forEach((fn) => fn(from, text));
export function sendChat(text) {
  if (!coop.role) return;
  const msg = { type: 'chat', from: coop.name, text: String(text).slice(0, 80) };
  if (coop.role === 'host') broadcast(msg); else if (coop.hostConn?.open) safeSend(coop.hostConn, msg);
  gotChat(coop.name, msg.text);
}
export function onDraft(fn) { draftFns.add(fn); return () => draftFns.delete(fn); }
export function onAction(fn) { actionFns.add(fn); return () => actionFns.delete(fn); }
const gotDraft = (k, v) => { drafts[k] = v; draftFns.forEach((fn) => fn(k, v)); };
/** Comparte un borrador con todos (sin pasar por la partida guardada). */
export function shareDraft(key, value) {
  if (!coop.role) return;
  drafts[key] = value;
  const msg = { type: 'borrador', key, value };
  if (coop.role === 'host') broadcast(msg);
  else if (coop.hostConn?.open) safeSend(coop.hostConn, msg);
}
/** Pide algo al anfitrión (lanzar, votar). En el anfitrión se cumple al tiro. */
export function coopAction(name, data = null) {
  if (coop.role === 'host' || !coop.role) actionFns.forEach((fn) => fn(name, data, coop.name));
  else if (coop.hostConn?.open) safeSend(coop.hostConn, { type: 'accion', name, data });
}
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
  return { type: 'estado', ver: coop.ver, screen: app.screen, state: app.state, meta: { difficulty: app.difficulty, mode: app.mode, objective: app.objective, scenario: app.scenario, kids: app.kids, contrarreloj: app.contrarreloj, budgetMult: app.budgetMult, reto: app.reto }, players: coop.players, drafts };
}

function apply(msg) {
  const app = hooks.getApp();
  if (msg.players) { coop.players = msg.players; changed(); }
  if (msg.drafts) Object.assign(drafts, msg.drafts);
  if (typeof msg.ver === 'number') coop.ver = Math.max(coop.ver, msg.ver);
  if (msg.meta) Object.assign(app, msg.meta);
  coop.applying = true;
  try {
    if (msg.state !== undefined) { app.state = msg.state; coop.base = msg.state ? structuredClone(msg.state) : null; if (msg.state) save(msg.state); }
  } finally { coop.applying = false; }
  hooks.rerender(msg.screen && msg.screen !== app.screen ? msg.screen : null);
}

// Todo viaja como texto JSON (igual que el guardado: Infinity/NaN no rompen el envío) por el canal binario de PeerJS,
// que parte los mensajes grandes en trozos. (El canal 'json' de PeerJS no acepta mensajes de más de 16 KB:
// el estado pasa ese tamaño hacia el día 50 y el invitado se quedaba congelado.)
function safeSend(c, msg) { try { if (c?.open) c.send(JSON.stringify(msg)); } catch (e) { console.error(e); } }
const unwire = (raw) => { if (typeof raw !== 'string') return raw; try { return JSON.parse(raw); } catch { return null; } };
function broadcast(msg, except = null) { const wire = JSON.stringify(msg); for (const c of coop.conns) if (c !== except && c.open) { try { c.send(wire); } catch (e) { console.error(e); } } }

// Cada guardado local (cualquier decisión) se comparte.
onSave((state) => {
  if (!coop.role || coop.applying) return;
  if (coop.role === 'host') { coop.ver++; broadcast(snapshot()); }
  else if (coop.hostConn?.open) {
    // Solo se manda lo que cambió desde el último estado recibido: el anfitrión lo junta con el suyo.
    const changes = coop.base ? diff(coop.base, state) : [[[], state]];
    coop.base = structuredClone(state);
    if (changes.length) safeSend(coop.hostConn, { type: 'cambio', changes });
  }
});

/** Avisa a los demás que el anfitrión cambió de pantalla (diseño → despegue, etc.). */
export function coopScreen() {
  if (coop.role === 'host' && !coop.applying) { coop.ver++; broadcast(snapshot()); }
}

// Latido: a veces la conexión directa se corta sin avisar. Cada 5 s todos mandan una señal;
// si pasan 15 s sin nada, el anfitrión da al invitado por caído y el invitado se reconecta solo.
const BEAT_MS = 5000; const DEAD_MS = 15000;
let beatTimer = null;
function startBeat(tick) { clearInterval(beatTimer); beatTimer = setInterval(tick, BEAT_MS); }
const seen = new WeakMap();

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
    startBeat(() => {
      const now = Date.now();
      for (const c of [...coop.conns]) {
        if (now - (seen.get(c) ?? now) > DEAD_MS) { try { c.close(); } catch { /* ya cerrada */ } dropConn(c); }
        else safeSend(c, { type: 'latido' });
      }
    });
    peer.on('connection', (conn) => {
      seen.set(conn, Date.now());
      conn.on('data', (raw) => {
        const msg = unwire(raw);
        seen.set(conn, Date.now());
        if (msg?.type === 'latido') return;
        if (msg?.type === 'hola') {
          let nm = String(msg.name || 'Jugador').trim().slice(0, 16) || 'Jugador';
          // Reconexión: si vuelve alguien que se cayó (mismo nombre), recupera su lugar y sus roles.
          // (el aviso de desconexión puede tardar: el mismo nombre recupera su lugar aunque aún no figure como caído)
          const same = coop.players.find((p) => p.name === nm && p.id !== peer.id);
          if (same && !same.away) { const old = coop.conns.find((c) => c.peer === same.id); coop.conns = coop.conns.filter((c) => c !== old); try { old?.close(); } catch { /* ya cerrada */ } same.away = true; same.id = null; }
          const seat = (same?.away ? same : null) ?? (coop.players.length >= COOP_MAX ? coop.players.find((p) => p.away) : null);
          if (!seat && coop.players.length >= COOP_MAX) { safeSend(conn, { type: 'llena' }); setTimeout(() => conn.close(), 300); return; }
          coop.conns.push(conn);
          if (seat) {
            if (seat.name !== nm) { for (let n = 2; coop.players.some((p) => p.name === nm); n++) nm = `${String(msg.name || 'Jugador').slice(0, 13)} ${n}`; }
            Object.assign(seat, { id: conn.peer, name: nm, away: false });
            setStatus(`${nm} volvió a la sala.`);
          } else {
            for (let n = 2; coop.players.some((p) => p.name === nm); n++) nm = `${String(msg.name || 'Jugador').slice(0, 13)} ${n}`;
            coop.players.push({ id: conn.peer, name: nm });
          }
          if (msg.v !== COOP_VERSION) setStatus(`${nm} tiene una versión vieja del juego: que recargue la página con Ctrl+Shift+R (o borre la caché en el teléfono).`);
          safeSend(conn, { type: 'nombre', name: nm });
          syncPlayers();
          coop.ver++; broadcast(snapshot());
        } else if (msg?.type === 'chat' && typeof msg.text === 'string') {
          const from = coop.players.find((p) => p.id === conn.peer)?.name ?? 'Jugador';
          broadcast({ type: 'chat', from, text: msg.text.slice(0, 80) }, conn);
          gotChat(from, msg.text.slice(0, 80));
        } else if (msg?.type === 'borrador' && typeof msg.key === 'string') {
          gotDraft(msg.key, msg.value);
          broadcast(msg, conn);
        } else if (msg?.type === 'accion' && typeof msg.name === 'string') {
          const from = coop.players.find((p) => p.id === conn.peer)?.name;
          if (from) actionFns.forEach((fn) => fn(msg.name, msg.data, from));
        } else if (msg?.type === 'cambio' && Array.isArray(msg.changes) && hooks.getApp().state) {
          // Durante el despegue o la reentrada manda el anfitrión: un cambio viejo del invitado se ignora y se le reenvía el estado.
          if (['launch', 'reentry'].includes(hooks.getApp().screen)) { safeSend(conn, snapshot()); return; }
          let next;
          try { next = patch(hooks.getApp().state, msg.changes.filter((c) => Array.isArray(c?.[0]) && c[0].length)); } catch { return; }
          coop.ver++;
          apply({ state: next, ver: coop.ver });
          broadcast(snapshot(), null);
        }
      });
      // Si alguien se cae, su lugar queda guardado (con sus roles) hasta que vuelva con el mismo nombre.
      conn.on('close', () => dropConn(conn));
    });
    peer.on('disconnected', () => setStatus('Sin conexión con el directorio; la sala sigue para quien ya entró.'));
    setStatus(`Sala ${code} abierta. Comparte el código.`);
    syncPlayers();
    return code;
  }
  throw new Error('No se pudo abrir la sala. Prueba otra vez.');
}

function dropConn(conn) {
  if (!coop.conns.includes(conn)) return;
  coop.conns = coop.conns.filter((c) => c !== conn);
  const p = coop.players.find((x) => x.id === conn.peer);
  if (p) { p.away = true; p.id = null; setStatus(`${p.name} se desconectó: si vuelve a entrar con el mismo nombre recupera su lugar.`); }
  syncPlayers(); broadcast(snapshot());
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
  let last = Date.now(); let rejoining = false;
  startBeat(() => {
    if (coop.hostConn !== conn || rejoining) return;
    if (Date.now() - last <= DEAD_MS) { safeSend(conn, { type: 'latido' }); return; }
    // Sin noticias del anfitrión: se vuelve a entrar con el mismo nombre (recupera su lugar).
    rejoining = true;
    setStatus('Se perdió la conexión con el anfitrión. Reconectando…');
    const nm = coop.name;
    const retry = () => joinRoom(code, nm).catch(() => {
      if (coop.role) return; // el jugador entró a otra sala mientras tanto
      setStatus('No se pudo reconectar todavía. Se vuelve a intentar…');
      setTimeout(() => { if (!coop.role) retry(); }, BEAT_MS);
    });
    retry();
  });
  conn.on('data', (raw) => {
    const msg = unwire(raw);
    last = Date.now();
    if (msg?.type === 'latido') return;
    if (msg?.type === 'estado') apply(msg);
    else if (msg?.type === 'borrador') gotDraft(msg.key, msg.value);
    else if (msg?.type === 'chat') gotChat(msg.from, msg.text);
    else if (msg?.type === 'nombre') { coop.name = msg.name; changed(); }
    else if (msg?.type === 'llena') { setStatus('La sala está llena (máximo 4).'); leaveRoom(); }
  });
  conn.on('close', () => { if (coop.hostConn !== conn) return; clearInterval(beatTimer); setStatus('El anfitrión cerró la sala. La partida sigue en esta compu, sin conexión.'); coop.role = null; changed(); hooks.rerender(null); });
  safeSend(conn, { type: 'hola', name: coop.name, v: COOP_VERSION });
  setStatus(`Conectado a la sala ${code}.`);
}

export function leaveRoom() {
  clearInterval(beatTimer);
  const old = coop.peer;
  // Primero se limpia, para que el aviso de cierre de la conexión vieja no se tome como el anfitrión saliendo.
  Object.assign(coop, { role: null, code: '', peer: null, conns: [], hostConn: null, players: [], ver: 0 });
  try { old?.destroy(); } catch { /* ya cerrada */ }
  for (const k of Object.keys(drafts)) delete drafts[k];
  changed();
}

// Reparte los roles de la misión entre las personas conectadas (como el modo de una sola compu).
function syncPlayers() {
  changed();
}
