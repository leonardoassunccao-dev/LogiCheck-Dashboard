const CACHE_NAME = 'logicheck-v3';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

// Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http requests (like chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // External Resources: Cache First strategy
  if (url.hostname === 'cdn.tailwindcss.com' || url.origin !== location.origin) {
     event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
           if (cachedResponse) return cachedResponse;
           return fetch(event.request).then((networkResponse) => {
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                 return networkResponse;
              }
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, responseToCache);
              });
              return networkResponse;
           }).catch(() => {
              // Return undefined ensures we don't crash, but won't load the resource
              return undefined; 
           });
        })
     );
     return;
  }

  // Local Resources: Stale-While-Revalidate with Safe Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid responses
        if (networkResponse && networkResponse.status === 200) {
           const responseToCache = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => {
             cache.put(event.request, responseToCache);
           });
        }
        return networkResponse;
      }).catch((err) => {
         // Network failed
         console.log('Network fetch failed for', event.request.url);
         // If we don't have a cached response, we might want to fallback to index.html for navigation
         if (event.request.mode === 'navigate') {
             return caches.match('/index.html');
         }
         // Otherwise, we throw/return undefined so the cachedResponse (if any) is used
         throw err;
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    }).catch(() => {
        // Ultimate fallback if both cache and network fail
        // This prevents the "White Screen" / Uncaught in promise
        if (event.request.mode === 'navigate') {
             return caches.match('/index.html');
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});