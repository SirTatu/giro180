// Pruebas de js/core/nutri.js (ejemplos inventados). Ejecutar con:  node --test tests/nutri.test.mjs
// Los totales, objetivos, cierre y resúmenes de macros se prueban en alimentos.test.mjs y macros.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarProteina, TIPOS_COMIDA, nombreTipo, NOTA_CIERRE } from '../js/core/nutri.js';

test('validarProteina: vacío es null (no cargada), nunca 0', () => {
  assert.deepEqual(validarProteina(''), { valor: null, error: null });
  assert.deepEqual(validarProteina('  '), { valor: null, error: null });
  assert.equal(validarProteina('0').valor, 0);
  assert.equal(validarProteina('32,5').valor, 32.5);
  for (const mal of ['abc', '-5', '501', '32.55']) assert.ok(validarProteina(mal).error, mal);
});

test('Tipos de comida y marca de cierre', () => {
  assert.deepEqual(TIPOS_COMIDA.map((t) => t.id), ['desayuno', 'almuerzo', 'merienda', 'cena', 'colacion', 'otro']);
  assert.equal(nombreTipo('colacion'), 'Colación');
  assert.equal(nombreTipo('raro'), 'raro');                    // un tipo desconocido se muestra tal cual, sin romper
  assert.equal(NOTA_CIERRE, 'cierre-dia');
});
