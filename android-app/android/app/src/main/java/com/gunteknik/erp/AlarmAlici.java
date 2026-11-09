package com.gunteknik.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Randevu alarmı vakti geldi → çalan alarm servisi. */
public class AlarmAlici extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (!Alarmci.EYLEM.equals(i.getAction())) return;
        String json = i.getStringExtra("alarm");
        if (json == null) return;
        AlarmCalar.baslat(c, json);
    }
}
