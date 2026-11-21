// Nutri → pestaña «Hoy»: comidas del día, proteína contra la meta y cierre del día.
// Las decisiones (cumplido automático, cierre, avisos) viven en js/core/nutri.js; los estados en estados.js.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import {
  TIPOS_COMIDA, nombreTipo, validarComida, totalDia, aviso, estadoProteina,
  decidirSincronizacion, decidirCierre, buscarHabitoProteina, NOTA_AUTO
} from '../../core/nutri.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = { cumplido: 'Cumplido', incumplido: 'Incumplido', sin_completar: 'Sin completar', no_registrado: 'No registrado' };
const g = (n) => `${formatoNumero(n)} g`;

export function renderHoy(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = ctx.fechaInicial || hoy();
  let datos = null;                                       // { comidas, hab, log }
  let editando = null;                                    // comida en edición

  const leer = async (f) => {
    const [comidas, defs, logs] = await Promise.all([D.comidasDelDia(f), H.listarDefiniciones(), H.logsEntre(f, f)]);
    const hab = buscarHabitoProteina(defs, f);
    const log = hab.versiones.length ? logs.find((l) => hab.versiones.some((v) => v.id === l.habit_id)) ?? null : null;
    return { comidas, hab, log };
  };

  // Después de cambiar comidas: marca «cumplido» solo si llegó a la meta (o quita ese marcado si dejó de llegar).
  async function sincronizar(f) {
    const d = await leer(f);
    const t = totalDia(d.comidas);
    const dec = decidirSincronizacion({ version: d.hab.version, total: t.total, log: d.log });
    if (dec.accion === 'guardar') await H.guardarLog({ habit_id: d.hab.version.id, log_date: f, status: dec.status, value: dec.value, note: dec.note });
    else if (dec.accion === 'quitar') await H.borrarLog(d.log.id);
    return dec.accion;
  }

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const d = await leer(f);
      if (t !== token) return;
      fecha = f; datos = d; editando = null; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  async function cambiar(operacion, textoOk) {
    msg.textContent = ''; ok.textContent = '';
    try {
      await operacion();
      const accion = await sincronizar(fecha);
      const extra = accion === 'guardar' ? ' Llegaste a la meta: el día quedó cumplido.' : accion === 'quitar' ? ' Dejaste de llegar a la meta: el día vuelve a «sin completar».' : '';
      await cargar(fecha, textoOk + extra);
    } catch (e) { msg.textContent = traducirError(e); }
  }

  function tarjetaProteina() {
    const { comidas, hab, log } = datos;
    const t = totalDia(comidas);
    if (hab.motivo === 'sin_habito' || hab.motivo === 'ambiguo') {
      return h('div', { class: 'card pad' }, h('p', {}, hab.motivo === 'sin_habito'
        ? 'Todavía no hay un hábito de proteína. Podés cargar comidas igual. Para medir la meta, creá uno en Central → Hábitos: módulo Nutri, tipo cantidad, nombre con «Proteína», unidad «g» y tu meta diaria.'
        : 'Hay más de un hábito de cantidad en Nutri y no sé cuál es el de proteína. Ponele «Proteína» en el nombre al que corresponda (Central → Hábitos).'));
    }
    if (!hab.version) {
      return h('div', { class: 'card pad' }, h('p', {}, 'El hábito de proteína no estaba vigente ese día. Podés cargar comidas igual.'));
    }
    const meta = Number(hab.version.target_value);
    const e = estadoProteina(log, t);
    const lineas = [];
    lineas.push(t.total == null
      ? `Meta de ese día: ${g(meta)}. Todavía no hay proteína cargada.`
      : `${g(t.total)} de ${g(meta)}${t.total >= meta ? '.' : ` (faltan ${g(meta - t.total)}).`}`);
    const av = aviso(t);
    const nota = e.cerrado ? (log.note === NOTA_AUTO ? '' : 'Día cerrado.') : log ? 'Marcado solo al llegar a la meta; el día sigue abierto.' : '';
    const acciones = e.cerrado
      ? h('button', { class: 'btn btn-sec', type: 'button', onClick: async () => {
        if (!confirm('¿Reabrir el día? Se borra el cierre y se vuelve a calcular con las comidas cargadas.')) return;
        await cambiar(() => H.borrarLog(log.id), 'Día reabierto.');
      } }, 'Reabrir el día')
      : h('button', { class: 'btn', type: 'button', onClick: async () => {
        msg.textContent = ''; ok.textContent = '';
        const c = decidirCierre({ version: hab.version, totales: t, fecha, hoyFecha: hoy() });
        if (c.error) { msg.textContent = c.error; return; }
        if (c.confirmar && !confirm(c.confirmar)) return;
        try {
          await H.guardarLog({ habit_id: hab.version.id, log_date: fecha, status: c.status, value: c.value, note: c.note });
          await cargar(fecha, `Día cerrado: ${c.status === 'done' ? 'cumplido' : 'incumplido'}.`);
        } catch (err) { msg.textContent = traducirError(err); }
      } }, 'Cerrar el día');
    return h('div', { class: 'card pad' },
      h('strong', {}, 'Proteína del día'),
      h('p', {}, lineas[0]),
      h('p', {}, h('span', { class: `badge ${e.estado === 'sin_completar' ? 'no_registrado' : e.estado}` }, ETIQUETA[e.estado])),
      av ? h('p', { class: 'aviso' }, av) : null,
      nota ? h('p', { class: 'fila-meta' }, nota) : null,
      h('p', { class: 'fila-meta' }, 'Si cambiás comidas de un día cerrado, reabrilo y volvé a cerrarlo para recalcular.'),
      h('div', { class: 'acciones' }, acciones));
  }

  function formulario() {
    const sel = h('select', { 'aria-label': 'Tipo de comida', value: editando?.meal_type ?? 'almuerzo' },
      TIPOS_COMIDA.map((x) => h('option', { value: x.id }, x.nombre)));
    const desc = h('input', { type: 'text', maxlength: 300, placeholder: 'Qué comiste', 'aria-label': 'Descripción', value: editando?.description ?? '' });
    const prot = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Proteína en g (opcional)', 'aria-label': 'Proteína en gramos',
      value: editando?.protein_g != null ? formatoNumero(editando.protein_g) : '' });
    const guardar = h('button', { class: 'btn', type: 'button' }, editando ? 'Guardar cambios' : 'Agregar comida');
    guardar.addEventListener('click', async () => {
      const v = validarComida({ tipo: sel.value, descripcion: desc.value, proteina: prot.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      guardar.disabled = true;
      const id = editando?.id;
      await cambiar(() => id ? D.actualizarComida(id, v.datos) : D.crearComida({ eaten_on: fecha, ...v.datos }), id ? 'Comida actualizada.' : 'Comida agregada.');
      guardar.disabled = false;
    });
    return h('div', { class: 'card form' }, h('strong', {}, editando ? 'Editar comida' : 'Agregar comida'),
      h('label', {}, 'Tipo', sel), h('label', {}, 'Qué comiste', desc), h('label', {}, 'Proteína (g)', prot),
      h('p', { class: 'fila-meta' }, 'Si no sabés la proteína, dejala vacía: queda como «no cargada», no como 0 g.'),
      h('div', { class: 'acciones' }, guardar,
        editando ? h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { editando = null; msg.textContent = ''; pintar(); } }, 'Cancelar') : null));
  }

  function pintar() {
    const { comidas } = datos;
    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha',
      onChange: () => { if (inputFecha.value) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    const nav = h('div', { class: 'card form' },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: () => cargar(sumarDias(fecha, -1)) }, '‹'),
        h('strong', {}, etiquetaLarga(fecha)),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: () => cargar(sumarDias(fecha, 1)) }, '›')),
      h('label', {}, 'Fecha', inputFecha));

    const lista = comidas.length
      ? comidas.map((c) => h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, nombreTipo(c.meal_type)),
          h('span', { class: 'badge' }, c.protein_g == null ? 'Proteína sin cargar' : g(c.protein_g))),
        h('div', { class: 'fila-meta' }, c.description),
        h('div', { class: 'acciones' },
          h('button', { class: 'link', type: 'button', onClick: () => { editando = c; msg.textContent = ''; ok.textContent = ''; pintar(); } }, 'Editar'),
          h('button', { class: 'link', type: 'button', onClick: async () => {
            if (!confirm('¿Borrar esta comida?')) return;
            await cambiar(() => D.borrarComida(c.id), 'Comida borrada.');
          } }, 'Borrar'))))
      : [h('p', { class: 'fila-meta' }, 'No hay comidas cargadas este día.')];

    raiz.replaceChildren(nav, tarjetaProteina(), formulario(), msg, ok, h('h2', { class: 'grupo-titulo' }, 'Comidas del día'), ...lista);
  }

  cont.append(raiz);
  return cargar();
}
