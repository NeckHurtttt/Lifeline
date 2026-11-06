// Logros: se ganan al terminar una misión y quedan guardados en esta compu.
const KEY = 'vdl-logros';
const count = (s, re) => (s.log ?? []).filter((l) => re.test(l.text)).length;
const ok = (rep) => rep.success;

export const ACHIEVEMENTS = [
  { id: 'primera', icon: '🚀', name: 'Primera misión', desc: 'Terminar una misión con éxito.', test: (s, rep) => ok(rep) },
  { id: 'sin_muertes', icon: '🫶', name: 'Todos a casa', desc: 'Éxito sin perder a nadie.', test: (s, rep) => ok(rep) && s.crew.every((c) => c.alive || c.evacuated) },
  { id: 'oro', icon: '🥇', name: 'Medalla de oro', desc: 'Sacar medalla de oro.', test: (s, rep) => rep.medal === 'oro' },
  { id: 'ciencia_100', icon: '🔬', name: 'Ciencia al 100 %', desc: 'Llegar a 100 en valor científico.', test: (s, rep) => rep.breakdown?.parts?.some((p) => p.id === 'ciencia' && p.value >= 100) },
  { id: 'explosiones', icon: '💥', name: 'A prueba de explosiones', desc: 'Éxito después de perder 2 naves de carga.', test: (s, rep) => ok(rep) && count(s, /La carga explota/) >= 2 },
  { id: 'dificil', icon: '🔴', name: 'Modo difícil', desc: 'Éxito en difícil.', test: (s, rep) => ok(rep) && s.difficulty === 'dificil' },
  { id: 'luna', icon: '🌙', name: 'Un año en la Luna', desc: 'Éxito en la base lunar.', test: (s, rep) => ok(rep) && s.scenarioId === 'luna' },
  { id: 'gateway', icon: '🌘', name: 'Vecinos de la Luna', desc: 'Éxito en el Gateway.', test: (s, rep) => ok(rep) && s.scenarioId === 'gateway' },
  { id: 'marte', icon: '🔴', name: 'Ida y vuelta a Marte', desc: 'Éxito en Marte.', test: (s, rep) => ok(rep) && s.scenarioId === 'marte' },
  { id: 'huerto', icon: '🥬', name: 'Mano verde', desc: '3 cosechas en una misión.', test: (s) => (s.garden?.harvests ?? 0) >= 3 },
  { id: 'polvo', icon: '🧹', name: 'Limpiavidrios marciano', desc: 'Limpiar los paneles en Marte.', test: (s) => count(s, /limpiaron los paneles/) >= 1 },
  { id: 'historica', icon: '📜', name: 'Historia viva', desc: 'Superar una misión histórica.', test: (s, rep) => ok(rep) && !!s.historica },
  { id: 'sin_racion', icon: '🍽️', name: 'Buen planificador', desc: 'Éxito sin racionar nunca la comida.', test: (s, rep) => ok(rep) && count(s, /media ración|ración/i) === 0 && Object.values(s.rations ?? {}).every((r) => r === 'completa') },
];

export function loadAchievements(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(KEY)) ?? {}; } catch { return {}; }
}

/** Revisa la misión terminada; devuelve los logros nuevos y guarda. */
export function checkAchievements(state, report, storage = globalThis.localStorage) {
  const got = loadAchievements(storage);
  const fresh = ACHIEVEMENTS.filter((a) => !got[a.id] && a.test(state, report));
  const date = new Date().toISOString().slice(0, 10);
  for (const a of fresh) got[a.id] = date;
  try { storage.setItem(KEY, JSON.stringify(got)); } catch { /* sin espacio */ }
  return fresh;
}

// Récords de cada reto (código VDL1-): los 5 mejores puntajes en esta compu.
const REC_KEY = 'vdl-records';
export function loadRecords(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(REC_KEY)) ?? {}; } catch { return {}; }
}
/** Clave corta y estable de un código de reto. */
export function recordKey(code) {
  let h = 5381;
  for (const ch of code.trim()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `r${h.toString(36)}`;
}
export function addRecord(code, entry, storage = globalThis.localStorage) {
  const all = loadRecords(storage);
  const key = recordKey(code);
  const list = [...(all[key] ?? []).filter((r) => r.id !== entry.id), entry].sort((a, b) => b.score - a.score).slice(0, 5);
  all[key] = list;
  try { storage.setItem(REC_KEY, JSON.stringify(all)); } catch { /* sin espacio */ }
  return list;
}
