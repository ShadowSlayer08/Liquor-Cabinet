package com.shadowslayer.liquorcabinet;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands orders off to Blinkit / Zomato: opens the link inside their Android app when it is
 * installed (e.g. zomato://order/123, https://blinkit.com/s/?q=soda), otherwise in the browser.
 * Called from src/lib/order.js.
 */
@CapacitorPlugin(name = "ExternalApp")
public class ExternalAppPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String pkg = call.getString("pkg");
        String fallback = call.getString("fallback");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        JSObject ret = new JSObject();
        if (pkg != null && tryStart(url, pkg)) {
            ret.put("opened", "app");
        } else if (url.startsWith("http") && tryStart(url, null)) {
            ret.put("opened", "browser");
        } else if (fallback != null && tryStart(fallback, null)) {
            ret.put("opened", "browser");
        } else {
            call.reject("No app can open " + url);
            return;
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String pkg = call.getString("pkg");
        boolean installed = false;
        if (pkg != null) {
            try {
                getContext().getPackageManager().getPackageInfo(pkg, 0);
                installed = true;
            } catch (PackageManager.NameNotFoundException ignored) {
                // not installed
            }
        }
        JSObject ret = new JSObject();
        ret.put("installed", installed);
        call.resolve(ret);
    }

    private boolean tryStart(String url, String pkg) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pkg != null) intent.setPackage(pkg);
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }
}
