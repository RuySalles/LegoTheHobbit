// Funções compartilhadas por todas as páginas (tema, menu, armazenamento, formatação).
// Exposto como window.Hobbit para os scripts de cada página.
(function () {
  'use strict';

  // --- Armazenamento local (nunca quebra se o navegador bloquear) ---
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // --- Texto ---
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- Números no padrão brasileiro ---
  const fmtInt = n => n.toLocaleString('pt-BR');                       // 1500000 → "1.500.000"
  const fmtShort = n => n >= 1e6                                        // 1500000 → "1,5M"; 175000 → "175 mil"
    ? String(+(n / 1e6).toFixed(1)).replace('.', ',') + 'M'
    : String(+(n / 1e3).toFixed(1)).replace('.', ',') + ' mil';
  const NUM_WORDS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
  const numWord = n => NUM_WORDS[n] || String(n);

  // --- Carrega um JSON de /data (sempre revalida para pegar edições recentes) ---
  async function loadJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
    return r.json();
  }

  // --- Tema claro/escuro (o tema inicial é aplicado por theme-init.js) ---
  const THEME_KEY = 'hobbit-theme';
  function initTheme() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const btn = document.getElementById('themeBtn');
    const apply = t => {
      document.documentElement.setAttribute('data-theme', t);
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0c100d' : '#efe6d0');
      if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    };
    apply(document.documentElement.getAttribute('data-theme') || 'dark');
    if (btn) btn.addEventListener('click', () => {
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
    const btn = document.getElementById('menuBtn'), nav = document.getElementById('mainNav');
    if (!btn || !nav) return;
    const set = open => {
      nav.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      btn.textContent = open ? '✕' : '☰';
    };
    btn.addEventListener('click', () => set(!nav.classList.contains('active')));
    // Fecha ao clicar num link, apertar Esc ou voltar para tela larga
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    window.matchMedia('(min-width:761px)').addEventListener('change', e => { if (e.matches) set(false); });
  }

  // --- Destaque rápido ao pular para um item ---
  function flash(el) {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // --- Mensagem quando os dados não carregam (ex.: arquivo aberto sem servidor) ---
  function loadError(container, err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state"><strong>Não foi possível carregar o conteúdo.</strong>'
      + 'Recarregue a página. Se você abriu o arquivo direto do computador, rode um servidor local (veja o README).</div>';
  }

  window.Hobbit = { store, read, norm, esc, fmtInt, fmtShort, numWord, loadJSON, initTheme, initMenu, flash, loadError };
  initTheme();
  initMenu();
})();
