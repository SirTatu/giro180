// Dashboard: lo esencial de un vistazo.
import { h } from '../../core/dom.js';
import { hoy, lunesDe, etiquetaLarga, formatoFechaHora } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import { agruparPorSerie, resumenGlobal } from '../../core/estados.js';
import { indicadoresPanel, textoPanel } from '../../core/areas.js';
import { pl } from '../../core/informes.js';
import { MODULOS } from '../registry.js';
import * as D from './datos.js';
import * as GD from '../gym/datos.js';
import * as ND from '../nutri/datos.js';

const pct = (n) => (n == null ? '—' : n + ' %');
const metrica = (valor, etiqueta, clase = '') =>
  h('div', { class: 'metrica ' + clase }, h('b', {}, String(valor)), h('span', {}, etiqueta));

export async function renderPanel(cont, ctx) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div', {}, h('p', { class: 'nota' }, 'Cargando…'));
  cont.append(msg, raiz);

  const f = hoy();
  const lunes = lunesDe(f);
  let defs, logsSemana, entrada, prioridades, compromisos;
  // Gym y Nutri son OPCIONALES: si una lectura falla, esa métrica queda en «—» y el resto del panel sigue.
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  const extrasP = Promise.allSettled([GD.listarSesiones(lunes), ND.comidasDelDia(f), ND.tomasDelDia(f)]);
  try {
    [defs, logsSemana, entrada, prioridades, compromisos] = await Promise.all([
      D.listarHabitos(), D.logsEntre(lunes, f), D.leerEntrada(f), D.listarPrioridades(), D.proximosCompromisos(5)
    ]);
  } catch (e) { raiz.replaceChildren(); msg.textContent = 'No se pudo cargar el panel: ' + e.message; return; }

  const [rSes, rCom, rTom] = await extrasP;
  const series = agruparPorSerie(defs);
  const semana = resumenGlobal(series, logsSemana, lunes, f);
  const dia = resumenGlobal(series, logsSemana.filter((l) => l.log_date === f), f, f).total;
  const activas = prioridades.filter((p) => p.ended_on == null);

  // Cabecera con acceso directo al registro
  const cabecera = h('div', { class: 'fecha-nav' },
    h('div', {}, h('strong', {}, etiquetaLarga(f)), h('span', { class: 'badge' }, 'Hoy')),
    h('button', { class: 'btn btn-sm', type: 'button', onClick: () => ctx.irATab('hoy') }, 'Registrar hoy'));

  // Prioridades vigentes
  const tarjetaPrio = h('div', { class: 'card pad' }, h('strong', {}, 'Prioridades vigentes'),
    ...(activas.length
      ? activas.map((p, i) => h('p', { class: 'prio' }, `${i + 1}. ${p.title}`))
      : [h('p', { class: 'nota' }, 'Sin prioridades vigentes. Definilas en la pestaña «Plan».')]));

  // Indicadores del día
  const extra = [];
  if (entrada?.mood != null) extra.push(`Ánimo ${entrada.mood}/5`);
  if (entrada?.energy != null) extra.push(`Energía ${entrada.energy}/5`);
  const tarjetaDia = h('div', { class: 'card pad' }, h('strong', {}, 'Hoy'),
    dia.programados
      ? h('div', { class: 'metricas' },
          metrica(dia.cumplidos, 'Cumplidos', 'ok'), metrica(dia.incumplidos, 'No cumplidos', 'bad'),
          metrica(dia.noRegistrados, 'Sin registrar', 'warn'))
      : h('p', { class: 'nota' }, series.size ? 'No hay hábitos programados para hoy.' : 'Todavía no hay hábitos. Creá el primero en la pestaña «Hábitos».'),
    dia.excedidos ? h('p', { class: 'nota' }, `${pl(dia.excedidos, 'excedido', 'excedidos')} hoy (pasó el máximo del objetivo): no cuenta como no cumplido.`) : null,
    extra.length ? h('p', { class: 'nota' }, extra.join(' · ')) : null);

  // Gym y Nutri de un vistazo: entrenos de la semana, proteína y agua de hoy
  const gn = textoPanel(indicadoresPanel({ defs, logs: logsSemana, fecha: f, lunes, sesiones: val(rSes), comidas: val(rCom), tomas: val(rTom) }));
  const tarjetaGN = h('div', { class: 'card pad' }, h('strong', {}, 'Gym y Nutri'),
    h('div', { class: 'metricas' }, ...gn.metricas.map((m) => metrica(m.valor, m.etiqueta, m.clase))),
    ...gn.notas.map((n) => h('p', { class: 'nota' }, n)));

  // Semana en curso
  const t = semana.total;
  const filasModulo = ORDEN_MODULOS.filter((m) => semana.porModulo.get(m)?.programados > 0).map((m) => {
    const r = semana.porModulo.get(m);
    const relleno = h('div', { class: 'barra-in' });
    relleno.style.width = (r.pct ?? 0) + '%';
    return h('div', { class: 'mod-fila' }, h('span', { class: 'mod-nombre' }, NOMBRES_MODULO[m]),
      h('div', { class: 'barra' }, relleno),
      h('span', { class: 'fila-meta' }, `${pct(r.pct)} · reg. ${pct(r.cobertura)}`));
  });
  const tarjetaSemana = h('div', { class: 'card pad' }, h('strong', {}, 'Semana en curso'),
    t.programados
      ? [h('div', { class: 'metricas' },
          metrica(pct(t.pct), 'Cumplido'), metrica(pct(t.cobertura), 'Registrado'), metrica(t.noRegistrados, 'Sin registrar', 'warn')),
        ...filasModulo,
        t.excedidos ? h('p', { class: 'nota' }, `${pl(t.excedidos, 'día excedido', 'días excedidos')} esta semana: se muestran aparte y no cuentan como no cumplidos.`) : null,
        h('p', { class: 'nota' }, 'El % de cumplimiento se calcula solo sobre lo registrado: un día sin registrar no cuenta como incumplimiento.')]
      : h('p', { class: 'nota' }, 'Todavía no hay hábitos programados esta semana.'));

  // Próximos compromisos
  const tarjetaComp = h('div', { class: 'card pad' }, h('strong', {}, 'Próximos compromisos'),
    ...(compromisos.length
      ? compromisos.map((c) => h('p', { class: 'prio' }, `${formatoFechaHora(c.starts_at)} · ${c.title}`))
      : [h('p', { class: 'nota' }, 'No hay compromisos próximos.')]));

  // Accesos rápidos
  const accesos = h('div', { class: 'accesos' },
    ...MODULOS.filter((m) => m.id !== 'central').map((m) =>
      h('a', { class: 'acceso', href: '#/' + m.id }, h('span', {}, m.icono), m.nombre)));

  raiz.replaceChildren(cabecera, tarjetaPrio, tarjetaDia, tarjetaGN, tarjetaSemana, tarjetaComp,
    h('h2', { class: 'grupo-titulo' }, 'Accesos rápidos'), accesos);
}
