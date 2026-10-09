// ═══════════════════════════════════════════════════════════════════════════════
//  OUT — the shared shapes for "plan a party outside" (v1.5, the Out tab).
//
//  The party can happen at home (everything as in v1.4.1) or out: at a bar or
//  pub, a club night, a BYOB place or a food & drink event. Venue lists come from
//  Zomato's category pages (lib/parse/zomato.js parseVenueList); details, club
//  nights and tickets from District's public pages (lib/parse/district.js); booking
//  and buying always happen in the District app (lib/order.js openDistrict).
//  This file is the contract between those modules and the UI, so it stays small,
//  pure and stable. `cfg.out` (App.jsx) holds DEFAULT_OUT's shape.
// ═══════════════════════════════════════════════════════════════════════════════

// Outing types, in chip order. `source` says where the list comes from.
export const OUT_KINDS = [
  { id: "bar", label: "Bars & pubs", emoji: "🍻", source: "zomato", path: "drinks-and-nightlife" },
  { id: "club", label: "Club nights", emoji: "🪩", source: "district", genres: ["nightlife"] },
  { id: "byob", label: "BYOB", emoji: "🍾", source: "zomato", path: "byob" },
  { id: "events", label: "Food & drink events", emoji: "🎟️", source: "district", genres: ["food-drinks", "social-mixers"] },
];
export const OUT_KIND = Object.fromEntries(OUT_KINDS.map((k) => [k.id, k]));

export const DEFAULT_OUT = {
  active: false,   // "Party at: Out" — invite, reminders, rides and split use the pick
  kind: "bar",     // OUT_KINDS id
  perHead: null,   // ₹ budget per head; null = no cap
  bigGroup: false, // venues District lists with large-group seating / private dining first
  pick: null,      // slimVenue() | slimEvent() — the chosen place, a snapshot (refreshed when its sheet opens)
  tickets: [],     // [{ id, name, price, qty, kind, service, gateCover }] — planned, prices as of pick.fetchedAt
  corkage: null,   // ₹ per bottle the venue quoted (BYOB); null = unknown
  booked: false,   // the host ticked "Booked on District"
};

// Restore a saved cfg.out over the defaults (older cfgs have none).
export const withOut = (saved) => ({ ...DEFAULT_OUT, ...(saved || {}), tickets: Array.isArray(saved?.tickets) ? saved.tickets : [] });

// The party is out, at a picked place.
export const isOut = (out) => !!(out?.active && out.pick);

/**
 * A venue in a list — lib/parse/zomato.js parseVenueList(html) returns these:
 * @typedef {object} VenueListItem
 * @property {number} resId        Zomato / District restaurant id (the same id on both)
 * @property {string} name
 * @property {string} zcity        city segment from the venue's own URL ("ncr", "sohna", "bangalore") — never from our zone
 * @property {string} slug         "soi-7-pub-brewery-dlf-cyber-city"
 * @property {string} locality
 * @property {number|null} costForTwo  ₹, the venue's estimate
 * @property {number|null} rating      0–5
 * @property {number|null} votes
 * @property {number|null} distanceKm
 * @property {string} timing       "Opens at 5pm" ("" if none)
 * @property {string} offer        "10% OFF" ("" if none)
 * @property {boolean} promoted
 * @property {string[]} cuisines
 */

/**
 * A venue's District page — lib/parse/district.js parseVenuePage(html) returns this (null if unreadable):
 * @typedef {object} VenueDetails
 * @property {number|null} resId
 * @property {string} name
 * @property {string} zcity        the page's city segment (fetchVenue adds it)
 * @property {string} slug
 * @property {string} locality
 * @property {number|null} lat
 * @property {number|null} lon
 * @property {string} address
 * @property {string} phone        "" if none
 * @property {string[]} phones     every number the page lists
 * @property {string[]} cuisines
 * @property {number|null} rating
 * @property {number|null} votes
 * @property {number|null} costForTwo
 * @property {string[]} amenities  as District lists them: "BYOB", "Full bar available", "DJ", "Large group seating", …
 * @property {{ day: string, opens: string, closes: string }[]} hours  schema.org rows ("Monday", "13:00", "23:59")
 * @property {boolean} bookable    takes table bookings (BOOKING_SECTION) — not the ReserveAction, which is always there
 * @property {{ title: string, subtitle: string, text: string }[]} offers  "FLAT 20% OFF" / "From 12:00 PM, today" / "20 slots left"
 */

/**
 * An event in a District listing — parseEventList(html) returns these ([] for a soft 404):
 * @typedef {object} EventListItem
 * @property {string} slug        "room-xo-presents-sajanka-oct9-2026" (no "-buy-tickets")
 * @property {string} name
 * @property {string} venue
 * @property {string} locality
 * @property {number|null} lat
 * @property {number|null} lon
 * @property {string} start       ISO (UTC)
 * @property {string} end         ISO (UTC), "" if none
 * @property {number|null} priceFrom  ₹; 0 = free; null = unknown
 */

/**
 * An event's District page — parseEventPage(html) returns this (null if unreadable):
 * @typedef {object} EventDetails
 * @property {string} slug
 * @property {string} name
 * @property {string} description  plain text
 * @property {string} venue
 * @property {string} locality
 * @property {string} organizer
 * @property {string} address
 * @property {number|null} lat
 * @property {number|null} lon
 * @property {{ start: string, end: string, soldOut?: boolean }[]} shows  ISO (UTC), sorted
 * @property {{ ageEntry: number|null, stagAllowed: boolean|null, stag: string, id: string, dress: string, reentry: string }} rules
 *   organiser's door rules; stag/id/dress/reentry are District's own headings ("Stag entry is not allowed at this event"), "" if not given
 * @property {boolean} soldOut
 * @property {Ticket[]} tickets
 * @property {number|null} priceFrom   cheapest buyable ticket
 * @property {number} feePct           District convenience fee, 0–0.07
 */

/**
 * @typedef {object} Ticket
 * @property {string} id
 * @property {string} name        as District names it ("Couple Entry", "Group of 5")
 * @property {number} price       ₹
 * @property {number} min         per order
 * @property {number} max         per order
 * @property {boolean} buyable    District's own rule (not hidden, not locked, available, cap > 0)
 * @property {string} kind        "stag" | "male" | "female" | "couple" | "group" | "guestlist" | "table" | "general" — from the ticket name
 * @property {number|null} groupSize   people one ticket admits, if the name says (couple 2, "Group of 5" 5)
 * @property {"cover"|"entry"|null} service  cover charge (redeemable on food & drinks) or entry fee
 * @property {{ amount: number, per: "person"|"couple"|null, couple?: number }|null} gateCover  extra paid at the gate, from the ticket's text
 * @property {string} description  plain text
 * @property {number[]} shows      indexes into EventDetails.shows this ticket is sold for (one entry per ticket across weekly shows)
 * @property {number[]} buyableIn  the shows it can still be bought for — per-show rows: district.js ticketsForShow()
 */

// What the plan keeps of a venue: enough for the summary, invite, reminders and rides.
export const slimVenue = (v, url = "") => v && ({
  type: "venue",
  resId: v.resId ?? null, zcity: v.zcity || "", slug: v.slug || "",
  name: v.name || "", locality: v.locality || "",
  lat: v.lat ?? null, lon: v.lon ?? null,
  costForTwo: v.costForTwo ?? null, rating: v.rating ?? null,
  tags: v.amenities || v.tags || [], bookable: !!v.bookable, phone: v.phone || "",
  closes: v.closes || "", url, fetchedAt: v.fetchedAt || Date.now(),
});

export const slimEvent = (e, url = "") => e && ({
  type: "event",
  slug: e.slug || "", name: e.name || "", venue: e.venue || "", locality: e.locality || "",
  lat: e.lat ?? null, lon: e.lon ?? null,
  start: e.start || e.shows?.[0]?.start || "", end: e.end || e.shows?.[0]?.end || "",
  priceFrom: e.priceFrom ?? null, ageEntry: e.rules?.ageEntry ?? e.ageEntry ?? null, stag: e.rules?.stag || e.stag || "",
  url, fetchedAt: e.fetchedAt || Date.now(),
});

// ── Shared maths (the Out tab, reminders and the split all use these) ─────────

// Straight-line km (lib/location.js has the same, but imports Capacitor).
export function kmBetween(a, b) {
  if (a?.lat == null || a?.lon == null || b?.lat == null || b?.lon == null) return null;
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// "About 25 min": roads are ~1.4× the straight line, city traffic ~20 km/h, plus 10 min to get
// going; rounded up to 5. null without a distance.
export const travelMinutes = (km) => (km == null ? null : Math.ceil((10 + ((km * 1.4) / 20) * 60) / 5) * 5);

// What the outing itself costs, for the split and the summary: the venue's estimate
// (cost for two ÷ 2 a head — an estimate, District has the bill) and the planned tickets
// (exact as of when they were picked). null venue = no venue estimate.
export function outSpend(out, people) {
  if (!isOut(out)) return { venue: null, tickets: 0, total: 0 };
  const p = out.pick;
  const venue = p.type === "venue" && p.costForTwo ? Math.round((p.costForTwo / 2) * Math.max(1, people || 1)) : null;
  const tickets = (out.tickets || []).reduce((s, t) => s + (t.price || 0) * (t.qty || 0), 0);
  return { venue, tickets, total: (venue || 0) + tickets };
}

// The picked place as a ride pickup / invite venue: { lat, lon, label } or null.
export const outPlace = (out) => (isOut(out) && out.pick.lat != null && out.pick.lon != null
  ? { lat: out.pick.lat, lon: out.pick.lon, label: out.pick.type === "event" ? out.pick.venue || out.pick.name : out.pick.name }
  : null);
