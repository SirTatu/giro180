// Vida → pestaña «Avisos» (hito 4-1b): PRUEBA DE VIABILIDAD de las notificaciones en el celular. Muestra un diagnóstico, deja
// pedir el permiso, mostrar un aviso de prueba (ahora o con 20 segundos de espera para bloquear el celular) y lista los toques
// que el service worker guardó con la hora exacta. La lógica pura está en js/core/avisos.js.
import { h } from '../../core/dom.js';
import { traducirError } from '../../core/gym.js';
import { horaSegundos } from '../../core/sueno.js';
import { diagnosticar, puedePedirPermiso, armarAvisoPrueba, resumenToques, ESPERA_PRUEBA_SEG } from '../../core/avisos.js';
import * as T from './toques.js';
import { cajaError } from '../gym/ui.js';

const ahoraISO = () => new Date().toISOString();
const ETIQUETA_ESTADO = { ok: '✓ Bien', mal: '✗ Falta', aviso: '! Atención' };
let detener = null;                                        // quita el oyente de mensajes de la pantalla anterior

async function leerEntorno() {
  const ua = globalThis.navigator?.userAgent ?? '';
  const tieneSW = !!globalThis.navigator && 'serviceWorker' in globalThis.navigator;
  const reg = tieneSW ? await globalThis.navigator.serviceWorker.getRegistration().catch(() => null) : null;
  const notif = 'Notification' in globalThis;
  return {
    esIOS: /iPad|iPhone|iPod/.test(ua) || (globalThis.navigator?.platform === 'MacIntel' && (globalThis.navigator?.maxTouchPoints ?? 0) > 1),
    instalada: globalThis.navigator?.standalone === true || !!globalThis.matchMedia?.('(display-mode: standalone)')?.matches,
    tieneSW, swActivo: !!reg?.active, tieneNotification: notif, permiso: notif ? globalThis.Notification.permission : null,
    tienePush: 'PushManager' in globalThis
  };
}

export function renderAvisos(cont) {
  if (detener) detener();
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg', role: 'status' });
  const raiz = h('div');
  let token = 0;
  let datos = null;                                         // { entorno, toques, errorToques, deLaDireccion }
  let temporizador = null;
  let ocupado = false;

  async function cargar(mensajeOk = '') {
    const t = ++token;
    try {
      let errorToques = '', toques = [];
      try { toques = await T.leerToques(); } catch (e) { errorToques = traducirError(e); }
      const entorno = await leerEntorno();
      if (t !== token) return;
      datos = { entorno, toques, errorToques, deLaDireccion: datos?.deLaDireccion ?? null };
      msg.textContent = ''; ok.textContent = mensajeOk;
      pintar();
    } catch (err) {
      if (t !== token) return;
      raiz.replaceChildren(cajaError(err, () => cargar()));
    }
  }

  async function accion(operacion, textoOk) {
    if (ocupado) return;
    ocupado = true; msg.textContent = ''; ok.textContent = '';
    try { const r = await operacion(); await cargar(typeof textoOk === 'function' ? textoOk(r) : textoOk); }
    catch (e) { msg.textContent = traducirError(e); } finally { ocupado = false; }
  }

  const permitir = () => accion(async () => {
    if (!('Notification' in globalThis)) throw new Error('Este navegador no ofrece notificaciones.');
    return globalThis.Notification.requestPermission();
  }, (r) => (r === 'granted' ? 'Permiso concedido.' : r === 'denied' ? 'El permiso quedó bloqueado. Se cambia en los ajustes del dispositivo.' : 'No elegiste una opción: el permiso sigue pendiente.'));

  async function mostrar(programadaISO) {
    const reg = await globalThis.navigator.serviceWorker.getRegistration();
    if (!reg?.active) throw new Error('El Service Worker todavía no está activo: cerrá la app del todo y volvé a abrirla.');
    const mostrada = ahoraISO();
    const a = armarAvisoPrueba({ programadaISO: programadaISO ?? mostrada, mostradaISO: mostrada });
    await reg.showNotification(a.titulo, a.opciones);
    return mostrada;
  }

  const probarAhora = () => accion(() => mostrar(null), (m) => `Aviso enviado a las ${horaSegundos(m)}. Mirá si apareció y tocalo.`);

  function probarConEspera() {
    if (ocupado) return;
    if (temporizador) clearTimeout(temporizador);
    const programada = ahoraISO();
    temporizador = setTimeout(() => {
      temporizador = null;
      mostrar(programada).then((m) => { ok.textContent = `El aviso se mostró a las ${horaSegundos(m)}.`; }, (e) => { msg.textContent = traducirError(e); });
    }, ESPERA_PRUEBA_SEG * 1000);
    msg.textContent = '';
    ok.textContent = `Programado a las ${horaSegundos(programada)}: va a salir en ${ESPERA_PRUEBA_SEG} segundos. Ahora bloqueá el celular y esperá un minuto.`;
  }

  const borrar = () => accion(() => T.borrarToques(), 'Lista de toques borrada.');

  function pintar() {
    const e = datos.entorno;
    const d = diagnosticar(e);
    const lineas = resumenToques(datos.toques, ahoraISO());
    const botones = [];
    if (puedePedirPermiso(e)) botones.push(h('button', { class: 'btn', type: 'button', onClick: permitir }, 'Permitir avisos'));
    if (d.veredicto.listo) {
      botones.push(h('button', { class: 'btn', type: 'button', onClick: probarAhora }, 'Mostrar aviso de prueba ahora'));
      botones.push(h('button', { class: 'btn btn-sec', type: 'button', onClick: probarConEspera }, `Aviso en ${ESPERA_PRUEBA_SEG} segundos (para probar con el celular bloqueado)`));
    }
    raiz.replaceChildren(
      h('div', { class: 'card pad' }, h('strong', {}, 'Avisos (prueba)'),
        h('p', { class: 'fila-meta' }, 'Esta pantalla sirve para comprobar que tu celular puede mostrar avisos y registrar la hora exacta en que los tocás. Todavía no cambia nada del sueño.'),
        h('p', {}, d.veredicto.texto),
        h('div', { class: 'acciones' }, ...botones,
          h('button', { class: 'btn btn-sec', type: 'button', onClick: () => cargar() }, 'Actualizar'))),
      msg, ok,
      h('h2', { class: 'grupo-titulo' }, 'Diagnóstico'),
      ...d.filas.map((f) => h('div', { class: 'fila' },
        h('div', { class: 'fila-top' }, h('div', { class: 'fila-nombre' }, f.titulo), h('span', { class: 'badge' }, ETIQUETA_ESTADO[f.estado])),
        h('div', { class: 'fila-meta' }, f.detalle))),
      h('h2', { class: 'grupo-titulo' }, 'Toques recibidos'),
      ...(datos.errorToques ? [h('p', { class: 'error' }, `No se pudo leer la lista: ${datos.errorToques}`)] : []),
      ...(datos.deLaDireccion ? [h('p', {}, `Toque recibido por la dirección: ${horaSegundos(datos.deLaDireccion)} (la base local falló al guardarlo).`)] : []),
      ...(lineas.length ? lineas.map((l) => h('div', { class: 'fila-meta' }, l)) : [h('p', { class: 'fila-meta' }, 'Todavía no hay toques guardados.')]),
      ...(lineas.length ? [h('div', { class: 'acciones' }, h('button', { class: 'link', type: 'button', onClick: borrar }, 'Borrar la lista'))] : []),
      h('h2', { class: 'grupo-titulo' }, 'Qué probar'),
      h('div', { class: 'fila-meta' }, '1) Permití los avisos. 2) Mostrá el aviso de prueba y, sin abrir nada, mirá si aparece. 3) Salí de la app, bloqueá el celular y tocá el aviso desde la pantalla de bloqueo: tiene que abrir la app y esta lista tiene que mostrar la hora del toque. 4) Repetí con la app cerrada del todo (deslizala fuera de las apps abiertas). 5) Probá el aviso con 20 segundos de espera y bloqueá el celular: si llega a tiempo, el celular permite avisos con la app en segundo plano; si llega tarde (o recién al volver a abrirla), no. 6) Antes de dormir mostrá un aviso y dejalo sin tocar: a la mañana mirá si sigue en el Centro de notificaciones.'));
  }

  const aviso = (ev) => {
    if (raiz.isConnected === false) { detener?.(); return; }          // la pantalla ya no está: dejar de escuchar
    if (ev?.data?.tipo === 'toque-aviso') cargar(`Toque recibido a las ${horaSegundos(ev.data.iso)}.`);
  };
  globalThis.navigator?.serviceWorker?.addEventListener?.('message', aviso);
  detener = () => { globalThis.navigator?.serviceWorker?.removeEventListener?.('message', aviso); if (temporizador) clearTimeout(temporizador); detener = null; };

  cont.append(raiz);
  const desdeUrl = T.toqueDeLaDireccion();
  datos = { entorno: null, toques: [], errorToques: '', deLaDireccion: desdeUrl };
  return cargar();
}
