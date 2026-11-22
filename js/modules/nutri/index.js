// Módulo Nutri: pestañas Hoy (comidas y proteína), Alimentos, Agua, Botellas, Historial y Cuerpo.
// Cuerpo reutiliza tal cual la pantalla de Gym: peso y cintura viven en una sola tabla (body_measurements).
import { h } from '../../core/dom.js';
import { renderHoy } from './hoy.js';
import { renderAgua } from './agua.js';
import { renderAlimentos } from './alimentos.js';
import { renderBotellas } from './botellas.js';
import { renderHistorial } from './historial.js';
import { renderCuerpo } from '../gym/cuerpo.js';

const TABS = [
  { id: 'hoy', nombre: 'Hoy', render: renderHoy },
  { id: 'alimentos', nombre: 'Alimentos', render: renderAlimentos },
  { id: 'agua', nombre: 'Agua', render: renderAgua },
  { id: 'botellas', nombre: 'Botellas', render: renderBotellas },
  { id: 'historial', nombre: 'Historial', render: renderHistorial },
  { id: 'cuerpo', nombre: 'Cuerpo', render: renderCuerpo }
];

export function renderNutri(el, ctx) {
  let actual = 'hoy';
  let fechaPedida = null;                                // «Ver comidas / Ver agua» desde el Historial abre la pestaña en esa fecha
  const nav = h('div', { class: 'tabs', role: 'tablist' });
  const cuerpo = h('div');
  let token = 0;

  function ir(id) {
    actual = id;
    ++token;
    nav.replaceChildren(...TABS.map((x) => h('button', {
      class: 'tab' + (x.id === actual ? ' active' : ''), type: 'button', role: 'tab',
      'aria-selected': String(x.id === actual), onClick: () => ir(x.id)
    }, x.nombre)));
    const fechaInicial = id === 'hoy' || id === 'agua' ? fechaPedida : null;
    fechaPedida = null;                                  // se usa una sola vez
    const nuevo = h('div');                              // cada pestaña dibuja en su propio contenedor
    cuerpo.replaceChildren(nuevo);
    const tab = TABS.find((x) => x.id === id);
    Promise.resolve(tab.render(nuevo, { ...ctx, fechaInicial,
      irAHoy: (fecha) => { fechaPedida = fecha; ir('hoy'); },
      irAAgua: (fecha) => { fechaPedida = fecha; ir('agua'); } }))
      .catch((e) => { nuevo.textContent = String(e?.message ?? e); });
  }

  el.replaceChildren(h('h1', {}, 'Nutri'), nav, cuerpo);
  ir(actual);
}
