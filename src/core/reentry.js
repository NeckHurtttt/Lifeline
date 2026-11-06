// Secuencia de reentrada: desacople, encendido de salida, plasma, escudo y paracaídas.
import { hasUpgrade } from './campaign.js';
import { DIFFICULTY } from '../data/catalog.js';

export const REENTRY_STEPS = [
  { id: 'desacople', desc: 'La cápsula se suelta de la estación.', label: 'Desacople de la estación' },
  { id: 'encendido_salida', desc: 'Un empujón de motor para frenar y empezar a bajar (gasta 10 de combustible).', label: 'Encendido de salida de órbita' },
  { id: 'sep_modulo_servicio', desc: 'Se suelta la parte de atrás de la nave.', label: 'Separación del módulo de servicio' },
  { id: 'interfaz_entrada', desc: 'La cápsula toca el aire de la Tierra a 120 km de altura.', label: 'Interfaz de entrada a 120 km' },
  { id: 'apagon_plasma', desc: 'El aire se calienta tanto que brilla y la radio no funciona.', label: 'Apagón de plasma: ~4 min sin radio' },
  { id: 'escudo_termico', desc: 'El escudo aguanta 1600 °C. Si la cabina está dañada, puede fallar.', label: 'Escudo térmico a 1600 °C' },
  { id: 'paracaidas_freno', desc: 'Un paracaídas chico frena primero.', label: 'Paracaídas de freno' },
  { id: 'paracaidas_principales', desc: 'Se abren 3 paracaídas gigantes.', label: 'Paracaídas principales (3)' },
  { id: 'amerizaje', desc: '¡Splash! La cápsula cae al mar.', label: 'Amerizaje' },
  { id: 'recuperacion', desc: 'Un barco recoge a los astronautas.', label: 'Recuperación de la tripulación' },
];

const OVERRIDES = {
  luna: {
    desacople: { label: 'Despegue desde la Luna', desc: 'El módulo de ascenso enciende su motor y sube a la tripulación a órbita lunar.' },
    encendido_salida: { label: 'Encendido de regreso a la Tierra (TEI)', desc: 'Un empujón para salir de la Luna rumbo a casa: 3 días de viaje (gasta 10 de combustible).' },
    interfaz_entrada: { label: 'Interfaz de entrada a 11 km/s', desc: 'Volviendo de la Luna se llega mucho más rápido que desde la estación: el escudo sufre más.' },
  },
  marte: {
    desacople: { label: 'Llegada a la Tierra: se suelta la cápsula', desc: 'Tras 7 meses de viaje, la cápsula se separa de la nave grande.' },
    encendido_salida: { label: 'Corrección final de trayectoria', desc: 'Un último ajuste para entrar a la atmósfera en el ángulo justo (gasta 10 de combustible).' },
    interfaz_entrada: { label: 'Interfaz de entrada a 12 km/s', desc: 'La entrada más rápida de todas: el escudo térmico trabaja al máximo.' },
  },
};
/** Pasos de la reentrada según el destino (mismos ids, textos propios). */
export const reentrySteps = (scenarioId) => REENTRY_STEPS.map((st) => ({ ...st, ...(OVERRIDES[scenarioId]?.[st.id] ?? {}) }));
const SHIELD_MULT = { estacion: 1, gateway: 1.4, luna: 1.4, marte: 1.6 };

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
  return Math.min(0.9, ((100 - health) / 100) * 0.5 * (SHIELD_MULT[state.scenarioId] ?? 1) * (hasUpgrade(state, 'escudo_mejorado') ? 0.5 : 1));
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
        if (s.scenarioId === 'estacion' || s.scenarioId === 'gateway') {
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
