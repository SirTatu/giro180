// Gym → pestaña "Importar": pegás texto, se muestra una vista previa EDITABLE y recién después se guarda.
import { h } from '../../core/dom.js';
import { parsearRutinas, planInicial, resolverImportacion, traducirError } from '../../core/gym.js';
import * as D from './datos.js';

const DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const numero = (el) => (el.value.trim() === '' ? null : Number(el.value));
const EJEMPLO = 'Lunes – Empuje\nPress plano con barra 4 x 6-8\nPress inclinado con mancuerna (o barra) 3 x 8-10\nAperturas en polea 3 x 12-15\n\nMartes – Tirón\nRemo en polea baja 4 x 8-10\nCurl con barra o Curl con mancuerna 3 x 10-12';

export function renderImportar(cont, ctx = {}) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const area = h('textarea', { rows: 10, placeholder: EJEMPLO, 'aria-label': 'Texto de las rutinas' });
  const zona = h('div');
  const botonAnalizar = h('button', { class: 'btn', type: 'button' }, 'Analizar texto');
  let plan = null, existentes = [], rutinasExist = [];
  let token = 0;

  function vistaPrevia() {
    const bloques = [];
    if (plan.errores.length) {
      bloques.push(h('details', { class: 'card pad', open: true },
        h('summary', {}, `Líneas que no se pudieron usar (${plan.errores.length})`),
        h('p', { class: 'nota' }, 'No se importan. Corregí el texto y analizá de nuevo, o cargalas a mano en «Rutinas».'),
        ...plan.errores.map((e) => h('p', { class: 'fila-meta' }, `${e.linea ? 'Línea ' + e.linea + ': ' : ''}«${e.texto}» → ${e.motivo}`))));
    }
    plan.rutinas.forEach((r) => bloques.push(tarjeta(r)));
    if (!plan.rutinas.length) bloques.push(h('div', { class: 'card' }, h('p', {}, 'No se encontró ninguna rutina con ejercicios en el texto.')));
    else bloques.push(h('div', { class: 'acciones' },
      h('button', { class: 'btn', type: 'button', onClick: guardar }, 'Importar lo tildado'),
      h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { plan = null; zona.replaceChildren(); } }, 'Descartar')));
    zona.replaceChildren(...bloques);
  }

  function tarjeta(r) {
    const incluir = h('input', { type: 'checkbox', checked: r.incluir, onChange: () => { r.incluir = incluir.checked; } });
    const nombre = h('input', { type: 'text', maxLength: 80, value: r.nombre, 'aria-label': 'Nombre de la rutina', onInput: () => { r.nombre = nombre.value; } });
    const dia = h('select', { value: r.weekday ?? '', 'aria-label': 'Día sugerido', onChange: () => { r.weekday = dia.value ? Number(dia.value) : null; } },
      h('option', { value: '' }, 'Sin día sugerido'), ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('option', { value: d }, DIA[d])));
    return h('div', { class: 'card form' },
      h('label', { class: 'check' }, incluir, 'Importar esta rutina'),
      h('label', {}, 'Nombre de la rutina', nombre), h('label', {}, 'Día sugerido', dia),
      ...r.items.map((it) => filaItem(r, it)));
  }

  function filaItem(r, it) {
    const nombre = h('input', { type: 'text', maxLength: 80, value: it.nombre, disabled: !!it.usarId, 'aria-label': 'Nombre del ejercicio', onInput: () => { it.nombre = nombre.value; } });
    const usar = h('select', { value: it.usarId, 'aria-label': 'Usar ejercicio existente',
      onChange: () => { it.usarId = usar.value; nombre.disabled = !!usar.value; } },
      h('option', { value: '' }, '— Crear ejercicio nuevo —'),
      ...existentes.map((e) => h('option', { value: e.id }, e.name + (e.archived ? ' (archivado)' : ''))));
    const campo = (clave, valor, etiqueta) => {
      const el = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: valor ?? '', onInput: () => { it[clave] = numero(el); } });
      return h('label', {}, etiqueta, el);
    };
    const nota = h('input', { type: 'text', maxLength: 200, value: it.nota ?? '', placeholder: 'Nota', 'aria-label': 'Nota', onInput: () => { it.nota = nota.value; } });
    return h('div', { class: 'fila' },
      h('label', {}, 'Ejercicio', nombre), h('label', {}, 'Unir con uno existente', usar),
      h('div', { class: 'tres-col' }, campo('series', it.series, 'Series'), campo('repsMin', it.repsMin, 'Reps mín.'), campo('repsMax', it.repsMax, 'Reps máx.')),
      h('label', {}, 'Nota', nota),
      it.hint ? h('p', { class: 'aviso' }, it.hint) : null,
      h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: () => {
        r.items = r.items.filter((x) => x !== it); vistaPrevia();
      } }, 'Quitar esta línea')));
  }

  async function analizar() {
    msg.textContent = ''; ok.textContent = '';
    const t = ++token;
    botonAnalizar.disabled = true;
    try {
      const [e, r] = await Promise.all([D.listarEjercicios(), D.listarRutinas()]);
      if (t !== token) return;
      existentes = e; rutinasExist = r;
      plan = planInicial(parsearRutinas(area.value), existentes);
      vistaPrevia();
    } catch (err) { if (t === token) msg.textContent = traducirError(err); }
    finally { botonAnalizar.disabled = false; }
  }

  async function guardar() {
    msg.textContent = ''; ok.textContent = '';
    const resuelto = resolverImportacion(plan, existentes, rutinasExist);
    if (resuelto.problemas.length) { msg.textContent = 'Revisá antes de importar: ' + resuelto.problemas.join(' · '); return; }
    const detalle = `Se crearán ${resuelto.rutinas.length} rutina(s) y ${resuelto.ejerciciosNuevos.length} ejercicio(s) nuevo(s). ¿Importar?`;
    if (!confirm(detalle)) return;
    try {
      const res = await D.importar(resuelto);
      plan = null; zona.replaceChildren(); area.value = '';
      ok.textContent = `Listo: ${res.rutinas} rutina(s) y ${res.ejercicios} ejercicio(s) nuevo(s) importados.`;
      zona.replaceChildren(h('button', { class: 'btn', type: 'button', onClick: () => ctx.irARutinas?.() }, 'Ver mis rutinas'));
    } catch (e) {
      const ya = e.guardadas?.length ? ` Ya se habían guardado: ${e.guardadas.join(', ')}. No las vuelvas a importar.` : '';
      msg.textContent = 'No se pudo importar: ' + traducirError(e) + ya;
    }
  }

  botonAnalizar.addEventListener('click', analizar);
  cont.append(
    h('div', { class: 'card form' },
      h('p', { class: 'nota' }, 'Pegá una rutina por bloque: una línea de título (con el día, por ejemplo «Martes – Pecho») y un ejercicio por línea con «series x repeticiones». Alternativas con «o» o «(o …)» quedan como nota. Nada se guarda hasta que revises la vista previa.'),
      area, h('div', { class: 'acciones' }, botonAnalizar)),
    msg, ok, zona);
  return Promise.resolve();
}
