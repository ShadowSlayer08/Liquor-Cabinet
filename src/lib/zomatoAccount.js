// ═══════════════════════════════════════════════════════════════════════════════
//  ZOMATO ACCOUNT (beta) — exact menu prices.
//  Zomato hides item prices from logged-out visitors (order.price_login_blocker).
//  The user signs in once on zomato.com inside an in-app web view that shares the
//  app's cookie store — `isIsolated: false` is essential: by default the web view
//  runs in its own process with its own cookie jar and the login never reaches
//  native requests. From then on every menu fetched through lib/http.js carries
//  the session. Never verified with a real Zomato account, hence "beta".
// ═══════════════════════════════════════════════════════════════════════════════
import { CapacitorCookies } from "@capacitor/core";
import { InAppBrowser, DefaultWebViewOptions, DefaultAndroidWebViewOptions } from "@capacitor/inappbrowser";
import { isNative } from "./http.js";
import { store } from "./store.js";
import { fetchMenu } from "./sources.js";
import { ZOMATO_BASE, hasExactPrices } from "./parse/zomato.js";

// { at } — the user went through sign-in but no priced menu has confirmed it yet.
const PENDING = "zomatoSignin";
export const pendingSignIn = async () => (await store.get(PENDING))?.at || null;
export const clearPending = () => store.del(PENDING);

// Opens zomato.com in-app. `onClosed` runs once, when the user taps Done.
// Returns a function that stops listening (e.g. when the card unmounts).
export async function openZomatoSignIn(onClosed) {
  let handle = null, done = false;
  const stop = () => { done = true; handle?.remove(); handle = null; };
  handle = await InAppBrowser.addListener("browserClosed", () => { if (!done) { stop(); onClosed(); } });
  await store.set(PENDING, { at: Date.now() });
  try {
    await InAppBrowser.openInWebView({
      url: `${ZOMATO_BASE}/`,
      options: {
        ...DefaultWebViewOptions,
        showURL: false, closeButtonText: "Done", clearCache: false, clearSessionCache: false,
        android: { ...DefaultAndroidWebViewOptions, isIsolated: false },
      },
    });
  } catch (e) {
    stop();
    await clearPending();
    throw e;
  }
  return stop;
}

// A restaurant to test with: one in the food cart, else the newest cached Zomato dish search.
export async function knownRestaurant(foodCart) {
  const inCart = (foodCart || []).find((l) => l.kind === "zomato" && l.restaurant?.resId && l.restaurant.orderUrl);
  if (inCart) return inCart.restaurant;
  let best = null;
  for (const k of await store.list("zomato:")) {
    const d = await store.get(k);
    const r = d?.restaurants?.find((x) => x.resId && x.orderUrl);
    if (r && (!best || (d.fetchedAt || 0) > best.at)) best = { r, at: d.fetchedAt || 0 };
  }
  return best?.r || null;
}

// Force-fetches one menu: true = priced (signed in), false = prices still hidden.
export async function checkExactPrices(restaurant, loc) {
  return hasExactPrices(await fetchMenu(restaurant, { force: true, loc }));
}

// Did any menu opened since `at` (e.g. from the Food tab) come back priced?
export async function pricedSince(at) {
  for (const k of await store.list("menu:")) {
    const m = await store.get(k);
    if (m?.fetchedAt >= at && hasExactPrices(m)) return true;
  }
  return false;
}

// Cached menus belong to the previous session (prices hidden or shown) — refetch on next open.
export async function dropCachedMenus() {
  for (const k of await store.list("menu:")) await store.del(k);
}

export async function signOutOfZomato() {
  if (isNative()) {
    // clearCookies only expires host cookies, so a login set on ".zomato.com" would survive it —
    // and getCookies can't tell (it reads the app's own document.cookie, whatever the url).
    // The app keeps no other logins (Zomato's location cookies are rewritten on every request;
    // Blinkit just asks for your location again), so clear the whole jar.
    await CapacitorCookies.clearCookies({ url: ZOMATO_BASE }).catch(() => {});
    await CapacitorCookies.clearAllCookies();
  }
  await dropCachedMenus();
  await clearPending();
}
