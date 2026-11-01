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
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** Altı widget'ın çizimi. Veri: widget_veri() → {bugun, arama{...}, snap{kasa, ay, aj[], od[]}} */
public final class WidgetCizici {

    static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080;
    static final int CYAN = 0xFF00E5FF, MG = 0xFFE8197A, YESIL = 0xFF00E676, KIRMIZI = 0xFFFF5252, AMBER = 0xFFFFAB00;
    static final Locale TR = new Locale("tr", "TR");

    @SuppressWarnings("unchecked")
    private static final Class<? extends TemelWidget>[] SINIFLAR = new Class[]{
        WAramaWidget.class, WAjandaWidget.class, WOzetWidget.class, WKasaWidget.class, WEvrakWidget.class, WPanoWidget.class
    };

    private static final int[] SEKTOR_ID = {R.id.s0, R.id.s1, R.id.s2, R.id.s3, R.id.s4, R.id.s5, R.id.s6, R.id.s7};

    private WidgetCizici() {}

    // ---------------------------------------------------------------- tümünü yenile
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

    // ---------------------------------------------------------------- 1) Arama +1
    public static RemoteViews arama(Context c, JSONObject v, Bundle o) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_arama);
        JSONObject a = aramaBugun(v);
        rv.setTextViewText(R.id.w_sayi, String.valueOf(a != null ? a.optInt("toplam") : 0));
        rv.setOnClickPendingIntent(R.id.w_baslik, sihirbaz(c, 1001));
        rv.setOnClickPendingIntent(R.id.w_sayi, Bildirimci.ac(c, "./?sayfa=reklam", 1002));
        sektorBagla(c, rv, a, 1000);
        kanalBagla(c, rv, 1003);
        rv.setTextViewText(R.id.w_alt, aramaAlt(c, a));
        rv.setOnClickPendingIntent(R.id.w_alt, yayin(c, EylemAlici.YENILE, 1004, null, null));
        rv.setOnClickPendingIntent(R.id.w_geri, yayin(c, EylemAlici.GERI, 1005, null, null));
        return rv;
    }

    private static void sektorBagla(Context c, RemoteViews rv, JSONObject a, int taban) {
        // bugünkü tüm aramalar (her kaynak) sektöre göre; dokununca adım adım kayıt penceresi
        JSONObject sek = a != null ? a.optJSONObject("tum_sektor") : null;
        for (int i = 0; i < SEKTOR_ID.length; i++) {
            int n = sek != null ? sek.optInt(Ayar.SEKTORLER[i], 0) : 0;
            CharSequence t = n > 0 ? renkli(Ayar.SEKTOR_KISA[i] + "  ", METIN, false, 1f).append(renkli(String.valueOf(n), CYAN, true, 1.15f)) : Ayar.SEKTOR_KISA[i];
            rv.setTextViewText(SEKTOR_ID[i], t);
            rv.setInt(SEKTOR_ID[i], "setBackgroundResource", n > 0 ? R.drawable.w_dugme_var : R.drawable.w_dugme);
            rv.setOnClickPendingIntent(SEKTOR_ID[i], sihirbaz(c, taban + 10 + i));
        }
    }

    private static void kanalBagla(Context c, RemoteViews rv, int istek) {
        rv.setTextViewText(R.id.w_kanal, "wa".equals(Ayar.kanal(c)) ? "💬 WhatsApp" : "📞 Telefon");
        rv.setOnClickPendingIntent(R.id.w_kanal, yayin(c, EylemAlici.KANAL, istek, null, null));
    }

    private static String aramaAlt(Context c, JSONObject a) {
        if (Ayar.cihaz(c) == null) return "Uygulamayı açıp ERP'ye giriş yap";
        if (a == null) return "↻ Yenilemek için dokun";
        String s = "Reklam " + a.optInt("reklam") + "  ·  📞 " + a.optInt("tel") + "  💬 " + a.optInt("wa") + "  ·  Dün " + a.optInt("dun");
        if (a.optInt("reklam") == 0 && a.optBoolean("yok")) s = "Reklamdan arama yok  ·  Dün " + a.optInt("dun");
        return s + "  ·  ↻ " + guncel(c);
    }

    // ---------------------------------------------------------------- 2) Ajanda
    public static RemoteViews ajanda(Context c, JSONObject v, Bundle o) {
        String bg = bugun();
        JSONObject snap = snap(v);
        List<JSONObject> L = new ArrayList<>();
        int gec = 0, bugunN = 0;
        if (snap != null) {
            JSONArray aj = snap.optJSONArray("aj");
            for (int i = 0; aj != null && i < aj.length(); i++) {
                JSONObject x = aj.optJSONObject(i);
                if (x == null) continue;
                String g = x.optString("g");
                if (g.compareTo(bg) < 0) { gec++; continue; }
                if (g.equals(bg)) bugunN++;
                L.add(x);
            }
        }
        RemoteViews rv = kart(c, "📅 Ajanda", bugunN > 0 ? "bugün " + bugunN : (L.isEmpty() ? "" : L.size() + " planlı"), bugunN > 0 ? AMBER : CYAN, "./?sayfa=takvim", 2000);
        if (!durumSatiri(c, rv, v, snap)) {
            int max = satirSayisi(o, 6);
            if (gec > 0) { rv.addView(R.id.w_icerik, satir(c, "⚠️", gec + " geçmiş randevu açık kaldı", "", KIRMIZI, KIRMIZI)); max--; }
            if (L.isEmpty()) rv.addView(R.id.w_icerik, satir(c, "", "Yaklaşan randevu yok", "", METIN3, METIN3));
            for (int i = 0; i < L.size() && i < max; i++) ajandaSatir(c, rv, L.get(i), bg);
        }
        return rv;
    }

    private static void ajandaSatir(Context c, RemoteViews rv, JSONObject x, String bg) {
        String g = x.optString("g");
        int f = fark(g, bg);
        String gun = f == 0 ? "Bugün" : f == 1 ? "Yarın" : f < 7 ? gunAdi(g) : kisaTarih(g);
        String saat = x.optString("s", "");
        String ad = x.optString("b", "") + (x.optString("k", "").isEmpty() ? "" : " · " + x.optString("k"));
        rv.addView(R.id.w_icerik, satir(c, gun + (saat.isEmpty() ? "" : " " + saat), ad, "", f == 0 ? AMBER : f == 1 ? CYAN : METIN2, METIN3));
    }

    // ---------------------------------------------------------------- 3) Bugünün özeti
    public static RemoteViews ozet(Context c, JSONObject v, Bundle o) {
        String bg = bugun();
        RemoteViews rv = kart(c, "☀️ Bugün", tarihUzun(), METIN2, "./", 3000);
        JSONObject snap = snap(v);
        JSONObject a = aramaBugun(v);
        if (Ayar.cihaz(c) == null) { durumSatiri(c, rv, v, snap); return rv; }

        // Arama
        String ar = a == null ? "—" : "Reklam " + a.optInt("reklam") + "  ·  toplam " + a.optInt("toplam");
        rv.addView(R.id.w_icerik, satir(c, "📞 Arama", ar, a == null ? "" : "Dün " + a.optInt("dun"), CYAN, METIN3));

        if (snap == null) {
            rv.addView(R.id.w_icerik, satir(c, "", "Ajanda ve ödemeler ERP bir kez açılınca gelir", "", METIN3, METIN3));
        } else {
            // Ajanda
            int bugunN = 0; String ilk = null;
            JSONArray aj = snap.optJSONArray("aj");
            for (int i = 0; aj != null && i < aj.length(); i++) {
                JSONObject x = aj.optJSONObject(i);
                if (x == null || !bg.equals(x.optString("g"))) continue;
                bugunN++;
                if (ilk == null) ilk = (x.optString("s").isEmpty() ? "" : x.optString("s") + " ") + x.optString("b");
            }
            rv.addView(R.id.w_icerik, satir(c, "📅 Ajanda", bugunN == 0 ? "Bugün iş yok" : bugunN + " iş  ·  " + ilk, "", AMBER, METIN3));

            // Ödemeler (evrak, kredi, vadeli işlem)
            int bugunO = 0, gecO = 0; double tutar = 0;
            JSONArray od = snap.optJSONArray("od");
            for (int i = 0; od != null && i < od.length(); i++) {
                JSONObject x = od.optJSONObject(i);
                if (x == null) continue;
                int f = fark(x.optString("g"), bg);
                if (f > 0) continue;
                if (f == 0) bugunO++; else gecO++;
                tutar += x.optDouble("t", 0);
            }
            String ot = bugunO + gecO == 0 ? "Bugün ödeme günü yok" : "Bugün " + bugunO + (gecO > 0 ? "  ·  gecikmiş " + gecO : "");
            rv.addView(R.id.w_icerik, satir(c, "💳 Ödeme", ot, tutar > 0 ? "≈ " + para(tutar) : "", gecO > 0 ? KIRMIZI : MG, METIN2));
        }
        if (a != null && a.optInt("takip") > 0)
            rv.addView(R.id.w_icerik, satir(c, "🎯 Takip", a.optInt("takip") + " potansiyel müşteri bekliyor", "", YESIL, METIN3));
        return rv;
    }

    // ---------------------------------------------------------------- 4) Kasa
    public static RemoteViews kasa(Context c, JSONObject v, Bundle o) {
        boolean acik = Ayar.kasaAcik(c);
        RemoteViews rv = kart(c, "💰 Kasa", "", METIN2, "./", 4000);
        rv.setViewVisibility(R.id.w_dugme, View.VISIBLE);
        rv.setTextViewText(R.id.w_dugme, acik ? "🙈 Gizle" : "👁 Göster");
        rv.setOnClickPendingIntent(R.id.w_dugme, yayin(c, EylemAlici.KASA_GOZ, 4002, null, null));
        JSONObject snap = snap(v);
        if (durumSatiri(c, rv, v, snap)) return rv;
        JSONObject k = snap.optJSONObject("kasa");
        if (k == null) { rv.addView(R.id.w_icerik, satir(c, "", "Kasa bilgisi yok", "", METIN3, METIN3)); return rv; }

        RemoteViews b = new RemoteViews(c.getPackageName(), R.layout.w_buyuk);
        double top = k.optDouble("top", 0);
        b.setTextViewText(R.id.w_deger, acik ? isaretli(top) : "••••• ₺");
        b.setTextColor(R.id.w_deger, !acik ? METIN : top < 0 ? KIRMIZI : METIN);
        b.setTextViewText(R.id.w_etiket, "Eldeki toplam");
        rv.addView(R.id.w_icerik, b);

        int max = satirSayisi(o, 6);
        List<String[]> S = new ArrayList<>();
        S.add(new String[]{"Nakit", gizle(acik, k.optDouble("nakit", 0)), ""});
        S.add(new String[]{"Kart", gizle(acik, k.optDouble("kart", 0)), ""});
        S.add(new String[]{"IBAN", gizle(acik, k.optDouble("iban", 0)), ""});
        S.add(new String[]{"Alacak", gizle(acik, k.optDouble("alacak", 0)), "y"});
        S.add(new String[]{"Borç", gizle(acik, k.optDouble("borc", 0)), "k"});
        JSONObject ay = snap.optJSONObject("ay");
        if (ay != null) S.add(new String[]{ay.optString("ad", "Bu ay"), acik ? "+" + para(ay.optDouble("gelir", 0)) + "  /  −" + para(ay.optDouble("gider", 0)) : "•••", ""});
        for (int i = 0; i < S.size() && i < max - 1; i++) {
            String[] s = S.get(i);
            int r = "y".equals(s[2]) ? YESIL : "k".equals(s[2]) ? KIRMIZI : METIN;
            rv.addView(R.id.w_icerik, satir(c, s[0], "", s[1], METIN2, r));
        }
        return rv;
    }

    // ---------------------------------------------------------------- 5) Evrak & ödemeler
    public static RemoteViews evrak(Context c, JSONObject v, Bundle o) {
        String bg = bugun();
        JSONObject snap = snap(v);
        List<JSONObject> L = new ArrayList<>();
        int gec = 0;
        if (snap != null) {
            JSONArray od = snap.optJSONArray("od");
            for (int i = 0; od != null && i < od.length(); i++) {
                JSONObject x = od.optJSONObject(i);
                if (x == null) continue;
                String tur = x.optString("tur");
                if (!"evrak".equals(tur) && !"kredi".equals(tur)) continue;
                if (fark(x.optString("g"), bg) < 0) gec++;
                L.add(x);
            }
        }
        RemoteViews rv = kart(c, "📄 Evrak ve ödemeler", gec > 0 ? gec + " gecikmiş" : (L.isEmpty() ? "" : L.size() + " yaklaşan"), gec > 0 ? KIRMIZI : CYAN, "./?sayfa=evrak", 5000);
        if (durumSatiri(c, rv, v, snap)) return rv;
        if (L.isEmpty()) { rv.addView(R.id.w_icerik, satir(c, "✓", "Yaklaşan ya da gecikmiş ödeme yok", "", YESIL, METIN3)); return rv; }
        int max = satirSayisi(o, 6);
        for (int i = 0; i < L.size() && i < max; i++) odemeSatir(c, rv, L.get(i), bg);
        return rv;
    }

    private static void odemeSatir(Context c, RemoteViews rv, JSONObject x, String bg) {
        int f = fark(x.optString("g"), bg);
        String sol = f < 0 ? (-f) + " gün geçti" : f == 0 ? "Bugün" : f == 1 ? "Yarın" : f + " gün";
        int renk = f < 0 ? KIRMIZI : f <= 1 ? AMBER : f <= 3 ? CYAN : METIN2;
        String ad = x.optString("ad") + (x.optInt("n", 0) > 1 ? " (" + x.optInt("n") + " dönem)" : "");
        double t = x.optDouble("t", 0);
        String sag = t > 0 ? (x.optInt("yon", -1) > 0 ? "+" : "≈ ") + para(t) : "";
        rv.addView(R.id.w_icerik, satir(c, sol, ad, sag, renk, x.optInt("yon", -1) > 0 ? YESIL : METIN2));
    }

    // ---------------------------------------------------------------- 6) Pano (hepsi bir arada)
    public static RemoteViews pano(Context c, JSONObject v, Bundle o) {
        String bg = bugun();
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_pano);
        rv.setTextViewText(R.id.w_rozet, tarihUzun());
        rv.setOnClickPendingIntent(R.id.w_baslik, Bildirimci.ac(c, "./", 6001));
        kanalBagla(c, rv, 6002);
        rv.setTextViewText(R.id.w_alt, Ayar.cihaz(c) == null ? "Uygulamayı açıp ERP'ye giriş yap" : "↻ " + guncel(c));
        rv.setOnClickPendingIntent(R.id.w_alt, yayin(c, EylemAlici.YENILE, 6003, null, null));
        rv.setOnClickPendingIntent(R.id.w_geri, yayin(c, EylemAlici.GERI, 6004, null, null));

        JSONObject a = aramaBugun(v);
        JSONObject snap = snap(v);
        sektorBagla(c, rv, a, 6000);

        // Sayılar
        int ajN = 0, odBugun = 0, odGec = 0;
        List<JSONObject> aj = new ArrayList<>(), od = new ArrayList<>();
        if (snap != null) {
            JSONArray A = snap.optJSONArray("aj");
            for (int i = 0; A != null && i < A.length(); i++) {
                JSONObject x = A.optJSONObject(i);
                if (x == null || x.optString("g").compareTo(bg) < 0) continue;
                if (bg.equals(x.optString("g"))) ajN++;
                aj.add(x);
            }
            JSONArray O = snap.optJSONArray("od");
            for (int i = 0; O != null && i < O.length(); i++) {
                JSONObject x = O.optJSONObject(i);
                if (x == null) continue;
                int f = fark(x.optString("g"), bg);
                if (f < 0) odGec++; else if (f == 0) odBugun++;
                if (f <= 7) od.add(x);
            }
        }
        rv.setTextViewText(R.id.w_st1, kutu(a != null ? String.valueOf(a.optInt("toplam")) : "—", a != null ? "Arama · reklam " + a.optInt("reklam") : "Arama", CYAN));
        rv.setTextViewText(R.id.w_st2, kutu(String.valueOf(ajN), "Bugün ajanda", AMBER));
        rv.setTextViewText(R.id.w_st3, kutu(String.valueOf(odBugun + odGec), odGec > 0 ? odGec + " gecikmiş" : "Ödeme günü", odGec > 0 ? KIRMIZI : MG));
        String kasaT = "—";
        JSONObject k = snap != null ? snap.optJSONObject("kasa") : null;
        if (k != null) kasaT = Ayar.kasaAcik(c) ? kisaPara(k.optDouble("top", 0)) : "•••";
        rv.setTextViewText(R.id.w_st4, kutu(kasaT, Ayar.kasaAcik(c) ? "Kasa" : "Kasa · dokun", YESIL));
        rv.setOnClickPendingIntent(R.id.w_st1, Bildirimci.ac(c, "./?sayfa=reklam", 6005));
        rv.setOnClickPendingIntent(R.id.w_st2, Bildirimci.ac(c, "./?sayfa=takvim", 6006));
        rv.setOnClickPendingIntent(R.id.w_st3, Bildirimci.ac(c, "./?sayfa=evrak", 6007));
        rv.setOnClickPendingIntent(R.id.w_st4, yayin(c, EylemAlici.KASA_GOZ, 6008, null, null));

        // Liste
        rv.removeAllViews(R.id.w_icerik);
        rv.setOnClickPendingIntent(R.id.w_icerik, Bildirimci.ac(c, "./", 6009));
        if (Ayar.cihaz(c) == null || snap == null) {
            rv.addView(R.id.w_icerik, satir(c, "", Ayar.cihaz(c) == null ? "Uygulamayı açıp ERP'ye giriş yap" : "ERP bir kez açılınca ajanda ve ödemeler gelir", "", METIN3, METIN3));
            return rv;
        }
        int max = satirSayisi(o, 7) - 4;
        if (max < 2) max = 2;
        int ajMax = Math.min(aj.size(), Math.max(1, max / 2));
        for (int i = 0; i < ajMax; i++) ajandaSatir(c, rv, aj.get(i), bg);
        int kalan = max - ajMax;
        for (int i = 0; i < od.size() && i < kalan; i++) odemeSatir(c, rv, od.get(i), bg);
        if (aj.isEmpty() && od.isEmpty()) rv.addView(R.id.w_icerik, satir(c, "✓", "Yaklaşan iş ya da ödeme yok", "", YESIL, METIN3));
        if (a != null && a.optInt("takip") > 0)
            rv.addView(R.id.w_icerik, satir(c, "🎯", a.optInt("takip") + " potansiyel müşteri takipte", "", YESIL, METIN3));
        return rv;
    }

    // ---------------------------------------------------------------- ortak parçalar
    private static RemoteViews kart(Context c, String baslik, String rozet, int rozetRenk, String url, int istek) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.w_kart);
        rv.setTextViewText(R.id.w_baslik, baslik);
        rv.setTextViewText(R.id.w_rozet, rozet);
        rv.setTextColor(R.id.w_rozet, rozetRenk);
        rv.setViewVisibility(R.id.w_dugme, View.GONE);
        rv.removeAllViews(R.id.w_icerik);
        rv.setOnClickPendingIntent(R.id.w_kok, Bildirimci.ac(c, url, istek));
        rv.setTextViewText(R.id.w_alt, "↻ " + guncel(c));
        rv.setOnClickPendingIntent(R.id.w_alt, yayin(c, EylemAlici.YENILE, istek + 1, null, null));
        return rv;
    }

    /** Giriş yoksa ya da ERP verisi hiç gelmediyse tek satırlık açıklama; true → çizim bitti. */
    private static boolean durumSatiri(Context c, RemoteViews rv, JSONObject v, JSONObject snap) {
        if (Ayar.cihaz(c) == null) {
            rv.addView(R.id.w_icerik, satir(c, "", "Uygulamayı açıp ERP'ye giriş yap", "", METIN3, METIN3));
            return true;
        }
        if (snap == null) {
            rv.addView(R.id.w_icerik, satir(c, "", v == null ? "↻ Yenilemek için dokun" : "ERP bir kez açılınca dolacak", "", METIN3, METIN3));
            return true;
        }
        return false;
    }

    private static RemoteViews satir(Context c, String sol, String orta, String sag, int solRenk, int sagRenk) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.w_satir);
        r.setTextViewText(R.id.w_sol, sol);
        r.setTextColor(R.id.w_sol, solRenk);
        r.setViewVisibility(R.id.w_sol, sol == null || sol.isEmpty() ? View.GONE : View.VISIBLE);
        r.setTextViewText(R.id.w_orta, orta);
        r.setTextViewText(R.id.w_sag, sag);
        r.setTextColor(R.id.w_sag, sagRenk);
        r.setViewVisibility(R.id.w_sag, sag == null || sag.isEmpty() ? View.GONE : View.VISIBLE);
        return r;
    }

    /** Adım adım arama kaydı penceresi (kaynak → sektör → sonuç). */
    static PendingIntent sihirbaz(Context c, int istek) {
        Intent i = new Intent(c, AramaPenceresi.class)
            .setAction("gt.arama." + istek)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(c, istek, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent yayin(Context c, String eylem, int istek, String k, String deger) {
        Intent i = new Intent(c, EylemAlici.class).setAction(eylem);
        if (k != null) i.putExtra(k, deger);
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

    private static JSONObject snap(JSONObject v) {
        return v != null ? v.optJSONObject("snap") : null;
    }

    private static int satirSayisi(Bundle o, int varsayilan) {
        if (o == null) return varsayilan;
        int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (h <= 0) return varsayilan;
        int n = (h - 64) / 24;
        return Math.max(2, Math.min(10, n));
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

    private static Date tarih(String g) {
        try {
            return new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(g.substring(0, 10));
        } catch (Exception e) {
            return new Date();
        }
    }

    private static String gunAdi(String g) {
        return new SimpleDateFormat("EEEE", TR).format(tarih(g));
    }

    private static String kisaTarih(String g) {
        return new SimpleDateFormat("d MMM", TR).format(tarih(g));
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

    private static String gizle(boolean acik, double v) {
        return acik ? isaretli(v) : "•••";
    }

    private static String kisaPara(double v) {
        double a = Math.abs(v);
        String s = a >= 1_000_000 ? String.format(TR, "%.1f M", a / 1_000_000) : a >= 10_000 ? Math.round(a / 1000) + " B" : NumberFormat.getIntegerInstance(TR).format(Math.round(a));
        return (v < 0 ? "−" : "") + s + " ₺";
    }
}
