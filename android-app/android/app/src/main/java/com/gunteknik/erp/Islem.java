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

    /** 21:00 hatırlatmasındaki "Arama gelmedi" */
    public static String aramaYok(Context c, String tarih) throws Exception {
        return Sunucu.metin(Sunucu.rpc("push_arama_yok", new JSONObject().put("p_token", token(c)).put("p_tarih", tarih)));
    }
}
