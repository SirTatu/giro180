// Objetivos generales y específicos. Los cambios quedan anotados en el historial de decisiones.
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import * as D from './datos.js';

const TEXTO_ESTADO = { achieved: 'Logrado', dropped: 'Descartado' };

export function renderObjetivos(cont, ctx) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  cont.append(h('h2', { class: 'seccion-titulo' }, 'Objetivos'), msg, raiz);

  let goals = [];
  let formAbierto = false;
  let editando = null;

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  async function cargar() {
    try { goals = await D.listarObjetivos(); msg.textContent = ''; } catch (e) { mostrarError(e); }
    pintar();
  }
  async function ejecutar(fn) {
    msg.textContent = '';
    try { await fn(); await cargar(); } catch (e) { mostrarError(e); }
  }
  async function decidir(g, decision, motivo) {
    await D.registrarDecision({ decided_on: hoy(), area: g.module ?? 'central', decision, reason: motivo || null });
    ctx.alRegistrarDecision?.();
  }

  const cerrarForm = () => { formAbierto = false; editando = null; };

  function cambiarEstado(g, status) {
    let motivo = '';
    if (status === 'dropped') {
      motivo = prompt(`Descartar «${g.title}».\n¿Por qué? (opcional)`);
      if (motivo === null) return;
    }
    ejecutar(async () => {
      await D.actualizarObjetivo(g.id, { status, valid_to: status === 'active' ? null : hoy() });
      const verbo = { achieved: 'logrado', dropped: 'descartado', active: 'reactivado' }[status];
      await decidir(g, `Objetivo «${g.title}» ${verbo}`, motivo.trim());
    });
  }

  function formulario() {
    const g = editando;
    const esEdicion = !!g;
    const scope = h('select', { value: g?.scope ?? 'general', disabled: esEdicion,
      onChange: () => { filaPadre.hidden = scope.value !== 'specific'; } },
      h('option', { value: 'general' }, 'General'), h('option', { value: 'specific' }, 'Específico'));
    const modulo = h('select', { value: g?.module ?? '', disabled: esEdicion },
      h('option', { value: '' }, 'Sin módulo'),
      ...ORDEN_MODULOS.map((k) => h('option', { value: k }, NOMBRES_MODULO[k])));
    const generales = goals.filter((x) => x.scope === 'general' && x.status === 'active');
    const padre = h('select', { value: g?.parent_goal_id ?? '', disabled: esEdicion },
      h('option', { value: '' }, 'Ninguno'), ...generales.map((x) => h('option', { value: x.id }, x.title)));
    const filaPadre = h('label', {}, 'Pertenece al objetivo general', padre);
    filaPadre.hidden = (g?.scope ?? 'general') !== 'specific';
    const titulo = h('input', { type: 'text', value: g?.title ?? '', maxLength: 120, placeholder: 'Ej.: Bajar a 80 kg' });
    const desc = h('input', { type: 'text', value: g?.description ?? '', maxLength: 300, placeholder: 'Detalle (opcional)' });
    const fecha = h('input', { type: 'date', value: g?.target_date ?? '' });
    const boton = h('button', { class: 'btn', type: 'button' }, esEdicion ? 'Guardar cambios' : 'Crear objetivo');

    boton.addEventListener('click', async () => {
      msg.textContent = '';
      const t = titulo.value.trim();
      if (!t) return mostrarError(new Error('Escribí el título del objetivo.'));
      boton.disabled = true;
      try {
        if (!esEdicion) {
          const nuevo = await D.crearObjetivo({
            scope: scope.value, module: modulo.value || null,
            parent_goal_id: scope.value === 'specific' && padre.value ? padre.value : null,
            title: t, description: desc.value.trim() || null, target_date: fecha.value || null, valid_from: hoy()
          });
          await decidir(nuevo, `Nuevo objetivo ${scope.value === 'general' ? 'general' : 'específico'}: ${t}`, null);
        } else {
          const cambios = [];
          if (t !== g.title) cambios.push(`título «${g.title}» → «${t}»`);
          if ((desc.value.trim() || null) !== (g.description || null)) cambios.push('descripción modificada');
          if ((fecha.value || null) !== (g.target_date || null)) {
            cambios.push(`fecha objetivo ${g.target_date ?? 'sin fecha'} → ${fecha.value || 'sin fecha'}`);
          }
          if (cambios.length) {
            await D.actualizarObjetivo(g.id, { title: t, description: desc.value.trim() || null, target_date: fecha.value || null });
            await decidir(g, `Objetivo «${t}» modificado: ${cambios.join('; ')}`, null);
          }
        }
        cerrarForm();
        await cargar();
      } catch (e) { mostrarError(e); } finally { boton.disabled = false; }
    });

    return h('div', { class: 'card form' },
      h('strong', {}, esEdicion ? 'Editar objetivo' : 'Nuevo objetivo'),
      h('div', { class: 'dos-col' }, h('label', {}, 'Tipo', scope), h('label', {}, 'Módulo', modulo)),
      filaPadre,
      h('label', {}, 'Título', titulo), h('label', {}, 'Detalle', desc), h('label', {}, 'Fecha objetivo (opcional)', fecha),
      h('div', { class: 'acciones' }, boton,
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { cerrarForm(); pintar(); } }, 'Cancelar')));
  }

  function fila(g, sub) {
    const meta = [g.module ? NOMBRES_MODULO[g.module] : null, g.target_date ? 'Para ' + g.target_date : null]
      .filter(Boolean).join(' · ');
    return h('div', { class: 'fila' + (sub ? ' sub' : '') },
      h('div', { class: 'fila-top' },
        h('div', {}, h('div', { class: 'fila-nombre' }, g.title),
          meta ? h('div', { class: 'fila-meta' }, meta) : null,
          g.description ? h('div', { class: 'fila-meta' }, g.description) : null),
        h('span', { class: 'badge' }, g.scope === 'general' ? 'General' : 'Específico')),
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: async () => { editando = g; formAbierto = true; pintar(); } }, 'Editar'),
        h('button', { class: 'link', type: 'button', onClick: () => cambiarEstado(g, 'achieved') }, 'Marcar logrado'),
        h('button', { class: 'link', type: 'button', onClick: () => cambiarEstado(g, 'dropped') }, 'Descartar')));
  }

  function pintar() {
    const activos = goals.filter((g) => g.status === 'active');
    const cerrados = goals.filter((g) => g.status !== 'active');
    const generales = activos.filter((g) => g.scope === 'general');
    const idsGenerales = new Set(generales.map((g) => g.id));

    const bloques = [];
    for (const gen of generales) {
      bloques.push(fila(gen, false));
      for (const hijo of activos.filter((x) => x.parent_goal_id === gen.id)) bloques.push(fila(hijo, true));
    }
    const sueltos = activos.filter((g) => g.scope === 'specific' && !idsGenerales.has(g.parent_goal_id));
    if (sueltos.length) {
      bloques.push(h('h3', { class: 'grupo-titulo' }, 'Objetivos específicos sin objetivo general'));
      sueltos.forEach((g) => bloques.push(fila(g, false)));
    }
    if (!activos.length) bloques.push(h('p', { class: 'nota' }, 'Todavía no hay objetivos activos.'));

    const hist = cerrados.length
      ? h('details', { class: 'card pad' },
          h('summary', {}, `Objetivos logrados o descartados (${cerrados.length})`),
          ...cerrados.map((g) => h('div', { class: 'fila-meta hist-fila' },
            `${TEXTO_ESTADO[g.status]} · ${g.title} · ${g.valid_from} → ${g.valid_to ?? ''} `,
            h('button', { class: 'link', type: 'button', onClick: () => cambiarEstado(g, 'active') }, 'Reactivar'))))
      : null;

    raiz.replaceChildren(
      formAbierto ? formulario() : h('button', { class: 'btn', type: 'button', onClick: () => { editando = null; formAbierto = true; pintar(); } }, '+ Nuevo objetivo'),
      ...bloques, hist);
  }

  cargar();
}
