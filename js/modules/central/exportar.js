// Tarjeta "Exportar tus datos" (se muestra en Ajustes). Copia de seguridad en JSON (completa y exacta)
// y CSV por tabla (para abrir en Excel). Dos pasos: primero se LEEN los datos y después se descarga,
// así cada descarga nace de un toque nuevo (los navegadores, sobre todo iPhone, lo exigen).
import { h } from '../../core/dom.js';
import { hoy } from '../../core/fechas.js';
import { APP_VERSION } from '../../version.js';
import { TABLAS_EXPORT, aCSV, conBOM, armarJSON, nombreArchivo } from '../../core/exportar.js';
import * as D from './datos.js';

function descargar(nombre, texto, mime) {
  const url = URL.createObjectURL(new Blob([texto], { type: mime }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// En celulares: abre el menú de compartir del sistema (permite «Guardar en Archivos»).
async function compartir(nombre, texto, mime) {
  const archivo = new File([texto], nombre, { type: mime });
  await navigator.share({ files: [archivo], title: nombre });
}

const puedeCompartir = () => {
  try {
    return typeof File === 'function' && typeof navigator.canShare === 'function' && navigator.maxTouchPoints > 0
      && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  } catch { return false; }
};

export function renderExportar() {
  const msg = h('p', { class: 'error', role: 'alert' });
  const estado = h('p', { class: 'nota' });
  const zona = h('div');                       // acá aparecen los botones de descarga cuando hay datos leídos
  let leidas = null;                           // { tablas: {nombre: filas}, fecha, hora }

  const preparar = h('button', { class: 'btn btn-sm', type: 'button' }, 'Preparar exportación');
  preparar.addEventListener('click', async () => {
    msg.textContent = '';
    zona.replaceChildren();
    leidas = null;
    preparar.disabled = true;
    const tablas = {};
    try {
      for (let i = 0; i < TABLAS_EXPORT.length; i++) {
        const { tabla, orden } = TABLAS_EXPORT[i];
        estado.textContent = `Leyendo ${tabla} (${i + 1} de ${TABLAS_EXPORT.length})…`;
        tablas[tabla] = (await D.leerTodaLaTabla(tabla, orden)).filas;
      }
      leidas = { tablas, fecha: hoy(), iso: new Date().toISOString() };
      const total = Object.values(tablas).reduce((s, f) => s + f.length, 0);
      estado.textContent = `Listo: ${total} filas leídas. Si registrás algo nuevo, volvé a preparar.`;
      mostrarDescargas();
    } catch (e) {
      estado.textContent = '';
      msg.textContent = 'No se pudo leer todo, no se generó ningún archivo: ' + (e?.message ?? e);
    }
    preparar.disabled = false;
  });

  function mostrarDescargas() {
    const { tablas, fecha, iso } = leidas;
    const nombreJSON = nombreArchivo(fecha, 'json');
    const textoJSON = () => armarJSON({ tablas, versionApp: APP_VERSION, exportadoEn: iso });
    const compartible = puedeCompartir();
    const avisar = (e) => { if (e?.name !== 'AbortError') msg.textContent = 'No se pudo compartir: ' + (e?.message ?? e); };

    const filaJSON = h('div', { class: 'acciones' },
      h('button', { class: 'btn btn-sm', type: 'button', onClick: () => descargar(nombreJSON, textoJSON(), 'application/json') }, 'Descargar JSON completo'),
      compartible ? h('button', { class: 'btn btn-sec btn-sm', type: 'button',
        onClick: () => compartir(nombreJSON, textoJSON(), 'application/json').catch(avisar) }, 'Compartir…') : null);

    const conDatos = TABLAS_EXPORT.filter((t) => tablas[t.tabla].length > 0);
    const selTabla = h('select', { 'aria-label': 'Tabla para el CSV' },
      ...conDatos.map((t) => h('option', { value: t.tabla }, `${t.etiqueta} (${tablas[t.tabla].length})`)));
    const csvDe = () => {
      const t = selTabla.value;
      return { nombre: nombreArchivo(fecha, 'csv', t), texto: conBOM(aCSV(tablas[t])) };
    };
    const filaCSV = conDatos.length ? h('div', {},
      selTabla,
      h('div', { class: 'acciones' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', onClick: () => { const c = csvDe(); descargar(c.nombre, c.texto, 'text/csv;charset=utf-8'); } }, 'Descargar CSV de esa tabla'),
        compartible ? h('button', { class: 'btn btn-sec btn-sm', type: 'button',
          onClick: () => { const c = csvDe(); compartir(c.nombre, c.texto, 'text/csv').catch(avisar); } }, 'Compartir…') : null))
      : h('p', { class: 'nota' }, 'No hay filas para exportar a CSV todavía.');

    const detalle = h('details', {}, h('summary', {}, 'Filas por tabla'),
      ...TABLAS_EXPORT.map((t) => h('p', { class: 'fila-meta' }, `${t.tabla}: ${tablas[t.tabla].length}`)));

    zona.replaceChildren(filaJSON, filaCSV, detalle);
  }

  return h('div', { class: 'card pad' },
    h('strong', {}, 'Exportar tus datos'),
    h('p', { class: 'nota' }, 'Copia de seguridad de todo lo que registraste. El JSON es la copia completa y exacta; el CSV se abre en Excel (separador «;» y coma decimal). El archivo queda en tu dispositivo y no está cifrado: guardalo en un lugar seguro.'),
    msg, h('div', { class: 'acciones' }, preparar), estado, zona);
}
