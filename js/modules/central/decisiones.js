// Historial de decisiones y cambios. Solo se agrega: no se edita ni se borra.
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import * as D from './datos.js';

const LIMITE = 30;

// Devuelve una función "recargar" para que otras secciones avisen cuando anotan una decisión.
export function renderDecisiones(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const lista = h('div');
  cont.append(h('h2', { class: 'seccion-titulo' }, 'Historial de decisiones'), msg);

  const area = h('select', {}, h('option', { value: 'general' }, 'General'),
    ...ORDEN_MODULOS.map((k) => h('option', { value: k }, NOMBRES_MODULO[k])));
  const decision = h('input', { type: 'text', placeholder: 'Decisión o cambio', maxLength: 200 });
  const motivo = h('input', { type: 'text', placeholder: 'Motivo (opcional)', maxLength: 300 });
  const boton = h('button', { class: 'btn btn-sm', type: 'button' }, 'Registrar');
  boton.addEventListener('click', async () => {
    msg.textContent = '';
    if (!decision.value.trim()) { msg.textContent = 'Escribí la decisión.'; return; }
    boton.disabled = true;
    try {
      await D.registrarDecision({ decided_on: hoy(), area: area.value, decision: decision.value.trim(), reason: motivo.value.trim() || null });
      decision.value = ''; motivo.value = '';
      await recargar();
    } catch (e) { msg.textContent = e.message; } finally { boton.disabled = false; }
  });

  cont.append(
    h('div', { class: 'card form' }, h('strong', {}, 'Registrar una decisión'),
      h('label', {}, 'Área', area), decision, motivo, h('div', { class: 'acciones' }, boton)),
    lista,
    h('p', { class: 'nota' }, `Se muestran las últimas ${LIMITE}. Lo registrado no se puede editar ni borrar.`));

  async function recargar() {
    try {
      const filas = await D.listarDecisiones(LIMITE);
      msg.textContent = '';
      lista.replaceChildren(...(filas.length
        ? filas.map((d) => h('div', { class: 'fila' },
            h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, d.decision),
              h('span', { class: 'badge' }, NOMBRES_MODULO[d.area] ?? 'General')),
            h('div', { class: 'fila-meta' }, d.decided_on + (d.reason ? ' · ' + d.reason : ''))))
        : [h('p', { class: 'nota' }, 'Todavía no hay decisiones registradas.')]));
    } catch (e) { msg.textContent = e.message; }
  }

  recargar();
  return recargar;
}
