const CACHE_NAME = 'libravault-pwa-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Completely bypass Cache API because Electron quota database corruption
  // causes caches.match() to hang forever, leading to a black screen.
  event.respondWith(fetch(event.request));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
