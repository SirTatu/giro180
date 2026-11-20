// Pruebas de js/core/gym.js. Ejecutar con:  node --test tests/gym.test.mjs
// Los ejemplos son INVENTADOS (el repo es público): imitan el estilo de uso (alternativas, tipeos), no rutinas reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar, formatoObjetivo, validarObjetivo, traducirError, intercambiarOrden, separarAlternativa,
  parsearRutinas, buscarCoincidencia, similitud, planInicial, resolverImportacion
} from '../js/core/gym.js';

test('normalizar: acentos, mayúsculas y espacios', () => {
  assert.equal(normalizar('  Elevación  LATERAL Ñandú '), 'elevacion lateral nandu');
  assert.equal(normalizar(null), '');
});

test('formatoObjetivo', () => {
  assert.equal(formatoObjetivo(4, 6, 8), '4 × 6-8');
  assert.equal(formatoObjetivo(3, 10, 10), '3 × 10');
  assert.equal(formatoObjetivo(3, 8, null), '3 × 8 o más');
  assert.equal(formatoObjetivo(3, null, 12), '3 × hasta 12');
  assert.equal(formatoObjetivo(2, null, null), '2 series');
});

test('validarObjetivo respeta los límites de la base', () => {
  assert.equal(validarObjetivo({ series: 4, repsMin: 6, repsMax: 8 }), null);
  assert.equal(validarObjetivo({ series: 3 }), null);
  assert.ok(validarObjetivo({ series: 0 }));
  assert.ok(validarObjetivo({ series: 21 }));
  assert.ok(validarObjetivo({ series: 2.5 }));
  assert.ok(validarObjetivo({ series: 3, repsMin: 10, repsMax: 8 }));
  assert.ok(validarObjetivo({ series: 3, repsMin: 0 }));
  assert.ok(validarObjetivo({ series: 3, repsMax: 201 }));
});

test('traducirError', () => {
  assert.match(traducirError({ code: '23505', message: 'duplicate key ... "exercises_nombre_uq"' }), /ejercicio/);
  assert.match(traducirError({ code: '23505', message: 'duplicate key ... "routines_nombre_uq"' }), /rutina/);
  assert.match(traducirError({ code: '23503', message: 'x' }), /en uso/);
  assert.equal(traducirError(new Error('boom')), 'boom');
});

test('intercambiarOrden', () => {
  const items = [{ id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 }, { id: 'c', sort_order: 3 }];
  assert.deepEqual(intercambiarOrden(items, 'b', -1).sort((x, y) => x.id.localeCompare(y.id)),
    [{ id: 'a', sort_order: 2 }, { id: 'b', sort_order: 1 }]);
  assert.deepEqual(intercambiarOrden(items, 'a', -1), []);          // ya es el primero
  assert.deepEqual(intercambiarOrden(items, 'c', 1), []);           // ya es el último
  assert.deepEqual(intercambiarOrden(items, 'zzz', 1), []);
  // con huecos y empates se renumera sin perder a nadie
  const raros = [{ id: 'a', sort_order: 5 }, { id: 'b', sort_order: 5 }, { id: 'c', sort_order: 9 }];
  const cambios = intercambiarOrden(raros, 'c', -1);
  const final = raros.map((x) => cambios.find((c) => c.id === x.id) ?? x);
  assert.equal(new Set(final.map((x) => x.sort_order)).size, 3);
});

test('separarAlternativa: paréntesis con "o", " o " suelta y paréntesis que son parte del nombre', () => {
  assert.deepEqual(separarAlternativa('Press plano con mancuerna (o barra)'),
    { nombre: 'Press plano con mancuerna', nota: 'Alternativa: barra' });
  assert.deepEqual(separarAlternativa('Curl con barra o Curl con mancuerna alternado'),
    { nombre: 'Curl con barra', nota: 'Alternativa: Curl con mancuerna alternado' });
  assert.deepEqual(separarAlternativa('Remo con apoyo (en T)'), { nombre: 'Remo con apoyo (en T)', nota: null });
  assert.deepEqual(separarAlternativa('Prensa'), { nombre: 'Prensa', nota: null });
});

const TEXTO = `
Lunes – Empuje de prueba
Press plano con barra 4 x 6-8
- Aperturas en polea 3x12-15
2) Elevaciones frontales con disco (o mancuerna) 3 × 10
Fondos en paralelas 3 x 8 a 12

Martes: Tirón de prueba
Remo en polea baja 4 x 8-10
Curl con barra o Curl con mancuerna 3 x 10
Plancha 3 x 60
`;

test('parsearRutinas: títulos, viñetas, formatos de x y rangos, alternativas', () => {
  const { rutinas, errores } = parsearRutinas(TEXTO);
  assert.equal(errores.length, 0, JSON.stringify(errores));
  assert.equal(rutinas.length, 2);
  assert.equal(rutinas[0].titulo, 'Lunes – Empuje de prueba');
  assert.equal(rutinas[0].weekday, 1);
  assert.equal(rutinas[1].weekday, 2);
  const l = rutinas[0].lineas;
  assert.deepEqual([l[0].nombre, l[0].series, l[0].repsMin, l[0].repsMax], ['Press plano con barra', 4, 6, 8]);
  assert.deepEqual([l[1].nombre, l[1].series, l[1].repsMin, l[1].repsMax], ['Aperturas en polea', 3, 12, 15]);
  assert.deepEqual([l[2].nombre, l[2].nota], ['Elevaciones frontales con disco', 'Alternativa: mancuerna']);
  assert.deepEqual([l[3].repsMin, l[3].repsMax], [8, 12]);
  const m = rutinas[1].lineas;
  assert.equal(m[1].nombre, 'Curl con barra');
  assert.equal(m[1].nota, 'Alternativa: Curl con mancuerna');
  assert.deepEqual([m[2].repsMin, m[2].repsMax], [60, 60]);      // una sola cifra: min = max
});

test('parsearRutinas: formato en una línea separado por puntos medios', () => {
  const { rutinas, errores } = parsearRutinas('Jueves: Sentadilla libre 4 x 6-8 · Prensa 3 x 10-12 · Gemelos 4 x 12-15');
  assert.equal(errores.length, 0);
  assert.equal(rutinas.length, 1);
  assert.equal(rutinas[0].weekday, 4);
  assert.deepEqual(rutinas[0].lineas.map((x) => x.nombre), ['Sentadilla libre', 'Prensa', 'Gemelos']);
});

test('parsearRutinas: nunca descarta en silencio lo que no entiende', () => {
  const { rutinas, errores } = parsearRutinas([
    'Press suelto 3 x 10',                 // antes de cualquier título
    'Viernes – Prueba',
    'Press de prueba 3 x 12-8',            // rango invertido
    'Algo raro sin series',
    'Dominadas 0 x 5',                     // series inválidas
    'Remo de prueba 3 x 8',
    'Sábado – Vacía'
  ].join('\n'));
  assert.equal(rutinas.length, 1);
  assert.equal(rutinas[0].lineas.length, 1);
  const motivos = errores.map((e) => e.motivo).join(' | ');
  assert.match(motivos, /antes de un título/);
  assert.match(motivos, /máximas no pueden/);
  assert.match(motivos, /No se entiende/);
  assert.match(motivos, /entre 1 y 20/);
  assert.match(motivos, /sin ejercicios/);
  assert.equal(errores.length, 5);
});

test('parsearRutinas: texto vacío o nulo', () => {
  assert.deepEqual(parsearRutinas(''), { rutinas: [], errores: [] });
  assert.deepEqual(parsearRutinas(null), { rutinas: [], errores: [] });
});

test('similitud y buscarCoincidencia', () => {
  assert.ok(similitud('Press frances con mancuerna', 'Press frnaces con mancuerna') > 0.9);   // letras cambiadas
  const base = [
    { id: '1', name: 'Jalón al pecho' },
    { id: '2', name: 'Elevaciones laterales con mancuerna' },
    { id: '3', name: 'Prensa' }
  ];
  assert.equal(buscarCoincidencia('jalon al PECHO', base).tipo, 'exacta');
  const typo = buscarCoincidencia('Elevacioens laterales con mancuerna', base);
  assert.equal(typo.tipo, 'parecida');
  assert.equal(typo.candidato.id, '2');
  const rel = buscarCoincidencia('Jalón al pecho en máquina', base);
  assert.equal(rel.tipo, 'relacionada');
  assert.equal(rel.candidato.id, '1');
  assert.equal(buscarCoincidencia('Plancha', base).tipo, 'nueva');
  assert.equal(buscarCoincidencia('Plancha', []).tipo, 'nueva');
});

test('planInicial: usa existentes, unifica tipeos del mismo texto y sugiere relacionados sin unir', () => {
  const existentes = [{ id: 'e1', name: 'Prensa', archived: false }, { id: 'e2', name: 'Jalón al pecho', archived: false }];
  const parseado = parsearRutinas([
    'Lunes – A', 'Prensa 3 x 10', 'Jalón al pecho en máquina 4 x 8-10', 'Elevaciones de prueba 3 x 12',
    'Martes – B', 'Elevacioens de prueba 3 x 12', 'Prenza 3 x 10'
  ].join('\n'));
  const plan = planInicial(parseado, existentes);
  const [a, b] = plan.rutinas;
  assert.equal(a.items[0].usarId, 'e1');                          // exacta
  assert.equal(a.items[1].usarId, '');                            // relacionada: NO se une sola
  assert.match(a.items[1].hint, /¿Es el mismo/);
  assert.equal(b.items[0].nombre, 'Elevaciones de prueba');       // unificado con la otra línea
  assert.match(b.items[0].hint, /otra línea/);
  assert.equal(b.items[1].usarId, 'e1');                          // tipeo contra la base
  assert.match(b.items[1].hint, /Parecido/);
});

test('resolverImportacion: ejercicios nuevos sin duplicar, reutilizar archivados y validar', () => {
  const existentes = [{ id: 'e1', name: 'Prensa', archived: false }, { id: 'e9', name: 'Gemelos', archived: true }];
  const plan = {
    rutinas: [
      { incluir: true, nombre: 'Lunes – A', weekday: 1, items: [
        { nombre: 'Plancha', nota: null, series: 3, repsMin: 30, repsMax: 60, usarId: '' },
        { nombre: 'Prensa', nota: 'ojo', series: 3, repsMin: 10, repsMax: 12, usarId: 'e1' },
        { nombre: 'gemelos', nota: null, series: 4, repsMin: 12, repsMax: 15, usarId: '' }] },
      { incluir: true, nombre: 'Martes – B', weekday: 2, items: [
        { nombre: 'PLANCHA', nota: null, series: 3, repsMin: 30, repsMax: 60, usarId: '' }] },
      { incluir: false, nombre: 'Descartada', weekday: null, items: [] }
    ]
  };
  const r = resolverImportacion(plan, existentes, [{ name: 'Otra' }]);
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.ejerciciosNuevos, [{ clave: 'plancha', nombre: 'Plancha' }]);     // una sola vez
  assert.deepEqual(r.desarchivar, ['e9']);
  assert.equal(r.rutinas.length, 2);
  assert.deepEqual(r.rutinas[0].items.map((i) => i.sort_order), [1, 2, 3]);
  assert.equal(r.rutinas[0].items[1].id, 'e1');
  assert.equal(r.rutinas[0].items[1].notes, 'ojo');
  assert.equal(r.rutinas[1].items[0].clave, 'plancha');
});

test('resolverImportacion: problemas (nombres repetidos, vacíos, series inválidas, nada tildado)', () => {
  const item = { nombre: 'X', nota: null, series: 3, repsMin: 8, repsMax: 10, usarId: '' };
  const plan = {
    rutinas: [
      { incluir: true, nombre: 'Existente', weekday: null, items: [item] },
      { incluir: true, nombre: 'Nueva', weekday: null, items: [item] },
      { incluir: true, nombre: 'nueva', weekday: null, items: [{ ...item, series: 0 }] },
      { incluir: true, nombre: '  ', weekday: null, items: [{ ...item, nombre: '' }] }
    ]
  };
  const t = resolverImportacion(plan, [], [{ name: 'existente' }]).problemas.join(' | ');
  assert.match(t, /ya existe una rutina/);
  assert.match(t, /entre 1 y 20/);
  assert.match(t, /falta el nombre/);
  const vacio = resolverImportacion({ rutinas: [{ incluir: false, nombre: 'a', items: [] }] }, [], []);
  assert.match(vacio.problemas[0], /ninguna rutina/);
  // elegir un ejercicio que ya no existe
  const huerfano = resolverImportacion({ rutinas: [{ incluir: true, nombre: 'Z', items: [{ ...item, usarId: 'nope' }] }] }, [], []);
  assert.match(huerfano.problemas.join(' '), /ya no existe/);
});
