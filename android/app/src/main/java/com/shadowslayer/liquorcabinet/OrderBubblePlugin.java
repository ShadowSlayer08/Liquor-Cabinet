package com.shadowslayer.liquorcabinet;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Application;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Insets;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowMetrics;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

/**
 * The order checklist as a floating bubble over Zomato / Bistro / Blinkit ("display over other apps"),
 * so items can be ticked off while you add them — no pulling down the notification shade.
 * A draggable gold bubble shows how many items are left; tap it for the list (tap a line to tick it),
 * "Back to Liquor Cabinet", collapse, or ✕ to close. While Liquor Cabinet itself is on screen the
 * bubble stays hidden; it comes back when you switch to another app.
 * canDraw() → { granted } · requestPermission() → { opened } · show({ title, lines, done? }) · hide().
 * Emits "toggle" { index, done } when a line is ticked. Called from src/lib/bubble.js.
 */
@CapacitorPlugin(name = "OrderBubble")
public class OrderBubblePlugin extends Plugin {

    // The app's palette (src/styles.css).
    private static final int GOLD_HI = 0xFFFBE29A, GOLD = 0xFFEAA447, GOLD_LO = 0xFFB9651B, INK = 0xFF231404;
    private static final int PANEL = 0xFF171012, TEXT = 0xFFF8F0E3, SOFT = 0xFFDCCFBB, MUTED = 0xFFA39581, DIM = 0xFF74685A;
    private static final int TITLE = 0xFFF8D77A, BORDER = 0x99E7A846, STROKE = 0x29FFF4E1, GLASS = 0x13FFFFFF;
    private static final int GREEN = 0xFF34D98F, GREEN_INK = 0xFF0B1B12;
    private static final int BUBBLE_DP = 56, CARD_DP = 300, PAD_DP = 6;

    private final Handler main = new Handler(Looper.getMainLooper());

    // Everything below is touched on the main thread only.
    private String title = "";
    private String[] lines = new String[0];
    private boolean[] done = new boolean[0];
    private boolean wanted;             // show() was called and the bubble hasn't been closed
    private boolean appInFront = true;  // one of Liquor Cabinet's screens is showing → keep the bubble hidden
    // Started activities of this app — MainActivity, but also screens it opens on top of itself
    // (e.g. the in-app browser for the Zomato sign-in), which would otherwise count as "another app".
    private final Set<Activity> started = new HashSet<>();
    private Application.ActivityLifecycleCallbacks lifecycle;
    private boolean expanded;
    private int bubbleX = -1, bubbleY = -1; // where the collapsed bubble sits (kept across show() calls)

    private WindowManager wm;
    private WindowManager.LayoutParams params;
    private FrameLayout root;
    private View bubble;
    private TextView count, countLabel;
    private LinearLayout card, list;
    private TextView titleView, subtitle;

    // ── Plugin API ───────────────────────────────────────────────────────────

    @PluginMethod
    public void canDraw(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    /** Opens Android's "Display over other apps" screen. JS re-checks canDraw() when the app resumes. */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        boolean opened;
        try {
            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(intent);
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            opened = true;
        } catch (ActivityNotFoundException | SecurityException e) {
            opened = false;
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    /** Shows the checklist, or replaces what it lists (the bubble keeps its place on screen). */
    @PluginMethod
    public void show(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("Display over other apps isn't allowed for Liquor Cabinet", "NO_PERMISSION");
            return;
        }
        String t = call.getString("title", "Your order");
        JSArray ls = call.getArray("lines", new JSArray());
        JSArray ds = call.getArray("done", new JSArray());
        String[] newLines = new String[ls.length()];
        boolean[] newDone = new boolean[ls.length()];
        for (int i = 0; i < newLines.length; i++) {
            newLines[i] = ls.optString(i, "");
            newDone[i] = ds.optBoolean(i, false);
        }
        main.post(() -> {
            title = t == null ? "" : t;
            lines = newLines;
            done = newDone;
            wanted = true;
            try {
                sync();
                render();
                call.resolve();
            } catch (RuntimeException e) {
                call.reject("Couldn't show the checklist: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        main.post(() -> {
            wanted = false;
            detach();
            call.resolve();
        });
    }

    // Hidden while any Liquor Cabinet screen is visible, back as soon as another app takes over.
    @Override
    public void load() {
        lifecycle = new Application.ActivityLifecycleCallbacks() {
            @Override public void onActivityStarted(Activity a) { started.add(a); frontChanged(); }
            @Override public void onActivityStopped(Activity a) { started.remove(a); frontChanged(); }
            @Override public void onActivityDestroyed(Activity a) { started.remove(a); frontChanged(); }
            @Override public void onActivityCreated(Activity a, Bundle b) {}
            @Override public void onActivityResumed(Activity a) {}
            @Override public void onActivityPaused(Activity a) {}
            @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
        };
        getActivity().getApplication().registerActivityLifecycleCallbacks(lifecycle);
    }

    @Override
    protected void handleOnStart() { // covers a plugin loaded after MainActivity had already started
        started.add(getActivity());
        frontChanged();
    }

    private void frontChanged() {
        appInFront = !started.isEmpty();
        sync();
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        detach();
        if (lifecycle != null) getActivity().getApplication().unregisterActivityLifecycleCallbacks(lifecycle);
        lifecycle = null;
        started.clear();
    }

    // ── Window ───────────────────────────────────────────────────────────────

    private void sync() {
        if (wanted && !appInFront && Settings.canDrawOverlays(getContext())) attach();
        else detach();
    }

    @SuppressWarnings("deprecation")
    private static int overlayType() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private void attach() {
        if (root != null) return;
        Context ctx = getContext().getApplicationContext();
        wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        build(ctx);
        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        int[] f = frame();
        if (bubbleX < 0 || bubbleY < 0) {
            bubbleX = f[0] - dp(BUBBLE_DP + PAD_DP * 2);
            bubbleY = f[1] / 3;
        }
        params.x = Math.max(0, Math.min(bubbleX, f[0] - dp(BUBBLE_DP + PAD_DP * 2)));
        params.y = Math.max(0, Math.min(bubbleY, f[1] - dp(BUBBLE_DP + PAD_DP * 2)));
        expanded = false;
        showExpanded(false);
        render();
        try {
            wm.addView(root, params);
        } catch (RuntimeException e) { // permission revoked meanwhile, or no window token
            clearViews();
        }
    }

    private void detach() {
        if (root == null) return;
        try {
            wm.removeView(root);
        } catch (RuntimeException ignored) {
            // already removed
        }
        clearViews();
    }

    private void clearViews() {
        root = null;
        bubble = null;
        count = countLabel = titleView = subtitle = null;
        card = list = null;
        expanded = false;
    }

    private void relayout() {
        if (root == null) return;
        try {
            wm.updateViewLayout(root, params);
        } catch (RuntimeException ignored) {
            // window already gone
        }
    }

    // ── Views (built in code, styled like the app) ───────────────────────────

    private void build(Context ctx) {
        root = new FrameLayout(ctx);
        root.setPadding(dp(PAD_DP), dp(PAD_DP), dp(PAD_DP), dp(PAD_DP));
        root.setClipToPadding(false);

        // Collapsed: gold bubble with the number of items still to add.
        LinearLayout b = new LinearLayout(ctx);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setGravity(Gravity.CENTER);
        GradientDrawable gold = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { GOLD_HI, GOLD, GOLD_LO });
        gold.setShape(GradientDrawable.OVAL);
        b.setBackground(gold);
        b.setElevation(dp(4));
        count = text(ctx, "", 20, INK, Typeface.DEFAULT_BOLD);
        count.setIncludeFontPadding(false);
        countLabel = text(ctx, "", 9, 0xB3231404, Typeface.DEFAULT_BOLD);
        countLabel.setIncludeFontPadding(false);
        b.addView(count);
        b.addView(countLabel);
        b.setContentDescription("Order checklist");
        b.setOnClickListener(v -> showExpanded(true));
        b.setOnTouchListener(new Drag(true));
        bubble = b;
        root.addView(b, new FrameLayout.LayoutParams(dp(BUBBLE_DP), dp(BUBBLE_DP)));

        // Expanded: the checklist card.
        DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        int cardW = Math.min(dp(CARD_DP), dm.widthPixels - dp(PAD_DP * 2 + 16));
        LinearLayout c = new LinearLayout(ctx);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(rounded(PANEL, 20, BORDER));
        c.setElevation(dp(8));
        c.setPadding(dp(14), dp(12), dp(14), dp(14));

        LinearLayout head = new LinearLayout(ctx); // drag the card by its header
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setOnTouchListener(new Drag(false));
        LinearLayout titles = new LinearLayout(ctx);
        titles.setOrientation(LinearLayout.VERTICAL);
        titleView = text(ctx, "", 16, TITLE, Typeface.create(Typeface.SERIF, Typeface.BOLD));
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        subtitle = text(ctx, "", 11, MUTED, Typeface.DEFAULT);
        titles.addView(titleView);
        titles.addView(subtitle);
        head.addView(titles, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        head.addView(iconButton(ctx, "–", "Collapse", v -> showExpanded(false)), square(30, 8));
        head.addView(iconButton(ctx, "✕", "Close checklist", v -> {
            wanted = false;
            detach();
        }), square(30, 6));
        c.addView(head);

        int maxListH = dm.heightPixels * 45 / 100;
        ScrollView scroll = new ScrollView(ctx) {
            @Override
            protected void onMeasure(int widthSpec, int heightSpec) {
                super.onMeasure(widthSpec, MeasureSpec.makeMeasureSpec(maxListH, MeasureSpec.AT_MOST));
            }
        };
        scroll.setVerticalScrollBarEnabled(false);
        list = new LinearLayout(ctx);
        list.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(list);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        scrollLp.topMargin = dp(8);
        c.addView(scroll, scrollLp);

        TextView back = text(ctx, "Back to Liquor Cabinet", 14, INK, Typeface.DEFAULT_BOLD);
        back.setGravity(Gravity.CENTER);
        GradientDrawable pill = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { GOLD_HI, GOLD, GOLD_LO });
        pill.setCornerRadius(dp(14));
        back.setBackground(pill);
        back.setPadding(dp(12), dp(11), dp(12), dp(11));
        back.setOnClickListener(v -> openApp());
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        backLp.topMargin = dp(10);
        c.addView(back, backLp);

        card = c;
        root.addView(c, new FrameLayout.LayoutParams(cardW, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    /** Fills in the title, the count and the lines. */
    private void render() {
        if (root == null) return;
        int left = 0;
        for (boolean d : done) if (!d) left++;
        count.setText(left > 0 ? String.valueOf(left) : "✓");
        countLabel.setText(left > 0 ? "to add" : "done");
        titleView.setText(title);
        subtitle.setText(lines.length == 0 ? "Nothing on the list" : left == 0 ? "All ticked off 🎉" : left + " of " + lines.length + " left · tap to tick");

        Context ctx = list.getContext();
        list.removeAllViews();
        for (int i = 0; i < lines.length; i++) {
            final int index = i;
            LinearLayout row = new LinearLayout(ctx);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(8), 0, dp(8));
            row.setOnClickListener(v -> toggle(index));
            row.setContentDescription((done[i] ? "Done: " : "To add: ") + lines[i]);

            TextView box = text(ctx, done[i] ? "✓" : "", 13, GREEN_INK, Typeface.DEFAULT_BOLD);
            box.setGravity(Gravity.CENTER);
            box.setBackground(done[i] ? rounded(GREEN, 7, GREEN) : rounded(Color.TRANSPARENT, 7, STROKE));
            row.addView(box, square(22, 0));

            TextView label = text(ctx, lines[i], 14, done[i] ? DIM : TEXT, Typeface.DEFAULT);
            int flags = label.getPaintFlags();
            label.setPaintFlags(done[i] ? flags | Paint.STRIKE_THRU_TEXT_FLAG : flags & ~Paint.STRIKE_THRU_TEXT_FLAG);
            LinearLayout.LayoutParams labelLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            labelLp.leftMargin = dp(10);
            row.addView(label, labelLp);
            list.addView(row);
        }
    }

    private void toggle(int index) {
        if (index < 0 || index >= done.length) return;
        done[index] = !done[index];
        render();
        JSObject ev = new JSObject();
        ev.put("index", index);
        ev.put("done", done[index]);
        notifyListeners("toggle", ev);
    }

    /** Swaps bubble ↔ card; the card opens where the bubble is, kept on screen, and closes back to it. */
    private void showExpanded(boolean on) {
        if (root == null) return;
        if (on && !expanded) {
            bubbleX = params.x;
            bubbleY = params.y;
            int cardW = card.getLayoutParams().width + dp(PAD_DP * 2);
            params.x = Math.max(0, Math.min(params.x, frame()[0] - cardW));
        } else if (!on && expanded) {
            params.x = bubbleX;
            params.y = bubbleY;
        }
        expanded = on;
        bubble.setVisibility(on ? View.GONE : View.VISIBLE);
        card.setVisibility(on ? View.VISIBLE : View.GONE);
        relayout();
    }

    private void openApp() {
        Context ctx = getContext().getApplicationContext();
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            try {
                ctx.startActivity(launch);
            } catch (RuntimeException ignored) {
                // nothing sensible to do from an overlay
            }
        }
        showExpanded(false);
    }

    /** Moves the window with the finger; a touch that stays within the touch slop is a tap (performClick). */
    private final class Drag implements View.OnTouchListener {
        private final boolean snap;
        private final int slop;
        private float downX, downY;
        private int startX, startY;
        private boolean dragging;

        Drag(boolean snapToEdge) {
            snap = snapToEdge;
            slop = ViewConfiguration.get(getContext()).getScaledTouchSlop();
        }

        @SuppressLint("ClickableViewAccessibility")
        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (root == null || params == null) return false;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downX = e.getRawX();
                    downY = e.getRawY();
                    // Android keeps the window on screen even when params point past the edge; start from where it really is.
                    startX = clampX(params.x);
                    startY = clampY(params.y);
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (!dragging && Math.hypot(dx, dy) > slop) dragging = true;
                    if (dragging) moveTo(startX + Math.round(dx), startY + Math.round(dy));
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!dragging) v.performClick();
                    else if (snap) snapToEdge();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    return true;
                default:
                    return false;
            }
        }
    }

    /**
     * Width and height of the area Android lays the overlay out in: the screen minus the status and
     * navigation bars (the window's default fitInsetsTypes). params.x/y are relative to it.
     */
    private int[] frame() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && wm != null) {
            WindowMetrics m = wm.getCurrentWindowMetrics();
            Insets i = m.getWindowInsets().getInsets(WindowInsets.Type.systemBars());
            return new int[] { m.getBounds().width() - i.left - i.right, m.getBounds().height() - i.top - i.bottom };
        }
        // Before Android 11 the display metrics already leave out the navigation bar, not the status bar.
        DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
        int id = getContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
        int status = id > 0 ? getContext().getResources().getDimensionPixelSize(id) : 0;
        return new int[] { dm.widthPixels, dm.heightPixels - status };
    }

    private int clampX(int x) {
        return Math.max(0, Math.min(x, frame()[0] - root.getWidth()));
    }

    private int clampY(int y) {
        return Math.max(0, Math.min(y, frame()[1] - root.getHeight()));
    }

    private void moveTo(int x, int y) {
        params.x = clampX(x);
        params.y = clampY(y);
        if (!expanded) {
            bubbleX = params.x;
            bubbleY = params.y;
        }
        relayout();
    }

    /** A dropped bubble settles against the nearer side of the screen. */
    private void snapToEdge() {
        int w = root.getWidth(), fw = frame()[0];
        moveTo(params.x + w / 2 < fw / 2 ? 0 : fw - w, params.y);
    }

    // ── Small view helpers ───────────────────────────────────────────────────

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getContext().getResources().getDisplayMetrics()));
    }

    private static TextView text(Context ctx, String s, float sp, int color, Typeface face) {
        TextView t = new TextView(ctx);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setTypeface(face);
        return t;
    }

    private GradientDrawable rounded(int fill, float radiusDp, int stroke) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radiusDp));
        d.setStroke(Math.max(1, dp(1.5f)), stroke);
        return d;
    }

    private TextView iconButton(Context ctx, String label, String description, View.OnClickListener onClick) {
        TextView t = text(ctx, label, 15, SOFT, Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setBackground(rounded(GLASS, 10, STROKE));
        t.setContentDescription(description);
        t.setOnClickListener(onClick);
        return t;
    }

    private LinearLayout.LayoutParams square(int sizeDp, int leftMarginDp) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
        lp.leftMargin = dp(leftMarginDp);
        return lp;
    }
}
