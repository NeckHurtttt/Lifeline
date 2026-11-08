// Simula muchas partidas por destino y dificultad: jugando con cuidado vs. a ciegas.
// Tres formas: con cuidado, con cuidado + reparación a mano y excavación ("experto"), y a ciegas.
// Uso: node scripts/balance.mjs [partidas] [destino]
import { createMission } from '../src/core/mission.js';
import { closeDoor, resolveFlash } from '../src/core/flash.js';
import { runUntilInterrupt, advanceDay, daysLeft } from '../src/core/sim.js';
import { repairPuzzle, applyFieldRepair, fieldRepairBlock } from '../src/core/repairs.js';
import { ensureTerrain, startOuting, endOuting, digBlock, canDigHere, T, DIG_COLS, DIG_ROWS, TILE_INFO } from '../src/core/dig.js';
import { resolveEvent, recommendedOption } from '../src/core/events.js';
import { resolvePhase } from '../src/core/mars.js';
import { candidatesFor } from '../src/core/interview.js';
import { buildReport } from '../src/core/report.js';
import { restoreRng } from '../src/core/rng.js';
import { EVENTS } from '../src/data/events.js';

const N = Number(process.argv[2] ?? 30);
const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const DESIGNS = {
  estacion: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1), mod('paneles', 4, 0)],
    instruments: ['camara_tierra', 'espectrometro'], launcher: 'condorH', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90 },
  gateway: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1)],
    instruments: ['dosimetro', 'espectrometro'], launcher: 'titan', orbit: 'nrho', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 210 },
  luna: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0), mod('pila_regenerativa', 0, 1), mod('reactor', 1, 1), mod('laboratorio', 2, 1), mod('bodega', 3, 1), mod('extractor_hielo', 4, 1), mod('rover_autonomo', 5, 1), mod('antena', 0, 2)],
    instruments: ['sismometro', 'georradar'], launcher: 'titan', orbit: 'luna_polo', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 150 },
  marte: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('planta_combustible', 3, 0), mod('paneles', 4, 0), mod('paneles', 5, 0), mod('reactor', 0, 1), mod('pila_regenerativa', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1), mod('refugio', 0, 2), mod('enfermeria', 1, 2), mod('bodega', 2, 2), mod('antena', 3, 2), mod('paneles', 4, 2)],
    instruments: ['buscador_vida', 'analizador_rocas'], launcher: 'titan', orbit: 'marte_jezero', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 240 },
};

const solve = (p) => (p.kind === 'ajuste' ? p.target : p.kind === 'plantas' ? p.sick : p.steps);
// Lo que haría un jugador experto en un día: 2 reparaciones a mano y, cada 3 días, una salida de excavación
// que saca los bloques más valiosos cerca de la esclusa (estimación generosa: sin perder tiempo caminando).
function expertDay(s) {
  for (let k = 0; k < 2; k++) {
    // como un jugador atento: primero lo vital (soporte vital, cabina, energía), después lo demás
    const VITAL = { soporte_vital: 0, cabina: 1, reactor: 2, paneles: 2, pila_regenerativa: 2, baterias: 2, planta_combustible: 3 };
    const m = s.modules.filter((x) => x.health < 70 && (x.type in VITAL || s.resources.parts > 20)).sort((a, b) => (VITAL[a.type] ?? 9) - (VITAL[b.type] ?? 9) || a.health - b.health)[0];
    if (!m || fieldRepairBlock(s, m.id)) break;
    s = applyFieldRepair(s, m.id, solve(repairPuzzle(s, m.id))).state;
  }
  if (canDigHere(s) && s.day % 3 === 0) {
    s = ensureTerrain(s);
    const crew = s.crew.filter((c) => c.alive && !c.evacuated && c.fatigue < 70 && c.health >= 50).slice(0, 2);
    if (!digBlock(s, crew)) {
      s = startOuting(s, crew.map((c) => c.id)).state;
      const o = s.dig.outing; let o2 = o.o2 - 10; // 10 de oxígeno para ir y volver
      const cells = [];
      for (let y = 0; y < DIG_ROWS; y++) for (let x = 2; x < 9; x++) { const t = s.dig.tiles[y * DIG_COLS + x]; if (TILE_INFO[t]?.bag) cells.push([t === T.HIELO ? 3 : t === T.METAL ? 2 : t === T.RARA ? 2 : 1, x, y, t]); }
      cells.sort((a, b) => b[0] - a[0]);
      for (const [, x, y, t] of cells) { const c = TILE_INFO[t].cost; if (o2 < c) break; o2 -= c; s.dig.tiles[y * DIG_COLS + x] = T.AIRE; o.bag[TILE_INFO[t].bag]++; }
      s = endOuting(s).state;
    }
  }
  return s;
}

function play(scn, dif, seed, careful, expert = false) {
  const design = structuredClone(DESIGNS[scn]);
  if (careful) {
    // contrata al mejor candidato en la habilidad principal del puesto
    design.hires = {};
    for (const ro of design.crewRoles) design.hires[ro] = candidatesFor(ro, seed).sort((a, b) => Math.max(...Object.values(b.stats)) - Math.max(...Object.values(a.stats)))[0];
  }
  let s = createMission({ design, scenarioId: scn, difficulty: dif, seed });
  s.phase = 'ops';
  if (careful) {
    const jobs = { comandante: 'mantenimiento', ingeniero: 'reparacion', medico: 'medico', cientifico: 'experimentos', piloto: 'mantenimiento' };
    for (const c of s.crew) s.schedule[c.id] = [jobs[c.role] ?? 'mantenimiento', 'ejercicio', 'sueño'];
    if (scn !== 'estacion' && s.modules.some((m) => m.type === 'invernadero')) s.schedule[s.crew.at(-1).id] = ['cultivo', 'ejercicio', 'sueño'];
  }
  for (let i = 0; i < (expert ? 20000 : 4000) && s.phase === 'ops'; i++) {
    const r = expert ? advanceDay(s) : runUntilInterrupt(s, 900);
    s = r.state;
    if (expert && s.phase === 'ops' && !s.pending) s = expertDay(s);
    if (r.interrupt?.kind === 'fase') { s = resolvePhase(s, r.interrupt.data.phase).state; continue; }
    if (s.flash) {
      // Un jugador atento cierra a tiempo casi siempre; uno al azar, la mitad de las veces.
      const hit = ((s.seed * 31 + s.day * 17) % 100) / 100 < (careful ? 0.85 : 0.5);
      if (hit) for (const d of s.flash.doors) s = closeDoor(s, d);
      s = resolveFlash(s).state;
      continue;
    }
    if (s.pending) {
      const rng = restoreRng(s.rng);
      const visibles = EVENTS[s.pending.eventId].options.filter((o) => !o.hidden);
      const opt = careful ? recommendedOption(s.pending.eventId, s) : visibles[Math.floor(rng.next() * visibles.length)].id;
      s = { ...resolveEvent(s, s.pending.eventId, s.pending.severity, opt, rng).state, rng: rng.state() };
    }
    s.minis = s.minis.map((m) => (m.status === 'oferta' ? { ...m, status: 'vencida' } : m));
    if (careful) {
      // como un jugador atento: si quedan menos de 15 días de comida o agua, media ración para todos
      const dl = daysLeft(s);
      const ration = Math.min(dl.food, dl.water) < 15 ? 'media' : 'completa';
      for (const c of s.crew) s.rations[c.id] = ration;
      // rutina: si alguien está muy cansado o enfermo, descansa o va al médico
      for (const c of s.crew.filter((x) => x.alive)) {
        if (c.fatigue >= 70) s.schedule[c.id] = ['descanso', 'ejercicio', 'sueño'];
        else if (c.role !== 'medico' && s.schedule[c.id][0] === 'descanso') s.schedule[c.id] = [{ comandante: 'mantenimiento', ingeniero: 'reparacion', cientifico: 'experimentos', piloto: 'mantenimiento' }[c.role] ?? 'mantenimiento', 'ejercicio', 'sueño'];
      }
    }
  }
  if (s.phase === 'reentry') s.outcome = { success: true, reason: 'ok' };
  const rep = buildReport({ ...s, outcome: s.outcome ?? { success: false, reason: '?' } });
  return { ok: s.phase === 'reentry', day: s.day, survivors: rep.survivors, science: rep.science, reason: s.outcome?.reason ?? '' };
}

for (const scn of Object.keys(DESIGNS).filter((x) => !process.argv[3] || x === process.argv[3])) {
  for (const dif of ['facil', 'medio', 'dificil']) {
    for (const [careful, expert] of [[true, true], [true, false], [false, false]]) {
      const res = Array.from({ length: N }, (_, i) => play(scn, dif, 1000 + i, careful, expert));
      const ok = res.filter((r) => r.ok).length;
      const avgDay = Math.round(res.reduce((t, r) => t + r.day, 0) / N);
      const sci = Math.round(res.filter((r) => r.ok).reduce((t, r) => t + r.science, 0) / Math.max(1, ok));
      const reasons = {};
      for (const r of res.filter((x) => !x.ok)) reasons[r.reason.slice(0, 45)] = (reasons[r.reason.slice(0, 45)] ?? 0) + 1;
      console.log(`${scn.padEnd(8)} ${dif.padEnd(7)} ${expert ? 'experto' : careful ? 'cuidado' : 'ciegas '}  éxito ${String(Math.round((ok / N) * 100)).padStart(3)} %  día medio ${String(avgDay).padStart(3)}  ciencia ${sci}  ${JSON.stringify(reasons)}`);
    }
  }
}
