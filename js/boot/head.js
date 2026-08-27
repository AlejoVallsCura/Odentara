// =============================================================================
// head.js — Lo que tiene que correr ANTES de que el DOM se pinte.
// Vive en un archivo aparte y no como <script> inline para poder sacar
// 'unsafe-inline' de script-src en la CSP: con eso, un XSS que inyecte una
// etiqueta <script> queda bloqueado por el navegador.
// Se carga sin defer a propósito — el tema tiene que aplicarse antes del render.
// =============================================================================

/* Aplica theme-dark en <html> antes de que el DOM renderice — evita el
   destello blanco al entrar (FOUC). */
(function () {
    try {
        var t = localStorage.getItem('theme');
        if (t === 'dark' || t === null) document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) {}
})();

/* Turnstile carga async y llama a este callback cuando está listo. Tiene que
   existir antes de que se ejecute su script. */
window._turnstileReadyFlag = false;
window._turnstileOnLoad = function () {
    window._turnstileReadyFlag = true;
    if (typeof window._renderTurnstile === 'function') window._renderTurnstile();
};
