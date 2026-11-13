// Fechas como texto 'AAAA-MM-DD' (día local). Se calculan en UTC para evitar saltos por zona horaria.
const TZ = 'America/Argentina/Buenos_Aires';
const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function hoy() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

const aMs = (f) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const deMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export const sumarDias = (f, n) => deMs(aMs(f) + n * 86400000);

// 1 = lunes ... 7 = domingo
export function diaISO(f) {
  const d = new Date(aMs(f)).getUTCDay();
  return d === 0 ? 7 : d;
}

export const lunesDe = (f) => sumarDias(f, -(diaISO(f) - 1));

export function rango(desde, hasta) {
  const r = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) r.push(f);
  return r;
}

export function etiquetaLarga(f) {
  const [, m, d] = f.split('-');
  return `${NOMBRES_DIA[diaISO(f)]} ${Number(d)}/${Number(m)}`;
}
