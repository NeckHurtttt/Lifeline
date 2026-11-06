// Idioma de la interfaz (ES/EN). La lógica del juego queda en español; la traducción se hace al mostrar
// el texto: frases exactas primero y, si no, plantillas con huecos {0}, {1}… (los huecos también se traducen).
import { EN } from './en.js';

const KEY = 'vdl.lang';
let lang = (() => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(KEY, lang); } catch { /* sin almacenamiento */ }
  document.documentElement.lang = lang;
}

const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/[{}]/g, (c) => `\\${c}`);
// Plantillas: las más largas (más específicas) primero.
const PATTERNS = Object.keys(EN).filter((k) => /\{\d+\}/.test(k))
  .sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map((k) => {
    const order = [...k.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    const re = new RegExp(`^${esc(k).replace(/\\\{\d+\\\}/g, '([\\s\\S]*?)')}$`, 'u');
    return { re, order, en: EN[k] };
  });

const cache = new Map();

/** Traduce un texto de la interfaz al idioma actual. */
export function tr(text, depth = 0) {
  if (lang === 'es' || typeof text !== 'string' || !text.trim()) return text;
  if (text in EN) return EN[text];
  if (cache.has(text)) return cache.get(text);
  let out = text;
  // Espacios o signos alrededor: se conservan.
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (m && (m[1] || m[3]) && m[2] in EN) out = m[1] + EN[m[2]] + m[3];
  else if (depth < 4) {
    for (const p of PATTERNS) {
      const r = text.match(p.re);
      if (!r) continue;
      const vals = [];
      p.order.forEach((n, i) => { vals[n] = tr(r[i + 1], depth + 1); });
      out = p.en.replace(/\{(\d+)\}/g, (_, n) => vals[n] ?? '');
      break;
    }
  }
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}

/** Vuelve a traducir lo que ya está en pantalla (al cambiar de idioma sin redibujar). */
export function retranslate(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.__es !== undefined) n.nodeValue = n.__fmt(tr(n.__es));
  for (const el of root.querySelectorAll('[title]')) if (el.__esTitle !== undefined) el.title = el.__fmt(tr(el.__esTitle));
  for (const el of root.querySelectorAll('[placeholder]')) if (el.__esPh !== undefined) el.placeholder = tr(el.__esPh);
}
