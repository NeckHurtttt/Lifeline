# Ventana de Lanzamiento — Capa 1 (núcleo + estación) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juego de navegador jugable de la misión a la estación espacial: diseño de misión, despegue real, 1 año de supervivencia con tripulación y labores, eventos, desastres, minimisiones, energía, reentrada e informe final. Cooperativo local de 1 a 4 jugadores. Para NASA Space Apps 2026, desafío *Space Mission Design Game*.

**Architecture:** Lógica pura en `src/core/` (sin DOM, determinista con semilla, probada con `node --test`). Datos del juego en `src/data/` como módulos ES. Interfaz retro de consola en `src/ui/` que solo lee el estado y llama funciones del core. Sin build: `index.html` carga módulos ES y se sirve con `python3 -m http.server`.

**Tech Stack:** HTML + CSS + JavaScript ES modules, Node 26 (`node --test`, `node:assert/strict`), WebAudio para sonido, localStorage para guardado, API DONKI de NASA (api.nasa.gov) con respaldo local.

**Spec:** `~/Documentos/Proyecto-Nasa/Recopilación completa.md` + `~/Documentos/Proyecto-Nasa/Definiciones.md` (bóveda Obsidian). Las capas 2 (Luna), 3 (Marte) y 4 (campaña + árbol tecnológico + exploración por nodos) tienen planes propios después de este.

## Global Constraints

- Todo el texto del juego en español.
- Nombre público: **Ventana de Lanzamiento**. Nunca usar logo, nombre ni marca NASA como si fuera oficial; agencia ficticia. Créditos: "Inspirado en procedimientos y datos abiertos de NASA".
- Nombres de cohetes, naves y personas inventados (nada de Falcon, Soyuz, Dragon, Canadarm).
- Victoria = al menos un tripulante vuelve vivo tras 365 días; la ciencia da puntos extra. Si mueren todos o la misión se aborta sin regreso, misión fallida (muerte permanente, sin recargar).
- Guardado: autoguardado diario en **una sola ranura** de localStorage (`vdl.save`), sin opción de cargar una ranura anterior.
- Dificultad: `facil` | `medio` | `dificil` en todo; desastres con gravedad `leve` | `media` | `grave`.
- Consumo por persona y día: O₂ 0,84 kg; agua 2,75 L; comida 1,8 kg; CO₂ 1,0 kg. Reciclaje de agua 98 % con soporte vital encendido.
- Horario real: sueño 8,5 h, trabajo ~6,5 h, ejercicio 2 h; en el juego, 3 turnos al día y dormir al menos 1 turno es obligatorio.
- Límite de radiación de carrera: 600 mSv.
- Estación: eclipse cada ~90 min con 45 min de sombra → fracción solar 0,5.
- Toda la lógica de `src/core/` es determinista dado `seed`; prohibido `Math.random()` en el core.
- Sin dependencias npm. Estilo visual: consola de control retro (verde/ámbar sobre negro, monoespaciada).
- Modo demo: misión de 365 días que avanza por saltos y se detiene solo con aviso, evento, minimisión o decisión; una partida completa debe poder jugarse en ~10 min.

## Review Focus

1. **Recursos que llegan a cero a mitad de día:** nunca valores negativos; el recurso queda en 0 y se aplica el daño por carencia (test en Task 5).
2. **Todos los tripulantes muertos durante un salto de días:** la simulación debe detenerse ese día y marcar la misión como fallida, no seguir saltando (test en Task 13).
3. **Diseño inválido que intenta lanzar** (masa sobre la capacidad, sin cabina, presupuesto negativo, energía negativa): el botón de lanzar queda bloqueado y se muestran las razones (test en Task 3).
4. **Sin conexión a internet:** la API DONKI falla o tarda; el juego usa el respaldo local sin bloquearse (test en Task 10).
5. **Guardado corrupto o de otra versión en localStorage:** se descarta y se empieza de cero sin romper la carga (test en Task 14).

---

## Estructura de archivos

```
index.html                  entrada, carga src/ui/main.js
styles/console.css          estilo de consola retro
package.json                {"type":"module","scripts":{"test":"node --test tests/"}}
src/core/rng.js             RNG con semilla
src/core/design.js          totales y validación del diseño
src/core/mission.js         creación del estado de misión
src/core/life.js            consumo diario y necesidades de la tripulación
src/core/energy.js          balance de energía y apagado por prioridad
src/core/tasks.js           labores y su producción
src/core/events.js          programador de eventos, avisos y resolución
src/core/minimissions.js    ofertas y resolución de minimisiones
src/core/realdata.js        DONKI + respaldo → tormentas solares reales
src/core/launch.js          secuencia de despegue
src/core/reentry.js         secuencia de reentrada
src/core/sim.js             avance de días, interrupciones, fin de misión
src/core/report.js          informe post-misión
src/core/save.js            autoguardado de una ranura
src/data/catalog.js         módulos, instrumentos, cohetes, órbitas, dificultad, escenarios
src/data/crew.js            roles, nombres, rasgos
src/data/events.js          eventos y desastres de la estación
src/data/minimissions.js    minimisiones de la estación
src/data/donki-snapshot.js  respaldo de fulguraciones reales
src/data/lessons.js         lecciones para la Tierra y fichas educativas
src/ui/main.js              router de pantallas, estado global, jugadores/roles
src/ui/audio.js             sonidos WebAudio
src/ui/screens/title.js     menú: modo, dificultad, jugadores
src/ui/screens/design.js    diseño de la nave
src/ui/screens/launch.js    despegue
src/ui/screens/ops.js       operaciones diarias
src/ui/screens/reentry.js   reentrada
src/ui/screens/report.js    informe final
tests/core/*.test.js        pruebas del core
```

### Tipos compartidos (JSDoc en `src/core/mission.js`)

```js
/** @typedef {'facil'|'medio'|'dificil'} Difficulty */
/** @typedef {'leve'|'media'|'grave'} Severity */
/** @typedef {{id:string, type:string, x:number, y:number, health:number, on:boolean, priority:number}} PlacedModule */
/** @typedef {{modules:PlacedModule[], instruments:string[], launcher:string, orbit:string, crewRoles:string[], cargoDays:number}} Design */
/** @typedef {{fuerza:number, tecnica:number, ciencia:number, medicina:number, temple:number}} Stats */
/** @typedef {{id:string, name:string, role:string, stats:Stats, traits:string[], health:number, fatigue:number,
 *   morale:number, radiation:number, bone:number, hunger:number, thirst:number, alive:boolean, onEva:boolean}} Crew */
/** @typedef {{o2:number, water:number, food:number, meds:number, parts:number, fuel:number,
 *   battery:number, batteryMax:number, dataStored:number}} Resources */
/** @typedef {{eventId:string, etaDays:number, severity:Severity, prepared:string[]}} Alert */
/** @typedef {{seed:number, rng:number, day:number, totalDays:number, difficulty:Difficulty, scenarioId:string,
 *   phase:'design'|'launch'|'ops'|'reentry'|'report', design:Design, resources:Resources, modules:PlacedModule[],
 *   crew:Crew[], schedule:Object<string,string[]>, rations:Object<string,'completa'|'media'|'nada'>,
 *   alerts:Alert[], pending:Object|null, history:{day:number,o2:number,water:number,food:number,battery:number}[], minis:Object[], science:number, reputation:number,
 *   nextResupply:number, log:{day:number,text:string,kind:string}[], outcome:null|{success:boolean, reason:string}}} MissionState */
```

Todos los valores de crew (`health`, `fatigue`, `morale`, `bone`, `hunger`, `thirst`) y `health` de módulos están en 0–100. `radiation` en mSv acumulados.

---

### Task 1: Proyecto base y RNG con semilla

**Files:**
- Create: `package.json`, `.gitignore`, `src/core/rng.js`
- Test: `tests/core/rng.test.js`

**Interfaces:**
- Produces: `createRng(seed:number) -> {next():number /*[0,1)*/, int(min,max):number /*inclusive*/, pick(arr):any, chance(p):boolean, state():number}`; `restoreRng(state:number) -> mismo objeto`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { createRng, restoreRng } from '../../src/core/rng.js';
test('misma semilla, misma secuencia', () => {
  const a = createRng(42), b = createRng(42);
  assert.deepEqual([a.next(), a.next(), a.int(1, 6)], [b.next(), b.next(), b.int(1, 6)]);
});
test('int dentro del rango inclusive', () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r.int(3, 5); assert.ok(v >= 3 && v <= 5); }
});
test('restoreRng continúa la secuencia', () => {
  const a = createRng(7); a.next(); const s = a.state();
  const b = restoreRng(s); assert.equal(a.next(), b.next());
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npm test` · Expected: FAIL, cannot find module `rng.js`.
- [ ] **Step 3: Implement** `package.json` (`{"name":"ventana-de-lanzamiento","type":"module","scripts":{"test":"node --test tests/"}}`), `.gitignore` (`node_modules/`), y `rng.js` con mulberry32 sobre un entero de 32 bits; `state()` devuelve ese entero.
- [ ] **Step 4: Run test to verify it passes** — Run: `npm test` · Expected: 3 pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: proyecto base y rng con semilla"`

---

### Task 2: Catálogo de datos

**Files:**
- Create: `src/data/catalog.js`, `src/data/crew.js`
- Test: `tests/core/catalog.test.js`

**Interfaces:**
- Produces: `MODULES`, `INSTRUMENTS`, `LAUNCHERS`, `ORBITS`, `DIFFICULTY`, `SCENARIOS`, `GRID` exportados de `catalog.js`; `ROLES`, `NAMES`, `TRAITS` de `crew.js`. Todos objetos indexados por `id` (salvo `NAMES`, arreglo de strings, y `GRID = {cols:6, rows:4}`).

Valores fijados (masa en t, potencia en kW: positivo produce, negativo consume; costo en millones):

| Módulo `id` | masa | kW | costo | efecto |
|---|---|---|---|---|
| `cabina` (obligatorio) | 8 | −2 | 100 | aloja 4 tripulantes; enlace base 10 GB/día |
| `soporte_vital` (obligatorio) | 6 | −3 | 120 | produce O₂ desde agua, filtra CO₂, recicla agua 98 % |
| `paneles` | 2 | +12 (×fracción solar) | 40 | — |
| `baterias` | 1.5 | 0 | 30 | +60 kWh de capacidad |
| `refugio` | 7 | −0.5 | 90 | refugio de radiación y de impactos |
| `laboratorio` | 5 | −3 | 80 | necesario para instrumentos; 3 ranuras |
| `invernadero` | 4 | −4 | 60 | 1,5 kg comida/día si alguien lo atiende |
| `enfermeria` | 3 | −1 | 50 | eficacia médica ×2 |
| `taller` | 3 | −1 | 40 | reparación ×1,5 |
| `bodega` | 2 | 0 | 20 | +60 días de carga |
| `radar` | 1 | −0.5 | 35 | avisos +2 días; detecta basura |
| `antena` | 1 | −1 | 30 | enlace +50 GB/día |
| `brazo` | 2 | −0.5 | 60 | necesario para capturas |
| `desplegador` | 0.5 | 0 | 15 | necesario para cubesats |

| Instrumento `id` | masa | kW | costo | GB/día | ciencia/día |
|---|---|---|---|---|---|
| `camara_tierra` | 0.3 | −0.2 | 10 | 20 | 2 |
| `espectrometro` | 0.5 | −0.5 | 25 | 15 | 4 |
| `cristales` | 0.4 | −0.6 | 20 | 5 | 3 |
| `bio_celulas` | 0.6 | −0.8 | 30 | 8 | 5 |
| `rayos_cosmicos` | 0.8 | −0.4 | 35 | 25 | 6 |
| `plantas_microg` | 0.5 | −0.7 | 15 | 3 | 2 (+0,2 kg comida/día) |

| Cohete `id` | nombre | capacidad a órbita baja (t) | costo | fiabilidad |
|---|---|---|---|---|
| `condor1` | Cóndor-1 | 25 | 60 | 0.97 |
| `condorH` | Cóndor-H | 60 | 120 | 0.95 |
| `quetzal5` | Quetzal-5 | 100 | 250 | 0.93 |

| Órbita `id` | nombre | factor de capacidad | fracción solar | explicación corta |
|---|---|---|---|---|
| `leo_estacion` | Órbita baja 400 km, 51,6° | 1.0 | 0.5 | la de la estación; basura espacial media |
| `sso` | Heliosíncrona 600 km | 0.8 | 0.65 | ideal para observar la Tierra |
| `geo` | Geoestacionaria 35 786 km | 0.35 | 0.99 | cobertura fija, mucha radiación |

Carga: cada día de carga pesa `crew × (0,84 + 1,8 + 0,1) / 1000` t y cuesta `0,05` M por tripulante-día. Capacidad base de carga: 90 días + 60 por `bodega`.

| `DIFFICULTY` | facil | medio | dificil |
|---|---|---|---|
| `budget` | 1300 | 1100 | 950 |
| `reserveBonus` | 0.5 | 0.2 | 0 |
| `warningMult` | 1.5 | 1 | 0.5 |
| `falseAlarm` | 0 | 0.05 | 0.15 |
| `disasterRate` (prob./día) | 0.01 | 0.02 | 0.035 |
| `severityWeights` [leve,media,grave] | [0.7,0.25,0.05] | [0.4,0.4,0.2] | [0.2,0.4,0.4] |
| `repairMult` | 1.5 | 1 | 0.7 |
| `deathAllowed` | false (se evacúa al llegar a 0 de salud) | true | true |
| `control` | 'resuelve' | 'aconseja' | 'retraso' |
| `launchMode` | 'auto' | 'pausas' | 'manual' |

`SCENARIOS.estacion = {id:'estacion', name:'Estación espacial: un año en órbita', orbit:'leo_estacion', days:365, resupplyEvery:60, requiredModules:['cabina','soporte_vital'], minScience:0}`.
`ROLES`: `comandante`, `piloto`, `ingeniero`, `medico`, `cientifico`, `biologo`, cada uno con la stat principal en 7–9 y el resto en 2–6. `TRAITS`: 6 positivos (`manos_firmes` +2 técnica en reparar, `atleta` −50 % pérdida ósea, `sereno` −50 % pérdida de moral, `ojo_cientifico` +20 % ciencia, `frugal` −20 % comida, `resistente` −20 % radiación) y 6 negativos (`claustrofobico` −1 moral/día extra, `gloton` +20 % comida, `insomne` +fatiga, `torpe` +10 % fallo en EVA, `ansioso` −moral en alertas, `fragil` +20 % daño de salud). `NAMES`: 24 nombres hispanos e internacionales inventados.

- [ ] **Step 1: Write the failing test** — `catalog.test.js`: cada módulo, instrumento, cohete y órbita tiene `id` igual a su clave y números finitos; `MODULES.cabina.required === true`; `Object.keys(DIFFICULTY)` es `['facil','medio','dificil']`; suma de cada `severityWeights` es 1 (tolerancia 1e-9); `ROLES` tiene los 6 roles; `TRAITS` tiene 6 con `positive:true` y 6 con `positive:false`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL, módulo inexistente.
- [ ] **Step 3: Implement** los dos archivos con exactamente los valores de las tablas.
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: catálogo de módulos, instrumentos, cohetes, órbitas y dificultad"` (después de `git add src/data tests`).

---

### Task 3: Cálculo y validación del diseño

**Files:**
- Create: `src/core/design.js`
- Test: `tests/core/design.test.js`

**Interfaces:**
- Consumes: catálogo (Task 2).
- Produces: `computeDesign(design:Design, scenarioId:string, difficulty:Difficulty) -> {mass, capacity, powerNet, energyPerDay, cost, budget, dataPerDay, downlinkPerDay, sciencePerDay, cargoMax, crewMax, errors:string[], warnings:string[]}`; `canLaunch(result) -> boolean` (true si `errors.length === 0`).

Reglas: `capacity = LAUNCHERS[l].capacity × ORBITS[o].factor`; `energyPerDay = Σ(kW positivos × fracción solar × 24) + Σ(kW negativos × 24)`; `powerNet` igual pero en kW. Errores (texto exacto): `"Falta el módulo obligatorio: cabina"`, `"Falta el módulo obligatorio: soporte vital"`, `"La nave pesa X t y el cohete solo lleva Y t a esta órbita"`, `"Te pasas del presupuesto por X M"`, `"La energía no alcanza: déficit de X kWh por día"`, `"Hay más instrumentos que ranuras de laboratorio"`, `"Más tripulantes que camas (máx. 4 por cabina)"`, `"Carga de X días supera la bodega (máx. Y)"`, `"Dos módulos en la misma casilla"`, `"Módulo fuera de la cuadrícula"`. Aviso (no bloquea): `"Los datos generados (X GB/día) superan el enlace (Y GB/día): se perderá ciencia"`. Números con 1 decimal.

- [ ] **Step 1: Write the failing test** — casos: diseño mínimo válido (cabina, soporte_vital, 1 paneles, 1 baterias, condor1, leo_estacion, 4 roles, 90 días) → `canLaunch` true; sin cabina → error exacto; `quetzal5` + `geo` con 40 t → error de masa contiene `"35.0 t"`; 3 instrumentos sin laboratorio → error de ranuras; 2 cámaras + solo enlace base → warning de datos; dos módulos en (0,0) → error de casilla.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement** `computeDesign` y `canLaunch`.
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: cálculo y validación del diseño"`

---

### Task 4: Tripulación y creación de la misión

**Files:**
- Create: `src/core/mission.js` (incluye los typedef de arriba)
- Test: `tests/core/mission.test.js`

**Interfaces:**
- Consumes: `createRng`, catálogo, `computeDesign`.
- Produces: `generateCrew(roles:string[], rng) -> Crew[]` (id `c1..cN`, nombre único de `NAMES`, 1 rasgo positivo + 1 negativo, salud/moral 100, fatiga 0, hueso 100, hambre/sed 0, radiación 0); `createMission({design, scenarioId, difficulty, seed}) -> MissionState`.

`createMission`: `phase:'launch'`, `day:0`, `totalDays:365`; recursos = días de carga × consumo × tripulantes × `(1 + reserveBonus)`, más `meds: 20 × crew`, `parts: 30`, `fuel: 100`, `batteryMax: 60 × baterías`, `battery = batteryMax`, `dataStored: 0`; agua inicial = consumo neto con reciclaje (2,75 × 0,02) × días + 500 L de colchón; `schedule` por defecto `['trabajo','ejercicio','sueño']` por tripulante; raciones `completa`; `nextResupply: 60`; `reputation: 50`; `rng` = estado del RNG.

- [ ] **Step 1: Write the failing test** — misma semilla → mismos nombres; 4 roles → 4 tripulantes con nombres distintos; `medio` con 90 días y 4 tripulantes → `food ≈ 90 × 1.8 × 4 × 1.2` (±0,01); `facil` da más comida que `dificil` con el mismo diseño; `schedule.c1` incluye `'sueño'`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: generación de tripulación y misión"`

---

### Task 5: Vida diaria (consumo y necesidades)

**Files:**
- Create: `src/core/life.js`
- Test: `tests/core/life.test.js`

**Interfaces:**
- Consumes: `MissionState`.
- Produces: `applyDailyLife(state, ctx:{lifeSupportOn:boolean, sheltered:boolean, exercised:Set<string>, slept:Set<string>}) -> {state, log:string[]}` (devuelve un estado nuevo, no muta).

Reglas por tripulante vivo y ración (`completa` 1, `media` 0,5, `nada` 0): consume comida 1,8 × ración (×1,2 `gloton`, ×0,8 `frugal`), agua 2,75 × ración y O₂ 0,84. Con soporte vital encendido, el agua neta es el 2 % del consumo y el O₂ sale del agua (0,84 kg de O₂ ≈ 0,95 L de agua); apagado, el O₂ baja del tanque y el agua no se recicla. Hambre +35 × (1 − ración) y sed igual; con ración completa ambas bajan 30. Si el recurso no alcanza: queda en 0 y el faltante cuenta como ración 0 para todos. Hambre o sed ≥ 100 → salud −15/día. O₂ en 0 → salud −40/día. Sin ejercicio → hueso −0,5/día (`atleta` −0,25). Sin dormir → fatiga +40; durmiendo, −35. Fatiga ≥ 80 → moral −5. Moral baja 1/día base (`claustrofobico` +1) y +3 con ración completa y sueño. Radiación +0,5 mSv/día (×0,2 si `sheltered`). Salud ≤ 0 → `alive:false` y log `"X ha muerto"`; en `facil` (`deathAllowed:false`) → evacuado: `alive:false, evacuated:true` con log `"X fue evacuado a la Tierra"`. Clampear todo a 0–100.

- [ ] **Step 1: Write the failing test** — 1 día con 4 tripulantes, raciones completas y soporte vital → comida −7,2; agua ≈ −(2,75 × 4 × 0,02 + 0,95 × 4) (±0,01); comida 3 kg y 4 tripulantes → `food === 0` y hambre sube para todos (**Review Focus 1**: nunca negativo); O₂ 0 y soporte vital apagado dos días → salud ≤ 20; sin ejercicio 10 días → hueso 95; `facil` con salud 1 y O₂ 0 → evacuado, no muerto.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: consumo diario y necesidades de la tripulación"`

---

### Task 6: Energía

**Files:**
- Create: `src/core/energy.js`
- Test: `tests/core/energy.test.js`

**Interfaces:**
- Produces: `applyEnergy(state, {solarFactor:number}) -> {state, shed:string[], log:string[]}`. `solarFactor` multiplica la fracción solar de la órbita (1 normal, 0 en modo seguro de tormenta). Apaga módulos `on:true` de menor a mayor `priority` (1 = se apaga primero) hasta que el balance más la batería alcance; `cabina` y `soporte_vital` se apagan últimos. Módulos con `health < 30` producen o consumen la mitad. `setPriority(state, moduleId, priority) -> state`.

- [ ] **Step 1: Write the failing test** — 1 panel + cabina + soporte vital en `leo_estacion`: balance diario = 12 × 0,5 × 24 − 5 × 24 = 24 kWh, la batería sube hasta `batteryMax`; con `solarFactor:0` y batería 60 → apaga primero el módulo de prioridad 1; con batería vacía y déficit total, `soporte_vital` es el último de `shed`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: balance de energía y apagado por prioridad"`

---

### Task 7: Labores

**Files:**
- Create: `src/core/tasks.js`
- Test: `tests/core/tasks.test.js`

**Interfaces:**
- Produces: `TASKS` (id → `{name, stat, needsModule|null}`); `applyTasks(state, rng) -> {state, ctx:{exercised:Set, slept:Set, sheltered:boolean}, log:string[]}`; `validateSchedule(schedule) -> string[]` (error `"X no tiene turno de sueño"` por tripulante sin `'sueño'`).

Labores (id: stat, efecto por turno × eficiencia): `mantenimiento` (técnica): +3 salud al módulo más dañado; `reparacion` (técnica, gasta 2 piezas): +15 salud × `repairMult` (×1,5 con `taller`); `trabajo`/`experimentos` (ciencia, `laboratorio`): ciencia y datos de los instrumentos encendidos repartidos por turno; `cultivo` (ciencia, `invernadero`): +1,5 kg comida; `produccion` (técnica): +3 L agua de condensado; `medico` (medicina, gasta 1 medicina): +15 salud y −5 mSv al más dañado (×2 con `enfermeria`); `ejercicio`: marca `exercised`; `descanso`: fatiga −20, moral +5; `sueño`: marca `slept`; `comunicacion` (temple): moral +8 al que la hace y +3 al resto; envía datos; `eva` (fuerza+temple)/2: hace la reparación externa pendiente, radiación +1 mSv, fallo con probabilidad `0.08 − 0.005 × stat` (+0,1 `torpe`) → salud −20; `refugio`: marca `sheltered`. Eficiencia = `stat/7`, ×0,6 si la stat principal del rol es otra. Fatiga +10 por turno de trabajo. Datos: `dataStored` += generados; bajada diaria = `min(dataStored, downlinkPerDay)` → ciencia `+= bajados × 0.1`; lo que exceda `dataStored > 500` GB se pierde con log `"Se perdieron X GB de datos: falta enlace"`.

- [ ] **Step 1: Write the failing test** — `validateSchedule({c1:['trabajo','trabajo','trabajo']})` devuelve el error exacto; un ingeniero con técnica 8 en `reparacion` con taller sube la salud del módulo en `15 × 1.5 × 8/7` en `medio`; cultivo sin invernadero no produce; `ejercicio` aparece en `ctx.exercised`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: labores de la tripulación"`

---

### Task 8: Eventos y desastres

**Files:**
- Create: `src/data/events.js`, `src/core/events.js`
- Test: `tests/core/events.test.js`

**Interfaces:**
- Produces (data): `EVENTS` (id → `{name, kind:'+'|'-'|'±', disaster:boolean, warnDays:number /*0 = sin aviso*/, weight:number, text:{leve,media,grave}, prepare:[{id,label,cost:{...}}], options:[{id,label,check?:{stat,dc}, cost?, effects:{leve,media,grave}}], chain?:string[]}`).
- Produces (core): `rollEvents(state, rng) -> state` (agrega `alerts` con `etaDays = round(warnDays × warningMult)`, +2 con `radar`; falsas alarmas según `falseAlarm`); `tickAlerts(state, rng) -> {state, triggered:{eventId,severity}|null}`; `prepareFor(state, alertIdx, prepId) -> state`; `resolveEvent(state, eventId, severity, optionId, rng) -> {state, log}`; `applyEffects(state, effects) -> state` con claves de efecto: `o2, water, food, meds, parts, fuel, battery, science, reputation, crewHealth, crewMorale, crewRadiation, moduleDamage:{type|'random':n}, moduleOff:{type:days}, delayResupply:days, endMission:'evacuar'`.

Eventos de la estación (ids; los de desastre con `disaster:true` y gravedad según `severityWeights`): `micrometeoritos`(−, aviso 1), `basura_tardia`(−, 0), `tormenta_solar`(−, 2), `carga_a_tiempo`(+, 0), `carga_explota`(−, 0), `captura_brazo`(±, 0), `fuga_amoniaco`(−, 0, desastre), `incendio`(−, 0, desastre), `robot_detecta_fuga`(+, 0), `fuga_misteriosa`(−, 0), `experimento_exitoso`(+, 0), `aurora`(+, 0), `radio_escuelas`(+, 0), `falla_bano`(−, 0), `bacterias`(−, 0), `nueva_tripulacion`(±, 0), `reboost`(±, 1). Desastres de nave: `tanque_o2`, `choque_carga`, `propulsor_atascado`, `falla_computadora`, `perdida_comunicacion`, `fuga_reciclador`, `sobrecalentamiento`, `falla_bateria`, `panel_danado`, `corto_circuito`, cada uno con las tres gravedades de la nota *Desastres de naves* y *Energía* del spec. Valores de efecto por gravedad: leve = −5 a −10 en el recurso o módulo afectado; media = −20 a −30 o módulo apagado 3–5 días; grave = −50 o más, módulo perdido o `endMission:'evacuar'` (solo `incendio`, `choque_carga` y `tanque_o2` graves). Cadenas: `tormenta_solar → panel_danado` (0,3); `carga_explota → falla_bano` no; `incendio → bacterias` (0,2); `choque_carga → fuga_misteriosa` (0,5). Preparaciones: `tormenta_solar` y `micrometeoritos` → `refugio` (todos con labor refugio ese día) y `modo_seguro` (solarFactor 0 ese día); `reboost` → gastar 10 de combustible o no. `control:'resuelve'` en fácil elige automáticamente la opción recomendada (`options[0]`).

Resupply: cada `resupplyEvery` días se fuerza `carga_a_tiempo` salvo que salga `carga_explota` (prob. 0,1 / 0,15 / 0,2 por dificultad) y `delayResupply` lo empuja 30 días. Carga a tiempo suma 60 días de comida/agua/O₂ y 20 piezas.

- [ ] **Step 1: Write the failing test** — todos los ids de la lista existen en `EVENTS` con `text.leve/media/grave`; con `warningMult` 0,5, `tormenta_solar` llega con `etaDays` 1; con `radar` → 3; `tickAlerts` dispara el evento cuando `etaDays` llega a 0; `applyEffects(state,{food:-1e9})` deja `food` en 0, no negativo; misma semilla → misma secuencia de eventos en 30 días.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement** datos y core.
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: eventos, desastres, avisos y cadenas"`

---

### Task 9: Minimisiones

**Files:**
- Create: `src/data/minimissions.js`, `src/core/minimissions.js`
- Test: `tests/core/minimissions.test.js`

**Interfaces:**
- Produces: `MINIMISSIONS` (id → `{name, desc, requires:{modules?:string[], crew:number, role?:string}, days:number, deadline:number, cost:{...}, check:{stat, dc}, reward:{...}, failure:{...}, mandatory?:boolean, chainUnlock?:string}`); `offerMinis(state, rng) -> state` (máx. 2 ofertas abiertas; prob. 0,04/día); `acceptMini(state, miniId, crewIds) -> {state, error?:string}`; `progressMinis(state, rng) -> {state, log}` (los tripulantes asignados no hacen otras labores; al completar, tirada `stat del mejor + rng.int(1,10) ≥ dc`).

Ids: `lanzar_cubesats` (desplegador), `recuperar_satelite` (brazo + EVA, `chainUnlock` tras `retirar_basura`), `retirar_basura` (brazo; éxito reduce `micrometeoritos`/`basura_tardia` a la mitad de peso el resto de la misión), `capturar_carga` (brazo, **obligatoria** al llegar cada carga: si falla, la carga vuelve sin entregar), `experimento_externo` (EVA ×2; +2 ciencia/día permanente), `cambiar_panel` (EVA + 5 piezas; repara paneles al 100), `fotografiar_desastre` (cámara_tierra; plazo 2 días; +10 reputación), `radio_escuelas` (comunicación; +moral +reputación), `cultivo_microg` (plantas_microg; +comida +ciencia), `prueba_nave_comercial` (piloto; ±reputación). Errores de `acceptMini`: `"Falta el módulo: X"`, `"Faltan tripulantes"`.

- [ ] **Step 1: Write the failing test** — aceptar `recuperar_satelite` sin brazo → `"Falta el módulo: brazo"`; `recuperar_satelite` no se ofrece antes de completar `retirar_basura`; una mini completada con éxito aplica `reward`; vencido el `deadline` sin aceptar desaparece.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: minimisiones de la estación"`

---

### Task 10: Datos reales de NASA y lecciones para la Tierra

**Files:**
- Create: `src/core/realdata.js`, `src/data/donki-snapshot.js`, `src/data/lessons.js`
- Test: `tests/core/realdata.test.js`

**Interfaces:**
- Produces: `fetchFlares({year, fetchImpl=fetch, timeoutMs=4000}) -> Promise<{source:'donki'|'respaldo', flares:{day:number, cls:string, date:string}[]}>`; `flaresToStorms(flares, difficulty) -> {day, severity, date, cls}[]` (clase X → `grave`, M5+ → `media`, M1–M4 → `leve`; las C se ignoran); `LESSONS` (id → `{title, space, earth}`), al menos 12, una por sistema del juego (reciclaje de agua, paneles, baterías, racionamiento, ejercicio y hueso, radiación y protector solar, purificadores de aire, cámaras de los satélites y clima, GPS, trabajo en equipo con Go/No-Go, filtros de agua portátiles, materiales del escudo térmico).

`fetchFlares` llama a `https://api.nasa.gov/DONKI/FLR?startDate=${year}-01-01&endDate=${year}-12-31&api_key=DEMO_KEY`, mapea `beginTime` a día del año y `classType` a `cls`. Si falla, tarda más de `timeoutMs` o devuelve no-JSON → respaldo. El respaldo `DONKI_2024` se genera una vez descargando 2024 (año de máximo solar) y se guarda como módulo con la lista recortada a `{date, cls}`; si no hay red al implementar, se escribe a mano con al menos 30 fulguraciones M y X reales de 2024 y la nota "fuente: DONKI, NASA". En la partida, las tormentas solares reales reemplazan a las `tormenta_solar` aleatorias y el aviso muestra la fecha y clase reales (ej. "Basado en la fulguración X1.1 real del 2024-05-14").

- [ ] **Step 1: Write the failing test** — con `fetchImpl` que rechaza → `source:'respaldo'` y `flares.length ≥ 30` (**Review Focus 4**); con `fetchImpl` que nunca resuelve y `timeoutMs:50` → respaldo en < 500 ms; `flaresToStorms` convierte `X1.1` en `grave` y descarta `C3.0`; `LESSONS` tiene ≥ 12 con `space` y `earth` no vacíos.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement** y generar el respaldo con `curl` (si `curl` falla por certificados, escribir el respaldo a mano como se indica).
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: fulguraciones reales DONKI y lecciones para la Tierra"`

---

### Task 11: Secuencia de despegue

**Files:**
- Create: `src/core/launch.js`
- Test: `tests/core/launch.test.js`

**Interfaces:**
- Produces: `LAUNCH_STEPS` (arreglo ordenado de `{id, t:number /*segundos respecto de T-0*/, label, risk:number, failure?:string}`); `checkWeather(rng, difficulty) -> {go:boolean, reasons:string[]}`; `goNoGoPoll(state, votes:Object<role,'go'|'nogo'>) -> {go:boolean, holdouts:string[]}`; `runLaunchStep(state, stepId, rng) -> {ok:boolean, failure?:string, abortMode?:string}`; `abortModeAt(t:number) -> 'torre_escape'|'amarizaje'|'aborto_orbita'|null`; `applyAbort(state, mode, rng) -> {state, log}`.

Pasos (t en s): `cuarentena` (−172800), `carga_propelente` (−36000, riesgo fuga 0,03), `clima` (−14400), `abordaje` (−10800), `hold_go_nogo` (−600), `retiro_brazo` (−420), `escape_armado` (−300), `computadora` (−60), `encendido` (−6, aborto automático 0,02), `despegue` (0), `despeje_torre` (10), `max_q` (70, riesgo 0,01), `sep_impulsores` (130, riesgo 0,01), `sep_torre_escape` (190), `meco` (480, riesgo 0,01), `insercion` (540), `paneles` (600, riesgo 0,02 → panel −50 salud), `acople_estacion` (86400, riesgo 0,02). Riesgo total escala con `1 − fiabilidad` del cohete y ×0,5 / 1 / 1,5 por dificultad. Clima: criterios reales (rayos en 10 millas, nubes de yunque, viento en altura > 30 m/s, mar en zonas de aborto); fallo → scrub, se reintenta al día siguiente con −1 día de carga y −3 moral. `abortModeAt`: t < 0 → `torre_escape`, 0 ≤ t < 190 → `torre_escape`, 190 ≤ t < 480 → `amarizaje`, 480 ≤ t < 540 → `aborto_orbita`, t ≥ 540 → null. Aborto antes de la órbita → misión fallida con tripulación viva (`outcome {success:false, reason:'Aborto en el despegue: tripulación a salvo'}`).

- [ ] **Step 1: Write the failing test** — `LAUNCH_STEPS` ordenado por `t`; `abortModeAt(100) === 'torre_escape'`, `abortModeAt(300) === 'amarizaje'`, `abortModeAt(500) === 'aborto_orbita'`, `abortModeAt(700) === null`; `goNoGoPoll` con un `nogo` → `go:false` y ese rol en `holdouts`; con semilla fija, `checkWeather` es reproducible.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: secuencia de despegue real con abortos"`

---

### Task 12: Secuencia de reentrada

**Files:**
- Create: `src/core/reentry.js`
- Test: `tests/core/reentry.test.js`

**Interfaces:**
- Produces: `REENTRY_STEPS` (`desacople`, `encendido_salida`, `sep_modulo_servicio`, `interfaz_entrada`, `apagon_plasma` (~4 min sin radio), `escudo_termico`, `paracaidas_freno`, `paracaidas_principales`, `amerizaje`, `recuperacion`); `runReentryStep(state, stepId, rng, choice?) -> {ok, log, failure?}`; `heatShieldRisk(state) -> number`.

Reglas: riesgo del escudo = `(100 − salud del módulo cabina)/100 × 0,5`; si no hay combustible ≥ 10 para el encendido de salida, se espera reabastecimiento (en la estación, pierde 1 día por intento); ángulo de entrada con opción `'normal'|'empinado'|'rasante'` en `manual`: empinado → +20 % riesgo de daño a tripulación, rasante → 30 % de rebote que añade 1 día; falla grave del escudo → todos mueren (`outcome {success:false, reason:'Falla del escudo térmico en la reentrada'}`); falla de paracaídas principal con 1 de 3 → amerizaje duro, salud −20.

- [ ] **Step 1: Write the failing test** — cabina al 100 → `heatShieldRisk` 0; cabina al 40 → 0,3; sin combustible, `encendido_salida` devuelve `ok:false` con log que contiene `"combustible"`; los pasos están en el orden indicado.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: secuencia de reentrada"`

---

### Task 13: Bucle de simulación e informe final

**Files:**
- Create: `src/core/sim.js`, `src/core/report.js`
- Test: `tests/core/sim.test.js`, `tests/core/report.test.js`

**Interfaces:**
- Consumes: Tasks 5–10.
- Produces: `advanceDay(state) -> {state, interrupt:null|{kind:'alerta'|'evento'|'mini'|'muerte'|'fin'|'recurso', data}}` (orden del día: `rollEvents` → `tickAlerts` → `offerMinis` → `applyTasks` → `progressMinis` → `applyEnergy` → `applyDailyLife` → resupply → `history.push({day, o2, water, food, battery})` → chequeo de fin); `runUntilInterrupt(state, maxDays=365) -> {state, interrupt}`; `checkEnd(state) -> null|{success, reason}`; `buildReport(state) -> {success, reason, score, medal:'oro'|'plata'|'bronce'|null, daysSurvived, survivors, science, resources:{min, end}, causes:string[], lessons:string[], suggestions:string[]}`.

Interrumpir cuando: aparece una alerta nueva, se dispara un evento con opciones, se ofrece una minimisión, muere alguien, un recurso baja de 7 días de consumo (`recurso`), o termina la misión. Fin: todos muertos o evacuados → fallo `"Toda la tripulación se perdió"` el mismo día (**Review Focus 2**); día 365 con alguien vivo → pasa a `phase:'reentry'`. Puntaje = `survivors × 1000 + science × 10 + reputation × 5`; medalla: oro si todos vuelven y ciencia ≥ 300, plata si ≥ la mitad vuelve, bronce si al menos uno. `causes`: lista de 1–5 frases que explican el resultado a partir del log (ej. `"La comida se acabó el día 212: faltaron 40 días de carga o un invernadero"`, `"El enlace no alcanzó: se perdieron 3200 GB de datos"`). `suggestions`: un cambio de diseño concreto por causa. `lessons`: ids de `LESSONS` ligadas a lo que pasó.

- [ ] **Step 1: Write the failing test** — misión con comida 0 y sin invernadero: `runUntilInterrupt` se detiene con `recurso` antes de que alguien muera; estado con todos con salud 1, O₂ 0 y `medio` → se detiene en ese mismo día con `checkEnd` fallido (**Review Focus 2**); misión mínima con 365 días de carga en `facil` y semilla 1 llega a `phase:'reentry'`; `buildReport` de una misión con comida agotada incluye una causa que contiene `"comida"`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` · Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: bucle de simulación e informe post-misión"`

---

### Task 14: Interfaz base, menú, cooperativo, sonido y guardado

**Files:**
- Create: `index.html`, `styles/console.css`, `src/ui/main.js`, `src/ui/audio.js`, `src/ui/screens/title.js`, `src/core/save.js`
- Test: `tests/core/save.test.js`

**Interfaces:**
- Produces: `save(state, storage=localStorage)`, `load(storage=localStorage) -> MissionState|null`, `clearSave(storage)`; clave `vdl.save`, formato `{v:1, state}`. `main.js` expone `go(screenName, params)` y `app = {state, players:[{name, roles:string[]}], difficulty, mode:'campana'|'libre'|'demo'}`. Cada pantalla exporta `render(root, app, go)`. `audio.js`: `beep(freq, ms)`, `alarm(kind:'aviso'|'emergencia')`, `hum(on)`, `radio()`; todo generado con WebAudio y con botón de silencio.

Menú: título "VENTANA DE LANZAMIENTO", modo (Campaña → en esta capa solo la estación, con Luna y Marte marcadas "Próximamente"; Libre → eliges escenario, dificultad y presupuesto ±50 %; Demo → estación en `facil` con avisos frecuentes), dificultad, número de jugadores 1–4 y reparto automático de roles (1: todos; 2: comandante+comunicaciones / ingeniero+científico; 3: comandante+comunicaciones / ingeniero / científico; 4: uno cada uno). "Continuar" si `load()` devuelve algo. Créditos con el texto de las Global Constraints.

- [ ] **Step 1: Write the failing test** — con un `storage` falso en memoria: `save` y `load` devuelven el mismo estado; `load` con JSON roto → `null` y borra la clave (**Review Focus 5**); `load` con `v:0` → `null`.
- [ ] **Step 2: Run** `npm test` · Expected: FAIL.
- [ ] **Step 3: Implement** `save.js` y la interfaz base. CSS: fondo `#050805`, texto `#33ff66`, alertas `#ffb000`, emergencias `#ff3344`, fuente monoespaciada, líneas de escaneo sutiles; diseño usable desde 1280×720.
- [ ] **Step 4: Run** `npm test` · Expected: PASS. Luego `python3 -m http.server 8000` y, con Playwright, abrir `http://localhost:8000`: se ve el menú, se elige 2 jugadores y aparecen sus roles; consola sin errores.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: interfaz base, menú cooperativo, sonido y guardado"`

---

### Task 15: Pantalla de diseño

**Files:**
- Create: `src/ui/screens/design.js`

**Interfaces:**
- Consumes: `computeDesign`, `canLaunch`, `createMission`, catálogo.

Contenido: cuadrícula 6×4 donde se colocan módulos (clic en catálogo y clic en casilla; clic derecho quita); listas de instrumentos, cohetes y órbitas con su explicación corta; selector de días de carga; tablero en vivo de masa/capacidad, energía/día, presupuesto, datos/enlace y ciencia/día con barras (verde/ámbar/rojo); lista de errores y avisos de `computeDesign`; botón **LANZAR** deshabilitado mientras haya errores (**Review Focus 3**). En cooperativo, cada sección muestra qué rol la decide (ingeniero: módulos y energía; científico: instrumentos; comunicaciones: antena y datos; comandante: cohete, órbita, carga y botón final). Botón "Explicar" junto a cada recurso con una ficha de `LESSONS`.

- [ ] **Step 1: Verify** con Playwright: armar diseño mínimo válido → LANZAR habilitado; quitar `cabina` → LANZAR deshabilitado y aparece `"Falta el módulo obligatorio: cabina"`; elegir `geo` con diseño pesado → error de masa.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** los tres casos del Step 1 y consola sin errores.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: pantalla de diseño de la nave"`

---

### Task 16: Pantallas de despegue y reentrada

**Files:**
- Create: `src/ui/screens/launch.js`, `src/ui/screens/reentry.js`

Despegue: reloj T−/T+ grande, lista de pasos con estado, telemetría simulada (altitud, velocidad, presión dinámica con pico en Max Q), voz del control en texto con `radio()`. Según `launchMode`: `auto` reproduce todo con resumen; `pausas` se detiene en `clima` (mostrar criterios y resultado) y en `hold_go_nogo` (cada jugador vota con su rol; un `nogo` pide motivo y mantiene el hold); `manual` además pide decidir el aborto cuando un paso falla, con el modo correcto según `abortModeAt` y 5 s para responder. Reentrada igual con `REENTRY_STEPS`, apagón de plasma con pantalla en estática 4 s y elección de ángulo en `manual`.

- [ ] **Step 1: Verify** con Playwright en `medio`: el despegue se detiene en el Go/No-Go; con 2 jugadores, votar go/go continúa hasta `acople_estacion` y pasa a operaciones.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** el caso del Step 1 y que la reentrada termina en el informe.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: pantallas de despegue y reentrada"`

---

### Task 17: Pantalla de operaciones

**Files:**
- Create: `src/ui/screens/ops.js`

Contenido: cabecera "DÍA X / 365" con barras de O₂, agua, comida, medicinas, piezas, combustible, batería y datos (con "días restantes" de cada consumible); vista de la nave (cuadrícula con salud y encendido de cada módulo, prioridad de apagado editable); tabla de tripulación (stats, salud, fatiga, moral, hueso, radiación y barra de dosis con el límite de 600 mSv) con selector de labor por turno y de ración; rutinas: "Guardar rutina" y "Repetir" para no decidir día a día; panel de alertas con cuenta regresiva y botones de preparación; ventana de evento con texto según gravedad y opciones (muestra la tirada si hay `check`); panel de minimisiones (ofertas con plazo, aceptar asignando tripulantes); botones **Avanzar 1 día** y **Avanzar hasta el próximo evento** (`runUntilInterrupt`); bitácora. El autoguardado (`save`) ocurre tras cada día. Las decisiones de evento las toma el rol responsable en cooperativo (desastres de módulos: ingeniero; médicos: el rol de quien tenga `medico` o comandante; ciencia: científico; comunicaciones: comunicaciones). Alarmas sonoras al llegar avisos y emergencias.

- [ ] **Step 1: Verify** con Playwright en modo demo: tras lanzar, "Avanzar hasta el próximo evento" se detiene en una alerta o evento; elegir una opción lo resuelve y la bitácora lo registra; un tripulante sin turno de sueño muestra `"X no tiene turno de sueño"` y bloquea avanzar.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** el Step 1 y jugar una partida demo completa hasta la reentrada en ≤ 10 min de interacciones.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: pantalla de operaciones diarias"`

---

### Task 18: Informe final, rediseño y ranking

**Files:**
- Create: `src/ui/screens/report.js`

Contenido: resultado y medalla, días, sobrevivientes, ciencia, gráfico simple en texto/CSS de recursos por día (de `state.history`, Task 13), lista de `causes` y `suggestions` de `buildReport`, tarjetas de lecciones para la Tierra, botón **Rediseñar y reintentar** (vuelve al diseño con el mismo diseño cargado y la misma semilla para comparar), ranking local en localStorage `vdl.ranking` (top 10 por puntaje con diseño resumido), botón para copiar el diseño como texto JSON y compartirlo. `clearSave()` al mostrar el informe.

- [ ] **Step 1: Verify** con Playwright: una partida fallida muestra al menos una causa y una sugerencia; "Rediseñar y reintentar" vuelve al diseño con los módulos previos; el ranking muestra la partida.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** el Step 1 y que `npm test` sigue en verde.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: informe final, rediseño y ranking"`

---

## Planes siguientes (fuera de este plan)
- **Capa 2 — Luna:** viaje, noche de 14 días, rovers, polvo, hielo polar, reactor y pilas de combustible, eventos y minimisiones lunares.
- **Capa 3 — Marte:** 7 meses + 1 año + 7 meses, tormentas globales, conjunción, invernadero, planta de combustible, dron.
- **Capa 4 — Campaña:** árbol tecnológico, presupuesto por reputación, exploración por nodos, muerte permanente entre misiones, veteranos con radiación acumulada.
- **Entrega Space Apps:** documento, pitch y video corto (al final de la capa que llegue).
