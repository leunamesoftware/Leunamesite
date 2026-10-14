package com.leuname.leunapets.painel;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Celular religou: volta a vigiar as vendas. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) VendasService.iniciar(c);
    }
}
