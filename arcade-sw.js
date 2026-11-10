/* Miki's Arcade — service worker.
 * Precaches the arcade shell (and the self-contained CANDELA game) so the
 * installed app opens instantly and works offline. Everything else — the
 * heavy Unity/WASM games, the external tool pages — is passed straight to
 * the network and never cached, so storage stays small and nothing goes
 * stale on the rest of the site. */
const CACHE = 'mb-arcade-v1';

// Core shell: must all exist, loaded atomically on install.
const CORE = [
  '/arcade.html',
  '/css/style.css',
  '/js/sidebar.js',
  '/js/fx.js',
  '/data.json',
  '/candela/',
  '/images/arcade-icon-192.png',
  '/images/arcade-icon-512.png'
];
// Nice-to-have (cabinet covers): best-effort, a miss won't fail install.
const EXTRA = [
  '/images/logo512.jpg',
  '/images/arcade/candela.svg',
  '/images/arcade/spacefrogs.jpg',
  '/images/arcade/hungry.jpg',
  '/images/arcade/somanyrockers.jpg',
  '/images/arcade/killerracoon.svg',
  '/images/arcade/barcodebattler.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(EXTRA.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Only manage the shell + CANDELA; pass everything else through untouched.
function managed(path) {
  return CORE.includes(path) || EXTRA.includes(path) ||
    path === '/arcade.html' || path.startsWith('/candela/');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // cross-origin → network
  if (!managed(url.pathname)) return;                    // other pages/games → network

  // Navigations to the arcade / CANDELA: network-first, fall back to cache
  // (so updates land, but it still opens offline).
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const copy = net.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return net;
      } catch (_) {
        return (await caches.match(req)) ||
               (await caches.match('/arcade.html'));
      }
    })());
    return;
  }

  // Shell assets: cache-first, refill on first network hit.
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      const copy = net.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return net;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
