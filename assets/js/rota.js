// Página da rota (index.html): monta o conteúdo a partir de data/rota.json e cuida do checklist.
// Para mudar textos, tarefas, materiais ou custos, edite data/rota.json — não este arquivo.
import { $, esc, norm, cap, lines, fmtInt, fmtShort, numWord, pad2, loadJSON, loadError, flash, store, read, readJSON, forget } from './lib/util.js';
import { renderLayout } from './lib/layout.js';
import { createChecklist, storeAsList, collapsible } from './lib/checklist.js';

// Chaves de armazenamento — NÃO alterar, para manter o progresso já salvo.
const STORAGE_KEY = 'hobbit-route-checklist-v1';
const HIDE_KEY = 'hobbit-route-hide-done-v1';
const VIEW_KEY = 'hobbit-route-stage-view-v1';   // etapas que o usuário abriu/fechou na mão: { "3": "open" | "closed" }
const TAB_KEY = 'hobbit-route-tab-v1';

// Tipo de etiqueta (data/rota.json) → classe CSS
const TAG_CLASS = { custo: 'gold', esquema: 'k-schem', forja: 'k-forge', entrega: 'k-deliv', prereq: 'k-req' };

renderLayout('rota', [
  { label: 'Jornada', page: 'rota', hash: 'jornada' },
  { label: 'O Tesouro de Erebor', page: 'rota', hash: 'tesouro' },
  { label: 'Referência', page: 'rota', hash: 'referencia' },
  { label: 'Conquistas', page: 'conquistas' },
]);
let data;
try { data = await loadJSON('data/rota.json'); }
catch (err) { loadError($('stages'), err); throw err; }

// =====================================================================
// DADOS DERIVADOS
// =====================================================================
const matName = Object.fromEntries(data.materials.map(m => [m.key, m.name]));
const sum = arr => arr.reduce((a, b) => a + b.cost, 0);
const bricks = data.redBricks;
// "group" separa os Red Bricks de uma parte extra; sem group = rota principal
const mainBricks = bricks.filter(b => !b.group), moreBricks = bricks.filter(b => b.group);
const multipliers = bricks.filter(b => b.multiplier);

// Partes da rota: tudo antes do primeiro "part" é a Jornada; cada "part" abre uma nova aba
const parts = [{ id: 'jornada', title: 'Jornada', stages: [] }];
data.stages.forEach((st, i) => {
  if (st.part) parts.push({ id: st.part.id, title: st.part.title, stages: [] });
  parts[parts.length - 1].stages.push(i);
});
const partOfStage = data.stages.map((_, i) => parts.find(p => p.stages.includes(i)).id);
const TABS = [...parts.map(p => p.id), 'referencia'];
// Endereços antigos continuam funcionando
const LEGACY = { rota: ['jornada'], custos: ['referencia', 'custos'], materiais: ['referencia', 'materiais'], fontes: ['referencia', 'fontes'] };

// =====================================================================
// RENDERIZAÇÃO
// =====================================================================
const tpl = {
  tag: g => `<span class="tag${g.type ? ' ' + TAG_CLASS[g.type] : ''}">${g.text}</span>`,
  mats: m => `<div class="mats"><b>Materiais:</b> ${m.map(([k, n]) => `${n} ${matName[k]}`).join(' · ')}</div>`,
  task: t => `<div class="task">
 <label class="taskmain"><input type="checkbox" data-id="${esc(t.id)}"><span class="taskcopy"><span class="tasktitle">${t.title}</span><span class="meta">${(t.tags || []).map(tpl.tag).join('')}</span></span></label>
 <details class="howto"><summary>Como fazer</summary><div class="taskdesc">${t.desc}</div>${t.materials ? tpl.mats(t.materials) : ''}</details>
</div>`,
  // "part" abre uma nova parte da rota (ex.: O Tesouro de Erebor) com um divisor antes da etapa
  part: p => `<div class="part-divider" data-part="${esc(p.id)}"><span class="part-rune" aria-hidden="true">ᛖ ᚱ ᛖ ᛒ ᛟ ᚱ</span><h2>${p.title}</h2><p>${p.text}</p></div>\n`,
  stage: (st, i) => (st.part ? tpl.part(st.part) : '') + `<article class="stage" id="etapa-${pad2(i + 1)}" data-part="${partOfStage[i]}">
<div class="stagehead"><div class="stage-num">${pad2(i + 1)}</div><div><h3>${st.title}</h3><p>${st.subtitle}</p></div><span class="chips"><span class="stage-tag">${st.tag}</span><span class="stage-count"></span></span></div>
<div class="stagebody">
${st.note ? `<div class="stage-note">${st.note}</div>\n` : ''}${st.tasks.map(tpl.task).join('\n')}
</div>
</article>`,
  mapGroup: p => `<div class="mapgroup" data-part="${p.id}"><span class="maplabel">${p.title}</span><span class="mapdots">`
    + p.stages.map(i => `<button type="button" class="mapdot" data-stage="${i}" title="${pad2(i + 1)} · ${esc(data.stages[i].title)}" aria-label="Ir para a etapa ${pad2(i + 1)}: ${esc(data.stages[i].title)}">${i + 1}</button>`).join('')
    + '</span></div>',
  tab: p => `<a class="tab" role="tab" href="#${p.id}" data-tab="${p.id}">${p.title}${p.count ? ` <span class="tabcount" data-count="${p.id}"></span>` : ''}</a>`,
  brickRow: b => `<li class="brickrow" data-unlock="${esc(b.unlock)}"><span class="brick">${b.label}</span><span class="brickinfo"><strong>${b.name}</strong><span>${b.where}</span></span><span class="brickcost">${fmtShort(b.cost)}</span></li>`,
  costRow: b => `<tr data-unlock="${esc(b.unlock)}"><td data-label="Desbloqueio"><strong>${b.tableName}</strong></td><td data-label="Item exigido">${b.item}</td>`
    + `<td data-label="Missão de entrega">${b.quest}</td><td data-label="Local / horário">${b.where}</td><td data-label="Custo">${fmtInt(b.cost)}</td></tr>`,
  pill: (strong, text) => `<span class="pill">${strong ? `<strong>${strong}</strong> ` : ''}${text}</span>`,
};

// Soma dos materiais: obrigatórios x cada grupo de etapas opcionais (ex.: Express Delivery, O Tesouro de Erebor)
function materialTotals() {
  const req = {}, extra = {};
  data.stages.forEach(st => st.tasks.forEach(t => (t.materials || []).forEach(([k, n]) => {
    const bucket = st.optional ? (extra[st.optional] = extra[st.optional] || {}) : req;
    bucket[k] = (bucket[k] || 0) + n;
  })));
  const groups = Object.keys(extra);
  const order = data.materials.map(m => m.key).filter(k => req[k] || groups.some(g => extra[g][k]));
  // Mithril Bricks primeiro; depois do mais necessário ao menos (empate: ordem do catálogo)
  order.sort((a, b) => (b === 'mithril') - (a === 'mithril') || (req[b] || 0) - (req[a] || 0) || order.indexOf(a) - order.indexOf(b));
  return { req, extra, groups, order };
}

function render() {
  $('heroMeta').innerHTML = lines([
    tpl.pill(multipliers.length, 'multiplicadores'),
    tpl.pill(fmtShort(sum(multipliers)), 'studs para comprar todos'),
    tpl.pill('', 'Checklist com progresso local')]);

  $('bricks').innerHTML = lines(mainBricks.map(tpl.brickRow));
  $('bricksMore').innerHTML = lines(moreBricks.map(tpl.brickRow));
  $('vaultMore').hidden = !moreBricks.length;
  $('vaultMoreTitle').textContent = parts[1] ? parts[1].title : 'Extras';

  $('tabs').innerHTML = [...parts.map(p => tpl.tab({ ...p, count: true })), tpl.tab({ id: 'referencia', title: 'Referência' })].join('');
  $('journeyMap').innerHTML = parts.map(tpl.mapGroup).join('');
  $('stages').innerHTML = lines(data.stages.map(tpl.stage));

  const partTitle = parts[1] ? parts[1].title : 'Extras';
  $('costRows').innerHTML = lines(mainBricks.map(tpl.costRow)) + (moreBricks.length
    ? `<tr class="grouprow"><th colspan="5" scope="rowgroup">${partTitle} · ${moreBricks.length} Red Bricks</th></tr>` + lines(moreBricks.map(tpl.costRow)) : '');

  const others = mainBricks.filter(b => !b.multiplier);
  $('budget').innerHTML = `<strong>Orçamento de referência:</strong> os ${numWord(multipliers.length)} multiplicadores custam ${fmtInt(sum(multipliers))} studs no total. `
    + `Incluindo ${others.map(b => b.name).join(' e ')}, a rota principal soma ${fmtInt(sum(mainBricks))} studs.`
    + (moreBricks.length ? ` Os ${moreBricks.length} Red Bricks de <em>${partTitle}</em> custam mais ${fmtInt(sum(moreBricks))} studs, ${fmtInt(sum(bricks))} no total, o que é pouco com o x10 ligado.` : '')
    + ' Sem contar personagens, materiais ou outras compras.';

  const mt = materialTotals();
  $('matGrid').innerHTML = lines(mt.order.map(k => {
    const small = mt.groups.filter(g => mt.extra[g][k]).map(g => `<small>+${mt.extra[g][k]} com ${g}</small>`).join('');
    return `<div class="mat${k === 'mithril' ? ' key' : ''}"><strong>${mt.req[k] || '—'}</strong><span>${cap(matName[k])}</span>${small}</div>`;
  }));

  $('sourceList').innerHTML = lines(data.sources.map(s => `<li>${s}</li>`));
  $('confirmList').innerHTML = lines(data.confirm.map(s => `<li>${s}</li>`));
}

render();

// =====================================================================
// COMPORTAMENTO
// =====================================================================
const boxes = [...document.querySelectorAll('.task input[data-id]')];
const byId = Object.fromEntries(boxes.map(b => [b.dataset.id, b]));
const stages = [...document.querySelectorAll('.stage')];
const stageOf = b => b.closest('.stage');
const unlockEls = [...document.querySelectorAll('[data-unlock]')];
const mapDots = [...document.querySelectorAll('.mapdot')];
const state = { tab: 'jornada', hideDone: read(HIDE_KEY) === '1' };

// --- Etapas: só a etapa atual de cada parte fica aberta, salvo escolha do usuário ---
const view = readJSON(VIEW_KEY, {});
const saveView = () => store(VIEW_KEY, JSON.stringify(view));
const isDone = st => [...st.querySelectorAll('input[data-id]')].every(b => b.checked);
const currentStage = partId => stages.find(st => st.dataset.part === partId && !isDone(st));
const collapse = collapsible({
  groups: stages, headSelector: '.stagehead',
  isCollapsed: st => {
    const v = view[stages.indexOf(st)];
    return v ? v === 'closed' : st !== currentStage(st.dataset.part);
  },
  onToggle: (st, c) => { view[stages.indexOf(st)] = c ? 'closed' : 'open'; saveView(); },
});

// --- Checklist ---
const list = createChecklist({
  boxes, groups: stages, countSelector: '.stage-count',
  itemOf: b => b.closest('.task'),
  ...storeAsList(STORAGE_KEY),
  keep: b => stageOf(b).dataset.part === state.tab && !(state.hideDone && b.checked),
  emptyState: $('emptyState'),
  onUpdate: updateProgress,
  afterFilter: afterFilter,
});

// Depois de cada busca/filtro: abre o que a busca encontrou e esconde divisores vazios
function afterFilter(q) {
  if (q) {
    stages.forEach(st => { if (!st.hidden) collapse.show(st, false); });
    boxes.forEach(b => {
      const how = b.closest('.task').querySelector('.howto');
      const hit = norm(how.textContent).includes(q);
      if (hit && !how.open) { how.open = true; how.dataset.auto = '1'; }
      else if (!hit && how.dataset.auto) { how.open = false; delete how.dataset.auto; }
    });
  } else {
    collapse.refresh();
    document.querySelectorAll('.howto[data-auto]').forEach(h => { h.open = false; delete h.dataset.auto; });
  }
  document.querySelectorAll('.part-divider').forEach(div => {
    div.hidden = div.dataset.part !== state.tab || !stages.some(st => st.dataset.part === div.dataset.part && !st.hidden);
  });
  // Busca sem resultado aqui: avisa se há resultados na outra parte
  const hint = $('emptyHint');
  hint.innerHTML = '';
  if (q && !$('emptyState').hidden) {
    parts.filter(p => p.id !== state.tab).forEach(p => {
      const n = boxes.filter(b => stageOf(b).dataset.part === p.id && norm(b.closest('.task').textContent).includes(q)).length;
      if (n) hint.insertAdjacentHTML('beforeend', `<button type="button" class="btn" data-goto-tab="${p.id}">Ver ${n} em ${p.title}</button>`);
    });
  }
}
$('emptyHint').addEventListener('click', e => { const b = e.target.closest('[data-goto-tab]'); if (b) setTab(b.dataset.gotoTab); });

// Progresso: texto, mapa da jornada, abas, Red Bricks
function updateProgress() {
  const { done, total } = list.stats();
  $('progressText').innerHTML = `<strong>${done}</strong> de ${total} tarefas concluídas · ${total ? Math.round(done / total * 100) : 0}%`;
  parts.forEach(p => {
    const s = list.stats(boxes.filter(b => stageOf(b).dataset.part === p.id));
    document.querySelector(`[data-count="${p.id}"]`).textContent = `${s.done}/${s.total}`;
  });
  const current = new Set(parts.map(p => currentStage(p.id)));
  mapDots.forEach(dot => {
    const st = stages[+dot.dataset.stage], s = list.stats(list.boxesOf(st));
    dot.style.setProperty('--p', Math.round(s.done / s.total * 100));
    dot.classList.toggle('done', s.done === s.total);
    dot.classList.toggle('current', current.has(st));
  });
  unlockEls.forEach(el => el.classList.toggle(el.tagName === 'TR' ? 'unlocked' : 'on', !!(byId[el.dataset.unlock] && byId[el.dataset.unlock].checked)));
  const lit = sel => document.querySelectorAll(`${sel} .brickrow.on`).length;
  $('vaultCount').textContent = `${lit('.vault')}/${bricks.length}`;
  $('vaultMoreCount').textContent = `${lit('#bricksMore')}/${moreBricks.length}`;
}

// Etapa concluída se recolhe sozinha (se o usuário não tiver escolhido deixá-la aberta) e a próxima abre
boxes.forEach(b => b.addEventListener('change', () => { if (!list.query) collapse.refresh(); }));

// --- Abas ---
function setTab(tab, { scrollTo, save = true } = {}) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(a => a.setAttribute('aria-selected', String(a.dataset.tab === tab)));
  $('panelRoute').hidden = tab === 'referencia';
  $('panelRef').hidden = tab !== 'referencia';
  if (save) store(TAB_KEY, tab);
  if (location.hash.slice(1) !== tab && !scrollTo) history.replaceState(null, '', '#' + tab);
  list.filter();
  syncExpandBtn();
  if (scrollTo) requestAnimationFrame(() => $(scrollTo).scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
function fromHash() {
  const h = location.hash.slice(1);
  if (TABS.includes(h)) return setTab(h, { scrollTo: 'tabs' });
  if (LEGACY[h]) return setTab(LEGACY[h][0], { scrollTo: LEGACY[h][1] || 'tabs' });
  const m = h.match(/^etapa-(\d+)$/);
  if (m && stages[+m[1] - 1]) return goToStage(+m[1] - 1);
  return false;
}
window.addEventListener('hashchange', fromHash);

// --- Navegação: mapa, continuar, ir para tarefa ---
function reveal(task) {
  if (task.hidden) { state.hideDone = false; syncHideBtn(); list.clearQuery(); $('searchInput').value = ''; list.filter(); }
}
function goToStage(i) {
  const st = stages[i];
  if (state.tab !== st.dataset.part) setTab(st.dataset.part, { save: true });
  if (st.hidden) { state.hideDone = false; syncHideBtn(); list.clearQuery(); $('searchInput').value = ''; list.filter(); }
  collapse.show(st, false);
  st.scrollIntoView({ behavior: 'smooth', block: 'start' });
  flash(st);
}
function goToTask(task) {
  const st = task.closest('.stage');
  if (state.tab !== st.dataset.part) setTab(st.dataset.part);
  reveal(task);
  collapse.show(st, false);
  task.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flash(task);
}
$('journeyMap').addEventListener('click', e => { const d = e.target.closest('.mapdot'); if (d) goToStage(+d.dataset.stage); });
$('continueBtn').addEventListener('click', () => {
  const next = boxes.find(b => !b.checked);
  if (next) goToTask(next.closest('.task'));
});

// --- Ferramentas: ocultar concluídas, busca, menu ⋯ ---
function syncHideBtn() { $('hideDoneBtn').setAttribute('aria-pressed', String(state.hideDone)); }
$('hideDoneBtn').addEventListener('click', () => { state.hideDone = !state.hideDone; store(HIDE_KEY, state.hideDone ? '1' : '0'); syncHideBtn(); list.filter(); });
$('searchInput').addEventListener('input', e => list.setQuery(e.target.value));

const tabStages = () => stages.filter(st => st.dataset.part === state.tab);
function syncExpandBtn() { $('expandBtn').textContent = collapse.allOpen(tabStages()) ? 'Recolher tudo' : 'Expandir tudo'; }
const setAllInTab = collapsed => { tabStages().forEach(st => { view[stages.indexOf(st)] = collapsed ? 'closed' : 'open'; }); saveView(); collapse.refresh(); syncExpandBtn(); };
$('expandBtn').addEventListener('click', () => setAllInTab(collapse.allOpen(tabStages())));
$('currentOnlyBtn').addEventListener('click', () => { tabStages().forEach(st => { delete view[stages.indexOf(st)]; }); saveView(); collapse.refresh(); syncExpandBtn(); });
$('printBtn').addEventListener('click', () => window.print());
// Na impressão, o "Como fazer" de todas as tarefas aparece aberto
let closedHowtos = [];
window.addEventListener('beforeprint', () => { closedHowtos = [...document.querySelectorAll('.howto:not([open])')]; closedHowtos.forEach(h => { h.open = true; }); });
window.addEventListener('afterprint', () => { closedHowtos.forEach(h => { h.open = false; }); });
$('resetBtn').addEventListener('click', () => {
  if (confirm('Deseja limpar todas as marcações do checklist?')) { list.reset(); forget(STORAGE_KEY); collapse.refresh(); }
});
// Fecha o menu ⋯ ao escolher uma opção ou clicar fora
const moreMenu = $('moreMenu');
moreMenu.addEventListener('click', e => { if (e.target.closest('button')) moreMenu.open = false; });
document.addEventListener('click', e => { if (!moreMenu.contains(e.target)) moreMenu.open = false; });
stages.forEach(st => st.querySelector('.stagehead').addEventListener('click', syncExpandBtn));

// --- Início ---
syncHideBtn();
list.update();
collapse.refresh();
if (fromHash() === false) {
  const saved = read(TAB_KEY);
  setTab(TABS.includes(saved) ? saved : 'jornada', { save: false });
}
