const CACHE_NAME = 'medquiz-v3.0-core';
const CACHE_QUESTIONS = 'medquiz-v3-questions';

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
    './manifest.json',
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
    // Cleanup old caches
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if(key !== CACHE_NAME && key !== CACHE_QUESTIONS) return caches.delete(key);
            })
        ))
    );
});

self.addEventListener('fetch', event => {
    // Strategy: Cache First, Network Fallback
    // Specifically handle Question JSONs in the separate bucket if they were manually downloaded
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(networkRes => {
                return networkRes; 
                // Note: We don't auto-cache fetched questions to save space unless user explicitly clicked "Download" in UI
            });
        })
    );
});
