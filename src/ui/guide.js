// Guía animada de Control de Misión: habla, cambia de cara y señala con una flecha qué tocar.
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
let hidden = false;
let follow = null;

function ensure() {
  if (box) return;
  box = document.createElement('div');
  box.id = 'guia';
  box.innerHTML = `
    <div class="g-bubble"><div class="g-name">Nova · Control de Misión</div><div class="g-text"></div><div class="g-btns"></div></div>
    <button class="g-avatar" title="Mostrar u ocultar a Nova"></button>`;
  document.body.append(box);
  box.querySelector('.g-avatar').addEventListener('click', () => {
    hidden = !hidden;
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
  text = natural(text);
  ensure();
  const same = current.text === text;
  current.text = text;
  box.querySelector('.g-avatar').innerHTML = guideSvg(mood);
  box.className = `mood-${mood}${hidden ? ' closed' : ''}`;
  const btns = box.querySelector('.g-btns');
  btns.replaceChildren(...buttons.map((b) => {
    const el = document.createElement('button');
    el.textContent = b.label;
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
  typing = setInterval(() => {
    i += 2;
    out.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(typing); box.classList.remove('talking'); }
  }, 18);
  if (!quiet) beep(mood === 'alerta' ? 520 : 980, 40, 'sine', 0.03);
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
}

export function hideGuide() {
  if (!box) return;
  current = { text: '', target: null };
  document.querySelectorAll('.senalado').forEach((e) => e.classList.remove('senalado'));
  arrow.style.display = 'none';
  clearInterval(follow);
}
