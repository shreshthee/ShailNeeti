// ShailNeeti SW - fast updates + cache-first for chapter files
const CACHE = 'shailneeti-v5';
const CORE = [
  './','./index.html','./main.jsx',
  './questions-index.json',
  './ganesh.png',
  './favicon-16.png','./favicon-32.png',
  './icon-192.png','./icon-512.png','./apple-touch-icon.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

// chapter JSON: cache-first; other requests: network-first
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.pathname.includes('/questions/')){
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(r=>{
        const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;
      }))
    );
  } else {
    e.respondWith(
      fetch(e.request).catch(()=>caches.match(e.request))
    );
  }
});