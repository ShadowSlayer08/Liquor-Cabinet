// ═══════════════════════════════════════════════════════════════════════════════
//  SCRAPERS — the app's own code, no AI/API keys involved.
//  • Checks the IndexedDB cache first (liquor 7 days, Zomato 12 h, groceries 24 h)
//  • Only hits the network when stale/missing or on Force Refresh
// ═══════════════════════════════════════════════════════════════════════════════
import { getText, HttpError } from "./http.js";
import { store } from "./store.js";
import { parseCategoryHtml, categoryUrl } from "./parse/livcheers.js";
import { parseDishPage, dishUrl, searchUrl, zomatoCity } from "./parse/zomato.js";
import { parseSearch, dmartSearchUrl } from "./parse/dmart.js";
import { pickProducts } from "./food.js";

export const STALE_MS = 7 * 86400 * 1000;
const ZOMATO_TTL = 12 * 3600 * 1000;
const GROCERY_TTL = 24 * 3600 * 1000;

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
  await store.set(key, { items, fetchedAt });
  onLog(`✓ ${cat.label} — ${items.length} items (${Math.round(html.length / 1024)} KB, ${((fetchedAt - t0) / 1000).toFixed(1)}s)`, "ok");
  return { items, fromCache: false, fetchedAt };
}

// ── Zomato ───────────────────────────────────────────────────────────────────
export async function fetchDish(city, dish, { force = false } = {}) {
  const key = `zomato:${zomatoCity(city)}:${dish.id}`;
  if (!force) {
    const cached = await store.get(key);
    if (cached && Date.now() - cached.fetchedAt < ZOMATO_TTL) return { ...cached, fromCache: true };
  }
  const webUrl = dishUrl(city, dish.path);
  let result;
  try {
    const parsed = parseDishPage(await getText(webUrl, { timeout: 30000 }));
    if (!parsed) throw new Error("Zomato page format changed");
    result = { ...parsed, webUrl, fetchedAt: Date.now() };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      // Zomato has no page for this dish in this city — fall back to a search link.
      result = { restaurants: [], medianCostForOne: null, notFound: true, webUrl: searchUrl(city, dish.name), fetchedAt: Date.now() };
    } else throw e;
  }
  await store.set(key, result);
  return { ...result, fromCache: false };
}

// ── Groceries (DMart live prices, ordered on Blinkit) ────────────────────────
export async function fetchGrocery(grocery, { force = false } = {}) {
  if (!grocery.query) {
    return { products: [{ ...grocery.fallback, id: `${grocery.id}-est`, fallback: true, img: null }], live: false };
  }
  const key = `grocery:${grocery.id}`;
  if (!force) {
    const cached = await store.get(key);
    if (cached && Date.now() - cached.fetchedAt < GROCERY_TTL) return { ...cached, fromCache: true };
  }
  const json = JSON.parse(await getText(dmartSearchUrl(grocery.query, 12), { timeout: 20000 }));
  const products = pickProducts(grocery, parseSearch(json)).slice(0, 8);
  const result = { products, live: true, fetchedAt: Date.now() };
  if (products.length) await store.set(key, result);
  return { ...result, fromCache: false };
}
