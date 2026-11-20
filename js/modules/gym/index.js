// Módulo Gym: pestañas Rutinas, Ejercicios e Importar (el registro de entrenamientos llega en el hito 3-2).
import { h } from '../../core/dom.js';
import { renderRutinas } from './rutinas.js';
import { renderEjercicios } from './ejercicios.js';
import { renderImportar } from './importar.js';

const TABS = [
  { id: 'rutinas', nombre: 'Rutinas', render: renderRutinas },
  { id: 'ejercicios', nombre: 'Ejercicios', render: renderEjercicios },
  { id: 'importar', nombre: 'Importar', render: renderImportar }
];

export function renderGym(el, ctx) {
  let actual = 'rutinas';
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
    const nuevo = h('div');                              // cada pestaña dibuja en su propio contenedor
    cuerpo.replaceChildren(nuevo);
    const tab = TABS.find((x) => x.id === id);
    Promise.resolve(tab.render(nuevo, { ...ctx, irARutinas: () => { if (t === token) ir('rutinas'); } }))
      .catch((e) => { nuevo.textContent = String(e?.message ?? e); });
  }

  el.replaceChildren(h('h1', {}, 'Gym'), nav, cuerpo);
  ir(actual);
}
