package com.leunamesoftwares.facturo;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Android 15+ desenha o app atrás do relógio e da barra de navegação: aqui reservamos esse espaço.
 * O teclado NÃO entra aqui: a janela já encolhe sozinha (adjustResize); somar os dois cortava a tela pela metade.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean escuro = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int fundo = Color.parseColor(escuro ? "#0C171A" : "#F3F6F6"); // = --fundo do app (claro/escuro)
        getWindow().getDecorView().setBackgroundColor(fundo);
        findViewById(android.R.id.content).setBackgroundColor(fundo);
        getWindow().setStatusBarColor(fundo);
        getWindow().setNavigationBarColor(fundo);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);     // sem faixa cinza por cima
            getWindow().setNavigationBarContrastEnforced(false); // nem embaixo
        }
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(!escuro);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(!escuro);

        View conteudo = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(conteudo, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
