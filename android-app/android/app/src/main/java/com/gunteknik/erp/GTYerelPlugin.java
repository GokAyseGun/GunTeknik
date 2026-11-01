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

import androidx.core.content.FileProvider;

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
