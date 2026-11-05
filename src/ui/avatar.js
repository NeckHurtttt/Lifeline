// Avatares SVG animados: uno por tripulante (según su estado) y la guía de Control de Misión.
const HAIRS = ['#1d1a17', '#4a2e1c', '#8a5a2b', '#d9b26a', '#b8452c', '#e8e2d6', '#3b3f8f'];
const ROLE_COLOR = { comandante: '#ffb000', piloto: '#4fc3ff', ingeniero: '#ff7a3d', medico: '#ff5c8a', cientifico: '#9b7bff', biologo: '#4ee08a' };

function hash(str) {
  let x = 2166136261;
  for (const ch of str) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return x >>> 0;
}

/**
 * Estado visual del tripulante según sus números y lo que hace ahora.
 * @returns {'muerto'|'evacuado'|'durmiendo'|'enfermo'|'radiacion'|'agotado'|'triste'|'hambre'|'feliz'|'normal'}
 */
export function moodOf(c, activity) {
  if (!c.alive) return c.evacuated ? 'evacuado' : 'muerto';
  if (activity === 'sueño') return 'durmiendo';
  if (c.health < 40) return 'enfermo';
  if (c.radiation >= 400) return 'radiacion';
  if (c.fatigue >= 70) return 'agotado';
  if (c.hunger >= 60 || c.thirst >= 60) return 'hambre';
  if (c.morale < 40) return 'triste';
  if (c.morale >= 75 && c.health >= 80) return 'feliz';
  return 'normal';
}

export const MOOD_TEXT = {
  muerto: 'Falleció', evacuado: 'Volvió a la Tierra', durmiendo: 'Durmiendo', enfermo: 'Está enfermo',
  radiacion: 'Mucha radiación', agotado: 'Muy cansado', hambre: 'Tiene hambre o sed', triste: 'Está triste',
  feliz: 'Contento', normal: 'Bien',
};

// ---------- Retratos en pixel art (cuadrícula de 20 × 22) ----------
const INK = '#14161c';
// Tonos de piel con contraste suficiente para los ojos bajo el filtro verde.
const PIXEL_SKINS = ['#f6d2b8', '#eab48f', '#c98d63', '#b0764a', '#94603a', '#7d5232'];
const HAIR_STYLES = ['corto', 'moño', 'afro', 'coleta', 'rulos', 'rapado', 'largo', 'calvo'];
// Emblema del rol en el parche del pecho (3 × 3 píxeles).
const EMBLEM = {
  comandante: [[1, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
  piloto: [[1, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  ingeniero: [[0, 0], [2, 0], [1, 1], [1, 2]],
  medico: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  cientifico: [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2]],
  biologo: [[2, 0], [1, 1], [2, 1], [0, 2]],
};

function pixelEyes(mood, r) {
  switch (mood) {
    case 'durmiendo': r(7, 10, 2, 1, INK); r(11, 10, 2, 1, INK); break;
    case 'muerto': for (const x of [7, 11]) { r(x, 9, 1, 1, INK); r(x + 2, 9, 1, 1, INK); r(x + 1, 10, 1, 1, INK); r(x, 11, 1, 1, INK); r(x + 2, 11, 1, 1, INK); } break;
    case 'feliz': for (const x of [7, 11]) { r(x, 10, 1, 1, INK); r(x + 1, 9, 1, 1, INK); r(x + 2, 10, 1, 1, INK); } break;
    case 'agotado': r(7, 9, 2, 1, INK); r(11, 9, 2, 1, INK); r(8, 10, 1, 1, INK); r(11, 10, 1, 1, INK); break;
    default: return `<g class="blink">${['<rect x="8" y="9" width="1" height="2"', '<rect x="11" y="9" width="1" height="2"'].map((t) => `${t} fill="${INK}"/>`).join('')}</g>`;
  }
  return '';
}

function pixelMouth(mood, r) {
  switch (mood) {
    case 'feliz': r(8, 12, 1, 1, INK); r(11, 12, 1, 1, INK); r(9, 13, 2, 1, INK); break;
    case 'triste': r(9, 12, 2, 1, INK); r(8, 13, 1, 1, INK); r(11, 13, 1, 1, INK); break;
    case 'enfermo': r(8, 13, 1, 1, INK); r(9, 12, 1, 1, INK); r(10, 13, 1, 1, INK); r(11, 12, 1, 1, INK); break;
    case 'agotado': case 'hambre': r(9, 12, 2, 2, INK); break;
    case 'durmiendo': r(9, 13, 2, 1, INK); break;
    case 'muerto': case 'radiacion': r(8, 12, 4, 1, INK); break;
    default: r(9, 12, 2, 1, INK);
  }
}

function pixelExtras(mood) {
  const px = (pts, fill, cls = '') => `<g class="${cls}" fill="${fill}">${pts.map(([x, y, w = 1, h = 1]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>`;
  switch (mood) {
    case 'durmiendo': return px([[16, 2, 3], [17, 3], [16, 4, 3], [19, -2, 2], [20, -1], [19, 0, 2]], '#bfe8ff', 'zzz');
    case 'agotado': return px([[15, 5, 1, 2], [14, 6]], '#7fd0ff', 'sweat');
    case 'hambre': return px([[16, -2, 4, 4], [15, -1, 6, 2], [14, 3], [13, 4]], '#ffffff', 'thought') + px([[17, -1, 2, 2]], '#d94b3b') + px([[18, -2]], '#3b7a2a');
    case 'triste': return px([[8, 11, 1, 2]], '#7fd0ff', 'tear');
    case 'enfermo': return px([[7, 11], [12, 11]], '#9fd36b');
    case 'radiacion': return px([[2, 1, 2], [7, 1, 2], [12, 1, 2], [17, 1, 1], [1, 4, 1, 2], [18, 4, 1, 2], [1, 9, 1, 2], [18, 9, 1, 2], [2, 15, 2], [16, 15, 2]], '#c6ff3d', 'rad');
    case 'feliz': return px([[17, 1, 1, 3], [16, 2, 3, 1]], '#ffe66b', 'sparkle');
    default: return '';
  }
}

/** Retrato pixel art de un tripulante. Cada uno se ve distinto (depende de su nombre). */
export function crewAvatar(c, { size = 84, activity = null } = {}) {
  const k = hash(c.name ?? c.id);
  const skin = PIXEL_SKINS[(k >>> 6) % PIXEL_SKINS.length];
  const hair = HAIRS[(k >>> 3) % HAIRS.length];
  const style = HAIR_STYLES[k % HAIR_STYLES.length];
  const beard = ((k >>> 9) & 3) === 0;
  const glasses = ((k >>> 11) & 3) === 0;
  const freckles = ((k >>> 13) % 5) === 0;
  const headset = ((k >>> 15) % 6) === 0;
  const traits = new Set(c.traits ?? []);
  const suit = ROLE_COLOR[c.role] ?? '#9aa';
  const mood = moodOf(c, activity);
  const eva = activity === 'eva';
  const back = []; const o = [];
  const R = (arr) => (x, y, w, h, fill) => arr.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
  const b = R(back); const r = R(o);

  // Pelo de atrás
  if (style === 'afro') { b(4, 1, 12, 3, hair); b(3, 3, 14, 9, hair); b(4, 12, 12, 1, hair); }
  if (style === 'largo') { b(4, 5, 2, 10, hair); b(14, 5, 2, 10, hair); }
  if (style === 'coleta') { b(15, 5, 2, 2, hair); b(16, 7, 2, 5, hair); b(17, 12, 1, 1, hair); }
  if (style === 'moño') { b(8, 0, 4, 3, hair); b(7, 1, 6, 1, hair); }

  // Traje, cuello y parche con el emblema del rol
  r(4, 16, 12, 6, '#e9eef5'); r(3, 17, 14, 5, '#e9eef5'); r(3, 18, 14, 1, suit);
  r(8, 15, 4, 1, skin); r(7, 16, 6, 1, '#9aa6b5');
  r(11, 19, 3, 3, '#24324a');
  for (const [x, y] of EMBLEM[c.role] ?? []) r(11 + x, 19 + y, 1, 1, suit);
  if (traits.has('gloton')) { r(4, 19, 2, 2, '#c98d4a'); r(4, 19, 1, 1, '#5a3620'); }

  // Cara
  r(6, 5, 8, 9, skin); r(5, 8, 1, 3, skin); r(14, 8, 1, 3, skin); r(7, 14, 6, 1, skin);
  if (freckles) { r(7, 11, 1, 1, '#a8693f'); r(12, 11, 1, 1, '#a8693f'); }

  // Pelo de adelante
  const front = {
    corto: () => { r(6, 3, 8, 2, hair); r(5, 4, 1, 4, hair); r(14, 4, 1, 4, hair); r(6, 5, 2, 1, hair); },
    moño: () => { r(6, 3, 8, 2, hair); r(5, 4, 1, 4, hair); r(14, 4, 1, 4, hair); r(10, 5, 4, 1, hair); },
    afro: () => { r(6, 4, 8, 1, hair); },
    coleta: () => { r(6, 3, 8, 2, hair); r(5, 4, 1, 3, hair); r(14, 4, 1, 3, hair); r(6, 5, 4, 1, hair); },
    rulos: () => { r(5, 3, 10, 2, hair); r(4, 4, 1, 5, hair); r(15, 4, 1, 5, hair); r(5, 2, 2, 1, hair); r(8, 2, 2, 1, hair); r(11, 2, 2, 1, hair); r(6, 5, 1, 1, hair); r(9, 5, 1, 1, hair); r(12, 5, 1, 1, hair); },
    rapado: () => { o.push(`<rect x="6" y="4" width="8" height="1" fill="${hair}" opacity=".55"/>`); },
    largo: () => { r(6, 3, 8, 2, hair); r(5, 4, 1, 6, hair); r(14, 4, 1, 6, hair); r(6, 5, 3, 1, hair); r(11, 5, 3, 1, hair); },
    calvo: () => { r(5, 7, 1, 2, hair); r(14, 7, 1, 2, hair); },
  };
  front[style]();
  if (traits.has('atleta')) r(6, 6, 8, 1, '#d94b3b');
  if (beard) { r(6, 12, 8, 2, hair); r(7, 14, 6, 1, hair); r(5, 10, 1, 2, hair); r(14, 10, 1, 2, hair); r(8, 11, 4, 1, hair); }

  // Gafas, ojeras, ojos, boca
  if (glasses) { r(7, 8, 3, 3, '#cfd8e3'); r(10, 8, 3, 3, '#cfd8e3'); r(6, 9, 1, 1, '#cfd8e3'); r(13, 9, 1, 1, '#cfd8e3'); }
  if (traits.has('insomne') && !['durmiendo', 'muerto'].includes(mood)) { r(8, 11, 1, 1, '#6b4a7a'); r(11, 11, 1, 1, '#6b4a7a'); }
  const eyes = pixelEyes(mood, r);
  pixelMouth(mood, r);
  if (mood === 'enfermo') o.push(`<rect x="6" y="5" width="8" height="9" fill="#9fd36b" opacity=".18"/>`);

  // Auriculares de comunicaciones
  if (headset && !eva) { r(5, 2, 10, 1, '#cfd8e3'); r(4, 3, 1, 4, '#cfd8e3'); r(15, 3, 1, 4, '#cfd8e3'); r(3, 7, 2, 4, '#5b6b80'); r(15, 7, 2, 4, '#5b6b80'); r(5, 11, 1, 1, '#5b6b80'); r(6, 12, 2, 1, '#5b6b80'); }

  // Casco solo en la EVA
  const helmet = eva ? `<g>
    <rect x="3" y="1" width="14" height="15" fill="#7fd0ff" opacity=".14"/>
    ${[[6, 0, 8, 1], [4, 1, 2, 1], [14, 1, 2, 1], [3, 2, 1, 2], [16, 2, 1, 2], [2, 4, 1, 9], [17, 4, 1, 9], [3, 13, 1, 2], [16, 13, 1, 2], [4, 15, 12, 1]]
      .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e9eef5"/>`).join('')}
    <rect x="5" y="3" width="1" height="2" fill="#fff" opacity=".8"/><rect x="6" y="2" width="2" height="1" fill="#fff" opacity=".8"/></g>` : '';

  const svg = `
<svg viewBox="-1 -3 22 25" width="${size}" height="${size * 1.1}" class="avatar pixel mood-${mood}" shape-rendering="crispEdges" role="img" aria-label="${c.name}: ${MOOD_TEXT[mood]}">
  <g class="body">${back.join('')}${o.join('')}${eyes}${helmet}${pixelExtras(mood)}</g>
</svg>`;
  const wrap = document.createElement('div');
  wrap.className = `avatar-wrap mood-${mood}`;
  wrap.style.animationDelay = `${-(k % 3000) / 1000}s`;
  wrap.innerHTML = svg;
  return wrap;
}

/** SVG de la guía Nova: dibujo animado retro de los años 50 (contornos gruesos, colores planos), personaje propio.
 *  mood: 'normal'|'feliz'|'alerta'|'pensando' */
export function guideSvg(mood = 'normal') {
  const K = '#151515';
  const ln = `stroke="${K}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const eyes = {
    feliz: `<path d="M38 50 q4 -5 8 0" fill="none" ${ln}/><path d="M54 50 q4 -4 8 0" fill="none" ${ln}/><path d="M53 45 l9 -2" ${ln}/>`,
    alerta: `<ellipse cx="42" cy="49" rx="3.6" ry="4.6" fill="#fff" ${ln}/><ellipse cx="58" cy="49" rx="3.6" ry="4.6" fill="#fff" ${ln}/>
      <circle cx="42" cy="50" r="1.6" fill="${K}"/><circle cx="58" cy="50" r="1.6" fill="${K}"/>`,
    pensando: `<ellipse cx="42" cy="49" rx="2.6" ry="3.4" fill="${K}"/><ellipse cx="58" cy="49" rx="2.6" ry="3.4" fill="${K}"/>
      <circle cx="43" cy="47" r=".9" fill="#fff"/><circle cx="59" cy="47" r=".9" fill="#fff"/>`,
  }[mood] ?? `<g class="g-eyes"><ellipse cx="42" cy="49" rx="2.6" ry="3.6" fill="${K}"/><ellipse cx="58" cy="49" rx="2.6" ry="3.6" fill="${K}"/>
      <circle cx="42.8" cy="47.6" r=".9" fill="#fff"/><circle cx="58.8" cy="47.6" r=".9" fill="#fff"/></g>`;
  const brows = mood === 'alerta' ? `<path d="M37 41 q5 -4 10 -1 M53 40 q5 -3 10 1" fill="none" ${ln}/>`
    : mood === 'pensando' ? `<path d="M37 43 q5 -2 10 0 M53 40 q5 -3 10 0" fill="none" ${ln}/>`
      : `<path d="M37 43 q5 -3 10 -1 M53 42 q5 -2 10 1" fill="none" ${ln}/>`;
  const mouth = mood === 'alerta' ? `<ellipse class="mouth" cx="50" cy="61" rx="4" ry="5" fill="#7a1f1f" ${ln}/>`
    : mood === 'feliz' ? `<path class="mouth" d="M38 56 q12 14 24 0 z" fill="#fff" ${ln}/><path d="M39.5 58 h21" ${ln} stroke-width="1.4"/>`
      : mood === 'pensando' ? `<path class="mouth" d="M44 61 q5 -2 10 1" fill="none" ${ln}/>`
        : `<path class="mouth" d="M39 57 q11 10 22 0" fill="none" ${ln}/><path d="M37.5 56 l2 2 M62.5 56 l-2 2" ${ln} stroke-width="1.6"/>`;
  const sweat = mood === 'alerta' ? `<path d="M68 38 q4 6 0 9 q-4 -3 0 -9z" fill="#9fe3ff" ${ln} stroke-width="1.4"/>` : '';
  const thought = mood === 'pensando' ? `<circle cx="82" cy="22" r="2" fill="#fff" ${ln} stroke-width="1.2"/><circle cx="88" cy="14" r="3.2" fill="#fff" ${ln} stroke-width="1.2"/>` : '';
  // Brazo: pulgar arriba (normal/feliz), dedo arriba (alerta), mano al mentón (pensando).
  const arm = mood === 'pensando'
    ? `<path d="M74 104 q12 -4 4 -20 l-12 -8" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
       <path d="M74 104 q12 -4 4 -20 l-12 -8" fill="none" stroke="#f3e7c9" stroke-width="7" stroke-linecap="round"/>
       <circle cx="63" cy="73" r="6" fill="#f4c99b" ${ln}/>`
    : `<path d="M74 102 q14 -4 16 -22" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
       <path d="M74 102 q14 -4 16 -22" fill="none" stroke="#f3e7c9" stroke-width="7" stroke-linecap="round"/>
       <rect x="82" y="71" width="15" height="13" rx="4.5" fill="#f4c99b" ${ln}/>
       <path d="M85 75.5 h8 M85 79.5 h8" ${ln} stroke-width="1.2"/>
       <rect x="${mood === 'alerta' ? 84 : 91.5}" y="59" width="5.4" height="14" rx="2.7" fill="#f4c99b" ${ln}/>`;
  return `
<svg viewBox="0 0 100 120" class="guide-svg mood-${mood}" role="img" aria-label="Nova, guía de Control de Misión">
  <g class="g-body">
    <path d="M20 119 q0 -26 30 -29 q30 3 30 29z" fill="#f3e7c9" ${ln}/>
    <path d="M36 92 q14 8 28 0" fill="none" ${ln}/>
    <path d="M50 96 v23" ${ln} stroke-width="1.6"/>
    <circle cx="38" cy="106" r="6" fill="#d94b3b" ${ln} stroke-width="1.8"/>
    <path d="M38 101.5 l1.3 3 3.2 .3 -2.4 2.1 .7 3.1 -2.8 -1.6 -2.8 1.6 .7 -3.1 -2.4 -2.1 3.2 -.3z" fill="#f3e7c9"/>
    <ellipse cx="38" cy="106" rx="9" ry="3" fill="none" stroke="#f3e7c9" stroke-width="1" transform="rotate(-25 38 106)"/>
    <rect x="58" y="102" width="12" height="6" rx="1.5" fill="#d94b3b" ${ln} stroke-width="1.6"/>
    <rect x="33" y="84" width="34" height="8" rx="4" fill="#bdb6a2" ${ln}/>
    <g class="g-head">
      <path d="M50 8 v8" ${ln}/><circle cx="50" cy="6" r="3.2" fill="#d94b3b" ${ln} stroke-width="1.8"/>
      <circle cx="50" cy="50" r="33" fill="rgba(190,235,255,.18)" ${ln}/>
      <path d="M30 30 q8 -10 20 -11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <path d="M28 52 q-2 -26 22 -28 q24 2 22 28 q0 10 -4 14 q-1 -12 -6 -16 q-12 -8 -24 0 q-5 4 -6 16 q-4 -4 -4 -14z" fill="#3b2a1a" ${ln}/>
      <path d="M33 54 q-1 -16 17 -18 q18 2 17 18 q0 15 -17 17 q-17 -2 -17 -17z" fill="#f4c99b" ${ln}/>
      <path d="M33 47 q4 -14 17 -14 q10 0 15 6 q-6 -1 -10 3 q-2 -6 -8 -3 q-6 3 -14 8z" fill="#3b2a1a" ${ln}/>
      <path d="M49 33 q-5 -6 1 -9 q5 -1 4 4" fill="none" ${ln}/>
      ${brows}
      ${eyes}
      <circle cx="36.5" cy="56" r="3" fill="#ff8f7a" opacity=".55"/><circle cx="63.5" cy="56" r="3" fill="#ff8f7a" opacity=".55"/>
      <g fill="#a0623a"><circle cx="38" cy="54" r=".7"/><circle cx="40" cy="56" r=".7"/><circle cx="62" cy="54" r=".7"/><circle cx="60" cy="56" r=".7"/></g>
      <path d="M49 52 q2 3 0 4" fill="none" ${ln} stroke-width="1.6"/>
      ${mouth}
      ${sweat}
    </g>
    ${thought}
    <g class="g-arm">${arm}</g>
  </g>
</svg>`;
}
