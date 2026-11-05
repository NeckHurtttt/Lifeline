import { MINIMISSIONS } from '../data/minimissions.js';
import { applyEffects } from './events.js';
import { skillCheck } from './skill.js';
import { miniEvaNoGo } from './protocols.js';

const OFFER_PROB = 0.04;
const MAX_OPEN = 2;

const hasModule = (s, type) => s.modules.some((m) => m.type === type && m.on);
const open = (s) => s.minis.filter((m) => m.status === 'oferta');

function newEntry(state, id, deadline) {
  return { id, status: 'oferta', offeredDay: state.day, deadline: state.day + deadline, crewIds: [], daysLeft: MINIMISSIONS[id].days };
}

function expire(s) {
  for (const m of s.minis) {
    if (m.status !== 'oferta' || s.day < m.deadline) continue;
    m.status = 'vencida';
    if (MINIMISSIONS[m.id].mandatory) s.flags = { ...(s.flags ?? {}), lastCargoLost: true };
  }
}

export function offerMinis(state, rng) {
  const s = structuredClone(state);
  expire(s);
  if (open(s).length >= MAX_OPEN || !rng.chance(OFFER_PROB)) return s;
  const taken = new Set(s.minis.filter((m) => ['oferta', 'activa', 'hecha'].includes(m.status)).map((m) => m.id));
  const candidates = Object.values(MINIMISSIONS).filter((d) => {
    if (d.mandatory || taken.has(d.id)) return false;
    if (d.chainUnlock && !s.minis.some((m) => m.id === d.chainUnlock && m.status === 'hecha')) return false;
    return true;
  });
  if (!candidates.length) return s;
  const def = rng.pick(candidates);
  s.minis.push(newEntry(s, def.id, def.deadline));
  return s;
}

export function forceMini(state, miniId) {
  const s = structuredClone(state);
  s.minis.push(newEntry(s, miniId, MINIMISSIONS[miniId].deadline));
  return s;
}

export function acceptMini(state, miniId, crewIds = []) {
  const entry = state.minis.find((m) => m.id === miniId && m.status === 'oferta');
  if (!entry) return { state, error: 'No hay oferta de esa minimisión' };
  if (state.day >= entry.deadline) {
    const s = structuredClone(state);
    const e = s.minis.find((m) => m.id === miniId && m.status === 'oferta');
    e.status = 'vencida';
    if (MINIMISSIONS[miniId].mandatory) s.flags = { ...(s.flags ?? {}), lastCargoLost: true };
    return { state: s, error: 'No hay oferta de esa minimisión' };
  }
  const def = MINIMISSIONS[miniId];
  for (const t of def.requires.modules ?? []) if (!hasModule(state, t)) return { state, error: `Falta el módulo: ${t}` };
  for (const i of def.instruments ?? []) if (!state.design.instruments.includes(i)) return { state, error: `Falta el instrumento: ${i}` };
  const busy = new Set(state.minis.filter((m) => m.status === 'activa').flatMap((m) => m.crewIds));
  const crew = crewIds.map((id) => state.crew.find((c) => c.id === id));
  const ok = crew.every((c) => c && c.alive && !c.evacuated && !busy.has(c.id)) && new Set(crewIds).size === crewIds.length;
  if (!ok || crew.length < def.requires.crew) return { state, error: 'Faltan tripulantes' };
  if (def.requires.role && !crew.some((c) => c.role === def.requires.role)) return { state, error: 'Faltan tripulantes' };
  if (def.eva) { const why = miniEvaNoGo(state, crew); if (why) return { state, error: `NO GO para la EVA: ${why}` }; }
  let s = applyEffects(state, def.cost);
  const e = s.minis.find((m) => m.id === miniId && m.status === 'oferta');
  e.status = 'activa';
  e.crewIds = [...crewIds];
  e.daysLeft = def.days;
  return { state: s };
}

/** ¿Funcionaría la minimisión con estos tripulantes? */
export function previewMini(state, miniId, crewIds) {
  return skillCheck(state, MINIMISSIONS[miniId].check, crewIds);
}

export function progressMinis(state, rng) {
  let s = structuredClone(state);
  expire(s);
  const log = [];
  const vencidas = s.minis.filter((m) => m.status === 'vencida' && m.deadline === s.day);
  for (const m of vencidas) {
    log.push(`Se acabó el plazo: ${MINIMISSIONS[m.id].name}`);
  }
  for (const id of s.minis.filter((m) => m.status === 'activa').map((m) => m.id)) {
    const def = MINIMISSIONS[id];
    let e = s.minis.find((m) => m.id === id && m.status === 'activa');
    if (def.eva) addRadiation(s, e);
    e = s.minis.find((m) => m.id === id && m.status === 'activa');
    e.daysLeft -= 1;
    if (e.daysLeft > 0) continue;
    const r = skillCheck(s, def.check, e.crewIds);
    const ok = r.ok;
    s = applyEffects(s, ok ? def.reward : def.failure);
    s.flags = s.flags ?? {};
    const f = s.minis.find((m) => m.id === id && m.status === 'activa');
    f.status = ok ? 'hecha' : 'fallida';
    if (ok) {
      if (id === 'retirar_basura') s.flags.debrisCleared = true;
      if (id === 'experimento_externo') s.flags.extraSciencePerDay = (s.flags.extraSciencePerDay ?? 0) + 2;
      if (id === 'cambiar_panel') for (const m of s.modules) if (m.type === 'paneles') m.health = 100;
    } else if (def.mandatory) s.flags.lastCargoLost = true;
    log.push(`${def.name}: ${ok ? 'éxito' : 'fracaso'} (${r.text})`);
  }
  return { state: s, log };
}

// EVA: +1 radiación por tripulante asignado y día (solo a los asignados)
function addRadiation(s, e) {
  for (const cid of e.crewIds) {
    const c = s.crew.find((x) => x.id === cid);
    if (c) c.radiation = (c.radiation ?? 0) + 1;
  }
}
