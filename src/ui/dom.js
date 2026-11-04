// Ayudas mínimas de DOM.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function bar(frac, { warn = 0.3, danger = 0.15, invert = false, mark = null } = {}) {
  const f = Math.max(0, Math.min(1, frac));
  const bad = invert ? f > 1 - danger : f < danger;
  const meh = invert ? f > 1 - warn : f < warn;
  const b = h('div', { class: `bar ${bad ? 'red' : meh ? 'amber' : ''}` }, h('i', { style: { width: `${f * 100}%` } }));
  if (mark !== null) b.append(h('span', { class: 'mark', style: { left: `${mark * 100}%` } }));
  return b;
}

export function modal(content, { grave = false } = {}) {
  const bg = h('div', { class: 'modal-bg' }, h('div', { class: `modal ${grave ? 'grave' : ''}` }, content));
  document.body.append(bg);
  return () => bg.remove();
}

export const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '∞');

/** Reemplaza el contenido de `root` ignorando hijos nulos. */
export function mount(root, ...kids) {
  root.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}
