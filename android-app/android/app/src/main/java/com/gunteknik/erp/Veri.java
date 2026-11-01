package com.gunteknik.erp;

import android.content.Context;

import org.json.JSONObject;

/** widget_veri() → önbellek → tüm widget'lar. */
public final class Veri {

    private Veri() {}

    public static synchronized boolean yenile(Context c) {
        Context a = c.getApplicationContext();
        String t = Ayar.cihaz(a);
        if (t == null) { WidgetCizici.hepsi(a); return false; }
        try {
            String r = Sunucu.rpc("widget_veri", new JSONObject().put("p_token", t));
            if (r == null || r.trim().isEmpty() || r.trim().equals("null")) return false;
            Ayar.veri(a, r);
            WidgetCizici.hepsi(a);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static void arkaplanda(Context c) {
        final Context a = c.getApplicationContext();
        new Thread(() -> yenile(a)).start();
    }

    public static JSONObject oku(Context c) {
        try {
            String s = Ayar.veri(c);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }
}
