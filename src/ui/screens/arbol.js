// Árbol de mejoras de la campaña: se compran con los puntos ganados en las misiones.
import { h, mount } from '../dom.js';
import { UPGRADES, loadCampaign, saveCampaign, canBuy, buyUpgrade, ORDER } from '../../core/campaign.js';
import { SCENARIOS } from '../../data/catalog.js';
import { beep } from '../audio.js';
import { say } from '../guide.js';

const LEVELS = [
  ['paneles_eficientes', 'trajes_nuevos', 'modulos_ligeros'],
  ['reciclador_99', 'medicina_avanzada', 'cohete_reutilizable'],
  ['radar_profundo', 'escudo_mejorado', 'impresion_3d'],
  ['isru_mejorado'],
];

export function render(root, app, go) {
  let camp = loadCampaign();
  const draw = () => {
    mount(root,
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h1', { style: { fontSize: '1.8rem' } }, '🌳 Árbol de mejoras'),
        h('div', { class: 'row' }, h('span', { class: 'pill amber', id: 'puntos' }, `⭐ ${camp.points} puntos`), h('button', { onclick: () => go('title') }, '🏠 Menú'))),
      h('div', { class: 'panel c-blue' },
        h('h2', {}, '🗺️ Campaña'),
        h('div', { class: 'row' }, ...ORDER.map((id, i) => {
          const sc = SCENARIOS[id];
          const done = camp.completed[id];
          const open = camp.unlocked.includes(id);
          return h('span', { class: `tag ${open ? '' : 'dim'}`, style: { fontSize: '1rem', padding: '.2rem .6rem' } },
            `${i + 1}. ${sc.icon} ${sc.short} ${done ? `✔ ${done.medal ? { oro: '🥇', plata: '🥈', bronce: '🥉' }[done.medal] : ''}` : open ? '▶ disponible' : '🔒'}`);
        })),
        h('div', { class: 'help' }, 'Cumple una misión para abrir la siguiente. Cada misión da puntos ⭐ para comprar mejoras (más si traes medalla y mucha ciencia).')),
      ...LEVELS.map((ids, lvl) => h('div', { class: 'panel c-green' },
        h('h2', {}, `Nivel ${lvl + 1}`),
        h('div', { class: 'grid3' }, ...ids.map((id) => {
          const u = UPGRADES[id];
          const owned = camp.upgrades.includes(id);
          const locked = u.req && !camp.upgrades.includes(u.req);
          return h('div', { class: `cand ${owned ? 'hired' : ''}`, 'data-up': id },
            h('div', { style: { fontSize: '1.6rem' } }, u.icon), h('b', {}, u.name),
            h('div', { class: 'small' }, u.desc),
            h('div', { class: 'small dim' }, '🌍 ', u.earth),
            locked ? h('div', { class: 'small amber' }, `🔒 Primero: ${UPGRADES[u.req].name}`) : null,
            owned ? h('div', { class: 'green' }, '✅ Tienes esta mejora')
              : h('button', { disabled: !canBuy(camp, id), 'data-buy': id, onclick: () => {
                camp = buyUpgrade(camp, id); saveCampaign(camp); beep(1100, 120); draw();
                say(`¡Nueva mejora: ${u.icon} ${u.name}! Se usa en tus próximas misiones de campaña.`, { mood: 'feliz' });
              } }, `Comprar · ⭐ ${u.cost}`));
        })))),
    );
  };
  draw();
  say(camp.points ? `Tienes ${camp.points} puntos. Elige una mejora: las de abajo necesitan las de arriba.` : 'Todavía no tienes puntos. ¡Cumple misiones de campaña para ganarlos!', { mood: 'pensando', quiet: true });
}
