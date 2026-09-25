// ═══════════════════════════════════════════════════════════════════════════════
//  ZOMATO PARSER  (pure — unit-tested)
//
//  Zomato's city dish pages  /{city}/delivery/dish-{dish}  server-render a Redux
//  store:  window.__PRELOADED_STATE__ = JSON.parse("…").  Under
//  pages.search[<path>].sections.SECTION_SEARCH_RESULT is the list of
//  restaurants delivering that dish, each with rating, "₹200 for one", delivery
//  time, the web order URL and a zomato://order/<resId> app deeplink.
// ═══════════════════════════════════════════════════════════════════════════════

export const ZOMATO_BASE = "https://www.zomato.com";

// Livcheers city slug → Zomato city slug (NCR cities share one Zomato city).
const ZOMATO_CITY = {
  delhi: "ncr", gurgaon: "ncr", noida: "ncr", ghaziabad: "ncr", faridabad: "ncr",
  thane: "mumbai", "hubli-dharwad": "hubli",
};
export const zomatoCity = (citySlug) => ZOMATO_CITY[citySlug] || citySlug;

// `zCity` (from GPS, see lib/location.js) wins over the Livcheers city mapping.
export const dishUrl = (citySlug, path, zCity) => `${ZOMATO_BASE}/${zCity || zomatoCity(citySlug)}/${path}`;
export const searchUrl = (citySlug, q, zCity) =>
  `${ZOMATO_BASE}/${zCity || zomatoCity(citySlug)}/delivery?q=${encodeURIComponent(q)}`;

// "1.1 km" / "904 m" → metres (for sorting by distance)
export const parseDistance = (text) => {
  const m = String(text || "").replace(/,/g, "").match(/([\d.]+)\s*(km|m)\b/i);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === "km" ? 1000 : 1));
};

// Zomato image URLs accept resize params; ask for a small square thumbnail.
export const thumb = (url, px = 240) =>
  url ? `${url.split("?")[0]}?fit=around%7C${px}%3A${px}&crop=${px}%3A${px}%3B%2A%2C%2A` : null;

export function parsePreloadedState(html) {
  const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
  if (!m) return null;
  try { return JSON.parse(JSON.parse(m[1])); } catch { return null; }
}

// "₹1,350 for one" → 1350
export const parseRupees = (text) => {
  const m = String(text || "").replace(/,/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

function deeplinkFrom(clickActionDeeplink) {
  // https://link.zomato.com/…?deep_link_value=zomato%3A%2F%2Forder%2F123… → zomato://order/123…
  try {
    const u = new URL(clickActionDeeplink);
    const v = u.searchParams.get("deep_link_value");
    return v && v.startsWith("zomato://") ? v : null;
  } catch { return null; }
}

export function parseDishPage(html) {
  const state = parsePreloadedState(html);
  const search = state?.pages?.search;
  if (!search) return null;
  const key = Object.keys(search).find((k) => search[k]?.sections?.SECTION_SEARCH_RESULT);
  if (!key) return null;
  const sec = search[key].sections;

  const restaurants = [];
  for (const card of sec.SECTION_SEARCH_RESULT || []) {
    const info = card?.info;
    if (!info?.resId || !info?.name) continue;
    const orderPath = card.order?.actionInfo?.clickUrl || card.cardAction?.clickUrl || "";
    const costForOne = parseRupees(info.cfo?.text) ?? (parseRupees(info.cft?.text) ? Math.round(parseRupees(info.cft.text) / 2) : null);
    restaurants.push({
      resId: String(info.resId),
      name: info.name,
      img: info.image?.url || null,
      rating: parseFloat(info.rating?.aggregate_rating) || null,
      votes: info.rating?.votes || null,
      costForOne,
      costText: info.cfo?.text || info.cft?.text || "",
      locality: info.locality?.name || "",
      cuisines: (info.cuisine || []).map((c) => c.name).filter(Boolean),
      deliveryTime: card.order?.deliveryTime || "",
      serviceable: card.order?.isServiceable !== false && card.order?.hasOnlineOrdering !== false,
      distance: card.distance || "",
      meters: parseDistance(card.distance),
      orderUrl: orderPath ? ZOMATO_BASE + orderPath.split("?")[0] : null,
      appLink: deeplinkFrom(card.cardAction?.clickActionDeeplink) || `zomato://order/${info.resId}`,
    });
  }

  const costs = restaurants.map((r) => r.costForOne).filter(Boolean).sort((a, b) => a - b);
  return {
    heading: sec.SECTION_BASIC_INFO?.pageHeading || "",
    appSearchLink: sec.SECTION_APP_DEEPLINK?.deeplink || null,
    restaurants,
    medianCostForOne: costs.length ? costs[Math.floor(costs.length / 2)] : null,
  };
}

// ── Restaurant menu  (/{city}/{restaurant}/order) ─────────────────────────────
// Items come with names, photos and veg tags. Zomato hides item prices from
// logged-out visitors (order.price_login_blocker), so the planner prices dishes
// with the restaurant's "cost for one" and Zomato shows the exact price at checkout.
// Signed in (Plan → Zomato account, beta) items should carry a price; which
// field it lives in couldn't be checked, so the usual candidates are tried in turn.

// 240 / "₹240" / "240.00" / "₹1,240" → 240 / 240 / 240 / 1240; 0, null or junk → null
export const menuPrice = (v) => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  const n = m ? parseFloat(m[0]) : 0;
  return n > 0 ? n : null;
};
const itemPrice = (it) => [it.price, it.display_price, it.min_price, it.default_price].map(menuPrice).find((p) => p != null) ?? null;

// A menu counts as exactly priced when Zomato didn't block prices and at least one item has one.
export const hasExactPrices = (menu) => !!menu && !menu.pricesHidden && (menu.menus || []).some((s) => s.items.some((i) => i.price));

export function parseMenuPage(html) {
  const state = parsePreloadedState(html);
  const pages = state?.pages?.restaurant;
  if (!pages) return null;
  const key = Object.keys(pages).find((k) => pages[k]?.order?.menuList);
  if (!key) return null;
  const r = pages[key], sec = r.sections || {}, bi = sec.SECTION_BASIC_INFO || {};
  const menus = [];
  for (const m of r.order.menuList.menus || []) {
    const items = [];
    for (const c of m.menu?.categories || []) {
      for (const w of c.category?.items || []) {
        const it = w?.item;
        if (!it?.id || !it.name) continue;
        const tags = it.tag_slugs || [], diet = it.dietary_slugs || [];
        items.push({
          id: String(it.id),
          name: String(it.name).trim(),
          desc: it.desc || "",
          img: it.item_image_url || it.media?.find((x) => x.mediaType === "image")?.image?.url?.split("?")[0] || null,
          veg: diet.includes("veg") ? true : diet.includes("non-veg") ? false : null,
          spicy: tags.includes("sf-spicy"),
          top: tags.includes("rating_4"),
          price: itemPrice(it),
        });
      }
    }
    if (items.length) menus.push({ id: String(m.menu?.id || menus.length), name: m.menu?.name || "Menu", items });
  }
  const delivery = bi.rating_new?.ratings?.DELIVERY || {};
  return {
    resId: String(bi.res_id || key),
    name: bi.name || "",
    cuisines: bi.cuisine_string || "",
    img: bi.res_thumb || null,
    rating: parseFloat(delivery.rating) || null,
    reviews: delivery.reviewCount || null,
    timing: bi.timing?.timing_desc || "",
    locality: sec.SECTION_RES_HEADER_DETAILS?.LOCALITY?.text || "",
    closed: !!(bi.is_perm_closed || bi.is_temp_closed),
    pricesHidden: !!r.order.price_login_blocker,
    menus,
  };
}
