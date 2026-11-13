/**
 * Service Worker — Offline-First & Instant Asset Cache for Jared Verana Portfolio
 */
const CACHE_VERSION = 'jrrd-portfolio-v2';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/records.css',
    './css/interactive.css?v=2',
    './js/main.js?v=2',
    './fonts/barlow-condensed-700.woff2',
    './fonts/barlow-condensed-800.woff2',
    './fonts/dm-sans-variable.woff2',
    './images/jared-verana.webp',
    './images/dalina.webp',
    './images/ifind.webp',
    './images/quicksnap.webp'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Network-first for HTML, CSS, and JS so code/design updates show up immediately on every push
    if (
        request.mode === 'navigate' ||
        (request.headers.get('accept') || '').includes('text/html') ||
        url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/js/')
    ) {
        event.respondWith(
            fetch(request, { cache: 'no-cache' })
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    // Stale-while-revalidate for images and fonts (0ms cached loads)
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});

