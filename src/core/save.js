// Autoguardado en una sola ranura. Sin cargar ranuras anteriores.
const KEY = 'vdl.save';
const VERSION = 1;

export function save(state, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify({ v: VERSION, state }));
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
