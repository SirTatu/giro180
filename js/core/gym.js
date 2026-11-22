// Lógica pura de Gym (sin pantalla ni base de datos): nombres, objetivos, importador de rutinas desde texto.
// Todo lo que está acá tiene pruebas en tests/gym.test.mjs.

export const GRUPOS = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'piernas', 'core', 'otro'];
export const NOMBRES_GRUPO = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', piernas: 'Piernas', core: 'Core', otro: 'Otro'
};
const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7 };

// Minúsculas, sin acentos y con espacios simples: sirve para comparar nombres.
export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------- objetivo (series x repeticiones) ----------
export function formatoObjetivo(series, repsMin, repsMax) {
  if (repsMin != null && repsMax != null) return repsMin === repsMax ? `${series} × ${repsMin}` : `${series} × ${repsMin}-${repsMax}`;
  if (repsMin != null) return `${series} × ${repsMin} o más`;
  if (repsMax != null) return `${series} × hasta ${repsMax}`;
  return `${series} series`;
}

const entero = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
// Devuelve un texto de error, o null si el objetivo es válido (mismos límites que la base de datos).
export function validarObjetivo({ series, repsMin = null, repsMax = null }) {
  if (!entero(series, 1, 20)) return 'Las series deben ser un número entero entre 1 y 20.';
  if (repsMin != null && !entero(repsMin, 1, 200)) return 'Las repeticiones mínimas deben estar entre 1 y 200.';
  if (repsMax != null && !entero(repsMax, 1, 200)) return 'Las repeticiones máximas deben estar entre 1 y 200.';
  if (repsMin != null && repsMax != null && repsMax < repsMin) return 'Las repeticiones máximas no pueden ser menores que las mínimas.';
  return null;
}

// Traduce errores técnicos de la base a textos claros.
export function traducirError(e) {
  const m = String(e?.message ?? e ?? '');
  if (e?.code === '23505' || /duplicate key/i.test(m)) {
    if (/exercises_nombre_uq/.test(m)) return 'Ya existe un ejercicio con ese nombre.';
    if (/routines_nombre_uq/.test(m)) return 'Ya existe una rutina con ese nombre.';
    if (/water_containers_nombre_uq/.test(m)) return 'Ya existe una botella con ese nombre.';
    if (/food_portions_nombre_uq/.test(m)) return 'Ese alimento ya tiene una porción con ese nombre.';
    if (/foods_nombre_uq/.test(m)) return 'Ya existe un alimento con ese nombre.';
    if (/foods_macros_suma_ck/.test(m)) return 'Carbohidratos, proteínas y grasas no pueden sumar más de 100 por cada 100 g (o ml).';
    return 'Ya existe un registro con esos datos.';
  }
  if (e?.code === '23503' || /foreign key/i.test(m)) return 'No se puede por estar en uso. Archivalo en lugar de borrarlo.';
  return m || 'Error desconocido.';
}

// Intercambia el orden de un ejercicio con su vecino. items: [{id, sort_order}].
// Devuelve los cambios a guardar: [{id, sort_order}, {id, sort_order}] o [] si no se puede mover.
export function intercambiarOrden(items, id, dir) {
  const orden = [...items].sort((a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)));
  const i = orden.findIndex((x) => x.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= orden.length) return [];
  // Se renumera 1..n para evitar empates; se devuelven solo las filas cuyo orden cambia.
  const nuevo = orden.map((x, k) => ({ id: x.id, sort_order: k + 1 }));
  [nuevo[i].sort_order, nuevo[j].sort_order] = [nuevo[j].sort_order, nuevo[i].sort_order];
  return nuevo.filter((x, k) => x.sort_order !== orden[k].sort_order);
}

// ---------- parecidos entre nombres ----------
// Distancia de edición con intercambio de letras vecinas (un tipeo como «ei» → «ie» cuenta como 1).
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
export function similitud(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x && !y) return 1;
  return 1 - distancia(x, y) / Math.max(x.length, y.length);
}
const UMBRAL_PARECIDA = 0.84;
const palabras = (s) => normalizar(s).split(' ').filter((p) => p.length > 1 || /\d/.test(p));
function contenido(a, b) {                // todas las palabras de a están en b (o al revés), sin ser iguales
  const A = new Set(palabras(a)), B = new Set(palabras(b));
  if (!A.size || !B.size) return false;
  const [chico, grande] = A.size <= B.size ? [A, B] : [B, A];
  return chico.size < grande.size && [...chico].every((p) => grande.has(p));
}

// candidatos: [{id, name, archived?}] (id null = nombre de otra línea del mismo texto pegado).
// tipo: 'exacta' | 'parecida' (error de tipeo probable) | 'relacionada' (uno contiene al otro) | 'nueva'.
export function buscarCoincidencia(nombre, candidatos) {
  const n = normalizar(nombre);
  let mejor = null;
  for (const c of candidatos) {
    const cn = normalizar(c.name);
    let tipo = null, sim = 0;
    if (cn === n) { tipo = 'exacta'; sim = 1; }
    else {
      sim = similitud(n, cn);
      if (sim >= UMBRAL_PARECIDA || (Math.min(n.length, cn.length) >= 4 && distancia(n, cn) <= 1)) tipo = 'parecida';
      else if (contenido(n, cn)) { tipo = 'relacionada'; sim = Math.max(sim, 0.5); }
    }
    if (!tipo) continue;
    const peso = { exacta: 3, parecida: 2, relacionada: 1 }[tipo] + sim + (c.archived ? 0 : 0.01);
    if (!mejor || peso > mejor.peso) mejor = { tipo, candidato: c, similitud: sim, peso };
  }
  return mejor ? { tipo: mejor.tipo, candidato: mejor.candidato, similitud: mejor.similitud } : { tipo: 'nueva', candidato: null, similitud: 0 };
}

// ---------- parser de texto pegado ----------
const RE_BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const RE_EJERCICIO = /^(.*?\S)\s+(\d{1,2})\s*[xX×]\s*(\d{1,3})(?:\s*(?:-|–|—|a)\s*(\d{1,3}))?\s*(?:reps?|repeticiones)?\s*$/i;
const RE_DIA_CONTENIDO = /^((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\s*[:\-–—]\s*(.+)$/i;

function diaDe(texto) {
  const p = normalizar(texto).split(/[^a-z]/)[0];
  return DIAS[p] ?? null;
}

// Separa "Press declinado (o barra)" o "Curl Z o Curl supinado" en nombre principal + nota de alternativa.
export function separarAlternativa(texto) {
  let nombre = texto.trim();
  let nota = null;
  const par = nombre.match(/\(\s*o\s+([^)]+)\)/i);
  if (par) {
    nota = 'Alternativa: ' + par[1].trim();
    nombre = nombre.replace(par[0], ' ');
  } else {
    let prof = 0, corte = -1;
    for (let i = 0; i < nombre.length && corte < 0; i++) {
      if (nombre[i] === '(') prof++;
      else if (nombre[i] === ')') prof = Math.max(0, prof - 1);
      else if (prof === 0 && /\s/.test(nombre[i])) {
        const m = nombre.slice(i).match(/^\s+o\s+(?=\S)/i);
        if (m) corte = i;
      }
    }
    if (corte > 0) {
      nota = 'Alternativa: ' + nombre.slice(corte).replace(/^\s+o\s+/i, '').trim();
      nombre = nombre.slice(0, corte);
    }
  }
  return { nombre: nombre.replace(/\s+/g, ' ').trim(), nota };
}

// Convierte el texto pegado en rutinas. Nunca descarta nada en silencio: lo que no entiende va a "errores".
export function parsearRutinas(texto) {
  const rutinas = [];
  const errores = [];
  let actual = null;
  const lineas = String(texto ?? '').split(/\r?\n/);

  lineas.forEach((crudo, idx) => {
    const nLinea = idx + 1;
    for (const segmento of crudo.split('·')) {
      let t = segmento.replace(RE_BULLET, '').trim();
      if (!t) continue;

      const conDia = t.match(RE_DIA_CONTENIDO);
      if (conDia && RE_EJERCICIO.test(conDia[2].replace(RE_BULLET, '').trim())) {   // "Martes: Press 4 x 6-8"
        actual = { titulo: conDia[1].trim(), weekday: diaDe(conDia[1]), lineas: [] };
        rutinas.push(actual);
        t = conDia[2].replace(RE_BULLET, '').trim();
      }

      const m = t.match(RE_EJERCICIO);
      if (m) {
        if (!actual) { errores.push({ linea: nLinea, texto: t, motivo: 'Ejercicio antes de un título de rutina (por ejemplo «Martes – Pecho»).' }); continue; }
        const series = Number(m[2]);
        const repsMin = Number(m[3]);
        const repsMax = m[4] != null ? Number(m[4]) : repsMin;
        const { nombre, nota } = separarAlternativa(m[1]);
        const err = nombre ? validarObjetivo({ series, repsMin, repsMax }) : 'Falta el nombre del ejercicio.';
        if (err) { errores.push({ linea: nLinea, texto: t, motivo: err }); continue; }
        actual.lineas.push({ linea: nLinea, texto: t, nombre, nota, series, repsMin, repsMax });
        continue;
      }

      const esTitulo = diaDe(t) != null || (/:\s*$/.test(t) && !/\d/.test(t));
      if (esTitulo) {
        actual = { titulo: t.replace(/\s*:\s*$/, '').trim(), weekday: diaDe(t), lineas: [] };
        rutinas.push(actual);
      } else {
        errores.push({ linea: nLinea, texto: t, motivo: 'No se entiende. Formato esperado: «Nombre del ejercicio 4 x 6-8».' });
      }
    }
  });

  for (const r of rutinas) {
    if (!r.lineas.length) errores.push({ linea: null, texto: r.titulo, motivo: 'Rutina sin ejercicios: se ignora.' });
  }
  return { rutinas: rutinas.filter((r) => r.lineas.length), errores };
}

// ---------- plan de importación ----------
// Arma lo que se muestra en la vista previa (editable). existentes: ejercicios de la base [{id,name,archived}].
export function planInicial(parseado, existentes) {
  const vistos = [];                                   // nombres ya usados en este mismo texto
  const rutinas = parseado.rutinas.map((r) => ({
    incluir: true,
    nombre: r.titulo,
    weekday: r.weekday,
    items: r.lineas.map((l) => {
      const base = existentes.filter((e) => !e.archived).concat(existentes.filter((e) => e.archived));
      const enBase = buscarCoincidencia(l.nombre, base);
      let nombre = l.nombre, usarId = '', hint = null;
      if (enBase.tipo === 'exacta' || enBase.tipo === 'parecida') {
        usarId = enBase.candidato.id;
        if (enBase.tipo === 'parecida') hint = `Parecido a «${enBase.candidato.name}»: se unifica. Revisalo.`;
      } else {
        const enTexto = buscarCoincidencia(l.nombre, vistos.map((v) => ({ id: null, name: v })));
        if (enTexto.tipo === 'parecida') {
          nombre = enTexto.candidato.name;
          hint = `Parecido a «${enTexto.candidato.name}» de otra línea: se unificó el nombre. Revisalo.`;
        } else if (enTexto.tipo === 'relacionada' || enBase.tipo === 'relacionada') {
          const otro = enBase.tipo === 'relacionada' ? enBase.candidato.name : enTexto.candidato.name;
          hint = `¿Es el mismo que «${otro}»? Si lo es, elegilo en «Usar existente» o poné el mismo nombre.`;
        }
      }
      if (!usarId) vistos.push(nombre);
      return { nombre, nota: l.nota, series: l.series, repsMin: l.repsMin, repsMax: l.repsMax, usarId, hint, linea: l.linea };
    })
  }));
  return { rutinas, errores: parseado.errores };
}

// Valida el plan ya editado y lo convierte en instrucciones concretas para guardar.
// Devuelve { problemas: [texto], ejerciciosNuevos: [{clave, nombre}], desarchivar: [id], rutinas: [...] }.
export function resolverImportacion(plan, existentes, rutinasExistentes) {
  const problemas = [];
  const porClave = new Map(existentes.map((e) => [normalizar(e.name), e]));
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const nombresRutina = new Set(rutinasExistentes.map((r) => normalizar(r.name)));
  const nuevos = new Map();                            // clave -> nombre
  const desarchivar = new Set();
  const rutinas = [];

  plan.rutinas.filter((r) => r.incluir).forEach((r, i) => {
    const nombre = r.nombre.trim();
    const et = nombre ? `Rutina «${nombre}»` : `Rutina ${i + 1}`;
    if (!nombre) problemas.push(`${et}: falta el nombre.`);
    else if (nombresRutina.has(normalizar(nombre))) problemas.push(`${et}: ya existe una rutina con ese nombre (cambiale el nombre o destildala).`);
    else nombresRutina.add(normalizar(nombre));
    if (!r.items.length) problemas.push(`${et}: no tiene ejercicios.`);

    const items = r.items.map((it, k) => {
      const err = validarObjetivo({ series: it.series, repsMin: it.repsMin ?? null, repsMax: it.repsMax ?? null });
      let ref;
      if (it.usarId) {
        const ex = porId.get(it.usarId);
        if (!ex) problemas.push(`${et}, ejercicio ${k + 1}: el ejercicio elegido ya no existe.`);
        if (ex?.archived) desarchivar.add(ex.id);
        ref = { id: it.usarId };
      } else {
        const n = it.nombre.trim();
        if (!n) problemas.push(`${et}, ejercicio ${k + 1}: falta el nombre.`);
        const clave = normalizar(n);
        const ya = porClave.get(clave);
        if (ya) { ref = { id: ya.id }; if (ya.archived) desarchivar.add(ya.id); }
        else { nuevos.set(clave, nuevos.get(clave) ?? n); ref = { clave }; }
      }
      if (err) problemas.push(`${et}, ejercicio ${k + 1} («${it.nombre}»): ${err}`);
      return { ...ref, sort_order: k + 1, target_sets: it.series, reps_min: it.repsMin ?? null, reps_max: it.repsMax ?? null, notes: it.nota || null };
    });
    rutinas.push({ nombre, weekday: r.weekday ?? null, items });
  });
  if (!rutinas.length) problemas.push('No hay ninguna rutina tildada para importar.');

  return {
    problemas,
    ejerciciosNuevos: [...nuevos].map(([clave, nombre]) => ({ clave, nombre })),
    desarchivar: [...desarchivar],
    rutinas
  };
}
