// Informe final: resultado, medalla, gráfico de recursos, causas, lecciones, rediseño y ranking local.
import { h, mount } from '../dom.js';
import { buildReport } from '../../core/report.js';
import { clearSave } from '../../core/save.js';
import { LESSONS } from '../../data/lessons.js';
import { MODULES, LAUNCHERS } from '../../data/catalog.js';
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar, moodOf, MOOD_TEXT } from '../avatar.js';

const RANK_KEY = 'vdl.ranking';
const MEDALS = { oro: '🥇 ORO', plata: '🥈 PLATA', bronce: '🥉 BRONCE' };
const SERIES = [['o2', 'O₂', '#7dd3ff'], ['water', 'Agua', '#33ff66'], ['food', 'Comida', '#ffb000'], ['battery', 'Batería', '#c78bff']];

function readRanking() {
  try { const r = JSON.parse(localStorage.getItem(RANK_KEY)); return Array.isArray(r) ? r : []; } catch { return []; }
}

function summary(design) {
  const count = {};
  for (const m of design.modules) count[m.type] = (count[m.type] ?? 0) + 1;
  const mods = Object.entries(count).map(([t, n]) => `${MODULES[t]?.name ?? t}${n > 1 ? `×${n}` : ''}`).join(', ');
  return `${LAUNCHERS[design.launcher]?.name ?? design.launcher} · ${design.crewRoles.length} trip. · ${design.cargoDays} d · ${mods}`;
}

function chart(history) {
  if (!history.length) return h('div', { class: 'small dim' }, 'Sin datos de días.');
  const W = 600; const H = 160;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('style', 'width:100%;height:180px;background:#020402;border:1px solid #1d3a1d');
  const maxDay = Math.max(...history.map((p) => p.day), 1);
  for (const [k, , color] of SERIES) {
    const max = Math.max(...history.map((p) => p[k]), 1);
    const pts = history.map((p) => `${(p.day / maxDay) * W},${H - 4 - (p[k] / max) * (H - 8)}`).join(' ');
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', '1.6');
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
    ranking.push({ id, score: rep.score, medal: rep.medal, success: rep.success, days: rep.daysSurvived, difficulty: s.difficulty,
      players: app.players.map((p) => p.name).join(', '), design: summary(s.design), date: new Date().toISOString().slice(0, 10) });
    ranking = ranking.sort((a, b) => b.score - a.score).slice(0, 10);
    try { localStorage.setItem(RANK_KEY, JSON.stringify(ranking)); } catch { /* sin espacio */ }
  }
  beep(rep.success ? 1200 : 300, 300, 'triangle');

  const copy = async (btn) => {
    const text = JSON.stringify(s.design, null, 2);
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado ✔'; } catch { prompt('Copia el diseño:', text); }
  };

  mount(root, 
    h('div', { style: { textAlign: 'center' } },
      h('h1', { class: rep.success ? '' : 'red', id: 'resultado' }, rep.success ? 'MISIÓN CUMPLIDA' : 'MISIÓN FALLIDA'),
      h('div', { class: 'dim' }, rep.reason),
      rep.medal ? h('div', { class: 'medal' }, MEDALS[rep.medal]) : null,
      h('div', { class: 'capsule', style: { margin: '.6rem 0' } }, ...s.crew.map((c) => h('div', { style: { textAlign: 'center' } },
        crewAvatar(c, { size: 76 }), h('div', { class: 'small' }, h('b', {}, c.name.split(' ')[0])), h('div', { class: 'small dim' }, MOOD_TEXT[moodOf(c)]))))),
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
      h('button', { onclick: (e) => copy(e.target) }, 'Copiar diseño (JSON)'),
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
