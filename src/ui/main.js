// Enrutador de pantallas, estado global y reparto de roles entre jugadores.
import * as title from './screens/title.js';
import * as design from './screens/design.js';
import * as launch from './screens/launch.js';
import * as ops from './screens/ops.js';
import * as reentry from './screens/reentry.js';
import * as report from './screens/report.js';
import * as arbol from './screens/arbol.js';
import { setMuted, isMuted, beep } from './audio.js';
import { hideGuide } from './guide.js';

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
  window.scrollTo(0, 0);
}

export function updateBar() {
  const info = document.getElementById('barra-info');
  const p = app.players.map((x) => `${x.name}: ${x.roles.map((r) => PLAYER_ROLES[r]).join('+')}`).join(' · ');
  info.textContent = `${app.mode.toUpperCase()} · ${app.difficulty} · ${p}`;
}

const mute = document.getElementById('silencio');
mute.addEventListener('click', () => {
  setMuted(!isMuted());
  mute.textContent = isMuted() ? 'SONIDO: NO' : 'SONIDO: SÍ';
  if (!isMuted()) beep(880, 60);
});

window.vdl = { app, go }; // útil para depurar desde la consola
go('title');
