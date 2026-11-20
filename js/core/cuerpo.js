// Lógica pura de PASOS y EVOLUCIÓN CORPORAL (hito 3-3). Sin pantalla ni base de datos.
// Pruebas en tests/cuerpo.test.mjs. Los estados de los pasos (cumplido / incumplido / no registrado / sin actividad)
// se deciden SIEMPRE en estados.js: acá solo se arman números a partir de ellos.
import { rango, sumarDias, lunesDe } from './fechas.js';
import { resumenSerie, logsDeSerie } from './estados.js';
import { parsearNumero, buscarHabitoDeGym, formatoNumero } from './entrenos.js';

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const decimales = (n, max) => Math.round(n * 10 ** max) / 10 ** max === n;

// «Pasos»: hábito de Gym de tipo cantidad (nombre con «paso»).
export const buscarHabitoPasos = (defs, fecha) => buscarHabitoDeGym(defs, fecha, 'quantity', /paso/);

// Texto -> pasos enteros (0 a 200000) o error.
export function validarPasos(texto) {
  const n = parsearNumero(texto);
  if (n === null) return { valor: null, error: 'Escribí la cantidad de pasos.' };
  if (Number.isNaN(n) || !Number.isInteger(n) || n > 200000) return { valor: null, error: 'Los pasos deben ser un número entero entre 0 y 200000.' };
  return { valor: n, error: null };
}

// Resumen de pasos de un período. Los días sin registro NO cuentan como 0: el promedio es sobre los días con dato.
// versiones: todas las versiones del hábito; logs: sus registros; hasta no debe superar hoy.
export function resumenPasos(versiones, logs, desde, hasta) {
  const porFecha = logsDeSerie(versiones, logs);
  const datos = [];
  for (const f of rango(desde, hasta)) {
    const l = porFecha.get(f);
    if (l && l.value != null) datos.push({ fecha: f, valor: Number(l.value) });
  }
  const total = datos.reduce((a, d) => a + d.valor, 0);
  let mejor = null;
  for (const d of datos) if (!mejor || d.valor > mejor.valor) mejor = d;
  return {
    estados: resumenSerie(versiones, logs, desde, hasta),
    conDato: datos.length, total,
    promedio: datos.length ? Math.round(total / datos.length) : null, mejor
  };
}

// Peso y cintura (texto) -> números o errores. Al menos uno de los dos. Peso: 2 decimales; cintura: 1 decimal.
export function validarMedida({ peso, cintura }) {
  const errores = [];
  const p = parsearNumero(peso), c = parsearNumero(cintura);
  if (Number.isNaN(p) || (p !== null && (p < 20 || p > 500 || !decimales(p, 2)))) errores.push('El peso debe estar entre 20 y 500 kg (hasta 2 decimales).');
  if (Number.isNaN(c) || (c !== null && (c < 30 || c > 250 || !decimales(c, 1)))) errores.push('La cintura debe estar entre 30 y 250 cm (hasta 1 decimal).');
  if (p === null && c === null) errores.push('Cargá el peso, la cintura o ambos.');
  return { peso: p, cintura: c, errores };
}

// Tendencia de una medida (campo: 'weight_kg' o 'waist_cm') en números.
// filas: body_measurements [{measured_on, weight_kg, waist_cm}]. Los días sin medición no cuentan: nunca son 0.
// Todo lo que no se puede calcular por falta de datos es null («sin base de comparación»), no cero.
export function tendenciaMedidas(filas, campo, hasta, dias = 30) {
  const desde = sumarDias(hasta, -(dias - 1));
  const serie = filas.filter((f) => f[campo] != null && f.measured_on <= hasta)
    .map((f) => ({ fecha: f.measured_on, valor: Number(f[campo]) }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const periodo = serie.filter((x) => x.fecha >= desde);
  const promedio = (a, b) => {
    const v = serie.filter((x) => x.fecha >= a && x.fecha <= b);
    return v.length ? { valor: r1(v.reduce((s, x) => s + x.valor, 0) / v.length), n: v.length } : null;
  };
  const ultimo = serie.length ? serie[serie.length - 1] : null;
  const actual = promedio(sumarDias(hasta, -6), hasta);
  const previo = promedio(sumarDias(hasta, -13), sumarDias(hasta, -7));

  // ritmo por semana (regresión lineal sobre el período): solo con 3+ mediciones que abarquen 7+ días
  let ritmoSemanal = null;
  if (periodo.length >= 3) {
    const base = periodo[0].fecha;
    const pts = periodo.map((x) => ({ x: rango(base, x.fecha).length - 1, y: x.valor }));
    if (pts[pts.length - 1].x >= 7) {
      const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
      if (den > 0) ritmoSemanal = r2((pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den) * 7);
    }
  }

  // promedio por semana (lunes a domingo), últimas 8 semanas, la más nueva primero; cambio contra la semana anterior CON datos
  const semanas = [];
  for (let k = 0; k < 8; k++) {
    const lunes = sumarDias(lunesDe(hasta), -7 * k);
    const v = serie.filter((x) => x.fecha >= lunes && x.fecha <= sumarDias(lunes, 6));
    if (v.length) semanas.push({ semana: lunes, promedio: r1(v.reduce((s, x) => s + x.valor, 0) / v.length), n: v.length });
  }
  semanas.forEach((w, i) => { const sig = semanas[i + 1]; w.cambio = sig ? r1(w.promedio - sig.promedio) : null; });

  return {
    n: periodo.length, ultimo,
    diasDesdeUltimo: ultimo ? rango(ultimo.fecha, hasta).length - 1 : null,
    primeroPeriodo: periodo[0] ?? null,
    cambioPeriodo: periodo.length >= 2 ? r1(periodo[periodo.length - 1].valor - periodo[0].valor) : null,
    min: periodo.length ? Math.min(...periodo.map((x) => x.valor)) : null,
    max: periodo.length ? Math.max(...periodo.map((x) => x.valor)) : null,
    promedio7: actual, promedio7Previo: previo,
    deltaSemana: actual && previo ? r1(actual.valor - previo.valor) : null,
    ritmoSemanal, semanas
  };
}

// Cambio con signo para mostrar: +1,5 kg / −0,7 kg / sin cambios; null si no hay dato (hay que decir «sin base»).
export function formatoDelta(n, unidad) {
  if (n == null) return null;
  if (n === 0) return 'sin cambios';
  return `${n > 0 ? '+' : '−'}${formatoNumero(Math.abs(n))} ${unidad}`.trim();
}
