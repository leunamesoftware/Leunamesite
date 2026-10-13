package com.leuname.leunapets.painel;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
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

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("pets.leuname.com") && u.getPath() != null && u.getPath().startsWith("/painel")) return false;
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
        if (salvo != null) web.restoreState(salvo); else web.loadUrl(PAINEL);
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
}
