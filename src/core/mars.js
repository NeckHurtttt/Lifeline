// Marte: viaje de ida (7 meses), un año en la superficie y viaje de vuelta (7 meses).
// Inspirado en la arquitectura de referencia de NASA: carga enviada antes, combustible fabricado allá (ISRU),
// conjunción solar sin radio y retraso de comunicaciones.
import { SCENARIOS } from '../data/catalog.js';
import { skillCheck } from './skill.js';

export const TRANSIT_DAYS = SCENARIOS.marte.travelDays; // 210
export const SURFACE_DAYS = SCENARIOS.marte.days; // 365
export const LANDING_DAY = TRANSIT_DAYS;
export const ASCENT_DAY = TRANSIT_DAYS + SURFACE_DAYS; // 575
export const ASCENT_FUEL = 180; // combustible que necesita el vehículo de ascenso
export const EDL_FUEL = 30;
export const EDL_CHECK = { stat: 'fuerza', dc: 12 };
export const CONJUNCTION = { start: 400, end: 414, warn: 395 }; // ~2 semanas sin radio con la Tierra
export const TRANSIT_SUN = 0.7; // sol medio en el viaje (relativo a la Tierra)
import { NEEDS } from './life.js';

export const isMars = (s) => s.scenarioId === 'marte';

/** Plazos de la misión (el modo demo los acorta). */
export function planOf(s) {
  const p = s.plan ?? { transit: TRANSIT_DAYS, surface: SURFACE_DAYS };
  const landing = p.transit;
  const ascent = p.transit + p.surface;
  const start = Math.round(landing + p.surface * (CONJUNCTION.start - LANDING_DAY) / SURFACE_DAYS);
  const len = Math.max(3, Math.round((CONJUNCTION.end - CONJUNCTION.start) * p.surface / SURFACE_DAYS));
  return { ...p, landing, ascent, conj: { start, end: start + len, warn: start - Math.max(2, Math.round(5 * p.surface / SURFACE_DAYS)) } };
}

/** Tramo del viaje: 'ida' | 'superficie' | 'vuelta' (siempre 'superficie' fuera de Marte). */
export function legOf(s, day = s.day) {
  if (!isMars(s)) return 'superficie';
  const p = planOf(s);
  if (day <= p.landing && !s.flags?.landed) return 'ida';
  if (day <= p.ascent && !s.flags?.ascended) return 'superficie';
  return 'vuelta';
}

export const inTransit = (s) => ['ida', 'vuelta'].includes(s.leg);

/** Conjunción solar: el Sol queda entre la Tierra y Marte y no hay radio. */
export const inBlackout = (s, day = s.day) => isMars(s) && day >= planOf(s).conj.start && day <= planOf(s).conj.end;

/** Minutos que tarda la radio en ir de Marte a la Tierra (varía con la distancia: 4 a 24). */
export function radioDelayMin(s, day = s.day) {
  if (!isMars(s)) return 0;
  const k = (Math.cos(((day - planOf(s).conj.start) / 780) * 2 * Math.PI) + 1) / 2; // 1 cerca de la conjunción
  return Math.round(4 + 20 * k);
}

/** Factor de sol del día (polvo y viaje). */
export function marsSolarFactor(s, site) {
  if (!isMars(s)) return 1;
  if (inTransit(s)) return TRANSIT_SUN / (site?.solarFraction || 1);
  if (s.flags?.dustUntil && s.day <= s.flags.dustUntil) return 0.25;
  return 1;
}

/** Qué fase hay que resolver hoy, si hay alguna. */
export function phaseDue(s) {
  if (!isMars(s)) return null;
  const p = planOf(s);
  if (s.day >= p.landing && !s.flags?.landed) return 'edl';
  if (s.day >= p.ascent && s.flags?.landed && !s.flags?.ascended) return 'ascenso';
  return null;
}

export const PHASES = {
  edl: {
    title: 'Llegada a Marte: los "7 minutos de terror"',
    steps: ['Entrada a la atmósfera a 20 000 km/h', 'El escudo térmico llega a 1300 °C', 'Paracaídas supersónico', 'Se suelta el escudo', 'Motores de frenado', '¡Contacto con el suelo!'],
    desc: 'La radio tarda tanto que la Tierra no puede ayudar: la nave aterriza sola y el piloto corrige al final.',
  },
  ascenso: {
    title: 'Despegue desde Marte',
    steps: ['Revisión del combustible fabricado', 'Encendido del vehículo de ascenso', 'Encuentro con la nave de regreso en órbita', 'Encendido hacia la Tierra (TEI)'],
    desc: `Hacen falta ${ASCENT_FUEL} de combustible. La planta ISRU lo fabricó durante el año con el CO₂ del aire.`,
  },
};

/** Vista previa de una fase: ¿va a salir bien? */
export function previewPhase(s, phase) {
  if (phase === 'edl') return skillCheck(s, EDL_CHECK);
  if (phase === 'ascenso') {
    const ok = s.resources.fuel >= ASCENT_FUEL;
    return { ok, total: Math.floor(s.resources.fuel), need: ASCENT_FUEL, parts: [{ label: 'combustible', value: Math.floor(s.resources.fuel) }], text: ok ? 'hay combustible suficiente' : 'no alcanza el combustible' };
  }
  return null;
}

/** Resuelve la fase. Puro. */
export function resolvePhase(state, phase) {
  const s = structuredClone(state);
  s.flags ??= {};
  const log = [];
  const n = s.crew.filter((c) => c.alive && !c.evacuated).length;
  if (phase === 'edl') {
    const r = skillCheck(s, EDL_CHECK);
    s.resources.fuel = Math.max(0, s.resources.fuel - EDL_FUEL);
    if (r.ok) log.push(`¡Aterrizaje perfecto! ${r.who ? r.who.name.split(' ')[0] : 'El piloto'} corrigió al final (${r.text}).`);
    else {
      for (const m of s.modules) m.health = Math.max(5, m.health - 25);
      for (const c of s.crew) if (c.alive) c.health = Math.max(1, c.health - 10);
      log.push(`Aterrizaje duro, lejos del sitio: todos los módulos −25 y la tripulación −10 de salud (${r.text}).`);
    }
    // La carga enviada dos años antes espera en la superficie.
    const days = planOf(s).surface * 0.85;
    s.resources.food += NEEDS.food * n * days;
    s.resources.water += NEEDS.water * n * days;
    s.resources.o2 += NEEDS.o2 * n * days;
    s.resources.parts += 50; // repuestos para un año sin naves de carga
    s.resources.meds += 5 * n;
    s.medsExpiry = s.day + 180;
    log.push('La nave de carga enviada antes los espera: comida, agua y O₂ para casi todo el año, piezas y medicinas.');
    s.flags.landed = true;
    s.leg = 'superficie';
    return { state: s, log, ok: r.ok };
  }
  if (phase === 'ascenso') {
    if (s.resources.fuel < ASCENT_FUEL) {
      s.outcome = { success: false, reason: `No alcanzó el combustible para despegar de Marte (${Math.floor(s.resources.fuel)} de ${ASCENT_FUEL}): la tripulación espera un rescate` };
      for (const c of s.crew) if (c.alive) c.evacuated = true;
      s.phase = 'report';
      log.push(s.outcome.reason);
      return { state: s, log, ok: false };
    }
    s.resources.fuel -= ASCENT_FUEL;
    const days = planOf(s).transit * 1.1;
    s.resources.food += NEEDS.food * n * days;
    s.resources.water += NEEDS.water * n * days;
    s.resources.o2 += NEEDS.o2 * n * days;
    s.resources.parts += 15;
    log.push('¡Despegue desde Marte! La nave de regreso tiene comida para el viaje. Rumbo a casa: 7 meses.');
    s.flags.ascended = true;
    s.leg = 'vuelta';
    return { state: s, log, ok: true };
  }
  throw new Error(`Fase desconocida: ${phase}`);
}
