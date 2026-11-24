// Gym → pestaña "Pasos": registrar los pasos del día (hábito de cantidad) y ver cómo vienen. Los estados
// (cumplido / incumplido / no registrado / sin actividad) los decide estados.js; acá solo se muestran.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, rango, etiquetaLarga } from '../../core/fechas.js';
import { agruparPorSerie, estadoDia, evaluar, logsDeSerie, ESTADO } from '../../core/estados.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import { buscarHabitoPasos, resumenPasos, validarPasos } from '../../core/cuerpo.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

const ETIQUETA = {
  [ESTADO.CUMPLIDO]: 'Cumplido', [ESTADO.INCUMPLIDO]: 'Incumplido',
  [ESTADO.NO_REGISTRADO]: 'No registrado', [ESTADO.SIN_ACTIVIDAD]: 'Sin actividad programada'
};
const miles = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR'));

export function renderPasos(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = hoy();

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const desdeLogs = sumarDias(hoy(), -59) < f ? sumarDias(hoy(), -59) : f;
      const hastaLogs = hoy() > f ? hoy() : f;
      const [defs, logs] = await Promise.all([D.listarHabitosDefiniciones(), D.logsEntre(desdeLogs, hastaLogs)]);
      if (t !== token) return;
      fecha = f; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar(defs, logs);
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  function pintar(defs, logs) {
    const hab = buscarHabitoPasos(defs, fecha);
    if (hab.motivo === 'sin_habito' || hab.motivo === 'ambiguo') {
      raiz.replaceChildren(h('div', { class: 'card pad' }, h('p', {}, hab.motivo === 'sin_habito'
        ? 'Todavía no hay un hábito de pasos. Creá uno en Central → Hábitos: módulo Gym, tipo cantidad, con tu meta diaria y unidad «pasos». Después volvé acá a registrar.'
        : 'Hay más de un hábito de cantidad en Gym y no sé cuál es el de pasos. Ponele «Pasos» en el nombre al que corresponda (Central → Hábitos).')));
      return;
    }
    const versiones = hab.versiones;
    const porFecha = logsDeSerie(versiones, logs);
    const log = porFecha.get(fecha) ?? null;
    const version = hab.version;                          // la meta VIGENTE ese día
    const dia = estadoDia(versiones, porFecha, fecha);

    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha',
      onChange: () => { if (inputFecha.value) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    const valor = h('input', { type: 'text', inputmode: 'numeric', value: log?.value ?? '', placeholder: 'Pasos', 'aria-label': 'Pasos del día', disabled: !version });
    const guardar = h('button', { class: 'btn', type: 'button', disabled: !version }, log ? 'Guardar cambios' : 'Guardar pasos');
    guardar.addEventListener('click', async () => {
      msg.textContent = ''; ok.textContent = '';
      const v = validarPasos(valor.value);
      if (v.error) { msg.textContent = v.error; return; }
      guardar.disabled = true;
      try {
        const status = evaluar(version, v.valor);
        await D.guardarLogPasos({ habit_id: version.id, log_date: fecha, status, value: v.valor });
        await cargar(fecha, `Guardado: ${miles(v.valor)} pasos (${status === 'done' ? 'meta cumplida' : status === 'exceeded' ? 'por encima del máximo' : 'por debajo de la meta'}).`);
      } catch (e) { msg.textContent = traducirError(e); guardar.disabled = false; }
    });

    const meta = version ? `Meta de ese día: ${miles(version.target_value)} ${version.unit ?? ''} o más.`.replace('  ', ' ') : 'El hábito de pasos no estaba vigente ese día.';
    const tarjetaDia = h('div', { class: 'card form' },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: () => cargar(sumarDias(fecha, -1)) }, '‹'),
        h('strong', {}, etiquetaLarga(fecha)),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: () => cargar(sumarDias(fecha, 1)) }, '›')),
      h('label', {}, 'Fecha', inputFecha),
      h('p', { class: 'fila-meta' }, meta),
      h('p', {}, h('span', { class: 'badge' }, dia.extra ? 'Extra (día no programado)' : ETIQUETA[dia.estado])),
      h('label', {}, 'Pasos', valor),
      h('div', { class: 'acciones' }, guardar,
        log ? h('button', { class: 'btn btn-sec', type: 'button', onClick: async () => {
          if (!confirm('¿Quitar el registro de pasos de este día? Vuelve a «no registrado».')) return;
          try { await D.borrarLogPasos(log.id); await cargar(fecha, 'Registro quitado.'); } catch (e) { msg.textContent = traducirError(e); }
        } }, 'Quitar registro') : null));

    const resumen = (titulo, n) => {
      const hasta = hoy(), desde = sumarDias(hasta, -(n - 1));
      const r = resumenPasos(versiones, logs, desde, hasta);
      const e = r.estados;
      return h('div', { class: 'card pad' }, h('strong', {}, titulo),
        h('div', { class: 'metricas' },
          h('div', { class: 'metrica ok' }, h('b', {}, String(e.cumplidos)), h('span', {}, 'cumplidos')),
          h('div', { class: 'metrica bad' }, h('b', {}, String(e.incumplidos)), h('span', {}, 'incumplidos')),
          h('div', { class: 'metrica' }, h('b', {}, String(e.noRegistrados)), h('span', {}, 'sin registrar'))),
        h('p', { class: 'fila-meta' }, e.pct == null ? 'Cumplimiento: sin días registrados.' : `Cumplimiento: ${e.pct} % de los días registrados.`),
        h('p', { class: 'fila-meta' }, e.cobertura == null ? 'Cobertura: sin días programados.' : `Cobertura: registraste el ${e.cobertura} % de los días programados.`),
        h('p', { class: 'fila-meta' }, r.conDato
          ? `Promedio: ${miles(r.promedio)} pasos por día con dato (${r.conDato} días) · mejor día: ${miles(r.mejor.valor)} (${etiquetaLarga(r.mejor.fecha)}).`
          : 'Todavía no hay pasos cargados en este período.'));
    };

    const ultimos = rango(sumarDias(hoy(), -13), hoy()).reverse().map((f) => {
      const d = estadoDia(versiones, porFecha, f);
      const l = porFecha.get(f);
      return h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, etiquetaLarga(f)),
          h('span', { class: 'badge' }, d.extra ? 'Extra' : ETIQUETA[d.estado])),
        h('div', { class: 'fila-meta' }, l?.value != null ? `${miles(l.value)} pasos` : '—'),
        h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: () => cargar(f) }, 'Ver / editar')));
    });

    raiz.replaceChildren(tarjetaDia, msg, ok, resumen('Últimos 7 días', 7), resumen('Últimos 30 días', 30),
      h('h2', { class: 'grupo-titulo' }, 'Últimos 14 días'), ...ultimos);
  }

  cont.append(raiz);
  return cargar();
}
