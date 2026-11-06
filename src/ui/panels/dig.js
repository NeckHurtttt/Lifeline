// EVA de excavación en vista lateral. Idea del juego "Los Tira Vida 02" del equipo, en estilo de consola.
import { h, bar } from '../dom.js';
import { ensureTerrain, startOuting, move, mine, place, endOuting, digBlock, atAirlock, bagValue, canDigHere,
  DIG_COLS, DIG_ROWS, T, TILE_INFO, DIG_REWARD, WALL_BLOCKS } from '../../core/dig.js';
import { beep, alarm } from '../audio.js';
import { SPRITE } from '../sprite.js';

const view = { pick: [], build: false, msg: '', dir: 1 };
const CHAR = { [T.AIRE]: ' ', [T.BASE]: '█' };

export const digAvailable = canDigHere;

export function digPanel(app, commit, redraw, setKey) {
  if (!app.state.dig) commit(ensureTerrain(app.state));
  const s = app.state;
  const d = s.dig; const o = d.outing;
  const first = (c) => c.name.split(' ')[0];
  const act = (fn) => {
    const before = app.state.dig.outing;
    const next = fn(app.state);
    if (next === app.state || JSON.stringify(next.dig.outing) === JSON.stringify(before)) { beep(250, 30); return; }
    commit(next); beep(520, 15);
    if (next.dig.outing.o2 <= 0) { finish(); return; }
    if (next.dig.outing.o2 <= 10) alarm('aviso');
    redraw();
  };
  const finish = () => { const r = endOuting(app.state); commit(r.state); view.msg = r.log.join(' '); view.pick = []; beep(r.log[0]?.startsWith('Regreso') ? 300 : 1100, 150); redraw(); };

  setKey(o ? (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { e.preventDefault(); view.dir = -1; act((st) => move(st, -1)); }
    else if (k === 'd' || k === 'arrowright') { e.preventDefault(); view.dir = 1; act((st) => move(st, 1)); }
    else if (k === 's' || k === 'arrowdown') { e.preventDefault(); act((st) => mine(st, st.dig.outing.x, st.dig.outing.y + 1)); }
    else if (k === 'b') { view.build = !view.build; redraw(); }
  } : null);

  const head = [h('h2', {}, 'EVA DE EXCAVACIÓN'),
    h('div', { class: 'help' }, 'Salen dos con el traje. A / D caminan, S excava hacia abajo y un clic en un bloque vecino lo excava. Con B cambias a construir: un clic en un hueco vecino pone regolito (escalón o techo). Vuelvan a la esclusa antes de que se acabe el oxígeno.'),
    h('div', { class: 'small' }, Object.entries(DIG_REWARD).map(([k, v]) => `${TILE_INFO[{ hielo: T.HIELO, metal: T.METAL, rara: T.RARA, regolito: T.REGOLITO }[k]].code} ${v.label}`).join(' · ')),
    h('div', { class: 'small' }, `Muro de regolito: ${d.wall}/${WALL_BLOCKS}${s.flags?.regolithWall ? ' (terminado)' : ''}`)];

  if (!o) {
    const living = s.crew.filter((c) => c.alive && !c.evacuated);
    const crew = living.filter((c) => view.pick.includes(c.id));
    const block = digBlock(s, crew);
    return h('div', { class: 'panel c-green', id: 'excavar' }, ...head,
      h('div', { class: 'small' }, 'Elige a los dos que salen:'),
      h('div', { class: 'row' }, ...living.map((c) => h('label', { class: 'chip' },
        h('input', { type: 'checkbox', checked: view.pick.includes(c.id), 'data-excavador': c.id, onchange: (e) => { view.pick = e.target.checked ? [...view.pick, c.id].slice(-2) : view.pick.filter((x) => x !== c.id); redraw(); } }),
        ` ${first(c)} (salud ${Math.round(c.health)}, cansancio ${Math.round(c.fatigue)})`))),
      h('div', { class: block ? 'red small' : 'green small' }, block ? `NO GO: ${block}.` : 'GO: pareja, descansados, sin tormenta solar.'),
      h('button', { id: 'salir-excavar', class: 'big', disabled: !!block, onclick: () => { const r = startOuting(app.state, view.pick); commit(r.state); view.msg = r.log.join(' '); beep(r.ok ? 900 : 300, 120); redraw(); } }, 'SALIR POR LA ESCLUSA'),
      view.msg ? h('div', { class: 'small' }, view.msg) : null,
      grid(d, null, () => {}));
  }

  const v = bagValue(o.bag, d.wall);
  const crew = s.crew.filter((c) => o.crewIds.includes(c.id)).map(first).join(' y ');
  return h('div', { class: 'panel c-green', id: 'excavar' }, ...head,
    h('div', { class: 'row' }, h('span', { class: 'small' }, `AFUERA: ${crew}`), h('div', { class: 'grow' }, h('span', { class: 'small' }, `O₂ DEL TRAJE ${Math.max(0, o.o2)}`), bar(o.o2 / 80, { warn: 0.3, danger: 0.15 })),
      h('button', { class: view.build ? 'sel' : '', onclick: () => { view.build = !view.build; redraw(); } }, view.build ? '[B] CONSTRUIR' : '[B] EXCAVAR')),
    h('div', { class: 'small' }, `BOLSA: regolito ${o.bag.regolito} · hielo ${o.bag.hielo} · hierro ${o.bag.metal} · rocas raras ${o.bag.rara}  →  +${v.water} L agua, +${v.parts} piezas, +${v.science} ciencia`),
    grid(d, o, (x, y) => act((st) => (view.build ? place(st, x, y) : mine(st, x, y)))),
    h('div', { class: 'row' },
      h('button', { onclick: () => { view.dir = -1; act((st) => move(st, -1)); } }, '< A'), h('button', { onclick: () => act((st) => mine(st, st.dig.outing.x, st.dig.outing.y + 1)) }, 'S abajo'), h('button', { onclick: () => { view.dir = 1; act((st) => move(st, 1)); } }, 'D >'),
      h('button', { id: 'volver-esclusa', class: atAirlock(s) ? 'big' : 'warn', onclick: finish }, atAirlock(s) ? 'ENTRAR POR LA ESCLUSA' : 'REGRESO DE EMERGENCIA (pierde la mitad)')),
    view.msg ? h('div', { class: 'small' }, view.msg) : null);
}

function grid(d, o, onCell) {
  const cells = [];
  for (let y = 0; y < DIG_ROWS; y++) for (let x = 0; x < DIG_COLS; x++) {
    const t = d.tiles[y * DIG_COLS + x];
    const me = o && o.x === x && o.y === y;
    const lock = x === 1 && y + 1 < DIG_ROWS && d.tiles[(y + 1) * DIG_COLS + 1] !== T.AIRE;
    const reach = o && Math.abs(x - o.x) <= 1 && Math.abs(y - o.y) <= 1 && !me;
    const cell = h('div', { class: `bloque b${t} ${me ? 'yo' : ''} ${reach ? 'alcance' : ''}`, 'data-x': x, 'data-y': y, onclick: () => reach && onCell(x, y) },
      me ? '' : lock && t === T.AIRE ? '▯' : CHAR[t] ?? TILE_INFO[t]?.code ?? ' ');
    if (me) { const fig = document.createElement('div'); fig.className = 'mini-astro'; fig.style.setProperty('--dir', view.dir); fig.innerHTML = SPRITE; cell.append(fig); }
    cells.push(cell);
  }
  const grid = h('div', { class: 'terreno', style: { gridTemplateColumns: `repeat(${DIG_COLS}, 1fr)` } }, ...cells);
  const wrap = h('div', { class: 'terreno-wrap' }, grid);
  // En pantallas chicas el terreno se desliza: la vista sigue al astronauta.
  if (o) requestAnimationFrame(() => { const me = grid.querySelector('.yo'); if (me) wrap.scrollLeft = Math.max(0, me.offsetLeft - wrap.clientWidth / 2); });
  return wrap;
}
