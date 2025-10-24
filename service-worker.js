// ShailNeeti - Service Worker
const CACHE = 'shailneeti-v3';

const CORE = [
  './',
  './index.html',
  './main.jsx',
  './questions-index.json',
  './ganesh.png',
  './favicon-16.png',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});

// Cache-first for chapter JSON; network-first for anything else
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.pathname.startsWith('/questions/')){
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(r=>{
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return r;
      }))
    );
  }else{
    e.respondWith(
      fetch(e.request).catch(()=>caches.match(e.request))
    );
  }
});