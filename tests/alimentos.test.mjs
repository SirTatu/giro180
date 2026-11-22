// Pruebas de js/core/alimentos.js (ejemplos inventados). Ejecutar con:  node --test tests/alimentos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MACROS, validarAlimento, validarPorcion, macrosDeCantidad, cantidadDePorcion, kcalEstimadas, avisoCoherencia,
  resumenAlimento, filtrarAlimentos, validarComidaManual, opcionesCantidad, calcularCantidad, comidaDeAlimento, reescalarComida,
  totalesMacros, textoMacrosComida, avisosMacros
} from '../js/core/alimentos.js';

const ok = { nombre: ' Pollo de prueba ', unidad: 'g', kcal: '165', carbs: '0', proteina: '31', grasas: '3,6' };

test('MACROS: las cuatro, con su columna de alimento y de comida', () => {
  assert.deepEqual(MACROS.map((m) => m.id), ['kcal', 'carbs', 'protein', 'fat']);
  assert.deepEqual(MACROS.map((m) => m.comida), ['calories_kcal', 'carbs_g', 'protein_g', 'fat_g']);
  assert.deepEqual(MACROS.map((m) => m.alimento), ['kcal_100', 'carbs_100', 'protein_100', 'fat_100']);
});

test('validarAlimento: datos válidos, coma decimal y nombre recortado', () => {
  const v = validarAlimento(ok);
  assert.equal(v.error, null);
  assert.deepEqual(v.datos, { name: 'Pollo de prueba', base_unit: 'g', kcal_100: 165, carbs_100: 0, protein_100: 31, fat_100: 3.6 });
  assert.equal(validarAlimento({ ...ok, unidad: 'ml' }).datos.base_unit, 'ml');
});

test('validarAlimento: las 4 macros son obligatorias (vacío no es 0)', () => {
  for (const campo of ['kcal', 'carbs', 'proteina', 'grasas']) {
    const v = validarAlimento({ ...ok, [campo]: '' });
    assert.match(v.error, /Falta cargar/, campo);
    assert.match(v.error, /escribí 0/);
  }
  assert.equal(validarAlimento({ ...ok, carbs: '0' }).error, null);          // el cero explícito sí vale
});

test('validarAlimento: rechazos', () => {
  assert.ok(validarAlimento({ ...ok, nombre: '  ' }).error);
  assert.ok(validarAlimento({ ...ok, nombre: 'x'.repeat(81) }).error);
  assert.ok(validarAlimento({ ...ok, unidad: 'kg' }).error);
  for (const [campo, valor] of [['kcal', '-1'], ['kcal', '1001'], ['kcal', 'abc'], ['carbs', '101'], ['proteina', '12,55'], ['grasas', '-0,1']]) {
    assert.match(validarAlimento({ ...ok, [campo]: valor }).error, /Revisá/, `${campo} ${valor}`);
  }
  assert.equal(validarAlimento({ ...ok, kcal: '1000', carbs: '0', proteina: '0', grasas: '100' }).error, null);   // aceite puro: 100 g de grasa
});

test('validarAlimento: carbos + proteínas + grasas no pueden pasar de 100 g por 100 g', () => {
  const v = validarAlimento({ ...ok, kcal: '400', carbs: '60', proteina: '30', grasas: '20' });
  assert.match(v.error, /suman 110/);
  assert.equal(validarAlimento({ ...ok, kcal: '400', carbs: '60', proteina: '20', grasas: '20' }).error, null);   // justo 100
  assert.equal(validarAlimento({ ...ok, carbs: '50,2', proteina: '30,2', grasas: '20,1' }).error, null);         // 100,5: tolerancia por redondeo
  assert.ok(validarAlimento({ ...ok, carbs: '50,2', proteina: '30,2', grasas: '20,2' }).error);                  // 100,6
});

test('validarPorcion', () => {
  assert.deepEqual(validarPorcion({ nombre: ' 1 huevo ', cantidad: '50' }).datos, { name: '1 huevo', amount: 50 });
  assert.equal(validarPorcion({ nombre: 'vaso', cantidad: '200,5' }).datos.amount, 200.5);
  for (const [n, c] of [['', '50'], ['x'.repeat(41), '50'], ['a', ''], ['a', '0'], ['a', '-3'], ['a', '5001'], ['a', 'abc'], ['a', '10,55']]) {
    assert.ok(validarPorcion({ nombre: n, cantidad: c }).error, `${n.slice(0, 5)} ${c}`);
  }
});

test('macrosDeCantidad: valor por 100 × cantidad / 100, a 1 decimal', () => {
  const pollo = { kcal_100: 165, carbs_100: 0, protein_100: 31, fat_100: 3.6 };
  assert.deepEqual(macrosDeCantidad(pollo, 120), { kcal: 198, carbs: 0, protein: 37.2, fat: 4.3 });
  assert.deepEqual(macrosDeCantidad(pollo, 100), { kcal: 165, carbs: 0, protein: 31, fat: 3.6 });
  assert.deepEqual(macrosDeCantidad(pollo, 33), { kcal: 54.5, carbs: 0, protein: 10.2, fat: 1.2 });
  assert.equal(macrosDeCantidad(pollo, 0), null);
  assert.equal(macrosDeCantidad(pollo, -5), null);
  assert.equal(macrosDeCantidad(null, 100), null);
  assert.equal(macrosDeCantidad({ ...pollo, carbs_100: 0 }, 250).carbs, 0);          // un cero real es 0, no «sin dato»
});

test('cantidadDePorcion', () => {
  assert.equal(cantidadDePorcion({ amount: 50 }, 2), 100);
  assert.equal(cantidadDePorcion({ amount: 33.3 }, 3), 99.9);
  assert.equal(cantidadDePorcion({ amount: 50 }, 0.5), 25);
  assert.equal(cantidadDePorcion({ amount: 50 }, 0), null);
  assert.equal(cantidadDePorcion(null, 2), null);
});

test('kcalEstimadas y avisoCoherencia: orientativo, no bloquea', () => {
  assert.equal(kcalEstimadas({ carbs: 0, protein: 31, fat: 3.6 }), 156);
  assert.equal(avisoCoherencia(validarAlimento(ok).datos), null);                      // 165 vs 156: coincide
  const mal = validarAlimento({ ...ok, kcal: '50' }).datos;                            // 50 vs 156
  assert.match(avisoCoherencia(mal), /macros suman unas 156 kcal y cargaste 50/);
  assert.equal(avisoCoherencia(validarAlimento({ ...ok, kcal: '0', carbs: '0', proteina: '0', grasas: '0' }).datos), null);   // agua
  assert.equal(avisoCoherencia(validarAlimento({ ...ok, kcal: '10', carbs: '0', proteina: '0', grasas: '0' }).datos), null);   // diferencia chica (<20)
});

test('resumenAlimento y búsqueda sin tildes ni mayúsculas', () => {
  const a = { name: 'Café con leche', base_unit: 'ml', kcal_100: 30, carbs_100: 3, protein_100: 1.7, fat_100: 1.2 };
  assert.equal(resumenAlimento(a), '30 kcal · C 3 · P 1,7 · G 1,2 por 100 ml');
  const lista = [a, { name: 'Pollo' }, { name: 'Pechuga de pollo' }];
  assert.deepEqual(filtrarAlimentos(lista, 'CAFE').map((x) => x.name), ['Café con leche']);
  assert.deepEqual(filtrarAlimentos(lista, ' pollo ').map((x) => x.name), ['Pollo', 'Pechuga de pollo']);
  assert.deepEqual(filtrarAlimentos(lista, 'cafe con').map((x) => x.name), ['Café con leche']);       // la tilde del nombre queda en el medio
  assert.deepEqual(filtrarAlimentos([{ name: 'Cafe solo' }], 'CAFÉ').map((x) => x.name), ['Cafe solo']);  // tilde en lo que se escribe
  assert.equal(filtrarAlimentos(lista, '').length, 3);
  assert.equal(filtrarAlimentos(lista, 'zzz').length, 0);
});

// ---------- comidas con macros (hito 3-6b) ----------
const pollo = { id: 'f1', name: 'Pollo', base_unit: 'g', kcal_100: 165, carbs_100: 0, protein_100: 31, fat_100: 3.6 };
const huevo = { id: 'f2', name: 'Huevo', base_unit: 'g', kcal_100: 143, carbs_100: 0.7, protein_100: 12.6, fat_100: 9.5 };
const aceite = { id: 'f3', name: 'Aceite', base_unit: 'ml', kcal_100: 900, carbs_100: 0, protein_100: 0, fat_100: 100 };
const porciones = [
  { id: 'p1', food_id: 'f2', name: '1 huevo', amount: 50 }, { id: 'p0', food_id: 'f2', name: '1 clara', amount: 33 },
  { id: 'p9', food_id: 'f1', name: 'pechuga', amount: 150 }
];

test('validarComidaManual: macros opcionales; vacío es NULL (sin dato), no 0', () => {
  const v = validarComidaManual({ tipo: 'cena', descripcion: ' Pizza ', kcal: '', carbs: '', proteina: '', grasas: '' });
  assert.deepEqual(v.datos, { meal_type: 'cena', description: 'Pizza', calories_kcal: null, carbs_g: null, protein_g: null, fat_g: null, food_id: null, food_name: null, amount: null });
  const w = validarComidaManual({ tipo: 'cena', descripcion: 'Pizza', kcal: '850', carbs: '90,5', proteina: '32', grasas: '0' });
  assert.deepEqual([w.datos.calories_kcal, w.datos.carbs_g, w.datos.protein_g, w.datos.fat_g], [850, 90.5, 32, 0]);   // el 0 explícito es 0
});

test('validarComidaManual: rechazos', () => {
  const base = { tipo: 'cena', descripcion: 'x', kcal: '', carbs: '', proteina: '', grasas: '' };
  assert.ok(validarComidaManual({ ...base, tipo: 'brunch' }).error);
  assert.ok(validarComidaManual({ ...base, descripcion: '   ' }).error);
  assert.ok(validarComidaManual({ ...base, descripcion: 'a'.repeat(301) }).error);
  for (const [campo, valor] of [['kcal', '10001'], ['kcal', '-1'], ['carbs', '1001'], ['grasas', 'abc'], ['proteina', '501'], ['proteina', '12,55']]) {
    assert.match(validarComidaManual({ ...base, [campo]: valor }).error, /Revis|número/, `${campo} ${valor}`);
  }
});

test('opcionesCantidad: gramos/ml y solo las porciones de ESE alimento, ordenadas', () => {
  assert.deepEqual(opcionesCantidad(huevo, porciones).map((o) => o.texto), ['g', '1 clara (33 g)', '1 huevo (50 g)']);
  assert.deepEqual(opcionesCantidad(pollo, porciones).map((o) => o.texto), ['g', 'pechuga (150 g)']);
  assert.deepEqual(opcionesCantidad(aceite, porciones).map((o) => o.texto), ['ml']);
});

test('calcularCantidad: gramos y porciones', () => {
  const g = calcularCantidad(pollo, opcionesCantidad(pollo, porciones)[0], '120');
  assert.deepEqual([g.error, g.amount, g.macros], [null, 120, { kcal: 198, carbs: 0, protein: 37.2, fat: 4.3 }]);
  const op = opcionesCantidad(huevo, porciones).find((o) => o.id === 'p1');
  const p = calcularCantidad(huevo, op, '2');                                        // 2 huevos = 100 g
  assert.deepEqual([p.amount, p.macros], [100, { kcal: 143, carbs: 0.7, protein: 12.6, fat: 9.5 }]);
  assert.equal(calcularCantidad(huevo, op, '0,5').amount, 25);                       // media porción
  for (const t of ['', 'abc', '0', '-2', '10,55']) assert.ok(calcularCantidad(pollo, { porcion: null }, t).error, t);
  assert.match(calcularCantidad(pollo, { porcion: null }, '10001').error, /10000/);
  assert.match(calcularCantidad(null, null, '10').error, /Elegí un alimento/);
});

test('calcularCantidad: no deja pasar lo que la base de datos rechazaría', () => {
  const e = calcularCantidad(aceite, { porcion: null }, '1100');                    // 1100 ml de aceite = 1100 g de grasa (> 1000)
  assert.match(e.error, /1100 de grasas/);
  assert.equal(calcularCantidad(aceite, { porcion: null }, '1000').error, null);
});

test('comidaDeAlimento: guarda la foto (nombre, cantidad y macros)', () => {
  const r = comidaDeAlimento({ tipo: 'almuerzo', alimento: pollo, opcion: { porcion: null }, cantidad: '120' });
  assert.deepEqual(r.datos, { meal_type: 'almuerzo', description: 'Pollo', calories_kcal: 198, carbs_g: 0, protein_g: 37.2, fat_g: 4.3, food_id: 'f1', food_name: 'Pollo', amount: 120 });
  assert.ok(comidaDeAlimento({ tipo: 'brunch', alimento: pollo, opcion: { porcion: null }, cantidad: '120' }).error);
  assert.ok(comidaDeAlimento({ tipo: 'cena', alimento: pollo, opcion: { porcion: null }, cantidad: '' }).error);
});

test('reescalarComida: proporcional a lo guardado; lo que no tenía dato sigue sin dato', () => {
  const c = { amount: 120, calories_kcal: 198, carbs_g: 0, protein_g: 37.2, fat_g: 4.3 };
  assert.deepEqual(reescalarComida(c, '240').datos, { amount: 240, calories_kcal: 396, carbs_g: 0, protein_g: 74.4, fat_g: 8.6 });
  const parcial = { amount: 100, calories_kcal: null, carbs_g: null, protein_g: 20, fat_g: null };
  assert.deepEqual(reescalarComida(parcial, '50').datos, { amount: 50, calories_kcal: null, carbs_g: null, protein_g: 10, fat_g: null });
  assert.ok(reescalarComida({ amount: null }, '50').error);
  assert.ok(reescalarComida(c, '0').error);
  assert.ok(reescalarComida(c, 'abc').error);
  assert.match(reescalarComida({ amount: 1, calories_kcal: 900, carbs_g: 0, protein_g: 0, fat_g: 100 }, '2000').error, /más de lo que acepta/);
});

test('totalesMacros: solo suma lo cargado; sin nada cargado es null, no 0', () => {
  const t = totalesMacros([
    { calories_kcal: 200, carbs_g: null, protein_g: 30, fat_g: 5 },
    { calories_kcal: null, carbs_g: null, protein_g: null, fat_g: null },
    { calories_kcal: 100.5, carbs_g: null, protein_g: 10, fat_g: null }
  ]);
  assert.deepEqual(t.kcal, { total: 300.5, conDato: 2, sinDato: 1 });
  assert.deepEqual(t.carbs, { total: null, conDato: 0, sinDato: 3 });
  assert.deepEqual(t.protein, { total: 40, conDato: 2, sinDato: 1 });
  assert.deepEqual(t.fat, { total: 5, conDato: 1, sinDato: 2 });
  assert.deepEqual(totalesMacros([]).kcal, { total: null, conDato: 0, sinDato: 0 });
  assert.equal(totalesMacros([{ calories_kcal: 0.1 }, { calories_kcal: 0.2 }]).kcal.total, 0.3);   // sin errores de coma flotante
  assert.deepEqual(avisosMacros(t), ['1 comida sin dato de calorías.', '3 comidas sin dato de carbohidratos.', '1 comida sin dato de proteínas.', '2 comidas sin dato de grasas.']);
  assert.deepEqual(avisosMacros(totalesMacros([])), []);
});

test('textoMacrosComida: solo lo que tiene dato', () => {
  assert.equal(textoMacrosComida({ calories_kcal: 198, carbs_g: 0, protein_g: 37.2, fat_g: 4.3 }), '198 kcal · C 0 · P 37,2 · G 4,3');
  assert.equal(textoMacrosComida({ calories_kcal: null, carbs_g: null, protein_g: 12, fat_g: null }), 'P 12');
  assert.equal(textoMacrosComida({ calories_kcal: null, carbs_g: null, protein_g: null, fat_g: null }), 'Sin macros cargadas');
});
