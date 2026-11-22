// Nutri → pestaña «Alimentos»: tu base de alimentos con valores por 100 g (o ml) y porciones con nombre.
// Se archivan, no se borran. Las comidas guardan una foto de lo calculado: cambiar un alimento no altera el historial.
import { h } from '../../core/dom.js';
import { traducirError } from '../../core/gym.js';
import { formatoNumero } from '../../core/entrenos.js';
import {
  UNIDADES_BASE, validarAlimento, validarPorcion, avisoCoherencia, resumenAlimento, filtrarAlimentos
} from '../../core/alimentos.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

export function renderAlimentos(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let alimentos = [], porciones = [];
  let editando = null;                                   // alimento en edición
  let buscar = '';
  let ocupado = false;

  async function cargar(mensajeOk = '', editarId = undefined) {
    const t = ++token;
    try {
      const [a, p] = await Promise.all([D.listarAlimentos(), D.listarPorciones()]);
      if (t !== token) return;
      alimentos = a; porciones = p;
      const id = editarId === undefined ? editando?.id : editarId;
      editando = id ? alimentos.find((x) => x.id === id) ?? null : null;
      msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar()));
    }
  }

  async function accion(fn, textoOk, editarId) {
    if (ocupado) return;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try { const r = await fn(); await cargar(typeof textoOk === 'function' ? textoOk(r) : textoOk, typeof editarId === 'function' ? editarId(r) : editarId); }
    catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
  }

  function formulario() {
    const e = editando;
    const num = (v) => (v == null ? '' : formatoNumero(v));
    const nombre = h('input', { type: 'text', maxlength: 80, placeholder: 'Ej.: Pechuga de pollo cocida', 'aria-label': 'Nombre del alimento', value: e?.name ?? '' });
    const unidad = h('select', { 'aria-label': 'Unidad base', value: e?.base_unit ?? 'g' }, UNIDADES_BASE.map((u) => h('option', { value: u.id }, u.nombre)));
    const kcal = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'kcal', 'aria-label': 'Calorías por 100', value: num(e?.kcal_100) });
    const carbs = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g', 'aria-label': 'Carbohidratos por 100', value: num(e?.carbs_100) });
    const prot = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g', 'aria-label': 'Proteínas por 100', value: num(e?.protein_100) });
    const gras = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'g', 'aria-label': 'Grasas por 100', value: num(e?.fat_100) });
    const guardar = h('button', { class: 'btn', type: 'button' }, e ? 'Guardar cambios' : 'Agregar alimento');
    guardar.addEventListener('click', () => {
      const v = validarAlimento({ nombre: nombre.value, unidad: unidad.value, kcal: kcal.value, carbs: carbs.value, proteina: prot.value, grasas: gras.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      const aviso = avisoCoherencia(v.datos);
      const id = e?.id;
      return accion(() => id ? D.actualizarAlimento(id, v.datos) : D.crearAlimento(v.datos),
        () => `${id ? 'Alimento actualizado.' : 'Alimento agregado. Ahora podés cargarle porciones.'}${aviso ? ' ' + aviso : ''}`,
        (r) => r.id);                                    // queda abierto para cargar sus porciones
    });
    return h('div', { class: 'card form' }, h('strong', {}, e ? 'Editar alimento' : 'Agregar alimento'),
      h('label', {}, 'Nombre', nombre), h('label', {}, 'Los valores de abajo son…', unidad),
      h('label', {}, 'Calorías (kcal)', kcal), h('label', {}, 'Carbohidratos (g)', carbs),
      h('label', {}, 'Proteínas (g)', prot), h('label', {}, 'Grasas (g)', gras),
      h('p', { class: 'fila-meta' }, 'Copialos de la etiqueta (por 100 g o 100 ml). Si algo es cero, escribí 0.'),
      h('div', { class: 'acciones' }, guardar,
        e ? h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { editando = null; msg.textContent = ''; ok.textContent = ''; pintar(); } }, 'Cerrar edición') : null));
  }

  function tarjetaPorciones() {
    const a = editando;
    if (!a) return null;
    const propias = porciones.filter((p) => p.food_id === a.id);
    const nombre = h('input', { type: 'text', maxlength: 40, placeholder: 'Ej.: 1 huevo', 'aria-label': 'Nombre de la porción' });
    const cantidad = h('input', { type: 'text', inputmode: 'decimal', placeholder: a.base_unit, 'aria-label': 'Cantidad de la porción' });
    const agregar = h('button', { class: 'btn btn-sm', type: 'button' }, 'Agregar porción');
    agregar.addEventListener('click', () => {
      const v = validarPorcion({ nombre: nombre.value, cantidad: cantidad.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      return accion(() => D.crearPorcion({ food_id: a.id, ...v.datos }), 'Porción agregada.');
    });
    return h('div', { class: 'card form' }, h('strong', {}, `Porciones de ${a.name}`),
      ...(propias.length
        ? propias.map((p) => h('div', { class: 'fila' },
          h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, p.name), h('span', { class: 'badge' }, `${formatoNumero(p.amount)} ${a.base_unit}`)),
          h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: async () => {
            if (!confirm('¿Borrar esta porción? Las comidas ya cargadas no cambian.')) return;
            await accion(() => D.borrarPorcion(p.id), 'Porción borrada.');
          } }, 'Borrar'))))
        : [h('p', { class: 'fila-meta' }, 'Todavía no tiene porciones (son opcionales: también podés cargar por gramos).')]),
      h('label', {}, 'Nombre', nombre), h('label', {}, `Cuánto pesa o mide (${a.base_unit})`, cantidad),
      h('div', { class: 'acciones' }, agregar));
  }

  function fila(a) {
    const ps = porciones.filter((p) => p.food_id === a.id);
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, a.name), h('span', { class: 'badge' }, a.archived ? 'Archivado' : a.base_unit)),
      h('div', { class: 'fila-meta' }, resumenAlimento(a)),
      ps.length ? h('div', { class: 'fila-meta' }, `Porciones: ${ps.map((p) => `${p.name} (${formatoNumero(p.amount)} ${a.base_unit})`).join(', ')}`) : null,
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => { editando = a; msg.textContent = ''; ok.textContent = ''; pintar(); } }, 'Editar / porciones'),
        h('button', { class: 'link', type: 'button', onClick: () => accion(() => D.actualizarAlimento(a.id, { archived: !a.archived }), a.archived ? 'Alimento recuperado.' : 'Alimento archivado.') },
          a.archived ? 'Desarchivar' : 'Archivar')));
  }

  function pintar() {
    const buscador = h('input', { type: 'search', placeholder: 'Buscar alimento', 'aria-label': 'Buscar alimento', value: buscar });
    const lista = h('div');
    const pintarLista = () => {
      const visibles = filtrarAlimentos(alimentos, buscar);
      const activos = visibles.filter((a) => !a.archived), archivados = visibles.filter((a) => a.archived);
      lista.replaceChildren(
        h('h2', { class: 'grupo-titulo' }, 'Mis alimentos'),
        ...(activos.length ? activos.map(fila) : [h('p', { class: 'fila-meta' }, alimentos.length ? 'Ningún alimento coincide con la búsqueda.' : 'Todavía no cargaste ningún alimento.')]),
        ...(archivados.length ? [h('h2', { class: 'grupo-titulo' }, 'Archivados'), ...archivados.map(fila)] : []));
    };
    buscador.addEventListener('input', () => { buscar = buscador.value; pintarLista(); });
    pintarLista();
    raiz.replaceChildren(formulario(), ...(editando ? [tarjetaPorciones()] : []), msg, ok, buscador, lista);
  }

  cont.append(raiz);
  return cargar();
}
