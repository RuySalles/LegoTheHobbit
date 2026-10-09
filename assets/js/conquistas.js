// Página de conquistas: monta os cards a partir de data/conquistas.json e cuida do checklist.
// Para mudar dicas, capítulos ou textos, edite data/conquistas.json — não este arquivo.
(async function () {
  'use strict';
  const H = window.Hobbit;

  // Chaves de armazenamento — NÃO alterar, para manter o progresso já salvo.
  const KEY = 'hobbit-achievements-v1';
  const FILTER_KEY = 'hobbit-achievements-filter-v1';

  // Faixas de raridade pela % global da Steam
  const RARITY = [[8, 'epic', 'Épica'], [15, 'rare', 'Rara'], [30, 'uncommon', 'Incomum'], [Infinity, 'common', 'Comum']];
  const rarity = p => RARITY.find(([max]) => p < max);
  const pct = p => p.toFixed(1).replace('.', ',') + '%';
  const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);

  const $ = id => document.getElementById(id);
  let data;
  try { data = await H.loadJSON('data/conquistas.json'); }
  catch (err) { H.loadError($('emptyState'), err); $('emptyState').hidden = false; return; }

  // =====================================================================
  // RENDERIZAÇÃO
  // =====================================================================
  function card(id) {
    const a = data.achievements[id];
    const [, rc, rl] = rarity(a.pct);
    const rota = a.rota ? ` <span class="rota-link">${a.rota}</span>` : '';
    const solo = a.solo ? '<span class="tag">Só 1 jogador</span>' : '';
    return `     <label class="ach" data-rarity="${rc}">
      <input type="checkbox" data-id="${H.esc(id)}">
      <span class="ach-icon"><img src="assets/achievements/${id.toLowerCase()}.jpg" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
      <span class="ach-copy">
       <span class="ach-name">${a.name}</span>
       <span class="ach-desc">“${a.desc}”</span>
       <span class="ach-tip">${a.tip}${rota}</span>
       <span class="meta"><span class="rar ${rc}">${rl} · ${pct(a.pct)}</span>${solo}</span>
      </span>
     </label>
`;
  }

  function render() {
    const html = data.chapters.map((c, i) => `  <section class="chapter" id="${H.esc(c.id)}">
   <header class="chapter-head"><span class="chapter-num">${roman(i + 1)}</span><div><h2>${c.title}</h2><p>${c.subtitle}</p></div><span class="chapter-count">0/${c.achievements.length}</span></header>
   <div class="grid">
${c.achievements.map(card).join('')}   </div>
  </section>
`).join('');
    $('emptyState').insertAdjacentHTML('beforebegin', html);

    const all = data.achievements.WATCH_100_PERCENT_ENDING;
    $('intro').innerHTML = data.intro.replace('{pct100}', all ? pct(all.pct) : '?');
    const [y, m, d] = data.updated.split('-');
    $('panelNote').textContent = `Raridade = % global de jogadores da Steam que desbloquearam, coletada em ${d}/${m}/${y}.`;
  }

  render();

  // =====================================================================
  // COMPORTAMENTO
  // =====================================================================
  const boxes = [...document.querySelectorAll('.ach input[data-id]')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const ring = $('ringFill'), C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C;
  const state = { filter: 'all', query: '' };

  try { const saved = JSON.parse(H.read(KEY) || '{}'); boxes.forEach(b => b.checked = !!saved[b.dataset.id]); } catch (e) {}

  function update() {
    const done = boxes.filter(b => b.checked).length, p = Math.round(done / boxes.length * 100);
    $('ringPct').textContent = p + '%';
    $('ringSub').textContent = `${done}/${boxes.length}`;
    $('topFill').style.width = p + '%';
    ring.style.strokeDashoffset = C * (1 - done / boxes.length);
    ['epic', 'rare', 'uncommon', 'common'].forEach(r => {
      const bs = boxes.filter(b => b.closest('.ach').dataset.rarity === r);
      $('r-' + r).textContent = `${bs.filter(b => b.checked).length}/${bs.length}`;
    });
    chapters.forEach(ch => {
      const bs = [...ch.querySelectorAll('input[data-id]')], d = bs.filter(b => b.checked).length;
      ch.querySelector('.chapter-count').textContent = `${d}/${bs.length}`;
      ch.classList.toggle('complete', d === bs.length);
    });
    const saved = {}; boxes.forEach(b => { if (b.checked) saved[b.dataset.id] = true; });
    H.store(KEY, JSON.stringify(saved));
    applyFilter();
  }

  function applyFilter() {
    const q = H.norm(state.query.trim()); let visible = 0;
    boxes.forEach(b => {
      const card = b.closest('.ach');
      const ok = (state.filter === 'all' || (state.filter === 'done') === b.checked) && (!q || H.norm(card.textContent).includes(q));
      card.hidden = !ok; if (ok) visible++;
    });
    chapters.forEach(ch => ch.hidden = !ch.querySelector('.ach:not([hidden])'));
    $('emptyState').hidden = visible > 0;
  }
  function setFilter(f, persist) {
    state.filter = f;
    document.querySelectorAll('.segmented button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    if (persist) H.store(FILTER_KEY, f);
    applyFilter();
  }
  document.querySelectorAll('.segmented button').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter, true)));
  $('searchInput').addEventListener('input', e => { state.query = e.target.value; applyFilter(); });
  boxes.forEach(b => b.addEventListener('change', update));
  const sf = H.read(FILTER_KEY); if (sf === 'pending' || sf === 'done') state.filter = sf;
  setFilter(state.filter, false);
  update();
})();
