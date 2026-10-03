// ═══════════════════════════════════════════════════════════════════════════════
//  OUT SOURCES — fetch + cache for the Out tab (v1.5). Plain GETs of public pages,
//  one per tap, through lib/http.js getText(); cached in IndexedDB (lib/store.js):
//    out:list:<kind>:<zcity>:<zone>  Zomato bars / BYOB list   12 h
//    dv:<zcity>/<slug>               District venue page        6 h
//    ev:list:<genre>:<cityKey>[:wk]  District event listing     3 h
//    ev:<slug>                       District event page        1 h
//  No /gw/ APIs, no query strings, no prefetching, no images.
//  (v1.5 foundation stub — track A writes the bodies; the signatures are the contract.)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bars & pubs or BYOB places near the user, from Zomato's category page for the zone.
 * @param {"bar"|"byob"} kind
 * @returns {Promise<{ venues: import("./outModel.js").VenueListItem[], total: number|null, hasMore: boolean,
 *   url: string, local: boolean, fetchedAt: number, fromCache: boolean }>}  url = the Zomato page ("More on Zomato")
 */
export async function fetchVenueList(kind, { city, loc = null, force = false } = {}) {
  return { venues: [], total: 0, hasMore: false, url: "", local: false, fetchedAt: Date.now(), fromCache: false };
}

/**
 * A venue's District page.
 * @param {{ zcity: string, slug: string }} v
 * @returns {Promise<import("./outModel.js").VenueDetails & { url: string, bookUrl: string, fetchedAt: number, fromCache: boolean }>}
 *   throws when the page can't be read (the sheet then offers "Open in District")
 */
export async function fetchVenue(v, { force = false } = {}) {
  throw new Error("not implemented");
}

/**
 * Club nights / food & drink events for the city, merged across genres, de-duplicated by slug.
 * @param {string[]} genres  OUT_KINDS[].genres
 * @returns {Promise<{ events: import("./outModel.js").EventListItem[], urls: string[], fetchedAt: number, fromCache: boolean }>}
 *   events = [] when District has no pages for the city
 */
export async function fetchEventList(genres, { city, weekend = false, force = false } = {}) {
  return { events: [], urls: [], fetchedAt: Date.now(), fromCache: false };
}

/**
 * An event's District page.
 * @returns {Promise<import("./outModel.js").EventDetails & { url: string, fetchedAt: number, fromCache: boolean }>}
 */
export async function fetchEvent(slug, { force = false } = {}) {
  throw new Error("not implemented");
}
