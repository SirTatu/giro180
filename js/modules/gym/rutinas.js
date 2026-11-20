// Gym → pestaña "Rutinas": alta, edición, archivo, día sugerido y ejercicios de cada rutina
// (agregar, cambiar, quitar, reordenar y editar series × repeticiones).
import { h } from '../../core/dom.js';
import { formatoObjetivo, validarObjetivo, intercambiarOrden, buscarCoincidencia, traducirError } from '../../core/gym.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

const DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const numero = (el) => (el.value.trim() === '' ? null : Number(el.value));

export function renderRutinas(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  let token = 0;
  let rutinas = [], items = [], ejercicios = [];
  let abierta = null;                                    // null = lista | 'nueva' | id de rutina
  let formItem = null;                                   // null | 'nuevo' | id del ejercicio-de-rutina que se edita

  const mostrarError = (e) => { msg.textContent = traducirError(e); };
  const itemsDe = (rid) => items.filter((i) => i.routine_id === rid).sort((a, b) => a.sort_order - b.sort_order);
  const nombreEj = (id) => ejercicios.find((e) => e.id === id);

  async function cargar() {
    const t = ++token;
    try {
      const [r, i, e] = await Promise.all([D.listarRutinas(), D.listarItems(), D.listarEjercicios()]);
      if (t !== token) return;
      rutinas = r; items = i; ejercicios = e; msg.textContent = '';
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, cargar));
    }
  }
  async function ejecutar(fn) {
    msg.textContent = '';
    try { await fn(); await cargar(); } catch (e) { mostrarError(e); }
  }

  // ---------------- lista ----------------
  function filaRutina(r) {
    const n = itemsDe(r.id).length;
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, r.name),
        r.archived ? h('span', { class: 'badge' }, 'Archivada') : null),
      h('div', { class: 'fila-meta' }, (r.weekday ? DIA[r.weekday] : 'Sin día sugerido') + ' · ' + (n === 1 ? '1 ejercicio' : `${n} ejercicios`)),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn btn-sm', type: 'button', onClick: () => { abierta = r.id; formItem = null; pintar(); } }, 'Abrir y editar')));
  }
  function lista() {
    const orden = (a, b) => (a.weekday ?? 9) - (b.weekday ?? 9) || a.name.localeCompare(b.name);
    const activas = rutinas.filter((r) => !r.archived).sort(orden);
    const archivadas = rutinas.filter((r) => r.archived).sort(orden);
    return [
      h('button', { class: 'btn', type: 'button', onClick: () => { abierta = 'nueva'; formItem = null; pintar(); } }, '+ Nueva rutina'),
      ...(activas.length ? activas.map(filaRutina)
        : [h('div', { class: 'card' }, h('p', {}, 'Todavía no hay rutinas. Creá una o usá la pestaña «Importar».'))]),
      archivadas.length ? h('details', { class: 'card pad' }, h('summary', {}, `Archivadas (${archivadas.length})`), ...archivadas.map(filaRutina)) : null
    ];
  }

  // ---------------- editor de una rutina ----------------
  function datosRutina(r) {
    const nombre = h('input', { type: 'text', maxLength: 80, value: r?.name ?? '', placeholder: 'Ej.: Martes – Pecho y tríceps' });
    const dia = h('select', { value: r?.weekday ?? '' }, h('option', { value: '' }, 'Sin día sugerido'),
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('option', { value: d }, DIA[d])));
    const notas = h('input', { type: 'text', maxLength: 200, value: r?.notes ?? '', placeholder: 'Notas (opcional)' });
    const guardar = h('button', { class: 'btn', type: 'button' }, r ? 'Guardar datos' : 'Crear rutina');
    guardar.addEventListener('click', async () => {
      msg.textContent = '';
      const nom = nombre.value.trim();
      if (!nom) return mostrarError(new Error('Poné un nombre.'));
      const campos = { name: nom, weekday: dia.value ? Number(dia.value) : null, notes: notas.value.trim() || null };
      guardar.disabled = true;
      try {
        if (r) await D.actualizarRutina(r.id, campos);
        else abierta = (await D.crearRutina(campos)).id;          // al crearla se abre para cargar ejercicios
        await cargar();
      } catch (e) { mostrarError(e); } finally { guardar.disabled = false; }
    });
    return h('div', { class: 'card form' },
      h('strong', {}, r ? 'Datos de la rutina' : 'Nueva rutina'),
      h('p', { class: 'nota' }, 'Cambiar el nombre o los objetivos no altera los entrenamientos ya registrados: cada uno guarda su propia copia.'),
      h('label', {}, 'Nombre', nombre), h('label', {}, 'Día sugerido', dia), h('label', {}, 'Notas', notas),
      h('div', { class: 'acciones' }, guardar));
  }

  function formularioItem(r, it) {
    const activos = ejercicios.filter((e) => !e.archived || e.id === it?.exercise_id);
    const sel = h('select', { value: it?.exercise_id ?? '', onChange: () => { bloqueNuevo.hidden = sel.value !== '__nuevo'; } },
      h('option', { value: '' }, 'Elegí un ejercicio…'),
      ...activos.map((e) => h('option', { value: e.id }, e.name + (e.archived ? ' (archivado)' : ''))),
      h('option', { value: '__nuevo' }, '+ Crear ejercicio nuevo…'));
    const nombreNuevo = h('input', { type: 'text', maxLength: 80, placeholder: 'Nombre del ejercicio nuevo' });
    const bloqueNuevo = h('label', {}, 'Nombre del ejercicio nuevo', nombreNuevo);
    bloqueNuevo.hidden = true;
    const series = h('input', { type: 'number', min: '1', max: '20', step: '1', inputmode: 'numeric', value: it?.target_sets ?? '' });
    const rmin = h('input', { type: 'number', min: '1', max: '200', step: '1', inputmode: 'numeric', value: it?.reps_min ?? '' });
    const rmax = h('input', { type: 'number', min: '1', max: '200', step: '1', inputmode: 'numeric', value: it?.reps_max ?? '' });
    const notas = h('input', { type: 'text', maxLength: 200, value: it?.notes ?? '', placeholder: 'Nota (ej.: alternativa)' });
    const guardar = h('button', { class: 'btn', type: 'button' }, it ? 'Guardar cambios' : 'Agregar a la rutina');

    guardar.addEventListener('click', async () => {
      msg.textContent = '';
      const obj = { series: numero(series), repsMin: numero(rmin), repsMax: numero(rmax) };
      if (!sel.value) return mostrarError(new Error('Elegí un ejercicio.'));
      const err = validarObjetivo(obj);
      if (err) return mostrarError(new Error(err));
      guardar.disabled = true;
      try {
        let exId = sel.value;
        if (exId === '__nuevo') {
          const nom = nombreNuevo.value.trim();
          if (!nom) throw new Error('Poné el nombre del ejercicio nuevo.');
          const igual = buscarCoincidencia(nom, ejercicios).tipo === 'exacta'
            ? ejercicios.find((e) => buscarCoincidencia(nom, [e]).tipo === 'exacta') : null;
          if (igual) {
            exId = igual.id;                                          // ya existía: se reutiliza
            if (igual.archived) await D.actualizarEjercicio(igual.id, { archived: false });
          } else exId = (await D.crearEjercicio({ name: nom })).id;
        }
        const campos = { exercise_id: exId, target_sets: obj.series, reps_min: obj.repsMin, reps_max: obj.repsMax, notes: notas.value.trim() || null };
        if (it) await D.actualizarItem(it.id, campos);
        else {
          const max = Math.max(0, ...itemsDe(r.id).map((i) => i.sort_order));
          await D.crearItem({ ...campos, routine_id: r.id, sort_order: max + 1 });
        }
        formItem = null;
        await cargar();
      } catch (e) { mostrarError(e); } finally { guardar.disabled = false; }
    });

    return h('div', { class: 'card form' },
      h('strong', {}, it ? 'Editar ejercicio de la rutina' : 'Agregar ejercicio'),
      h('label', {}, 'Ejercicio', sel), bloqueNuevo,
      h('div', { class: 'tres-col' }, h('label', {}, 'Series', series), h('label', {}, 'Reps mín.', rmin), h('label', {}, 'Reps máx.', rmax)),
      h('label', {}, 'Nota', notas),
      h('div', { class: 'acciones' }, guardar,
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { formItem = null; pintar(); } }, 'Cancelar')));
  }

  function filaItem(r, lista, it, k) {
    const ej = nombreEj(it.exercise_id);
    const mover = (dir) => () => ejecutar(async () => {
      const cambios = intercambiarOrden(lista.map((x) => ({ id: x.id, sort_order: x.sort_order })), it.id, dir);
      for (const c of cambios) await D.actualizarItem(c.id, { sort_order: c.sort_order });
    });
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, `${k + 1}. ${ej?.name ?? '(ejercicio desconocido)'}`),
        ej?.archived ? h('span', { class: 'badge' }, 'Archivado') : null),
      h('div', { class: 'fila-meta' }, formatoObjetivo(it.target_sets, it.reps_min, it.reps_max) + (it.notes ? ' · ' + it.notes : '')),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', disabled: k === 0, 'aria-label': 'Subir', onClick: mover(-1) }, '↑'),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', disabled: k === lista.length - 1, 'aria-label': 'Bajar', onClick: mover(1) }, '↓'),
        h('button', { class: 'link', type: 'button', onClick: () => { formItem = it.id; pintar(); } }, 'Editar'),
        h('button', { class: 'link', type: 'button', onClick: () => {
          if (confirm(`¿Quitar «${ej?.name ?? 'este ejercicio'}» de la rutina? Los entrenamientos ya registrados no cambian.`)) ejecutar(() => D.quitarItem(it.id));
        } }, 'Quitar')));
  }

  function editor() {
    const volver = h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: () => { abierta = null; formItem = null; pintar(); } }, '← Volver a las rutinas');
    if (abierta === 'nueva') return [volver, datosRutina(null)];
    const r = rutinas.find((x) => x.id === abierta);
    if (!r) { abierta = null; return lista(); }
    const lis = itemsDe(r.id);
    const edit = formItem && formItem !== 'nuevo' ? lis.find((x) => x.id === formItem) : null;
    return [
      volver,
      h('h2', { class: 'grupo-titulo' }, r.name),
      datosRutina(r),
      h('h2', { class: 'grupo-titulo' }, `Ejercicios (${lis.length})`),
      ...lis.map((it, k) => filaItem(r, lis, it, k)),
      !lis.length ? h('div', { class: 'card' }, h('p', {}, 'Esta rutina no tiene ejercicios todavía.')) : null,
      formItem ? formularioItem(r, edit)
        : h('button', { class: 'btn', type: 'button', onClick: () => { formItem = 'nuevo'; pintar(); } }, '+ Agregar ejercicio'),
      h('button', { class: 'btn btn-sec', type: 'button', onClick: () => {
        if (r.archived || confirm(`¿Archivar «${r.name}»? Deja de ofrecerse para entrenar; el historial se conserva.`)) {
          ejecutar(() => D.actualizarRutina(r.id, { archived: !r.archived }));
        }
      } }, r.archived ? 'Desarchivar rutina' : 'Archivar rutina')
    ];
  }

  function pintar() { raiz.replaceChildren(msg, ...(abierta ? editor() : lista())); }

  cont.append(raiz);
  return cargar();
}
