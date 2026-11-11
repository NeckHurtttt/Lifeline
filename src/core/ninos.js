// VERSIÓN NIÑOS: reglas propias (puras). Menos ventanas de texto, emergencias seguras y estrellas con metas claras.
// Todo se activa solo con state.kids; la versión completa no pasa por aquí.

/** Las misiones largas (Marte en demo: 120 días) tienen los mismos problemas por partida que las cortas. */
export const kidsEventMult = (s) => Math.min(1, 60 / (s.totalDays || 60));

/** Como mucho estos problemas (ventanas de texto) por partida. */
export const KIDS_MAX_PROBLEMS = 4;

/** Días en que llega una emergencia (alarma con reloj): 3 por partida, repartidas. */
export const KIDS_FLASH_AT = [0.22, 0.5, 0.78];
export function kidsFlashDay(s) {
  const i = s.kidsFlashes ?? 0;
  if (i >= KIDS_FLASH_AT.length) return null;
  return Math.max(4, Math.round(KIDS_FLASH_AT[i] * (s.totalDays || 60)));
}

/** Cuánto de algo hay que hacer bien para ganar la estrella (2 de 3, 3 de 4…). */
const enough = (good, total) => total === 0 || good / total >= 2 / 3 - 1e-9;

/**
 * Las 3 estrellas: volver a casa, elegir bien en los problemas y ganar las alarmas.
 * Sin volver a casa no hay estrellas (pero se muestra qué salió bien).
 */
export function kidStars(s, rep) {
  const ch = s.kidsChoices ?? { good: 0, total: 0 };
  const fl = s.flashStats ?? { ok: 0, total: 0 };
  const goals = [
    { id: 'casa', ok: !!rep.success, text: rep.success ? 'Volvieron a casa' : 'No volvieron a casa' },
    { id: 'problemas', ok: enough(ch.good, ch.total), text: ch.total ? `Problemas bien resueltos: ${ch.good} de ${ch.total}` : 'No hubo problemas' },
    { id: 'alarmas', ok: enough(fl.ok, fl.total), text: fl.total ? `Alarmas ganadas: ${fl.ok} de ${fl.total}` : 'No sonó ninguna alarma' },
  ];
  const stars = rep.success ? goals.filter((g) => g.ok).length : 0;
  return { stars, goals };
}

/** Por qué no salió, en palabras de niño. */
export function kidReason(rep) {
  const r = rep.reason ?? '';
  if (/combustible para despegar/i.test(r)) return 'No alcanzó el combustible para salir de Marte. Los astronautas se quedaron esperando un rescate.';
  if (/escudo/i.test(r)) return 'El escudo de la cápsula se rompió al entrar a la Tierra.';
  if (/Evacuaci|volver antes|volvió antes/i.test(r)) return 'Los astronautas tuvieron que volver antes de tiempo porque había peligro.';
  if (/ox[ií]geno/i.test(r)) return 'Se acabó el aire.';
  if (/agua/i.test(r)) return 'Se acabó el agua.';
  if (/comida/i.test(r)) return 'Se acabó la comida.';
  if (/Aborto|retorno libre|camino al destino/i.test(r)) return 'El cohete tuvo una falla y hubo que volver.';
  return r || 'La misión terminó antes de tiempo.';
}

/** Qué hacer para ganar la estrella que faltó. */
export function kidTip(rep, goals) {
  if (!rep.success) {
    if (/combustible para despegar/i.test(rep.reason ?? '')) return 'En Marte, deja siempre prendida y arreglada la PLANTA DE COMBUSTIBLE.';
    return 'Cuida que nunca falte AIRE, AGUA, COMIDA ni LUZ, y elige lo RECOMENDADO en los problemas.';
  }
  if (!goals.find((g) => g.id === 'problemas').ok) return 'En los problemas, lee las opciones y elige el botón RECOMENDADO.';
  if (!goals.find((g) => g.id === 'alarmas').ok) return 'Cuando suene una alarma, haz rápido lo que dice el cuadro.';
  return '¡Eres de Control de Misión de verdad!';
}
