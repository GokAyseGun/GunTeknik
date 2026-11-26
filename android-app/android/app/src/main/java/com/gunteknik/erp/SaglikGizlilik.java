package com.gunteknik.erp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Health Connect izin ekranındaki "gizlilik politikası" bağlantısı: gizlilik sayfasını açar. */
public class SaglikGizlilik extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Ayar.ERP_URL + "gizlilik.html")));
        } catch (Exception ignored) {}
        finish();
    }
}
