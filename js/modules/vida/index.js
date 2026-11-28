// Módulo Vida: pestañas. Hoy solo «Sueño» (hito 4-1a); se suman Historial, acciones sociales y más en los próximos hitos.
import { h } from '../../core/dom.js';
import { renderSueno } from './sueno.js';

const TABS = [
  { id: 'sueno', nombre: 'Sueño', render: renderSueno }
];

export function renderVida(el, ctx) {
  let actual = 'sueno';
  const nav = h('div', { class: 'tabs', role: 'tablist' });
  const cuerpo = h('div');

  function ir(id) {
    actual = id;
    nav.replaceChildren(...TABS.map((x) => h('button', {
      class: 'tab' + (x.id === actual ? ' active' : ''), type: 'button', role: 'tab',
      'aria-selected': String(x.id === actual), onClick: () => ir(x.id)
    }, x.nombre)));
    const nuevo = h('div');                              // cada pestaña dibuja en su propio contenedor
    cuerpo.replaceChildren(nuevo);
    const tab = TABS.find((x) => x.id === id);
    Promise.resolve(tab.render(nuevo, ctx))
      .catch((e) => { nuevo.textContent = String(e?.message ?? e); });
  }

  el.replaceChildren(h('h1', {}, 'Vida'), nav, cuerpo);
  ir(actual);
}
