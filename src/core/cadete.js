// CENTRO DE CADETES: rango, ficha, reto diario, récords por destino, código para el maestro y datos reales.
// Lógica pura (sin DOM): se prueba con node --test.

/** Rangos del cadete según sus puntos de entrenamiento. */
export const RANKS = [
  { id: 'cadete', name: 'Cadete', icon: '▫️', min: 0 },
  { id: 'especialista', name: 'Especialista', icon: '◆', min: 12 },
  { id: 'piloto', name: 'Piloto', icon: '✈', min: 26 },
  { id: 'comandante', name: 'Comandante', icon: '★', min: 42 },
];

/**
 * Puntos del cadete: 1 por estrella de la academia, 3 por misión cumplida (máx. 4 destinos × 2),
 * 1 por logro, 4 si tiene las alas y 1 cada 1500 puntos de récord en el Arcade (hasta 10).
 */
export function cadetPoints({ stars = {}, missions = {}, achievements = 0, wings = false, arcade = 0 } = {}) {
  const st = Object.values(stars).reduce((a, b) => a + (Number(b) || 0), 0);
  const ms = Object.values(missions).reduce((a, b) => a + Math.min(2, Number(b) || 0), 0) * 3;
  return st + ms + (Number(achievements) || 0) + (wings ? 4 : 0) + Math.min(10, Math.floor((Number(arcade) || 0) / 1500));
}

/** Rango actual, el siguiente y cuánto falta. */
export function rankOf(points) {
  let i = 0;
  RANKS.forEach((r, k) => { if (points >= r.min) i = k; });
  const next = RANKS[i + 1] ?? null;
  return { ...RANKS[i], index: i, next, toNext: next ? next.min - points : 0, frac: next ? (points - RANKS[i].min) / (next.min - RANKS[i].min) : 1 };
}

// ---------- Reto diario: la misma misión para todos el mismo día ----------
export function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const OBJ = ['ciencia', 'tripulacion', 'economica'];
/** Fecha local AAAA-MM-DD. */
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Destino, dificultad, objetivo y semilla del reto del día. */
export function dailyChallenge(date = todayKey(), playable = ['estacion', 'gateway', 'luna', 'marte']) {
  const h = hashStr(`lifeline-${date}`);
  const dayN = Math.floor(Date.UTC(...date.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) / 86400000);
  return {
    date,
    scenario: playable[dayN % playable.length],
    difficulty: ['facil', 'medio', 'medio', 'dificil'][h % 4],
    objective: OBJ[(h >>> 3) % OBJ.length],
    seed: h % 1000000007,
  };
}

// ---------- Récords por destino ----------
export function addDestRecord(all, scenario, entry, max = 5) {
  const list = [...(all?.[scenario] ?? []), entry].sort((a, b) => b.score - a.score).slice(0, max);
  return { ...(all ?? {}), [scenario]: list };
}

// ---------- Código del alumno para el modo maestro ----------
const b64e = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8'); };

export function encodeCadet({ name, points, stars, missions, wings }) {
  return `CAD1-${b64e(JSON.stringify({ n: String(name ?? '').slice(0, 24), p: points | 0, s: stars ?? {}, m: missions ?? {}, w: !!wings }))}`;
}
export function decodeCadet(code) {
  try {
    const t = String(code).trim();
    if (!t.startsWith('CAD1-')) return null;
    const o = JSON.parse(b64d(t.slice(5)));
    if (typeof o !== 'object' || !o) return null;
    return { name: String(o.n ?? '?'), points: Number(o.p) || 0, stars: o.s ?? {}, missions: o.m ?? {}, wings: !!o.w };
  } catch { return null; }
}

// ---------- Retraso real de la señal Tierra-Marte según la fecha ----------
const J2000 = Date.UTC(2000, 0, 1, 12);
/** Distancia Tierra-Marte (UA) con órbitas circulares (error de ~10 %, suficiente para enseñar). */
export function marsDistanceAU(date = new Date()) {
  const d = (date.getTime() - J2000) / 86400000;
  const rad = Math.PI / 180;
  const le = (100.46 + 360 * d / 365.256) * rad, lm = (355.45 + 360 * d / 686.98) * rad;
  const ae = 1, am = 1.5237;
  return Math.sqrt(ae * ae + am * am - 2 * ae * am * Math.cos(le - lm));
}
/** Minutos que tarda la luz (y la radio) en llegar a Marte. */
export const marsDelayMin = (date = new Date()) => (marsDistanceAU(date) * 499.005) / 60;

// ---------- Comparar con misiones reales ----------
export const REAL_MISSIONS = {
  estacion: { name: 'Frank Rubio, Expedición 68-69 (2022-23)', days: 371, note: 'récord de un astronauta de NASA en un solo vuelo' },
  gateway: { name: 'Artemis I (2022)', days: 25, note: 'la cápsula Orion viajó sin tripulación alrededor de la Luna' },
  luna: { name: 'Apolo 17 (1972)', days: 3, note: 'la estadía más larga en la Luna: 75 horas' },
  marte: { name: 'CHAPEA (2023-24)', days: 378, note: 'simulacro de Marte en Houston: 4 voluntarios vivieron 378 días encerrados' },
};
export function compareReal(scenario, daysSurvived) {
  const r = REAL_MISSIONS[scenario];
  if (!r) return null;
  const ratio = daysSurvived / r.days;
  return { ...r, ratio, text: ratio >= 1 ? `Aguantaron ${daysSurvived} días: ${ratio >= 2 ? `${ratio.toFixed(1)} veces` : 'más que'} ${r.name} (${r.days} días, ${r.note}).` : `Aguantaron ${daysSurvived} días; ${r.name} duró ${r.days} (${r.note}).` };
}
