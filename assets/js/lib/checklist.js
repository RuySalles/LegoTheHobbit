// Checklist compartilhado: marca/salva itens, conta progresso por grupo, busca e filtra.
// Cada página decide o formato do que salva (load/save) e o que fazer depois (onUpdate/afterFilter).
import { norm, store, readJSON } from './util.js';
import { setTopProgress } from './layout.js';

/**
 * @param {object} o
 * @param {HTMLInputElement[]} o.boxes      checkboxes com data-id
 * @param {(box)=>Element} o.itemOf          elemento que some/aparece no filtro
 * @param {Element[]} o.groups               etapas/capítulos (recebem .complete e contagem)
 * @param {string} o.countSelector           onde escrever "feitas/total" dentro de cada grupo
 * @param {()=>Set<string>} o.load           ids salvos
 * @param {(ids:string[])=>void} o.save      grava os ids marcados
 * @param {(box)=>boolean} [o.keep]          filtro extra da página (ex.: ocultar concluídas)
 * @param {Element} [o.emptyState]           aviso de "nada encontrado"
 * @param {()=>void} [o.onUpdate]            depois de cada marcação
 * @param {(query:string)=>void} [o.afterFilter] depois de cada filtragem
 */
export function createChecklist(o) {
  const keep = o.keep || (() => true);
  let query = '';

  const saved = o.load();
  o.boxes.forEach(b => { b.checked = saved.has(b.dataset.id); });

  const doneIn = boxes => boxes.filter(b => b.checked).length;
  const groupBoxes = new Map(o.groups.map(g => [g, o.boxes.filter(b => g.contains(b))]));

  function update() {
    const done = doneIn(o.boxes);
    setTopProgress(o.boxes.length ? Math.round(done / o.boxes.length * 100) : 0);
    groupBoxes.forEach((bs, g) => {
      const d = doneIn(bs);
      g.querySelector(o.countSelector).textContent = `${d}/${bs.length}`;
      g.classList.toggle('complete', bs.length > 0 && d === bs.length);
    });
    o.save(o.boxes.filter(b => b.checked).map(b => b.dataset.id));
    if (o.onUpdate) o.onUpdate();
    filter();
  }

  function filter() {
    const q = norm(query.trim());
    let visible = 0;
    o.boxes.forEach(b => {
      const item = o.itemOf(b);
      const show = keep(b) && (!q || norm(item.textContent).includes(q));
      item.hidden = !show;
      if (show) visible++;
    });
    groupBoxes.forEach((bs, g) => { g.hidden = !bs.some(b => !o.itemOf(b).hidden); });
    if (o.emptyState) o.emptyState.hidden = visible > 0;
    if (o.afterFilter) o.afterFilter(q);
  }

  o.boxes.forEach(b => b.addEventListener('change', update));

  return {
    update,
    filter,
    setQuery(q) { query = q; filter(); },
    clearQuery() { query = ''; },
    get query() { return query; },
    stats: (boxes = o.boxes) => ({ done: doneIn(boxes), total: boxes.length }),
    boxesOf: g => groupBoxes.get(g) || [],
    reset() { o.boxes.forEach(b => { b.checked = false; }); update(); },
  };
}

// Formatos de armazenamento já usados pelas páginas (não mudar, para manter o progresso salvo)
export const storeAsList = key => ({
  load: () => new Set(readJSON(key, [])),
  save: ids => store(key, JSON.stringify(ids)),
});
export const storeAsMap = key => ({
  load: () => { const m = readJSON(key, {}); return new Set(Object.keys(m).filter(k => m[k])); },
  save: ids => store(key, JSON.stringify(Object.fromEntries(ids.map(id => [id, true])))),
});

/**
 * Grupos recolhíveis (clique, toque e teclado).
 * A página decide o estado padrão de cada grupo (isCollapsed) e guarda as escolhas do usuário (onToggle).
 * @param {object} o
 * @param {Element[]} o.groups
 * @param {string} o.headSelector              cabeçalho clicável dentro de cada grupo
 * @param {(g:Element)=>boolean} o.isCollapsed estado de cada grupo ao (re)aplicar
 * @param {(g:Element, collapsed:boolean)=>void} [o.onToggle] quando o usuário abre/fecha um grupo
 */
export function collapsible({ groups, headSelector, isCollapsed, onToggle }) {
  const show = (g, collapsed) => {
    g.classList.toggle('collapsed', collapsed);
    g.querySelector(headSelector).setAttribute('aria-expanded', String(!collapsed));
  };
  groups.forEach(g => {
    const head = g.querySelector(headSelector);
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    const toggle = () => { const c = !g.classList.contains('collapsed'); show(g, c); if (onToggle) onToggle(g, c); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  const refresh = () => groups.forEach(g => show(g, isCollapsed(g)));
  refresh();
  return {
    refresh,                       // reaplica o estado padrão + escolhas salvas
    show,                          // muda só a tela, sem salvar (ex.: a busca abre etapas)
    allOpen: (gs = groups) => gs.every(g => !g.classList.contains('collapsed')),
  };
}
