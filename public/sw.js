// Same-origin app cache. A complete first online visit makes the app readable offline.
const ROOT = new URL('./', self.location.href);
const PREFIX = `tangtou-${encodeURIComponent(ROOT.pathname)}-`;
const CACHE = `${PREFIX}v2`;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'].map(path => new URL(path, ROOT).href))));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match(new URL('index.html', ROOT).href) : null) || Response.error();
  }));
});
