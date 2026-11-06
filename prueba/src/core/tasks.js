import { hasUpgrade } from './campaign.js';
import { MODULES, INSTRUMENTS, DIFFICULTY, ORBITS } from '../data/catalog.js';
import { ROLES } from '../data/crew.js';
import { crewScore } from './skill.js';
import { evaGoNoGo, isWeekend } from './protocols.js';
import { inBlackout } from './mars.js';

export const EVA_SAFE = 8;

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
  prerespiracion: { name: 'Pre-respiración (O₂ puro)', stat: null, needsModule: null },
  campamento: { name: 'Sueño en la esclusa', stat: null, needsModule: null },
};

const NO_FATIGUE = new Set(['descanso', 'sueño', 'refugio', 'campamento']);
const SLEEP = new Set(['sueño', 'campamento']);

/**
 * El jugador solo elige mañana y tarde; la noche y la pre-respiración se ponen solas.
 * - EVA en la mañana: esa noche duermen en la esclusa (campamento, como en la NASA) y eso cuenta como pre-respiración.
 * - EVA en la tarde: la mañana se usa para la pre-respiración.
 * @param {string[]} turns [mañana, tarde, noche]
 * @returns {string[]}
 */
export function normalizeSchedule(turns = []) {
  let [m = 'descanso', t = 'descanso'] = turns;
  if (t === 'eva') m = 'prerespiracion';
  else if (m === 'prerespiracion') m = 'descanso';
  if (SLEEP.has(m) && m !== 'sueño') m = 'descanso';
  if (t === 'prerespiracion' || t === 'campamento') t = 'descanso';
  return [m, t, m === 'eva' ? 'campamento' : 'sueño'];
}
const WORK = new Set(['mantenimiento', 'reparacion', 'experimentos', 'trabajo', 'cultivo', 'produccion']);
const EXTERNAL = new Set(['paneles', 'antena']);
const MAX_DATA = 500;
const clamp = (v) => Math.max(0, Math.min(100, v));

/** @returns {string[]} errores del horario */
export function validateSchedule(schedule) {
  return Object.entries(schedule)
    .filter(([, turns]) => !turns.some((t) => SLEEP.has(t)))
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
  for (const id of s.expedition?.crewIds ?? []) busy.add(id);
  const active = s.crew.filter((c) => c.alive && !busy.has(c.id));
  const on = (type) => s.modules.some((m) => m.type === type && m.on);
  const mult = DIFFICULTY[s.difficulty].repairMult;
  let expEff = 0;
  let commTurns = 0;
  for (const c of s.crew) if (s.schedule[c.id]) s.schedule[c.id] = normalizeSchedule(s.schedule[c.id]);
  const goNoGo = [0, 1, 2].map((turn) => evaGoNoGo(s, turn));
  const weekend = isWeekend(s.day);

  for (let turn = 0; turn < 3; turn++) {
    const g = goNoGo[turn];
    if (g.crew.length && !g.go) {
      const why = g.items.filter((i) => !i.ok).map((i) => i.label.replace(/^\S+\s/, '')).join('; ');
      log.push(`EVA cancelada (NO GO): ${why}.`);
    }
    for (const c of active) {
      if (!c.alive) continue;
      const t = s.schedule[c.id]?.[turn];
      if (!TASKS[t]) continue;
      const eff = efficiency(c, t);
      if (t === 'ejercicio') { exercised.add(c.id); c.fatigue = clamp(c.fatigue + 5); continue; }
      if (SLEEP.has(t)) { slept.add(c.id); continue; }
      if (t === 'refugio') { if (on('refugio')) sheltered.add(c.id); continue; }
      if (t === 'descanso') { c.fatigue = clamp(c.fatigue - 20); c.morale = clamp(c.morale + (weekend ? 8 : 5)); continue; }
      if (t === 'prerespiracion') { c.fatigue = clamp(c.fatigue + 5); continue; }
      if (t === 'eva' && !g.go) { c.fatigue = clamp(c.fatigue + 5); continue; }
      if (weekend && WORK.has(t)) c.morale = clamp(c.morale - 1);
      const need = TASKS[t].needsModule;
      if (need && !on(need)) { c.fatigue = clamp(c.fatigue + 10); continue; }
      c.fatigue = clamp(c.fatigue + 10);

      if (t === 'mantenimiento') {
        // Revisa toda la nave: frena el desgaste de cada módulo que aún funciona.
        for (const m of s.modules) if (m.health > 0 && m.health < 100) m.health = clamp(m.health + 0.6 * eff);
      } else if (t === 'reparacion') {
        const m = worst(s.modules.filter((x) => x.health < 100));
        if (m) {
          if (r.parts < 2) log.push('Faltan piezas para reparar');
          else {
            r.parts -= 2;
            const roto = m.health <= 0;
            m.health = clamp(m.health + 15 * (on('taller') ? MODULES.taller.repairMult : 1) * mult * eff);
            if (roto && m.health > 0) { m.on = true; log.push(`Reparado y encendido de nuevo: ${MODULES[m.type].name}`); }
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
          target.health = clamp(target.health + 15 * k * eff * (hasUpgrade(s, 'medicina_avanzada') ? 1.5 : 1));
          target.radiation = Math.max(0, target.radiation - 5 * k);
        }
      } else if (t === 'comunicacion') {
        commTurns++;
        c.morale = clamp(c.morale + (weekend ? 11 : 8));
        for (const o of s.crew) if (o.alive && o !== c) o.morale = clamp(o.morale + 3);
      } else if (t === 'eva') {
        const m = worst(s.modules.filter((x) => EXTERNAL.has(x.type) && x.health < 100));
        if (m) m.health = clamp(m.health + 30 * eff);
        c.radiation += 1;
        // Sin azar: con poca habilidad de traje, cansancio o torpeza hay percance.
        if (crewScore(s, c, 'eva').total < EVA_SAFE) {
          c.health = clamp(c.health - 20);
          log.push(`${c.name} sufrió un percance en la EVA`);
        }
      }
    }
  }

  if (expEff > 0 && on('laboratorio')) {
    const sci = s.crew.some((c) => c.alive && c.traits.includes('ojo_cientifico')) ? 1.2 : 1;
    const siteMult = ORBITS[s.design.orbit]?.scienceMult ?? 1;
    for (const id of s.design.instruments) {
      const ins = INSTRUMENTS[id];
      if (!ins) continue;
      r.dataStored += ins.dataPerDay;
      s.science += ins.sciencePerDay * Math.min(1, expEff) * sci * siteMult;
      if (ins.foodPerDay) r.food += ins.foodPerDay;
    }
  }

  const downlink = s.modules.filter((m) => m.on).reduce((t, m) => t + (MODULES[m.type].downlink ?? 0), 0) + 10 * commTurns + (s.flags?.extraDownlink ?? 0);
  const sent = inBlackout(s) ? 0 : Math.min(r.dataStored, downlink);
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
