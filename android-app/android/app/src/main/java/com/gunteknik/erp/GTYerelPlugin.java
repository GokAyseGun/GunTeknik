package com.gunteknik.erp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;
import androidx.core.content.FileProvider;

import android.Manifest;
import android.content.pm.PackageManager;
import android.provider.Settings;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSArray;

import java.util.ArrayList;
import java.util.List;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * ERP ile yerel taraf arasındaki köprü.
 * JS'ten: Capacitor.nativePromise('GTYerel', 'yöntem', {...})
 */
@CapacitorPlugin(name = "GTYerel")
public class GTYerelPlugin extends Plugin {

    private static final String KLASOR = "GunTeknik";

    /** Uygulama sürüm bilgisi — ERP'nin Android içinde çalıştığını anlaması için. */
    @PluginMethod
    public void bilgi(PluginCall call) {
        JSObject r = new JSObject();
        r.put("platform", "android");
        r.put("surumKodu", GuncellemeDenetci.surumKodu(getContext()));
        r.put("surumAdi", GuncellemeDenetci.surumAdi(getContext()));
        call.resolve(r);
    }

    /** FCM anahtarı + kayıtlı cihaz anahtarı (ERP bununla cihaz_kaydet çağırır). */
    @PluginMethod
    public void fcmToken(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
            if (!t.isSuccessful() || t.getResult() == null) {
                call.reject("FCM anahtarı alınamadı" + (t.getException() != null ? ": " + t.getException().getMessage() : ""));
                return;
            }
            Ayar.fcm(getContext(), t.getResult());
            JSObject r = new JSObject();
            r.put("fcm", t.getResult());
            r.put("cihaz", Ayar.cihaz(getContext()));
            call.resolve(r);
        });
    }

    /** Sunucunun verdiği cihaz anahtarını sakla; widget'lar ve arama penceresi bununla yazar. */
    @PluginMethod
    public void cihazKaydet(PluginCall call) {
        String t = call.getString("token");
        if (t == null || t.isEmpty()) { call.reject("Anahtar yok"); return; }
        Ayar.cihaz(getContext(), t);
        Veri.arkaplanda(getContext());
        call.resolve();
    }

    @PluginMethod
    public void widgetYenile(PluginCall call) {
        Veri.arkaplanda(getContext());
        call.resolve();
    }

    @PluginMethod
    public void izinDurum(PluginCall call) {
        JSObject r = new JSObject();
        r.put("telefon", izin(Manifest.permission.READ_PHONE_STATE));
        r.put("aramaKaydi", izin(Manifest.permission.READ_CALL_LOG));
        r.put("rehber", izin(Manifest.permission.READ_CONTACTS));
        r.put("bildirim", Build.VERSION.SDK_INT < 33 || izin(Manifest.permission.POST_NOTIFICATIONS));
        r.put("ustte", Settings.canDrawOverlays(getContext()));
        r.put("cihaz", Ayar.cihaz(getContext()) != null);
        android.content.SharedPreferences ap = getContext().getSharedPreferences("gt_arama", android.content.Context.MODE_PRIVATE);
        r.put("aramaSonZaman", ap.getLong("sonOlay", 0));
        r.put("aramaSonuc", ap.getString("sonSonuc", ""));
        android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        r.put("pil", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        r.put("uretici", Build.MANUFACTURER);
        // randevu alarmları
        android.app.AlarmManager am = (android.app.AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
        boolean tamZaman = Build.VERSION.SDK_INT < 31 || (am != null && am.canScheduleExactAlarms());
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        boolean tamEkran = Build.VERSION.SDK_INT < 34 || (nm != null && nm.canUseFullScreenIntent());
        r.put("alarm", tamZaman && tamEkran);
        r.put("alarmTamZaman", tamZaman);
        r.put("alarmTamEkran", tamEkran);
        try {
            org.json.JSONObject o = Alarmci.ozet(getContext());
            r.put("alarmSayi", o.optInt("sayi", 0));
            if (o.has("ilkZ")) { r.put("alarmIlkZ", o.optLong("ilkZ")); r.put("alarmIlkB", o.optString("ilkB")); r.put("alarmIlkTur", o.optString("ilkTur")); }
        } catch (Exception ignored) {}
        call.resolve(r);
    }

    /** Randevu alarmı izinleri: tam zamanlı alarm (Android 12+) ve kilit ekranında tam ekran (Android 14+). */
    @PluginMethod
    public void alarmIzni(PluginCall call) {
        android.content.Context c = getContext();
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(android.content.Context.ALARM_SERVICE);
            android.app.NotificationManager nm = (android.app.NotificationManager) c.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 31 && am != null && !am.canScheduleExactAlarms()) {
                c.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else if (Build.VERSION.SDK_INT >= 34 && nm != null && !nm.canUseFullScreenIntent()) {
                c.startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else if (Build.VERSION.SDK_INT >= 26) {
                c.startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                    .putExtra(Settings.EXTRA_CHANNEL_ID, AlarmCalar.KANAL)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        } catch (Exception e) {
            try { c.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
        }
        call.resolve();
    }

    /** 10 saniye sonra deneme alarmı. */
    @PluginMethod
    public void alarmDene(PluginCall call) {
        AlarmCalar.kanallar(getContext());
        Alarmci.dene(getContext());
        call.resolve();
    }

    /** Pil kısıtlamasından muaf tutma (arama algılama ve bildirimler arka planda kesilmesin). */
    @PluginMethod
    public void pilIzni(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            try {
                getContext().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    /** Uygulama ayrıntıları (Xiaomi vb.: "Otomatik başlat", pil, arka plan izinleri buradan). */
    @PluginMethod
    public void uygulamaAyarlari(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) {}
        call.resolve();
    }

    /** Xiaomi/Redmi/POCO (MIUI/HyperOS): "Otomatik başlatma" izni — yoksa uygulama kapalıyken bildirim ve arama penceresi gecikir. Diğer markalarda uygulama ayarları. */
    @PluginMethod
    public void otomatikBaslat(PluginCall call) {
        String[][] adaylar = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"}};
        for (String[] a : adaylar) {
            try {
                Intent i = new Intent().setComponent(new android.content.ComponentName(a[0], a[1])).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
                return;
            } catch (Exception ignored) {}
        }
        try {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void izinIste(PluginCall call) {
        Activity a = getActivity();
        if (a instanceof MainActivity) a.runOnUiThread(() -> ((MainActivity) a).izinleriIste(true));
        call.resolve();
    }

    private boolean izin(String p) {
        return ContextCompat.checkSelfPermission(getContext(), p) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Google erişim jetonu (Takvim, Rehber). WebView'da Google'ın açılır pencere girişi çalışmadığı için
     * telefonun kendi Google hesabıyla yetki alınır. {kapsamlar:[...]} → {token}
     */
    @PluginMethod
    public void googleYetki(PluginCall call) {
        Activity a = getActivity();
        if (a == null) { call.reject("Etkinlik yok"); return; }
        List<Scope> L = new ArrayList<>();
        try {
            JSArray k = call.getArray("kapsamlar");
            for (int i = 0; k != null && i < k.length(); i++) L.add(new Scope(k.getString(i)));
        } catch (Exception ignored) {}
        if (L.isEmpty()) { call.reject("Kapsam yok"); return; }
        AuthorizationRequest istek = AuthorizationRequest.builder().setRequestedScopes(L).build();
        Identity.getAuthorizationClient(a).authorize(istek)
            .addOnSuccessListener(r -> {
                if (r.hasResolution() && r.getPendingIntent() != null) {
                    googlePencere(call, a, r);
                } else {
                    googleDon(call, r);
                }
            })
            .addOnFailureListener(e -> call.reject("Google izni alınamadı: " + googleHata(e)));
    }

    private void googlePencere(PluginCall call, Activity a, AuthorizationResult r) {
        if (!(a instanceof androidx.activity.ComponentActivity)) { call.reject("Etkinlik desteklenmiyor"); return; }
        final ActivityResultLauncher<IntentSenderRequest>[] kayit = new ActivityResultLauncher[1];
        kayit[0] = ((androidx.activity.ComponentActivity) a).getActivityResultRegistry().register(
            "gt_google_" + System.currentTimeMillis(),
            new ActivityResultContracts.StartIntentSenderForResult(),
            sonuc -> {
                try {
                    if (sonuc.getResultCode() != Activity.RESULT_OK || sonuc.getData() == null) {
                        call.reject("İzin verilmedi");
                        return;
                    }
                    AuthorizationResult ar = Identity.getAuthorizationClient(a).getAuthorizationResultFromIntent(sonuc.getData());
                    googleDon(call, ar);
                } catch (Exception e) {
                    call.reject("Google izni alınamadı: " + googleHata(e));
                } finally {
                    if (kayit[0] != null) kayit[0].unregister();
                }
            });
        try {
            kayit[0].launch(new IntentSenderRequest.Builder(r.getPendingIntent().getIntentSender()).build());
        } catch (Exception e) {
            kayit[0].unregister();
            call.reject("Google izin penceresi açılamadı: " + e.getMessage());
        }
    }

    private void googleDon(PluginCall call, AuthorizationResult r) {
        String t = r.getAccessToken();
        if (t == null || t.isEmpty()) { call.reject("Google jetonu gelmedi"); return; }
        JSObject o = new JSObject();
        o.put("token", t);
        call.resolve(o);
    }

    private static String googleHata(Exception e) {
        if (e instanceof ApiException) {
            int k = ((ApiException) e).getStatusCode();
            if (k == 10) return "uygulama Google Cloud'da tanımlı değil (Android OAuth istemcisi gerekli)";
            if (k == 16 || k == 12501) return "iptal edildi";
            return "kod " + k;
        }
        return e.getMessage() != null ? e.getMessage() : "bilinmeyen hata";
    }

    /** Yeni APK sürümü var mı? (Uygulama zaten günde birkaç kez kendisi bakar.) */
    @PluginMethod
    public void guncellemeDenetle(PluginCall call) {
        // Kullanıcı istedi: son sürüme bak; yeniyse indir ve hemen kur
        final android.content.Context c = getContext();
        new Thread(() -> {
            JSObject r = new JSObject();
            long mevcut = GuncellemeDenetci.surumKodu(c);
            r.put("surumKodu", mevcut);
            try {
                String[] e = GuncellemeDenetci.sonEtiket();
                if (e == null) { r.put("durum", "hata"); call.resolve(r); return; }
                int yeni = Integer.parseInt(e[1]);
                r.put("sonSurum", yeni);
                if (yeni <= mevcut) { r.put("durum", "guncel"); call.resolve(r); return; }
                if (!GuncellemeDenetci.kurIzniVar(c)) {
                    r.put("durum", "izin");
                    call.resolve(r);
                    Activity a = getActivity();
                    if (a != null) a.runOnUiThread(() -> {
                        try {
                            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName())));
                        } catch (Exception ignored) {}
                    });
                    return;
                }
                r.put("durum", "indiriliyor");
                call.resolve(r);
                GuncellemeDenetci.simdi(c, true);
            } catch (Exception ex) {
                r.put("durum", "hata");
                call.resolve(r);
            }
        }).start();
    }

    /** ERP'nin indirdiği dosyaları (Excel, PDF, CSV, yedek…) İndirilenler/GunTeknik'e kaydeder ve açar. */
    @PluginMethod
    public void dosyaKaydet(PluginCall call) {
        String veri = call.getString("veri");
        String ad = temizAd(call.getString("ad", "dosya"));
        String tur = call.getString("tur", "application/octet-stream");
        if (veri == null) {
            call.reject("Veri yok");
            return;
        }
        if (tur == null || tur.isEmpty()) tur = "application/octet-stream";
        ad = uzantiEkle(ad, tur);

        try {
            byte[] bayt = Base64.decode(veri, Base64.DEFAULT);
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, ad);
                cv.put(MediaStore.Downloads.MIME_TYPE, tur);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + KLASOR);
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("Dosya oluşturulamadı");
                try (OutputStream os = cr.openOutputStream(uri)) {
                    if (os == null) throw new Exception("Dosya yazılamadı");
                    os.write(bayt);
                }
            } else {
                File dizin = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), KLASOR);
                if (!dizin.exists()) dizin.mkdirs();
                File f = new File(dizin, ad);
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write(bayt);
                }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            }

            final Uri sonUri = uri;
            final String sonAd = ad;
            final String sonTur = tur;
            Activity a = getActivity();
            if (a != null) {
                a.runOnUiThread(() -> {
                    Toast.makeText(a, "İndirildi: İndirilenler/" + KLASOR + "/" + sonAd, Toast.LENGTH_LONG).show();
                    try {
                        Intent ac = new Intent(Intent.ACTION_VIEW);
                        ac.setDataAndType(sonUri, sonTur);
                        ac.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        a.startActivity(Intent.createChooser(ac, sonAd));
                    } catch (ActivityNotFoundException ignored) {
                        // Açacak uygulama yoksa dosya yine de İndirilenler'de durur.
                    }
                });
            }

            JSObject r = new JSObject();
            r.put("ad", ad);
            r.put("uri", uri.toString());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Dosya kaydedilemedi: " + e.getMessage(), e);
        }
    }

    // ---------------------------------------------------------------- fiş görseli → WhatsApp
    private boolean kurulu(String paket) {
        try {
            getContext().getPackageManager().getPackageInfo(paket, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Hangi WhatsApp'lar kurulu: {normal, isletme} */
    @PluginMethod
    public void whatsappDurum(PluginCall call) {
        JSObject r = new JSObject();
        r.put("normal", kurulu("com.whatsapp"));
        r.put("isletme", kurulu("com.whatsapp.w4b"));
        call.resolve(r);
    }

    /**
     * Fiş görselini (PNG, base64) mesaj metniyle birlikte doğrudan müşterinin WhatsApp sohbetine gönderir.
     * tel: 90 ile başlayan rakamlar (boşsa WhatsApp kişi seçtirir). paket: com.whatsapp / com.whatsapp.w4b.
     */
    @PluginMethod
    public void whatsappGonder(PluginCall call) {
        String veri = call.getString("veri");
        String tel = call.getString("tel", "");
        String metin = call.getString("metin", "");
        String paket = call.getString("paket", "");
        String ad = temizAd(call.getString("ad", "fis.png"));
        if (veri == null || veri.isEmpty()) {
            call.reject("Görsel yok");
            return;
        }
        try {
            byte[] bayt = Base64.decode(veri, Base64.DEFAULT);
            File dizin = new File(getContext().getCacheDir(), "fis");
            if (!dizin.exists()) dizin.mkdirs();
            File[] eski = dizin.listFiles();
            if (eski != null) {
                for (File x : eski) {
                    if (System.currentTimeMillis() - x.lastModified() > 86_400_000L) x.delete();
                }
            }
            if (!ad.toLowerCase().endsWith(".png")) ad = ad + ".png";
            File f = new File(dizin, ad);
            try (FileOutputStream fos = new FileOutputStream(f)) {
                fos.write(bayt);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);

            final Intent gonder = new Intent(Intent.ACTION_SEND);
            gonder.setType("image/png");
            gonder.putExtra(Intent.EXTRA_STREAM, uri);
            if (metin != null && !metin.isEmpty()) gonder.putExtra(Intent.EXTRA_TEXT, metin);
            gonder.setClipData(android.content.ClipData.newRawUri("fis", uri));
            gonder.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            String secilen = null;
            if (paket != null && !paket.isEmpty() && kurulu(paket)) secilen = paket;
            else if (kurulu("com.whatsapp")) secilen = "com.whatsapp";
            else if (kurulu("com.whatsapp.w4b")) secilen = "com.whatsapp.w4b";
            String no = tel == null ? "" : tel.replaceAll("\\D", "");
            if (secilen != null) {
                gonder.setPackage(secilen);
                // müşterinin sohbetini doğrudan açar (WhatsApp'ın belgelenmemiş ama yaygın kullanılan alanı)
                if (!no.isEmpty()) gonder.putExtra("jid", no + "@s.whatsapp.net");
            }
            final String sonPaket = secilen;
            Activity a = getActivity();
            if (a == null) {
                call.reject("Uygulama penceresi yok");
                return;
            }
            a.runOnUiThread(() -> {
                try {
                    if (sonPaket != null) a.startActivity(gonder);
                    else a.startActivity(Intent.createChooser(gonder, "Fişi gönder"));
                    JSObject r = new JSObject();
                    r.put("paket", sonPaket == null ? "" : sonPaket);
                    call.resolve(r);
                } catch (Exception e) {
                    try {
                        gonder.setPackage(null);
                        gonder.removeExtra("jid");
                        a.startActivity(Intent.createChooser(gonder, "Fişi gönder"));
                        JSObject r = new JSObject();
                        r.put("paket", "");
                        call.resolve(r);
                    } catch (Exception e2) {
                        call.reject("Gönderilemedi: " + e2.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            call.reject("Gönderilemedi: " + e.getMessage(), e);
        }
    }

    private static String temizAd(String ad) {
        if (ad == null || ad.trim().isEmpty()) return "dosya";
        return ad.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static String uzantiEkle(String ad, String tur) {
        if (ad.lastIndexOf('.') > 0) return ad;
        String uz = MimeTypeMap.getSingleton().getExtensionFromMimeType(tur);
        return uz != null ? ad + "." + uz : ad;
    }

    // ---------------------------------------------------------------- parmak izi (30 dk kilidi)
    private static int parmakYetki() {
        return Build.VERSION.SDK_INT >= 30
            ? (BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            : BiometricManager.Authenticators.BIOMETRIC_WEAK;
    }

    /** Telefonda parmak izi (ya da yüz / ekran kilidi) tanımlı mı? */
    @PluginMethod
    public void parmakDurum(PluginCall call) {
        JSObject r = new JSObject();
        int s;
        try { s = BiometricManager.from(getContext()).canAuthenticate(parmakYetki()); } catch (Exception e) { s = -1; }
        r.put("var", s == BiometricManager.BIOMETRIC_SUCCESS);
        r.put("kod", s);
        call.resolve(r);
    }

    /** Sistemin parmak izi ekranı; {ok:true} ya da {ok:false, kod, mesaj}. */
    @PluginMethod
    public void parmakDogrula(PluginCall call) {
        final String baslik = call.getString("baslik", "Gün Teknik");
        final String alt = call.getString("alt", "Devam etmek için parmak izini okut");
        Activity a = getActivity();
        if (!(a instanceof FragmentActivity)) {
            JSObject r = new JSObject(); r.put("ok", false); r.put("mesaj", "etkinlik yok"); call.resolve(r); return;
        }
        final FragmentActivity fa = (FragmentActivity) a;
        fa.runOnUiThread(() -> {
            try {
                BiometricPrompt bp = new BiometricPrompt(fa, ContextCompat.getMainExecutor(fa), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
                    }

                    @Override
                    public void onAuthenticationError(int kod, CharSequence mesaj) {
                        JSObject r = new JSObject(); r.put("ok", false); r.put("kod", kod); r.put("mesaj", String.valueOf(mesaj)); call.resolve(r);
                    }
                });
                BiometricPrompt.PromptInfo.Builder b = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(baslik)
                    .setSubtitle(alt)
                    .setAllowedAuthenticators(parmakYetki());
                if (Build.VERSION.SDK_INT < 30) b.setNegativeButtonText("Vazgeç");
                bp.authenticate(b.build());
            } catch (Exception e) {
                JSObject r = new JSObject(); r.put("ok", false); r.put("mesaj", String.valueOf(e.getMessage())); call.resolve(r);
            }
        });
    }
}
