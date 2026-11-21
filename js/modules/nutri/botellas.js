// Nutri → pestaña «Botellas»: tus recipientes (botella de la oficina, jarra, termo, vaso...) con su volumen.
// En la pestaña Agua, tocar una botella suma sus ml. Se archivan, no se borran; las tomas ya cargadas no cambian.
import { h } from '../../core/dom.js';
import { traducirError } from '../../core/gym.js';
import { validarBotella, formatoMl } from '../../core/agua.js';
import * as D from './datos.js';
import { cajaError } from './ui.js';

export function renderBotellas(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let lista = [];
  let editando = null;
  let ocupado = false;

  async function cargar(mensajeOk = '') {
    const t = ++token;
    try {
      const l = await D.listarBotellas();
      if (t !== token) return;
      lista = l; editando = null; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar()));
    }
  }

  async function accion(fn, textoOk) {
    if (ocupado) return;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try { await fn(); await cargar(textoOk); } catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
  }

  function formulario() {
    const nombre = h('input', { type: 'text', maxlength: 60, placeholder: 'Ej.: Botella de la oficina', 'aria-label': 'Nombre de la botella', value: editando?.name ?? '' });
    const volumen = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Volumen', 'aria-label': 'Volumen de la botella',
      value: editando ? String(editando.volume_ml) : '' });
    const unidad = h('select', { 'aria-label': 'Unidad del volumen', value: 'ml' }, h('option', { value: 'ml' }, 'ml'), h('option', { value: 'l' }, 'L'));
    const guardar = h('button', { class: 'btn', type: 'button' }, editando ? 'Guardar cambios' : 'Agregar botella');
    guardar.addEventListener('click', () => {
      const v = validarBotella({ nombre: nombre.value, volumen: volumen.value, unidad: unidad.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      const id = editando?.id;
      return accion(() => id ? D.actualizarBotella(id, v.datos) : D.crearBotella(v.datos), id ? 'Botella actualizada.' : 'Botella agregada.');
    });
    return h('div', { class: 'card form' }, h('strong', {}, editando ? 'Editar botella' : 'Agregar botella'),
      h('label', {}, 'Nombre', nombre), h('label', {}, 'Volumen', volumen), h('label', {}, 'Unidad', unidad),
      h('div', { class: 'acciones' }, guardar,
        editando ? h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { editando = null; msg.textContent = ''; pintar(); } }, 'Cancelar') : null));
  }

  function fila(b) {
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, b.name), h('span', { class: 'badge' }, b.archived ? 'Archivada' : formatoMl(b.volume_ml))),
      h('div', { class: 'fila-meta' }, `${formatoMl(b.volume_ml)}${b.archived ? ' · no aparece en Agua' : ''}`),
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => { editando = b; msg.textContent = ''; ok.textContent = ''; pintar(); } }, 'Editar'),
        h('button', { class: 'link', type: 'button', onClick: () => accion(() => D.actualizarBotella(b.id, { archived: !b.archived }), b.archived ? 'Botella recuperada.' : 'Botella archivada.') },
          b.archived ? 'Desarchivar' : 'Archivar')));
  }

  function pintar() {
    const activas = lista.filter((b) => !b.archived), archivadas = lista.filter((b) => b.archived);
    raiz.replaceChildren(formulario(), msg, ok,
      h('h2', { class: 'grupo-titulo' }, 'Mis botellas'),
      ...(activas.length ? activas.map(fila) : [h('p', { class: 'fila-meta' }, 'Todavía no cargaste ninguna botella.')]),
      ...(archivadas.length ? [h('h2', { class: 'grupo-titulo' }, 'Archivadas'), ...archivadas.map(fila)] : []));
  }

  cont.append(raiz);
  return cargar();
}
