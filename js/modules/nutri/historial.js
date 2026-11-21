// Nutri → pestaña «Historial»: proteína y agua de los últimos 7 / 30 días y lista de días con datos.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, rango, etiquetaLarga } from '../../core/fechas.js';
import { logsDeSerie } from '../../core/estados.js';
import { formatoNumero } from '../../core/entrenos.js';
import { buscarHabitoProteina, resumenProteina, totalesPorDia, estadoProteina, aviso } from '../../core/nutri.js';
import {
  buscarHabitoAgua, resumenAgua, totalesPorDia as totalesAguaPorDia, estadoAgua, formatoMl
} from '../../core/agua.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = { cumplido: 'Cumplido', incumplido: 'Incumplido', sin_completar: 'Sin completar', no_registrado: 'No registrado' };
const PERIODOS = [{ dias: 7, nombre: 'Últimos 7 días' }, { dias: 30, nombre: 'Últimos 30 días' }];
const g = (n) => `${formatoNumero(n)} g`;
const clase = (e) => (e === 'sin_completar' ? 'no_registrado' : e);

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

  function tarjetaResumen(titulo, estados, sinCompletar, lineas) {
    return h('div', { class: 'card pad' }, h('strong', {}, titulo),
      h('div', { class: 'metricas' },
        h('div', { class: 'metrica ok' }, h('b', {}, String(estados.cumplidos)), h('span', {}, 'cumplidos')),
        h('div', { class: 'metrica bad' }, h('b', {}, String(estados.incumplidos)), h('span', {}, 'incumplidos')),
        h('div', { class: 'metrica' }, h('b', {}, String(sinCompletar)), h('span', {}, 'sin completar'))),
      h('p', { class: 'fila-meta' }, estados.pct == null ? 'Cumplimiento: sin días cerrados o cumplidos todavía.' : `Cumplimiento: ${estados.pct} % de los días registrados.`),
      ...lineas);
  }

  function pintar(comidas, tomas, defs, logs, desde, hasta) {
    const nombrePeriodo = PERIODOS.find((p) => p.dias === dias).nombre;
    const selector = h('div', { class: 'acciones' }, PERIODOS.map((p) => h('button', {
      class: 'btn btn-sm' + (p.dias === dias ? '' : ' btn-sec'), type: 'button', onClick: () => { dias = p.dias; cargar(); }
    }, p.nombre)));

    const habP = buscarHabitoProteina(defs, hasta), vP = habP.versiones;
    const habA = buscarHabitoAgua(defs, hasta), vA = habA.versiones;
    const porDiaP = totalesPorDia(comidas), porDiaA = totalesAguaPorDia(tomas);

    let tarjetaP;
    if (!vP.length) tarjetaP = h('div', { class: 'card pad' }, h('strong', {}, 'Proteína'), h('p', {}, 'Todavía no hay un hábito de proteína (o hay más de uno ambiguo), así que no hay meta para comparar.'));
    else {
      const r = resumenProteina(vP, logs, comidas, desde, hasta);
      tarjetaP = tarjetaResumen(`Proteína · ${nombrePeriodo}`, r.estados, r.sinCompletar, [
        h('p', { class: 'fila-meta' }, r.conDato
          ? `Promedio: ${g(r.promedio)} por día con proteína cargada (${r.conDato} ${r.conDato === 1 ? 'día' : 'días'}) · mejor día: ${g(r.mejor.valor)} (${etiquetaLarga(r.mejor.fecha)}).`
          : 'Todavía no hay proteína cargada en este período.'),
        r.diasConFaltantes ? h('p', { class: 'aviso' }, `${r.diasConFaltantes} ${r.diasConFaltantes === 1 ? 'día tiene' : 'días tienen'} comidas sin proteína cargada.`) : null]);
    }
    let tarjetaA;
    if (!vA.length) tarjetaA = h('div', { class: 'card pad' }, h('strong', {}, 'Agua'), h('p', {}, 'Todavía no hay un hábito de agua (o hay más de uno ambiguo), así que no hay meta para comparar.'));
    else {
      const r = resumenAgua(vA, logs, tomas, desde, hasta);
      tarjetaA = tarjetaResumen(`Agua · ${nombrePeriodo}`, r.estados, r.sinCompletar, [
        h('p', { class: 'fila-meta' }, r.conDato
          ? `Promedio: ${formatoMl(r.promedioMl)} por día con tomas (${r.conDato} ${r.conDato === 1 ? 'día' : 'días'}) · mejor día: ${formatoMl(r.mejor.ml)} (${etiquetaLarga(r.mejor.fecha)}).`
          : 'Todavía no hay agua cargada en este período.')]);
    }

    const propiosP = vP.length ? logsDeSerie(vP, logs) : new Map();
    const propiosA = vA.length ? logsDeSerie(vA, logs) : new Map();
    const filas = rango(desde, hasta).reverse().filter((f) => porDiaP.has(f) || porDiaA.has(f)).map((f) => {
      const tp = porDiaP.get(f), ta = porDiaA.get(f);
      const lineas = [];
      if (tp) {
        const e = estadoProteina(propiosP.get(f) ?? null, tp);
        lineas.push(h('div', { class: 'fila-meta' }, `Proteína: ${tp.total == null ? 'sin cargar' : g(tp.total)} · ${tp.cantidad} ${tp.cantidad === 1 ? 'comida' : 'comidas'}${aviso(tp) ? ' · ' + aviso(tp) : ''}`,
          vP.length ? h('span', { class: `badge ${clase(e.estado)}` }, ETIQUETA[e.estado]) : null));
      }
      if (ta) {
        const e = estadoAgua(propiosA.get(f) ?? null, ta);
        lineas.push(h('div', { class: 'fila-meta' }, `Agua: ${formatoMl(ta.ml)} · ${ta.cantidad} ${ta.cantidad === 1 ? 'toma' : 'tomas'}`,
          vA.length ? h('span', { class: `badge ${clase(e.estado)}` }, ETIQUETA[e.estado]) : null));
      }
      return h('div', { class: 'fila' }, h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, etiquetaLarga(f))), ...lineas,
        h('div', { class: 'acciones' },
          tp ? h('button', { class: 'link', type: 'button', onClick: () => ctx.irAHoy?.(f) }, 'Ver comidas') : null,
          ta ? h('button', { class: 'link', type: 'button', onClick: () => ctx.irAAgua?.(f) }, 'Ver agua') : null));
    });
    raiz.replaceChildren(selector, tarjetaP, tarjetaA, h('h2', { class: 'grupo-titulo' }, 'Días con datos'),
      ...(filas.length ? filas : [h('p', { class: 'fila-meta' }, 'No hay comidas ni agua cargadas en este período.')]));
  }

  cont.append(raiz);
  return cargar();
}
