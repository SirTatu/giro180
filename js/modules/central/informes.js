// Pestaña "Informes": textos en Markdown listos para copiar y pegar en los chats de ChatGPT.
// Los textos se arman en js/core/informes.js (lógica pura con pruebas); acá solo se muestran y se copian.
import { h } from '../../core/dom.js';
import { hoy, lunesDe, sumarDias, rango, etiquetaLarga, formatoFechaHora } from '../../core/fechas.js';
import { agruparPorSerie } from '../../core/estados.js';
import { calcularSemana, armarInformes, prioridadesAl, ESPECIALISTAS, MAX_LINEAS_GENERAL } from '../../core/informes.js';
import * as D from './datos.js';

const ddmm = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };

const NOMBRE_TIPO = {
  general: 'Informe general', diario: 'Registro diario', semanal: 'Resumen semanal',
  comparacion: 'Comparación semanal', areas: 'Indicadores por área'
};
const etiquetaTipo = (t) => {
  if (t.startsWith('nota_')) return 'Nota ' + (ESPECIALISTAS.find((e) => e.id === t.slice(5))?.nombre ?? t.slice(5));
  return NOMBRE_TIPO[t] ?? t;
};

// Copia al portapapeles. Si el navegador no deja, selecciona el texto para que lo copies a mano.
async function copiarTexto(texto, area) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* se prueba el método alternativo */ }
  try {
    area.focus(); area.select(); area.setSelectionRange(0, texto.length + 1);
    if (document.execCommand('copy')) return true;
  } catch { /* nada más que probar */ }
  return false;
}

// Caja de texto de solo lectura + botones. `onGuardar` y `onEliminar` son opcionales.
function panelTexto({ getTexto, onGuardar, onEliminar, avisoLineas = false }) {
  const area = h('textarea', { class: 'informe-area', readOnly: true, 'aria-label': 'Texto del informe' });
  const estado = h('span', { class: 'ok-msg' });
  const aviso = avisoLineas ? h('p', { class: 'nota' }) : null;

  const refrescar = () => {
    const t = getTexto();
    const n = t.split('\n').length;
    area.value = t;
    area.rows = Math.min(16, n + 1);
    estado.textContent = '';
    if (aviso) aviso.textContent = `${n} de ${MAX_LINEAS_GENERAL} líneas máximo.`;
  };

  const copiar = h('button', { class: 'btn btn-sm', type: 'button' }, 'Copiar');
  copiar.addEventListener('click', async () => {
    const ok = await copiarTexto(area.value, area);
    estado.textContent = ok ? 'Copiado ✓' : 'No se pudo copiar solo: el texto quedó seleccionado, copialo con el menú del teléfono.';
  });

  const acciones = h('div', { class: 'acciones' }, copiar);
  if (onGuardar) {
    const guardar = h('button', { class: 'btn btn-sec btn-sm', type: 'button' }, 'Guardar');
    guardar.addEventListener('click', async () => {
      guardar.disabled = true;
      estado.textContent = '';
      try { await onGuardar(area.value); estado.textContent = 'Guardado ✓'; }
      catch (e) { estado.textContent = 'No se pudo guardar: ' + (e?.message ?? e); }
      guardar.disabled = false;
    });
    acciones.append(guardar);
  }
  if (onEliminar) acciones.append(h('button', { class: 'link', type: 'button', onClick: onEliminar }, 'Eliminar'));
  acciones.append(estado);

  refrescar();
  return { el: h('div', {}, aviso, area, acciones), refrescar };
}

export function renderInformes(cont, ctx) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  const cajaGuardados = h('div');
  cont.append(msg, raiz, cajaGuardados);

  let lunes = lunesDe(hoy());
  let fecha = null;           // día del registro diario
  let espId = 'central';      // especialista de la nota
  let token = 0;

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };
  const cambiarSemana = (n) => { lunes = sumarDias(lunes, 7 * n); fecha = null; cargar(); };

  async function cargar() {
    const mio = ++token;
    msg.textContent = '';
    raiz.replaceChildren(h('p', { class: 'nota' }, 'Cargando…'));
    const desde = sumarDias(lunes, -7);
    const hasta = sumarDias(lunes, 6);
    try {
      const [defs, logs, entradas, prioridades, revision] = await Promise.all([
        D.listarHabitos(), D.logsEntre(desde, hasta), D.entradasEntre(desde, hasta),
        D.listarPrioridades(), D.leerRevision(lunes)
      ]);
      if (mio !== token) return;
      pintar({ series: agruparPorSerie(defs), logs, entradas, prioridades, revision });
    } catch (e) {
      if (mio !== token) return;
      mostrarError(new Error('No se pudieron cargar los datos: ' + (e?.message ?? e)));
      raiz.replaceChildren(h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: cargar }, 'Reintentar'));
    }
  }

  function pintar({ series, logs, entradas, prioridades, revision }) {
    const sem = calcularSemana({ series, logs, entradas, lunes, hoy: hoy() });
    const p = sem.periodo;
    const dias = rango(p.desde, p.hasta);
    if (!fecha || !dias.includes(fecha)) fecha = dias[dias.length - 1];
    const titulos = prioridadesAl(prioridades, p.hasta).map((x) => x.title);
    const textos = () => armarInformes({ sem, series, logs, entradas, fecha, especialista: espId, prioridades: titulos, revision });

    const guardarComo = (tipo, inicio, fin) => async (contenido) => {
      await D.guardarInforme({ report_type: tipo, period_start: inicio, period_end: fin, content: contenido });
      cargarGuardados();
    };

    const nav = h('div', { class: 'fecha-nav' },
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Semana anterior', onClick: () => cambiarSemana(-1) }, '‹'),
      h('div', {}, h('strong', {}, `${ddmm(p.desde)} al ${ddmm(p.domingo)}`),
        h('span', { class: 'badge' }, p.enCurso ? 'En curso' : 'Cerrada')),
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Semana siguiente',
        disabled: sumarDias(lunes, 7) > hoy(), onClick: () => cambiarSemana(1) }, '›'));

    // Una tarjeta desplegable por informe
    const tarjeta = (titulo, ayuda, panel, extra = null, abierta = false) =>
      h('details', { class: 'card pad', open: abierta }, h('summary', {}, titulo),
        h('p', { class: 'nota' }, ayuda), extra, panel.el);

    const general = panelTexto({ getTexto: () => textos().general, avisoLineas: true,
      onGuardar: guardarComo('general', p.desde, p.hasta) });

    const diario = panelTexto({ getTexto: () => textos().diario,
      onGuardar: (c) => guardarComo('diario', fecha, fecha)(c) });
    const selDia = h('select', { 'aria-label': 'Día del registro', value: fecha },
      ...dias.map((d) => h('option', { value: d }, etiquetaLarga(d))));
    selDia.addEventListener('change', () => { fecha = selDia.value; diario.refrescar(); });

    const semanal = panelTexto({ getTexto: () => textos().semanal, onGuardar: guardarComo('semanal', p.desde, p.hasta) });
    const comparacion = panelTexto({ getTexto: () => textos().comparacion, onGuardar: guardarComo('comparacion', p.desde, p.hasta) });
    const areas = panelTexto({ getTexto: () => textos().areas, onGuardar: guardarComo('areas', p.desde, p.hasta) });

    const nota = panelTexto({ getTexto: () => textos().especialista,
      onGuardar: (c) => guardarComo('nota_' + espId, p.desde, p.hasta)(c) });
    const selEsp = h('select', { 'aria-label': 'Especialista', value: espId },
      ...ESPECIALISTAS.map((e) => h('option', { value: e.id }, e.nombre)));
    selEsp.addEventListener('change', () => { espId = selEsp.value; nota.refrescar(); });

    raiz.replaceChildren(
      nav,
      h('p', { class: 'nota' }, 'Cada informe está en Markdown: copialo y pegalo en el chat del especialista. Un dato sin registrar figura como tal, nunca como incumplimiento.'),
      tarjeta('INFORME GENERAL', 'Para el chat Central. Resumen corto de la semana.', general, null, true),
      tarjeta('Registro diario consolidado', 'Lo registrado en un día, con ánimo, energía y notas.', diario, selDia),
      tarjeta('Resumen semanal', 'Totales de la semana, tu revisión y tus prioridades.', semanal),
      tarjeta('Comparación con la semana anterior', 'Cambios frente a la semana previa (en curso: mismos días).', comparacion),
      tarjeta('Indicadores por área', 'Cumplimiento de cada módulo y detalle por hábito.', areas),
      tarjeta('Nota para un especialista', 'Elegí el chat al que se lo vas a pegar.', nota, selEsp)
    );
  }

  async function cargarGuardados() {
    try {
      const lista = await D.listarInformes(20);
      cajaGuardados.replaceChildren(h('details', { class: 'card pad' },
        h('summary', {}, `Informes guardados (${lista.length})`),
        ...(lista.length ? lista.map((r) => {
          const periodo = r.period_start === r.period_end ? ddmm(r.period_start) : `${ddmm(r.period_start)} al ${ddmm(r.period_end)}`;
          const panel = panelTexto({
            getTexto: () => r.content,
            onEliminar: async () => {
              if (!confirm('¿Eliminar este informe guardado?')) return;
              try { await D.eliminarInforme(r.id); cargarGuardados(); } catch (e) { mostrarError(e); }
            }
          });
          return h('details', { class: 'fila' },
            h('summary', {}, `${etiquetaTipo(r.report_type)} · ${periodo} · guardado ${formatoFechaHora(r.created_at)}`), panel.el);
        }) : [h('p', { class: 'nota' }, 'Todavía no guardaste ninguno.')])));
    } catch (e) { cajaGuardados.replaceChildren(h('p', { class: 'nota' }, 'No se pudieron cargar los informes guardados: ' + (e?.message ?? e))); }
  }

  cargar();
  cargarGuardados();
}
