// Nutri → pestaña «Historial»: las 4 macros y el agua de los últimos 7 / 30 días, y la lista de días con datos.
// Cada macro con objetivo muestra cuántos días cumpliste, no cumpliste, te excediste (aparte: no cuenta como no cumplido)
// y cuántos quedaron sin cerrar. Promedios SOLO sobre días con dato. Cálculos en js/core/macros.js.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, rango, etiquetaLarga } from '../../core/fechas.js';
import { ESTADO, estadoDia, logsDeSerie, textoObjetivo } from '../../core/estados.js';
import { formatoNumero } from '../../core/entrenos.js';
import { MACROS, totalesMacrosPorDia } from '../../core/alimentos.js';
import { buscarHabitoMacro, resumenMacroPeriodo } from '../../core/macros.js';
import { buscarHabitoAgua, resumenAgua, totalesPorDia as totalesAguaPorDia, estadoAgua, formatoMl } from '../../core/agua.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = { cumplido: 'Cumplido', incumplido: 'Incumplido', excedido: 'Excedido', sin_completar: 'Sin completar', no_registrado: 'No registrado', sin_cerrar: 'Sin cerrar' };
const PERIODOS = [{ dias: 7, nombre: 'Últimos 7 días' }, { dias: 30, nombre: 'Últimos 30 días' }];
const clase = (e) => (e === 'sin_completar' || e === 'sin_cerrar' ? 'no_registrado' : e);
const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;

export function renderHistorial(cont, ctx = {}) {
  const raiz = h('div');
  let token = 0;
  let dias = 7;

  async function cargar() {
    const t = ++token;
    try {
      const hasta = hoy(), desde = sumarDias(hasta, -(dias - 1));
      const [comidas, tomas, defs, logs] = await Promise.all([D.comidasEntre(desde, hasta), D.tomasEntre(desde, hasta), H.listarDefiniciones(), H.logsEntre(desde, hasta)]);
      if (t !== token) return;
      pintar(comidas, tomas, defs, logs, desde, hasta);
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, cargar));
    }
  }

  // Tarjeta de una macro: objetivo, promedio, días cumplidos / no cumplidos / excedidos / sin cerrar.
  function tarjetaMacro(m, hab, r, nombrePeriodo) {
    const u = m.unidad;
    const e = r.estados;
    const lineas = [h('p', { class: 'fila-meta' }, hab.version ? `Objetivo actual: ${textoObjetivo(hab.version)}` : 'Sin objetivo (configuralo en la pestaña Objetivos).')];
    lineas.push(h('p', { class: 'fila-meta' }, r.conDato
      ? `Promedio: ${formatoNumero(r.promedio)} ${u} por día con dato (${pl(r.conDato, 'día', 'días')}) · día más alto: ${formatoNumero(r.mayor.valor)} ${u} (${etiquetaLarga(r.mayor.fecha)}).`
      : 'Todavía no hay datos cargados en este período.'));
    if (e) {
      lineas.push(h('div', { class: 'metricas' },
        h('div', { class: 'metrica ok' }, h('b', {}, String(e.cumplidos)), h('span', {}, 'cumplidos')),
        h('div', { class: 'metrica bad' }, h('b', {}, String(e.incumplidos)), h('span', {}, 'no cumplidos')),
        h('div', { class: 'metrica' }, h('b', {}, String(e.excedidos)), h('span', {}, 'excedidos'))));
      lineas.push(h('p', { class: 'fila-meta' }, `${pl(r.pendientes, 'día sin cerrar', 'días sin cerrar')}. ${e.pct == null ? 'Cumplimiento: todavía no hay días cumplidos ni no cumplidos.' : `Cumplimiento: ${e.pct} % de los días evaluados.`}`));
      if (e.excedidos) lineas.push(h('p', { class: 'fila-meta' }, 'Los días excedidos se muestran aparte: no cuentan como no cumplidos.'));
    }
    if (r.diasParciales) lineas.push(h('p', { class: 'aviso' }, `${pl(r.diasParciales, 'día tiene', 'días tienen')} comidas sin dato de ${m.nombre.toLowerCase()}: el promedio solo suma lo cargado.`));
    return h('div', { class: 'card pad' }, h('strong', {}, `${m.nombre} · ${nombrePeriodo}`), ...lineas);
  }

  function pintar(comidas, tomas, defs, logs, desde, hasta) {
    const nombrePeriodo = PERIODOS.find((p) => p.dias === dias).nombre;
    const selector = h('div', { class: 'acciones' }, PERIODOS.map((p) => h('button', {
      class: 'btn btn-sm' + (p.dias === dias ? '' : ' btn-sec'), type: 'button', onClick: () => { dias = p.dias; cargar(); }
    }, p.nombre)));

    const porDiaM = totalesMacrosPorDia(comidas);
    const porDiaA = totalesAguaPorDia(tomas);
    const macros = MACROS.map((m) => {
      const hab = buscarHabitoMacro(defs, hasta, m.id);
      const r = resumenMacroPeriodo({ versiones: hab.versiones, logs, porDia: porDiaM, macroId: m.id, desde, hasta });
      return { m, hab, r, propios: hab.versiones.length ? logsDeSerie(hab.versiones, logs) : new Map() };
    });
    const tarjetas = macros.filter((x) => x.hab.versiones.length || x.r.conDato).map((x) => tarjetaMacro(x.m, x.hab, x.r, nombrePeriodo));
    const vacio = h('div', { class: 'card pad' }, h('strong', {}, 'Macros'), h('p', {}, 'Todavía no hay comidas con macros ni objetivos en este período. Definí tus objetivos en la pestaña Objetivos.'));

    const habA = buscarHabitoAgua(defs, hasta), vA = habA.versiones;
    let tarjetaA;
    if (!vA.length) tarjetaA = h('div', { class: 'card pad' }, h('strong', {}, 'Agua'), h('p', {}, 'Todavía no hay un hábito de agua (o hay más de uno ambiguo), así que no hay meta para comparar.'));
    else {
      const r = resumenAgua(vA, logs, tomas, desde, hasta);
      const e = r.estados;
      tarjetaA = h('div', { class: 'card pad' }, h('strong', {}, `Agua · ${nombrePeriodo}`),
        h('div', { class: 'metricas' },
          h('div', { class: 'metrica ok' }, h('b', {}, String(e.cumplidos)), h('span', {}, 'cumplidos')),
          h('div', { class: 'metrica bad' }, h('b', {}, String(e.incumplidos)), h('span', {}, 'incumplidos')),
          h('div', { class: 'metrica' }, h('b', {}, String(r.sinCompletar)), h('span', {}, 'sin completar'))),
        h('p', { class: 'fila-meta' }, e.pct == null ? 'Cumplimiento: sin días cerrados o cumplidos todavía.' : `Cumplimiento: ${e.pct} % de los días registrados.`),
        h('p', { class: 'fila-meta' }, r.conDato
          ? `Promedio: ${formatoMl(r.promedioMl)} por día con tomas (${pl(r.conDato, 'día', 'días')}) · mejor día: ${formatoMl(r.mejor.ml)} (${etiquetaLarga(r.mejor.fecha)}).`
          : 'Todavía no hay agua cargada en este período.'));
    }
    const propiosA = vA.length ? logsDeSerie(vA, logs) : new Map();

    // Día por día: totales de macros, el estado de cada macro con objetivo y el agua.
    const filas = rango(desde, hasta).reverse().filter((f) => porDiaM.has(f) || porDiaA.has(f)).map((f) => {
      const tm = porDiaM.get(f), ta = porDiaA.get(f);
      const lineas = [];
      if (tm) {
        const abrev = { kcal: (v) => `${formatoNumero(v)} kcal`, carbs: (v) => `C ${formatoNumero(v)} g`, protein: (v) => `P ${formatoNumero(v)} g`, fat: (v) => `G ${formatoNumero(v)} g` };
        const partes = MACROS.filter((m) => tm[m.id].total != null).map((m) => abrev[m.id](tm[m.id].total));
        lineas.push(h('div', { class: 'fila-meta' }, `Nutri: ${pl(tm.cantidad, 'comida', 'comidas')} · ${partes.length ? partes.join(' · ') : 'sin macros cargadas'}`));
        const estados = macros.filter((x) => x.hab.versiones.length && tm[x.m.id].total != null).map((x) => {
          const d = estadoDia(x.hab.versiones, x.propios, f);
          if (d.estado === ESTADO.SIN_ACTIVIDAD) return null;
          const e = d.estado === ESTADO.NO_REGISTRADO ? 'sin_cerrar' : d.estado;
          return h('span', { class: `badge ${clase(e)}` }, `${x.m.nombre}: ${ETIQUETA[e]}`);
        }).filter(Boolean);
        if (estados.length) lineas.push(h('div', { class: 'acciones' }, ...estados));
      }
      if (ta) {
        const e = estadoAgua(propiosA.get(f) ?? null, ta);
        lineas.push(h('div', { class: 'fila-meta' }, `Agua: ${formatoMl(ta.ml)} · ${pl(ta.cantidad, 'toma', 'tomas')}`,
          vA.length ? h('span', { class: `badge ${clase(e.estado)}` }, ETIQUETA[e.estado]) : null));
      }
      return h('div', { class: 'fila' }, h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, etiquetaLarga(f))), ...lineas,
        h('div', { class: 'acciones' },
          tm ? h('button', { class: 'link', type: 'button', onClick: () => ctx.irAHoy?.(f) }, 'Ver comidas') : null,
          ta ? h('button', { class: 'link', type: 'button', onClick: () => ctx.irAAgua?.(f) }, 'Ver agua') : null));
    });
    raiz.replaceChildren(selector, ...(tarjetas.length ? tarjetas : [vacio]), tarjetaA, h('h2', { class: 'grupo-titulo' }, 'Días con datos'),
      ...(filas.length ? filas : [h('p', { class: 'fila-meta' }, 'No hay comidas ni agua cargadas en este período.')]));
  }

  cont.append(raiz);
  return cargar();
}
