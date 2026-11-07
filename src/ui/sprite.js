// Astronauta de perfil en pixel art, compartido por Recorrido y Excavar.
// Astronauta de perfil en pixel art (12×16), dibujado con el color de la consola. Dos cuadros de paso.
const BODY = [
  '...HHHH.....', '..HHHHHH....', '..HHVVVV....', '..HHVVVV....', '..HHHHHH....', '...HHHH.....',
  '.BBSSSSS....', '.BBSSSSSS...', '.BBSSSSSAA..', '.BBSSSSS....', '...SSSS.....', '...SSSS.....',
];
const LEGS = [
  ['..SS..SS....', '..SS...SS...', '.SS.....SS..', '.DD.....DD..'],
  ['...SS.SS....', '...SS.SS....', '...SS.SS....', '...DD.DD....'],
];
const PIX = { H: 'px-casco', V: 'px-visor', S: 'px-traje', B: 'px-mochila', A: 'px-traje', D: 'px-bota' };
function frame(rows, cls) {
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PIX[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" class="${PIX[ch]}"/>`; }));
  return `<g class="${cls}">${r}</g>`;
}
export const SPRITE = `<svg viewBox="0 0 12 16" shape-rendering="crispEdges">${frame(BODY, 'cuerpo')}${frame(BODY.map(() => '').concat(LEGS[0]), 'paso paso-a')}${frame(BODY.map(() => '').concat(LEGS[1]), 'paso paso-b')}</svg>`;

