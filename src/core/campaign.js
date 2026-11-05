// Campaña (estación → Luna → Marte) y árbol de mejoras que se compran con puntos de las misiones.
export const ORDER = ['estacion', 'luna', 'marte'];
const KEY = 'vdl.campaign';

/** Árbol de mejoras. `req`: mejora que hay que tener antes. */
export const UPGRADES = {
  paneles_eficientes: { id: 'paneles_eficientes', icon: '☀️', name: 'Paneles más eficientes', desc: 'Los paneles dan 20 % más electricidad.', cost: 30, req: null, earth: 'Las celdas solares de varias capas nacieron para el espacio y hoy mejoran los paneles de las casas.' },
  trajes_nuevos: { id: 'trajes_nuevos', icon: '🧑‍🚀', name: 'Trajes espaciales nuevos', desc: '+1 en todas las salidas al exterior (EVA).', cost: 30, req: null, earth: 'Los materiales de los trajes inspiraron ropa para bomberos y deportistas.' },
  modulos_ligeros: { id: 'modulos_ligeros', icon: '🪶', name: 'Módulos más livianos', desc: 'Todos los módulos pesan 10 % menos.', cost: 30, req: null, earth: 'Los materiales compuestos livianos hoy se usan en autos, bicicletas y aviones.' },
  reciclador_99: { id: 'reciclador_99', icon: '♻️', name: 'Reciclador de agua al 99 %', desc: 'Se pierde la mitad de agua al reciclar.', cost: 60, req: 'paneles_eficientes', earth: 'Los filtros de agua de la estación se usan en zonas sin agua potable.' },
  medicina_avanzada: { id: 'medicina_avanzada', icon: '💉', name: 'Medicina a distancia', desc: 'El médico cura 50 % más.', cost: 60, req: 'trajes_nuevos', earth: 'La telemedicina lleva doctores a pueblos alejados.' },
  cohete_reutilizable: { id: 'cohete_reutilizable', icon: '♻️🚀', name: 'Cohete reutilizable', desc: 'Los cohetes cuestan 25 % menos.', cost: 60, req: 'modulos_ligeros', earth: 'Reutilizar cohetes abarata subir satélites de internet y clima.' },
  radar_profundo: { id: 'radar_profundo', icon: '📡', name: 'Alerta temprana', desc: 'Todos los avisos llegan 1 día antes.', cost: 100, req: 'reciclador_99', earth: 'Los satélites de alerta temprana avisan de huracanes y tormentas solares.' },
  escudo_mejorado: { id: 'escudo_mejorado', icon: '🛡️', name: 'Escudo térmico mejorado', desc: 'La mitad de riesgo en la reentrada.', cost: 100, req: 'medicina_avanzada', earth: 'Los materiales que aguantan calor extremo protegen hornos y motores.' },
  impresion_3d: { id: 'impresion_3d', icon: '🖨️', name: 'Impresora 3D a bordo', desc: 'Empiezas con 15 piezas de repuesto más.', cost: 100, req: 'cohete_reutilizable', earth: 'Imprimir repuestos en el lugar ahorra viajes y basura.' },
  isru_mejorado: { id: 'isru_mejorado', icon: '⛽', name: 'Planta de combustible mejorada', desc: 'La planta de Marte fabrica 50 % más.', cost: 140, req: 'impresion_3d', earth: 'Convertir CO₂ en combustible podría ayudar a frenar el cambio climático.' },
};

/** ¿Tiene la mejora? Acepta un estado de misión o un diseño. */
export const hasUpgrade = (x, id) => (x?.upgrades ?? x?.design?.upgrades ?? []).includes(id);

export const newCampaign = () => ({ unlocked: ['estacion'], completed: {}, points: 0, upgrades: [], recorded: [] });

export function loadCampaign(storage = globalThis.localStorage) {
  try {
    const c = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (c && Array.isArray(c.unlocked)) return { ...newCampaign(), ...c };
  } catch { /* corrupto */ }
  return newCampaign();
}

export function saveCampaign(camp, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(camp)); } catch { /* sin espacio */ }
}

export const canPlay = (camp, scenarioId) => camp.unlocked.includes(scenarioId);

/** Puntos que da una misión. */
export function pointsFor(report) {
  if (!report.success) return Math.floor(report.science / 40);
  const medal = { oro: 30, plata: 15, bronce: 5 }[report.medal] ?? 0;
  return 20 + medal + Math.floor(report.science / 20);
}

/** Registra el resultado una sola vez (id) y desbloquea el siguiente destino si se cumplió. */
export function recordResult(camp, id, scenarioId, report) {
  if (camp.recorded.includes(id)) return { camp, points: 0, unlockedNow: null };
  const c = structuredClone(camp);
  const points = pointsFor(report);
  c.points += points;
  c.recorded = [...c.recorded, id].slice(-50);
  let unlockedNow = null;
  if (report.success) {
    const prev = c.completed[scenarioId];
    if (!prev || report.score > prev.score) c.completed[scenarioId] = { score: report.score, medal: report.medal };
    const next = ORDER[ORDER.indexOf(scenarioId) + 1];
    if (next && !c.unlocked.includes(next)) { c.unlocked.push(next); unlockedNow = next; }
  }
  return { camp: c, points, unlockedNow };
}

export function canBuy(camp, id) {
  const u = UPGRADES[id];
  if (!u || camp.upgrades.includes(id)) return false;
  if (u.req && !camp.upgrades.includes(u.req)) return false;
  return camp.points >= u.cost;
}

export function buyUpgrade(camp, id) {
  if (!canBuy(camp, id)) return camp;
  const c = structuredClone(camp);
  c.points -= UPGRADES[id].cost;
  c.upgrades.push(id);
  return c;
}
