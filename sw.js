// Service worker : le jeu fonctionne entièrement hors connexion.
const VERSION = 'lob-v30';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/supabase.min.js',
  'js/main.js', 'js/game.js', 'js/run.js', 'js/giga.js', 'js/visuals.js', 'vendor/three.module.min.js',
  'js/g3d/fx.js', 'js/g3d/fx-c1.js', 'js/g3d/fx-c2.js', 'js/g3d/index.js', 'js/g3d/kit.js', 'js/g3d/layout.js', 'js/g3d/models-bosses.js', 'js/g3d/models-heroes.js', 'js/g3d/models-heroes-c1.js', 'js/g3d/models-heroes-c2.js', 'js/g3d/models-kit.js', 'js/g3d/models-monsters.js', 'js/g3d/models.js', 'js/g3d/objects.js', 'js/g3d/overlay.js', 'js/g3d/portraits.js', 'js/g3d/preview.js', 'js/g3d/renderer.js', 'js/g3d/stand-in.js', 'js/g3d/tex2d.js', 'js/g3d/world.js', 'js/data.js', 'js/save.js', 'js/cloud.js', 'js/config.js',
  'js/art.js', 'js/pixel.js', 'js/ui.js', 'js/audio.js', 'js/ads.js', 'js/daily.js', 'js/native.js', 'js/unlocks.js', 'js/mastery.js', 'js/abyss.js', 'js/season.js', 'js/season-ui.js', 'js/story.js', 'js/champions-c1.js', 'js/champions-c2.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/lilita-one-latin.woff2', 'fonts/lilita-one-latin-ext.woff2', 'fonts/rajdhani-500.woff2', 'fonts/rajdhani-600.woff2', 'fonts/rajdhani-700.woff2',
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
