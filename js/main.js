// Arranque de Giro 180.
import { configLista } from './config.js';

const raiz = document.getElementById('app');
let auth = null;
let vistas = null;
let usuarioActual;          // id del usuario mostrado (o null)

function aviso(titulo, texto) {
  raiz.replaceChildren();
  const s = document.createElement('section');
  s.className = 'login';
  const h = document.createElement('h1');
  h.textContent = titulo;
  const p = document.createElement('p');
  p.className = 'sub';
  p.textContent = texto;
  s.append(h, p);
  raiz.append(s);
}

function pintar(session) {
  usuarioActual = session?.user?.id ?? null;
  raiz.replaceChildren();
  if (!session) vistas.renderLogin(raiz, { signIn: auth.signIn });
  else vistas.renderShell(raiz, session, { signOut: auth.signOut });
}

async function main() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  if (!configLista()) {
    return aviso('Falta configurar', 'Editá js/config.js y pegá la URL y la publishable key de Supabase.');
  }

  try {
    const [a, login, shell] = await Promise.all([
      import('./auth.js'), import('./views/login.js'), import('./views/shell.js')
    ]);
    auth = a;
    vistas = { renderLogin: login.renderLogin, renderShell: shell.renderShell };
  } catch (e) {
    return aviso('No se pudo cargar la aplicación', e.message);
  }

  let session = null;
  try { session = await auth.getSession(); } catch { /* sin sesión */ }
  pintar(session);

  auth.onAuthChange((_evento, s) => {
    const id = s?.user?.id ?? null;
    if (id === usuarioActual) return;      // evita redibujar sin necesidad
    setTimeout(() => pintar(s), 0);        // evita llamar a Supabase dentro del callback
  });
}

main();
