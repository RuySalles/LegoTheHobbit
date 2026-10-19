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
 * Grupos recolhíveis (clique, toque e teclado). Salva os índices recolhidos em storageKey.
 * @returns {{set:(g,collapsed)=>void, setAll:(collapsed)=>void, allOpen:()=>boolean}}
 */
export function collapsible({ groups, headSelector, storageKey, onChange }) {
  const save = () => store(storageKey, JSON.stringify(groups.map((g, i) => g.classList.contains('collapsed') ? i : -1).filter(i => i >= 0)));
  const sync = g => g.querySelector(headSelector).setAttribute('aria-expanded', String(!g.classList.contains('collapsed')));
  const changed = () => { save(); if (onChange) onChange(); };

  readJSON(storageKey, []).forEach(i => groups[i] && groups[i].classList.add('collapsed'));
  groups.forEach(g => {
    const head = g.querySelector(headSelector);
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    const toggle = () => { g.classList.toggle('collapsed'); sync(g); changed(); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    sync(g);
  });

  return {
    // persist=false muda só a tela (ex.: a busca abre etapas sem mexer no que foi salvo)
    set(g, collapsed, persist = true) {
      if (g.classList.contains('collapsed') === collapsed) return;
      g.classList.toggle('collapsed', collapsed); sync(g);
      if (persist) changed(); else if (onChange) onChange();
    },
    setAll(collapsed) { groups.forEach(g => { g.classList.toggle('collapsed', collapsed); sync(g); }); changed(); },
    allOpen: () => groups.every(g => !g.classList.contains('collapsed')),
    syncAll: () => groups.forEach(sync),
  };
}
