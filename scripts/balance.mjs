// Simula muchas partidas por destino y dificultad: jugando con cuidado vs. a ciegas.
// Uso: node scripts/balance.mjs [partidas]
import { createMission } from '../src/core/mission.js';
import { runUntilInterrupt } from '../src/core/sim.js';
import { resolveEvent, recommendedOption } from '../src/core/events.js';
import { resolvePhase } from '../src/core/mars.js';
import { candidatesFor } from '../src/core/interview.js';
import { buildReport } from '../src/core/report.js';
import { restoreRng } from '../src/core/rng.js';
import { EVENTS } from '../src/data/events.js';

const N = Number(process.argv[2] ?? 30);
const mod = (type, x, y) => ({ id: `${type}-${x}-${y}`, type, x, y });
const DESIGNS = {
  estacion: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('paneles', 2, 0), mod('paneles', 3, 0), mod('baterias', 0, 1), mod('laboratorio', 1, 1), mod('antena', 2, 1), mod('refugio', 3, 1)],
    instruments: ['camara_tierra', 'espectrometro'], launcher: 'condorH', orbit: 'leo_estacion', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 90 },
  luna: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('paneles', 3, 0), mod('paneles', 4, 0), mod('pila_regenerativa', 0, 1), mod('reactor', 1, 1), mod('laboratorio', 2, 1), mod('bodega', 3, 1), mod('extractor_hielo', 4, 1), mod('rover_autonomo', 5, 1), mod('antena', 0, 2)],
    instruments: ['sismometro', 'georradar'], launcher: 'titan', orbit: 'luna_polo', crewRoles: ['comandante', 'ingeniero', 'medico', 'cientifico'], cargoDays: 150 },
  marte: { modules: [mod('cabina', 0, 0), mod('soporte_vital', 1, 0), mod('modulo_aterrizaje', 2, 0), mod('planta_combustible', 3, 0), mod('paneles', 4, 0), mod('paneles', 5, 0), mod('reactor', 0, 1), mod('pila_regenerativa', 1, 1), mod('laboratorio', 2, 1), mod('invernadero', 3, 1), mod('bodega', 4, 1), mod('bodega', 5, 1), mod('refugio', 0, 2), mod('enfermeria', 1, 2), mod('bodega', 2, 2), mod('antena', 3, 2)],
    instruments: ['buscador_vida', 'analizador_rocas'], launcher: 'titan', orbit: 'marte_jezero', crewRoles: ['comandante', 'piloto', 'ingeniero', 'medico'], cargoDays: 240 },
};

function play(scn, dif, seed, careful) {
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
  for (let i = 0; i < 4000 && s.phase === 'ops'; i++) {
    const r = runUntilInterrupt(s, 900);
    s = r.state;
    if (r.interrupt?.kind === 'fase') { s = resolvePhase(s, r.interrupt.data.phase).state; continue; }
    if (s.pending) {
      const rng = restoreRng(s.rng);
      const visibles = EVENTS[s.pending.eventId].options.filter((o) => !o.hidden);
      const opt = careful ? recommendedOption(s.pending.eventId, s) : visibles[Math.floor(rng.next() * visibles.length)].id;
      s = { ...resolveEvent(s, s.pending.eventId, s.pending.severity, opt, rng).state, rng: rng.state() };
    }
    s.minis = s.minis.map((m) => (m.status === 'oferta' ? { ...m, status: 'vencida' } : m));
    if (careful) {
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

for (const scn of Object.keys(DESIGNS)) {
  for (const dif of ['facil', 'medio', 'dificil']) {
    for (const careful of [true, false]) {
      const res = Array.from({ length: N }, (_, i) => play(scn, dif, 1000 + i, careful));
      const ok = res.filter((r) => r.ok).length;
      const avgDay = Math.round(res.reduce((t, r) => t + r.day, 0) / N);
      const sci = Math.round(res.filter((r) => r.ok).reduce((t, r) => t + r.science, 0) / Math.max(1, ok));
      const reasons = {};
      for (const r of res.filter((x) => !x.ok)) reasons[r.reason.slice(0, 45)] = (reasons[r.reason.slice(0, 45)] ?? 0) + 1;
      console.log(`${scn.padEnd(8)} ${dif.padEnd(7)} ${careful ? 'cuidado' : 'ciegas '}  éxito ${String(Math.round((ok / N) * 100)).padStart(3)} %  día medio ${String(avgDay).padStart(3)}  ciencia ${sci}  ${JSON.stringify(reasons)}`);
    }
  }
}
