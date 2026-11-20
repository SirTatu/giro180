// Pruebas de js/core/exportar.js. Ejecutar con:  node --test tests/exportar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  TABLAS_EXPORT, FORMATO_CSV, paginar, celdaCSV, columnasDe, aCSV, conBOM, armarJSON, nombreArchivo
} from '../js/core/exportar.js';

test('toda tabla creada en las migraciones SQL está en TABLAS_EXPORT (y sin repetidas)', () => {
  const dir = new URL('../sql/', import.meta.url);
  const sql = readdirSync(dir).filter((f) => f.endsWith('.sql') && !/test/i.test(f))
    .map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
  const creadas = [...sql.matchAll(/create table(?: if not exists)? public\.(\w+)/gi)].map((m) => m[1]);
  assert.ok(creadas.length >= 17, 'se esperaban al menos 17 tablas');
  const exportadas = TABLAS_EXPORT.map((t) => t.tabla);
  for (const t of creadas) assert.ok(exportadas.includes(t), `Falta exportar la tabla ${t}`);
  assert.equal(new Set(exportadas).size, exportadas.length);
});

test('paginar: junta páginas aunque el servidor entregue menos filas que las pedidas', async () => {
  const datos = Array.from({ length: 25 }, (_, i) => ({ i }));
  const pedidos = [];
  const r = await paginar(async (d, h) => { pedidos.push([d, h]); return { filas: datos.slice(d, Math.min(h + 1, d + 10)), total: 25 }; }, { tamano: 20 });
  assert.equal(r.filas.length, 25);
  assert.deepEqual(r.filas.map((f) => f.i), datos.map((f) => f.i));
  assert.ok(pedidos.length >= 3);
});

test('paginar: tabla vacía y errores (sin total, página vacía antes de tiempo)', async () => {
  assert.deepEqual(await paginar(async () => ({ filas: [], total: 0 })), { filas: [], total: 0 });
  await assert.rejects(paginar(async () => ({ filas: [{}], total: null })), /total/);
  await assert.rejects(paginar(async () => ({ filas: [], total: 5 })), /incompleta/);
});

test('celdaCSV: coma decimal, comillas, separador y protección contra fórmulas', () => {
  assert.equal(celdaCSV(null), '');
  assert.equal(celdaCSV(72.5), '72,5');
  assert.equal(celdaCSV(true), 'true');
  assert.equal(celdaCSV('hola; chau'), '"hola; chau"');
  assert.equal(celdaCSV('dijo "sí"'), '"dijo ""sí"""');
  assert.equal(celdaCSV('línea1\nlínea2'), '"línea1\nlínea2"');
  assert.equal(celdaCSV('=SUMA(A1)'), "'=SUMA(A1)");
  assert.equal(celdaCSV('@x'), "'@x");
  assert.equal(celdaCSV('-5'), '-5');                    // un número negativo NO es fórmula
  assert.equal(celdaCSV('- texto'), "'- texto");
});

test('aCSV: encabezado = unión de claves, CRLF, tabla vacía = texto vacío', () => {
  assert.equal(aCSV([]), '');
  assert.deepEqual(columnasDe([{ a: 1 }, { b: 2, a: 3 }]), ['a', 'b']);
  assert.equal(aCSV([{ a: 1.5, b: 'x' }, { a: 2 }]), 'a;b\r\n1,5;x\r\n2;\r\n');
  assert.equal(FORMATO_CSV.sep, ';');
});

test('BOM: se agrega como un solo carácter U+FEFF (verificado por bytes)', () => {
  const bytes = Buffer.from(conBOM('á'), 'utf8');
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test('armarJSON: conteos coherentes y datos exactos', () => {
  const tablas = { goals: [{ id: 1, nota: '=x' }], meals: [] };
  const j = JSON.parse(armarJSON({ tablas, versionApp: '9.9.9', exportadoEn: '2026-01-01T00:00:00Z' }));
  assert.equal(j.app, 'Giro 180');
  assert.deepEqual(j.conteos, { goals: 1, meals: 0 });
  assert.equal(j.tablas.goals[0].nota, '=x');            // el JSON NO modifica los textos
  assert.equal(j.version_app, '9.9.9');
});

test('nombreArchivo', () => {
  assert.equal(nombreArchivo('2026-11-19', 'json'), 'giro180-2026-11-19.json');
  assert.equal(nombreArchivo('2026-11-19', 'csv', 'goals'), 'giro180-2026-11-19-goals.csv');
});
