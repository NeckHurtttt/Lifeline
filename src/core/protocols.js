// Protocolos de vuelo inspirados en los procedimientos públicos de NASA para la estación espacial.
// Todo es determinista: se puede saber antes si una EVA tiene GO o NO GO.

export const MEDS_SHELF_DAYS = 180; // las medicinas a bordo caducan; llegan frescas con la carga
export const MEDS_EXPIRE_FRACTION = 0.4;
export const EXERCISE_RULE = { perWeekMissing: 3, reputation: -2 }; // 2 h de ejercicio diario obligatorio
export const CONTINGENCY_DAYS = 30; // reserva de contingencia por encima de la primera carga
export const TRESERVE_SECONDS = { facil: 90, medio: 60, dificil: 40 }; // tiempo de reserva en una despresurización

/** Fin de semana a bordo: días más ligeros (sábado y domingo de cada semana de misión). */
export const isWeekend = (day) => day > 0 && (day % 7 === 6 || day % 7 === 0);

const prevTurn = (turn) => (turn + 2) % 3;

/**
 * Sondeo Go/No-Go de una EVA en un turno. Reglas: nunca se sale solo, pre-respiración de O₂ en el turno anterior,
 * tripulantes descansados y sanos, y ninguna tormenta solar en camino.
 * @returns {{crew:object[], go:boolean, items:{id:string,label:string,ok:boolean}[]}}
 */
export function evaGoNoGo(state, turn) {
  const busy = new Set((state.minis ?? []).filter((m) => m.status === 'activa').flatMap((m) => m.crewIds ?? []));
  for (const id of state.expedition?.crewIds ?? []) busy.add(id);
  const crew = state.crew.filter((c) => c.alive && !c.evacuated && !busy.has(c.id) && state.schedule[c.id]?.[turn] === 'eva');
  if (!crew.length) return { crew, go: false, items: [] };
  const storm = (state.alerts ?? []).some((a) => a.eventId === 'tormenta_solar' && a.etaDays <= 1);
  const items = [
    { id: 'pareja', label: '👥 En pareja: nunca se sale solo', ok: crew.length >= 2 },
    { id: 'prerespiracion', label: '🫁 Pre-respiración de O₂ puro en el turno anterior', ok: crew.every((c) => state.schedule[c.id]?.[prevTurn(turn)] === 'prerespiracion') },
    { id: 'salud', label: '💪 Descansados y sanos', ok: crew.every((c) => c.fatigue < 70 && c.health >= 50) },
    { id: 'clima', label: '🌞 Sin tormenta solar en camino', ok: !storm },
  ];
  return { crew, go: items.every((i) => i.ok), items };
}

/** Go/No-Go para una minimisión con salida al exterior. Devuelve el motivo del NO GO o null. */
export function miniEvaNoGo(state, crew) {
  if (crew.length < 2) return 'nunca se sale solo: hacen falta 2';
  const bad = crew.find((c) => c.fatigue >= 70 || c.health < 50);
  if (bad) return `${bad.name.split(' ')[0]} está muy cansado o enfermo`;
  if ((state.alerts ?? []).some((a) => a.eventId === 'tormenta_solar' && a.etaDays <= 1)) return 'viene una tormenta solar';
  return null;
}

/** Caducidad de medicinas. Muta `s` (ya clonado). */
export function expireMeds(s, log) {
  s.medsExpiry ??= MEDS_SHELF_DAYS;
  if (s.day < s.medsExpiry) return;
  const lost = Math.round(s.resources.meds * MEDS_EXPIRE_FRACTION);
  s.resources.meds -= lost;
  s.medsExpiry = s.day + MEDS_SHELF_DAYS;
  if (lost > 0) log.push(`Caducaron ${lost} medicinas del botiquín. Las nuevas llegan con la carga.`);
}

/** Regla de ejercicio: cada semana Control de Misión revisa que todos hayan entrenado. Muta `s`. */
export function exerciseRule(s, exercised, log) {
  s.flags ??= {};
  s.flags.skipped ??= {};
  for (const c of s.crew) if (c.alive && !c.evacuated && !exercised.has(c.id)) s.flags.skipped[c.id] = (s.flags.skipped[c.id] ?? 0) + 1;
  if (s.day % 7 !== 0) return;
  const faltan = s.crew.filter((c) => (s.flags.skipped[c.id] ?? 0) >= EXERCISE_RULE.perWeekMissing);
  if (faltan.length) {
    s.reputation = Math.max(0, s.reputation + EXERCISE_RULE.reputation);
    log.push(`Control de Misión: ${faltan.map((c) => c.name.split(' ')[0]).join(', ')} no cumplió las 2 h de ejercicio diario (${EXERCISE_RULE.reputation} fama).`);
  }
  s.flags.skipped = {};
}
