// Pruebas del núcleo de exportación. Ejecutar con:  node --test tests/exportar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  TABLAS_EXPORT, FORMATO_CSV, paginar, celdaCSV, columnasDe, aCSV, conBOM, armarJSON, nombreArchivo
} from '../js/core/exportar.js';

// ---------- Guardia: ninguna tabla de las migraciones puede quedar fuera de la exportación ----------
test('TABLAS_EXPORT cubre exactamente las tablas creadas en sql/ (y su clave de orden existe)', () => {
  const dir = new URL('../sql/', import.meta.url);
  const sqls = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(new URL(f, dir), 'utf8'));
  const bloques = new Map();    // tabla -> texto de su create table
  for (const sql of sqls) {
    for (const m of sql.matchAll(/create table(?: if not exists)? public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) bloques.set(m[1], m[2]);
  }
  assert.ok(bloques.size >= 11, 'no se encontraron las tablas en sql/ (' + bloques.size + ')');
  const exportadas = TABLAS_EXPORT.map((t) => t.tabla);
  for (const t of bloques.keys()) assert.ok(exportadas.includes(t), `La tabla «${t}» existe en sql/ pero no está en TABLAS_EXPORT (quedaría fuera del backup)`);
  for (const t of exportadas) assert.ok(bloques.has(t), `TABLAS_EXPORT menciona «${t}» que no existe en sql/`);
  for (const { tabla, orden } of TABLAS_EXPORT) {
    assert.match(bloques.get(tabla), new RegExp('\\b' + orden + '\\b'), `La clave de orden «${orden}» no está en ${tabla}`);
  }
  assert.equal(new Set(exportadas).size, exportadas.length, 'tablas repetidas');
});

// ---------- Paginación ----------
const fabrica = (n, limiteServidor = Infinity, sinTotal = false) => {
  const filas = Array.from({ length: n }, (_, i) => ({ id: i }));
  const llamadas = [];
  const fetch = async (desde, hasta) => {
    llamadas.push([desde, hasta]);
    const pedido = filas.slice(desde, hasta + 1);
    return { filas: pedido.slice(0, limiteServidor), total: sinTotal ? undefined : n };
  };
  return { fetch, llamadas };
};

test('paginar: junta varias páginas en orden y sin repetir', async () => {
  const { fetch, llamadas } = fabrica(2500);
  const r = await paginar(fetch);
  assert.equal(r.filas.length, 2500);
  assert.equal(r.total, 2500);
  assert.deepEqual(r.filas.map((f) => f.id), Array.from({ length: 2500 }, (_, i) => i));
  assert.deepEqual(llamadas, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('paginar: tabla vacía y tabla de exactamente una página', async () => {
  assert.deepEqual((await paginar(fabrica(0).fetch)).filas, []);
  assert.equal((await paginar(fabrica(1000).fetch)).filas.length, 1000);
  assert.equal((await paginar(fabrica(1001).fetch)).filas.length, 1001);
});

test('paginar: si el servidor entrega menos de lo pedido (límite propio) igual completa todo', async () => {
  const { fetch } = fabrica(1234, 500);
  const r = await paginar(fetch);
  assert.equal(r.filas.length, 1234);
  assert.deepEqual(r.filas.map((f) => f.id), Array.from({ length: 1234 }, (_, i) => i));
});

test('paginar: nunca devuelve datos incompletos en silencio', async () => {
  await assert.rejects(paginar(fabrica(10, Infinity, true).fetch), /total de filas/);
  // página vacía antes de completar
  const rota = async (desde) => ({ filas: desde === 0 ? [{ id: 0 }, { id: 1 }] : [], total: 5 });
  await assert.rejects(paginar(rota), /incompleta: se leyeron 2 de 5/);
  // el fetch lanza => se propaga el error
  await assert.rejects(paginar(async () => { throw new Error('sin red'); }), /sin red/);
  // tope de páginas
  await assert.rejects(paginar(fabrica(100).fetch, { tamano: 1, maxPaginas: 5 }), /demasiadas páginas/);
});

// ---------- CSV ----------
test('celdaCSV: nulos, números con coma decimal, booleanos y objetos', () => {
  assert.equal(celdaCSV(null), '');
  assert.equal(celdaCSV(undefined), '');
  assert.equal(celdaCSV(2.5), '2,5');
  assert.equal(celdaCSV(7), '7');
  assert.equal(celdaCSV(true), 'true');
  assert.equal(celdaCSV([1, 2, 3]), '[1,2,3]');
  assert.equal(celdaCSV({ a: 1 }), '"{""a"":1}"');          // el JSON lleva comillas: se escapan
  assert.equal(celdaCSV(2.5, { sep: ',', decimal: '.' }), '2.5');
});

test('celdaCSV: comillas, separador y saltos de línea se escapan sin perder texto', () => {
  assert.equal(celdaCSV('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(celdaCSV('a;b'), '"a;b"');
  assert.equal(celdaCSV('a,b'), 'a,b');                          // la coma ya no es separador
  assert.equal(celdaCSV('línea1\nlínea2'), '"línea1\nlínea2"');
  assert.equal(celdaCSV('acentos ñ á ü'), 'acentos ñ á ü');
});

test('celdaCSV: protege contra fórmulas sin tocar números ni fechas', () => {
  assert.equal(celdaCSV('=1+1'), "'=1+1");
  assert.equal(celdaCSV('+54911'), '+54911');                    // parece número: queda igual
  assert.equal(celdaCSV('@usuario'), "'@usuario");
  assert.equal(celdaCSV('-cmd|x'), "'-cmd|x");
  assert.equal(celdaCSV('-5'), '-5');
  assert.equal(celdaCSV('2026-11-14'), '2026-11-14');
  assert.equal(celdaCSV(-5), '-5');                               // número real
});

test('aCSV: encabezado con unión de columnas, filas alineadas y fin de línea CRLF', () => {
  const csv = aCSV([{ a: 1, b: 'x;y' }, { a: 2, c: null }, { c: 'z' }]);
  assert.deepEqual(columnasDe([{ a: 1, b: 2 }, { c: 3, a: 4 }]), ['a', 'b', 'c']);
  assert.equal(csv, 'a;b;c\r\n1;"x;y";\r\n2;;\r\n;;z\r\n');
  assert.equal(aCSV([]), '');
  assert.equal(conBOM('x'), '\uFEFFx');
  assert.deepEqual(FORMATO_CSV, { sep: ';', decimal: ',' });
});

test('aCSV: round-trip simple (leer de vuelta con el mismo separador da los mismos valores)', () => {
  const filas = [{ id: 'u1', notas: 'hola; "mundo"\nchau', valor: 2.5, dias: [1, 2] }];
  const csv = aCSV(filas);
  // Parseo mínimo para verificar: quita comillas dobladas
  assert.match(csv, /"hola; ""mundo""\nchau"/);
  assert.match(csv, /;2,5;/);
  assert.match(csv, /\[1,2\]/);
});

// ---------- JSON y nombres ----------
test('armarJSON: estructura, conteos y ida y vuelta exacta', () => {
  const tablas = { habit_logs: [{ id: 'a', value: 2.5, extra: null }], goals: [] };
  const txt = armarJSON({ tablas, versionApp: '0.7.0', exportadoEn: '2026-11-14T10:00:00.000Z' });
  const o = JSON.parse(txt);
  assert.equal(o.app, 'Giro 180');
  assert.equal(o.formato, 1);
  assert.equal(o.version_app, '0.7.0');
  assert.deepEqual(o.conteos, { habit_logs: 1, goals: 0 });
  assert.deepEqual(o.tablas, tablas);                              // sin pérdidas
});

test('nombreArchivo', () => {
  assert.equal(nombreArchivo('2026-11-14', 'json'), 'giro180-2026-11-14.json');
  assert.equal(nombreArchivo('2026-11-14', 'csv', 'habit_logs'), 'giro180-2026-11-14-habit_logs.csv');
});
