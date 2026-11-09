package com.gunteknik.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Telefon açılınca arama nöbetçisini başlat, randevu alarmlarını yeniden kur (telefon kapanınca alarmlar silinir). */
public class AcilisAlici extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.QUICKBOOT_POWERON".equals(a)) {
            Alarmci.yeniden(c);
            AramaNobetci.baslat(c);
            Veri.arkaplanda(c);
        } else if ("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(a)) {
            Alarmci.yeniden(c);
        }
    }
}
