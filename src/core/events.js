// Eventos, avisos, desastres y cadenas. Funciones puras: devuelven estado nuevo (structuredClone).
import { DIFFICULTY, MODULES, SCENARIOS } from '../data/catalog.js';
import { EVENTS } from '../data/events.js';
import { skillCheck } from './skill.js';
import { envMults, siteOf, availableIn } from './surface.js';
import { inBlackout } from './mars.js';

const SEVERITIES = ['leve', 'media', 'grave'];
const POSITIVE_CHANCE = 0.06;
const BOOM = { facil: 0.1, medio: 0.15, dificil: 0.2 };
const NEEDS = { food: 1.8, water: 2.75 * 0.02 + 0.95, o2: 0.84 };
const RESOURCE_KEYS = ['o2', 'water', 'food', 'meds', 'parts', 'fuel', 'battery'];
const RESUPPLY_ONLY = new Set(['carga_a_tiempo', 'carga_explota']);
const DEBRIS = new Set(['micrometeoritos', 'basura_tardia']);
const REDUCERS = { tormenta_solar: 'refugio', micrometeoritos: 'refugio', reboost: 'gastar_combustible', polvo_paneles: 'cubrir', tormenta_polvo: 'asegurar', particulas_profundas: 'refugio' };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const addLog = (s, text, kind = 'evento') => s.log.push({ day: s.day, text, kind });

function weightedPick(items, rng) {
  const total = items.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const [id, w] of items) {
    r -= w;
    if (r < 0) return id;
  }
  return items[items.length - 1][0];
}

function drawSeverity(state, rng) {
  const w = DIFFICULTY[state.difficulty].severityWeights;
  const r = rng.next();
  return r < w[0] ? 'leve' : r < w[0] + w[1] ? 'media' : 'grave';
}

function pool(state, disaster) {
  return Object.values(EVENTS)
    .filter((e) => e.disaster === disaster && !RESUPPLY_ONLY.has(e.id) && e.weight > 0)
    .filter((e) => availableIn(e, state.scenarioId) && (!e.sites || e.sites.includes(state.design.orbit))
      && (!e.needsModule || state.modules.some((m) => m.type === e.needsModule))
      && (!e.legs || e.legs.includes(state.leg ?? 'superficie')))
    .map((e) => [e.id, DEBRIS.has(e.id) && state.flags?.debrisCleared ? e.weight / 2 : e.weight]);
}

/** Crea una alerta (con aviso) o deja el evento pendiente (sin aviso). Muta `s` (ya clonado). */
function launchEvent(s, eventId, rng) {
  const ev = EVENTS[eventId];
  const severity = drawSeverity(s, rng);
  if (ev.warnDays > 0) {
    if (s.alerts.some((a) => a.eventId === eventId)) return;
    const d = DIFFICULTY[s.difficulty];
    const radar = s.modules.some((m) => m.type === 'radar' && m.on);
    const eta = Math.max(1, Math.round(ev.warnDays * d.warningMult)) + (radar ? MODULES.radar.warningBonusDays : 0);
    s.alerts.push({ eventId, etaDays: eta, severity, prepared: [], false: rng.chance(d.falseAlarm) });
    addLog(s, `Aviso: ${ev.name} en ${eta} día(s).`, 'aviso');
  } else if (!s.pending) {
    s.pending = { eventId, severity, prepared: [] };
  }
}

export function rollEvents(state, rng) {
  const s = structuredClone(state);
  s.alerts ??= [];
  if (rng.chance(DIFFICULTY[s.difficulty].disasterRate)) {
    const id = weightedPick(pool(s, true), rng);
    if (id) launchEvent(s, id, rng);
  }
  if (rng.chance(POSITIVE_CHANCE)) {
    const id = weightedPick(pool(s, false), rng);
    if (id) launchEvent(s, id, rng);
  }
  return s;
}

export function tickAlerts(state, rng) {
  void rng;
  const s = structuredClone(state);
  let triggered = null;
  for (const a of s.alerts) a.etaDays -= 1;
  const rest = [];
  for (const a of s.alerts) {
    if (a.etaDays > 0) { rest.push(a); continue; }
    if (a.false) { addLog(s, `Falsa alarma: ${EVENTS[a.eventId].name}`, 'aviso'); continue; }
    if (triggered || s.pending) { a.etaDays = 0; rest.push(a); continue; }
    triggered = { eventId: a.eventId, severity: a.severity, prepared: [...a.prepared] };
    s.pending = { ...triggered };
  }
  s.alerts = rest;
  return { state: s, triggered };
}

export function prepareFor(state, alertIdx, prepId) {
  const s = structuredClone(state);
  const alert = s.alerts[alertIdx];
  if (!alert || alert.prepared.includes(prepId)) return s;
  const prep = EVENTS[alert.eventId].prepare.find((p) => p.id === prepId);
  if (!prep) return s;
  alert.prepared.push(prepId);
  const cost = Object.fromEntries(Object.entries(prep.cost ?? {}).map(([k, v]) => [k, -v]));
  return applyEffects(s, cost);
}

function targetModule(s, type) {
  if (type === 'random') return s.modules.length ? s.modules[s.day % s.modules.length] : null;
  return s.modules.find((m) => m.type === type) ?? null;
}

export function applyEffects(state, effects) {
  const s = structuredClone(state);
  for (const [k, v] of Object.entries(effects ?? {})) {
    if (RESOURCE_KEYS.includes(k)) {
      const max = k === 'battery' ? s.resources.batteryMax : Infinity;
      s.resources[k] = clamp(s.resources[k] + v, 0, max);
    } else if (k === 'science') s.science = Math.max(0, s.science + v);
    else if (k === 'reputation') s.reputation = clamp(s.reputation + v, 0, 100);
    else if (k === 'crewHealth' || k === 'crewMorale') {
      const f = k === 'crewHealth' ? 'health' : 'morale';
      for (const c of s.crew) if (c.alive) c[f] = clamp(c[f] + v, 0, 100);
    } else if (k === 'crewRadiation') {
      const mult = v > 0 ? envMults(s).radMult : 1;
      for (const c of s.crew) if (c.alive) c.radiation = Math.max(0, c.radiation + v * mult);
    } else if (k === 'moduleDamage') {
      for (const [type, n] of Object.entries(v)) {
        const m = targetModule(s, type);
        if (!m) continue;
        m.health = clamp(m.health - n, 0, 100);
        if (m.health <= 0) m.on = false;
      }
    } else if (k === 'moduleOff') {
      for (const [type, days] of Object.entries(v)) {
        const m = targetModule(s, type);
        if (!m) continue;
        m.on = false;
        m.offDays = Math.max(m.offDays ?? 0, days);
      }
    } else if (k === 'delayResupply') s.nextResupply += v;
    else if (k === 'dustDays') { s.flags ??= {}; s.flags.dustUntil = Math.max(s.flags.dustUntil ?? 0, s.day + v); }
    else if (k === 'endMission' && v === 'evacuar') {
      s.outcome = { success: false, reason: 'Evacuación de emergencia: la tripulación volvió antes' };
      for (const c of s.crew) if (c.alive) c.evacuated = true;
    }
  }
  return s;
}

/** Vista previa técnica de una opción: ¿funcionaría ahora? (null si no tiene comprobación). */
export function previewOption(state, eventId, optionId) {
  const opt = EVENTS[eventId].options.find((o) => o.id === optionId);
  if (!opt?.check) return null;
  const prep = state.pending?.eventId === eventId ? state.pending.prepared ?? [] : [];
  return skillCheck(state, opt.check, null, { prepared: prep.length > 0 });
}

/** Lo que recomienda Control de Misión: la primera opción que funciona (las sin comprobación siempre funcionan). */
export function recommendedOption(eventId, state = null) {
  const opts = EVENTS[eventId].options.filter((o) => !o.hidden);
  if (state) {
    const works = opts.find((o) => !o.check || previewOption(state, eventId, o.id)?.ok);
    if (works) return works.id;
  }
  return opts[0].id;
}

export function resolveEvent(state, eventId, severity, optionId, rng, prepared) {
  const ev = EVENTS[eventId];
  const opt = ev.options.find((o) => o.id === optionId);
  if (!opt) throw new Error(`Opción desconocida: ${eventId}/${optionId}`);
  const prep = prepared ?? (state.pending?.eventId === eventId ? state.pending.prepared : null) ?? [];
  const log = [];
  let sev = severity;
  if (REDUCERS[eventId] && prep.includes(REDUCERS[eventId]) && sev !== 'leve') {
    sev = SEVERITIES[SEVERITIES.indexOf(sev) - 1];
    log.push(`La preparación redujo la gravedad a ${sev}.`);
  }
  let s = structuredClone(state);
  log.unshift(`${ev.name} (${sev}): ${ev.text[sev]}`);
  const visibles = ev.options.filter((o) => !o.hidden);
  if (visibles.length > 1 && !opt.hidden && !inBlackout(state)) {
    const followed = optionId === recommendedOption(eventId, state);
    s.reputation = clamp(s.reputation + (followed ? 1 : -1), 0, 100);
    log.push(followed ? 'Seguiste el procedimiento de Control de Misión (+1 fama).' : 'Te apartaste del procedimiento de Control de Misión (−1 fama).');
  }
  let effects = opt.effects[sev];
  if (opt.check) {
    const r = skillCheck(s, opt.check, null, { prepared: prep.length > 0 });
    log.push(`${opt.label}: ${r.text}.`);
    if (!r.ok) effects = opt.failEffects[sev];
  } else log.push(`Decisión: ${opt.label}.`);
  s = applyEffects(s, effects);
  s.pending = null;
  for (const c of ev.chain ?? []) {
    if (rng.chance(c.prob)) {
      launchEvent(s, c.eventId, rng);
      log.push(`Consecuencia: ${EVENTS[c.eventId].name}.`);
      break;
    }
  }
  for (const t of log) addLog(s, t, ev.kind === '+' ? 'bueno' : 'evento');
  return { state: s, log };
}

export function resolveResupply(state, rng) {
  const boom = rng.chance(BOOM[state.difficulty]);
  const event = boom ? 'carga_explota' : 'carga_a_tiempo';
  const ev = EVENTS[event];
  let s = structuredClone(state);
  const log = [];
  if (boom) {
    s.nextResupply += 30;
    log.push(`${ev.name}: ${ev.text.media} Próximo intento en 30 días.`);
  } else {
    const n = s.crew.filter((c) => c.alive).length;
    s = applyEffects(s, {
      food: 60 * n * NEEDS.food, water: 60 * n * NEEDS.water, o2: 60 * n * NEEDS.o2, parts: 20, meds: 5 * n,
    });
    s.medsExpiry = s.day + 180;
    s.nextResupply += SCENARIOS[s.scenarioId].resupplyEvery;
    log.push(`${ev.name}: ${ev.text.media} Llegan 60 días de comida, agua y O₂, 20 piezas y medicinas frescas.`);
  }
  for (const t of log) addLog(s, t, boom ? 'evento' : 'bueno');
  return { state: s, log, event };
}
