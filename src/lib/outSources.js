// ═══════════════════════════════════════════════════════════════════════════════
//  OUT SOURCES — fetch + cache for the Out tab (v1.5). Plain GETs of public pages,
//  one per tap, through lib/http.js getText(); cached in IndexedDB (lib/store.js):
//    out:list:<kind>:<zcity>:<zone>  Zomato bars / BYOB list   12 h
//    dv:<zcity>/<slug>               District venue page        6 h
//    ev:list:<genre>:<cityKey>[:wk]  District event listing     3 h
//    ev:<slug>                       District event page        1 h
//  Never District's JSON gateway, no query strings, no prefetching, no images:
//  every URL comes from a builder in lib/parse/district.js or the Zomato city path,
//  and slugs are checked before they go into one. Offers and "N slots left" move
//  during the day, so the sheets show when a page was read ("as of 7:40 PM").
// ═══════════════════════════════════════════════════════════════════════════════
import { getText, HttpError } from "./http.js";
import { store } from "./store.js";
import { zomatoCookie } from "./location.js";
import { OUT_KIND } from "./outModel.js";
import { ZOMATO_BASE, zomatoCity, parseVenueListPage, isVenueList } from "./parse/zomato.js";
import { venueUrl, bookUrl, eventUrl, eventListUrls, EVENT_CITY, parseVenuePage, parseEventList, parseEventPage } from "./parse/district.js";

const H = 3600 * 1000;
export const OUT_TTL = { list: 12 * H, venue: 6 * H, events: 3 * H, event: 1 * H };

// The network and the cache, swappable so tests/district.test.mjs can count requests offline.
export const io = { getText, store, now: () => Date.now() };

// A URL segment we put in a link: lowercase letters, digits and dashes only (no "?", no "/").
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const checkSegments = (...parts) => {
  if (!parts.every((p) => SEGMENT.test(String(p || "")))) throw new Error("That link doesn't look like a District page");
};

async function cached(key, ttl, force) {
  if (force) return null;
  const hit = await io.store.get(key);
  return hit && io.now() - hit.fetchedAt < ttl ? { ...hit, fromCache: true } : null;
}

async function save(key, result) {
  await io.store.set(key, result);
  return { ...result, fromCache: false };
}

// One GET with the app's friendly errors. `site` names who answered.
async function page(url, site, opts = {}) {
  try {
    return await io.getText(url, { timeout: 30000, ...opts });
  } catch (e) {
    if (e instanceof HttpError) throw Object.assign(new Error(`${site} returned ${e.status}`), { status: e.status });
    throw new Error(`Network error: ${e.message}`);
  }
}

/**
 * Bars & pubs or BYOB places near the user, from Zomato's category page for the zone.
 * @param {"bar"|"byob"} kind
 * @returns {Promise<{ venues: import("./outModel.js").VenueListItem[], total: number|null, hasMore: boolean,
 *   url: string, local: boolean, notFound?: boolean, fetchedAt: number, fromCache: boolean }>}
 *   url = the Zomato page ("More on Zomato"); notFound = Zomato has no such list for the city (venues [])
 */
export async function fetchVenueList(kind, { city, loc = null, force = false } = {}) {
  const k = OUT_KIND[kind];
  if (k?.source !== "zomato") throw new Error(`No Zomato list for "${kind}"`);
  const zCity = loc?.zomato?.city || zomatoCity(city);
  checkSegments(zCity);
  const zone = loc?.zomato?.entityId || "city";
  const key = `out:list:${kind}:${zCity}:${zone}`;
  const hit = await cached(key, OUT_TTL.list, force);
  if (hit) return hit;

  const url = `${ZOMATO_BASE}/${zCity}/${k.path}`;
  // No such list for this city: an empty list (cached like any other) and the link still works.
  const notFound = () => save(key, { venues: [], total: 0, hasMore: false, url, local: !!loc?.zomato, notFound: true, fetchedAt: io.now() });
  let parsed;
  try {
    parsed = parseVenueListPage(await page(url, "Zomato", { cookie: zomatoCookie(loc) }));
  } catch (e) {
    if (e.status === 404) return notFound();
    throw e;
  }
  // Most cities without the page get another list with a 200 (delivery kitchens, every dine-out place):
  // never show those as bars or BYOB places.
  const right = parsed && isVenueList(parsed, { zcity: zCity, path: k.path });
  if (right == null) throw new Error("Zomato page format changed");
  if (!right) return notFound();
  const { venues, total, hasMore } = parsed;
  return save(key, { venues, total, hasMore, url, local: !!loc?.zomato, fetchedAt: io.now() });
}

/**
 * A venue's District page.
 * @param {{ zcity: string, slug: string }} v
 * @returns {Promise<import("./outModel.js").VenueDetails & { url: string, bookUrl: string, fetchedAt: number, fromCache: boolean }>}
 *   throws when the page can't be read (the sheet then offers "Open in District")
 */
export async function fetchVenue(v, { force = false } = {}) {
  checkSegments(v?.zcity, v?.slug);
  const at = { zcity: v.zcity, slug: v.slug };
  const key = `dv:${at.zcity}/${at.slug}`;
  const hit = await cached(key, OUT_TTL.venue, force);
  if (hit) return hit;

  const url = venueUrl(at);
  let html;
  try {
    html = await page(url, "District");
  } catch (e) {
    throw e.status === 404 ? new Error("District has no page for this place") : e;
  }
  const details = parseVenuePage(html);
  if (!details) throw new Error("Couldn't read this place's District page");
  return save(key, { ...details, zcity: at.zcity, slug: at.slug, url, bookUrl: bookUrl(at), fetchedAt: io.now() });
}

/**
 * Club nights / food & drink events for the city, merged across genres, de-duplicated by slug.
 * One listing page per genre (each cached on its own); a genre that fails is left out unless all do.
 * @param {string[]} genres  OUT_KINDS[].genres
 * @returns {Promise<{ events: import("./outModel.js").EventListItem[], urls: string[], fetchedAt: number, fromCache: boolean }>}
 *   events = [] when District has no pages for the city
 */
export async function fetchEventList(genres, { city, weekend = false, force = false } = {}) {
  const cityKey = EVENT_CITY[city];
  const pages = (genres || []).map((g) => ({ genre: g, url: eventListUrls(city, [g], { weekend })[0] })).filter((p) => p.url);
  if (!pages.length) return { events: [], urls: [], fetchedAt: io.now(), fromCache: false };

  const settled = await Promise.allSettled(pages.map(async ({ genre, url }) => {
    const key = `ev:list:${genre}:${cityKey}${weekend ? ":wk" : ""}`;
    const hit = await cached(key, OUT_TTL.events, force);
    if (hit) return hit;
    return save(key, { events: parseEventList(await page(url, "District")), url, fetchedAt: io.now() });
  }));
  const ok = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  if (!ok.length) throw settled[0].reason;

  const events = [], seen = new Set();
  for (const e of ok.flatMap((r) => r.events)) if (!seen.has(e.slug)) { seen.add(e.slug); events.push(e); }
  return {
    events,
    urls: pages.map((p) => p.url),
    fetchedAt: Math.min(...ok.map((r) => r.fetchedAt)),
    fromCache: ok.every((r) => r.fromCache),
  };
}

/**
 * An event's District page.
 * @returns {Promise<import("./outModel.js").EventDetails & { url: string, fetchedAt: number, fromCache: boolean }>}
 */
export async function fetchEvent(slug, { force = false } = {}) {
  checkSegments(slug);
  const key = `ev:${slug}`;
  const hit = await cached(key, OUT_TTL.event, force);
  if (hit) return hit;

  const url = eventUrl(slug);
  let html;
  try {
    html = await page(url, "District");
  } catch (e) {
    throw e.status === 404 ? new Error("This event isn't on District any more") : e;
  }
  const details = parseEventPage(html);
  if (!details) throw new Error("Couldn't read this event's District page");
  return save(key, { ...details, slug: details.slug || slug, url, fetchedAt: io.now() });
}
