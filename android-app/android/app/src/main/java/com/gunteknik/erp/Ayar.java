package com.gunteknik.erp;

import android.content.Context;
import android.content.SharedPreferences;

/** Sabitler ve yerel ayarlar (SharedPreferences). */
public final class Ayar {

    public static final String SB_URL = "https://zfflnrerdevnflchscqe.supabase.co";
    // Supabase "anon" anahtarı — ERP'nin index.html'inde de açık duruyor; yetki cihaz anahtarıyla RPC'lerde denetlenir.
    public static final String SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZmxucmVyZGV2bmZsY2hzY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzQ3MjUsImV4cCI6MjA5NjQxMDcyNX0.uby8MidaKpnsceel5E_zTJm3LTYwoMrbKUryr5ZszcI";
    public static final String ERP_URL = "https://gokaysegun.github.io/GunTeknik/";

    /** ERP'deki ISLETME_HİZ anahtarları + Diğer (sıra önemli: widget düğmeleri s0..s7). */
    public static final String[] SEKTORLER = {"Elektrik", "Klima", "TV, Uydu, Çanak", "İnternet", "Sıhhi Tesisat", "Metal", "Ahşap", "Diğer"};
    public static final String[] SEKTOR_KISA = {"Elektrik", "Klima", "TV/Uydu", "İnternet", "Tesisat", "Metal", "Ahşap", "Diğer"};

    private Ayar() {}

    private static SharedPreferences p(Context c) {
        return c.getApplicationContext().getSharedPreferences("gt_ayar", Context.MODE_PRIVATE);
    }

    /** Sunucunun bu telefona verdiği cihaz anahtarı (ERP'ye giriş yapılınca gelir). */
    public static String cihaz(Context c) { return p(c).getString("cihaz", null); }
    public static void cihaz(Context c, String t) { p(c).edit().putString("cihaz", t).apply(); }

    public static String fcm(Context c) { return p(c).getString("fcm", null); }
    public static void fcm(Context c, String t) { p(c).edit().putString("fcm", t).apply(); }

    /** Widget'taki +1 düğmelerinin kanalı: tel | wa */
    public static String kanal(Context c) { return p(c).getString("kanal", "tel"); }
    public static void kanal(Context c, String k) { p(c).edit().putString("kanal", k).apply(); }

    /** Kasa rakamları açık mı? (varsayılan gizli) */
    public static boolean kasaAcik(Context c) { return p(c).getBoolean("kasaAcik", false); }
    public static void kasaAcik(Context c, boolean a) { p(c).edit().putBoolean("kasaAcik", a).apply(); }

    /** widget_veri() sonucunun önbelleği */
    public static String veri(Context c) { return p(c).getString("veri", null); }
    public static long veriZaman(Context c) { return p(c).getLong("veriZaman", 0); }
    public static void veri(Context c, String json) {
        p(c).edit().putString("veri", json).putLong("veriZaman", System.currentTimeMillis()).apply();
    }
    /** İyimser güncelleme: zaman damgasını değiştirmeden önbelleği yaz. */
    public static void veriYerel(Context c, String json) { p(c).edit().putString("veri", json).apply(); }

    /** Widget'tan girilen son arama (geri al için) */
    public static long sonArama(Context c) { return p(c).getLong("sonArama", 0); }
    public static void sonArama(Context c, long id) { p(c).edit().putLong("sonArama", id).apply(); }

    public static boolean bayrak(Context c, String ad) { return p(c).getBoolean(ad, false); }
    public static void bayrak(Context c, String ad, boolean v) { p(c).edit().putBoolean(ad, v).apply(); }
}
