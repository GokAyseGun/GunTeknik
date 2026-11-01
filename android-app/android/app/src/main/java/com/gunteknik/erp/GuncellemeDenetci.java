package com.gunteknik.erp;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Kendi kendine güncelleme.
 * 1) GitHub'daki son "android-vN" sürümüne bakar (releases/latest yönlendirmesi; API sınırı yok).
 * 2) N bu kurulumdan büyükse APK'yı uygulamanın kendi klasörüne indirir.
 * 3) Uygulama ekranda değilse Android'in kurulum sistemiyle (PackageInstaller) kurar.
 *    Android 12+ : uygulama kendini bir kez güncelledikten sonra sonraki güncellemeler genellikle onay istemez.
 * Tetikleyiciler: FCM "guncelle" sinyali (Supabase 10 dk'da bir GitHub'a bakar), uygulama açılışı, widget yenilemesi.
 */
public final class GuncellemeDenetci {

    private static final String SAYFA = "https://github.com/GokAyseGun/GunTeknik/releases/latest";
    private static final String INDIR = "https://github.com/GokAyseGun/GunTeknik/releases/download/%s/GunTeknik.apk";
    private static final Pattern ETIKET = Pattern.compile("/tag/(android-v(\\d+))");
    private static final long ARALIK_MS = 60L * 60 * 1000; // zorlanmadıkça saatte bir

    private static volatile boolean calisiyor = false;

    private GuncellemeDenetci() {}

    private static SharedPreferences p(Context c) {
        return c.getApplicationContext().getSharedPreferences("gt_guncelleme", Context.MODE_PRIVATE);
    }

    /** Eski çağrı: uygulama açılışında. */
    public static void denetle(Activity a, boolean zorla) {
        arkaplan(a.getApplicationContext(), zorla, false);
    }

    /** Arka planda denetle / indir / (uygun anda) kur. */
    public static void arkaplan(Context c, boolean zorla, boolean hemenKur) {
        final Context a = c.getApplicationContext();
        if (calisiyor) return;
        if (!zorla && System.currentTimeMillis() - p(a).getLong("son", 0) < ARALIK_MS) {
            // denetim zamanı gelmedi ama indirilmiş bekleyen varsa ve uygulama kapalıysa kur
            if (!MainActivity.onde) new Thread(() -> bekleyeniKur(a, false)).start();
            return;
        }
        new Thread(() -> simdi(a, hemenKur)).start();
    }

    /** Eşzamanlı (FCM servisinden çağrılır). */
    public static void simdi(Context c, boolean hemenKur) {
        final Context a = c.getApplicationContext();
        if (calisiyor) return;
        calisiyor = true;
        try {
            p(a).edit().putLong("son", System.currentTimeMillis()).apply();
            String[] e = sonEtiket();
            if (e == null) return;
            int yeni = Integer.parseInt(e[1]);
            if (yeni <= surumKodu(a)) { temizle(a, -1); return; }
            File f = apk(a, yeni);
            if (!f.exists() || f.length() < 200_000) {
                temizle(a, yeni);
                indir(String.format(INDIR, e[0]), f);
            }
            p(a).edit().putInt("bekleyen", yeni).apply();
            if (hemenKur || !MainActivity.onde) kur(a, f);
        } catch (Exception ignored) {
        } finally {
            calisiyor = false;
        }
    }

    /** İndirilmiş bir güncelleme varsa kur (uygulama arka plana geçince). */
    public static void bekleyeniKur(Context c, boolean zorla) {
        Context a = c.getApplicationContext();
        int n = p(a).getInt("bekleyen", 0);
        if (n <= surumKodu(a)) return;
        File f = apk(a, n);
        if (!f.exists() || f.length() < 200_000) return;
        if (!zorla && MainActivity.onde) return;
        try {
            kur(a, f);
        } catch (Exception ignored) {}
    }

    public static boolean kurIzniVar(Context c) {
        return Build.VERSION.SDK_INT < 26 || c.getPackageManager().canRequestPackageInstalls();
    }

    public static int bekleyen(Context c) {
        int n = p(c).getInt("bekleyen", 0);
        return n > surumKodu(c) ? n : 0;
    }

    // ---------------------------------------------------------------- iç işler
    private static String[] sonEtiket() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(SAYFA).openConnection();
        try {
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            c.setRequestProperty("User-Agent", "GunTeknik-Android");
            c.getResponseCode();
            String yer = c.getHeaderField("Location");
            if (yer == null) return null;
            Matcher m = ETIKET.matcher(yer);
            return m.find() ? new String[]{m.group(1), m.group(2)} : null;
        } finally {
            c.disconnect();
        }
    }

    private static void indir(String adres, File hedef) throws Exception {
        File gecici = new File(hedef.getPath() + ".parca");
        HttpURLConnection c = (HttpURLConnection) new URL(adres).openConnection();
        try {
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "GunTeknik-Android");
            if (c.getResponseCode() != 200) throw new Exception("İndirme " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(gecici)) {
                byte[] b = new byte[64 * 1024];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
            }
        } finally {
            c.disconnect();
        }
        if (!gecici.renameTo(hedef)) throw new Exception("Dosya taşınamadı");
    }

    private static void kur(Context c, File f) throws Exception {
        if (!kurIzniVar(c)) {
            p(c).edit().putBoolean("izinGerekli", true).apply();
            return;
        }
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(c.getPackageName());
        sp.setSize(f.length());
        if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        if (Build.VERSION.SDK_INT >= 34) sp.setRequestUpdateOwnership(true);
        int id = pi.createSession(sp);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(f); OutputStream out = s.openWrite("gunteknik", 0, f.length())) {
                byte[] b = new byte[64 * 1024];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                s.fsync(out);
            }
            Intent i = new Intent(c, KurulumAlici.class).setAction("com.gunteknik.erp.KURULUM");
            int bayrak = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pend = PendingIntent.getBroadcast(c, 7700, i, bayrak);
            s.commit(pend.getIntentSender());
        }
    }

    private static File apk(Context c, int surum) {
        File d = new File(c.getFilesDir(), "guncelleme");
        if (!d.exists()) d.mkdirs();
        return new File(d, "gunteknik-" + surum + ".apk");
    }

    /** "tut" dışındaki indirilmiş dosyaları sil (-1: hepsini). */
    static void temizle(Context c, int tut) {
        File d = new File(c.getApplicationContext().getFilesDir(), "guncelleme");
        File[] L = d.listFiles();
        if (L == null) return;
        for (File f : L) if (tut < 0 || !f.getName().contains("-" + tut + ".apk")) f.delete();
    }

    public static long surumKodu(Context c) {
        PackageInfo pi = paket(c);
        if (pi == null) return 0;
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? pi.getLongVersionCode() : pi.versionCode;
    }

    public static String surumAdi(Context c) {
        PackageInfo pi = paket(c);
        return pi != null && pi.versionName != null ? pi.versionName : "";
    }

    private static PackageInfo paket(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }
}
