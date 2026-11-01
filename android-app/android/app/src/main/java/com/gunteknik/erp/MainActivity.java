package com.gunteknik.erp;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Gün Teknik ERP kabuğu.
 * ERP, capacitor.config.json'daki server.url adresinden (GitHub Pages) canlı yüklenir;
 * web tarafındaki her güncelleme uygulamaya kendiliğinden yansır.
 */
public class MainActivity extends BridgeActivity {

    private String koprBetigi;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Yerel eklentiler super.onCreate'ten ÖNCE kaydedilmeli.
        registerPlugin(GTYerelPlugin.class);
        super.onCreate(savedInstanceState);

        koprBetigi = betikOku();
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                if (koprBetigi != null) webView.evaluateJavascript(koprBetigi, null);
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        GuncellemeDenetci.denetle(this, false);
    }

    /** assets/gt-kopru.js — indirme köprüsü ve uygulama işareti. */
    private String betikOku() {
        try (InputStream in = getAssets().open("gt-kopru.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] tampon = new byte[8192];
            int n;
            while ((n = in.read(tampon)) > 0) out.write(tampon, 0, n);
            String js = new String(out.toByteArray(), StandardCharsets.UTF_8);
            return js.replace("__SURUM_KODU__", String.valueOf(GuncellemeDenetci.surumKodu(this)));
        } catch (Exception e) {
            return null;
        }
    }
}
