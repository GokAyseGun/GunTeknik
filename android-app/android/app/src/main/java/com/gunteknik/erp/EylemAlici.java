package com.gunteknik.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** Bildirim ve widget düğmeleri. Ağ işi arka planda yapılır. */
public class EylemAlici extends BroadcastReceiver {

    public static final String ARAMA_YOK = "com.gunteknik.erp.ARAMA_YOK";
    public static final String TAKIP = "com.gunteknik.erp.TAKIP";
    public static final String KANAL = "com.gunteknik.erp.KANAL";
    public static final String GERI = "com.gunteknik.erp.GERI";
    public static final String YENILE = "com.gunteknik.erp.YENILE";
    public static final String KASA_GOZ = "com.gunteknik.erp.KASA_GOZ";

    @Override
    public void onReceive(Context ctx, Intent i) {
        final String eylem = i.getAction();
        if (eylem == null) return;
        final Context c = ctx.getApplicationContext();
        final Bundle e = i.getExtras() != null ? i.getExtras() : new Bundle();

        // Ağ gerektirmeyenler hemen
        if (KANAL.equals(eylem)) {
            Ayar.kanal(c, "wa".equals(Ayar.kanal(c)) ? "tel" : "wa");
            WidgetCizici.hepsi(c);
            return;
        }
        if (KASA_GOZ.equals(eylem)) {
            Ayar.kasaAcik(c, !Ayar.kasaAcik(c));
            WidgetCizici.hepsi(c);
            return;
        }
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                isle(c, eylem, e);
            } catch (Exception x) {
                tost(c, x.getMessage() != null ? x.getMessage() : "İşlem yapılamadı");
            } finally {
                pr.finish();
            }
        }).start();
    }

    private void isle(Context c, String eylem, Bundle e) throws Exception {
        switch (eylem) {
            case ARAMA_YOK: {
                String r = Islem.aramaYok(c, e.getString("tarih", ""));
                iptal(c, e);
                tost(c, "tamam".equals(r) ? "Kaydedildi: o gün reklam araması yok" : "zaten".equals(r) ? "O gün zaten girilmiş" : "Kaydedilemedi (" + r + ")");
                Veri.yenile(c);
                break;
            }
            case TAKIP: {
                String sonuc = e.getString("sonuc", "");
                Islem.aramaGuncelle(c, e.getLong("id"), new JSONObject().put("sonuc", sonuc));
                iptal(c, e);
                tost(c, "is_alindi".equals(sonuc) ? "✅ İş alındı olarak kaydedildi" : "Kaydedildi: iş oluşmadı");
                Veri.yenile(c);
                break;
            }
            case GERI: {
                long id = Ayar.sonArama(c);
                if (id <= 0) { tost(c, "Geri alınacak kayıt yok"); return; }
                String r = Islem.aramaSil(c, id);
                Ayar.sonArama(c, 0);
                tost(c, "tamam".equals(r) ? "↶ Son kayıt geri alındı" : "Geri alınamadı (" + r + ")");
                Veri.yenile(c);
                break;
            }
            case YENILE: {
                if (!Veri.yenile(c)) tost(c, Ayar.cihaz(c) == null ? "Önce uygulamayı açıp ERP'ye giriş yap" : "Yenilenemedi, internet bağlantısını kontrol et");
                break;
            }
            default:
                break;
        }
    }

    private static void iptal(Context c, Bundle e) {
        int b = e.getInt("bildirim", 0);
        if (b != 0) NotificationManagerCompat.from(c).cancel(b);
    }

    static void tost(Context c, String m) {
        new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(c, m, Toast.LENGTH_SHORT).show());
    }
}
