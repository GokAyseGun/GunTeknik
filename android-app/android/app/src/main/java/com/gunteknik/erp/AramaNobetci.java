package com.gunteknik.erp;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Arama nöbetçisi: ön planda küçük bir servis olarak telefon durumunu dinler.
 * Bazı telefonlar (Xiaomi/MIUI vb.) uygulama kapalıyken PHONE_STATE yayınını kesebiliyor; servis açık kaldıkça
 * görüşme bitişi yine yakalanır ve AramaTarama çalışır. Bildirim çubuğunda sessiz bir "aramalar izleniyor" satırı durur.
 * Uygulama açılınca, telefon açılınca, güncellemeden sonra, her telefon yayınında ve FCM mesajında yeniden başlatılır.
 */
public class AramaNobetci extends Service {

    private static final String KANAL = "arama_nobetci";
    private static final int NO = 4343;

    private TelephonyManager tm;
    private Object cb;                 // TelephonyCallback (API 31+)
    private PhoneStateListener psl;    // eski sürümler
    private volatile int onceki = TelephonyManager.CALL_STATE_IDLE;
    private volatile long bas;

    static void baslat(Context c) {
        try {
            if (ContextCompat.checkSelfPermission(c, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return;
            if (Ayar.cihaz(c) == null) return;
            Intent i = new Intent(c, AramaNobetci.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception ignored) {}   // arka plandan başlatma kısıtı: bir sonraki fırsatta denenir
    }

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            ServiceCompat.startForeground(this, NO, bildirim(), Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
        } catch (Exception e) {
            stopSelf();
            return;
        }
        dinle();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification bildirim() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(KANAL) == null) {
                NotificationChannel k = new NotificationChannel(KANAL, "Arama nöbetçisi", NotificationManager.IMPORTANCE_MIN);
                k.setDescription("Görüşme bitince arama kaydı penceresinin kesin açılması için arka planda açık kalır");
                k.setShowBadge(false);
                nm.createNotificationChannel(k);
            }
        }
        Intent ac = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, NO, ac, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(0xFFE8197A)
            .setContentTitle("Aramalar izleniyor")
            .setContentText("Görüşme bitince kaydını soracağım")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(pi)
            .build();
    }

    private void durum(int s) {
        if (s != TelephonyManager.CALL_STATE_IDLE) {
            if (onceki == TelephonyManager.CALL_STATE_IDLE) bas = System.currentTimeMillis();
            onceki = s;
            return;
        }
        if (onceki == TelephonyManager.CALL_STATE_IDLE) return;
        onceki = TelephonyManager.CALL_STATE_IDLE;
        final long b = bas;
        final Context c = getApplicationContext();
        new Thread(() -> {
            try { AramaTarama.cagriBitti(c, b); } catch (Exception ignored) {}
        }).start();
    }

    @SuppressWarnings("deprecation")
    private void dinle() {
        tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        if (tm == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                Dinleyici d = new Dinleyici(this);
                tm.registerTelephonyCallback(getMainExecutor(), d);
                cb = d;
            } else {
                psl = new PhoneStateListener() {
                    @Override public void onCallStateChanged(int state, String no) { durum(state); }
                };
                tm.listen(psl, PhoneStateListener.LISTEN_CALL_STATE);
            }
        } catch (Exception ignored) {}
    }

    @androidx.annotation.RequiresApi(31)
    private static final class Dinleyici extends TelephonyCallback implements TelephonyCallback.CallStateListener {
        private final AramaNobetci s;
        Dinleyici(AramaNobetci s) { this.s = s; }
        @Override public void onCallStateChanged(int state) { s.durum(state); }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onDestroy() {
        try {
            if (tm != null) {
                if (Build.VERSION.SDK_INT >= 31 && cb != null) tm.unregisterTelephonyCallback((TelephonyCallback) cb);
                else if (psl != null) tm.listen(psl, PhoneStateListener.LISTEN_NONE);
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
