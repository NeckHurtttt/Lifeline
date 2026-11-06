// Exploración por nodos con rovers (Luna y Marte): un mapa con niebla; al visitar un lugar se descubren sus vecinos.
// Todo determinista: el mapa sale de la semilla y el resultado se sabe antes (comprobación técnica).
import { createRng } from './rng.js';
import { skillCheck } from './skill.js';
import { applyEffects } from './events.js';
import { miniEvaNoGo } from './protocols.js';
import { ORBITS } from '../data/catalog.js';

export const NODE_TYPES = {
  crater_hielo: { icon: '🧊', name: 'Cráter con hielo', desc: 'Un cráter siempre en sombra guarda hielo.', check: { stat: 'fuerza', dc: 10 }, reward: { water: 200, science: 4 }, failure: { crewHealth: -5 }, ice: true },
  crater: { icon: '🌑', name: 'Cráter joven', desc: 'Rocas lanzadas de muy hondo por un impacto.', check: { stat: 'ciencia', dc: 9 }, reward: { science: 8 }, failure: {} },
  cueva: { icon: '🕳️', name: 'Tubo de lava', desc: 'Una cueva que podría proteger una base de la radiación.', check: { stat: 'temple', dc: 12 }, reward: { science: 14, reputation: 5 }, failure: { crewHealth: -10, crewRadiation: 5 } },
  roca: { icon: '🪨', name: 'Campo de rocas raras', desc: 'Rocas muy antiguas, perfectas para estudiar.', check: { stat: 'ciencia', dc: 10 }, reward: { science: 10 }, failure: { science: 1 } },
  sonda: { icon: '🛰️', name: 'Sonda antigua', desc: 'Una nave robot de hace décadas. ¿Se pueden recuperar piezas?', check: { stat: 'tecnica', dc: 11 }, reward: { reputation: 10, parts: 6 }, failure: { parts: -1 } },
  mirador: { icon: '🏔️', name: 'Mirador', desc: 'Una loma alta: desde ahí se ve todo el mapa cercano.', check: null, reward: { crewMorale: 10 }, failure: {}, revealAll: true },
  peligro: { icon: '⚠️', name: 'Terreno peligroso', desc: 'Pendientes y polvo suelto, pero dicen que hay algo valioso.', check: { stat: 'fuerza', dc: 13 }, reward: { science: 18, reputation: 6 }, failure: { moduleDamage: { rover: 40 }, crewHealth: -10 } },
  pico: { icon: '☀️', name: 'Pico de luz eterna', desc: 'Un lugar donde casi siempre da el sol: ideal para paneles.', check: { stat: 'tecnica', dc: 10 }, reward: { battery: 1000, reputation: 4 }, failure: {}, sites: ['luna_polo'] },
  delta: { icon: '🏞️', name: 'Delta de un río antiguo', desc: 'Donde había agua puede haber rastros de vida.', check: { stat: 'ciencia', dc: 12 }, reward: { science: 20, reputation: 8 }, failure: { science: 2 }, sites: ['marte_jezero'] },
};

const POS = [[50, 50], [24, 30], [76, 28], [20, 72], [80, 70], [50, 14], [50, 86], [10, 48], [90, 48]];
const LINKS = { base: ['n1', 'n2', 'n3', 'n4'], n1: ['base', 'n5', 'n7'], n2: ['base', 'n5', 'n8'], n3: ['base', 'n6', 'n7'], n4: ['base', 'n6', 'n8'], n5: ['n1', 'n2'], n6: ['n3', 'n4'], n7: ['n1', 'n3'], n8: ['n2', 'n4'] };

/** Genera el mapa del sitio. Nodos cercanos (1 día) alrededor de la base y lejanos (2 días) afuera. */
export function genMap(seed, siteId) {
  const site = ORBITS[siteId];
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
  const types = Object.entries(NODE_TYPES).filter(([, t]) => (!t.sites || t.sites.includes(siteId)) && (!t.ice || site?.ice)).map(([id]) => id);
  if (!site?.ice) types.push('crater');
  const nodes = [{ id: 'base', type: 'base', x: 50, y: 50, dist: 0, known: true, done: true, links: LINKS.base }];
  for (let i = 1; i <= 8; i++) {
    const id = `n${i}`;
    const special = types.find((t) => NODE_TYPES[t].sites) && i === 6 ? types.find((t) => NODE_TYPES[t].sites) : null;
    nodes.push({ id, type: special ?? rng.pick(types), x: POS[i][0], y: POS[i][1], dist: i <= 4 ? 1 : 2, known: i <= 4, done: false, links: LINKS[id] });
  }
  return nodes;
}

export const hasRoverPres = (s) => s.modules.some((m) => m.type === 'rover' && m.on && m.health > 0);
export const hasRoverAuto = (s) => s.modules.some((m) => m.type === 'rover_autonomo' && m.on && m.health > 0);

/** ¿Se puede explorar aquí? */
export const canExplore = (s) => ['luna', 'marte'].includes(s.scenarioId) && (s.leg ?? 'superficie') === 'superficie' && (hasRoverPres(s) || hasRoverAuto(s));

export function ensureMap(state) {
  if (state.map) return state;
  return { ...state, map: genMap(state.seed, state.design.orbit) };
}

/** Días de viaje (ida y vuelta) hasta un nodo. El rover autónomo tarda el doble. */
export const tripDays = (node, auto) => node.dist * 2 * (auto ? 2 : 1);

/** Vista previa: ¿funcionaría con estos tripulantes? */
export function previewExpedition(state, nodeId, crewIds) {
  const node = state.map?.find((n) => n.id === nodeId);
  const t = node && NODE_TYPES[node.type];
  if (!t) return null;
  if (!t.check) return { ok: true, total: 0, need: 0, parts: [], text: 'no hace falta comprobar nada' };
  return skillCheck(state, t.check, crewIds);
}

export function startExpedition(state, nodeId, crewIds) {
  if (!canExplore(state)) return { state, error: 'Hace falta un rover en buen estado' };
  if (state.expedition) return { state, error: 'El rover ya está afuera' };
  const s0 = ensureMap(state);
  const node = s0.map.find((n) => n.id === nodeId);
  if (!node || !node.known || node.done || node.type === 'base') return { state, error: 'Ese lugar no se puede visitar' };
  const auto = !hasRoverPres(s0);
  const busy = new Set((s0.minis ?? []).filter((m) => m.status === 'activa').flatMap((m) => m.crewIds));
  const crew = crewIds.map((id) => s0.crew.find((c) => c.id === id));
  if (crew.some((c) => !c || !c.alive || c.evacuated || busy.has(c.id))) return { state, error: 'Ese tripulante no está libre' };
  if (crew.length < (auto ? 1 : 2)) return { state, error: auto ? 'Hace falta 1 persona que maneje el rover autónomo' : 'Nunca se sale solo: hacen falta 2' };
  if (!auto) { const why = miniEvaNoGo(s0, crew); if (why) return { state, error: `NO GO: ${why}` }; }
  const s = structuredClone(s0);
  s.expedition = { nodeId, crewIds: [...crewIds], daysLeft: tripDays(node, auto), auto };
  s.log.push({ day: s.day, text: `🚙 Expedición a ${NODE_TYPES[node.type].name}: ${tripDays(node, auto)} días.`, kind: 'mini' });
  return { state: s };
}

/** Avanza un día la expedición. Muta `s` (ya clonado) y devuelve el resultado si terminó. */
export function progressExpedition(s) {
  const e = s.expedition;
  if (!e) return null;
  if (!e.auto) for (const id of e.crewIds) { const c = s.crew.find((x) => x.id === id); if (c) c.radiation += 1; }
  e.daysLeft -= 1;
  if (e.daysLeft > 0) return null;
  const node = s.map.find((n) => n.id === e.nodeId);
  const t = NODE_TYPES[node.type];
  const r = t.check ? skillCheck(s, t.check, e.crewIds) : { ok: true, text: 'sin comprobación' };
  const after = applyEffects(s, r.ok ? t.reward : t.failure);
  Object.assign(s, after);
  const n2 = s.map.find((n) => n.id === e.nodeId);
  n2.done = true;
  for (const id of t.revealAll ? s.map.map((n) => n.id) : n2.links) s.map.find((n) => n.id === id).known = true;
  const text = `${t.icon} ${t.name}: ${r.ok ? '¡éxito!' : 'no salió bien'} (${r.text}).`;
  s.log.push({ day: s.day, text, kind: r.ok ? 'bueno' : 'evento' });
  s.expedition = null;
  return { ok: r.ok, text, nodeId: node.id };
}

export const expeditionCrew = (s) => new Set(s.expedition?.crewIds ?? []);
