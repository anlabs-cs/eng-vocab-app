const CACHE_NAME = 'engvocab-cache-v8';
const PRECACHE_URLS = [
  './',
  './index.html',
  './detail.html',
  './style.css',
  './fonts.css',
  './manifest.json',
  './js/state.js',
  './js/theme.js',
  './js/drivesync.js',
  './js/progress.js',
  './js/helpers.js',
  './js/layout.js',
  './js/main.js',
  './js/views/home.js',
  './js/views/detail.js',
  './js/views/editor.js',
  './js/views/flashcards.js',
  './js/views/learn.js',
  './js/views/test.js',
  './js/views/results.js',
  './fonts/be-vietnam-pro-latin-400-normal.woff2',
  './fonts/be-vietnam-pro-latin-500-normal.woff2',
  './fonts/be-vietnam-pro-latin-600-normal.woff2',
  './fonts/be-vietnam-pro-latin-700-normal.woff2',
  './fonts/be-vietnam-pro-latin-ext-400-normal.woff2',
  './fonts/be-vietnam-pro-latin-ext-500-normal.woff2',
  './fonts/be-vietnam-pro-latin-ext-600-normal.woff2',
  './fonts/be-vietnam-pro-latin-ext-700-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-400-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-500-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-600-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-700-normal.woff2',
  './fonts/lora-latin-500-italic.woff2',
  './fonts/lora-latin-500-normal.woff2',
  './fonts/lora-latin-600-italic.woff2',
  './fonts/lora-latin-600-normal.woff2',
  './fonts/lora-latin-700-normal.woff2',
  './fonts/lora-latin-ext-500-italic.woff2',
  './fonts/lora-latin-ext-500-normal.woff2',
  './fonts/lora-latin-ext-600-italic.woff2',
  './fonts/lora-latin-ext-600-normal.woff2',
  './fonts/lora-latin-ext-700-normal.woff2',
  './fonts/lora-vietnamese-500-italic.woff2',
  './fonts/lora-vietnamese-500-normal.woff2',
  './fonts/lora-vietnamese-600-italic.woff2',
  './fonts/lora-vietnamese-600-normal.woff2',
  './fonts/lora-vietnamese-700-normal.woff2',
  './fonts/patrick-hand-latin-400-normal.woff2',
  './fonts/patrick-hand-latin-ext-400-normal.woff2',
  './fonts/patrick-hand-vietnamese-400-normal.woff2',
  './img/icon/arrow-right-left.png',
  './img/icon/arrow-right.png',
  './img/icon/check.png',
  './img/icon/chevron-down.png',
  './img/icon/chevron-left.png',
  './img/icon/chevron-right.png',
  './img/icon/chevron-up.png',
  './img/icon/clipboard-list.png',
  './img/icon/download.png',
  './img/icon/icon-512.png',
  './img/icon/import.png',
  './img/icon/keyboard.png',
  './img/icon/lightbulb.png',
  './img/icon/menu.png',
  './img/icon/moon.png',
  './img/icon/pencil.png',
  './img/icon/plus.png',
  './img/icon/rotate-ccw.png',
  './img/icon/search.png',
  './img/icon/settings.png',
  './img/icon/share-2.png',
  './img/icon/shuffle.png',
  './img/icon/star1.png',
  './img/icon/star2.png',
  './img/icon/sun.png',
  './img/icon/undo.png',
  './img/icon/volume-2.png',
  './img/icon/x.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network first so code changes show up right away; fall back to cache when offline.
  // cache:'no-cache' revalidates with the server (cheap 304) instead of trusting the
  // browser's heuristic HTTP cache, which can otherwise serve stale JS for days.
  const fresh = event.request.mode === 'navigate'
    ? new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(event.request, { cache: 'no-cache' });
  event.respondWith(
    fetch(fresh).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
