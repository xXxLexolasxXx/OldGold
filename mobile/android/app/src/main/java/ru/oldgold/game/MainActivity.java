package ru.oldgold.game;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        // поля под вырез камеры (старые WebView без passthrough safe-area) — цвет игры, а не белые
        int bg = Color.parseColor("#1a130d");
        getWindow().getDecorView().setBackgroundColor(bg);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        WebView web = getBridge().getWebView();
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // Capacitor 8 (targetSdk 35+) может отодвинуть WebView полями от строки состояния и выреза — в поле виден фон
        // родителей WebView, а не окна: красим и их, чтобы полоса сверху была цвета игры, а не белой
        web.setBackgroundColor(bg);
        for (View v = web; v != null; v = v.getParent() instanceof View ? (View) v.getParent() : null) v.setBackgroundColor(bg);
        WebSettings s = web.getSettings();
        s.setMediaPlaybackRequiresUserGesture(false); // звук играет сразу после первого тапа
        s.setCacheMode(WebSettings.LOAD_DEFAULT);     // свежесть обеспечивает сервер/service worker (сеть в приоритете)
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}

