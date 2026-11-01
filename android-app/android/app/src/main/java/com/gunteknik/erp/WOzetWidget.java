package com.gunteknik.erp;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget: Bugünün özeti */
public class WOzetWidget extends TemelWidget {
    @Override
    protected RemoteViews ciz(Context c, JSONObject v, Bundle secenek) {
        return WidgetCizici.ozet(c, v, secenek);
    }
}
