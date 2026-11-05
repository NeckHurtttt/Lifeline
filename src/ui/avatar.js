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
    case 'hambre': return '<g class="thought"><circle cx="76" cy="22" r="9" fill="#fff" opacity=".9"/><circle cx="76" cy="23.5" r="4" fill="#d94b3b"/><path d="M76 19.5 q1 -2 3 -2" stroke="#3b7a2a" stroke-width="1.4" fill="none"/></g>';
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
