package com.gunteknik.erp;

import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Widget'tan tam atak kaydı — ERP'deki atak formunun aynısı (saglik.js BELIRTI / TETIK / DURUM / IYI listeleri).
 * Zaman: pencerenin açıldığı an. Kayıt: saglik_atak_ekle (aktivite eşleştirme, tansiyon ölçümü, kriz ilacı sunucuda).
 */
public class AtakPenceresi extends AppCompatActivity {

    private static final int ZEMIN = 0xFF141414, KUTU = 0xFF1C1C1C, CIZGI = 0xFF333333;
    private static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080, MG = 0xFFE8197A;

    static final String[] BELIRTI = {"Baş dönmesi", "Boşluk hissi", "Düşme hissi", "Dalga hissi", "Uyuşma / karıncalanma", "Çarpıntı", "Nefes darlığı", "İç huzursuzluk", "Görme değişikliği", "Terleme", "Göğüste sıkışma", "Bulantı"};
    static final String[] TETIK = {"Aç karnına kahve", "Açlık", "Az / kötü uyku", "Stres", "Heyecan / sohbet", "Efor", "Yemek sonrası", "Eğilip kalkma", "Sıcak", "Kalabalık", "Araba", "Belirsiz"};
    static final String[] DURUM = {"Dinlenirken", "İşte", "Spor / yürüyüş", "Yemekte", "Yatakta / uykuda", "Sohbette", "Araba", "Diğer"};
    static final String[] IYI = {"Uzanmak", "Nefes egzersizi", "Su içmek", "Bir şey yemek", "Yürümek", "Temiz hava", "Kriz ilacı", "Kendiliğinden geçti"};

    private long zaman;
    private int siddet;
    private final TextView[] siddetD = new TextView[10];
    private final List<String> bel = new ArrayList<>(), tet = new ArrayList<>(), iyi = new ArrayList<>();
    private String durum;
    private final List<TextView> durumD = new ArrayList<>();
    private EditText sure, tb, tk, nabiz, not;
    private TextView kriz, kaydet;
    private boolean krizSecili, krizKapali, gonderiliyor;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setFinishOnTouchOutside(false);
        if (android.os.Build.VERSION.SDK_INT >= 27) setShowWhenLocked(true);
        zaman = System.currentTimeMillis();
        setContentView(arayuz());
        DisplayMetrics m = getResources().getDisplayMetrics();
        getWindow().setLayout((int) (m.widthPixels * 0.94), (int) (m.heightPixels * 0.88));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private View arayuz() {
        LinearLayout kok = new LinearLayout(this);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setPadding(dp(16), dp(14), dp(16), dp(12));
        kok.setBackground(yuvarlak(ZEMIN, CIZGI, 22));

        kok.addView(metin("⚡ Atak kaydı", 18, METIN, true));
        kok.addView(metin("🕐 " + new SimpleDateFormat("d MMMM HH:mm", new Locale("tr", "TR")).format(new Date(zaman)) + "  ·  şimdi", 12.5f, METIN2, false));

        ScrollView sv = new ScrollView(this);
        LinearLayout g = new LinearLayout(this);
        g.setOrientation(LinearLayout.VERTICAL);
        g.setPadding(0, dp(4), 0, dp(8));
        sv.addView(g);
        kok.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // Şiddet 1–10
        g.addView(baslik("Şiddet (1 hafif – 10 çok güçlü)"));
        for (int s = 0; s < 2; s++) {
            LinearLayout satir = yatay();
            for (int i = 0; i < 5; i++) {
                final int v = s * 5 + i + 1;
                TextView t = metin(String.valueOf(v), 16, METIN, true);
                t.setGravity(Gravity.CENTER);
                t.setPadding(0, dp(9), 0, dp(9));
                t.setOnClickListener(x -> siddetSec(v));
                satir.addView(t, agirlik(1f));
                siddetD[v - 1] = t;
            }
            g.addView(satir);
        }
        siddetSec(0);

        g.addView(baslik("Süre (dakika)"));
        sure = sayiKutu("ör. 10");
        g.addView(sure);

        g.addView(baslik("Belirtiler"));
        coklu(g, BELIRTI, bel);
        g.addView(baslik("Olası tetikleyiciler"));
        coklu(g, TETIK, tet);

        g.addView(baslik("O sırada"));
        LinearLayout satir = null;
        for (int i = 0; i < DURUM.length; i++) {
            if (i % 2 == 0) { satir = yatay(); g.addView(satir); }
            final String x = DURUM[i];
            TextView t = cip(x);
            t.setOnClickListener(v -> durumSec(x));
            satir.addView(t, agirlik(1f));
            durumD.add(t);
        }
        durumSec(null);

        g.addView(baslik("Tansiyon ve nabız"));
        LinearLayout ta = yatay();
        tb = sayiKutu("büyük");
        tk = sayiKutu("küçük");
        nabiz = sayiKutu("nabız");
        ta.addView(tb, agirlik(1f));
        ta.addView(tk, agirlik(1f));
        ta.addView(nabiz, agirlik(1f));
        g.addView(ta);

        g.addView(baslik("Ne iyi geldi?"));
        coklu(g, IYI, iyi);

        // kriz ilacı (widget önbelleğindeki ad ve bugünkü sayı)
        JSONObject v = Veri.oku(this);
        JSONObject sg = v != null ? v.optJSONObject("saglik") : null;
        JSONObject k = sg != null ? sg.optJSONObject("kriz") : null;
        if (k != null) {
            int bugun = WidgetCizici.bugun().equals(sg.optString("bugun")) ? k.optInt("bugun") : 0;
            int mx = k.optInt("max", 2);
            krizKapali = bugun >= mx;
            kriz = metin("", 14, METIN, true);
            kriz.setPadding(dp(12), dp(11), dp(12), dp(11));
            kriz.setTag(k.optString("ad", "Kriz ilacı") + " aldım   ·   bugün " + bugun + "/" + mx + (krizKapali ? " (sınır doldu)" : ""));
            kriz.setOnClickListener(x -> { if (!krizKapali) { krizSecili = !krizSecili; krizCiz(); } });
            LinearLayout.LayoutParams kp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            kp.topMargin = dp(12);
            g.addView(kriz, kp);
            krizCiz();
        }

        g.addView(baslik("Not"));
        not = new EditText(this);
        not.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        not.setMinLines(2);
        kutuStil(not, 14);
        not.setGravity(Gravity.TOP | Gravity.START);
        g.addView(not);

        TextView ipucu = metin("Hızlıysan sadece şiddeti girip kaydet; gerisini sonra ERP'den düzenleyebilirsin. Aynı saatte bir aktivite varsa kendiliğinden eşleşir.", 11.5f, METIN3, false);
        ipucu.setPadding(0, dp(10), 0, 0);
        g.addView(ipucu);

        LinearLayout alt = yatay();
        alt.setPadding(0, dp(8), 0, 0);
        TextView iptal = dugme("Vazgeç", KUTU, METIN2);
        iptal.setOnClickListener(x -> finish());
        kaydet = dugme("Kaydet", MG, 0xFFFFFFFF);
        kaydet.setOnClickListener(x -> gonder());
        LinearLayout.LayoutParams a = new LinearLayout.LayoutParams(0, dp(50), 1f);
        a.setMargins(0, 0, dp(6), 0);
        alt.addView(iptal, a);
        alt.addView(kaydet, new LinearLayout.LayoutParams(0, dp(50), 2f));
        kok.addView(alt);
        return kok;
    }

    // ---------------------------------------------------------------- seçimler
    private static int siddetRenk(int v) {
        // 1 yeşil → 10 kırmızı
        if (v <= 3) return 0xFF00E676;
        if (v <= 5) return 0xFFFFD600;
        if (v <= 7) return 0xFFFFAB00;
        return 0xFFFF1744;
    }

    private void siddetSec(int v) {
        siddet = siddet == v ? 0 : v;
        for (int i = 0; i < 10; i++) {
            boolean on = siddet == i + 1;
            int r = siddetRenk(i + 1);
            siddetD[i].setBackground(yuvarlak(on ? (r & 0x00FFFFFF) | 0x40000000 : KUTU, on ? r : CIZGI, 12));
            siddetD[i].setTextColor(on ? r : METIN);
        }
    }

    private void durumSec(String x) {
        durum = x != null && x.equals(durum) ? null : x;
        for (TextView t : durumD) cipCiz(t, t.getText().toString().equals(durum));
    }

    private void coklu(LinearLayout g, String[] liste, List<String> secim) {
        LinearLayout satir = null;
        for (int i = 0; i < liste.length; i++) {
            if (i % 2 == 0) { satir = yatay(); g.addView(satir); }
            final String x = liste[i];
            final TextView t = cip(x);
            t.setOnClickListener(v -> {
                if (secim.contains(x)) secim.remove(x); else secim.add(x);
                cipCiz(t, secim.contains(x));
            });
            satir.addView(t, agirlik(1f));
            cipCiz(t, false);
        }
    }

    private void krizCiz() {
        kriz.setText((krizSecili ? "☑  " : "☐  ") + kriz.getTag());
        kriz.setTextColor(krizKapali ? METIN3 : krizSecili ? 0xFFFF5252 : METIN);
        kriz.setBackground(yuvarlak(krizSecili ? 0x33FF5252 : KUTU, krizSecili ? 0xFFFF5252 : CIZGI, 12));
    }

    // ---------------------------------------------------------------- kayıt
    private void gonder() {
        if (gonderiliyor) return;
        try {
            JSONObject p = new JSONObject();
            p.put("zaman", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date(zaman)));
            if (siddet > 0) p.put("siddet", siddet);
            putSayi(p, "sure_dk", sure);
            p.put("belirtiler", new JSONArray(bel));
            p.put("tetikleyiciler", new JSONArray(tet));
            if (durum != null) p.put("durum", durum);
            putSayi(p, "tansiyon_b", tb);
            putSayi(p, "tansiyon_k", tk);
            putSayi(p, "nabiz", nabiz);
            if (!iyi.isEmpty()) p.put("iyi_gelen", android.text.TextUtils.join(", ", iyi));
            if (krizSecili) p.put("kriz_ilac", true);
            String n = not.getText().toString().trim();
            if (!n.isEmpty()) p.put("notu", n);
            gonderiliyor = true;
            kaydet.setText("Kaydediliyor…");
            final android.content.Context c = getApplicationContext();
            new Thread(() -> {
                try {
                    JSONObject r = new JSONObject(Sunucu.rpc("saglik_atak_ekle", new JSONObject().put("p_token", Ayar.cihaz(c)).put("p", p)));
                    Islem.saglikYaz(c, r);
                    EylemAlici.tost(c, "⚡ Atak kaydedildi");
                    runOnUiThread(this::finish);
                } catch (Exception x) {
                    EylemAlici.tost(c, x.getMessage() != null ? x.getMessage() : "Kaydedilemedi");
                    runOnUiThread(() -> { gonderiliyor = false; kaydet.setText("Kaydet"); });
                }
            }).start();
        } catch (Exception e) {
            EylemAlici.tost(this, "Kaydedilemedi");
        }
    }

    private static void putSayi(JSONObject p, String k, EditText e) throws Exception {
        String s = e.getText().toString().trim();
        if (s.isEmpty()) return;
        try { p.put(k, Integer.parseInt(s)); } catch (NumberFormatException ignored) {}
    }

    // ---------------------------------------------------------------- yardımcılar
    private TextView baslik(String s) {
        TextView t = metin(s, 13, METIN2, false);
        t.setPadding(0, dp(12), 0, dp(5));
        return t;
    }

    private LinearLayout yatay() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);
        return l;
    }

    private LinearLayout.LayoutParams agirlik(float w) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, w);
        lp.setMargins(dp(3), dp(3), dp(3), dp(3));
        return lp;
    }

    private TextView cip(String s) {
        TextView t = metin(s, 13, METIN, false);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(6), dp(9), dp(6), dp(9));
        return t;
    }

    private void cipCiz(TextView t, boolean on) {
        t.setBackground(yuvarlak(on ? 0x33E8197A : KUTU, on ? MG : CIZGI, 12));
        t.setTextColor(on ? 0xFFFF80B5 : METIN);
        t.setTypeface(on ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
    }

    private EditText sayiKutu(String ipucu) {
        EditText e = new EditText(this);
        e.setInputType(InputType.TYPE_CLASS_NUMBER);
        e.setHint(ipucu);
        kutuStil(e, 17);
        e.setGravity(Gravity.CENTER);
        return e;
    }

    private void kutuStil(EditText e, float boy) {
        e.setTextColor(METIN);
        e.setHintTextColor(0xFF555555);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, boy);
        e.setPadding(dp(10), dp(8), dp(10), dp(8));
        e.setBackground(yuvarlak(KUTU, CIZGI, 12));
    }

    private TextView metin(String s, float boy, int renk, boolean kalin) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, boy);
        t.setTextColor(renk);
        if (kalin) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private TextView dugme(String s, int zemin, int renk) {
        TextView t = metin(s, 15, renk, true);
        t.setGravity(Gravity.CENTER);
        t.setBackground(yuvarlak(zemin, zemin == KUTU ? CIZGI : zemin, 14));
        return t;
    }

    private GradientDrawable yuvarlak(int zemin, int cizgi, int yaricapDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(zemin);
        g.setStroke(dp(1), cizgi);
        g.setCornerRadius(dp(yaricapDp));
        return g;
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
