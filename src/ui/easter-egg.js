import { h, modal } from './dom.js';
import calmImage from './assets/no-ragebait.png';

// Un puntito junto a los créditos del menú. No cambia la misión ni el guardado.
export function secretCalmButton() {
  const trigger = h('button', {
    id: 'secreto-calma', type: 'button', 'aria-label': 'Un momento de calma',
    style: { padding: '.2rem .5rem', background: 'transparent', border: 'none', opacity: '.5' },
    onclick: () => {
      if (document.getElementById('calma-secreta')) return;
      const dismiss = () => {
        close();
        if (trigger.isConnected) trigger.focus();
      };
      const exit = h('button', { type: 'button', onclick: dismiss }, 'Volver al juego');
      const content = h('div', {
        id: 'calma-secreta', role: 'dialog', 'aria-modal': 'true',
        'aria-label': 'Un momento de calma', style: { textAlign: 'center' },
      },
      h('img', {
        src: calmImage, alt: 'Hoy no voy a caer en ragebait. Un perro meditando: Ommmmmmm.',
        style: { display: 'block', maxWidth: '100%', maxHeight: '65vh', margin: '0 auto 1rem', objectFit: 'contain' },
      }), exit);
      const close = modal(content);
      const backdrop = content.closest('.modal-bg');
      backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dismiss(); });
      backdrop.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); }
        // El único control del diálogo es el botón de volver.
        if (event.key === 'Tab') { event.preventDefault(); exit.focus(); }
      });
      exit.focus();
    },
  }, '·');
  return trigger;
}
