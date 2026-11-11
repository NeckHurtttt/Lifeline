// Informe final: resultado, medalla, gráfico de recursos, causas, lecciones, rediseño y ranking local.
import { loadCampaign, saveCampaign, recordResult } from '../../core/campaign.js';
import { SCENARIOS } from '../../data/catalog.js';
import { h, mount, bar, fmt } from '../dom.js';
import { buildReport } from '../../core/report.js';
import { clearSave } from '../../core/save.js';
import { LESSONS } from '../../data/lessons.js';
import { MODULES, LAUNCHERS } from '../../data/catalog.js';
import { beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar, moodOf, MOOD_TEXT } from '../avatar.js';
import { OBJECTIVES, SCORE_PARTS } from '../../data/objectives.js';
import { encodeMission } from '../../core/share.js';
import { checkAchievements, ACHIEVEMENTS, addRecord, loadAchievements } from '../../core/achievements.js';
import { QUIZ } from '../../data/quiz.js';
import { modal } from '../dom.js';
import { NEEDS } from '../../core/life.js';
import { HISTORICA } from '../../data/historicas.js';
import { musicMood } from '../main.js';
import { kidStars, kidReason, kidTip } from '../../core/ninos.js';

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

/** Gráfico grande con un deslizador para ver los valores de cada día. */
function bigChart(history) {
  const out = h('div', { class: 'small', id: 'valores-dia' });
  const show = (i) => {
    const p = history[i];
    out.replaceChildren(h('b', {}, `Día ${p.day}: `), `O₂ ${Math.round(p.o2)} kg · agua ${Math.round(p.water)} L · comida ${Math.round(p.food)} kg · batería ${Math.round(p.battery)} kWh`);
  };
  const close = modal(h('div', {}, h('h2', {}, '📈 Recursos día a día'), chart(history, { big: true }),
    h('input', { type: 'range', min: 0, max: history.length - 1, value: history.length - 1, style: { width: '100%' }, oninput: (e) => show(Number(e.target.value)) }),
    out, h('button', { onclick: () => close() }, 'Cerrar')));
  show(history.length - 1);
}

export function chart(history, { big = false } = {}) {
  if (!history.length) return h('div', { class: 'small dim' }, 'Sin datos de días.');
  const W = 600; const H = big ? 300 : 160;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('style', `width:100%;height:${big ? 340 : 180}px;background:#020402;border:1px solid #1d3a1d;${big ? '' : 'cursor:zoom-in'}`);
  if (!big) svg.addEventListener('click', () => bigChart(history));
  const maxDay = Math.max(...history.map((p) => p.day), 1);
  for (const [k, , color, dash] of SERIES) {
    const max = Math.max(...history.map((p) => p[k]), 1);
    const pts = history.map((p) => `${(p.day / maxDay) * W},${H - 4 - (p[k] / max) * (H - 8)}`).join(' ');
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', '1.6'); if (dash) pl.setAttribute('stroke-dasharray', dash);
    svg.append(pl);
  }
  return h('div', {}, svg, h('div', { class: 'row small' }, ...SERIES.map(([, name, color]) => h('span', { style: { color } }, `■ ${name}`)),
    h('span', { class: 'dim' }, big ? '(cada línea, relativa a su máximo)' : '(cada línea, relativa a su máximo · toca el gráfico para agrandarlo)')));
}

/** 3 datos reales de esta partida para aprender. */
function learned(s, rep) {
  const n = s.crew.length; const d = Math.max(1, rep.daysSurvived);
  const facts = [];
  const sinReciclar = Math.round((3.5 + 0.95) * n * d); const conReciclar = Math.round(NEEDS.water * n * d);
  facts.push(`💧 Tu tripulación necesitó unos ${sinReciclar} L de agua, pero gracias al reciclaje solo se gastaron unos ${conReciclar} L. Sin reciclar, habría que mandar ${(sinReciclar / 1000).toFixed(1).replace(".", ",")} toneladas de agua.`);
  const maxRad = Math.round(Math.max(...s.crew.map((c) => c.radiation)));
  facts.push(`☢️ La dosis más alta fue ${maxRad} mSv. En la Tierra recibimos unos 3 mSv por año; en la Estación, unos 80 mSv en 6 meses.`);
  if (s.dust > 0.05 || (s.log ?? []).some((l) => /limpiaron los paneles/.test(l.text))) facts.push('🟤 En Marte el polvo tapa los paneles poco a poco, como les pasó a los robots Spirit y Opportunity.');
  else if (s.garden?.harvests) facts.push(`🥬 Cosecharon ${s.garden.harvests} vez/veces. En la Estación real ya se cultivaron lechugas, rábanos y chiles (experimento Veggie).`);
  else if (s.resources.batteryBase) facts.push(`🔋 Las baterías quedaron al ${Math.round((s.resources.batteryMax / s.resources.batteryBase) * 100)} %: cada carga y descarga las gasta un poco, igual que la de un celular.`);
  else facts.push(`🔬 Juntaron ${Math.round(rep.science)} de ciencia. En la Estación se hicieron más de 3000 experimentos.`);
  return facts.slice(0, 3);
}

function quizPanel(seed, campaign) {
  const pick = [...QUIZ].sort((a, b) => ((seed * 31 + QUIZ.indexOf(a) * 17) % 97) - ((seed * 31 + QUIZ.indexOf(b) * 17) % 97)).slice(0, 3);
  let right = 0; let answered = 0;
  const result = h('div', { class: 'small', id: 'quiz-resultado' });
  return h('div', { class: 'panel c-green', id: 'quiz' }, h('h2', {}, '❓ Mini quiz'),
    h('div', { class: 'small dim' }, campaign ? 'Cada respuesta correcta da +5 puntos de campaña.' : '¿Cuánto aprendiste? 3 preguntas.'),
    ...pick.map((q) => {
      const btns = q.a.map((txt, i) => h('button', { class: 'small', onclick: () => {
        if (btns.some((b) => b.disabled)) return;
        btns.forEach((b) => { b.disabled = true; });
        btns[q.ok].classList.add('ok');
        answered += 1;
        if (i === q.ok) { right += 1; beep(1100, 80); if (campaign) { const c = loadCampaign(); c.points += 5; saveCampaign(c); } } else { btns[i].classList.add('mal'); beep(300, 80); }
        if (answered === pick.length) result.textContent = `Resultado: ${right} de ${pick.length}${campaign && right ? ` (+${right * 5} puntos de campaña)` : ''}.`;
      } }, txt));
      return h('div', { class: 'quiz-q' }, h('div', {}, q.q), h('div', { class: 'row' }, ...btns));
    }), result);
}

/** Diario del comandante: una página para imprimir o guardar como PDF. */
function diary(s, rep) {
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana: permite ventanas emergentes para descargar el diario.'); return; }
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const keep = (s.log ?? []).filter((l) => ['evento', 'bueno', 'fin', 'aviso', 'mini'].includes(l.kind));
  const byDay = {};
  for (const l of keep) (byDay[l.day] ??= []).push(l.text);
  const sc = SCENARIOS[s.scenarioId];
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Diario del comandante</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111}h1{margin-bottom:0}.dim{color:#555}.d{margin:.6rem 0}.d b{display:inline-block;min-width:5rem}</style></head><body>
<h1>Diario del comandante</h1><p class="dim">${esc(sc?.name ?? '')} · ${esc(s.difficulty)} · ${rep.success ? 'Misión cumplida' : 'Misión fallida'} · puntaje ${rep.score}/1000</p>
<p>Tripulación: ${s.crew.map((c) => esc(c.name)).join(', ')}.</p>
${Object.entries(byDay).map(([d, ts]) => `<div class="d"><b>Día ${d}</b> ${ts.map(esc).join(' ')}</div>`).join('')}
<p><i>${esc(rep.reason)}</i></p><p class="dim">Ventana de Lanzamiento · NASA Space Apps 2026</p>
<script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

export function render(root, app, go) {
  const s = app.state;
  const rep = buildReport(s);
  clearSave();
  musicMood(rep.success ? 'victory' : 'danger');

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
  const nuevos = checkAchievements(s, rep);
  const got = loadAchievements();
  const records = app.reto ? addRecord(app.reto, { id, score: rep.score, players: app.players.map((p) => p.name).join(', '), date: new Date().toISOString().slice(0, 10) }) : null;
  const booms = (s.log ?? []).filter((l) => /La carga explota/.test(l.text)).length;
  const llegaron = (s.log ?? []).filter((l) => /^Carga a tiempo/.test(l.text)).length;
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
    app.kids ? (() => {
      const { stars, goals } = kidStars(s, rep);
      return h('div', { class: 'panel c-green kid-fin', id: 'estrellas', style: { textAlign: 'center' } },
        h('div', { class: 'estrellas' }, ...[0, 1, 2].map((i) => h('span', { class: i < stars ? 'llena' : 'vacia' }, '★'))),
        h('h2', {}, stars === 3 ? '¡PERFECTO!' : stars === 2 ? '¡MUY BIEN!' : stars === 1 ? '¡LO LOGRASTE!' : 'ESTA VEZ NO SALIÓ'),
        h('p', { style: { fontSize: '1.2rem' }, id: 'por-que' }, rep.success
          ? `Volvieron ${s.crew.filter((c) => c.alive).length} de ${s.crew.length} astronautas. Hicieron ${fmt(s.science)} descubrimientos.`
          : kidReason(rep)),
        h('ul', { class: 'metas', id: 'metas' }, ...goals.map((g) => h('li', { class: g.ok ? 'ok' : 'falta' }, h('span', { class: 'meta-estrella' }, g.ok ? '★' : '☆'), h('span', {}, g.text)))),
        h('p', { class: 'small', id: 'consejo' }, stars < 3 ? kidTip(rep, goals) : '¡Eres de Control de Misión de verdad!'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'big', id: 'otra-vez', onclick: () => go('title') }, '▶ JUGAR OTRA VEZ'),
          h('button', { id: 'ver-detalle', onclick: (e) => { document.body.classList.toggle('ver-detalle'); e.target.textContent = document.body.classList.contains('ver-detalle') ? 'OCULTAR DETALLES' : 'VER TODOS LOS DETALLES'; } }, 'VER TODOS LOS DETALLES')));
    })() : null,
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
            ['Dificultad', s.difficulty], ...(s.lostModules?.length ? [['Módulos perdidos', s.lostModules.map((l) => `${MODULES[l.type]?.name ?? l.type} (día ${l.day})`).join(', ')]] : []), ['Clima espacial', s.flareSource === 'donki' ? 'NASA DONKI en vivo' : 'registro DONKI 2024 (respaldo)']]
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
    h('div', { class: 'grid2' },
      h('div', { class: 'panel c-cyan', id: 'aprendiste' }, h('h2', {}, '💡 Lo que aprendiste hoy'),
        ...learned(s, rep).map((f) => h('p', { class: 'small' }, f)),
        s.historica ? h('p', { class: 'small amber' }, `📜 ${HISTORICA[s.historica]?.name}: ${HISTORICA[s.historica]?.story}`) : null),
      h('div', { class: 'panel c-blue', id: 'comparacion' }, h('h2', {}, '🛰️ Tu misión y la Estación real'),
        h('table', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Tu misión'), h('th', {}, 'Estación Espacial')),
          ...[['Tripulación', `${s.crew.length}`, '7 personas'],
            ['Duración', `${rep.daysSurvived} días`, '~180 días por tripulación (récord: 437 días, Valeri Polyakov en Mir)'],
            ['Reciclaje de agua', s.design.upgrades?.includes('reciclador_99') ? '98 %' : '93 %', '98 % (desde 2023)'],
            ['Radiación máxima', `${Math.round(Math.max(...s.crew.map((c) => c.radiation)))} mSv`, '~80 mSv en 6 meses'],
            ['Naves de carga', SCENARIOS[s.scenarioId]?.resupplyEvery ? `${llegaron} llegaron, ${booms} explotaron` : 'ninguna', '~6 por año; 3 fallaron entre 2014 y 2015']]
            .map(([k, a, b]) => h('tr', {}, h('td', { class: 'dim' }, k), h('td', {}, a), h('td', { class: 'small' }, b)))))),
    h('div', { class: 'grid2' },
      quizPanel(s.seed + s.day, s.mode === 'campana'),
      h('div', { class: 'panel c-amber', id: 'logros' }, h('h2', {}, '🏅 Logros'),
        nuevos.length ? h('div', { class: 'green' }, `¡Logros nuevos: ${nuevos.map((a) => `${a.icon} ${a.name}`).join(', ')}!`) : h('div', { class: 'small dim' }, 'Esta vez no hubo logros nuevos.'),
        h('div', {}, ...ACHIEVEMENTS.map((a) => h('span', { class: `logro ${got[a.id] ? '' : 'no'}`, title: `${a.desc}${got[a.id] ? ` (ganado el ${got[a.id]})` : ''}` }, `${a.icon} ${a.name}`))),
        h('div', { style: { marginTop: '.5rem' } }, h('button', { id: 'diario', onclick: () => diary(s, rep) }, '📄 Diario del comandante (imprimir o PDF)')))),
    records ? h('div', { class: 'panel c-violet', id: 'records' }, h('h2', {}, '🏁 Récords de este reto en esta compu'),
      h('table', {}, h('tr', {}, ...['#', 'Puntaje', 'Jugadores', 'Fecha'].map((t) => h('th', {}, t))),
        ...records.map((r, i) => h('tr', { class: r.id === id ? 'sel' : '' }, h('td', {}, i + 1), h('td', {}, r.score), h('td', { class: 'small' }, r.players), h('td', { class: 'small' }, r.date))))) : null,
    h('div', { class: 'panel c-pink', id: 'ranking' },
      h('h2', {}, '🏆 Mejores misiones en esta compu'),
      h('table', {},
        h('tr', {}, ...['#', 'Puntaje', 'Medalla', 'Días', 'Dif.', 'Jugadores', 'Diseño', 'Fecha'].map((t) => h('th', {}, t))),
        ...ranking.map((r, i) => h('tr', { class: r.id === id ? 'sel' : '' },
          h('td', {}, i + 1), h('td', {}, r.score), h('td', {}, r.medal ? MEDALS[r.medal] : (r.success ? '—' : '✖')), h('td', {}, r.days),
          h('td', {}, r.difficulty), h('td', { class: 'small' }, r.players), h('td', { class: 'small dim' }, r.design), h('td', { class: 'small' }, r.date))))),
  );
  if (s.jurado) {
    const secs = app.jurado ? Math.floor((Date.now() - app.jurado) / 1000) : 0;
    say(`🏛️ Paso 5 de 5 · Informe. Puntaje de 0 a 1000 según las 5 categorías del desafío, qué salió bien, qué cambiar y un quiz de lo aprendido. Recorrido en ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} min. ¡Gracias por jugar!`, { mood: 'feliz', target: '#causas' });
    return;
  }
  if (app.kids) {
    say(rep.success ? '¡Volvieron a casa! Mira tus estrellas. ¿Juegas otra vez para ganar más?' : 'Esta vez no salió. No pasa nada: toca JUGAR OTRA VEZ y elige lo RECOMENDADO.', { mood: rep.success ? 'feliz' : 'pensando', target: '#otra-vez', quiet: true });
    return;
  }
  say(rep.success
    ? `¡Misión cumplida! ${rep.medal ? `Ganaron ${MEDALS[rep.medal]}.` : ''} Mira abajo qué podrían mejorar para sacar más puntos.`
    : `Esta vez no se pudo. Mira "Qué pasó y qué cambiar" y prueba de nuevo con REDISEÑAR.`,
  { mood: rep.success ? 'feliz' : 'pensando', target: rep.success ? '#causas' : '#redisenar' });
}
