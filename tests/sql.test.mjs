// Chequeo ESTRUCTURAL de las migraciones SQL. Ejecutar con:  node --test tests/sql.test.mjs
// OJO: esto NO ejecuta el SQL (no hay PostgreSQL en el entorno de pruebas). Atrapa errores típicos de forma
// estática: paréntesis o $$ desparejos, tablas sin RLS, referencias a tablas inexistentes, firmas de
// funciones que no coinciden con su revoke/grant, y tablas nuevas que la prueba de seguridad no toca.
// La prueba real es ejecutar los scripts en Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../sql/', import.meta.url);
const archivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const crudo = Object.fromEntries(archivos.map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]));
const limpio = (sql) => sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
const migraciones = archivos.filter((f) => !/test/i.test(f));
const todoMigraciones = migraciones.map((f) => crudo[f]).join('\n');

test('hay migraciones y scripts de prueba', () => {
  assert.ok(migraciones.length >= 2 && archivos.length > migraciones.length, archivos.join(', '));
});

test('cada archivo: $$ parejos y paréntesis balanceados', () => {
  for (const f of archivos) {
    assert.equal((crudo[f].match(/\$\$/g) ?? []).length % 2, 0, `${f}: cantidad impar de $$`);
    let nivel = 0;
    for (const ch of limpio(crudo[f])) {
      if (ch === '(') nivel++;
      if (ch === ')') nivel--;
      assert.ok(nivel >= 0, `${f}: paréntesis de cierre de más`);
    }
    assert.equal(nivel, 0, `${f}: paréntesis sin cerrar`);
  }
});

const tablasCreadas = [...todoMigraciones.matchAll(/create table(?: if not exists)? public\.(\w+)/gi)].map((m) => m[1]);

test('toda tabla creada tiene RLS (plantilla o alter table explícito)', () => {
  const enPlantilla = new Set();
  for (const m of todoMigraciones.matchAll(/foreach t in array array\[([\s\S]*?)\]/gi)) {
    for (const t of m[1].matchAll(/'(\w+)'/g)) enPlantilla.add(t[1]);
  }
  for (const t of tablasCreadas) {
    const explicita = new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(todoMigraciones);
    assert.ok(enPlantilla.has(t) || explicita, `La tabla «${t}» no tiene RLS`);
  }
});

test('toda referencia (foreign key) apunta a una tabla que existe', () => {
  for (const m of todoMigraciones.matchAll(/references public\.(\w+)\s*\(/gi)) {
    assert.ok(tablasCreadas.includes(m[1]), `referencia a una tabla inexistente: ${m[1]}`);
  }
});

test('toda tabla tiene user_id con default auth.uid() (salvo que sea su clave primaria)', () => {
  for (const m of todoMigraciones.matchAll(/create table(?: if not exists)? public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    assert.match(m[2], /user_id uuid (?:primary key )?(?:not null )?default auth\.uid\(\)/i, `«${m[1]}» sin user_id con default auth.uid()`);
  }
});

// Parte una lista de parámetros por comas de primer nivel.
const partirParametros = (txt) => {
  const partes = []; let nivel = 0; let actual = '';
  for (const ch of txt) {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) { partes.push(actual.trim()); actual = ''; } else actual += ch;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
};

test('cada función (no trigger) tiene revoke y grant con la MISMA firma que su create', () => {
  const sql = limpio(todoMigraciones);
  let vistas = 0;
  for (const m of sql.matchAll(/create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns\s+(\w+)/gi)) {
    const [, nombre, params, retorna] = m;
    if (retorna.toLowerCase() === 'trigger') continue;
    vistas++;
    const tipos = partirParametros(params).map((p) => p.split(/\s+/)[1].toLowerCase());
    const firma = tipos.join(',\\s*');
    const rev = new RegExp(`revoke all on function public\\.${nombre}\\(\\s*${firma}\\s*\\)`, 'i');
    const gra = new RegExp(`grant execute on function public\\.${nombre}\\(\\s*${firma}\\s*\\)\\s+to authenticated`, 'i');
    assert.match(sql, rev, `${nombre}: falta o no coincide el revoke (tipos: ${tipos.join(', ')})`);
    assert.match(sql, gra, `${nombre}: falta o no coincide el grant (tipos: ${tipos.join(', ')})`);
  }
  assert.ok(vistas >= 1, 'no se encontró ninguna función con permisos explícitos');
});

test('los scripts de prueba mantienen el marcador del UID y cubren cada tabla nueva', () => {
  const nueva = crudo['003_gym_nutri.sql'];
  const prueba = crudo['004_test_rls_gym_nutri.sql'];
  assert.match(prueba, /PEGAR-AQUI-TU-USER-UID/);
  for (const m of nueva.matchAll(/create table(?: if not exists)? public\.(\w+)/gi)) {
    assert.match(prueba, new RegExp(`public\\.${m[1]}\\b`), `004 no prueba la tabla ${m[1]}`);
  }
  assert.match(prueba, /guardar_entrenamiento/);
  // No debe quedar ningún "FALLO n" repetido ni salteado
  const nums = [...prueba.matchAll(/'FALLO (\d+):/g)].map((m) => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: nums.length }, (_, i) => i + 1), 'los números de FALLO deben ser 1..N sin repetir');
});

test('005 (agua): su script de prueba 006 cubre cada tabla, tiene el marcador del UID y FALLO 1..N', () => {
  const nueva = crudo['005_agua.sql'];
  const prueba = crudo['006_test_rls_agua.sql'];
  assert.match(prueba, /PEGAR-AQUI-TU-USER-UID/);
  for (const m of nueva.matchAll(/create table(?: if not exists)? public\.(\w+)/gi)) {
    assert.match(prueba, new RegExp(`public\\.${m[1]}\\b`), `006 no prueba la tabla ${m[1]}`);
  }
  const nums = [...prueba.matchAll(/'FALLO (\d+):/g)].map((m) => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: nums.length }, (_, i) => i + 1), 'los números de FALLO deben ser 1..N sin repetir');
});
