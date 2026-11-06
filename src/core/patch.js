// Diferencias entre dos estados (para el cooperativo en línea): solo se manda lo que cambió y el anfitrión
// lo aplica sobre su estado actual, así dos personas pueden decidir cosas distintas a la vez sin pisarse.
const isObj = (v) => v !== null && typeof v === 'object';

/** Lista de cambios [ruta, valor] para pasar de `a` a `b`. Las listas de distinto largo se reemplazan enteras. */
export function diff(a, b, path = [], out = []) {
  if (Object.is(a, b)) return out;
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length)) {
    out.push([path, b === undefined ? null : b]);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in b)) out.push([[...path, k], undefined]);
    else diff(a[k], b[k], [...path, k], out);
  }
  return out;
}

/** Aplica los cambios sobre una copia de `base`. */
export function patch(base, changes) {
  let root = structuredClone(base);
  for (const [path, value] of changes) {
    if (!path.length) { root = structuredClone(value); continue; }
    let o = root;
    for (let i = 0; i < path.length - 1; i++) {
      if (!isObj(o[path[i]])) o[path[i]] = typeof path[i + 1] === 'number' || /^\d+$/.test(path[i + 1]) ? [] : {};
      o = o[path[i]];
    }
    const k = path[path.length - 1];
    if (value === undefined) { if (Array.isArray(o)) o.splice(k, 1); else delete o[k]; } else o[k] = structuredClone(value);
  }
  return root;
}
