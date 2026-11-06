// Realismo extra: polvo en los paneles de Marte, baterías que envejecen, racionamiento automático,
// plan de la nave de carga y huerto por etapas. Funciones que mutan un estado ya clonado (las llama sim.js)
// o puras (las acciones del jugador).
import { isMars } from './mars.js';
import { NEEDS } from './life.js';

// Polvo: los robots Spirit y Opportunity perdían ~0,2-0,3 % de energía por día por el polvo.
export const DUST_PER_DAY = 0.0025;
export const DUST_MAX = 0.7;
// Baterías de ion-litio: pierden capacidad con cada ciclo de carga (en órbita baja, 16 ciclos por día).
export const BATTERY_FADE = { estacion: 0.0002, luna: 0.0001, marte: 0.00012 };
export const BATTERY_PARTS = 8;
export const AUTO_RATION_DAYS = 15;

/** Qué trae la nave de carga según lo que pida el equipo. `food` multiplica comida y agua. */
export const CARGO_PLANS = {
  equilibrada: { icon: '⚖️', name: 'Equilibrada', desc: 'Comida, agua y 20 piezas.', food: 1, parts: 20, science: 0 },
  comida: { icon: '🍎', name: 'Más comida', desc: '30 % más comida y agua, solo 8 piezas.', food: 1.3, parts: 8, science: 0 },
  piezas: { icon: '🔧', name: 'Más piezas', desc: '40 piezas, pero 15 % menos comida y agua.', food: 0.85, parts: 40, science: 0 },
  ciencia: { icon: '🔬', name: 'Más ciencia', desc: 'Experimentos nuevos (+25 ciencia), 10 % menos comida y 12 piezas.', food: 0.9, parts: 12, science: 25 },
};

const alive = (s) => s.crew.filter((c) => c.alive && !c.evacuated);

export function dustTick(s) {
  if (!isMars(s) || s.leg !== 'superficie' || !s.modules.some((m) => m.type === 'paneles')) return;
  s.dust = Math.min(DUST_MAX, (s.dust ?? 0) + DUST_PER_DAY);
}
export const dustFactor = (s) => 1 - (s.dust ?? 0);

/** Salida al exterior para limpiar los paneles: 2 tripulantes en forma, una vez por día. */
export function cleanPanels(state, crewIds) {
  if (!state.dust || state.dust < 0.01) return { state, error: 'Los paneles están limpios.' };
  if (state.flags?.cleanedDay === state.day) return { state, error: 'Ya salieron a limpiar hoy.' };
  const team = crewIds.map((id) => state.crew.find((c) => c.id === id)).filter((c) => c?.alive && !c.evacuated && c.health >= 50 && c.fatigue < 70);
  if (team.length < 2) return { state, error: 'Hacen falta 2 tripulantes sanos y descansados (salida en pareja).' };
  const s = structuredClone(state);
  const lost = Math.round(s.dust * 100);
  s.dust = 0;
  s.flags ??= {};
  s.flags.cleanedDay = s.day;
  s.resources.o2 = Math.max(0, s.resources.o2 - 2);
  for (const c of s.crew) if (crewIds.includes(c.id)) { c.fatigue = Math.min(100, c.fatigue + 25); c.radiation += 1; }
  s.log.push({ day: s.day, text: `Salida al exterior: ${team.map((c) => c.name.split(' ')[0]).join(' y ')} limpiaron los paneles (recuperan ${lost} % de energía).`, kind: 'bueno' });
  return { state: s, error: null };
}

export function batteryTick(s) {
  const r = s.resources;
  if (!r.batteryMax) return;
  r.batteryBase ??= r.batteryMax;
  const fade = BATTERY_FADE[s.scenarioId] ?? 0.0002;
  r.batteryMax = Math.max(r.batteryBase * 0.5, r.batteryMax - r.batteryBase * fade);
  r.battery = Math.min(r.battery, r.batteryMax);
}
export const batteryHealth = (s) => (s.resources.batteryBase ? s.resources.batteryMax / s.resources.batteryBase : 1);

export function replaceBatteries(state) {
  if (batteryHealth(state) > 0.97) return { state, error: 'Las baterías están casi nuevas.' };
  if (state.resources.parts < BATTERY_PARTS) return { state, error: `Faltan piezas (hacen falta ${BATTERY_PARTS}).` };
  const s = structuredClone(state);
  s.resources.parts -= BATTERY_PARTS;
  s.resources.batteryMax = s.resources.batteryBase;
  s.log.push({ day: s.day, text: `Cambiaron las celdas de las baterías (−${BATTERY_PARTS} piezas): vuelven al 100 %.`, kind: 'bueno' });
  return { state: s, error: null };
}

/** Días que alcanzan comida y agua al ritmo normal. */
export function supplyDays(s) {
  const n = Math.max(1, alive(s).length);
  return { food: s.resources.food / (NEEDS.food * n), water: s.resources.water / (NEEDS.water * n) };
}

export function autoRationTick(s) {
  if (!s.autoRation) return [];
  const d = supplyDays(s);
  const want = Math.min(d.food, d.water) < AUTO_RATION_DAYS ? 'media' : 'completa';
  let changed = false;
  for (const c of alive(s)) if (s.rations[c.id] !== want) { s.rations[c.id] = want; changed = true; }
  if (!changed) return [];
  return [want === 'media' ? `Racionamiento automático: quedan menos de ${AUTO_RATION_DAYS} días; todos a media ración.` : 'Racionamiento automático: hay reserva de nuevo; ración completa.'];
}

export const GARDEN_HARVEST = 45;
export function gardenStage(g) {
  const p = g?.growth ?? 0;
  return p < 30 ? '🌰 Semillas' : p < 70 ? '🌱 Brotes' : '🥬 Casi lista';
}
/** Huerto: crece solo con luz (poco) y mucho más con alguien en 🌱 Cultivo. Al 100 % se cosecha. */
export function gardenTick(s) {
  const gh = s.modules.find((m) => m.type === 'invernadero' && m.on && m.health > 0);
  s.garden ??= { growth: 0, harvests: 0 };
  const care = s.garden.care ?? 0;
  s.garden.care = 0;
  if (!gh) return [];
  s.garden.growth += 1.5 * (gh.health / 100) + 2 * care;
  if (s.garden.growth < 100) return [];
  s.garden.growth = 0;
  s.garden.harvests += 1;
  s.resources.food += GARDEN_HARVEST;
  for (const c of alive(s)) c.morale = Math.min(100, c.morale + 5);
  return [`¡Cosecha en el invernadero! +${GARDEN_HARVEST} kg de comida fresca (y la tripulación está feliz).`];
}
