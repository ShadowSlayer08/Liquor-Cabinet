// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERING — hand-off to the Blinkit and Zomato apps.
//  Neither service has a public ordering API, so the app opens the exact
//  restaurant (Zomato) or product search (Blinkit) in their Android app when
//  it's installed, or on their website otherwise. The native side is
//  android/…/ExternalAppPlugin.java.
// ═══════════════════════════════════════════════════════════════════════════════
import { registerPlugin } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { isNative } from "./http.js";

const ExternalApp = registerPlugin("ExternalApp");

export const BLINKIT = { name: "Blinkit", pkg: "com.grofers.customerapp", color: "#f8cb46", ink: "#0c831f" };
export const ZOMATO = { name: "Zomato", pkg: "com.application.zomato", color: "#e23744", ink: "#fff" };

export const blinkitSearchUrl = (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`;

async function open(url, pkg, fallback) {
  if (isNative()) {
    try { return await ExternalApp.open({ url, pkg, fallback }); } catch (e) { console.warn("ExternalApp.open", e); }
  }
  window.open(url.startsWith("http") ? url : fallback || url, "_blank", "noopener");
  return { opened: "browser" };
}

export const openBlinkitSearch = (query) => open(blinkitSearchUrl(query), BLINKIT.pkg, blinkitSearchUrl(query));

// Opens the restaurant's menu in the Zomato app (zomato://order/<resId>) or its web order page.
export const openZomatoRestaurant = (r) => open(r.appLink || r.orderUrl, ZOMATO.pkg, r.orderUrl);

export const openZomatoUrl = (url) => open(url, ZOMATO.pkg, url);

export const openUrl = (url) => open(url, null, url);

export async function isInstalled(app) {
  if (!isNative()) return false;
  try { return (await ExternalApp.isInstalled({ pkg: app.pkg })).installed; } catch { return false; }
}

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
