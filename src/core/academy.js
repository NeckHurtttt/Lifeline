// ACADEMIA DE ASTRONAUTAS: pruebas cortas de entrenamiento como las reales de NASA.
// Lógica pura (sin DOM): qué prueba toca, cuántas estrellas da un resultado y qué ayuda deja en la misión.

export const TRAININGS = {
  flotar: {
    id: 'flotar', icon: '🫧', name: 'Gravedad cero', seconds: 25, where: [],
    goal: 'Atrapa las cosas que flotan en la cabina antes de que se acabe el tiempo.',
    fact: 'Los astronautas practican la ingravidez en un avión que cae en picada: unos 25 segundos de flotar en cada subida.',
  },
  acople: {
    id: 'acople', icon: '🎯', name: 'Acoplamiento', seconds: 35, where: ['estacion'],
    goal: 'Mantén la cruz en el centro del puerto mientras la nave se acerca.',
    fact: 'Las naves llegan a la Estación a unos 10 cm por segundo, más lento que una persona caminando.',
  },
  brazo: {
    id: 'brazo', icon: '🦾', name: 'Brazo robótico', seconds: 30, where: ['gateway'],
    goal: 'Toca AGARRAR cuando la pinza esté justo encima de la nave de carga.',
    fact: 'El brazo Canadarm2 mide 17 metros y atrapa naves de carga que flotan junto a la Estación.',
  },
  luna: {
    id: 'luna', icon: '🌕', name: 'Caminar en la Luna', seconds: 30, where: ['luna'],
    goal: 'Salta los cráteres. En la Luna pesas 6 veces menos: los saltos son largos y lentos.',
    fact: 'Los astronautas del Apolo avanzaban dando saltitos de canguro porque caminar normal era más difícil.',
  },
  rover: {
    id: 'rover', icon: '🛰️', name: 'Rover en Marte', seconds: 75, where: ['marte'],
    goal: 'Programa al rover con órdenes y envíalas. La señal tarda en llegar a Marte: piensa todo el camino antes.',
    fact: 'Una señal tarda entre 4 y 24 minutos en llegar a Marte. Por eso los rovers no se manejan en vivo: se les manda el plan del día.',
  },
  centrifuga: {
    id: 'centrifuga', icon: '🌀', name: 'Centrífuga', seconds: 25, where: [],
    goal: 'Mantén la aguja en la zona verde: toca TENSAR para aguantar la fuerza G, sin pasarte.',
    fact: 'Al frenar en la atmósfera de Marte o de la Tierra se sienten varias G; en la centrífuga se entrena a aguantarlas apretando el cuerpo y respirando.',
  },
};

/** Orden de la academia (versión niños). */
export const ACADEMY_ORDER = ['flotar', 'acople', 'brazo', 'luna', 'centrifuga', 'rover'];

/** La prueba que corresponde a cada destino (la versión completa ofrece solo esa antes de volar). */
export function trainingFor(scenarioId) {
  return Object.values(TRAININGS).find((t) => t.where.includes(scenarioId))?.id ?? 'acople';
}

/**
 * Estrellas 0-3 a partir de lo logrado.
 * score: fracción 0-1 de lo bien que salió (atrapados/total, tiempo en zona, precisión…).
 */
export function starsFrom(score) {
  const s = Math.max(0, Math.min(1, Number(score) || 0));
  return s >= 0.85 ? 3 : s >= 0.6 ? 2 : s >= 0.3 ? 1 : 0;
}

/** Ayuda en las habilidades de la tripulación según las estrellas (se suma en crewScore). */
export const trainingBonus = (stars) => (stars >= 3 ? 2 : stars >= 2 ? 1 : 0);

/** Deja el entrenamiento en el estado de la misión (puro). */
export function applyTraining(state, id, stars) {
  const bonus = trainingBonus(stars);
  const crew = bonus ? state.crew.map((c) => ({ ...c, morale: Math.min(100, (c.morale ?? 70) + 5 * bonus) })) : state.crew;
  return { ...state, crew, training: { id, stars, bonus } };
}

/** "Alas" de astronauta: todas las pruebas con al menos 2 estrellas. */
export const hasWings = (record) => ACADEMY_ORDER.every((id) => (record?.[id] ?? 0) >= 2);

// ---------- Rover en Marte: cuadrícula, rocas y programa de órdenes ----------
export const ROVER_COLS = 8, ROVER_ROWS = 5;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // este, sur, oeste, norte
const key = (x, y) => `${x},${y}`;

/** Camino más corto (en casillas) entre dos puntos sin pasar por rocas, o -1. */
export function roverDistance(rocks, from, to) {
  const block = new Set(rocks.map((r) => key(r.x, r.y)));
  const seen = new Set([key(from.x, from.y)]);
  let frontier = [from], d = 0;
  while (frontier.length) {
    const next = [];
    for (const p of frontier) {
      if (p.x === to.x && p.y === to.y) return d;
      for (const [dx, dy] of DIRS) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= ROVER_COLS || q.y >= ROVER_ROWS || block.has(key(q.x, q.y)) || seen.has(key(q.x, q.y))) continue;
        seen.add(key(q.x, q.y)); next.push(q);
      }
    }
    frontier = next; d++;
  }
  return -1;
}

/** Un nivel: rover, muestra y rocas, siempre con camino. rnd: función 0-1. */
export function roverLevel(rnd = Math.random, n = 0) {
  const ri = (k) => Math.floor(rnd() * k);
  for (let tries = 0; tries < 200; tries++) {
    const rover = { x: ri(2), y: ri(ROVER_ROWS), dir: 0 };
    const sample = { x: ROVER_COLS - 1 - ri(2), y: ri(ROVER_ROWS) };
    const rocks = [];
    const want = 5 + n * 2;
    while (rocks.length < want) {
      const r = { x: 1 + ri(ROVER_COLS - 2), y: ri(ROVER_ROWS) };
      if ((r.x === rover.x && r.y === rover.y) || (r.x === sample.x && r.y === sample.y) || rocks.some((o) => o.x === r.x && o.y === r.y)) continue;
      rocks.push(r);
    }
    const d = roverDistance(rocks, rover, sample);
    if (d >= 6) return { rover, sample, rocks, best: d };
  }
  return { rover: { x: 0, y: 2, dir: 0 }, sample: { x: 7, y: 2 }, rocks: [], best: 7 };
}

/**
 * Ejecuta el programa ('F' avanzar, 'L' girar a la izquierda, 'R' a la derecha).
 * Devuelve cada posición, si llegó a la muestra y si chocó (roca o borde).
 */
export function runRover(level, program) {
  let { x, y, dir } = level.rover;
  const path = [{ x, y, dir }];
  const block = new Set(level.rocks.map((r) => key(r.x, r.y)));
  for (const c of program) {
    if (c === 'L') dir = (dir + 3) % 4;
    else if (c === 'R') dir = (dir + 1) % 4;
    else if (c === 'F') {
      const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
      if (nx < 0 || ny < 0 || nx >= ROVER_COLS || ny >= ROVER_ROWS || block.has(key(nx, ny))) return { path, reached: false, crashed: true, at: { x, y, dir } };
      x = nx; y = ny;
    }
    path.push({ x, y, dir });
    if (x === level.sample.x && y === level.sample.y) return { path, reached: true, crashed: false, at: { x, y, dir } };
  }
  return { path, reached: false, crashed: false, at: { x, y, dir } };
}
