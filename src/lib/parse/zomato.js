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

export const dishUrl = (citySlug, path) => `${ZOMATO_BASE}/${zomatoCity(citySlug)}/${path}`;
export const searchUrl = (citySlug, q) =>
  `${ZOMATO_BASE}/${zomatoCity(citySlug)}/delivery?q=${encodeURIComponent(q)}`;

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
