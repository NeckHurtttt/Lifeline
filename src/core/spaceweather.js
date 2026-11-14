// CLIMA ESPACIAL REAL → DECISIÓN CON COSTO. La restricción central del juego:
// protegerse de la radiación cuesta ciencia y energía; no protegerse cuesta dosis que nunca se borra.
// Datos: NASA DONKI (llamaradas de los últimos 30 días). Sin internet: una llamarada real archivada.

/** Llamarada real archivada (NASA DONKI): la más fuerte del ciclo solar 25 hasta entonces. */
export const ARCHIVED_FLARE = { cls: 'X8.7', date: '2024-05-14', source: 'archivo' };

/** Letra y número de la clase (C, M, X) → intensidad comparable. */
export function flareRank(cls) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(String(cls ?? ''));
  if (!m) return 0;
  return { A: 0.001, B: 0.01, C: 0.1, M: 1, X: 10 }[m[1]] * Number(m[2]);
}
/** La más fuerte de una lista de DONKI FLR. */
export function strongestFlare(list) {
  let best = null;
  for (const f of list ?? []) if (f?.classType && (!best || flareRank(f.classType) > flareRank(best.classType))) best = f;
  return best ? { cls: best.classType, date: String(best.beginTime ?? best.peakTime ?? '').slice(0, 10), source: 'donki' } : null;
}

/**
 * Dosis (mSv) que recibiría cada astronauta SIN refugio si la llamarada trae una tormenta de partículas.
 * Valores de juego, del orden de los medidos (Curiosity RAD midió ~1,8 mSv/día de fondo en el viaje a Marte;
 * una tormenta fuerte suma decenas de mSv en un día). En órbita baja el campo magnético de la Tierra protege.
 */
export function stormDose(cls, scenarioId) {
  const r = flareRank(cls);
  const base = r >= 10 ? 60 : r >= 5 ? 40 : r >= 1 ? 15 : 3;
  const site = { estacion: 0.25, gateway: 1, luna: 0.8, marte: 0.5 }[scenarioId] ?? 1; // la Luna sin atmósfera; Marte con un poco
  return Math.round(base * site);
}
export const SHELTER_FACTOR = 0.2; // el refugio con paredes de agua/carga deja pasar ~1/5

/** Las 3 opciones: ninguna es gratis. */
export function stormOptions(cls, scenarioId, scienceGoalPerDay = 8) {
  const dose = stormDose(cls, scenarioId);
  const sci = Math.round(scienceGoalPerDay * 2);
  return [
    { id: 'refugio', label: 'Todos al refugio 2 días', dose: Math.round(dose * SHELTER_FACTOR), science: -sci, battery: -20,
      cost: `Pierden ${sci} de ciencia (nadie trabaja) y 20 kWh: el refugio y los filtros gastan energía.` },
    { id: 'mitad', label: 'La mitad al refugio, la otra sigue trabajando', dose: Math.round(dose * 0.6), science: -Math.round(sci / 2), battery: -10,
      cost: `Pierden la mitad de la ciencia (${Math.round(sci / 2)}) y 10 kWh; reciben algo de radiación.` },
    { id: 'seguir', label: 'Seguir con los experimentos', dose, science: Math.round(sci / 2), battery: 0,
      cost: `Ganan ${Math.round(sci / 2)} de ciencia, pero cada uno recibe ${dose} mSv que no se borran nunca.` },
  ];
}

/** Efectos para applyEffects (crewRadiation se multiplica por el escudo de la nave en events.js). */
export const optionEffects = (o) => ({ crewRadiation: o.dose, science: o.science, battery: o.battery });

export const NASA_CAREER_LIMIT = 600; // mSv: límite de toda la carrera de un astronauta de NASA (norma de 2022)
/** Qué parte del límite de carrera se lleva esta decisión. */
export const limitShare = (dose) => dose / NASA_CAREER_LIMIT;

/** Hallazgos reales de salud de astronautas (NASA Human Research Program y estudios publicados en OSDR). */
export const HEALTH_FINDINGS = [
  { id: 'hueso', icon: '🦴', text: 'Sin gravedad, los huesos de cadera y piernas pierden cerca de 1 a 1,5 % por MES. Por eso se hace ejercicio 2 horas al día.', src: 'NASA Human Research Program' },
  { id: 'musculo', icon: '💪', text: 'En vuelos cortos, sin ejercicio, se puede perder hasta 20 % de músculo en 1 a 2 semanas.', src: 'NASA Human Research Program' },
  { id: 'radiacion', icon: '☢️', text: 'Un viaje de ida y vuelta a Marte daría ~660 mSv solo de radiación de fondo: más que el límite de toda la carrera (600 mSv).', src: 'Curiosity RAD (Zeitlin et al., 2013) · NASA' },
  { id: 'gemelos', icon: '🧬', text: 'Estudio de los Gemelos: tras casi un año en la Estación, Scott Kelly tuvo cambios en genes y en el cuerpo; la mayoría volvió a la normalidad meses después.', src: 'NASA Twins Study (2019) · datos en OSDR' },
  { id: 'ratones', icon: '🐭', text: 'Ratones que vivieron en la Estación perdieron hueso y músculo rápido: así se prueban medicinas antes de usarlas en personas.', src: 'NASA Rodent Research · OSDR' },
];
