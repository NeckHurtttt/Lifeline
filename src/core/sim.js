// Bucle de simulación: avanza días y se detiene cuando hay algo que decidir.
import { hasUpgrade } from './campaign.js';
import { restoreRng } from './rng.js';
import { rollEvents, tickAlerts, resolveResupply } from './events.js';
import { offerMinis, progressMinis } from './minimissions.js';
import { applyTasks, validateSchedule } from './tasks.js';
import { applyEnergy } from './energy.js';
import { applyDailyLife } from './life.js';
import { expireMeds, exerciseRule } from './protocols.js';
import { siteOf, scenarioOf, isNight, daysToNight } from './surface.js';
import { MODULES } from '../data/catalog.js';
import { progressExpedition } from './explore.js';
import { legOf, phaseDue, marsSolarFactor, inBlackout, isMars, CONJUNCTION } from './mars.js';

export const NIGHT_WARN_DAYS = 2;

const LOW_DAYS = 7;
const NEED = { food: 1.8, water: 2.75 * 0.02 + 0.95, waterNoLS: 2.75, o2: 0.84 };
const RES_NAME = { food: 'comida', water: 'agua', o2: 'oxígeno' };

const living = (s) => s.crew.filter((c) => c.alive);
const lsOn = (s) => s.modules.some((m) => m.type === 'soporte_vital' && m.on);
const pushLog = (s, lines, kind) => { for (const text of lines) s.log.push({ day: s.day, text, kind }); };

/** Días que alcanza cada consumible al ritmo actual (Infinity si no se consume). */
export function daysLeft(state) {
  const n = living(state).length;
  const ls = lsOn(state);
  const r = state.resources;
  const need = { food: NEED.food * n, water: (ls ? NEED.water : NEED.waterNoLS) * n, o2: ls ? 0 : NEED.o2 * n };
  const out = {};
  for (const k of ['food', 'water', 'o2']) out[k] = need[k] > 0 ? r[k] / need[k] : Infinity;
  return out;
}

export function checkEnd(state) {
  const back = state.crew.filter((c) => c.alive && !c.evacuated).length;
  if (back === 0) return { success: false, reason: state.outcome?.reason ?? 'Toda la tripulación se perdió' };
  if (state.outcome && !state.outcome.success) return state.outcome;
  return null;
}

/**
 * Avanza un día. Puro.
 * @returns {{state:object, interrupt:null|{kind:string, data:any}}}
 */
export function advanceDay(state) {
  if (state.outcome || state.phase !== 'ops') return { state, interrupt: { kind: 'fin', data: state.outcome } };
  if (state.pending) return { state, interrupt: { kind: 'evento', data: state.pending } };
  const due = phaseDue(state);
  if (due) return { state, interrupt: { kind: 'fase', data: { phase: due } } };
  const bad = validateSchedule(Object.fromEntries(Object.entries(state.schedule)
    .filter(([id]) => state.crew.find((c) => c.id === id)?.alive)));
  if (bad.length) return { state, interrupt: { kind: 'horario', data: bad } };

  const rng = restoreRng(state.rng);
  let s = structuredClone(state);
  s.flags ??= {};
  s.day += 1;
  s.leg = legOf(s);
  const alertsBefore = s.alerts.length;
  const offersBefore = s.minis.filter((m) => m.status === 'oferta').length;
  const aliveBefore = living(s).length;

  s = rollEvents(s, rng);
  if (s.mode === 'demo') s = rollEvents(s, rng);
  for (const st of s.realStorms ?? []) {
    if (st.day !== s.day || s.alerts.some((a) => a.eventId === 'tormenta_solar')) continue;
    s.alerts.push({ eventId: 'tormenta_solar', etaDays: 2, severity: st.severity, prepared: [], false: false, real: st });
    pushLog(s, [`Aviso real: fulguración ${st.cls} detectada (${st.date}). Tormenta solar en 2 días.`], 'aviso');
  }
  s = tickAlerts(s, rng).state;
  s = offerMinis(s, rng);

  const t = applyTasks(s, rng);
  s = t.state; pushLog(s, t.log, 'labor');
  const p = progressMinis(s, rng);
  s = p.state; pushLog(s, p.log, 'mini');
  const expResult = progressExpedition(s);

  for (const m of s.modules) {
    if (!m.offDays) continue;
    m.offDays -= 1;
    if (m.offDays === 0 && m.health > 0) { m.on = true; pushLog(s, [`Vuelve a funcionar: ${m.type}`], 'bueno'); }
  }
  if (s.flags.extraSciencePerDay) s.science += s.flags.extraSciencePerDay;

  const site = siteOf(s);
  const sc = scenarioOf(s);
  const night = isNight(site, s.day);
  const e = applyEnergy(s, { solarFactor: night ? 0 : marsSolarFactor(s, site), heatKw: night ? sc.nightHeatKw ?? 0 : 0 });
  s = e.state; pushLog(s, e.log, 'energia');
  // Recursos del lugar: agua del hielo y combustible fabricado allí (ISRU).
  for (const m of s.modules) {
    if (!m.on || m.health <= 0) continue;
    const def = MODULES[m.type];
    if (s.leg === 'ida' || s.leg === 'vuelta') continue; // en el viaje no hay suelo
    if (def.waterPerDay && site?.ice) s.resources.water += def.waterPerDay * (m.health / 100);
    if (def.fuelPerDay) s.resources.fuel += def.fuelPerDay * (m.health / 100) * (hasUpgrade(s, 'isru_mejorado') ? 1.5 : 1);
  }

  const l = applyDailyLife(s, { ...t.ctx, lifeSupportOn: lsOn(s) });
  s = l.state; pushLog(s, l.log, 'vida');
  const proto = [];
  expireMeds(s, proto);
  exerciseRule(s, t.ctx.exercised, proto);
  pushLog(s, proto, 'aviso');

  if (s.day >= s.nextResupply && living(s).length) s = resolveResupply(s, rng).state;

  const r = s.resources;
  s.history.push({ day: s.day, o2: r.o2, water: r.water, food: r.food, battery: r.battery });
  s.rng = rng.state();

  const end = checkEnd(s);
  if (end) {
    s.outcome = end; s.phase = 'report';
    pushLog(s, [end.reason], 'fin');
    return { state: s, interrupt: { kind: 'fin', data: end } };
  }
  if (living(s).length < aliveBefore) return { state: s, interrupt: { kind: 'muerte', data: l.log } };
  if (s.day >= s.totalDays) {
    s.phase = 'reentry';
    pushLog(s, [`Día ${s.totalDays}: hora de volver a casa.`], 'fin');
    return { state: s, interrupt: { kind: 'fin', data: null } };
  }
  if (s.pending) return { state: s, interrupt: { kind: 'evento', data: s.pending } };
  if (s.alerts.length > alertsBefore) return { state: s, interrupt: { kind: 'alerta', data: s.alerts.at(-1) } };
  const offers = s.minis.filter((m) => m.status === 'oferta');
  if (offers.length > offersBefore) return { state: s, interrupt: { kind: 'mini', data: offers.at(-1) } };

  const fase = phaseDue(s);
  if (fase) return { state: s, interrupt: { kind: 'fase', data: { phase: fase } } };
  if (isMars(s) && s.day === CONJUNCTION.warn) {
    const text = `En ${CONJUNCTION.start - CONJUNCTION.warn} días empieza la conjunción solar: el Sol queda entre Marte y la Tierra y no habrá radio durante ${CONJUNCTION.end - CONJUNCTION.start + 1} días. Manden los datos ahora`;
    pushLog(s, [text], 'aviso');
    return { state: s, interrupt: { kind: 'aviso', data: { text } } };
  }
  if (isMars(s) && s.day === CONJUNCTION.end + 1) pushLog(s, ['📡 Terminó la conjunción solar: vuelve la radio con la Tierra.'], 'bueno');
  if (site?.nightDays && daysToNight(site, s.day) === NIGHT_WARN_DAYS) {
    const text = `En ${NIGHT_WARN_DAYS} días empieza la noche: ${site.nightDays} días sin sol y mucho frío. Revisa la batería y apaga lo que no haga falta`;
    pushLog(s, [text], 'aviso');
    return { state: s, interrupt: { kind: 'noche', data: { text, days: site.nightDays } } };
  }
  if (site?.nightDays && isNight(site, s.day) && !isNight(site, s.day - 1)) pushLog(s, ['🌑 Empieza la noche. Sin sol: la base vive de lo que guardó.'], 'aviso');
  if (site?.nightDays && !isNight(site, s.day) && isNight(site, s.day - 1)) pushLog(s, ['🌅 ¡Amanece! Los paneles vuelven a cargar.'], 'bueno');
  if (expResult) return { state: s, interrupt: { kind: 'expedicion', data: expResult } };
  const left = daysLeft(s);
  s.flags.lowWarned ??= {};
  let low = null;
  for (const k of ['food', 'water', 'o2']) {
    if (left[k] < LOW_DAYS) {
      if (!s.flags.lowWarned[k] && !low) { s.flags.lowWarned[k] = true; low = k; }
    } else s.flags.lowWarned[k] = false;
  }
  if (low) {
    const text = `Quedan menos de ${LOW_DAYS} días de ${RES_NAME[low]}`;
    pushLog(s, [text], 'aviso');
    return { state: s, interrupt: { kind: 'recurso', data: { resource: low, days: left[low], text } } };
  }
  return { state: s, interrupt: null };
}

export function runUntilInterrupt(state, maxDays = 365) {
  let s = state;
  for (let i = 0; i < maxDays; i++) {
    const r = advanceDay(s);
    s = r.state;
    if (r.interrupt) return r;
  }
  return { state: s, interrupt: null };
}
