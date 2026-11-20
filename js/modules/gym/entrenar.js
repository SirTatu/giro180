// Gym → pestaña "Entrenar": registrar el entrenamiento de un día (peso y repeticiones de cada serie), con
// totales en vivo, «última vez» de cada ejercicio, y la posibilidad de reemplazar, saltear o agregar ejercicios
// solo ese día. Guarda con guardar_entrenamiento (una transacción) y marca el hábito «Entrenar».
import { h } from '../../core/dom.js';
import { hoy, sumarDias, diaISO, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import {
  armarEntrenamiento, bloquesIniciales, ultimasPorEjercicio, buscarHabitoEntrenar, totales, validarFilas,
  formatoNumero, formatoSerie, textoObjetivo, parsearNumero
} from '../../core/entrenos.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

const MAX_FILAS = 20;

export function renderEntrenar(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const aviso = h('p', { class: 'aviso' });
  const raiz = h('div');
  let token = 0;
  let fecha = ctx.fechaInicial || hoy();
  let rutinas = [], items = [], ejercicios = [], defsHabito = [];
  let sesion = null, extraSesiones = 0, ultimas = new Map();
  let rutinaId = '', bloques = [], sucio = false;
  let duracion = null, notas = null;                       // elementos de entrada (se arman en pintar)
  let zonaBloques = null, zonaTotales = null;

  const mostrarError = (e) => { msg.textContent = typeof e === 'string' ? e : traducirError(e); };
  const itemsDe = (rid) => items.filter((i) => i.routine_id === rid);
  const activos = () => ejercicios.filter((e) => !e.archived);
  const tocar = () => { sucio = true; ok.textContent = ''; };
  const confirmarDescarte = () => !sucio || confirm('Hay cambios sin guardar. ¿Descartarlos?');

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const [r, i, e, d, delDia, previas] = await Promise.all([
        D.listarRutinas(), D.listarItems(), D.listarEjercicios(), D.listarHabitosDefiniciones(), D.sesionesDelDia(f), D.sesionesAnteriores(f, 20)
      ]);
      const actual = delDia[0] ?? null;
      const sets = await D.setsDe([...previas.map((s) => s.id), ...(actual ? [actual.id] : [])]);
      if (t !== token) return;                              // llegó una respuesta vieja: se ignora
      fecha = f; rutinas = r; items = i; ejercicios = e; defsHabito = d;
      sesion = actual; extraSesiones = Math.max(0, delDia.length - 1);
      const idsPrevias = new Set(previas.map((s) => s.id));
      ultimas = ultimasPorEjercicio(previas, sets.filter((s) => idsPrevias.has(s.session_id)));
      if (actual) rutinaId = actual.routine_id ?? '';
      else rutinaId = rutinas.find((x) => !x.archived && x.weekday === diaISO(f))?.id ?? '';
      bloques = bloquesIniciales({
        items: rutinaId ? itemsDe(rutinaId) : [], ejercicios, ultimas,
        setsSesion: actual ? sets.filter((s) => s.session_id === actual.id) : []
      });
      sucio = false; msg.textContent = ''; aviso.textContent = ''; ok.textContent = mensajeOk;
      pintar(actual);
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  // ---------- totales en vivo ----------
  function pintarTotales() {
    const r = armarEntrenamiento(bloques).totales;
    zonaTotales.replaceChildren(
      h('div', { class: 'metricas' },
        h('div', { class: 'metrica' }, h('b', {}, String(r.series)), h('span', {}, 'series')),
        h('div', { class: 'metrica' }, h('b', {}, String(r.reps)), h('span', {}, 'repeticiones')),
        h('div', { class: 'metrica' }, h('b', {}, formatoNumero(r.volumen)), h('span', {}, 'kg de volumen'))),
      r.sinPeso ? h('p', { class: 'nota' }, `${r.sinPeso} serie(s) sin peso: cuentan en repeticiones pero no suman al volumen.`) : null);
  }

  // ---------- un ejercicio del día ----------
  function bloqueEl(b) {
    const totEl = h('p', { class: 'fila-meta' });
    const actualizar = () => {
      const t = totales(validarFilas(b.filas).sets);
      totEl.textContent = t.series ? `${t.series} series · ${t.reps} reps · ${formatoNumero(t.volumen)} kg` : 'Sin series cargadas';
      pintarTotales();
    };
    const obj = b.objetivo ? textoObjetivo(b.objetivo) : '';
    const cabecera = h('div', { class: 'fila-top' },
      h('div', { class: 'fila-nombre' }, b.nombre),
      b.origen === 'extra' ? h('span', { class: 'badge' }, 'Extra') : null,
      b.exerciseId !== b.original ? h('span', { class: 'badge' }, 'Cambiado hoy') : null);

    if (b.saltado) {
      return h('div', { class: 'fila' }, cabecera,
        h('div', { class: 'fila-meta' }, 'Salteado hoy: no se guarda.'),
        h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: () => { b.saltado = false; tocar(); pintarBloques(); } }, 'Hacerlo igual')));
    }

    const filas = b.filas.map((f, i) => {
      const u = b.ultima?.sets[i] ?? b.ultima?.sets[b.ultima.sets.length - 1] ?? null;
      const peso = h('input', { type: 'text', inputmode: 'decimal', placeholder: u && u.weight_kg != null ? formatoNumero(u.weight_kg) : 'kg', value: f.peso,
        'aria-label': `Peso de la serie ${i + 1} de ${b.nombre}`, onInput: () => { f.peso = peso.value; tocar(); actualizar(); } });
      const reps = h('input', { type: 'text', inputmode: 'numeric', placeholder: u ? String(u.reps) : 'reps', value: f.reps,
        'aria-label': `Repeticiones de la serie ${i + 1} de ${b.nombre}`, onInput: () => { f.reps = reps.value; tocar(); actualizar(); } });
      return h('div', { class: 'dos-col' }, h('label', {}, `Serie ${i + 1} · kg`, peso), h('label', {}, 'Reps', reps));
    });

    const cambiar = h('select', { 'aria-label': `Cambiar ${b.nombre} solo por hoy`, onChange: () => {
      const id = cambiar.value; if (!id) return;
      const ex = ejercicios.find((e) => e.id === id);
      b.exerciseId = id; b.nombre = ex.name; b.ultima = ultimas.get(id) ?? null;
      tocar(); pintarBloques();
    } }, h('option', { value: '' }, 'Cambiar por otro ejercicio (solo hoy)…'),
      ...activos().filter((e) => e.id !== b.exerciseId).map((e) => h('option', { value: e.id }, e.name)));

    const botones = [
      b.ultima ? h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: () => {
        b.ultima.sets.slice(0, MAX_FILAS).forEach((s, i) => {
          b.filas[i] = { peso: s.weight_kg == null ? '' : formatoNumero(s.weight_kg), reps: String(s.reps) };
        });
        tocar(); pintarBloques();
      } }, 'Copiar la última vez') : null,
      h('button', { class: 'btn btn-sec btn-sm', type: 'button', disabled: b.filas.length >= MAX_FILAS, onClick: () => { b.filas.push({ peso: '', reps: '' }); tocar(); pintarBloques(); } }, '+ Serie'),
      b.filas.length > 1 ? h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: () => { b.filas.pop(); tocar(); pintarBloques(); } }, '− Serie') : null,
      h('button', { class: 'link', type: 'button', onClick: () => { b.saltado = true; tocar(); pintarBloques(); } }, 'Saltear'),
      b.origen === 'extra' ? h('button', { class: 'link', type: 'button', onClick: () => { bloques = bloques.filter((x) => x !== b); tocar(); pintarBloques(); } }, 'Quitar') : null
    ];

    const el = h('div', { class: 'fila' }, cabecera,
      obj ? h('div', { class: 'fila-meta' }, 'Objetivo: ' + obj) : null,
      b.ultima ? h('div', { class: 'fila-meta' }, `Última vez (${etiquetaLarga(b.ultima.fecha)}): ` + b.ultima.sets.map(formatoSerie).join(' · ')) : h('div', { class: 'fila-meta' }, 'Sin datos de una vez anterior.'),
      ...filas, totEl, h('div', { class: 'acciones' }, ...botones), cambiar);
    actualizar0(totEl, b);
    return el;
  }
  const actualizar0 = (totEl, b) => {
    const t = totales(validarFilas(b.filas).sets);
    totEl.textContent = t.series ? `${t.series} series · ${t.reps} reps · ${formatoNumero(t.volumen)} kg` : 'Sin series cargadas';
  };

  function pintarBloques() {
    zonaBloques.replaceChildren(...bloques.map(bloqueEl), agregarExtra());
    pintarTotales();
  }

  function agregarExtra() {
    const sel = h('select', { 'aria-label': 'Ejercicio extra' }, h('option', { value: '' }, 'Agregar un ejercicio extra…'),
      ...activos().map((e) => h('option', { value: e.id }, e.name)));
    sel.addEventListener('change', () => {
      if (!sel.value) return;
      const ex = ejercicios.find((e) => e.id === sel.value);
      bloques.push({ exerciseId: ex.id, nombre: ex.name, objetivo: null, origen: 'extra', saltado: false, original: ex.id,
        filas: Array.from({ length: 3 }, () => ({ peso: '', reps: '' })), ultima: ultimas.get(ex.id) ?? null });
      tocar(); pintarBloques();
    });
    return h('div', { class: 'card form' }, sel);
  }

  // ---------- guardar ----------
  async function guardar(boton) {
    msg.textContent = ''; ok.textContent = ''; aviso.textContent = '';
    const r = armarEntrenamiento(bloques);
    if (r.errores.length) return mostrarError(r.errores.join(' · '));
    const dur = parsearNumero(duracion.value);
    if (Number.isNaN(dur) || (dur !== null && (!Number.isInteger(dur) || dur < 1 || dur > 600))) return mostrarError('La duración debe ser un número entero de minutos (1 a 600), o dejarla vacía.');
    const rutina = rutinas.find((x) => x.id === rutinaId) ?? null;
    const habito = buscarHabitoEntrenar(defsHabito, fecha);
    boton.disabled = true;
    try {
      await D.guardarEntrenamiento({
        sessionId: sesion?.id ?? null, fecha,
        routineId: sesion ? sesion.routine_id : (rutina?.id ?? null),
        routineName: sesion ? sesion.routine_name : (rutina?.name ?? null),
        duracion: dur, notas: notas.value.trim() || null, sets: r.sets, habitId: habito.version?.id ?? null
      });
      const MOTIVOS = {
        sin_habito: 'No encontré un hábito de Gym de tipo sí/no («Entrenar»): se guardó el entrenamiento, pero no se marcó nada en Hábitos.',
        ambiguo: 'Hay más de un hábito de Gym posible: se guardó el entrenamiento, pero no se marcó ninguno. Revisá en Central → Hábitos.',
        sin_version_vigente: 'El hábito «Entrenar» no estaba vigente ese día: se guardó el entrenamiento, pero no se marcó.'
      };
      const hab = habito.version
        ? `Hábito «${habito.version.name}» marcado como cumplido${habito.programado ? '' : ' (día no programado: cuenta como extra)'}.`
        : '';
      await cargar(fecha, `Entrenamiento guardado: ${r.totales.series} series, ${r.totales.reps} repeticiones, ${formatoNumero(r.totales.volumen)} kg. ${hab}`);
      if (!habito.version) aviso.textContent = MOTIVOS[habito.motivo];
    } catch (e) { mostrarError(e); } finally { boton.disabled = false; }
  }

  async function borrar() {
    if (!confirm('¿Borrar este entrenamiento y todas sus series? El hábito «Entrenar» de ese día NO se desmarca (corregilo en Central → Hoy si hace falta).')) return;
    try { await D.borrarSesion(sesion.id); await cargar(fecha, 'Entrenamiento borrado.'); } catch (e) { mostrarError(e); }
  }

  // ---------- pantalla ----------
  function pintar(actual) {
    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha del entrenamiento',
      onChange: () => { if (inputFecha.value && confirmarDescarte()) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    const ir = (n) => () => { if (confirmarDescarte()) cargar(sumarDias(fecha, n)); };
    const rutSel = h('select', { value: rutinaId, 'aria-label': 'Rutina', disabled: !!actual, onChange: () => {
      if (!confirmarDescarte()) { rutSel.value = rutinaId; return; }
      rutinaId = rutSel.value; sucio = false;
      bloques = bloquesIniciales({ items: rutinaId ? itemsDe(rutinaId) : [], ejercicios, ultimas });
      pintarBloques();
    } }, h('option', { value: '' }, 'Sin rutina (libre)'),
      ...rutinas.filter((x) => !x.archived).map((x) => h('option', { value: x.id }, x.name)));
    duracion = h('input', { type: 'text', inputmode: 'numeric', value: actual?.duration_min ?? '', placeholder: 'Minutos (opcional)', onInput: tocar });
    notas = h('input', { type: 'text', maxLength: 300, value: actual?.notes ?? '', placeholder: 'Notas (opcional)', onInput: tocar });
    zonaBloques = h('div'); zonaTotales = h('div', { class: 'card pad' });
    const botonGuardar = h('button', { class: 'btn', type: 'button' }, actual ? 'Guardar cambios' : 'Guardar entrenamiento');
    botonGuardar.addEventListener('click', () => guardar(botonGuardar));

    raiz.replaceChildren(
      h('div', { class: 'card form' },
        h('div', { class: 'fecha-nav' },
          h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: ir(-1) }, '‹'),
          h('strong', {}, etiquetaLarga(fecha)),
          h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: ir(1) }, '›')),
        h('label', {}, 'Fecha', inputFecha),
        actual
          ? h('p', { class: 'nota' }, `Ya hay un entrenamiento guardado este día (${actual.routine_name ?? 'sin rutina'}): lo que guardes lo reemplaza.${extraSesiones ? ` Hay ${extraSesiones} más ese día; se edita el más reciente.` : ''}`)
          : null,
        h('label', {}, 'Rutina', rutSel)),
      zonaBloques, zonaTotales,
      h('div', { class: 'card form' }, h('label', {}, 'Duración', duracion), h('label', {}, 'Notas', notas)),
      msg, ok, aviso,
      h('div', { class: 'acciones' }, botonGuardar,
        actual ? h('button', { class: 'btn btn-sec', type: 'button', onClick: borrar }, 'Borrar entrenamiento') : null));
    pintarBloques();
  }

  cont.append(raiz);
  return cargar();
}
