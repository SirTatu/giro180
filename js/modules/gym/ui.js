// Piezas de pantalla compartidas por las pestañas de Gym.
import { h } from '../../core/dom.js';
import { traducirError } from '../../core/gym.js';

// Mensaje de error accesible con botón Reintentar (mismo patrón que Central).
export function cajaError(e, reintentar) {
  return h('div', { class: 'card pad' },
    h('p', { class: 'error', role: 'alert' }, traducirError(e)),
    reintentar ? h('button', { class: 'btn btn-sm', type: 'button', onClick: reintentar }, 'Reintentar') : null);
}
