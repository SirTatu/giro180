// Nutri → pestaña «Hoy»: comidas del día (con alimento o a mano), las 4 macros, proteína contra la meta y cierre del día.
// Las decisiones (cumplido automático, cierre, avisos) viven en js/core/nutri.js; los estados en estados.js.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import {
  TIPOS_COMIDA, nombreTipo, totalDia, aviso, estadoProteina,
  decidirSincronizacion, decidirCierre, buscarHabitoProteina, NOTA_AUTO
} from '../../core/nutri.js';
import {
  MACROS, validarComidaManual, opcionesCantidad, calcularCantidad, comidaDeAlimento, reescalarComida,
  totalesMacros, textoMacrosComida, avisosMacros, filtrarAlimentos
} from '../../core/alimentos.js';
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
  let datos = null;                                       // { comidas, hab, log, alimentos, porciones }
  let editando = null;                                    // comida en edición
  let modo = null;                                        // 'alimento' | 'manual' (se recuerda entre cargas)
  let ultimoTipo = 'almuerzo';
  let ocupado = false;                                    // evita comidas duplicadas por doble toque

  const leerNucleo = async (f) => {
    const [comidas, defs, logs] = await Promise.all([D.comidasDelDia(f), H.listarDefiniciones(), H.logsEntre(f, f)]);
    const hab = buscarHabitoProteina(defs, f);
    const log = hab.versiones.length ? logs.find((l) => hab.versiones.some((v) => v.id === l.habit_id)) ?? null : null;
    return { comidas, hab, log };
  };
  // Los alimentos son OPCIONALES: si no se pueden leer, se puede cargar a mano y el resto funciona.
  const leer = async (f) => {
    const extrasP = Promise.allSettled([D.listarAlimentos(), D.listarPorciones()]);
    const nucleo = await leerNucleo(f);
    const [rAl, rPo] = await extrasP;
    return { ...nucleo, alimentos: rAl.status === 'fulfilled' ? rAl.value : null, porciones: rPo.status === 'fulfilled' ? rPo.value : [] };
  };

  // Después de cambiar comidas: marca «cumplido» solo si llegó a la meta (o quita ese marcado si dejó de llegar).
  async function sincronizar(f) {
    const d = await leerNucleo(f);
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
      if (modo === null) modo = (d.alimentos ?? []).some((a) => !a.archived) ? 'alimento' : 'manual';
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  async function cambiar(operacion, textoOk) {
    if (ocupado) return;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try {
      await operacion();
      const accion = await sincronizar(fecha);
      const extra = accion === 'guardar' ? ' Llegaste a la meta: el día quedó cumplido.' : accion === 'quitar' ? ' Dejaste de llegar a la meta: el día vuelve a «sin completar».' : '';
      await cargar(fecha, textoOk + extra);
    } catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
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

  const selTipo = (valor) => h('select', { 'aria-label': 'Tipo de comida', value: valor }, TIPOS_COMIDA.map((x) => h('option', { value: x.id }, x.nombre)));
  const num = (v) => (v == null ? '' : formatoNumero(v));
  const unidadDe = (c) => (datos.alimentos ?? []).find((a) => a.id === c.food_id)?.base_unit ?? '';
  const botonesCancelar = () => (editando ? h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { editando = null; msg.textContent = ''; pintar(); } }, 'Cancelar') : null);

  // Comida cargada a mano: las 4 macros son opcionales (vacío = «sin dato», no 0).
  function camposManual() {
    const sel = selTipo(editando?.meal_type ?? ultimoTipo);
    const desc = h('input', { type: 'text', maxlength: 300, placeholder: 'Qué comiste', 'aria-label': 'Descripción', value: editando?.description ?? '' });
    const kcal = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'kcal (opcional)', 'aria-label': 'Calorías', value: num(editando?.calories_kcal) });
    const carb = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g (opcional)', 'aria-label': 'Carbohidratos en gramos', value: num(editando?.carbs_g) });
    const prot = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g (opcional)', 'aria-label': 'Proteína en gramos', value: num(editando?.protein_g) });
    const gras = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g (opcional)', 'aria-label': 'Grasas en gramos', value: num(editando?.fat_g) });
    const guardar = h('button', { class: 'btn', type: 'button' }, editando ? 'Guardar cambios' : 'Agregar comida');
    guardar.addEventListener('click', async () => {
      const v = validarComidaManual({ tipo: sel.value, descripcion: desc.value, kcal: kcal.value, carbs: carb.value, proteina: prot.value, grasas: gras.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      ultimoTipo = sel.value;
      const id = editando?.id;
      await cambiar(() => id ? D.actualizarComida(id, v.datos) : D.crearComida({ eaten_on: fecha, ...v.datos }), id ? 'Comida actualizada.' : 'Comida agregada.');
    });
    return [h('label', {}, 'Tipo', sel), h('label', {}, 'Qué comiste', desc),
      h('label', {}, 'Calorías (kcal)', kcal), h('label', {}, 'Carbohidratos (g)', carb), h('label', {}, 'Proteína (g)', prot), h('label', {}, 'Grasas (g)', gras),
      h('p', { class: 'fila-meta' }, 'Lo que no sepas, dejalo vacío: queda como «sin dato», no como 0.'),
      h('div', { class: 'acciones' }, guardar, botonesCancelar())];
  }

  // Comida a partir de un alimento de tu base: elegís alimento y cantidad (g, ml o porciones) y la app calcula las macros.
  function camposAlimento() {
    const activos = (datos.alimentos ?? []).filter((a) => !a.archived);
    if (datos.alimentos === null) return [h('p', { class: 'fila-meta' }, 'No se pudieron leer tus alimentos. Podés cargar la comida «A mano» y probar de nuevo más tarde.')];
    if (!activos.length) return [h('p', { class: 'fila-meta' }, 'Todavía no cargaste alimentos. Cargalos en la pestaña Alimentos o usá «A mano».')];
    const sel = selTipo(ultimoTipo);
    const buscador = h('input', { type: 'search', placeholder: 'Buscar alimento', 'aria-label': 'Buscar alimento' });
    const selAl = h('select', { 'aria-label': 'Alimento' });
    const cant = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Cantidad', 'aria-label': 'Cantidad' });
    const selUni = h('select', { 'aria-label': 'Unidad de la cantidad' });
    const prev = h('p', { class: 'fila-meta', role: 'status' });
    const elegido = () => activos.find((a) => a.id === selAl.value) ?? null;
    const opciones = () => { const a = elegido(); return a ? opcionesCantidad(a, datos.porciones) : []; };
    const opcion = () => { const o = opciones(); return o.find((x) => x.id === selUni.value) ?? o[0] ?? null; };
    const vistaPrevia = () => {
      const a = elegido();
      if (!a) { prev.textContent = ''; return; }
      const r = calcularCantidad(a, opcion(), cant.value);
      if (r.error) { prev.textContent = cant.value.trim() ? r.error : ''; return; }
      prev.textContent = `${formatoNumero(r.amount)} ${a.base_unit} → ${textoMacrosComida({ calories_kcal: r.macros.kcal, carbs_g: r.macros.carbs, protein_g: r.macros.protein, fat_g: r.macros.fat })}`;
    };
    const pintarUnidades = () => { selUni.replaceChildren(...opciones().map((o) => h('option', { value: o.id }, o.texto))); vistaPrevia(); };
    const pintarAlimentos = () => {
      selAl.replaceChildren(h('option', { value: '' }, '— Elegí un alimento —'), ...filtrarAlimentos(activos, buscador.value).map((a) => h('option', { value: a.id }, a.name)));
      pintarUnidades();
    };
    buscador.addEventListener('input', pintarAlimentos);
    selAl.addEventListener('change', pintarUnidades);
    selUni.addEventListener('change', vistaPrevia);
    cant.addEventListener('input', vistaPrevia);
    pintarAlimentos();
    const guardar = h('button', { class: 'btn', type: 'button' }, 'Agregar comida');
    guardar.addEventListener('click', async () => {
      const r = comidaDeAlimento({ tipo: sel.value, alimento: elegido(), opcion: opcion(), cantidad: cant.value });
      if (r.error) { msg.textContent = r.error; ok.textContent = ''; return; }
      ultimoTipo = sel.value;
      await cambiar(() => D.crearComida({ eaten_on: fecha, ...r.datos }), 'Comida agregada.');
    });
    return [h('label', {}, 'Tipo', sel), h('label', {}, 'Buscar', buscador), h('label', {}, 'Alimento', selAl),
      h('label', {}, 'Cantidad', cant), h('label', {}, 'Unidad (gramos, ml o una porción)', selUni), prev,
      h('div', { class: 'acciones' }, guardar)];
  }

  // Editar una comida que vino de un alimento: solo tipo y cantidad (se recalcula proporcional a lo guardado).
  function camposEditarCantidad() {
    const sel = selTipo(editando.meal_type);
    const cant = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Cantidad', value: num(editando.amount) });
    const guardar = h('button', { class: 'btn', type: 'button' }, 'Guardar cambios');
    guardar.addEventListener('click', async () => {
      const r = reescalarComida(editando, cant.value);
      if (r.error) { msg.textContent = r.error; ok.textContent = ''; return; }
      const id = editando.id, tipo = sel.value;
      await cambiar(() => D.actualizarComida(id, { meal_type: tipo, ...r.datos }), 'Comida actualizada.');
    });
    return [h('p', { class: 'fila-meta' }, `${editando.food_name ?? editando.description}: al cambiar la cantidad, las macros se recalculan proporcionalmente. Para cambiar de alimento, borrá la comida y cargala de nuevo.`),
      h('label', {}, 'Tipo', sel), h('label', {}, `Cantidad${unidadDe(editando) ? ` (${unidadDe(editando)})` : ''}`, cant),
      h('div', { class: 'acciones' }, guardar, botonesCancelar())];
  }

  function formulario() {
    if (editando) {
      const deAlimento = editando.amount != null && editando.food_name;
      return h('div', { class: 'card form' }, h('strong', {}, 'Editar comida'), ...(deAlimento ? camposEditarCantidad() : camposManual()));
    }
    const boton = (id, texto) => h('button', { class: 'btn btn-sm' + (modo === id ? '' : ' btn-sec'), type: 'button', onClick: () => { modo = id; msg.textContent = ''; pintar(); } }, texto);
    return h('div', { class: 'card form' }, h('strong', {}, 'Agregar comida'),
      h('div', { class: 'acciones' }, boton('alimento', 'Con alimento'), boton('manual', 'A mano')),
      ...(modo === 'manual' ? camposManual() : camposAlimento()));
  }

  function tarjetaMacros() {
    const tm = totalesMacros(datos.comidas);
    const valor = (m) => (tm[m.id].total == null ? '—' : `${formatoNumero(tm[m.id].total)} ${m.unidad}`);
    return h('div', { class: 'card pad' }, h('strong', {}, 'Macros del día'),
      h('div', { class: 'metricas cuatro' }, MACROS.map((m) => h('div', { class: 'metrica' }, h('b', {}, valor(m)), h('span', {}, m.nombre)))),
      ...avisosMacros(tm).map((a) => h('p', { class: 'aviso' }, a)),
      h('p', { class: 'fila-meta' }, 'Los totales solo suman lo cargado. Hoy se mide la meta de proteína; los objetivos de las otras macros llegan en una próxima versión.'));
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
        h('div', { class: 'fila-meta' }, `${c.description}${c.amount != null ? ` · ${formatoNumero(c.amount)}${unidadDe(c) ? ' ' + unidadDe(c) : ''}` : ''}`),
        h('div', { class: 'fila-meta' }, textoMacrosComida(c)),
        h('div', { class: 'acciones' },
          h('button', { class: 'link', type: 'button', onClick: () => { editando = c; msg.textContent = ''; ok.textContent = ''; pintar(); } }, 'Editar'),
          h('button', { class: 'link', type: 'button', onClick: async () => {
            if (!confirm('¿Borrar esta comida?')) return;
            await cambiar(() => D.borrarComida(c.id), 'Comida borrada.');
          } }, 'Borrar'))))
      : [h('p', { class: 'fila-meta' }, 'No hay comidas cargadas este día.')];

    raiz.replaceChildren(nav, tarjetaMacros(), tarjetaProteina(), formulario(), msg, ok, h('h2', { class: 'grupo-titulo' }, 'Comidas del día'), ...lista);
  }

  cont.append(raiz);
  return cargar();
}
