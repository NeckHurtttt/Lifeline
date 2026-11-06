import { hasUpgrade } from './campaign.js';
import { DIFFICULTY } from '../data/catalog.js';
import { envMults } from './surface.js';

const RATION = { completa: 1, media: 0.5, nada: 0 };
const FOOD = 1.8;
// Cifras de la NASA (Estación Espacial): ~3,5 L de agua por persona al día (beber, comida e higiene);
// el sistema de recuperación de agua recupera ~93 % (98 % con el reciclador mejorado) si está sano.
const WATER = 3.5;
const O2 = 0.84;
const O2_AS_WATER = 0.95;
const RECOVERY = 0.93;
const RECOVERY_UPGRADED = 0.98;
/** Electricidad que gasta cada astronauta (computadoras, luces, cocina, ropa de ejercicio...), kW. */
export const CREW_KW = 0.4;
/** Pérdidas al cargar y descargar baterías y en los cables: los paneles rinden 90 %. */
export const SOLAR_EFFICIENCY = 0.9;
/** Gasto diario por persona con el soporte vital sano (agua = lo que no se recupera + la que se vuelve O₂). */
export const NEEDS = { food: 1.8, water: WATER * (1 - RECOVERY) + O2_AS_WATER, waterNoLS: WATER, o2: O2 };
/** Fracción del agua que se pierde al reciclar: sube si el soporte vital está dañado. */
export function recycleLoss(s) {
  const ls = s.modules.filter((m) => m.type === 'soporte_vital' && m.on);
  const health = ls.length ? Math.max(...ls.map((m) => m.health ?? 100)) : 0;
  const base = hasUpgrade(s, 'reciclador_99') ? RECOVERY_UPGRADED : RECOVERY;
  // Sano (≥ 70 %) recicla normal; más dañado recicla cada vez peor (a 30 % pierde un tercio del agua).
  return 1 - base * Math.min(1, 0.5 + health / 140);
}
const clamp = (v) => Math.max(0, Math.min(100, v));

/**
 * Aplica un día de vida diaria. Puro: devuelve estado nuevo y registro.
 * @param {object} state MissionState
 * @param {{lifeSupportOn:boolean, sheltered:boolean, exercised:Set<string>, slept:Set<string>}} ctx
 * @returns {{state:object, log:string[]}}
 */
export function applyDailyLife(state, ctx) {
  const s = structuredClone(state);
  const log = [];
  const r = s.resources;
  const deathAllowed = DIFFICULTY[s.difficulty].deathAllowed;
  const living = s.crew.filter((c) => c.alive);
  const { boneMult, radMult } = envMults(s);

  const ration = (c) => RATION[s.rations[c.id]] ?? 1;
  const foodMult = (c) => (c.traits.includes('gloton') ? 1.2 : 1) * (c.traits.includes('frugal') ? 0.8 : 1);
  const foodNeed = living.reduce((t, c) => t + FOOD * ration(c) * foodMult(c), 0);
  // Agua para beber, comer e higiene (lo que no se recupera) y aparte la que la electrólisis vuelve O₂.
  const drinkNeed = living.reduce((t, c) => t + WATER * ration(c) * (ctx.lifeSupportOn ? recycleLoss(s) : 1), 0);
  const electroNeed = ctx.lifeSupportOn ? living.length * O2_AS_WATER : 0;
  // Como en la estación: si el agua escasea, primero se bebe; la electrólisis se frena y el O₂ sale de los tanques.
  const electroWater = Math.min(electroNeed, Math.max(0, r.water - drinkNeed));
  const waterNeed = drinkNeed + electroWater;
  let o2Need = ctx.lifeSupportOn ? 0 : living.length * O2;
  if (electroNeed > 0 && electroWater < electroNeed) {
    o2Need = living.length * O2 * (1 - electroWater / electroNeed);
    log.push('Poca agua: se frena la electrólisis y el oxígeno sale de los tanques.');
  }

  const foodShort = r.food < foodNeed;
  const waterShort = r.water < drinkNeed;
  const o2Short = r.o2 < o2Need;
  r.food = foodShort ? 0 : r.food - foodNeed;
  r.water = waterShort ? 0 : r.water - waterNeed;
  r.o2 = o2Short ? 0 : r.o2 - o2Need;
  if (foodShort) log.push('Se acabó la comida: la tripulación pasa hambre.');
  if (waterShort) log.push('Se acabó el agua: la tripulación pasa sed.');
  if (o2Short) log.push('Se acabó el oxígeno: la tripulación se asfixia.');

  for (const c of living) {
    const foodR = foodShort ? 0 : ration(c);
    const waterR = waterShort ? 0 : ration(c);
    c.hunger = foodR === 1 ? c.hunger - 30 : c.hunger + 35 * (1 - foodR);
    c.thirst = waterR === 1 ? c.thirst - 30 : c.thirst + 35 * (1 - waterR);
    c.hunger = clamp(c.hunger);
    c.thirst = clamp(c.thirst);

    let dmg = 0;
    if (c.hunger >= 100 || c.thirst >= 100) dmg += 15;
    if (o2Short) dmg += 40;
    if (c.traits.includes('fragil')) dmg *= 1.2;
    c.health = clamp(c.health - dmg);

    if (!ctx.exercised.has(c.id)) c.bone = clamp(c.bone - (c.traits.includes('atleta') ? 0.25 : 0.5) * boneMult);

    const slept = ctx.slept.has(c.id);
    const insomne = c.traits.includes('insomne');
    c.fatigue = clamp(c.fatigue + (slept ? (insomne ? -25 : -35) : (insomne ? 50 : 40)));

    let loss = 1 + (c.traits.includes('claustrofobico') ? 1 : 0);
    if (c.fatigue >= 80) loss += 5;
    if (c.traits.includes('sereno')) loss /= 2;
    let morale = c.morale - loss;
    if (ration(c) === 1 && !foodShort && !waterShort && slept) morale += 3;
    c.morale = clamp(morale);

    c.radiation += 0.5 * radMult * (ctx.sheltered ? 0.2 : 1) * (c.traits.includes('resistente') ? 0.8 : 1);

    if (c.health <= 0) {
      c.alive = false;
      if (deathAllowed) {
        log.push(`${c.name} ha muerto`);
      } else {
        c.evacuated = true;
        log.push(`${c.name} fue evacuado a la Tierra`);
      }
    }
  }
  return { state: s, log };
}
