// Nutri → pestaña «Hoy»: comidas del día (con alimento o a mano), las 4 macros contra su objetivo y cierre del día.
// Las decisiones (estado de cada macro, cumplido/excedido automáticos, cierre) viven en js/core/macros.js; los estados en estados.js.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import { textoObjetivo } from '../../core/estados.js';
import { TIPOS_COMIDA, nombreTipo } from '../../core/nutri.js';
import {
  MACROS, validarComidaManual, opcionesCantidad, calcularCantidad, comidaDeAlimento, reescalarComida,
  totalesMacros, textoMacrosComida, avisosMacros, filtrarAlimentos
} from '../../core/alimentos.js';
import {
  NOTA_AUTO_MACRO, buscarHabitoMacro, decidirSincronizacionMacro, decidirCierreMacros, estadoMacro, notaMacro,
  logsParaReabrir, textoResumenCierre
} from '../../core/macros.js';
import * as D from './datos.js';
import * as H from '../compartido/habitos.js';
import { cajaError } from './ui.js';

const ETIQUETA = {
  cumplido: 'Cumplido', incumplido: 'Incumplido', excedido: 'Excedido', sin_completar: 'Sin completar', no_registrado: 'No registrado',
  sin_dato: 'Sin dato', dentro_del_limite: 'Dentro del límite', dentro_del_rango: 'Dentro del rango'
};
// Colores: los estados ya registrados usan su propia clase; lo que todavía no se registró va en tono neutro.
const CLASE = { cumplido: 'cumplido', incumplido: 'incumplido', excedido: 'excedido', sin_completar: 'no_registrado', no_registrado: 'no_registrado', sin_dato: 'no_registrado', dentro_del_limite: '', dentro_del_rango: '' };

const g = (n) => `${formatoNumero(n)} g`;

export function renderHoy(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = ctx.fechaInicial || hoy();
  let datos = null;                                       // { comidas, macros: { id: { hab, log } }, alimentos, porciones }
  let editando = null;                                    // comida en edición
  let modo = null;                                        // 'alimento' | 'manual' (se recuerda entre cargas)
  let ultimoTipo = 'almuerzo';
  let ocupado = false;                                    // evita comidas duplicadas por doble toque

  const leerNucleo = async (f) => {
    const [comidas, defs, logs] = await Promise.all([D.comidasDelDia(f), H.listarDefiniciones(), H.logsEntre(f, f)]);
    const macros = {};
    for (const m of MACROS) {
      const hab = buscarHabitoMacro(defs, f, m.id);
      const log = hab.versiones.length ? logs.find((l) => hab.versiones.some((v) => v.id === l.habit_id)) ?? null : null;
      macros[m.id] = { hab, log };
    }
    return { comidas, macros };
  };
  // Los alimentos son OPCIONALES: si no se pueden leer, se puede cargar a mano y el resto funciona.
  const leer = async (f) => {
    const extrasP = Promise.allSettled([D.listarAlimentos(), D.listarPorciones()]);
    const nucleo = await leerNucleo(f);
    const [rAl, rPo] = await extrasP;
    return { ...nucleo, alimentos: rAl.status === 'fulfilled' ? rAl.value : null, porciones: rPo.status === 'fulfilled' ? rPo.value : [] };
  };

  // Después de cambiar comidas: marca «cumplido» o «excedido» solo cuando corresponde (y lo quita si dejó de corresponder).
  // Nunca marca «incumplido» solo. Devuelve qué cambió, para avisarlo.
  async function sincronizar(f) {
    const d = await leerNucleo(f);
    const tm = totalesMacros(d.comidas);
    const cambios = [];
    for (const m of MACROS) {
      const { hab, log } = d.macros[m.id];
      const dec = decidirSincronizacionMacro({ version: hab.version, total: tm[m.id].total, log, notaAuto: NOTA_AUTO_MACRO[m.id] });
      if (dec.accion === 'guardar') {
        const estadoPrevio = log?.status ?? null;                 // se guarda ANTES de escribir, para comparar con lo anterior
        await H.guardarLog({ habit_id: hab.version.id, log_date: f, status: dec.status, value: dec.value, note: dec.note });
        if (estadoPrevio !== dec.status) cambios.push({ nombre: m.nombre.toLowerCase(), que: dec.status === 'exceeded' ? 'excedido' : 'cumplido' });
      } else if (dec.accion === 'quitar') {
        await H.borrarLog(log.id);
        cambios.push({ nombre: m.nombre.toLowerCase(), que: 'quitado' });
      }
    }
    return cambios;
  }
  const textoCambios = (cambios) => {
    const de = (que) => cambios.filter((c) => c.que === que).map((c) => c.nombre).join(', ');
    return [
      de('cumplido') && ` Objetivo cumplido: ${de('cumplido')}.`,
      de('excedido') && ` Te pasaste del máximo de ${de('excedido')}: queda «excedido».`,
      de('quitado') && ` Se quitó la marca automática de ${de('quitado')}.`
    ].filter(Boolean).join('');
  };

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
      const cambios = await sincronizar(fecha);
      await cargar(fecha, textoOk + textoCambios(cambios));
    } catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
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

  // Una fila por macro: total del día, objetivo (si lo hay), estado y una nota con los números que faltan o sobran.
  function filasMacros() {
    const tm = totalesMacros(datos.comidas);
    const hayComidas = datos.comidas.length > 0;
    return MACROS.map((m) => {
      const { hab, log } = datos.macros[m.id];
      const e = estadoMacro({ version: hab.version, total: tm[m.id].total, log, notaAuto: NOTA_AUTO_MACRO[m.id], hayComidas });
      return { macroId: m.id, nombre: m.nombre, unidad: m.unidad, version: hab.version, motivo: hab.motivo, log, total: tm[m.id].total, sinDato: tm[m.id].sinDato, ...e };
    });
  }

  function tarjetaMacros() {
    const filas = filasMacros();
    const tm = totalesMacros(datos.comidas);
    const hayComidas = datos.comidas.length > 0;
    const conObjetivo = filas.filter((f) => f.version);
    const hayAbiertas = conObjetivo.some((f) => !f.cerrado);
    const hayCerradas = logsParaReabrir(filas).length > 0;

    const fila = (f) => {
      const total = f.total == null ? '—' : `${formatoNumero(f.total)} ${f.unidad}`;
      const nota = f.motivo === 'ambiguo'
        ? 'Hay más de un hábito de esta macro en Nutri: dejá uno solo en Central → Hábitos.'
        : notaMacro({ version: f.version, total: f.total, estado: f.estado, cerrado: f.cerrado, unidad: f.unidad });
      return h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, f.nombre),
          f.estado ? h('span', { class: `badge ${CLASE[f.estado]}`.trim() }, ETIQUETA[f.estado]) : null),
        h('div', { class: 'fila-meta' }, f.version ? `${total} · objetivo ${textoObjetivo(f.version)}` : `${total} · sin objetivo`),
        nota ? h('div', { class: 'fila-meta' }, nota) : null);
    };

    const cerrar = h('button', { class: 'btn', type: 'button' }, 'Cerrar el día');
    cerrar.addEventListener('click', async () => {
      if (ocupado) return;
      msg.textContent = ''; ok.textContent = '';
      const c = decidirCierreMacros({
        filas: filas.map((f) => ({ macroId: f.macroId, nombre: f.nombre, version: f.version, total: f.total, sinDato: f.sinDato, log: f.log })),
        hayComidas, fecha, hoyFecha: hoy()
      });
      if (c.error) { msg.textContent = c.error; return; }
      if (c.confirmar && !confirm(c.confirmar)) return;
      ocupado = true;
      try {
        for (const e of c.escribir) await H.guardarLog({ habit_id: e.habit_id, log_date: fecha, status: e.status, value: e.value, note: e.note });
        await cargar(fecha, `Día cerrado: ${textoResumenCierre(c.resumen)}.`);
      } catch (err) { msg.textContent = traducirError(err); } finally { ocupado = false; }
    });
    const reabrir = h('button', { class: 'btn btn-sec', type: 'button' }, 'Reabrir el día');
    reabrir.addEventListener('click', async () => {
      if (!confirm('¿Reabrir el día? Se borra el cierre de las macros y se vuelve a calcular con las comidas cargadas.')) return;
      const logs = logsParaReabrir(filas);
      await cambiar(async () => { for (const l of logs) await H.borrarLog(l.id); }, 'Día reabierto.');
    });

    return h('div', { class: 'card pad' }, h('strong', {}, 'Macros del día'),
      ...filas.map(fila),
      ...avisosMacros(tm).map((a) => h('p', { class: 'aviso' }, a)),
      h('p', { class: 'fila-meta' }, 'Los totales solo suman lo cargado.'),
      conObjetivo.length ? null : h('p', { class: 'fila-meta' }, 'Todavía no definiste objetivos de macros: configuralos en la pestaña Objetivos.'),
      hayCerradas ? h('p', { class: 'fila-meta' }, 'Si cambiás comidas de un día cerrado, reabrilo y volvé a cerrarlo para recalcular.') : null,
      conObjetivo.length && (hayAbiertas || hayCerradas)
        ? h('div', { class: 'acciones' }, hayAbiertas ? cerrar : null, hayCerradas ? reabrir : null)
        : null);
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

    raiz.replaceChildren(nav, tarjetaMacros(), formulario(), msg, ok, h('h2', { class: 'grupo-titulo' }, 'Comidas del día'), ...lista);
  }

  cont.append(raiz);
  return cargar();
}
