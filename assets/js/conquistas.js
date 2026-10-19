// Página de conquistas: monta os cards a partir de data/conquistas.json e cuida do checklist.
// Para mudar dicas, capítulos ou textos, edite data/conquistas.json — não este arquivo.
import { $, esc, lines, loadJSON, loadError, store, read } from './lib/util.js';
import { renderLayout } from './lib/layout.js';
import { createChecklist, storeAsMap } from './lib/checklist.js';

// Chaves de armazenamento — NÃO alterar, para manter o progresso já salvo.
const KEY = 'hobbit-achievements-v1';
const FILTER_KEY = 'hobbit-achievements-filter-v1';

// Faixas de raridade pela % global da Steam
const RARITY = [[8, 'epic', 'Épica'], [15, 'rare', 'Rara'], [30, 'uncommon', 'Incomum'], [Infinity, 'common', 'Comum']];
const rarity = p => RARITY.find(([max]) => p < max);
const pct = p => p.toFixed(1).replace('.', ',') + '%';
const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);

renderLayout('conquistas');
let data;
try { data = await loadJSON('data/conquistas.json'); }
catch (err) { loadError($('emptyState'), err); throw err; }

// =====================================================================
// RENDERIZAÇÃO
// =====================================================================
const tpl = {
  card: id => {
    const a = data.achievements[id];
    const [, rc, rl] = rarity(a.pct);
    return `<label class="ach" data-rarity="${rc}">
 <input type="checkbox" data-id="${esc(id)}">
 <span class="ach-icon"><img src="assets/achievements/${id.toLowerCase()}.jpg" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
 <span class="ach-copy">
  <span class="ach-name">${a.name}</span>
  <span class="ach-desc">“${a.desc}”</span>
  <span class="ach-tip">${a.tip}${a.rota ? ` <span class="rota-link">${a.rota}</span>` : ''}</span>
  <span class="meta"><span class="rar ${rc}">${rl} · ${pct(a.pct)}</span>${a.solo ? '<span class="tag">Só 1 jogador</span>' : ''}</span>
 </span>
</label>`;
  },
  chapter: (c, i) => `<section class="chapter" id="${esc(c.id)}">
 <header class="chapter-head"><span class="chapter-num">${roman(i + 1)}</span><div><h2>${c.title}</h2><p>${c.subtitle}</p></div><span class="chapter-count">0/${c.achievements.length}</span></header>
 <div class="grid">${lines(c.achievements.map(tpl.card))}</div>
</section>`,
};

$('chapters').innerHTML = lines(data.chapters.map(tpl.chapter));
const all = data.achievements.WATCH_100_PERCENT_ENDING;
$('intro').innerHTML = data.intro.replace('{pct100}', all ? pct(all.pct) : '?');
const [y, m, d] = data.updated.split('-');
$('panelNote').textContent = `Raridade = % global de jogadores da Steam que desbloquearam, coletada em ${d}/${m}/${y}.`;
$('sourceList').innerHTML = lines((data.sources || []).map(x => `<li>${x}</li>`));

// =====================================================================
// COMPORTAMENTO
// =====================================================================
const boxes = [...document.querySelectorAll('.ach input[data-id]')];
const ring = $('ringFill'), C = 2 * Math.PI * 52;
ring.style.strokeDasharray = C;
let filter = 'all';

const list = createChecklist({
  boxes, groups: [...document.querySelectorAll('.chapter')], countSelector: '.chapter-count',
  itemOf: b => b.closest('.ach'),
  ...storeAsMap(KEY),
  keep: b => filter === 'all' || (filter === 'done') === b.checked,
  emptyState: $('emptyState'),
  onUpdate: () => {
    const { done, total } = list.stats();
    $('ringPct').textContent = Math.round(done / total * 100) + '%';
    $('ringSub').textContent = `${done}/${total}`;
    ring.style.strokeDashoffset = C * (1 - done / total);
    RARITY.forEach(([, r]) => {
      const s = list.stats(boxes.filter(b => b.closest('.ach').dataset.rarity === r));
      $('r-' + r).textContent = `${s.done}/${s.total}`;
    });
  },
});

function setFilter(f, persist) {
  filter = f;
  document.querySelectorAll('.segmented button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  if (persist) store(FILTER_KEY, f);
  list.filter();
}
document.querySelectorAll('.segmented button').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter, true)));
$('searchInput').addEventListener('input', e => list.setQuery(e.target.value));
const savedFilter = read(FILTER_KEY);
setFilter(savedFilter === 'pending' || savedFilter === 'done' ? savedFilter : 'all', false);
list.update();
