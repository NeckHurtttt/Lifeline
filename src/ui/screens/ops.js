// Pantalla de operaciones diarias: recursos, nave, tripulación, alertas, eventos, minimisiones y bitácora.
import { h, mount, bar, modal, fmt } from '../dom.js';
import { MODULES, INSTRUMENTS, DIFFICULTY } from '../../data/catalog.js';
import { ROLES, TRAITS } from '../../data/crew.js';
import { EVENTS } from '../../data/events.js';
import { MINIMISSIONS } from '../../data/minimissions.js';
import { TASKS, validateSchedule } from '../../core/tasks.js';
import { advanceDay, runUntilInterrupt, daysLeft } from '../../core/sim.js';
import { prepareFor, resolveEvent, recommendedOption } from '../../core/events.js';
import { acceptMini } from '../../core/minimissions.js';
import { setPriority } from '../../core/energy.js';
import { restoreRng } from '../../core/rng.js';
import { save } from '../../core/save.js';
import { whoDecides } from '../main.js';
import { alarm, beep } from '../audio.js';

const TASK_IDS = Object.keys(TASKS).filter((t) => t !== 'trabajo');
const RAD_LIMIT = 600;
const ENGINEERING = new Set(['micrometeoritos', 'basura_tardia', 'fuga_amoniaco', 'incendio', 'robot_detecta_fuga', 'fuga_misteriosa', 'falla_bano',
  'reboost', 'choque_carga', 'propulsor_atascado', 'falla_computadora', 'fuga_reciclador', 'sobrecalentamiento', 'falla_bateria', 'panel_danado', 'corto_circuito', 'captura_brazo']);
const SCIENCE = new Set(['experimento_exitoso', 'aurora']);
const COMMS = new Set(['radio_escuelas', 'perdida_comunicacion']);
const roleFor = (eventId) => (ENGINEERING.has(eventId) ? 'ingeniero' : SCIENCE.has(eventId) ? 'cientifico' : COMMS.has(eventId) ? 'comunicaciones' : 'comandante');
const STAT_SHORT = { fuerza: 'F', tecnica: 'T', ciencia: 'C', medicina: 'M', temple: 'Te' };

export function render(root, app, go) {
  let banner = null; // {text, cls}
  const living = () => app.state.crew.filter((c) => c.alive);

  const commit = (state) => { app.state = state; save(state); };

  function handle(interrupt) {
    const s = app.state;
    if (!interrupt) { banner = { text: `Día ${s.day}: sin novedades.`, cls: '' }; return; }
    const k = interrupt.kind;
    if (k === 'alerta') { const ev = EVENTS[interrupt.data.eventId]; banner = { text: `AVISO: ${ev.name} en ${interrupt.data.etaDays} día(s). Prepárense.`, cls: '' }; alarm('aviso'); }
    else if (k === 'evento') { alarm(interrupt.data.severity === 'grave' ? 'emergencia' : 'aviso'); banner = null; }
    else if (k === 'mini') { banner = { text: `Nueva minimisión ofrecida: ${MINIMISSIONS[interrupt.data.id].name}.`, cls: '' }; beep(900, 120); }
    else if (k === 'muerte') { banner = { text: interrupt.data.join(' · '), cls: 'red' }; alarm('emergencia'); }
    else if (k === 'recurso') { banner = { text: `${interrupt.data.text}. Revisa raciones, labores o espera la carga.`, cls: 'red' }; alarm('aviso'); }
    else if (k === 'horario') { banner = { text: interrupt.data.join(' · '), cls: 'red' }; }
    else if (k === 'fin') {
      if (s.phase === 'report') { alarm('emergencia'); setTimeout(() => go('report'), 1500); banner = { text: s.outcome?.reason ?? 'Fin de la misión', cls: 'red' }; }
      else banner = { text: 'Día 365 cumplido. Preparen la reentrada.', cls: '' };
    }
  }

  function advance(all) {
    const r = all ? runUntilInterrupt(app.state) : advanceDay(app.state);
    commit(r.state);
    handle(r.interrupt);
    draw();
  }

  function eventModal() {
    const s = app.state;
    const p = s.pending;
    const ev = EVENTS[p.eventId];
    const control = DIFFICULTY[s.difficulty].control;
    const rec = recommendedOption(p.eventId);
    const who = whoDecides(app, roleFor(p.eventId));
    const close = modal(h('div', { id: 'evento' },
      h('h2', { class: p.severity === 'grave' ? 'red' : 'amber' }, `${ev.kind === '+' ? '★' : '⚠'} ${ev.name} · ${p.severity}`),
      h('p', {}, ev.text[p.severity]),
      p.prepared?.length ? h('p', { class: 'small dim' }, `Preparación hecha: ${p.prepared.join(', ')}`) : null,
      who ? h('p', { class: 'small' }, h('span', { class: 'tag' }, `decide ${who}`)) : null,
      h('div', {}, ...ev.options.map((o) => h('div', { style: { margin: '.35rem 0' } },
        h('button', { 'data-option': o.id, class: control !== 'retraso' && o.id === rec ? 'sel' : '', onclick: () => {
          const rng = restoreRng(app.state.rng);
          const r = resolveEvent(app.state, p.eventId, p.severity, o.id, rng);
          close();
          commit({ ...r.state, rng: rng.state() });
          banner = { text: r.log.join(' '), cls: '' };
          draw();
        } }, o.label),
        o.check ? h('span', { class: 'small dim' }, ` (tirada de ${o.check.stat}: mejor tripulante + 1d10 ≥ ${o.check.dc})`) : null,
        control !== 'retraso' && o.id === rec ? h('span', { class: 'small amber' }, ' recomendado') : null))),
    ), { grave: p.severity === 'grave' });
  }

  function resources() {
    const s = app.state; const r = s.resources; const left = daysLeft(s); const n = living().length || 1;
    const line = (name, frac, text, opts) => h('div', { class: 'res' }, h('span', {}, name), bar(frac, opts), h('span', { class: 'small' }, text));
    const days = (k) => (Number.isFinite(left[k]) ? `${fmt(left[k])} días` : 'reciclado');
    return h('div', { class: 'panel', id: 'recursos' },
      h('h2', {}, 'Recursos'),
      line('O₂', Number.isFinite(left.o2) ? left.o2 / 60 : 1, `${fmt(r.o2)} kg · ${days('o2')}`),
      line('Agua', left.water / 60, `${fmt(r.water)} L · ${days('water')}`),
      line('Comida', left.food / 60, `${fmt(r.food)} kg · ${days('food')}`),
      line('Medicinas', r.meds / (20 * n), `${fmt(r.meds)}`),
      line('Piezas', r.parts / 30, `${fmt(r.parts)}`),
      line('Combustible', r.fuel / 100, `${fmt(r.fuel)} %`),
      line('Batería', r.batteryMax ? r.battery / r.batteryMax : 0, `${fmt(r.battery)}/${r.batteryMax} kWh`),
      line('Datos', r.dataStored / 500, `${fmt(r.dataStored)} GB en cola`, { invert: true }),
      h('div', { class: 'small dim' }, `Ciencia ${fmt(s.science)} · Reputación ${fmt(s.reputation)} · Próxima carga: día ${s.nextResupply}`));
  }

  function ship() {
    const s = app.state;
    const cols = Math.max(...s.modules.map((m) => m.x)) + 1;
    return h('div', { class: 'panel' },
      h('h2', {}, 'Nave ', whoDecides(app, 'ingeniero') ? h('span', { class: 'tag' }, `decide ${whoDecides(app, 'ingeniero')}`) : null),
      h('div', { class: 'small dim' }, 'Clic: encender/apagar. Prioridad: el número más bajo se apaga primero si falta energía.'),
      h('div', { class: 'ship', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } },
        ...s.modules.slice().sort((a, b) => a.y - b.y || a.x - b.x).map((m) => h('div', {
          class: `cell full ${m.on ? '' : 'off'}`, style: { gridColumn: m.x + 1, gridRow: m.y + 1 },
          onclick: (e) => {
            if (e.target.tagName === 'INPUT') return;
            const st = structuredClone(app.state);
            const mm = st.modules.find((q) => q.id === m.id);
            if (mm.health <= 0) return;
            mm.on = !mm.on; commit(st); beep(mm.on ? 800 : 400, 40); draw();
          },
        }, h('b', {}, MODULES[m.type].name), m.offDays ? h('div', { class: 'amber' }, `fuera ${m.offDays} d`) : null,
        bar(m.health / 100), h('div', { class: 'row small' }, m.on ? 'ON' : 'OFF',
          h('input', { type: 'number', min: 1, max: 10, value: m.priority, style: { width: '3.2rem' }, title: 'Prioridad', onchange: (e) => { commit(setPriority(app.state, m.id, Number(e.target.value))); } }))))),
      s.design.instruments.length ? h('div', { class: 'small dim', style: { marginTop: '.3rem' } }, 'Instrumentos: ', s.design.instruments.map((i) => INSTRUMENTS[i].name).join(', ')) : null);
  }

  function crew() {
    const s = app.state;
    const setTurn = (id, turn, val) => { const st = structuredClone(app.state); st.schedule[id][turn] = val; commit(st); draw(); };
    const setRation = (id, val) => { const st = structuredClone(app.state); st.rations[id] = val; commit(st); draw(); };
    return h('div', { class: 'panel' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h2', {}, 'Tripulación'),
        h('div', { class: 'row' },
          h('button', { onclick: () => { app.routine = structuredClone(app.state.schedule); banner = { text: 'Rutina guardada.', cls: '' }; draw(); } }, 'Guardar rutina'),
          h('button', { disabled: !app.routine, onclick: () => { const st = structuredClone(app.state); for (const id of Object.keys(st.schedule)) if (app.routine[id]) st.schedule[id] = [...app.routine[id]]; commit(st); draw(); } }, 'Repetir rutina'))),
      h('table', { id: 'tripulacion' },
        h('tr', {}, ...['Tripulante', 'Stats', 'Salud', 'Fatiga', 'Moral', 'Hueso', `Radiación (límite ${RAD_LIMIT} mSv)`, 'Turno 1', 'Turno 2', 'Turno 3', 'Ración'].map((t) => h('th', {}, t))),
        ...s.crew.map((c) => h('tr', { class: c.alive ? '' : 'muted' },
          h('td', {}, h('b', {}, c.name), h('div', { class: 'small dim' }, `${ROLES[c.role]?.name ?? c.role}${c.traits.length ? ' · ' + c.traits.map((t) => TRAITS[t]?.name ?? t).join(', ') : ''}${c.alive ? '' : c.evacuated ? ' · EVACUADO' : ' · FALLECIDO'}`)),
          h('td', { class: 'small', style: { whiteSpace: 'nowrap' } }, Object.entries(c.stats).map(([k, v]) => `${STAT_SHORT[k]}${v}`).join(' ')),
          h('td', {}, bar(c.health / 100), h('span', { class: 'small' }, fmt(c.health))),
          h('td', {}, bar(c.fatigue / 100, { invert: true }), h('span', { class: 'small' }, fmt(c.fatigue))),
          h('td', {}, bar(c.morale / 100), h('span', { class: 'small' }, fmt(c.morale))),
          h('td', {}, bar(c.bone / 100, { warn: 0.8, danger: 0.7 }), h('span', { class: 'small' }, fmt(c.bone))),
          h('td', {}, bar(c.radiation / (RAD_LIMIT * 1.2), { invert: true, warn: 0.4, danger: 1 - 1 / 1.2, mark: 1 / 1.2 }), h('span', { class: 'small' }, `${fmt(c.radiation)} mSv`)),
          ...[0, 1, 2].map((turn) => h('td', {}, c.alive ? h('select', { 'data-turn': `${c.id}:${turn}`, onchange: (e) => setTurn(c.id, turn, e.target.value) },
            ...TASK_IDS.map((t) => h('option', { value: t, selected: (s.schedule[c.id]?.[turn] === 'trabajo' ? 'experimentos' : s.schedule[c.id]?.[turn]) === t }, TASKS[t].name))) : '')),
          h('td', {}, c.alive ? h('select', { onchange: (e) => setRation(c.id, e.target.value) },
            ...['completa', 'media', 'nada'].map((r) => h('option', { value: r, selected: s.rations[c.id] === r }, r))) : '')))));
  }

  function alerts() {
    const s = app.state;
    return h('div', { class: 'panel', id: 'alertas' },
      h('h2', {}, 'Alertas'),
      s.alerts.length ? null : h('div', { class: 'small dim' }, 'Sin avisos.'),
      ...s.alerts.map((a, idx) => {
        const ev = EVENTS[a.eventId];
        return h('div', { style: { marginBottom: '.4rem' } },
          h('div', { class: 'amber' }, `⚠ ${ev.name} en ${a.etaDays} día(s)`, a.real ? h('span', { class: 'tag' }, `dato real ${a.real.cls} · ${a.real.date}`) : null),
          h('div', { class: 'row small' }, ...ev.prepare.map((p) => h('button', {
            class: a.prepared.includes(p.id) ? 'sel' : '', disabled: a.prepared.includes(p.id),
            onclick: () => { commit(prepareFor(app.state, idx, p.id)); beep(700, 40); draw(); },
          }, p.label, Object.keys(p.cost ?? {}).length ? ` (${Object.entries(p.cost).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''))));
      }));
  }

  function minis() {
    const s = app.state;
    const offers = s.minis.filter((m) => m.status === 'oferta');
    const active = s.minis.filter((m) => m.status === 'activa');
    const busy = new Set(active.flatMap((m) => m.crewIds));
    return h('div', { class: 'panel', id: 'minis' },
      h('h2', {}, 'Minimisiones'),
      !offers.length && !active.length ? h('div', { class: 'small dim' }, 'Ninguna ahora. Llegan ofertas de vez en cuando.') : null,
      ...offers.map((m) => {
        const def = MINIMISSIONS[m.id];
        const picks = new Set();
        return h('div', { style: { marginBottom: '.5rem' } },
          h('div', {}, h('b', {}, def.name), h('span', { class: 'small dim' }, ` · vence día ${m.deadline} · ${def.days} día(s)${def.eva ? ' · EVA' : ''}`)),
          h('div', { class: 'small' }, def.desc),
          h('div', { class: 'small dim' }, `Requiere ${def.requires.crew} tripulante(s)${def.requires.role ? ` (uno ${def.requires.role})` : ''}${def.requires.modules?.length ? ` · módulos: ${def.requires.modules.join(', ')}` : ''}${def.instruments?.length ? ` · instrumentos: ${def.instruments.join(', ')}` : ''} · tirada ${def.check.stat} ≥ ${def.check.dc}`),
          h('div', { class: 'row small' }, ...living().filter((c) => !busy.has(c.id)).map((c) => h('label', {},
            h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picks.add(c.id) : picks.delete(c.id)) }), c.name.split(' ')[0])),
          h('button', { 'data-accept': m.id, onclick: () => {
            const r = acceptMini(app.state, m.id, [...picks]);
            if (r.error) { banner = { text: r.error, cls: 'red' }; draw(); return; }
            commit(r.state); banner = { text: `Aceptada: ${def.name}`, cls: '' }; beep(900, 60); draw();
          } }, 'Aceptar')));
      }),
      ...active.map((m) => h('div', { class: 'small' }, `▶ ${MINIMISSIONS[m.id].name}: faltan ${m.daysLeft} día(s) · ${m.crewIds.map((id) => s.crew.find((c) => c.id === id)?.name.split(' ')[0]).join(', ')}`)));
  }

  function logPanel() {
    const s = app.state;
    return h('div', { class: 'panel' }, h('h2', {}, 'Bitácora'),
      h('div', { class: 'log', id: 'bitacora' }, ...s.log.slice(-80).reverse().map((l) => h('div', { class: l.kind }, `D${l.day} · ${l.text}`))));
  }

  function draw() {
    const s = app.state;
    const sched = validateSchedule(Object.fromEntries(Object.entries(s.schedule).filter(([id]) => s.crew.find((c) => c.id === id)?.alive)))
      .map((e) => { const id = e.split(' ')[0]; const c = s.crew.find((x) => x.id === id); return c ? e.replace(id, c.name) : e; });
    const blocked = sched.length > 0 || !!s.pending || s.phase !== 'ops';
    mount(root, 
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h1', { style: { fontSize: '1.8rem' }, id: 'dia' }, `DÍA ${s.day} / ${s.totalDays}`),
        h('div', { class: 'row' },
          h('button', { id: 'avanzar1', disabled: blocked, onclick: () => advance(false) }, 'Avanzar 1 día'),
          h('button', { id: 'avanzar', class: 'big', disabled: blocked, onclick: () => advance(true) }, 'Avanzar hasta el próximo evento'),
          s.phase === 'reentry' ? h('button', { id: 'reentrada', class: 'big warn', onclick: () => go('reentry') }, 'INICIAR REENTRADA') : null,
          s.pending ? h('button', { class: 'warn', onclick: eventModal }, 'Ver evento') : null)),
      sched.length ? h('div', { class: 'banner red', id: 'horario' }, sched.join(' · '), ' — cada tripulante debe dormir al menos un turno.') : null,
      banner ? h('div', { class: `banner ${banner.cls}`, id: 'aviso' }, banner.text) : null,
      h('div', { class: 'grid3' },
        h('div', {}, resources(), alerts()),
        h('div', {}, ship(), minis()),
        h('div', {}, logPanel())),
      crew(),
    );
    if (s.pending && !document.getElementById('evento')) eventModal();
  }

  draw();
  return () => document.querySelectorAll('.modal-bg').forEach((e) => e.remove());
}
