// Misiones históricas recreadas como retos: misma idea del problema real, en el juego.
// `scripted`: eventos que pasan sí o sí ese día. `forceBoom`: cuántas naves de carga seguidas fallan.
export const HISTORICAS = [
  {
    id: 'apolo13', year: 1970, icon: '🌕', name: 'Apolo 13: "Houston, tenemos un problema"', scenarioId: 'luna', difficulty: 'medio', objective: 'tripulacion',
    story: 'Rumbo a la Luna explotó un tanque de oxígeno. La tripulación sobrevivió improvisando filtros de CO₂ con cinta y apagando casi todo para ahorrar energía.',
    scripted: [{ day: 4, eventId: 'tanque_o2', severity: 'grave' }],
  },
  {
    id: 'skylab', year: 1973, icon: '🛰️', name: 'Skylab: la estación que perdió un panel', scenarioId: 'estacion', difficulty: 'medio', objective: 'ciencia',
    story: 'En el despegue, Skylab perdió un panel solar y su escudo térmico. La primera tripulación salió a liberar el otro panel y armó una sombrilla para enfriarla.',
    scripted: [{ day: 1, eventId: 'impacto_panel', severity: 'grave' }, { day: 3, eventId: 'micrometeoritos', severity: 'media' }],
  },
  {
    id: 'mir', year: 1997, icon: '🔥', name: 'Mir 1997: incendio y choque', scenarioId: 'estacion', difficulty: 'dificil', objective: 'tripulacion',
    story: 'En febrero un generador de oxígeno se incendió; en junio una nave de carga chocó contra el módulo Spektr y lo despresurizó. La tripulación cerró la escotilla a tiempo.',
    scripted: [{ day: 20, eventId: 'incendio', severity: 'media' }, { day: 120, eventId: 'choque_carga', severity: 'grave' }],
  },
  {
    id: 'iss2015', year: 2015, icon: '💥', name: 'Estación 2015: tres cargas perdidas', scenarioId: 'estacion', difficulty: 'medio', objective: 'economica',
    story: 'Entre octubre de 2014 y junio de 2015 fallaron tres naves de carga seguidas (Orb-3, Progress M-27M y CRS-7). La estación siguió gracias a sus reservas.',
    forceBoom: 3,
  },
];
export const HISTORICA = Object.fromEntries(HISTORICAS.map((m) => [m.id, m]));
