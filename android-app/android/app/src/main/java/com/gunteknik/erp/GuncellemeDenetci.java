package com.gunteknik.erp;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.appcompat.app.AlertDialog;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * GitHub Releases'taki en son "android-vN" sürümüne bakar; N bu APK'nın sürüm
 * kodundan büyükse güncellemeyi önerir. Yerel parçalar değişince GitHub Actions
 * yeni APK'yı derleyip Releases'a koyar; burası onu bulur.
 */
public final class GuncellemeDenetci {

    private static final String API = "https://api.github.com/repos/GokAyseGun/GunTeknik/releases/latest";
    private static final String ETIKET_ON = "android-v";
    private static final long ARALIK_MS = 6L * 60 * 60 * 1000; // 6 saatte bir

    private static volatile boolean calisiyor = false;

    private GuncellemeDenetci() {}

    public static void denetle(final Activity a, boolean zorla) {
        if (calisiyor) return;
        final SharedPreferences p = a.getSharedPreferences("gt_guncelleme", Context.MODE_PRIVATE);
        long simdi = System.currentTimeMillis();
        if (!zorla && simdi - p.getLong("son", 0) < ARALIK_MS) return;
        calisiyor = true;

        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(API).openConnection();
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "GunTeknik-Android");
                if (c.getResponseCode() != 200) return;

                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                    String satir;
                    while ((satir = r.readLine()) != null) sb.append(satir);
                }
                p.edit().putLong("son", System.currentTimeMillis()).apply();

                JSONObject j = new JSONObject(sb.toString());
                String etiket = j.optString("tag_name", "");
                if (!etiket.startsWith(ETIKET_ON)) return;
                final int yeni = Integer.parseInt(etiket.substring(ETIKET_ON.length()).trim());
                if (yeni <= surumKodu(a)) return;

                String apk = null;
                JSONArray varliklar = j.optJSONArray("assets");
                if (varliklar != null) {
                    for (int i = 0; i < varliklar.length(); i++) {
                        JSONObject v = varliklar.getJSONObject(i);
                        if (v.optString("name").endsWith(".apk")) {
                            apk = v.optString("browser_download_url");
                            break;
                        }
                    }
                }
                final String indir = apk != null ? apk : j.optString("html_url");
                final String notlar = j.optString("body", "").trim();

                a.runOnUiThread(() -> {
                    if (a.isFinishing() || a.isDestroyed()) return;
                    String mesaj = "Sürüm " + yeni + " hazır (sende: " + surumKodu(a) + ").";
                    if (!notlar.isEmpty()) mesaj += "\n\n" + notlar;
                    mesaj += "\n\nİndirdikten sonra dosyaya dokunup \"Güncelle\"yi seç.";
                    new AlertDialog.Builder(a)
                        .setTitle("Gün Teknik güncellemesi")
                        .setMessage(mesaj)
                        .setPositiveButton("İndir", (d, w) -> {
                            try {
                                a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(indir)));
                            } catch (Exception ignored) {}
                        })
                        .setNegativeButton("Sonra", null)
                        .show();
                });
            } catch (Exception ignored) {
                // Ağ yoksa sessizce geç; bir sonraki açılışta yeniden bakılır.
            } finally {
                calisiyor = false;
            }
        }).start();
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
