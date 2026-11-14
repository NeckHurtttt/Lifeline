// CENTRO DE CADETES: ficha con rango, academia básica + avanzada, certificado, modo maestro, escuela,
// pestaña DATA (sensores, APOD, ISS en vivo, retraso a Marte, fuentes), parches, récords, reto diario,
// demo automática y QR.
import { h, modal } from './dom.js';
import { beep } from './audio.js';
import { say, hideGuide } from './guide.js';
import { TRAININGS, ACADEMY_ORDER, hasWings } from '../core/academy.js';
import { ADVANCED, ADVANCED_ORDER } from '../core/academy2.js';
import { runTraining, academyRecord, saveAcademy } from './academy.js';
import './academy2.js';
import { ACHIEVEMENTS, loadAchievements } from '../core/achievements.js';
import { cadetPoints, rankOf, RANKS, dailyChallenge, todayKey, addDestRecord, encodeCadet, decodeCadet, marsDelayMin, marsDistanceAU } from '../core/cadete.js';
import { SENSORS, FACTS, SOURCES, FAR } from '../data/nasa.js';
import { liveCanvas, drawRocket, drawRadar, drawBase, drawPulse } from './viz.js';
import { speak } from './fx.js';
import { tr } from '../i18n/i18n.js';
import { updateStreak, liveStreak, PHOSPHORS, unlockedPhosphors, rankedUp } from '../core/arcade.js';

const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const DEST = { estacion: '🛰️ Estación', gateway: '🌘 Gateway', luna: '🌙 Luna', marte: '🔴 Marte' };
export const PUBLIC_URL = 'https://neckhurtttt.github.io/Lifeline/';

// ---------- Perfil ----------
export function cadetName() { return get('vdl-cadete-nombre', '') || 'Cadete'; }
export function profile() {
  const stars = academyRecord();
  const missions = get('vdl-misiones', {});
  const achievements = Object.keys(loadAchievements()).length;
  const wings = hasWings(stars);
  const arcade = get('vdl-arcade', { best: 0 }).best;
  const points = cadetPoints({ stars, missions, achievements, wings, arcade });
  return { name: cadetName(), stars, missions, achievements, wings, arcade, points, rank: rankOf(points), streak: streak() };
}

// ---------- Racha diaria ----------
export const streak = () => { const r = get('vdl-racha', null); return { now: liveStreak(r, todayKey()), best: r?.best ?? 0, today: r?.last === todayKey() }; };
/** Marca que hoy se jugó (academia, arcade o misión). */
export function markPlayed() {
  const before = get('vdl-racha', null);
  const r = updateStreak(before, todayKey());
  put('vdl-racha', r);
  if (r.count > 1 && before?.last !== r.last) say(`🔥 ¡Racha de ${r.count} días seguidos! Vuelve mañana para que no se corte.`, { mood: 'feliz', quiet: true });
  return r;
}

// ---------- Ascenso de rango con celebración y desbloqueo ----------
export function checkRankUp() {
  const p = profile();
  const seen = get('vdl-rango-visto', 0);
  if (!rankedUp(seen, p.rank.index)) { if (p.rank.index < seen) put('vdl-rango-visto', p.rank.index); return false; }
  put('vdl-rango-visto', p.rank.index);
  const unlock = PHOSPHORS.find((f) => f.rank === p.rank.index);
  const close = modal(h('div', { class: 'ascenso', id: 'ascenso' },
    h('div', { class: 'asc-rayos' }),
    h('div', { class: 'asc-tit' }, '▲ ASCENSO ▲'),
    h('div', { class: 'asc-ico' }, p.rank.icon),
    h('div', { class: 'asc-rango' }, p.rank.name.toUpperCase()),
    h('p', {}, `${p.name}, Control de Misión te asciende a ${p.rank.name}.`),
    unlock ? h('div', { class: 'asc-premio' }, `🔓 Desbloqueaste: ${unlock.name}. Cámbialo en tu FICHA.`) : null,
    h('button', { class: 'big', onclick: () => close() }, '¡A LA ORDEN!')));
  [523, 659, 784, 1047, 1319].forEach((f, k) => setTimeout(() => beep(f, 160, 'triangle', 0.07), k * 130));
  speak(`Ascenso. Ahora eres ${p.rank.name}.`, { interrupt: true });
  return true;
}

// ---------- Color del fósforo (se desbloquea con el rango) ----------
export function applyPhosphor(id = get('vdl-fosforo', 'verde')) {
  PHOSPHORS.forEach((f) => document.documentElement.classList.toggle(`fosforo-${f.id}`, f.id === id && id !== 'verde'));
  put('vdl-fosforo', id);
}
/** Lo llama el informe final. */
export function recordMissionEnd(scenario, success, score) {
  markPlayed(); setTimeout(checkRankUp, 2500);
  if (success) { const m = get('vdl-misiones', {}); m[scenario] = (m[scenario] ?? 0) + 1; put('vdl-misiones', m); }
  put('vdl-rec-dest', addDestRecord(get('vdl-rec-dest', {}), scenario, { score, date: todayKey(), ok: !!success }));
}

/** Avatar en pixel art (12×12 simétrico) a partir del nombre. */
export function pixelAvatar(name, px = 8) {
  const c = h('canvas', { class: 'pixel-av', width: 12 * px, height: 12 * px });
  const ctx = c.getContext('2d');
  let seed = 0; for (const ch of name) seed = (seed * 31 + ch.codePointAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  ctx.fillStyle = '#020a04'; ctx.fillRect(0, 0, 12 * px, 12 * px);
  const cols = ['#4dff88', '#2fb35c', '#b6ffcf'];
  // casco
  ctx.strokeStyle = '#2fb35c'; ctx.lineWidth = px / 2; ctx.beginPath(); ctx.arc(6 * px, 6 * px, 5.4 * px, 0, 7); ctx.stroke();
  for (let y = 2; y < 10; y++) for (let x = 2; x < 6; x++) {
    if (rnd() < (y > 7 ? 0.75 : 0.5)) { ctx.fillStyle = cols[Math.floor(rnd() * 3)]; ctx.fillRect(x * px, y * px, px, px); ctx.fillRect((11 - x) * px, y * px, px, px); }
  }
  ctx.fillStyle = '#020a04'; ctx.fillRect(3 * px, 4 * px, px, px); ctx.fillRect(8 * px, 4 * px, px, px);
  return c;
}

function rankBar(p) {
  const r = p.rank;
  return h('div', { class: 'rango' },
    h('div', { class: 'rango-nombre' }, `${r.icon} ${tr(r.name).toUpperCase()}`),
    h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(r.frac * 100)}%` } })),
    h('div', { class: 'small dim' }, r.next ? `${p.points} puntos · faltan ${r.toNext} para ${r.next.name}` : `${p.points} puntos · ¡rango máximo!`),
    h('div', { class: 'rangos' }, ...RANKS.map((x, i) => h('span', { class: i <= r.index ? 'on' : '' }, `${x.icon} ${tr(x.name)}`))));
}

// ---------- Pestañas del centro ----------
const TABS = [['ficha', 'FICHA'], ['acad', 'ACAD'], ['data', 'DATA'], ['parches', 'PARCHES'], ['clase', 'CLASE']];

export function openCenter(app, go, tab = 'ficha') {
  let cur = tab;
  hideGuide();
  const body = h('div', { class: 'centro-cuerpo' });
  const top = h('div', { class: 'pip-tabs', role: 'tablist' });
  const box = h('div', { class: 'centro', id: 'centro-cadetes' }, top, body);
  const close = modal(box);
  const paint = () => {
    top.replaceChildren(...TABS.map(([id, label]) => h('button', { class: `pip-tab ${cur === id ? 'on' : ''}`, 'data-pip': id, onclick: () => { cur = id; beep(900, 25); paint(); } }, label)),
      h('button', { class: 'pip-cerrar', onclick: () => close(), title: 'Cerrar' }, '✕'));
    const views = { ficha: fichaView, acad: acadView, data: dataView, parches: parchesView, clase: claseView };
    body.replaceChildren(views[cur]({ app, go, close, paint, reopen: (t) => { close(); openCenter(app, go, t); } }));
  };
  paint();
  return close;
}

function fichaView({ app, go, close, paint }) {
  const p = profile();
  const missionsTotal = Object.values(p.missions).reduce((a, b) => a + b, 0);
  const starsTotal = Object.values(p.stars).reduce((a, b) => a + b, 0);
  const daily = dailyChallenge();
  return h('div', { class: 'ficha' },
    h('div', { class: 'ficha-top' },
      pixelAvatar(p.name),
      h('div', {},
        h('div', { class: 'small dim' }, 'FICHA DE CADETE · LIFELINE'),
        h('input', { class: 'ficha-nombre', value: p.name === 'Cadete' ? '' : p.name, placeholder: 'Tu nombre', maxlength: 24,
          onchange: (e) => { put('vdl-cadete-nombre', e.target.value.trim()); paint(); } }),
        rankBar(p))),
    h('div', { class: 'ficha-stats' },
      ...[['★', 'Estrellas', `${starsTotal} / ${(ACADEMY_ORDER.length + ADVANCED_ORDER.length) * 3}`], ['🚀', 'Misiones cumplidas', missionsTotal], ['🎖️', 'Parches', `${p.achievements} / ${ACHIEVEMENTS.length}`], ['🪽', 'Alas', p.wings ? 'SÍ' : 'todavía no']]
        .map(([i, l, v]) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, `${i} ${typeof v === 'string' ? tr(v) : v}`), h('div', { class: 'small dim' }, l)))),
    h('div', { class: 'row' }, h('span', { class: `pill ${p.streak.now ? 'amber' : 'dim'}`, id: 'racha' }, `${tr('🔥 Racha:')} ${p.streak.now} ${tr(p.streak.now === 1 ? 'día' : 'días')}${tr(p.streak.today ? ' (hoy ✔)' : ' · ¡juega hoy!')}`),
      h('span', { class: 'pill dim' }, `mejor racha ${p.streak.best}`), h('span', { class: 'pill dim' }, `🕹️ Arcade: ${p.arcade}`)),
    h('div', { class: 'row', style: { margin: '.4rem 0' } }, h('span', { class: 'small dim' }, 'Color de pantalla:'),
      ...PHOSPHORS.map((f) => { const ok = unlockedPhosphors(p.rank.index).includes(f); return h('button', { class: `small ${get('vdl-fosforo', 'verde') === f.id ? 'sel' : ''}`, disabled: !ok, 'data-fosforo': f.id, title: ok ? f.name : `Se desbloquea con rango ${RANKS[f.rank].name}`, onclick: () => { applyPhosphor(f.id); paint(); } }, `${ok ? '' : '🔒 '}${tr(f.name.replace('Fósforo ', '').replace(' (Comandante)', ''))}`); })),
    h('div', { class: 'small dim' }, 'Destinos: ', ...Object.entries(DEST).map(([id, n]) => h('span', { class: `pill ${p.missions[id] ? 'green' : 'dim'}` }, `${tr(n)} ${p.missions[id] ? '✔' : '·'}`))),
    h('div', { class: 'acad-botones' },
      h('button', { class: 'big', id: 'reto-diario', onclick: () => { close(); startDaily(app, go); } }, `📅 Reto diario · ${DEST[daily.scenario]}`),
      h('button', { id: 'certificado', onclick: () => printCertificate(p) }, '🖨️ Certificado (PDF)'),
      h('button', { id: 'copiar-codigo', onclick: async (e) => {
        const code = encodeCadet(p);
        try { await navigator.clipboard.writeText(code); e.target.textContent = '✔ Código copiado'; } catch { prompt('Copia tu código para el profe:', code); }
      } }, '📋 Código para el profe')));
}

// ---------- Academia: básica (alas) + avanzada (rango) ----------
const WHERE = { estacion: 'la Estación', luna: 'la Luna', marte: 'Marte', gateway: 'Gateway' };
function acadView({ reopen }) {
  const rec = academyRecord();
  const card = (t, st) => h('button', { class: `acad-carta ${st >= 2 ? 'ok' : ''}`, 'data-acad': t.id, onclick: async () => {
    beep(820, 40);
    const before = hasWings(academyRecord());
    document.querySelector('#centro-cadetes')?.closest('.modal-bg')?.remove();
    const r = await runTraining(t.id);
    if (r) { saveAcademy(t.id, r.stars); markPlayed(); }
    reopen('acad');
    checkRankUp();
    if (!before && hasWings(academyRecord())) say('¡Felicidades! Ganaste tus ALAS DE ASTRONAUTA.', { mood: 'feliz' });
  } }, h('div', { class: 'acad-nombre' }, h('span', {}, t.icon), ' ', h('span', {}, t.name)), h('div', { class: 'acad-st' }, '★'.repeat(st) + '☆'.repeat(3 - st)),
  t.where.length ? h('div', { class: 'small dim' }, `Ayuda en ${WHERE[t.where[0]]}`) : null);
  return h('div', { id: 'academia-lista' },
    h('h2', {}, '🎓 Academia de astronautas'),
    hasWings(rec) ? h('div', { class: 'alas' }, '— ★ ALAS DE ASTRONAUTA ★ —') : h('p', { class: 'small' }, 'BÁSICA: con 2 estrellas en cada prueba ganas tus ALAS.'),
    h('div', { class: 'acad-lista' }, ...ACADEMY_ORDER.map((id) => card(TRAININGS[id], rec[id] ?? 0))),
    h('h2', { style: { marginTop: '1rem' } }, '🧑‍🚀 Entrenamiento avanzado'),
    h('p', { class: 'small dim' }, 'Cada estrella suma puntos para subir de rango: Cadete → Especialista → Piloto → Comandante.'),
    h('div', { class: 'acad-lista' }, ...ADVANCED_ORDER.map((id) => card(ADVANCED[id], rec[id] ?? 0))));
}

/** Abre directo la academia (botón del inicio). */
export const openAcademy = (app, go) => openCenter(app, go, 'acad');

// ---------- DATA: sensores reales, APOD, ISS en vivo, retraso a Marte y fuentes ----------
function dataView({ app }) {
  const scn = app.state?.scenarioId ?? app.scenario ?? 'estacion';
  const sen = SENSORS[scn] ?? SENSORS.estacion;
  const delay = marsDelayMin();
  const apod = h('div', { class: 'apod small dim' }, 'Cargando la foto del día de la NASA…');
  const issTxt = h('div', { class: 'small' }, 'Buscando la Estación…');
  const track = [];
  const issMap = liveCanvas(300, 150, (ctx, w, hh) => {
    ctx.strokeStyle = '#1f8a45'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    for (let x = 0; x <= w; x += w / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hh); ctx.stroke(); }
    for (let y = 0; y <= hh; y += hh / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#2fb35c'; ctx.beginPath(); ctx.moveTo(0, hh / 2); ctx.lineTo(w, hh / 2); ctx.stroke();
    ctx.fillStyle = '#4dff88';
    track.forEach((p, i) => { ctx.globalAlpha = (i + 1) / track.length; ctx.fillRect((p.lon + 180) / 360 * w - 1, (90 - p.lat) / 180 * hh - 1, 2, 2); });
    ctx.globalAlpha = 1;
    const last = track.at(-1);
    if (last) { const x = (last.lon + 180) / 360 * w, y = (90 - last.lat) / 180 * hh; ctx.strokeStyle = '#ffc23d'; ctx.beginPath(); ctx.arc(x, y, 5 + Math.sin(performance.now() / 200) * 1.5, 0, 7); ctx.stroke(); }
  }, { cls: 'iss-mapa' });
  const pollISS = async () => {
    if (!issMap.isConnected && track.length) return;
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const d = await r.json();
      track.push({ lat: d.latitude, lon: d.longitude }); if (track.length > 60) track.shift();
      issTxt.textContent = `🛰️ AHORA: lat ${d.latitude.toFixed(1)}°, lon ${d.longitude.toFixed(1)}° · ${Math.round(d.altitude)} km de altura · ${Math.round(d.velocity).toLocaleString('es')} km/h · ${d.visibility === 'daylight' ? 'de día' : 'de noche'}`;
    } catch { issTxt.textContent = 'Sin internet: la Estación vuela a ~420 km de altura y 27 600 km/h.'; return; }
    setTimeout(() => { if (issMap.isConnected) pollISS(); }, 5000);
  };
  pollISS();
  (async () => {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
      const d = await (await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true', { signal: ctl.signal })).json();
      if (!d?.title) throw new Error('sin datos');
      const src = d.media_type === 'image' ? d.url : d.thumbnail_url;
      apod.replaceChildren(h('b', {}, `📷 Foto del día (NASA APOD): ${d.title}`), ...(src ? [h('img', { src, alt: d.title, loading: 'lazy' })] : []),
        h('div', { class: 'small dim' }, `${d.date}${d.copyright ? ` · © ${d.copyright.trim()}` : ''}`));
    } catch { apod.textContent = 'Sin conexión con NASA APOD ahora (o se acabó el límite de la llave DEMO). Las demás lecturas funcionan sin internet.'; }
  })();
  const flare = h('div', { class: 'small' }, 'Consultando NASA DONKI…');
  const paintFlare = () => import('./spaceweather.js').then(({ recentFlare }) => recentFlare()).then((f) => { flare.textContent = f.source === 'donki' ? `☀️ EN VIVO (DONKI): llamarada más fuerte de los últimos 30 días: ${f.cls}, el ${f.date}.` : f.source === 'donki-calma' ? '☀️ EN VIVO (DONKI): el último mes no hubo llamaradas.' : `☀️ No se pudo consultar a NASA (sin internet o la llave de prueba se agotó): se usa la llamarada real archivada ${f.cls} del ${f.date}.`; });
  paintFlare();
  const keyInput = h('input', { placeholder: 'Llave de api.nasa.gov (opcional)', size: 28, value: (() => { try { return localStorage.getItem('vdl-nasa-key') ?? ''; } catch { return ''; } })() });
  const keyRow = h('div', { class: 'row small' }, keyInput, h('button', { class: 'small', onclick: () => import('./spaceweather.js').then(({ setNasaKey }) => { setNasaKey(keyInput.value); flare.textContent = 'Consultando NASA DONKI…'; paintFlare(); }) }, 'Usar llave'),
    h('span', { class: 'dim' }, 'Gratis en api.nasa.gov: la de prueba se agota rápido.'));
  return h('div', { class: 'data' },
    h('div', { class: 'panel c-amber', id: 'jurado-datos' },
      h('h2', {}, '🏛️ Para el jurado: la restricción y los datos'),
      h('p', {}, h('b', {}, 'Restricción central: '), 'protegerse de la radiación cuesta ciencia y energía hoy; no protegerse suma una dosis que el cuerpo nunca borra. Y la energía es la que mantiene vivo el soporte vital. Ninguna opción es gratis.'),
      h('ul', { class: 'small' },
        h('li', {}, h('b', {}, 'NASA DONKI: '), 'la llamarada más fuerte del último mes se convierte en una decisión en cada misión (refugio, mitad o seguir). También el calendario de tormentas solares de la misión. Si no hay internet se usa un evento real archivado y se dice que no es en vivo.'),
        h('li', {}, h('b', {}, 'Límite de NASA (600 mSv en la carrera): '), 'es la meta de radiación del juego; cada decisión muestra cuánto de ese límite se gasta.'),
        h('li', {}, h('b', {}, 'Salud de astronautas (NASA HRP, Twins Study, Rodent Research en OSDR): '), 'pérdida de hueso y músculo, dosis del viaje a Marte (Curiosity RAD). Explican por qué hay que hacer ejercicio y usar refugio.'),
        h('li', {}, h('b', {}, 'Sensores del destino (LRO, Perseverance MEDA, Curiosity RAD, ISS): '), 'gravedad, temperatura, radiación y duración del día. Son datos fijos citados, no en vivo.'),
        h('li', {}, h('b', {}, 'En vivo: '), 'posición de la Estación (wheretheiss.at), foto del día (APOD) y el retraso de la señal a Marte calculado con la fecha de hoy.')),
      flare, keyRow),
    h('h2', {}, `📡 SENSORES · ${DEST[scn] ?? scn}`),
    h('table', { class: 'sensores' },
      ...[['Gravedad', sen.grav], ['Temperatura', sen.temp], ['Radiación', sen.rad], ['Día', sen.dia], ['Presión', sen.pres]].map(([k, v]) => h('tr', {}, h('td', { class: 'dim' }, k), h('td', {}, v)))),
    h('div', { class: 'small dim' }, `Fuente: ${sen.src}`),
    h('h2', {}, '📻 Retraso de la señal a Marte HOY'),
    h('div', { class: 'lectura code' }, `${delay.toFixed(1)} min`),
    h('div', { class: 'small dim' }, `Marte está a ${(marsDistanceAU() * 149.6).toFixed(0)} millones de km. Un "hola" va y vuelve en ${(delay * 2).toFixed(0)} minutos.`),
    h('h2', {}, '🛰️ Estación Espacial en vivo'), issMap, issTxt,
    apod,
    h('h2', {}, '🔭 Más lejos (expediciones con rango Comandante)'),
    ...Object.values(FAR).map((f) => h('div', { class: 'lesson' }, h('b', {}, `${f.icon} ${f.name}`), h('div', { class: 'small' }, `Gravedad ${f.grav} · ${f.temp} · Radiación: ${f.rad}`), h('div', { class: 'small dim' }, f.fact))),
    h('h2', {}, '📚 Fuentes'),
    h('ul', { class: 'small fuentes' }, ...SOURCES.map(([n, u]) => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, n)))));
}

// ---------- Parches (logros) y récords por destino ----------
function parchesView() {
  const got = loadAchievements();
  const rec = get('vdl-rec-dest', {});
  return h('div', {},
    h('h2', {}, `🎖️ Parches de misión (${Object.keys(got).length} de ${ACHIEVEMENTS.length})`),
    h('div', { class: 'parches' }, ...ACHIEVEMENTS.map((a) => h('div', { class: `parche ${got[a.id] ? 'on' : ''}`, title: a.desc },
      h('div', { class: 'parche-ico' }, got[a.id] ? a.icon : '?'), h('div', { class: 'parche-txt' }, a.name), h('div', { class: 'small dim' }, got[a.id] ? got[a.id] : a.desc)))),
    h('h2', { style: { marginTop: '1rem' } }, '🏆 Récords por destino'),
    h('div', { class: 'grid2' }, ...Object.entries(DEST).map(([id, n]) => h('div', { class: 'panel' }, h('h3', {}, n),
      (rec[id] ?? []).length ? h('table', { class: 'small' }, ...(rec[id]).map((r, i) => h('tr', {}, h('td', {}, `${i + 1}.`), h('td', {}, String(r.score)), h('td', {}, r.ok ? '✔' : '✖'), h('td', { class: 'dim' }, r.date))))
        : h('div', { class: 'small dim' }, 'Todavía sin misiones.')))));
}

// ---------- Clase: modo maestro y "cómo lo usa una escuela" ----------
function claseView() {
  const roster = get('vdl-clase', []);
  const table = h('div');
  const paintRoster = () => {
    const list = get('vdl-clase', []);
    table.replaceChildren(list.length ? h('table', { class: 'small clase' },
      h('tr', {}, ...['Cadete', 'Rango', 'Puntos', 'Estrellas', 'Misiones', 'Alas', ''].map((t) => h('th', {}, t))),
      ...list.sort((a, b) => b.points - a.points).map((c, i) => h('tr', {},
        h('td', {}, c.name), h('td', {}, `${rankOf(c.points).icon} ${rankOf(c.points).name}`), h('td', {}, c.points),
        h('td', {}, Object.values(c.stars).reduce((a, b) => a + b, 0)), h('td', {}, Object.values(c.missions).reduce((a, b) => a + b, 0)), h('td', {}, c.wings ? '🪽' : '·'),
        h('td', {}, h('button', { class: 'small', onclick: () => { const l = get('vdl-clase', []); l.splice(l.findIndex((x) => x.name === c.name), 1); put('vdl-clase', l); paintRoster(); } }, '✕')))))
      : h('div', { class: 'small dim' }, 'Todavía no hay alumnos. Pega sus códigos arriba.'));
  };
  paintRoster(); void roster;
  const input = h('textarea', { rows: 3, placeholder: 'Pega aquí los códigos CAD1-… (uno por línea)', style: { width: '100%' } });
  return h('div', {},
    h('h2', {}, '🍎 Modo maestro'),
    h('p', { class: 'small' }, 'Cada alumno toca "📋 Código para el profe" en su FICHA y te lo manda (WhatsApp, Classroom, correo). Pégalos aquí para ver el progreso de toda la clase. Todo se guarda en esta compu, sin cuentas ni servidores.'),
    input,
    h('div', { class: 'acad-botones' },
      h('button', { onclick: () => {
        const l = get('vdl-clase', []); let n = 0;
        for (const line of input.value.split(/\s+/)) { const c = decodeCadet(line); if (!c) continue; const i = l.findIndex((x) => x.name === c.name); if (i >= 0) l[i] = c; else l.push(c); n++; }
        put('vdl-clase', l); input.value = ''; paintRoster(); beep(n ? 990 : 300, 80);
      } }, '➕ Agregar alumnos'),
      h('button', { onclick: () => { const l = get('vdl-clase', []); const csv = ['nombre,rango,puntos,estrellas,misiones,alas', ...l.map((c) => [c.name, rankOf(c.points).name, c.points, Object.values(c.stars).reduce((a, b) => a + b, 0), Object.values(c.missions).reduce((a, b) => a + b, 0), c.wings ? 'si' : 'no'].join(','))].join('\n');
        const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'clase-lifeline.csv' }); a.click(); } }, '⬇️ Bajar planilla (CSV)')),
    table,
    h('h2', { style: { marginTop: '1rem' } }, '🏫 Cómo lo usa una escuela'),
    h('ol', { class: 'escuela' },
      h('li', {}, h('b', {}, 'Entrenar (15 min). '), 'Cada alumno hace la Academia en su celular o compu: 14 pruebas cortas con datos reales de NASA. Sin instalar nada.'),
      h('li', {}, h('b', {}, 'Volar en equipo (30 min). '), 'Grupos de 2 a 4 con roles (Comandante, Comunicaciones, Ingeniería, Ciencia) en una compu o cada uno en la suya con código de sala. Contrarreloj para competir.'),
      h('li', {}, h('b', {}, 'Debatir (10 min). '), 'El informe final explica qué salió bien y mal, compara con misiones reales y deja un diario para imprimir. El profe junta los códigos y ve el avance.')),
    h('div', { class: 'small dim' }, 'Funciona sin internet una vez abierto (se puede instalar en tablets) y tiene modo niños, letra grande y colores para daltonismo.'),
    qrBlock(PUBLIC_URL, 'Escanea para jugar'));
}

// ---------- Reto diario ----------
export function startDaily(app, go, SUGGESTED = app.suggested) {
  const d = dailyChallenge();
  Object.assign(app, { mode: 'libre', budgetMult: 1, scenario: d.scenario, difficulty: d.difficulty, objective: d.objective, state: null,
    lastDesign: null, lastSeed: d.seed, reto: `DIARIO-${d.date}`, historica: null, practice: null, kids: false });
  beep(990, 80);
  go('design', SUGGESTED ? { design: SUGGESTED(d.scenario) } : {});
  say(`📅 Reto diario del ${d.date}: ${DEST[d.scenario]}, mismo clima espacial para todos los que jueguen hoy. ¡Compara tu puntaje con tus amigos!`, { mood: 'feliz', target: '#lanzar' });
}

// ---------- Certificado imprimible ----------
export function printCertificate(p = profile()) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const all = [...ACADEMY_ORDER.map((id) => TRAININGS[id]), ...ADVANCED_ORDER.map((id) => ADVANCED[id])];
  const rows = all.map((t) => `<tr><td>${t.icon} ${esc(t.name)}</td><td>${'★'.repeat(p.stars[t.id] ?? 0)}${'☆'.repeat(3 - (p.stars[t.id] ?? 0))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado LIFELINE · ${esc(p.name)}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Georgia,serif;color:#062;margin:0}
.c{border:6px double #0a5;padding:18px 28px;height:178mm;box-sizing:border-box;position:relative;text-align:center}
h1{font-size:40px;letter-spacing:.2em;margin:.2em 0;color:#063}h2{font-weight:normal;margin:.2em}.n{font-size:34px;border-bottom:1px solid #0a5;display:inline-block;padding:0 40px;margin:.3em}
.alas{font-size:22px;letter-spacing:.3em;color:#a70}table{margin:8px auto;font-size:12px;columns:2;border-collapse:collapse}td{padding:1px 10px;text-align:left}
.f{position:absolute;bottom:18px;left:28px;right:28px;display:flex;justify-content:space-between;font-size:12px}.f div{border-top:1px solid #062;padding-top:4px;width:30%}
.mono{font-family:monospace;color:#0a5}</style></head><body><div class="c">
<div class="mono">◢ LIFELINE · ACADEMIA DE ASTRONAUTAS · NASA SPACE APPS 2026</div>
<h1>CERTIFICADO</h1><h2>Se certifica que</h2><div class="n">${esc(p.name)}</div>
<h2>completó el entrenamiento con el rango de <b>${esc(p.rank.name.toUpperCase())}</b> (${p.points} puntos)</h2>
${p.wings ? '<div class="alas">— ★ ALAS DE ASTRONAUTA ★ —</div>' : ''}
<table>${rows}</table>
<div class="f"><div>Control de Misión · Nova</div><div>${todayKey()}</div><div>Equipo #LosTiraVida</div></div>
</div><script>setTimeout(()=>print(),400)</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { say('El navegador bloqueó la ventana del certificado. Permite ventanas emergentes y vuelve a tocar.', { mood: 'alerta' }); return; }
  w.document.write(html); w.document.close();
}

// ---------- QR (generador de cdnjs; sin internet muestra el enlace) ----------
let qrLib = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('sin QR')); };
    document.head.append(s);
  });
  return qrLib;
}
export function qrBlock(url, label = 'Ábrelo en tu celular') {
  const holder = h('div', { class: 'qr-img' }, '…');
  loadQr().then((q) => {
    const qr = q(0, 'M'); qr.addData(url); qr.make();
    holder.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }).catch(() => { holder.textContent = '(sin internet para el QR)'; });
  return h('div', { class: 'qr' }, holder, h('div', {}, h('b', {}, `📱 ${label}`), h('div', { class: 'small' }, h('a', { href: url, target: '_blank', rel: 'noopener' }, url))));
}

// ---------- Demo automática de 60 s (para el stand o mientras se presenta) ----------
export function attractDemo() {
  const SLIDES = [
    { t: '🎓 ENTRENA', d: '14 pruebas como las de NASA: gravedad cero, acople, traje EVA, rover con retraso de señal…', draw: (ctx, w, hh, t) => drawRadar(ctx, w, hh, t, [{ ang: 1, dist: 0.9, label: 'CADETE', speed: 0.05 }]) },
    { t: '🚀 DESPEGA', d: 'Cuenta regresiva, clima, Go/No-Go de cada consola y abortos de verdad.', draw: (ctx, w, hh, t) => drawRocket(ctx, w, hh, t, { lift: Math.max(0, (t % 10 - 3) * 18), firing: t % 10 > 2 }) },
    { t: '🛰️ SOBREVIVE', d: 'Un año en la Estación, el Gateway, la Luna o Marte: aire, agua, comida, energía y radiación.', draw: (ctx, w, hh, t) => drawBase(ctx, w, hh, t, { day: Math.floor(t * 9), night: (Math.sin(t / 2) + 1) / 2, plants: (t % 10) / 10, crew: [1, 2, 3, 4].map(() => ({ alive: true, health: 90 })), modules: [['cabina', 0, 0], ['soporte_vital', 1, 0], ['laboratorio', 2, 0], ['invernadero', 0, 1], ['paneles', 1, 1], ['baterias', 2, 1]].map(([type, x, y]) => ({ type, x, y, on: true, health: type === 'laboratorio' && t % 10 > 6 ? 20 : 90 })) }) },
    { t: '🚨 EMERGENCIAS', d: 'Meteoritos, fuego, fugas: cierra escotillas y sigue el protocolo contra reloj.', draw: (ctx, w, hh, t) => drawRadar(ctx, w, hh, t % 10, [{ ang: 0.4, dist: 1, label: 'METEORITO', speed: 0.09 }, { ang: 2.5, dist: 0.8, label: 'BASURA', speed: 0.06 }, { ang: 4.2, dist: 0.95, speed: 0.08 }]) },
    { t: '❤️ CUIDA A TU GENTE', d: 'Cada astronauta tiene pulso, ánimo, cansancio y personalidad.', draw: (ctx, w, hh, t) => drawPulse(ctx, w, hh, t, 72 + Math.round(Math.sin(t / 3) * 30)) },
    { t: '📡 DATOS REALES', d: `Tormentas solares de NASA DONKI, la ISS en vivo y Marte hoy a ${marsDelayMin().toFixed(1)} min-luz.`, draw: (ctx, w, hh, t) => drawRadar(ctx, w, hh, t, [{ ang: 5, dist: 0.6, label: 'ISS', speed: 0 }, { ang: 2, dist: 0.85, label: 'MARTE', speed: 0 }]) },
  ];
  let i = 0, t0 = performance.now();
  const title = h('div', { class: 'demo-t' }), desc = h('div', { class: 'demo-d' }), fact = h('div', { class: 'demo-f' });
  const canvas = liveCanvas(420, 260, (ctx, w, hh) => { const t = (performance.now() - t0) / 1000; SLIDES[i].draw(ctx, w, hh, t); }, { cls: 'demo-c' });
  const set = () => { title.textContent = SLIDES[i].t; desc.textContent = SLIDES[i].d; fact.textContent = `¿Sabías que…? ${FACTS[(i * 3) % FACTS.length]}`; t0 = performance.now(); speak(`${SLIDES[i].t.replace(/^\S+\s/, '')}. ${SLIDES[i].d}`, { interrupt: true }); };
  const el = h('div', { id: 'demo-auto', onclick: () => stop() }, h('div', { class: 'demo-marco' }, h('div', { class: 'small dim' }, '◢ LIFELINE · DEMO AUTOMÁTICA · toca para salir'), title, canvas, desc, fact, h('div', { class: 'demo-pie' }, 'Junior Astronaut Mission Trainer · #LosTiraVida · NASA Space Apps 2026')));
  document.body.append(el); set();
  const iv = setInterval(() => { i = (i + 1) % SLIDES.length; set(); }, 10000);
  const stop = () => { clearInterval(iv); window.speechSynthesis?.cancel(); el.remove(); document.removeEventListener('keydown', stop); };
  document.addEventListener('keydown', stop);
  return stop;
}
