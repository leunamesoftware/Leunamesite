package com.leuname.leunapets.painel;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/** Vigia as vendas (a cada 60 s) e toca o som de caixa quando entra uma venda nova, mesmo com o app fechado. */
public class VendasService extends Service {
    static final String PREFS = "painel";
    private static final String URL_ULTIMO = "https://pets.leuname.com/api/painel/ultimo";
    private static final String CANAL_VENDAS = "vendas_caixa";
    private static final String CANAL_VIGIA = "vigia";
    private static final long INTERVALO = 60_000L;
    private HandlerThread fio;
    private Handler handler;

    public static void iniciar(Context c) {
        String tk = c.getSharedPreferences(PREFS, MODE_PRIVATE).getString("token", "");
        Intent i = new Intent(c, VendasService.class);
        if (tk.isEmpty()) { c.stopService(i); return; }
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) { /* sistema não deixou agora; tenta na próxima abertura */ }
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        criarCanais(this);
        Notification fixa = construir(this, CANAL_VIGIA, "Vigiando suas vendas", "Toca o som de caixa quando entrar um pedido.", false);
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, fixa, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, fixa);
        fio = new HandlerThread("vendas");
        fio.start();
        handler = new Handler(fio.getLooper());
        handler.post(verificar);
    }

    @Override public int onStartCommand(Intent i, int f, int id) { return START_STICKY; }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (fio != null) fio.quitSafely();
        super.onDestroy();
    }

    private final Runnable verificar = new Runnable() {
        @Override public void run() {
            try { checar(); } catch (Exception e) { /* sem internet: tenta de novo */ }
            handler.postDelayed(this, INTERVALO);
        }
    };

    private void checar() throws Exception {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        String tk = p.getString("token", "");
        if (tk.isEmpty()) { stopSelf(); return; }
        HttpURLConnection c = (HttpURLConnection) new URL(URL_ULTIMO).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setRequestProperty("Authorization", "Bearer " + tk);
        int cod = c.getResponseCode();
        if (cod == 401) { p.edit().putString("token", "").apply(); stopSelf(); return; }
        if (cod != 200) return;
        StringBuilder sb = new StringBuilder();
        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
        String l; while ((l = r.readLine()) != null) sb.append(l);
        r.close();
        JSONObject j = new JSONObject(sb.toString());
        long ultimo = j.optLong("ultimo", 0);
        long visto = p.getLong("visto", -1);
        if (visto < 0) { p.edit().putLong("visto", ultimo).apply(); return; }   // 1ª vez: só memoriza
        if (ultimo > visto) {
            p.edit().putLong("visto", ultimo).apply();
            String texto = j.optString("texto", "Abra o painel para ver o pedido.");
            Notification n = construir(this, CANAL_VENDAS, "💰 Venda nova!", texto, true);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify((int) (ultimo / 1000 % 100000) + 10, n);
        }
    }

    static void criarCanais(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel v = new NotificationChannel(CANAL_VENDAS, "Vendas (som de caixa)", NotificationManager.IMPORTANCE_HIGH);
        v.setSound(som(c), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        v.enableVibration(true);
        v.setVibrationPattern(new long[]{0, 200, 80, 200});
        nm.createNotificationChannel(v);
        NotificationChannel g = new NotificationChannel(CANAL_VIGIA, "Vigia de vendas", NotificationManager.IMPORTANCE_MIN);
        g.setShowBadge(false);
        nm.createNotificationChannel(g);
    }

    static Uri som(Context c) { return Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.caixa); }

    static Notification construir(Context c, String canal, String titulo, String texto, boolean venda) {
        Intent abrir = new Intent(c, MainActivity.class).putExtra("aba", venda ? "pedidos" : "");
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, venda ? 2 : 1, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, canal) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle(titulo).setContentText(texto).setContentIntent(pi)
                .setStyle(new Notification.BigTextStyle().bigText(texto));
        if (venda) {
            b.setAutoCancel(true).setCategory(Notification.CATEGORY_MESSAGE);
            if (Build.VERSION.SDK_INT < 26) b.setSound(som(c)).setVibrate(new long[]{0, 200, 80, 200}).setPriority(Notification.PRIORITY_HIGH);
        } else {
            b.setOngoing(true);
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MIN);
        }
        return b.build();
    }
}
