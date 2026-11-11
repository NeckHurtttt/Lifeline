// Resolución técnica sin azar: una solución funciona si el equipo llega a la dificultad.
// Se puede calcular antes de decidir, para mostrar si va a funcionar y por qué.
import { hasUpgrade } from './campaign.js';

export const TOOL = { tecnica: 'taller', medicina: 'enfermeria', ciencia: 'laboratorio' };
export const BASE = 5;
const STAT_NAME = { fuerza: 'fuerza', tecnica: 'técnica', ciencia: 'ciencia', medicina: 'medicina', temple: 'calma', eva: 'traje espacial' };
const TOOL_NAME = { taller: 'taller', enfermeria: 'enfermería', laboratorio: 'laboratorio' };

const statOf = (c, stat) => (stat === 'eva' ? (c.stats.fuerza + c.stats.temple) / 2 : c.stats[stat] ?? 0);

/** Puntaje de un tripulante para una habilidad, con el detalle de cada parte. */
export function crewScore(state, c, stat, { prepared = false } = {}) {
  const parts = [{ label: `${STAT_NAME[stat] ?? stat} de ${c.name.split(' ')[0]}`, value: statOf(c, stat) }, { label: 'experiencia', value: BASE }];
  const tool = TOOL[stat];
  if (tool && state.modules.some((m) => m.type === tool && m.on && m.health > 0)) parts.push({ label: `herramientas del ${TOOL_NAME[tool]}`, value: 2 });
  if (prepared) parts.push({ label: 'se prepararon antes', value: 1 });
  if (stat === 'tecnica' && c.traits.includes('manos_firmes')) parts.push({ label: 'manos firmes', value: 2 });
  if (stat === 'eva' && c.traits.includes('torpe')) parts.push({ label: 'es torpe', value: -2 });
  if (stat === 'eva' && hasUpgrade(state, 'trajes_nuevos')) parts.push({ label: 'trajes nuevos', value: 1 });
  if (c.fatigue >= 70) parts.push({ label: 'muy cansado', value: -2 });
  if (c.health < 50) parts.push({ label: 'salud baja', value: -2 });
  if (c.morale < 30) parts.push({ label: 'ánimo bajo', value: -1 });
  return { total: parts.reduce((t, p) => t + p.value, 0), parts };
}

/**
 * ¿Funciona la solución? Elige al mejor de `crewIds` (o de toda la tripulación viva).
 * @returns {{ok:boolean, total:number, need:number, who:object|null, parts:{label:string,value:number}[], text:string}}
 */
export function skillCheck(state, check, crewIds = null, { prepared = false } = {}) {
  const pool = state.crew.filter((c) => c.alive && !c.evacuated && (!crewIds || crewIds.includes(c.id)));
  let best = null;
  for (const c of pool) {
    const sc = crewScore(state, c, check.stat, { prepared });
    if (!best || sc.total > best.total) best = { ...sc, who: c };
  }
  if (!best) return { ok: false, total: 0, need: check.dc, who: null, parts: [], text: 'No hay nadie para hacerlo' };
  const helpers = Math.min(2, pool.length - 1);
  if (crewIds && helpers > 0) { best.parts.push({ label: `ayuda del equipo (${helpers})`, value: helpers }); best.total += helpers; }
  const ok = best.total >= check.dc;
  const text = `${best.parts.map((p) => `${p.label} ${p.value >= 0 ? '+' : ''}${p.value}`).join(', ')} = ${best.total} (hace falta ${check.dc}): ${ok ? 'éxito' : 'fallo, no alcanza'}`;
  // Versión niños: sin cuentas, solo si salió bien.
  const kidText = ok ? `¡${best.who?.name?.split(' ')[0] ?? 'El equipo'} lo logró!` : 'esta vez no salió';
  return { ok, total: best.total, need: check.dc, who: best.who, parts: best.parts, text: state.kids ? kidText : text };
}
