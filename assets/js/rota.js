// Página da rota (index.html): monta o conteúdo a partir de data/rota.json e cuida do checklist.
// Para mudar textos, tarefas, materiais ou custos, edite data/rota.json — não este arquivo.
import { $, esc, cap, lines, fmtInt, fmtShort, numWord, pad2, loadJSON, loadError, flash, store, read, forget } from './lib/util.js';
import { renderLayout } from './lib/layout.js';
import { createChecklist, storeAsList, collapsible } from './lib/checklist.js';

// Chaves de armazenamento — NÃO alterar, para manter o progresso já salvo.
const STORAGE_KEY = 'hobbit-route-checklist-v1';
const COLLAPSED_KEY = 'hobbit-route-collapsed-v1';
const HIDE_KEY = 'hobbit-route-hide-done-v1';

// Tipo de etiqueta (data/rota.json) → classe CSS
const TAG_CLASS = { custo: 'gold', esquema: 'k-schem', forja: 'k-forge', entrega: 'k-deliv', prereq: 'k-req' };

renderLayout('rota');
let data;
try { data = await loadJSON('data/rota.json'); }
catch (err) { loadError($('stages'), err); throw err; }

// =====================================================================
// RENDERIZAÇÃO
// =====================================================================
const matName = Object.fromEntries(data.materials.map(m => [m.key, m.name]));
const sum = arr => arr.reduce((a, b) => a + b.cost, 0);
const bricks = data.redBricks;
// "group" separa os Red Bricks de uma parte extra; sem group = rota principal
const mainBricks = bricks.filter(b => !b.group), moreBricks = bricks.filter(b => b.group);
const multipliers = bricks.filter(b => b.multiplier);
const partTitle = (data.stages.find(s => s.part) || { part: { title: 'Extras' } }).part.title;

const tpl = {
  tag: g => `<span class="tag${g.type ? ' ' + TAG_CLASS[g.type] : ''}">${g.text}</span>`,
  task: t => `<label class="task"><input type="checkbox" data-id="${esc(t.id)}"><span class="taskcopy"><div class="tasktitle">${t.title}</div>`
    + `<div class="taskdesc">${t.desc}</div>`
    + (t.materials ? `<div class="mats"><b>Materiais:</b> ${t.materials.map(([k, n]) => `${n} ${matName[k]}`).join(' · ')}</div>` : '')
    + `<span class="meta">${(t.tags || []).map(tpl.tag).join('')}</span></span></label>`,
  // "part" abre uma nova parte da rota (ex.: O Tesouro de Erebor) com um divisor antes da etapa
  part: p => `<div class="part-divider"><span class="part-rune" aria-hidden="true">ᛖ ᚱ ᛖ ᛒ ᛟ ᚱ</span><h2>${p.title}</h2><p>${p.text}</p></div>\n`,
  stage: (st, i) => (st.part ? tpl.part(st.part) : '') + `<article class="stage">
<div class="stagehead"><div class="stage-num">${pad2(i + 1)}</div><div><h3>${st.title}</h3><p>${st.subtitle}</p></div><span class="chips"><span class="stage-tag">${st.tag}</span><span class="stage-count"></span></span></div>
<div class="stagebody">
${st.note ? `<div class="stage-note">${st.note}</div>\n` : ''}${st.tasks.map(tpl.task).join('\n')}
</div>
</article>`,
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
  $('vaultMoreTitle').textContent = partTitle;

  $('stages').innerHTML = lines(data.stages.map(tpl.stage));

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
// COMPORTAMENTO (checklist, studs, filtros, etapas recolhíveis)
// =====================================================================
const boxes = [...document.querySelectorAll('.task input[data-id]')];
const byId = Object.fromEntries(boxes.map(b => [b.dataset.id, b]));
const stages = [...document.querySelectorAll('.stage')];
const unlockEls = [...document.querySelectorAll('[data-unlock]')];
let hideDone = read(HIDE_KEY) === '1';

// Etapas recolhíveis; o botão sempre descreve a ação que vai executar
const expandBtn = $('expandBtn');
const syncExpandBtn = () => { expandBtn.textContent = collapse.allOpen() ? 'Recolher tudo' : 'Expandir tudo'; };
const collapse = collapsible({ groups: stages, headSelector: '.stagehead', storageKey: COLLAPSED_KEY, onChange: syncExpandBtn });
expandBtn.addEventListener('click', () => collapse.setAll(collapse.allOpen()));
syncExpandBtn();

const list = createChecklist({
  boxes, groups: stages, countSelector: '.stage-count',
  itemOf: b => b.closest('.task'),
  ...storeAsList(STORAGE_KEY),
  keep: b => !(hideDone && b.checked),
  emptyState: $('emptyState'),
  onUpdate: updateExtras,
  afterFilter: q => {
    if (q) stages.forEach(st => { if (!st.hidden) collapse.set(st, false, false); }); // busca abre as etapas com resultado (sem salvar)
    // Divisor de parte some se nenhuma etapa dela estiver visível
    document.querySelectorAll('.part-divider').forEach(div => {
      let el = div.nextElementSibling, any = false;
      while (el && !el.classList.contains('part-divider')) { if (el.classList.contains('stage') && !el.hidden) { any = true; break; } el = el.nextElementSibling; }
      div.hidden = !any;
    });
  },
});

// Studs de progresso: um por tarefa
const studs = boxes.map(b => {
  const task = b.closest('.task');
  const title = task.querySelector('.tasktitle').textContent.trim();
  const s = document.createElement('button');
  s.type = 'button'; s.className = 'stud'; s.title = title;
  s.setAttribute('aria-label', 'Ir para: ' + title);
  s.addEventListener('click', () => goTo(task));
  $('studs').appendChild(s);
  return s;
});

function goTo(task) {
  if (task.hidden) { hideDone = false; syncHideBtn(); list.clearQuery(); $('searchInput').value = ''; }
  collapse.set(task.closest('.stage'), false);
  list.filter();
  task.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flash(task);
}

function updateExtras() {
  const { done, total } = list.stats();
  $('progressText').innerHTML = `<strong>${done}</strong> de ${total} tarefas concluídas · ${total ? Math.round(done / total * 100) : 0}%`;
  boxes.forEach((b, i) => studs[i].classList.toggle('done', b.checked));
  unlockEls.forEach(el => el.classList.toggle(el.tagName === 'TR' ? 'unlocked' : 'on', !!(byId[el.dataset.unlock] && byId[el.dataset.unlock].checked)));
  const lit = sel => document.querySelectorAll(`${sel} .brickrow.on`).length;
  $('vaultCount').textContent = `${lit('.vault')}/${bricks.length}`;
  $('vaultMoreCount').textContent = `${lit('#bricksMore')}/${moreBricks.length}`;
}

// Ocultar concluídas + busca
const hideBtn = $('hideDoneBtn');
function syncHideBtn() { hideBtn.setAttribute('aria-pressed', String(hideDone)); }
hideBtn.addEventListener('click', () => { hideDone = !hideDone; store(HIDE_KEY, hideDone ? '1' : '0'); syncHideBtn(); list.filter(); });
$('searchInput').addEventListener('input', e => list.setQuery(e.target.value));
syncHideBtn();

list.update();

$('printBtn').addEventListener('click', () => window.print());
$('resetBtn').addEventListener('click', () => {
  if (confirm('Deseja limpar todas as marcações do checklist?')) { list.reset(); forget(STORAGE_KEY); }
});
