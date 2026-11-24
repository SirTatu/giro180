// Pestaña "Semana": indicadores de la semana, comparación con la anterior y revisión semanal.
// Los números salen de js/core/informes.js (que usa estados.js: un día sin registrar nunca es incumplimiento).
import { h } from '../../core/dom.js';
import { hoy, lunesDe, sumarDias, formatoFechaHora } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import { agruparPorSerie } from '../../core/estados.js';
import {
  calcularSemana, aIndicadores, detalleHabitos, prioridadesAl, fmtPct, fmtDelta, fmtEscala, pl
} from '../../core/informes.js';
import * as D from './datos.js';

const ddmm = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
const metrica = (valor, etiqueta, clase = '') =>
  h('div', { class: 'metrica ' + clase }, h('b', {}, String(valor)), h('span', {}, etiqueta));

// Etiqueta de cambio: verde si sube, rojo si baja, neutra si es igual o no hay con qué comparar.
const etiquetaDelta = (delta) =>
  h('span', { class: 'badge ' + (delta > 0 ? 'cumplido' : delta < 0 ? 'incumplido' : '') }, fmtDelta(delta));

export function renderSemana(cont, ctx) {
  const userId = ctx.session.user.id;
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  cont.append(msg, raiz);

  let lunes = lunesDe(hoy());
  let token = 0;          // descarta respuestas viejas si cambiás de semana rápido
  let sucio = false;      // hay texto de revisión sin guardar

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  function cambiarSemana(n) {
    if (sucio && !confirm('Tenés cambios sin guardar en la revisión. ¿Descartarlos?')) return;
    sucio = false;
    lunes = sumarDias(lunes, 7 * n);
    cargar();
  }

  async function cargar() {
    const mio = ++token;
    msg.textContent = '';
    raiz.replaceChildren(h('p', { class: 'nota' }, 'Cargando…'));
    const desde = sumarDias(lunes, -7);
    const hasta = sumarDias(lunes, 6);
    try {
      const [defs, logs, entradas, prioridades, revision] = await Promise.all([
        D.listarHabitos(), D.logsEntre(desde, hasta), D.entradasEntre(desde, hasta),
        D.listarPrioridades(), D.leerRevision(lunes)
      ]);
      if (mio !== token) return;
      pintar({ series: agruparPorSerie(defs), logs, entradas, prioridades, revision });
    } catch (e) {
      if (mio !== token) return;
      mostrarError(new Error('No se pudo cargar la semana: ' + (e?.message ?? e)));
      raiz.replaceChildren(h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: cargar }, 'Reintentar'));
    }
  }

  function pintar({ series, logs, entradas, prioridades, revision }) {
    const sem = calcularSemana({ series, logs, entradas, lunes, hoy: hoy() });
    const p = sem.periodo;
    const semanaLunes = lunes;

    // Navegación entre semanas (no se puede ir a una semana futura)
    const nav = h('div', { class: 'fecha-nav' },
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Semana anterior', onClick: () => cambiarSemana(-1) }, '‹'),
      h('div', {}, h('strong', {}, `${ddmm(p.desde)} al ${ddmm(p.domingo)}`),
        h('span', { class: 'badge' }, p.enCurso ? 'En curso' : 'Cerrada')),
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Semana siguiente',
        disabled: sumarDias(lunes, 7) > hoy(), onClick: () => cambiarSemana(1) }, '›'));

    // Cumplimiento
    const t = sem.actual.total;
    const c = sem.comparacion.total;
    const tarjetaTotal = h('div', { class: 'card pad' }, h('strong', {}, 'Cumplimiento'),
      t.programados
        ? [h('div', { class: 'metricas' },
            metrica(fmtPct(t.pct).replace('sin datos', '—'), 'Cumplido'),
            metrica(fmtPct(t.cobertura).replace('sin datos', '—'), 'Registrado'),
            metrica(t.noRegistrados, 'Sin registrar', 'warn')),
          h('p', { class: 'nota' }, 'Frente a la semana anterior' + (p.enCurso ? ` (mismas ${p.dias} jornadas, ${ddmm(sem.periodoAnterior.desde)} al ${ddmm(sem.periodoAnterior.hasta)})` : '') + ':  ',
            etiquetaDelta(c.pct.delta)),
          sem.anterior.total.cumplidos + sem.anterior.total.incumplidos === 0
            ? h('p', { class: 'nota' }, 'La semana anterior no tiene registros: no hay base de comparación (no es un 0 %).') : null,
          t.excedidos ? h('p', { class: 'nota' }, `${pl(t.excedidos, 'día excedido', 'días excedidos')} (pasó el máximo del objetivo): se muestran aparte y no cuentan como no cumplidos.`) : null,
          h('p', { class: 'nota' }, 'El % se calcula solo sobre lo registrado: un día sin registrar no cuenta como incumplimiento.')]
        : h('p', { class: 'nota' }, series.size ? 'No hay hábitos programados en este período.' : 'Todavía no hay hábitos. Creá el primero en la pestaña «Hábitos».'));

    // Ánimo y energía
    const an = sem.animo;
    const tarjetaAnimo = h('div', { class: 'card pad' }, h('strong', {}, 'Ánimo y energía'),
      h('p', { class: 'nota' }, `Ánimo: ${fmtEscala(an.actual.animo)} · semana anterior: ${fmtEscala(an.anterior.animo)}`),
      h('p', { class: 'nota' }, `Energía: ${fmtEscala(an.actual.energia)} · semana anterior: ${fmtEscala(an.anterior.energia)}`),
      h('p', { class: 'nota' }, `Con registro: ${pl(an.actual.dias, 'día', 'días')} (semana anterior: ${an.anterior.dias}).`));

    // Por área
    const filas = ORDEN_MODULOS.filter((m) => sem.actual.porModulo.get(m)?.programados > 0).map((m) => {
      const r = sem.actual.porModulo.get(m);
      const relleno = h('div', { class: 'barra-in' });
      relleno.style.width = (r.pct ?? 0) + '%';
      return h('div', { class: 'mod-fila' }, h('span', { class: 'mod-nombre' }, NOMBRES_MODULO[m]),
        h('div', { class: 'barra' }, relleno),
        h('span', { class: 'fila-meta' }, `${fmtPct(r.pct)} · reg. ${fmtPct(r.cobertura)} `, etiquetaDelta(sem.comparacion.porModulo.get(m)?.pct.delta ?? null)));
    });
    const tarjetaAreas = filas.length ? h('div', { class: 'card pad' }, h('strong', {}, 'Por área'), ...filas) : null;

    // Detalle por hábito
    const detalle = detalleHabitos(series, logs, p.desde, p.hasta).filter((d) => d.programados > 0);
    const tarjetaHabitos = detalle.length
      ? h('details', { class: 'card pad' }, h('summary', {}, `Detalle por hábito (${detalle.length})`),
          ...detalle.map((d) => h('p', { class: 'fila-meta' },
            `${NOMBRES_MODULO[d.module] ?? d.module} · ${d.nombre}: ${pl(d.cumplidos, 'cumplido', 'cumplidos')}, ${pl(d.incumplidos, 'no cumplido', 'no cumplidos')}${d.excedidos ? `, ${pl(d.excedidos, 'excedido', 'excedidos')}` : ''}, ${d.noRegistrados} sin registrar`)))
      : null;

    // Prioridades que regían al cierre de esa semana
    const prios = prioridadesAl(prioridades, p.hasta);
    const tarjetaPrio = h('div', { class: 'card pad' }, h('strong', {}, 'Prioridades de la semana'),
      ...(prios.length ? prios.map((x, i) => h('p', { class: 'prio' }, `${i + 1}. ${x.title}`))
        : [h('p', { class: 'nota' }, 'No había prioridades vigentes.')]));

    // Revisión semanal
    const resumen = h('textarea', { rows: 4, maxLength: 2000, placeholder: '¿Cómo estuvo la semana? ¿Qué salió bien y qué no?', value: revision?.summary ?? '' });
    const decisiones = h('textarea', { rows: 3, maxLength: 2000, placeholder: '¿Qué decidís cambiar o sostener para la próxima semana?', value: revision?.decisions ?? '' });
    const estado = h('span', { class: 'ok-msg' }, revision ? 'Guardada ' + formatoFechaHora(revision.updated_at) : '');
    const marcarSucio = () => { sucio = true; estado.textContent = 'Cambios sin guardar'; };
    resumen.addEventListener('input', marcarSucio);
    decisiones.addEventListener('input', marcarSucio);

    const guardar = h('button', { class: 'btn btn-sm', type: 'button' }, 'Guardar revisión');
    guardar.addEventListener('click', async () => {
      msg.textContent = '';
      guardar.disabled = true;
      try {
        const g = await D.guardarRevision({
          user_id: userId, week_start: semanaLunes,
          summary: resumen.value.trim() || null,
          decisions: decisiones.value.trim() || null,
          indicators: aIndicadores(sem)
        });
        sucio = false;
        estado.textContent = 'Guardada ' + formatoFechaHora(g.updated_at) + ' ✓';
      } catch (e) { mostrarError(e); }
      guardar.disabled = false;
    });

    const tarjetaRevision = h('div', { class: 'card form' },
      h('strong', {}, 'Revisión de la semana'),
      h('label', {}, 'Resumen', resumen),
      h('label', {}, 'Decisiones', decisiones),
      h('div', { class: 'acciones' }, guardar, estado),
      h('p', { class: 'nota' }, p.enCurso
        ? 'Al guardar se conserva una foto de los indicadores con lo registrado hasta hoy. Podés volver a guardar al cerrar la semana.'
        : 'Al guardar se conserva una foto de los indicadores de esta semana.'));

    raiz.replaceChildren(nav, tarjetaTotal, tarjetaAnimo, tarjetaAreas, tarjetaHabitos, tarjetaPrio, tarjetaRevision);
  }

  cargar();
}
