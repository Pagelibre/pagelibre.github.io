/* PageLibre : service worker (cache d'abord, version du cache = version de l'application) */
const CACHE = 'pagelibre-2026-11-24-01-39';
const FICHIERS = ['./', './index.html', './manifest.webmanifest', './logo.svg', './logo-petit.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './confidentialite.html'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)));
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('pagelibre-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

// la page demande d'activer la nouvelle version (bouton « Recharger »)
self.addEventListener('message', ev => { if (ev.data === 'activer') self.skipWaiting(); });

self.addEventListener('fetch', ev => {
  const r = ev.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const trouve = await c.match(r, { ignoreSearch: true });
    if (trouve) return trouve;
    try {
      const rep = await fetch(r);
      if (rep.ok) c.put(r, rep.clone());
      return rep;
    } catch (e) {
      // hors connexion : on sert l'application pour toute navigation
      if (r.mode === 'navigate') return (await c.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
