package com.gunteknik.erp;

import android.content.Context;

import org.json.JSONObject;

/** Arama kayıtları — widget, bildirim ve arama penceresi aynı yolu kullanır. */
public final class Islem {

    private Islem() {}

    private static String token(Context c) throws Exception {
        String t = Ayar.cihaz(c);
        if (t == null) throw new Exception("Önce uygulamayı açıp ERP'ye giriş yap");
        return t;
    }

    public static long aramaKaydet(Context c, JSONObject p) throws Exception {
        String r = Sunucu.rpc("arama_kaydet", new JSONObject().put("p_token", token(c)).put("p", p));
        long id = new JSONObject(r).optLong("id", 0);
        if (id > 0) Ayar.sonArama(c, id);
        return id;
    }

    public static String aramaGuncelle(Context c, long id, JSONObject p) throws Exception {
        return Sunucu.metin(Sunucu.rpc("arama_guncelle", new JSONObject().put("p_token", token(c)).put("p_id", id).put("p", p)));
    }

    public static String aramaSil(Context c, long id) throws Exception {
        return Sunucu.metin(Sunucu.rpc("arama_sil", new JSONObject().put("p_token", token(c)).put("p_id", id)));
    }

    /** Spam arama: yalnızca sayı olarak kaydedilir (reklam_manuel tip=spam) */
    public static String aramaSpam(Context c, String numara, String zaman) throws Exception {
        return Sunucu.metin(Sunucu.rpc("arama_spam", new JSONObject().put("p_token", token(c)).put("p_numara", numara == null ? "" : numara).put("p_zaman", zaman == null ? "" : zaman)));
    }

    /** Sağlık (yalnız sağlık sahibinin cihazında çalışır): su ekle → güncel sağlık özeti */
    public static JSONObject suEkle(Context c, int ml) throws Exception {
        return new JSONObject(Sunucu.rpc("saglik_su_ekle", new JSONObject().put("p_token", token(c)).put("p_ml", ml)));
    }

    /** baglam: dinlenme · gunluk · hafif · agir · atak */
    public static JSONObject nabizEkle(Context c, int deger, String baglam) throws Exception {
        return new JSONObject(Sunucu.rpc("saglik_nabiz_ekle", new JSONObject().put("p_token", token(c)).put("p_deger", deger).put("p_baglam", baglam)));
    }

    /** Sunucudan gelen sağlık özetini widget önbelleğine yaz ve widget'ları çiz. */
    public static synchronized void saglikYaz(Context c, JSONObject saglik) {
        try {
            JSONObject v = Veri.oku(c);
            if (v == null || saglik == null) return;
            v.put("saglik", saglik);
            Ayar.veriYerel(c, v.toString());
            WidgetCizici.hepsi(c);
        } catch (Exception ignored) {}
    }

    /** İyimser su: önbellekteki bugünkü miktarı hemen artır (üst üste dokunuşlar anında görünsün). */
    public static synchronized void suYerel(Context c, int ml) {
        try {
            JSONObject v = Veri.oku(c);
            JSONObject s = v != null ? v.optJSONObject("saglik") : null;
            if (s == null) return;
            s.put("su_ml", s.optInt("su_ml") + ml);
            s.put("su_adet", s.optInt("su_adet") + 1);
            s.put("su_son", new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(new java.util.Date()));
            Ayar.veriYerel(c, v.toString());
            WidgetCizici.hepsi(c);
        } catch (Exception ignored) {}
    }

    /** 21:00 hatırlatmasındaki "Arama gelmedi" */
    public static String aramaYok(Context c, String tarih) throws Exception {
        return Sunucu.metin(Sunucu.rpc("push_arama_yok", new JSONObject().put("p_token", token(c)).put("p_tarih", tarih)));
    }
}
