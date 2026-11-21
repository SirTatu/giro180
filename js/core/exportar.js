// Núcleo de EXPORTACIÓN (lógica pura, sin pantalla ni base de datos).
// - TABLAS_EXPORT: lista de tablas que se exportan. Al crear una tabla nueva en una migración SQL hay que sumarla
//   acá (una prueba automática lo exige leyendo la carpeta sql/).
// - paginar: lee todas las filas aunque la base limite cuántas entrega por consulta, sin cortar datos en silencio.
// - aCSV / armarJSON / nombreArchivo: arman los textos de los archivos.

export const TABLAS_EXPORT = [
  { tabla: 'user_settings', orden: 'user_id', etiqueta: 'Ajustes' },
  { tabla: 'habit_definitions', orden: 'id', etiqueta: 'Hábitos (definiciones y versiones)' },
  { tabla: 'habit_logs', orden: 'id', etiqueta: 'Registros de hábitos' },
  { tabla: 'goals', orden: 'id', etiqueta: 'Objetivos' },
  { tabla: 'priorities', orden: 'id', etiqueta: 'Prioridades' },
  { tabla: 'daily_entries', orden: 'id', etiqueta: 'Registro diario (ánimo, energía, notas)' },
  { tabla: 'weekly_reviews', orden: 'id', etiqueta: 'Revisiones semanales' },
  { tabla: 'saved_reports', orden: 'id', etiqueta: 'Informes guardados' },
  { tabla: 'appointments', orden: 'id', etiqueta: 'Compromisos y turnos' },
  { tabla: 'body_measurements', orden: 'id', etiqueta: 'Medidas corporales' },
  { tabla: 'decision_log', orden: 'id', etiqueta: 'Historial de decisiones' },
  // Etapa 3 (migración 003)
  { tabla: 'exercises', orden: 'id', etiqueta: 'Gym: ejercicios' },
  { tabla: 'routines', orden: 'id', etiqueta: 'Gym: rutinas' },
  { tabla: 'routine_exercises', orden: 'id', etiqueta: 'Gym: ejercicios de cada rutina' },
  { tabla: 'workout_sessions', orden: 'id', etiqueta: 'Gym: entrenamientos' },
  { tabla: 'workout_sets', orden: 'id', etiqueta: 'Gym: series' },
  { tabla: 'meals', orden: 'id', etiqueta: 'Nutri: comidas' },
  // Hito 3-4b (migración 005)
  { tabla: 'water_containers', orden: 'id', etiqueta: 'Nutri: botellas' },
  { tabla: 'water_intakes', orden: 'id', etiqueta: 'Nutri: tomas de agua' }
];

// Formato del CSV pensado para Excel en español de Argentina (separador de listas «;» y coma decimal).
// Si algún día querés el formato internacional, cambiá estos dos valores.
export const FORMATO_CSV = { sep: ';', decimal: ',' };

// ---------- Paginación segura ----------
// fetchPagina(desde, hasta) debe devolver { filas, total } con el total EXACTO de la tabla.
// Sigue pidiendo hasta tener todas las filas. Si la base entrega menos filas que las pedidas
// (límite del servidor) no pasa nada: continúa desde donde quedó. Si falta el total o una página
// viene vacía antes de completar, lanza un error en vez de devolver datos incompletos.
export async function paginar(fetchPagina, { tamano = 1000, maxPaginas = 1000 } = {}) {
  const todas = [];
  let total = null;
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const desde = todas.length;
    const r = await fetchPagina(desde, desde + tamano - 1);
    if (!Number.isInteger(r?.total)) throw new Error('No se pudo conocer el total de filas: exportación cancelada para no entregar datos incompletos.');
    total = r.total;
    if (todas.length >= total) return { filas: todas, total };          // tabla vacía o ya completa
    if (!r.filas.length) throw new Error(`Exportación incompleta: se leyeron ${todas.length} de ${total} filas.`);
    todas.push(...r.filas);
    if (todas.length >= total) return { filas: todas, total };
  }
  throw new Error('Exportación cancelada: demasiadas páginas (revisar el tamaño de la tabla).');
}

// ---------- CSV ----------
const PARECE_NUMERO = /^[-+]?\d+([.,]\d+)?$/;

// Una celda. Los textos que arrancan con = + - @ (o tab / retorno) se prefijan con una comilla simple para que
// Excel/Sheets no los ejecuten como fórmulas. El JSON conserva el texto exacto.
export function celdaCSV(valor, { sep, decimal } = FORMATO_CSV) {
  if (valor == null) return '';
  let s;
  if (typeof valor === 'number') s = String(valor).replace('.', decimal);
  else if (typeof valor === 'boolean') s = valor ? 'true' : 'false';
  else if (typeof valor === 'object') s = JSON.stringify(valor);
  else {
    s = String(valor);
    if (/^[=+\-@\t\r]/.test(s) && !PARECE_NUMERO.test(s)) s = "'" + s;
  }
  return /["\r\n]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Columnas = unión de las claves de todas las filas, en el orden en que aparecen.
export function columnasDe(filas) {
  const cols = [];
  const vistas = new Set();
  for (const f of filas) for (const k of Object.keys(f)) if (!vistas.has(k)) { vistas.add(k); cols.push(k); }
  return cols;
}

// Devuelve el texto CSV (sin BOM; el BOM se agrega al armar el archivo). Tabla vacía => ''.
export function aCSV(filas, formato = FORMATO_CSV) {
  if (!filas.length) return '';
  const cols = columnasDe(filas);
  const lineas = [cols.map((c) => celdaCSV(c, formato)).join(formato.sep)];
  for (const f of filas) lineas.push(cols.map((c) => celdaCSV(f[c], formato)).join(formato.sep));
  return lineas.join('\r\n') + '\r\n';
}

// Excel necesita el BOM UTF-8 para mostrar bien los acentos.
export const conBOM = (texto) => '\uFEFF' + texto;

// ---------- JSON ----------
// `tablas` es { nombreTabla: [filas] }. Incluye conteos para poder verificar la copia.
export function armarJSON({ tablas, versionApp, exportadoEn }) {
  const conteos = Object.fromEntries(Object.entries(tablas).map(([t, f]) => [t, f.length]));
  return JSON.stringify({
    app: 'Giro 180', formato: 1, version_app: versionApp, exportado_en: exportadoEn, conteos, tablas
  }, null, 2);
}

// ---------- Nombres de archivo ----------
export function nombreArchivo(fecha, ext, tabla = null) {
  return `giro180-${fecha}${tabla ? '-' + tabla : ''}.${ext}`;
}
