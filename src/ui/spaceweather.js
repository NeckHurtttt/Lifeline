// Ventana "CLIMA ESPACIAL REAL": la llamarada más fuerte del último mes (NASA DONKI) se vuelve una decisión
// con costo en la misión, y después se muestra la restricción real con la dosis frente al límite de NASA.
import { h, modal, bar } from './dom.js';
import { beep, alarm } from './audio.js';
import { applyEffects } from '../core/events.js';
import { SCENARIOS } from '../data/catalog.js';
import { ARCHIVED_FLARE, ARCHIVED_FLARES, strongestFlares, stormOptions, stormIndexDue, NASA_CAREER_LIMIT, HEALTH_FINDINGS, SHELTER_FACTOR, osdUrl } from '../core/spaceweather.js';

let cached = null;
/** Llave de api.nasa.gov: la propia (gratis en api.nasa.gov) o la de prueba, que se agota rápido. */
export const nasaKey = () => { try { return localStorage.getItem('vdl-nasa-key') || 'DEMO_KEY'; } catch { return 'DEMO_KEY'; } };
export function setNasaKey(k) { try { if (k) localStorage.setItem('vdl-nasa-key', k.trim()); else localStorage.removeItem('vdl-nasa-key'); sessionStorage.removeItem('vdl-llamarada'); } catch { /* nada */ } cached = null; }
/** Las 3 llamaradas más fuertes de los últimos 30 días (DONKI) o las archivadas si no hay internet. */
export const recentFlare = () => recentFlares().then((l) => l[0]);
export function recentFlares() {
  if (cached) return cached;
  cached = (async () => {
    try { const s = JSON.parse(sessionStorage.getItem('vdl-llamarada') || 'null'); if (Array.isArray(s)) return s; } catch { /* nada */ }
    const end = new Date(), start = new Date(Date.now() - 30 * 86400000);
    const d = (x) => x.toISOString().slice(0, 10);
    // 1) api.nasa.gov con la llave propia (si se puso en DATA) o DEMO_KEY; 2) el servidor de DONKI sin llave (CCMC).
    const q = `startDate=${d(start)}&endDate=${d(end)}`;
    const urls = [`https://api.nasa.gov/DONKI/FLR?${q}&api_key=${nasaKey()}`, `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?${q}`];
    for (const url of urls) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const list = await r.json();
        if (!Array.isArray(list)) continue;
        const top = strongestFlares(list, 3);
        const f = top.length ? top : [{ cls: 'ninguna', date: d(end), source: 'donki-calma' }];
        try { sessionStorage.setItem('vdl-llamarada', JSON.stringify(f)); } catch { /* nada */ }
        return f;
      } catch { /* probar la siguiente */ }
    }
    return ARCHIVED_FLARES;
  })();
  return cached;
}

const flareText = (f) => (f.source === 'donki'
  ? `Datos REALES de NASA DONKI: la llamarada más fuerte del último mes fue clase ${f.cls}, el ${f.date}.`
  : `No se pudo consultar a NASA ahora (sin internet o la llave de prueba se agotó): usamos una llamarada REAL archivada de NASA DONKI, clase ${f.cls} del ${f.date} (la más fuerte del ciclo solar hasta ese día). No es un dato en vivo.`);
const CLASS_TXT = (cls) => (cls.startsWith('X') ? 'X es la clase más fuerte' : cls.startsWith('M') ? 'M es media-fuerte (X es la más fuerte)' : 'C es débil (M y X son más fuertes)');

/** ¿Toca una decisión de clima espacial? 3 por misión: al empezar, a 1/3 y a 2/3. */
export const stormDue = (s) => !!s && s.phase === 'ops' && !s.pending && !s.flash && s.flags?.realStorm !== 'abierta'
  && stormIndexDue(s.day, s.totalDays, s.flags?.realStormsDone ?? 0) >= 0;

export async function stormDecision(app, commit, draw) {
  const s0 = app.state;
  const idx = s0.flags?.realStormsDone ?? 0;
  commit({ ...s0, flags: { ...(s0.flags ?? {}), realStorm: 'abierta' } });
  const list = await recentFlares();
  let f = list[idx] ?? list[list.length - 1];
  const calm = f.source === 'donki-calma';
  if (calm) f = { ...ARCHIVED_FLARES[idx % ARCHIVED_FLARES.length], calm: true };
  else if (f.source === 'donki' && !list[idx]) f = { ...ARCHIVED_FLARES[idx % ARCHIVED_FLARES.length], calm: true };
  const s = app.state;
  const sc = SCENARIOS[s.scenarioId] ?? SCENARIOS.estacion;
  const kids = !!s.kids || !!app.kids;
  const shield = (s.modules.some((m) => m.type === 'escudo_agua') ? 0.6 : 1) * (s.flags?.regolithWall ? 0.6 : 1);
  const opts = stormOptions(f.cls, s.scenarioId, sc.scienceGoalPerDay ?? 8).map((o) => ({ ...o, dose: Math.round(o.dose * shield) }));
  const box = h('div', { id: 'clima-real', class: 'clima-real' });
  const close = modal(box, { grave: true });
  alarm('aviso');

  const pick = (o) => {
    let st = applyEffects(app.state, { science: o.science, battery: o.battery });
    st = structuredClone(st);
    for (const c of st.crew) if (c.alive && !c.evacuated) c.radiation = (c.radiation ?? 0) + o.dose;
    st.flags = { ...(st.flags ?? {}), realStorm: o.id, realStormsDone: idx + 1, realStormChoices: [...(st.flags?.realStormChoices ?? []), o.id] };
    st.log = [...(st.log ?? []), { day: st.day, text: `☀️ Llamarada real ${f.cls}: ${o.label.toLowerCase()} (+${o.dose} mSv c/u).`, cls: o.dose > 20 ? 'malo' : '' }];
    commit(st); beep(o.id === 'seguir' ? 400 : 880, 120);
    result(o, st);
  };

  const KID_COST = { refugio: 'Casi sin rayos. Pero no hay ciencia y se gasta energía.', mitad: 'Un poco de rayos y un poco de ciencia.', seguir: 'Mucha ciencia. Pero muchos rayos que el cuerpo no borra.' };
  const KID_LABEL = { refugio: '🛡️ Todos al refugio', mitad: '⚖️ La mitad al refugio', seguir: '🔬 Seguir trabajando' };
  if (kids) opts.forEach((o) => { o.cost = KID_COST[o.id]; o.label = KID_LABEL[o.id]; });
  const card = (o) => h('button', { class: `clima-op ${o.id}`, 'data-clima': o.id, onclick: () => pick(o) },
    h('b', {}, o.label),
    h('div', { class: 'clima-fila' }, h('span', {}, `☢️ +${o.dose} mSv c/u`), bar(o.dose / 60, { invert: true, warn: 0.3, danger: 0.6 })),
    h('div', { class: 'clima-fila' }, h('span', {}, `🔬 ${o.science >= 0 ? '+' : ''}${o.science} ciencia`), h('span', {}, `⚡ ${o.battery} kWh`)),
    h('div', { class: 'small dim' }, o.cost));

  box.replaceChildren(
    h('h2', {}, `☀️ CLIMA ESPACIAL REAL · ${idx + 1} de 3`),
    h('p', { class: 'clima-dato' }, kids ? `${f.source === 'donki' && !calm ? 'Dato de HOY' : 'Dato real guardado'} de NASA: el Sol lanzó una llamarada clase ${f.cls} (${f.date}).` : calm ? `Datos REALES de NASA DONKI: el último mes no hubo ${idx ? 'más ' : ''}llamaradas fuertes. Para entrenar usamos una real archivada: clase ${f.cls} del ${f.date}.` : flareText(f)),
    h('p', {}, kids
      ? `Una llamarada es una explosión en el Sol. ${CLASS_TXT(f.cls)}. Si tira partículas hacia ${sc.home ?? 'la base'}, son como rayos invisibles que dañan el cuerpo.`
      : `Una llamarada clase ${f.cls} (${CLASS_TXT(f.cls)}) puede venir con una tormenta de partículas. Si llegara hoy a ${sc.home ?? 'la base'}, cada astronauta sin protección recibiría unos ${opts[2].dose} mSv${shield < 1 ? ' (tu escudo ya la baja)' : ''}.`),
    h('p', { class: 'amber' }, '¿Qué hacen? Ninguna opción es gratis.'),
    h('div', { class: 'clima-ops' }, ...opts.map(card)),
    h('p', { class: 'small dim' }, `mSv (milisievert) mide cuánta radiación recibe el cuerpo. NASA permite como máximo ${NASA_CAREER_LIMIT} mSv en TODA la carrera de un astronauta.`));

  function result(o, st) {
    const crew = st.crew.filter((c) => c.alive && !c.evacuated);
    const finding = HEALTH_FINDINGS.find((x) => x.id === 'radiacion');
    box.replaceChildren(
      h('h2', {}, '📘 LA RESTRICCIÓN REAL'),
      h('p', { class: 'clima-grande' }, kids
        ? 'Protegerse de la radiación cuesta tiempo y energía. No protegerse cuesta salud que no se recupera.'
        : 'Protegerse cuesta ciencia y energía HOY. No protegerse suma radiación que el cuerpo NUNCA borra.'),
      h('p', {}, `Elegiste: ${o.label}. ${o.id === 'refugio' ? `Cada uno recibió solo ${o.dose} mSv (el refugio deja pasar ~${Math.round(SHELTER_FACTOR * 100)} %), pero perdieron ${-o.science} de ciencia y ${-o.battery} kWh.` : o.id === 'seguir' ? `Ganaron ${o.science} de ciencia, pero cada uno sumó ${o.dose} mSv para siempre.` : `Repartieron el costo: ${o.dose} mSv cada uno y ${-o.science} de ciencia menos.`}`),
      h('h3', {}, `Dosis de cada astronauta frente al límite de NASA (${NASA_CAREER_LIMIT} mSv en toda la vida)`),
      h('div', { class: 'clima-dosis' }, ...crew.map((c) => h('div', { class: 'clima-fila' }, h('span', {}, c.name.split(' ')[0]), bar(c.radiation / NASA_CAREER_LIMIT, { invert: true, warn: 0.5, danger: 0.8 }), h('span', { class: 'small' }, `${Math.round(c.radiation)} / ${NASA_CAREER_LIMIT}`)))),
      h('div', { class: 'lesson' }, h('b', {}, `${finding.icon} Dato real`), h('div', { class: 'small' }, finding.text), h('div', { class: 'small dim' }, `Fuente: ${finding.src}`)),
      (() => { const o = HEALTH_FINDINGS.find((x) => x.id === 'osd340'); return h('div', { class: 'lesson' }, h('b', {}, `${o.icon} Estudio real de NASA (${o.osd})`), h('div', { class: 'small' }, o.text), h('a', { class: 'small', href: osdUrl(o.osd), target: '_blank', rel: 'noopener' }, `Ver ${o.osd} en el repositorio OSDR de NASA`)); })(),
      h('div', { class: 'lesson' }, h('b', {}, '🧑‍🚀 Así lo hacen de verdad'), h('div', { class: 'small' }, 'En la Estación, en una tormenta solar, la tripulación se va a los módulos con más blindaje. En la nave Orion de Artemis, los astronautas arman un refugio con las bolsas de carga y agua alrededor de ellos.')),
      h('button', { class: 'big', id: 'clima-seguir', onclick: () => { close(); draw(); } }, 'ENTENDIDO'));
  }
}
