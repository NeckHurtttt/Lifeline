// Código de misión: diseño + destino + dificultad + objetivo + semilla en un texto corto.
// Sirve para compartir un diseño, compararlo y para el modo reto: dos equipos juegan la misma misión
// (mismo clima espacial y mismos eventos de partida) y gana el mejor puntaje.
const PREFIX = 'VDL1-';
const DESIGN_KEYS = ['modules', 'instruments', 'launcher', 'orbit', 'crewRoles', 'cargoDays', 'crewSeed'];

const toB64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (code) => {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** @returns {string} */
export function encodeMission({ design, scenarioId, difficulty, objective, seed }) {
  const d = Object.fromEntries(DESIGN_KEYS.filter((k) => design[k] !== undefined).map((k) => [k, design[k]]));
  d.modules = (d.modules ?? []).map((m) => [m.type, m.x, m.y]);
  return PREFIX + toB64(JSON.stringify({ s: scenarioId, d: difficulty, o: objective, r: seed, n: d }));
}

/** @returns {{design:object, scenarioId:string, difficulty:string, objective:string, seed:number}|null} */
export function decodeMission(code) {
  try {
    const raw = String(code ?? '').trim();
    if (!raw.startsWith(PREFIX)) return null;
    const j = JSON.parse(fromB64(raw.slice(PREFIX.length)));
    if (!j?.n || !Array.isArray(j.n.modules)) return null;
    const design = { ...j.n, modules: j.n.modules.map(([type, x, y]) => ({ id: `${type}-${x}-${y}`, type, x, y })) };
    design.instruments ??= [];
    design.crewRoles ??= [];
    return { design, scenarioId: j.s, difficulty: j.d, objective: j.o, seed: j.r };
  } catch {
    return null;
  }
}
