// Base de alimentos (hito 3-6a): validación, porciones y cálculo de macros. Lógica pura: sin pantalla ni base de datos.
// Pruebas en tests/alimentos.test.mjs. Los valores de un alimento son POR 100 g (o por 100 ml). Una macro que no se cargó
// nunca se cuenta como 0: en un alimento las 4 son obligatorias (si es cero se escribe 0); en una comida pueden faltar.
import { parsearNumero, formatoNumero } from './entrenos.js';
import { TIPOS_COMIDA, validarProteina } from './nutri.js';

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

// ---------- comidas con macros (hito 3-6b) ----------
// Máximos que acepta la base de datos en una comida (columnas de meals).
const LIMITES_COMIDA = { kcal: 10000, carbs: 1000, protein: 500, fat: 1000 };

function macroOpcional(texto, nombre, max) {
  const v = parsearNumero(texto);
  if (v === null) return { valor: null, error: null };                      // vacío = «sin dato», nunca 0
  if (Number.isNaN(v) || v > max || Math.round(v * 10) / 10 !== v) {
    return { valor: null, error: `Revisá ${nombre}: un número entre 0 y ${formatoNumero(max)}, con un decimal como máximo (o dejalo vacío).` };
  }
  return { valor: v, error: null };
}

const validarTipoYDescripcion = (tipo, descripcion) => {
  if (!TIPOS_COMIDA.some((t) => t.id === tipo)) return { error: 'Elegí el tipo de comida.' };
  const d = String(descripcion ?? '').trim();
  if (!d) return { error: 'Escribí qué comiste.' };
  if (d.length > 300) return { error: 'La descripción es demasiado larga (máximo 300 caracteres).' };
  return { error: null, d };
};

// Comida cargada a mano: las 4 macros son opcionales (vacío = NULL, sin dato).
export function validarComidaManual({ tipo, descripcion, kcal, carbs, proteina, grasas }) {
  const td = validarTipoYDescripcion(tipo, descripcion);
  if (td.error) return { error: td.error };
  const p = validarProteina(proteina);
  if (p.error) return { error: p.error };
  const k = macroOpcional(kcal, 'las calorías', LIMITES_COMIDA.kcal); if (k.error) return { error: k.error };
  const c = macroOpcional(carbs, 'los carbohidratos', LIMITES_COMIDA.carbs); if (c.error) return { error: c.error };
  const g = macroOpcional(grasas, 'las grasas', LIMITES_COMIDA.fat); if (g.error) return { error: g.error };
  return {
    error: null,
    datos: { meal_type: tipo, description: td.d, calories_kcal: k.valor, carbs_g: c.valor, protein_g: p.valor, fat_g: g.valor, food_id: null, food_name: null, amount: null }
  };
}

// Opciones para cargar la cantidad: gramos/ml del alimento o cada una de sus porciones.
export function opcionesCantidad(alimento, porciones) {
  const propias = (porciones ?? []).filter((p) => p.food_id === alimento.id).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  return [
    { id: 'base', texto: alimento.base_unit, porcion: null },
    ...propias.map((p) => ({ id: p.id, texto: `${p.name} (${formatoNumero(p.amount)} ${alimento.base_unit})`, porcion: p }))
  ];
}

const dentroDeLimites = (m) => {
  const nombres = { kcal: 'calorías', carbs: 'carbohidratos', protein: 'proteínas', fat: 'grasas' };
  for (const k of Object.keys(LIMITES_COMIDA)) {
    if (m[k] > LIMITES_COMIDA[k]) return `Esa cantidad da ${formatoNumero(m[k])} de ${nombres[k]}, más de lo que acepta una sola comida (${formatoNumero(LIMITES_COMIDA[k])}). Revisá la cantidad.`;
  }
  return null;
};

// Cantidad en g/ml (o número de porciones) -> cantidad total y macros. Sirve para la vista previa y para guardar.
export function calcularCantidad(alimento, opcion, texto) {
  if (!alimento) return { error: 'Elegí un alimento.' };
  const n = parsearNumero(texto);
  if (n === null) return { error: 'Escribí la cantidad.' };
  if (Number.isNaN(n) || n <= 0 || Math.round(n * 10) / 10 !== n) return { error: 'La cantidad debe ser un número mayor que 0, con un decimal como máximo.' };
  const amount = opcion?.porcion ? cantidadDePorcion(opcion.porcion, n) : n;
  if (amount > 10000) return { error: 'La cantidad no puede pasar de 10000 (g o ml).' };
  const macros = macrosDeCantidad(alimento, amount);
  const limite = dentroDeLimites(macros);
  if (limite) return { error: limite };
  return { error: null, amount, macros };
}

// Comida a partir de un alimento. Guarda una FOTO (nombre, cantidad y macros calculadas): si después cambia o se borra
// el alimento, el historial no se altera.
export function comidaDeAlimento({ tipo, alimento, opcion, cantidad }) {
  if (!TIPOS_COMIDA.some((t) => t.id === tipo)) return { error: 'Elegí el tipo de comida.' };
  const c = calcularCantidad(alimento, opcion, cantidad);
  if (c.error) return { error: c.error };
  return {
    error: null,
    datos: {
      meal_type: tipo, description: alimento.name, calories_kcal: c.macros.kcal, carbs_g: c.macros.carbs, protein_g: c.macros.protein,
      fat_g: c.macros.fat, food_id: alimento.id, food_name: alimento.name, amount: c.amount
    },
    amount: c.amount, macros: c.macros
  };
}

// Cambiar la cantidad de una comida ya cargada: se recalcula PROPORCIONALMENTE desde lo que quedó guardado
// (no desde el alimento actual). Una macro que no tenía dato sigue sin dato.
export function reescalarComida(comida, texto) {
  const viejo = Number(comida?.amount);
  if (!(viejo > 0)) return { error: 'Esta comida no tiene una cantidad guardada.' };
  const n = parsearNumero(texto);
  if (n === null) return { error: 'Escribí la cantidad.' };
  if (Number.isNaN(n) || n <= 0 || Math.round(n * 10) / 10 !== n) return { error: 'La cantidad debe ser un número mayor que 0, con un decimal como máximo.' };
  if (n > 10000) return { error: 'La cantidad no puede pasar de 10000.' };
  const f = n / viejo;
  const esc = (v) => (v == null ? null : r1(Number(v) * f));
  const datos = { amount: n, calories_kcal: esc(comida.calories_kcal), carbs_g: esc(comida.carbs_g), protein_g: esc(comida.protein_g), fat_g: esc(comida.fat_g) };
  const limite = dentroDeLimites({ kcal: datos.calories_kcal ?? 0, carbs: datos.carbs_g ?? 0, protein: datos.protein_g ?? 0, fat: datos.fat_g ?? 0 });
  if (limite) return { error: limite };
  return { error: null, datos };
}

// Totales del día por macro: suma solo lo cargado. total = null si ninguna comida tiene ese dato (no es lo mismo que 0).
export function totalesMacros(comidas) {
  const out = { cantidad: comidas.length };
  for (const m of MACROS) {
    let suma = 0, con = 0;
    for (const c of comidas) if (c[m.comida] != null) { suma += Number(c[m.comida]); con++; }
    out[m.id] = { total: con ? r1(suma) : null, conDato: con, sinDato: comidas.length - con };
  }
  return out;
}

// Totales de cada macro por día: Map fecha -> totalesMacros(comidas de ese día). Sirve para el Historial y los Informes.
export function totalesMacrosPorDia(comidas) {
  const porDia = new Map();
  for (const c of comidas) {
    if (!porDia.has(c.eaten_on)) porDia.set(c.eaten_on, []);
    porDia.get(c.eaten_on).push(c);
  }
  return new Map([...porDia].map(([f, lista]) => [f, totalesMacros(lista)]));
}

// «198 kcal · C 0 · P 37,2 · G 4,3»: solo lo que tiene dato.
export function textoMacrosComida(c) {
  const partes = [];
  if (c.calories_kcal != null) partes.push(`${formatoNumero(c.calories_kcal)} kcal`);
  if (c.carbs_g != null) partes.push(`C ${formatoNumero(c.carbs_g)}`);
  if (c.protein_g != null) partes.push(`P ${formatoNumero(c.protein_g)}`);
  if (c.fat_g != null) partes.push(`G ${formatoNumero(c.fat_g)}`);
  return partes.length ? partes.join(' · ') : 'Sin macros cargadas';
}

// «2 comidas sin dato de calorías.» para cada macro con faltantes.
export function avisosMacros(totales) {
  const nombres = { kcal: 'calorías', carbs: 'carbohidratos', protein: 'proteínas', fat: 'grasas' };
  const out = [];
  for (const m of MACROS) {
    const t = totales[m.id];
    if (t.sinDato > 0 && totales.cantidad > 0) out.push(`${t.sinDato === 1 ? '1 comida' : `${t.sinDato} comidas`} sin dato de ${nombres[m.id]}.`);
  }
  return out;
}
