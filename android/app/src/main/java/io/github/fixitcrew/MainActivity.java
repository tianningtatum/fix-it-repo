package io.github.fixitcrew;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

/** Host screen: starts the server and shows the host board (and the game, if the host plays too). */
public class MainActivity extends Activity {
    private WebView web;
    private TextView splash;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int tries = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#14161a"));

        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);

        Intent svc = new Intent(this, GameService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc); else startService(svc);

        splash = new TextView(this);
        splash.setText("Starting the game server…");
        splash.setTextColor(Color.WHITE);
        splash.setBackgroundColor(Color.parseColor("#14161a"));
        splash.setGravity(Gravity.CENTER);
        splash.setTextSize(18);
        setContentView(splash);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#14161a"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String h = u.getHost();
                if ("127.0.0.1".equals(h) || "localhost".equals(h)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        waitForServer();
    }

    private void waitForServer() {
        int port = GameService.runningPort();
        if (port > 0) {
            setContentView(web);
            web.loadUrl("http://127.0.0.1:" + port + "/host");
            return;
        }
        if (++tries > 60) { splash.setText("Couldn't start the game server. Close the app and open it again."); return; }
        handler.postDelayed(new Runnable() { public void run() { waitForServer(); } }, 150);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
