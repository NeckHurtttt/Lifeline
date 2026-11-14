// ACADEMIA AVANZADA: 8 pruebas más (traje EVA, soldadura, primeros auxilios, cultivo, radio, estrellas,
// protocolos de emergencia y trabajo en equipo). Datos y reglas puras; el dibujo está en ui/academy2.js.

export const ADVANCED = {
  eva: { id: 'eva', icon: '🧑‍🚀', name: 'Traje EVA', seconds: 40, where: [],
    goal: 'Ponte el traje espacial en el orden correcto antes de salir.',
    fact: 'Ponerse el traje EMU de la Estación lleva casi una hora, y antes hay que respirar oxígeno puro para no sufrir de descompresión.' },
  soldadura: { id: 'soldadura', icon: '🔥', name: 'Reparación de casco', seconds: 30, where: [],
    goal: 'Mantén el soplete sobre la grieta mientras avanza (↑ ↓).',
    fact: 'En 1984 un cosmonauta soldó metal fuera de la estación Salyut 7: es posible, pero las gotas de metal flotan.' },
  auxilios: { id: 'auxilios', icon: '🩹', name: 'Primeros auxilios', seconds: 45, where: [],
    goal: 'Cada astronauta tiene un problema: elige el tratamiento correcto.',
    fact: 'En la Estación no hay médico de guardia: dos tripulantes por misión se entrenan como "oficiales médicos" y consultan a la Tierra por video. (Los casos del juego son ejemplos simples, no protocolos médicos de NASA.)' },
  cultivo: { id: 'cultivo', icon: '🌱', name: 'Huerto espacial', seconds: 35, where: [],
    goal: 'Mantén el agua y la luz en la zona verde para que la lechuga crezca.',
    fact: 'En 2015 los astronautas de la Estación comieron por primera vez lechuga cultivada en el espacio, en el huerto Veggie.' },
  radio: { id: 'radio', icon: '📻', name: 'Comunicaciones', seconds: 40, where: [],
    goal: 'Control deletrea con el alfabeto fonético: toca la palabra de cada letra.',
    fact: 'Por radio "B" y "D" suenan parecido. Por eso se dice Bravo y Delta: así no hay confusiones con ruido.' },
  estrellas: { id: 'estrellas', icon: '✨', name: 'Navegación estelar', seconds: 40, where: [],
    goal: 'Lleva la mira a la estrella que pide Control (↑ ↓ ← →) y toca FIJAR.',
    fact: 'Las naves usan "rastreadores de estrellas": cámaras que reconocen constelaciones para saber hacia dónde apuntan.' },
  protocolo: { id: 'protocolo', icon: '🚨', name: 'Protocolos de emergencia', seconds: 45, where: [],
    goal: 'Fuego, amoníaco o fuga: toca los pasos en el orden del manual.',
    fact: 'En la Estación hay 3 emergencias graves: fuego, despresurización y aire tóxico (amoníaco). Pasos simplificados de casos reales: el simulacro de incendio de ESA, la alarma de amoníaco de 2015 y la fuga de 2020.' },
  equipo: { id: 'equipo', icon: '🤝', name: 'Trabajo en equipo', seconds: 60, where: [],
    goal: 'Para 2 personas: una mira el MANUAL y la otra corta el cable que le digan. ¡Sin mirar las dos!',
    fact: 'En Control de Misión, quien lee el procedimiento y quien lo ejecuta son personas distintas: así se atrapan los errores.' },
};
export const ADVANCED_ORDER = ['eva', 'soldadura', 'auxilios', 'cultivo', 'radio', 'estrellas', 'protocolo', 'equipo'];

export const EVA_ORDER = ['Ropa con tubos de agua fría', 'Pantalón del traje', 'Torso duro', 'Gorro con audífonos', 'Casco', 'Guantes', 'Revisar presión', 'Abrir la esclusa'];

// Pasos simplificados para chicos a partir de fuentes públicas (ver PROTOCOL_SOURCES). No son la lista oficial de vuelo.
export const PROTOCOLS = {
  fuego: { name: '🔥 FUEGO en el laboratorio', steps: ['Suena la alarma: la ventilación se apaga sola', 'Ponerse las máscaras', 'Cortar la electricidad del equipo', 'Usar el extintor de CO₂', 'Medir el aire antes de sacarse las máscaras'] },
  amoniaco: { name: '☠️ AMONÍACO en el aire', steps: ['Suena la alarma de amoníaco', 'Ponerse las máscaras', 'Ir al segmento ruso', 'Cerrar la escotilla detrás', 'Volver solo cuando el aire esté limpio'] },
  fuga: { name: '💨 FUGA de aire (lenta, como la de 2020)', steps: ['Juntarse todos en un mismo lugar', 'Cerrar escotillas para separar los módulos', 'Ver en qué módulo baja la presión', 'Buscar el agujero con el detector', 'Parchar la grieta'] },
};

/** De dónde salen los pasos (fuentes públicas de NASA y ESA). */
export const PROTOCOL_SOURCES = [
  ['NASA: historia de las operaciones de emergencia de la Estación (fuego, despresurización, aire tóxico)', 'https://ntrs.nasa.gov/citations/20220019247'],
  ['ESA: simulacro de incendio en la Estación (máscaras, cortar energía, extintor)', 'https://blogs.esa.int/astronauts/?p=643'],
  ['NASA: la tripulación vuelve al segmento de EE. UU. tras la alarma de amoníaco (2015)', 'https://www.nasa.gov/blogs/spacestation/2015/01/14/station-managers-allow-crew-back-in-u-s-segment/'],
  ['NASA: la tripulación pasa días en el segmento ruso para aislar la fuga (2020)', 'https://www.nasa.gov/blogs/spacestation/2020/08/24/crew-spending-another-day-in-russian-segment'],
];

export const TRIAGE = [
  { who: 'Ada', sym: 'Se golpeó la cabeza con una escotilla y sangra un poco', ok: 'Presionar con gasa y vendar', bad: ['Darle agua', 'Que haga ejercicio'] },
  { who: 'Leo', sym: 'Tiene mareos y vómitos el primer día en órbita', ok: 'Medicina para el mareo y descansar', bad: ['Volver a la Tierra ya', 'Comer mucho'] },
  { who: 'Iris', sym: 'Le entró polvo lunar en el ojo', ok: 'Lavar el ojo con agua limpia', bad: ['Frotarse fuerte', 'Ponerse el casco'] },
  { who: 'Tomás', sym: 'Le duelen los huesos después de meses flotando', ok: 'Ejercicio en la cinta y bici 2 h al día', bad: ['Dormir más', 'Dejar de comer'] },
  { who: 'Ada', sym: 'Se quemó la mano con un cable caliente', ok: 'Enfriar con agua y cubrir con gasa', bad: ['Poner hielo directo', 'Ignorarlo'] },
  { who: 'Leo', sym: 'Le duele mucho una muela', ok: 'Consultar al dentista de la Tierra por video', bad: ['Sacarla solo', 'Comer chocolate'] },
  { who: 'Iris', sym: 'No puede dormir hace 3 días', ok: 'Horario fijo, luz baja y antifaz', bad: ['Tomar mucho café', 'Trabajar toda la noche'] },
];

export const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Eco', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
export const RADIO_WORDS = ['LUNA', 'MARTE', 'NOVA', 'ORION', 'GO', 'SOL', 'ISS', 'EVA'];

/** Reglas del manual del trabajo en equipo: qué cable cortar según los cables que hay. */
export const WIRE_COLORS = ['rojo', 'azul', 'amarillo', 'blanco'];
export function wireToCut(wires) {
  const n = (c) => wires.filter((w) => w === c).length;
  if (n('rojo') === 0) return wires.length - 1; // sin rojo: el último
  if (n('azul') >= 2) return wires.lastIndexOf('azul'); // 2+ azules: el último azul
  if (wires[0] === 'amarillo') return 0; // primero amarillo: el primero
  if (n('blanco') === 1) return wires.indexOf('blanco'); // un solo blanco: ese
  return 1; // si no: el segundo
}
export const MANUAL = [
  'Si NO hay cables rojos → corta el ÚLTIMO.',
  'Si hay 2 o más azules → corta el ÚLTIMO AZUL.',
  'Si el PRIMERO es amarillo → corta el PRIMERO.',
  'Si hay UN solo blanco → corta el BLANCO.',
  'Si nada de eso → corta el SEGUNDO.',
];

/** Puntaje del huerto: fracción del tiempo con agua y luz en zona. */
export const inZone = (v, lo = 0.4, hi = 0.8) => v >= lo && v <= hi;

/** Preguntas de 3 opciones al terminar cada prueba (ok = índice correcto). */
export const TRAINING_QUIZ = {
  flotar: [{ q: '¿Por qué flotan los astronautas?', a: ['No hay gravedad en el espacio', 'Caen todo el tiempo alrededor de la Tierra junto con la nave', 'Usan imanes'], ok: 1 }],
  acople: [{ q: '¿A qué velocidad llega una nave a acoplarse?', a: ['10 cm por segundo', '100 km/h', 'Muy rápido para ahorrar tiempo'], ok: 0 }],
  brazo: [{ q: '¿Cómo se llama el brazo robótico de la Estación?', a: ['Canadarm2', 'Robonauta', 'Brazo X'], ok: 0 }],
  luna: [{ q: 'En la Luna pesas…', a: ['Igual que en la Tierra', '6 veces menos', 'Nada'], ok: 1 }],
  centrifuga: [{ q: '¿Qué ayuda a aguantar las fuerzas G?', a: ['Apretar piernas y abdomen y respirar fuerte', 'Dormir', 'Cerrar los ojos'], ok: 0 }],
  rover: [{ q: '¿Por qué no se maneja un rover de Marte en vivo?', a: ['La señal tarda varios minutos', 'Es muy caro', 'No tiene volante'], ok: 0 }],
  eva: [{ q: '¿Qué se hace antes de salir con el traje?', a: ['Respirar oxígeno puro para sacar el nitrógeno', 'Comer mucho', 'Nada'], ok: 0 }],
  soldadura: [{ q: '¿Qué pasa con las gotas de metal al soldar en el espacio?', a: ['Caen al suelo', 'Flotan', 'Se congelan al instante'], ok: 1 }],
  auxilios: [{ q: '¿Qué hace la tripulación si hay un problema médico?', a: ['Vuelve siempre a la Tierra', 'Lo atiende el oficial médico con ayuda de la Tierra', 'Espera a que pase'], ok: 1 }],
  cultivo: [{ q: '¿Qué verdura comieron primero en la Estación?', a: ['Papa', 'Lechuga', 'Tomate'], ok: 1 }],
  radio: [{ q: '¿Cómo se dice la letra M por radio?', a: ['Mike', 'Mamá', 'Marte'], ok: 0 }],
  estrellas: [{ q: '¿Para qué sirve un rastreador de estrellas?', a: ['Para saber hacia dónde apunta la nave', 'Para hacer fotos bonitas', 'Para contar estrellas'], ok: 0 }],
  protocolo: [{ q: 'En una fuga de aire, ¿qué se hace primero?', a: ['Salir al espacio', 'Juntarse en un lugar seguro', 'Abrir todas las escotillas'], ok: 1 }],
  equipo: [{ q: '¿Por qué una persona lee y otra ejecuta?', a: ['Para atrapar errores', 'Por aburrimiento', 'Porque es más rápido solo'], ok: 0 }],
};
