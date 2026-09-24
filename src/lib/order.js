// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERING — hand-off to Zomato, Bistro and Blinkit.
//  None of them offers a public "add to cart" API, so the app:
//   1. opens the exact restaurant (Zomato), the Bistro app, or the product search
//      (Blinkit) — inside their Android apps when installed;
//   2. puts your order list on the clipboard; and
//   3. posts an "order checklist" notification you can pull down while you're
//      in their app, so every item and quantity comes along with you.
//  Native side: android/…/ExternalAppPlugin.java
// ═══════════════════════════════════════════════════════════════════════════════
import { registerPlugin } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "./http.js";

const ExternalApp = registerPlugin("ExternalApp");

export const BLINKIT = { name: "Blinkit", pkg: "com.grofers.customerapp", url: "https://blinkit.com/" };
export const ZOMATO = { name: "Zomato", pkg: "com.application.zomato", url: "https://www.zomato.com/" };
export const BISTRO = { name: "Bistro", pkg: "com.blinkit.bistro", url: "https://bistro.blinkit.com/" };

export const blinkitSearchUrl = (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`;

async function open(url, pkg, fallback) {
  if (isNative()) {
    try { return await ExternalApp.open({ url, pkg, fallback }); } catch (e) { console.warn("ExternalApp.open", e); }
  }
  window.open(url.startsWith("http") ? url : fallback || url, "_blank", "noopener");
  return { opened: "browser" };
}

// blinkit.com links are verified Android App Links for the Blinkit app.
export const openBlinkitSearch = (query) => open(blinkitSearchUrl(query), BLINKIT.pkg, blinkitSearchUrl(query));

// Opens the restaurant's menu in the Zomato app (zomato://order/<resId>) or its web order page.
export const openZomatoRestaurant = (r) => open(r.appLink || r.orderUrl, ZOMATO.pkg, r.orderUrl);
export const openZomatoUrl = (url) => open(url, ZOMATO.pkg, url);

// Launches the Bistro app (or bistro.blinkit.com when it isn't installed).
export async function openBistro() {
  if (isNative()) {
    try { return await ExternalApp.launch({ pkg: BISTRO.pkg, fallback: BISTRO.url }); } catch (e) { console.warn("ExternalApp.launch", e); }
  }
  window.open(BISTRO.url, "_blank", "noopener");
  return { opened: "browser" };
}

export const openUrl = (url) => open(url, null, url);

export async function isInstalled(app) {
  if (!isNative()) return false;
  try { return (await ExternalApp.isInstalled({ pkg: app.pkg })).installed; } catch { return false; }
}

// ── Order checklist notification ─────────────────────────────────────────────
export const CHECKLIST_IDS = { blinkit: 7001, bistro: 7002 };
export const zomatoChecklistId = (resId) => 7100 + (parseInt(String(resId).slice(-5), 10) % 800 || 0);

export async function postChecklist(id, title, lines, summary) {
  if (!isNative() || !lines.length) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return false;
    await LocalNotifications.schedule({
      notifications: [{
        id, title,
        body: lines.slice(0, 2).join(" · ") + (lines.length > 2 ? ` +${lines.length - 2} more` : ""),
        largeBody: lines.join("\n"),
        summaryText: summary,
        smallIcon: "ic_stat_liquor",
        iconColor: "#D4872A",
        autoCancel: false,
        extra: { tab: "cart" },
      }],
    });
    return true;
  } catch (e) {
    console.warn("postChecklist", e);
    return false;
  }
}

export async function clearChecklist(id) {
  if (!isNative()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
}

export function onChecklistTap(fn) {
  if (!isNative()) return () => {};
  const sub = LocalNotifications.addListener("localNotificationActionPerformed", (a) => fn(a.notification?.extra));
  return () => { sub.then((s) => s.remove()); };
}

// ── Share / clipboard / haptics ──────────────────────────────────────────────
export async function shareText(title, text) {
  try {
    if (isNative() || navigator.share) { await Share.share({ title, text, dialogTitle: title }); return "shared"; }
  } catch (e) {
    if (String(e?.message || e).toLowerCase().includes("cancel")) return "cancelled";
  }
  await copyText(text);
  return "copied";
}

export async function copyText(text) {
  try { await Clipboard.write({ string: text }); return true; } catch {}
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export const tap = () => { if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };
export const buzz = () => { if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); };
