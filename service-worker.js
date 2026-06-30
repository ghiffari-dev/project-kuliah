const CACHE_NAME = 'moneytrack-cache-v3';

// Aset lokal yang wajib di-cache untuk offline
const LOCAL_ASSETS = [
  './',
  './index.html',
  './db.js',
  './script.js',
  './manifest.json',
  './css/output.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/tailwind.min.js',
  './vendor/chart.umd.min.js',
  './vendor/lucide.min.js',
];

// Tidak ada CDN lagi — semua sudah lokal
const CDN_ORIGINS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache local assets; lanjutkan meski css/output.css belum ada (opsional)
        return Promise.allSettled(
          LOCAL_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Gagal cache:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCDN = CDN_ORIGINS.includes(url.hostname);

  if (isCDN) {
    // Strategi: Network-first untuk CDN, fallback ke cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategi: Cache-first untuk aset lokal
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, copy).catch(() => {})
            );
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});