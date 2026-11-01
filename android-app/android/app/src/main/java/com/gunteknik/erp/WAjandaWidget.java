package com.gunteknik.erp;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget: Ajanda */
public class WAjandaWidget extends TemelWidget {
    @Override
    protected RemoteViews ciz(Context c, JSONObject v, Bundle secenek) {
        return WidgetCizici.ajanda(c, v, secenek);
    }
}
