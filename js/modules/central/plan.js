// Pestaña "Plan": prioridades, objetivos, compromisos y decisiones.
import { h } from '../../core/dom.js';
import { renderPrioridades } from './prioridades.js';
import { renderObjetivos } from './objetivos.js';
import { renderCompromisos } from './compromisos.js';
import { renderDecisiones } from './decisiones.js';

export function renderPlan(cont, ctx) {
  const [sPrio, sObj, sComp, sDec] = [1, 2, 3, 4].map(() => h('section', { class: 'seccion' }));
  cont.append(sPrio, sObj, sComp, sDec);
  const recargarDecisiones = renderDecisiones(sDec);
  const ctx2 = { ...ctx, alRegistrarDecision: recargarDecisiones };
  renderPrioridades(sPrio, ctx2);
  renderObjetivos(sObj, ctx2);
  renderCompromisos(sComp, ctx2);
}
