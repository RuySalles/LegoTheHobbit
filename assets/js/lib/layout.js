// Cabeçalho, menu e rodapé de todas as páginas, montados num lugar só.
// Cada página tem só <header class="topbar" id="topbar"></header> e <footer id="footer"></footer>.
import { $, store, read } from './util.js';

// Links do menu principal. "page" é a página onde o link mora (rota = index.html).
const NAV = [
  { label: 'Jornada', page: 'rota', hash: 'jornada' },
  { label: 'O Tesouro de Erebor', page: 'rota', hash: 'tesouro' },
  { label: 'Referência', page: 'rota', hash: 'referencia' },
  { label: 'Conquistas', page: 'conquistas' },
];
const FILES = { rota: 'index.html', conquistas: 'conquistas.html' };

const FOOTER = 'LEGO The Hobbit · Guia comunitário não oficial. LEGO, nomes e ícones de conquistas pertencem aos seus respectivos proprietários. '
  + 'Esta página não é afiliada nem endossada pela LEGO, Warner Bros. ou Valve.';

const ICON_SUN = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

// Link de um item do menu, relativo à página atual
function href(item, current) {
  if (!item.hash) return FILES[item.page];
  return `${item.page === current ? '' : FILES[item.page]}#${item.hash}`;
}

export function renderLayout(current) {
  const links = NAV.map(item => {
    const here = item.page === current && !item.hash ? ' aria-current="page"' : '';
    return `<a href="${href(item, current)}"${here}>${item.label}</a>`;
  }).join('');
  $('topbar').innerHTML = `
 <div class="wrap topinner">
  <a class="brand" href="${current === 'rota' ? '#top' : FILES.rota}"><span class="brandmark"><span>✦</span></span><span>Middle-earth field guide</span></a>
  <nav class="nav" id="mainNav" aria-label="Navegação principal">${links}</nav>
  <div class="top-actions">
   <button class="iconbtn" id="themeBtn" type="button" aria-label="Alternar tema claro/escuro">${ICON_SUN}${ICON_MOON}</button>
   <button class="iconbtn menu-toggle" id="menuBtn" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button>
  </div>
 </div>
 <div class="topprogress" aria-hidden="true"><i id="topFill"></i></div>`;
  $('footer').innerHTML = `<div class="footerline"></div><p>${FOOTER}</p>`;
  initTheme();
  initMenu();
}

// --- Tema claro/escuro (o tema inicial é aplicado por theme-init.js, antes da pintura) ---
const THEME_KEY = 'hobbit-theme';
function initTheme() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const btn = $('themeBtn');
  const apply = t => {
    document.documentElement.setAttribute('data-theme', t);
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0c100d' : '#efe6d0');
    btn.setAttribute('aria-label', t === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
  };
  apply(document.documentElement.getAttribute('data-theme') || 'dark');
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next); store(THEME_KEY, next);
  });
  // Sem preferência salva: acompanha o sistema
  if (!read(THEME_KEY) && window.matchMedia) {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
      if (!read(THEME_KEY)) apply(e.matches ? 'light' : 'dark');
    });
  }
}

// --- Menu "hambúrguer" do celular ---
function initMenu() {
  const btn = $('menuBtn'), nav = $('mainNav');
  const set = open => {
    nav.classList.toggle('active', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    btn.textContent = open ? '✕' : '☰';
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('active')));
  // Fecha ao clicar num link, apertar Esc ou voltar para tela larga
  nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width:761px)').addEventListener('change', e => { if (e.matches) set(false); });
}

// Atualiza a barrinha de progresso do topo (0–100)
export const setTopProgress = pct => { $('topFill').style.width = pct + '%'; };
