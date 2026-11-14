// Guía animada de Control de Misión: habla, cambia de cara y señala con una flecha qué tocar.
import { speak, readAloud } from './fx.js';
import { tr } from '../i18n/i18n.js';
import { guideSvg } from './avatar.js';
import { plain } from './dom.js';

/** Nova habla como una persona de Control de Misión: sin emojis y sin tantos signos de exclamación. */
function natural(text) {
  return plain(text).replace(/¡([^!¡]*)!/g, (m, a) => `${a}.`).replace(/\.\.(?!\.)/g, '.').replace(/\.\s*\./g, '.').replace(/\s+([.,:;?])/g, '$1').trim();
}
import { beep } from './audio.js';

let box = null;
let arrow = null;
let typing = null;
let current = { text: '', target: null };
// En el teléfono Nova empieza recogida (solo la carita): se abre tocándola. Las alertas la abren sola.
let hidden = globalThis.matchMedia?.('(max-width: 600px)').matches ?? false;
let autoOpened = false;
let follow = null;

function ensure() {
  if (box) return;
  box = document.createElement('div');
  box.id = 'guia';
  box.innerHTML = `
    <div class="g-bubble"><div class="g-name">Nova · Control de Misión</div><div class="g-text"></div><div class="g-btns"></div></div>
    <button class="g-avatar" title="Mostrar u ocultar a Nova"></button>`;
  document.body.append(box);
  // Tocar el globo lo recoge al instante (para ver lo que hay detrás, como el monitor de la estación).
  box.querySelector('.g-bubble').addEventListener('click', (e) => { if (e.target.closest('button')) return; clearTimeout(restTimer); box.classList.add('resting'); });
  box.querySelector('.g-avatar').addEventListener('click', () => {
    // Si estaba recogida, tocar la carita la vuelve a mostrar en vez de esconderla.
    if (box.classList.contains('resting') && !hidden) { clearTimeout(restTimer); box.classList.remove('resting'); return; }
    hidden = !hidden;
    autoOpened = false;
    box.classList.toggle('closed', hidden);
    if (!hidden) point(current.target);
  });
  arrow = document.createElement('div');
  arrow.id = 'flecha';
  arrow.textContent = '▼';
  document.body.append(arrow);
  window.addEventListener('scroll', () => place(), { passive: true });
  window.addEventListener('resize', () => place());
}

function place() {
  if (!current.target || hidden) { arrow.style.display = 'none'; return; }
  const el = typeof current.target === 'string' ? document.querySelector(current.target) : current.target;
  if (!el || !el.isConnected || el.offsetParent === null) { arrow.style.display = 'none'; return; }
  const r = el.getBoundingClientRect();
  arrow.style.display = 'block';
  arrow.style.left = `${r.left + r.width / 2 - 18}px`;
  arrow.style.top = `${r.top - 46}px`;
}

function point(target) {
  document.querySelectorAll('.senalado').forEach((e) => e.classList.remove('senalado'));
  current.target = target;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el && !hidden) {
    el.classList.add('senalado');
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  place();
  clearInterval(follow);
  follow = setInterval(place, 400);
}

/**
 * Nova dice algo.
 * @param {string} text
 * @param {{mood?:'normal'|'feliz'|'alerta'|'pensando', target?:string|Element|null, buttons?:{label:string,onclick:Function}[], quiet?:boolean}} opts
 */
export function say(text, { mood = 'normal', target = null, buttons = [], quiet = false } = {}) {
  current.es = text;
  current.opts = { mood, target, buttons, quiet };
  text = natural(tr(text));
  ensure();
  const same = current.text === text;
  current.text = text;
  box.querySelector('.g-avatar').innerHTML = guideSvg(mood);
  // En el teléfono una alerta abre a Nova solo mientras dura; después vuelve a recogerse.
  const phone = globalThis.matchMedia?.('(max-width: 600px)').matches;
  if (phone && mood === 'alerta' && !quiet && hidden) { hidden = false; autoOpened = true; }
  else if (phone && autoOpened && mood !== 'alerta') { hidden = true; autoOpened = false; }
  box.className = `mood-${mood}${hidden ? ' closed' : ''}${hidden && !same ? ' nuevo' : ''}`;
  const btns = box.querySelector('.g-btns');
  btns.replaceChildren(...buttons.map((b) => {
    const el = document.createElement('button');
    el.textContent = plain(tr(b.label));
    el.addEventListener('click', b.onclick);
    return el;
  }));
  point(target);
  if (same) return;
  const out = box.querySelector('.g-text');
  clearInterval(typing);
  box.classList.add('talking');
  let i = 0;
  out.textContent = '';
  if (readAloud()) speak(text, { interrupt: true, rate: 0.95 });
  typing = setInterval(() => {
    i += 2;
    out.textContent = text.slice(0, i);
    if (!quiet && i % 8 === 0) beep(1700 + (i % 3) * 120, 6, 'square', 0.01); // tecleo de terminal
    if (i >= text.length) { clearInterval(typing); box.classList.remove('talking'); }
  }, 18);
  if (!quiet) beep(mood === 'alerta' ? 520 : 980, 40, 'sine', 0.03);
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  // Los consejos tranquilos se achican solos a los 9 s para no tapar la pantalla (pasar el mouse sobre Nova los muestra).
  clearTimeout(restTimer);
  box.classList.remove('resting');
  // Todo consejo sin botones se recoge (los tranquilos a los 9 s, los demás a los 14 s); las alertas se quedan.
  if (!buttons.length && mood !== 'alerta') restTimer = setTimeout(() => box.classList.add('resting'), quiet ? 4000 : 7000);
}
let restTimer = null;

export function hideGuide() {
  if (!box) return;
  current = { text: '', target: null };
  document.querySelectorAll('.senalado').forEach((e) => e.classList.remove('senalado'));
  arrow.style.display = 'none';
  clearInterval(follow);
}

/** Repite lo último que dijo Nova en el idioma actual (al cambiar ES/EN). */
export function relang() {
  if (!current.es) return;
  const { es, opts } = current;
  current.text = '';
  say(es, { ...opts, quiet: true });
}
