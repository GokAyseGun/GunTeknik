package com.gunteknik.erp;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.Map;

/** Yerel bildirimler: FCM'den gelen hatırlatmalar ve arama kaydı. */
public final class Bildirimci {

    public static final String K_HATIRLATMA = "hatirlatma";
    public static final String K_ARAMA = "arama_kaydi";
    private static final int RENK = 0xFFE8197A;

    private Bildirimci() {}

    public static void kanallar(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel h = new NotificationChannel(K_HATIRLATMA, "Hatırlatmalar", NotificationManager.IMPORTANCE_HIGH);
        h.setDescription("Arama hatırlatması, ödeme günleri, ajanda, reklam özeti");
        nm.createNotificationChannel(h);
        NotificationChannel a = new NotificationChannel(K_ARAMA, "Arama kaydı", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Arama bitince kaynağını ve sonucunu sorar");
        nm.createNotificationChannel(a);
    }

    private static boolean izinVar(Context c) {
        return Build.VERSION.SDK_INT < 33
            || ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    /** FCM "bildirim" mesajı: {baslik, govde, url, eylem(json), etiket} */
    public static void goster(Context c, Map<String, String> d) {
        if (!izinVar(c)) return;
        kanallar(c);
        String baslik = d.get("baslik") != null ? d.get("baslik") : "Gün Teknik";
        String govde = d.get("govde") != null ? d.get("govde") : "";
        String url = d.get("url") != null ? d.get("url") : "./";
        String etiket = d.get("etiket") != null ? d.get("etiket") : "genel";

        JSONObject eylem = null;
        try {
            String e = d.get("eylem");
            if (e != null && !e.equals("null") && !e.isEmpty()) eylem = new JSONObject(e);
        } catch (Exception ignored) {}

        String tip = eylem != null ? eylem.optString("tip", "") : "";
        int id = ("takip".equals(tip) ? "takip:" + eylem.optLong("id") : etiket).hashCode() & 0x0fffffff;

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, K_HATIRLATMA)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(RENK)
            .setContentTitle(baslik)
            .setContentText(govde)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(govde))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(ac(c, url, id));

        if ("arama".equals(tip)) {
            String tarih = eylem.optString("tarih", "");
            b.addAction(0, "📞 Sektörle gir", ac(c, "./?arama=" + tarih, id + 1));
            b.addAction(0, "Arama gelmedi", yayin(c, EylemAlici.ARAMA_YOK, id + 2, id, "tarih", tarih, null, 0));
        } else if ("takip".equals(tip)) {
            long aid = eylem.optLong("id");
            b.addAction(0, "✅ İş alındı", yayin(c, EylemAlici.TAKIP, id + 1, id, "sonuc", "is_alindi", "id", aid));
            b.addAction(0, "❌ Oluşmadı", yayin(c, EylemAlici.TAKIP, id + 2, id, "sonuc", "olusmadi", "id", aid));
        }
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException ignored) {}
    }

    /** Üstte gösterme izni yoksa arama penceresini bildirimle aç. */
    public static void aramaBekliyor(Context c, Intent pencere, String kim) {
        if (!izinVar(c)) return;
        kanallar(c);
        int id = 4242;
        pencere.putExtra("bildirim", id);
        PendingIntent pi = PendingIntent.getActivity(c, id, pencere, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, K_ARAMA)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(RENK)
            .setContentTitle("📞 Az önceki arama: " + kim)
            .setContentText("Kaynağını ve sonucunu kaydetmek için dokun")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException ignored) {}
    }

    public static PendingIntent ac(Context c, String url, int istek) {
        Intent i = new Intent(c, MainActivity.class)
            .setAction("gt.ac." + istek)
            .putExtra("url", url)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent yayin(Context c, String eylem, int istek, int bildirim, String k1, String v1, String k2, long v2) {
        Intent i = new Intent(c, EylemAlici.class).setAction(eylem).putExtra("bildirim", bildirim).putExtra(k1, v1);
        if (k2 != null) i.putExtra(k2, v2);
        return PendingIntent.getBroadcast(c, istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
