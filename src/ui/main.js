// Enrutador de pantallas, estado global y reparto de roles entre jugadores.
import * as title from './screens/title.js';
import * as design from './screens/design.js';
import * as launch from './screens/launch.js';
import * as ops from './screens/ops.js';
import * as reentry from './screens/reentry.js';
import * as report from './screens/report.js';
import * as arbol from './screens/arbol.js';
import { setMuted, isMuted, beep } from './audio.js';
import { hideGuide, relang } from './guide.js';
import { tr, getLang, setLang, retranslate } from '../i18n/i18n.js';
import { music } from './music.js';
import { initCoop, onCoopChange, coopInfo, coopScreen } from './coop.js';

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
  return app.players.find((p) => p.roles.includes(role))?.name ?? null;
}

export const app = {
  state: null,
  players: makePlayers(1),
  difficulty: 'medio',
  mode: 'libre',
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
let musicOn = false;
const musicLabel = () => { musicBtn.textContent = tr(musicOn ? 'MÚSICA: SÍ' : 'MÚSICA: NO'); };
musicBtn.addEventListener('click', async () => {
  musicOn = !musicOn;
  if (musicOn) { await music.start(); music.muted = false; music.setVolume(0.18); } else music.suspend();
  musicLabel();
});
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
initCoop(() => app, (screen) => {
  if (screen) redrawTo = screen;
  if (redrawTimer) return; // como mucho 4 redibujos por segundo
  redrawTimer = setTimeout(() => {
    redrawTimer = null;
    const to = redrawTo; redrawTo = null;
    if (!to && document.activeElement?.tagName === 'INPUT') return; // no borrar lo que alguien está escribiendo
    const y = window.scrollY;
    go(to ?? app.screen ?? 'title', { keepScroll: true, remote: true });
    window.scrollTo(0, y);
  }, 250);
});
onCoopChange((c) => {
  if (c.players.length) app.players = makePlayers(Math.min(4, c.players.length), c.players.map((p) => p.name));
  updateBar();
});

window.vdl = { app, go }; // útil para depurar desde la consola
go('title');
