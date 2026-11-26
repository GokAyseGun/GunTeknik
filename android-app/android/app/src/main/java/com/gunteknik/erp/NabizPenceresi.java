package com.gunteknik.erp;

import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

/**
 * Widget'tan nabız kaydı: an seç (Dinlenme · Gündelik · Hafif aktivite · Ağır aktivite · Atak anı) → değer → Kaydet.
 * Zaman: o an. "Atak anı" seçilirse sunucu son 1 saatteki atak kaydına da yazar (saglik_nabiz_ekle).
 */
public class NabizPenceresi extends AppCompatActivity {

    private static final int ZEMIN = 0xFF141414, KUTU = 0xFF1C1C1C, CIZGI = 0xFF333333;
    private static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, KIRMIZI = 0xFFFF1744, MG = 0xFFE8197A;

    static final String[] AN = {"dinlenme", "gunluk", "hafif", "agir", "atak"};
    static final String[] AN_AD = {"🛋️ Dinlenme", "🚶 Gündelik", "🏃 Hafif aktivite", "🏋️ Ağır aktivite", "⚡ Atak anı"};
    static final int[] AN_RENK = {0xFF00E676, 0xFF00E5FF, 0xFFFFAB00, 0xFFFF6D00, 0xFFFF1744};

    private String secili = "gunluk";
    private final TextView[] cipler = new TextView[AN.length];
    private EditText giris;
    private TextView kaydet;
    private boolean gonderiliyor;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setFinishOnTouchOutside(true);
        if (android.os.Build.VERSION.SDK_INT >= 27) setShowWhenLocked(true);
        setContentView(arayuz());
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        giris.requestFocus();
    }

    private View arayuz() {
        LinearLayout kok = new LinearLayout(this);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setPadding(dp(18), dp(16), dp(18), dp(14));
        kok.setBackground(yuvarlak(ZEMIN, CIZGI, 22));

        kok.addView(metin("❤️ Nabız", 18, METIN, true));
        TextView alt = metin("Hangi an?", 13, METIN2, false);
        alt.setPadding(0, dp(10), 0, dp(6));
        kok.addView(alt);

        // 5 an: 2 + 2 + 1 satır
        LinearLayout satir = null;
        for (int i = 0; i < AN.length; i++) {
            if (i % 2 == 0) {
                satir = new LinearLayout(this);
                satir.setOrientation(LinearLayout.HORIZONTAL);
                kok.addView(satir, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            }
            final int k = i;
            TextView c = metin(AN_AD[i], 14, METIN, true);
            c.setGravity(Gravity.CENTER);
            c.setPadding(dp(6), dp(11), dp(6), dp(11));
            c.setOnClickListener(v -> sec(AN[k]));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            satir.addView(c, lp);
            cipler[i] = c;
        }

        TextView et = metin("Nabız (bpm)", 13, METIN2, false);
        et.setPadding(0, dp(12), 0, dp(4));
        kok.addView(et);
        giris = new EditText(this);
        giris.setInputType(InputType.TYPE_CLASS_NUMBER);
        giris.setHint("72");
        giris.setTextColor(METIN);
        giris.setHintTextColor(0xFF555555);
        giris.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        giris.setTypeface(Typeface.DEFAULT_BOLD);
        giris.setGravity(Gravity.CENTER);
        giris.setPadding(dp(10), dp(8), dp(10), dp(8));
        giris.setBackground(yuvarlak(KUTU, CIZGI, 14));
        kok.addView(giris, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView not = metin("Zaman: şimdi. \"Atak anı\" seçersen son 1 saatteki atak kaydına da yazılır.", 11.5f, 0xFF808080, false);
        not.setPadding(0, dp(8), 0, dp(10));
        kok.addView(not);

        LinearLayout alt2 = new LinearLayout(this);
        alt2.setOrientation(LinearLayout.HORIZONTAL);
        TextView iptal = dugme("Vazgeç", KUTU, METIN2);
        iptal.setOnClickListener(v -> finish());
        kaydet = dugme("Kaydet", MG, 0xFFFFFFFF);
        kaydet.setOnClickListener(v -> gonder());
        LinearLayout.LayoutParams a = new LinearLayout.LayoutParams(0, dp(48), 1f);
        a.setMargins(0, 0, dp(6), 0);
        LinearLayout.LayoutParams b = new LinearLayout.LayoutParams(0, dp(48), 2f);
        alt2.addView(iptal, a);
        alt2.addView(kaydet, b);
        kok.addView(alt2);

        sec(secili);
        return kok;
    }

    private void sec(String an) {
        secili = an;
        for (int i = 0; i < AN.length; i++) {
            boolean on = AN[i].equals(an);
            cipler[i].setBackground(yuvarlak(on ? (AN_RENK[i] & 0x00FFFFFF) | 0x33000000 : KUTU, on ? AN_RENK[i] : CIZGI, 14));
            cipler[i].setTextColor(on ? AN_RENK[i] : METIN);
        }
    }

    private void gonder() {
        if (gonderiliyor) return;
        int d;
        try {
            d = Integer.parseInt(giris.getText().toString().trim());
        } catch (Exception e) {
            d = 0;
        }
        if (d < 30 || d > 230) {
            EylemAlici.tost(this, "Nabzı gir (30–230)");
            return;
        }
        gonderiliyor = true;
        kaydet.setText("Kaydediliyor…");
        final int deger = d;
        final String an = secili;
        final android.content.Context c = getApplicationContext();
        new Thread(() -> {
            try {
                JSONObject r = Islem.nabizEkle(c, deger, an);
                Islem.saglikYaz(c, r);
                EylemAlici.tost(c, "❤️ " + deger + " bpm kaydedildi");
                runOnUiThread(this::finish);
            } catch (Exception x) {
                EylemAlici.tost(c, x.getMessage() != null ? x.getMessage() : "Kaydedilemedi");
                runOnUiThread(() -> {
                    gonderiliyor = false;
                    kaydet.setText("Kaydet");
                });
            }
        }).start();
    }

    // ---------------------------------------------------------------- yardımcılar
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
