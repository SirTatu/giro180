// Prioridades generales: máximo 3 activas. Solo Central las establece.
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import * as D from './datos.js';

const MAX = 3;

export function renderPrioridades(cont, ctx) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  cont.append(h('h2', { class: 'seccion-titulo' }, 'Prioridades'), msg, raiz);
  let todas = [];

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  async function cargar() {
    try { todas = await D.listarPrioridades(); msg.textContent = ''; } catch (e) { mostrarError(e); }
    pintar();
  }

  async function decidir(decision, motivo) {
    await D.registrarDecision({ decided_on: hoy(), area: 'central', decision, reason: motivo || null });
    ctx.alRegistrarDecision?.();
  }

  async function agregar(titulo, detalle) {
    msg.textContent = '';
    const t = titulo.value.trim();
    if (!t) return mostrarError(new Error('Escribí el título de la prioridad.'));
    try {
      await D.crearPrioridad({ title: t, description: detalle.value.trim() || null, started_on: hoy() });
    } catch (e) { return mostrarError(e); }
    try { await decidir(`Nueva prioridad: ${t}`, null); }
    catch (e) { mostrarError(new Error('La prioridad se creó, pero no se pudo anotar en el historial: ' + e.message)); }
    await cargar();
  }

  async function cerrar(p) {
    const motivo = prompt(`Cerrar la prioridad «${p.title}».\n¿Por qué se cierra? (opcional)`);
    if (motivo === null) return;                       // cancelado
    msg.textContent = '';
    try { await D.cerrarPrioridad(p.id, hoy()); } catch (e) { return mostrarError(e); }
    try { await decidir(`Prioridad cerrada: ${p.title}`, motivo.trim()); }
    catch (e) { mostrarError(new Error('Se cerró, pero no se pudo anotar en el historial: ' + e.message)); }
    await cargar();
  }

  function pintar() {
    const activas = todas.filter((p) => p.ended_on == null);
    const cerradas = todas.filter((p) => p.ended_on != null);

    const lista = activas.map((p, i) => h('div', { class: 'fila' },
      h('div', { class: 'fila-top' },
        h('div', {}, h('div', { class: 'fila-nombre' }, `${i + 1}. ${p.title}`),
          p.description ? h('div', { class: 'fila-meta' }, p.description) : null),
        h('span', { class: 'badge' }, 'Desde ' + p.started_on)),
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => cerrar(p) }, 'Cerrar'))));
    if (!activas.length) lista.push(h('p', { class: 'nota' }, 'No hay prioridades vigentes.'));

    const completo = activas.length >= MAX;
    const titulo = h('input', { type: 'text', placeholder: 'Nueva prioridad', maxLength: 120, disabled: completo });
    const detalle = h('input', { type: 'text', placeholder: 'Detalle (opcional)', maxLength: 200, disabled: completo });
    const form = h('div', { class: 'card form' },
      completo
        ? h('p', { class: 'nota' }, `Ya hay ${MAX} prioridades activas. Cerrá una para agregar otra.`)
        : h('strong', {}, `Agregar prioridad (${activas.length} de ${MAX})`),
      titulo, detalle,
      h('div', { class: 'acciones' },
        h('button', { class: 'btn btn-sm', type: 'button', disabled: completo, onClick: () => agregar(titulo, detalle) }, 'Agregar')));

    const hist = cerradas.length
      ? h('details', { class: 'card pad' },
          h('summary', {}, `Prioridades cerradas (${cerradas.length})`),
          ...cerradas.map((p) => h('p', { class: 'fila-meta' }, `${p.title} · ${p.started_on} → ${p.ended_on}`)))
      : null;

    raiz.replaceChildren(...lista, form, hist);
  }

  cargar();
}
