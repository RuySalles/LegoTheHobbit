// Aplica o tema salvo (ou o do sistema) antes da página ser pintada, para não "piscar".
// Carregado sem defer no <head> de todas as páginas.
(function () {
  var t = null;
  try { t = localStorage.getItem('hobbit-theme'); } catch (e) {}
  if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
