const CACHE = 'medquiz-v3.2-full'; // Bump this
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/data.js',
  './js/ui.js',
  './js/game-select.js',
  './js/game-engine.js',
  './js/main.js',
  './questions_list.json'
  // questions cached dynamically upon fetch
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).then(res => {
            return caches.open(CACHE).then(cache => {
                cache.put(e.request, res.clone());
                return res;
            });
        }))
    );
});
