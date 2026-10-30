// Gün Teknik ERP — Service Worker
const CACHE = 'gunteknik-v8';
// El Kitabı sahada çekim yokken de açılsın diye kurulumda önbelleğe alınır
const ELKITABI = ['elkitabi/index.html','elkitabi/hesap.html','elkitabi/semalar.html','elkitabi/teori.html','elkitabi/ortak.css','elkitabi/ortak.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all([c.add('/GunTeknik/').catch(() => {})].concat(
        ELKITABI.map(y => c.add(new Request(new URL(y, self.registration.scope).href, {cache:'reload'})).catch(() => {}))
      )))
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
  // Google Haritalar ve hava servisi: tarayıcı kendi önbelleğini kullanır (harita döşemeleri burada birikmesin)
  if (/googleapis\.com|gstatic\.com|google\.com\/maps|open-meteo\.com/.test(e.request.url)) return;

  // Sürüm numaralı kütüphaneler (grafik, QR okuyucu) hiç değişmez: önce önbellek, yoksa ağ
  const u = e.request.url;
  if (/cdn\.jsdelivr\.net\/npm\/[^/]+@\d|cdnjs\.cloudflare\.com\/ajax\/libs\/[^/]+\/\d|unpkg\.com\/[^/]+@\d/.test(u)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
        return res;
      }))
    );
    return;
  }
  // Büyük ama nadiren değişen dosyalar (adres listesi, ikonlar): önbellekten anında ver, arkada tazele
  if (/\/adres_tr\.json$|\.(png|ico|svg|webp)$/.test(new URL(u).pathname)) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(e.request).then(hit => {
        const ag = fetch(e.request).then(res => { if (res && res.status === 200) c.put(e.request, res.clone()); return res; }).catch(() => hit);
        return hit || ag;
      }))
    );
    return;
  }

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
