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

## 6d. Kaynak kişide + müşteri ölçüleri + kendi kendine güncelleme (1 Kasım 2026)
- **Kişi kaynağı:**
  - Kolonlar: `kisiler.kaynak` (Google Ads | Armut | Dışarıdan | Eski Müşteri | Tavsiye), `tavsiye_eden_id` (rehberden) ya da `tavsiye_eden_ad` (rehberde yoksa).
  - Kaynak yalnızca **Müşteri** kategorisinde tutulur ve orada zorunludur (`mkKaynakOku`). Diğer kategorilerde sorulmaz.
  - Mevcut müşteriler dolduruldu: ilk işleminde Armut/Dışarıdan yazanlar öyle kaldı, kalanı Google Ads oldu (49 Google Ads, 5 Armut, 1 Dışarıdan).
- **İşlem / proje / teklif kaynağı:** Artık seçilmiyor; loadDB'de `kaynakTuret` ile kişiden türetiliyor. `Evrak` işareti korunuyor; ham değer `islemKaynagiHam`'da. Böylece rkErpIsler, rkAdsIsler, grafik ve özet raporları kendiliğinden kişi kaynağını kullanıyor. İşlem formunda yalnızca salt-okunur etiket var (`miKaynakEtiket`).
- **Kişi kartı:** `kisiKaynakRozet` kaynağı, tavsiye edeni ve "Tavsiye ettikleri: N kişi · ₺" bilgisini gösteriyor.
- **Reklam sayfası:** `#rk-musteri` / `rkMusteriHtml` eklendi:
  - Google Ads ve Armut için yeni müşteri, yeni müşteri başı maliyet, müşteri değeri ve geri dönüş (ilk iş + tekrar iş)
  - Kaynağa göre müşteri tablosu ve tavsiye edenler listesi
  - `RK_KAYNAKLAR`'a Tavsiye eklendi.
- **Arama takibi:**
  - Kaynak listesi rehberle aynı (+ Bilinmiyor); eski kayıtlar dönüştürüldü. `_arama_reklam_esle` artık `kaynak='Google Ads'` ile çalışıyor.
  - Numara rehberdeyse ad ve kaynak kendiliğinden dolar: ERP'de `atNumaraDegisti`, Android'de `arama_kisi_bul`.
  - "İş alındı" + rehberde yok → "Rehbere ekle" önerisi (`atRehbereEkle`).
- **Eski hızlı sayaç penceresi silindi:** rkAgCiz, rkAgEkle, rkAgEksi, rkAgKanal, rkAramaGirAcEski, rkAramaSil. `rkAgYok` kaldı (Arama gir formundaki "📵 arama gelmedi" düğmesi kullanıyor).
- **Widget:** "+ Arama kaydet" düğmesi kaldırıldı (kutular ve başlık zaten kaydı açıyor); ↶ kaldı. Eski tek dokunuş +1 kodu (EylemAlici.SEKTOR, iyimserArti) silindi.
- **Kendi kendine güncelleme (`GuncellemeDenetci`):**
  - Son sürümü `github.com/.../releases/latest` yönlendirmesinden okur, APK'yı `filesDir/guncelleme`'ye indirir ve PackageInstaller ile kurar.
  - Android 12+'da `USER_ACTION_NOT_REQUIRED`, 14+'da update ownership kullanılır.
  - Alıcılar: `KurulumAlici` (onay gerekirse ekran ya da bildirim), `GuncellendiAlici` (MY_PACKAGE_REPLACED → temizlik + bildirim).
- **Güncelleme yalnızca elle (Gökay'ın isteği):** ERP → Ayarlar → Android → ⬆️ Güncelleme (`andGuncelle` → `guncellemeDenetle`). Sürüm güncelse "güncel" der, yeniyse indirip hemen kurar. Kurulum izni yoksa ayar ekranını açar. Açılışta, widget'ta ya da sunucudan otomatik denetim **yok**: `android-surum` cron'u kaldırıldı; `push-gonder?surum=1` kodu duruyor ama çağrılmıyor.
- **Görüşme sonrası pencere:** Arama kaydına telefon rehberindeki "GT Ahmet" yerine ERP'deki ad yazılır (`erpAd`, yoksa `gtsiz`).

## 6e. Arama verisi tek kaynakta (1 Kasım 2026)
- **Eski kayıtların aktarımı:** Hızlı sayaçla girilmiş 61 `reklam_manuel` ads_arama satırı (toplam 68 arama) `arama_takip`'e tek tek aktarıldı: kaynak Google Ads, sonuç boş, not "Eski hızlı girişten aktarıldı". Geçersiz sektörler (ör. "Montaj İşleri") nota taşındı.
  - Yedek: `reklam_manuel_yedek_20261101`.
  - Artık `reklam_manuel` ads_arama = `arama_takip` (kaynak Google Ads) ile 1:1.
- **Google arama kayıtları:** `google_ads_aramalar` Ads betiğinden gelir (callView): reklamdaki "Ara" düğmesiyle Google yönlendirme numarasından geçen aramalar; telefon kaydı değil. Süre ve durum (RECEIVED/MISSED) Google'dan gelir.
  - `rkAramaGrupla`: 2 dk içindeki art arda denemeler tek arama sayılır (31.10'daki 9 kayıt = 2 arama). `rkTopla.arama` / `cevapsiz` gruplanmış sayıyı kullanır.
- **KPI:** "Kaydedilen reklam araması" (eski adı "Elle girilen arama") dokununca Google Ads süzgeçli kayıt listesini açar.

## 6k. Spam, bahis düzeni, GTCOIN (2 Kasım 2026)
- **Arama penceresi** (görüşme sonrası) önce "Bu arama neydi?": 🔒 Özel (hiçbir şey) · 💼 İş (kaynak → sektör → sonuç; rehberde kaynak varsa doğrudan sektöre) · 📛 Spam (`arama_spam` RPC → `reklam_manuel` tip=`spam`, deger 1; yalnızca sayı). Widget'tan açılan elle giriş doğrudan kaynakla başlar.
- ERP: Arama gir penceresinde "📛 Spam aramaydı" düğmesi (`atSpam`); reklam KPI'larında "Spam arama" kutusu; arama takibi kartında yanlış arama kutusunda spam sayısı.
- Bet: A6 "Yarın kaç telefon gelir?" (arama_takip, kanal tel, spam hariç) eklendi; A1, A2, A5, R1, R3, Y3 kaldırıldı → 25 tür (günlük I1 A6 A4, ilk iş F1–F4, haftalık 14, aylık 4).
- **GTCOIN** (Bet sayfasının en üstü): `bet_gt_fiyat` (tikler), `bet_gt_islem`, `bet_gt_durum` (baz/prim/dalga), `bet_oyuncular.gt/gt_maliyet`.
  - Fiyat = temel × (1 + prim) × (1 + dalga). Temel `_gt_temel(_gt_bilesen(bugün), baz)`: 15.07.2026 = 100; geometrik ağırlık kasa(+60.000 kaydırma) %30, 30 gün net kâr (+baz gelir) %25, 30 gün iş (+2) %25, Google Ads getirisi (+1) %20; her oran 0,2–5 arası.
  - Prim: alım +coin/40.000, satış −tutar/40.000, tik başına ×0,985 söner. Dalga: ortalamaya dönen küçük rastgele (σ %0,25, ×0,92). pg_cron `gt-tik` 15 dakikada bir `bet_gt_tik()`.
  - `bet_gt_al(p_coin ≥2)`, `bet_gt_sat(p_miktar)`: %1 komisyon (en az 1 coin), coin defterine `gt_al`/`gt_sat`.
  - Ay şampiyonu ve sıralama: coin + GTCOIN satış değeri (×0,99). Yardım: coin 0 ve GTCOIN değeri < 10.
  - ERP: klinecharts mum/çizgi grafik (15 dk / 1 sa / 4 sa / 1 gün), 24s/7g/30g değişim, cüzdan K/Z, al/sat, "fiyatı ne belirliyor", son işlemler.

## 6j. Widget sadeleşti + Bet oyunu (2 Kasım 2026)
**Widget'lar** (Android): yalnızca iki widget kaldı.
- **Pano** (`w_pano.xml`): 📞 Arama ekle (AramaPenceresi, kaynak → sektör → sonuç) · bugünkü arama sayısı (arama_takip, reklam sayfasına gider) · ↶ son kaydı geri al · Ajanda bugün / 7 gün (takvim) · Evrak bugün (+gecikmiş, kırmızı) / 7 gün (evrak) · 💰 Kasa (özet sayfası) + 👁 gizle/göster. Sektör düğmeleri, telefon/WhatsApp düğmesi ve potansiyel satırı kaldırıldı.
- **Arama ekle** (`w_arama.xml`, 4×1): Arama ekle + sayı + ↶.
- Ajanda, Bugünün Özeti, Kasa, Evrak widget'ları silindi (sınıflar, info xml, manifest, w_kart/w_buyuk/w_satir).

**Bet** (ERP alt menüde en solda, `#page-bet`, `betCiz`): ERP verisine bahis oyunu; hiçbir ERP kaydını değiştirmez.
- Tablolar: `bet_oyuncular` (coin), `bet_hareketler` (coin defteri, `anahtar` tekil), `bet_pazarlar` (bahis), `bet_kuponlar`, `bet_secimler` (kişi başı bahis başına bir seçim), `bet_sezonlar` (ay şampiyonu). RLS: erp_uye() okur; yazma yalnızca RPC.
- Tarayıcıdan çağrılan: `bet_katil()`, `bet_oyna({tutar 1–100, secimler:[{pazar_id, secenek|tahmin}]})` (1–8 seçim, kombine oran çarpılır, en fazla 1000).
- Sunucu (pg_cron `bet-saatlik` her saat :04 → `bet_saatlik()`): `bet_uret()` (yarın: I1 A1 A4 + ilk iş F1–F4; gelecek hafta pzt–paz: K2 K3 I2 I4 X1 G1 G2 G3 X2 A2 A3 A5 R1 R2 R3 Y1 Y2 Y3 Y4; gelecek ay: K1 K4 I3 G4 = 30 tür), `bet_sonuclandir()`, `bet_donem_isle()` (ay başında şampiyon + herkese 1000; coin'i 0 olana haftada bir 100).
- Ölçüm tek yerde: `bet_olc(tur, bas, bit)` → hem geçmiş oran hesabı (`_bet_gecmis`, kasa için `_bet_kasa_degisim`) hem sonuç. Oran = 0,92 / olasılık (Laplace düzeltmeli, 1,05–25). I3 Poisson: tam = 0,46/P(k), ±1 = 0,46/P(k±1).
- Kapanış = dönem başı 00:00; sonuç = dönem sonu + 24 saat (ilk iş türleri: ilk iş gününden 24 saat sonra; 45 gün iş yoksa iade). Kimsenin oynamadığı bahis sonuçlanmaz, silinir. Sonuçlanınca push (`bet:` anahtarı, ./?sayfa=bet).

## 6i. Yapılan iş sayısı (1 Kasım 2026)
- Özet → İşletme Özeti'ne "🧰 Yapılan İş" kartı: dönem (global-month) iş adedi, toplam, bu ay, iş başı ortalama, tahsil bekleyen. Tanım (`isListesi`): her İşletme Geliri işlemi bir iş; İptal hariç, Bekliyor dahil; aynı `projeId`'li işlemler tek iş. Karta dokununca aylık dağılım + iş listesi (`showDashDetay('isAdet')`).

## 6h. Yeni numara kuralı + sayfa düzeni (1 Kasım 2026)
- **AramaAlici**: yalnızca *yeni numara* işlenir. Kaydedilmeyenler: rehberde kayıtlı her numara (GT'li müşteriler dahil), 850 / 444 / 800 / 9xx hatları, şehir alan kodlu sabit hatlar (2xx-3xx-4xx). Cep (5xx) ve yabancı numaralar işlenir. `kurumsalNumara()` sebebi tanı satırına yazar.
- Reklam sayfası sırası: KPI → ana grafik → arama takibi → müşteri kazanımı → gün ve saat → (aylık | kanal) → (sektör | Google aramaları) → (terimler | kelimeler) → (bütçe | konum) → kampanyalar.
- Arama takibi içinde: ısı haritası → aylara göre → görüşme süresi → kıyas → neden olmadı.
- Özet sayfası reklam kutusu: bu ayın harcama / gösterim / tıklama / elle arama; uyarılar tek satır ve küçük; kutu rengi sabit hardal (`r-hardal`). Gider tahmini kutusu sabit cam mavisi (`r-cam`), değerler kırmızı kalır.

## 6g. Arama takibi kartı + analiz (1 Kasım 2026)
- Kart reklam sayfasının döneminden bağımsız: kendi dönem seçici (Bu ay / 30 / 90 / Tümü / Reklam dönemi; `AT.donem`, localStorage `at_donem`, varsayılan Tümü). `atYukle` artık tarih sınırı olmadan tüm kayıtları çeker.
- Analizler: 9 KPI (önceki döneme fark), sonuca göre yığılı trend grafiği (Chart.js, gün/hafta/ay kovası, dönüşüm % çizgisi, Google'ın saydığı reklam araması kesikli çizgi), arama hunisi, kaynak/sektör sonuç çubukları (dokununca liste süzülür), sektör × kaynak matrisi, gün × saat ısı haritası + saat çubukları, neden olmadı, ortalama görüşme süresi, önceki dönemle kıyas tablosu, aylık tablo (Ads arama/iş başı maliyet).
- Saati bilinmeyen kayıt = elle girilmiş ve tam 12:00:00 (`atSaatYok`) → saat analizine katılmaz, listede "saat yok".
- "Takipteki potansiyel müşteriler" listesi ve 3 gün sonra soran `takip:` bildirimi kaldırıldı (push_sunucu_kontrol'dan çıkarıldı). Potansiyel sonucu kaydedilmeye devam eder.
- Son 20 arama (tüm tarihler) + "📋 Tüm liste" düğmesi.
- Arama gir: tarih + saat (bugün → şu an, geçmiş gün → 12:00), düzenlemede tarih/saat değişebilir (`arama_guncelle` `zaman` alır, gün değişirse reklam eşlemesi yenilenir). "4 · Arama adedi" (1–30): `arama_kaydet` `adet` kadar ayrı kayıt açar, `idler` döner.
- Eski hata: geçmiş gün kayıtları `T12:00:00` UTC olarak yazılıp 15:00 görünüyordu; düzeltildi ve mevcut 8 kayıt 12:00 TSİ'ye çekildi.

## 6f. Arama algılama tanısı + Google "bağlanmadı" uyarısı (1 Kasım 2026)
- **AramaAlici** her adımı `gt_arama` prefs'e yazar (`sonOlay`, `sonSonuc`): "Telefon durumu alındı", "Arama kaydı izni yok", "Cihaz kaydı yok", "Giden arama", "Cevapsız/reddedilen", "0 sn", "Rehberde özel kayıt", "Pencere açıldı", "Üstte gösterme izni yok — bildirim gönderildi"… Arama kaydı geç yazılan telefonlar için 4 deneme (~6.5 sn).
- `izinDurum` artık `aramaSonZaman`, `aramaSonuc`, `pil` (pil kısıtlamasından muaf mı), `uretici` döndürür; yeni yöntemler `pilIzni` (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) ve `uygulamaAyarlari` (Xiaomi vb. otomatik başlat için).
- ERP → Ayarlar → Android kartı: "Son arama algılama" satırı + 🔋 Pil izni / ⚙️ Uygulama ayarları düğmeleri (yalnız yeni sürümde görünür).
- **push_sunucu_kontrol**: son 24 saatte Google'ın MISSED kaydettiği, aynı kampanyada 3 dk içinde RECEIVED olmayan arama grubu (2 dk içindeki tekrarlar tek arama) → `gkacan:<arama_id>` bildirimi (öncelik 2). Google verisi saatlik geldiği için uyarı en geç ~1 saat gecikir.
- Reklam KPI'si "Kaydedilen reklam araması (dönem)" adını aldı; dokununca liste aynı dönem + Google Ads süzgeciyle açılır (`atListeAc({donem:'ozel',bas,bit,…})`). Arama takibindeki düğme "tüm zamanlar, N kayıt" der. `atListeAc()` her açılışta süzgeci sıfırlar.

## 6c. Tek arama kaydı (1 Kasım 2026)
- Eski hızlı sayaç ("Arama gir" → yalnızca `reklam_manuel` +1) kaldırıldı.
- **ERP:** `rkAramaGirAc(tarih)` artık `atEkleAc(null,null,{tarih})` açıyor. Buna reklam sayfası, özet şeridi, bildirimdeki `?arama=` ve kısayol dahil. Eski pencere `rkAramaGirAcEski` adıyla duruyor ama kullanılmıyor.
- **ERP formu:**
  - Tarih seçimi (Bugün / Dün / girilmemiş günler) ve kanal
  - Kaynak, sektör, sonuç (+ sebep), isteğe bağlı kişi ve not
  - O günün kayıtları
  - "📵 reklamdan hiç arama gelmedi" (`rkAgYok`)
  - "Kaydet + yeni" düğmesi
- **Reklam sayıları:** Hâlâ `reklam_manuel`'den hesaplanıyor; `kaynak=reklam` kayıtları buraya otomatik yazılıyor.
- **Android widget'ları:** Sektör kutuları bugünkü tüm aramaları gösteriyor (`widget_veri.arama.tum_sektor`). Kutulara, başlığa ya da "+ Arama kaydet"e dokununca `AramaPenceresi` adım adım açılıyor: kaynak → sektör → sonuç (→ sebep), son seçimde otomatik kayıt. Numara ve kişi sorulmuyor.
- **Görüşme sonrası pencere:** Aynı adım adım akışı kullanıyor, numara görüşmeden otomatik alınıyor.

## 6a. Google girişi uygulamada (1 Kasım 2026)
- WebView'da Google'ın açılır pencereli girişi (GIS token client) çalışmıyor: hesap seçilince beyaz sayfada kalıyor.
- Uygulamada `gtToken` (Takvim) ve `googleTokenAl` (Rehber), `andGoogleToken` → yerel `googleYetki` üzerinden telefonun Google hesabıyla yetki alıyor (play-services-auth, AuthorizationClient).
- Bunun için Google Cloud'da (web istemcisi 341229493021 ile aynı proje) **Android OAuth istemcisi** gerekli: paket `com.gunteknik.erp`, SHA-1 `68:AF:5C:8A:73:79:E5:E9:C5:A0:B5:8B:09:5A:FB:B8:3B:38:D6:EA` (sürüm imza anahtarı).

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
