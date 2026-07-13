// =============================================================================
// Service Worker de Odentara
// Estrategia conservadora: network-first con fallback a cache.
// - Nunca intercepta /api (datos siempre frescos, el token viaja en headers)
// - Los assets estáticos quedan cacheados como respaldo si se corta la red
// - Al cambiar CACHE_VERSION se descarta el cache viejo automáticamente
// =============================================================================

const CACHE_VERSION = "odentara-v1";

self.addEventListener("install", (event) => {
  // Activar inmediatamente la versión nueva del SW sin esperar a cerrar pestañas
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borrar caches de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo GET del mismo origen, y nunca la API
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        // Network-first: online siempre se sirve lo último
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (_err) {
        // Sin red: servir del cache si existe
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Navegación sin cache → intentar servir el shell de la app
        if (event.request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw _err;
      }
    })()
  );
});
