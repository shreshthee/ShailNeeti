// ShailNeeti SW – stale-while-revalidate for questions
const VERSION = 'sn-v3';
const CORE = [
  './','./index.html','./main.jsx','./manifest.webmanifest',
  './ganesh.png','./favicon-16.png','./favicon-32.png','./apple-touch-icon.png',
  './questions-index.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // questions: stale-while-revalidate
  if (url.pathname.includes('/questions/')) {
    e.respondWith((async ()=>{
      const cache = await caches.open(VERSION);
      const cached = await cache.match(e.request);
      const net = fetch(e.request).then(r=>{ cache.put(e.request, r.clone()); return r; }).catch(()=>cached);
      return cached || net;
    })());
    return;
  }
  // index list: SWR
  if (url.pathname.endsWith('/questions-index.json')) {
    e.respondWith((async ()=>{
      const cache = await caches.open(VERSION);
      const cached = await cache.match(e.request);
      const net = fetch(e.request).then(r=>{ cache.put(e.request, r.clone()); return r; }).catch(()=>cached);
      return cached || net;
    })());
    return;
  }
  // default: network-first
  e.respondWith((async ()=>{
    try { const r = await fetch(e.request); const c=await caches.open(VERSION); c.put(e.request, r.clone()); return r; }
    catch { const cached = await caches.match(e.request); return cached || Response.error(); }
  })());
});