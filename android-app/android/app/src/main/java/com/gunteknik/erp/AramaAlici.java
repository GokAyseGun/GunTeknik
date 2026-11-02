package com.gunteknik.erp;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Telefon görüşmesi bitince (IDLE) arama kaydına bakar.
 * Gelen ve cevaplanmış arama + yeni numara ise arama penceresini açar.
 * Yeni sayılmayanlar: rehberde kayıtlı her numara, 850 / 444 / 800 numaraları ve şehir alan kodlu sabit hatlar.
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
        // Sunucuya da yaz (cihazlar.tani): telefona bakmadan sorun ayıklanabilsin
        final String t = Ayar.cihaz(c);
        if (t == null) return;
        final boolean ust = Settings.canDrawOverlays(c);
        new Thread(() -> {
            try {
                JSONObject b = new JSONObject().put("sdk", Build.VERSION.SDK_INT).put("model", Build.MANUFACTURER + " " + Build.MODEL).put("ust", ust);
                Sunucu.rpc("cihaz_tani", new JSONObject().put("p_token", t).put("p_metin", sonuc).put("p_bilgi", b));
            } catch (Exception ignored) {}
        }).start();
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
        // Geri dönüş: kaçırılan/reddedilen yeni numarayı 24 saat içinde geri arayıp konuştuysan pencere açılır (arama, müşterinin ilk aradığı saatle kaydedilir)
        boolean geri = false;
        if (tip == CallLog.Calls.OUTGOING_TYPE) {
            if (sure <= 0) { iz(c, "Giden arama (cevaplanmadı) — pencere açılmaz"); return; }
            long ilk = oncekiGelen(c, numara, zaman);
            if (ilk <= 0) { iz(c, "Giden arama — pencere açılmaz"); return; }
            if (System.currentTimeMillis() - c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE).getLong("pencere:" + son10(numara), 0) < 24 * 3600_000L) {
                iz(c, "Geri dönüş — bu numara için bugün pencere zaten açıldı"); return;
            }
            geri = true;
            zaman = ilk;
        } else if (tip != CallLog.Calls.INCOMING_TYPE) {
            iz(c, "Cevapsız/reddedilen arama — geri ararsan pencere açılır"); return;
        }
        if (sure <= 0) { iz(c, "Gelen arama 0 sn — pencere açılmaz"); return; }

        SharedPreferences p = c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE);
        if (p.getLong("sonKayit", 0) == zaman) { iz(c, "Aynı görüşme ikinci kez bildirildi"); return; }
        p.edit().putLong("sonKayit", zaman).apply();

        String kurum = kurumsalNumara(numara);
        if (kurum != null) { iz(c, kurum + " (" + numara + ") — kaydedilmez"); return; }
        String ad = rehberAd(c, numara);
        if (ad != null) { iz(c, "Rehberde kayıtlı (" + ad + ") — yeni numara değil, kaydedilmez"); return; }

        Intent pen = new Intent(c, AramaPenceresi.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("numara", numara)
            .putExtra("ad", ad)
            .putExtra("sure", (int) sure)
            .putExtra("zaman", zaman)
            .putExtra("geri", geri);
        if (son10(numara) != null) p.edit().putLong("pencere:" + son10(numara), System.currentTimeMillis()).apply();
        String kim = ad != null ? ad : (numara == null || numara.isEmpty() ? "Gizli numara" : numara);
        final long t0 = System.currentTimeMillis();
        boolean izin = Settings.canDrawOverlays(c);
        String hata = null;
        if (izin) hata = ustundenBaslat(c, pen);
        // Pencere gerçekten açıldı mı? (Android arka plandan açmayı sessizce engelleyebilir)
        for (int i = 0; i < 14 && izin; i++) {
            Thread.sleep(300);
            if (p.getLong("pencereAcildi", 0) >= t0) { iz(c, (geri ? "Geri dönüş · " : "") + "Pencere açıldı: " + kim); return; }
        }
        iz(c, (geri ? "Geri dönüş · " : "") + (!izin ? "Üstte gösterme izni yok" : hata != null ? "Pencere açılamadı (" + hata + ")" : "Pencere Android tarafından engellendi")
            + " — bildirim gönderildi: " + kim);
        Bildirimci.aramaBekliyor(c, pen, kim);
    }

    /**
     * Android 15+ (hedef SDK 35+): "üstte gösterme" izni olan uygulama arka plandan pencere açabilmek için
     * o an ekranda kendi üst katman penceresine sahip olmalı. 1 piksellik görünmez bir katman ekleyip pencereyi
     * onunla açıyoruz; katman 3 sn sonra kaldırılır.
     */
    private static String ustundenBaslat(Context c, Intent pen) throws InterruptedException {
        final Handler h = new Handler(Looper.getMainLooper());
        final CountDownLatch bitti = new CountDownLatch(1);
        final String[] hata = {null};
        h.post(() -> {
            final WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
            View v = null;
            try {
                v = new View(c);
                @SuppressWarnings("deprecation")
                int tip = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
                WindowManager.LayoutParams lp = new WindowManager.LayoutParams(1, 1, tip,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT);
                lp.gravity = Gravity.TOP | Gravity.START;
                wm.addView(v, lp);
            } catch (Exception e) {
                v = null;
            }
            final View ust = v;
            h.postDelayed(() -> {
                try {
                    c.startActivity(pen);
                } catch (Exception e) {
                    hata[0] = e.getClass().getSimpleName();
                }
                if (ust != null) h.postDelayed(() -> { try { wm.removeView(ust); } catch (Exception ignored) {} }, 3000);
                bitti.countDown();
            }, ust != null ? 300 : 0);
        });
        bitti.await(5, TimeUnit.SECONDS);
        return hata[0];
    }

    /** Bu numaradan, verilen andan önceki 24 saatte gelen / kaçırılan / reddedilen arama varsa o aramanın zamanı; yoksa 0. */
    static long oncekiGelen(Context c, String numara, long once) {
        String n = son10(numara);
        if (n == null) return 0;
        try (Cursor cur = c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                new String[]{CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE},
                CallLog.Calls.DATE + " > ?", new String[]{String.valueOf(once - 24 * 3600_000L)}, CallLog.Calls.DATE + " DESC")) {
            if (cur == null) return 0;
            while (cur.moveToNext()) {
                long d = cur.getLong(2);
                if (d >= once) continue;
                int t = cur.getInt(1);
                boolean gelen = t == CallLog.Calls.INCOMING_TYPE || t == CallLog.Calls.MISSED_TYPE || t == CallLog.Calls.REJECTED_TYPE;
                if (gelen && n.equals(son10(cur.getString(0)))) return d;
            }
        } catch (Exception ignored) {}
        return 0;
    }

    /** Karşılaştırma için numaranın son 10 hanesi */
    static String son10(String numara) {
        if (numara == null) return null;
        String d = numara.replaceAll("[^0-9]", "");
        if (d.length() < 7) return null;
        return d.length() > 10 ? d.substring(d.length() - 10) : d;
    }

    /**
     * Türkiye numarası ise ulusal 10 haneye indirip türüne bakar.
     * 850 / 444 / 800 / 900 hatları ve 2xx-3xx-4xx şehir alan kodlu sabit hatlar → sebep metni; cep (5xx) ve yabancı numaralar → null.
     */
    static String kurumsalNumara(String numara) {
        if (numara == null) return null;
        String n = numara.trim();
        boolean arti = n.startsWith("+");
        String d = n.replaceAll("[^0-9]", "");
        if (d.isEmpty()) return null;
        if (d.startsWith("444") && d.length() <= 8) return "444'lü numara";
        String ulusal;
        if (arti || d.startsWith("00")) {
            String u = arti ? d : d.substring(2);
            if (!u.startsWith("90")) return null;            // yabancı numara: kaydedilir
            ulusal = u.substring(2);
        } else if (d.startsWith("0")) {
            ulusal = d.substring(1);
        } else if (d.length() == 12 && d.startsWith("90")) {
            ulusal = d.substring(2);
        } else {
            ulusal = d;
        }
        if (ulusal.startsWith("444")) return "444'lü numara";
        if (ulusal.length() != 10) return null;
        char ilk = ulusal.charAt(0);
        if (ulusal.startsWith("850")) return "850'li numara";
        if (ilk == '8' || ilk == '9') return "Kurumsal/özel servis numarası";
        if (ilk == '2' || ilk == '3' || ilk == '4') return "Sabit hat (alan kodu " + ulusal.substring(0, 3) + ")";
        return null;
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
