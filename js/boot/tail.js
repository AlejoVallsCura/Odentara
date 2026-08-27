// =============================================================================
// tail.js — Arranque que corre al final del body.
// Separado del HTML por el mismo motivo que head.js: permitir una CSP sin
// 'unsafe-inline' en script-src.
// =============================================================================

/* Si entramos a un subdominio de clínica con un código de intercambio y la app
   no llega a resolverlo, se vuelve a app.<dominio> en vez de dejar la pantalla
   colgada. */
(function () {
    var parts = window.location.hostname.split('.');
    var PLATFORM = ['www', 'admin', 'platform', 'api', 'app'];
    var isClinic = parts.length >= 3 && !PLATFORM.includes(parts[0]);
    if (isClinic && new URLSearchParams(window.location.search).has('__exchange')) {
        window.__clinicFallback = setTimeout(function () {
            window.location.href = window.location.protocol + '//app.' + parts.slice(-2).join('.') + '/';
        }, 8000);
    }
})();

/* PWA: registro del service worker (no bloquea la carga) */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
}
