// Cálculo y validación del diseño de la misión (determinista, sin azar).
import { MODULES, INSTRUMENTS, LAUNCHERS, ORBITS, CARGO, DIFFICULTY, SCENARIOS, GRID } from '../data/catalog.js';
import { ROLES } from '../data/crew.js';

const f1 = (n) => n.toFixed(1);
const suma = (lista, fn) => lista.reduce((s, e) => s + fn(e), 0);
const etiqueta = (id) => (id === 'soporte_vital' ? 'soporte vital' : id);

/** @param {import('./mission.js').Design} design */
export function computeDesign(design, scenarioId, difficulty, budgetMult = 1) {
  const mods = design.modules.map((m) => ({ placed: m, def: MODULES[m.type] })).filter((m) => m.def);
  const instr = design.instruments.map((id) => INSTRUMENTS[id]).filter(Boolean);
  const launcher = LAUNCHERS[design.launcher];
  const orbit = ORBITS[design.orbit];
  const diff = DIFFICULTY[difficulty];
  const crew = design.crewRoles.length;
  const errors = [];
  const warnings = [];

  const cargoMass = CARGO.massPerCrewDayT * crew * design.cargoDays;
  const cargoCost = CARGO.costPerCrewDay * crew * design.cargoDays;
  const mass = suma(mods, (m) => m.def.mass) + suma(instr, (i) => i.mass) + cargoMass;
  const cost = suma(mods, (m) => m.def.cost) + suma(instr, (i) => i.cost) + (launcher ? launcher.cost : 0) + cargoCost;
  const capacity = launcher && orbit ? launcher.capacity * orbit.factor : 0;
  const solar = orbit ? orbit.solarFraction : 1;
  const kwDe = (e, esModulo) => (esModulo && e.solar ? e.kw * solar : e.kw);
  const powerNet = suma(mods, (m) => kwDe(m.def, true)) + suma(instr, (i) => i.kw);
  const energyPerDay = powerNet * 24;
  const budget = diff.budget * budgetMult;
  const dataPerDay = suma(instr, (i) => i.dataPerDay);
  const sciencePerDay = suma(instr, (i) => i.sciencePerDay);
  const downlinkPerDay = suma(mods, (m) => m.def.downlink || 0);
  const cargoMax = CARGO.baseDays + suma(mods, (m) => m.def.cargoDays || 0);
  const crewMax = suma(mods, (m) => m.def.crewCapacity || 0);
  const slots = suma(mods, (m) => m.def.instrumentSlots || 0);

  const requeridos = (SCENARIOS[scenarioId] || SCENARIOS.estacion).requiredModules;
  for (const id of requeridos) {
    if (!mods.some((m) => m.placed.type === id)) errors.push(`Falta el módulo obligatorio: ${etiqueta(id)}`);
  }
  if (mass > capacity) errors.push(`La nave pesa ${f1(mass)} t y el cohete solo lleva ${f1(capacity)} t a esta órbita`);
  if (cost > budget) errors.push(`Te pasas del presupuesto por ${f1(cost - budget)} M`);
  if (energyPerDay < 0) errors.push(`La energía no alcanza: déficit de ${f1(-energyPerDay)} kWh por día`);
  if (instr.length > slots) errors.push('Hay más instrumentos que ranuras de laboratorio');
  if (design.hires) {
    const sin = design.crewRoles.filter((r) => !design.hires[r]);
    if (sin.length) errors.push(`Falta entrevistar y contratar: ${sin.map((r) => ROLES[r]?.name ?? r).join(', ')}`);
  }
  if (crew > crewMax) errors.push('Más tripulantes que camas (máx. 4 por cabina)');
  if (design.cargoDays > cargoMax) errors.push(`Carga de ${design.cargoDays} días supera la bodega (máx. ${cargoMax})`);

  const vistas = new Set();
  let repetida = false;
  let fuera = false;
  for (const { placed } of mods) {
    if (placed.x < 0 || placed.x >= GRID.cols || placed.y < 0 || placed.y >= GRID.rows) { fuera = true; continue; }
    const k = `${placed.x},${placed.y}`;
    if (vistas.has(k)) repetida = true;
    vistas.add(k);
  }
  if (repetida) errors.push('Dos módulos en la misma casilla');
  if (fuera) errors.push('Módulo fuera de la cuadrícula');

  if (dataPerDay > downlinkPerDay) {
    warnings.push(`Los datos generados (${f1(dataPerDay)} GB/día) superan el enlace (${f1(downlinkPerDay)} GB/día): se perderá ciencia`);
  }

  return { mass, capacity, powerNet, energyPerDay, cost, budget, dataPerDay, downlinkPerDay, sciencePerDay, cargoMax, crewMax, errors, warnings };
}

export function canLaunch(result) {
  return result.errors.length === 0;
}
