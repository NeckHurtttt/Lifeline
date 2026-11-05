// Minimisiones de la Estación. instruments: instrumentos requeridos (diseño); eva: salida al exterior.
export const MINIMISSIONS = {
  lanzar_cubesats: {
    id: 'lanzar_cubesats', name: 'Lanzar cubesats', desc: 'Desplegar los cubesats de los estudiantes desde el desplegador.',
    requires: { modules: ['desplegador'], crew: 1 }, days: 1, deadline: 6, cost: {},
    check: { stat: 'tecnica', dc: 8 }, reward: { science: 8, reputation: 4 }, failure: { reputation: -2 },
  },
  recuperar_satelite: {
    id: 'recuperar_satelite', name: 'Recuperar satélite averiado', desc: 'Capturar con el brazo un satélite caro que quedó a la deriva.',
    requires: { modules: ['brazo'], crew: 2, role: 'ingeniero' }, eva: true, days: 3, deadline: 10, cost: { fuel: -3 },
    check: { stat: 'tecnica', dc: 12 }, reward: { reputation: 12, science: 10 }, failure: { reputation: -4, crewHealth: -3 },
    chainUnlock: 'retirar_basura',
  },
  retirar_basura: {
    id: 'retirar_basura', name: 'Retirar basura espacial', desc: 'Limpiar escombros cercanos con el brazo: menos impactos el resto de la misión.',
    requires: { modules: ['brazo'], crew: 1 }, days: 2, deadline: 8, cost: { fuel: -2 },
    check: { stat: 'fuerza', dc: 10 }, reward: { reputation: 5 }, failure: { reputation: -2 },
  },
  capturar_carga: {
    id: 'capturar_carga', name: 'Capturar nave de carga', desc: 'Atrapar la nave de carga con el brazo. Obligatoria: si falla, la carga vuelve sin entregar.',
    requires: { modules: ['brazo'], crew: 1, role: 'piloto' }, days: 1, deadline: 1, cost: {},
    check: { stat: 'fuerza', dc: 9 }, reward: { reputation: 2 }, failure: { reputation: -5 }, mandatory: true,
  },
  experimento_externo: {
    id: 'experimento_externo', name: 'Instalar experimento externo', desc: 'Salida al exterior para fijar un experimento: +2 ciencia por día.',
    requires: { crew: 2 }, eva: true, days: 2, deadline: 10, cost: { parts: -2 },
    check: { stat: 'tecnica', dc: 10 }, reward: { science: 5 }, failure: { crewHealth: -5 },
  },
  cambiar_panel: {
    id: 'cambiar_panel', name: 'Cambiar panel o batería', desc: 'Salida al exterior para reemplazar paneles dañados (usa 5 piezas).',
    requires: { crew: 2 }, eva: true, days: 2, deadline: 8, cost: { parts: -5 },
    check: { stat: 'tecnica', dc: 10 }, reward: { reputation: 2 }, failure: { crewHealth: -5 },
  },
  fotografiar_desastre: {
    id: 'fotografiar_desastre', name: 'Fotografiar un desastre', desc: 'Un desastre natural pasa debajo: fotografiarlo para ayudar en tierra.',
    requires: { crew: 1 }, instruments: ['camara_tierra'], days: 1, deadline: 2, cost: {},
    check: { stat: 'ciencia', dc: 7 }, reward: { reputation: 10 }, failure: {},
  },
  radio_escuelas: {
    id: 'radio_escuelas', name: 'Radio con escuelas', desc: 'Hablar por radio con estudiantes desde la estación.',
    requires: { modules: ['antena'], crew: 1 }, days: 1, deadline: 6, cost: {},
    check: { stat: 'temple', dc: 6 }, reward: { crewMorale: 8, reputation: 4 }, failure: { crewMorale: -2 },
  },
  cultivo_microg: {
    id: 'cultivo_microg', name: 'Cultivo en microgravedad', desc: 'Cultivar plantas sin gravedad para estudiar su crecimiento.',
    requires: { crew: 1, role: 'biologo' }, instruments: ['plantas_microg'], days: 3, deadline: 10, cost: { water: -10 },
    check: { stat: 'ciencia', dc: 9 }, reward: { food: 10, science: 6 }, failure: { science: 1 },
  },
  prueba_nave_comercial: {
    id: 'prueba_nave_comercial', name: 'Prueba de nave comercial', desc: 'Guiar el acople de prueba de una nave comercial: gloria o vergüenza.',
    requires: { crew: 1, role: 'piloto' }, days: 2, deadline: 8, cost: {},
    check: { stat: 'fuerza', dc: 10 }, reward: { reputation: 8 }, failure: { reputation: -6 },
  },
};

// ---------- Luna y Marte ----------
// rover: hace falta un rover. Con el presurizado van 2 en EVA; con el autónomo va 1 operador desde la base, sin EVA y en el doble de días.
const SURF = ['luna', 'marte'];
Object.assign(MINIMISSIONS, {
  satelite_comunicaciones: {
    id: 'satelite_comunicaciones', name: 'Desplegar satélite de comunicaciones', desc: 'Un satélite en órbita para hablar con la Tierra desde cualquier lado: +20 GB/día de enlace.',
    scenarios: SURF, requires: { modules: ['desplegador'], crew: 1 }, days: 2, deadline: 10, cost: {},
    check: { stat: 'tecnica', dc: 9 }, reward: { reputation: 6, science: 4 }, failure: { reputation: -3 },
  },
  red_sismografos: {
    id: 'red_sismografos', name: 'Red de sismógrafos', desc: 'Llevar sismógrafos lejos de la base en rover: +1 ciencia por día.',
    scenarios: SURF, rover: true, eva: true, requires: { crew: 2 }, days: 3, deadline: 12, cost: { parts: -2 },
    check: { stat: 'tecnica', dc: 10 }, reward: { science: 8 }, failure: { crewHealth: -5 },
  },
  explorar_cueva: {
    id: 'explorar_cueva', name: 'Explorar una cueva de lava', desc: 'Bajar a un túnel de lava antiguo con el rover: mucha ciencia, algo de riesgo.',
    scenarios: SURF, rover: true, eva: true, requires: { crew: 2 }, days: 3, deadline: 10, cost: {},
    check: { stat: 'temple', dc: 12 }, reward: { science: 15, reputation: 6 }, failure: { crewHealth: -10, crewRadiation: 5 },
  },
  minar_hielo: {
    id: 'minar_hielo', name: 'Minar hielo', desc: 'Ir con el rover a un cráter oscuro y traer hielo: +300 L de agua.',
    scenarios: SURF, sites: ['luna_polo', 'marte_arcadia'], rover: true, eva: true, requires: { crew: 2 }, days: 4, deadline: 12, cost: {},
    check: { stat: 'fuerza', dc: 10 }, reward: { water: 300, reputation: 3 }, failure: { crewHealth: -5 },
  },
  muro_regolito: {
    id: 'muro_regolito', name: 'Muro de regolito', desc: 'Cubrir la base con suelo: la radiación baja 40 % el resto de la misión.',
    scenarios: SURF, eva: true, requires: { crew: 2 }, days: 4, deadline: 15, cost: { parts: -3 },
    check: { stat: 'fuerza', dc: 10 }, reward: { reputation: 4 }, failure: { crewHealth: -5 },
  },
  telescopio_oculto: {
    id: 'telescopio_oculto', name: 'Antena del radiotelescopio', desc: 'Extender la antena del radiotelescopio lejos de la base.',
    scenarios: ['luna'], instruments: ['radiotelescopio'], rover: true, eva: true, requires: { crew: 2 }, days: 2, deadline: 10, cost: {},
    check: { stat: 'ciencia', dc: 10 }, reward: { science: 12, reputation: 4 }, failure: { science: 1 },
  },
});
for (const id of ['recuperar_satelite', 'retirar_basura', 'capturar_carga', 'fotografiar_desastre', 'cultivo_microg', 'prueba_nave_comercial']) {
  MINIMISSIONS[id].scenarios = ['estacion'];
}

// ---------- Marte ----------
Object.assign(MINIMISSIONS, {
  vuelo_helicoptero: {
    id: 'vuelo_helicoptero', name: 'Vuelo del helicóptero explorador', desc: 'Un helicóptero chiquito vuela en el aire finito de Marte y busca el mejor camino.',
    scenarios: ['marte'], requires: { crew: 1 }, days: 1, deadline: 8, cost: {},
    check: { stat: 'tecnica', dc: 9 }, reward: { science: 6, reputation: 5 }, failure: { reputation: -2 },
  },
  perforacion_profunda: {
    id: 'perforacion_profunda', name: 'Perforación profunda', desc: 'Perforar 2 metros: debajo del suelo la radiación no destruyó las moléculas antiguas.',
    scenarios: ['marte'], rover: true, eva: true, requires: { crew: 2 }, days: 4, deadline: 14, cost: { parts: -3 },
    check: { stat: 'tecnica', dc: 12 }, reward: { science: 16, reputation: 4 }, failure: { parts: -2, crewHealth: -5 },
  },
  cache_muestras: {
    id: 'cache_muestras', name: 'Guardar muestras para la Tierra', desc: 'Sellar tubos con rocas para traerlas a casa (con protección planetaria).',
    scenarios: ['marte'], eva: true, requires: { crew: 2 }, days: 2, deadline: 12, cost: {},
    check: { stat: 'ciencia', dc: 10 }, reward: { science: 6, reputation: 8 }, failure: { reputation: -3 },
  },
  visitar_rover_antiguo: {
    id: 'visitar_rover_antiguo', name: 'Visitar un rover antiguo', desc: 'Ir hasta un rover robot que lleva años en Marte y revisar cómo envejeció.',
    scenarios: ['marte'], rover: true, eva: true, requires: { crew: 2 }, days: 3, deadline: 12, cost: {},
    check: { stat: 'temple', dc: 10 }, reward: { reputation: 10, science: 6 }, failure: { crewHealth: -5 },
  },
});
