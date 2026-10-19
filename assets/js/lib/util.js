// Utilitários compartilhados por todas as páginas: DOM, armazenamento, texto e números.

export const $ = id => document.getElementById(id);

// --- Armazenamento local (nunca quebra se o navegador bloquear) ---
export const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
export const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const forget = k => { try { localStorage.removeItem(k); } catch (e) {} };
export function readJSON(k, fallback) {
  try { const v = JSON.parse(read(k)); return v ?? fallback; } catch (e) { return fallback; }
}

// --- Texto ---
export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const lines = arr => '\n' + arr.join('\n') + '\n';

// --- Números no padrão brasileiro ---
export const fmtInt = n => n.toLocaleString('pt-BR');                  // 1500000 → "1.500.000"
export const fmtShort = n => n >= 1e6                                   // 1500000 → "1,5M"; 175000 → "175 mil"
  ? String(+(n / 1e6).toFixed(1)).replace('.', ',') + 'M'
  : String(+(n / 1e3).toFixed(1)).replace('.', ',') + ' mil';
const NUM_WORDS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
export const numWord = n => NUM_WORDS[n] || String(n);
export const pad2 = n => String(n).padStart(2, '0');

// --- Carrega um JSON de /data (sempre revalida para pegar edições recentes) ---
export async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  return r.json();
}

// --- Destaque rápido ao pular para um item ---
export function flash(el) {
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

// --- Mensagem quando os dados não carregam (ex.: arquivo aberto sem servidor) ---
export function loadError(container, err) {
  console.error(err);
  container.hidden = false;
  container.innerHTML = '<div class="empty-state"><strong>Não foi possível carregar o conteúdo.</strong>'
    + 'Recarregue a página. Se você abriu o arquivo direto do computador, rode um servidor local (veja o README).</div>';
}
