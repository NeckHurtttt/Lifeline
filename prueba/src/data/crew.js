export const ROLES = {
  comandante: { id: 'comandante', name: 'Comandante', mainStat: 'temple' },
  piloto: { id: 'piloto', name: 'Piloto', mainStat: 'fuerza' },
  ingeniero: { id: 'ingeniero', name: 'Ingeniero', mainStat: 'tecnica' },
  medico: { id: 'medico', name: 'Médico', mainStat: 'medicina' },
  cientifico: { id: 'cientifico', name: 'Científico', mainStat: 'ciencia' },
  biologo: { id: 'biologo', name: 'Biólogo', mainStat: 'ciencia' },
};

// Se aplican al generar la tripulación.
export const STAT_RANGES = { main: [7, 9], other: [2, 6] };

export const TRAITS = {
  manos_firmes: { id: 'manos_firmes', name: 'Manos firmes', positive: true, desc: '+2 técnica al reparar.' },
  atleta: { id: 'atleta', name: 'Atleta', positive: true, desc: 'Pierde 50 % menos masa ósea.' },
  sereno: { id: 'sereno', name: 'Sereno', positive: true, desc: 'Pierde 50 % menos moral.' },
  ojo_cientifico: { id: 'ojo_cientifico', name: 'Ojo científico', positive: true, desc: '+20 % de ciencia.' },
  frugal: { id: 'frugal', name: 'Frugal', positive: true, desc: 'Come 20 % menos.' },
  resistente: { id: 'resistente', name: 'Resistente', positive: true, desc: 'Recibe 20 % menos radiación.' },
  claustrofobico: { id: 'claustrofobico', name: 'Claustrofóbico', positive: false, desc: '-1 de moral extra por día.' },
  gloton: { id: 'gloton', name: 'Glotón', positive: false, desc: 'Come 20 % más.' },
  insomne: { id: 'insomne', name: 'Insomne', positive: false, desc: 'Se fatiga más rápido.' },
  torpe: { id: 'torpe', name: 'Torpe', positive: false, desc: '+10 % de fallo en actividades extravehiculares.' },
  ansioso: { id: 'ansioso', name: 'Ansioso', positive: false, desc: 'Pierde moral en cada alerta.' },
  fragil: { id: 'fragil', name: 'Frágil', positive: false, desc: '+20 % de daño a la salud.' },
};

export const NAMES = [
  'Valeria Montoya', 'Mateo Quispe', 'Ingrid Solberg', 'Kenji Arakawa', 'Camila Duarte', 'Tomás Villarreal',
  'Amara Okonkwo', 'Dario Ferrante', 'Lucía Paredes', 'Nikolai Varga', 'Sofía Beltrán', 'Hugo Lindqvist',
  'Inés Carvalho', 'Rafael Quintero', 'Mei Tanaka', 'Bruno Escalante', 'Zoe Marchand', 'Andrés Ledesma',
  'Yara Haddad', 'Emilio Sandoval', 'Freya Nilsen', 'Joaquín Ibarra', 'Nadia Petrova', 'Santiago Mora',
];
