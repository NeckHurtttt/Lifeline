// Pantalla de operaciones: recursos, nave, tripulación con avatares, alertas, eventos, minimisiones y bitácora, con Nova guiando.
import { h, mount, bar, modal, fmt, tabs } from '../dom.js';
import { MODULES, INSTRUMENTS, DIFFICULTY, SCENARIOS } from '../../data/catalog.js';
import { siteOf, isNight, daysToNight, daysToDawn } from '../../core/surface.js';
import { phaseDue, resolvePhase, previewPhase, PHASES, inBlackout, radioDelayMin, isMars, ASCENT_FUEL, ASCENT_DAY, LANDING_DAY, TRANSIT_DAYS } from '../../core/mars.js';
import { ROLES, TRAITS } from '../../data/crew.js';
import { EVENTS } from '../../data/events.js';
import { MINIMISSIONS } from '../../data/minimissions.js';
import { TASKS, validateSchedule } from '../../core/tasks.js';
import { advanceDay, runUntilInterrupt, daysLeft } from '../../core/sim.js';
import { prepareFor, resolveEvent, recommendedOption, previewOption } from '../../core/events.js';
import { acceptMini, previewMini, usesAutoRover } from '../../core/minimissions.js';
import { setPriority } from '../../core/energy.js';
import { restoreRng } from '../../core/rng.js';
import { save } from '../../core/save.js';
import { whoDecides } from '../main.js';
import { alarm, beep } from '../audio.js';
import { say } from '../guide.js';
import { crewAvatar, moodOf, MOOD_TEXT } from '../avatar.js';
import { evaGoNoGo, isWeekend, TRESERVE_SECONDS } from '../../core/protocols.js';

const TASK_IDS = Object.keys(TASKS).filter((t) => t !== 'trabajo');
const TASK_ICON = { mantenimiento: '🧹', reparacion: '🔧', experimentos: '🔬', cultivo: '🌱', produccion: '💧', medico: '🩺', ejercicio: '🏃', descanso: '🛋️', sueño: '😴', comunicacion: '📞', eva: '👨‍🚀', refugio: '🛡️', prerespiracion: '🫁' };
const TURNS = ['🌅 Mañana', '☀️ Tarde', '🌙 Noche'];
const TASK_DESC = {
  mantenimiento: 'Cuida los módulos para que no se rompan.', reparacion: 'Arregla módulos dañados.', experimentos: 'Hace ciencia en el laboratorio.',
  cultivo: 'Cuida el invernadero: da comida.', produccion: 'Fabrica agua.', medico: 'Cura a los enfermos.', ejercicio: 'Mantiene fuertes los huesos.',
  descanso: 'Quita el cansancio y sube el ánimo.', sueño: 'Dormir: ¡obligatorio una vez al día!', comunicacion: 'Manda los datos a la Tierra y habla con la familia.',
  eva: 'Sale afuera a arreglar paneles y antena. Siempre en pareja y con pre-respiración antes.', refugio: 'Se esconde de la radiación.',
  prerespiracion: 'Respira oxígeno puro antes de una EVA para no enfermarse al salir (descompresión).',
};
const RATIONS = { completa: '🍽️ Completa', media: '🥣 Media', nada: '🚫 Nada' };
const RAD_LIMIT = 600;
const RES = [
  ['o2', '🫧', 'Aire'], ['water', '💧', 'Agua'], ['food', '🍎', 'Comida'], ['meds', '💊', 'Medicinas'],
  ['parts', '⚙️', 'Piezas'], ['fuel', '⛽', 'Combustible'], ['battery', '🔋', 'Batería'], ['dataStored', '💾', 'Datos por enviar'],
];
const EVENT_ICON = {
  micrometeoritos: '☄️', basura_tardia: '🗑️', tormenta_solar: '🌞', carga_a_tiempo: '📦', carga_explota: '💥', captura_brazo: '🦾',
  fuga_amoniaco: '🧪', incendio: '🔥', robot_detecta_fuga: '🤖', fuga_misteriosa: '🌬️', experimento_exitoso: '🎉', aurora: '🌌',
  radio_escuelas: '📻', falla_bano: '🚽', bacterias: '🦠', nueva_tripulacion: '👋', reboost: '🚀', choque_carga: '💢',
  propulsor_atascado: '🔩', falla_computadora: '💻', perdida_comunicacion: '📵', fuga_reciclador: '💧', sobrecalentamiento: '🌡️',
  falla_bateria: '🪫', panel_danado: '☀️', corto_circuito: '⚡', despresurizacion: '🌀',
  sismo: '🫨', polvo_paneles: '🌫️', rover_atascado: '🚙', falla_traje: '🧑‍🚀', hielo_polar: '🧊', cueva_lava: '🕳️', roca_rara: '🪨', tierra_en_el_cielo: '🌍', impresora_regolito: '🖨️',
  tormenta_polvo: '🌪️', remolino_polvo: '🌀', muestra_contaminada: '🧫', aislamiento: '😔', particulas_profundas: '☢️', plaga_invernadero: '🍂',
};
const MINI_ICON = { lanzar_cubesats: '🛰️', recuperar_satelite: '🧲', retirar_basura: '🧹', capturar_carga: '📦', experimento_externo: '🔭', cambiar_panel: '☀️', fotografiar_desastre: '📸', radio_escuelas: '📻', cultivo_microg: '🪴', prueba_nave_comercial: '🚀',
  satelite_comunicaciones: '📡', red_sismografos: '📈', explorar_cueva: '🕳️', minar_hielo: '🧊', muro_regolito: '🧱', telescopio_oculto: '📻',
  vuelo_helicoptero: '🚁', perforacion_profunda: '⛏️', cache_muestras: '🧪', visitar_rover_antiguo: '🤖' };
const ENGINEERING = new Set(['micrometeoritos', 'basura_tardia', 'fuga_amoniaco', 'incendio', 'robot_detecta_fuga', 'fuga_misteriosa', 'falla_bano',
  'reboost', 'choque_carga', 'propulsor_atascado', 'falla_computadora', 'fuga_reciclador', 'sobrecalentamiento', 'falla_bateria', 'panel_danado', 'corto_circuito', 'captura_brazo']);
const SCIENCE = new Set(['experimento_exitoso', 'aurora']);
const COMMS = new Set(['radio_escuelas', 'perdida_comunicacion']);
const roleFor = (id) => (ENGINEERING.has(id) ? 'ingeniero' : SCIENCE.has(id) ? 'cientifico' : COMMS.has(id) ? 'comunicaciones' : 'comandante');
const STAT = { fuerza: '💪', tecnica: '🛠️', ciencia: '🧠', medicina: '❤️‍🩹', temple: '🧘' };
const STAT_NAME = { fuerza: 'Fuerza', tecnica: 'Técnica', ciencia: 'Ciencia', medicina: 'Medicina', temple: 'Calma' };
const RES_NAME = { o2: '🫧 aire', water: '💧 agua', food: '🍎 comida', meds: '💊 medicinas', parts: '⚙️ piezas', fuel: '⛽ combustible', battery: '🔋 batería', science: '🧪 ciencia', reputation: '⭐ fama' };

/** Efectos de una opción como etiquetas de colores. */
function chips(effects) {
  const out = [];
  for (const [k, v] of Object.entries(effects ?? {})) {
    if (RES_NAME[k]) out.push([`${v > 0 ? '+' : ''}${v} ${RES_NAME[k]}`, v > 0]);
    else if (k === 'crewHealth') out.push([`${v > 0 ? '+' : ''}${v} ❤️ salud de todos`, v > 0]);
    else if (k === 'crewMorale') out.push([`${v > 0 ? '+' : ''}${v} 😊 ánimo de todos`, v > 0]);
    else if (k === 'crewRadiation') out.push([`+${v} ☢️ radiación`, false]);
    else if (k === 'moduleDamage') for (const [t, n] of Object.entries(v)) out.push([`💥 daña ${t === 'random' ? 'un módulo' : MODULES[t]?.name ?? t} −${n}`, false]);
    else if (k === 'moduleOff') for (const [t, n] of Object.entries(v)) out.push([`⏸️ apaga ${t === 'random' ? 'un módulo' : MODULES[t]?.name ?? t} ${n} días`, false]);
    else if (k === 'delayResupply') out.push([`📦 carga ${v} días tarde`, false]);
    else if (k === 'endMission') out.push(['🏠 todos vuelven antes (misión fallida)', false]);
  }
  if (!out.length) return [h('span', { class: 'chip ok' }, '✨ nada cambia')];
  return out.map(([t, good]) => h('span', { class: `chip ${good ? 'ok' : 'bad'}` }, t));
}

export function render(root, app, go) {
  let banner = null;
  let tab = app.opsTab ?? 'resumen';
  let shift = app.opsShift ?? 0;
  const pick = (t) => { tab = t; app.opsTab = t; beep(760, 30); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const living = () => app.state.crew.filter((c) => c.alive);
  const commit = (state) => { app.state = state; save(state); };
  const firstName = (c) => c.name.split(' ')[0];
  const SC = SCENARIOS[app.state.scenarioId] ?? SCENARIOS.estacion;
  const DEST = { estacion: '🛰️', luna: '🌙', marte: '🔴' }[SC.id] ?? '🛰️';
  const HOME = SC.home.charAt(0).toUpperCase() + SC.home.slice(1);

  function handle(interrupt) {
    const s = app.state;
    if (!interrupt) { banner = { text: `📅 Día ${s.day}: todo tranquilo.`, cls: '' }; return; }
    const k = interrupt.kind;
    if (k === 'alerta') { const ev = EVENTS[interrupt.data.eventId]; banner = { text: `⚠️ AVISO: ${EVENT_ICON[ev.id] ?? ''} ${ev.name} en ${interrupt.data.etaDays} día(s).`, cls: '' }; alarm('aviso'); }
    else if (k === 'evento') { alarm(interrupt.data.severity === 'grave' ? 'emergencia' : 'aviso'); banner = null; }
    else if (k === 'mini') { banner = { text: `🎯 Nueva minimisión: ${MINI_ICON[interrupt.data.id] ?? ''} ${MINIMISSIONS[interrupt.data.id].name}.`, cls: '' }; beep(900, 120); }
    else if (k === 'muerte') { banner = { text: interrupt.data.join(' · '), cls: 'red' }; alarm('emergencia'); }
    else if (k === 'fase') { banner = null; beep(700, 200); }
    else if (k === 'aviso') { banner = { text: `📡 ${interrupt.data.text}.`, cls: 'red' }; alarm('aviso'); }
    else if (k === 'noche') { banner = { text: `🌑 ${interrupt.data.text}.`, cls: 'red' }; alarm('aviso'); }
    else if (k === 'recurso') { banner = { text: `🚨 ${interrupt.data.text}.`, cls: 'red' }; alarm('aviso'); }
    else if (k === 'horario') { banner = { text: interrupt.data.join(' · '), cls: 'red' }; }
    else if (k === 'fin') {
      if (s.phase === 'report') { alarm('emergencia'); setTimeout(() => go('report'), 1800); banner = { text: s.outcome?.reason ?? 'Fin de la misión', cls: 'red' }; }
      else banner = { text: `🎉 ¡Cumplieron los ${s.totalDays} días! Hora de volver a casa.`, cls: '' };
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
    const rec = inBlackout(s) ? null : recommendedOption(p.eventId, s);
    let timer = null;
    const choose = (optId, bad) => {
      clearInterval(timer);
      const rng = restoreRng(app.state.rng);
      const r = resolveEvent(app.state, p.eventId, p.severity, optId, rng);
      close();
      commit({ ...r.state, rng: rng.state() });
      banner = { text: r.log.join(' '), cls: bad ? 'red' : '' };
      beep(bad ? 300 : 1000, 120);
      draw();
    };
    let left = TRESERVE_SECONDS[s.difficulty];
    const who = whoDecides(app, roleFor(p.eventId));
    const close = modal(h('div', { id: 'evento' },
      h('div', { class: 'big-ico' }, EVENT_ICON[ev.id] ?? (ev.kind === '+' ? '🎉' : '⚠️')),
      h('h2', { class: p.severity === 'grave' ? 'red' : ev.kind === '+' ? 'green' : 'amber' }, ev.name),
      h('div', { class: 'small' }, { leve: '🟢 Poco grave', media: '🟠 Grave', grave: '🔴 ¡Muy grave!' }[p.severity]),
      h('p', { style: { clear: 'both', fontSize: '1.1rem' } }, ev.text[p.severity]),
      p.prepared?.length ? h('p', { class: 'small green' }, '✔ Se prepararon antes: ayuda.') : null,
      ev.procedure ? h('p', { class: 'small' }, '📋 ', ev.procedure) : null,
      isMars(s) ? h('p', { class: 'small amber' }, inBlackout(s) ? '📵 Conjunción solar: Control de Misión no puede ayudar. Decide tu tripulación.' : `📡 Control de Misión responde con ${radioDelayMin(s)} min de retraso: la tripulación decide primero.`) : null,
      ev.countdown ? h('div', { class: 'treserve' }, '⏱️ Tiempo de reserva: ', h('b', { id: 'treserve' }, `${left} s`), h('span', { class: 'small dim' }, ' — si llega a 0 sin decidir, la presión baja al mínimo.')) : null,
      who ? h('p', { class: 'small' }, h('span', { class: 'tag' }, `decide ${who}`)) : null,
      h('div', {}, ...ev.options.filter((o) => !o.hidden).map((o) => {
        const pre = previewOption(s, p.eventId, o.id);
        const effects = pre && !pre.ok ? o.failEffects[p.severity] : o.effects[p.severity];
        return h('div', { class: `option ${control !== 'retraso' && o.id === rec ? 'sel' : ''}` },
          h('button', { 'data-option': o.id, onclick: () => choose(o.id, pre && !pre.ok) }, o.label),
          control !== 'retraso' && o.id === rec ? h('span', { class: 'chip ok' }, '👍 recomendado') : null,
          pre ? h('div', { class: 'que-pasa', style: { width: '100%' } },
            pre.ok ? h('b', { class: 'green' }, `✔ Funciona: lo hace ${firstName(pre.who)}. `) : h('b', { class: 'red' }, `✖ No alcanza: ${firstName(pre.who)} no sabe lo suficiente. `),
            `${pre.parts.map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${x.value}`).join(' · ')} = ${pre.total} de ${pre.need}`) : null,
          h('div', { style: { width: '100%' } }, h('span', { class: 'small dim' }, 'Lo que pasa: '), ...chips(effects)));
      })),
    ), { grave: p.severity === 'grave' });
    if (ev.countdown) {
      timer = setInterval(() => {
        left -= 1;
        const el = document.getElementById('treserve');
        if (!el) { clearInterval(timer); return; }
        el.textContent = `${left} s`;
        if (left <= 10) { el.classList.add('red'); beep(440, 60); }
        if (left <= 0) choose('tarde', true);
      }, 1000);
    }
    say(ev.countdown ? '¡Despresurización! Sigan el protocolo: decidan antes de que se acabe el tiempo de reserva. ⏱️' : `¡${ev.name}! Mira cada opción: abajo dice si funciona y qué pasa con cada una.`, { mood: ev.kind === '+' ? 'feliz' : 'alerta', target: '#evento' });
  }

  function phaseModal() {
    const s = app.state;
    const phase = phaseDue(s);
    const P = PHASES[phase];
    const pre = previewPhase(s, phase);
    const list = h('ul', { class: 'plain steps' }, ...P.steps.map((t, i) => h('li', { 'data-fase': i }, t)));
    const out = h('div', { class: 'small', style: { marginTop: '.5rem' } });
    let close = null;
    const start = h('button', { class: 'big', id: 'iniciarFase', onclick: async () => {
      start.disabled = true;
      for (let i = 0; i < P.steps.length; i++) {
        list.children[i].classList.add('now'); beep(600 + i * 80, 80);
        await new Promise((r) => setTimeout(r, 700));
        list.children[i].classList.remove('now'); list.children[i].classList.add('done');
      }
      const r = resolvePhase(app.state, phase);
      commit(r.state);
      out.replaceChildren(...r.log.map((t) => h('div', { class: r.ok ? 'green' : 'red' }, t)));
      alarm(r.ok ? 'aviso' : 'emergencia');
      start.replaceWith(h('button', { class: 'big', id: 'seguirFase', onclick: () => { close(); if (app.state.phase === 'report') go('report'); else draw(); } }, 'CONTINUAR ▶'));
    } }, phase === 'edl' ? '🪂 ¡A ATERRIZAR!' : '🚀 ¡DESPEGAR!');
    close = modal(h('div', { id: 'fase' },
      h('div', { class: 'big-ico' }, phase === 'edl' ? '🪂' : '🚀'),
      h('h2', {}, P.title),
      h('p', { style: { clear: 'both' } }, P.desc),
      list,
      pre ? h('div', { class: 'que-pasa' }, pre.ok ? h('b', { class: 'green' }, '✔ Va a salir bien. ') : h('b', { class: 'red' }, '✖ Cuidado: no alcanza. '),
        pre.parts.map((x) => `${x.label} ${x.value}`).join(' · '), ` = ${pre.total} de ${pre.need}`) : null,
      out,
      h('div', { style: { textAlign: 'center', marginTop: '.6rem' } }, start)));
    say(phase === 'edl' ? '¡Llegamos a Marte! Son los "7 minutos de terror": la Tierra no puede ayudar por el retraso de la radio. ¡Suerte, piloto!' : pre.ok ? '¡Hay combustible! Hora de volver a casa.' : `No alcanza el combustible (${pre.total} de ${pre.need}). Si despegan igual, se quedan varados.`,
      { mood: pre.ok ? 'feliz' : 'alerta', target: '#iniciarFase' });
  }

  const fuelRate = (s) => s.modules.filter((m) => m.type === 'planta_combustible' && m.on).reduce((t, m) => t + (MODULES[m.type].fuelPerDay * m.health) / 100, 0);

  function marsLeg() {
    const s = app.state;
    if (!isMars(s)) return null;
    const radio = inBlackout(s, s.day + 1) ? '📵 Conjunción solar: sin radio con la Tierra' : `📡 La radio tarda ${radioDelayMin(s, s.day + 1)} min en llegar a la Tierra`;
    if (s.flags?.landed && !s.flags?.ascended) {
      const proj = s.resources.fuel + fuelRate(s) * Math.max(0, ASCENT_DAY - s.day);
      return h('div', { class: `small ${proj >= ASCENT_FUEL ? 'green' : 'red'}`, id: 'tramo' },
        `🔴 Sol ${s.day - LANDING_DAY} de 365 en Marte · ⛽ combustible para volver: ${fmt(s.resources.fuel)} de ${ASCENT_FUEL} (al despegar tendrás ~${fmt(proj)}) · ${radio}`);
    }
    if (s.flags?.ascended) return h('div', { class: 'small', id: 'tramo' }, `🌍 Regreso: día ${s.day - ASCENT_DAY} de ${TRANSIT_DAYS} · ${radio}`);
    return h('div', { class: 'small', id: 'tramo' }, `🚀 Viaje a Marte: día ${s.day} de ${TRANSIT_DAYS} · sin gravedad y con más radiación · ${radio}`);
  }

  function resources() {
    const s = app.state; const r = s.resources; const left = daysLeft(s); const n = living().length || 1;
    const max = { meds: 20 * n, parts: 30, fuel: 100, battery: r.batteryMax || 1, dataStored: 500 };
    return h('div', { class: 'panel c-blue', id: 'recursos' },
      h('h2', {}, '📦 Lo que tenemos'),
      h('div', { class: 'res-grid' }, ...RES.map(([k, ico, name]) => {
        const days = ['o2', 'water', 'food'].includes(k) ? left[k] : null;
        const frac = days !== null ? (Number.isFinite(days) ? days / 60 : 1) : r[k] / max[k];
        const low = k === 'dataStored' ? frac > 0.8 : frac < 0.15;
        return h('div', { class: `res-card ${low ? 'low' : ''}`, title: name },
          h('div', { class: 'res-ico' }, ico),
          h('div', {}, h('div', { class: 'res-name' }, name),
            h('div', { class: 'res-val' }, days !== null ? (Number.isFinite(days) ? `${fmt(days)} días` : '♻️ se recicla') : `${fmt(r[k])}${k === 'battery' ? ` / ${r.batteryMax}` : ''}`),
            bar(frac, k === 'dataStored' ? { invert: true } : {})));
      })),
      h('div', { class: 'row', style: { marginTop: '.5rem' } },
        h('span', { class: 'pill violet' }, `🧪 Ciencia ${fmt(s.science)}`),
        h('span', { class: 'pill amber' }, `⭐ Fama ${fmt(s.reputation)}`),
        h('span', { class: 'pill blue' }, `📦 Próxima carga: día ${s.nextResupply}`)));
  }

  function ship() {
    const s = app.state;
    const cols = Math.max(...s.modules.map((m) => m.x)) + 1;
    const who = whoDecides(app, 'ingeniero');
    return h('div', { class: 'panel c-violet', id: 'estacion' },
      h('h2', {}, `${DEST} ${HOME} `, who ? h('span', { class: 'tag' }, `decide ${who}`) : null),
      h('div', { class: 'help' }, 'Toca un módulo para prenderlo o apagarlo. El número es su turno para apagarse si falta electricidad (el más bajo, primero).'),
      h('div', { class: 'ship', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } },
        ...s.modules.slice().sort((a, b) => a.y - b.y || a.x - b.x).map((m) => h('div', {
          class: `cell full ${m.on ? '' : 'off'} ${m.health < 40 ? 'roto' : ''}`, style: { gridColumn: m.x + 1, gridRow: m.y + 1 }, 'data-module': m.id,
          title: `${MODULES[m.type].name}: ${MODULES[m.type].desc}`,
          onclick: (e) => {
            if (e.target.tagName === 'INPUT') return;
            const st = structuredClone(app.state);
            const mm = st.modules.find((q) => q.id === m.id);
            if (mm.health <= 0) return;
            mm.on = !mm.on; commit(st); beep(mm.on ? 800 : 400, 40); draw();
          },
        }, h('div', { class: 'ico' }, MODULES[m.type].icon), h('b', {}, MODULES[m.type].name),
        m.offDays ? h('div', { class: 'amber small' }, `⏸️ ${m.offDays} días`) : null,
        bar(m.health / 100), h('div', { class: 'row small' }, m.on ? '🟢' : '⚫',
          h('input', { type: 'number', min: 1, max: 10, value: m.priority, style: { width: '3.4rem' }, title: 'Turno para apagarse', onchange: (e) => { commit(setPriority(app.state, m.id, Number(e.target.value))); } }))))),
      s.design.instruments.length ? h('div', { class: 'small', style: { marginTop: '.4rem' } }, '🔬 ', s.design.instruments.map((i) => `${INSTRUMENTS[i].icon} ${INSTRUMENTS[i].name}`).join(' · ')) : null);
  }

  const shown = (t) => (t === 'trabajo' ? 'experimentos' : t);
  const hasModule = (type) => app.state.modules.some((m) => m.type === type);
  const setTurn = (id, turn, val) => { const st = structuredClone(app.state); st.schedule[id][turn] = val; commit(st); beep(880, 40); draw(); };

  /** Arrastre con puntero (mouse y pantalla táctil): se suelta la carita sobre un trabajo. */
  function startDrag(e, crewId) {
    if (e.button > 0) return;
    e.preventDefault();
    const src = e.currentTarget;
    const ghost = src.cloneNode(true);
    ghost.classList.add('drag-ghost');
    document.body.append(ghost);
    src.classList.add('dragging');
    let over = null;
    const move = (ev) => {
      ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
      if (ev.clientY < 90) window.scrollBy(0, -14); else if (ev.clientY > innerHeight - 70) window.scrollBy(0, 14);
      const z = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-job]');
      if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      ghost.remove(); src.classList.remove('dragging'); over?.classList.remove('over');
      if (!over) return;
      const job = over.dataset.job;
      const need = TASKS[job].needsModule;
      if (need && !hasModule(need)) { say(`Para ${TASKS[job].name} hace falta el módulo ${MODULES[need].name}. Esa casilla está apagada.`, { mood: 'alerta' }); return; }
      if (shown(app.state.schedule[crewId][shift]) !== job) setTurn(crewId, shift, job);
    };
    move(e);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }

  function evaChecklist() {
    const g = evaGoNoGo(app.state, shift);
    if (!g.crew.length) return h('div', { class: 'small dim' }, '📋 Arrastra a 2 astronautas para el sondeo GO / NO GO.');
    return h('div', { class: 'checklist', id: 'eva-check' },
      h('div', { class: g.go ? 'green' : 'red' }, g.go ? '✅ GO para la EVA' : '⛔ NO GO: no salen'),
      ...g.items.map((i) => h('div', { class: `small ${i.ok ? 'green' : 'red'}` }, `${i.ok ? '✔' : '✖'} ${i.label}`)));
  }

  function dayNight() {
    const site = siteOf(app.state);
    if (!site?.nightDays) return null;
    const next = app.state.day + 1;
    return isNight(site, next)
      ? h('div', { class: 'small amber', id: 'diaNoche' }, `🌑 Es de noche: sin sol. Amanece en ${daysToDawn(site, next)} día(s). Cuida la batería 🔋.`)
      : h('div', { class: 'small green', id: 'diaNoche' }, `☀️ Es de día. La noche (${site.nightDays} días) empieza en ${daysToNight(site, next)} día(s).`);
  }

  function jobBoard() {
    const s = app.state;
    const here = (job) => living().filter((c) => shown(s.schedule[c.id]?.[shift]) === job);
    return h('div', { id: 'tablero' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '.3rem 0 .5rem' } },
        h('div', { class: 'row' }, ...TURNS.map((t, i) => h('button', { class: `tab ${i === shift ? 'on' : ''}`, 'data-shift': i, onclick: () => { shift = i; app.opsShift = i; beep(700, 30); draw(); } }, t))),
        h('div', { class: 'help' }, '✋ Arrastra la carita de cada astronauta al trabajo que hará en este turno. ¡Todos deben dormir 😴 al menos un turno!')),
      h('div', { class: 'job-grid' }, ...TASK_IDS.map((job) => {
        const need = TASKS[job].needsModule;
        const off = need && !hasModule(need);
        return h('div', { class: `job ${off ? 'off' : ''} ${job === 'sueño' ? 'sleep' : ''}`, 'data-job': job, title: off ? `Falta el módulo ${MODULES[need].name}` : TASK_DESC[job] },
          h('div', { class: 'job-head' }, h('span', { class: 'ico' }, TASK_ICON[job]), h('span', {}, TASKS[job].name)),
          h('div', { class: 'job-desc small dim' }, off ? `🔒 Necesita ${MODULES[need].name}` : TASK_DESC[job]),
          job === 'eva' ? evaChecklist() : null,
          h('div', { class: 'job-crew' }, ...here(job).map((c) => h('div', { class: 'token', 'data-token': c.id, onpointerdown: (e) => startDrag(e, c.id) },
            crewAvatar(c, { size: 46 }), h('div', { class: 'small' }, firstName(c))))));
      })));
  }

  function crewCards() {
    const s = app.state;
    const setRation = (id, val) => { const st = structuredClone(app.state); st.rations[id] = val; commit(st); draw(); };
    const statRow = (label, v, opts, text) => [h('span', {}, label), bar(v, opts), h('span', { class: 'small' }, text)];
    return h('div', { class: 'panel c-pink', id: 'tripulacion' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h2', {}, '🧑‍🚀 La tripulación'),
        h('div', { class: 'row' },
          h('button', { onclick: () => { app.routine = structuredClone(app.state.schedule); banner = { text: '💾 Rutina guardada.', cls: '' }; draw(); } }, '💾 Guardar rutina'),
          h('button', { disabled: !app.routine, onclick: () => { const st = structuredClone(app.state); for (const id of Object.keys(st.schedule)) if (app.routine[id]) st.schedule[id] = [...app.routine[id]]; commit(st); draw(); } }, '🔁 Repetir rutina'))),
      jobBoard(),
      h('div', { class: 'crew-grid' }, ...s.crew.map((c) => {
        const sleeping = s.schedule[c.id]?.includes('sueño') ? null : 'sinsueño';
        const mood = moodOf(c);
        return h('div', { class: `crew-card ${['enfermo', 'radiacion', 'agotado', 'hambre', 'triste', 'muerto'].includes(mood) || sleeping ? 'mal' : ''}`, 'data-crew': c.id },
          h('div', { class: 'top' },
            crewAvatar(c, { size: 80 }),
            h('div', {},
              h('div', { class: 'name' }, c.name),
              h('div', { class: 'small' }, h('span', { class: 'pill role' }, ROLES[c.role]?.name ?? c.role)),
              h('div', { class: `estado ${mood === 'feliz' || mood === 'normal' ? 'green' : 'amber'}` }, MOOD_TEXT[mood]),
              h('div', { class: 'small dim' }, Object.entries(c.stats).map(([k, v]) => `${STAT[k]}${v}`).join(' '), ' ',
                ...c.traits.map((t) => h('span', { class: `chip ${TRAITS[t]?.positive ? 'ok' : 'bad'}`, title: TRAITS[t]?.desc }, TRAITS[t]?.name ?? t))))),
          c.alive ? [
            h('div', { class: 'stats' },
              ...statRow('❤️ Salud', c.health / 100, {}, fmt(c.health)),
              ...statRow('🥱 Cansancio', c.fatigue / 100, { invert: true }, fmt(c.fatigue)),
              ...statRow('😊 Ánimo', c.morale / 100, {}, fmt(c.morale)),
              ...statRow('🦴 Huesos', c.bone / 100, { warn: 0.8, danger: 0.7 }, fmt(c.bone)),
              ...statRow('☢️ Radiación', c.radiation / (RAD_LIMIT * 1.2), { invert: true, warn: 0.4, danger: 1 - 1 / 1.2, mark: 1 / 1.2 }, fmt(c.radiation))),
            h('div', { class: 'turnos-ver' }, ...[0, 1, 2].map((turn) => {
              const t = shown(s.schedule[c.id]?.[turn]);
              return h('div', { class: `turno-chip ${turn === shift ? 'on' : ''}`, onclick: () => { shift = turn; app.opsShift = turn; draw(); } },
                h('span', { class: 'small dim' }, TURNS[turn]), h('span', {}, `${TASK_ICON[t]} ${TASKS[t].name}`));
            })),
            h('label', { class: 'small row', style: { marginTop: '.3rem' } }, 'Ración de comida',
              h('select', { 'data-ration': c.id, onchange: (e) => setRation(c.id, e.target.value) },
                ...Object.entries(RATIONS).map(([r, t]) => h('option', { value: r, selected: s.rations[c.id] === r }, t)))),
          ] : null);
      })));
  }

  function alerts() {
    const s = app.state;
    return h('div', { class: 'panel c-amber', id: 'alertas' },
      h('h2', {}, '⚠️ Avisos'),
      s.alerts.length ? null : h('div', { class: 'help' }, '😌 Nada a la vista.'),
      ...s.alerts.map((a, idx) => {
        const ev = EVENT_ICON[a.eventId] ?? '⚠️';
        const def = EVENTS[a.eventId];
        return h('div', { class: 'alert-card' },
          h('div', { class: 'row' }, h('span', { style: { fontSize: '1.8rem' } }, ev), h('div', {},
            h('b', {}, def.name), h('div', { class: 'amber' }, `llega en ${a.etaDays} día(s)`),
            a.real ? h('span', { class: 'tag' }, `☀️ dato real de NASA: fulguración ${a.real.cls} del ${a.real.date}`) : null)),
          def.prepare.length ? h('div', { class: 'help' }, 'Prepárense antes, así el problema será menor:') : null,
          h('div', { class: 'row small' }, ...def.prepare.map((p) => h('button', {
            class: a.prepared.includes(p.id) ? 'sel' : '', disabled: a.prepared.includes(p.id), 'data-prep': p.id,
            onclick: () => { commit(prepareFor(app.state, idx, p.id)); beep(700, 40); draw(); },
          }, a.prepared.includes(p.id) ? '✔ ' : '', p.label, Object.keys(p.cost ?? {}).length ? ` (${Object.entries(p.cost).map(([k, v]) => `${v} ${RES_NAME[k] ?? k}`).join(', ')})` : ''))));
      }));
  }

  function minis() {
    const s = app.state;
    const offers = s.minis.filter((m) => m.status === 'oferta');
    const active = s.minis.filter((m) => m.status === 'activa');
    const busy = new Set(active.flatMap((m) => m.crewIds));
    return h('div', { class: 'panel c-green', id: 'minis' },
      h('h2', {}, '🎯 Minimisiones'),
      !offers.length && !active.length ? h('div', { class: 'help' }, 'Ninguna ahora. Te van a pedir trabajos especiales de vez en cuando.') : null,
      ...offers.map((m) => {
        const def = MINIMISSIONS[m.id];
        const picks = new Set();
        const preview = h('div', { class: 'que-pasa' }, 'Elige quién va para ver si le alcanza.');
        const updatePreview = () => {
          if (!picks.size) { preview.textContent = 'Elige quién va para ver si le alcanza.'; return; }
          const r = previewMini(app.state, m.id, [...picks]);
          preview.replaceChildren(r.ok ? h('b', { class: 'green' }, '✔ Va a funcionar. ') : h('b', { class: 'red' }, '✖ No alcanza todavía. '),
            `${r.parts.map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${x.value}`).join(' · ')} = ${r.total} de ${r.need}`);
        };
        return h('div', { class: 'mini-card' },
          h('div', { class: 'row' }, h('span', { style: { fontSize: '1.8rem' } }, MINI_ICON[m.id] ?? '🎯'),
            h('div', {}, h('b', {}, def.name), h('div', { class: 'small dim' }, `hasta el día ${m.deadline} · dura ${def.days} día(s)${def.eva ? ' · sale afuera 👨‍🚀' : ''}`))),
          h('div', { class: 'small' }, def.desc),
          def.rover ? h('div', { class: 'small' }, usesAutoRover(s, def) ? '🤖 Va el rover autónomo: 1 persona lo maneja desde la base, sin salir, pero tarda el doble.' : '🚙 Van 2 en el rover presurizado (EVA en pareja).') : null,
          h('div', { class: 'small dim' }, `Necesita: ${def.rover && usesAutoRover(s, def) ? 1 : def.requires.crew} persona(s)${def.requires.role ? ` (una ${ROLES[def.requires.role]?.name ?? def.requires.role})` : ''}${def.requires.modules?.length ? ` · ${def.requires.modules.map((t) => `${MODULES[t].icon} ${MODULES[t].name}`).join(', ')}` : ''}${def.instruments?.length ? ` · ${def.instruments.map((i) => INSTRUMENTS[i]?.name ?? i).join(', ')}` : ''} · usa ${STAT[def.check.stat] ?? ''} ${STAT_NAME[def.check.stat] ?? def.check.stat}`),
          h('div', { class: 'row small' }, ...living().filter((c) => !busy.has(c.id)).map((c) => h('label', { class: 'pick' },
            h('input', { type: 'checkbox', onchange: (e) => { (e.target.checked ? picks.add(c.id) : picks.delete(c.id)); updatePreview(); } }), firstName(c)))),
          preview,
          h('button', { 'data-accept': m.id, onclick: () => {
            const r = acceptMini(app.state, m.id, [...picks]);
            if (r.error) { banner = { text: `❌ ${r.error}`, cls: 'red' }; draw(); return; }
            commit(r.state); banner = { text: `🚀 ¡En marcha: ${def.name}!`, cls: '' }; beep(900, 60); draw();
          } }, '✔ Aceptar'));
      }),
      ...active.map((m) => h('div', { class: 'small' }, `▶ ${MINI_ICON[m.id] ?? ''} ${MINIMISSIONS[m.id].name}: faltan ${m.daysLeft} día(s) · ${m.crewIds.map((id) => firstName(s.crew.find((c) => c.id === id))).join(', ')}`)));
  }

  function logPanel() {
    const s = app.state;
    return h('div', { class: 'panel c-cyan' }, h('h2', {}, '📖 Diario de a bordo'),
      h('div', { class: 'log', id: 'bitacora' }, ...s.log.slice(-80).reverse().map((l) => h('div', { class: l.kind }, h('b', {}, `Día ${l.day} `), l.text))));
  }

  /** Lo más importante que Nova debe decir ahora, y a qué apuntar. */
  function coach(sched) {
    const s = app.state;
    if (s.phase === 'reentry') return ['¡Un año completo! 🎉 Ahora hay que volver a la Tierra. Toca INICIAR REENTRADA.', 'feliz', '#reentrada', null];
    if (sched.length) return [`${sched[0]}. Arrástralo a 😴 Sueño en algún turno.`, 'alerta', '[data-job="sueño"]', 'tripulacion'];
    if (isMars(s) && s.flags?.landed && !s.flags?.ascended && s.resources.fuel + fuelRate(s) * Math.max(0, ASCENT_DAY - s.day) < ASCENT_FUEL) {
      return ['⛽ ¡Al ritmo de ahora no vamos a tener combustible para volver! Repara y deja encendida la planta de combustible.', 'alerta', '[data-module^="planta_combustible"]', 'estacion'];
    }
    const evaBad = [0, 1, 2].map((t) => evaGoNoGo(s, t)).findIndex((g) => g.crew.length && !g.go);
    if (evaBad >= 0) {
      const g = evaGoNoGo(s, evaBad);
      const miss = g.items.find((i) => !i.ok);
      return [`La EVA de la ${TURNS[evaBad].split(' ')[1].toLowerCase()} tiene NO GO: falta ${miss.label.replace(/^\S+\s/, '').toLowerCase()}. Mira la casilla 👨‍🚀 EVA.`, 'alerta', '[data-job="eva"]', 'tripulacion'];
    }
    const unprepped = s.alerts.findIndex((a) => EVENTS[a.eventId].prepare.length && !a.prepared.length);
    if (unprepped >= 0) return [`Viene ${EVENTS[s.alerts[unprepped].eventId].name}. ¡Prepárense ahora y será menos grave!`, 'alerta', '#alertas', 'misiones'];
    const left = daysLeft(s);
    const lowRes = ['food', 'water', 'o2'].find((k) => left[k] < 10);
    if (lowRes) return [`¡Queda poca ${{ food: 'comida 🍎', water: 'agua 💧', o2: 'aire 🫧' }[lowRes]}! Pon raciones medias, alguien en ${lowRes === 'food' ? 'cultivo 🌱' : 'producción de agua 💧'} o espera la carga del día ${s.nextResupply}.`, 'alerta', '#recursos', 'resumen'];
    const sick = living().find((c) => c.health < 50);
    if (sick) return [`${firstName(sick)} está enfermo. Pon a alguien en 🩺 Atención médica.`, 'alerta', `[data-crew="${sick.id}"]`, 'tripulacion'];
    const tired = living().find((c) => c.fatigue >= 70);
    if (tired) return [`${firstName(tired)} está muy cansado. Dale un turno de 🛋️ Descanso.`, 'pensando', `[data-crew="${tired.id}"]`, 'tripulacion'];
    const broken = s.modules.find((m) => m.health < 40);
    if (broken) return [`El módulo ${MODULES[broken.type].name} está muy dañado. Pon a alguien en 🔧 Reparación.`, 'alerta', `[data-module="${broken.id}"]`, 'estacion'];
    const weakBone = living().find((c) => c.bone < 85);
    if (weakBone) return [`Los huesos de ${firstName(weakBone)} se debilitan sin gravedad. Dale 🏃 Ejercicio.`, 'pensando', `[data-crew="${weakBone.id}"]`, 'tripulacion'];
    const offer = s.minis.find((m) => m.status === 'oferta');
    if (offer) return [`Hay una minimisión: ${MINIMISSIONS[offer.id].name}. Elige quién va y mira si le alcanza.`, 'pensando', '#minis', 'misiones'];
    if (s.resources.dataStored > 300) return ['Se están juntando muchos datos. Pon a alguien en 📞 Comunicación para mandarlos.', 'pensando', '#recursos', 'resumen'];
    const site = siteOf(s);
    if (site?.nightDays && isNight(site, s.day + 1) && s.resources.battery < s.resources.batteryMax * 0.3) return ['Es de noche y queda poca batería. En la pestaña de la base apaga lo que no sea vital (toca el módulo). El soporte vital y la cabina se apagan al final.', 'alerta', '#estacion', 'estacion'];
    if (s.day === 0 && SC.id === 'marte') return ['¡Empieza el viaje a Marte! Son 210 días sin gravedad: 🏃 ejercicio diario para los huesos y 🛡️ refugio en las tormentas solares. Arrastra a cada uno a su trabajo y toca ▶ AVANZAR.', 'feliz', '#avanzar', null];
    if (s.day === 0 && SC.id !== 'estacion') return [`¡Bienvenidos a ${SC.home}! Aquí hay gravedad baja y más radiación. ${site?.nightDays ? `Ojo: cada tanto llega la noche de ${site.nightDays} días.` : ''} Arrastra a cada astronauta a su trabajo y toca ▶ AVANZAR.`, 'feliz', '#avanzar', null];
    if (s.day === 0) return ['¡Bienvenidos a la estación! En la pestaña 🧑‍🚀 Tripulación eliges qué hace cada astronauta. Cuando estés listo, toca ▶ AVANZAR.', 'feliz', '#avanzar', null];
    return ['Todo bajo control. 👍 Toca ▶ AVANZAR y yo te aviso cuando pase algo.', 'feliz', '#avanzar', null];
  }

  function crewMini() {
    const s = app.state;
    return h('div', { class: 'panel c-pink' }, h('h2', {}, '🧑‍🚀 ¿Cómo están?'),
      h('div', { class: 'mini-crew' }, ...s.crew.map((c) => h('div', { class: 'who', onclick: () => pick('tripulacion') },
        crewAvatar(c, { size: 64 }), h('div', {}, h('b', {}, firstName(c))), h('div', { class: 'small dim' }, MOOD_TEXT[moodOf(c)])))));
  }

  function draw() {
    const s = app.state;
    const sched = validateSchedule(Object.fromEntries(Object.entries(s.schedule).filter(([id]) => s.crew.find((c) => c.id === id)?.alive)))
      .map((e) => { const id = e.split(' ')[0]; const c = s.crew.find((x) => x.id === id); return c ? e.replace(id, c.name) : e; });
    const blocked = sched.length > 0 || !!s.pending || s.phase !== 'ops' || !!phaseDue(s);
    const pct = Math.min(100, (s.day / s.totalDays) * 100);
    mount(root,
      h('div', { class: 'day-head' },
        h('div', {},
          h('h1', { style: { fontSize: '2rem', margin: 0 }, id: 'dia' }, `📅 DÍA ${s.day} de ${s.totalDays}`),
          dayNight(),
          marsLeg(),
          isWeekend(s.day + 1) ? h('div', { class: 'small amber' }, '🗓️ Mañana es fin de semana: día ligero. Descanso y llamadas a casa dan más ánimo; trabajar lo baja un poco.') : null,
          h('div', { class: 'trip' }, h('div', { class: 'trip-fill', style: { width: `${pct}%` } }), h('span', { class: 'trip-ship', style: { left: `${pct}%` } }, DEST), h('span', { class: 'trip-end' }, '🏠'))),
        h('div', { class: 'row' },
          h('button', { id: 'avanzar1', disabled: blocked, onclick: () => advance(false) }, '⏭️ 1 día'),
          h('button', { id: 'avanzar', class: 'big', disabled: blocked, onclick: () => advance(true) }, '▶ AVANZAR'),
          s.phase === 'reentry' ? h('button', { id: 'reentrada', class: 'big warn', onclick: () => go('reentry') }, '🌍 INICIAR REENTRADA') : null,
          s.pending ? h('button', { class: 'warn', onclick: eventModal }, '⚠️ Ver problema') : null)),
      sched.length ? h('div', { class: 'banner red', id: 'horario' }, '😴 ', sched.join(' · '), ' — todos deben dormir al menos un turno.') : null,
      banner ? h('div', { class: `banner ${banner.cls}`, id: 'aviso' }, banner.text) : null,
      tabs([
        { id: 'resumen', label: '🏠 Resumen', color: 'c-blue', badge: ['food', 'water', 'o2'].some((k) => daysLeft(s)[k] < 10) ? '!' : 0 },
        { id: 'tripulacion', label: '🧑‍🚀 Tripulación', color: 'c-pink', badge: sched.length + living().filter((c) => c.health < 50 || c.fatigue >= 70).length },
        { id: 'estacion', label: SC.id === 'estacion' ? '🛰️ Estación' : `${DEST} Base`, color: 'c-violet', badge: s.modules.filter((m) => m.health < 40 || !m.on).length },
        { id: 'misiones', label: '⚠️ Avisos y misiones', color: 'c-amber', badge: s.alerts.length + s.minis.filter((m) => m.status === 'oferta').length },
        { id: 'diario', label: '📖 Diario', color: 'c-cyan' },
      ], tab, pick),
      tab === 'resumen' ? h('div', { class: 'grid2' }, h('div', {}, resources()), h('div', {}, crewMini(), alerts())) : null,
      tab === 'tripulacion' ? crewCards() : null,
      tab === 'estacion' ? ship() : null,
      tab === 'misiones' ? h('div', { class: 'grid2' }, alerts(), minis()) : null,
      tab === 'diario' ? logPanel() : null,
    );
    if (phaseDue(s) && s.phase === 'ops') { if (!document.getElementById('fase')) phaseModal(); }
    else if (s.pending && !document.getElementById('evento')) eventModal();
    else if (!s.pending) {
      const [t, mood, target, where] = coach(sched);
      const elsewhere = where && where !== tab;
      say(elsewhere ? `${t} (Toca la pestaña señalada.)` : t, { mood, target: elsewhere ? `[data-tab="${where}"]` : target, quiet: true });
    }
  }

  draw();
  return () => document.querySelectorAll('.modal-bg').forEach((e) => e.remove());
}
