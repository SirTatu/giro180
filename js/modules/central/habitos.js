// Pestaña "Hábitos": crear, corregir, versionar y archivar.
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS, DIAS_CORTOS, DIAS_LETRA } from '../../core/constantes.js';
import * as D from './datos.js';

const diasTexto = (arr) =>
  arr.length === 7 ? 'Todos los días' : [...arr].sort((a, b) => a - b).map((d) => DIAS_CORTOS[d]).join(', ');
const tipoTexto = (v) => v.kind === 'boolean'
  ? 'Sí / No'
  : `${v.kind === 'quantity' ? 'Cantidad' : 'Duración'}: ${v.target_value} ${v.unit ?? ''} o más`;
const orden = (a, b) =>
  ORDEN_MODULOS.indexOf(a.module) - ORDEN_MODULOS.indexOf(b.module) || a.name.localeCompare(b.name);

export async function renderHabitos(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  cont.append(raiz);

  let defs = [];
  let formAbierto = false;
  let editando = null;      // versión que se edita (null = hábito nuevo)
  let tieneLogs = false;

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  async function cargar() {
    try { defs = await D.listarHabitos(); msg.textContent = ''; } catch (e) { mostrarError(e); }
    pintar();
  }
  async function ejecutar(fn) {
    msg.textContent = '';
    try { await fn(); await cargar(); } catch (e) { mostrarError(e); }
  }

  const abrirNuevo = () => { editando = null; tieneLogs = false; formAbierto = true; pintar(); };
  async function abrirEditar(v) {
    try { tieneLogs = (await D.contarLogs(v.id)) > 0; } catch (e) { return mostrarError(e); }
    editando = v; formAbierto = true; pintar();
  }
  const cerrarForm = () => { formAbierto = false; editando = null; };

  function formulario() {
    const v = editando;
    const esEdicion = !!v;
    const pedirDesde = !esEdicion || tieneLogs;

    const modulo = h('select', { value: v?.module ?? 'central', disabled: esEdicion },
      ...ORDEN_MODULOS.map((k) => h('option', { value: k }, NOMBRES_MODULO[k])));
    const nombre = h('input', { type: 'text', value: v?.name ?? '', placeholder: 'Ej.: Proteínas', maxLength: 80 });
    const tipo = h('select', { value: v?.kind ?? 'boolean', onChange: () => { bloqueMeta.hidden = tipo.value === 'boolean'; } },
      h('option', { value: 'boolean' }, 'Sí / No'),
      h('option', { value: 'quantity' }, 'Cantidad'),
      h('option', { value: 'duration' }, 'Duración'));
    const meta = h('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: v?.target_value ?? '' });
    const unidad = h('input', { type: 'text', value: v?.unit ?? '', placeholder: 'g, ml, min…', maxLength: 20 });
    const bloqueMeta = h('div', { class: 'dos-col' },
      h('label', {}, 'Meta (se cumple con esta cantidad o más)', meta), h('label', {}, 'Unidad', unidad));
    bloqueMeta.hidden = (v?.kind ?? 'boolean') === 'boolean';

    const dias = new Set(v?.scheduled_days ?? [1, 2, 3, 4, 5, 6, 7]);
    const botonesDia = [1, 2, 3, 4, 5, 6, 7].map((d) => h('button', {
      type: 'button', class: 'dia-btn', title: DIAS_CORTOS[d], 'aria-label': DIAS_CORTOS[d],
      onClick: () => { dias.has(d) ? dias.delete(d) : dias.add(d); refrescarDias(); }
    }, DIAS_LETRA[d]));
    function refrescarDias() {
      botonesDia.forEach((b, i) => {
        b.classList.toggle('on', dias.has(i + 1));
        b.setAttribute('aria-pressed', String(dias.has(i + 1)));
      });
    }
    const preset = (lista) => () => { dias.clear(); lista.forEach((d) => dias.add(d)); refrescarDias(); };
    refrescarDias();

    const desde = h('input', { type: 'date', value: hoy() });
    const bloquear = h('input', { type: 'checkbox' });
    const boton = h('button', { class: 'btn', type: 'button' }, esEdicion ? 'Guardar cambios' : 'Crear hábito');

    boton.addEventListener('click', async () => {
      msg.textContent = '';
      const nom = nombre.value.trim();
      if (!nom) return mostrarError(new Error('Poné un nombre.'));
      if (dias.size === 0) return mostrarError(new Error('Elegí al menos un día.'));
      let objetivo = null, uni = null;
      if (tipo.value !== 'boolean') {
        objetivo = meta.valueAsNumber;
        if (!(objetivo > 0)) return mostrarError(new Error('La meta debe ser un número mayor que 0.'));
        uni = unidad.value.trim() || null;
      }
      const campos = { name: nom, kind: tipo.value, target_value: objetivo, unit: uni,
        scheduled_days: [...dias].sort((a, b) => a - b) };
      boton.disabled = true;
      try {
        if (!esEdicion) {
          await D.crearHabito({ ...campos, module: modulo.value, valid_from: desde.value || hoy(), locked: bloquear.checked });
        } else if (!tieneLogs) {
          await D.corregirHabito(v.id, campos);
        } else {
          if (!desde.value || desde.value <= v.valid_from) {
            throw new Error(`La nueva vigencia debe ser posterior al inicio de la versión actual (${v.valid_from}).`);
          }
          await D.nuevaVersion(v, campos, desde.value);
        }
        cerrarForm();
        await cargar();
      } catch (e) { mostrarError(e); } finally { boton.disabled = false; }
    });

    return h('div', { class: 'card form' },
      h('strong', {}, esEdicion ? 'Editar hábito' : 'Nuevo hábito'),
      esEdicion && tieneLogs
        ? h('p', { class: 'nota' }, 'Esta versión ya tiene registros: se creará una versión nueva desde la fecha elegida y el historial no cambia.')
        : null,
      h('label', {}, 'Módulo', modulo),
      h('label', {}, 'Nombre', nombre),
      h('label', {}, 'Tipo', tipo),
      bloqueMeta,
      h('div', {}, h('div', { class: 'nota' }, 'Días programados'),
        h('div', { class: 'dias' }, ...botonesDia),
        h('div', { class: 'acciones' },
          h('button', { class: 'link', type: 'button', onClick: preset([1, 2, 3, 4, 5, 6, 7]) }, 'Todos'),
          h('button', { class: 'link', type: 'button', onClick: preset([1, 2, 3, 4, 5]) }, 'Lun–Vie'),
          h('button', { class: 'link', type: 'button', onClick: preset([2, 3, 4, 5, 6]) }, 'Mar–Sáb'))),
      pedirDesde ? h('label', {}, esEdicion ? 'Nueva versión vigente desde' : 'Vigente desde', desde) : null,
      !esEdicion
        ? h('label', { class: 'check' }, bloquear, 'Bloquear (no se podrá modificar ni borrar desde la app)')
        : null,
      h('div', { class: 'acciones' }, boton,
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { cerrarForm(); pintar(); } }, 'Cancelar')));
  }

  function filaHabito(v, hoyStr) {
    const botones = [];
    if (v.locked) botones.push(h('span', { class: 'badge' }, '🔒 Bloqueado'));
    else {
      if (v.valid_to == null) {
        botones.push(
          h('button', { class: 'link', type: 'button', onClick: () => abrirEditar(v) }, 'Editar'),
          h('button', { class: 'link', type: 'button', onClick: () => {
            if (confirm(`¿Archivar «${v.name}»? Deja de aparecer en Hoy; el historial se conserva.`)) {
              ejecutar(() => D.cerrarHabito(v.id, v.valid_from > hoyStr ? v.valid_from : hoyStr));
            }
          } }, 'Archivar'));
      }
      botones.push(h('button', { class: 'link', type: 'button', onClick: () => {
        if (confirm(`¿Eliminar «${v.name}»? Solo es posible si no tiene registros.`)) ejecutar(() => D.eliminarHabito(v.id));
      } }, 'Eliminar'));
    }
    const vigencia = v.valid_from > hoyStr ? `Desde ${v.valid_from}` : v.valid_to ? `Hasta ${v.valid_to}` : '';
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, v.name),
        v.valid_from > hoyStr ? h('span', { class: 'badge' }, 'Programado') : null),
      h('div', { class: 'fila-meta' }, `${tipoTexto(v)} · ${diasTexto(v.scheduled_days)}`),
      vigencia ? h('div', { class: 'fila-meta' }, vigencia) : null,
      h('div', { class: 'acciones' }, ...botones));
  }

  function pintar() {
    const hoyStr = hoy();
    const activos = defs.filter((v) => v.valid_to == null || v.valid_to >= hoyStr).sort(orden);
    const historial = defs.filter((v) => v.valid_to != null && v.valid_to < hoyStr).sort(orden);

    const bloques = [];
    let actual = null;
    for (const v of activos) {
      if (v.module !== actual) { actual = v.module; bloques.push(h('h2', { class: 'grupo-titulo' }, NOMBRES_MODULO[actual])); }
      bloques.push(filaHabito(v, hoyStr));
    }
    if (!activos.length) bloques.push(h('div', { class: 'card' }, h('p', {}, 'Todavía no hay hábitos. Creá el primero con «Nuevo hábito».')));

    const hist = historial.length
      ? h('details', { class: 'card pad' },
          h('summary', {}, `Versiones anteriores y archivados (${historial.length})`),
          ...historial.map((v) => h('p', { class: 'fila-meta' },
            `${NOMBRES_MODULO[v.module]} · ${v.name} · ${tipoTexto(v)} · ${diasTexto(v.scheduled_days)} · ${v.valid_from} → ${v.valid_to}`)))
      : null;

    raiz.replaceChildren(
      msg,
      formAbierto ? formulario() : h('button', { class: 'btn', type: 'button', onClick: abrirNuevo }, '+ Nuevo hábito'),
      ...bloques, hist);
  }

  await cargar();
}
