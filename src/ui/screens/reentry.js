// Pantalla de reentrada: pasos, apagón de plasma con estática y elección de ángulo en modo manual.
import { h, mount } from '../dom.js';
import { REENTRY_STEPS, runReentryStep, heatShieldRisk } from '../../core/reentry.js';
import { restoreRng } from '../../core/rng.js';
import { DIFFICULTY } from '../../data/catalog.js';
import { save } from '../../core/save.js';
import { beep, alarm, radio, hum } from '../audio.js';

const ANGLES = {
  normal: 'Normal: el ángulo de diseño',
  empinado: 'Empinado: más rápido, más fuerza G (+20 % de daño)',
  rasante: 'Rasante: más suave, 30 % de rebotar y perder un día',
};

export function render(root, app, go) {
  let s = app.state;
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
    h('h1', { style: { fontSize: '1.6rem' } }, 'Reentrada · vuelta a casa'),
    h('div', { class: 'grid2' },
      h('div', { class: 'panel' }, h('h2', {}, 'Secuencia'), steps,
        h('div', { class: `small ${risk > 20 ? 'red' : risk > 5 ? 'amber' : 'dim'}` }, `Riesgo del escudo térmico: ${risk} % (según la salud de la cabina)`)),
      h('div', { class: 'panel' }, h('h2', {}, 'Bitácora'), out, action)),
  );
  const say = (text, cls = '') => { lines.unshift(h('div', { class: cls }, text)); out.replaceChildren(...lines); radio(); };
  const drawSteps = (now) => steps.replaceChildren(...REENTRY_STEPS.map((st) =>
    h('li', { class: `${status[st.id] ?? ''} ${st.id === now ? 'now' : ''}` }, st.label)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    hum(true);
    for (let i = 0; i < REENTRY_STEPS.length; i++) {
      if (cancelled) return;
      const step = REENTRY_STEPS[i];
      drawSteps(step.id);
      beep(600, 50);
      let choice;
      if (step.id === 'interfaz_entrada' && mode === 'manual') {
        choice = await new Promise((res) => action.replaceChildren(h('div', { class: 'panel', id: 'angulo' },
          h('div', { class: 'amber' }, 'Elige el ángulo de entrada'),
          ...Object.entries(ANGLES).map(([id, txt]) => h('div', {}, h('button', { 'data-angle': id, onclick: () => res(id) }, txt))))));
        action.replaceChildren();
      }
      if (step.id === 'apagon_plasma') {
        const st = h('div', { class: 'static' }, 'APAGÓN DE PLASMA · SIN SEÑAL');
        document.body.append(st);
        await wait(4000);
        st.remove();
        if (cancelled) return;
      }
      const rng = restoreRng(s.rng);
      const r = runReentryStep(s, step.id, rng, choice);
      s = { ...r.state, rng: rng.state() };
      for (const [k, l] of r.log.entries()) say(l, k === 0 ? '' : (r.ok ? 'aviso' : 'evento'));
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
    action.replaceChildren(h('button', { class: 'big', id: 'continuar', onclick: () => go('report') }, 'VER INFORME'));
  }

  run();
  return () => { cancelled = true; hum(false); document.querySelectorAll('.static').forEach((e) => e.remove()); };
}
