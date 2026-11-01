// Gün Teknik ERP — Service Worker
const CACHE = 'gunteknik-v13';
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

// ── Telefon bildirimleri (Web Push): ERP kapalıyken de gelir
const SB_URL = 'https://zfflnrerdevnflchscqe.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZmxucmVyZGV2bmZsY2hzY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzQ3MjUsImV4cCI6MjA5NjQxMDcyNX0.uby8MidaKpnsceel5E_zTJm3LTYwoMrbKUryr5ZszcI';
function trTarih(g) { const p = String(g || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ''; }
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { govde: e.data ? e.data.text() : '' }; }
  const actions = [];
  if (d.eylem && d.eylem.tip === 'arama') {
    actions.push({ action: 'arama-gir', title: '📞 Sektörle gir' });
    actions.push({ action: 'arama-yok', title: 'Arama gelmedi' });
  }
  const ikon = new URL('icon-192.png', self.registration.scope).href;
  e.waitUntil(self.registration.showNotification(d.baslik || 'Gün Teknik', {
    body: d.govde || '', icon: ikon, badge: new URL('favicon-48x48.png', self.registration.scope).href,
    tag: d.etiket || 'gt', renotify: true, actions, vibrate: [80, 40, 80],
    data: { url: d.url || './', eylem: d.eylem || null, token: d.token || null }
  }));
});
self.addEventListener('notificationclick', e => {
  const n = e.notification; const d = n.data || {}; n.close();
  if (e.action === 'arama-yok' && d.eylem && d.token) {
    e.waitUntil(fetch(SB_URL + '/rest/v1/rpc/push_arama_yok', {
      method: 'POST', headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: d.token, p_tarih: d.eylem.tarih })
    }).then(r => r.json()).then(s => self.registration.showNotification(s === 'tamam' || s === 'zaten' ? '✓ Kaydedildi' : 'Kaydedilemedi', {
      body: s === 'tamam' ? trTarih(d.eylem.tarih) + ' için "reklamdan arama gelmedi" girildi.' : s === 'zaten' ? 'O gün için zaten giriş vardı.' : 'ERP’yi açıp elle gir.',
      tag: 'gt-onay', icon: new URL('icon-192.png', self.registration.scope).href
    })).catch(() => {}));
    return;
  }
  const url = new URL(d.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    for (const c of L) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.postMessage({ tip: 'bildirim-ac', url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
