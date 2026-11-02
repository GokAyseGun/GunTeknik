package com.gunteknik.erp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * İki widget: Pano (arama ekle · bugün · geri al / randevu ekle · ajanda bugün · 10 gün / evrak bugün · 5 gün · 15 gün / kasa · göster)
 * ve küçük "Arama ekle". Veri: widget_veri() → {bugun, arama{...}, snap{kasa, aj[], od[]}}
 */
public final class WidgetCizici {

    static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080;
    static final int CYAN = 0xFF00E5FF, MG = 0xFFE8197A, YESIL = 0xFF00E676, KIRMIZI = 0xFFFF5252, AMBER = 0xFFFFAB00;
    static final Locale TR = new Locale("tr", "TR");

    @SuppressWarnings("unchecked")
    private static final Class<? extends TemelWidget>[] SINIFLAR = new Class[]{WAramaWidget.class, WPanoWidget.class};

    private WidgetCizici() {}

    public static void hepsi(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        JSONObject v = Veri.oku(c);
        for (Class<? extends TemelWidget> k : SINIFLAR) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids == null || ids.length == 0) continue;
            try {
                TemelWidget w = k.getDeclaredConstructor().newInstance();
                for (int id : ids) m.updateAppWidget(id, w.ciz(c, v, m.getAppWidgetOptions(id)));
            } catch (Exception ignored) {}
        }
    }

    // ---------------------------------------------------------------- küçük: Arama ekle
    public static RemoteViews arama(Context c, JSONObject v, Bundle o) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_arama);
        aramaBagla(c, rv, v, 1000, "bugün");
        rv.setTextViewText(R.id.w_alt, altYazi(c));
        rv.setOnClickPendingIntent(R.id.w_alt, yayin(c, EylemAlici.YENILE, 1004));
        return rv;
    }

    private static void aramaBagla(Context c, RemoteViews rv, JSONObject v, int taban, String etiket) {
        JSONObject a = aramaBugun(v);
        rv.setOnClickPendingIntent(R.id.w_ekle, sihirbaz(c, taban + 1));
        rv.setTextViewText(R.id.w_sayi, kutu(a != null ? String.valueOf(a.optInt("toplam")) : "—", etiket, CYAN));
        rv.setOnClickPendingIntent(R.id.w_sayi, Bildirimci.ac(c, "./?sayfa=reklam", taban + 2));
        rv.setOnClickPendingIntent(R.id.w_geri, yayin(c, EylemAlici.GERI, taban + 3));
    }

    // ---------------------------------------------------------------- Pano
    public static RemoteViews pano(Context c, JSONObject v, Bundle o) {
        String bg = bugun();
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_pano);
        rv.setTextViewText(R.id.w_rozet, tarihUzun());
        rv.setOnClickPendingIntent(R.id.w_baslik, Bildirimci.ac(c, "./", 6001));
        rv.setTextViewText(R.id.w_alt, altYazi(c));
        rv.setOnClickPendingIntent(R.id.w_alt, yayin(c, EylemAlici.YENILE, 6002));
        aramaBagla(c, rv, v, 6010, "Arama · bugün");

        JSONObject snap = v != null ? v.optJSONObject("snap") : null;
        boolean veri = snap != null;
        // ajanda: bugün ve bugünden itibaren 10 gün · evrak/kredi ödemeleri: bugün (+ gecikmişler), 5 gün, 15 gün
        int aj1 = 0, aj10 = 0, ev1 = 0, ev5 = 0, ev15 = 0, evGec = 0;
        if (veri) {
            JSONArray A = snap.optJSONArray("aj");
            for (int i = 0; A != null && i < A.length(); i++) {
                JSONObject x = A.optJSONObject(i);
                if (x == null) continue;
                int f = fark(x.optString("g"), bg);
                if (f == 0) aj1++;
                if (f >= 0 && f <= 9) aj10++;
            }
            JSONArray O = snap.optJSONArray("od");
            for (int i = 0; O != null && i < O.length(); i++) {
                JSONObject x = O.optJSONObject(i);
                if (x == null) continue;
                String tur = x.optString("tur");
                if (!"evrak".equals(tur) && !"kredi".equals(tur)) continue;
                int f = fark(x.optString("g"), bg);
                if (f < 0) evGec++;
                else if (f == 0) ev1++;
                if (f >= 0 && f <= 4) ev5++;
                if (f >= 0 && f <= 14) ev15++;
            }
        }
        String yok = "—";
        rv.setOnClickPendingIntent(R.id.w_randevu, Bildirimci.ac(c, "./?randevu=yeni", 6020));
        rv.setTextViewText(R.id.w_aj1, kutu(veri ? String.valueOf(aj1) : yok, "Ajanda · bugün", AMBER));
        rv.setTextViewText(R.id.w_aj10, kutu(veri ? String.valueOf(aj10) : yok, "Ajanda · 10 gün", AMBER));
        rv.setTextViewText(R.id.w_ev1, kutu(veri ? String.valueOf(ev1 + evGec) : yok, evGec > 0 ? "Evrak · " + evGec + " gecikmiş" : "Evrak · bugün", evGec > 0 ? KIRMIZI : MG));
        rv.setInt(R.id.w_ev1, "setBackgroundResource", evGec > 0 ? R.drawable.w_kutu_kirmizi : R.drawable.w_kutu);
        rv.setTextViewText(R.id.w_ev5, kutu(veri ? String.valueOf(ev5) : yok, "Evrak · 5 gün", MG));
        rv.setTextViewText(R.id.w_ev15, kutu(veri ? String.valueOf(ev15) : yok, "Evrak · 15 gün", MG));
        rv.setOnClickPendingIntent(R.id.w_aj1, Bildirimci.ac(c, "./?sayfa=takvim", 6021));
        rv.setOnClickPendingIntent(R.id.w_aj10, Bildirimci.ac(c, "./?sayfa=takvim", 6022));
        rv.setOnClickPendingIntent(R.id.w_ev1, Bildirimci.ac(c, "./?sayfa=evrak", 6023));
        rv.setOnClickPendingIntent(R.id.w_ev5, Bildirimci.ac(c, "./?sayfa=evrak", 6024));
        rv.setOnClickPendingIntent(R.id.w_ev15, Bildirimci.ac(c, "./?sayfa=evrak", 6025));

        // kasa: dokununca özet sayfası, 👁 gizle / göster
        boolean acik = Ayar.kasaAcik(c);
        JSONObject k = veri ? snap.optJSONObject("kasa") : null;
        SpannableStringBuilder ks = renkli("💰 Kasa   ", METIN2, false, 1f);
        if (k == null) ks.append(renkli("—", METIN3, true, 1.25f));
        else {
            double top = k.optDouble("top", 0);
            ks.append(renkli(acik ? isaretli(top) : "••••• ₺", acik && top < 0 ? KIRMIZI : YESIL, true, 1.3f));
        }
        rv.setTextViewText(R.id.w_kasa, ks);
        rv.setOnClickPendingIntent(R.id.w_kasa, Bildirimci.ac(c, "./", 6031));
        rv.setTextViewText(R.id.w_goz, renkli(acik ? "🙈" : "👁", METIN, false, 1.2f).append("\n").append(renkli(acik ? "Gizle" : "Göster", METIN2, false, 0.85f)));
        rv.setOnClickPendingIntent(R.id.w_goz, yayin(c, EylemAlici.KASA_GOZ, 6032));
        return rv;
    }

    // ---------------------------------------------------------------- ortak parçalar
    private static String altYazi(Context c) {
        if (Ayar.cihaz(c) == null) return "Uygulamayı açıp ERP'ye giriş yap";
        return "↻ " + guncel(c);
    }

    /** Adım adım arama kaydı penceresi (kaynak → sektör → sonuç). */
    static PendingIntent sihirbaz(Context c, int istek) {
        Intent i = new Intent(c, AramaPenceresi.class)
            .setAction("gt.arama." + istek)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(c, istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent yayin(Context c, String eylem, int istek) {
        Intent i = new Intent(c, EylemAlici.class).setAction(eylem);
        return PendingIntent.getBroadcast(c, istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SpannableStringBuilder renkli(String s, int renk, boolean kalin, float boy) {
        SpannableStringBuilder b = new SpannableStringBuilder(s);
        b.setSpan(new ForegroundColorSpan(renk), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (kalin) b.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (boy != 1f) b.setSpan(new RelativeSizeSpan(boy), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return b;
    }

    private static CharSequence kutu(String sayi, String etiket, int renk) {
        return renkli(sayi, renk, true, 1.6f).append("\n").append(renkli(etiket, METIN2, false, 0.85f));
    }

    /** Önbellekteki arama sayıları bugüne aitse döndür (gece yarısından sonra eski sayı gösterilmesin). */
    static JSONObject aramaBugun(JSONObject v) {
        if (v == null) return null;
        if (!bugun().equals(v.optString("bugun"))) return null;
        return v.optJSONObject("arama");
    }

    static String bugun() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static long gunNo(String g) {
        try {
            String[] p = g.substring(0, 10).split("-");
            Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            cal.clear();
            cal.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            return cal.getTimeInMillis() / 86400000L;
        } catch (Exception e) {
            return 0;
        }
    }

    private static int fark(String g, String bg) {
        if (g == null || g.length() < 10) return 999;
        return (int) (gunNo(g) - gunNo(bg));
    }

    private static String tarihUzun() {
        return new SimpleDateFormat("d MMMM EEEE", TR).format(new Date());
    }

    private static String guncel(Context c) {
        long z = Ayar.veriZaman(c);
        if (z <= 0) return "—";
        return new SimpleDateFormat("HH:mm", TR).format(new Date(z));
    }

    static String para(double v) {
        return NumberFormat.getIntegerInstance(TR).format(Math.round(Math.abs(v))) + " ₺";
    }

    private static String isaretli(double v) {
        return (v < 0 ? "−" : "") + para(v);
    }
}
