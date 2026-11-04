// Regenera src/data/donki-snapshot.js desde la API DONKI (fulguraciones M5+ y X de 2024).
import { writeFileSync } from 'node:fs';

const url = 'https://api.nasa.gov/DONKI/FLR?startDate=2024-01-01&endDate=2024-12-31&api_key=DEMO_KEY';
const res = await fetch(url);
if (!res.ok) throw new Error(`DONKI respondió ${res.status}`);
const datos = await res.json();
const lista = datos
  .filter((f) => f.classType && f.beginTime && (f.classType[0] === 'X' || (f.classType[0] === 'M' && parseFloat(f.classType.slice(1)) >= 5)))
  .map((f) => ({ date: f.beginTime.slice(0, 10), cls: f.classType }))
  .sort((a, b) => a.date.localeCompare(b.date));
const cabecera = '// Fulguraciones clase X de 2024 recopiladas de registros públicos (NASA DONKI / NOAA SWPC). Regenerar con `node scripts/actualizar-donki.mjs` cuando la API responda.\n';
const cuerpo = lista.map((f) => `  { date: '${f.date}', cls: '${f.cls}' },`).join('\n');
const destino = new URL('../src/data/donki-snapshot.js', import.meta.url);
writeFileSync(destino, `${cabecera}export const DONKI_2024 = [\n${cuerpo}\n];\n`);
console.log(`${lista.length} fulguraciones escritas`);
