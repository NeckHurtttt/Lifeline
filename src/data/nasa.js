// Datos reales para las lecturas de sensores, el "¿Sabías que…?" y la pestaña DATA (con fuentes).

/** Lecturas de cada destino (valores reales redondeados). */
export const SENSORS = {
  estacion: { grav: '≈ 0 g (caída libre)', temp: '−157 °C a la sombra · +121 °C al sol', rad: '≈ 0,5 mSv por día', dia: 'una vuelta cada 92 min', pres: '1 atm adentro · vacío afuera', radNum: 0.5, src: 'NASA ISS' },
  gateway: { grav: '≈ 0 g', temp: '−170 °C a +120 °C', rad: '≈ 1,8 mSv por día (espacio profundo)', dia: 'órbita de 7 días alrededor de la Luna', pres: 'vacío', radNum: 1.8, src: 'NASA Artemis / MSL RAD' },
  luna: { grav: '0,17 g (1,62 m/s²)', temp: '−173 °C de noche · +127 °C de día; −240 °C en cráteres del polo', rad: '≈ 1,4 mSv por día', dia: 'un día lunar dura 29,5 días de la Tierra', pres: 'casi vacío', radNum: 1.4, src: 'NASA LRO · Chang\'e 4 LND' },
  marte: { grav: '0,38 g (3,71 m/s²)', temp: '−90 °C a −20 °C en Jezero', rad: '≈ 0,7 mSv por día en el suelo', dia: 'un sol dura 24 h 37 min', pres: '0,6 % de la Tierra (6 mbar)', radNum: 0.7, src: 'NASA Perseverance MEDA · Curiosity RAD' },
};

/** "¿Sabías que…?" para pantallas de carga y transiciones. */
export const FACTS = [
  'La Estación Espacial viaja a 28 000 km/h: da una vuelta a la Tierra en 92 minutos.',
  'Los astronautas crecen hasta 5 cm en el espacio porque su columna se estira.',
  'En la Luna no hay viento: las huellas del Apolo siguen ahí después de 50 años.',
  'Un día en Marte dura 24 horas y 37 minutos. Se llama "sol".',
  'La Estación recicla el 98 % del agua, incluido el sudor y la orina.',
  'El polvo lunar es filoso como vidrio porque no hay viento ni agua que lo pulan.',
  'Un traje espacial cuesta más de 10 millones de dólares.',
  'En el espacio no se puede llorar bien: las lágrimas no caen, se quedan como una burbuja.',
  'Marte tiene el volcán más alto del sistema solar: el Monte Olimpo, de 22 km.',
  'Las misiones Artemis quieren llevar a la primera mujer a la Luna.',
  'Una señal de radio tarda 1,3 segundos en ir a la Luna y hasta 22 minutos en llegar a Marte.',
  'Los astronautas hacen 2 horas de ejercicio al día para no perder hueso ni músculo.',
  'En la Estación ven 16 amaneceres y 16 atardeceres cada día.',
  'El helicóptero Ingenuity voló 72 veces en Marte, donde el aire es 100 veces más fino.',
  'En el polo sur de la Luna hay cráteres que nunca ven el Sol y guardan hielo.',
];

/** Fuentes (pestaña DATA). */
export const SOURCES = [
  ['NASA DONKI (tormentas solares reales)', 'https://ccmc.gsfc.nasa.gov/tools/DONKI/'],
  ['NASA APOD (foto astronómica del día)', 'https://apod.nasa.gov/'],
  ['Where the ISS at? (posición de la Estación)', 'https://wheretheiss.at/'],
  ['NASA: Estación Espacial Internacional', 'https://www.nasa.gov/international-space-station/'],
  ['NASA Artemis y Gateway', 'https://www.nasa.gov/humans-in-space/artemis/'],
  ['NASA Mars 2020 Perseverance (MEDA)', 'https://science.nasa.gov/mission/mars-2020-perseverance/'],
  ['Curiosity RAD: radiación en el viaje y en Marte', 'https://science.nasa.gov/mission/msl-curiosity/'],
  ['NASA LRO: temperaturas de la Luna', 'https://science.nasa.gov/mission/lro/'],
  ['NASA Veggie: cultivos en la Estación', 'https://www.nasa.gov/missions/station/veggie/'],
  ['NASA CHAPEA: simulacro de Marte', 'https://www.nasa.gov/humans-in-space/chapea/'],
];

/** Destinos lejanos que se desbloquean (expediciones especiales). */
export const FAR = {
  europa: { icon: '🧊', name: 'Europa (luna de Júpiter)', grav: '0,13 g', temp: '−160 °C', rad: '≈ 5 400 mSv por día en la superficie: ¡mortal en 1 día!', fact: 'Bajo su hielo hay un océano con más agua que toda la Tierra. La sonda Europa Clipper llega en 2030.' },
  titan: { icon: '🟠', name: 'Titán (luna de Saturno)', grav: '0,14 g', temp: '−179 °C', rad: 'muy baja: la atmósfera espesa protege', fact: 'Tiene lagos de metano y una atmósfera más densa que la de la Tierra. El dron Dragonfly volará allí en 2034.' },
};
