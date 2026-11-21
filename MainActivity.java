package com.chessoffline.game;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;

/**
 * Hosts the whole game (assets/chess.html) in a WebView. Everything is bundled in the APK,
 * so the app works fully offline. The page talks to this class through the "Android" bridge.
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 4711;
    private static final String PAGE = "file:///android_asset/chess.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean immersive = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(android.R.color.black);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Offline app: never navigate away from the bundled page.
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(PAGE);

        applyImmersive(true);
        setHighRefresh(true, 0);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        // Let the page close dialogs / settings first; otherwise send the app to the background.
        web.evaluateJavascript("(window.__back ? window.__back() : false)", value -> {
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("if(window.saveGame)saveGame();", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        applyImmersive(immersive);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive(immersive);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Android");
            web.destroy();
        }
        super.onDestroy();
    }

    // ---------------------------------------------------------------- helpers

    private void applyImmersive(boolean on) {
        immersive = on;
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c == null) return;
            if (on) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
        } else {
            View d = w.getDecorView();
            if (on) {
                d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            } else {
                d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
        }
    }

    /** Ask the system for the highest refresh rate at (or below) the requested cap. 0 = no cap. */
    @SuppressWarnings("deprecation")
    private void setHighRefresh(boolean on, int capFps) {
        try {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            if (!on) {
                lp.preferredDisplayModeId = 0;
                lp.preferredRefreshRate = 0f;
                getWindow().setAttributes(lp);
                return;
            }
            Display display = getWindowManager().getDefaultDisplay();
            Display.Mode cur = display.getMode();
            Display.Mode best = null;
            float target = capFps > 0 ? capFps : 1000f;
            for (Display.Mode m : display.getSupportedModes()) {
                if (m.getPhysicalWidth() != cur.getPhysicalWidth()
                        || m.getPhysicalHeight() != cur.getPhysicalHeight()) continue;
                float r = m.getRefreshRate();
                if (best == null) { best = m; continue; }
                float br = best.getRefreshRate();
                boolean rOk = r <= target + 1f, bOk = br <= target + 1f;
                if (rOk && !bOk) best = m;
                else if (rOk && bOk && r > br) best = m;
                else if (!rOk && !bOk && r < br) best = m;
            }
            if (best != null) {
                lp.preferredDisplayModeId = best.getModeId();
                lp.preferredRefreshRate = best.getRefreshRate();
                getWindow().setAttributes(lp);
            }
        } catch (Throwable ignored) {
        }
    }

    // ----------------------------------------------------------- JS bridge

    private class Bridge {
        @JavascriptInterface
        public void vibrate(final int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                int len = Math.max(1, Math.min(ms, 300));
                v.vibrate(VibrationEffect.createOneShot(len, VibrationEffect.DEFAULT_AMPLITUDE));
            } catch (Throwable ignored) {
            }
        }

        @JavascriptInterface
        public void setOrientation(final String mode) {
            runOnUiThread(() -> {
                int o;
                switch (mode == null ? "" : mode) {
                    case "portrait": o = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT; break;
                    case "landscape": o = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE; break;
                    case "system": o = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED; break;
                    default: o = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR; break;
                }
                setRequestedOrientation(o);
            });
        }

        @JavascriptInterface
        public void setImmersive(final boolean on) {
            runOnUiThread(() -> applyImmersive(on));
        }

        @JavascriptInterface
        public void setKeepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void setHighRefresh(final boolean on, final int capFps) {
            runOnUiThread(() -> MainActivity.this.setHighRefresh(on, capFps));
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Share game"));
            });
        }

        @JavascriptInterface
        public void copy(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("chess", text));
            });
        }
    }
}
