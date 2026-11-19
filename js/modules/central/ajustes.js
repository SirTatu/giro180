// Pestaña "Ajustes": umbrales configurables y datos de la cuenta.
import { h } from '../../core/dom.js';
import { APP_VERSION } from '../../version.js';
import * as D from './datos.js';
import { renderExportar } from './exportar.js';

export async function renderAjustes(cont, ctx) {
  const { session, signOut } = ctx;
  const msg = h('p', { class: 'error', role: 'alert' });
  const ok = h('p', { class: 'ok-msg' });
  const punto = h('span', { class: 'dot' });
  const estadoBD = h('span', {}, 'Comprobando base de datos…');
  let ajustes = {};

  try {
    ajustes = await D.leerAjustes();
    punto.className = 'dot ok';
    estadoBD.textContent = 'Base de datos conectada (RLS activo)';
  } catch (e) {
    punto.className = 'dot warn';
    estadoBD.textContent = 'Error de base de datos: ' + e.message;
  }

  const horas = h('input', { type: 'number', min: '0', max: '24', step: '0.25', inputmode: 'decimal', value: ajustes.sleep_min_hours ?? '' });
  const diasAlerta = h('input', { type: 'number', min: '1', max: '30', step: '1', inputmode: 'numeric', value: ajustes.sleep_alert_days ?? '' });

  const guardar = h('button', { class: 'btn', type: 'button', onClick: async () => {
    msg.textContent = ''; ok.textContent = '';
    const h1 = horas.value === '' ? null : horas.valueAsNumber;
    const d1 = diasAlerta.value === '' ? null : Math.trunc(diasAlerta.valueAsNumber);
    if ((h1 !== null && !(h1 > 0 && h1 <= 24)) || (d1 !== null && !(d1 >= 1))) {
      msg.textContent = 'Revisá los valores: horas entre 0 y 24, días mínimo 1.';
      return;
    }
    try {
      const nuevo = { ...ajustes, sleep_min_hours: h1, sleep_alert_days: d1 };
      await D.guardarAjustes(session.user.id, nuevo);
      ajustes = nuevo;
      ok.textContent = 'Guardado ✓';
    } catch (e) { msg.textContent = e.message; }
  } }, 'Guardar ajustes');

  cont.append(
    msg,
    h('div', { class: 'card form' },
      h('strong', {}, 'Alerta de sueño insuficiente'),
      h('p', { class: 'nota' }, 'Dejá vacío lo que todavía no definiste. Se usa en el módulo Vida (Etapa 4). Las metas de proteína y agua se configuran como hábitos con meta, en la pestaña «Hábitos».'),
      h('label', {}, 'Horas efectivas mínimas por noche', horas),
      h('label', {}, 'Días seguidos por debajo del mínimo que disparan la alerta', diasAlerta),
      h('div', { class: 'acciones' }, guardar, ok)),
    renderExportar(),
    h('div', { class: 'card' },
      h('p', {}, h('span', { class: 'dot ok' }), 'Sesión: ' + session.user.email),
      h('p', {}, punto, estadoBD)),
    h('button', { class: 'btn btn-sec', type: 'button', onClick: () => signOut() }, 'Cerrar sesión'),
    h('p', { class: 'version' }, 'Versión ' + APP_VERSION));
}
