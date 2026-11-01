package com.gunteknik.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Uygulama güncellendikten sonra: indirilen dosyayı sil, kısa bilgi bildirimi göster, widget'ları tazele. */
public class GuncellendiAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent i) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction())) return;
        GuncellemeDenetci.temizle(c, -1);
        NotificationManagerCompat.from(c).cancel(7701);
        Bildirimci.kanallar(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, Bildirimci.K_HATIRLATMA)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(0xFFE8197A)
            .setContentTitle("✓ Gün Teknik güncellendi")
            .setContentText("Sürüm " + GuncellemeDenetci.surumAdi(c))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setTimeoutAfter(60_000)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(c).notify(7702, b.build());
        } catch (SecurityException ignored) {}
        Veri.arkaplanda(c);
    }
}
