// Informe post-misión: puntaje, medalla, causas, sugerencias y lecciones.
import { computeDesign } from './design.js';
import { OBJECTIVES, SCORE_PARTS, DEFAULT_OBJECTIVE } from '../data/objectives.js';

const RAD_LIMIT = 600;
const clamp100 = (v) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Puntaje en las 5 categorías que pide el desafío (0-100 cada una) y el total ponderado por el objetivo (0-1000).
 * @returns {{objective:string, parts:{id:string, value:number, weight:number}[], total:number}}
 */
export function scoreBreakdown(state, { survivors, total, science, scienceGoal }) {
  const log = state.log ?? [];
  const has = (re) => log.some((l) => re.test(l.text));
  const count = (re) => log.filter((l) => re.test(l.text)).length;
  const days = Math.min(1, state.day / Math.max(1, state.totalDays ?? 1));

  const rendimiento = 60 * days + 40 * (total ? survivors / total : 0);
  // Llegar a la meta de ciencia = 70; superarla en un 50 % = 100 (así hay espacio para comparar equipos).
  const ratio = scienceGoal ? science / scienceGoal : 0;
  const ciencia = ratio <= 1 ? 70 * ratio : 70 + 60 * (ratio - 1);

  let eficiencia = 70;
  try {
    const d = computeDesign(state.design, state.scenarioId, state.difficulty, state.budgetMult ?? 1);
    // Gastar todo el presupuesto deja 50; ahorrar la mitad da el máximo.
    if (d.budget > 0) eficiencia = 50 + 50 * Math.min(1, Math.max(0, 1 - d.cost / d.budget) / 0.5);
  } catch { /* diseño viejo sin datos: valor medio */ }
  for (const re of [/Se acabó la comida/, /Se acabó el agua/, /Se acabó el oxígeno/]) if (has(re)) eficiencia -= 20;
  if (has(/Apagado por falta de energía/)) eficiencia -= 15;
  if (has(/Se perdieron [\d.]+ GB/)) eficiencia -= 15;

  const followed = count(/Seguiste el procedimiento/);
  const departed = count(/Te apartaste del procedimiento/);
  let decisiones = followed + departed ? (100 * followed) / (followed + departed) : 80;
  decisiones -= Math.min(30, 10 * count(/EVA cancelada \(NO GO\)/));

  const alive = state.crew.filter((c) => c.alive);
  const morale = alive.length ? alive.reduce((t, c) => t + (c.morale ?? 50), 0) / alive.length : 0;
  const equipo = morale * (total ? alive.length / total : 0);

  const objective = OBJECTIVES[state.objective] ? state.objective : DEFAULT_OBJECTIVE;
  const w = OBJECTIVES[objective].weights;
  const values = { rendimiento, ciencia, eficiencia, decisiones, equipo };
  const parts = Object.keys(SCORE_PARTS).map((id) => ({ id, value: clamp100(values[id]), weight: w[id] }));
  const wsum = parts.reduce((t, p) => t + p.weight, 0);
  const totalScore = Math.round((10 * parts.reduce((t, p) => t + p.value * p.weight, 0)) / wsum);
  return { objective, parts, total: totalScore };
}

const firstDay = (log, re) => log.find((l) => re.test(l.text))?.day ?? null;

export function buildReport(state) {
  const log = state.log ?? [];
  const survivors = state.crew.filter((c) => c.alive && !c.evacuated).length;
  const total = state.crew.length;
  const success = state.outcome?.success ?? false;
  const science = Math.round(state.science);
  // Meta de ciencia según destino y duración (una misión bien llevada la alcanza; a ciegas, no).
  const goalPerDay = { estacion: 8, luna: 9, marte: 7 }[state.scenarioId] ?? 8;
  const scienceGoal = Math.round(goalPerDay * (state.totalDays ?? 365));
  let medal = null;
  if (success) medal = survivors === total && science >= scienceGoal ? 'oro' : survivors >= total / 2 && science >= scienceGoal / 2 ? 'plata' : 'bronce';

  const hist = state.history ?? [];
  const keys = ['o2', 'water', 'food', 'battery'];
  const min = Object.fromEntries(keys.map((k) => [k, hist.length ? Math.min(...hist.map((h) => h[k])) : state.resources[k]]));
  const end = Object.fromEntries(keys.map((k) => [k, state.resources[k]]));

  const found = []; // {cause, suggestion, lesson}
  const add = (cause, suggestion, lesson) => found.push({ cause, suggestion, lesson });
  const left = (d) => state.totalDays - d;

  const reason = state.outcome?.reason ?? '';
  if (/escudo/i.test(reason)) add('El escudo térmico falló en la reentrada: la cabina volvió dañada', 'Haz mantenimiento a la cabina antes de volver y lleva un taller', 'escudo_termico');
  if (/combustible para despegar/i.test(reason)) add('No se fabricó suficiente combustible en Marte para volver', 'Mantén la planta de combustible encendida y reparada todo el año (prioridad alta de energía)', 'isru');
  if (/retorno libre|camino al destino/i.test(reason)) add('El motor falló camino al destino y hubo que volver', 'Elige un cohete más fiable', 'go_nogo_equipo');
  if (/Aborto/i.test(reason)) add('El cohete falló en el despegue y hubo que abortar', 'Elige un cohete más fiable aunque cueste más', 'go_nogo_equipo');

  const dFood = firstDay(log, /Se acabó la comida/);
  if (dFood !== null) add(`La comida se acabó el día ${dFood}: faltaron ${left(dFood)} días de carga o un invernadero`, `Sube la carga a más días o añade un invernadero`, 'racionamiento');
  const dWater = firstDay(log, /Se acabó el agua/);
  if (dWater !== null) add(`El agua se acabó el día ${dWater}: el soporte vital no alcanzó a reciclar`, 'Mantén el soporte vital con energía y pon a alguien en producción de agua', 'reciclaje_agua');
  const dO2 = firstDay(log, /Se acabó el oxígeno/);
  if (dO2 !== null) add(`El oxígeno se acabó el día ${dO2}`, 'No dejes que el soporte vital se apague: dale la prioridad más alta', 'purificador_aire');

  const lost = log.filter((l) => /Se perdieron/.test(l.text))
    .reduce((t, l) => t + parseFloat(l.text.match(/([\d.]+) GB/)?.[1] ?? 0), 0);
  if (lost > 0) add(`El enlace no alcanzó: se perdieron ${Math.round(lost)} GB de datos`, 'Añade una antena para bajar más datos por día', 'satelites_clima');

  const shed = firstDay(log, /Apagado por falta de energía/);
  const nocturno = state.design?.orbit && /luna_/.test(state.design.orbit);
  if (shed !== null) add(`La energía no alcanzó desde el día ${shed} y hubo que apagar módulos`, nocturno ? 'Para la noche lunar: pilas regenerativas o un reactor' : 'Añade paneles o baterías', nocturno ? 'noche_lunar' : 'baterias');
  if (state.scenarioId === 'marte' && /contaminada|sin protocolo/.test(log.map((l) => l.text).join(' '))) add('Se analizó una muestra sin protección planetaria', 'Sigue el protocolo: sella y esteriliza las muestras', 'proteccion_planetaria');

  if (state.crew.some((c) => c.radiation >= RAD_LIMIT)) add(`Alguien superó el límite de radiación de ${RAD_LIMIT} mSv`, 'Lleva un refugio y úsalo en las tormentas solares', 'radiacion_protector');
  if (state.crew.some((c) => c.alive && c.bone < 70)) add('La tripulación perdió mucha masa ósea', 'Programa un turno de ejercicio cada día', 'ejercicio_hueso');

  const deaths = log.filter((l) => /ha muerto|fue evacuado/.test(l.text));
  if (deaths.length && found.length === 0) add(`${deaths.length} tripulante(s) no volvieron`, 'Revisa raciones, sueño y atención médica', 'racionamiento');
  if (found.length === 0) add(success ? 'La misión salió según lo planeado' : reason || 'La misión terminó antes de tiempo', success ? 'Prueba con más instrumentos para sumar ciencia' : 'Revisa el diseño y vuelve a intentarlo', 'paneles_solares');

  if (state.scenarioId === 'luna' && found.length < 3) add('En la Luna, la noche larga es el mayor reto', 'Revisa siempre cuánta energía guardas para la noche', 'noche_lunar');
  if (state.scenarioId === 'marte' && found.length < 3) add('En Marte no hay rescate rápido: todo depende de la planificación', 'Lleva repuestos y fabrica tu propio combustible', 'conjuncion');
  const top = found.slice(0, 5);
  const breakdown = scoreBreakdown(state, { survivors, total, science, scienceGoal });
  return {
    success, reason, score: breakdown.total, breakdown, medal, daysSurvived: state.day, survivors, science, scienceGoal,
    resources: { min, end },
    causes: top.map((f) => f.cause),
    suggestions: top.map((f) => f.suggestion),
    lessons: [...new Set(top.map((f) => f.lesson))],
  };
}
