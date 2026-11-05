// Objetivo de la misión: se elige ANTES de diseñar. Cambia qué cuenta más en el puntaje
// y qué recursos son críticos (el desafío pide definir el objetivo antes de las decisiones técnicas).

/** Las 5 cosas que premia el puntaje (las mismas que pide el desafío de Space Apps). */
export const SCORE_PARTS = {
  rendimiento: { icon: '🚀', name: 'Rendimiento de la misión', desc: 'Cuántos días aguantaron y cuántos volvieron.' },
  ciencia: { icon: '🔬', name: 'Valor científico', desc: 'Cuánta ciencia llegó a la Tierra frente a la meta.' },
  eficiencia: { icon: '💰', name: 'Uso de recursos', desc: 'Dinero ahorrado y sin quedarse sin comida, agua, aire, energía ni enlace.' },
  decisiones: { icon: '🧠', name: 'Calidad de las decisiones', desc: 'Seguir los protocolos y no cancelar EVAs por mala planificación.' },
  equipo: { icon: '🤝', name: 'Trabajo en equipo', desc: 'Ánimo de la tripulación y que nadie quede atrás.' },
};

export const OBJECTIVES = {
  ciencia: {
    id: 'ciencia', icon: '🔬', name: 'Máxima ciencia',
    desc: 'Juntar y mandar a la Tierra la mayor cantidad de datos.',
    tip: 'Lleva laboratorio e instrumentos, pero cuida la electricidad y la antena: sin enlace, los datos se pierden.',
    weights: { rendimiento: 1, ciencia: 2.5, eficiencia: 1, decisiones: 1, equipo: 1 },
    critical: ['energia', 'datos', 'ciencia'],
  },
  tripulacion: {
    id: 'tripulacion', icon: '🧑‍🚀', name: 'Todos a salvo',
    desc: 'Que toda la tripulación vuelva sana, aunque se haga menos ciencia.',
    tip: 'Comida de sobra, refugio contra la radiación y un cohete fiable valen más que un instrumento extra.',
    weights: { rendimiento: 2.5, ciencia: 0.5, eficiencia: 1, decisiones: 1.5, equipo: 1.5 },
    critical: ['comida', 'energia', 'peso'],
  },
  economica: {
    id: 'economica', icon: '💰', name: 'Misión económica',
    desc: 'Cumplir la misión gastando lo menos posible.',
    tip: 'Cada módulo cuesta y pesa: un cohete más chico es más barato, pero ¿alcanza para lo que llevas?',
    weights: { rendimiento: 1, ciencia: 1, eficiencia: 2.5, decisiones: 1, equipo: 1 },
    critical: ['dinero', 'peso'],
  },
};

/** Recursos críticos por destino, además de los del objetivo. */
export const SCENARIO_CRITICAL = { estacion: ['datos'], luna: ['noche', 'energia'], marte: ['comida', 'peso'] };

export const DEFAULT_OBJECTIVE = 'ciencia';

/** @returns {Set<string>} claves de recursos críticos: peso, dinero, energia, datos, ciencia, noche, comida */
export function criticalResources(objectiveId, scenarioId) {
  return new Set([...(OBJECTIVES[objectiveId]?.critical ?? []), ...(SCENARIO_CRITICAL[scenarioId] ?? [])]);
}
