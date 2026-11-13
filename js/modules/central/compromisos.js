// Compromisos y turnos (sirven a Central y, más adelante, a Derma).
import { h } from '../../core/dom.js';
import { formatoFechaHora } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import * as D from './datos.js';

export function renderCompromisos(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  cont.append(h('h2', { class: 'seccion-titulo' }, 'Compromisos'), msg, raiz);
  let todos = [];

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  async function cargar() {
    try { todos = await D.listarCompromisos(); msg.textContent = ''; } catch (e) { mostrarError(e); }
    pintar();
  }
  async function ejecutar(fn) {
    msg.textContent = '';
    try { await fn(); await cargar(); } catch (e) { mostrarError(e); }
  }

  function fila(c) {
    const vencido = new Date(c.starts_at) < new Date();
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' },
        h('div', {}, h('div', { class: 'fila-nombre' }, c.title),
          h('div', { class: 'fila-meta' },
            [formatoFechaHora(c.starts_at), c.module ? NOMBRES_MODULO[c.module] : null, c.location].filter(Boolean).join(' · '))),
        vencido ? h('span', { class: 'badge no_registrado' }, 'Vencido') : null),
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => ejecutar(() => D.actualizarCompromiso(c.id, { status: 'done' })) }, 'Hecho'),
        h('button', { class: 'link', type: 'button', onClick: () => ejecutar(() => D.actualizarCompromiso(c.id, { status: 'cancelled' })) }, 'Cancelar'),
        h('button', { class: 'link', type: 'button', onClick: () => {
          if (confirm(`¿Eliminar «${c.title}»?`)) ejecutar(() => D.eliminarCompromiso(c.id));
        } }, 'Eliminar')));
  }

  function formulario() {
    const titulo = h('input', { type: 'text', placeholder: 'Ej.: Turno dermatólogo', maxLength: 120 });
    const cuando = h('input', { type: 'datetime-local' });
    const modulo = h('select', {}, h('option', { value: '' }, 'General'),
      ...ORDEN_MODULOS.map((k) => h('option', { value: k }, NOMBRES_MODULO[k])));
    const lugar = h('input', { type: 'text', placeholder: 'Lugar (opcional)', maxLength: 120 });
    const boton = h('button', { class: 'btn btn-sm', type: 'button' }, 'Agregar');
    boton.addEventListener('click', async () => {
      msg.textContent = '';
      if (!titulo.value.trim()) return mostrarError(new Error('Escribí qué es el compromiso.'));
      if (!cuando.value) return mostrarError(new Error('Elegí fecha y hora.'));
      boton.disabled = true;
      try {
        await D.crearCompromiso({
          title: titulo.value.trim(), starts_at: new Date(cuando.value).toISOString(),
          module: modulo.value || null, location: lugar.value.trim() || null
        });
        await cargar();
      } catch (e) { mostrarError(e); } finally { boton.disabled = false; }
    });
    return h('div', { class: 'card form' }, h('strong', {}, 'Agregar compromiso'),
      titulo, h('label', {}, 'Fecha y hora', cuando),
      h('div', { class: 'dos-col' }, h('label', {}, 'Módulo', modulo), h('label', {}, 'Lugar', lugar)),
      h('div', { class: 'acciones' }, boton));
  }

  function pintar() {
    const pendientes = todos.filter((c) => c.status === 'pending');
    const resto = todos.filter((c) => c.status !== 'pending').sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)).slice(0, 15);
    const filas = pendientes.map(fila);
    if (!pendientes.length) filas.push(h('p', { class: 'nota' }, 'No hay compromisos pendientes.'));
    const hist = resto.length
      ? h('details', { class: 'card pad' }, h('summary', {}, `Hechos o cancelados (últimos ${resto.length})`),
          ...resto.map((c) => h('p', { class: 'fila-meta' },
            `${c.status === 'done' ? 'Hecho' : 'Cancelado'} · ${c.title} · ${formatoFechaHora(c.starts_at)}`)))
      : null;
    raiz.replaceChildren(...filas, formulario(), hist);
  }

  cargar();
}
