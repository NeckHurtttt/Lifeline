// Sondeo Go/No-Go: cada jugador vota (en línea, desde su compu; si no responde en 30 s cuenta como GO).
import { h } from './dom.js';
import { inCoop, coopInfo, shareDraft, onAction } from './coop.js';
import { PLAYER_ROLES } from './main.js';

export function goNoGo(players, box, { title = 'Sondeo Go/No-Go', onTimeout = null } = {}) {
  return new Promise((res) => {
    const pv = {}; const btns = {}; const round = Date.now();
    let off = null; let timer = null;
    const finish = () => { off?.(); clearTimeout(timer); if (inCoop()) shareDraft('gonogo', null); box.replaceChildren(); res(pv); };
    const vote = (name, v) => {
      if (!btns[name] || pv[name]) return;
      pv[name] = v; btns[name][v].classList.add('sel');
      if (Object.keys(pv).length === players.length) finish();
    };
    const panel = h('div', { class: 'panel', id: 'gonogo' }, h('h3', {}, title));
    for (const p of players) {
      const remote = inCoop() && p.name !== coopInfo().name;
      btns[p.name] = {
        go: h('button', { 'data-vote': `${p.name}:go`, onclick: () => vote(p.name, 'go') }, 'GO'),
        nogo: h('button', { class: 'danger', 'data-vote': `${p.name}:nogo`, onclick: () => vote(p.name, 'nogo') }, 'NO GO'),
      };
      panel.append(h('div', { class: 'vote-card' }, h('b', {}, p.name),
        h('span', { class: 'dim small' }, p.roles.map((r) => PLAYER_ROLES[r]).join('+'), remote ? ' · vota desde su compu (30 s)' : ''),
        btns[p.name].go, btns[p.name].nogo));
    }
    box.replaceChildren(panel);
    if (inCoop()) {
      off = onAction((name, data, from) => { if (name === 'voto' && data?.round === round && (data.v === 'go' || data.v === 'nogo')) vote(from, data.v); });
      shareDraft('gonogo', { round, players: players.map((p) => p.name) });
      timer = setTimeout(() => {
        for (const p of players) if (!pv[p.name] && p.name !== coopInfo().name) { onTimeout?.(p.name); vote(p.name, 'go'); }
      }, 30000);
    }
  });
}
