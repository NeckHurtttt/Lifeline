// ARCADE: pruebas seguidas, cada vez más rápidas, con combos y 3 vidas. También la racha diaria y los desbloqueos por rango.
import { starsFrom } from './academy.js';

/** Pruebas que sirven en ráfaga (sin las de planear ni las de 2 personas). */
export const ARCADE_POOL = ['flotar', 'acople', 'brazo', 'luna', 'centrifuga', 'soldadura', 'cultivo', 'estrellas', 'eva', 'protocolo', 'radio', 'auxilios'];
export const LIVES = 3;

/** Segundos de una ronda: empieza en 16 s como mucho y se acorta 4 % por nivel (mínimo 8 s). */
export function roundSeconds(base, level) {
  return Math.max(8, Math.round(Math.min(base, 16) * Math.max(0.5, 1 - level * 0.04)));
}
/** Multiplicador del combo: ×1, ×1, ×1.5, ×1.5, ×2… hasta ×4. */
export const comboMult = (combo) => Math.min(4, 1 + Math.floor(Math.max(0, combo) / 2) * 0.5);

/** Resultado de una ronda: estrellas, si se pierde vida, puntos y el combo nuevo. */
export function scoreRound(score, { combo = 0, level = 0 } = {}) {
  const stars = starsFrom(score);
  const ok = stars >= 1;
  const newCombo = ok ? (stars >= 2 ? combo + 1 : combo) : 0;
  const mult = comboMult(newCombo);
  const points = ok ? Math.round((stars * 100 + level * 15) * mult) : 0;
  return { stars, ok, loseLife: !ok, combo: newCombo, mult, points };
}

/** Siguiente prueba al azar, distinta de la anterior. rnd: función 0-1. */
export function nextGame(rnd = Math.random, last = null, pool = ARCADE_POOL) {
  const opts = pool.filter((id) => id !== last);
  return opts[Math.floor(rnd() * opts.length) % opts.length];
}

// ---------- Racha diaria ----------
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
/** Actualiza la racha al jugar el día `today` (AAAA-MM-DD). */
export function updateStreak(prev, today) {
  const p = prev ?? { last: null, count: 0, best: 0 };
  if (p.last === today) return p;
  const count = p.last && dayNum(today) - dayNum(p.last) === 1 ? p.count + 1 : 1;
  return { last: today, count, best: Math.max(p.best ?? 0, count) };
}
/** Racha que se ve hoy: si no jugó ayer ni hoy, ya se cortó. */
export function liveStreak(prev, today) {
  if (!prev?.last) return 0;
  const gap = dayNum(today) - dayNum(prev.last);
  return gap <= 1 ? prev.count : 0;
}

// ---------- Desbloqueos por rango ----------
export const PHOSPHORS = [
  { id: 'verde', name: 'Fósforo verde', rank: 0 },
  { id: 'ambar', name: 'Fósforo ámbar', rank: 1 },
  { id: 'cian', name: 'Fósforo cian', rank: 2 },
  { id: 'blanco', name: 'Fósforo blanco (Comandante)', rank: 3 },
];
export const unlockedPhosphors = (rankIndex) => PHOSPHORS.filter((p) => p.rank <= rankIndex);
/** ¿Subió de rango desde la última vez que se mostró? */
export const rankedUp = (seenIndex, nowIndex) => nowIndex > (seenIndex ?? 0);
