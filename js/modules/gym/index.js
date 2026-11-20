// Módulo Gym: pestañas Entrenar, Historial, Rutinas, Ejercicios e Importar.
import { h } from '../../core/dom.js';
import { renderEntrenar } from './entrenar.js';
import { renderHistorial } from './historial.js';
import { renderRutinas } from './rutinas.js';
import { renderEjercicios } from './ejercicios.js';
import { renderImportar } from './importar.js';

const TABS = [
  { id: 'entrenar', nombre: 'Entrenar', render: renderEntrenar },
  { id: 'historial', nombre: 'Historial', render: renderHistorial },
  { id: 'rutinas', nombre: 'Rutinas', render: renderRutinas },
  { id: 'ejercicios', nombre: 'Ejercicios', render: renderEjercicios },
  { id: 'importar', nombre: 'Importar', render: renderImportar }
];

export function renderGym(el, ctx) {
  let actual = 'entrenar';
  let fechaPedida = null;                                // «Editar» desde el Historial abre Entrenar en esa fecha
  const nav = h('div', { class: 'tabs', role: 'tablist' });
  const cuerpo = h('div');
  let token = 0;

  function ir(id) {
    actual = id;
    const t = ++token;
    nav.replaceChildren(...TABS.map((x) => h('button', {
      class: 'tab' + (x.id === actual ? ' active' : ''), type: 'button', role: 'tab',
      'aria-selected': String(x.id === actual), onClick: () => ir(x.id)
    }, x.nombre)));
    const fechaInicial = id === 'entrenar' ? fechaPedida : null;
    fechaPedida = null;                                  // se usa una sola vez
    const nuevo = h('div');                              // cada pestaña dibuja en su propio contenedor
    cuerpo.replaceChildren(nuevo);
    const tab = TABS.find((x) => x.id === id);
    Promise.resolve(tab.render(nuevo, { ...ctx, fechaInicial,
      irARutinas: () => { if (t === token) ir('rutinas'); },
      irAEntrenar: (fecha) => { fechaPedida = fecha; ir('entrenar'); } }))
      .catch((e) => { nuevo.textContent = String(e?.message ?? e); });
  }

  el.replaceChildren(h('h1', {}, 'Gym'), nav, cuerpo);
  ir(actual);
}
