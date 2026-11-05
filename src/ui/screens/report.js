// Informe final: resultado, medalla, gráfico de recursos, causas, lecciones, rediseño y ranking local.
import { loadCampaign, saveCampaign, recordResult } from '../../core/campaign.js';
import { SCENARIOS } from '../../data/catalog.js';
import { h, mount, bar } from '../dom.js';
import { buildReport } from '../../core/report.js';
import { clearSave } from '../../core/save.js';
import { LESSONS } from '../../data/lessons.js';
import { MODULES, LAUNCHERS } from '../../data/catalog.js';
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar, moodOf, MOOD_TEXT } from '../avatar.js';
import { OBJECTIVES, SCORE_PARTS } from '../../data/objectives.js';
import { encodeMission } from '../../core/share.js';

// v2: puntaje de 0 a 1000 por categorías (el ranking viejo usaba otra escala).
const RANK_KEY = 'vdl.ranking.v2';
const MEDALS = { oro: 'MEDALLA DE ORO', plata: 'MEDALLA DE PLATA', bronce: 'MEDALLA DE BRONCE' };
// Colores de consola: verdes y ámbar; cada línea con su trazo para distinguirlas.
const SERIES = [['o2', 'O₂', '#b8ffd0', ''], ['water', 'Agua', '#4dff88', '4 2'], ['food', 'Comida', '#ffc23d', ''], ['battery', 'Batería', '#2fb35c', '1 2']];

function readRanking() {
  try { const r = JSON.parse(localStorage.getItem(RANK_KEY)); return Array.isArray(r) ? r : []; } catch { return []; }
}

function summary(design) {
  const count = {};
  for (const m of design.modules) count[m.type] = (count[m.type] ?? 0) + 1;
  const mods = Object.entries(count).map(([t, n]) => `${MODULES[t]?.name ?? t}${n > 1 ? `×${n}` : ''}`).join(', ');
  return `${LAUNCHERS[design.launcher]?.name ?? design.launcher} · ${design.crewRoles.length} trip. · ${design.cargoDays} d · ${mods}`;
}

export function chart(history) {
  if (!history.length) return h('div', { class: 'small dim' }, 'Sin datos de días.');
  const W = 600; const H = 160;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('style', 'width:100%;height:180px;background:#020402;border:1px solid #1d3a1d');
  const maxDay = Math.max(...history.map((p) => p.day), 1);
  for (const [k, , color, dash] of SERIES) {
    const max = Math.max(...history.map((p) => p[k]), 1);
    const pts = history.map((p) => `${(p.day / maxDay) * W},${H - 4 - (p[k] / max) * (H - 8)}`).join(' ');
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', '1.6'); if (dash) pl.setAttribute('stroke-dasharray', dash);
    svg.append(pl);
  }
  return h('div', {}, svg, h('div', { class: 'row small' }, ...SERIES.map(([, name, color]) => h('span', { style: { color } }, `■ ${name}`)),
    h('span', { class: 'dim' }, '(cada línea, relativa a su máximo)')));
}

export function render(root, app, go) {
  const s = app.state;
  const rep = buildReport(s);
  clearSave();

  const id = `${s.seed}-${s.day}-${rep.score}`;
  let ranking = readRanking();
  if (!ranking.some((r) => r.id === id)) {
    ranking.push({ id, score: rep.score, medal: rep.medal, success: rep.success, days: rep.daysSurvived, difficulty: `${s.difficulty} ${OBJECTIVES[rep.breakdown.objective].icon}${app.reto ? ' 🏁' : ''}`,
      players: app.players.map((p) => p.name).join(', '), design: summary(s.design), date: new Date().toISOString().slice(0, 10) });
    ranking = ranking.sort((a, b) => b.score - a.score).slice(0, 10);
    try { localStorage.setItem(RANK_KEY, JSON.stringify(ranking)); } catch { /* sin espacio */ }
  }
  let campInfo = null;
  if (s.mode === 'campana') {
    const r = recordResult(loadCampaign(), id, s.scenarioId, rep);
    saveCampaign(r.camp);
    campInfo = r;
  }
  beep(rep.success ? 1200 : 300, 300, 'triangle');
  // Comparar con el intento anterior (rediseñar y repetir).
  const before = app.lastReport && app.lastReport.id !== id ? app.lastReport : null;
  app.lastReport = { id, score: rep.score, parts: Object.fromEntries(rep.breakdown.parts.map((p) => [p.id, p.value])) };
  const delta = (now, old) => (old === undefined ? null : now === old ? h('span', { class: 'dim' }, ' =') : h('span', { class: now > old ? 'delta-up' : 'delta-down' }, ` ${now > old ? '▲' : '▼'}${Math.abs(now - old)}`));
  const obj = OBJECTIVES[rep.breakdown.objective];

  const code = encodeMission({ design: s.design, scenarioId: s.scenarioId, difficulty: s.difficulty, objective: rep.breakdown.objective, seed: s.seed });
  const copy = async (btn) => {
    try { await navigator.clipboard.writeText(code); btn.textContent = '✔ Código copiado: pásalo a otro equipo'; } catch { prompt('Copia este código y pásalo a otro equipo:', code); }
  };

  mount(root, 
    h('div', { style: { textAlign: 'center' } },
      h('h1', { class: rep.success ? '' : 'red', id: 'resultado' }, rep.success ? 'MISIÓN CUMPLIDA' : 'MISIÓN FALLIDA'),
      h('div', { class: 'dim' }, rep.reason),
      rep.medal ? h('div', { class: 'medal' }, MEDALS[rep.medal]) : null,
      campInfo ? h('div', { class: 'panel c-amber', id: 'campana', style: { display: 'inline-block', marginTop: '.5rem' } },
        h('div', {}, `⭐ +${campInfo.points} puntos de campaña (tienes ${campInfo.camp.points})`),
        campInfo.unlockedNow ? h('div', { class: 'green' }, `🔓 ¡Nuevo destino desbloqueado: ${SCENARIOS[campInfo.unlockedNow].icon} ${SCENARIOS[campInfo.unlockedNow].short}!`) : null,
        h('button', { onclick: () => go('arbol') }, '🌳 Ver mejoras')) : null,
      h('div', { class: 'capsule', style: { margin: '.6rem 0' } }, ...s.crew.map((c) => h('div', { style: { textAlign: 'center' } },
        crewAvatar(c, { size: 76 }), h('div', { class: 'small' }, h('b', {}, c.name.split(' ')[0])), h('div', { class: 'small dim' }, MOOD_TEXT[moodOf(c)]))))),
    h('div', { class: 'panel c-cyan', id: 'puntaje' },
      h('h2', {}, `🏅 Puntaje: ${rep.score} / 1000`, before ? delta(rep.score, before.score) : null),
      h('div', { class: 'small dim' }, `Objetivo: ${obj.icon} ${obj.name}. Las categorías con ×2 o más valen más para este objetivo.`,
        before ? ' Las flechas comparan con tu intento anterior.' : ''),
      ...rep.breakdown.parts.map((p) => h('div', { class: 'score-part', title: SCORE_PARTS[p.id].desc },
        h('span', {}, SCORE_PARTS[p.id].icon),
        h('div', {}, h('div', { class: 'small' }, SCORE_PARTS[p.id].name, ' ', h('span', { class: 'w' }, `×${p.weight}`), before ? delta(p.value, before.parts[p.id]) : null), bar(p.value / 100, { warn: 0.5, danger: 0.3 })),
        h('b', {}, String(p.value))))),
    h('div', { class: 'grid3' },
      h('div', { class: 'panel c-blue' },
        h('h2', {}, '📊 Resumen'),
        h('table', {},
          ...[['Puntaje', rep.score], ['Días', rep.daysSurvived], ['Sobrevivientes', `${rep.survivors} / ${s.crew.length}`], ['Ciencia', rep.science],
            ['Dificultad', s.difficulty], ['Clima espacial', s.flareSource === 'donki' ? 'NASA DONKI en vivo' : 'registro DONKI 2024 (respaldo)']]
            .map(([k, v]) => h('tr', {}, h('td', { class: 'dim' }, k), h('td', {}, String(v))))),
        h('h3', { style: { marginTop: '.6rem' } }, 'Tripulación'),
        h('ul', { class: 'plain small' }, ...s.crew.map((c) => h('li', { class: c.alive ? '' : 'red' },
          `${c.alive ? '✔' : c.evacuated ? '↩' : '✖'} ${c.name} · salud ${Math.round(c.health)} · ${Math.round(c.radiation)} mSv`)))),
      h('div', {},
        h('div', { class: 'panel c-violet' }, h('h2', {}, '📈 Recursos día a día'), chart(s.history ?? [])),
        h('div', { class: 'panel c-amber', id: 'causas' },
          h('h2', {}, '🤔 Qué pasó y qué cambiar'),
          ...rep.causes.map((c, i) => h('div', { style: { margin: '.4rem 0' } },
            h('div', {}, '▸ ', c),
            h('div', { class: 'amber small' }, '  → ', rep.suggestions[i]))))),
      h('div', { class: 'panel c-green' },
        h('h2', {}, '🌍 Lo que sirve en la Tierra'),
        ...rep.lessons.map((lid) => LESSONS[lid]).filter(Boolean).map((l) => h('div', { class: 'lesson' },
          h('b', {}, l.title), h('div', { class: 'small' }, l.space), h('div', { class: 'small dim' }, '🌍 ', l.earth))))),
    h('div', { class: 'row', style: { justifyContent: 'center', margin: '1rem 0' } },
      h('button', { class: 'big', id: 'redisenar', onclick: () => { app.state = null; go('design', { design: s.design }); } }, 'REDISEÑAR Y REINTENTAR'),
      h('button', { id: 'compartir', title: 'Otro equipo lo pega en 🏁 Jugar un reto: misma nave, mismo destino y mismo clima espacial.', onclick: (e) => copy(e.target) }, '📤 Código para retar a otro equipo'),
      h('button', { onclick: () => { app.state = null; app.lastDesign = null; app.lastSeed = null; go('title'); } }, 'Menú')),
    h('div', { class: 'panel c-pink', id: 'ranking' },
      h('h2', {}, '🏆 Mejores misiones en esta compu'),
      h('table', {},
        h('tr', {}, ...['#', 'Puntaje', 'Medalla', 'Días', 'Dif.', 'Jugadores', 'Diseño', 'Fecha'].map((t) => h('th', {}, t))),
        ...ranking.map((r, i) => h('tr', { class: r.id === id ? 'sel' : '' },
          h('td', {}, i + 1), h('td', {}, r.score), h('td', {}, r.medal ? MEDALS[r.medal] : (r.success ? '—' : '✖')), h('td', {}, r.days),
          h('td', {}, r.difficulty), h('td', { class: 'small' }, r.players), h('td', { class: 'small dim' }, r.design), h('td', { class: 'small' }, r.date))))),
  );
  say(rep.success
    ? `¡Misión cumplida! ${rep.medal ? `Ganaron ${MEDALS[rep.medal]}.` : ''} Mira abajo qué podrían mejorar para sacar más puntos.`
    : `Esta vez no se pudo. Mira "Qué pasó y qué cambiar" y prueba de nuevo con REDISEÑAR.`,
  { mood: rep.success ? 'feliz' : 'pensando', target: rep.success ? '#causas' : '#redisenar' });
}
