// ═══════════════════════════════════════════════════════════════════════════════
//  SCRAPERS — the app's own code, no AI/API keys involved.
//  • Checks the IndexedDB cache first (liquor 7 days, Zomato 12 h)
//  • Only hits the network when stale/missing or on Force Refresh
//  • Each fresh Livcheers scrape is diffed with the last one (lib/pricehist.js)
// ═══════════════════════════════════════════════════════════════════════════════
import { getText, HttpError } from "./http.js";
import { store } from "./store.js";
import { parseCategoryHtml, categoryUrl } from "./parse/livcheers.js";
import { parseDishPage, parseMenuPage, dishUrl, searchUrl, zomatoCity } from "./parse/zomato.js";
import { zomatoCookie } from "./location.js";
import { applyPriceHistory, histKey } from "./pricehist.js";

export const STALE_MS = 7 * 86400 * 1000;
const ZOMATO_TTL = 12 * 3600 * 1000;
const MENU_TTL = 6 * 3600 * 1000;

// ── Livcheers ────────────────────────────────────────────────────────────────
export const priceKey = (city, catId) => `price:${city}:${catId}`;

export async function loadCachedCatalog(city, cats) {
  const catalog = {}, ages = {};
  for (const cat of cats) {
    const cached = await store.get(priceKey(city, cat.id));
    if (cached?.items?.length) { catalog[cat.id] = cached.items; ages[cat.id] = cached.fetchedAt; }
  }
  return { catalog, ages };
}

export async function scrapeCategory(city, cat, onLog, force = false) {
  const key = priceKey(city, cat.id);
  if (!force) {
    const cached = await store.get(key);
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
      const h = Math.round((Date.now() - cached.fetchedAt) / 3600000);
      onLog(`✓ ${cat.label} — cache hit (${h}h old, ${cached.items.length} items)`, "ok");
      return { items: cached.items, fromCache: true, fetchedAt: cached.fetchedAt };
    }
  }

  const url = categoryUrl(city, cat);
  onLog(`⟳ ${cat.label} — GET ${url.replace("https://www.", "")}`, "pending");
  const t0 = Date.now();
  let html;
  try {
    html = await getText(url, { timeout: 45000 });
  } catch (e) {
    throw new Error(e instanceof HttpError ? `Livcheers returned ${e.status}` : `Network error: ${e.message}`);
  }
  const items = parseCategoryHtml(html, city);
  if (!items.length) {
    onLog(`  ⚠ ${cat.label} — page loaded (${Math.round(html.length / 1024)} KB) but no products found`, "warn");
    return { items: [], fromCache: false, fetchedAt: Date.now() };
  }
  const fetchedAt = Date.now();
  // Diff against the previous sync → price-drop badges + a short per-bottle history.
  const hk = histKey(city, cat.id);
  const diff = applyPriceHistory(items, await store.get(key), await store.get(hk), fetchedAt);
  await store.set(key, { items: diff.items, fetchedAt });
  await store.set(hk, diff.hist);
  const moved = diff.items.filter((it) => it.priceChangedAt === fetchedAt).length;
  onLog(`✓ ${cat.label} — ${items.length} items (${Math.round(html.length / 1024)} KB, ${((fetchedAt - t0) / 1000).toFixed(1)}s)${moved ? ` · ${moved} price change${moved > 1 ? "s" : ""}` : ""}`, "ok");
  return { items: diff.items, fromCache: false, fetchedAt };
}

// ── Zomato ───────────────────────────────────────────────────────────────────
// `loc` (lib/location.js) localises results to the user's delivery zone.
export async function fetchDish(city, dish, { force = false, loc = null } = {}) {
  const zCity = loc?.zomato?.city || zomatoCity(city);
  const zone = loc?.zomato?.entityId || "city";
  const key = `zomato:${zCity}:${zone}:${dish.id}`;
  if (!force) {
    const cached = await store.get(key);
    if (cached && Date.now() - cached.fetchedAt < ZOMATO_TTL) return { ...cached, fromCache: true };
  }
  const webUrl = dishUrl(city, dish.path, zCity);
  let result;
  try {
    const parsed = parseDishPage(await getText(webUrl, { timeout: 30000, cookie: zomatoCookie(loc) }));
    if (!parsed) throw new Error("Zomato page format changed");
    result = { ...parsed, webUrl, local: !!loc?.zomato, fetchedAt: Date.now() };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      // Zomato has no page for this dish in this city — fall back to a search link.
      result = { restaurants: [], medianCostForOne: null, notFound: true, webUrl: searchUrl(city, dish.name, zCity), fetchedAt: Date.now() };
    } else throw e;
  }
  await store.set(key, result);
  // Remember a photo for the dish tile.
  const photo = result.restaurants?.find((r) => r.img)?.img;
  if (photo) store.set(`dishphoto:${dish.id}`, photo);
  return { ...result, fromCache: false };
}

export async function fetchMenu(restaurant, { force = false, loc = null } = {}) {
  const key = `menu:${restaurant.resId}`;
  if (!force) {
    const cached = await store.get(key);
    if (cached && Date.now() - cached.fetchedAt < MENU_TTL) return { ...cached, fromCache: true };
  }
  if (!restaurant.orderUrl) throw new Error("No Zomato menu link for this restaurant");
  const menu = parseMenuPage(await getText(restaurant.orderUrl, { timeout: 30000, cookie: zomatoCookie(loc) }));
  if (!menu || !menu.menus.length) throw new Error("Couldn't read this restaurant's menu");
  const result = { ...menu, fetchedAt: Date.now() };
  await store.set(key, result);
  return { ...result, fromCache: false };
}

export async function dishPhotos(dishes) {
  const out = {};
  for (const d of dishes) { const p = await store.get(`dishphoto:${d.id}`); if (p) out[d.id] = p; }
  return out;
}
