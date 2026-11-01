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
        call.resolve(r);
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
        Activity a = getActivity();
        if (a != null) GuncellemeDenetci.denetle(a, true);
        call.resolve();
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

    private static String temizAd(String ad) {
        if (ad == null || ad.trim().isEmpty()) return "dosya";
        return ad.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static String uzantiEkle(String ad, String tur) {
        if (ad.lastIndexOf('.') > 0) return ad;
        String uz = MimeTypeMap.getSingleton().getExtensionFromMimeType(tur);
        return uz != null ? ad + "." + uz : ad;
    }
}
