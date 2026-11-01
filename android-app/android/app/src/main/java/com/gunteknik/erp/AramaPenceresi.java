package com.gunteknik.erp;

import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Arama bitince ekranın üstünde açılan küçük pencere: kaynak, sektör, sonuç. */
public class AramaPenceresi extends AppCompatActivity {

    private static final int ZEMIN = 0xFF141414, KUTU = 0xFF1C1C1C, CIZGI = 0xFF333333;
    private static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080;
    private static final int CYAN = 0xFF00E5FF, MG = 0xFFE8197A;

    static final String[] KAYNAK = {"reklam", "tavsiye", "eski", "bilinmiyor"};
    static final String[] KAYNAK_AD = {"📢 Reklam", "🤝 Tavsiye", "🔁 Eski müşteri", "❔ Bilinmiyor"};
    static final String[] SONUC = {"potansiyel", "is_alindi", "yanlis", "olusmadi"};
    static final String[] SONUC_AD = {"🟡 Potansiyel müşteri", "✅ İş alındı", "📵 Yanlış arama", "⛔ İş oluşmadı"};
    static final String[] SEBEP = {"fiyat", "uzak", "vazgecti", "baska_usta", "diger"};
    static final String[] SEBEP_AD = {"Fiyat", "Uzak", "Vazgeçti", "Başka usta", "Diğer"};

    private final Secim kaynak = new Secim(), sektor = new Secim(), sonuc = new Secim(), sebep = new Secim();
    private LinearLayout sebepKutu;
    private EditText not;
    private TextView kaydet;
    private String numara, ad;
    private int sure;
    private long zaman;
    private boolean gonderiliyor;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = getIntent();
        numara = i.getStringExtra("numara");
        ad = i.getStringExtra("ad");
        sure = i.getIntExtra("sure", 0);
        zaman = i.getLongExtra("zaman", System.currentTimeMillis());
        int bildirim = i.getIntExtra("bildirim", 0);
        if (bildirim != 0) NotificationManagerCompat.from(this).cancel(bildirim);
        setFinishOnTouchOutside(false);
        setContentView(arayuz());
    }

    // ---------------------------------------------------------------- arayüz
    private View arayuz() {
        LinearLayout kok = dikey();
        kok.setPadding(dp(18), dp(16), dp(18), dp(14));
        kok.setBackground(yuvarlak(ZEMIN, CIZGI, 22));

        TextView bas = metin("📞 Az önceki arama", 18, METIN, true);
        kok.addView(bas);
        String kim = ad != null && !ad.isEmpty() ? ad + (numara != null ? "  ·  " + numara : "") : (numara == null || numara.isEmpty() ? "Gizli numara" : numara);
        String ek = new SimpleDateFormat("HH:mm", Locale.US).format(new Date(zaman)) + (sure > 0 ? "  ·  " + sureYaz(sure) : "");
        TextView alt = metin(kim + "\n" + ek, 13, METIN2, false);
        alt.setPadding(0, dp(2), 0, dp(4));
        kok.addView(alt);

        kok.addView(baslik("Nereden geldi?"));
        kok.addView(izgara(KAYNAK_AD, KAYNAK, 2, kaynak, null));
        kok.addView(baslik("Sektör"));
        kok.addView(izgara(Ayar.SEKTOR_KISA, Ayar.SEKTORLER, 4, sektor, null));
        kok.addView(baslik("Sonuç"));
        kok.addView(izgara(SONUC_AD, SONUC, 2, sonuc, () -> sebepKutu.setVisibility("olusmadi".equals(sonuc.deger) ? View.VISIBLE : View.GONE)));

        sebepKutu = dikey();
        sebepKutu.addView(baslik("Neden olmadı?"));
        sebepKutu.addView(izgara(SEBEP_AD, SEBEP, 3, sebep, null));
        sebepKutu.setVisibility(View.GONE);
        kok.addView(sebepKutu);

        not = new EditText(this);
        not.setHint("Not (isteğe bağlı)");
        not.setHintTextColor(METIN3);
        not.setTextColor(METIN);
        not.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        not.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        not.setBackground(yuvarlak(KUTU, CIZGI, 12));
        not.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        np.topMargin = dp(12);
        kok.addView(not, np);

        LinearLayout dugmeler = new LinearLayout(this);
        dugmeler.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams dp0 = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dp0.topMargin = dp(14);
        TextView atla = dugme("Atla", KUTU, METIN2);
        atla.setOnClickListener(v -> finish());
        kaydet = dugme("Kaydet", CYAN, 0xFF06121A);
        kaydet.setTypeface(Typeface.DEFAULT_BOLD);
        kaydet.setOnClickListener(v -> kaydet());
        LinearLayout.LayoutParams a = new LinearLayout.LayoutParams(0, dp(48), 1f);
        a.rightMargin = dp(6);
        LinearLayout.LayoutParams k = new LinearLayout.LayoutParams(0, dp(48), 2f);
        k.leftMargin = dp(6);
        dugmeler.addView(atla, a);
        dugmeler.addView(kaydet, k);
        kok.addView(dugmeler, dp0);

        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(false);
        sv.addView(kok);
        return sv;
    }

    private TextView baslik(String s) {
        TextView t = metin(s.toUpperCase(new Locale("tr", "TR")), 11, METIN3, true);
        t.setLetterSpacing(0.06f);
        t.setPadding(0, dp(12), 0, dp(6));
        return t;
    }

    private LinearLayout izgara(String[] etiket, String[] deger, int sutun, Secim s, Runnable degisti) {
        s.degerler = deger;
        LinearLayout kap = dikey();
        LinearLayout satir = null;
        for (int i = 0; i < etiket.length; i++) {
            if (i % sutun == 0) {
                satir = new LinearLayout(this);
                satir.setOrientation(LinearLayout.HORIZONTAL);
                kap.addView(satir, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            }
            final int n = i;
            TextView c = metin(etiket[i], 13, METIN, false);
            c.setGravity(Gravity.CENTER);
            c.setMinHeight(dp(44));
            c.setPadding(dp(4), dp(8), dp(4), dp(8));
            c.setBackground(yuvarlak(KUTU, CIZGI, 12));
            c.setOnClickListener(v -> {
                s.sec(n);
                if (degisti != null) degisti.run();
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            satir.addView(c, lp);
            s.ogeler.add(c);
        }
        // son satırı boşlukla tamamla (hizalı dursun)
        int eksik = (sutun - etiket.length % sutun) % sutun;
        for (int i = 0; i < eksik && satir != null; i++) {
            View bos = new View(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, 1, 1f);
            lp.setMargins(dp(3), 0, dp(3), 0);
            satir.addView(bos, lp);
        }
        return kap;
    }

    private class Secim {
        String deger;
        String[] degerler;
        final List<TextView> ogeler = new ArrayList<>();

        void sec(int n) {
            String yeni = degerler[n];
            deger = yeni.equals(deger) ? null : yeni;
            for (int i = 0; i < ogeler.size(); i++) {
                boolean on = degerler[i].equals(deger);
                ogeler.get(i).setBackground(on ? yuvarlak(0x33E8197A, MG, 12) : yuvarlak(KUTU, CIZGI, 12));
                ogeler.get(i).setTextColor(on ? 0xFFFFFFFF : METIN);
                ogeler.get(i).setTypeface(on ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            }
        }
    }

    // ---------------------------------------------------------------- kaydet
    private void kaydet() {
        if (gonderiliyor) return;
        if (kaynak.deger == null) { tost("Aramanın nereden geldiğini seç"); return; }
        if (sonuc.deger == null) { tost("Sonucu seç"); return; }
        if (sektor.deger == null && !"yanlis".equals(sonuc.deger)) { tost("Sektörü seç"); return; }
        if (Ayar.cihaz(this) == null) { tost("Önce uygulamayı açıp ERP'ye giriş yap"); return; }

        final JSONObject p = new JSONObject();
        try {
            p.put("numara", numara == null ? "" : numara);
            p.put("rehber_ad", ad == null ? "" : ad);
            p.put("yon", "gelen");
            p.put("sure_sn", String.valueOf(sure));
            p.put("zaman", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date(zaman)));
            p.put("kanal", "tel");
            p.put("kaynak", kaynak.deger);
            p.put("sektor", sektor.deger == null ? "" : sektor.deger);
            p.put("sonuc", sonuc.deger);
            p.put("sebep", "olusmadi".equals(sonuc.deger) && sebep.deger != null ? sebep.deger : "");
            p.put("aciklama", not.getText().toString().trim());
        } catch (Exception ignored) {}

        gonderiliyor = true;
        kaydet.setText("Kaydediliyor…");
        new Thread(() -> {
            try {
                Islem.aramaKaydet(getApplicationContext(), p);
                Veri.yenile(getApplicationContext());
                runOnUiThread(() -> {
                    tost("Kaydedildi");
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    gonderiliyor = false;
                    kaydet.setText("Kaydet");
                    tost("Kaydedilemedi: " + (e.getMessage() != null ? e.getMessage() : "bağlantı yok"));
                });
            }
        }).start();
    }

    // ---------------------------------------------------------------- küçük yardımcılar
    private LinearLayout dikey() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    private TextView metin(String s, float sp, int renk, boolean kalin) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(renk);
        if (kalin) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private TextView dugme(String s, int zemin, int renk) {
        TextView t = metin(s, 15, renk, false);
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
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private static String sureYaz(int sn) {
        return sn < 60 ? sn + " sn" : (sn / 60) + " dk " + (sn % 60) + " sn";
    }

    private void tost(String m) {
        Toast.makeText(this, m, Toast.LENGTH_SHORT).show();
    }
}
