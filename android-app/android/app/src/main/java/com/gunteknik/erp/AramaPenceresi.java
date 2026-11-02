package com.gunteknik.erp;

import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
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
import java.util.function.Consumer;

/**
 * Arama kaydı — görüşme sonrası önce: Özel / İş / Spam.
 *   Özel → hiçbir şey yapılmaz · Spam → yalnızca sayı olarak kaydedilir · İş → adım adım:
 *   1) Nereden geldi?  2) Sektör  3) Sonuç  (+ neden olmadı).
 * İki yerden açılır: görüşme bitince (numara ile) ve widget'tan (numarasız, kanal seçilebilir).
 * Son seçimde kendiliğinden kaydeder.
 */
public class AramaPenceresi extends AppCompatActivity {

    private static final int ZEMIN = 0xFF141414, KUTU = 0xFF1C1C1C, CIZGI = 0xFF333333;
    private static final int METIN = 0xFFF0F0F0, METIN2 = 0xFFB0B0B0, METIN3 = 0xFF808080;
    private static final int CYAN = 0xFF00E5FF, MG = 0xFFE8197A;

    // Rehberdeki kişi kaynaklarıyla aynı liste (+ Bilinmiyor)
    static final String[] KAYNAK = {"Google Ads", "Armut", "Dışarıdan", "Eski Müşteri", "Tavsiye", "Bilinmiyor"};
    static final String[] KAYNAK_AD = {"📢 Google Ads", "🍑 Armut", "🚪 Dışarıdan", "🔁 Eski müşteri", "🤝 Tavsiye", "❔ Bilinmiyor"};
    static final String[] SONUC = {"potansiyel", "is_alindi", "yanlis", "olusmadi"};
    static final String[] SONUC_AD = {"🟡 Potansiyel müşteri", "✅ İş alındı", "📵 Yanlış arama", "⛔ İş oluşmadı"};
    static final String[] SEBEP = {"fiyat", "uzak", "vazgecti", "baska_usta", "diger"};
    static final String[] SEBEP_AD = {"💸 Fiyat", "📍 Uzak", "↩️ Vazgeçti", "🔧 Başka usta", "❔ Diğer"};

    private String numara, ad, kanal, erpAd;
    private int sure;
    private long zaman;
    private boolean gorusme;          // true: görüşme bitince açıldı
    private boolean geri;             // true: kaçırılan aramaya geri dönüldü
    private int kalan;                // sırada bekleyen başka arama sayısı
    private boolean bitti;            // bu arama sıradan çıkarıldı
    static volatile boolean acik;     // pencere ekranda mı (AramaTarama ikinci kez açmasın)
    private int adim;                 // -1 tür (özel/iş/spam), 0 kaynak, 1 sektör, 2 sonuç, 3 sebep
    private String bulunanKaynak;     // ERP rehberinden gelen kaynak (İş seçilince kullanılır)
    private String kaynak, sektor, sonuc, sebep;
    private boolean gonderiliyor;

    private LinearLayout govde, kanalSatir;
    private TextView ozet, geri, adimBaslik, rehberBilgi;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setFinishOnTouchOutside(false);
        if (android.os.Build.VERSION.SDK_INT >= 27) setShowWhenLocked(true);
        hazirla(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        acik = true;
    }

    @Override
    protected void onDestroy() {
        acik = false;
        // geri tuşuyla kapandıysa bu aramayı atlanmış say; sırada kalan varsa bildirimle hatırlat
        if (isFinishing() && gorusme && !bitti) {
            bitti = true;
            final android.content.Context c = getApplicationContext();
            final long z = zaman;
            new Thread(() -> {
                Intent n = AramaTarama.cikar(c, z);
                if (n != null) Bildirimci.aramaBekliyor(c, n, AramaTarama.bekleyen(c) + " arama kaydedilmedi");
            }).start();
        }
        super.onDestroy();
    }

    /** Bu arama bitti (kaydedildi, spam, özel ya da atlandı): sırada başka arama varsa aynı pencerede ona geç. */
    private void kapat() {
        if (!gorusme) { finish(); return; }
        bitti = true;
        Intent n = AramaTarama.cikar(this, zaman);
        if (n != null) {
            setIntent(n);
            hazirla(n);
        } else {
            finish();
        }
    }

    private static String saatYaz(long z) {
        boolean bugun = android.text.format.DateUtils.isToday(z);
        return new SimpleDateFormat(bugun ? "HH:mm" : "dd.MM HH:mm", Locale.US).format(new Date(z));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hazirla(intent);
    }

    private void hazirla(Intent i) {
        numara = i.getStringExtra("numara");
        ad = i.getStringExtra("ad");
        sure = i.getIntExtra("sure", 0);
        zaman = i.getLongExtra("zaman", 0);
        gorusme = zaman > 0;
        geri = i.getBooleanExtra("geri", false);
        kalan = i.getIntExtra("kalan", 0);
        bitti = false;
        kanal = gorusme ? "tel" : Ayar.kanal(this);
        int bildirim = i.getIntExtra("bildirim", 0);
        if (bildirim != 0) NotificationManagerCompat.from(this).cancel(bildirim);
        if (gorusme) {
            // AramaAlici pencerenin gerçekten açıldığını buradan anlar; yedek bildirim geldiyse kaldır
            getSharedPreferences("gt_arama", MODE_PRIVATE).edit().putLong("pencereAcildi", System.currentTimeMillis()).apply();
            NotificationManagerCompat.from(this).cancel(4242);
        }
        adim = gorusme ? -1 : 0;
        kaynak = sektor = sonuc = sebep = null;
        erpAd = null;
        bulunanKaynak = null;
        gonderiliyor = false;
        setContentView(arayuz());
        adimCiz();
        if (gorusme && numara != null && !numara.isEmpty()) rehberdenBul();
    }

    /** Numara ERP rehberinde kayıtlıysa kaynağını kendiliğinden seç (değiştirilebilir). */
    private void rehberdenBul() {
        final String no = numara;
        new Thread(() -> {
            try {
                String t = Ayar.cihaz(this);
                if (t == null) return;
                String r = Sunucu.rpc("arama_kisi_bul", new JSONObject().put("p_token", t).put("p_numara", no));
                if (r == null || r.trim().isEmpty() || r.trim().equals("null")) return;
                JSONObject k = new JSONObject(r);
                final String isim = k.optString("isim", "");
                final String ky = k.optString("kaynak", "");
                runOnUiThread(() -> {
                    if (isFinishing() || !no.equals(numara)) return;
                    if (!isim.isEmpty()) erpAd = isim;
                    if (rehberBilgi != null && !isim.isEmpty()) {
                        rehberBilgi.setText("👤 Rehberde: " + isim + (ky.isEmpty() || "null".equals(ky) ? "" : "  ·  " + ky));
                        rehberBilgi.setVisibility(View.VISIBLE);
                    }
                    boolean gecerli = false;
                    for (String x : KAYNAK) if (x.equals(ky)) gecerli = true;
                    if (gecerli) bulunanKaynak = ky;
                    if (gecerli && adim == 0 && kaynak == null && !gonderiliyor) {
                        kaynak = ky;
                        adim = 1;
                        adimCiz();
                    }
                });
            } catch (Exception ignored) {}
        }).start();
    }

    // ---------------------------------------------------------------- iskelet
    private View arayuz() {
        LinearLayout kok = dikey();
        kok.setPadding(dp(18), dp(16), dp(18), dp(14));
        kok.setBackground(yuvarlak(ZEMIN, CIZGI, 22));

        kok.addView(metin(gorusme ? (geri ? "📞 Geri döndüğün arama" : "📞 Az önceki arama") : "📞 Arama kaydet", 18, METIN, true));
        if (gorusme) {
            String kim = ad != null && !ad.isEmpty() ? ad + (numara != null ? "  ·  " + numara : "") : (numara == null || numara.isEmpty() ? "Gizli numara" : numara);
            String ek = (geri ? "Kaçırılan arama " : "") + saatYaz(zaman) + (geri ? "  ·  geri aradın" : "") + (sure > 0 ? "  ·  " + sureYaz(sure) : "")
                + (kalan > 0 ? "\n⏳ Sırada " + kalan + " arama daha" : "");
            TextView alt = metin(kim + "\n" + ek, 13, METIN2, false);
            alt.setPadding(0, dp(2), 0, dp(2));
            kok.addView(alt);
            rehberBilgi = metin("", 12, 0xFF00E676, false);
            rehberBilgi.setVisibility(View.GONE);
            kok.addView(rehberBilgi);
        } else {
            kanalSatir = new LinearLayout(this);
            kanalSatir.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams kp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            kp.topMargin = dp(8);
            kok.addView(kanalSatir, kp);
            kanalCiz();
        }

        ozet = metin("", 12, CYAN, false);
        ozet.setPadding(0, dp(8), 0, 0);
        kok.addView(ozet);

        adimBaslik = metin("", 11, METIN3, true);
        adimBaslik.setLetterSpacing(0.06f);
        adimBaslik.setPadding(0, dp(12), 0, dp(6));
        kok.addView(adimBaslik);

        govde = dikey();
        kok.addView(govde);

        LinearLayout alt = new LinearLayout(this);
        alt.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ap.topMargin = dp(12);
        geri = dugme("← Geri", KUTU, METIN2);
        geri.setOnClickListener(v -> {
            if (gonderiliyor || adim <= -1 || (adim == 0 && !gorusme)) return;
            adim = adim == 3 ? 2 : adim - 1;
            if (adim == -1) kaynak = null;
            if (adim <= 2) sebep = null;
            if (adim <= 1) sonuc = null;
            if (adim == 0) sektor = null;
            adimCiz();
        });
        TextView iptal = dugme(gorusme ? "Atla" : "İptal", KUTU, METIN2);
        iptal.setOnClickListener(v -> kapat());
        LinearLayout.LayoutParams g1 = new LinearLayout.LayoutParams(0, dp(46), 1f);
        g1.rightMargin = dp(6);
        LinearLayout.LayoutParams g2 = new LinearLayout.LayoutParams(0, dp(46), 1f);
        g2.leftMargin = dp(6);
        alt.addView(geri, g1);
        alt.addView(iptal, g2);
        kok.addView(alt, ap);

        ScrollView sv = new ScrollView(this);
        sv.addView(kok);
        return sv;
    }

    private void kanalCiz() {
        if (kanalSatir == null) return;
        kanalSatir.removeAllViews();
        String[] k = {"tel", "wa"};
        String[] e = {"📞 Telefon", "💬 WhatsApp"};
        for (int i = 0; i < 2; i++) {
            final String d = k[i];
            boolean on = d.equals(kanal);
            TextView t = metin(e[i], 13, on ? 0xFFFFFFFF : METIN2, on);
            t.setGravity(Gravity.CENTER);
            t.setPadding(dp(4), dp(8), dp(4), dp(8));
            t.setBackground(on ? yuvarlak(0x3300E5FF, CYAN, 12) : yuvarlak(KUTU, CIZGI, 12));
            t.setOnClickListener(v -> {
                kanal = d;
                Ayar.kanal(this, d);
                kanalCiz();
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            lp.setMargins(i == 0 ? 0 : dp(4), 0, i == 0 ? dp(4) : 0, 0);
            kanalSatir.addView(t, lp);
        }
    }

    // ---------------------------------------------------------------- adımlar
    private void adimCiz() {
        govde.removeAllViews();
        geri.setVisibility(adim > 0 || (adim == 0 && gorusme) ? View.VISIBLE : View.INVISIBLE);
        ozetYaz();
        switch (adim) {
            case -1:
                adimBaslik.setText("BU ARAMA NEYDİ?");
                govde.addView(izgara(new String[]{"🔒 Özel", "💼 İş", "📛 Spam"}, new String[]{"ozel", "is", "spam"}, 3, null, v -> {
                    if ("ozel".equals(v)) { kapat(); return; }
                    if ("spam".equals(v)) { spamKaydet(); return; }
                    if (bulunanKaynak != null) { kaynak = bulunanKaynak; adim = 1; } else adim = 0;
                    adimCiz();
                }));
                TextView not = metin("Özel: hiçbir şey kaydedilmez · Spam: yalnızca spam sayısına +1", 11, METIN3, false);
                not.setPadding(dp(4), dp(8), dp(4), 0);
                govde.addView(not);
                break;
            case 0:
                adimBaslik.setText("1 / 3  ·  NEREDEN GELDİ?");
                govde.addView(izgara(KAYNAK_AD, KAYNAK, 2, kaynak, v -> { kaynak = v; adim = 1; adimCiz(); }));
                break;
            case 1: {
                adimBaslik.setText("2 / 3  ·  SEKTÖR");
                String[] e = new String[Ayar.SEKTOR_KISA.length + 1];
                String[] d = new String[Ayar.SEKTORLER.length + 1];
                System.arraycopy(Ayar.SEKTOR_KISA, 0, e, 0, Ayar.SEKTOR_KISA.length);
                System.arraycopy(Ayar.SEKTORLER, 0, d, 0, Ayar.SEKTORLER.length);
                e[e.length - 1] = "❔ Belli değil";
                d[d.length - 1] = "";
                govde.addView(izgara(e, d, 3, sektor == null ? null : sektor, v -> { sektor = v.isEmpty() ? null : v; adim = 2; adimCiz(); }));
                break;
            }
            case 2:
                adimBaslik.setText("3 / 3  ·  SONUÇ");
                govde.addView(izgara(SONUC_AD, SONUC, 2, sonuc, v -> {
                    sonuc = v;
                    if ("olusmadi".equals(v)) { adim = 3; adimCiz(); }
                    else kaydet();
                }));
                break;
            default:
                adimBaslik.setText("NEDEN OLMADI?");
                govde.addView(izgara(SEBEP_AD, SEBEP, 2, sebep, v -> { sebep = v; kaydet(); }));
                break;
        }
    }

    private void ozetYaz() {
        List<String> L = new ArrayList<>();
        if (kaynak != null) L.add(ad(KAYNAK, KAYNAK_AD, kaynak));
        if (adim >= 2) L.add(sektor == null ? "Sektör belli değil" : sektor);
        if (sonuc != null && adim >= 3) L.add(ad(SONUC, SONUC_AD, sonuc));
        ozet.setText(L.isEmpty() ? "" : android.text.TextUtils.join("  ›  ", L));
        ozet.setVisibility(L.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private static String ad(String[] d, String[] e, String v) {
        for (int i = 0; i < d.length; i++) if (d[i].equals(v)) return e[i];
        return v;
    }

    private LinearLayout izgara(String[] etiket, String[] deger, int sutun, String secili, Consumer<String> secildi) {
        LinearLayout kap = dikey();
        LinearLayout satir = null;
        for (int i = 0; i < etiket.length; i++) {
            if (i % sutun == 0) {
                satir = new LinearLayout(this);
                satir.setOrientation(LinearLayout.HORIZONTAL);
                kap.addView(satir, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            }
            final String d = deger[i];
            boolean on = d.equals(secili);
            TextView c = metin(etiket[i], 14, on ? 0xFFFFFFFF : METIN, on);
            c.setGravity(Gravity.CENTER);
            c.setMinHeight(dp(56));
            c.setPadding(dp(4), dp(10), dp(4), dp(10));
            c.setBackground(on ? yuvarlak(0x33E8197A, MG, 14) : yuvarlak(KUTU, CIZGI, 14));
            c.setOnClickListener(v -> {
                if (gonderiliyor) return;
                secildi.accept(d);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            satir.addView(c, lp);
        }
        int eksik = (sutun - etiket.length % sutun) % sutun;
        for (int i = 0; i < eksik && satir != null; i++) {
            View bos = new View(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, 1, 1f);
            lp.setMargins(dp(3), 0, dp(3), 0);
            satir.addView(bos, lp);
        }
        return kap;
    }

    // ---------------------------------------------------------------- spam: yalnızca sayı
    private void spamKaydet() {
        if (gonderiliyor) return;
        if (Ayar.cihaz(this) == null) { tost("Önce uygulamayı açıp ERP'ye giriş yap"); return; }
        gonderiliyor = true;
        govde.removeAllViews();
        geri.setVisibility(View.INVISIBLE);
        adimBaslik.setText("KAYDEDİLİYOR…");
        final String z = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date(zaman > 0 ? zaman : System.currentTimeMillis()));
        new Thread(() -> {
            try {
                Islem.aramaSpam(getApplicationContext(), numara, z);
                runOnUiThread(() -> { tost("📛 Spam sayıldı"); kapat(); });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    gonderiliyor = false;
                    tost("Kaydedilemedi: " + (e.getMessage() != null ? e.getMessage() : "bağlantı yok"));
                    adimCiz();
                });
            }
        }).start();
    }

    // ---------------------------------------------------------------- kaydet
    private void kaydet() {
        if (gonderiliyor) return;
        if (Ayar.cihaz(this) == null) { tost("Önce uygulamayı açıp ERP'ye giriş yap"); return; }
        final JSONObject p = new JSONObject();
        try {
            p.put("kanal", kanal);
            p.put("kaynak", kaynak);
            p.put("sektor", sektor == null ? "" : sektor);
            p.put("sonuc", sonuc);
            p.put("sebep", "olusmadi".equals(sonuc) && sebep != null ? sebep : "");
            if (gorusme) {
                p.put("yon", "gelen");
                p.put("numara", numara == null ? "" : numara);
                p.put("rehber_ad", erpAd != null ? erpAd : gtsiz(ad));
                p.put("sure_sn", String.valueOf(sure));
                p.put("zaman", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date(zaman)));
            } else {
                p.put("yon", "manuel");
            }
        } catch (Exception ignored) {}

        gonderiliyor = true;
        govde.removeAllViews();
        geri.setVisibility(View.INVISIBLE);
        adimBaslik.setText("KAYDEDİLİYOR…");
        new Thread(() -> {
            try {
                Islem.aramaKaydet(getApplicationContext(), p);
                Veri.yenile(getApplicationContext());
                runOnUiThread(() -> {
                    tost("✓ Kaydedildi");
                    kapat();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    gonderiliyor = false;
                    tost("Kaydedilemedi: " + (e.getMessage() != null ? e.getMessage() : "bağlantı yok"));
                    adimCiz();
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
        t.setBackground(yuvarlak(zemin, CIZGI, 14));
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

    /** Telefon rehberindeki "GT Ahmet" → "Ahmet" (ERP'deki adla aynı olsun) */
    static String gtsiz(String s) {
        if (s == null) return "";
        String t = s.trim();
        if (t.length() > 2 && t.substring(0, 2).equalsIgnoreCase("gt") && !Character.isLetter(t.charAt(2))) {
            t = t.substring(2).replaceFirst("^[\\s\\-_.:]+", "");
        }
        return t;
    }

    private static String sureYaz(int sn) {
        return sn < 60 ? sn + " sn" : (sn / 60) + " dk " + (sn % 60) + " sn";
    }

    private void tost(String m) {
        Toast.makeText(this, m, Toast.LENGTH_SHORT).show();
    }
}
