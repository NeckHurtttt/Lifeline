// Autoguardado en una sola ranura. Sin cargar ranuras anteriores.
const KEY = 'vdl.save.ninos'; // versión niños: guardado aparte de la versión completa
const VERSION = 1;

const listeners = new Set();
/** Avisa cada vez que se guarda (lo usa el cooperativo en línea para compartir los cambios). */
export function onSave(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function save(state, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify({ v: VERSION, state }));
  // Un oyente que falla (p. ej. la conexión en línea rota) no debe frenar el juego.
  for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } }
}

export function load(storage = globalThis.localStorage) {
  const raw = storage?.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.v === VERSION && data.state && typeof data.state === 'object') return data.state;
  } catch { /* guardado corrupto */ }
  storage.removeItem(KEY);
  return null;
}

export function clearSave(storage = globalThis.localStorage) {
  storage.removeItem(KEY);
}
