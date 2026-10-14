package com.leuname.leunapets.painel;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.SharedPreferences;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

/** Abre o painel do dono da loja (pets.leuname.com/painel/). O login fica guardado no app. */
public class MainActivity extends Activity {
    private static final String PAINEL = "https://pets.leuname.com/painel/";
    private WebView web;
    private ProgressBar carregando;
    private ValueCallback<Uri[]> escolha;   // "Subir vídeo" do painel (seletor de arquivos)

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        FrameLayout tela = new FrameLayout(this);
        web = new WebView(this);
        carregando = new ProgressBar(this);
        FrameLayout.LayoutParams centro = new FrameLayout.LayoutParams(120, 120, android.view.Gravity.CENTER);
        tela.addView(web);
        tela.addView(carregando, centro);
        setContentView(tela);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // guarda o login do painel
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Ponte(), "LeuNativo");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (escolha != null) escolha.onReceiveValue(null);
                escolha = cb;
                try { startActivityForResult(params.createIntent(), 42); }
                catch (Exception e) { escolha = null; return false; }
                return true;
            }
        });   // o painel passa o login para o vigia de vendas

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (!r.isForMainFrame()) return false;   // aba "Ver loja" (iframe) abre dentro do app
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("pets.leuname.com") && u.getPath() != null && u.getPath().startsWith("/painel")) return false;
                if (host.endsWith("cjdropshipping.com") || host.endsWith("cjdropshipping.cn")) return false;   // CJ abre dentro do app (fica logada)
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sem app para abrir */ }
                return true;                       // loja, CJ e outros links abrem no navegador
            }
            @Override public void onPageStarted(WebView v, String url, Bitmap f) { carregando.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView v, String url) { carregando.setVisibility(View.GONE); }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    v.loadData("<html><body style='font-family:sans-serif;text-align:center;padding:60px 20px;color:#0F1E44'>"
                        + "<h2>Sem internet</h2><p>Verifique a conexão.</p>"
                        + "<button style='background:#E62E73;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:16px' "
                        + "onclick=\"location.href='" + PAINEL + "'\">Tentar de novo</button></body></html>", "text/html", "UTF-8");
                }
            }
        });
        // downloads (vídeos, APK): abre no navegador, que baixa para a Galeria/Downloads
        web.setDownloadListener((url, ua, disp, tipo, tam) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* nada */ }
        });
        String aba = getIntent() != null ? getIntent().getStringExtra("aba") : null;
        if (salvo != null) web.restoreState(salvo); else web.loadUrl(PAINEL + ("pedidos".equals(aba) ? "#pedidos" : ""));
        pedirPermissoes();
        VendasService.iniciar(this);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent dados) {
        if (req == 42 && escolha != null) {
            Uri[] r = WebChromeClient.FileChooserParams.parseResult(res, dados);
            if (r == null && dados != null && dados.getClipData() != null) {   // vários vídeos de uma vez
                int n = dados.getClipData().getItemCount();
                r = new Uri[n];
                for (int k = 0; k < n; k++) r[k] = dados.getClipData().getItemAt(k).getUri();
            }
            escolha.onReceiveValue(r);
            escolha = null;
            return;
        }
        super.onActivityResult(req, res, dados);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if ("pedidos".equals(i.getStringExtra("aba"))) web.loadUrl(PAINEL + "#pedidos");
    }

    private void pedirPermissoes() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7);
        SharedPreferences p = getSharedPreferences(VendasService.PREFS, MODE_PRIVATE);
        if (Build.VERSION.SDK_INT >= 23 && !p.getBoolean("pediuBateria", false)) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                p.edit().putBoolean("pediuBateria", true).apply();
                try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                catch (Exception e) { /* aparelho sem essa tela */ }
            }
        }
    }

    /** Chamado pelo JavaScript do painel. */
    class Ponte {
        @JavascriptInterface
        public void salvarToken(String tk) {
            getSharedPreferences(VendasService.PREFS, MODE_PRIVATE).edit().putString("token", tk == null ? "" : tk).apply();
            VendasService.iniciar(MainActivity.this);
        }
        @JavascriptInterface
        public void testarSom() {
            VendasService.criarCanais(MainActivity.this);
            ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(9,
                VendasService.construir(MainActivity.this, "vendas_caixa", "💰 Teste de venda", "Assim você vai ser avisado quando vender.", true));
        }
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
}
