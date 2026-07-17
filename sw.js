/* Klass service worker — precaches the whole app for offline use.
   Bump CACHE_VERSION whenever any file changes so installed clients update. */

const CACHE_VERSION = 'klass-v2';

const PRECACHE = [
    './',
    './index.html',
    './KRandom.html',
    './KAssignTeam.html',
    './KPresenter.html',
    './KSeatingChart.html',
    './manifest.webmanifest',
    './chime.mp3',
    './assets/tailwind.js',
    './assets/theme.js',
    './assets/app.js',
    './assets/klass.css',
    './assets/fonts/inter.css',
    './assets/fonts/InterVariable.woff2',
    './assets/fontawesome/css/all.min.css',
    './assets/fontawesome/webfonts/fa-solid-900.woff2',
    './assets/fontawesome/webfonts/fa-solid-900.ttf',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok && new URL(event.request.url).origin === self.location.origin) {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
                }
                return response;
            });
        })
    );
});
