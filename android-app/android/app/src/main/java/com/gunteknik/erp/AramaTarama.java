package com.gunteknik.erp;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CallLog;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Arama kaydını tarar, kurala uyan ve henüz sorulmamış aramaları sıraya alır, sıradakinin penceresini açar.
 * Kural: cevaplanmış gelen arama · ya da kaçırılan/reddedilen bir numarayı 24 saat içinde geri arayıp konuşma.
 * Yeni sayılmayanlar: rehberde kayıtlı her numara, 850 / 444 / 8xx-9xx ve şehir alan kodlu sabit hatlar.
 *
 * Üç yerden çalışır: görüşme bitince (AramaAlici yayını ve AramaNobetci servisi), uygulama açılınca ve her FCM mesajında.
 * Böylece telefon uygulamayı uyutup bir görüşmeyi kaçırtsa bile, uygulama bir sonraki uyanışında o aramayı sorar.
 * Uygulama ilk kez taradığında son 24 saate bakar; sonra yalnız son taramadan sonraki aramalara.
 */
final class AramaTarama {

    private static final Object KILIT = new Object();
    private static final long GUN = 24 * 3600_000L;

    private AramaTarama() {}

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("gt_arama", Context.MODE_PRIVATE);
    }

    private static boolean hazir(Context c, boolean izYaz) {
        if (Ayar.cihaz(c) == null) { if (izYaz) AramaAlici.iz(c, "Cihaz kaydı yok — uygulamada ERP'ye giriş yap"); return false; }
        if (ContextCompat.checkSelfPermission(c, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            if (izYaz) AramaAlici.iz(c, "Arama kaydı izni yok"); return false;
        }
        return true;
    }

    /** Görüşme bitti (yayın ya da servis). Aynı görüşme iki yerden gelirse bir kez işlenir. */
    static void cagriBitti(Context c, long bas) {
        synchronized (KILIT) {
            SharedPreferences p = p(c);
            long simdi = System.currentTimeMillis();
            if (simdi - p.getLong("sonBitis", 0) < 8000) return;
            p.edit().putLong("sonBitis", simdi).apply();
            if (!hazir(c, true)) return;
            // Arama kaydı bazı telefonlarda birkaç saniye geç yazılır
            long esik = Math.max(p.getLong("tarandi", 0), bas - 90_000L);
            boolean yazildi = false;
            for (int i = 0; i < 5 && !yazildi; i++) {
                try { Thread.sleep(i == 0 ? 1500 : 1700); } catch (InterruptedException e) { return; }
                yazildi = sonTarih(c) > esik;
            }
            if (!yazildi) { AramaAlici.iz(c, "Görüşme arama kaydında bulunamadı"); return; }
            tara(c, true, true);
        }
    }

    /** Arama kaydını tara; ac=true ise sırada arama varsa pencereyi aç. */
    static void tara(Context c, boolean ac, boolean gorusme) {
        synchronized (KILIT) {
            if (!hazir(c, gorusme)) return;
            SharedPreferences p = p(c);
            long simdi = System.currentTimeMillis();
            long tarandi = p.getLong("tarandi", 0);
            long alt = Math.max(tarandi, simdi - GUN);
            JSONArray k = kuyruk(p);
            SharedPreferences.Editor e = p.edit();
            String son = null;
            long enSon = tarandi;
            try (Cursor cur = c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                    new String[]{CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DURATION, CallLog.Calls.DATE},
                    CallLog.Calls.DATE + " > ?", new String[]{String.valueOf(alt)}, CallLog.Calls.DATE + " ASC")) {
                if (cur != null) {
                    while (cur.moveToNext()) {
                        long z = cur.getLong(3);
                        enSon = Math.max(enSon, z);
                        son = degerlendir(c, p, e, k, cur.getString(0), cur.getInt(1), cur.getLong(2), z);
                    }
                }
            } catch (Exception ex) {
                if (gorusme) AramaAlici.iz(c, "Arama kaydı okunamadı: " + ex.getMessage());
                return;
            }
            e.putLong("tarandi", enSon).putString("kuyruk", k.toString()).apply();
            if (gorusme && son != null) AramaAlici.iz(c, son);
            if (ac && k.length() > 0) ac(c, k);
        }
    }

    private static String degerlendir(Context c, SharedPreferences p, SharedPreferences.Editor e, JSONArray k,
                                      String numara, int tip, long sure, long zaman) {
        boolean geri = false;
        long kayitZamani = zaman;
        if (tip == CallLog.Calls.INCOMING_TYPE) {
            if (sure <= 0) return "Gelen arama 0 sn — pencere açılmaz";
        } else if (tip == CallLog.Calls.OUTGOING_TYPE) {
            if (sure <= 0) return "Giden arama (cevaplanmadı) — pencere açılmaz";
            long ilk = AramaAlici.oncekiGelen(c, numara, zaman);
            if (ilk <= 0) return "Giden arama — pencere açılmaz";
            geri = true;
            kayitZamani = ilk;
        } else {
            return "Cevapsız/reddedilen arama — geri ararsan pencere açılır";
        }
        String kurum = AramaAlici.kurumsalNumara(numara);
        if (kurum != null) return kurum + " (" + numara + ") — kaydedilmez";
        String ad = AramaAlici.rehberAd(c, numara);
        if (ad != null) return "Rehberde kayıtlı (" + ad + ") — yeni numara değil, kaydedilmez";
        String n = AramaAlici.son10(numara);
        if (geri && n != null && (System.currentTimeMillis() - p.getLong("pencere:" + n, 0) < GUN || siradaMi(k, n))) {
            return "Geri dönüş — bu numara bugün zaten soruldu";
        }
        try {
            k.put(new JSONObject().put("numara", numara == null ? "" : numara).put("sure", sure).put("zaman", kayitZamani).put("geri", geri));
        } catch (Exception ignored) {}
        if (n != null) e.putLong("pencere:" + n, System.currentTimeMillis());
        String kim = numara == null || numara.isEmpty() ? "Gizli numara" : numara;
        return (geri ? "Geri dönüş · " : "") + "Sıraya alındı: " + kim;
    }

    private static boolean siradaMi(JSONArray k, String n) {
        for (int i = 0; i < k.length(); i++) if (n.equals(AramaAlici.son10(k.optJSONObject(i).optString("numara")))) return true;
        return false;
    }

    private static long sonTarih(Context c) {
        try (Cursor cur = c.getContentResolver().query(CallLog.Calls.CONTENT_URI, new String[]{CallLog.Calls.DATE}, null, null, CallLog.Calls.DATE + " DESC")) {
            if (cur != null && cur.moveToFirst()) return cur.getLong(0);
        } catch (Exception ignored) {}
        return 0;
    }

    private static JSONArray kuyruk(SharedPreferences p) {
        try {
            JSONArray k = new JSONArray(p.getString("kuyruk", "[]"));
            // 3 günden eski bekleyenleri at
            JSONArray o = new JSONArray();
            long sinir = System.currentTimeMillis() - 3 * GUN;
            for (int i = 0; i < k.length(); i++) if (k.optJSONObject(i) != null && k.optJSONObject(i).optLong("zaman") > sinir) o.put(k.optJSONObject(i));
            return o;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static int bekleyen(Context c) {
        return kuyruk(p(c)).length();
    }

    static Intent pencereIntent(Context c, JSONObject x, int toplam) {
        return new Intent(c, AramaPenceresi.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("numara", x.optString("numara"))
            .putExtra("sure", (int) x.optLong("sure"))
            .putExtra("zaman", x.optLong("zaman"))
            .putExtra("geri", x.optBoolean("geri"))
            .putExtra("kalan", toplam - 1);
    }

    /** Sıradaki aramanın penceresini aç; açılmazsa bildirim. */
    private static void ac(Context c, JSONArray k) {
        if (AramaPenceresi.acik) return;              // pencere zaten ekranda: bitince sıradakine geçer
        JSONObject x = k.optJSONObject(0);
        if (x == null) return;
        Intent pen = pencereIntent(c, x, k.length());
        String no = x.optString("numara");
        String kim = (no.isEmpty() ? "Gizli numara" : no) + (k.length() > 1 ? " (+" + (k.length() - 1) + " arama)" : "");
        boolean geri = x.optBoolean("geri");
        SharedPreferences p = p(c);
        long t0 = System.currentTimeMillis();
        boolean izin = Settings.canDrawOverlays(c);
        String hata = null;
        try {
            if (izin) hata = AramaAlici.ustundenBaslat(c, pen);
            for (int i = 0; i < 14 && izin; i++) {
                Thread.sleep(300);
                if (p.getLong("pencereAcildi", 0) >= t0) { AramaAlici.iz(c, (geri ? "Geri dönüş · " : "") + "Pencere açıldı: " + kim); return; }
            }
        } catch (InterruptedException ignored) {}
        AramaAlici.iz(c, (geri ? "Geri dönüş · " : "") + (!izin ? "Üstte gösterme izni yok" : hata != null ? "Pencere açılamadı (" + hata + ")" : "Pencere Android tarafından engellendi")
            + " — bildirim gönderildi: " + kim);
        Bildirimci.aramaBekliyor(c, pen, kim);
    }

    /** Pencere bu aramayı bitirdi (kaydedildi / spam / özel / atlandı). Sıradaki varsa onun intent'i. */
    static Intent cikar(Context c, long zaman) {
        synchronized (KILIT) {
            SharedPreferences p = p(c);
            JSONArray k = kuyruk(p);
            JSONArray o = new JSONArray();
            for (int i = 0; i < k.length(); i++) if (k.optJSONObject(i).optLong("zaman") != zaman) o.put(k.optJSONObject(i));
            p.edit().putString("kuyruk", o.toString()).apply();
            return o.length() > 0 ? pencereIntent(c, o.optJSONObject(0), o.length()) : null;
        }
    }
}
