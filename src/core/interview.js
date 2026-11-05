// Entrevistas: cada puesto tiene 3 candidatos; con 3 preguntas por candidato se descubren habilidades y rasgos.
import { createRng } from './rng.js';
import { ROLES, STAT_RANGES, TRAITS, NAMES } from '../data/crew.js';

export const CANDIDATES_PER_ROLE = 3;
export const QUESTIONS_PER_CANDIDATE = 3;
const STAT_KEYS = ['fuerza', 'tecnica', 'ciencia', 'medicina', 'temple'];
const ROLE_ORDER = Object.keys(ROLES);

const level = (v) => (v >= 8 ? 3 : v >= 6 ? 2 : v >= 4 ? 1 : 0);

/** Preguntas. `stat`: habilidad que revela; `traits`: rasgos que puede delatar (respuesta propia si lo tiene). */
export const QUESTIONS = [
  { id: 'arreglar', icon: '🔧', q: 'Se rompe una máquina en plena noche. ¿Qué haces?', stat: 'tecnica', traits: ['manos_firmes', 'torpe'],
    answers: ['Uy… llamaría a alguien que sepa.', 'Leo el manual y pruebo con cuidado.', 'Busco la falla y la arreglo, sé de esto.', '¡Lo desarmo y lo dejo mejor que nuevo!'] },
  { id: 'alarma', icon: '🚨', q: 'Suena una alarma fuerte. ¿Cómo reaccionas?', stat: 'temple', traits: ['ansioso', 'sereno'],
    answers: ['Me asusto mucho, me cuesta pensar.', 'Me pongo nervioso, pero sigo el protocolo.', 'Respiro hondo y reviso qué pasa.', 'Tranquilo. Ordeno a todos y lo resolvemos.'] },
  { id: 'entrenar', icon: '🏋️', q: '¿Cuánto haces ejercicio? ¿Podrías pilotear una nave?', stat: 'fuerza', traits: ['atleta'],
    answers: ['Casi nada, y los mandos me marean.', 'A veces. Piloteo en el simulador.', 'Bastante, y piloteo bien.', '¡Todos los días! Soy piloto de pruebas.'] },
  { id: 'descubrir', icon: '🔬', q: '¿Qué te gustaría descubrir en el espacio?', stat: 'ciencia', traits: ['ojo_cientifico'],
    answers: ['La verdad, la ciencia no es lo mío.', 'Me gusta ayudar en los experimentos.', 'Tengo ideas para varios experimentos.', '¡Tengo una lista enorme! Soy investigador.'] },
  { id: 'herido', icon: '🩹', q: 'Un compañero se corta la mano. ¿Qué haces?', stat: 'medicina', traits: [],
    answers: ['Me da miedo la sangre…', 'Sé primeros auxilios básicos.', 'Lo curo bien, estudié enfermería.', 'Soy médico: lo atiendo de inmediato.'] },
  { id: 'encierro', icon: '📦', q: '¿Cómo te sientes en un lugar chico mucho tiempo?', stat: null, traits: ['claustrofobico', 'sereno'],
    neutral: 'Normal. Me acostumbro.' },
  { id: 'comer', icon: '🍎', q: '¿Cuánto comes al día?', stat: null, traits: ['gloton', 'frugal'], neutral: 'Lo normal, tres comidas.' },
  { id: 'dormir', icon: '😴', q: '¿Duermes bien?', stat: null, traits: ['insomne'], neutral: 'Sí, duermo bien.' },
  { id: 'salud', icon: '🤒', q: '¿Te enfermas seguido? ¿Aguantas el sol fuerte?', stat: null, traits: ['fragil', 'resistente'], neutral: 'Como cualquiera.' },
];

const TRAIT_ANSWER = {
  manos_firmes: 'Y tengo manos firmes: nunca se me cae un tornillo.',
  torpe: 'Aunque… a veces se me caen las herramientas.',
  ansioso: 'Me pongo ansioso con cada alarma, la verdad.',
  sereno: 'Casi nada me quita la calma.',
  atleta: 'Soy atleta: mis huesos son muy fuertes.',
  ojo_cientifico: 'Tengo ojo científico: noto detalles que otros no ven.',
  claustrofobico: 'Mal… los lugares chicos me ponen triste.',
  gloton: '¡Mucho! Siempre tengo hambre.',
  frugal: 'Poquito, con poco me alcanza.',
  insomne: 'No… me cuesta dormir y me canso rápido.',
  fragil: 'Sí, me enfermo bastante.',
  resistente: 'Casi nunca, y aguanto bien la radiación del sol.',
};

/** Candidatos deterministas para un puesto. */
export function candidatesFor(role, seed) {
  const order = createRng(seed >>> 0);
  const names = [...NAMES];
  for (let i = names.length - 1; i > 0; i--) { const j = order.int(0, i); [names[i], names[j]] = [names[j], names[i]]; }
  const base = ROLE_ORDER.indexOf(role) * CANDIDATES_PER_ROLE;
  const rng = createRng((seed ^ ((base + 1) * 0x9e3779b1)) >>> 0);
  const pos = Object.values(TRAITS).filter((t) => t.positive);
  const neg = Object.values(TRAITS).filter((t) => !t.positive);
  const main = ROLES[role].mainStat;
  return Array.from({ length: CANDIDATES_PER_ROLE }, (_, i) => {
    const stats = {};
    for (const k of STAT_KEYS) {
      const [lo, hi] = k === main ? STAT_RANGES.main : STAT_RANGES.other;
      stats[k] = rng.int(lo, hi);
    }
    return { id: `${role}-${i}`, name: names[base + i], role, stats, traits: [rng.pick(pos).id, rng.pick(neg).id] };
  });
}

/** Respuesta del candidato a una pregunta y qué se descubre. */
export function ask(candidate, questionId) {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) throw new Error(`Pregunta desconocida: ${questionId}`);
  const parts = [];
  const reveals = { stats: [], traits: [] };
  if (q.stat) { parts.push(q.answers[level(candidate.stats[q.stat])]); reveals.stats.push(q.stat); }
  const found = q.traits.filter((t) => candidate.traits.includes(t));
  for (const t of found) { parts.push(TRAIT_ANSWER[t]); reveals.traits.push(t); }
  if (!parts.length) parts.push(q.neutral);
  return { text: parts.join(' '), reveals };
}

/** Lo que el jugador sabe de un candidato tras sus preguntas. */
export function knownAbout(candidate, asked) {
  const stats = {};
  const traits = new Set();
  for (const qid of asked) {
    const { reveals } = ask(candidate, qid);
    for (const s of reveals.stats) stats[s] = candidate.stats[s];
    for (const t of reveals.traits) traits.add(t);
  }
  return { stats, traits: [...traits] };
}
