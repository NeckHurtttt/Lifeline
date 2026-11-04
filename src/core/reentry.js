// Secuencia de reentrada: desacople, encendido de salida, plasma, escudo y paracaídas.
import { DIFFICULTY } from '../data/catalog.js';

export const REENTRY_STEPS = [
  { id: 'desacople', label: 'Desacople de la estación' },
  { id: 'encendido_salida', label: 'Encendido de salida de órbita' },
  { id: 'sep_modulo_servicio', label: 'Separación del módulo de servicio' },
  { id: 'interfaz_entrada', label: 'Interfaz de entrada a 120 km' },
  { id: 'apagon_plasma', label: 'Apagón de plasma: ~4 min sin radio' },
  { id: 'escudo_termico', label: 'Escudo térmico a 1600 °C' },
  { id: 'paracaidas_freno', label: 'Paracaídas de freno' },
  { id: 'paracaidas_principales', label: 'Paracaídas principales (3)' },
  { id: 'amerizaje', label: 'Amerizaje' },
  { id: 'recuperacion', label: 'Recuperación de la tripulación' },
];

const DEORBIT_FUEL = 10;
const MAIN_CHUTE_RISK = 0.03;
const SEVERITIES = ['leve', 'media', 'grave'];

const living = (s) => s.crew.filter((c) => c.alive);
const hurt = (s, n) => { for (const c of living(s)) c.health = Math.max(1, c.health - n); };

function loseDay(s) {
  const n = living(s).length;
  const r = s.resources;
  r.food = Math.max(0, r.food - 1.8 * n);
  r.water = Math.max(0, r.water - 2.75 * n * 0.02 - 0.95 * n);
  s.day += 1;
}

function pickSeverity(rng, difficulty) {
  const w = DIFFICULTY[difficulty].severityWeights;
  let x = rng.next();
  for (let i = 0; i < w.length; i++) { if (x < w[i]) return SEVERITIES[i]; x -= w[i]; }
  return 'grave';
}

export function heatShieldRisk(state) {
  const cabina = state.modules.find((m) => m.type === 'cabina');
  const health = cabina ? cabina.health : 0;
  return ((100 - health) / 100) * 0.5;
}

/**
 * Ejecuta un paso de la reentrada. Puro: devuelve estado nuevo.
 * @param {'normal'|'empinado'|'rasante'} [choice] ángulo de entrada en interfaz_entrada
 * @returns {{ok:boolean, state:object, log:string[], failure?:string}}
 */
export function runReentryStep(state, stepId, rng, choice) {
  const step = REENTRY_STEPS.find((x) => x.id === stepId);
  if (!step) throw new Error(`Paso desconocido: ${stepId}`);
  const s = structuredClone(state);
  const log = [step.label];

  switch (stepId) {
    case 'encendido_salida':
      if (s.resources.fuel < DEORBIT_FUEL) {
        loseDay(s);
        log.push('No hay combustible suficiente para salir de órbita: se espera reabastecimiento (−1 día)');
        if (s.scenarioId === 'estacion') {
          s.resources.fuel += DEORBIT_FUEL;
          log.push('La estación transfiere combustible para el próximo intento');
        }
        return { ok: false, state: s, log, failure: 'Sin combustible' };
      }
      s.resources.fuel -= DEORBIT_FUEL;
      break;
    case 'interfaz_entrada': {
      const angle = choice ?? 'normal';
      s.reentryAngle = angle;
      if (angle === 'rasante' && rng.chance(0.3)) {
        loseDay(s);
        log.push('Entrada demasiado rasante: la cápsula rebota en la atmósfera y da otra vuelta (+1 día)');
      }
      break;
    }
    case 'escudo_termico': {
      if (s.reentryAngle === 'empinado' && rng.chance(0.2)) {
        hurt(s, 10);
        log.push('Entrada empinada: la desaceleración golpea a la tripulación (−10 salud)');
      }
      if (rng.chance(heatShieldRisk(s))) {
        const sev = pickSeverity(rng, s.difficulty);
        if (sev === 'grave') {
          for (const c of s.crew) { c.alive = false; c.health = 0; }
          s.phase = 'report';
          s.outcome = { success: false, reason: 'Falla del escudo térmico en la reentrada' };
          log.push('El escudo térmico se rompe: la cápsula se pierde');
          return { ok: false, state: s, log, failure: 'Falla grave del escudo' };
        }
        const dmg = sev === 'media' ? 25 : 10;
        hurt(s, dmg);
        log.push(`El escudo térmico se daña (${sev}): calor en cabina (−${dmg} salud)`);
      }
      break;
    }
    case 'paracaidas_principales':
      if (rng.chance(MAIN_CHUTE_RISK)) {
        hurt(s, 20);
        log.push('Solo abren 2 de 3 paracaídas: amerizaje duro (−20 salud)');
      }
      break;
    case 'recuperacion': {
      const n = living(s).length;
      s.phase = 'report';
      s.outcome = n > 0
        ? { success: true, reason: `Misión cumplida: ${n} tripulante(s) de vuelta en la Tierra` }
        : { success: false, reason: 'Toda la tripulación se perdió' };
      break;
    }
    case 'apagon_plasma':
      log.push('Control de misión espera en silencio…');
      break;
  }
  return { ok: true, state: s, log };
}
