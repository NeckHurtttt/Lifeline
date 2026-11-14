// Pantalla de operaciones: recursos, nave, tripulación con avatares, alertas, eventos, minimisiones y bitácora, con Nova guiando.
import { tr } from '../../i18n/i18n.js';
import { MOD_CODE, RES_CODE, NODE_CODE } from '../art.js';
import { hatchClue, tryHatch, resolveHatches, WRONG_COST_S } from '../../core/hatches.js';
import { chart } from './report.js';
import { h, mount, bar, modal, fmt, tabs } from '../dom.js';
import { MODULES, INSTRUMENTS, DIFFICULTY, SCENARIOS } from '../../data/catalog.js';
import { siteOf, isNight, daysToNight, daysToDawn } from '../../core/surface.js';
import { canExplore, ensureMap, startExpedition, previewExpedition, tripDays, hasRoverPres, NODE_TYPES } from '../../core/explore.js';
import { phaseDue, resolvePhase, previewPhase, PHASES, inBlackout, radioDelayMin, isMars, ASCENT_FUEL, SEAL_FUEL, planOf, isruPerDay } from '../../core/mars.js';
import { ROLES, TRAITS } from '../../data/crew.js';
import { EVENTS } from '../../data/events.js';
import { MINIMISSIONS } from '../../data/minimissions.js';
import { TASKS, validateSchedule, normalizeSchedule } from '../../core/tasks.js';
import { advanceDay, runUntilInterrupt, daysLeft } from '../../core/sim.js';
import { fastForward, juradoStep } from '../../core/jurado.js';
import { prepareFor, resolveEvent, recommendedOption, previewOption } from '../../core/events.js';
import { acceptMini, previewMini, usesAutoRover } from '../../core/minimissions.js';
import { setPriority } from '../../core/energy.js';
import { restoreRng } from '../../core/rng.js';
import { save } from '../../core/save.js';
import { whoDecides, musicMood, musicUrgency } from '../main.js';
import { alarm, beep, hiss, hissHit, spark, clunk, squeak, zap } from '../audio.js';
import { say, hideGuide } from '../guide.js';
import { crewAvatar, moodOf, MOOD_TEXT } from '../avatar.js';
import { evaGoNoGo, isWeekend, TRESERVE_SECONDS } from '../../core/protocols.js';
import { walkPanel } from '../panels/walk.js';
import { isGuest, mine } from '../coop.js';
import { digPanel, digAvailable } from '../panels/dig.js';
import { autoAssign } from '../../core/autoplan.js';
import { CARGO_PLANS, cleanPanels, replaceBatteries, batteryHealth, gardenStage, BATTERY_PARTS, AUTO_RATION_DAYS } from '../../core/extras.js';
import { inCoop, coopInfo, shareDraft, onDraft, allDrafts } from '../coop.js';
import { radarCanvas, pulseCanvas, liveCanvas, drawBase, icon } from '../viz.js';
import { runTraining } from '../academy.js';
import '../academy2.js';
import { SENSORS } from '../../data/nasa.js';
import { glitch } from '../fx.js';
import { placeOf, FLASH_TYPES, CABLE_COLORS, closeDoor, resolveFlash, modName, allDone, stepDone, flashLeft, leakReading, probeLeak, turnValve, connectCable, pressProtocol, protocolOrder, pressCode, peekCode, adjustPower, timingPress, timingPos, timingZone } from '../../core/flash.js';

// Modo niños: menos trabajos, energía en una barra y Nova reparte sola cada día.
const KID_TASKS = new Set(['cultivo', 'produccion', 'reparacion', 'experimentos', 'medico', 'ejercicio', 'descanso']);

// La noche (sueño o campamento) y la pre-respiración son automáticas: no se arrastran.
const AUTO_TASKS = new Set(['sueño', 'campamento', 'prerespiracion']);
const TASK_IDS = Object.keys(TASKS).filter((t) => t !== 'trabajo' && !['sueño', 'campamento'].includes(t));
const TASK_ICON = { mantenimiento: '🧹', reparacion: '🔧', experimentos: '🔬', cultivo: '🌱', produccion: '💧', medico: '🩺', ejercicio: '🏃', descanso: '🛋️', sueño: '😴', comunicacion: '📞', eva: '👨‍🚀', refugio: '🛡️', prerespiracion: '🫁', campamento: '⛺' };
const TURNS = ['🌅 Mañana', '☀️ Tarde', '🌙 Noche'];
const TASK_DESC = {
  mantenimiento: 'Cuida los módulos para que no se rompan.', reparacion: 'Arregla módulos dañados.', experimentos: 'Hace ciencia en el laboratorio.',
  cultivo: 'Cuida el invernadero: da comida.', produccion: 'Fabrica agua.', medico: 'Cura a los enfermos.', ejercicio: 'Mantiene fuertes los huesos.',
  descanso: 'Quita el cansancio y sube el ánimo.', sueño: 'Dormir: ¡obligatorio una vez al día!', comunicacion: 'Manda los datos a la Tierra y habla con la familia.',
  eva: 'Sale afuera a arreglar paneles y antena. Siempre en pareja y con pre-respiración antes.', refugio: 'Se esconde de la radiación.',
  prerespiracion: 'Automática: respira oxígeno puro antes de una EVA de la tarde para no enfermarse al salir.',
  campamento: 'Duerme en la esclusa a baja presión: así ya está listo para la EVA de la mañana (como en la NASA).',
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
  let keyFn = null;
  const setKey = (fn) => { keyFn = fn; };
  const onKey = (e) => { if (!document.querySelector('.modal-bg')) keyFn?.(e); };
  document.addEventListener('keydown', onKey);
  let tab = app.opsTab ?? 'resumen';
  let shift = Math.min(app.opsShift ?? 0, 1);
  const pick = (t) => { tab = t; app.opsTab = t; beep(760, 30); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const living = () => app.state.crew.filter((c) => c.alive);
  const commit = (state) => { app.state = state; save(state); };
  const firstName = (c) => c.name.split(' ')[0];
  const SC = SCENARIOS[app.state.scenarioId] ?? SCENARIOS.estacion;
  const DEST = { estacion: '🛰️', gateway: '🌘', luna: '🌙', marte: '🔴' }[SC.id] ?? '🛰️';
  const HOME = SC.home.charAt(0).toUpperCase() + SC.home.slice(1);

  function handle(interrupt) {
    const s = app.state;
    if (!interrupt) { banner = { text: `📅 Día ${s.day}: todo tranquilo.`, cls: '' }; return; }
    const k = interrupt.kind;
    if (k === 'alerta') { const ev = EVENTS[interrupt.data.eventId]; banner = { text: `⚠️ AVISO: ${EVENT_ICON[ev.id] ?? ''} ${ev.name} en ${interrupt.data.etaDays} día(s).`, cls: '' }; alarm('aviso'); }
    else if (k === 'evento' || k === 'flash') { banner = null; } // el sonido lo pone la ventana del evento, según la gravedad
    else if (k === 'mini') { banner = { text: `🎯 Nueva minimisión: ${MINI_ICON[interrupt.data.id] ?? ''} ${MINIMISSIONS[interrupt.data.id].name}.`, cls: '' }; beep(900, 120); }
    else if (k === 'muerte') { banner = { text: interrupt.data.join(' · '), cls: 'red' }; alarm('emergencia'); }
    else if (k === 'expedicion') { banner = { text: `🗺️ ${interrupt.data.text}`, cls: interrupt.data.ok ? '' : 'red' }; beep(interrupt.data.ok ? 1100 : 300, 150); }
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

  const kids = () => !!app.kids;
  const autoOn = () => kids() && app.autoPlan !== false && !isGuest();
  function autoNow() { commit(autoAssign(app.state)); beep(1000, 60); banner = { text: '🪄 Nova repartió los trabajos según lo que falta.', cls: '' }; draw(); }
  function autoBar() {
    return h('div', { class: 'row', id: 'auto-reparto', style: { margin: '.3rem 0' } },
      h('button', { class: 'big', onclick: autoNow }, '🪄 Reparto automático'),
      kids() ? h('label', { class: 'small row' }, h('input', { type: 'checkbox', checked: app.autoPlan !== false, onchange: (e) => { app.autoPlan = e.target.checked; draw(); } }), 'Nova reparte sola cada día') : null);
  }

  let clock = null;
  let speed = 0;
  function stopClock() { clearInterval(clock); clock = null; speed = 0; }
  function play(sp) {
    stopClock();
    if (!sp) { draw(); return; }
    speed = sp;
    clock = setInterval(() => {
      const st = app.state;
      if (st.pending || st.flash || st.phase !== 'ops' || phaseDue(st) || document.querySelector('.modal-bg')) { stopClock(); draw(); return; }
      const r = advanceDay(autoOn() ? autoAssign(st) : st);
      commit(r.state);
      if (r.interrupt) { stopClock(); handle(r.interrupt); }
      draw();
    }, 1000 / sp);
    draw();
  }

  function advance(all) {
    stopClock();
    const plan = autoOn() ? autoAssign : null;
    const r = all ? runUntilInterrupt(app.state, 365, plan) : advanceDay(plan ? plan(app.state) : app.state);
    commit(r.state);
    handle(r.interrupt);
    draw();
  }

  // Evento relámpago: 1 o 2 minijuegos contra reloj (escotillas, fuga, válvulas, cables, protocolo).
  // Todo se calcula desde app.state.flash (con la hora límite adentro), así se puede redibujar cuando llega
  // un cambio de otro jugador sin perder la cuenta. Solo el anfitrión (o quien juega solo) cierra el evento.
  let flashTimer = null; let flashKey = null; let flashAlarm = ''; let cableSel = null; let codeSeen = {}; let codeUntil = {}; let flashRaf = null;
  let flashRadar = null;
  const flashClose = () => { flashRadar = null; document.getElementById('relampago')?.closest('.modal-bg')?.remove(); };
  const flashOff = () => { clearInterval(flashTimer); if (flashKey) document.removeEventListener('keydown', flashKey); flashKey = null; };
  const VALVE_ARROW = ['↑', '→', '↓', '←'];
  const CABLE_HEX = { rojo: '#ff4b4b', azul: '#4b9dff', amarillo: '#ffd23d', verde: '#4dff88', blanco: '#e8e8e8' };
  const STEP_TITLE = { doors: '🚪 Cerrar escotillas', leak: '🔍 Encontrar la fuga', valves: '🔧 Girar válvulas', cables: '🔌 Conectar cables', protocol: '📋 Seguir el protocolo', code: '🔢 Código de memoria', power: '⚡ Repartir energía', timing: '🎯 En el momento justo' };
  const STEP_HELP = {
    doors: 'Toca cada escotilla (o su número en el teclado) para cerrarla.',
    leak: 'Toca partes del casco: el número es qué tan fuerte se oye el silbido. 100 = ahí está el agujero.',
    valves: 'Cada toque gira la válvula un cuarto de vuelta. Déjalas apuntando como su marca. ═ = giran juntas.',
    cables: 'Toca un cable de la izquierda y después su borne a la derecha. Si te equivocas salta una chispa y pierdes tiempo.',
    protocol: 'Aprieta los pasos en el orden correcto. Un paso equivocado cuesta tiempo.',
    code: 'Toca MOSTRAR, memoriza el código y tecléalo. Un número mal y empiezas de nuevo.',
    power: 'Dale a cada sistema justo la energía que pide. No hay más de la que ves: a veces hay que quitarle a uno para darle a otro.',
    timing: 'Aprieta ¡AHORA! (o la barra espaciadora) cuando la marca esté dentro de la zona verde.',
  };
  const STEP_HELP_BLIND = 'Las alarmas no dan números: guíate solo por el color. Más rojo = más cerca del agujero.';
  function flashFx(kind) {
    const m = document.querySelector('#relampago')?.closest('.modal');
    if (kind === 'mal') { spark(); m?.classList.remove('chispa'); void m?.offsetWidth; m?.classList.add('chispa'); }
    if (kind === 'bien') beep(900, 60, 'triangle', 0.05);
  }
  function flashModal() {
    const s = app.state;
    const f = s.flash;
    flashOff();
    if (!f.deadline && !isGuest()) { commit({ ...s, flash: { ...f, deadline: Date.now() + f.seconds * 1000 } }); return flashModal(); }
    const T = FLASH_TYPES[f.type];
    const target = s.modules.find((m) => m.id === f.target);
    if (!target) { if (!isGuest()) { commit({ ...s, flash: null }); draw(); } return; }
    const names = inCoop() ? coopInfo().players.filter((p) => !p.away).map((p) => p.name) : app.players.map((p) => p.name);
    const owner = (i) => (names.length > 1 ? names[i % names.length] : null);
    const left = () => flashLeft(app.state.flash ?? f);
    const canClose = (i) => !inCoop() || mine(owner(i)) || left() <= f.seconds / 2;
    const finish = () => {
      flashOff();
      if (!app.state.flash) return;
      const r = resolveFlash(app.state);
      flashClose(); cableSel = null;
      hiss(false);
      document.body.classList.remove('alarma-roja');
      // COMBO: emergencias resueltas seguidas dan fama extra (+1, +2, +3…).
      const combo = r.success ? (s.flashCombo ?? 0) + 1 : 0;
      const bonus = combo >= 2 ? combo - 1 : 0;
      commit({ ...r.state, flashCombo: combo, reputation: (r.state.reputation ?? 0) + bonus });
      banner = { text: `${bonus ? `⚡ COMBO ×${combo}: +${bonus} fama. ` : ''}${r.log.join(' ')}`, cls: r.success ? '' : 'red' };
      if (bonus) document.body.classList.add('combo-flash'), setTimeout(() => document.body.classList.remove('combo-flash'), 900);
      if (r.success) [0, 120, 240].forEach((d, k) => setTimeout(() => beep([660, 880, 1320][k], 140, 'triangle', 0.06), d)); else alarm('emergencia');
      if (app.state.phase === 'report') handle({ kind: 'fin' });
      draw();
    };
    // Aplica una acción: guarda, suena y redibuja (o termina si ya está todo).
    const act = (next, good = true) => {
      if (!app.state.flash) return;
      commit(next);
      flashFx(good ? 'bien' : 'mal');
      if (allDone(app.state.flash) && !isGuest()) finish(); else flashModal();
    };
    const shut = (id) => {
      if (!app.state.flash || app.state.flash.closed?.[id]) return;
      clunk();
      act(closeDoor(app.state, id));
    };

    const doorsView = () => {
      // Cuadrícula doble: módulos en las casillas impares y escotillas entre ellos.
      const xs = s.modules.map((m) => m.x); const ys = s.modules.map((m) => m.y);
      const x0 = Math.min(...xs); const y0 = Math.min(...ys);
      const W = Math.max(...xs) - x0 + 1; const H = Math.max(...ys) - y0 + 1;
      const cols = Array.from({ length: 2 * W - 1 }, (_, i) => (i % 2 ? 'minmax(.8rem, 1.6rem)' : 'minmax(1.2rem, 4.2rem)')).join(' ');
      const rows = Array.from({ length: 2 * H - 1 }, (_, i) => (i % 2 ? '1.6rem' : '2.6rem')).join(' ');
      const near = new Set(f.doors.flatMap((d) => d.split('|')));
      const cells = s.modules.map((m) => h('div', {
        class: `flash-mod ${m.id === f.target ? 'golpe' : near.has(m.id) ? 'vecino' : ''}`,
        style: { gridColumn: 2 * (m.x - x0) + 1, gridRow: 2 * (m.y - y0) + 1 },
      }, m.id === f.target ? `${T.icon} ${MOD_CODE[m.type]}` : MOD_CODE[m.type]));
      const doors = f.doors.map((d, i) => {
        const [a, b] = d.split('|').map((id) => s.modules.find((m) => m.id === id));
        const horiz = a.y === b.y;
        const col = horiz ? 2 * (Math.min(a.x, b.x) - x0) + 2 : 2 * (a.x - x0) + 1;
        const row = horiz ? 2 * (a.y - y0) + 1 : 2 * (Math.min(a.y, b.y) - y0) + 2;
        const done = !!f.closed?.[d];
        const who = owner(i);
        return h('button', {
          class: `flash-door ${done ? 'cerrada' : ''} ${f.stuck?.[d] && !done ? 'atascada' : ''} ${horiz ? 'v' : 'h'}`, 'data-door': d, 'data-key': i + 1,
          disabled: done || !canClose(i), title: who ? `Cierra ${who}` : 'Cerrar escotilla',
          style: { gridColumn: col, gridRow: row }, onclick: () => shut(d),
        }, done ? '■' : f.stuck?.[d] ? (f.half?.[d] ? `${i + 1}½` : `${i + 1}!`) : String(i + 1));
      });
      return [
        h('div', { class: 'flash-grid', style: { gridTemplateColumns: cols, gridTemplateRows: rows } }, ...cells, ...doors),
        Object.keys(f.stuck ?? {}).length ? h('div', { class: 'small amber' }, '⚠ Una escotilla está atascada (!): hay que tocarla dos veces.') : null,
        names.length > 1 ? h('div', { class: 'small' }, ...f.doors.map((d, i) => h('span', { class: `chip ${f.closed?.[d] ? 'ok' : ''}` }, `${i + 1}: ${owner(i)}`)),
          inCoop() ? h('div', { class: 'small amber' }, 'Cada uno cierra las suyas. A la mitad del tiempo, cualquiera puede ayudar.') : null) : null,
      ];
    };
    const leakView = (st, i) => h('div', { class: 'flash-casco', style: { gridTemplateColumns: `repeat(${st.w}, 1fr)` } },
      ...Array.from({ length: st.w * st.h }, (_, c) => {
        const seen = !!st.probed[c];
        const v = seen ? leakReading(st, c) : null;
        const hole = seen && c === st.hole;
        return h('button', {
          class: `flash-panel ${seen ? 'medido' : ''} ${hole ? 'agujero' : ''}`, 'data-cell': c,
          style: seen && !hole ? { '--calor': v / 100 } : {}, disabled: seen,
          onclick: () => { if (c === st.hole) hissHit(); else beep(200 + leakReading(st, c) * 9, 90, 'sine', 0.05); act(probeLeak(app.state, i, c), c === st.hole); },
        }, hole ? '🩹' : seen ? (st.blind ? '●' : String(v)) : '▒');
      }));
    const valvesView = (st, i) => h('div', { class: 'flash-valvulas' },
      ...st.angles.flatMap((a, v) => {
        const ok = a === st.target[v];
        const link = st.links.some((l) => l[0] === v);
        return [
          h('button', { class: `flash-valvula ${ok ? 'ok' : ''}`, 'data-valve': v, onclick: () => { squeak(); act(turnValve(app.state, i, v)); } },
            h('span', { class: 'flecha', style: { transform: `rotate(${a * 90}deg)` } }, '▲'),
            h('small', {}, `meta ${VALVE_ARROW[st.target[v]]}`)),
          v < st.angles.length - 1 ? h('span', { class: `flash-eslabon ${link ? 'unida' : ''}` }, link ? '═' : '') : null,
        ];
      }));
    const cablesView = (st, i) => {
      const placed = Object.values(st.conn);
      const leftCol = Array.from({ length: st.n }, (_, w) => {
        const c = CABLE_COLORS[w]; const done = st.conn[w] != null;
        return h('button', {
          class: `flash-cable ${cableSel === w ? 'elegido' : ''} ${done ? 'listo' : ''}`, 'data-wire': w, disabled: done,
          style: { '--cable': CABLE_HEX[c], gridRow: w + 1 }, onclick: () => { cableSel = cableSel === w ? null : w; beep(500, 30, 'square', 0.03); flashModal(); },
        }, `● ${c.toUpperCase()}`);
      });
      const rightCol = Array.from({ length: st.n }, (_, slot) => {
        const wire = st.right[slot]; const done = placed.includes(slot);
        const label = st.chart ? st.systems[slot] : `● ${CABLE_COLORS[wire].toUpperCase()}`;
        return h('button', {
          class: `flash-borne ${done ? 'listo' : ''}`, 'data-slot': slot, disabled: done || cableSel == null,
          style: { gridRow: slot + 1, ...(!st.chart || done ? { '--cable': CABLE_HEX[CABLE_COLORS[wire]] } : {}) },
          onclick: () => { const r = connectCable(app.state, i, cableSel, slot); if (r.ok) zap(); cableSel = null; act(r.state, r.ok); },
        }, label);
      });
      // Líneas de los cables ya conectados.
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 100 ${st.n * 10}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('flash-lineas'); svg.style.gridRow = `1 / span ${st.n}`;
      for (const [w, slot] of Object.entries(st.conn)) {
        const e = document.createElementNS(NS, 'line');
        for (const [k, v] of Object.entries({ x1: 0, y1: Number(w) * 10 + 5, x2: 100, y2: slot * 10 + 5, stroke: CABLE_HEX[CABLE_COLORS[w]], 'stroke-width': 2.5 })) e.setAttribute(k, v);
        svg.append(e);
      }
      return [
        st.chart ? h('div', { class: 'flash-esquema small' }, '📄 Esquema: ', ...Array.from({ length: st.n }, (_, w) => h('span', { class: 'chip', style: { color: CABLE_HEX[CABLE_COLORS[w]] } }, `${CABLE_COLORS[w]} → ${st.systems[st.right.indexOf(w)]}`))) : null,
        h('div', { class: 'flash-cables', style: { gridTemplateRows: `repeat(${st.n}, 2.3rem)` } },
          h('div', { class: 'col' }, ...leftCol), svg, h('div', { class: 'col' }, ...rightCol)),
      ];
    };
    const protocolView = (st, i) => {
      const order = protocolOrder(st, s.seed ?? 1);
      return [
        h('ol', { class: 'flash-lista small' }, ...st.items.map((it, k) => h('li', { class: k < st.progress ? 'hecho' : k === st.progress ? 'ahora' : '' }, it))),
        h('div', { class: 'flash-botones' }, ...order.map((k) => h('button', {
          class: `flash-paso-btn ${k < st.progress ? 'hecho' : ''}`, 'data-item': k, disabled: k < st.progress,
          onclick: () => { const r = pressProtocol(app.state, i, k); act(r.state, r.ok); },
        }, st.items[k]))),
      ];
    };
    const codeVisible = (i) => (codeUntil[`${f.day}-${i}`] ?? 0) > Date.now();
    const codeView = (st, i) => {
      const key = `${f.day}-${i}`;
      const vis = codeVisible(i);
      const shown = vis ? st.digits.map(String) : st.digits.map((d, k) => (k < st.progress ? String(d) : '_'));
      return [
        h('div', { class: `flash-codigo ${vis ? 'visible' : ''}` }, shown.join(' ')),
        h('div', { class: 'flash-teclado' }, ...st.pad.map((d) => h('button', { class: 'flash-tecla', 'data-digit': d, disabled: vis,
          onclick: () => { const r = pressCode(app.state, i, d); beep(r.ok ? 700 + d * 40 : 150, 60, 'square', 0.04); act(r.state, r.ok); } }, String(d)))),
        h('button', { class: 'small', 'data-peek': i, disabled: vis, onclick: () => {
          const first = !codeSeen[key]; codeSeen[key] = true;
          codeUntil[key] = Date.now() + (first ? st.show : 2) * 1000;
          if (first) flashModal(); else act(peekCode(app.state), false);
        } }, codeSeen[key] ? '👁 Ver otra vez (−2 s)' : `👁 MOSTRAR (${st.show} s)`),
      ];
    };
    const powerView = (st, i) => {
      const used = st.have.reduce((a, b) => a + b, 0); const free = st.total - used;
      const kw = (n) => `${fmt(n * st.unit, st.unit % 1 ? 1 : 0)} kW`;
      return [
        h('div', { class: 'small amber' }, st.unit === 1 ? `Libres: ${free} barras` : `Libres: ${free} barras · cada barra = ${fmt(st.unit, 1)} kW`),
        ...st.names.map((n, j) => {
          const ok = st.have[j] === st.need[j];
          return h('div', { class: `flash-energia ${ok ? 'ok' : ''}`, 'data-power': j },
            h('span', { class: 'nombre' }, n),
            h('button', { class: 'menos', 'data-power-down': j, disabled: st.have[j] <= 0, onclick: () => { beep(300, 40, 'square', 0.03); act(adjustPower(app.state, i, j, -1)); } }, '−'),
            h('span', { class: 'barras' }, '▮'.repeat(st.have[j]) + '▯'.repeat(Math.max(0, 6 - st.have[j]))),
            h('button', { class: 'mas', 'data-power-up': j, disabled: free <= 0, onclick: () => { beep(500, 40, 'square', 0.03); act(adjustPower(app.state, i, j, 1)); } }, '+'),
            h('span', { class: 'pide' }, st.unit === 1 ? `pide ${st.need[j]}` : `pide ${kw(st.need[j])}`));
        }),
      ];
    };
    const timingView = (st, i) => {
      const c = timingZone(st);
      return [
        h('div', { class: 'flash-pista', 'data-timing': i },
          h('div', { class: 'zona', style: { left: `${(c - st.zone / 2) * 100}%`, width: `${st.zone * 100}%` } }),
          h('div', { class: 'marca' })),
        h('div', { class: 'row' },
          h('button', { class: 'big flash-ahora', 'data-now': i, onclick: () => timingHit(i) }, '🎯 ¡AHORA!'),
          h('span', { class: 'small' }, `Aciertos: ${st.hits} de ${st.need}`)),
      ];
    };
    const timingHit = (i) => {
      const st = app.state.flash?.steps?.[i]; if (!st || stepDone(app.state.flash, st)) return;
      const pos = timingPos(st, performance.now() / 1000); const c = timingZone(st);
      const hit = Math.abs(pos - c) <= st.zone / 2;
      if (hit) beep(1100, 80, 'triangle', 0.06);
      const r = timingPress(app.state, i, hit); act(r.state, r.ok);
    };
    const VIEW = { doors: doorsView, leak: leakView, valves: valvesView, cables: cablesView, protocol: protocolView, code: codeView, power: powerView, timing: timingView };
    const stepsDone = f.steps.filter((st) => stepDone(f, st)).length;

    const content = [
      h('div', { class: 'radar-caja' }, h('div', { class: 'big-ico code alerta' }, '⚡ EVENTO RELÁMPAGO'), flashRadar ??= radarCanvas([{ ang: Math.random() * 6, dist: 1, label: T.name.split(' ')[0].toUpperCase(), speed: 0.95 / f.seconds }], 130)),
      h('h2', { class: 'red' }, `${T.icon} ${T.name}`),
      h('p', { style: { fontSize: '1.05rem' } }, T.text(modName(target))),
      h('div', { class: 'flash-tiempo' }, h('div', { class: 'flash-barra', id: 'flash-barra' }), h('b', { id: 'flash-seg' }, `${Math.ceil(left())} s`)),
      f.steps.length > 1 ? h('div', { class: 'small amber' }, `Pasos listos: ${stepsDone} de ${f.steps.length}. Si hacen solo uno, el daño es a medias.`) : null,
      ...f.steps.map((st, i) => {
        const done = stepDone(f, st);
        return h('section', { class: `flash-paso ${done ? 'hecho' : ''}`, 'data-step': st.kind },
          h('h3', {}, `${done ? '✅' : `${i + 1}.`} ${STEP_TITLE[st.kind]}`),
          done ? null : h('p', { class: 'small' }, st.blind ? STEP_HELP_BLIND : STEP_HELP[st.kind]),
          ...(done ? [] : [VIEW[st.kind](st, i)].flat()));
      }),
      s.kids ? h('p', { class: 'small green' }, '🧒 Si no alcanzas, el módulo solo se rompe y se puede reparar.') : null,
    ];
    const box = document.getElementById('relampago');
    if (box) box.replaceChildren(...content.flat().filter(Boolean).map((x) => (typeof x === 'string' ? document.createTextNode(x) : x)));
    else {
      modal(h('div', { id: 'relampago' }, ...content), { grave: true });
      document.body.classList.add('sacudon', 'alarma-roja');
      setTimeout(() => document.body.classList.remove('sacudon'), 600);
    }
    const tick = () => {
      const l = left();
      const bar = document.getElementById('flash-barra');
      if (!bar) { flashOff(); return; }
      bar.style.width = `${(l / f.seconds) * 100}%`;
      document.getElementById('flash-seg').textContent = `${Math.ceil(l)} s`;
      bar.classList.toggle('roja', l <= 3);
      musicUrgency(1 - l / f.seconds);
      if (document.querySelector('.flash-codigo.visible') && !f.steps.some((st, i) => st.kind === 'code' && codeVisible(i))) flashModal();
      document.querySelectorAll('.flash-door').forEach((b, i) => { if (!f.closed?.[f.doors[i]] && canClose(i)) b.disabled = false; });
      if (!isGuest() && (l <= 0 || allDone(app.state.flash))) finish();
      if (isGuest() && !app.state.flash) { flashOff(); flashClose(); hiss(false); document.body.classList.remove('alarma-roja'); }
    };
    setKey(null);
    flashKey = (e) => {
      const live = app.state.flash; if (!live) return;
      if (e.key === ' ') { const i = live.steps.findIndex((st) => st.kind === 'timing' && !stepDone(live, st)); if (i >= 0) { e.preventDefault(); timingHit(i); } return; }
      if (!/^[0-9]$/.test(e.key)) return;
      const n = Number(e.key);
      // Si hay un código por teclear, los números van al código; si no, a las escotillas.
      const ci = live.steps.findIndex((st, i) => st.kind === 'code' && !stepDone(live, st) && codeSeen[`${f.day}-${i}`] && !codeVisible(i));
      if (ci >= 0) { e.preventDefault(); const r = pressCode(app.state, ci, n); beep(r.ok ? 700 + n * 40 : 150, 60, 'square', 0.04); act(r.state, r.ok); return; }
      if (live.doors.length && n >= 1 && n <= live.doors.length && canClose(n - 1)) { e.preventDefault(); shut(live.doors[n - 1]); }
    };
    // Marca que se mueve en los minijuegos de "momento justo".
    cancelAnimationFrame(flashRaf);
    const anim = () => {
      const tracks = document.querySelectorAll('#relampago .flash-pista');
      if (!tracks.length) return;
      for (const tr of tracks) {
        const st = app.state.flash?.steps?.[Number(tr.dataset.timing)];
        if (st) tr.querySelector('.marca').style.left = `${timingPos(st, performance.now() / 1000) * 100}%`;
      }
      flashRaf = requestAnimationFrame(anim);
    };
    flashRaf = requestAnimationFrame(anim);
    document.addEventListener('keydown', flashKey);
    flashTimer = setInterval(tick, 200);
    tick();
    const tag = `${f.day}-${f.target}`;
    if (flashAlarm !== tag) { flashAlarm = tag; alarm('emergencia'); hideGuide(); if (T.hiss) hiss(true); }
  }

  function eventModal() {
    const s = app.state;
    const p = s.pending;
    const ev = EVENTS[p.eventId];
    const control = DIFFICULTY[s.difficulty].control;
    const rec = inBlackout(s) ? null : recommendedOption(p.eventId, s);
    let timer = null;
    let offVotes = null;
    const choose = (optId, bad, viaHatch = null) => {
      clearInterval(timer); offVotes?.();
      const rng = restoreRng(app.state.rng);
      const r = viaHatch === null ? resolveEvent(app.state, p.eventId, p.severity, optId, rng) : resolveHatches(app.state, viaHatch, rng);
      close();
      commit({ ...r.state, rng: rng.state() });
      banner = { text: r.log.join(' '), cls: bad ? 'red' : '' };
      beep(bad ? 300 : 1000, 120);
      if (app.state.phase === 'report') handle({ kind: 'fin' });
      draw();
    };
    let left = TRESERVE_SECONDS[s.difficulty];
    const hatchLog = h('div', { class: 'small', id: 'escotillas-log' });
    const clue = ev.id === 'despresurizacion' ? hatchClue(s) : null;
    const hatchPanel = clue ? h('div', { class: 'escotillas', id: 'escotillas' },
      h('div', { class: 'small' }, 'PANEL DE ESCOTILLAS. La tripulación espera en la cabina. Cierra la escotilla del módulo donde crees que está la fuga.'),
      h('div', { class: 'small amber' }, clue.text),
      h('div', { class: 'hatch-grid', style: { gridTemplateColumns: `repeat(${Math.max(...s.modules.map((m) => m.x)) + 1}, 1fr)` } },
        ...s.modules.map((m) => h('button', {
          class: 'hatch', 'data-hatch': m.id, disabled: m.type === 'cabina' || m.health <= 0, style: { gridColumn: m.x + 1, gridRow: m.y + 1 },
          onclick: (e) => {
            const t = tryHatch(app.state, m.id);
            hatchLog.prepend(h('div', { class: t.found ? 'green' : 'red' }, t.text));
            if (t.found) { beep(1100, 150); clearInterval(timer); setTimeout(() => choose(null, false, true), 900); return; }
            e.currentTarget.disabled = true; e.currentTarget.classList.add('mal'); beep(300, 80);
            left = Math.max(0, left - WRONG_COST_S);
            const el = document.getElementById('treserve'); if (el) el.textContent = `${left} s`;
            if (left <= 0) choose('tarde', true);
          } }, MOD_CODE[m.type]))),
      hatchLog,
      h('div', { class: 'small dim' }, 'También puedes elegir una de las opciones de abajo.')) : null;
    const who = whoDecides(app, roleFor(p.eventId));
    // En línea: los demás pueden sugerir una opción; quien decide ve los votos.
    const voteKey = `${s.day}-${p.eventId}`;
    const paintVotes = () => {
      const votes = Object.entries(allDrafts()).filter(([k, v]) => k.startsWith('voto:') && v?.key === voteKey);
      for (const o of ev.options) {
        const el = document.getElementById(`votos-${o.id}`);
        if (!el) continue;
        const names = votes.filter(([, v]) => v.opt === o.id).map(([k]) => k.slice(5));
        el.textContent = names.length ? ` 🗳️ ${names.join(', ')}` : '';
      }
    };
    const close = modal(h('div', { id: 'evento' },
      h('div', { class: `big-ico code ${ev.kind === '+' ? '' : 'alerta'}` }, ev.kind === '+' ? 'BUENO' : ev.disaster ? 'EMERGENCIA' : 'ALERTA'),
      h('h2', { class: p.severity === 'grave' ? 'red' : ev.kind === '+' ? 'green' : 'amber' }, ev.name),
      h('div', { class: 'small' }, { leve: '🟢 Poco grave', media: '🟠 Grave', grave: '🔴 ¡Muy grave!' }[p.severity]),
      h('p', { style: { clear: 'both', fontSize: '1.1rem' } }, ev.text[p.severity]),
      p.prepared?.length ? h('p', { class: 'small green' }, '✔ Se prepararon antes: ayuda.') : null,
      ev.procedure ? h('p', { class: 'small' }, '📋 ', ev.procedure) : null,
      isMars(s) ? h('p', { class: 'small amber' }, inBlackout(s) ? '📵 Conjunción solar: Control de Misión no puede ayudar. Decide tu tripulación.' : `📡 Control de Misión responde con ${radioDelayMin(s)} min de retraso: la tripulación decide primero.`) : null,
      ev.countdown && !kids() ? h('div', { class: 'treserve' }, '⏱️ Tiempo de reserva: ', h('b', { id: 'treserve' }, `${left} s`), h('span', { class: 'small dim' }, ' — si llega a 0 sin decidir, la presión baja al mínimo.')) : null,
      hatchPanel,
      who ? h('p', { class: 'small' }, h('span', { class: 'tag' }, `decide ${who}`)) : null,
      h('div', {}, ...ev.options.filter((o) => !o.hidden).map((o) => {
        const pre = previewOption(s, p.eventId, o.id);
        const effects = pre && !pre.ok ? o.failEffects[p.severity] : o.effects[p.severity];
        return h('div', { class: `option ${control !== 'retraso' && o.id === rec ? 'sel' : ''}` },
          h('button', { 'data-option': o.id, disabled: !mine(who), title: mine(who) ? undefined : `Decide ${who}`, onclick: () => choose(o.id, pre && !pre.ok) }, o.label),
          control !== 'retraso' && o.id === rec ? h('span', { class: 'chip ok' }, '👍 recomendado') : null,
          inCoop() && who && !mine(who) ? h('button', { class: 'small', 'data-sugerir': o.id, onclick: () => { shareDraft(`voto:${coopInfo().name}`, { key: voteKey, opt: o.id }); paintVotes(); beep(900, 40); } }, '🗳️ Sugerir esta') : null,
          inCoop() ? h('span', { class: 'small amber', id: `votos-${o.id}` }) : null,
          pre ? h('div', { class: 'que-pasa', style: { width: '100%' } },
            pre.ok ? h('b', { class: 'green' }, `✔ Funciona: lo hace ${firstName(pre.who)}. `) : h('b', { class: 'red' }, `✖ No alcanza: ${firstName(pre.who)} no sabe lo suficiente. `),
            kids() ? null : `${pre.parts.map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${x.value}`).join(' · ')} = ${pre.total} de ${pre.need}`) : null,
          h('div', { style: { width: '100%' } }, h('span', { class: 'small dim' }, 'Lo que pasa: '), ...chips(effects)));
      })),
    ), { grave: p.severity === 'grave' });
    if (inCoop()) { paintVotes(); offVotes = onDraft((k) => { if (!document.getElementById('evento')) offVotes?.(); else if (k.startsWith('voto:')) paintVotes(); }); }
    // Sonido según la gravedad.
    if (ev.kind === '+') beep(1100, 120, 'triangle'); else if (p.severity === 'grave') alarm('emergencia'); else if (p.severity === 'media') alarm('aviso'); else beep(620, 120, 'triangle');
    if (ev.countdown && !kids()) {
      timer = setInterval(() => {
        left -= 1;
        const el = document.getElementById('treserve');
        if (!el) { clearInterval(timer); return; }
        el.textContent = `${left} s`;
        if (left <= 10) { el.classList.add('red'); beep(440, 60); }
        if (left <= 0) { if (mine(who)) choose('tarde', true); else clearInterval(timer); }
      }, 1000);
    }
    say(ev.countdown && kids() ? '¡Hay una fuga de aire! 🫧 Toca el módulo donde crees que está o elige la opción 👍 recomendada. Sin apuro.' : ev.countdown ? '¡Despresurización! Sigan el protocolo: decidan antes de que se acabe el tiempo de reserva. ⏱️' : `¡${ev.name}! Mira cada opción: abajo dice si funciona y qué pasa con cada una.`, { mood: ev.kind === '+' ? 'feliz' : 'alerta', target: '#evento' });
  }

  function phaseModal() {
    const s = app.state;
    const phase = phaseDue(s);
    const P = PHASES[phase];
    const pre = previewPhase(s, phase);
    const list = h('ul', { class: 'plain steps' }, ...P.steps.map((t, i) => h('li', { 'data-fase': i }, t)));
    const out = h('div', { class: 'small', style: { marginTop: '.5rem' } });
    let close = null;
    // Protección planetaria: sellar las muestras pesa más (pide combustible). Se puede elegir no hacerlo.
    const canSeal = phase === 'ascenso' && s.resources.fuel >= ASCENT_FUEL + SEAL_FUEL;
    const sealBox = phase === 'ascenso' ? h('input', { type: 'checkbox', id: 'sellar', checked: canSeal, disabled: !canSeal }) : null;
    const start = h('button', { class: 'big', id: 'iniciarFase', onclick: async () => {
      start.disabled = true;
      if (sealBox) sealBox.disabled = true;
      for (let i = 0; i < P.steps.length; i++) {
        list.children[i].classList.add('now'); beep(600 + i * 80, 80);
        await new Promise((r) => setTimeout(r, 700));
        list.children[i].classList.remove('now'); list.children[i].classList.add('done');
      }
      const r = resolvePhase(app.state, phase, { seal: sealBox ? sealBox.checked : true });
      commit(r.state);
      out.replaceChildren(...r.log.map((t) => h('div', { class: r.ok ? 'green' : 'red' }, t)));
      alarm(r.ok ? 'aviso' : 'emergencia');
      start.replaceWith(h('button', { class: 'big', id: 'seguirFase', onclick: () => { close(); if (app.state.phase === 'report') go('report'); else draw(); } }, 'CONTINUAR ▶'));
    } }, phase === 'edl' ? '🪂 ¡A ATERRIZAR!' : '🚀 ¡DESPEGAR!');
    close = modal(h('div', { id: 'fase' },
      h('div', { class: 'big-ico code' }, phase === 'edl' ? 'EDL' : 'ASCENSO'),
      h('h2', {}, P.title),
      h('p', { style: { clear: 'both' } }, P.desc),
      list,
      pre ? h('div', { class: 'que-pasa' }, pre.ok ? h('b', { class: 'green' }, '✔ Va a salir bien. ') : h('b', { class: 'red' }, '✖ Cuidado: no alcanza. '),
        pre.parts.map((x) => `${x.label} ${x.value}`).join(' · '), ` = ${pre.total} de ${pre.need}`) : null,
      sealBox ? h('label', { class: 'row small', style: { marginTop: '.5rem' }, title: 'Regla COSPAR: nada de Marte vuelve sin sellar' },
        sealBox, ` PROTECCIÓN PLANETARIA: sellar muestras en doble contenedor (−${SEAL_FUEL} combustible). `,
        canSeal ? h('span', { class: 'dim' }, 'Sin sellar: cuarentena, −30 % de la ciencia de Marte y −8 fama.') : h('span', { class: 'amber' }, 'No alcanza el combustible para sellarlas.')) : null,
      out,
      h('div', { style: { textAlign: 'center', marginTop: '.6rem' } }, start)));
    say(phase === 'edl' ? '¡Llegamos a Marte! Son los "7 minutos de terror": la Tierra no puede ayudar por el retraso de la radio. ¡Suerte, piloto!' : pre.ok ? '¡Hay combustible! Hora de volver a casa.' : `No alcanza el combustible (${pre.total} de ${pre.need}). Si despegan igual, se quedan varados.`,
      { mood: pre.ok ? 'feliz' : 'alerta', target: '#iniciarFase' });
  }

  const fuelRate = isruPerDay;

  function marsLeg() {
    const s = app.state;
    if (!isMars(s)) return null;
    const radio = inBlackout(s, s.day + 1) ? '📵 Conjunción solar: sin radio con la Tierra' : `📡 La radio tarda ${radioDelayMin(s, s.day + 1)} min en llegar a la Tierra`;
    if (s.flags?.landed && !s.flags?.ascended) {
      const proj = s.resources.fuel + fuelRate(s) * Math.max(0, planOf(s).ascent - s.day);
      return h('div', { class: `small ${proj >= ASCENT_FUEL ? 'green' : 'red'}`, id: 'tramo' },
        `Sol ${s.day - planOf(s).landing} de ${planOf(s).surface} en Marte · ⛽ combustible para volver: ${fmt(s.resources.fuel)} de ${ASCENT_FUEL} (al despegar tendrás ~${fmt(proj)}) · ${radio}`);
    }
    if (s.flags?.ascended) return h('div', { class: 'small', id: 'tramo' }, `Regreso: día ${s.day - planOf(s).ascent} de ${planOf(s).transit} · ${radio}`);
    return h('div', { class: 'small', id: 'tramo' }, `Viaje a Marte: día ${s.day} de ${planOf(s).transit} · sin gravedad y con más radiación · ${radio}`);
  }

  let mapSel = null;
  function explorePanel() {
    if (!app.state.map) commit(ensureMap(app.state));
    const s = app.state;
    const map = s.map;
    const byId = Object.fromEntries(map.map((n) => [n.id, n]));
    const visible = map.filter((n) => n.known || n.links.some((l) => byId[l].known));
    const auto = !hasRoverPres(s);
    const lines = [];
    for (const n of visible) for (const l of n.links) if (n.id < l && visible.includes(byId[l])) lines.push([n, byId[l]]);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'mapa');
    for (const [a, b] of lines) {
      const ln = document.createElementNS(NS, 'line');
      Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: a.known && b.known ? 'ruta' : 'ruta niebla' }).forEach(([k, v]) => ln.setAttribute(k, v));
      svg.append(ln);
    }
    for (const n of visible) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', `nodo ${n.done ? 'hecho' : ''} ${n.known ? '' : 'niebla'} ${mapSel === n.id ? 'sel' : ''} ${s.expedition?.nodeId === n.id ? 'destino' : ''}`);
      g.setAttribute('data-node', n.id);
      const c = document.createElementNS(NS, 'circle');
      Object.entries({ cx: n.x, cy: n.y, r: n.type === 'base' ? 7 : 6 }).forEach(([k, v]) => c.setAttribute(k, v));
      const t = document.createElementNS(NS, 'text');
      Object.entries({ x: n.x, y: n.y + 2.2, 'text-anchor': 'middle', 'font-size': 6 }).forEach(([k, v]) => t.setAttribute(k, v));
      t.textContent = n.known ? NODE_CODE[n.type] : '?';
      g.append(c, t);
      if (n.known && n.type !== 'base') g.addEventListener('click', () => { mapSel = n.id; beep(700, 30); draw(); });
      svg.append(g);
    }
    const sel = mapSel && byId[mapSel];
    const T = sel && NODE_TYPES[sel.type];
    const busy = new Set([...s.minis.filter((m) => m.status === 'activa').flatMap((m) => m.crewIds), ...(s.expedition?.crewIds ?? [])]);
    const picks = new Set();
    const prev = h('div', { class: 'que-pasa' }, auto ? 'Elige quién maneja el rover autónomo.' : 'Elige 2 astronautas (nunca se sale solo).');
    const upd = () => {
      if (!picks.size) return;
      const r = previewExpedition(app.state, mapSel, [...picks]);
      prev.replaceChildren(r.ok ? h('b', { class: 'green' }, '✔ Va a funcionar. ') : h('b', { class: 'red' }, '✖ No alcanza todavía. '),
        r.parts.length ? `${r.parts.map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${x.value}`).join(' · ')} = ${r.total} de ${r.need}` : r.text);
    };
    return h('div', { class: 'grid2' },
      h('div', { class: 'panel c-cyan', id: 'mapa' },
        h('h2', {}, '🗺️ Mapa de los alrededores'),
        h('div', { class: 'help' }, 'Toca un lugar para ver qué hay. Al visitarlo se descubren los caminos que salen de ahí. ❔ = todavía no se sabe.'),
        svg),
      h('div', { class: 'panel c-green' },
        s.expedition ? h('div', { class: 'banner', id: 'expedicion' }, `🚙 El rover está en camino a ${NODE_TYPES[byId[s.expedition.nodeId].type].name}: faltan ${s.expedition.daysLeft} día(s).`) : null,
        !sel ? h('div', { class: 'help' }, `👈 Elige un lugar del mapa. ${auto ? '🤖 Tienes el rover autónomo: va 1 persona que lo maneja desde la base, sin salir, pero tarda el doble.' : '🚙 Con el rover presurizado van 2 astronautas (EVA en pareja).'}`) : [
          h('h2', {}, `${T.icon} ${T.name}`),
          h('p', {}, T.desc),
          h('div', { class: 'small' }, `🕒 Ida y vuelta: ${tripDays(sel, auto)} días · ${T.check ? `hace falta ${T.check.dc} de ${{ fuerza: '💪 fuerza', tecnica: '🛠️ técnica', ciencia: '🧠 ciencia', temple: '🧘 calma' }[T.check.stat]}` : 'sin riesgo'}`),
          h('div', { class: 'small' }, h('span', { class: 'dim' }, 'Si sale bien: '), ...chips(T.reward)),
          T.check ? h('div', { class: 'small' }, h('span', { class: 'dim' }, 'Si sale mal: '), ...chips(T.failure)) : null,
          sel.done ? h('div', { class: 'green' }, '✅ Ya lo exploraron.') : s.expedition ? null : [
            h('div', { class: 'row small', style: { margin: '.4rem 0' } }, ...living().filter((c) => !busy.has(c.id)).map((c) => h('label', { class: 'pick' },
              h('input', { type: 'checkbox', onchange: (e) => { (e.target.checked ? picks.add(c.id) : picks.delete(c.id)); upd(); } }), firstName(c)))),
            prev,
            h('button', { class: 'big', id: 'enviar', onclick: () => {
              const r = startExpedition(app.state, mapSel, [...picks]);
              if (r.error) { banner = { text: `❌ ${r.error}`, cls: 'red' }; draw(); return; }
              commit(r.state); banner = { text: `🚙 ¡Salió la expedición a ${T.name}!`, cls: '' }; beep(900, 80); draw();
            } }, '🚙 ENVIAR EXPEDICIÓN'),
          ],
        ]));
  }

  function resources() {
    const s = app.state; const r = s.resources; const left = daysLeft(s); const n = living().length || 1;
    const max = { meds: 20 * n, parts: 30, fuel: 100, battery: r.batteryMax || 1, dataStored: 500 };
    return h('div', { class: 'panel c-blue', id: 'recursos' },
      h('h2', {}, '📦 Lo que tenemos'),
      h('div', { class: 'res-grid' }, ...RES.filter(([k]) => !kids() || ['o2', 'water', 'food', 'battery'].includes(k)).map(([k, ico, name]) => {
        const days = ['o2', 'water', 'food'].includes(k) ? left[k] : null;
        const frac = days !== null ? (Number.isFinite(days) ? days / 60 : 1) : r[k] / max[k];
        const low = k === 'dataStored' ? frac > 0.8 : frac < 0.15;
        return h('div', { class: `res-card ${low ? 'low' : ''}`, title: name },
          h('div', { class: 'res-ico code', title: RES_CODE[k] }, icon(k)),
          h('div', {}, h('div', { class: 'res-name' }, name),
            h('div', { class: 'res-val' }, days !== null ? (Number.isFinite(days) ? `${fmt(days)} días` : '♻️ se recicla') : `${fmt(r[k])}${k === 'battery' ? ` / ${fmt(r.batteryMax)}` : ''}`),
            bar(frac, k === 'dataStored' ? { invert: true } : {})));
      })),
      h('div', { class: 'row', style: { marginTop: '.5rem' } },
        h('span', { class: 'pill violet' }, `🧪 Ciencia ${fmt(s.science)}`),
        h('span', { class: 'pill amber' }, `⭐ Fama ${fmt(s.reputation)}`),
        s.nextResupply != null && s.nextResupply < 1e8 ? h('span', { class: 'pill blue' }, `📦 Próxima carga: día ${s.nextResupply}`) : null));
  }

  function energyPanel() {
    const s = app.state;
    let gen = 0; let use = 0;
    for (const m of s.modules) { if (!m.on) continue; const kw = MODULES[m.type].kw; if (kw > 0) gen += kw; else use -= kw; }
    if (kids()) {
      const r0 = s.resources; const frac = r0.batteryMax ? r0.battery / r0.batteryMax : 1;
      const [txt, cls] = gen >= use ? ['⚡ Sobra energía. ¡Todo bien!', 'green'] : frac > 0.3 ? ['🔋 Gastamos más de lo que hacemos: la batería baja.', 'amber'] : ['🪫 ¡Casi sin energía! Apaga lo que no uses (toca el módulo).', 'red'];
      return h('div', { class: 'panel c-amber', id: 'energia' }, h('h2', {}, 'Energía'), h('div', { class: cls, style: { fontSize: '1.2rem' } }, txt),
        h('div', { class: 'small' }, '🔋 Batería'), bar(frac));
    }
    const rank = (m) => (m.type === 'soporte_vital' ? 2 : m.type === 'cabina' ? 1 : 0);
    const order = s.modules.filter((m) => m.on && MODULES[m.type].kw < 0).sort((a, b) => rank(a) - rank(b) || a.priority - b.priority);
    const r = s.resources;
    return h('div', { class: 'panel c-amber', id: 'energia' },
      h('h2', {}, 'Energía'),
      h('table', {},
        h('tr', {}, h('td', { class: 'dim' }, 'Generación instalada'), h('td', {}, `${fmt(gen, 1)} kW`)),
        h('tr', {}, h('td', { class: 'dim' }, 'Consumo encendido'), h('td', {}, `${fmt(use, 1)} kW`)),
        h('tr', {}, h('td', { class: 'dim' }, 'Batería'), h('td', {}, `${fmt(r.battery)} de ${fmt(r.batteryMax)} kWh`)),
        h('tr', {}, h('td', { class: 'dim' }, 'Módulos apagados'), h('td', {}, String(s.modules.filter((m) => !m.on).length)))),
      h('div', { class: 'small', style: { marginTop: '.4rem' } }, 'Si falta energía se apagan en este orden:'),
      h('ol', { class: 'small orden' }, ...order.map((m) => h('li', {}, `${MOD_CODE[m.type]} ${MODULES[m.type].name}`))));
  }

  /** Reservas siempre a la vista: días que alcanzan agua, comida y O₂ (verde, ámbar, rojo). */
  function reservas() {
    const s = app.state; const left = daysLeft(s);
    const lsOn = s.modules.some((m) => m.type === 'soporte_vital' && m.on);
    const chip = (ico, name, d, note) => {
      const cls = !Number.isFinite(d) ? 'ok' : d < 7 ? 'bad' : d < 20 ? 'warn' : 'ok';
      return h('span', { class: `chip-res ${cls}`, title: `${name}: días que alcanza al ritmo de hoy` }, `${ico} `, h('span', {}, name), ` ${Number.isFinite(d) ? `${fmt(d)} d` : ''}`, Number.isFinite(d) ? null : h('span', {}, note));
    };
    return h('div', { class: 'reservas', id: 'reservas' },
      chip('💧', 'Agua', left.water), chip('🍎', 'Comida', left.food), chip('🫁', 'O₂', left.o2, lsOn ? '♻️ del agua' : '—'),
      s.resources.batteryMax ? h('span', { class: `chip-res ${s.resources.battery / s.resources.batteryMax < 0.2 ? 'bad' : 'ok'}` }, `🔋 ${Math.round((s.resources.battery / s.resources.batteryMax) * 100)} %`) : null,
      s.deadline ? h('span', { class: 'chip-res warn', id: 'reloj-contra' }, '⏱️ …') : null);
  }

  /** Decisiones de operación: racionamiento, nave de carga, baterías, polvo y huerto. */
  function operaciones() {
    const s = app.state; const r = s.resources;
    const act = (res) => { if (res.error) { banner = { text: res.error, cls: 'red' }; beep(300, 80); } else { commit(res.state); beep(1000, 60); } draw(); };
    const gh = s.modules.find((m) => m.type === 'invernadero');
    const team = () => s.crew.filter((c) => c.alive && !c.evacuated && c.health >= 50 && c.fatigue < 70).sort((a, b) => a.fatigue - b.fatigue).slice(0, 2).map((c) => c.id);
    const bh = batteryHealth(s);
    return h('div', { class: 'panel c-cyan', id: 'operaciones' },
      h('h2', {}, '🧰 Operaciones'),
      h('label', { class: 'row small' }, h('input', { type: 'checkbox', id: 'auto-racion', checked: !!s.autoRation, onchange: (e) => { commit({ ...app.state, autoRation: e.target.checked }); draw(); } }),
        `Racionamiento automático: media ración si quedan menos de ${AUTO_RATION_DAYS} días de comida o agua`),
      SC.resupplyEvery ? h('div', { style: { marginTop: '.5rem' } },
        h('div', { class: 'small' }, `📦 ¿Qué pedimos en la próxima nave de carga (día ${s.nextResupply})?`),
        h('div', { class: 'row' }, ...Object.entries(CARGO_PLANS).map(([id, p]) => h('button', {
          class: (s.cargoPlan ?? 'equilibrada') === id ? 'sel' : '', 'data-carga': id, title: p.desc,
          onclick: () => { commit({ ...app.state, cargoPlan: id }); beep(820, 40); draw(); },
        }, `${p.icon} `, h('span', {}, p.name)))),
        h('div', { class: 'small dim' }, (CARGO_PLANS[s.cargoPlan] ?? CARGO_PLANS.equilibrada).desc)) : null,
      r.batteryBase ? h('div', { style: { marginTop: '.5rem' } },
        h('div', { class: 'small' }, `🔋 Salud de las baterías: ${Math.round(bh * 100)} % (pierden capacidad con cada carga y descarga)`), bar(bh, { warn: 0.8, danger: 0.65 }),
        h('button', { class: 'small', id: 'cambiar-baterias', disabled: bh > 0.97, onclick: () => act(replaceBatteries(app.state)) }, `Cambiar celdas (${BATTERY_PARTS} piezas)`)) : null,
      isMars(s) && s.leg === 'superficie' ? h('div', { style: { marginTop: '.5rem' } },
        h('div', { class: 'small' }, `🟤 Polvo en los paneles: ${Math.round((s.dust ?? 0) * 100)} % menos energía`), bar(1 - (s.dust ?? 0), { warn: 0.8, danger: 0.6 }),
        h('button', { class: 'small', id: 'limpiar-paneles', disabled: (s.dust ?? 0) < 0.01, onclick: () => act(cleanPanels(app.state, team())) }, '🧹 Salida al exterior para limpiar (2 tripulantes)')) : null,
      gh ? h('div', { style: { marginTop: '.5rem' } },
        h('div', { class: 'small' }, `🌱 Huerto: ${gardenStage(s.garden)} · ${Math.round(s.garden?.growth ?? 0)} % · cosechas: ${s.garden?.harvests ?? 0}`), bar((s.garden?.growth ?? 0) / 100),
        h('div', { class: 'small dim' }, 'Crece solo con la luz, pero mucho más rápido si alguien hace 🌱 Cultivo. Al 100 % se cosechan 45 kg.')) : null);
  }

  // Sensores reales del destino (gravedad, temperatura, radiación).
  function sensorsMini() {
    const sen = SENSORS[app.state.scenarioId] ?? SENSORS.estacion;
    return h('div', { class: 'panel c-cyan', id: 'sensores' }, h('h2', {}, '📡 Sensores (datos reales)'),
      h('div', { class: 'sensores-mini' }, ...[['Gravedad', sen.grav], ['Temperatura', sen.temp], ['Radiación', sen.rad], ['Día', sen.dia]].map(([k, v]) => h('div', {}, h('b', {}, `${k}: `), v))),
      h('div', { class: 'small dim' }, `Fuente: ${sen.src}`));
  }

  // Esquema vivo de la base: día/noche, tripulación caminando, huerto creciendo y polvo.
  let baseCanvas = null;
  function baseLive() {
    baseCanvas ??= liveCanvas(520, 170, (ctx, w, hh, t) => {
      const s = app.state; if (!s) return;
      const site = siteOf(s);
      const night = site?.nightDays ? (isNight(site, s.day) ? 1 : 0) : (Math.sin(t * (2 * Math.PI / 9.2)) > 0 ? 0 : 0.8); // la Estación: amanecer cada 92 min (aquí cada 9 s)
      drawBase(ctx, w, hh, t, { modules: s.modules.map((m) => ({ ...m, code: MOD_CODE[m.type] })), crew: s.crew, night, day: s.day, dust: (s.dust ?? 0) > 0.25, plants: Math.min(1, (s.garden?.growth ?? 0) / 100) });
    });
    return h('div', { class: 'esquema' }, baseCanvas);
  }

  // Reparación por fuera: minijuego de soldadura; cada estrella repara 15 % y gasta 1 pieza.
  async function evaRepair(id) {
    if ((app.state.resources.parts ?? 0) < 1) { banner = { text: '🔧 No quedan piezas para la EVA.', cls: 'red' }; draw(); return; }
    const name = modName(app.state.modules.find((q) => q.id === id));
    const r = await runTraining('soldadura', { kids: kids(), intro: `EVA de reparación: ${name}. Suelda la grieta del casco.` });
    if (!r) return;
    const st = structuredClone(app.state);
    const m = st.modules.find((q) => q.id === id);
    st.resources.parts -= 1;
    const fix = r.stars * 15;
    m.health = Math.min(100, m.health + fix);
    commit(st); glitch(200);
    banner = { text: r.stars ? `🧑‍🚀 EVA lista: ${name} +${fix} % (1 pieza).` : '🧑‍🚀 La EVA no logró soldar la grieta. Se gastó 1 pieza.', cls: r.stars ? '' : 'red' };
    draw();
  }

  function ship() {
    const s = app.state;
    const cols = Math.max(...s.modules.map((m) => m.x)) + 1;
    const who = whoDecides(app, 'ingeniero');
    return h('div', { class: 'panel c-violet', id: 'estacion' },
      h('h2', {}, `${DEST} ${HOME} `, who ? h('span', { class: 'tag' }, `decide ${who}`) : null),
      baseLive(),
      h('div', { class: 'help' }, kids() ? 'Toca un módulo para prenderlo o apagarlo. 🟢 prendido · ⚫ apagado.' : 'Toca un módulo para prenderlo o apagarlo. El número es su turno para apagarse si falta electricidad (el más bajo, primero).'),
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
        }, h('div', { class: 'ico code' }, MOD_CODE[m.type]), h('b', {}, MODULES[m.type].name),
        m.offDays ? h('div', { class: 'amber small' }, `⏸️ ${m.offDays} días`) : null,
        bar(m.health / 100), m.health < 60 && !isGuest() ? h('button', { class: 'eva-btn', 'data-eva': m.id, title: 'Sal en EVA y suelda el daño: cada estrella repara 15 % (gasta 1 pieza).', onclick: (e) => { e.stopPropagation(); evaRepair(m.id); } }, '🧑‍🚀 EVA') : null, h('div', { class: 'row small' }, m.on ? '🟢' : '⚫',
          kids() ? null : h('input', { type: 'number', min: 1, max: 10, value: m.priority, style: { width: '3.4rem' }, title: 'Turno para apagarse', onchange: (e) => { commit(setPriority(app.state, m.id, Number(e.target.value))); } }))))),
      s.design.instruments.length ? h('div', { class: 'small', style: { marginTop: '.4rem' } }, '🔬 ', s.design.instruments.map((i) => `${INSTRUMENTS[i].icon} ${INSTRUMENTS[i].name}`).join(' · ')) : null);
  }

  const shown = (t) => (t === 'trabajo' ? 'experimentos' : t);
  const hasModule = (type) => app.state.modules.some((m) => m.type === type);
  const setTurn = (id, turn, val) => {
    const st = structuredClone(app.state);
    const day = st.schedule[id];
    // Una sola EVA por día: si la mueve de turno, el otro queda libre.
    if (val === 'eva' && day[1 - turn] === 'eva') day[1 - turn] = 'descanso';
    // Sacarlo de la pre-respiración automática = cancelar la EVA de la tarde.
    if (turn === 0 && day[0] === 'prerespiracion' && day[1] === 'eva' && val !== 'eva') day[1] = 'descanso';
    day[turn] = val;
    st.schedule[id] = normalizeSchedule(day);
    commit(st); beep(880, 40); draw();
  };

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
      if (AUTO_TASKS.has(job)) { say('La pre-respiración se pone sola: arrastra a los astronautas a 👨‍🚀 Actividad extravehicular.', { mood: 'pensando', target: '[data-job="eva"]' }); return; }
      const need = TASKS[job].needsModule;
      if (need && !hasModule(need)) { say(`Para ${TASKS[job].name} hace falta el módulo ${MODULES[need].name}. Esa casilla está apagada.`, { mood: 'alerta' }); return; }
      if (shown(app.state.schedule[crewId][shift]) !== job) { if (kids() && app.autoPlan !== false) { app.autoPlan = false; banner = { text: '✋ Ahora repartes tú. Toca 🪄 si quieres que Nova vuelva a repartir sola.', cls: '' }; } setTurn(crewId, shift, job); }
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
    for (const id of Object.keys(s.schedule)) s.schedule[id] = normalizeSchedule(s.schedule[id]);
    const here = (job) => living().filter((c) => shown(s.schedule[c.id]?.[shift]) === job);
    const campers = living().filter((c) => s.schedule[c.id]?.[2] === 'campamento').map(firstName);
    return h('div', { id: 'tablero' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '.3rem 0 .5rem' } },
        h('div', { class: 'row' }, ...TURNS.slice(0, 2).map((t, i) => h('button', { class: `tab ${i === shift ? 'on' : ''}`, 'data-shift': i, onclick: () => { shift = i; app.opsShift = i; beep(700, 30); draw(); } }, t))),
        h('div', { class: 'help' }, '✋ Arrastra la carita de cada astronauta al trabajo que hará en este turno.')),
      h('div', { class: 'small dim', id: 'noche-auto', style: { margin: '0 0 .5rem' } },
        campers.length
          ? `🌙 Noche: duermen solos. ⛺ ${campers.join(' y ')} duerme${campers.length > 1 ? 'n' : ''} en la esclusa para la EVA de la mañana (así respiran oxígeno puro, como en la NASA).`
          : '🌙 Noche: todos duermen solos. Si alguien sale a EVA, la pre-respiración también se pone sola.'),
      autoBar(),
      h('div', { class: 'job-grid' }, ...TASK_IDS.filter((job) => (job !== 'prerespiracion' || here(job).length) && (!kids() || KID_TASKS.has(job) || here(job).length)).map((job) => {
        const need = TASKS[job].needsModule;
        const off = need && !hasModule(need);
        return h('div', { class: `job ${off ? 'off' : ''} ${job === 'sueño' ? 'sleep' : ''}`, 'data-job': job, title: off ? `Falta el módulo ${MODULES[need].name}` : TASK_DESC[job] },
          h('div', { class: 'job-head' }, h('span', { class: 'ico' }, TASK_ICON[job]), h('span', {}, TASKS[job].name)),
          h('div', { class: 'job-desc small dim' }, off ? `🔒 Necesita ${MODULES[need].name}` : TASK_DESC[job]),
          job === 'eva' ? evaChecklist() : null,
          h('div', { class: 'job-crew' }, ...here(job).map((c) => h('div', { class: 'token', 'data-token': c.id, onpointerdown: (e) => startDrag(e, c.id) },
            crewAvatar(c, { size: 46, activity: job }), h('div', { class: 'small' }, firstName(c))))));
      })));
  }

  function crewCards() {
    const s = app.state;
    const setRation = (id, val) => { const st = structuredClone(app.state); st.rations[id] = val; commit(st); draw(); };
    const statRow = (label, v, opts, text) => [h('span', {}, label), bar(v, opts), h('span', { class: 'small' }, text)];
    return h('div', { class: 'panel c-pink', id: 'tripulacion' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h2', {}, '🧑‍🚀 La tripulación'),
        kids() ? null : h('div', { class: 'row' },
          h('button', { onclick: () => { app.routine = structuredClone(app.state.schedule); banner = { text: '💾 Rutina guardada.', cls: '' }; draw(); } }, '💾 Guardar rutina'),
          h('button', { disabled: !app.routine, onclick: () => { const st = structuredClone(app.state); for (const id of Object.keys(st.schedule)) if (app.routine[id]) st.schedule[id] = [...app.routine[id]]; commit(st); draw(); } }, '🔁 Repetir rutina'))),
      jobBoard(),
      h('div', { class: 'crew-grid' }, ...s.crew.map((c) => {
        const sleeping = s.schedule[c.id]?.some((t) => t === 'sueño' || t === 'campamento') ? null : 'sinsueño';
        const mood = moodOf(c);
        return h('div', { class: `crew-card ${['enfermo', 'radiacion', 'agotado', 'hambre', 'triste', 'muerto'].includes(mood) || sleeping ? 'mal' : ''}`, 'data-crew': c.id },
          h('div', { class: 'top' },
            h('div', {}, crewAvatar(c, { size: 80 }), pulseCanvas(() => app.state.crew.find((x) => x.id === c.id) ?? c)),
            h('div', {},
              h('div', { class: 'name' }, c.name),
              h('div', { class: 'small' }, h('span', { class: 'pill role' }, ROLES[c.role]?.name ?? c.role)),
              h('div', { class: `estado ${mood === 'feliz' || mood === 'normal' ? 'green' : 'amber'}` }, MOOD_TEXT[mood]),
              kids() ? null : h('div', { class: 'small dim' }, Object.entries(c.stats).map(([k, v]) => `${STAT[k]}${v}`).join(' '), ' ',
                ...c.traits.map((t) => h('span', { class: `chip ${TRAITS[t]?.positive ? 'ok' : 'bad'}`, title: TRAITS[t]?.desc }, TRAITS[t]?.name ?? t))))),
          c.alive ? [
            h('div', { class: 'stats' },
              ...statRow('❤️ Salud', c.health / 100, {}, fmt(c.health)),
              ...statRow('🥱 Cansancio', c.fatigue / 100, { invert: true }, fmt(c.fatigue)),
              ...statRow('😊 Ánimo', c.morale / 100, {}, fmt(c.morale)),
              ...(kids() ? [] : statRow('🦴 Huesos', c.bone / 100, { warn: 0.8, danger: 0.7 }, fmt(c.bone))),
              ...(kids() ? [] : statRow('☢️ Radiación', c.radiation / (RAD_LIMIT * 1.2), { invert: true, warn: 0.4, danger: 1 - 1 / 1.2, mark: 1 / 1.2 }, fmt(c.radiation)))),
            h('div', { class: 'turnos-ver' }, ...[0, 1, 2].map((turn) => {
              const t = shown(s.schedule[c.id]?.[turn]);
              return h('div', { class: `turno-chip ${turn === shift ? 'on' : ''}`, onclick: () => { if (turn > 1) return; shift = turn; app.opsShift = turn; draw(); } },
                h('span', { class: 'small dim' }, TURNS[turn]), h('span', {}, `${TASK_ICON[t]} ${TASKS[t].name}`));
            })),
            kids() ? null : h('label', { class: 'small row', style: { marginTop: '.3rem' } }, 'Ración de comida',
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
    const offers = s.minis.filter((m) => m.status === 'oferta' && (!kids() || MINIMISSIONS[m.id].mandatory));
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
    return h('div', { class: 'grid-base' },
      h('div', { class: 'panel c-cyan' }, h('h2', {}, '📖 Diario de a bordo'),
        h('div', { class: 'log', id: 'bitacora' }, ...s.log.slice(-80).reverse().map((l) => h('div', { class: l.kind }, h('b', {}, `Día ${l.day} `), l.text)))),
      h('div', { class: 'panel c-violet' }, h('h2', {}, 'Recursos día a día'), chart(s.history ?? []),
        h('table', { class: 'small', style: { marginTop: '.5rem' } },
          h('tr', {}, h('td', { class: 'dim' }, 'Días en misión'), h('td', {}, `${s.day} de ${s.totalDays}`)),
          h('tr', {}, h('td', { class: 'dim' }, 'Eventos resueltos'), h('td', {}, String(s.log.filter((l) => l.kind === 'evento').length))),
          h('tr', {}, h('td', { class: 'dim' }, 'Minimisiones hechas'), h('td', {}, String(s.minis.filter((m) => m.status === 'hecha').length))),
          h('tr', {}, h('td', { class: 'dim' }, 'Ciencia'), h('td', {}, String(Math.round(s.science)))))));
  }

  /** Lo más importante que Nova debe decir ahora, y a qué apuntar. */
  function coach(sched) {
    const s = app.state;
    if (s.phase === 'reentry') return ['¡Un año completo! 🎉 Ahora hay que volver a la Tierra. Toca INICIAR REENTRADA.', 'feliz', '#reentrada', null];
    if (sched.length) return [`${sched[0]}. Arrástralo a 😴 Sueño en algún turno.`, 'alerta', '[data-job="sueño"]', 'tripulacion'];
    if (isMars(s) && s.flags?.landed && !s.flags?.ascended && s.resources.fuel + fuelRate(s) * Math.max(0, planOf(s).ascent - s.day) < ASCENT_FUEL) {
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
    if (broken && kids()) return [`El módulo ${MODULES[broken.type].name} está muy dañado. Pon a alguien en 🔧 Reparación (o toca 🪄).`, 'alerta', '[data-job="reparacion"]', 'tripulacion'];
    if (broken) return [`El módulo ${MODULES[broken.type].name} está muy dañado. Pon a alguien en 🔧 Reparación o repáralo a mano en Recorrido.`, 'alerta', `[data-tramo="${broken.id}"]`, 'recorrido'];
    const weakBone = living().find((c) => c.bone < 85);
    if (weakBone) return [`Los huesos de ${firstName(weakBone)} se debilitan sin gravedad. Dale 🏃 Ejercicio.`, 'pensando', `[data-crew="${weakBone.id}"]`, 'tripulacion'];
    const offer = s.minis.find((m) => m.status === 'oferta' && (!kids() || MINIMISSIONS[m.id].mandatory));
    if (offer) return [`Hay una minimisión: ${MINIMISSIONS[offer.id].name}. Elige quién va y mira si le alcanza.`, 'pensando', '#minis', 'misiones'];
    if (s.resources.dataStored > 300 && !kids()) return ['Se están juntando muchos datos. Pon a alguien en 📞 Comunicación para mandarlos.', 'pensando', '#recursos', 'resumen'];
    const site = siteOf(s);
    if (site?.nightDays && isNight(site, s.day + 1) && s.resources.battery < s.resources.batteryMax * 0.3) return ['Es de noche y queda poca batería. En la pestaña de la base apaga lo que no sea vital (toca el módulo). El soporte vital y la cabina se apagan al final.', 'alerta', '#estacion', 'estacion'];
    if (s.day === 0 && SC.id === 'marte') return ['¡Empieza el viaje a Marte! Son 210 días sin gravedad: 🏃 ejercicio diario para los huesos y 🛡️ refugio en las tormentas solares. Arrastra a cada uno a su trabajo y toca ▶ AVANZAR.', 'feliz', '#avanzar', null];
    if (s.day === 0 && !SC.orbital) return [`¡Bienvenidos a ${SC.home}! Aquí hay gravedad baja y más radiación. ${site?.nightDays ? `Ojo: cada tanto llega la noche de ${site.nightDays} días.` : ''} Arrastra a cada astronauta a su trabajo y toca ▶ AVANZAR.`, 'feliz', '#avanzar', null];
    if (kids() && s.day === 0) return ['¡Hola! 🧒 Yo, Nova, reparto los trabajos cada día. Tú mira los avisos, prende o apaga módulos y toca ▶ AVANZAR. Si quieres mandar tú, arrastra las caritas.', 'feliz', '#avanzar', null];
    if (s.day === 0) return ['¡Bienvenidos a la estación! En la pestaña 🧑‍🚀 Tripulación eliges qué hace cada astronauta. Cuando estés listo, toca ▶ AVANZAR.', 'feliz', '#avanzar', null];
    return ['Sin novedades. Avanza y te llamo si pasa algo.', 'feliz', '#avanzar', null];
  }

  const TASK_ROOM = { experimentos: 'laboratorio', trabajo: 'laboratorio', cultivo: 'invernadero', medico: 'enfermeria', refugio: 'refugio', comunicacion: 'antena', produccion: 'soporte_vital' };
  const SHIFT_NAME = ['MAÑANA 06:00', 'TARDE 14:00', 'NOCHE 22:00'];
  let monitorTimer = null;
  let monShift = 0;
  const initials = (c) => c.name.split(' ').map((p) => p[0]).join('').slice(0, 2);
  function roomOf(s, c, turn) {
    if (s.expedition?.crewIds.includes(c.id)) return 'EXP';
    if (s.minis.some((m) => m.status === 'activa' && m.crewIds.includes(c.id))) return 'MIS';
    const t = s.schedule[c.id]?.[turn];
    if (t === 'eva') return 'EXT';
    if (t === 'reparacion' || t === 'mantenimiento') return s.modules.filter((m) => m.health > 0).sort((a, b) => a.health - b.health)[0]?.id ?? null;
    const type = TASK_ROOM[t];
    const m = (type && s.modules.find((x) => x.type === type)) || s.modules.find((x) => x.type === 'cabina');
    return m?.id ?? null;
  }
  /** Mapa del viaje como pantalla de monitor: dónde va la nave, hitos de la misión, próxima carga y peligros avisados. */
  function tripMap(s) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
    const W = 200; const X0 = 8; const X1 = W - 8; const Y = 19;
    const total = Math.max(1, s.totalDays);
    const xOf = (d) => X0 + (Math.max(0, Math.min(total, d)) / total) * (X1 - X0);
    const svg = el('svg', { viewBox: `0 0 ${W} 38`, class: 'trip-map', id: 'mapa-viaje' });
    svg.append(el('line', { x1: X0, y1: Y, x2: X1, y2: Y, class: 'tm-ruta' }), el('line', { x1: X0, y1: Y, x2: xOf(s.day), y2: Y, class: 'tm-hecho' }));
    const marks = [];
    if (isMars(s)) {
      const p = planOf(s);
      svg.append(el('rect', { x: xOf(p.conj.start), y: Y - 3, width: Math.max(1, xOf(p.conj.end) - xOf(p.conj.start)), height: 6, class: 'tm-conj' }));
      marks.push([p.landing, 'EDL', 'hito'], [p.conj.start, 'SIN RADIO', 'aviso'], [p.ascent, 'ASCENSO', 'hito']);
    }
    if (s.nextResupply != null && s.nextResupply < s.totalDays && s.nextResupply >= s.day) marks.push([s.nextResupply, 'CARGA', 'carga']);
    for (const a of s.alerts ?? []) marks.push([s.day + a.etaDays, tr(EVENTS[a.eventId]?.name ?? '!').toUpperCase().slice(0, 14), 'peligro']);
    marks.sort((a, b) => a[0] - b[0]).forEach(([d, label, kind], i) => {
      const x = xOf(d); const up = i % 2 === 0;
      svg.append(el('line', { x1: x, y1: Y - 4, x2: x, y2: Y + 4, class: `tm-${kind}` }),
        el('text', { x, y: up ? Y - 7 : Y + 12, 'text-anchor': 'middle', class: `tm-txt tm-${kind}` }, tr(label)));
    });
    const sx = xOf(s.day);
    for (let k = 1; k <= 3; k++) svg.append(el('circle', { cx: sx - k * 4, cy: Y, r: 1.2 - k * 0.25, class: 'tm-estela', style: `animation-delay:${k * 0.2}s` }));
    // estrellas de fondo que pasan
    for (let k = 0; k < 7; k++) svg.append(el('circle', { cx: (k * 37) % W, cy: 3 + (k * 11) % 32, r: 0.5, class: 'tm-estrella', style: `animation-delay:${-k * 0.9}s` }));
    svg.append(el('polygon', { points: `${sx - 3},${Y + 3} ${sx + 3},${Y + 3} ${sx},${Y - 3}`, class: 'tm-nave' }),
      el('text', { x: X0, y: 36, class: 'tm-txt' }, 'T-0'), el('text', { x: X1, y: 36, 'text-anchor': 'end', class: 'tm-txt' }, tr(isMars(s) || !SCENARIOS[s.scenarioId]?.orbital ? 'TIERRA' : 'FIN')));
    return h('div', { class: 'trip-wrap', title: 'Mapa de la misión: ▲ es tu nave. Rojo = peligro avisado; CARGA = próxima nave de carga.' }, svg);
  }

  function monitor() {
    const s = app.state;
    const NS = 'http://www.w3.org/2000/svg';
    const W = 22; const H = 15;
    const cols = Math.max(...s.modules.map((m) => m.x)) + 1;
    const rows = Math.max(...s.modules.map((m) => m.y)) + 1;
    const vw = cols * W + 26; const vh = Math.max(rows * H + 6, 40);
    const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
    const svg = el('svg', { viewBox: `0 0 ${vw} ${vh}`, class: 'monitor' });
    const pos = {};
    for (const m of s.modules) {
      const x = m.x * W + 2; const y = m.y * H + 3;
      pos[m.id] = [x + W / 2, y + H / 2];
      const g = el('g', { class: `mod ${m.on ? '' : 'apagado'} ${m.health < 40 ? 'roto' : ''}` });
      g.append(el('rect', { x, y, width: W - 2, height: H - 2 }), el('text', { x: x + 1.5, y: y + 4.5 }, MOD_CODE[m.type]));
      const segs = Math.round((m.health / 100) * 8);
      for (let i = 0; i < 8; i++) g.append(el('rect', { class: i < segs ? 'seg' : 'seg vacio', x: x + 1.5 + i * 2.2, y: y + H - 4.5, width: 1.6, height: 1.4 }));
      svg.append(g);
    }
    const ex = cols * W + 4;
    pos.EXT = [ex + 10, 10]; pos.EXP = [ex + 10, vh / 2 + 2]; pos.MIS = [ex + 10, vh - 6];
    svg.append(el('text', { x: ex, y: 5, class: 'zona' }, 'AFUERA'), el('text', { x: ex, y: vh / 2 - 3, class: 'zona' }, 'ROVER'), el('text', { x: ex, y: vh - 11, class: 'zona' }, 'MISIÓN'));
    const marks = s.crew.filter((c) => c.alive && !c.evacuated).map((c) => {
      const g = el('g', { class: `marca ${['enfermo', 'radiacion', 'agotado', 'hambre'].includes(moodOf(c)) ? 'mal' : ''}`, 'data-c': c.id });
      g.append(el('circle', { cx: 0, cy: 0, r: 3.6 }), el('text', { x: 0, y: 1.3, 'text-anchor': 'middle' }, initials(c)));
      g.addEventListener('click', () => pick('tripulacion'));
      svg.append(g);
      return { c, g };
    });
    const label = h('div', { class: 'small', id: 'turno-monitor' });
    const place = () => {
      const st = app.state;
      const count = {};
      for (const { c, g } of marks) {
        const room = roomOf(st, c, monShift);
        const [cx, cy] = pos[room] ?? [6, 6];
        const k = (count[room] = (count[room] ?? 0) + 1);
        const off = [[-4.5, -1], [4.5, -1], [-4.5, 3.5], [4.5, 3.5], [0, 1]][(k - 1) % 5];
        g.style.transform = `translate(${cx + off[0]}px, ${cy + off[1]}px)`;
      }
      label.textContent = `RELOJ DE A BORDO · TURNO ${SHIFT_NAME[monShift]}`;
    };
    clearInterval(monitorTimer);
    monitorTimer = setInterval(() => { if (!document.body.contains(svg)) { clearInterval(monitorTimer); return; } monShift = (monShift + 1) % 3; place(); }, 2200);
    place();
    return h('div', { class: 'panel c-pink', id: 'monitor' },
      h('h2', {}, `Monitor de ${SC.home}`),
      label, svg,
      h('div', { class: 'mini-crew' }, ...s.crew.map((c) => h('div', { class: 'who small', onclick: () => pick('tripulacion') },
        h('b', {}, initials(c)), ` ${firstName(c)}: `, h('span', { class: c.alive ? (['feliz', 'normal'].includes(moodOf(c)) ? 'green' : 'amber') : 'red' }, MOOD_TEXT[moodOf(c)])))));
  }

  function crewMini() {
    const s = app.state;
    return h('div', { class: 'panel c-pink' }, h('h2', {}, '🧑‍🚀 ¿Cómo están?'),
      h('div', { class: 'mini-crew' }, ...s.crew.map((c) => h('div', { class: 'who', onclick: () => pick('tripulacion') },
        crewAvatar(c, { size: 64 }), h('div', {}, h('b', {}, firstName(c))), h('div', { class: 'small dim' }, MOOD_TEXT[moodOf(c)])))));
  }

  // Práctica guiada: Nova muestra cada parte de la pantalla, paso a paso.
  const PRACTICE = [
    ['#reservas', 'Estas son tus reservas: cuántos días alcanzan el agua, la comida y el aire. Verde está bien, amarillo es cuidado y rojo es peligro.'],
    ['[data-tab="tripulacion"]', 'En 🧑‍🚀 Tripulación repartes los trabajos de la mañana y la tarde arrastrando a cada astronauta. La noche es para dormir.'],
    ['[data-tab="estacion"]', 'En 🛰️ Estación ves los módulos, la energía y 🧰 Operaciones: racionamiento, qué pedir en la nave de carga y las baterías.'],
    ['[data-tab="misiones"]', 'En ⚠️ Avisos llegan los peligros con tiempo para prepararse, y las minimisiones que dan ciencia.'],
    ['#avanzar', 'Con ▶ AVANZAR pasan los días hasta que haya algo que decidir. Cuando pase algo, lee las opciones: abajo dice si funciona.'],
    [null, '¡Listo! Ya sabes lo básico. Si una palabra no la entiendes, toca 📖 arriba para ver el glosario. ¡Buena misión!'],
  ];
  function practiceStep() {
    const [target, text] = PRACTICE[app.practice] ?? PRACTICE.at(-1);
    const last = app.practice >= PRACTICE.length - 1;
    say(`🎓 ${app.practice + 1}/${PRACTICE.length}. ${text}`, { mood: last ? 'feliz' : 'normal', target, buttons: [{ label: last ? 'Terminar' : 'Siguiente ▶', onclick: () => { app.practice = last ? null : app.practice + 1; draw(); } }] });
  }

  // Modo jurado: un cartel con el paso del recorrido y un solo botón para seguir.
  const JURADO_TXT = {
    3: ['Paso 3 de 5 · La misión', 'Así se ve un día en la estación: recursos, tripulación y turnos. Toquen ⏩ y en unos segundos salta una emergencia relámpago: hay que resolverla contra reloj.', '⏩ Adelantar hasta la emergencia'],
    4: ['Paso 4 de 5 · El resto del año', 'Ya vieron una emergencia. El resto del año (eventos, cargas, reparaciones) se juega igual. Toquen ⏩ y Nova lo juega por ustedes eligiendo lo recomendado.', '⏩ Adelantar el año y volver a la Tierra'],
  };
  function juradoPanel() {
    const s = app.state;
    if (!s.jurado || isGuest()) return null;
    const step = juradoStep(s, 'ops');
    const [title, txt, label] = JURADO_TXT[step] ?? [];
    if (!title) return null;
    const secs = app.jurado ? Math.floor((Date.now() - app.jurado) / 1000) : 0;
    const blocked = !!s.pending || !!s.flash || s.phase !== 'ops';
    return h('div', { class: 'panel c-amber', id: 'jurado-panel' },
      h('h2', {}, `🏛️ Modo jurado · ${title}`),
      h('div', { class: 'small' }, txt),
      h('div', { class: 'row', style: { marginTop: '.4rem' } },
        h('button', { class: 'big', id: 'jurado-seguir', disabled: blocked, onclick: () => {
          stopClock();
          if (step === 3) { advance(true); return; }
          const end = fastForward(app.state);
          commit(end); beep(1100, 120);
          go(end.phase === 'reentry' ? 'reentry' : 'report');
        } }, label),
        h('span', { class: 'small dim' }, `⏱️ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`)));
  }

  function draw() {
    keyFn = null;
    if (autoOn() && app.autoDay !== app.state.day && !app.state.pending) { app.autoDay = app.state.day; commit(autoAssign(app.state)); }
    const s = app.state;
    musicMood(s.flash ? 'tension' : s.pending && EVENTS[s.pending.eventId]?.kind !== '+' ? 'danger' : s.dig?.outing || placeOf(s) === 'suelo' ? 'surface' : 'orbit');
    const sched = validateSchedule(Object.fromEntries(Object.entries(s.schedule).filter(([id]) => s.crew.find((c) => c.id === id)?.alive)))
      .map((e) => { const id = e.split(' ')[0]; const c = s.crew.find((x) => x.id === id); return c ? e.replace(id, c.name) : e; });
    const blocked = sched.length > 0 || !!s.pending || !!s.flash || s.phase !== 'ops' || !!phaseDue(s);
    const pct = Math.min(100, (s.day / s.totalDays) * 100);
    if (kids() && ['recorrido', 'excavar', 'mapa', 'diario'].includes(tab)) tab = 'resumen';
    mount(root,
      h('div', { class: 'day-head' },
        h('div', {},
          h('h1', { style: { fontSize: '2rem', margin: 0 }, id: 'dia' }, `📅 DÍA ${s.day} de ${s.totalDays}`),
          dayNight(),
          marsLeg(),
          isWeekend(s.day + 1) && !kids() ? h('div', { class: 'small amber' }, '🗓️ Mañana es fin de semana: día ligero. Descanso y llamadas a casa dan más ánimo; trabajar lo baja un poco.') : null,
          tripMap(s),
          reservas()),
        isGuest() ? h('div', { class: 'small amber', id: 'tiempo-anfitrion' }, 'EN LÍNEA: el anfitrión avanza el tiempo. Tú puedes asignar trabajos, reparar, excavar y decidir lo de tu rol.') :
        h('div', { class: 'row' },
          kids() ? null : h('div', { class: 'velocidad', id: 'velocidad' }, h('span', { class: 'small dim' }, 'TIEMPO'),
            ...[[0, '||'], [1, '1×'], [4, '4×'], [12, '12×']].map(([v, t]) => h('button', { class: speed === v ? 'sel' : '', disabled: blocked && v > 0, 'data-speed': v, onclick: () => play(v) }, t))),
          kids() ? null : h('button', { id: 'avanzar1', disabled: blocked, onclick: () => advance(false) }, '⏭️ 1 día'),
          h('button', { id: 'avanzar', class: 'big', disabled: blocked, onclick: () => advance(true) }, '▶ AVANZAR'),
          s.phase === 'reentry' ? h('button', { id: 'reentrada', class: 'big warn', onclick: () => go('reentry') }, '🌍 INICIAR REENTRADA') : null,
          s.pending ? h('button', { class: 'warn', onclick: eventModal }, '⚠️ Ver problema') : null)),
      sched.length ? h('div', { class: 'banner red', id: 'horario' }, '😴 ', sched.join(' · '), ' — todos deben dormir al menos un turno.') : null,
      banner ? h('div', { class: `banner ${banner.cls}`, id: 'aviso' }, banner.text) : null,
      juradoPanel(),
      tabs([
        { id: 'resumen', label: '🏠 Resumen', color: 'c-blue', badge: ['food', 'water', 'o2'].some((k) => daysLeft(s)[k] < 10) ? '!' : 0 },
        { id: 'tripulacion', label: '🧑‍🚀 Tripulación', color: 'c-pink', badge: sched.length + living().filter((c) => c.health < 50 || c.fatigue >= 70).length },
        { id: 'estacion', label: SC.orbital ? `${SC.id === 'gateway' ? '🌘' : '🛰️'} Estación` : `${DEST} Base`, color: 'c-violet', badge: s.modules.filter((m) => m.health < 40 || !m.on).length },
        { id: 'misiones', label: '⚠️ Avisos y misiones', color: 'c-amber', badge: s.alerts.length + s.minis.filter((m) => m.status === 'oferta').length },
        ...(kids() ? [] : [{ id: 'recorrido', label: 'Recorrido', color: 'c-violet', badge: s.modules.filter((m) => m.health <= 0).length }]),
        ...(digAvailable(s) && !kids() ? [{ id: 'excavar', label: 'Excavar', color: 'c-green', badge: s.dig?.outing ? '!' : 0 }] : []),
        ...((canExplore(s) || s.map) && !kids() ? [{ id: 'mapa', label: '🗺️ Exploración', color: 'c-green', badge: s.expedition ? 0 : (s.map ?? []).filter((n) => n.known && !n.done).length }] : []),
        ...(kids() ? [] : [{ id: 'diario', label: '📖 Diario', color: 'c-cyan' }]),
      ], tab, pick),
      tab === 'resumen' ? h('div', { class: 'grid2' }, h('div', {}, resources(), sensorsMini()), h('div', {}, monitor(), alerts())) : null,
      tab === 'tripulacion' ? crewCards() : null,
      tab === 'estacion' ? h('div', { class: 'grid-base' }, ship(), h('div', {}, energyPanel(), kids() ? null : operaciones())) : null,
      tab === 'misiones' ? h('div', { class: 'grid2' }, alerts(), minis()) : null,
      tab === 'diario' ? logPanel() : null,
      tab === 'mapa' ? explorePanel() : null,
      tab === 'recorrido' ? walkPanel(app, commit, draw, setKey) : null,
      tab === 'excavar' && digAvailable(s) ? digPanel(app, commit, draw, setKey) : null,
    );
    if (phaseDue(s) && s.phase === 'ops') { if (!document.getElementById('fase')) phaseModal(); }
    else if (s.flash) flashModal();
    else if (s.pending && !document.getElementById('evento')) eventModal();
    else if (!s.pending && app.practice != null) practiceStep();
    else if (!s.pending && s.jurado && JURADO_TXT[juradoStep(s, 'ops')]) say(JURADO_TXT[juradoStep(s, 'ops')][1], { mood: 'feliz', target: '#jurado-seguir', quiet: true });
    else if (!s.pending) {
      const [t, mood, target, where] = coach(sched);
      if ((tab === 'recorrido' || tab === 'excavar') && mood !== 'alerta') return; // ahí Nova no tapa los controles
      const elsewhere = where && where !== tab;
      say(elsewhere ? `${t} (Toca la pestaña señalada.)` : t, { mood, target: elsewhere ? `[data-tab="${where}"]` : target, quiet: true });
    }
  }

  draw();
  // Contrarreloj: la misión termina cuando se acaba el tiempo real; gana el equipo con más puntaje.
  const contra = setInterval(() => {
    const s = app.state;
    if (!s?.deadline || s.phase !== 'ops' || isGuest()) return;
    const left = Math.max(0, s.deadline - Date.now());
    const el = document.getElementById('reloj-contra');
    if (el) el.textContent = `⏱️ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (left > 0) return;
    stopClock();
    commit({ ...s, pending: null, phase: 'report', outcome: { success: s.crew.some((c) => c.alive && !c.evacuated), reason: '⏱️ Se acabó el tiempo del contrarreloj. Comparen el puntaje: gana el más alto.' } });
    handle({ kind: 'fin' }); draw();
  }, 1000);
  return () => { clearInterval(contra); stopClock(); clearInterval(monitorTimer); document.removeEventListener('keydown', onKey); document.querySelectorAll('.modal-bg').forEach((e) => e.remove()); };
}
