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
