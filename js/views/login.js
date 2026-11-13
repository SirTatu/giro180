// Pantalla de acceso.
const traducir = (msg) =>
  /invalid login/i.test(msg) ? 'Correo o contraseña incorrectos.' : msg;

export function renderLogin(raiz, { signIn }) {
  const vista = document.createElement('section');
  vista.className = 'login';
  vista.innerHTML = `
    <h1>Giro 180</h1>
    <p class="sub">Acceso privado</p>
    <form class="card form" id="f-login">
      <label>Correo
        <input type="email" name="email" autocomplete="username" required>
      </label>
      <label>Contraseña
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button class="btn" type="submit">Ingresar</button>
      <p class="error" id="login-error" role="alert"></p>
    </form>`;
  raiz.append(vista);

  const form = vista.querySelector('#f-login');
  const boton = form.querySelector('button');
  const error = vista.querySelector('#login-error');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.textContent = '';
    boton.disabled = true;
    try {
      await signIn(form.email.value.trim(), form.password.value);
    } catch (e) {
      error.textContent = traducir(e.message);
    } finally {
      boton.disabled = false;
    }
  });
}
