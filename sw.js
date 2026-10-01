const CACHE_NAME = 'engvocab-cache-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './detail.html',
  './flashcard.html',
  './learn.html',
  './test.html',
  './style.css',
  './manifest.json',
  './js/state.js',
  './js/theme.js',
  './js/filesync.js',
  './js/progress.js',
  './js/helpers.js',
  './js/main.js',
  './js/views/home.js',
  './js/views/detail.js',
  './js/views/editor.js',
  './js/views/flashcards.js',
  './js/views/learn.js',
  './js/views/test.js',
  './js/views/results.js',
  './font/font-times-new-roman.ttf'
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
  // Ignore non-GET requests and requests that aren't for the same origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, fetch from network and cache it
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});
