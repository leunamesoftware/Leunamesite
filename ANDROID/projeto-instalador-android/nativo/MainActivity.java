package com.leunamesoftwares.gestacell;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

/**
 * 1) No Android 15+ (targetSdk 35/36) o app é desenhado atrás da barra de status (relógio)
 *    e da barra de navegação. Aqui reservamos esse espaço (e o do teclado).
 * 2) Quem instalou pelo link (fora da Play Store) recebe o aviso "Nova versão disponível".
 *    Quem instalou pela Play Store não vê o aviso: a loja atualiza sozinha.
 */
public class MainActivity extends BridgeActivity {
    private static final String BAR_COLOR = "#0B2545"; // azul-marinho do cabeçalho
    private static final String VERSION_URL = "https://api.leunamesoftware.com/download/gestacell-versao.json";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor(BAR_COLOR));
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false); // ícones brancos sobre o azul
        controller.setAppearanceLightNavigationBars(false);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        new Thread(this::checkForUpdate).start();
    }

    private boolean installedFromPlayStore() {
        try {
            PackageManager pm = getPackageManager();
            String installer = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? pm.getInstallSourceInfo(getPackageName()).getInstallingPackageName()
                : pm.getInstallerPackageName(getPackageName());
            return "com.android.vending".equals(installer);
        } catch (Exception e) {
            return false;
        }
    }

    private void checkForUpdate() {
        if (installedFromPlayStore()) return;
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(VERSION_URL).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            String body;
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                body = out.toString("UTF-8");
            } finally {
                conn.disconnect();
            }
            JSONObject info = new JSONObject(body);
            long latest = info.getLong("versionCode");
            String apkUrl = info.getString("apk");
            String latestName = info.optString("versionName", "");
            long current = PackageInfoCompat.getLongVersionCode(
                getPackageManager().getPackageInfo(getPackageName(), 0));
            if (latest <= current) return;
            runOnUiThread(() -> {
                if (isFinishing()) return;
                new AlertDialog.Builder(this)
                    .setTitle("Nova versão disponível")
                    .setMessage("Há uma atualização do Gestacell" + (latestName.isEmpty() ? "" : " (" + latestName + ")")
                        + ". Toque em Atualizar, baixe e abra o arquivo: ela instala por cima, sem perder seus dados.")
                    .setPositiveButton("Atualizar", (d, w) ->
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl))))
                    .setNegativeButton("Depois", null)
                    .show();
            });
        } catch (Exception ignored) {
            // Sem internet ou servidor fora do ar: tenta de novo na próxima abertura.
        }
    }
}
