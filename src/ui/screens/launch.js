// Pantalla de despegue: reloj T−/T+, pasos, telemetría, clima, Go/No-Go y abortos.
import { h, mount } from '../dom.js';
import { LAUNCH_STEPS, checkWeather, goNoGoPoll, runLaunchStep, applyAbort, scrubLaunch } from '../../core/launch.js';
import { restoreRng } from '../../core/rng.js';
import { DIFFICULTY } from '../../data/catalog.js';
import { save } from '../../core/save.js';
import { PLAYER_ROLES } from '../main.js';
import { beep, alarm, radio, hum } from '../audio.js';

const ABORT_NAMES = { torre_escape: 'Torre de escape', amarizaje: 'Aborto con amarizaje', aborto_orbita: 'Aborto a órbita' };
const RADIO = {
  cuarentena: 'Tripulación en cuarentena. Dos días para el lanzamiento.',
  carga_propelente: 'Inicia la carga de propelente criogénico.',
  clima: 'Meteorología, informe del clima para la ventana.',
  abordaje: 'La tripulación sube por el brazo de acceso.',
  hold_go_nogo: 'Pausa programada. Sondeo Go/No-Go de todas las consolas.',
  retiro_brazo: 'Brazo de acceso retirado.',
  escape_armado: 'Sistema de escape armado.',
  computadora: 'La secuencia automática tiene el control.',
  encendido: 'Encendido de motores…',
  despegue: '¡Despegue! Arriba con la tripulación.',
  despeje_torre: 'Torre despejada, control pasa a vuelo.',
  max_q: 'Max Q. Máxima presión aerodinámica.',
  sep_impulsores: 'Separación de impulsores confirmada.',
  sep_torre_escape: 'Torre de escape eyectada.',
  meco: 'MECO. Corte de motores principales.',
  insercion: 'Inserción en órbita confirmada.',
  paneles: 'Despliegue de paneles solares.',
  acople_estacion: 'Captura suave… acople firme con la estación.',
};

const tel = (t) => {
  if (t <= 0) return { alt: 0, vel: 0, q: 0 };
  const tt = Math.min(t, 600);
  return {
    alt: Math.min(400, 0.0011 * tt * tt + 0.02 * tt),
    vel: Math.min(7.66, 0.000021 * tt * tt + 0.0005 * tt),
    q: 35 * Math.exp(-(((tt - 70) / 30) ** 2)),
  };
};

const clockText = (t) => {
  const sign = t < 0 ? 'T−' : 'T+';
  const a = Math.abs(Math.round(t));
  const hh = String(Math.floor(a / 3600)).padStart(2, '0');
  const mm = String(Math.floor((a % 3600) / 60)).padStart(2, '0');
  const ss = String(a % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}:${ss}`;
};

export function render(root, app, go) {
  let s = app.state;
  const mode = DIFFICULTY[s.difficulty].launchMode;
  const speed = mode === 'auto' ? 260 : 520;
  const status = {};
  const radioLog = [];
  let cancelled = false;
  let t = LAUNCH_STEPS[0].t;
  let attempts = 0;

  const els = {
    clock: h('div', { class: 'clock', id: 'reloj' }, clockText(t)),
    steps: h('ul', { class: 'plain steps', id: 'pasos' }),
    tel: h('div', { class: 'small' }),
    radio: h('div', { class: 'log', id: 'radio', style: { maxHeight: '320px' } }),
    action: h('div', { id: 'accion', style: { marginTop: '.6rem' } }),
  };
  mount(root, 
    h('h1', { style: { fontSize: '1.6rem' } }, 'Despegue', h('span', { class: 'dim small' }, ` · modo ${mode}`)),
    h('div', { class: 'grid3' },
      h('div', { class: 'panel' }, h('h2', {}, 'Secuencia'), els.steps),
      h('div', { class: 'panel', style: { textAlign: 'center' } }, els.clock, els.tel, els.action),
      h('div', { class: 'panel' }, h('h2', {}, 'Radio del control'), els.radio)),
  );

  const say = (text, cls = '') => { radioLog.unshift(h('div', { class: cls }, `[${clockText(t)}] ${text}`)); els.radio.replaceChildren(...radioLog.slice(0, 60)); radio(); };
  const drawSteps = (now) => els.steps.replaceChildren(...LAUNCH_STEPS.map((st) =>
    h('li', { class: `${status[st.id] ?? ''} ${st.id === now ? 'now' : ''}`, 'data-step': st.id }, `${clockText(st.t)}  ${st.label}`)));
  const drawTel = () => {
    const v = tel(t);
    els.clock.textContent = clockText(t);
    els.tel.replaceChildren(h('div', {}, `ALT ${v.alt.toFixed(1)} km · VEL ${v.vel.toFixed(2)} km/s · Q ${v.q.toFixed(1)} kPa`));
  };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const ask = (build) => new Promise((res) => {
    els.action.replaceChildren(build((v) => { els.action.replaceChildren(); res(v); }));
  });
  const persist = () => { app.state = s; };

  async function weather() {
    for (;;) {
      const rng = restoreRng(s.rng);
      const w = checkWeather(rng, s.difficulty);
      s = { ...s, rng: rng.state() };
      const criteria = ['Rayos a menos de 10 millas', 'Nubes de yunque', 'Viento en altura > 30 m/s', 'Mar en zonas de aborto'];
      say(w.go ? 'Clima: GO. Todos los criterios en verde.' : `Clima: NO GO. ${w.reasons.join('; ')}.`, w.go ? '' : 'aviso');
      if (mode !== 'auto') {
        await ask((res) => h('div', { class: 'panel', id: 'clima' },
          h('h3', {}, 'Criterios de clima'),
          h('ul', { class: 'plain small', style: { textAlign: 'left' } }, ...criteria.map((c) => {
            const bad = w.reasons.some((r) => r.startsWith(c.split(' ')[0]));
            return h('li', { class: bad ? 'red' : '' }, `${bad ? '✖' : '✔'} ${c}`);
          })),
          h('button', { id: 'seguir-clima', onclick: res }, w.go ? 'Continuar' : 'Suspender y reintentar mañana')));
      }
      if (w.go) return;
      const r = scrubLaunch(s, w.reasons[0]);
      s = r.state; persist();
      say(r.log[0], 'aviso');
      if (++attempts > 6) { say('El clima mejora por fin.', ''); return; }
      await wait(speed);
    }
  }

  async function goNoGo() {
    if (mode === 'auto') { say('Todas las consolas: GO.'); return; }
    for (;;) {
      const votes = {};
      const players = app.players;
      const result = await ask((res) => {
        const box = h('div', { class: 'panel', id: 'gonogo' }, h('h3', {}, 'Sondeo Go/No-Go'));
        const pv = {};
        const finish = () => res(pv);
        for (const p of players) {
          const line = h('div', { class: 'row', style: { justifyContent: 'center', margin: '.3rem 0' } },
            h('b', {}, p.name), h('span', { class: 'dim small' }, p.roles.map((r) => PLAYER_ROLES[r]).join('+')),
            h('button', { 'data-vote': `${p.name}:go`, onclick: (e) => { pv[p.name] = 'go'; e.target.classList.add('sel'); if (Object.keys(pv).length === players.length) finish(); } }, 'GO'),
            h('button', { class: 'danger', 'data-vote': `${p.name}:nogo`, onclick: (e) => { pv[p.name] = 'nogo'; e.target.classList.add('sel'); if (Object.keys(pv).length === players.length) finish(); } }, 'NO GO'));
          box.append(line);
        }
        return box;
      });
      // Cada voto de jugador cuenta por los tripulantes de sus roles.
      const nogoPlayers = players.filter((p) => result[p.name] !== 'go').map((p) => p.name);
      for (const c of s.crew) votes[c.role] = nogoPlayers.length ? 'nogo' : 'go';
      const poll = goNoGoPoll(s, votes);
      if (poll.go) { say('Comandante: estamos GO para el lanzamiento.'); return; }
      const why = await ask((res) => h('div', { class: 'panel' },
        h('div', { class: 'amber' }, `NO GO de ${nogoPlayers.join(', ')}. ¿Motivo?`),
        h('input', { id: 'motivo', placeholder: 'Ej.: lectura rara en un sensor', size: 30 }),
        h('button', { onclick: () => res(document.getElementById('motivo').value || 'sin motivo') }, 'Mantener la pausa y repetir el sondeo')));
      say(`Pausa mantenida: ${why}.`, 'aviso');
      alarm('aviso');
    }
  }

  async function onFailure(step, r) {
    alarm('emergencia');
    say(`¡Falla! ${r.failure}`, 'evento');
    const correct = r.abortMode;
    let chosen = correct;
    if (mode === 'manual') {
      chosen = await new Promise((res) => {
        let left = 5;
        const timer = setInterval(() => { left -= 1; const c = document.getElementById('cuenta'); if (c) c.textContent = `${left} s`; if (left <= 0) { clearInterval(timer); res(null); } }, 1000);
        els.action.replaceChildren(h('div', { class: 'panel', id: 'aborto' },
          h('div', { class: 'red' }, `¡${r.failure}! Elige el modo de aborto`), h('div', { id: 'cuenta', class: 'clock', style: { fontSize: '2rem' } }, '5 s'),
          h('div', { class: 'row', style: { justifyContent: 'center' } }, ...Object.entries(ABORT_NAMES).map(([id, name]) =>
            h('button', { class: 'danger', 'data-abort': id, onclick: () => { clearInterval(timer); res(id); } }, name)))));
      });
      els.action.replaceChildren();
    } else say(`Computadora de vuelo: ${ABORT_NAMES[correct]}.`, 'aviso');
    if (chosen !== correct) {
      s = structuredClone(s);
      for (const c of s.crew) { c.alive = false; c.health = 0; }
      s.phase = 'report';
      s.outcome = { success: false, reason: chosen ? `Aborto equivocado (${ABORT_NAMES[chosen]}): la nave se perdió` : 'Aborto tardío: la nave se perdió' };
      say(s.outcome.reason, 'evento');
      return 'lost';
    }
    const res = applyAbort(s, correct, restoreRng(s.rng));
    s = res.state;
    for (const l of res.log) say(l, 'aviso');
    return correct === 'aborto_orbita' ? 'continue' : 'abort';
  }

  async function run() {
    hum(true);
    drawSteps(null);
    for (let i = 0; i < LAUNCH_STEPS.length; i++) {
      if (cancelled) return;
      const step = LAUNCH_STEPS[i];
      t = step.t; drawSteps(step.id); drawTel();
      say(RADIO[step.id]);
      beep(step.t >= 0 ? 1000 : 700, 50);
      if (step.id === 'clima') await weather();
      if (step.id === 'hold_go_nogo') await goNoGo();
      if (cancelled) return;

      const rng = restoreRng(s.rng);
      const r = runLaunchStep(s, step.id, rng);
      s = { ...r.state, rng: rng.state() };
      if (r.failure && r.ok) say(r.failure, 'aviso');
      if (!r.ok) {
        status[step.id] = 'fail';
        if (r.scrub) {
          const sc = scrubLaunch(s, r.failure);
          s = sc.state; say(sc.log[0], 'aviso');
          i = LAUNCH_STEPS.findIndex((x) => x.id === 'carga_propelente') - 1;
          await wait(speed);
          continue;
        }
        if (step.id === 'acople_estacion') {
          say('Segundo intento de acople…', 'aviso');
          s = { ...s }; status[step.id] = '';
          i -= 1; await wait(speed); continue;
        }
        const outcome = await onFailure(step, r);
        if (outcome !== 'continue') return finish();
      } else status[step.id] = 'done';
      // Telemetría animada durante el ascenso.
      const next = LAUNCH_STEPS[i + 1];
      if (next && step.t >= 0 && next.t <= 600) {
        const frames = 6;
        for (let f = 1; f <= frames && !cancelled; f++) { t = step.t + ((next.t - step.t) * f) / frames; drawTel(); await wait(speed / frames); }
      } else await wait(speed);
    }
    s = { ...s, phase: 'ops' };
    s.log = [...s.log, { day: 0, text: 'Acople con la estación. Comienza la misión de 365 días.', kind: 'bueno' }];
    finish();
  }

  function finish() {
    hum(false);
    app.state = s;
    if (s.phase === 'ops') save(s);
    els.action.replaceChildren(h('button', { class: 'big', id: 'continuar', onclick: () => go(s.phase === 'ops' ? 'ops' : 'report') },
      s.phase === 'ops' ? 'A LA ESTACIÓN' : 'VER INFORME'));
    if (s.phase === 'ops' && mode === 'auto') setTimeout(() => !cancelled && go('ops'), 1200);
  }

  run();
  return () => { cancelled = true; hum(false); };
}
