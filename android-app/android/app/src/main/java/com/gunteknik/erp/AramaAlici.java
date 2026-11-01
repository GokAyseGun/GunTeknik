package com.gunteknik.erp;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

/**
 * Telefon görüşmesi bitince (IDLE) arama kaydına bakar.
 * Gelen ve cevaplanmış arama + numara rehberde yok ya da "GT" ile kayıtlıysa arama penceresini açar.
 * Rehberdeki diğer kişiler (özel kayıtlar) için pencere açılmaz.
 */
public class AramaAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent i) {
        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(i.getAction())) return;
        String durum = i.getStringExtra(TelephonyManager.EXTRA_STATE);
        final Context c = ctx.getApplicationContext();
        SharedPreferences p = c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE);
        iz(c, "Telefon durumu alındı: " + durum);

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(durum) || TelephonyManager.EXTRA_STATE_OFFHOOK.equals(durum)) {
            if (!p.getBoolean("aktif", false)) p.edit().putBoolean("aktif", true).putLong("bas", System.currentTimeMillis()).apply();
            return;
        }
        if (!TelephonyManager.EXTRA_STATE_IDLE.equals(durum) || !p.getBoolean("aktif", false)) return;
        p.edit().putBoolean("aktif", false).apply();
        final long bas = p.getLong("bas", 0);

        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                isle(c, bas);
            } catch (Exception ignored) {
            } finally {
                pr.finish();
            }
        }).start();
    }

    /** Son algılama adımını sakla (ERP → Ayarlar → Android kartında görünür; sorun ayıklamak için). */
    static void iz(Context c, String sonuc) {
        c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE).edit()
            .putLong("sonOlay", System.currentTimeMillis()).putString("sonSonuc", sonuc).apply();
    }

    private static void isle(Context c, long bas) throws InterruptedException {
        if (Ayar.cihaz(c) == null) { iz(c, "Cihaz kaydı yok — uygulamada ERP'ye giriş yap"); return; }
        if (ContextCompat.checkSelfPermission(c, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) { iz(c, "Arama kaydı izni yok"); return; }

        // Arama kaydı bazı telefonlarda birkaç saniye geç yazılır: 4 kez dene
        String numara = null; int tip = 0; long sure = 0, zaman = 0;
        boolean bulundu = false;
        for (int deneme = 0; deneme < 4 && !bulundu; deneme++) {
            Thread.sleep(deneme == 0 ? 1500 : 1700);
            try (Cursor cur = c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                    new String[]{CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DURATION, CallLog.Calls.DATE},
                    null, null, CallLog.Calls.DATE + " DESC")) {
                if (cur == null || !cur.moveToFirst()) continue;
                zaman = cur.getLong(3);
                if (zaman < bas - 90_000L) continue;                 // henüz bu görüşme yazılmamış
                numara = cur.getString(0);
                tip = cur.getInt(1);
                sure = cur.getLong(2);
                bulundu = true;
            } catch (Exception e) {
                iz(c, "Arama kaydı okunamadı: " + e.getMessage());
                return;
            }
        }
        if (!bulundu) { iz(c, "Görüşme arama kaydında bulunamadı"); return; }
        if (tip != CallLog.Calls.INCOMING_TYPE) { iz(c, (tip == CallLog.Calls.OUTGOING_TYPE ? "Giden arama" : "Cevapsız/reddedilen arama") + " — pencere açılmaz"); return; }
        if (sure <= 0) { iz(c, "Gelen arama 0 sn — pencere açılmaz"); return; }

        SharedPreferences p = c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE);
        if (p.getLong("sonKayit", 0) == zaman) { iz(c, "Aynı görüşme ikinci kez bildirildi"); return; }
        p.edit().putLong("sonKayit", zaman).apply();

        String ad = rehberAd(c, numara);
        if (ad != null && !gtMi(ad)) { iz(c, "Rehberde özel kayıt (" + ad + ") — pencere açılmaz"); return; }

        Intent pen = new Intent(c, AramaPenceresi.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("numara", numara)
            .putExtra("ad", ad)
            .putExtra("sure", (int) sure)
            .putExtra("zaman", zaman);
        String kim = ad != null ? ad : (numara == null || numara.isEmpty() ? "Gizli numara" : numara);
        if (Settings.canDrawOverlays(c)) {
            try {
                c.startActivity(pen);
                iz(c, "Pencere açıldı: " + kim);
                return;
            } catch (Exception e) {
                iz(c, "Pencere açılamadı (" + e.getClass().getSimpleName() + ") — bildirim gönderildi: " + kim);
            }
        } else {
            iz(c, "Üstte gösterme izni yok — bildirim gönderildi: " + kim);
        }
        Bildirimci.aramaBekliyor(c, pen, kim);
    }

    static String rehberAd(Context c, String numara) {
        if (numara == null || numara.isEmpty()) return null;
        if (ContextCompat.checkSelfPermission(c, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null;
        Uri u = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(numara));
        try (Cursor cur = c.getContentResolver().query(u, new String[]{ContactsContract.PhoneLookup.DISPLAY_NAME}, null, null, null)) {
            if (cur != null && cur.moveToFirst()) return cur.getString(0);
        } catch (Exception ignored) {}
        return null;
    }

    /** "GT Ahmet", "GT-Ahmet", "GTAhmet", "gt ahmet" → müşteri */
    static boolean gtMi(String ad) {
        String s = ad.trim();
        if (s.startsWith("GT")) return true;
        if (s.length() >= 2 && s.substring(0, 2).equalsIgnoreCase("gt")) return s.length() == 2 || !Character.isLetter(s.charAt(2));
        return false;
    }
}
