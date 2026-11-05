// Genera Jugar.html: el juego entero en un solo archivo que se abre con doble clic
// (sin servidor). Uso: node scripts/empaquetar.mjs   (usa esbuild vía npx)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = p => readFileSync(join(root, p), 'utf8');

const js = execFileSync('npx', ['-y', 'esbuild@0.28', 'src/ui/main.js', '--bundle', '--format=iife', '--minify', '--charset=utf8', '--target=es2020'],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });

const fuente = readFileSync(join(root, 'fonts/VT323-Regular.ttf')).toString('base64');
const css = leer('styles/console.css') + '\n' +
  leer('styles/terminal.css').replace('url("../fonts/VT323-Regular.ttf")', `url("data:font/ttf;base64,${fuente}")`);

let html = leer('index.html');
const reemplazar = (de, a) => { if (!html.includes(de)) throw new Error('No encontré: ' + de); html = html.replace(de, () => a); };
reemplazar('  <link rel="stylesheet" href="styles/console.css">\n  <link rel="stylesheet" href="styles/terminal.css">\n', `  <style>\n${css}\n  </style>\n`);
reemplazar('  <script type="module" src="src/ui/main.js"></script>', `  <script>\n${js.replace(/<\/script/gi, '<\\/script')}\n  </script>`);
html = html.replace('<head>', '<head>\n  <!-- Archivo generado por scripts/empaquetar.mjs. No editar a mano. -->');

writeFileSync(join(root, 'Jugar.html'), html);
console.log(`Jugar.html listo (${(html.length / 1024).toFixed(0)} KB)`);
