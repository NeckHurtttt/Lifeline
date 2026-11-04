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
  { id: 'brazo', icon: '🦾', desc: 'Brazo robot para atrapar naves y satélites.', name: 'Brazo robótico', mass: 2, kw: -0.5, cost: 60 },
  { id: 'desplegador', icon: '🛰️', desc: 'Lanza satélites pequeñitos.', name: 'Desplegador de cubesats', mass: 0.5, kw: 0, cost: 15 },
]);

export const INSTRUMENTS = indexar([
  { id: 'camara_tierra', icon: '📷', desc: 'Fotos de la Tierra desde arriba.', name: 'Cámara terrestre', mass: 0.3, kw: -0.2, cost: 10, dataPerDay: 20, sciencePerDay: 2 },
  { id: 'espectrometro', icon: '🌈', desc: 'Separa la luz en colores para saber de qué están hechas las cosas.', name: 'Espectrómetro', mass: 0.5, kw: -0.5, cost: 25, dataPerDay: 15, sciencePerDay: 4 },
  { id: 'cristales', icon: '💎', desc: 'Cristales que ayudan a crear medicinas.', name: 'Cristalización de proteínas', mass: 0.4, kw: -0.6, cost: 20, dataPerDay: 5, sciencePerDay: 3 },
  { id: 'bio_celulas', icon: '🧫', desc: 'Cómo crecen las células flotando.', name: 'Cultivo de células', mass: 0.6, kw: -0.8, cost: 30, dataPerDay: 8, sciencePerDay: 5 },
  { id: 'rayos_cosmicos', icon: '✨', desc: 'Atrapa partículas de estrellas lejanas.', name: 'Detector de rayos cósmicos', mass: 0.8, kw: -0.4, cost: 35, dataPerDay: 25, sciencePerDay: 6 },
  { id: 'plantas_microg', icon: '🪴', desc: 'Plantas que crecen flotando y dan un poco de comida.', name: 'Plantas en microgravedad', mass: 0.5, kw: -0.7, cost: 15, dataPerDay: 3, sciencePerDay: 2, foodPerDay: 0.2 },
]);

export const LAUNCHERS = indexar([
  { id: 'condor1', icon: '🚀', desc: 'Pequeño y muy seguro.', name: 'Cóndor-1', capacity: 25, cost: 60, reliability: 0.97 },
  { id: 'condorH', icon: '🚀', desc: 'Mediano: lleva el doble.', name: 'Cóndor-H', capacity: 60, cost: 120, reliability: 0.95 },
  { id: 'quetzal5', icon: '🚀', desc: 'Gigante, pero falla un poco más.', name: 'Quetzal-5', capacity: 100, cost: 250, reliability: 0.93 },
]);

export const ORBITS = indexar([
  { id: 'leo_estacion', icon: '🌍', desc: 'La de la estación espacial. La más fácil.', name: 'Órbita baja 400 km, 51,6°', factor: 1.0, solarFraction: 0.5, desc: 'La de la estación; basura espacial media.' },
  { id: 'sso', icon: '🛰️', desc: 'Pasa siempre a la misma hora de luz: buena para fotos.', name: 'Heliosíncrona 600 km', factor: 0.8, solarFraction: 0.65, desc: 'Ideal para observar la Tierra.' },
  { id: 'geo', icon: '🌐', desc: 'Muy lejos: casi siempre al sol, pero el cohete lleva mucho menos.', name: 'Geoestacionaria 35 786 km', factor: 0.35, solarFraction: 0.99, desc: 'Cobertura fija, mucha radiación.' },
]);

export const CARGO = { massPerCrewDayT: (0.84 + 1.8 + 0.1) / 1000, costPerCrewDay: 0.05, baseDays: 90 };

export const DIFFICULTY = {
  facil: { id: 'facil', name: 'Fácil', budget: 1300, reserveBonus: 0.5, warningMult: 1.5, falseAlarm: 0, disasterRate: 0.01, severityWeights: [0.7, 0.25, 0.05], repairMult: 1.5, deathAllowed: false, control: 'resuelve', launchMode: 'auto' },
  medio: { id: 'medio', name: 'Medio', budget: 1100, reserveBonus: 0.2, warningMult: 1, falseAlarm: 0.05, disasterRate: 0.02, severityWeights: [0.4, 0.4, 0.2], repairMult: 1, deathAllowed: true, control: 'aconseja', launchMode: 'pausas' },
  dificil: { id: 'dificil', name: 'Difícil', budget: 950, reserveBonus: 0, warningMult: 0.5, falseAlarm: 0.15, disasterRate: 0.035, severityWeights: [0.2, 0.4, 0.4], repairMult: 0.7, deathAllowed: true, control: 'retraso', launchMode: 'manual' },
};

export const SCENARIOS = {
  estacion: { id: 'estacion', name: 'Estación espacial: un año en órbita', orbit: 'leo_estacion', days: 365, resupplyEvery: 60, requiredModules: ['cabina', 'soporte_vital'], minScience: 0 },
};

export const GRID = { cols: 6, rows: 4 };
