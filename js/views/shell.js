// Estructura de la app: navegación + zona de contenido.
import { MODULOS } from '../modules/registry.js';
import { iniciarRouter } from '../router.js';

export function renderShell(raiz, session, { signOut }) {
  const shell = document.createElement('div');
  shell.className = 'shell';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Módulos');
  for (const m of MODULOS) {
    const a = document.createElement('a');
    a.href = '#/' + m.id;
    a.dataset.ruta = m.id;
    a.innerHTML = `<span class="nav-ico">${m.icono}</span><span class="nav-txt">${m.nombre}</span>`;
    nav.append(a);
  }

  const vista = document.createElement('main');
  vista.className = 'view';

  shell.append(nav, vista);
  raiz.append(shell);
  iniciarRouter({ vista, nav, contexto: { session, signOut } });
}
