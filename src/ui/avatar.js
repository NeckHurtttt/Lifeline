// Avatares SVG animados: uno por tripulante (según su estado) y la guía de Control de Misión.
const SKINS = ['#f6d2b8', '#eab48f', '#c98d63', '#a8693f', '#7a4a2a', '#5a3620'];
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

function face(mood) {
  // ojos y boca según el ánimo
  const eyes = {
    durmiendo: '<path d="M37 47 q4 3 8 0 M55 47 q4 3 8 0" stroke="#222" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    muerto: '<path d="M37 43 l7 7 M44 43 l-7 7 M56 43 l7 7 M63 43 l-7 7" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>',
    agotado: '<path d="M36 46 h9 M55 46 h9" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="40.5" cy="49" r="2" fill="#222"/><circle cx="59.5" cy="49" r="2" fill="#222"/>',
    feliz: '<path d="M36 48 q4.5 -6 9 0 M55 48 q4.5 -6 9 0" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  }[mood] ?? '<circle class="blink" cx="40.5" cy="46" r="3.2" fill="#222"/><circle class="blink" cx="59.5" cy="46" r="3.2" fill="#222"/>';
  const mouth = {
    feliz: '<path d="M41 57 q9 9 18 0" stroke="#222" stroke-width="2.4" fill="#fff" stroke-linecap="round"/>',
    triste: '<path d="M42 61 q8 -7 16 0" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    enfermo: '<path d="M42 60 q4 -3 8 0 q4 3 8 0" stroke="#222" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    agotado: '<ellipse cx="50" cy="59" rx="4" ry="3" fill="#222"/>',
    hambre: '<ellipse cx="50" cy="59" rx="5" ry="4" fill="#222"/>',
    durmiendo: '<path d="M46 59 h8" stroke="#222" stroke-width="2" stroke-linecap="round"/>',
    muerto: '<path d="M43 60 h14" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>',
    radiacion: '<path d="M43 59 h14" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>',
  }[mood] ?? '<path d="M43 57 q7 5 14 0" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  return eyes + mouth;
}

function extras(mood) {
  switch (mood) {
    case 'durmiendo': return '<g class="zzz" font-family="sans-serif" font-weight="bold" fill="#bfe8ff"><text x="70" y="22" font-size="11">z</text><text x="77" y="13" font-size="14">Z</text></g>';
    case 'agotado': return '<path class="sweat" d="M68 36 q4 7 0 10 q-4 -3 0 -10z" fill="#7fd0ff"/>';
    case 'hambre': return '<g class="thought"><circle cx="76" cy="22" r="9" fill="#fff" opacity=".9"/><text x="70.5" y="26.5" font-size="11">🍎</text></g>';
    case 'triste': return '<path class="tear" d="M38 52 q2 5 0 7 q-2 -2 0 -7z" fill="#7fd0ff"/>';
    case 'enfermo': return '<circle cx="34" cy="54" r="3.5" fill="#9fd36b" opacity=".7"/><circle cx="66" cy="54" r="3.5" fill="#9fd36b" opacity=".7"/>';
    case 'radiacion': return '<g class="rad"><circle cx="50" cy="48" r="34" fill="none" stroke="#c6ff3d" stroke-width="2" stroke-dasharray="4 5"/></g>';
    case 'feliz': return '<g class="sparkle" fill="#ffe66b"><path d="M78 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>';
    default: return '';
  }
}

/** SVG de un tripulante. Cada uno se ve distinto (depende de su nombre). */
export function crewAvatar(c, { size = 84, activity = null } = {}) {
  const k = hash(c.name ?? c.id);
  const skin = SKINS[k % SKINS.length];
  const hair = HAIRS[(k >>> 3) % HAIRS.length];
  const longHair = ((k >>> 7) & 1) === 1;
  const suit = ROLE_COLOR[c.role] ?? '#9aa';
  const mood = moodOf(c, activity);
  const sickTint = mood === 'enfermo' ? '<circle cx="50" cy="48" r="18" fill="#9fd36b" opacity=".18"/>' : '';
  const hairPath = longHair
    ? `<path d="M31 47 q-2 -20 19 -21 q21 1 19 21 l0 12 q-4 -3 -4 -14 q-15 -6 -30 0 q0 11 -4 14z" fill="${hair}"/>`
    : `<path d="M32 44 q0 -18 18 -18 q18 0 18 18 q-6 -8 -18 -8 q-12 0 -18 8z" fill="${hair}"/>`;
  const svg = `
<svg viewBox="0 0 100 110" width="${size}" height="${size * 1.1}" class="avatar mood-${mood}" role="img" aria-label="${c.name}: ${MOOD_TEXT[mood]}">
  <g class="body">
    <rect x="26" y="70" width="48" height="34" rx="14" fill="#e9eef5" stroke="#9aa6b5" stroke-width="2"/>
    <rect x="26" y="78" width="48" height="7" fill="${suit}"/>
    <rect x="43" y="88" width="14" height="9" rx="2" fill="#5b6b80"/>
    <circle cx="47" cy="92.5" r="1.6" fill="#7dff9e"/><circle cx="53" cy="92.5" r="1.6" fill="${mood === 'enfermo' || mood === 'radiacion' ? '#ff4d4d' : '#ffd23d'}"/>
    <circle cx="50" cy="48" r="30" fill="#e9eef5" stroke="#9aa6b5" stroke-width="2.5"/>
    <circle cx="50" cy="48" r="24" fill="#16243a"/>
    <circle cx="50" cy="50" r="18" fill="${skin}"/>
    ${hairPath}
    ${sickTint}
    ${face(mood)}
    <path d="M36 32 q8 -6 16 -4" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>
    <rect x="44" y="16" width="12" height="5" rx="2" fill="${suit}"/>
    ${extras(mood)}
  </g>
</svg>`;
  const wrap = document.createElement('div');
  wrap.className = `avatar-wrap mood-${mood}`;
  wrap.style.animationDelay = `${-(k % 3000) / 1000}s`;
  wrap.innerHTML = svg;
  return wrap;
}

/** SVG de la guía (Control de Misión). mood: 'normal'|'feliz'|'alerta'|'pensando' */
export function guideSvg(mood = 'normal') {
  const mouth = mood === 'alerta' ? '<ellipse class="mouth" cx="50" cy="60" rx="5" ry="5" fill="#2a1010"/>'
    : mood === 'feliz' ? '<path class="mouth" d="M40 56 q10 12 20 0z" fill="#2a1010"/>'
      : '<path class="mouth" d="M42 57 q8 6 16 0" stroke="#2a1010" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  const brows = mood === 'alerta' ? '<path d="M35 38 l10 4 M65 38 l-10 4" stroke="#3a2416" stroke-width="2.6" stroke-linecap="round"/>'
    : mood === 'pensando' ? '<path d="M35 40 q5 -4 10 0 M55 37 q5 -2 10 1" stroke="#3a2416" stroke-width="2.4" fill="none" stroke-linecap="round"/>' : '';
  return `
<svg viewBox="0 0 100 120" class="guide-svg mood-${mood}" role="img" aria-label="Guía de Control de Misión">
  <g class="g-body">
    <path d="M22 118 q0 -30 28 -32 q28 2 28 32z" fill="#2c6fd6"/>
    <path d="M42 86 l8 10 8 -10" fill="#fff"/>
    <rect x="46" y="96" width="8" height="12" rx="2" fill="#ffb000"/>
    <g class="g-head">
      <path d="M26 46 q-2 -30 24 -32 q26 2 24 32 q2 18 -6 26 l-36 0 q-8 -8 -6 -26z" fill="#2a1a12"/>
      <circle cx="50" cy="50" r="21" fill="#e6b08a"/>
      <path d="M29 44 q4 -20 21 -20 q17 0 21 20 q-10 -10 -21 -10 q-11 0 -21 10z" fill="#2a1a12"/>
      ${brows}
      <g class="g-eyes"><circle cx="42" cy="48" r="3.4" fill="#1b1b1b"/><circle cx="58" cy="48" r="3.4" fill="#1b1b1b"/>
      <circle cx="43" cy="47" r="1" fill="#fff"/><circle cx="59" cy="47" r="1" fill="#fff"/></g>
      <circle cx="36" cy="55" r="3" fill="#ff8a8a" opacity=".45"/><circle cx="64" cy="55" r="3" fill="#ff8a8a" opacity=".45"/>
      ${mouth}
      <path d="M26 50 q0 -30 24 -30 q24 0 24 30" stroke="#333" stroke-width="3.5" fill="none"/>
      <rect x="20" y="44" width="9" height="14" rx="4" fill="#333"/><rect x="71" y="44" width="9" height="14" rx="4" fill="#333"/>
      <path d="M25 56 q2 12 16 10" stroke="#333" stroke-width="2.4" fill="none"/><circle cx="42" cy="66" r="2.6" fill="#ff4d4d"/>
    </g>
    <g class="g-arm"><path d="M76 100 q14 -6 16 -22" stroke="#2c6fd6" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="92" cy="76" r="5.5" fill="#e6b08a"/></g>
  </g>
</svg>`;
}
