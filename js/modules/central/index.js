// Central: por ahora solo verifica sesión y conexión con la base (Etapa 1B).
import { supabase } from '../../supabase.js';
import { APP_VERSION } from '../../config.js';

export function renderCentral(el, { session, signOut }) {
  el.innerHTML = `
    <h1>Central</h1>
    <p class="sub">Panel principal (se construye en la Etapa 2)</p>
    <div class="card">
      <p><span class="dot ok"></span><span id="txt-user"></span></p>
      <p><span class="dot" id="dot-db"></span><span id="txt-db">Comprobando base de datos…</span></p>
    </div>
    <button class="btn btn-sec" id="btn-salir" type="button">Cerrar sesión</button>
    <p class="version">Versión ${APP_VERSION}</p>`;

  el.querySelector('#txt-user').textContent = 'Sesión iniciada: ' + session.user.email;

  const dot = el.querySelector('#dot-db');
  const txt = el.querySelector('#txt-db');
  supabase.from('user_settings').select('user_id', { count: 'exact', head: true })
    .then(({ error }) => {
      dot.className = 'dot ' + (error ? 'warn' : 'ok');
      txt.textContent = error
        ? 'Error de base de datos: ' + error.message
        : 'Base de datos conectada (RLS activo)';
    });

  el.querySelector('#btn-salir').addEventListener('click', () => signOut());
}
