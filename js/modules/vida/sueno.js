// Vida → pestaña «Sueño»: tocá «Me acuesto» y «Me levanté» (se guarda la hora de tu dispositivo), con varios registros por día
// (noche + siestas), corrección a mano y resumen del día. Las reglas viven en js/core/sueno.js; acá solo se dibuja y se guarda.
// Todas las horas están en hora de Argentina. Un registro cuenta para el día en que TERMINÓ; un día sin registros es «sin dato».
import { h } from '../../core/dom.js';
import { hoy, sumarDias, etiquetaLarga, formatoFechaHora } from '../../core/fechas.js';
import { traducirError } from '../../core/gym.js';
import {
  ETIQUETA_TIPO, ACCION_INICIO, ACCION_FIN, MAX_NOTA, decidirInicio, decidirFin, validarSesion, formularioDeSesion,
  localAInstante, fechaDeInstante, horaTexto, limitesDelDia, formatoDuracion, duracionMin, resumenDia
} from '../../core/sueno.js';
import * as D from './datos.js';
import { cajaError } from '../gym/ui.js';

const ahoraISO = () => new Date().toISOString();
const masUnDia = (iso) => new Date(Date.parse(iso) + 86400000).toISOString();

export function renderSueno(cont) {
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let fecha = hoy();
  let datos = null;                                       // { abierta, delDia }
  let ocupado = false;                                    // evita registros duplicados por doble toque
  let formulario = null;                                  // null = cerrado · { id, abierta, valores } = cargando o corrigiendo a mano

  const leer = async (f) => {
    const { desde, hasta } = limitesDelDia(f);
    const [abierta, delDia] = await Promise.all([D.sesionEnCurso(), D.sesionesQueTerminaronEntre(desde, hasta)]);
    return { abierta, delDia };
  };

  async function cargar(f = fecha, mensajeOk = '') {
    const t = ++token;
    try {
      const d = await leer(f);
      if (t !== token) return;
      fecha = f; datos = d; msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar(f)));
    }
  }

  // Ejecuta una escritura de a una por vez; textoOk y fechaDestino pueden ser texto o funciones del resultado.
  async function cambiar(operacion, textoOk, fechaDestino) {
    if (ocupado) return false;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try {
      const r = await operacion();
      await cargar(typeof fechaDestino === 'function' ? fechaDestino(r) : (fechaDestino ?? fecha), typeof textoOk === 'function' ? textoOk(r) : textoOk);
      return true;
    } catch (e) { msg.textContent = traducirError(e); return false; } finally { ocupado = false; }
  }

  const avisar = (texto) => { msg.textContent = texto; ok.textContent = ''; };

  function empezar(tipo) {
    if (ocupado) return undefined;
    const dec = decidirInicio({ tipo, ahora: ahoraISO(), sesiones: datos.abierta ? [datos.abierta] : [] });
    if (dec.error) return avisar(dec.error);
    return cambiar(() => D.crearSesion(dec.datos),
      `Registrado: ${tipo === 'night' ? 'te acostaste' : 'empezaste la siesta'} a las ${horaTexto(dec.datos.started_at)}.`, hoy());
  }

  function terminar() {
    if (ocupado) return undefined;
    const s = datos.abierta;
    const dec = decidirFin({ sesion: s, ahora: ahoraISO() });
    if (dec.error) return avisar(dec.error);
    return cambiar(() => D.cerrarSesion(s.id, dec.datos.ended_at),
      `Registrado: ${s.kind === 'night' ? 'dormiste' : 'la siesta duró'} ${formatoDuracion(dec.minutos)}.`, fechaDeInstante(dec.datos.ended_at));
  }

  function abrirFormulario(s = null) {
    formulario = s
      ? { id: s.id, abierta: !s.ended_at, valores: formularioDeSesion(s) }
      : { id: null, abierta: false, valores: { tipo: 'night', inicio: '', fin: '', nota: '' } };
    msg.textContent = ''; ok.textContent = '';
    pintar();
  }

  async function borrar(s, pregunta, textoOk) {
    if (!confirm(pregunta)) return;
    await cambiar(() => D.borrarSesion(s.id), textoOk);
  }

  // ---------- piezas ----------
  function tarjetaAhora() {
    const a = datos.abierta;
    if (!a) {
      return h('div', { class: 'card pad' }, h('strong', {}, 'Sueño'),
        h('p', { class: 'fila-meta' }, 'No hay ningún registro en curso. Tocá cuando te acuestes: se guarda la hora de tu dispositivo.'),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn', type: 'button', onClick: () => empezar('night') }, ACCION_INICIO.night),
          h('button', { class: 'btn btn-sec', type: 'button', onClick: () => empezar('nap') }, ACCION_INICIO.nap)));
    }
    const min = duracionMin(a, ahoraISO());
    return h('div', { class: 'card pad' }, h('strong', {}, a.kind === 'night' ? 'Durmiendo' : 'Siesta en curso'),
      h('p', {}, `Desde ${formatoFechaHora(a.started_at)}${min !== null && min >= 0 ? ` (hace ${formatoDuracion(min)})` : ''}.`),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn', type: 'button', onClick: terminar }, ACCION_FIN[a.kind]),
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => abrirFormulario(a) }, 'Corregir'),
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => borrar(a, '¿Descartar el registro en curso? Se borra y no queda nada guardado.', 'Registro descartado.') }, 'Descartar')));
  }

  function tarjetaFormulario() {
    const f = formulario;
    const tipo = h('select', { 'aria-label': 'Tipo', value: f.valores.tipo }, h('option', { value: 'night' }, ETIQUETA_TIPO.night), h('option', { value: 'nap' }, ETIQUETA_TIPO.nap));
    const inicio = h('input', { type: 'datetime-local', value: f.valores.inicio, 'aria-label': 'Hora de inicio' });
    const fin = h('input', { type: 'datetime-local', value: f.valores.fin, 'aria-label': 'Hora de fin' });
    const nota = h('input', { type: 'text', value: f.valores.nota, maxlength: MAX_NOTA, placeholder: 'Opcional', 'aria-label': 'Nota' });
    const guardar = h('button', { class: 'btn', type: 'button' }, f.id ? 'Guardar cambios' : 'Guardar registro');
    guardar.addEventListener('click', () => cambiar(async () => {
      const ahora = ahoraISO();
      const valores = { tipo: tipo.value, inicio: inicio.value, fin: fin.value, nota: nota.value };
      const ini = localAInstante(valores.inicio), fn = localAInstante(valores.fin);
      const otras = ini ? await D.sesionesCercanas(ini, masUnDia(fn ?? ahora)) : [];      // para avisar si se superpone con otro registro
      const v = validarSesion(valores, { ahora, otras, permitirAbierta: f.abierta, idActual: f.id });
      if (v.error) throw new Error(v.error);
      const guardado = f.id ? await D.actualizarSesion(f.id, v.datos) : await D.crearSesion(v.datos);
      formulario = null;
      return guardado;
    }, f.id ? 'Cambios guardados.' : 'Registro guardado.', (r) => (r.ended_at ? fechaDeInstante(r.ended_at) : fecha)));
    return h('div', { class: 'card form' }, h('strong', {}, f.id ? 'Corregir registro' : 'Cargar a mano'),
      h('label', {}, 'Tipo', tipo),
      h('label', {}, 'Me acosté (hora de Argentina)', inicio),
      h('label', {}, f.abierta ? 'Me levanté (dejalo vacío si sigue en curso)' : 'Me levanté', fin),
      h('label', {}, 'Nota', nota),
      h('div', { class: 'acciones' }, guardar,
        h('button', { class: 'btn btn-sec', type: 'button', onClick: () => { formulario = null; msg.textContent = ''; pintar(); } }, 'Cancelar')));
  }

  const metrica = (etiqueta, min) => h('div', { class: 'metrica' }, h('b', {}, min == null ? '—' : formatoDuracion(min)), h('span', {}, etiqueta));

  function tarjetaDia() {
    const r = resumenDia(datos.delDia, fecha);
    const inputFecha = h('input', { type: 'date', value: fecha, 'aria-label': 'Fecha',
      onChange: () => { if (inputFecha.value) cargar(inputFecha.value); else inputFecha.value = fecha; } });
    return h('div', { class: 'card form' },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día anterior', onClick: () => cargar(sumarDias(fecha, -1)) }, '‹'),
        h('strong', {}, etiquetaLarga(fecha)),
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', 'aria-label': 'Día siguiente', onClick: () => cargar(sumarDias(fecha, 1)) }, '›')),
      h('label', {}, 'Fecha', inputFecha),
      h('div', { class: 'metricas compactas' }, metrica('Noche', r.noche_min), metrica('Siestas', r.siesta_min), metrica('Total', r.total_min)),
      h('p', { class: 'fila-meta' }, r.cantidad
        ? 'Cuenta lo que terminó este día (la noche de ayer a hoy cuenta para hoy).'
        : 'Sin sueño registrado este día. «—» significa sin dato, no cero horas.'));
  }

  function filaSesion(s) {
    return h('div', { class: 'fila' },
      h('div', { class: 'fila-top' },
        h('div', { class: 'fila-nombre' }, `${formatoFechaHora(s.started_at)} → ${horaTexto(s.ended_at)}`),
        h('span', { class: 'badge' }, ETIQUETA_TIPO[s.kind] ?? s.kind)),
      h('div', { class: 'fila-meta' }, formatoDuracion(duracionMin(s)) + (s.note ? ` · ${s.note}` : '')),
      h('div', { class: 'acciones' },
        h('button', { class: 'link', type: 'button', onClick: () => abrirFormulario(s) }, 'Corregir'),
        h('button', { class: 'link', type: 'button', onClick: () => borrar(s, '¿Borrar este registro de sueño?', 'Registro borrado.') }, 'Borrar')));
  }

  function pintar() {
    const lista = resumenDia(datos.delDia, fecha).sesiones;
    raiz.replaceChildren(
      tarjetaAhora(), msg, ok,
      formulario ? tarjetaFormulario()
        : h('div', { class: 'acciones' }, h('button', { class: 'btn btn-sec', type: 'button', onClick: () => abrirFormulario() }, 'Cargar a mano')),
      tarjetaDia(),
      h('h2', { class: 'grupo-titulo' }, 'Registros del día'),
      ...(lista.length ? lista.map(filaSesion) : [h('p', { class: 'fila-meta' }, 'No hay registros que terminen este día.')]));
  }

  cont.append(raiz);
  return cargar();
}
