import { DONKI_2024 } from '../data/donki-snapshot.js';

const dayOfYear = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
};
const fromDate = (date, cls) => ({ day: dayOfYear(date), cls, date: date.slice(0, 10) });
const respaldo = () => ({ source: 'respaldo', flares: DONKI_2024.map((f) => fromDate(f.date, f.cls)) });

export async function fetchFlares({ year = 2024, fetchImpl = globalThis.fetch, timeoutMs = 4000 } = {}) {
  const ctl = new AbortController();
  let timer;
  const limite = new Promise((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new Error('timeout')); }, timeoutMs); });
  const url = `https://api.nasa.gov/DONKI/FLR?startDate=${year}-01-01&endDate=${year}-12-31&api_key=DEMO_KEY`;
  try {
    const datos = await Promise.race([
      (async () => {
        const res = await fetchImpl(url, { signal: ctl.signal });
        if (!res || res.ok === false) throw new Error('http');
        return res.json();
      })(),
      limite,
    ]);
    if (!Array.isArray(datos)) throw new Error('formato');
    const flares = datos
      .filter((f) => f && typeof f.beginTime === 'string' && typeof f.classType === 'string')
      .map((f) => fromDate(f.beginTime, f.classType));
    if (!flares.length) throw new Error('vacío');
    return { source: 'donki', flares };
  } catch {
    return respaldo();
  } finally {
    clearTimeout(timer);
  }
}

// `difficulty` se reserva para escalar la gravedad en el futuro; hoy no se usa.
export function flaresToStorms(flares, difficulty) {
  void difficulty;
  const out = [];
  for (const f of flares) {
    const letra = f.cls[0].toUpperCase();
    const n = parseFloat(f.cls.slice(1));
    let severity = null;
    if (letra === 'X') severity = 'grave';
    else if (letra === 'M') severity = n >= 5 ? 'media' : 'leve';
    if (severity) out.push({ day: f.day, severity, date: f.date, cls: f.cls });
  }
  return out.sort((a, b) => a.day - b.day);
}
