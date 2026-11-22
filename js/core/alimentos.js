// Base de alimentos (hito 3-6a): validación, porciones y cálculo de macros. Lógica pura: sin pantalla ni base de datos.
// Pruebas en tests/alimentos.test.mjs. Los valores de un alimento son POR 100 g (o por 100 ml). Una macro que no se cargó
// nunca se cuenta como 0: en un alimento las 4 son obligatorias (si es cero se escribe 0); en una comida pueden faltar.
import { parsearNumero, formatoNumero } from './entrenos.js';

export const MACROS = [
  { id: 'kcal', nombre: 'Calorías', unidad: 'kcal', comida: 'calories_kcal', alimento: 'kcal_100' },
  { id: 'carbs', nombre: 'Carbohidratos', unidad: 'g', comida: 'carbs_g', alimento: 'carbs_100' },
  { id: 'protein', nombre: 'Proteínas', unidad: 'g', comida: 'protein_g', alimento: 'protein_100' },
  { id: 'fat', nombre: 'Grasas', unidad: 'g', comida: 'fat_g', alimento: 'fat_100' }
];
export const UNIDADES_BASE = [{ id: 'g', nombre: 'g (por 100 g)' }, { id: 'ml', nombre: 'ml (por 100 ml)' }];

const r1 = (n) => Math.round(n * 10) / 10;

// ---------- validación ----------
export function validarAlimento({ nombre, unidad, kcal, carbs, proteina, grasas }) {
  const n = String(nombre ?? '').trim();
  if (!n) return { error: 'Ponele un nombre al alimento.' };
  if (n.length > 80) return { error: 'El nombre es demasiado largo (máximo 80 caracteres).' };
  if (!UNIDADES_BASE.some((u) => u.id === unidad)) return { error: 'Elegí si los valores son por 100 g o por 100 ml.' };
  const campos = [
    ['las calorías', kcal, 1000, 'kcal_100'], ['los carbohidratos', carbs, 100, 'carbs_100'],
    ['las proteínas', proteina, 100, 'protein_100'], ['las grasas', grasas, 100, 'fat_100']
  ];
  const datos = { name: n, base_unit: unidad };
  for (const [nombreCampo, texto, max, col] of campos) {
    const v = parsearNumero(texto);
    if (v === null) return { error: `Falta cargar ${nombreCampo} (si es cero, escribí 0).` };
    if (Number.isNaN(v) || v > max || Math.round(v * 10) / 10 !== v) {
      return { error: `Revisá ${nombreCampo}: un número entre 0 y ${formatoNumero(max)}, con un decimal como máximo.` };
    }
    datos[col] = v;
  }
  if (r1(datos.carbs_100 + datos.protein_100 + datos.fat_100) > 100.5) {
    return { error: `Carbohidratos, proteínas y grasas suman ${formatoNumero(r1(datos.carbs_100 + datos.protein_100 + datos.fat_100))}: por 100 ${unidad} no pueden pasar de 100. Revisá los valores.` };
  }
  return { error: null, datos };
}

export function validarPorcion({ nombre, cantidad }) {
  const n = String(nombre ?? '').trim();
  if (!n) return { error: 'Ponele un nombre a la porción (por ejemplo «1 huevo»).' };
  if (n.length > 40) return { error: 'El nombre de la porción es demasiado largo (máximo 40 caracteres).' };
  const v = parsearNumero(cantidad);
  if (v === null) return { error: 'Escribí cuánto pesa o mide la porción.' };
  if (Number.isNaN(v) || v <= 0 || v > 5000 || Math.round(v * 10) / 10 !== v) {
    return { error: 'La porción debe ser un número mayor que 0 y hasta 5000, con un decimal como máximo.' };
  }
  return { error: null, datos: { name: n, amount: v } };
}

// ---------- cálculo ----------
// Macros de una cantidad (en g o ml) de un alimento: valor por 100 × cantidad / 100, a 1 decimal.
export function macrosDeCantidad(alimento, cantidad) {
  const c = Number(cantidad);
  if (!alimento || !(c > 0)) return null;
  const por = (v) => r1((Number(v) * c) / 100);
  return { kcal: por(alimento.kcal_100), carbs: por(alimento.carbs_100), protein: por(alimento.protein_100), fat: por(alimento.fat_100) };
}

// Cantidad total a partir de porciones: 2 porciones de 50 g = 100 g.
export function cantidadDePorcion(porcion, veces) {
  const v = Number(veces);
  if (!porcion || !(v > 0)) return null;
  return r1(Number(porcion.amount) * v);
}

// ---------- ayudas ----------
// Calorías que salen de las macros (4·C + 4·P + 9·G). Solo orientativo: la etiqueta manda (fibra, alcohol, redondeos).
export const kcalEstimadas = ({ carbs, protein, fat }) => Math.round(4 * Number(carbs) + 4 * Number(protein) + 9 * Number(fat));

// Aviso no bloqueante si las calorías y las macros no cierran (más de 20 % de diferencia, con al menos 20 kcal de diferencia).
export function avisoCoherencia(datos) {
  const est = kcalEstimadas({ carbs: datos.carbs_100, protein: datos.protein_100, fat: datos.fat_100 });
  const kcal = Number(datos.kcal_100);
  const dif = Math.abs(kcal - est);
  if (dif < 20 || dif <= 0.2 * Math.max(kcal, est)) return null;
  return `Ojo: las macros suman unas ${est} kcal y cargaste ${formatoNumero(kcal)}. Si la etiqueta dice eso (fibra, alcohol), ignorá este aviso.`;
}

export const resumenAlimento = (a) =>
  `${formatoNumero(a.kcal_100)} kcal · C ${formatoNumero(a.carbs_100)} · P ${formatoNumero(a.protein_100)} · G ${formatoNumero(a.fat_100)} por 100 ${a.base_unit}`;

// Búsqueda sin distinguir mayúsculas ni tildes («cafe» encuentra «Café»).
const plano = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const filtrarAlimentos = (lista, texto) => {
  const q = plano(texto);
  return q ? lista.filter((a) => plano(a.name).includes(q)) : lista;
};
