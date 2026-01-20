const CACHE_NAME = 'medquiz-core-v5';
// Important files to cache immediately
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
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
    // Clear old caches to save space and ensure updates
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => {
                if (k !== CACHE_NAME) return caches.delete(k);
            })
        ))
    );
});

// Cache-First Strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                return caches.open(CACHE_NAME).then(cache => {
                    // Dynamically cache questions/*.json
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        })
    );
});
