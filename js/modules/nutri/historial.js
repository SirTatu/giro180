// Nutri → pestaña «Historial»: proteína de los últimos 7 / 30 días y lista de días con comidas.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, rango, etiquetaLarga } from '../../core/fechas.js';
import { logsDeSerie } from '../../core/estados.js';
import { formatoNumero } from '../../core/entrenos.js';
import { buscarHabitoProteina, resumenProteina, totalesPorDia, estadoProteina, aviso } from '../../core/nutri.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = { cumplido: 'Cumplido', incumplido: 'Incumplido', sin_completar: 'Sin completar', no_registrado: 'No registrado' };
const PERIODOS = [{ dias: 7, nombre: 'Últimos 7 días' }, { dias: 30, nombre: 'Últimos 30 días' }];
const g = (n) => `${formatoNumero(n)} g`;

export function renderHistorial(cont, ctx = {}) {
  const raiz = h('div');
  let token = 0;
  let dias = 7;

  async function cargar() {
    const t = ++token;
    try {
      const hasta = hoy(), desde = sumarDias(hasta, -(dias - 1));
      const [comidas, defs, logs] = await Promise.all([D.comidasEntre(desde, hasta), H.listarDefiniciones(), H.logsEntre(desde, hasta)]);
      if (t !== token) return;
      pintar(comidas, defs, logs, desde, hasta);
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, cargar));
    }
  }

  function pintar(comidas, defs, logs, desde, hasta) {
    const selector = h('div', { class: 'acciones' }, PERIODOS.map((p) => h('button', {
      class: 'btn btn-sm' + (p.dias === dias ? '' : ' btn-sec'), type: 'button', onClick: () => { dias = p.dias; cargar(); }
    }, p.nombre)));
    const hab = buscarHabitoProteina(defs, hasta);
    const versiones = hab.versiones;
    const porDia = totalesPorDia(comidas);

    let resumen;
    if (!versiones.length) {
      resumen = h('div', { class: 'card pad' }, h('p', {}, 'Todavía no hay un hábito de proteína (o hay más de uno ambiguo), así que no hay meta para comparar. Los días con comidas se listan igual abajo.'));
    } else {
      const r = resumenProteina(versiones, logs, comidas, desde, hasta);
      const e = r.estados;
      resumen = h('div', { class: 'card pad' }, h('strong', {}, PERIODOS.find((p) => p.dias === dias).nombre),
        h('div', { class: 'metricas' },
          h('div', { class: 'metrica ok' }, h('b', {}, String(e.cumplidos)), h('span', {}, 'cumplidos')),
          h('div', { class: 'metrica bad' }, h('b', {}, String(e.incumplidos)), h('span', {}, 'incumplidos')),
          h('div', { class: 'metrica' }, h('b', {}, String(r.sinCompletar)), h('span', {}, 'sin completar'))),
        h('p', { class: 'fila-meta' }, e.pct == null ? 'Cumplimiento: sin días cerrados o cumplidos todavía.' : `Cumplimiento: ${e.pct} % de los días registrados.`),
        h('p', { class: 'fila-meta' }, r.conDato
          ? `Promedio: ${g(r.promedio)} por día con proteína cargada (${r.conDato} ${r.conDato === 1 ? 'día' : 'días'}) · mejor día: ${g(r.mejor.valor)} (${etiquetaLarga(r.mejor.fecha)}).`
          : 'Todavía no hay proteína cargada en este período.'),
        r.diasConFaltantes ? h('p', { class: 'aviso' }, `${r.diasConFaltantes} ${r.diasConFaltantes === 1 ? 'día tiene' : 'días tienen'} comidas sin proteína cargada.`) : null);
    }

    const propios = versiones.length ? logsDeSerie(versiones, logs) : new Map();
    const filas = rango(desde, hasta).reverse().filter((f) => porDia.has(f)).map((f) => {
      const t = porDia.get(f);
      const e = estadoProteina(propios.get(f) ?? null, t);
      return h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, etiquetaLarga(f)),
          versiones.length ? h('span', { class: `badge ${e.estado === 'sin_completar' ? 'no_registrado' : e.estado}` }, ETIQUETA[e.estado]) : null),
        h('div', { class: 'fila-meta' }, `${t.total == null ? 'Sin proteína cargada' : g(t.total)} · ${t.cantidad} ${t.cantidad === 1 ? 'comida' : 'comidas'}${aviso(t) ? ' · ' + aviso(t) : ''}`),
        h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: () => ctx.irAHoy?.(f) }, 'Ver / editar')));
    });
    raiz.replaceChildren(selector, resumen, h('h2', { class: 'grupo-titulo' }, 'Días con comidas'),
      ...(filas.length ? filas : [h('p', { class: 'fila-meta' }, 'No hay comidas cargadas en este período.')]));
  }

  cont.append(raiz);
  return cargar();
}
