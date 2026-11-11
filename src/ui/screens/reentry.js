// Pantalla de reentrada: pasos, apagón de plasma con estática y elección de ángulo en modo manual.
import { art } from '../art.js';
import { h, mount } from '../dom.js';
import { reentrySteps, runReentryStep, heatShieldRisk } from '../../core/reentry.js';
import { restoreRng } from '../../core/rng.js';
import { DIFFICULTY } from '../../data/catalog.js';
import { save } from '../../core/save.js';
import { beep, alarm, radio, hum } from '../audio.js';
import { say as nova } from '../guide.js';
import { crewAvatar } from '../avatar.js';
import { goNoGo } from '../poll.js';
import { inCoop, shareDraft } from '../coop.js';

// Niños: cada paso en palabras simples (mismos ids que la reentrada de verdad).
const KID_STEPS = {
  desacople: 'La cápsula se suelta de la estación',
  encendido_salida: 'El motor da un empujón para bajar',
  sep_modulo_servicio: 'Se suelta la parte de atrás de la nave',
  interfaz_entrada: 'La cápsula toca el aire de la Tierra',
  apagon_plasma: 'Mucho calor afuera: la radio se calla un ratito',
  escudo_termico: 'El escudo aguanta el fuego de afuera',
  paracaidas_freno: 'Se abre un paracaídas chico',
  paracaidas_principales: 'Se abren 3 paracaídas gigantes',
  amerizaje: '¡Splash! La cápsula cae al mar',
  recuperacion: 'Un barco recoge a los astronautas',
};
const KID_OVERRIDES = {
  luna: { desacople: 'La nave despega de la Luna', encendido_salida: 'El motor nos empuja hacia la Tierra: 3 días de viaje', interfaz_entrada: 'Llegamos muy rápido al aire de la Tierra' },
  marte: { desacople: 'Después de 7 meses, la cápsula se suelta de la nave grande', encendido_salida: 'Un último empujón para apuntar bien a la Tierra', interfaz_entrada: 'Llegamos rapidísimo al aire de la Tierra' },
};

const ANGLES = {
  normal: 'Normal: el ángulo de diseño',
  empinado: 'Empinado: más rápido, más fuerza G (+20 % de daño)',
  rasante: 'Rasante: más suave, 30 % de rebotar y perder un día',
};

export function render(root, app, go) {
  const REENTRY_STEPS = reentrySteps(app.state.scenarioId);
  let s = app.state;
  const kids = !!app.kids;
  const kidLabel = (id) => KID_OVERRIDES[s.scenarioId]?.[id] ?? KID_STEPS[id];
  const label = (st) => (kids ? kidLabel(st.id) : st.label);
  const mode = DIFFICULTY[s.difficulty].launchMode;
  const speed = mode === 'auto' ? 450 : 800;
  const status = {};
  const lines = [];
  let cancelled = false;

  const steps = h('ul', { class: 'plain steps', id: 'pasos' });
  const out = h('div', { class: 'log', style: { maxHeight: '360px' } });
  const action = h('div', { id: 'accion', style: { marginTop: '.6rem' } });
  const risk = Math.round(heatShieldRisk(s) * 100);
  mount(root, 
    h('h1', { style: { fontSize: '1.8rem' } }, '🌍 Vuelta a casa'),
    h('div', { class: 'panel c-blue', style: { textAlign: 'center' } },
      h('div', { class: 'sky space', id: 'cielo' }, h('div', { class: 'planet' }), h('div', { class: 'rocket', id: 'capsula', style: { bottom: '200px' } }, art('capsula'))),
      h('div', { class: 'capsule', style: { marginTop: '.5rem' } }, ...s.crew.map((c) => crewAvatar(c, { size: 60 })))),
    h('div', { class: 'grid2' },
      h('div', { class: 'panel c-violet' }, h('h2', {}, kids ? 'QUÉ VA PASANDO' : 'Pasos'), steps,
        h('div', { class: `small ${risk > 20 ? 'red' : risk > 5 ? 'amber' : 'dim'}` }, kids
          ? `Escudo de calor: ${risk > 20 ? 'MUY GASTADO (cuidado)' : risk > 5 ? 'UN POCO GASTADO' : 'BIEN'}`
          : `Riesgo del escudo térmico: ${risk} % (según la salud de la cabina)`)),
      h('div', { class: 'panel c-cyan' }, h('h2', {}, '📻 Radio'), action, out)),
  );
  const say = (text, cls = '') => {
    lines.unshift(h('div', { class: cls }, text)); out.replaceChildren(...lines); radio();
    if (inCoop()) shareDraft('radio', lines.slice(0, 15).map((e) => [e.textContent, e.className]));
  };
  const drawSteps = (now) => steps.replaceChildren(...REENTRY_STEPS.map((st) =>
    h('li', { class: `${status[st.id] ?? ''} ${st.id === now ? 'now' : ''}` }, label(st))));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    hum(true);
    for (let i = 0; i < REENTRY_STEPS.length; i++) {
      if (cancelled) return;
      const step = REENTRY_STEPS[i];
      drawSteps(step.id);
      beep(600, 50);
      const cap = document.getElementById('capsula');
      if (cap) cap.style.bottom = `${200 - (i / (REENTRY_STEPS.length - 1)) * 180}px`;
      if (i >= 4) document.getElementById('cielo')?.classList.remove('space');
      nova(kids ? kidLabel(step.id) : /[!?.…]$/.test(step.label) ? `${step.label} ${step.desc}` : `${step.label}: ${step.desc}`, { quiet: true, mood: step.id === 'escudo_termico' ? 'alerta' : step.id === 'recuperacion' ? 'feliz' : 'normal' });
      let choice;
      // Antes de encender los motores para volver, cada jugador (cada rol) dice si está listo.
      if (i === 0 && app.players.length > 1) {
        for (;;) {
          nova('Go/No-Go para volver a casa: cada uno revisa su consola y dice si está listo.', { target: '#gonogo' });
          const pv = await goNoGo(app.players, action, { title: 'Go/No-Go para la reentrada', onTimeout: (n) => say(`${n} no respondió: cuenta como GO.`, 'aviso') });
          if (cancelled) return;
          const nogo = Object.entries(pv).filter(([, v]) => v !== 'go').map(([n]) => n);
          if (!nogo.length) { say('Todas las consolas: GO para la reentrada.'); break; }
          say(`NO GO de ${nogo.join(', ')}: revisamos y se vuelve a preguntar.`, 'aviso'); alarm('aviso');
          await wait(speed);
        }
      }
      if (step.id === 'interfaz_entrada' && mode === 'manual') {
        setTimeout(() => nova('Elige cómo entrar al aire. Normal es lo seguro. Empinado lastima más. Rasante puede rebotar y perder un día.', { mood: 'pensando', target: '#angulo' }), 30);
        choice = await new Promise((res) => action.replaceChildren(h('div', { class: 'panel c-amber', id: 'angulo' },
          h('div', { class: 'amber' }, 'Elige el ángulo de entrada'),
          ...Object.entries(ANGLES).map(([id, txt]) => h('div', {}, h('button', { 'data-angle': id, onclick: () => res(id) }, txt))))));
        action.replaceChildren();
      }
      if (step.id === 'apagon_plasma') {
        const st = h('div', { class: 'static' }, kids ? 'MUCHO CALOR · LA RADIO SE CALLA' : 'APAGÓN DE PLASMA · SIN SEÑAL');
        document.body.append(st);
        await wait(4000);
        st.remove();
        if (cancelled) return;
      }
      const rng = restoreRng(s.rng);
      const r = runReentryStep(s, step.id, rng, choice);
      s = { ...r.state, rng: rng.state() };
      for (const [k, l] of r.log.entries()) say(k === 0 && kids ? kidLabel(step.id) : l, k === 0 ? '' : (r.ok ? 'aviso' : 'evento'));
      if (r.log.length > 1 && !/silencio/.test(r.log[1])) alarm(r.ok ? 'aviso' : 'emergencia');
      if (!r.ok) {
        status[step.id] = 'fail';
        if (s.outcome) break;
        i -= 1; // reintento (encendido de salida sin combustible)
        await wait(speed);
        continue;
      }
      status[step.id] = 'done';
      await wait(speed);
    }
    drawSteps(null);
    hum(false);
    s.log = [...s.log, { day: s.day, text: s.outcome?.reason ?? 'Fin de la reentrada', kind: 'fin' }];
    app.state = s;
    save(s);
    action.replaceChildren(h('button', { class: 'big', id: 'continuar', onclick: () => go('report') }, '📋 VER CÓMO NOS FUE'));
    nova(s.outcome?.success ? '¡Splash! 🌊 ¡Están en casa! Vamos a ver cómo les fue.' : 'No salió bien… Veamos qué pasó para aprender.', { mood: s.outcome?.success ? 'feliz' : 'alerta', target: '#continuar' });
  }

  run();
  return () => { cancelled = true; hum(false); document.querySelectorAll('.static').forEach((e) => e.remove()); };
}
