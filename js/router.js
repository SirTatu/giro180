// Navegación por hash (#/gym). Funciona en GitHub Pages sin configuración extra.
import { MODULOS } from './modules/registry.js';

let manejador = null;

export function iniciarRouter({ vista, nav, contexto }) {
  if (manejador) window.removeEventListener('hashchange', manejador);

  manejador = () => {
    const id = location.hash.replace(/^#\//, '').split('/')[0];
    const modulo = MODULOS.find((m) => m.id === id) ?? MODULOS[0];
    if (modulo.id !== id) history.replaceState(null, '', '#/' + modulo.id);

    nav.querySelectorAll('a').forEach((a) =>
      a.classList.toggle('active', a.dataset.ruta === modulo.id));

    vista.replaceChildren();
    modulo.render(vista, contexto);
    window.scrollTo(0, 0);
  };

  window.addEventListener('hashchange', manejador);
  manejador();
}
