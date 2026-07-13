const CACHE_NAME = 'mamones-cache-v1';
const ARCHIVOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(nombres=>
      Promise.all(nombres.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event)=>{
  event.respondWith(
    caches.match(event.request).then(respuesta => respuesta || fetch(event.request))
  );
});
