const CACHE_NAME = 'medquiz-v11';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/ui.js',
  './js/game.js',
  './questions_list.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (!key.includes(CACHE_NAME)) return caches.delete(key);
      })
    ))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
