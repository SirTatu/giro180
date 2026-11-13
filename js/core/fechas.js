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

// Fecha y hora legible en hora de Argentina, a partir de un instante ISO (timestamptz).
// Se arma a mano con las partes para que se vea igual en todos los navegadores: "mié 18/11 15:30".
export function formatoFechaHora(iso) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-AR', {
      timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  const hora = partes.hour === '24' ? '00' : partes.hour;
  return `${partes.weekday} ${partes.day}/${partes.month} ${hora}:${partes.minute}`;
}
