// Dibujos de línea propios (estilo consola) y códigos cortos para reemplazar emojis.

/** Código de consola de cada módulo (como las siglas de los sistemas reales). */
export const MOD_CODE = {
  cabina: 'CAB', soporte_vital: 'ECLSS', paneles: 'SOL', baterias: 'BAT', refugio: 'REF', laboratorio: 'LAB', invernadero: 'INV',
  enfermeria: 'MED', taller: 'TALL', bodega: 'BOD', radar: 'RAD', antena: 'ANT', brazo: 'BRAZO', desplegador: 'CUBE',
  modulo_aterrizaje: 'LANDER', pila_regenerativa: 'PILA', reactor: 'FISIÓN', extractor_hielo: 'HIELO', rover: 'ROVER', rover_autonomo: 'ROBOT', planta_combustible: 'ISRU',
};
export const RES_CODE = { o2: 'O₂', water: 'H₂O', food: 'ALIM', meds: 'MED', parts: 'PZA', fuel: 'COMB', battery: 'BAT', dataStored: 'DATOS' };
export const NODE_CODE = { base: 'B', crater_hielo: 'H', crater: 'C', cueva: 'T', roca: 'R', sonda: 'S', mirador: 'M', peligro: '!', pico: 'L', delta: 'D' };
export const DEST_CODE = { estacion: 'ISS', gateway: 'GTWY', luna: 'LUNA', marte: 'MARTE' };

const svg = (body, vb = '0 0 40 40', cls = '') => `<svg class="art ${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

export const ART = {
  cohete: svg('<path d="M20 3 C26 9 27 18 26 27 L14 27 C13 18 14 9 20 3 Z"/><circle cx="20" cy="14" r="3"/><path d="M14 22 L8 30 L14 28 M26 22 L32 30 L26 28"/><path d="M17 27 L18 33 M23 27 L22 33"/>', '0 0 40 40', 'cohete'),
  capsula: svg('<path d="M12 30 L16 10 L24 10 L28 30 Z"/><path d="M14 22 L26 22"/><circle cx="20" cy="16" r="2"/><path d="M11 30 Q20 35 29 30"/>'),
  estacion: svg('<rect x="15" y="16" width="10" height="8"/><path d="M4 12 L14 12 L14 28 L4 28 Z M26 12 L36 12 L36 28 L26 28 Z"/><path d="M4 20 L14 20 M26 20 L36 20 M9 12 L9 28 M31 12 L31 28"/><path d="M20 16 L20 10"/>'),
  luna: svg('<circle cx="20" cy="20" r="14"/><circle cx="15" cy="15" r="3"/><circle cx="24" cy="24" r="4"/><circle cx="25" cy="13" r="1.5"/>'),
  marte: svg('<circle cx="20" cy="20" r="14"/><path d="M8 16 Q16 20 24 15 Q30 12 33 16"/><path d="M9 25 Q18 28 30 24"/><circle cx="22" cy="20" r="1.5"/>'),
  tierra: svg('<circle cx="20" cy="20" r="14"/><path d="M12 10 Q16 16 12 20 Q10 24 14 28 M24 8 Q22 14 27 17 Q32 20 30 26"/>'),
};

export const destArt = (scenarioId) => ART[{ estacion: 'estacion', luna: 'luna', marte: 'marte' }[scenarioId] ?? 'estacion'];

/** Nodo HTML con un dibujo. */
export function art(name) {
  const span = document.createElement('span');
  span.className = 'art-wrap';
  span.innerHTML = ART[name] ?? '';
  return span;
}
