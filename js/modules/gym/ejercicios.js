// Gym → pestaña "Ejercicios": catálogo con alta, edición, grupo muscular y archivo.
import { h } from '../../core/dom.js';
import { GRUPOS, NOMBRES_GRUPO, normalizar, traducirError } from '../../core/gym.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

export function renderEjercicios(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const zonaForm = h('div');
  const zonaLista = h('div');
  let token = 0;
  let ejercicios = [];
  let items = [];
  let q = '', grupo = '', verArchivados = false;
  let editando = null;                                   // null | 'nuevo' | id del ejercicio

  const mostrarError = (e) => { msg.textContent = traducirError(e); };

  async function cargar() {
    const t = ++token;
    try {
      const [e, i] = await Promise.all([D.listarEjercicios(), D.listarItems()]);
      if (t !== token) return;                           // llegó una respuesta vieja: se ignora
      ejercicios = e; items = i; msg.textContent = '';
      pintar();
    } catch (err) {
      if (t !== token) return;
      zonaForm.replaceChildren();
      zonaLista.replaceChildren(cajaError(err, cargar));
    }
  }
  async function ejecutar(fn) {
    msg.textContent = '';
    try { await fn(); await cargar(); } catch (e) { mostrarError(e); }
  }

  // ---- filtros (se arman una sola vez para no perder el foco al escribir) ----
  const buscador = h('input', { type: 'search', placeholder: 'Buscar ejercicio…', 'aria-label': 'Buscar ejercicio',
    onInput: () => { q = normalizar(buscador.value); pintarLista(); } });
  const filtroGrupo = h('select', { 'aria-label': 'Filtrar por grupo muscular', onChange: () => { grupo = filtroGrupo.value; pintarLista(); } },
    h('option', { value: '' }, 'Todos los grupos'),
    h('option', { value: '__sin' }, 'Sin grupo asignado'),
    ...GRUPOS.map((g) => h('option', { value: g }, NOMBRES_GRUPO[g])));
  const chkArch = h('input', { type: 'checkbox', onChange: () => { verArchivados = chkArch.checked; pintarLista(); } });
  const filtros = h('div', { class: 'card form' }, buscador, filtroGrupo,
    h('label', { class: 'check' }, chkArch, 'Mostrar archivados'));

  function formulario() {
    const ej = editando === 'nuevo' ? null : ejercicios.find((e) => e.id === editando);
    const nombre = h('input', { type: 'text', maxLength: 80, value: ej?.name ?? '', placeholder: 'Nombre del ejercicio' });
    const sel = h('select', { value: ej?.muscle_group ?? '' }, h('option', { value: '' }, 'Sin grupo asignado'),
      ...GRUPOS.map((g) => h('option', { value: g }, NOMBRES_GRUPO[g])));
    const notas = h('input', { type: 'text', maxLength: 200, value: ej?.notes ?? '', placeholder: 'Notas (opcional)' });
    const guardar = h('button', { class: 'btn', type: 'button' }, ej ? 'Guardar cambios' : 'Crear ejercicio');
    guardar.addEventListener('click', async () => {
      msg.textContent = '';
      const nom = nombre.value.trim();
      if (!nom) return mostrarError(new Error('Poné un nombre.'));
      const campos = { name: nom, muscle_group: sel.value || null, notes: notas.value.trim() || null };
      guardar.disabled = true;
      try {
        if (ej) await D.actualizarEjercicio(ej.id, campos); else await D.crearEjercicio(campos);
        editando = null;
        await cargar();
      } catch (e) { mostrarError(e); } finally { guardar.disabled = false; }
    });
    return h('div', { class: 'card form' },
      h('strong', {}, ej ? 'Editar ejercicio' : 'Nuevo ejercicio'),
      h('label', {}, 'Nombre', nombre), h('label', {}, 'Grupo muscular', sel), h('label', {}, 'Notas', notas),
      h('div', { class: 'acciones' }, guardar,
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { editando = null; pintar(); } }, 'Cancelar')));
  }

  function fila(e) {
    const uso = items.filter((i) => i.exercise_id === e.id).length;
    const sel = h('select', { value: e.muscle_group ?? '', 'aria-label': 'Grupo muscular de ' + e.name,
      onChange: () => ejecutar(() => D.actualizarEjercicio(e.id, { muscle_group: sel.value || null })) },
      h('option', { value: '' }, 'Sin grupo'), ...GRUPOS.map((g) => h('option', { value: g }, NOMBRES_GRUPO[g])));
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, e.name),
        e.archived ? h('span', { class: 'badge' }, 'Archivado') : null),
      h('div', { class: 'fila-meta' }, uso === 1 ? 'En 1 rutina' : `En ${uso} rutinas`, e.notes ? ' · ' + e.notes : ''),
      sel,
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => { editando = e.id; pintar(); } }, 'Editar'),
        h('button', { class: 'link', type: 'button', onClick: () => {
          if (e.archived || confirm(`¿Archivar «${e.name}»? Deja de ofrecerse al armar rutinas; el historial se conserva.`)) {
            ejecutar(() => D.actualizarEjercicio(e.id, { archived: !e.archived }));
          }
        } }, e.archived ? 'Desarchivar' : 'Archivar')));
  }

  function pintarLista() {
    const lista = ejercicios.filter((e) =>
      (verArchivados || !e.archived) &&
      (!q || normalizar(e.name).includes(q)) &&
      (!grupo || (grupo === '__sin' ? !e.muscle_group : e.muscle_group === grupo)));
    zonaLista.replaceChildren(
      ...(lista.length ? lista.map(fila)
        : [h('div', { class: 'card' }, h('p', {}, ejercicios.length ? 'Ningún ejercicio coincide con el filtro.'
          : 'Todavía no hay ejercicios. Creá uno con «Nuevo ejercicio» o importá tus rutinas.'))]));
  }
  function pintar() {
    zonaForm.replaceChildren(editando
      ? formulario()
      : h('button', { class: 'btn', type: 'button', onClick: () => { editando = 'nuevo'; pintar(); } }, '+ Nuevo ejercicio'));
    pintarLista();
  }

  cont.append(msg, zonaForm, filtros, zonaLista);
  return cargar();
}
