# Gün Teknik ERP — Devir notu (Android uygulamasına başlarken)

Bu dosya yeni bir sohbete başlarken bağlamı aktarmak için yazıldı. Yeni sohbette: **"docs/DEVIR_ANDROID.md dosyasını oku, Android uygulamasının ilk adımıyla başla."**

## 1. Çalışma kuralları (Gökay)
- Her zaman **depodaki en son dosyaları** temel al; istenmeyen hiçbir şeye dokunma.
- "Önce konuşalım / konuşalım" denince **sadece konuş, kod yazma**.
- Büyük işleri **tek seferde** teslim et (parça parça değil).
- ERP değişikliklerini **doğrudan GitHub'a yükle**; dosyaları ancak istenince gönder. Yükledikten sonra yayını **izleme**, bırak.
- "Standart Dışı" metriğine dokunma. Adres Tarifi yalnızca ERP'de kalır, Google'a gönderilmez. Google Maps API anahtarı bana verilmez.
- Kullanıcı Android telefon kullanıyor. Dil: Türkçe.

## 2. Mevcut sistem
- Depo: `GokAyseGun/GunTeknik` (eski adı gokaysegun/gunteknik). Yayın: https://gokaysegun.github.io/GunTeknik/ (GitHub Pages, `.github/workflows/deploy.yml`).
- Tek dosya ERP: `index.html` (~1,6 MB, HTML+CSS+JS). Ayrıca `sw.js` (service worker, önbellek `gunteknik-v13`), `manifest.json` (kısayol: `./?arama=bugun`), `onay.html`, `villa.html`, `elkitabi/` (index, hesap, semalar, teori, ortak.css, ortak.js).
- Supabase projesi: `zfflnrerdevnflchscqe` (REST + Auth; anon anahtar index.html içinde `SB_KEY`). Giriş: Supabase Auth e-posta/şifre; oturum `SB_TOKEN`, rol `USER_ROL` (`goruntule` = salt okunur).
- Temalar: Koyu, Açık, Sistem, Zarif, Chill (`data-tema`, localStorage `gt_tema`).

## 3. Google Ads senkronu
- Google Ads hesabındaki **Google Ads Script** saatlik çalışır, `ads_yaz` / `ads_log` RPC'leriyle `google_ads_*` tablolarına ve `ads_senkron_log`'a yazar. (1 Kasım 2026: sıklık "Saatlik" yapılmamıştı, düzeltildi.)
- ERP Reklam sayfası: `rkYukle`, `rkCiz`, `rkGrafikCiz`, `RK_METRIK` (yeni metrik `elle` = elle arama, hardal `#D9A441`).

## 4. Elle reklam araması (sektör zorunlu)
- Tablo `reklam_manuel`: `tarih, tip, deger, sektor, kanal, aciklama`.
  - `tip='ads_arama'`, `deger=1`, `sektor` = `ISLETME_HİZ` anahtarlarından biri ya da `Diğer`, `kanal` = `tel` | `wa`.
  - `tip='ads_arama_yok'`, `deger=0` → o gün arama gelmedi (gün sayıldı). Hiç kaydı olmayan gün = girilmemiş (grafikte boşluk).
- Sektörler: Elektrik, Klima, TV Uydu Çanak, İnternet, Sıhhi Tesisat, Metal, Ahşap, Diğer.
- ERP fonksiyonları: `rkAramaGirAc(tarih)`, `rkAgEkle(sektor)`, `rkAgEksi`, `rkAgYok`, `rkGunDurum`, `rkEksikGunler`.

## 5. Telefon bildirimleri (Web Push) — 1 Kasım 2026'da kuruldu
- Tablolar:
  - `push_abonelik(endpoint, p256dh, auth, token, cihaz, …)`
  - `push_kuyruk(anahtar PK, zaman, baslik, govde, url, eylem jsonb, kaynak, oncelik, gonderildi)`
  - `push_gizli` (VAPID anahtarı; yalnızca service role okur)
- RPC'ler:
  - `push_abone_ol`, `push_abone_sil`, `push_vapid`
  - `push_planla(p)`: ERP'nin 14 günlük planı, kaynak `erp-plan`. Çözülenler silinir.
  - `push_ekle(p)`: anlık olaylar.
  - `push_test`, `push_durum`
  - `push_arama_yok(token, tarih)`: bildirim düğmesinden çağrılır.
  - `push_sunucu_kontrol()`: 21:00 arama hatırlatması, 08:30 dün eksikse hatırlatma, 08:30 dünün reklam özeti, Ads senkronu 3 saat sessizse uyarı, `sistem_bildirimleri`.
  - `push_teslim_al()`: sessiz saat 23–07 uygulanır; öncelik 0 bu kuralı atlar.
  - `push_tetikle()`
- `pg_cron` işi `push-bildirim` 5 dakikada bir şunları çalıştırır: `push_sunucu_kontrol()` + `push_tetikle()`. Gerekirse `push-gonder` Edge Function'ı çağrılır (pg_net).
- Edge Function `push-gonder`:
  - WebCrypto ile RFC 8291/8292 uygular; harici kütüphane yok.
  - Aynı anda düşen öğeleri tek bildirimde birleştirir.
  - Yük biçimi: `{baslik, govde, url, eylem:{tip:'arama',tarih}, etiket, token}`.
- `sw.js`:
  - `push` olayında bildirimi gösterir. Arama hatırlatmasında iki düğme var: "📞 Sektörle gir" ve "Arama gelmedi".
  - `notificationclick` olayında açık pencereye `postMessage({tip:'bildirim-ac', url})` gönderir.
- ERP:
  - URL parametreleri `bildirimUrlIsle` ile işlenir: `?arama=YYYY-MM-DD|bugun`, `?sayfa=evrak|reklam|takvim|islemler`, `?islem=ID`.
  - `pushPlanListe()` şunları planlar: evrak ve kredi son günleri (3 gün önce ve son gün, gecikince ertesi gün ve sonra haftalık), vadeli işlemler, ajanda (08:30 ve önceki akşam 21:00).
  - Bütçe, kasa riski ve reklam uyarıları `pushEkle` ile gönderilir.

## 6. Android uygulaması — hedef
Gökay'ın isteği: **çeşitli widget'ları olan, tüm bildirim ve ek pencere sistemlerini çalıştıran, profesyonel bir uygulama**. Android Studio'da her seferinde yeniden uygulama kurmak yerine kod **GitHub'dan en pratik ve otomatik şekilde** gelmeli.

### Konuşulan yaklaşım: Capacitor
- WebView, ERP'yi doğrudan `https://gokaysegun.github.io/GunTeknik/` adresinden yükler (`server.url`). Web tarafındaki her güncelleme uygulamaya kendiliğinden yansır. Yeni APK yalnızca yerel parçalar değişince gerekir.
- Yerel parçalar (Kotlin):
  - **Ana ekran widget'ları:**
    - sektör düğmeleriyle tek dokunuş arama +1
    - bugünün özeti (arama sayısı, ajanda, ödeme günleri)
    - gerekirse hızlı işlem ve kasa widget'ları
  - **Arama bittiğinde soran küçük pencere:** "Reklamdan mıydı? Hangi sektör?". Yalnızca sorar; otomatik kayıt yok, çünkü işler WhatsApp'tan da geliyor.
  - **Yerel bildirimler** (eylem düğmeli).
- Dikkat: **Capacitor WebView'da Web Push çalışmaz.** Uygulama içi bildirim için iki seçenek var:
  - (a) FCM: Firebase projesi gerekir, `push-gonder` FCM HTTP v1 ile de gönderecek şekilde genişletilir.
  - (b) `push_kuyruk`'u periyodik okuyan WorkManager ile yerel bildirim.
  - Bu kararı yeni sohbette ver. Tarayıcıdaki PWA bildirimleri olduğu gibi kalmalı.
- Widget'ların Supabase'e yazabilmesi için ERP oturum jetonu bir Capacitor eklentisiyle yerel tarafa (SharedPreferences) aktarılmalı; yenileme jetonu da gerekli.
- **Otomasyon önerisi:** Android projesi depoda `android-app/` klasöründe dursun.
  - GitHub Actions APK'yı derleyip **Releases**'a koysun; Android Studio şart olmasın.
  - Uygulama yeni sürümü kendisi fark edip güncelleme önersin.
  - İmzalama anahtarı GitHub Secrets'ta tutulmalı.

### Durum — Adım 1 tamam (1 Kasım 2026)
- `android-app/`: Capacitor 8.6 projesi. `appId` = `com.gunteknik.erp`, ad "Gün Teknik". `server.url` = GitHub Pages; çevrimdışıyken `www/hata.html` (15 sn'de bir yeniden dener).
- Yerel kod Java (`android-app/android/app/src/main/java/com/gunteknik/erp/`):
  - `MainActivity` — `GTYerelPlugin`'i kaydeder, her sayfa yüklenişinde `assets/gt-kopru.js`'i ekler, açılışta güncelleme denetler.
  - `GTYerelPlugin` (`Capacitor.nativePromise('GTYerel', …)`): `bilgi`, `guncellemeDenetle`, `dosyaKaydet` (blob/data indirmelerini İndirilenler/GunTeknik'e kaydeder ve açar).
  - `GuncellemeDenetci` — 6 saatte bir `releases/latest`'e bakar; `android-vN` etiketi > sürüm kodu ise "İndir" önerir.
- `gt-kopru.js`: `window.GT_ANDROID={surumKodu}`, `<html data-android="1">`, `gt-android-hazir` olayı; `a[download]` blob/data tıklamalarını yerele yönlendirir.
- İzinler: internet, konum, kamera. İkon/splash ERP logosundan (zemin `#060606`).
- `.github/workflows/android.yml`: `android-app/**` değişince derler, `GT_KEYSTORE_BASE64`, `GT_KEYSTORE_PASSWORD`, `GT_KEY_ALIAS`, `GT_KEY_PASSWORD` secret'larıyla imzalar, `android-vN` (N = run_number = versionCode) olarak Releases'a koyar. Secret yoksa derlemeyi atlar.
- Sıradaki: bildirim kararı (FCM / WorkManager), oturum jetonu köprüsü, widget'lar, arama sonrası pencere.

## 7. Bekleyen küçük işler (kullanıcı tarafı)
- Google Maps anahtarına `https://gokaysegun.github.io/*` yönlendiren kısıtlaması eklenmeli (ERP'deki anahtar, RefererNotAllowedMapError).
- Depodan eski dosyalar silinebilir: `deprem.html`, `evrak.html`, eski Google Ads workflow'ları.
- İsteğe bağlı: `google.maps.Marker` → `AdvancedMarkerElement` (Map ID gerekir).
