import { DIFFICULTY } from '../data/catalog.js';

const RATION = { completa: 1, media: 0.5, nada: 0 };
const FOOD = 1.8;
const WATER = 2.75;
const O2 = 0.84;
const O2_AS_WATER = 0.95;
const RECYCLE_LOSS = 0.02;
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

  const ration = (c) => RATION[s.rations[c.id]] ?? 1;
  const foodMult = (c) => (c.traits.includes('gloton') ? 1.2 : 1) * (c.traits.includes('frugal') ? 0.8 : 1);
  const foodNeed = living.reduce((t, c) => t + FOOD * ration(c) * foodMult(c), 0);
  const waterNeed = living.reduce(
    (t, c) => t + (ctx.lifeSupportOn ? WATER * ration(c) * RECYCLE_LOSS + O2_AS_WATER : WATER * ration(c)),
    0,
  );
  let o2Need = ctx.lifeSupportOn ? 0 : living.length * O2;
  if (ctx.lifeSupportOn && waterNeed > 0 && r.water < waterNeed) {
    // el agua que falta para la electrólisis se cubre con el tanque de O₂
    o2Need = living.length * O2 * (1 - r.water / waterNeed);
  }

  const foodShort = r.food < foodNeed;
  const waterShort = r.water < waterNeed;
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

    if (!ctx.exercised.has(c.id)) c.bone = clamp(c.bone - (c.traits.includes('atleta') ? 0.25 : 0.5));

    const slept = ctx.slept.has(c.id);
    const insomne = c.traits.includes('insomne');
    c.fatigue = clamp(c.fatigue + (slept ? (insomne ? -25 : -35) : (insomne ? 50 : 40)));

    let loss = 1 + (c.traits.includes('claustrofobico') ? 1 : 0);
    if (c.fatigue >= 80) loss += 5;
    if (c.traits.includes('sereno')) loss /= 2;
    let morale = c.morale - loss;
    if (ration(c) === 1 && !foodShort && !waterShort && slept) morale += 3;
    c.morale = clamp(morale);

    c.radiation += 0.5 * (ctx.sheltered ? 0.2 : 1) * (c.traits.includes('resistente') ? 0.8 : 1);

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
