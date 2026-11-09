package com.gunteknik.erp;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Çalan randevu alarmı: alarm sesiyle (alarm ses düzeyi, sessiz modda da çalar) ve titreşimle çalar,
 * kilit ekranında tam ekran AlarmEkrani'ni açar; ekran açıksa üstten bildirim (Kapat / 5 dk ertele) gösterir.
 * 3 dakika kapatılmazsa susar ve "kaçırılan alarm" bildirimi bırakır.
 */
public class AlarmCalar extends Service {

    static final String KANAL = "randevu_alarmi";
    static final String KACAN = "randevu_alarmi_kacan";
    static final String KAPAT = "gt.alarm.kapat", ERTELE = "gt.alarm.ertele", CAL = "gt.alarm.basla";
    private static final int NO = 7301;
    private static final int RENK = 0xFFE8197A;
    private static final long SURE = 3 * 60_000L;

    /** Sırada çalan alarmlar (aynı dakikaya düşen birden fazla randevu olabilir) */
    static final List<JSONObject> aktif = new ArrayList<>();

    private MediaPlayer calar;
    private Vibrator titresim;
    private PowerManager.WakeLock uyanik;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable sustur = this::zamanAsimi;

    static void baslat(Context c, String json) {
        Intent i = new Intent(c, AlarmCalar.class).setAction(CAL).putExtra("alarm", json);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception e) {
            // servis başlatılamadıysa (çok nadir): en azından sesli bildirim
            try { kacanBildir(c, new JSONObject(json), true); } catch (Exception ignored) {}
        }
    }

    static void gonder(Context c, String eylem) {
        try { c.startService(new Intent(c, AlarmCalar.class).setAction(eylem)); } catch (Exception ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        String e = i != null ? i.getAction() : null;
        if (CAL.equals(e)) {
            JSONObject x = null;
            try { x = new JSONObject(i.getStringExtra("alarm")); } catch (Exception ignored) {}
            if (x == null) { bitir(); return START_NOT_STICKY; }
            Alarmci.caldi(this, x.optString("i"));
            synchronized (aktif) {
                for (JSONObject a : aktif) if (a.optString("i").equals(x.optString("i"))) { x = null; break; }
                if (x != null) aktif.add(x);
            }
            on();
            cal();
            ekraniAc();
            h.removeCallbacks(sustur);
            h.postDelayed(sustur, SURE);
        } else if (KAPAT.equals(e) || ERTELE.equals(e)) {
            JSONObject x;
            synchronized (aktif) { x = aktif.isEmpty() ? null : aktif.remove(0); }
            if (x != null && ERTELE.equals(e)) Alarmci.ertele(this, x, 5);
            boolean kalan;
            synchronized (aktif) { kalan = !aktif.isEmpty(); }
            if (kalan) {
                on();
                AlarmEkrani.tazele();
            } else {
                bitir();
            }
        } else {
            boolean bos;
            synchronized (aktif) { bos = aktif.isEmpty(); }
            if (bos) bitir(); else on();
        }
        return START_NOT_STICKY;
    }

    /** Ön plan bildirimi (tam ekran niyetli). */
    private void on() {
        kanallar(this);
        JSONObject x;
        int n;
        synchronized (aktif) {
            x = aktif.isEmpty() ? null : aktif.get(0);
            n = aktif.size();
        }
        if (x == null) return;
        Intent ekran = new Intent(this, AlarmEkrani.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent tam = PendingIntent.getActivity(this, NO, ekran, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String baslik = ust(x) + " · " + x.optString("b");
        String govde = alt(x) + (n > 1 ? "\n+" + (n - 1) + " alarm daha" : "");
        Notification b = new NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(RENK)
            .setContentTitle(baslik)
            .setContentText(govde)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(govde))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true) // sesi servis çalıyor
            .setFullScreenIntent(tam, true)
            .setContentIntent(tam)
            .addAction(0, "✕ Kapat", servis(this, KAPAT, 1))
            .addAction(0, "⏰ 5 dk ertele", servis(this, ERTELE, 2))
            .build();
        try {
            ServiceCompat.startForeground(this, NO, b, Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
        } catch (Exception ex) {
            try { NotificationManagerCompat.from(this).notify(NO, b); } catch (SecurityException ignored) {}
        }
    }

    private static PendingIntent servis(Context c, String eylem, int istek) {
        Intent i = new Intent(c, AlarmCalar.class).setAction(eylem);
        return PendingIntent.getService(c, NO + istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void cal() {
        if (uyanik == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) {
                uyanik = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GunTeknik:alarm");
                uyanik.acquire(SURE + 10_000L);
            }
        }
        if (calar == null) {
            try {
                Uri ses = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
                if (ses == null) ses = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (ses == null) ses = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                if (ses == null) ses = Settings.System.DEFAULT_NOTIFICATION_URI;
                MediaPlayer m = new MediaPlayer();
                m.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                m.setDataSource(this, ses);
                m.setLooping(true);
                m.prepare();
                m.start();
                calar = m;
            } catch (Exception ignored) {}
        }
        if (titresim == null) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    long[] desen = {0, 800, 600, 800, 600};
                    if (Build.VERSION.SDK_INT >= 26) {
                        v.vibrate(VibrationEffect.createWaveform(desen, 1),
                            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
                    } else {
                        v.vibrate(desen, 1);
                    }
                    titresim = v;
                }
            } catch (Exception ignored) {}
        }
    }

    /** Kilit ekranı / ekran kapalıyken tam ekran niyeti kendisi açar; MIUI gibi engelleyenler için "üstte göster" yolu. */
    private void ekraniAc() {
        if (AlarmEkrani.acik) { AlarmEkrani.tazele(); return; }
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        boolean kilitli = (km != null && km.isKeyguardLocked()) || (pm != null && !pm.isInteractive());
        if (!kilitli || !Settings.canDrawOverlays(this)) return;
        final Context c = getApplicationContext();
        new Thread(() -> {
            try {
                Thread.sleep(1200);
                if (AlarmEkrani.acik) return;
                Intent ekran = new Intent(c, AlarmEkrani.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                AramaAlici.ustundenBaslat(c, ekran);
            } catch (Exception ignored) {}
        }).start();
    }

    private void zamanAsimi() {
        List<JSONObject> l;
        synchronized (aktif) { l = new ArrayList<>(aktif); aktif.clear(); }
        for (JSONObject x : l) kacanBildir(this, x, false);
        bitir();
    }

    private void bitir() {
        h.removeCallbacks(sustur);
        if (calar != null) { try { calar.stop(); calar.release(); } catch (Exception ignored) {} calar = null; }
        if (titresim != null) { try { titresim.cancel(); } catch (Exception ignored) {} titresim = null; }
        if (uyanik != null) { try { if (uyanik.isHeld()) uyanik.release(); } catch (Exception ignored) {} uyanik = null; }
        AlarmEkrani.kapat();
        try { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE); } catch (Exception ignored) {}
        NotificationManagerCompat.from(this).cancel(NO);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(sustur);
        if (calar != null) { try { calar.release(); } catch (Exception ignored) {} calar = null; }
        if (titresim != null) { try { titresim.cancel(); } catch (Exception ignored) {} }
        if (uyanik != null && uyanik.isHeld()) { try { uyanik.release(); } catch (Exception ignored) {} }
        super.onDestroy();
    }

    // ------------------------------------------------------------ yardımcılar

    static void kanallar(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(KANAL) == null) {
            NotificationChannel k = new NotificationChannel(KANAL, "Randevu alarmı", NotificationManager.IMPORTANCE_HIGH);
            k.setDescription("Randevu hatırlatmaları alarm gibi çalar (Kapat / 5 dk ertele)");
            k.setSound(null, null);
            k.enableVibration(false);
            k.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            k.setBypassDnd(true);
            nm.createNotificationChannel(k);
        }
        if (nm.getNotificationChannel(KACAN) == null) {
            NotificationChannel k = new NotificationChannel(KACAN, "Kaçırılan randevu alarmı", NotificationManager.IMPORTANCE_HIGH);
            k.setDescription("Kapatılmadan susan randevu alarmları");
            nm.createNotificationChannel(k);
        }
    }

    /** "⏰ 15 dk sonra" / "🔔 Randevu saati" / "📅 Bugün" */
    static String ust(JSONObject x) {
        String tur = x.optString("tur");
        if ("once".equals(tur)) return "⏰ " + sureYaz(x.optInt("h")) + " sonra";
        if ("gun".equals(tur)) return "📅 Bugün";
        return "🔔 Randevu saati";
    }

    static String sureYaz(int dk) {
        if (dk <= 0) return "Şimdi";
        if (dk % 1440 == 0) return (dk / 1440) + " gün";
        if (dk >= 60 && dk % 60 == 0) return (dk / 60) + " saat";
        if (dk > 60) return (dk / 60) + " sa " + (dk % 60) + " dk";
        return dk + " dk";
    }

    static String alt(JSONObject x) {
        StringBuilder s = new StringBuilder();
        String saat = x.optString("s");
        if (!saat.isEmpty()) s.append("🕐 ").append(saat);
        String g = x.optString("g");
        if (!g.isEmpty() && !g.equals(new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()))) {
            String[] p = g.split("-");
            if (p.length == 3) s.append(s.length() > 0 ? " · " : "").append(p[2]).append('.').append(p[1]);
        }
        String k = x.optString("k");
        if (!k.isEmpty()) s.append(s.length() > 0 ? " · " : "").append("👤 ").append(k);
        String ad = x.optString("ad");
        if (!ad.isEmpty()) s.append("\n📍 ").append(ad);
        return s.toString();
    }

    static void kacanBildir(Context c, JSONObject x, boolean sesli) {
        kanallar(c);
        int id = ("kacan:" + x.optString("i")).hashCode() & 0x0fffffff;
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, sesli ? Bildirimci.K_HATIRLATMA : KACAN)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(RENK)
            .setContentTitle((sesli ? "" : "Kaçırılan alarm · ") + ust(x) + " · " + x.optString("b"))
            .setContentText(alt(x))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(alt(x)))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(Bildirimci.ac(c, "./?sayfa=takvim", id));
        try { NotificationManagerCompat.from(c).notify(id, b.build()); } catch (SecurityException ignored) {}
    }
}
