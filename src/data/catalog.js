// Catálogo de datos. Masa en t, potencia en kW (+ produce, - consume), costo en millones.
const indexar = (lista) => Object.fromEntries(lista.map((e) => [e.id, e]));

export const MODULES = indexar([
  { id: 'cabina', icon: '🛏️', desc: 'Es la casa de los astronautas: ahí duermen y viven. Caben 4.', name: 'Cabina', mass: 8, kw: -2, cost: 100, required: true, crewCapacity: 4, downlink: 10 },
  { id: 'soporte_vital', icon: '🫁', desc: 'Fabrica aire con agua y recicla el agua para volver a beberla.', name: 'Soporte vital', mass: 6, kw: -3, cost: 120, required: true, recycleRate: 0.98 },
  { id: 'paneles', icon: '☀️', desc: 'Convierten la luz del Sol en electricidad.', name: 'Paneles solares', mass: 2, kw: 12, cost: 40, solar: true },
  { id: 'baterias', icon: '🔋', desc: 'Guardan electricidad para cuando la Tierra tapa el Sol.', name: 'Baterías', mass: 1.5, kw: 0, cost: 30, batteryKwh: 60 },
  { id: 'refugio', icon: '🛡️', desc: 'Un cuarto de paredes gruesas para esconderse de las tormentas solares.', name: 'Refugio', mass: 7, kw: -0.5, cost: 90, shelter: true },
  { id: 'laboratorio', icon: '🔬', desc: 'Aquí se hace ciencia. Le caben 3 instrumentos.', name: 'Laboratorio', mass: 5, kw: -3, cost: 80, instrumentSlots: 3 },
  { id: 'invernadero', icon: '🌱', desc: 'Un jardín espacial que da comida cada día.', name: 'Invernadero', mass: 4, kw: -4, cost: 60, foodPerDay: 1.5 },
  { id: 'enfermeria', icon: '🩺', desc: 'Un pequeño hospital: el médico cura el doble.', name: 'Enfermería', mass: 3, kw: -1, cost: 50, medicalMult: 2 },
  { id: 'taller', icon: '🔧', desc: 'Herramientas para arreglar mejor.', name: 'Taller', mass: 3, kw: -1, cost: 40, repairMult: 1.5 },
  { id: 'bodega', icon: '📦', desc: 'Un armario gigante: 60 días más de comida.', name: 'Bodega', mass: 2, kw: 0, cost: 20, cargoDays: 60 },
  { id: 'radar', icon: '📡', desc: 'Ve los peligros de lejos: avisa 2 días antes.', name: 'Radar', mass: 1, kw: -0.5, cost: 35, warningBonusDays: 2 },
  { id: 'antena', icon: '📶', desc: 'Manda tu ciencia a la Tierra mucho más rápido.', name: 'Antena', mass: 1, kw: -1, cost: 30, downlink: 50 },
  { id: 'brazo', icon: '🦾', desc: 'Brazo robot para atrapar naves y satélites.', name: 'Brazo robótico', mass: 2, kw: -0.5, cost: 60, scenarios: ['estacion'] },
  { id: 'desplegador', icon: '🛰️', desc: 'Lanza satélites pequeñitos.', name: 'Desplegador de cubesats', mass: 0.5, kw: 0, cost: 15 },
  // Superficie (Luna y Marte)
  { id: 'modulo_aterrizaje', icon: '🛬', desc: 'Baja la base hasta el suelo y luego sube a la tripulación para volver. Obligatorio.', name: 'Módulo de aterrizaje', mass: 4, kw: 0, cost: 150, scenarios: ['luna', 'marte'], lander: true },
  { id: 'pila_regenerativa', icon: '🧪', desc: 'Guarda muchísima energía de día (separa agua en hidrógeno y oxígeno) para usarla de noche.', name: 'Pila regenerativa', mass: 3, kw: 0, cost: 100, batteryKwh: 1000, scenarios: ['luna', 'marte'] },
  { id: 'reactor', icon: '⚛️', desc: 'Reactor nuclear pequeño: da electricidad de día y de noche. Pesado y caro.', name: 'Reactor de fisión', mass: 5, kw: 10, cost: 220, scenarios: ['luna', 'marte'] },
  { id: 'extractor_hielo', icon: '🧊', desc: 'Saca agua del hielo del suelo. Solo sirve donde hay hielo.', name: 'Extractor de hielo', mass: 3, kw: -2, cost: 70, waterPerDay: 4, scenarios: ['luna', 'marte'] },
  { id: 'rover', icon: '🚙', desc: 'Auto con cabina: lleva a 2 astronautas lejos de la base y les sirve de refugio.', name: 'Rover presurizado', mass: 3, kw: -1, cost: 90, scenarios: ['luna', 'marte'] },
  { id: 'rover_autonomo', icon: '🤖', desc: 'Robot que explora solo, sin arriesgar a nadie, pero tarda el doble.', name: 'Rover autónomo', mass: 1, kw: -0.5, cost: 50, scenarios: ['luna', 'marte'] },
  { id: 'planta_combustible', icon: '⛽', desc: 'Fabrica combustible con el aire de Marte (CO₂). Sin ella no se puede volver.', name: 'Planta de combustible (ISRU)', mass: 4, kw: -4, cost: 160, fuelPerDay: 1, scenarios: ['marte'] },
]);

export const INSTRUMENTS = indexar([
  { id: 'camara_tierra', icon: '📷', desc: 'Fotos de la Tierra desde arriba.', name: 'Cámara terrestre', mass: 0.3, kw: -0.2, cost: 10, dataPerDay: 20, sciencePerDay: 2, scenarios: ['estacion'] },
  { id: 'espectrometro', icon: '🌈', desc: 'Separa la luz en colores para saber de qué están hechas las cosas.', name: 'Espectrómetro', mass: 0.5, kw: -0.5, cost: 25, dataPerDay: 15, sciencePerDay: 4 },
  { id: 'cristales', icon: '💎', desc: 'Cristales que ayudan a crear medicinas.', name: 'Cristalización de proteínas', mass: 0.4, kw: -0.6, cost: 20, dataPerDay: 5, sciencePerDay: 3 },
  { id: 'bio_celulas', icon: '🧫', desc: 'Cómo crecen las células flotando.', name: 'Cultivo de células', mass: 0.6, kw: -0.8, cost: 30, dataPerDay: 8, sciencePerDay: 5 },
  { id: 'rayos_cosmicos', icon: '✨', desc: 'Atrapa partículas de estrellas lejanas.', name: 'Detector de rayos cósmicos', mass: 0.8, kw: -0.4, cost: 35, dataPerDay: 25, sciencePerDay: 6 },
  { id: 'plantas_microg', icon: '🪴', desc: 'Plantas que crecen flotando y dan un poco de comida.', name: 'Plantas en microgravedad', mass: 0.5, kw: -0.7, cost: 15, dataPerDay: 3, sciencePerDay: 2, foodPerDay: 0.2, scenarios: ['estacion'] },
  { id: 'sismometro', icon: '📈', desc: 'Siente los temblores del suelo para saber qué hay adentro.', name: 'Sismómetro', mass: 0.3, kw: -0.2, cost: 15, dataPerDay: 4, sciencePerDay: 3, scenarios: ['luna', 'marte'] },
  { id: 'georradar', icon: '〰️', desc: 'Mira bajo el suelo: busca hielo y cuevas.', name: 'Radar de subsuelo', mass: 0.6, kw: -0.6, cost: 30, dataPerDay: 12, sciencePerDay: 5, scenarios: ['luna', 'marte'] },
  { id: 'analizador_rocas', icon: '🪨', desc: 'Dice de qué están hechas las rocas.', name: 'Analizador de rocas', mass: 0.5, kw: -0.5, cost: 25, dataPerDay: 6, sciencePerDay: 4, scenarios: ['luna', 'marte'] },
  { id: 'radiotelescopio', icon: '📻', desc: 'En el lado oculto de la Luna no llega el ruido de la Tierra: se escucha el universo.', name: 'Radiotelescopio lunar', mass: 1, kw: -0.8, cost: 45, dataPerDay: 30, sciencePerDay: 8, scenarios: ['luna'] },
  { id: 'buscador_vida', icon: '🦠', desc: 'Busca rastros de vida antigua en las rocas de Marte.', name: 'Buscador de vida antigua', mass: 0.7, kw: -0.7, cost: 50, dataPerDay: 15, sciencePerDay: 9, scenarios: ['marte'] },
]);

export const LAUNCHERS = indexar([
  { id: 'condor1', icon: '🚀', desc: 'Pequeño y muy seguro.', name: 'Cóndor-1', capacity: 25, cost: 60, reliability: 0.97 },
  { id: 'condorH', icon: '🚀', desc: 'Mediano: lleva el doble.', name: 'Cóndor-H', capacity: 60, cost: 120, reliability: 0.95 },
  { id: 'quetzal5', icon: '🚀', desc: 'Gigante, pero falla un poco más.', name: 'Quetzal-5', capacity: 100, cost: 250, reliability: 0.93 },
  { id: 'titan', icon: '🚀', desc: 'Superpesado para ir lejos: Luna y Marte. Caro.', name: 'Titán', capacity: 150, cost: 400, reliability: 0.92 },
]);

export const ORBITS = indexar([
  { id: 'leo_estacion', scenario: 'estacion', icon: '🌍', name: 'Órbita baja 400 km, 51,6°', factor: 1.0, solarFraction: 0.5, desc: 'La de la estación espacial. La más fácil; basura espacial media.' },
  { id: 'sso', scenario: 'estacion', icon: '🛰️', name: 'Heliosíncrona 600 km', factor: 0.8, solarFraction: 0.65, desc: 'Pasa siempre a la misma hora de luz: buena para fotos de la Tierra.' },
  { id: 'geo', scenario: 'estacion', icon: '🌐', name: 'Geoestacionaria 35 786 km', factor: 0.35, solarFraction: 0.99, desc: 'Muy lejos: casi siempre al sol, pero el cohete lleva mucho menos y hay más radiación.' },
  // Sitios de alunizaje: de día el sol da `solarFraction`; de noche nada. Ciclo de 28 días (un día lunar).
  { id: 'luna_polo', scenario: 'luna', icon: '🧊', name: 'Polo sur lunar (borde del cráter Shackleton)', factor: 0.3, solarFraction: 0.8, cycleDays: 28, nightDays: 4, ice: true, scienceMult: 1,
    desc: 'Sol casi siempre (noches de solo 4 días) y hielo en los cráteres oscuros. Donde quiere ir Artemis.' },
  { id: 'luna_ecuador', scenario: 'luna', icon: '🌗', name: 'Ecuador lunar (Mar de la Tranquilidad)', factor: 0.32, solarFraction: 1, cycleDays: 28, nightDays: 14, ice: false, scienceMult: 1.25,
    desc: 'Donde aterrizó el Apolo 11: 14 días de sol y 14 de noche helada. Rocas muy interesantes (+25 % ciencia).' },
  // Sitios en Marte: el sol llega más débil (~43 %) y un sol (día marciano) dura 24 h 40 min.
  { id: 'marte_jezero', scenario: 'marte', icon: '🏞️', name: 'Cráter Jezero (antiguo lago)', factor: 0.45, solarFraction: 0.45, cycleDays: 1, nightDays: 0, ice: false, scienceMult: 1.3,
    desc: 'Un lago seco con delta de río: el mejor lugar para buscar vida antigua (+30 % ciencia). Sin hielo. (El cohete se recarga de combustible en órbita antes de partir.)' },
  { id: 'marte_arcadia', scenario: 'marte', icon: '❄️', name: 'Arcadia Planitia (hielo bajo el suelo)', factor: 0.45, solarFraction: 0.4, cycleDays: 1, nightDays: 0, ice: true, scienceMult: 1,
    desc: 'Llanura con hielo a poca profundidad: agua para beber y para fabricar combustible.' },
]);

export const CARGO = { massPerCrewDayT: (0.84 + 1.8 + 0.1) / 1000, costPerCrewDay: 0.05, baseDays: 90 };

export const DIFFICULTY = {
  facil: { id: 'facil', name: 'Fácil', budget: 1300, reserveBonus: 0.5, warningMult: 1.5, falseAlarm: 0, disasterRate: 0.01, severityWeights: [0.7, 0.25, 0.05], repairMult: 1.5, deathAllowed: false, control: 'resuelve', launchMode: 'auto' },
  medio: { id: 'medio', name: 'Medio', budget: 1100, reserveBonus: 0.2, warningMult: 1, falseAlarm: 0.05, disasterRate: 0.02, severityWeights: [0.4, 0.4, 0.2], repairMult: 1, deathAllowed: true, control: 'aconseja', launchMode: 'pausas' },
  dificil: { id: 'dificil', name: 'Difícil', budget: 950, reserveBonus: 0, warningMult: 0.5, falseAlarm: 0.15, disasterRate: 0.035, severityWeights: [0.2, 0.4, 0.4], repairMult: 0.7, deathAllowed: true, control: 'retraso', launchMode: 'manual' },
};

export const SCENARIOS = {
  estacion: { id: 'estacion', icon: '🛰️', short: 'Estación', name: 'Estación espacial: un año en órbita', orbit: 'leo_estacion', days: 365, resupplyEvery: 60,
    requiredModules: ['cabina', 'soporte_vital'], minScience: 0, budgetMult: 1, boneMult: 1, radiationMult: 1, nightHeatKw: 0, home: 'la estación' },
  luna: { id: 'luna', icon: '🌙', short: 'Luna', name: 'Base lunar: un año en la Luna', orbit: 'luna_polo', days: 365, resupplyEvery: 120,
    requiredModules: ['cabina', 'soporte_vital', 'modulo_aterrizaje'], minScience: 0, budgetMult: 1.5, boneMult: 0.5, radiationMult: 1.5, nightHeatKw: 3, home: 'la base lunar' },
  marte: { id: 'marte', icon: '🔴', short: 'Marte', name: 'Marte: 7 meses de ida, 1 año allá y 7 meses de vuelta', orbit: 'marte_jezero', days: 365, travelDays: 210, resupplyEvery: 0,
    requiredModules: ['cabina', 'soporte_vital', 'modulo_aterrizaje', 'planta_combustible'], minScience: 0, budgetMult: 2.2, boneMult: 0.7, radiationMult: 2, nightHeatKw: 2, home: 'la base marciana' },
};

export const GRID = { cols: 6, rows: 4 };
