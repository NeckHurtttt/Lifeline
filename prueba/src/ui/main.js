// Enrutador de pantallas, estado global y reparto de roles entre jugadores.
import * as title from './screens/title.js';
import * as design from './screens/design.js';
import * as launch from './screens/launch.js';
import * as ops from './screens/ops.js';
import * as reentry from './screens/reentry.js';
import * as report from './screens/report.js';
import * as arbol from './screens/arbol.js';
import { setMuted, isMuted, beep } from './audio.js';
import { hideGuide, relang, say as sayGuide } from './guide.js';
import { tr, getLang, setLang, retranslate } from '../i18n/i18n.js';
import { music } from './music.js';
import { initCoop, onCoopChange, coopInfo, coopScreen, isGuest, getDraft, onDraft, coopAction, sendChat, onChat } from './coop.js';
import { h, modal } from './dom.js';
import { GLOSSARY } from '../data/glossary.js';

export const PLAYER_ROLES = {
  comandante: 'Comandante',
  comunicaciones: 'Comunicaciones',
  ingeniero: 'Ingeniería',
  cientifico: 'Ciencia',
};

const SPLITS = {
  1: [['comandante', 'comunicaciones', 'ingeniero', 'cientifico']],
  2: [['comandante', 'comunicaciones'], ['ingeniero', 'cientifico']],
  3: [['comandante', 'comunicaciones'], ['ingeniero'], ['cientifico']],
  4: [['comandante'], ['comunicaciones'], ['ingeniero'], ['cientifico']],
};

export function makePlayers(n, names = []) {
  return SPLITS[n].map((roles, i) => ({ name: names[i] || `Jugador ${i + 1}`, roles }));
}

/** Nombre del jugador que decide por un rol (o null si juega uno solo). */
export function whoDecides(app, role) {
  if (app.players.length <= 1) return null;
  const name = app.players.find((p) => p.roles.includes(role))?.name ?? null;
  // En línea: si esa persona se desconectó, decide cualquiera hasta que vuelva.
  if (name && coopInfo().players.find((p) => p.name === name)?.away) return null;
  return name;
}

export const app = {
  state: null,
  players: makePlayers(1),
  difficulty: 'medio',
  mode: 'libre',
  kids: (() => { try { return localStorage.getItem('vdl-ninos') === '1'; } catch { return false; } })(),
  autoPlan: true,
  budgetMult: 1,
  routine: null,
  lastDesign: null,
  lastSeed: null,
  objective: null, // objetivo de misión: se elige antes de diseñar
  reto: null, // código de misión si se está jugando un reto
  lastReport: null, // para comparar con el intento anterior
};

const screens = { title, design, launch, ops, reentry, report, arbol };
const root = document.getElementById('app');
let cleanup = null;

export function go(name, params = {}) {
  cleanup?.();
  cleanup = null;
  root.replaceChildren();
  document.querySelectorAll('.modal-bg, .static').forEach((e) => e.remove());
  app.screen = name;
  hideGuide();
  updateBar();
  // En el cooperativo en línea el anfitrión dirige el diseño, el despegue y la reentrada; el invitado mira el resultado.
  const HOST_ONLY = { launch: 'dirigiendo el despegue', reentry: 'dirigiendo la reentrada', arbol: 'en el árbol de mejoras' };
  if (isGuest() && HOST_ONLY[name]) {
    root.append(h('div', { class: 'panel c-cyan', id: 'esperando', style: { textAlign: 'center', marginTop: '2rem' } },
      h('h2', {}, 'EN LÍNEA · ESPERANDO AL ANFITRIÓN'),
      h('p', {}, `El anfitrión está ${HOST_ONLY[name]}. Tu pantalla cambia sola cuando termine.${name === 'launch' || name === 'reentry' ? ' Escucha la radio y vota GO / NO GO cuando te pregunten.' : ''}`),
      h('div', { class: 'code amber' }, `SALA ${coopInfo().code}`)));
    if (name === 'launch' || name === 'reentry') {
      // El invitado vota GO/NO GO desde su compu y escucha la radio del despegue.
      const live = h('div', { id: 'en-vivo', style: { maxWidth: '640px', margin: '1rem auto' } });
      root.append(live);
      const paint = () => {
        const poll = getDraft('gonogo');
        const me = coopInfo().name;
        const voted = poll && app.votedRound === poll.round;
        live.replaceChildren(...[
          poll && !voted && poll.players.includes(me) ? h('div', { class: 'panel c-amber', id: 'gonogo' },
            h('h3', {}, 'Sondeo Go/No-Go: ¿estás listo?'),
            h('button', { 'data-vote': 'go', onclick: () => { app.votedRound = poll.round; coopAction('voto', { v: 'go', round: poll.round }); paint(); } }, 'GO'), ' ',
            h('button', { class: 'danger', 'data-vote': 'nogo', onclick: () => { app.votedRound = poll.round; coopAction('voto', { v: 'nogo', round: poll.round }); paint(); } }, 'NO GO')) :
            poll && voted ? h('div', { class: 'small amber' }, 'Voto enviado. Esperando a los demás…') : null,
          h('div', { class: 'panel c-cyan' }, h('h2', {}, '📻 Radio de Control'),
            h('div', { class: 'log', id: 'radio' }, ...(getDraft('radio') ?? []).map(([t, cls]) => h('div', { class: cls }, t))))].filter(Boolean));
      };
      paint();
      const off = onDraft((k) => { if (k === 'gonogo' || k === 'radio') paint(); });
      cleanup = off;
    }
    return;
  }
  const r = screens[name].render(root, app, go, params);
  if (typeof r === 'function') cleanup = r;
  if (!params.keepScroll) window.scrollTo(0, 0);
  if (!params.remote) coopScreen();
}

export function updateBar() {
  const info = document.getElementById('barra-info');
  const p = app.players.map((x) => `${x.name}: ${x.roles.map((r) => PLAYER_ROLES[r]).join('+')}`).join(' · ');
  const c = coopInfo();
  info.textContent = tr(`${c.role ? `EN LÍNEA ${c.code} · ` : ''}${app.mode.toUpperCase()} · ${app.difficulty} · ${p}`);
}

const mute = document.getElementById('silencio');
const muteLabel = () => { mute.textContent = tr(isMuted() ? 'SONIDO: NO' : 'SONIDO: SÍ'); mute.title = tr('Silenciar sonido'); };
const langBtn = document.getElementById('idioma');
const langLabel = () => { langBtn.textContent = getLang() === 'en' ? 'EN → ES' : 'ES → EN'; document.title = tr('Ventana de Lanzamiento'); document.querySelector('.logo').textContent = tr('◢ VENTANA DE LANZAMIENTO'); };
setLang(getLang());
langBtn.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  retranslate();
  relang();
  updateBar(); muteLabel(); langLabel();
  beep(760, 40);
});
langLabel(); muteLabel();
const musicBtn = document.getElementById('musica');
// Música encendida por defecto: el navegador solo deja sonar tras el primer toque, así que arranca ahí.
// Si el jugador la apaga, se recuerda.
let musicOn = (() => { try { return localStorage.getItem('vdl-musica') !== 'no'; } catch { return true; } })();
const musicLabel = () => { musicBtn.textContent = tr(musicOn ? 'MÚSICA: SÍ' : 'MÚSICA: NO'); };
const musicPlay = async () => { await music.start(); music.muted = false; music.setVolume(0.75); };
musicBtn.addEventListener('click', async () => {
  musicOn = !musicOn;
  try { localStorage.setItem('vdl-musica', musicOn ? 'si' : 'no'); } catch {}
  if (musicOn) await musicPlay(); else music.suspend();
  musicLabel();
});
const musicFirstTouch = (e) => {
  window.removeEventListener('pointerdown', musicFirstTouch, true);
  window.removeEventListener('keydown', musicFirstTouch, true);
  if (musicOn && e.target !== musicBtn) musicPlay();
};
window.addEventListener('pointerdown', musicFirstTouch, true);
window.addEventListener('keydown', musicFirstTouch, true);
musicLabel();
/** Cambia el ánimo de la música según lo que pasa. */
export function musicMood(mode) { if (musicOn && music.mode !== mode) music.modeTo(mode); }
mute.addEventListener('click', () => {
  setMuted(!isMuted());
  muteLabel();
  if (isMuted() && musicOn) { musicOn = false; music.suspend(); musicLabel(); }
  if (!isMuted()) beep(880, 60);
});

// Cooperativo en línea: al llegar un cambio de otra persona se vuelve a dibujar la pantalla.
let redrawTimer = null; let redrawTo = null;
const LIVE = ['launch', 'reentry'];
initCoop(() => app, (screen) => {
  if (screen) redrawTo = screen;
  if (redrawTimer) return; // como mucho 4 redibujos por segundo
  redrawTimer = setTimeout(() => {
    redrawTimer = null;
    let to = redrawTo; redrawTo = null;
    // Si una decisión de otro jugador terminó la misión (evacuación, etc.), todos pasan al informe.
    if (!to && app.screen === 'ops' && app.state?.phase === 'report') to = 'report';
    if (!to && document.activeElement?.tagName === 'INPUT') return; // no borrar lo que alguien está escribiendo
    // El despegue y la reentrada del anfitrión corren en vivo: redibujarlos los reiniciaría.
    if (!to && !isGuest() && LIVE.includes(app.screen)) return;
    const y = window.scrollY;
    go(to ?? app.screen ?? 'title', { keepScroll: true, remote: true });
    window.scrollTo(0, y);
  }, 250);
});
onCoopChange((c) => {
  if (c.players.length) app.players = makePlayers(Math.min(4, c.players.length), c.players.map((p) => p.name));
  updateBar();
});

// Accesibilidad: tamaño de letra (para proyectar en clase) y colores para daltonismo.
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin espacio */ } };
let zoom = Number(pref('vdl-letra', '1')) || 1;
const applyZoom = () => { document.body.style.zoom = String(zoom); };
applyZoom();
document.getElementById('letra-mas').addEventListener('click', () => { zoom = Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10); setPref('vdl-letra', zoom); applyZoom(); });
document.getElementById('letra-menos').addEventListener('click', () => { zoom = Math.max(0.8, Math.round((zoom - 0.1) * 10) / 10); setPref('vdl-letra', zoom); applyZoom(); });
document.body.classList.toggle('daltonico', pref('vdl-daltonico', '0') === '1');
document.getElementById('daltonico').addEventListener('click', () => {
  const on = !document.body.classList.contains('daltonico');
  document.body.classList.toggle('daltonico', on); setPref('vdl-daltonico', on ? '1' : '0');
  sayGuide(on ? 'Colores para daltonismo: peligro en magenta y aviso en amarillo claro. Las barras también tienen rayas.' : 'Colores normales.', { quiet: true });
});
document.getElementById('glosario').addEventListener('click', () => {
  let q = '';
  const list = h('div', { class: 'glosario' });
  const paint = () => list.replaceChildren(...GLOSSARY.filter((g) => !q || `${g.term} ${g.def}`.toLowerCase().includes(q)).map((g) =>
    h('div', { class: 'lesson' }, h('b', {}, `${g.icon} ${g.term}`), h('div', { class: 'small' }, g.def), h('div', { class: 'small dim' }, `Ejemplo: ${g.ex}`))));
  paint();
  const close = modal(h('div', {}, h('h2', {}, '📖 Glosario del espacio'),
    h('input', { placeholder: 'Buscar palabra…', oninput: (e) => { q = e.target.value.toLowerCase(); paint(); } }),
    h('div', { style: { maxHeight: '60vh', overflow: 'auto', marginTop: '.5rem' } }, list),
    h('button', { onclick: () => close() }, 'Cerrar')));
});

// Chat rápido del cooperativo en línea: frases fijas, sin escribir.
const PHRASES = ['¡GO!', '¡Necesito piezas!', 'Falta energía ⚡', 'Hay que racionar 🍎', '¡Bien hecho! 👍', 'Espérenme ⏳', '¿Quién repara? 🔧', '¡Emergencia! 🚨'];
let chatBar = null;
onCoopChange((c) => {
  if (c.role && !chatBar) {
    const list = h('div', { class: 'chat-list' }, ...PHRASES.map((p) => h('button', { onclick: () => { sendChat(p); chatBar.classList.remove('open'); } }, p)));
    chatBar = h('div', { class: 'chat-bar', id: 'chat' }, h('button', { class: 'chat-toggle', title: 'Chat rápido', onclick: () => chatBar.classList.toggle('open') }, '💬'), list);
    document.body.append(chatBar);
  } else if (!c.role && chatBar) { chatBar.remove(); chatBar = null; }
});
onChat((from, text) => {
  const t = h('div', { class: 'chat-toast' }, `💬 ${from}: ${text}`);
  document.body.append(t); beep(1300, 50);
  setTimeout(() => t.remove(), 4000);
});

window.vdl = { app, go }; // útil para depurar desde la consola
go('title');
