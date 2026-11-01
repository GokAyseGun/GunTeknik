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

### Durum — Adım 2 tamam (1 Kasım 2026): FCM, widget'lar, arama penceresi, Arama Takibi
- **Karar: FCM.** Firebase projesi `gun-teknik`; `android-app/android/app/google-services.json` depoda. Hizmet hesabı Supabase secret'ı `FCM_SERVICE_ACCOUNT` (JSON).
- **Supabase:**
  - `cihazlar(token PK, kullanici, ad, fcm, surum, …)` — RLS açık, politika yok; yalnızca RPC'ler erişir.
  - RPC'ler: `cihaz_kaydet(p_fcm,p_ad,p_token,p_surum)` (ERP oturumu gerekir, cihaz anahtarı döner), `cihaz_fcm(p_token,p_fcm)`.
  - `arama_takip(zaman, tarih, numara, rehber_ad, yon, sure_sn, kanal, kaynak, sektor, sonuc, sebep, aciklama, reklam_id, takip_soruldu, …)`. Kaynak: `reklam|tavsiye|eski|bilinmiyor`. Sonuç: `potansiyel|is_alindi|yanlis|olusmadi`. Sebep: `fiyat|uzak|vazgecti|baska_usta|diger`.
  - RPC'ler `arama_kaydet(p_token,p)`, `arama_guncelle(p_token,p_id,p)`, `arama_sil(p_token,p_id)`: ERP oturumu ya da cihaz anahtarı kabul eder. `kaynak='reklam'` olan kayıt `_arama_reklam_esle` ile `reklam_manuel`'e +1 (`aciklama='Arama takibi #id'`) yazılır, o günün `ads_arama_yok` kaydı ve arama hatırlatması silinir.
  - `widget_durum(id=1, veri, veri_zaman, son_sinyal)`: ERP `widget_yaz(p)` ile anlık görüntüyü yazar (kasa, ay, aj[], od[]). `widget_veri(p_token)` bunu canlı arama sayılarıyla birlikte döndürür.
  - `widget_sinyal()`: en fazla 10 sn'de bir `push-gonder?yenile=1` çağırır. `reklam_manuel` ve `arama_takip` tetikleyicileri ile `widget_yaz` kullanır.
  - Eklemeler: `push_arama_yok` cihaz anahtarını da kabul eder; `push_tetikle` FCM cihazı varsa da çalışır; `push_durum` içinde `android` sayısı var; `push_sunucu_kontrol` potansiyel müşteriyi 3 gün sonra 09–20 arası sorar (`takip:ID`, eylem `{tip:'takip',id}`).
- **push-gonder** (sürüm 3): Web Push'a ek olarak `fcm.js` ile FCM HTTP v1 data mesajı gönderir (`tip=bildirim|yenile`). Geçersiz FCM anahtarı `cihazlar.fcm=null` yapılır.
- **Android** (`com.gunteknik.erp`):
  - `GTMesajServisi`: FCM mesajlarını alır.
  - `Bildirimci`: kanallar `hatirlatma`, `arama_kaydi`. Arama hatırlatmasında "Sektörle gir" / "Arama gelmedi" düğmeleri, takipte "İş alındı" / "Oluşmadı" düğmeleri var.
  - `EylemAlici`: bildirim ve widget düğmelerini işler.
  - `AramaAlici` (PHONE_STATE) + `AramaPenceresi`: gelen ve cevaplanmış aramadan sonra açılır. Numara rehberde yoksa ya da ad "GT" ile başlıyorsa çıkar; diğer rehber kayıtlarında çıkmaz. Üstte gösterme izni yoksa bildirimle açılır.
  - Widget'lar: `WAramaWidget`, `WOzetWidget`, `WAjandaWidget`, `WEvrakWidget`, `WKasaWidget` (varsayılan gizli, 👁), `WPanoWidget`. Çizimler `WidgetCizici`'de. Veri önbelleği `Ayar.veri`; tazeleme FCM `yenile` sinyaliyle, uygulama açılınca ve 30 dakikada bir.
  - `GTYerelPlugin` yöntemleri: `fcmToken`, `cihazKaydet`, `widgetYenile`, `izinDurum`, `izinIste`, `bilgi`, `guncellemeDenetle`, `dosyaKaydet`.
- **ERP (index.html):**
  - `andAktif` / `andKaydol` / `andKartCiz`: Ayarlar'daki bildirim kartı uygulamada Android kartına dönüşür.
  - `widgetVeri` / `widgetYaz`: açılışta, her yazma işleminden 5 sn sonra, arka plana alınınca ve 30 dakikada bir çalışır.
  - Reklam sayfasında **Arama takibi** kartı (`#at-kart`, `atHtml`): kaynak ve sektöre göre dönüşüm, oluşmama sebepleri, takip listesi, "+ Kayıt" (WhatsApp için).
- Sıradaki fikirler: arama penceresine "iş alındı" seçilince ERP'de işlem açma; ERP'den widget teması.

## 6b. Güvenlik (1 Kasım 2026)
- **Tablolar:** Anonim (anon) erişim kapatıldı. Tablolar yalnızca `erp_uyeler` listesindeki giriş yapmış kullanıcılara açık (`erp_uye()`, politika `erp_uye_hepsi` / `erp_uye_okur`). Listede şu an 3 hesap var (auth.users'tan). **Yeni kullanıcı eklenince `erp_uyeler`'e de eklenmeli.**
- **Açık bırakılanlar:** `villa_*` tabloları ve `sistem_ayarlar` (villa.html girişsiz kullanıyor) ile `villa-files` deposu.
- **Teklif onayı:** Müşteri artık `teklif_onay_getir(p_token)` / `teklif_onayla(p_token,p_isim)` RPC'leriyle onaylıyor (onay.html ve ERP'deki eski satır içi sayfa güncellendi).
- **RPC'ler:** `auth.uid() is null` denetimleri `erp_uye()` oldu. `push_teslim_al`, `push_tetikle` ve `push_sunucu_kontrol` dışarıdan çağrılamaz.
- **Görünüm:** `google_ads_grup_gunluk` artık `security_invoker`.

## 7. Bekleyen küçük işler (kullanıcı tarafı)
- Supabase → Authentication → Sign In / Providers → "Allow new users to sign up" kapatılmalı (yabancı kayıt olsa da erp_uyeler'de olmadığı için veri göremez; yine de kapalı olması iyi).
- Google Maps anahtarına `https://gokaysegun.github.io/*` yönlendiren kısıtlaması eklenmeli (ERP'deki anahtar, RefererNotAllowedMapError).
- Depodan eski dosyalar silinebilir: `deprem.html`, `evrak.html`, eski Google Ads workflow'ları.
- İsteğe bağlı: `google.maps.Marker` → `AdvancedMarkerElement` (Map ID gerekir).
