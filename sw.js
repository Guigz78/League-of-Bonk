// Service worker : le jeu fonctionne entièrement hors connexion.
const VERSION = 'lob-v15';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/supabase.min.js',
  'js/main.js', 'js/game.js', 'js/run.js', 'js/g2d/renderer.js', 'js/g2d/sprites.js', 'js/g2d/world.js', 'js/g2d/items.js', 'js/g2d/preview.js', 'js/data.js', 'js/save.js', 'js/cloud.js', 'js/config.js',
  'js/art.js', 'js/pixel.js', 'js/ui.js', 'js/audio.js', 'js/ads.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/lilita-one-latin.woff2', 'fonts/lilita-one-latin-ext.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API cloud : réseau direct
  // cache d'abord (démarrage instantané), mise à jour en arrière-plan pour le prochain lancement
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || cache.match('index.html');
  }));
});
