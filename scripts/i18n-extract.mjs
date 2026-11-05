// Junta los textos visibles del juego (literales y plantillas) para traducirlos.
// Uso: node scripts/i18n-extract.mjs [--missing]  → imprime JSON {archivo: [textos]}
// Con --missing solo muestra los que aún no están en src/i18n/en.js.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
});

// Clases CSS: si un texto son solo clases, no es texto visible.
const css = readdirSync(join(ROOT, 'styles')).map((f) => readFileSync(join(ROOT, 'styles', f), 'utf8')).join('\n');
const classes = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

/** Convierte `${expr}` en {0}, {1}… */
export function toKey(raw) {
  let i = 0;
  let out = '';
  for (let p = 0; p < raw.length; p++) {
    if (raw[p] === '$' && raw[p + 1] === '{') {
      let depth = 1; p += 2;
      while (p < raw.length && depth) { if (raw[p] === '{') depth++; else if (raw[p] === '}') depth--; p++; }
      p--; out += `{${i++}}`;
    } else out += raw[p];
  }
  return out;
}

const isProse = (s) => {
  const t = s.replace(/\{\d+\}/g, ' ').trim();
  if (!/[a-záéíóúñ]{2,}/i.test(t)) return false;
  if (/^[\w./:-]+$/.test(t) && !/[áéíóúñ¿¡]/i.test(t) && !/^[A-ZÁÉÍÓÚ]/.test(t)) return false; // ids
  if (t.split(/\s+/).every((w) => classes.has(w) || /^\$|^\{/.test(w))) return false;
  if (/^(M|L|Q|C|q|l|h|v|m|a)[\d\s.,-]/.test(t)) return false; // trazos SVG
  if (/<\/?\w|=["']|^\.|^#|^\[data-|^https?:|\bvar\(|\bpx\b|^\d|^[a-z]+\/[a-z]+/.test(t)) return false;
  return true;
};

const out = {};
for (const f of files(join(ROOT, 'src')).filter((f) => !/i18n/.test(f))) {
  const src = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Set();
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const raw = m[1] ?? m[2];
    if (raw.includes('\n')) continue;
    const key = m[2] !== undefined ? toKey(raw) : raw.replace(/\\'/g, "'");
    if (isProse(key)) found.add(key);
  }
  if (found.size) out[f.slice(ROOT.length)] = [...found];
}

if (process.argv.includes('--missing')) {
  const { EN } = await import(join(ROOT, 'src/i18n/en.js'));
  for (const f of Object.keys(out)) { out[f] = out[f].filter((k) => !(k in EN)); if (!out[f].length) delete out[f]; }
}
console.log(JSON.stringify(out, null, 0));
