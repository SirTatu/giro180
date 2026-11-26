// Nutri → pestaña «Objetivos»: el objetivo diario de cada macro (calorías, carbohidratos, proteínas, grasas) como
// «al menos», «como máximo» o «entre un mínimo y un máximo». Por debajo cada objetivo es un hábito de cantidad del módulo
// Nutri, versionado como todos: cambiarlo no altera el historial. Las decisiones viven en js/core/macros.js.
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import { textoObjetivo } from '../../core/estados.js';
import { MACROS } from '../../core/alimentos.js';
import { TIPOS_OBJETIVO, buscarHabitoMacro, validarObjetivo, objetivoDeVersion, planObjetivo } from '../../core/macros.js';
import * as H from '../compartido/habitos.js';
import * as CD from '../central/datos.js';
import { cajaError } from './ui.js';

export function renderObjetivos(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let defs = [];
  let ocupado = false;

  async function cargar(mensajeOk = '') {
    const t = ++token;
    try {
      const d = await H.listarDefiniciones();
      if (t !== token) return;
      defs = d; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar()));
    }
  }

  async function ejecutar(plan) {
    if (plan.accion === 'crear' || plan.accion === 'reabrir_serie') await CD.crearHabito(plan.campos);
    else if (plan.accion === 'corregir') await CD.corregirHabito(plan.id, plan.campos);
    else if (plan.accion === 'nueva_version') await CD.nuevaVersion(plan.anterior, plan.campos, plan.desde);
    else if (plan.accion === 'cerrar') await CD.cerrarHabito(plan.id, plan.valid_to);
  }

  function tarjeta(m) {
    const f = hoy();
    const hab = buscarHabitoMacro(defs, f, m.id);
    const actual = hab.version;
    const previo = objetivoDeVersion(actual);

    const tipo = h('select', { 'aria-label': `Tipo de objetivo de ${m.nombre}`, value: previo.tipo },
      TIPOS_OBJETIVO.map((t) => h('option', { value: t.id }, t.nombre)));
    const minimo = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `Mínimo de ${m.nombre}`, placeholder: m.unidad, value: previo.minimo });
    const maximo = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `Máximo de ${m.nombre}`, placeholder: m.unidad, value: previo.maximo });
    const desde = h('input', { type: 'date', 'aria-label': `Vigente desde (${m.nombre})`, value: f });
    const lMin = h('label', {}, `Mínimo (${m.unidad})`, minimo);
    const lMax = h('label', {}, `Máximo (${m.unidad})`, maximo);
    const ajustar = () => { lMin.hidden = !['al_menos', 'entre'].includes(tipo.value); lMax.hidden = !['maximo', 'entre'].includes(tipo.value); };
    tipo.addEventListener('change', ajustar);
    ajustar();

    const guardar = h('button', { class: 'btn', type: 'button' }, 'Guardar objetivo');
    guardar.addEventListener('click', async () => {
      if (ocupado) return;
      const v = validarObjetivo({ macroId: m.id, tipo: tipo.value, minimo: minimo.value, maximo: maximo.value });
      if (v.error) { msg.textContent = v.error; ok.textContent = ''; return; }
      ocupado = true; msg.textContent = ''; ok.textContent = '';
      try {
        const vigente = hab.version;
        const tieneLogs = vigente ? (await CD.contarLogs(vigente.id)) > 0 : false;
        const plan = planObjetivo({ macroId: m.id, hab, tipo: tipo.value, datos: v.datos, desde: desde.value, hoyFecha: f, tieneLogs });
        if (plan.error) { msg.textContent = plan.error; return; }
        if (plan.accion === 'ninguna') { await cargar(plan.mensaje); return; }
        await ejecutar(plan);
        await cargar(plan.mensaje);
      } catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
    });

    const estado = hab.motivo === 'ambiguo'
      ? h('p', { class: 'error' }, `Hay más de un hábito de ${m.nombre.toLowerCase()} en Nutri. Dejá uno solo en Central → Hábitos para poder configurarlo acá.`)
      : h('p', {}, actual ? `Objetivo actual: ${textoObjetivo(actual)} (desde el ${actual.valid_from}).` : 'Sin objetivo: se muestra el total del día, pero no se mide contra nada.');
    return h('div', { class: 'card form' }, h('strong', {}, m.nombre), estado,
      ...(hab.motivo === 'ambiguo' ? [] : [
        h('label', {}, 'Tipo de objetivo', tipo), lMin, lMax, h('label', {}, 'Vigente desde', desde),
        h('p', { class: 'fila-meta' }, 'Si ya hay días registrados con el objetivo actual, el cambio rige desde esa fecha y el historial no se modifica.'),
        h('div', { class: 'acciones' }, guardar)]));
  }

  function pintar() {
    raiz.replaceChildren(
      h('div', { class: 'card pad' }, h('strong', {}, 'Objetivos diarios de macros'),
        h('p', { class: 'fila-meta' }, '«Al menos»: llegar al mínimo. «Como máximo»: no pasarte (por ejemplo, calorías). «Entre»: dentro de un rango. Pasarte del máximo marca el día como «excedido»: se muestra aparte y no cuenta como no cumplido.'),
        h('p', { class: 'fila-meta' }, 'Por debajo del mínimo, el día queda «sin completar»: nunca se marca incumplido solo. En «como máximo», el día se marca cumplido recién cuando lo cerrás en Hoy.')),
      ...MACROS.map(tarjeta), msg, ok);
  }

  cont.append(raiz);
  return cargar();
}
