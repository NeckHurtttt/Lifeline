// Junta un JSON {"es": "en"} dentro de src/i18n/en.js (ordenado por inserción).
// Uso: node scripts/i18n-merge.mjs archivo.json
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../src/i18n/en.js', import.meta.url);
const { EN } = await import(path);
const add = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const all = { ...EN, ...add };
const body = Object.entries(all).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
const head = readFileSync(path, 'utf8').split('export const EN = {')[0];
writeFileSync(path, `${head}export const EN = {\n${body}\n};\n`);
console.log(`en.js: ${Object.keys(all).length} textos (+${Object.keys(add).length})`);
