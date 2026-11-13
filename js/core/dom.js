// Ayudante para armar HTML de forma segura (usa textContent: no interpreta el texto como HTML).
export function h(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  let valor;
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'value') valor = v;                       // se aplica al final (útil en <select>)
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  e.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
  if (valor !== undefined) e.value = valor;
  return e;
}
