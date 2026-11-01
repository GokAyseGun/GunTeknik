package com.gunteknik.erp;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** PackageInstaller sonucu: onay gerekiyorsa onay ekranını açar (ya da bildirim gösterir). */
public class KurulumAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent i) {
        int durum = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        if (durum == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent onay = Build.VERSION.SDK_INT >= 33
                ? i.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : eskiIntent(i);
            if (onay == null) return;
            onay.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (MainActivity.onde || Settings.canDrawOverlays(c)) {
                try {
                    c.startActivity(onay);
                    return;
                } catch (Exception ignored) {}
            }
            bildir(c, onay);
        } else if (durum != PackageInstaller.STATUS_SUCCESS) {
            c.getSharedPreferences("gt_guncelleme", Context.MODE_PRIVATE).edit()
                .putString("sonHata", String.valueOf(i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))).apply();
        }
    }

    @SuppressWarnings("deprecation")
    private static Intent eskiIntent(Intent i) {
        return i.getParcelableExtra(Intent.EXTRA_INTENT);
    }

    private static void bildir(Context c, Intent onay) {
        Bildirimci.kanallar(c);
        PendingIntent pi = PendingIntent.getActivity(c, 7701, onay, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, Bildirimci.K_HATIRLATMA)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(0xFFE8197A)
            .setContentTitle("⬆️ Gün Teknik güncellemesi hazır")
            .setContentText("Kurmak için dokun")
            .setAutoCancel(true)
            .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(c).notify(7701, b.build());
        } catch (SecurityException ignored) {}
    }
}
