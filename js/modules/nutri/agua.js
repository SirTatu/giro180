// Nutri → pestaña «Agua»: sumá tomas con un toque (botones rápidos o tus botellas) y mirá el total del día contra la meta.
// La meta es el hábito de agua (Central → Hábitos). Las decisiones viven en js/core/agua.js; los estados en estados.js.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import {
  BOTONES_RAPIDOS, formatoMl, metaEnMl, totalAgua, estadoAgua, validarCantidad, buscarHabitoAgua,
  decidirSincronizacionAgua, decidirCierreAgua, NOTA_AUTO_AGUA
} from '../../core/agua.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = { cumplido: 'Cumplido', incumplido: 'Incumplido', sin_completar: 'Sin completar', no_registrado: 'No registrado' };

export function renderAgua(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = ctx.fechaInicial || hoy();
  let datos = null;                                       // { tomas, botellas, hab, log }
  let ocupado = false;                                    // evita tomas duplicadas por doble toque

  const leer = async (f) => {
    const [tomas, botellas, defs, logs] = await Promise.all([D.tomasDelDia(f), D.listarBotellas(), H.listarDefiniciones(), H.logsEntre(f, f)]);
    const hab = buscarHabitoAgua(defs, f);
    const log = hab.versiones.length ? logs.find((l) => hab.versiones.some((v) => v.id === l.habit_id)) ?? null : null;
    return { tomas, botellas, hab, log };
  };

  async function sincronizar(f) {
    const d = await leer(f);
    const dec = decidirSincronizacionAgua({ version: d.hab.version, totales: totalAgua(d.tomas), log: d.log });
    if (dec.accion === 'guardar') await H.guardarLog({ habit_id: d.hab.version.id, log_date: f, status: dec.status, value: dec.value, note: dec.note });
    else if (dec.accion === 'quitar') await H.borrarLog(d.log.id);
    return dec.accion;
  }

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const d = await leer(f);
      if (t !== token) return;
      fecha = f; datos = d; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  async function cambiar(operacion, textoOk) {
    if (ocupado) return false;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try {
      await operacion();
      const accion = await sincronizar(fecha);
      const extra = accion === 'guardar' ? ' Llegaste a la meta: el día quedó cumplido.' : accion === 'quitar' ? ' Dejaste de llegar a la meta: el día vuelve a «sin completar».' : '';
      await cargar(fecha, textoOk + extra);
      return true;
    } catch (e) { msg.textContent = traducirError(e); return false; } finally { ocupado = false; }
  }

  const sumar = (ml, nombre, botellaId = null) =>
    cambiar(() => D.crearToma({ drunk_on: fecha, ml, container_id: botellaId, container_name: nombre }), `Sumaste ${formatoMl(ml)}${nombre ? ` (${nombre})` : ''}.`);

  function tarjetaTotal() {
    const { tomas, hab, log } = datos;
    const t = totalAgua(tomas);
    const total = t.cantidad ? formatoMl(t.ml) : 'sin tomas';
    if (hab.motivo === 'sin_habito' || hab.motivo === 'ambiguo') {
      return h('div', { class: 'card pad' }, h('strong', {}, 'Agua del día'), h('p', {}, `Total: ${total}.`), h('p', { class: 'fila-meta' }, hab.motivo === 'sin_habito'
        ? 'Podés cargar agua igual. Para medir la meta, creá un hábito en Central → Hábitos: módulo Nutri, tipo cantidad, nombre con «Agua», unidad «L» y tu meta diaria en litros.'
        : 'Hay más de un hábito de cantidad en Nutri y no sé cuál es el de agua. Ponele «Agua» en el nombre al que corresponda (Central → Hábitos).'));
    }
    if (!hab.version) return h('div', { class: 'card pad' }, h('strong', {}, 'Agua del día'), h('p', {}, `Total: ${total}.`), h('p', { class: 'fila-meta' }, 'El hábito de agua no estaba vigente ese día.'));
    const meta = metaEnMl(hab.version);
    if (meta == null) {
      return h('div', { class: 'card pad' }, h('strong', {}, 'Agua del día'), h('p', {}, `Total: ${total}.`),
        h('p', { class: 'error' }, `La unidad del hábito de agua es «${hab.version.unit ?? ''}»: tiene que ser L o ml (Central → Hábitos).`));
    }
    const e = estadoAgua(log, t);
    const falta = t.ml < meta ? ` (faltan ${formatoMl(meta - t.ml)})` : '';
    const cerrar = e.cerrado
      ? h('button', { class: 'btn btn-sec', type: 'button', onClick: async () => {
        if (!confirm('¿Reabrir el día? Se borra el cierre y se vuelve a calcular con las tomas cargadas.')) return;
        await cambiar(() => H.borrarLog(log.id), 'Día reabierto.');
      } }, 'Reabrir el día')
      : h('button', { class: 'btn', type: 'button', onClick: async () => {
        msg.textContent = ''; ok.textContent = '';
        const c = decidirCierreAgua({ version: hab.version, totales: t, fecha, hoyFecha: hoy() });
        if (c.error) { msg.textContent = c.error; return; }
        try {
          await H.guardarLog({ habit_id: hab.version.id, log_date: fecha, status: c.status, value: c.value, note: c.note });
          await cargar(fecha, `Día cerrado: ${c.status === 'done' ? 'cumplido' : 'incumplido'}.`);
        } catch (err) { msg.textContent = traducirError(err); }
      } }, 'Cerrar el día');
    return h('div', { class: 'card pad' }, h('strong', {}, 'Agua del día'),
      h('p', {}, `${total} de ${formatoMl(meta)}${t.cantidad ? falta : ''}.`),
      h('p', {}, h('span', { class: `badge ${e.estado === 'sin_completar' ? 'no_registrado' : e.estado}` }, ETIQUETA[e.estado])),
      e.cerrado ? h('p', { class: 'fila-meta' }, 'Día cerrado.') : log && log.note === NOTA_AUTO_AGUA ? h('p', { class: 'fila-meta' }, 'Marcado solo al llegar a la meta; el día sigue abierto.') : null,
      h('p', { class: 'fila-meta' }, 'Si cambiás tomas de un día cerrado, reabrilo y volvé a cerrarlo para recalcular.'),
      h('div', { class: 'acciones' }, cerrar));
  }

  function tarjetaCarga() {
    const botellas = datos.botellas.filter((b) => !b.archived);
    const cantidad = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Otra cantidad', 'aria-label': 'Otra cantidad de agua' });
    const unidad = h('select', { 'aria-label': 'Unidad', value: 'ml' }, h('option', { value: 'ml' }, 'ml'), h('option', { value: 'l' }, 'L'));
    const agregar = h('button', { class: 'btn btn-sm', type: 'button' }, 'Sumar');
    agregar.addEventListener('click', () => {
      const v = validarCantidad(cantidad.value, unidad.value);
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      return sumar(v.ml, null);
    });
    return h('div', { class: 'card form' }, h('strong', {}, 'Sumar agua'),
      h('div', { class: 'acciones' }, BOTONES_RAPIDOS.map((ml) =>
        h('button', { class: 'btn', type: 'button', onClick: () => sumar(ml, null) }, `+ ${formatoMl(ml)}`))),
      h('p', { class: 'fila-meta' }, botellas.length ? 'Tus botellas (un toque suma su volumen):' : 'Todavía no tenés botellas: cargalas en la pestaña Botellas para sumar con un toque.'),
      botellas.length ? h('div', { class: 'acciones' }, botellas.map((b) =>
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => sumar(b.volume_ml, b.name, b.id) }, `${b.name} · ${formatoMl(b.volume_ml)}`))) : null,
      h('div', { class: 'acciones' }, cantidad, unidad, agregar));
  }

  function pintar() {
    const { tomas } = datos;
    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha',
      onChange: () => { if (inputFecha.value) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    const nav = h('div', { class: 'card form' },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: () => cargar(sumarDias(fecha, -1)) }, '‹'),
        h('strong', {}, etiquetaLarga(fecha)),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: () => cargar(sumarDias(fecha, 1)) }, '›')),
      h('label', {}, 'Fecha', inputFecha));
    const lista = tomas.length
      ? tomas.map((t, i) => h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, formatoMl(t.ml)), h('span', { class: 'badge' }, t.container_name ?? 'Rápida / manual')),
        h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: async () => {
          if (!confirm('¿Borrar esta toma?')) return;
          await cambiar(() => D.borrarToma(t.id), 'Toma borrada.');
        } }, i === tomas.length - 1 ? 'Deshacer / borrar' : 'Borrar'))))
      : [h('p', { class: 'fila-meta' }, 'No hay tomas cargadas este día.')];
    raiz.replaceChildren(nav, tarjetaTotal(), tarjetaCarga(), msg, ok, h('h2', { class: 'grupo-titulo' }, 'Tomas del día'), ...lista.reverse());
  }

  cont.append(raiz);
  return cargar();
}
