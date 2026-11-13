// Pestaña "Hoy": registro diario rápido.
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga } from '../../core/fechas.js';
import { NOMBRES_MODULO, ORDEN_MODULOS } from '../../core/constantes.js';
import { agruparPorSerie, estadoDia, evaluar, logsDeSerie, ESTADO } from '../../core/estados.js';
import * as D from './datos.js';

const TEXTO_ESTADO = { cumplido: 'Cumplido', incumplido: 'Incumplido', no_registrado: 'Sin registrar' };
const textoMeta = (v) =>
  v && v.kind !== 'boolean' ? `Meta: ${v.target_value} ${v.unit ?? ''} o más`.replace('  ', ' ') : '';

export async function renderHoy(cont, ctx) {
  const userId = ctx.session.user.id;
  const msg = h('p', { class: 'error', role: 'alert' });
  const raiz = h('div');
  const listaEl = h('div');
  cont.append(raiz);

  let fecha = hoy();
  let series = new Map();
  let logs = [];
  let entrada = null;

  const mostrarError = (e) => { msg.textContent = e?.message ?? String(e); };

  async function accion(fn) {
    msg.textContent = '';
    try { await fn(); } catch (e) { mostrarError(e); }
    pintarLista();
  }

  const guardarEnMemoria = (g) => {
    logs = logs.filter((x) => x.id !== g.id && !(x.habit_id === g.habit_id && x.log_date === g.log_date));
    logs.push(g);
  };

  const marcar = (version, status) => accion(async () => {
    guardarEnMemoria(await D.guardarLog({ habit_id: version.id, log_date: fecha, status, value: null }));
  });

  const guardarValor = (version, campo) => accion(async () => {
    const valor = campo.valueAsNumber;
    if (Number.isNaN(valor) || valor < 0) throw new Error('Ingresá un número válido (0 o más).');
    guardarEnMemoria(await D.guardarLog({
      habit_id: version.id, log_date: fecha, status: evaluar(version, valor), value: valor
    }));
  });

  const quitar = (log) => accion(async () => {
    await D.borrarLog(log.id);
    logs = logs.filter((x) => x.id !== log.id);
  });

  function fila({ estado, version, log, ref, extra }) {
    const acciones = h('div', { class: 'acciones' });
    if (version && !extra) {
      if (version.kind === 'boolean') {
        acciones.append(
          h('button', { class: 'btn-estado cumplido' + (estado === ESTADO.CUMPLIDO ? ' on' : ''), type: 'button',
            onClick: () => marcar(version, 'done') }, '✓ Cumplido'),
          h('button', { class: 'btn-estado incumplido' + (estado === ESTADO.INCUMPLIDO ? ' on' : ''), type: 'button',
            onClick: () => marcar(version, 'missed') }, '✗ No cumplido')
        );
      } else {
        const campo = h('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal',
          value: log?.value ?? '', placeholder: ref.unit ?? '', 'aria-label': 'Valor de ' + ref.name });
        acciones.append(campo,
          h('button', { class: 'btn btn-sm', type: 'button', onClick: () => guardarValor(version, campo) }, 'Guardar'));
      }
    }
    if (log) acciones.append(h('button', { class: 'link', type: 'button', onClick: () => quitar(log) }, 'Quitar registro'));

    const meta = textoMeta(ref);
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' },
        h('div', {}, h('div', { class: 'fila-nombre' }, ref.name), meta ? h('div', { class: 'fila-meta' }, meta) : null),
        h('span', { class: 'badge ' + estado }, TEXTO_ESTADO[estado] + (extra ? ' (extra)' : ''))),
      acciones);
  }

  function pintarLista() {
    const items = [];
    let sinProgramar = 0;
    for (const versiones of series.values()) {
      const r = estadoDia(versiones, logsDeSerie(versiones, logs), fecha);
      if (r.estado === ESTADO.SIN_ACTIVIDAD) { if (r.version) sinProgramar++; continue; }
      const ref = r.version ?? versiones.find((v) => v.id === r.log?.habit_id) ?? versiones[0];
      items.push({ ...r, ref });
    }
    items.sort((a, b) =>
      ORDEN_MODULOS.indexOf(a.ref.module) - ORDEN_MODULOS.indexOf(b.ref.module) || a.ref.name.localeCompare(b.ref.name));

    const bloques = [];
    let actual = null;
    for (const it of items) {
      if (it.ref.module !== actual) {
        actual = it.ref.module;
        bloques.push(h('h2', { class: 'grupo-titulo' }, NOMBRES_MODULO[actual]));
      }
      bloques.push(fila(it));
    }
    if (!items.length) {
      bloques.push(h('div', { class: 'card' },
        h('p', {}, 'No hay hábitos programados para este día. Creá hábitos en la pestaña «Hábitos».')));
    } else if (sinProgramar) {
      bloques.push(h('p', { class: 'nota' }, `${sinProgramar} hábito(s) sin actividad programada este día.`));
    }
    listaEl.replaceChildren(...bloques);
  }

  function tarjetaDia() {
    const opciones = () => ['', '1', '2', '3', '4', '5'].map((n) => h('option', { value: n }, n || '—'));
    const animo = h('select', { value: entrada?.mood != null ? String(entrada.mood) : '' }, ...opciones());
    const energia = h('select', { value: entrada?.energy != null ? String(entrada.energy) : '' }, ...opciones());
    const notas = h('textarea', { rows: 3, placeholder: 'Notas del día (opcional)', value: entrada?.notes ?? '' });
    const estado = h('span', { class: 'ok-msg' });
    const guardar = h('button', { class: 'btn btn-sm', type: 'button', onClick: async () => {
      msg.textContent = ''; estado.textContent = '';
      try {
        entrada = await D.guardarEntrada({
          user_id: userId, entry_date: fecha,
          mood: animo.value ? Number(animo.value) : null,
          energy: energia.value ? Number(energia.value) : null,
          notes: notas.value.trim() || null
        });
        estado.textContent = 'Guardado ✓';
      } catch (e) { mostrarError(e); }
    } }, 'Guardar día');
    return h('div', { class: 'card form' },
      h('strong', {}, 'Registro del día'),
      h('div', { class: 'dos-col' },
        h('label', {}, 'Ánimo (1-5)', animo), h('label', {}, 'Energía (1-5)', energia)),
      notas,
      h('div', { class: 'acciones' }, guardar, estado));
  }

  function armarDia() {
    const esHoy = fecha === hoy();
    const cambiar = (n) => { fecha = sumarDias(fecha, n); cargarDia(); };
    const nav = h('div', { class: 'fecha-nav' },
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Día anterior', onClick: () => cambiar(-1) }, '‹'),
      h('div', {}, h('strong', {}, etiquetaLarga(fecha)), esHoy ? h('span', { class: 'badge' }, 'Hoy') : null),
      h('button', { class: 'btn btn-sec btn-ico', type: 'button', 'aria-label': 'Día siguiente',
        disabled: fecha >= hoy(), onClick: () => cambiar(1) }, '›'));
    raiz.replaceChildren(msg, nav, listaEl, tarjetaDia());
    pintarLista();
  }

  async function cargarDia() {
    msg.textContent = '';
    try {
      [logs, entrada] = await Promise.all([D.logsEntre(fecha, fecha), D.leerEntrada(fecha)]);
      armarDia();
    } catch (e) { raiz.replaceChildren(msg); mostrarError(e); }
  }

  try { series = agruparPorSerie(await D.listarHabitos()); }
  catch (e) { raiz.append(msg); mostrarError(e); return; }
  await cargarDia();
}
