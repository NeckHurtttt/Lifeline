// Tripulación y creación de la misión. Determinista dado `seed`.
import { hasUpgrade } from './campaign.js';
import { createRng } from './rng.js';
import { DIFFICULTY, MODULES, SCENARIOS } from '../data/catalog.js';
import { ROLES, STAT_RANGES, TRAITS, NAMES } from '../data/crew.js';
import { NEEDS } from './life.js';

/** @typedef {'facil'|'medio'|'dificil'} Difficulty */
/** @typedef {'leve'|'media'|'grave'} Severity */
/** @typedef {{id:string, type:string, x:number, y:number, health:number, on:boolean, priority:number}} PlacedModule */
/** @typedef {{modules:PlacedModule[], instruments:string[], launcher:string, orbit:string, crewRoles:string[], cargoDays:number}} Design */
/** @typedef {{fuerza:number, tecnica:number, ciencia:number, medicina:number, temple:number}} Stats */
/** @typedef {{id:string, name:string, role:string, stats:Stats, traits:string[], health:number, fatigue:number,
 *   morale:number, radiation:number, bone:number, hunger:number, thirst:number, alive:boolean, onEva:boolean}} Crew */
/** @typedef {{o2:number, water:number, food:number, meds:number, parts:number, fuel:number,
 *   battery:number, batteryMax:number, dataStored:number}} Resources */
/** @typedef {{eventId:string, etaDays:number, severity:Severity, prepared:string[]}} Alert */
/** @typedef {{seed:number, rng:number, day:number, totalDays:number, difficulty:Difficulty, scenarioId:string,
 *   phase:'design'|'launch'|'ops'|'reentry'|'report', design:Design, resources:Resources, modules:PlacedModule[],
 *   crew:Crew[], schedule:Object<string,string[]>, rations:Object<string,'completa'|'media'|'nada'>,
 *   alerts:Alert[], pending:Object|null, history:{day:number,o2:number,water:number,food:number,battery:number}[], minis:Object[], science:number, reputation:number,
 *   nextResupply:number, log:{day:number,text:string,kind:string}[], outcome:null|{success:boolean, reason:string}}} MissionState */

const STAT_KEYS = ['fuerza', 'tecnica', 'ciencia', 'medicina', 'temple'];
const DEFAULT_PRIORITY = { cabina: 10, soporte_vital: 9 };

/**
 * @param {string[]} roles
 * @param {ReturnType<typeof createRng>} rng
 * @returns {Crew[]}
 */
export function generateCrew(roles, rng) {
  const names = [...NAMES];
  const pos = Object.values(TRAITS).filter((t) => t.positive);
  const neg = Object.values(TRAITS).filter((t) => !t.positive);
  return roles.map((role, i) => {
    const name = names.splice(rng.int(0, names.length - 1), 1)[0];
    const main = ROLES[role].mainStat;
    const stats = {};
    for (const k of STAT_KEYS) {
      const [lo, hi] = k === main ? STAT_RANGES.main : STAT_RANGES.other;
      stats[k] = rng.int(lo, hi);
    }
    return {
      id: `c${i + 1}`, name, role, stats,
      traits: [rng.pick(pos).id, rng.pick(neg).id],
      health: 100, fatigue: 0, morale: 100, radiation: 0, bone: 100, hunger: 0, thirst: 0,
      alive: true, onEva: false,
    };
  });
}

/**
 * @param {{design:Design, scenarioId:string, difficulty:Difficulty, seed:number}} p
 * @returns {MissionState}
 */
/** Plazos cortos del modo demo (unos 10 minutos de juego). */
export const DEMO_DAYS = { estacion: 60, luna: 56, marte: { transit: 30, surface: 60 } };

/** Día "nunca" para la próxima carga (Marte). Número normal, no Infinity: Infinity se pierde al guardar y al mandarlo en línea. */
export const NO_RESUPPLY = 1e9;

export function createMission({ design, scenarioId, difficulty, seed, demo = false }) {
  const rng = createRng(seed);
  const crew = generateCrew(design.crewRoles, rng);
  // Los contratados en la entrevista reemplazan a los generados (mismo puesto).
  for (const c of crew) {
    const hire = design.hires?.[c.role];
    if (hire) Object.assign(c, { name: hire.name, stats: { ...hire.stats }, traits: [...hire.traits] });
  }
  const n = crew.length;
  const days = design.cargoDays;
  const mult = n * days * (1 + DIFFICULTY[difficulty].reserveBonus);
  const modules = design.modules.map((m) => ({
    ...m,
    health: m.health ?? 100,
    on: m.on ?? true,
    priority: m.priority ?? DEFAULT_PRIORITY[m.type] ?? 5,
  }));
  const batteryMax = modules.reduce((t, m) => t + (MODULES[m.type]?.batteryKwh ?? 0), 0);
  const sc = SCENARIOS[scenarioId] ?? SCENARIOS.estacion;
  const schedule = {};
  const rations = {};
  for (const c of crew) {
    schedule[c.id] = ['trabajo', 'ejercicio', 'sueño'];
    rations[c.id] = 'completa';
  }
  return {
    seed, rng: rng.state(), day: 0, difficulty, scenarioId,
    ...(demo && scenarioId === 'marte' ? { plan: DEMO_DAYS.marte, totalDays: DEMO_DAYS.marte.surface + 2 * DEMO_DAYS.marte.transit }
      : { totalDays: demo ? DEMO_DAYS[scenarioId] ?? 60 : sc.days + 2 * (sc.travelDays ?? 0) }),
    phase: 'launch', design, modules, crew, schedule, rations,
    resources: {
      // Tanques de O₂ solo para emergencias (~45 días): el aire de cada día sale del agua con el soporte vital.
      o2: NEEDS.o2 * n * Math.min(days, 45) * (1 + DIFFICULTY[difficulty].reserveBonus),
      water: NEEDS.water * mult * (sc.travelDays ? 1.15 : 1), // viaje largo sin cargas: 15 % de agua de reserva
      food: NEEDS.food * mult,
      meds: 20 * n, parts: 30 + (sc.travelDays ? 40 : 0) + (hasUpgrade(design, 'impresion_3d') ? 15 : 0), /* a Marte no llegan cargas: más repuestos */ fuel: 100,
      battery: batteryMax, batteryMax, dataStored: 0,
    },
    alerts: [], pending: null, history: [], minis: [], science: 0, reputation: 50,
    nextResupply: sc.resupplyEvery || NO_RESUPPLY, medsExpiry: 180, log: [], outcome: null,
  };
}
