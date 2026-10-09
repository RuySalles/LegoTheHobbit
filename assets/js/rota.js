// Página da rota (index.html): monta o conteúdo a partir de data/rota.json e cuida do checklist.
// Para mudar textos, tarefas, materiais ou custos, edite data/rota.json — não este arquivo.
(async function () {
  'use strict';
  const H = window.Hobbit;

  // Chaves de armazenamento — NÃO alterar, para manter o progresso já salvo.
  const STORAGE_KEY = 'hobbit-route-checklist-v1';
  const COLLAPSED_KEY = 'hobbit-route-collapsed-v1';
  const HIDE_KEY = 'hobbit-route-hide-done-v1';

  // Tipo de etiqueta (data/rota.json) → classe CSS
  const TAG_CLASS = { custo: 'gold', esquema: 'k-schem', forja: 'k-forge', entrega: 'k-deliv', prereq: 'k-req' };

  const $ = id => document.getElementById(id);
  let data;
  try { data = await H.loadJSON('data/rota.json'); }
  catch (err) { H.loadError($('stages'), err); return; }

  // =====================================================================
  // RENDERIZAÇÃO
  // =====================================================================
  const matName = Object.fromEntries(data.materials.map(m => [m.key, m.name]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lines = arr => '\n' + arr.join('\n') + '\n';

  function renderTask(t) {
    const mats = t.materials
      ? `<div class="mats"><b>Materiais:</b> ${t.materials.map(([k, n]) => `${n} ${matName[k]}`).join(' · ')}</div>` : '';
    const tags = (t.tags || []).map(g => `<span class="tag${g.type ? ' ' + TAG_CLASS[g.type] : ''}">${g.text}</span>`).join('');
    return `<label class="task"><input type="checkbox" data-id="${H.esc(t.id)}"><span class="taskcopy"><div class="tasktitle">${t.title}</div>`
      + `<div class="taskdesc">${t.desc}</div>${mats}<span class="meta">${tags}</span></span></label>`;
  }

  function renderStage(st, i) {
    const num = String(i + 1).padStart(2, '0');
    const note = st.note ? `<div class="stage-note">${st.note}</div>\n` : '';
    return `<article class="stage">
<div class="stagehead"><div class="stage-num">${num}</div><div><h3>${st.title}</h3><p>${st.subtitle}</p></div><span class="chips"><span class="stage-tag">${st.tag}</span><span class="stage-count"></span></span></div>
<div class="stagebody">
${note}${st.tasks.map(renderTask).join('\n')}
</div>
</article>`;
  }

  // Soma dos materiais: obrigatórios x etapas opcionais (ex.: Express Delivery)
  function materialTotals() {
    const req = {}, extra = {}, optLabels = new Set();
    data.stages.forEach(st => st.tasks.forEach(t => (t.materials || []).forEach(([k, n]) => {
      const bucket = st.optional ? extra : req;
      bucket[k] = (bucket[k] || 0) + n;
      if (st.optional) optLabels.add(st.optional);
    })));
    const order = data.materials.map(m => m.key).filter(k => req[k] || extra[k]);
    // Mithril Bricks primeiro; depois do mais necessário ao menos (empate: ordem do catálogo)
    order.sort((a, b) => (b === 'mithril') - (a === 'mithril') || (req[b] || 0) - (req[a] || 0) || order.indexOf(a) - order.indexOf(b));
    return { req, extra, order, optLabel: [...optLabels].join(' e ') };
  }

  function render() {
    const bricks = data.redBricks, mult = bricks.filter(b => b.multiplier), other = bricks.filter(b => !b.multiplier);
    const sum = arr => arr.reduce((a, b) => a + b.cost, 0);

    $('heroMeta').innerHTML = lines([
      `<span class="pill"><strong>${mult.length}</strong> multiplicadores</span>`,
      `<span class="pill"><strong>${H.fmtShort(sum(mult))}</strong> studs para comprar todos</span>`,
      `<span class="pill">Checklist com progresso local</span>`]);

    $('bricks').innerHTML = lines(bricks.map(b =>
      `<li class="brickrow" data-unlock="${H.esc(b.unlock)}"><span class="brick">${b.label}</span><span class="brickinfo"><strong>${b.name}</strong><span>${b.where}</span></span><span class="brickcost">${H.fmtShort(b.cost)}</span></li>`));
    $('vaultCount').textContent = `0/${bricks.length}`;

    $('stages').innerHTML = lines(data.stages.map(renderStage));

    $('costRows').innerHTML = lines(bricks.map(b =>
      `<tr data-unlock="${H.esc(b.unlock)}"><td data-label="Desbloqueio"><strong>${b.tableName}</strong></td><td data-label="Item exigido">${b.item}</td>`
      + `<td data-label="Missão de entrega">${b.quest}</td><td data-label="Local / horário">${b.where}</td><td data-label="Custo">${H.fmtInt(b.cost)}</td></tr>`));

    $('budget').innerHTML = `<strong>Orçamento de referência:</strong> os ${H.numWord(mult.length)} multiplicadores custam ${H.fmtInt(sum(mult))} studs no total. `
      + `Incluindo ${other.map(b => b.name).join(' e ')}, o total dos ${H.numWord(bricks.length)} extras desta rota é ${H.fmtInt(sum(bricks))} studs, sem contar personagens, materiais ou outras compras.`;

    const mt = materialTotals();
    $('matGrid').innerHTML = lines(mt.order.map(k => {
      const n = mt.req[k] || 0, x = mt.extra[k] || 0;
      const small = x ? `<small>+${x} com ${mt.optLabel}</small>` : '';
      return `<div class="mat${k === 'mithril' ? ' key' : ''}"><strong>${n || '—'}</strong><span>${cap(matName[k])}</span>${small}</div>`;
    }));

    $('sourceList').innerHTML = lines(data.sources.map(s => `<li>${s}</li>`));
    $('confirmList').innerHTML = lines(data.confirm.map(s => `<li>${s}</li>`));
  }

  render();

  // =====================================================================
  // COMPORTAMENTO (checklist, studs, filtros, etapas recolhíveis)
  // =====================================================================
  const boxes = [...document.querySelectorAll('input[type="checkbox"][data-id]')];
  const byId = Object.fromEntries(boxes.map(b => [b.dataset.id, b]));
  const stages = [...document.querySelectorAll('.stage')];
  const state = { hideDone: H.read(HIDE_KEY) === '1', query: '' };

  // Studs de progresso: um por tarefa
  const studs = boxes.map(b => {
    const task = b.closest('.task');
    const title = task.querySelector('.tasktitle').textContent.trim();
    const s = document.createElement('button');
    s.type = 'button'; s.className = 'stud'; s.title = title;
    s.setAttribute('aria-label', 'Ir para: ' + title);
    s.addEventListener('click', () => {
      if (task.hidden) { state.hideDone = false; state.query = ''; $('searchInput').value = ''; syncHideBtn(); }
      const stage = task.closest('.stage');
      if (stage.classList.contains('collapsed')) { stage.classList.remove('collapsed'); syncStage(stage); syncExpandBtn(); saveCollapsed(); }
      applyFilter();
      task.scrollIntoView({ behavior: 'smooth', block: 'center' });
      H.flash(task);
    });
    $('studs').appendChild(s);
    return s;
  });

  function update() {
    const done = boxes.filter(b => b.checked).length;
    const pct = boxes.length ? Math.round(done / boxes.length * 100) : 0;
    $('progressText').innerHTML = `<strong>${done}</strong> de ${boxes.length} tarefas concluídas · ${pct}%`;
    $('topFill').style.width = pct + '%';
    boxes.forEach((b, i) => studs[i].classList.toggle('done', b.checked));

    stages.forEach(st => {
      const sb = [...st.querySelectorAll('input[data-id]')];
      const d = sb.filter(b => b.checked).length;
      st.querySelector('.stage-count').textContent = `${d}/${sb.length}`;
      st.classList.toggle('complete', d === sb.length && sb.length > 0);
    });

    let bricksOn = 0;
    document.querySelectorAll('[data-unlock]').forEach(el => {
      const on = !!(byId[el.dataset.unlock] && byId[el.dataset.unlock].checked);
      el.classList.toggle(el.tagName === 'TR' ? 'unlocked' : 'on', on);
      if (on && el.classList.contains('brickrow')) bricksOn++;
    });
    $('vaultCount').textContent = `${bricksOn}/${data.redBricks.length}`;

    H.store(STORAGE_KEY, JSON.stringify(boxes.filter(b => b.checked).map(b => b.dataset.id)));
    applyFilter();
  }

  // Busca + ocultar concluídas
  function applyFilter() {
    const q = H.norm(state.query.trim());
    let visible = 0;
    boxes.forEach(b => {
      const task = b.closest('.task');
      const show = !(state.hideDone && b.checked) && (!q || H.norm(task.textContent).includes(q));
      task.hidden = !show;
      if (show) visible++;
    });
    stages.forEach(st => {
      const any = !!st.querySelector('.task:not([hidden])');
      st.hidden = !any;
      if (q && any) st.classList.remove('collapsed'); // durante a busca, abre as etapas com resultado
    });
    $('emptyState').hidden = visible > 0;
  }
  const hideBtn = $('hideDoneBtn');
  function syncHideBtn() { hideBtn.setAttribute('aria-pressed', String(state.hideDone)); }
  hideBtn.addEventListener('click', () => { state.hideDone = !state.hideDone; H.store(HIDE_KEY, state.hideDone ? '1' : '0'); syncHideBtn(); applyFilter(); });
  $('searchInput').addEventListener('input', e => { state.query = e.target.value; applyFilter(); stages.forEach(syncStage); syncExpandBtn(); });
  syncHideBtn();

  try {
    const saved = JSON.parse(H.read(STORAGE_KEY) || '[]');
    boxes.forEach(b => b.checked = saved.includes(b.dataset.id));
  } catch (e) {}
  boxes.forEach(b => b.addEventListener('change', update));

  // Etapas recolhíveis (clique, toque e teclado)
  const expandBtn = $('expandBtn');
  function syncStage(stage) {
    stage.querySelector('.stagehead').setAttribute('aria-expanded', !stage.classList.contains('collapsed'));
  }
  // O texto do botão sempre descreve a ação que ele vai executar
  function syncExpandBtn() {
    const allOpen = stages.every(s => !s.classList.contains('collapsed'));
    expandBtn.textContent = allOpen ? 'Recolher tudo' : 'Expandir tudo';
  }
  function saveCollapsed() {
    H.store(COLLAPSED_KEY, JSON.stringify(stages.map((s, i) => s.classList.contains('collapsed') ? i : -1).filter(i => i >= 0)));
  }
  try { JSON.parse(H.read(COLLAPSED_KEY) || '[]').forEach(i => stages[i] && stages[i].classList.add('collapsed')); } catch (e) {}
  stages.forEach(stage => {
    const head = stage.querySelector('.stagehead');
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    const toggle = () => { stage.classList.toggle('collapsed'); syncStage(stage); syncExpandBtn(); saveCollapsed(); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    syncStage(stage);
  });
  syncExpandBtn();
  expandBtn.addEventListener('click', () => {
    const collapse = stages.every(s => !s.classList.contains('collapsed'));
    stages.forEach(s => { s.classList.toggle('collapsed', collapse); syncStage(s); });
    syncExpandBtn(); saveCollapsed();
  });

  update();

  $('printBtn').addEventListener('click', () => window.print());
  $('resetBtn').addEventListener('click', () => {
    if (confirm('Deseja limpar todas as marcações do checklist?')) {
      boxes.forEach(b => b.checked = false);
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      update();
    }
  });
})();
