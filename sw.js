/* 墨读 · Service Worker（离线可用） */
const VER = 'modu-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/font-kai.css',
  './js/main.js',
  './js/store.js',
  './js/shelf.js',
  './js/reader.js',
  './js/ui.js',
  './assets/books/index.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 导航请求：网络优先，离线回落壳
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          caches.open(VER).then((c) => c.put('./index.html', r.clone())).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 静态资源 / 书籍：缓存优先，后台更新
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((r) => {
          if (r && r.ok) caches.open(VER).then((c) => c.put(req, r.clone())).catch(() => {});
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});