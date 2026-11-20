// Gym → pestaña "Historial": entrenamientos pasados con totales, resumen por semana y progresión por ejercicio.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import {
  totalesPorSesion, totalesPorSemana, progresionEjercicio, agruparPorEjercicio, totales, mejorSerie,
  formatoNumero, formatoSerie, textoObjetivo
} from '../../core/entrenos.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

const RANGOS = [{ dias: 30, nombre: 'Últimos 30 días' }, { dias: 90, nombre: 'Últimos 90 días' }, { dias: 180, nombre: 'Últimos 180 días' }];
const resumen = (t) => `${t.series} series · ${t.reps} reps · ${formatoNumero(t.volumen)} kg` + (t.sinPeso ? ` (${t.sinPeso} sin peso)` : '');

export function renderHistorial(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const zona = h('div');
  let token = 0;
  let dias = 30, ejercicioSel = '';

  async function cargar() {
    const t = ++token;
    try {
      const desde = sumarDias(hoy(), -(dias - 1));
      const [sesiones, ejercicios] = await Promise.all([D.listarSesiones(desde), D.listarEjercicios()]);
      const sets = await D.setsDe(sesiones.map((s) => s.id));
      if (t !== token) return;
      msg.textContent = '';
      pintar(sesiones, sets, new Map(ejercicios.map((e) => [e.id, e.name])));
    } catch (err) {
      if (t !== token) return;
      zona.replaceChildren(cajaError(err, cargar));
    }
  }

  function pintar(sesiones, sets, nombres) {
    const rango = h('select', { value: String(dias), 'aria-label': 'Período', onChange: () => { dias = Number(rango.value); cargar(); } },
      ...RANGOS.map((r) => h('option', { value: String(r.dias) }, r.nombre)));
    const bloques = [h('div', { class: 'card form' }, h('label', {}, 'Período', rango))];

    if (!sesiones.length) {
      bloques.push(h('div', { class: 'card' }, h('p', {}, 'No hay entrenamientos registrados en este período.')));
      zona.replaceChildren(...bloques);
      return;
    }

    const porSesion = totalesPorSesion(sesiones, sets);
    const semanas = totalesPorSemana(sesiones, sets);
    bloques.push(h('h2', { class: 'grupo-titulo' }, 'Por semana'),
      ...semanas.map((w) => h('div', { class: 'fila' },
        h('div', { class: 'fila-nombre' }, `Semana del ${etiquetaLarga(w.semana)}`),
        h('div', { class: 'fila-meta' }, `${w.sesiones} ${w.sesiones === 1 ? 'entrenamiento' : 'entrenamientos'} · ${resumen(w)}`))));

    // progresión por ejercicio
    const idsConDatos = [...new Set(sets.map((s) => s.exercise_id))].sort((a, b) => (nombres.get(a) ?? '').localeCompare(nombres.get(b) ?? ''));
    if (!idsConDatos.includes(ejercicioSel)) ejercicioSel = '';
    const selEj = h('select', { value: ejercicioSel, 'aria-label': 'Ejercicio', onChange: () => { ejercicioSel = selEj.value; pintar(sesiones, sets, nombres); } },
      h('option', { value: '' }, 'Elegí un ejercicio…'), ...idsConDatos.map((id) => h('option', { value: id }, nombres.get(id) ?? '(desconocido)')));
    bloques.push(h('h2', { class: 'grupo-titulo' }, 'Progresión por ejercicio'), h('div', { class: 'card form' }, selEj));
    if (ejercicioSel) {
      const prog = progresionEjercicio(sesiones, sets, ejercicioSel);
      bloques.push(...prog.map((p) => h('div', { class: 'fila' },
        h('div', { class: 'fila-nombre' }, etiquetaLarga(p.fecha)),
        h('div', { class: 'fila-meta' }, p.sets.map(formatoSerie).join(' · ')),
        h('div', { class: 'fila-meta' }, resumen(p) + (p.mejor ? ` · mejor: ${formatoSerie(p.mejor)}` : '')),
        h('div', { class: 'fila-meta' }, p.deltaVolumen == null ? 'Volumen: sin base de comparación' : `Volumen vs. la vez anterior: ${p.deltaVolumen > 0 ? '+' : ''}${formatoNumero(p.deltaVolumen)} %`))));
    }

    // lista de entrenamientos
    bloques.push(h('h2', { class: 'grupo-titulo' }, `Entrenamientos (${sesiones.length})`));
    for (const s of sesiones) {
      const delaSesion = sets.filter((x) => x.session_id === s.id);
      const detalle = [...agruparPorEjercicio(delaSesion)].map(([id, v]) => h('div', {},
        h('strong', {}, nombres.get(id) ?? '(desconocido)'),
        v[0].target_sets != null || v[0].target_reps_min != null ? h('span', { class: 'fila-meta' }, ' · objetivo ' + textoObjetivo({ series: v[0].target_sets, min: v[0].target_reps_min, max: v[0].target_reps_max })) : null,
        h('div', { class: 'fila-meta' }, v.map(formatoSerie).join(' · '))));
      bloques.push(h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, etiquetaLarga(s.performed_on)), h('span', { class: 'badge' }, s.routine_name ?? 'Sin rutina')),
        h('div', { class: 'fila-meta' }, resumen(porSesion.get(s.id)) + (s.duration_min ? ` · ${s.duration_min} min` : '')),
        s.notes ? h('div', { class: 'fila-meta' }, s.notes) : null,
        h('details', {}, h('summary', {}, 'Ver series'), ...detalle),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn btn-sm', type: 'button', onClick: () => ctx.irAEntrenar?.(s.performed_on) }, 'Editar'),
          h('button', { class: 'link', type: 'button', onClick: async () => {
            if (!confirm('¿Borrar este entrenamiento y sus series? El hábito «Entrenar» de ese día NO se desmarca.')) return;
            try { await D.borrarSesion(s.id); await cargar(); } catch (e) { msg.textContent = traducirError(e); }
          } }, 'Borrar'))));
    }
    zona.replaceChildren(...bloques);
  }

  cont.append(msg, zona);
  return cargar();
}
