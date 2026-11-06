// Superficie: ciclo día/noche (Luna: 28 días; Marte: un sol) y qué piezas sirven en cada destino.
import { ORBITS, SCENARIOS } from '../data/catalog.js';

export const siteOf = (state) => ORBITS[state.design.orbit];
export const scenarioOf = (state) => SCENARIOS[state.scenarioId] ?? SCENARIOS.estacion;
export const availableIn = (def, scenarioId) => !def?.scenarios || def.scenarios.includes(scenarioId);

/** ¿Es de noche el día `day`? (el día 1 empieza al amanecer) */
export function isNight(site, day) {
  if (!site?.nightDays || !site.cycleDays) return false;
  const phase = (day - 1) % site.cycleDays;
  return phase >= site.cycleDays - site.nightDays;
}

/** Días que faltan para que empiece la noche (0 si ya es de noche; Infinity si no hay noche larga). */
export function daysToNight(site, day) {
  if (!site?.nightDays || !site.cycleDays) return Infinity;
  if (isNight(site, day)) return 0;
  const phase = (day - 1) % site.cycleDays;
  return site.cycleDays - site.nightDays - phase;
}

/** Días que faltan para que amanezca (0 si es de día). */
export function daysToDawn(site, day) {
  if (!isNight(site, day)) return 0;
  const phase = (day - 1) % site.cycleDays;
  return site.cycleDays - phase;
}

/** Multiplicadores del ambiente: pérdida de hueso (gravedad) y radiación (sin campo magnético, muros de regolito). */
export function envMults(state) {
  const sc = scenarioOf(state);
  let boneMult = sc.boneMult ?? 1;
  let radMult = sc.radiationMult ?? 1;
  const viaje = state.leg === 'ida' || state.leg === 'vuelta';
  if (viaje) { boneMult = 1; radMult = Math.max(radMult, 2); } // en el viaje no hay gravedad ni suelo que proteja
  if (state.flags?.regolithWall && !viaje) radMult *= 0.6;
  return { boneMult, radMult };
}
