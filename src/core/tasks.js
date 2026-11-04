import { MODULES, INSTRUMENTS, DIFFICULTY } from '../data/catalog.js';
import { ROLES } from '../data/crew.js';

const EXP = { name: 'Experimentos', stat: 'ciencia', needsModule: 'laboratorio' };
/** Labores disponibles: id -> {name, stat, needsModule|null}. */
export const TASKS = {
  mantenimiento: { name: 'Mantenimiento', stat: 'tecnica', needsModule: null },
  reparacion: { name: 'Reparación', stat: 'tecnica', needsModule: null },
  experimentos: EXP,
  trabajo: EXP,
  cultivo: { name: 'Cultivo', stat: 'ciencia', needsModule: 'invernadero' },
  produccion: { name: 'Producción de agua', stat: 'tecnica', needsModule: null },
  medico: { name: 'Atención médica', stat: 'medicina', needsModule: null },
  ejercicio: { name: 'Ejercicio', stat: null, needsModule: null },
  descanso: { name: 'Descanso', stat: null, needsModule: null },
  sueño: { name: 'Sueño', stat: null, needsModule: null },
  comunicacion: { name: 'Comunicación', stat: 'temple', needsModule: null },
  eva: { name: 'Actividad extravehicular', stat: 'eva', needsModule: null },
  refugio: { name: 'Refugio antirradiación', stat: null, needsModule: 'refugio' },
};

const NO_FATIGUE = new Set(['descanso', 'sueño', 'refugio']);
const EXTERNAL = new Set(['paneles', 'antena']);
const MAX_DATA = 500;
const clamp = (v) => Math.max(0, Math.min(100, v));

/** @returns {string[]} errores del horario */
export function validateSchedule(schedule) {
  return Object.entries(schedule)
    .filter(([, turns]) => !turns.includes('sueño'))
    .map(([id]) => `${id} no tiene turno de sueño`);
}

const statOf = (c, t) => (TASKS[t].stat === 'eva' ? (c.stats.fuerza + c.stats.temple) / 2 : c.stats[TASKS[t].stat]);
function efficiency(c, t) {
  const def = TASKS[t];
  if (!def.stat) return 1;
  const main = ROLES[c.role]?.mainStat;
  const mainOk = def.stat === 'eva' ? main === 'fuerza' || main === 'temple' : main === def.stat;
  return (statOf(c, t) / 7) * (mainOk ? 1 : 0.6);
}

/**
 * Aplica las labores de un día. Puro.
 * @param {object} state MissionState
 * @param {{chance:(p:number)=>boolean}} rng
 */
export function applyTasks(state, rng) {
  const s = structuredClone(state);
  const log = [];
  const r = s.resources;
  const exercised = new Set();
  const slept = new Set();
  const sheltered = new Set();
  const busy = new Set((s.minis ?? []).filter((m) => m.status === 'activa').flatMap((m) => m.crewIds ?? []));
  const active = s.crew.filter((c) => c.alive && !busy.has(c.id));
  const on = (type) => s.modules.some((m) => m.type === type && m.on);
  const mult = DIFFICULTY[s.difficulty].repairMult;
  let expEff = 0;
  let commTurns = 0;

  for (let turn = 0; turn < 3; turn++) {
    for (const c of active) {
      if (!c.alive) continue;
      const t = s.schedule[c.id]?.[turn];
      if (!TASKS[t]) continue;
      const eff = efficiency(c, t);
      if (t === 'ejercicio') { exercised.add(c.id); c.fatigue = clamp(c.fatigue + 5); continue; }
      if (t === 'sueño') { slept.add(c.id); continue; }
      if (t === 'refugio') { if (on('refugio')) sheltered.add(c.id); continue; }
      if (t === 'descanso') { c.fatigue = clamp(c.fatigue - 20); c.morale = clamp(c.morale + 5); continue; }
      const need = TASKS[t].needsModule;
      if (need && !on(need)) { c.fatigue = clamp(c.fatigue + 10); continue; }
      c.fatigue = clamp(c.fatigue + 10);

      if (t === 'mantenimiento') {
        const m = worst(s.modules.filter((x) => x.health < 100));
        if (m) m.health = clamp(m.health + 3 * eff);
      } else if (t === 'reparacion') {
        const m = worst(s.modules.filter((x) => x.health < 100));
        if (m) {
          if (r.parts < 2) log.push('Faltan piezas para reparar');
          else {
            r.parts -= 2;
            m.health = clamp(m.health + 15 * (on('taller') ? MODULES.taller.repairMult : 1) * mult * eff);
          }
        }
      } else if (t === 'experimentos' || t === 'trabajo') {
        expEff += eff;
      } else if (t === 'cultivo') {
        r.food += MODULES.invernadero.foodPerDay * eff;
      } else if (t === 'produccion') {
        r.water += 3 * eff;
      } else if (t === 'medico') {
        const target = worst(s.crew.filter((x) => x.alive && (x.health < 100 || x.radiation > 0)), 'health');
        if (target && r.meds >= 1) {
          r.meds -= 1;
          const k = on('enfermeria') ? MODULES.enfermeria.medicalMult : 1;
          target.health = clamp(target.health + 15 * k * eff);
          target.radiation = Math.max(0, target.radiation - 5 * k);
        }
      } else if (t === 'comunicacion') {
        commTurns++;
        c.morale = clamp(c.morale + 8);
        for (const o of s.crew) if (o.alive && o !== c) o.morale = clamp(o.morale + 3);
      } else if (t === 'eva') {
        const m = worst(s.modules.filter((x) => EXTERNAL.has(x.type) && x.health < 100));
        if (m) m.health = clamp(m.health + 30 * eff);
        c.radiation += 1;
        const p = 0.08 - 0.005 * statOf(c, t) + (c.traits.includes('torpe') ? 0.1 : 0);
        if (rng.chance(Math.max(0, p))) {
          c.health = clamp(c.health - 20);
          log.push(`${c.name} sufrió un percance en la EVA`);
        }
      }
    }
  }

  if (expEff > 0 && on('laboratorio')) {
    const sci = s.crew.some((c) => c.alive && c.traits.includes('ojo_cientifico')) ? 1.2 : 1;
    for (const id of s.design.instruments) {
      const ins = INSTRUMENTS[id];
      if (!ins) continue;
      r.dataStored += ins.dataPerDay;
      s.science += ins.sciencePerDay * Math.min(1, expEff) * sci;
      if (ins.foodPerDay) r.food += ins.foodPerDay;
    }
  }

  const downlink = s.modules.filter((m) => m.on).reduce((t, m) => t + (MODULES[m.type].downlink ?? 0), 0) + 10 * commTurns;
  const sent = Math.min(r.dataStored, downlink);
  r.dataStored -= sent;
  s.science += sent * 0.1;
  if (r.dataStored > MAX_DATA) {
    log.push(`Se perdieron ${(r.dataStored - MAX_DATA).toFixed(1)} GB de datos: falta enlace`);
    r.dataStored = MAX_DATA;
  }

  const living = s.crew.filter((c) => c.alive);
  const ctx = {
    exercised, slept,
    sheltered: living.length > 0 && living.every((c) => sheltered.has(c.id)),
    lifeSupportOn: on('soporte_vital'),
  };
  return { state: s, ctx, log };
}

function worst(list, key = 'health') {
  return list.reduce((a, b) => (a && a[key] <= b[key] ? a : b), null);
}
