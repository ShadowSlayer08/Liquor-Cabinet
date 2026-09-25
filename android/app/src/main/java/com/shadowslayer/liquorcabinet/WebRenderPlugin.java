package com.shadowslayer.liquorcabinet;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Reads data off a web page that only answers a real browser. extract({ url, script, timeoutMs, pollMs })
 * loads `url` in an invisible, phone-sized WebView behind the app — the user's own connection, cookies
 * and (when the app has location permission) location — then runs `script` every `pollMs` until it
 * returns something non-empty, and resolves { result: string | null, timedOut, url }.
 * Used for live Blinkit prices: blinkit.com sits behind Cloudflare, which turns plain HTTP requests away.
 * One page at a time; the WebView is always torn down afterwards.
 * Called from src/lib/blinkitLive.js.
 */
@CapacitorPlugin(name = "WebRender")
public class WebRenderPlugin extends Plugin {

    /** One page being read. Only touched on the main thread. */
    private static final class Job {
        PluginCall call;
        WebView web;
        String script;
        int pollMs;
        boolean done;
        Runnable poll;
        Runnable timeout;
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private Job job;

    @PluginMethod
    public void extract(PluginCall call) {
        String url = call.getString("url");
        String script = call.getString("script");
        if (url == null || !url.startsWith("http") || script == null || script.isEmpty()) {
            call.reject("An http(s) url and a script are required");
            return;
        }
        int timeoutMs = Math.max(1000, call.getInt("timeoutMs", 20000));
        int pollMs = Math.max(200, call.getInt("pollMs", 700));
        main.post(() -> start(call, url, script, timeoutMs, pollMs));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void start(PluginCall call, String url, String script, int timeoutMs, int pollMs) {
        if (job != null) {
            call.reject("Already reading a page — try again in a moment", "BUSY");
            return;
        }
        Activity activity = getActivity();
        ViewGroup root = null;
        if (activity != null && !activity.isFinishing()) root = activity.findViewById(android.R.id.content);
        if (root == null) {
            call.reject("The app isn't on screen");
            return;
        }
        WebView web;
        try {
            web = new WebView(activity);
        } catch (RuntimeException e) { // e.g. the system WebView is being updated
            call.reject("WebView unavailable: " + e.getMessage());
            return;
        }

        Job j = new Job();
        j.call = call;
        j.web = web;
        j.script = script;
        j.pollMs = pollMs;
        j.poll = () -> poll(j);
        j.timeout = () -> finish(j, null, true, null);
        job = j;

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setBlockNetworkImage(true); // image URLs are enough — saves the user's data
        // The phone's own Chrome UA without the "; wv" WebView marker.
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Stay on the web page: never hand off to another app (intent://, market://, blinkit://…).
                String scheme = request.getUrl().getScheme();
                return !"http".equals(scheme) && !"https".equals(scheme);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) finish(j, null, false, "Page didn't load: " + error.getDescription());
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Handled, so a crashed page renderer doesn't take the whole app down with it.
                finish(j, null, false, "The page stopped responding");
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Only works when the app itself already has location permission.
                callback.invoke(origin, true, false);
            }

            // Nobody can see this page, so dismiss any dialog it tries to open.
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                result.cancel();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                result.cancel();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                result.cancel();
                return true;
            }

            @Override
            public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
                result.confirm();
                return true;
            }
        });

        // Lay the page out like a phone screen, behind the app and never drawn.
        DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        int w = root.getWidth() > 0 ? root.getWidth() : dm.widthPixels;
        int h = root.getHeight() > 0 ? root.getHeight() : dm.heightPixels;
        web.setVisibility(View.INVISIBLE);
        web.setFocusable(false);
        web.setFocusableInTouchMode(false);
        web.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        try {
            root.addView(web, 0, new FrameLayout.LayoutParams(w, h));
            main.postDelayed(j.timeout, timeoutMs);
            main.postDelayed(j.poll, pollMs);
            web.loadUrl(url);
        } catch (RuntimeException e) {
            finish(j, null, false, "Couldn't open the page: " + e.getMessage());
        }
    }

    /** Runs the script; the next run is scheduled up front, as a navigating page may never answer this one. */
    private void poll(Job j) {
        if (j.done) return;
        main.postDelayed(j.poll, j.pollMs);
        try {
            j.web.evaluateJavascript(j.script, value -> {
                String result = unquote(value);
                if (!j.done && hasData(result)) finish(j, result, false, null);
            });
        } catch (RuntimeException e) {
            finish(j, null, false, "Couldn't read the page: " + e.getMessage());
        }
    }

    /** Resolves or rejects exactly once, and always tears the WebView down. */
    private void finish(Job j, String result, boolean timedOut, String error) {
        if (j.done) return;
        j.done = true;
        if (job == j) job = null;
        main.removeCallbacks(j.poll);
        main.removeCallbacks(j.timeout);
        String finalUrl = null;
        try {
            finalUrl = j.web.getUrl();
        } catch (RuntimeException ignored) {
            // already gone
        }
        WebView web = j.web;
        // Destroy on the next loop turn, never inside one of the WebView's own callbacks.
        main.post(() -> destroy(web));
        try {
            if (error != null) {
                j.call.reject(error);
                return;
            }
            JSObject ret = new JSObject();
            ret.put("result", result == null ? JSONObject.NULL : result);
            ret.put("timedOut", timedOut);
            ret.put("url", finalUrl == null ? JSONObject.NULL : finalUrl);
            j.call.resolve(ret);
        } catch (RuntimeException ignored) {
            // the bridge is gone (app closing) — nobody is waiting any more
        }
    }

    private static void destroy(WebView web) {
        try {
            web.stopLoading();
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.removeAllViews();
            web.destroy();
        } catch (RuntimeException ignored) {
            // best effort
        }
    }

    /** evaluateJavascript hands the script's value back as JSON, so a string arrives quoted. */
    private static String unquote(String json) {
        if (json == null || json.isEmpty() || "null".equals(json)) return null;
        if (!json.startsWith("\"")) return json;
        try {
            return new JSONArray("[" + json + "]").getString(0);
        } catch (JSONException e) {
            return null;
        }
    }

    private static boolean hasData(String s) {
        if (s == null) return false;
        String t = s.trim();
        return !t.isEmpty() && !"null".equals(t) && !"[]".equals(t) && !"{}".equals(t) && !"\"\"".equals(t);
    }

    @Override
    protected void handleOnDestroy() {
        if (job != null) finish(job, null, false, "The app was closed");
    }
}
