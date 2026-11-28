// Lógica pura de los AVISOS (notificaciones) de Vida y Estudio (hito 4-1b: prueba de viabilidad en el celular). Sin pantalla.
// Pruebas en tests/avisos.test.mjs. Qué resuelve:
// - diagnosticar: con los datos que lee la pantalla (¿app instalada?, ¿permiso?, ¿service worker?) arma la lista de chequeos y
//   un veredicto claro de si ya se puede mostrar un aviso.
// - armarAvisoPrueba: título y opciones del aviso de prueba.
// - resumenToques: texto de los toques que el service worker guardó (la hora se captura en el instante del toque).
// DB_AVISOS es el nombre de la base local (IndexedDB) donde sw.js guarda los toques; sw.js repite estos valores y una prueba
// verifica que coincidan.
import { formatoDuracion, horaSegundos } from './sueno.js';

export const DB_AVISOS = { nombre: 'giro180-avisos', version: 1, almacen: 'toques' };
export const TAG_PRUEBA = 'giro180-prueba';
export const URL_AVISOS = './#/vida/avisos';
export const ESPERA_PRUEBA_SEG = 20;

// ---------- diagnóstico ----------
// e: { esIOS, instalada, tieneSW, swActivo, tieneNotification, permiso ('default'|'granted'|'denied'|null), tienePush }
export function diagnosticar(e) {
  const filas = [];
  const fila = (id, titulo, estado, detalle) => filas.push({ id, titulo, estado, detalle });   // estado: ok | mal | aviso

  if (e.instalada) fila('instalada', 'App instalada', 'ok', 'Estás usando la app desde la pantalla de inicio.');
  else if (e.esIOS) fila('instalada', 'App instalada', 'mal', 'Estás en Safari. En iPhone las notificaciones solo funcionan con la app instalada: abrila desde su ícono en la pantalla de inicio (si no está, Compartir → Añadir a pantalla de inicio).');
  else fila('instalada', 'App instalada', 'aviso', 'Estás en un navegador. En el celular conviene instalarla, pero acá se puede probar igual.');

  if (!e.tieneSW) fila('sw', 'Service Worker', 'mal', 'Este navegador no lo ofrece.');
  else if (!e.swActivo) fila('sw', 'Service Worker', 'aviso', 'Todavía no está activo. Cerrá la app del todo y volvé a abrirla.');
  else fila('sw', 'Service Worker', 'ok', 'Activo: puede recibir el toque sobre un aviso.');

  if (!e.tieneNotification) fila('notif', 'Notificaciones', 'mal', 'Este navegador no ofrece notificaciones.');
  else fila('notif', 'Notificaciones', 'ok', 'Disponibles.');

  if (!e.tieneNotification) fila('permiso', 'Permiso', 'mal', 'Sin notificaciones no hay permiso para pedir.');
  else if (e.permiso === 'granted') fila('permiso', 'Permiso', 'ok', 'Concedido.');
  else if (e.permiso === 'denied') fila('permiso', 'Permiso', 'mal', 'Bloqueado. Se cambia en Ajustes del iPhone → Notificaciones → Giro 180 (o en los ajustes del navegador).');
  else fila('permiso', 'Permiso', 'aviso', 'Todavía no lo diste: tocá «Permitir avisos».');

  fila('push', 'Avisos con la app cerrada (push)', e.tienePush ? 'ok' : 'aviso',
    e.tienePush ? 'Disponible en este dispositivo. Hace falta un servidor propio para usarlo (hito 4-6b).' : 'No disponible. Los avisos con el celular bloqueado no van a ser posibles.');

  return { filas, veredicto: veredicto(e) };
}

function veredicto(e) {
  if (!e.tieneNotification) return { listo: false, codigo: 'sin-notificaciones', texto: 'Este navegador no ofrece notificaciones.' };
  if (e.esIOS && !e.instalada) return { listo: false, codigo: 'sin-instalar', texto: 'Falta abrir la app desde el ícono de la pantalla de inicio.' };
  if (!e.tieneSW || !e.swActivo) return { listo: false, codigo: 'sin-sw', texto: 'Falta que el Service Worker esté activo: cerrá la app del todo y volvé a abrirla.' };
  if (e.permiso === 'denied') return { listo: false, codigo: 'bloqueado', texto: 'El permiso está bloqueado: cambialo en los ajustes del dispositivo.' };
  if (e.permiso !== 'granted') return { listo: false, codigo: 'falta-permiso', texto: 'Falta dar permiso: tocá «Permitir avisos».' };
  return { listo: true, codigo: 'listo', texto: 'Todo listo: ya podés mostrar un aviso de prueba.' };
}

// Solo se puede pedir el permiso si todavía no se eligió, hay notificaciones y (en iPhone) la app está instalada.
export const puedePedirPermiso = (e) => !!e.tieneNotification && e.permiso === 'default' && (!!e.instalada || !e.esIOS);

// ---------- aviso de prueba ----------
const msDe = (iso) => { const n = Date.parse(iso); return Number.isNaN(n) ? null : n; };

// programada = cuándo se pidió el aviso; mostrada = cuándo se mostró de verdad. Si el celular suspendió la app, mostrada llega tarde.
export function textoRetraso(programadaISO, mostradaISO) {
  const a = msDe(programadaISO), b = msDe(mostradaISO);
  if (a === null || b === null) return '';
  const seg = Math.round((b - a) / 1000);
  if (seg < 5) return '';
  return seg < 60 ? `${seg} s` : formatoDuracion(Math.round(seg / 60));
}

export function armarAvisoPrueba({ programadaISO, mostradaISO }) {
  const tarde = textoRetraso(programadaISO, mostradaISO);
  const pedido = horaSegundos(programadaISO), mostrado = horaSegundos(mostradaISO);
  const cuerpo = tarde
    ? `Pedido a las ${pedido}, mostrado a las ${mostrado} (llegó ${tarde} tarde). Tocalo para probar el toque.`
    : `Pedido y mostrado a las ${mostrado}. Tocalo para probar el toque.`;
  return {
    titulo: 'Aviso de prueba',
    opciones: { body: cuerpo, tag: TAG_PRUEBA, icon: 'assets/icons/icon-192.png', requireInteraction: true,
      data: { tipo: 'prueba', url: URL_AVISOS, programada: programadaISO, mostrada: mostradaISO } }
  };
}

// ---------- toques guardados por el service worker ----------
export function formatoHace(ahoraISO, iso) {
  const a = msDe(ahoraISO), b = msDe(iso);
  if (a === null || b === null || a < b) return '';
  const seg = Math.round((a - b) / 1000);
  return seg < 60 ? `hace ${seg} s` : `hace ${formatoDuracion(Math.round(seg / 60))}`;
}

const etiquetaTag = (tag) => (tag === TAG_PRUEBA ? 'aviso de prueba' : tag || 'sin etiqueta');

// Los más recientes primero, hasta max líneas: «07:12:03 · aviso de prueba · hace 2 min».
export function resumenToques(toques, ahoraISO, max = 5) {
  return [...(toques ?? [])]
    .filter((t) => msDe(t?.iso) !== null)
    .sort((x, y) => msDe(y.iso) - msDe(x.iso))
    .slice(0, max)
    .map((t) => [horaSegundos(t.iso), etiquetaTag(t.tag), formatoHace(ahoraISO, t.iso)].filter(Boolean).join(' · '));
}
