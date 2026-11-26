// Lógica pura de NUTRI (comidas). Sin pantalla ni base de datos. Pruebas en tests/nutri.test.mjs.
// Los estados los decide siempre estados.js. Las macros (totales, objetivos, cumplido/excedido automáticos, cierre del día y
// resúmenes de un período) viven en alimentos.js y macros.js; el agua, en agua.js. Acá quedan los tipos de comida y la
// validación de la proteína de una comida.
import { parsearNumero } from './entrenos.js';

export const TIPOS_COMIDA = [
  { id: 'desayuno', nombre: 'Desayuno' }, { id: 'almuerzo', nombre: 'Almuerzo' }, { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' }, { id: 'colacion', nombre: 'Colación' }, { id: 'otro', nombre: 'Otro' }
];
export const nombreTipo = (id) => TIPOS_COMIDA.find((t) => t.id === id)?.nombre ?? id;

// Marca en habit_logs.note de un cierre manual del día: la app no lo modifica sola (hay que reabrir el día).
export const NOTA_CIERRE = 'cierre-dia';

// ---------- validación ----------
// Proteína opcional: vacío = null (NO cargada, nunca 0). Hasta 500 g con un decimal.
export function validarProteina(texto) {
  const n = parsearNumero(texto);
  if (n === null) return { valor: null, error: null };
  if (Number.isNaN(n) || n > 500 || Math.round(n * 10) / 10 !== n) {
    return { valor: null, error: 'La proteína debe ser un número entre 0 y 500 g, con un decimal como máximo (o dejala vacía).' };
  }
  return { valor: n, error: null };
}
