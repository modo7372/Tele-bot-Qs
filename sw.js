const CACHE_NAME = 'medquiz-v2.2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/ui.js',
  './js/data.js',
  './js/game.js',
  './js/main.js',
  './questions_list.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
