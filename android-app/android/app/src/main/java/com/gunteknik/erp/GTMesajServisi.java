package com.gunteknik.erp;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;

/** FCM: "bildirim" → yerel bildirim, her mesajda widget verisi tazelenir ("yenile"). */
public class GTMesajServisi extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        Ayar.fcm(this, token);
        String t = Ayar.cihaz(this);
        if (t == null) return;
        try {
            Sunucu.rpc("cihaz_fcm", new JSONObject().put("p_token", t).put("p_fcm", token));
        } catch (Exception ignored) {}
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage m) {
        Map<String, String> d = m.getData();
        String tip = d.get("tip");
        if ("guncelle".equals(tip)) {
            GuncellemeDenetci.simdi(this, false);
            return;
        }
        if ("bildirim".equals(tip)) Bildirimci.goster(this, d);
        Veri.yenile(this);
    }
}
