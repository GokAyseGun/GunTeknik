package com.gunteknik.erp;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Supabase RPC çağrıları (anon anahtar + cihaz anahtarı). Ana iş parçacığında çağrılmaz. */
public final class Sunucu {

    private Sunucu() {}

    public static String rpc(String fonksiyon, JSONObject govde) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(Ayar.SB_URL + "/rest/v1/rpc/" + fonksiyon).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setConnectTimeout(12000);
            c.setReadTimeout(15000);
            c.setRequestProperty("apikey", Ayar.SB_KEY);
            c.setRequestProperty("Authorization", "Bearer " + Ayar.SB_KEY);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Accept", "application/json");
            try (OutputStream o = c.getOutputStream()) {
                o.write(govde.toString().getBytes(StandardCharsets.UTF_8));
            }
            int kod = c.getResponseCode();
            String t = oku(kod < 400 ? c.getInputStream() : c.getErrorStream());
            if (kod >= 400) throw new Exception(hata(t, kod));
            return t;
        } finally {
            c.disconnect();
        }
    }

    /** RPC "text" döndürünce gelen "\"tamam\"" → tamam */
    public static String metin(String yanit) {
        if (yanit == null) return "";
        String s = yanit.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length() - 1);
        return s;
    }

    private static String oku(InputStream in) throws Exception {
        if (in == null) return "";
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = i.read(b)) > 0) out.write(b, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static String hata(String t, int kod) {
        try {
            JSONObject j = new JSONObject(t);
            String m = j.optString("message", "");
            if (!m.isEmpty()) return m;
        } catch (Exception ignored) {}
        return "Sunucu hatası " + kod;
    }
}
