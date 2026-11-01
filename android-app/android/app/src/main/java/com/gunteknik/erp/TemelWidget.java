package com.gunteknik.erp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Tüm widget'ların ortak davranışı: önbellekten hemen çiz, veri eskiyse arkada tazele. */
public abstract class TemelWidget extends AppWidgetProvider {

    protected abstract RemoteViews ciz(Context c, JSONObject v, Bundle secenek);

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject v = Veri.oku(c);
        for (int id : ids) {
            try {
                m.updateAppWidget(id, ciz(c, v, m.getAppWidgetOptions(id)));
            } catch (Exception ignored) {}
        }
        if (Ayar.cihaz(c) != null && System.currentTimeMillis() - Ayar.veriZaman(c) > 5 * 60 * 1000L) {
            final PendingResult pr = goAsync();
            final Context a = c.getApplicationContext();
            new Thread(() -> {
                try {
                    Veri.yenile(a);
                } finally {
                    pr.finish();
                }
            }).start();
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle yeni) {
        try {
            m.updateAppWidget(id, ciz(c, Veri.oku(c), yeni));
        } catch (Exception ignored) {}
    }
}
