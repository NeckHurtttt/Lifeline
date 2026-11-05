// Eventos de la estación y desastres de nave. Efectos por gravedad (leve/media/grave).
// Claves de efecto: o2, water, food, meds, parts, fuel, battery, science, reputation,
// crewHealth, crewMorale, crewRadiation, moduleDamage:{tipo|'random':n}, moduleOff:{tipo|'random':días},
// delayResupply:días, endMission:'evacuar'.

const T = (leve, media, grave) => ({ leve, media, grave });
const PREP_STORM = [
  { id: 'refugio', label: 'Refugiar a la tripulación', cost: {} },
  { id: 'modo_seguro', label: 'Modo seguro (paneles plegados)', cost: {} },
];

export const EVENTS = {
  micrometeoritos: {
    id: 'micrometeoritos', name: 'Lluvia de micrometeoritos', kind: '-', disaster: false, warnDays: 1, weight: 10,
    text: T('Pequeños impactos tamborilean contra el casco.', 'Una nube de partículas perfora paneles y revestimiento.', 'Una lluvia densa de micrometeoritos azota toda la nave.'),
    prepare: PREP_STORM,
    options: [
      { id: 'reparar', label: 'Reparar con piezas', effects: T({ parts: -2, moduleDamage: { random: 5 } }, { parts: -5, moduleDamage: { random: 20 } }, { parts: -8, moduleDamage: { random: 40 }, crewMorale: -10 }) },
      { id: 'ignorar', label: 'Ignorar el daño', effects: T({ moduleDamage: { random: 10 } }, { moduleDamage: { random: 30 } }, { moduleDamage: { random: 60 }, crewMorale: -15 }) },
    ],
  },
  basura_tardia: {
    id: 'basura_tardia', name: 'Basura espacial con aviso tardío', kind: '-', disaster: false, warnDays: 0, weight: 6,
    text: T('Un fragmento pasa rozando; salta la alarma.', 'Un fragmento impacta un módulo exterior.', 'Basura orbital destroza parte de la estación.'),
    prepare: [],
    options: [
      { id: 'maniobra', label: 'Maniobra evasiva (combustible)', effects: T({ fuel: -5 }, { fuel: -10, moduleDamage: { random: 10 } }, { fuel: -15, moduleDamage: { random: 35 } }) },
      { id: 'aceptar', label: 'Aceptar el riesgo', effects: T({ moduleDamage: { random: 8 } }, { moduleDamage: { random: 25 } }, { moduleDamage: { random: 55 }, crewMorale: -10 }) },
    ],
  },
  tormenta_solar: {
    id: 'tormenta_solar', name: 'Tormenta solar', kind: '-', disaster: false, warnDays: 2, weight: 10,
    text: T('Aumenta la radiación; los contadores suben un poco.', 'Una eyección de masa coronal eleva la radiación a bordo.', 'Tormenta solar severa: dosis peligrosas en toda la nave.'),
    prepare: PREP_STORM,
    options: [
      { id: 'aguantar', label: 'Seguir con las labores', effects: T({ crewRadiation: 10 }, { crewRadiation: 30, crewHealth: -5 }, { crewRadiation: 70, crewHealth: -15 }) },
      { id: 'apagar', label: 'Apagar sistemas sensibles', effects: T({ crewRadiation: 6, science: -1 }, { crewRadiation: 20, science: -3, moduleOff: { laboratorio: 2 } }, { crewRadiation: 45, science: -6, moduleOff: { laboratorio: 4 } }) },
    ],
    chain: [{ eventId: 'panel_danado', prob: 0.3 }],
  },
  carga_a_tiempo: {
    id: 'carga_a_tiempo', name: 'Carga a tiempo', kind: '+', disaster: false, warnDays: 0, weight: 0,
    text: T('Llega la nave de carga puntual.', 'La nave de carga atraca sin problemas.', 'La carga llega incluso antes de lo previsto.'),
    prepare: [],
    options: [{ id: 'continuar', label: 'Descargar suministros', effects: T({ reputation: 1 }, { reputation: 2, crewMorale: 5 }, { reputation: 3, crewMorale: 8 }) }],
  },
  carga_explota: {
    id: 'carga_explota', name: 'La carga explota', kind: '-', disaster: false, warnDays: 0, weight: 0,
    text: T('El lanzamiento de carga falla; se reintentará.', 'La nave de carga estalla en el ascenso.', 'La carga explota: se pierde todo el envío.'),
    prepare: [],
    options: [{ id: 'continuar', label: 'Esperar la próxima carga', effects: T({ crewMorale: -5 }, { crewMorale: -10, reputation: -2 }, { crewMorale: -15, reputation: -4 }) }],
  },
  captura_brazo: {
    id: 'captura_brazo', name: 'Captura con el brazo robótico', kind: '±', disaster: false, warnDays: 0, weight: 6,
    text: T('Una cápsula de carga privada se acerca para ser capturada.', 'Un satélite a la deriva pasa cerca del brazo.', 'Una nave averiada pide ser capturada de inmediato.'),
    prepare: [],
    options: [
      { id: 'capturar', label: 'Capturar con el brazo (piloto)', check: { stat: 'fuerza', dc: 12 },
        effects: T({ science: 3, reputation: 2 }, { science: 6, parts: 5, reputation: 3 }, { science: 10, parts: 10, reputation: 5 }),
        failEffects: T({ moduleDamage: { brazo: 10 } }, { moduleDamage: { brazo: 25 }, crewMorale: -5 }, { moduleDamage: { brazo: 50 }, crewMorale: -10 }) },
      { id: 'dejar', label: 'Dejarla pasar', effects: T({}, { crewMorale: -2 }, { crewMorale: -4, reputation: -2 }) },
    ],
  },
  fuga_amoniaco: {
    id: 'fuga_amoniaco', name: 'Fuga de amoníaco', kind: '-', disaster: true, warnDays: 0, weight: 8,
    text: T('Olor acre: una microfuga en el circuito de enfriamiento.', 'El amoníaco escapa y obliga a sellar un módulo.', 'Fuga masiva de amoníaco: la atmósfera se vuelve tóxica.'),
    prepare: [],
    options: [
      { id: 'aislar', label: 'Aislar el módulo afectado', effects: T({ moduleOff: { random: 2 } }, { moduleOff: { random: 4 }, o2: -15 }, { moduleOff: { random: 5 }, moduleDamage: { random: 40 }, o2: -40, crewHealth: -10 }) },
      { id: 'eva', label: 'EVA de reparación', check: { stat: 'tecnica', dc: 13 },
        effects: T({ parts: -1 }, { parts: -3, crewRadiation: 5 }, { parts: -5, crewRadiation: 10 }),
        failEffects: T({ crewHealth: -5, moduleOff: { random: 2 } }, { crewHealth: -15, moduleOff: { random: 4 }, crewRadiation: 8 }, { crewHealth: -30, moduleDamage: { random: 50 }, o2: -50 }) },
    ],
  },
  incendio: {
    id: 'incendio', name: 'Incendio a bordo', kind: '-', disaster: true, warnDays: 0, weight: 8,
    text: T('Humo en un compartimento; el extintor lo apaga.', 'El fuego daña un módulo y lo deja inutilizable unos días.', 'Fuego en un módulo crítico: hay que evacuar a la cápsula.'),
    prepare: [],
    options: [
      { id: 'extintor', label: 'Combatir con extintores', check: { stat: 'temple', dc: 12 },
        effects: T({ parts: -1, crewMorale: -3 }, { moduleOff: { random: 3 }, parts: -3 }, { moduleDamage: { random: 70 }, crewHealth: -25, parts: -8 }),
        failEffects: T({ moduleDamage: { random: 10 }, crewHealth: -5 }, { moduleOff: { random: 5 }, moduleDamage: { random: 30 }, crewHealth: -15 }, { endMission: 'evacuar' }) },
      { id: 'sellar', label: 'Sellar el módulo (pierdes aire)', effects: T({ o2: -8 }, { o2: -25, moduleOff: { random: 4 } }, { o2: -60, moduleDamage: { random: 100 }, endMission: 'evacuar' }) },
    ],
    chain: [{ eventId: 'bacterias', prob: 0.2 }],
  },
  robot_detecta_fuga: {
    id: 'robot_detecta_fuga', name: 'El robot detecta una fuga', kind: '+', disaster: false, warnDays: 0, weight: 5,
    text: T('Un robot de inspección encuentra una fuga mínima.', 'El robot localiza a tiempo una fuga importante.', 'El robot evita una catástrofe al detectar una fuga grave.'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Aprovechar el hallazgo', effects: T({ reputation: 1, parts: 1 }, { reputation: 2, crewMorale: 5 }, { reputation: 4, crewMorale: 10 }) }],
  },
  despresurizacion: {
    id: 'despresurizacion', name: 'Despresurización', kind: '-', disaster: true, warnDays: 0, weight: 7, countdown: true,
    text: T('Suena la alarma de presión: una fuga pequeña en algún módulo.', 'La presión cae rápido: hay una grieta en un módulo.', '¡Fuga grave! La presión se desploma en todos los módulos.'),
    procedure: 'Protocolo real: todos se juntan en un lugar seguro, calculan el tiempo de reserva (cuánto falta para que la presión llegue al mínimo) y cierran escotillas módulo por módulo hasta aislar la fuga.',
    prepare: [],
    options: [
      { id: 'escotillas', label: 'Cerrar escotillas y aislar el módulo (protocolo)', check: { stat: 'temple', dc: 11 },
        effects: T({ o2: -5, moduleOff: { random: 2 } }, { o2: -12, moduleOff: { random: 4 }, parts: -2 }, { o2: -25, moduleOff: { random: 6 }, parts: -4 }),
        failEffects: T({ o2: -15, moduleOff: { random: 3 } }, { o2: -35, moduleOff: { random: 5 }, crewHealth: -5 }, { o2: -60, moduleDamage: { random: 40 }, crewHealth: -15 }) },
      { id: 'parchar', label: 'Buscar la grieta y parcharla sin aislar', check: { stat: 'tecnica', dc: 14 },
        effects: T({ o2: -8, parts: -2 }, { o2: -20, parts: -4 }, { o2: -40, parts: -6 }),
        failEffects: T({ o2: -20 }, { o2: -50, crewHealth: -10 }, { o2: -90, crewHealth: -25, moduleDamage: { random: 50 } }) },
      { id: 'capsula', label: 'Refugiarse en la cápsula y evacuar', effects: T({ endMission: 'evacuar' }, { endMission: 'evacuar' }, { endMission: 'evacuar' }) },
      { id: 'tarde', hidden: true, label: 'Se acabó el tiempo de reserva',
        effects: T({ o2: -25, crewHealth: -10, moduleOff: { random: 4 } }, { o2: -60, crewHealth: -25, moduleDamage: { random: 40 } }, { o2: -100, crewHealth: -45, moduleDamage: { random: 70 } }) },
    ],
  },
  fuga_misteriosa: {
    id: 'fuga_misteriosa', name: 'Fuga misteriosa', kind: '-', disaster: false, warnDays: 0, weight: 6,
    text: T('La presión baja apenas; nadie sabe por qué.', 'Una fuga lenta pierde aire cada hora.', 'La presión cae rápido: hay que encontrar la grieta.'),
    prepare: [],
    options: [
      { id: 'buscar', label: 'Buscar la fuga (técnica)', check: { stat: 'tecnica', dc: 12 },
        effects: T({ parts: -1 }, { parts: -2, o2: -5 }, { parts: -4, o2: -15 }),
        failEffects: T({ o2: -10 }, { o2: -30 }, { o2: -60, crewHealth: -10 }) },
      { id: 'parche', label: 'Parchear a ciegas', effects: T({ parts: -2, o2: -5 }, { parts: -4, o2: -20 }, { parts: -6, o2: -45, crewHealth: -10 }) },
    ],
  },
  experimento_exitoso: {
    id: 'experimento_exitoso', name: 'Experimento exitoso', kind: '+', disaster: false, warnDays: 0, weight: 7,
    text: T('Un experimento sale bien.', 'Un resultado inesperado entusiasma a la Tierra.', 'Un hallazgo digno de portada.'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Publicar el resultado', effects: T({ science: 3, reputation: 1 }, { science: 8, reputation: 3 }, { science: 15, reputation: 6, crewMorale: 10 }) }],
  },
  aurora: {
    id: 'aurora', name: 'Aurora vista desde la órbita', kind: '+', disaster: false, warnDays: 0, weight: 7,
    text: T('Una aurora tenue ilumina el horizonte.', 'Una aurora verde cubre medio planeta.', 'La aurora más espectacular que nadie recuerda.'),
    prepare: [],
    options: [{ id: 'continuar', label: 'Contemplarla', effects: T({ crewMorale: 5 }, { crewMorale: 10 }, { crewMorale: 15, reputation: 2 }) }],
  },
  radio_escuelas: {
    id: 'radio_escuelas', name: 'Radio con escuelas', kind: '+', disaster: false, warnDays: 0, weight: 7,
    text: T('Un grupo de escolares saluda por radio.', 'Varias escuelas te hacen preguntas en directo.', 'Millones de estudiantes siguen la transmisión.'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Responder las preguntas', effects: T({ crewMorale: 4, reputation: 1 }, { crewMorale: 8, reputation: 2 }, { crewMorale: 12, reputation: 4 }) }],
  },
  falla_bano: {
    id: 'falla_bano', name: 'Falla del baño', kind: '-', disaster: false, warnDays: 0, weight: 6,
    text: T('El inodoro espacial se atasca.', 'El baño queda fuera de servicio y huele mal.', 'Avería total del sistema sanitario.'),
    prepare: [],
    options: [
      { id: 'reparar', label: 'Reparar con piezas', effects: T({ parts: -1 }, { parts: -3, crewMorale: -3 }, { parts: -5, crewMorale: -8 }) },
      { id: 'improvisar', label: 'Improvisar con bolsas', effects: T({ crewMorale: -4 }, { crewMorale: -10, water: -10 }, { crewMorale: -18, crewHealth: -5 }) },
    ],
  },
  bacterias: {
    id: 'bacterias', name: 'Bacterias en el agua', kind: '-', disaster: false, warnDays: 0, weight: 6,
    text: T('Se detecta una colonia en un filtro.', 'Las bacterias contaminan parte del agua.', 'Un brote bacteriano enferma a la tripulación.'),
    prepare: [],
    options: [
      { id: 'tratar', label: 'Tratar con medicinas', effects: T({ meds: -1 }, { meds: -3, water: -10 }, { meds: -6, water: -25, crewHealth: -10 }) },
      { id: 'purgar', label: 'Purgar y recargar el agua', effects: T({ water: -10 }, { water: -30 }, { water: -60, crewHealth: -5 }) },
    ],
  },
  nueva_tripulacion: {
    id: 'nueva_tripulacion', name: 'Visita de nueva tripulación', kind: '±', disaster: false, warnDays: 0, weight: 4,
    text: T('Una cápsula visitante trae noticias y un poco de carga.', 'Una tripulación de relevo comparte la estación unos días.', 'Una visita numerosa agota los recursos pero levanta el ánimo.'),
    prepare: [],
    options: [
      { id: 'recibir', label: 'Recibirlos con una fiesta', effects: T({ crewMorale: 5, food: -5 }, { crewMorale: 10, food: -15, water: -10 }, { crewMorale: 15, food: -30, water: -25, reputation: 3 }) },
      { id: 'breve', label: 'Visita breve', effects: T({ crewMorale: 2 }, { crewMorale: 4, food: -3 }, { crewMorale: 6, food: -8 }) },
    ],
  },
  reboost: {
    id: 'reboost', name: 'Reajuste de órbita', kind: '±', disaster: false, warnDays: 1, weight: 6,
    text: T('La estación ha perdido algo de altura.', 'La órbita decae más de lo esperado.', 'La estación desciende peligrosamente.'),
    prepare: [{ id: 'gastar_combustible', label: 'Gastar 10 de combustible', cost: { fuel: 10 } }],
    options: [
      { id: 'reboost', label: 'Encender motores (combustible)', effects: T({ fuel: -10 }, { fuel: -20 }, { fuel: -35 }) },
      { id: 'esperar', label: 'Esperar sin gastar', effects: T({ reputation: -1 }, { reputation: -2, moduleDamage: { random: 10 } }, { reputation: -4, moduleDamage: { random: 30 }, crewMorale: -10 }) },
    ],
  },
  tanque_o2: {
    id: 'tanque_o2', name: 'Explosión de tanque de O₂', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Una fuga lenta vacía parte de un tanque de oxígeno.', 'Pierdes un tanque de oxígeno; toca racionar.', 'El tanque estalla: pierdes energía y O₂, la misión corre peligro.'),
    prepare: [],
    options: [
      { id: 'racionar', label: 'Racionar y sellar', effects: T({ o2: -8 }, { o2: -35, crewMorale: -5 }, { o2: -90, battery: -20, endMission: 'evacuar' }) },
      { id: 'reparar', label: 'Reparar el circuito', check: { stat: 'tecnica', dc: 13 },
        effects: T({ o2: -5, parts: -1 }, { o2: -20, parts: -3 }, { o2: -60, battery: -15, parts: -6 }),
        failEffects: T({ o2: -12 }, { o2: -45, crewHealth: -5 }, { o2: -90, battery: -25, endMission: 'evacuar' }) },
    ],
  },
  choque_carga: {
    id: 'choque_carga', name: 'Choque con nave de carga', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('La nave de carga roza la estación: un rasguño.', 'El choque perfora un módulo.', 'Despresurización rápida: cerrar escotillas con contador.'),
    prepare: [],
    options: [
      { id: 'sellar', label: 'Cerrar escotillas', effects: T({ moduleDamage: { random: 8 } }, { moduleDamage: { random: 25 }, o2: -15 }, { moduleDamage: { random: 80 }, o2: -50, crewHealth: -20 }) },
      { id: 'parche_eva', label: 'EVA para parchear', check: { stat: 'tecnica', dc: 13 },
        effects: T({ parts: -1 }, { parts: -3, o2: -8 }, { parts: -6, o2: -25, crewRadiation: 8 }),
        failEffects: T({ moduleDamage: { random: 12 } }, { moduleDamage: { random: 35 }, o2: -20 }, { endMission: 'evacuar' }) },
    ],
    chain: [{ eventId: 'fuga_misteriosa', prob: 0.5 }],
  },
  propulsor_atascado: {
    id: 'propulsor_atascado', name: 'Propulsor atascado', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Un giro leve desorienta a la estación.', 'La estación gira rápido; hay que apagar sistemas.', 'Giro descontrolado: solo un piloto con temple lo detiene.'),
    prepare: [],
    options: [
      { id: 'corregir', label: 'Corregir con el piloto', check: { stat: 'temple', dc: 12 },
        effects: T({ fuel: -3 }, { fuel: -8 }, { fuel: -20, crewHealth: -5 }),
        failEffects: T({ fuel: -8, crewMorale: -3 }, { fuel: -15, crewHealth: -10, moduleOff: { random: 3 } }, { fuel: -30, crewHealth: -25, moduleDamage: { random: 30 } }) },
      { id: 'apagar', label: 'Apagar sistemas y esperar', effects: T({ crewMorale: -2 }, { moduleOff: { random: 3 }, crewMorale: -5 }, { moduleOff: { random: 5 }, crewHealth: -15 }) },
    ],
  },
  falla_computadora: {
    id: 'falla_computadora', name: 'Falla de computadora', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('La computadora se reinicia sola.', 'Pasas a modo manual unos días.', 'Navegación a mano con estrellas.'),
    prepare: [],
    options: [
      { id: 'reiniciar', label: 'Reiniciar sistemas', effects: T({ science: -1 }, { science: -3, moduleOff: { random: 3 } }, { science: -6, moduleOff: { random: 5 }, fuel: -10 }) },
      { id: 'manual', label: 'Operar en manual (ciencia)', check: { stat: 'ciencia', dc: 12 },
        effects: T({}, { crewMorale: -3 }, { fuel: -5, crewMorale: -8 }),
        failEffects: T({ science: -2 }, { science: -5, fuel: -5 }, { science: -8, fuel: -20, moduleDamage: { random: 20 } }) },
    ],
  },
  perdida_comunicacion: {
    id: 'perdida_comunicacion', name: 'Pérdida de comunicación', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Silencio de radio por unas horas.', 'Pasan días sin hablar con la Tierra.', 'Sin control de misión hasta reparar la antena.'),
    prepare: [],
    options: [
      { id: 'esperar', label: 'Esperar a que vuelva la señal', effects: T({ crewMorale: -2 }, { crewMorale: -8, science: -3 }, { crewMorale: -15, science: -8, reputation: -3 }) },
      { id: 'reparar', label: 'Reparar la antena (EVA)', check: { stat: 'tecnica', dc: 12 },
        effects: T({ parts: -1 }, { parts: -2, crewRadiation: 5 }, { parts: -4, crewRadiation: 10 }),
        failEffects: T({ crewMorale: -3 }, { crewMorale: -8, moduleDamage: { antena: 20 } }, { crewMorale: -15, moduleDamage: { antena: 60 } }) },
    ],
  },
  fuga_reciclador: {
    id: 'fuga_reciclador', name: 'Fuga del reciclador', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Unos días sin reciclar agua.', 'Agua racionada hasta reparar el reciclador.', 'Solo quedan las reservas.'),
    prepare: [],
    options: [
      { id: 'reparar', label: 'Reparar el reciclador', effects: T({ water: -8, parts: -1 }, { water: -25, parts: -3 }, { water: -60, parts: -6, moduleDamage: { soporte_vital: 30 } }) },
      { id: 'racionar', label: 'Racionar el agua', effects: T({ water: -6, crewMorale: -2 }, { water: -20, crewMorale: -8 }, { water: -50, crewMorale: -15, crewHealth: -5 }) },
    ],
  },
  sobrecalentamiento: {
    id: 'sobrecalentamiento', name: 'Sobrecalentamiento', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Hay que apagar experimentos para enfriar.', 'Un módulo se apaga por el calor.', 'EVA urgente al radiador.'),
    prepare: [],
    options: [
      { id: 'apagar', label: 'Apagar y enfriar', effects: T({ science: -2, moduleOff: { laboratorio: 1 } }, { moduleOff: { random: 4 }, science: -4 }, { moduleOff: { random: 5 }, moduleDamage: { random: 50 } }) },
      { id: 'eva', label: 'EVA al radiador', check: { stat: 'tecnica', dc: 13 },
        effects: T({ parts: -1 }, { parts: -3, crewRadiation: 6 }, { parts: -5, crewRadiation: 12 }),
        failEffects: T({ moduleOff: { random: 2 } }, { moduleOff: { random: 4 }, crewHealth: -10 }, { moduleDamage: { random: 60 }, crewHealth: -20 }) },
    ],
  },
  falla_bateria: {
    id: 'falla_bateria', name: 'Falla de batería', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Una celda pierde algo de carga.', 'Un banco de baterías se degrada.', 'El banco de baterías queda inservible.'),
    prepare: [],
    options: [
      { id: 'reemplazar', label: 'Reemplazar celdas', effects: T({ battery: -5, parts: -1 }, { battery: -20, parts: -3, moduleDamage: { baterias: 20 } }, { battery: -50, parts: -6, moduleDamage: { baterias: 60 } }) },
      { id: 'aislar', label: 'Aislar el banco', effects: T({ battery: -8 }, { battery: -25, moduleOff: { baterias: 3 } }, { battery: -60, moduleOff: { baterias: 5 } }) },
    ],
  },
  panel_danado: {
    id: 'panel_danado', name: 'Panel solar dañado', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Un panel pierde un poco de eficiencia.', 'Un panel queda parcialmente inutilizable.', 'El panel se parte: casi sin generación.'),
    prepare: [],
    options: [
      { id: 'eva', label: 'EVA de reparación', check: { stat: 'tecnica', dc: 12 },
        effects: T({ parts: -1 }, { parts: -3, crewRadiation: 5 }, { parts: -6, crewRadiation: 10 }),
        failEffects: T({ moduleDamage: { paneles: 8 } }, { moduleDamage: { paneles: 25 } }, { moduleDamage: { paneles: 60 }, crewHealth: -10 }) },
      { id: 'dejar', label: 'Dejarlo así', effects: T({ moduleDamage: { paneles: 8 } }, { moduleDamage: { paneles: 25 } }, { moduleDamage: { paneles: 60 } }) },
    ],
  },
  corto_circuito: {
    id: 'corto_circuito', name: 'Corto circuito', kind: '-', disaster: true, warnDays: 0, weight: 6,
    text: T('Salta un fusible y se pierde algo de energía.', 'Un módulo se apaga por un corto.', 'Corto grave: se quema un módulo y la red cae.'),
    prepare: [],
    options: [
      { id: 'fusibles', label: 'Cambiar fusibles', effects: T({ parts: -1, battery: -3 }, { parts: -3, battery: -10, moduleOff: { random: 3 } }, { parts: -6, battery: -30, moduleDamage: { random: 50 } }) },
      { id: 'desconectar', label: 'Desconectar el circuito', effects: T({ battery: -3 }, { battery: -10, moduleOff: { random: 5 } }, { battery: -25, moduleOff: { random: 5 }, moduleDamage: { random: 25 } }) },
    ],
  },
};

// ---------- Luna y Marte ----------
const SURF = ['luna', 'marte'];
Object.assign(EVENTS, {
  sismo: {
    id: 'sismo', name: 'Sismo', kind: '-', disaster: false, warnDays: 0, weight: 6, scenarios: SURF,
    text: T('El suelo tiembla un poco: se caen herramientas.', 'Un sismo sacude la base durante minutos.', 'Un sismo fuerte agrieta las uniones de los módulos.'),
    prepare: [],
    options: [
      { id: 'revisar', label: 'Revisar las uniones (técnica)', check: { stat: 'tecnica', dc: 11 },
        effects: T({ parts: -1 }, { parts: -3 }, { parts: -6, moduleDamage: { random: 10 } }),
        failEffects: T({ moduleDamage: { random: 8 } }, { moduleDamage: { random: 25 } }, { moduleDamage: { random: 50 }, o2: -20 }) },
      { id: 'esperar', label: 'Esperar a que pase', effects: T({ moduleDamage: { random: 5 } }, { moduleDamage: { random: 20 } }, { moduleDamage: { random: 45 }, crewMorale: -10 }) },
    ],
  },
  polvo_paneles: {
    id: 'polvo_paneles', name: 'Polvo en los paneles', kind: '-', disaster: false, warnDays: 1, weight: 9, scenarios: SURF, needsModule: 'paneles',
    text: T('Una capa fina de polvo opaca los paneles.', 'El polvo pegajoso (con carga eléctrica) cubre los paneles.', 'Los paneles quedan cubiertos: casi no dan energía.'),
    prepare: [{ id: 'cubrir', label: 'Cubrir los paneles a tiempo', cost: {} }],
    options: [
      { id: 'limpiar', label: 'Salir a limpiarlos (EVA en pareja)', check: { stat: 'eva', dc: 10 },
        effects: T({ crewRadiation: 2 }, { crewRadiation: 4, parts: -1 }, { crewRadiation: 6, parts: -2 }),
        failEffects: T({ moduleDamage: { paneles: 10 }, crewRadiation: 3 }, { moduleDamage: { paneles: 25 }, crewHealth: -5 }, { moduleDamage: { paneles: 45 }, crewHealth: -10 }) },
      { id: 'esperar', label: 'Dejarlos así', effects: T({ moduleDamage: { paneles: 10 } }, { moduleDamage: { paneles: 30 } }, { moduleDamage: { paneles: 55 } }) },
    ],
  },
  rover_atascado: {
    id: 'rover_atascado', name: 'Rover atascado', kind: '-', disaster: false, warnDays: 0, weight: 6, scenarios: SURF, needsModule: 'rover',
    text: T('Una rueda se hunde en polvo suelto.', 'El rover queda enterrado hasta los ejes.', 'El rover se queda sin batería y atascado lejos de la base.'),
    prepare: [],
    options: [
      { id: 'rescatar', label: 'Rescatarlo (fuerza, EVA)', check: { stat: 'fuerza', dc: 11 },
        effects: T({ crewRadiation: 2 }, { crewRadiation: 4, parts: -2 }, { crewRadiation: 8, parts: -4 }),
        failEffects: T({ moduleDamage: { rover: 20 } }, { moduleDamage: { rover: 50 }, crewHealth: -5 }, { moduleDamage: { rover: 100 }, crewHealth: -10 }) },
      { id: 'abandonar', label: 'Dejarlo hasta mañana', effects: T({ moduleOff: { rover: 2 } }, { moduleOff: { rover: 5 }, science: -3 }, { moduleDamage: { rover: 60 }, science: -6 }) },
    ],
  },
  falla_traje: {
    id: 'falla_traje', name: 'Falla en un traje espacial', kind: '-', disaster: false, warnDays: 0, weight: 6, scenarios: SURF,
    text: T('Un guante pierde un poco de presión.', 'El sistema de enfriamiento de un traje gotea.', 'Un traje se despresuriza en plena salida: hay que volver ya.'),
    prepare: [],
    options: [
      { id: 'reparar', label: 'Reparar el traje (técnica)', check: { stat: 'tecnica', dc: 10 },
        effects: T({ parts: -1 }, { parts: -2 }, { parts: -4, crewHealth: -5 }),
        failEffects: T({ parts: -2 }, { parts: -3, crewHealth: -5 }, { crewHealth: -20, crewMorale: -10 }) },
      { id: 'repuesto', label: 'Usar piezas de repuesto', effects: T({ parts: -3 }, { parts: -5 }, { parts: -8, crewHealth: -10 }) },
    ],
  },
  hielo_polar: {
    id: 'hielo_polar', name: 'Hielo descubierto', kind: '+', disaster: false, warnDays: 0, weight: 6, scenarios: SURF, sites: ['luna_polo', 'marte_arcadia'],
    text: T('El radar encuentra un poco de hielo cerca.', 'Una capa de hielo limpio a pocos metros de la base.', '¡Un depósito enorme de hielo!'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Sacar el agua', effects: T({ water: 60 }, { water: 150, science: 3 }, { water: 300, science: 6, reputation: 4 }) }],
  },
  cueva_lava: {
    id: 'cueva_lava', name: 'Cueva de lava', kind: '+', disaster: false, warnDays: 0, weight: 5, scenarios: SURF,
    text: T('Se ve la entrada de un túnel antiguo de lava.', 'Un túnel de lava enorme: podría proteger de la radiación.', '¡Una caverna gigante, perfecta para una futura base!'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Estudiarla', effects: T({ science: 4 }, { science: 8, reputation: 3 }, { science: 15, reputation: 6, crewMorale: 8 }) }],
  },
  roca_rara: {
    id: 'roca_rara', name: 'Roca muy rara', kind: '+', disaster: false, warnDays: 0, weight: 7, scenarios: SURF,
    text: T('Una roca con cristales extraños.', 'Una roca de las más antiguas del sistema solar.', '¡Un hallazgo histórico en una roca!'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Analizarla', effects: T({ science: 3 }, { science: 7, reputation: 2 }, { science: 14, reputation: 6 }) }],
  },
  tierra_en_el_cielo: {
    id: 'tierra_en_el_cielo', name: 'La Tierra en el cielo', kind: '+', disaster: false, warnDays: 0, weight: 6, scenarios: ['luna'],
    text: T('La Tierra se ve azul sobre el horizonte.', 'Un "amanecer de Tierra" emociona a todos.', 'Todos se quedan mirando la Tierra: el ánimo vuela.'),
    prepare: [],
    options: [{ id: 'continuar', label: 'Tomar fotos', effects: T({ crewMorale: 5 }, { crewMorale: 10 }, { crewMorale: 15, reputation: 2 }) }],
  },
  impresora_regolito: {
    id: 'impresora_regolito', name: 'Piezas impresas con regolito', kind: '+', disaster: false, warnDays: 0, weight: 5, scenarios: SURF, needsModule: 'taller',
    text: T('Se imprime una pieza con polvo del suelo.', 'La impresora 3D fabrica repuestos con regolito.', '¡Una tanda entera de repuestos hecha con suelo local!'),
    prepare: [],
    options: [{ id: 'aprovechar', label: 'Guardar las piezas', effects: T({ parts: 3 }, { parts: 6 }, { parts: 10, reputation: 2 }) }],
  },
});
for (const id of ['basura_tardia', 'captura_brazo', 'aurora', 'nueva_tripulacion', 'reboost', 'choque_carga', 'propulsor_atascado', 'fuga_amoniaco']) {
  EVENTS[id].scenarios = ['estacion'];
}
