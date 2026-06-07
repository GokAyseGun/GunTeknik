// Gün Teknik ERP — Service Worker
const CACHE = 'gunteknik-v2';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/GunTeknik/']))
      .catch(() => {}) // Cache hatası uygulamayı engellemesin
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Sadece GET
  if (e.request.method !== 'GET') return;
  // Supabase API'yi cache'leme — her zaman canlı veri
  if (e.request.url.includes('supabase.co')) return;
  // Chrome extension isteklerini atla
  if (e.request.url.startsWith('chrome-extension://')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
