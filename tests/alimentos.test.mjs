// Pruebas de js/core/alimentos.js (ejemplos inventados). Ejecutar con:  node --test tests/alimentos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MACROS, validarAlimento, validarPorcion, macrosDeCantidad, cantidadDePorcion, kcalEstimadas, avisoCoherencia,
  resumenAlimento, filtrarAlimentos
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
