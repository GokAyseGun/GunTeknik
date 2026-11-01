package com.gunteknik.erp;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget: Evrak ve ödemeler */
public class WEvrakWidget extends TemelWidget {
    @Override
    protected RemoteViews ciz(Context c, JSONObject v, Bundle secenek) {
        return WidgetCizici.evrak(c, v, secenek);
    }
}
