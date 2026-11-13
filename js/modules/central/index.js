// Central: contenedor con pestañas. (El dashboard y los informes llegan en 2B y 2C.)
import { h } from '../../core/dom.js';
import { renderHoy } from './hoy.js';
import { renderHabitos } from './habitos.js';
import { renderAjustes } from './ajustes.js';

const TABS = [
  { id: 'hoy', nombre: 'Hoy', render: renderHoy },
  { id: 'habitos', nombre: 'Hábitos', render: renderHabitos },
  { id: 'ajustes', nombre: 'Ajustes', render: renderAjustes }
];

export function renderCentral(el, ctx) {
  const cuerpo = h('div');
  const botones = new Map();

  function mostrar(id) {
    for (const [tid, b] of botones) b.classList.toggle('active', tid === id);
    const cont = h('div');                    // cada vista usa su propio contenedor
    cuerpo.replaceChildren(cont);
    TABS.find((t) => t.id === id).render(cont, ctx);
  }

  const barra = h('div', { class: 'tabs', role: 'tablist' },
    ...TABS.map((t) => {
      const b = h('button', { class: 'tab', type: 'button', role: 'tab', onClick: () => mostrar(t.id) }, t.nombre);
      botones.set(t.id, b);
      return b;
    }));

  el.append(h('h1', {}, 'Central'), barra, cuerpo);
  mostrar('hoy');
}
