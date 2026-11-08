// Ayudas mínimas de DOM.
import { tr } from '../i18n/i18n.js';

// Estilo de consola: sin emojis. Algunos símbolos pasan a marcas de terminal; el resto se quita.
const MARKS = [[/✅|✔️?|☑️?/gu, '✓'], [/❌|✖️?|⛔|🚫/gu, '×'], [/▶️?|⏩|⏭️?/gu, '>'], [/⚠️?|❗|‼️?/gu, '!'], [/⭐|🌟/gu, '*'], [/❔|❓/gu, '?'], [/🔒/gu, '[bloq.]'], [/🔓/gu, ''], [/➜|👉/gu, '→']];
const EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|⃣|[\u{1F3FB}-\u{1F3FF}]|‍(?:\p{Extended_Pictographic}|\p{Regional_Indicator}))*️?/gu;
/** Texto "de consola": cambia símbolos por marcas y quita emojis. */
export function plain(text) {
  let t = String(text);
  for (const [re, rep] of MARKS) t = t.replace(re, rep);
  return t.replace(EMOJI, '').replace(/️/g, '').replace(/[ \t]{2,}/g, ' ');
}
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else if (k === 'placeholder') { el.__esPh = String(v); el.setAttribute(k, tr(String(v))); }
    else if (k === 'title') { el.__esTitle = String(v); el.__fmt = plain; el.setAttribute(k, plain(tr(String(v)))); }
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (kid instanceof Node) { el.append(kid); continue; }
    const node = document.createTextNode(plain(tr(String(kid))));
    node.__es = String(kid); node.__fmt = plain;
    el.append(node);
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

/** Barra de subpestanas. list: [{id, label, badge?, color?}] */
export function tabs(list, current, onPick) {
  return h('div', { class: 'tabs', role: 'tablist' }, ...list.map((t) => h('button', {
    class: `tab ${t.id === current ? 'on' : ''} ${t.color ?? ''}`, role: 'tab', 'data-tab': t.id, onclick: () => onPick(t.id),
  }, t.label, t.badge ? h('span', { class: `badge ${t.badgeClass ?? ''}` }, String(t.badge)) : null)));
}
