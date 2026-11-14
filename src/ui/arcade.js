// ARCADE: pruebas de la academia una tras otra, cada vez más rápidas, con combos y 3 vidas. Partidas de 2-3 minutos.
import { h, modal } from './dom.js';
import { beep, alarm } from './audio.js';
import { mountGame } from './academy.js';
import './academy2.js';
import { TRAININGS } from '../core/academy.js';
import { ADVANCED } from '../core/academy2.js';
import { ARCADE_POOL, LIVES, roundSeconds, scoreRound, nextGame } from '../core/arcade.js';
import { markPlayed, checkRankUp } from './cadete.js';
import { speak, glitch } from './fx.js';

const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const set = (el, ...kids) => el.replaceChildren(...kids.filter((k) => k != null && k !== false));
export const arcadeBest = () => get('vdl-arcade', { best: 0, combo: 0, rounds: 0 });

export function openArcade() {
  const box = h('div', { class: 'academia arcade', id: 'arcade' });
  const close = modal(box);
  let stop = null;
  const quit = () => { stop?.(); close(); };

  const intro = () => {
    const rec = arcadeBest();
    set(box, 
      h('div', { class: 'arc-logo' }, 'ARCADE'),
      h('p', { class: 'acad-meta' }, 'Pruebas seguidas, cada vez más rápidas. Con 2★ o más sube el COMBO y multiplica los puntos. Con 0★ pierdes una vida.'),
      h('div', { class: 'arc-rec' }, `🏆 RÉCORD ${rec.best} · mejor combo ×${rec.combo} · ${rec.rounds} rondas`),
      h('div', { class: 'acad-botones' },
        h('button', { class: 'big', id: 'arc-jugar', onclick: run }, '▶ JUGAR'),
        h('button', { onclick: quit }, 'Salir')));
  };

  function run() {
    let lives = LIVES, score = 0, combo = 0, bestCombo = 0, level = 0, last = null;
    const hud = h('div', { class: 'arc-hud' });
    const paintHud = (left = null) => set(hud, 
      h('span', { class: 'arc-vidas' }, `VIDAS ${'█'.repeat(lives)}${'░'.repeat(LIVES - lives)}`),
      h('span', {}, `NIVEL ${level + 1}`),
      h('span', { class: `arc-combo ${combo >= 2 ? 'on' : ''}` }, `COMBO ×${scoreRound(1, { combo: combo - 1 }).mult}`),
      h('span', { class: 'arc-pts' }, String(score).padStart(6, '0')),
      left != null ? h('b', { class: left < 4 ? 'red' : '' }, `${Math.max(0, Math.ceil(left))} s`) : null);
    const round = () => {
      const id = nextGame(Math.random, last); last = id;
      const def = TRAININGS[id] ?? ADVANCED[id];
      const secs = roundSeconds(def.seconds, level);
      // Cartel de 1 s con el nombre de la prueba.
      set(box, hud, h('div', { class: 'arc-cartel' }, h('div', { class: 'arc-ico' }, def.icon), h('div', {}, def.name.toUpperCase()), h('div', { class: 'small dim' }, def.goal)));
      paintHud(); beep(700 + level * 40, 60);
      setTimeout(() => {
        if (!box.isConnected) return;
        stop = mountGame(box, id, { seconds: secs, short: true, header: hud, timeLabel: (l) => paintHud(l), onEnd: (sc) => after(sc) });
      }, 1100);
    };
    const after = (sc) => {
      const r = scoreRound(sc, { combo, level });
      combo = r.combo; bestCombo = Math.max(bestCombo, combo); score += r.points; level++;
      if (r.loseLife) lives--;
      const msg = r.loseLife ? '✖ −1 VIDA' : combo >= 2 && r.stars >= 2 ? `COMBO ×${r.mult}!` : `+${r.points}`;
      set(box, hud, h('div', { class: `arc-cartel ${r.loseLife ? 'mal' : 'bien'}` },
        h('div', { class: 'acad-estrellas' }, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)), h('div', { class: 'arc-msg' }, msg), r.ok ? h('div', { class: 'small' }, `+${r.points} puntos`) : null));
      paintHud();
      if (r.loseLife) { alarm('aviso'); glitch(); } else [0, 90, 180].slice(0, Math.min(3, 1 + Math.floor(combo / 2))).forEach((d, k) => setTimeout(() => beep(880 + k * 220, 90, 'triangle', 0.06), d));
      if (combo >= 4 && r.stars >= 2 && combo % 2 === 0) speak(`Combo por ${r.mult}`, { interrupt: true });
      setTimeout(() => { if (!box.isConnected) return; if (lives <= 0) over(); else round(); }, 1300);
    };
    const over = () => {
      const rec = arcadeBest();
      const nuevo = score > rec.best;
      put('vdl-arcade', { best: Math.max(rec.best, score), combo: Math.max(rec.combo, bestCombo), rounds: Math.max(rec.rounds, level) });
      markPlayed();
      if (nuevo) { [0, 120, 240, 360].forEach((d, k) => setTimeout(() => beep([660, 880, 1100, 1320][k], 140, 'triangle', 0.07), d)); speak('¡Nuevo récord!'); }
      set(box, 
        h('div', { class: 'arc-logo' }, 'FIN DE PARTIDA'),
        nuevo ? h('div', { class: 'arc-nuevo' }, '★ ¡NUEVO RÉCORD! ★') : null,
        h('div', { class: 'arc-final' }, String(score).padStart(6, '0')),
        h('div', { class: 'arc-rec' }, `${level} rondas · mejor combo ×${scoreRound(1, { combo: bestCombo - 1 }).mult} · récord ${Math.max(rec.best, score)}`),
        h('div', { class: 'acad-botones' },
          h('button', { class: 'big', id: 'arc-otra', onclick: run }, '↻ OTRA VEZ'),
          h('button', { onclick: () => { quit(); checkRankUp(); } }, 'Salir')));
      setTimeout(checkRankUp, 1500);
    };
    round();
  }
  intro();
  return quit;
}
