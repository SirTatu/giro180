// Módulo Nutri: pestañas Hoy e Historial (agua y Cuerpo llegan en el hito 3-4b).
import { h } from '../../core/dom.js';
import { renderHoy } from './hoy.js';
import { renderHistorial } from './historial.js';

const TABS = [
  { id: 'hoy', nombre: 'Hoy', render: renderHoy },
  { id: 'historial', nombre: 'Historial', render: renderHistorial }
];

export function renderNutri(el, ctx) {
  let actual = 'hoy';
  let fechaPedida = null;                                // «Ver / editar» desde el Historial abre Hoy en esa fecha
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
    const fechaInicial = id === 'hoy' ? fechaPedida : null;
    fechaPedida = null;                                  // se usa una sola vez
    const nuevo = h('div');                              // cada pestaña dibuja en su propio contenedor
    cuerpo.replaceChildren(nuevo);
    const tab = TABS.find((x) => x.id === id);
    Promise.resolve(tab.render(nuevo, { ...ctx, fechaInicial, irAHoy: (fecha) => { fechaPedida = fecha; ir('hoy'); } }))
      .catch((e) => { nuevo.textContent = String(e?.message ?? e); });
  }

  el.replaceChildren(h('h1', {}, 'Nutri'), nav, cuerpo);
  ir(actual);
}
