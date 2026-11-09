package com.gunteknik.erp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Randevu alarmları: ERP'nin widget anlık görüntüsündeki snap.al listesini (önümüzdeki 14 gün) telefona
 * saat uygulaması gibi gerçek alarm olarak kurar (AlarmManager.setAlarmClock). Randevu değişince / silinince
 * alarm da güncellenir / kaldırılır. Telefon yeniden başlayınca ya da uygulama güncellenince yeniden kurulur.
 * Liste öğesi: {i, z, tur: once|an|gun, h, b, k, tel, ad, yol, g, s, d}
 */
public final class Alarmci {

    static final String EYLEM = "gt.alarm.cal";

    private Alarmci() {}

    private static SharedPreferences p(Context c) {
        return c.getApplicationContext().getSharedPreferences("gt_alarm", Context.MODE_PRIVATE);
    }

    /** widget_veri sonucundan alarmları eşitle. */
    public static synchronized void esitle(Context c, String veriJson) {
        try {
            JSONObject v = new JSONObject(veriJson);
            JSONObject snap = v.optJSONObject("snap");
            if (snap == null) return;
            JSONArray al = snap.optJSONArray("al");
            if (al == null) return; // ERP henüz alarm listesi yazmamış (eski sürüm): dokunma
            kur(c, al);
        } catch (Exception ignored) {}
    }

    /** Kayıtlı listeden yeniden kur (telefon açılınca, uygulama güncellenince). */
    public static synchronized void yeniden(Context c) {
        try {
            JSONArray al = new JSONArray(p(c).getString("liste", "[]"));
            p(c).edit().putString("kurulu", "[]").apply();
            kur(c, al);
        } catch (Exception ignored) {}
    }

    private static void kur(Context c, JSONArray al) throws Exception {
        Context a = c.getApplicationContext();
        long simdi = System.currentTimeMillis();
        Set<String> eski = new HashSet<>();
        JSONArray k = new JSONArray(p(a).getString("kurulu", "[]"));
        for (int n = 0; n < k.length(); n++) eski.add(k.getString(n));

        JSONArray liste = new JSONArray();
        JSONArray kurulu = new JSONArray();
        Set<String> yeni = new HashSet<>();
        String eskiImza = p(a).getString("imza", "");
        StringBuilder imza = new StringBuilder();
        for (int n = 0; n < al.length(); n++) {
            JSONObject x = al.optJSONObject(n);
            if (x == null) continue;
            String id = x.optString("i", "");
            long z = x.optLong("z", 0);
            if (id.isEmpty() || z <= simdi) continue;
            liste.put(x);
            yeni.add(id);
            kurulu.put(id);
            imza.append(id).append('@').append(z).append(';');
        }
        // ertelenmiş alarmlar listede yoktur ama korunur
        JSONArray ertelenen = new JSONArray(p(a).getString("ertelenen", "[]"));
        JSONArray ertKalan = new JSONArray();
        for (int n = 0; n < ertelenen.length(); n++) {
            JSONObject x = ertelenen.optJSONObject(n);
            if (x != null && x.optLong("z", 0) > simdi) {
                ertKalan.put(x);
                yeni.add(x.optString("i"));
                kurulu.put(x.optString("i"));
            }
        }
        boolean ayni = imza.toString().equals(eskiImza) && eski.containsAll(yeni);
        // kaldırılan / iptal edilen randevuların alarmlarını sil
        for (String id : eski) if (!yeni.contains(id)) iptal(a, id);
        if (!ayni || eski.isEmpty()) {
            for (int n = 0; n < liste.length(); n++) planla(a, liste.getJSONObject(n));
            for (int n = 0; n < ertKalan.length(); n++) planla(a, ertKalan.getJSONObject(n));
        }
        p(a).edit()
            .putString("liste", liste.toString())
            .putString("kurulu", kurulu.toString())
            .putString("ertelenen", ertKalan.toString())
            .putString("imza", imza.toString())
            .apply();
    }

    private static PendingIntent yayin(Context c, String id, String json) {
        Intent i = new Intent(c, AlarmAlici.class)
            .setAction(EYLEM)
            .setData(Uri.parse("gtalarm://a/" + Uri.encode(id)));
        if (json != null) i.putExtra("alarm", json);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void planla(Context c, JSONObject x) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long z = x.optLong("z", 0);
        PendingIntent op = yayin(c, x.optString("i"), x.toString());
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, z, op);
            } else {
                PendingIntent goster = Bildirimci.ac(c, "./?sayfa=takvim", 7300);
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(z, goster), op);
            }
        } catch (SecurityException e) {
            try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, z, op); } catch (Exception ignored) {}
        }
    }

    static void iptal(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent op = yayin(c, id, null);
        if (am != null) am.cancel(op);
        op.cancel();
    }

    /** "5 dk ertele" */
    static synchronized void ertele(Context c, JSONObject x, int dakika) {
        try {
            Context a = c.getApplicationContext();
            JSONObject e = new JSONObject(x.toString());
            String kok = x.optString("i").split("\\|e")[0];
            long z = System.currentTimeMillis() + dakika * 60_000L;
            e.put("i", kok + "|e" + z);
            e.put("z", z);
            e.put("ertelendi", true);
            JSONArray l = new JSONArray(p(a).getString("ertelenen", "[]"));
            l.put(e);
            JSONArray k = new JSONArray(p(a).getString("kurulu", "[]"));
            k.put(e.getString("i"));
            p(a).edit().putString("ertelenen", l.toString()).putString("kurulu", k.toString()).apply();
            planla(a, e);
        } catch (Exception ignored) {}
    }

    /** Çalan alarm listeden düşer (yeniden kurulmasın). */
    static synchronized void caldi(Context c, String id) {
        try {
            Context a = c.getApplicationContext();
            JSONArray k = new JSONArray(p(a).getString("kurulu", "[]"));
            JSONArray y = new JSONArray();
            for (int n = 0; n < k.length(); n++) if (!id.equals(k.optString(n))) y.put(k.optString(n));
            p(a).edit().putString("kurulu", y.toString()).apply();
        } catch (Exception ignored) {}
    }

    /** ERP ayar kartı için: kurulu alarm sayısı ve ilk alarm. */
    static JSONObject ozet(Context c) {
        JSONObject r = new JSONObject();
        try {
            long simdi = System.currentTimeMillis();
            JSONArray l = new JSONArray(p(c).getString("liste", "[]"));
            JSONArray e = new JSONArray(p(c).getString("ertelenen", "[]"));
            int say = 0;
            JSONObject ilk = null;
            for (JSONArray d : new JSONArray[]{l, e}) {
                for (int n = 0; n < d.length(); n++) {
                    JSONObject x = d.optJSONObject(n);
                    if (x == null || x.optLong("z") <= simdi) continue;
                    say++;
                    if (ilk == null || x.optLong("z") < ilk.optLong("z")) ilk = x;
                }
            }
            r.put("sayi", say);
            if (ilk != null) {
                r.put("ilkZ", ilk.optLong("z"));
                r.put("ilkB", ilk.optString("b"));
                r.put("ilkTur", ilk.optString("tur"));
            }
        } catch (Exception ignored) {}
        return r;
    }

    /** Deneme: 10 saniye sonra çalar. */
    static void dene(Context c) {
        try {
            JSONObject x = new JSONObject();
            long z = System.currentTimeMillis() + 10_000L;
            String s = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(new java.util.Date(z + 15 * 60_000L));
            x.put("i", "deneme|" + z).put("z", z).put("tur", "once").put("h", 15)
                .put("b", "🛠️ Deneme alarmı").put("k", "Gün Teknik").put("ad", "Alarm böyle çalacak")
                .put("g", "").put("s", s).put("deneme", true);
            planla(c.getApplicationContext(), x);
        } catch (Exception ignored) {}
    }
}
