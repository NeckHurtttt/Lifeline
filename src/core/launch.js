// Secuencia de despegue basada en el conteo real: cuarentena, Go/No-Go, Max Q, abortos.
import { LAUNCHERS } from '../data/catalog.js';

const DIFF_MULT = { facil: 0.5, medio: 1, dificil: 1.5 };
// Fiabilidad de referencia: un cohete con 0,95 deja el riesgo base tal cual.
const REF_UNRELIABILITY = 0.05;

export const LAUNCH_STEPS = [
  { id: 'cuarentena', desc: 'Los astronautas se aíslan para no llevar gérmenes.', t: -172800, label: 'Cuarentena de la tripulación', risk: 0 },
  { id: 'carga_propelente', desc: 'Se llena el cohete de combustible súper frío.', t: -36000, label: 'Carga de propelente', risk: 0.03, failure: 'Fuga en la línea de propelente' },
  { id: 'clima', desc: 'Con rayos, viento fuerte o mar picado no se puede despegar.', t: -14400, label: 'Revisión del clima', risk: 0 },
  { id: 'abordaje', desc: 'Los astronautas suben a la cápsula.', t: -10800, label: 'Abordaje de la tripulación', risk: 0 },
  { id: 'hold_go_nogo', desc: 'Cada equipo dice GO (listo) o NO GO (esperen).', t: -600, label: 'Pausa y sondeo Go/No-Go', risk: 0 },
  { id: 'retiro_brazo', desc: 'Se aparta el puente por donde subieron.', t: -420, label: 'Retiro del brazo de acceso', risk: 0 },
  { id: 'escape_armado', desc: 'Si algo falla, un cohetito saca la cápsula volando.', t: -300, label: 'Sistema de escape armado', risk: 0 },
  { id: 'computadora', desc: 'La computadora del cohete toma el mando.', t: -60, label: 'La computadora toma el control', risk: 0 },
  { id: 'encendido', desc: 'Se encienden los motores.', t: -6, label: 'Encendido de motores', risk: 0.02, failure: 'Aborto automático: motor fuera de parámetros' },
  { id: 'despegue', desc: '¡Arriba!', t: 0, label: '¡Despegue!', risk: 0 },
  { id: 'despeje_torre', desc: 'El cohete ya pasó la torre.', t: 10, label: 'Despeje de la torre', risk: 0 },
  { id: 'max_q', desc: 'El aire empuja más fuerte que nunca contra el cohete.', t: 70, label: 'Max Q: máxima presión aerodinámica', risk: 0.01, failure: 'Vibración estructural en Max Q' },
  { id: 'sep_impulsores', desc: 'Se sueltan los cohetes de los lados, ya vacíos.', t: 130, label: 'Separación de impulsores', risk: 0.01, failure: 'Un impulsor no se separa' },
  { id: 'sep_torre_escape', desc: 'Ya no hace falta la torre de escape.', t: 190, label: 'Separación de la torre de escape', risk: 0 },
  { id: 'meco', desc: 'Se apagan los motores principales.', t: 480, label: 'Corte de motores principales (MECO)', risk: 0.01, failure: 'Corte prematuro de motores' },
  { id: 'insercion', desc: '¡En órbita! Ahora damos vueltas a la Tierra.', t: 540, label: 'Inserción en órbita', risk: 0 },
  { id: 'paneles', desc: 'Se abren los paneles solares como alas.', t: 600, label: 'Despliegue de paneles', risk: 0.02, failure: 'Un panel solar no se despliega bien' },
  { id: 'acople_estacion', desc: 'La nave se engancha a la estación.', t: 86400, label: 'Acople con la estación', risk: 0.02, failure: 'Acople fallido: hay que reintentar' },
];

const BASE_STEPS = LAUNCH_STEPS.filter((st) => st.id !== 'acople_estacion');
const TO_MOON = [
  { id: 'tli', desc: 'Un encendido largo saca la nave de la órbita de la Tierra rumbo a la Luna (3 días de viaje).', t: 9000, label: 'Encendido hacia la Luna (TLI)', risk: 0.02, failure: 'El motor no enciende bien: no podemos ir a la Luna' },
  { id: 'loi', desc: 'Al llegar, se frena para quedar dando vueltas a la Luna.', t: 280000, label: 'Frenado en órbita lunar (LOI)', risk: 0.01, failure: 'Frenado corto: se gasta combustible extra' },
  { id: 'descenso', desc: 'El módulo de aterrizaje baja con sus motores. El piloto busca un lugar plano.', t: 300000, label: 'Descenso motorizado', risk: 0.03, failure: 'Alarma de la computadora: alunizaje lejos del sitio' },
  { id: 'alunizaje', desc: '¡Contacto con el suelo! Los motores se apagan.', t: 300720, label: 'Alunizaje', risk: 0 },
];
const TO_MARS = [
  { id: 'tmi', desc: 'Un encendido larguísimo saca la nave hacia Marte: empiezan 7 meses de viaje.', t: 9000, label: 'Encendido hacia Marte (TMI)', risk: 0.02, failure: 'El motor no enciende bien: no podemos ir a Marte' },
];
const TO_GATEWAY = [
  TO_MOON[0],
  { id: 'nri', desc: 'Al llegar cerca de la Luna, un encendido deja la nave en la órbita halo del Gateway.', t: 400000, label: 'Entrada en la órbita halo (NRI)', risk: 0.01, failure: 'Encendido corto: se gasta combustible extra' },
  { id: 'acople_gateway', desc: 'La nave se engancha al Gateway.', t: 450000, label: 'Acople con el Gateway', risk: 0.02, failure: 'Acople fallido: hay que reintentar' },
];
const STEPS_BY_SCENARIO = { estacion: LAUNCH_STEPS, gateway: [...BASE_STEPS, ...TO_GATEWAY], luna: [...BASE_STEPS, ...TO_MOON], marte: [...BASE_STEPS, ...TO_MARS] };
/** Pasos del despegue según el destino. */
export const launchSteps = (scenarioId) => STEPS_BY_SCENARIO[scenarioId] ?? LAUNCH_STEPS;
const byId = Object.fromEntries([...LAUNCH_STEPS, ...TO_MOON, ...TO_MARS, ...TO_GATEWAY.slice(1)].map((s) => [s.id, s]));

// Criterios reales de clima de lanzamiento; probabilidad base por intento.
const WEATHER = [
  { p: 0.08, reason: 'Rayos a menos de 10 millas de la plataforma' },
  { p: 0.05, reason: 'Nubes de yunque en la trayectoria' },
  { p: 0.06, reason: 'Viento en altura sobre 30 m/s' },
  { p: 0.04, reason: 'Mar picado en las zonas de aborto' },
];

export function stepRisk(step, state) {
  const rel = LAUNCHERS[state.design.launcher]?.reliability ?? 0.95;
  return step.risk * ((1 - rel) / REF_UNRELIABILITY) * DIFF_MULT[state.difficulty];
}

export function checkWeather(rng, difficulty) {
  const m = DIFF_MULT[difficulty];
  const reasons = WEATHER.filter((w) => rng.chance(w.p * m)).map((w) => w.reason);
  return { go: reasons.length === 0, reasons };
}

export function goNoGoPoll(state, votes) {
  const roles = state.crew.filter((c) => c.alive).map((c) => c.role);
  const holdouts = roles.filter((r) => votes[r] !== 'go');
  return { go: holdouts.length === 0, holdouts };
}

export function abortModeAt(t) {
  if (t < 190) return 'torre_escape';
  if (t < 480) return 'amarizaje';
  if (t < 540) return 'aborto_orbita';
  return null;
}

/**
 * Ejecuta un paso. Puro: devuelve estado nuevo.
 * @returns {{ok:boolean, state:object, log:string[], failure?:string, abortMode?:string|null, scrub?:boolean}}
 */
export function runLaunchStep(state, stepId, rng) {
  const step = byId[stepId];
  if (!step) throw new Error(`Paso desconocido: ${stepId}`);
  const s = structuredClone(state);
  const log = [step.label];
  if (!step.risk || !rng.chance(stepRisk(step, s))) return { ok: true, state: s, log };

  log.push(step.failure);
  if (stepId === 'paneles') {
    const panel = s.modules.find((m) => m.type === 'paneles');
    if (panel) panel.health = Math.max(0, panel.health - 50);
    return { ok: true, state: s, log, failure: step.failure };
  }
  if (stepId === 'tli' || stepId === 'tmi') return { ok: false, state: s, log, failure: step.failure, abortMode: 'retorno_libre' };
  if (stepId === 'loi') {
    s.resources.fuel = Math.max(0, s.resources.fuel - 15);
    return { ok: true, state: s, log, failure: step.failure };
  }
  if (stepId === 'descenso') {
    const m = s.modules[s.seed % s.modules.length];
    if (m) m.health = Math.max(0, m.health - 30);
    s.flags = { ...(s.flags ?? {}), landedFar: true };
    return { ok: true, state: s, log, failure: step.failure };
  }
  if (stepId === 'acople_estacion') {
    s.resources.fuel = Math.max(0, s.resources.fuel - 10);
    return { ok: false, state: s, log, failure: step.failure, abortMode: null };
  }
  // Antes del abordaje no hay nadie a bordo: se suspende el conteo.
  if (step.t < byId.abordaje.t) return { ok: false, state: s, log, failure: step.failure, abortMode: null, scrub: true };
  return { ok: false, state: s, log, failure: step.failure, abortMode: abortModeAt(step.t) };
}

export function applyAbort(state, mode, rng) {
  const s = structuredClone(state);
  const log = [];
  if (mode === 'aborto_orbita') {
    s.resources.fuel = Math.max(0, s.resources.fuel - 40);
    log.push('Aborto a órbita: llegamos a una órbita más baja y subimos con combustible propio');
    return { state: s, log };
  }
  if (mode === 'retorno_libre') {
    log.push('Retorno libre: la nave da la vuelta y vuelve a la Tierra sin entrar en órbita, como el Apolo 13');
    s.phase = 'report';
    s.outcome = { success: false, reason: 'Misión abortada camino al destino: tripulación a salvo' };
    return { state: s, log };
  }
  if (mode === 'amarizaje') {
    for (const c of s.crew) if (c.alive) c.health = Math.max(1, c.health - rng.int(5, 15));
    log.push('Aborto con amarizaje: la cápsula cae al mar y la recuperan');
  } else {
    log.push('Torre de escape activada: la cápsula se aleja del cohete y baja en paracaídas');
  }
  s.phase = 'report';
  s.outcome = { success: false, reason: 'Aborto en el despegue: tripulación a salvo' };
  return { state: s, log };
}

/** Suspende el lanzamiento un día: se gasta un día de carga y baja la moral. */
export function scrubLaunch(state, reason) {
  const s = structuredClone(state);
  const n = s.crew.filter((c) => c.alive).length;
  const r = s.resources;
  r.food = Math.max(0, r.food - 1.8 * n);
  r.water = Math.max(0, r.water - 2.75 * n);
  r.o2 = Math.max(0, r.o2 - 0.84 * n);
  for (const c of s.crew) if (c.alive) c.morale = Math.max(0, c.morale - 3);
  return { state: s, log: [`Lanzamiento suspendido: ${reason}. Se reintenta mañana`] };
}
