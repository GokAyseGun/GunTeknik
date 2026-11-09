package com.gunteknik.erp;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Tam ekran randevu alarmı: saat, ne kadar kaldığı, randevu, kişi, adres · Kapat / 5 dk ertele / Ara / Yol tarifi. */
public class AlarmEkrani extends Activity {

    private static final int ZEMIN = 0xFF0E0E0E, KUTU = 0xFF1C1C1C, CIZGI = 0xFF333333;
    private static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080;
    private static final int MG = 0xFFE8197A, AMBER = 0xFFFFAB00, YESIL = 0xFF00E676, CYAN = 0xFF00E5FF;

    static volatile boolean acik;
    private static WeakReference<AlarmEkrani> son = new WeakReference<>(null);

    private LinearLayout kok;

    static void tazele() {
        AlarmEkrani a = son.get();
        if (a != null) a.runOnUiThread(a::ciz);
    }

    static void kapat() {
        AlarmEkrani a = son.get();
        if (a != null) a.runOnUiThread(a::finish);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(ZEMIN);
        getWindow().setNavigationBarColor(ZEMIN);
        son = new WeakReference<>(this);
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(ZEMIN);
        kok = new LinearLayout(this);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setGravity(Gravity.CENTER_HORIZONTAL);
        kok.setPadding(dp(22), dp(36), dp(22), dp(28));
        sv.addView(kok, new ScrollView.LayoutParams(-1, -1));
        setContentView(sv);
        ciz();
    }

    @Override
    protected void onResume() {
        super.onResume();
        acik = true;
        boolean bos;
        synchronized (AlarmCalar.aktif) { bos = AlarmCalar.aktif.isEmpty(); }
        if (bos) finish();
    }

    @Override
    protected void onPause() {
        super.onPause();
        acik = false;
    }

    @Override
    protected void onDestroy() {
        acik = false;
        if (son.get() == this) son = new WeakReference<>(null);
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // geri tuşu alarmı susturmaz; Kapat ya da Ertele seçilmeli
    }

    private void ciz() {
        JSONObject x;
        int n;
        synchronized (AlarmCalar.aktif) {
            x = AlarmCalar.aktif.isEmpty() ? null : AlarmCalar.aktif.get(0);
            n = AlarmCalar.aktif.size();
        }
        if (x == null) { finish(); return; }
        kok.removeAllViews();

        kok.addView(yazi(new SimpleDateFormat("HH:mm", Locale.US).format(new Date()), 64, METIN, true), sar());
        String tur = x.optString("tur");
        int renk = "once".equals(tur) ? AMBER : ("gun".equals(tur) ? CYAN : MG);
        TextView ust = yazi(AlarmCalar.ust(x), 24, renk, true);
        ust.setPadding(0, dp(6), 0, dp(18));
        kok.addView(ust, sar());

        LinearLayout kart = new LinearLayout(this);
        kart.setOrientation(LinearLayout.VERTICAL);
        kart.setPadding(dp(18), dp(16), dp(18), dp(16));
        kart.setBackground(kutu(KUTU, CIZGI, 18));
        TextView b = yazi(x.optString("b"), 21, METIN, true);
        b.setGravity(Gravity.START);
        kart.addView(b, tam());
        String saat = x.optString("s");
        String g = x.optString("g");
        String zaman = (saat.isEmpty() ? "Gün boyu" : "🕐 " + saat) + (g.isEmpty() ? "" : " · " + gunYaz(g));
        kart.addView(satir(zaman, METIN2), tam());
        if (!x.optString("k").isEmpty()) kart.addView(satir("👤 " + x.optString("k") + (x.optString("tel").isEmpty() ? "" : "  ·  " + x.optString("tel")), METIN), tam());
        if (!x.optString("ad").isEmpty()) kart.addView(satir("📍 " + x.optString("ad"), METIN2), tam());
        if (!x.optString("d").isEmpty()) kart.addView(satir("📝 " + x.optString("d"), METIN3), tam());
        kok.addView(kart, tam());

        if (n > 1) {
            TextView s = yazi("+" + (n - 1) + " alarm daha sırada", 13, METIN3, false);
            s.setPadding(0, dp(10), 0, 0);
            kok.addView(s, sar());
        }

        View bosluk = new View(this);
        kok.addView(bosluk, new LinearLayout.LayoutParams(1, 0, 1f));

        // Ara / Yol tarifi / ERP
        LinearLayout kucuk = new LinearLayout(this);
        kucuk.setOrientation(LinearLayout.HORIZONTAL);
        kucuk.setPadding(0, dp(22), 0, dp(12));
        final String tel = x.optString("tel"), yol = x.optString("yol");
        if (!tel.isEmpty()) kucuk.addView(dugme("📞 Ara", KUTU, CIZGI, METIN, 15, v -> { dis(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + tel))); }), agirlik());
        if (!yol.isEmpty()) kucuk.addView(dugme("🗺️ Yol tarifi", KUTU, CIZGI, METIN, 15, v -> { dis(new Intent(Intent.ACTION_VIEW, Uri.parse(yol))); }), agirlik());
        kucuk.addView(dugme("📅 Ajanda", KUTU, CIZGI, METIN, 15, v -> {
            dis(new Intent(this, MainActivity.class).putExtra("url", "./?sayfa=takvim").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        }), agirlik());
        kok.addView(kucuk, tam());

        LinearLayout buyuk = new LinearLayout(this);
        buyuk.setOrientation(LinearLayout.HORIZONTAL);
        buyuk.addView(dugme("⏰ 5 dk ertele", KUTU, AMBER, AMBER, 18, v -> AlarmCalar.gonder(this, AlarmCalar.ERTELE)), agirlik());
        buyuk.addView(dugme("✕ Kapat", MG, MG, 0xFFFFFFFF, 18, v -> AlarmCalar.gonder(this, AlarmCalar.KAPAT)), agirlik());
        kok.addView(buyuk, tam());
    }

    /** Alarmı kapatıp başka bir şey aç (ara, yol tarifi, ajanda). */
    private void dis(Intent i) {
        AlarmCalar.gonder(this, AlarmCalar.KAPAT);
        try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
        finish();
    }

    private static String gunYaz(String g) {
        String bugun = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String yarin = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(System.currentTimeMillis() + 86_400_000L));
        if (g.equals(bugun)) return "Bugün";
        if (g.equals(yarin)) return "Yarın";
        String[] p = g.split("-");
        return p.length == 3 ? p[2] + "." + p[1] + "." + p[0] : g;
    }

    // ------------------------------------------------------------ görünüm yardımcıları

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView yazi(String s, int sp, int renk, boolean kalin) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(renk);
        t.setGravity(Gravity.CENTER);
        if (kalin) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private TextView satir(String s, int renk) {
        TextView t = yazi(s, 15, renk, false);
        t.setGravity(Gravity.START);
        t.setPadding(0, dp(7), 0, 0);
        return t;
    }

    private GradientDrawable kutu(int dolgu, int kenar, int yaricap) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(dolgu);
        d.setCornerRadius(dp(yaricap));
        d.setStroke(dp(1), kenar);
        return d;
    }

    private TextView dugme(String s, int dolgu, int kenar, int renk, int sp, View.OnClickListener l) {
        TextView t = yazi(s, sp, renk, true);
        t.setPadding(dp(8), dp(sp >= 18 ? 18 : 12), dp(8), dp(sp >= 18 ? 18 : 12));
        t.setBackground(kutu(dolgu, kenar, 14));
        t.setOnClickListener(l);
        return t;
    }

    private static LinearLayout.LayoutParams sar() {
        return new LinearLayout.LayoutParams(-2, -2);
    }

    private static LinearLayout.LayoutParams tam() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private LinearLayout.LayoutParams agirlik() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1f);
        p.setMargins(dp(5), 0, dp(5), 0);
        return p;
    }
}
