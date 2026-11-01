package com.gunteknik.erp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.WebView;

import androidx.appcompat.app.AlertDialog;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Gün Teknik ERP kabuğu.
 * ERP, capacitor.config.json'daki server.url adresinden (GitHub Pages) canlı yüklenir;
 * web tarafındaki her güncelleme uygulamaya kendiliğinden yansır.
 */
public class MainActivity extends BridgeActivity {

    private static final int IZIN_ISTEK = 77;
    private String koprBetigi;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Yerel eklentiler super.onCreate'ten ÖNCE kaydedilmeli.
        registerPlugin(GTYerelPlugin.class);
        super.onCreate(savedInstanceState);

        Bildirimci.kanallar(this);
        koprBetigi = betikOku();
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                if (koprBetigi != null) webView.evaluateJavascript(koprBetigi, null);
            }
        });
        urlIsle(getIntent(), true);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!isFinishing()) izinleriIste(false);
        }, 4000);
    }

    @Override
    public void onResume() {
        super.onResume();
        GuncellemeDenetci.denetle(this, false);
        Veri.arkaplanda(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        urlIsle(intent, false);
    }

    /** Bildirim / widget'tan gelen adres: "./?sayfa=evrak", "./?arama=2026-11-01" … */
    private void urlIsle(Intent i, boolean ilk) {
        if (i == null) return;
        String u = i.getStringExtra("url");
        if (u == null || u.isEmpty()) return;
        i.removeExtra("url");
        if (ilk) {
            String q = u.startsWith("./") ? u.substring(2) : u;
            if (q.startsWith("?")) getBridge().getWebView().loadUrl(Ayar.ERP_URL + q);
        } else {
            String js = "try{if(typeof bildirimUrlIsle==='function')bildirimUrlIsle(" + JSONObject.quote(u) + ");}catch(e){}";
            getBridge().getWebView().evaluateJavascript(js, null);
        }
    }

    // ---------------------------------------------------------------- izinler
    /** Telefon durumu, arama kaydı, rehber, bildirim; sonra "diğer uygulamaların üzerinde göster". */
    public void izinleriIste(boolean zorla) {
        List<String> L = new ArrayList<>();
        String[] gerekli = Build.VERSION.SDK_INT >= 33
            ? new String[]{Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_CONTACTS, Manifest.permission.POST_NOTIFICATIONS}
            : new String[]{Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_CONTACTS};
        for (String p : gerekli) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) L.add(p);
        }
        if (!L.isEmpty() && (zorla || !Ayar.bayrak(this, "izinSoruldu"))) {
            Ayar.bayrak(this, "izinSoruldu", true);
            ActivityCompat.requestPermissions(this, L.toArray(new String[0]), IZIN_ISTEK);
            return;
        }
        ustteKontrol(zorla);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == IZIN_ISTEK) ustteKontrol(false);
    }

    private void ustteKontrol(boolean zorla) {
        if (Settings.canDrawOverlays(this)) return;
        if (!zorla && Ayar.bayrak(this, "ustteSoruldu")) return;
        Ayar.bayrak(this, "ustteSoruldu", true);
        new AlertDialog.Builder(this)
            .setTitle("Arama sonrası pencere")
            .setMessage("Görüşme bitince \"Reklamdan mıydı, hangi sektör, sonuç ne?\" penceresinin ekranın üstünde açılabilmesi için bir sonraki ekranda Gün Teknik için \"Diğer uygulamaların üzerinde göster\" iznini aç.")
            .setPositiveButton("Ayarları aç", (d, w) -> {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) {}
            })
            .setNegativeButton("Sonra", null)
            .show();
    }

    // ---------------------------------------------------------------- köprü betiği
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
