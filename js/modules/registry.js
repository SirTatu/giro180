// Lista de módulos. Cada uno se completa en su etapa.
import { renderCentral } from './central/index.js';
import { renderGym } from './gym/index.js';

const proximamente = (nombre, etapa) => (el) => {
  el.innerHTML = `<h1>${nombre}</h1><p class="sub">Este módulo se construye en la ${etapa}.</p>`;
};

export const MODULOS = [
  { id: 'central', nombre: 'Central', icono: '◎', render: renderCentral },
  { id: 'gym', nombre: 'Gym', icono: '🏋️', render: renderGym },
  { id: 'nutri', nombre: 'Nutri', icono: '🥗', render: proximamente('Nutri', 'Etapa 3') },
  { id: 'vida', nombre: 'Vida', icono: '🌙', render: proximamente('Vida', 'Etapa 4') },
  { id: 'estudio', nombre: 'Estudio', icono: '📚', render: proximamente('Estudio', 'Etapa 4') },
  { id: 'derma', nombre: 'Derma', icono: '🧴', render: proximamente('Derma', 'Etapa 5') }
];
