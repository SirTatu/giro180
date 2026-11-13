// Arranque de Giro 180 (Etapa 1A: solo verifica que la base PWA funcione)
const marcar = (id, ok, texto) => {
  document.getElementById('dot-' + id).className = 'dot ' + (ok ? 'ok' : 'warn');
  document.getElementById('txt-' + id).textContent = texto;
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => marcar('sw', true, 'Service Worker registrado'))
    .catch((err) => marcar('sw', false, 'Error de Service Worker: ' + err.message));
} else {
  marcar('sw', false, 'Este navegador no soporta Service Worker');
}

const instalada = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;
marcar('mode', instalada, instalada
  ? 'Abierta como app (pantalla de inicio)'
  : 'Abierta en el navegador (todavía no instalada)');
