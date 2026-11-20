// Gym → pestaña "Cuerpo": peso y cintura (tabla body_measurements, compartida con Nutri) y su tendencia en números.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import { validarMedida, tendenciaMedidas, formatoDelta } from '../../core/cuerpo.js';
import * as M from '../compartido/medidas.js';
import { cajaError } from './ui.js';

const PERIODOS = [{ dias: 30, nombre: 'Últimos 30 días' }, { dias: 90, nombre: 'Últimos 90 días' }, { dias: 180, nombre: 'Últimos 180 días' }];

export function renderCuerpo(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = hoy(), dias = 30;

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const [filas, delDia] = await Promise.all([M.medidasDesde(sumarDias(hoy(), -(dias + 14))), M.medidaDelDia(f)]);
      if (t !== token) return;
      fecha = f; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar(filas, delDia);
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  function tarjetaTendencia(titulo, unidad, t) {
    const n = (v) => `${formatoNumero(v)} ${unidad}`;
    const lineas = [];
    lineas.push(t.ultimo
      ? `Última: ${n(t.ultimo.valor)} (${t.diasDesdeUltimo === 0 ? 'hoy' : t.diasDesdeUltimo === 1 ? 'ayer' : `hace ${t.diasDesdeUltimo} días`}, ${etiquetaLarga(t.ultimo.fecha)}).`
      : 'Todavía no hay mediciones.');
    if (t.promedio7) {
      lineas.push(`Promedio de los últimos 7 días: ${n(t.promedio7.valor)} (${t.promedio7.n} ${t.promedio7.n === 1 ? 'medición' : 'mediciones'}).`);
      lineas.push(t.promedio7Previo
        ? `Contra los 7 días anteriores (${n(t.promedio7Previo.valor)}, ${t.promedio7Previo.n} ${t.promedio7Previo.n === 1 ? 'medición' : 'mediciones'}): ${formatoDelta(t.deltaSemana, unidad)}.`
        : 'Contra los 7 días anteriores: no hay base de comparación.');
    } else if (t.ultimo) lineas.push('Sin mediciones en los últimos 7 días.');
    lineas.push(t.cambioPeriodo != null
      ? `Cambio en el período: ${formatoDelta(t.cambioPeriodo, unidad)} (de ${n(t.primeroPeriodo.valor)} a ${n(t.ultimo.valor)}; ${t.n} mediciones; mín. ${n(t.min)}, máx. ${n(t.max)}).`
      : 'Cambio en el período: no hay base de comparación (hacen falta al menos 2 mediciones).');
    lineas.push(t.ritmoSemanal != null
      ? `Ritmo estimado: ${formatoDelta(t.ritmoSemanal, unidad)} por semana (aproximado, sobre todo el período).`
      : 'Ritmo estimado: sin datos suficientes (hacen falta 3 mediciones que abarquen 7 días o más).');
    return h('div', { class: 'card pad' }, h('strong', {}, titulo), ...lineas.map((l) => h('p', { class: 'fila-meta' }, l)),
      t.semanas.length ? h('details', {}, h('summary', {}, 'Promedio por semana'),
        ...t.semanas.map((w) => h('p', { class: 'fila-meta' },
          `Semana del ${etiquetaLarga(w.semana)}: ${n(w.promedio)} (${w.n} ${w.n === 1 ? 'medición' : 'mediciones'})` + (w.cambio != null ? ` · ${formatoDelta(w.cambio, unidad)} vs. la semana anterior con datos` : '')))) : null);
  }

  function pintar(filas, delDia) {
    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha de la medición',
      onChange: () => { if (inputFecha.value) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    const peso = h('input', { type: 'text', inputmode: 'decimal', value: delDia?.weight_kg != null ? formatoNumero(delDia.weight_kg) : '', placeholder: 'kg', 'aria-label': 'Peso en kg' });
    const cintura = h('input', { type: 'text', inputmode: 'decimal', value: delDia?.waist_cm != null ? formatoNumero(delDia.waist_cm) : '', placeholder: 'cm', 'aria-label': 'Cintura en cm' });
    const notas = h('input', { type: 'text', maxLength: 200, value: delDia?.notes ?? '', placeholder: 'Notas (opcional)', 'aria-label': 'Notas de la medición' });
    const guardar = h('button', { class: 'btn', type: 'button' }, delDia ? 'Guardar cambios' : 'Guardar medición');
    guardar.addEventListener('click', async () => {
      msg.textContent = ''; ok.textContent = '';
      const v = validarMedida({ peso: peso.value, cintura: cintura.value });
      if (v.errores.length) { msg.textContent = v.errores.join(' '); return; }
      guardar.disabled = true;
      try {
        await M.guardarMedida({ id: delDia?.id ?? null, fecha, peso: v.peso, cintura: v.cintura, notas: notas.value.trim() || null });
        await cargar(fecha, 'Medición guardada.');
      } catch (e) { msg.textContent = traducirError(e); guardar.disabled = false; }
    });

    const periodo = h('select', { value: String(dias), 'aria-label': 'Período', onChange: () => { dias = Number(periodo.value); cargar(); } },
      ...PERIODOS.map((p) => h('option', { value: String(p.dias) }, p.nombre)));

    const form = h('div', { class: 'card form' },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: () => cargar(sumarDias(fecha, -1)) }, '‹'),
        h('strong', {}, etiquetaLarga(fecha)),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: () => cargar(sumarDias(fecha, 1)) }, '›')),
      h('label', {}, 'Fecha', inputFecha),
      h('div', { class: 'dos-col' }, h('label', {}, 'Peso (kg)', peso), h('label', {}, 'Cintura (cm)', cintura)),
      h('label', {}, 'Notas', notas),
      h('div', { class: 'acciones' }, guardar,
        delDia ? h('button', { class: 'btn btn-sec', type: 'button', onClick: async () => {
          if (!confirm('¿Borrar la medición de este día?')) return;
          try { await M.borrarMedida(delDia.id); await cargar(fecha, 'Medición borrada.'); } catch (e) { msg.textContent = traducirError(e); }
        } }, 'Borrar medición') : null));

    const hasta = hoy();
    const recientes = [...filas].sort((a, b) => (a.measured_on < b.measured_on ? 1 : -1)).slice(0, 10).map((f) => h('div', { class: 'fila' },
      h('div', { class: 'fila-nombre' }, etiquetaLarga(f.measured_on)),
      h('div', { class: 'fila-meta' }, [f.weight_kg != null ? `${formatoNumero(f.weight_kg)} kg` : null, f.waist_cm != null ? `cintura ${formatoNumero(f.waist_cm)} cm` : null].filter(Boolean).join(' · ') + (f.notes ? ' · ' + f.notes : '')),
      h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: () => cargar(f.measured_on) }, 'Ver / editar'))));

    raiz.replaceChildren(form, msg, ok,
      h('div', { class: 'card form' }, h('label', {}, 'Período de la tendencia', periodo)),
      tarjetaTendencia('Peso', 'kg', tendenciaMedidas(filas, 'weight_kg', hasta, dias)),
      tarjetaTendencia('Cintura', 'cm', tendenciaMedidas(filas, 'waist_cm', hasta, dias)),
      h('h2', { class: 'grupo-titulo' }, 'Últimas mediciones'),
      ...(recientes.length ? recientes : [h('div', { class: 'card' }, h('p', {}, 'Todavía no hay mediciones en este período.'))]));
  }

  cont.append(raiz);
  return cargar();
}
