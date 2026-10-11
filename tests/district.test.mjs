// District + Zomato going-out readers (v1.5 Out tab), against trimmed captures in tests/fixtures/district/
// (each file says where it came from). Offline; the live checks are in parsers.live.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DISTRICT_BASE, venueUrl, bookUrl, eventUrl, eventListUrl, eventListUrls, EVENT_CITY, EVENT_PAGES, fromZomatoUrl,
  parseVenuePage, parseEventList, parseEventPage, parseEventData, closingTime, ticketKind, gateCover, buyable, cleanOffer, ticketsForShow,
  ticketService,
} from "../src/lib/parse/district.js";
import { parseVenueList, parseVenueListPage, parseVotes, isVenueList } from "../src/lib/parse/zomato.js";
import { CITIES } from "../src/lib/parse/livcheers.js";
import { HttpError } from "../src/lib/http.js";
import { io, OUT_TTL, fetchVenueList, fetchVenue, fetchEventList, fetchEvent } from "../src/lib/outSources.js";

const fx = (f) => readFileSync(new URL(`./fixtures/district/${f}`, import.meta.url), "utf8");
const noFlight = (html) => html.replace(/<script>self\.__next_f\.push[\s\S]*?<\/script>/g, "");
const byName = (list) => Object.fromEntries(list.map((t) => [t.name, t]));

// ── Venue pages ──────────────────────────────────────────────────────────────

test("Soi 7: takes bookings, full bar, the FLAT 20% OFF offer, 7512 ratings, geo", () => {
  const v = parseVenuePage(fx("venue_soi7.html"));
  assert.equal(v.name, "Soi 7 Pub & Brewery");
  assert.equal(v.resId, 305281);
  assert.equal(v.bookable, true);
  assert.ok(v.amenities.includes("Full bar available"));
  assert.ok(v.amenities.includes("Large group seating"));
  assert.equal(v.votes, 7512);
  assert.equal(v.rating, 4.1);
  assert.equal(v.costForTwo, 2800);
  assert.ok(Math.abs(v.lat - 28.4956) < 0.001 && Math.abs(v.lon - 77.0884) < 0.001);
  assert.deepEqual([v.zcity, v.slug, v.locality], ["ncr", "soi-7-pub-brewery-dlf-cyber-city", "DLF Cyber City"]);
  assert.equal(v.phone, "+918130261700");
  assert.deepEqual(v.cuisines, ["Continental", "Asian", "North Indian"]);
  // The flight's offer titles carry line breaks ("FLAT \n20% OFF ") — collapsed.
  assert.deepEqual(v.offers[0], { title: "FLAT 20% OFF", subtitle: "From 12:00 AM, today", text: "20 slots left" });
  assert.ok(v.offers.every((o) => !/\n|\\n|\s$/.test(o.title)));
  assert.equal(v.hours.length, 14);
  assert.deepEqual(v.hours[0], { day: "Monday", opens: "13:00", closes: "23:59" });
});

test("Ebowla Club & BYOB (20855103): BYOB, but no table bookings despite its ReserveAction", () => {
  const html = fx("venue_ebowla_20855103.html");
  assert.ok(html.includes("ReserveAction"));
  const v = parseVenuePage(html);
  assert.equal(v.resId, 20855103);
  assert.ok(v.amenities.includes("BYOB"));
  assert.equal(v.bookable, false);
  assert.equal(v.costForTwo, 1500);
});

test("Club Ebowla BYOB (21568340) takes bookings", () => {
  const v = parseVenuePage(fx("venue_clubebowla_21568340.html"));
  assert.equal(v.resId, 21568340);
  assert.equal(v.bookable, true);
  assert.equal(v.name, "Club Ebowla BYOB");
});

test("a venue page without the flight still gives the JSON-LD fields (and bookings from the meta text)", () => {
  const soi = parseVenuePage(noFlight(fx("venue_soi7.html")));
  assert.equal(soi.name, "Soi 7 Pub & Brewery");
  assert.equal(soi.votes, 7512);
  assert.ok(soi.lat && soi.lon && soi.amenities.length > 10 && soi.hours.length === 14);
  assert.equal(soi.bookable, true);            // meta description: "… book a table and more …"
  assert.equal(soi.resId, null);
  assert.deepEqual(soi.offers, []);
  assert.equal(parseVenuePage(noFlight(fx("venue_ebowla_20855103.html"))).bookable, false);
  // Club Ebowla's page also has the <h2>Book a table</h2> block.
  assert.equal(parseVenuePage(noFlight(fx("venue_clubebowla_21568340.html"))).bookable, true);
  // A flight that no longer parses degrades the same way.
  const broken = fx("venue_soi7.html").replace(/"pageDetailsResponse":\{/, '"pageDetailsResponse":{oops');
  assert.equal(parseVenuePage(broken).name, "Soi 7 Pub & Brewery");
});

test("Sohna: the city segment comes from the venue's own URL, never our zone", () => {
  const v = parseVenuePage(fx("venue_sohna_dominos.html"));
  assert.equal(v.zcity, "sohna");
  assert.equal(v.slug, "dominos-pizza-sohna-locality");
  const at = fromZomatoUrl("https://www.zomato.com/sohna/dominos-pizza-sohna-locality/info");
  assert.deepEqual(at, { zcity: "sohna", slug: "dominos-pizza-sohna-locality" });
  assert.equal(venueUrl(at), "https://www.district.in/dining/sohna/dominos-pizza-sohna-locality");
  // The same venue under /ncr/ is District's 404 page: nothing to read.
  assert.equal(parseVenuePage(fx("venue_ncr_sohna_404.html")), null);
  assert.equal(parseVenuePage(""), null);
  assert.equal(parseVenuePage("<html><body>Not found</body></html>"), null);
});

test("Bengaluru venue page reads the same way", () => {
  const v = parseVenuePage(fx("venue_vapour_bangalore.html"));
  assert.equal(v.zcity, "bangalore");
  assert.equal(v.bookable, true);
  assert.equal(v.votes, 10118);
  assert.equal(closingTime(v.hours, "2026-10-10"), "01:00");
});

test("closingTime: a 00:00–02:00 row next to 13:00–23:59 is that night's late close", () => {
  const soi = parseVenuePage(fx("venue_soi7.html")).hours;
  assert.equal(closingTime(soi, "2026-10-05"), "02:00");   // Monday
  assert.equal(closingTime(soi, "2026-10-10"), "03:00");   // Saturday
  assert.equal(closingTime(parseVenuePage(fx("venue_sohna_dominos.html")).hours, "2026-10-10"), "23:00");
  const late = [{ day: "Monday", opens: "13:00", closes: "23:59" }, { day: "Monday", opens: "00:00", closes: "02:00" }];
  assert.equal(closingTime(late, "2026-10-05"), "02:00");
  assert.equal(closingTime(late, "2026-10-06"), "");                                          // no Tuesday rows
  assert.equal(closingTime([{ day: "Friday", opens: "18:00", closes: "02:00" }], "2026-10-09"), "02:00");  // one row across midnight
  assert.equal(closingTime([{ day: "Friday", opens: "12:00", closes: "23:59" }], "2026-10-09"), "23:59");
  assert.equal(closingTime(late, "not a date"), "");
  assert.equal(closingTime(null, "2026-10-05"), "");
});

test("closingTime: a close written as 00:00 or 24:00 runs to midnight; 24 hours has no close", () => {
  const sat = (rows) => closingTime(rows.map(([opens, closes]) => ({ day: "Saturday", opens, closes })), "2026-10-10");
  assert.equal(sat([["13:00", "00:00"], ["00:00", "02:00"]]), "02:00");
  assert.equal(sat([["00:00", "02:00"], ["13:00", "24:00"]]), "02:00");
  assert.equal(sat([["13:00", "00:00"]]), "00:00");
  assert.equal(sat([["13:00", "24:00"]]), "00:00");
  assert.equal(sat([["00:00", "23:59"]]), "");
  assert.equal(sat([["00:00", "00:00"]]), "");
  assert.equal(sat([["12:00", "16:00"], ["19:00", "23:30"]]), "23:30");
});

test("cleanOffer collapses literal and real line breaks", () => {
  assert.equal(cleanOffer("FLAT \\n20% OFF "), "FLAT 20% OFF");
  assert.equal(cleanOffer("FLAT \n10% OFF"), "FLAT 10% OFF");
  assert.equal(cleanOffer(null), "");
});

// ── Zomato venue lists ───────────────────────────────────────────────────────

test("Zomato /ncr/byob: 9 venues with zcity, slug, resId, timing and offers — no delivery links", () => {
  const html = fx("zomato_ncr_byob.html");
  const venues = parseVenueList(html);
  assert.equal(venues.length, 9);                 // the collections rail and the banner are skipped
  for (const v of venues) {
    assert.equal(v.zcity, "ncr");
    assert.match(v.slug, /^[a-z0-9-]+$/);
    assert.equal(typeof v.resId, "number");
    assert.ok(v.timing, v.name);
    assert.ok(v.costForTwo > 0, v.name);
    assert.ok(v.distanceKm > 0 && v.distanceKm < 15, v.name);
  }
  assert.ok(!JSON.stringify(venues).includes("zomato://"));
  const ebowla = venues.find((v) => v.resId === 20855103);
  assert.deepEqual(
    { slug: ebowla.slug, costForTwo: ebowla.costForTwo, rating: ebowla.rating, votes: ebowla.votes, distanceKm: ebowla.distanceKm, timing: ebowla.timing, offer: ebowla.offer, promoted: ebowla.promoted },
    { slug: "ebowla-club-byob-sector-30-gurgaon", costForTwo: 1500, rating: 3.8, votes: 320, distanceKm: 2.8, timing: "Opens at 5pm", offer: "10% OFF", promoted: false });
  assert.ok(venues.some((v) => v.resId === 21568340));
  // Unrated: no 0 stars.
  const naansense = venues.find((v) => v.name === "Naansense");
  assert.deepEqual([naansense.rating, naansense.votes], [null, null]);
  assert.equal(venues.filter((v) => v.offer).length, 4);
  const page = parseVenueListPage(html);
  assert.deepEqual([page.total, page.hasMore], [40, true]);
  assert.equal(page.path, "/ncr/byob");
  assert.deepEqual(page.filters, { category_sheet: "go_out_home", context: "dineout_home" });
  assert.equal(isVenueList(page, { zcity: "ncr", path: "byob" }), true);
  assert.equal(isVenueList(page, { zcity: "ncr", path: "drinks-and-nightlife" }), false);
});

test("Zomato serves another list (200) where a city has no such page: never bars or BYOB", () => {
  // Warangal "BYOB" = delivery kitchens: delivery_home, and every card links to /order.
  const war = parseVenueListPage(fx("zomato_warangal_byob.html"));
  assert.deepEqual([war.path, war.filters, war.total], ["/warangal/byob", { category_sheet: "delivery_home" }, 75]);
  assert.equal(isVenueList(war, { zcity: "warangal", path: "byob" }), false);
  assert.deepEqual(war.venues, []);                               // /order links are no District page
  // Jaipur "bars" = a redirect to every dine-out place (dineout_home, 6,292 of them).
  const jai = parseVenueListPage(fx("zomato_jaipur_drinks-and-nightlife.html"));
  assert.deepEqual([jai.path, jai.filters.context, jai.total], ["/jaipur/restaurants?category=3&context=nightlife", "dineout_home", 6292]);
  assert.ok(jai.venues.length > 0);                               // readable cards, wrong list
  assert.equal(isVenueList(jai, { zcity: "jaipur", path: "drinks-and-nightlife" }), false);
  // Hubli's redirect keeps the nightlife context: those are bars.
  const hub = parseVenueListPage(fx("zomato_hubli_drinks-and-nightlife.html"));
  assert.equal(hub.path, "/hubli/restaurants?category=3&context=nightlife");
  assert.equal(isVenueList(hub, { zcity: "hubli", path: "drinks-and-nightlife" }), true);
  assert.ok(hub.venues.length === 4 && hub.venues.every((v) => v.zcity === "hubli"));
  // BYOB must be the /<zcity>/byob page itself.
  assert.equal(isVenueList({ ...hub, path: "/hubli/restaurants?category=3", filters: { category_sheet: "go_out_home", context: "dineout_home" } }, { zcity: "hubli", path: "byob" }), false);
  // No filter rail at all: can't tell.
  assert.equal(isVenueList({ ...hub, filters: null }, { zcity: "hubli", path: "drinks-and-nightlife" }), null);
});

test("fromZomatoUrl: venue pages only — no delivery links, no vanity links without a city", () => {
  assert.deepEqual(fromZomatoUrl("/ncr/soi-7-pub-brewery-dlf-cyber-city/info"), { zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city" });
  assert.deepEqual(fromZomatoUrl("/ncr/soi-7-pub-brewery-dlf-cyber-city"), { zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city" });
  assert.equal(fromZomatoUrl("/warangal/roti-walaa-mathwada/order"), null);
  assert.equal(fromZomatoUrl("https://www.zomato.com/hubli/hotel-shree-ganesh-keshwapur/order"), null);
  assert.equal(fromZomatoUrl("/24-7RestaurantNewDelhi/info"), null);
  assert.equal(fromZomatoUrl(""), null);
});

test("Zomato drinks-and-nightlife lists for NCR and Bengaluru", () => {
  const ncr = parseVenueListPage(fx("zomato_ncr_drinks-and-nightlife.html"));
  assert.equal(ncr.venues.length, 9);
  assert.equal(ncr.total, 1131);
  assert.equal(ncr.filters.context, "nightlife_home");
  assert.equal(isVenueList(ncr, { zcity: "ncr", path: "drinks-and-nightlife" }), true);
  assert.equal(isVenueList(parseVenueListPage(fx("zomato_bangalore_drinks-and-nightlife.html")), { zcity: "bangalore", path: "drinks-and-nightlife" }), true);
  assert.ok(ncr.venues.every((v) => v.zcity === "ncr" && v.slug && v.name));
  assert.equal(ncr.venues.find((v) => v.resId === 310737).offer, "25% OFF");
  const blr = parseVenueList(fx("zomato_bangalore_drinks-and-nightlife.html"));
  assert.ok(blr.length >= 9 && blr.every((v) => v.zcity === "bangalore"));
  const hoc = blr.find((v) => v.resId === 18580202);
  assert.deepEqual([hoc.votes, hoc.distanceKm], [15600, 0.3]);   // "15.6K", "273 m"
  assert.equal(blr.find((v) => v.resId === 22744095).timing, "");
});

test("parseVotes and non-list pages", () => {
  assert.equal(parseVotes("1,190"), 1190);
  assert.equal(parseVotes("15.6K"), 15600);
  assert.equal(parseVotes("0"), null);
  assert.equal(parseVotes(undefined), null);
  assert.deepEqual(parseVenueList("<html>nothing</html>"), []);
  assert.equal(parseVenueListPage("<html>nothing</html>"), null);
});

// ── Event listings ───────────────────────────────────────────────────────────

test("nightlife in Gurgaon: 12 events, slugs without -buy-tickets, prices as numbers (Free = 0)", () => {
  const events = parseEventList(fx("events_nightlife-in-gurgaon.html"));
  assert.equal(events.length, 12);
  assert.equal(new Set(events.map((e) => e.slug)).size, 12);
  for (const e of events) {
    assert.match(e.slug, /^[a-z0-9-]+$/);
    assert.ok(!e.slug.endsWith("-buy-tickets"));
    assert.equal(typeof e.priceFrom, "number", e.name);
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(e.lat && e.lon && e.venue, e.name);
  }
  assert.equal(events[0].priceFrom, 0);            // "Free"
  const x = events.find((e) => e.slug === "giada-brince-xlive-saturday-oct3-2026");
  assert.deepEqual({ venue: x.venue, locality: x.locality, priceFrom: x.priceFrom, start: x.start },
    { venue: "X LIVE", locality: "DLF Phase 5, Gurgaon", priceFrom: 499, start: "2026-10-03T17:00:00.000Z" });
  assert.equal(events.find((e) => e.slug === "room-xo-presents-sajanka-oct9-2026").priceFrom, 1800);
});

test("an unknown genre is a soft 404 (200, no ItemList) → []", () => {
  assert.deepEqual(parseEventList(fx("events_nonsense-genre-in-gurgaon.html")), []);
  assert.deepEqual(parseEventList(""), []);
});

// ── Event pages ──────────────────────────────────────────────────────────────

test("X LIVE: male / female / couple entry fees, gate cover 1500 / 2500, no stags, 21+", () => {
  const e = parseEventPage(fx("event_xlive.html"));
  assert.equal(e.slug, "giada-brince-xlive-saturday-oct3-2026");
  assert.equal(e.venue, "X LIVE");
  assert.deepEqual(e.shows, [{ start: "2026-10-03T17:00:00.000Z", end: "2026-10-03T20:45:00.000Z", soldOut: false }]);
  const t = byName(e.tickets);
  assert.deepEqual(e.tickets.map((x) => x.kind), ["male", "female", "couple"]);
  assert.ok(e.tickets.every((x) => x.service === "entry" && x.buyable));
  assert.deepEqual(t["Male Pass"].gateCover, { amount: 1500, per: "person" });
  assert.deepEqual(t["Female Pass"].gateCover, { amount: 1500, per: "person" });
  assert.deepEqual(t["Couple Pass"].gateCover, { amount: 2500, per: "couple" });
  assert.equal(t["Couple Pass"].groupSize, 2);
  assert.equal(e.rules.ageEntry, 21);
  assert.equal(e.rules.stagAllowed, false);
  assert.match(e.rules.stag, /not allowed/i);
  assert.match(e.rules.id, /ID/);
  assert.equal(e.priceFrom, 499);
  assert.equal(e.feePct, 0.06);
  assert.ok(!/<br|&amp;/.test(t["Male Pass"].description));
});

test("Room XO: a group of 5, from ₹1800 (not the stale 1499), ₹1000 a person at the gate", () => {
  const html = fx("event_roomxo.html");
  assert.ok(html.includes("1499 onwards"));         // District's own stale price_display_string
  const e = parseEventPage(html);
  assert.equal(e.priceFrom, 1800);
  const group = e.tickets.find((t) => /group of 5/i.test(t.name));
  assert.deepEqual([group.kind, group.groupSize, group.price], ["group", 5, 8000]);
  assert.ok(e.tickets.every((t) => t.gateCover?.amount === 1000 && t.gateCover.per === "person"));
  assert.ok(e.tickets.every((t) => t.service === null));   // no services[], and the text only talks about the gate
  assert.equal(e.rules.ageEntry, 21);
  assert.equal(e.rules.stag, "");
});

test("The Inner Room: ₹0 couple / female guestlist, one ticket list across 7 weekly shows", () => {
  const e = parseEventData(JSON.parse(fx("event_inner-room.json")).data);
  const t = byName(e.tickets);
  assert.deepEqual([t["COUPLE GUESTLIST"].kind, t["COUPLE GUESTLIST"].price, t["COUPLE GUESTLIST"].groupSize, t["COUPLE GUESTLIST"].buyable], ["guestlist", 0, 2, true]);
  assert.deepEqual([t["FEMALE GUESTLIST"].kind, t["FEMALE GUESTLIST"].groupSize], ["guestlist", 1]);
  assert.equal(e.priceFrom, 0);
  assert.equal(e.shows.length, 7);
  assert.deepEqual(e.shows.map((s) => s.start), [...e.shows.map((s) => s.start)].sort());
  assert.equal(e.tickets.length, 4);
  assert.deepEqual(t.COUPLE.shows, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(ticketsForShow(e, 3).length, 4);
  assert.equal(t["FEMALE STAG"].service, "cover");   // "TICKETS ARE FULLY REDEEMABLE"
});

test("Fashion Friday: VIP TABLE FOR 2 is a table, sold as an entry fee", () => {
  const e = parseEventData(JSON.parse(fx("event_fashion-friday.json")).data);
  const table = byName(e.tickets)["VIP TABLE FOR 2"];
  assert.deepEqual([table.kind, table.groupSize, table.service, table.price], ["table", 2, "entry", 499]);
  assert.equal(e.priceFrom, 199);
});

test("Bora Bora: cover charge tickets, redeemable on food & drinks", () => {
  const e = parseEventData(JSON.parse(fx("event_borabora.json")).data);
  assert.deepEqual(e.tickets.map((t) => [t.kind, t.service, t.price]), [["female", "cover", 499], ["couple", "cover", 999]]);
  assert.ok(e.tickets.every((t) => /redeemable on food & beverages/i.test(t.description)));
  assert.equal(e.rules.stagAllowed, false);
  assert.equal(e.feePct, 0.04);
});

test("an event page without the flight falls back to the JSON-LD offers", () => {
  const e = parseEventPage(noFlight(fx("event_xlive.html")));
  assert.equal(e.name, "Giada Brince Xlive Saturday");
  assert.deepEqual(e.tickets.map((t) => [t.name, t.price, t.kind, t.buyable]),
    [["Male Pass", 1299, "male", true], ["Female Pass", 499, "female", true], ["Couple Pass", 999, "couple", true]]);
  assert.equal(e.priceFrom, 499);
  assert.equal(e.shows.length, 1);
  assert.deepEqual(e.rules, { ageEntry: null, stag: "", stagAllowed: null, id: "", dress: "", reentry: "" });
  assert.equal(parseEventPage("<html></html>"), null);
});

test("ticketKind reads the ticket name", () => {
  const k = (n) => { const r = ticketKind(n); return `${r.kind}/${r.groupSize}`; };
  assert.equal(k("Stag Full Cover"), "stag/1");
  assert.equal(k("Male Stag "), "male/1");
  assert.equal(k("FEMALE STAG"), "female/1");
  assert.equal(k("Ladies Entry "), "female/1");
  assert.equal(k("Couples Ticket "), "couple/2");
  assert.equal(k("Phase 1 Group of 5 entry"), "group/5");
  assert.equal(k("VIP GROUP OF 6 PAX WITH UNLIMITED F&B"), "group/6");
  assert.equal(k("Group of 3 | Cover Charge Ticket"), "group/3");
  assert.equal(k("COUPLE GUESTLIST"), "guestlist/2");
  assert.equal(k("VIP TABLE FOR 2"), "table/2");
  assert.equal(k("Entry for 1 "), "general/1");
  assert.equal(k("SOLO PASS - GENERAL ACCESS"), "general/1");
  assert.equal(k("Regular Ticket "), "general/null");
  assert.equal(k(""), "general/null");
});

test("gateCover reads extra cover at the gate from the text", () => {
  const xlive = "Additional cover charge of INR 1500 (couple 2500) is applicable at the gate";
  assert.deepEqual(gateCover(xlive), { amount: 1500, per: "person", couple: 2500 });
  assert.deepEqual(gateCover(xlive, "couple"), { amount: 2500, per: "couple" });
  assert.deepEqual(gateCover("- Gate open at 10 PM<br />- Mandatory additional cover charge of ₹1000 per person at the gate"), { amount: 1000, per: "person" });
  assert.deepEqual(gateCover("Cover charge of 500 rs applicable at gate "), { amount: 500, per: null });
  assert.deepEqual(gateCover("Free Entry Till 9:30pm, Post Rs. 3000 Cover Charges will be applicable.<br />Club Rules Apply."), { amount: 3000, per: null });
  assert.deepEqual(gateCover("An additional fully redeemable cover charge of INR 1,000 will be applicable at the venue."), { amount: 1000, per: null });
  // The ticket's own cover, or no money at all, isn't a gate cover.
  assert.equal(gateCover("A fully redeemable INR 1000 cover charge, redeemable against F&amp;B, at the event."), null);
  assert.equal(gateCover("• No cover charges applicable"), null);
  assert.equal(gateCover("- Gate open at 10 PM"), null);
  assert.equal(gateCover(""), null);
  // "Not redeemable" says nothing about a gate either.
  assert.equal(gateCover("The ticket price is non-redeemable on food and drinks."), null);
});

test("ticketService: cover vs entry fee, and text that says it's not redeemable", () => {
  const entry = (name = "Entry") => ({ name, services: [{ service_type: "ENTRY_FEES" }] });
  const cover = { name: "Cover", services: [{ service_type: "COVER_CHARGE" }] };
  const bare = { name: "Regular Ticket" };
  // Negations aren't a cover.
  assert.equal(ticketService(entry(), "The ticket price is non-redeemable on food and drinks."), "entry");
  assert.equal(ticketService(bare, "Ticket amount not redeemable"), "entry");
  assert.equal(ticketService(entry(), "Entry fee, not fully redeemable"), "entry");
  assert.equal(ticketService(bare, "Entry fee, not fully redeemable"), "entry");
  assert.equal(ticketService(cover, "Cover charge is non-redeemable"), "entry");
  assert.equal(ticketService(bare, "• No cover charges applicable"), null);
  // A redeemable "Cover Charge" ticket sold as ENTRY_FEES (live: corporate-night-feb23-2026).
  assert.equal(ticketService(entry("Cover Charge"), "Cover Charge is Redeemable at the Restaurant."), "cover");
  assert.equal(ticketService(entry("Cover Charge"), "Redeemable — show this ticket at the bar"), "cover");
  assert.equal(ticketService(entry("Stag Entry"), "Redeemable — show this ticket at the bar"), "entry");
  // What was right stays right; a line that denies something else doesn't undo the cover.
  assert.equal(ticketService(entry(), "The ticket amount is fully redeemable on food and drinks"), "cover");
  assert.equal(ticketService(entry(), "Ticket price fully redeemable against F&B. Convenience fees are non-redeemable"), "cover");
  assert.equal(ticketService(bare, "Cover charge redeemable on F&B, convenience fee non-redeemable"), "cover");
  assert.equal(ticketService(cover, ""), "cover");
  assert.equal(ticketService(entry(), "Entry for 1"), "entry");
  assert.equal(ticketService(bare, "Entry for 1"), null);
  // Through the event reader too.
  const show = (item) => ({ venue: { name: "X", shows: [{ start_utc_timestamp: 1790000000, items_for_sale: [{ items: [{ quantity_available_for_purchase: 5, price: 1000, ...item }] }] }] } });
  assert.equal(parseEventData(show({ name: "Cover Charge", services: [{ service_type: "ENTRY_FEES" }], description: "Cover Charge is Redeemable at the Restaurant." })).tickets[0].service, "cover");
  assert.equal(parseEventData(show({ name: "Stag", services: [{ service_type: "ENTRY_FEES" }], description: "The ticket price is non-redeemable on food and drinks." })).tickets[0].service, "entry");
});

test("buyable copies District's own rule", () => {
  const ok = { is_hidden: false, locked: false, is_available: true, item_state: "available", quantity_available_for_purchase: 10 };
  assert.equal(buyable(ok, { is_available: true }), true);
  assert.equal(buyable({ ...ok, item_state: undefined }, {}), true);
  for (const bad of [{ is_hidden: true }, { locked: true }, { is_available: false }, { item_state: "sold_out" }, { quantity_available_for_purchase: 0 }]) {
    assert.equal(buyable({ ...ok, ...bad }, {}), false, JSON.stringify(bad));
  }
  assert.equal(buyable(ok, { is_available: false }), false);
  assert.equal(buyable(null, {}), false);
});

// ── Cities, genres and URLs ──────────────────────────────────────────────────

test("EVENT_CITY maps Livcheers cities to District's event keys", () => {
  assert.equal(EVENT_CITY.delhi, "new-delhi");
  assert.equal(EVENT_CITY.bangalore, "bengaluru");
  assert.equal(EVENT_CITY.mysore, "mysuru");
  assert.equal(EVENT_CITY.gurgaon, "gurgaon");
  assert.equal(EVENT_CITY.warangal, null);
  for (const c of CITIES) assert.ok(c.slug in EVENT_CITY, c.slug);
  for (const key of Object.values(EVENT_CITY)) if (key) assert.ok(EVENT_PAGES[key], key);
  assert.deepEqual(eventListUrls("delhi", ["nightlife", "food-drinks"]), [
    "https://www.district.in/events/nightlife-in-new-delhi-book-tickets",
    "https://www.district.in/events/food-drinks-in-new-delhi-book-tickets",
  ]);
  assert.deepEqual(eventListUrls("gurgaon", ["nightlife"], { weekend: true }), ["https://www.district.in/events/nightlife-this-weekend-in-gurgaon"]);
  assert.deepEqual(eventListUrls("mysore", ["nightlife"]), []);
  assert.deepEqual(eventListUrls("warangal", ["nightlife"]), []);
  assert.deepEqual(eventListUrls("nashik", ["nightlife"], { weekend: true }), []);   // not in the weekend sitemap
});

test("every District URL the module builds is a www page: no query string, no /gw/", () => {
  const urls = [DISTRICT_BASE];
  for (const [key, pages] of Object.entries(EVENT_PAGES)) {
    for (const g of pages.all) urls.push(eventListUrl(g, key));
    for (const g of pages.weekend) urls.push(eventListUrl(g, key, { weekend: true }));
  }
  for (const city of Object.keys(EVENT_CITY)) urls.push(...eventListUrls(city, ["nightlife", "food-drinks", "social-mixers"]));
  for (const f of ["venue_soi7.html", "venue_ebowla_20855103.html", "venue_clubebowla_21568340.html", "venue_sohna_dominos.html"]) {
    const v = parseVenuePage(fx(f));
    urls.push(venueUrl(v), bookUrl(v));
  }
  for (const e of parseEventList(fx("events_nightlife-in-gurgaon.html"))) urls.push(eventUrl(e.slug));
  for (const v of parseVenueList(fx("zomato_ncr_byob.html"))) urls.push(venueUrl(v));
  for (const u of urls) {
    assert.ok(u.startsWith("https://www.district.in"), u);
    assert.ok(!u.includes("?") && !u.includes("/gw/"), u);
  }
  assert.ok(!readFileSync(new URL("../src/lib/outSources.js", import.meta.url), "utf8").includes("/gw/"));
});

// ── outSources: one GET per tap, cache keys and TTLs ─────────────────────────

const HOUR = 3600 * 1000;
function fakeNet(pages) {
  const calls = [], db = new Map();
  let clock = Date.UTC(2026, 9, 3, 12);
  Object.assign(io, {
    getText: async (url, opts = {}) => {
      calls.push({ url, cookie: opts.cookie ?? null });
      const p = pages[url];
      if (p instanceof Error) throw p;
      if (p == null) throw new HttpError(404, url);
      return p;
    },
    store: { get: async (k) => (db.has(k) ? structuredClone(db.get(k)) : null), set: async (k, v) => { db.set(k, structuredClone(v)); } },
    now: () => clock,
  });
  return { calls, db, tick: (ms) => { clock += ms; } };
}
const LOC = { lat: 28.4595, lon: 77.0266, zomato: { entityId: 1234, entityType: "subzone", city: "ncr" } };

test("cache lifetimes", () => {
  assert.deepEqual(OUT_TTL, { list: 12 * HOUR, venue: 6 * HOUR, events: 3 * HOUR, event: 1 * HOUR });
});

test("fetchVenueList: one Zomato GET with the zone cookie, then the 12 h cache", async () => {
  const net = fakeNet({ "https://www.zomato.com/ncr/byob": fx("zomato_ncr_byob.html") });
  const r = await fetchVenueList("byob", { city: "gurgaon", loc: LOC });
  assert.deepEqual(net.calls, [{ url: "https://www.zomato.com/ncr/byob", cookie: "ltv=1234; lty=subzone" }]);
  assert.equal(r.venues.length, 9);
  assert.deepEqual([r.total, r.hasMore, r.local, r.fromCache, r.url], [40, true, true, false, "https://www.zomato.com/ncr/byob"]);
  assert.ok(net.db.has("out:list:byob:ncr:1234"));
  assert.equal((await fetchVenueList("byob", { city: "gurgaon", loc: LOC })).fromCache, true);
  net.tick(12 * HOUR - 1000);
  assert.equal((await fetchVenueList("byob", { city: "gurgaon", loc: LOC })).fromCache, true);
  net.tick(2000);
  assert.equal((await fetchVenueList("byob", { city: "gurgaon", loc: LOC })).fromCache, false);
  await fetchVenueList("byob", { city: "gurgaon", loc: LOC, force: true });
  assert.equal(net.calls.length, 3);
});

test("fetchVenueList: Delhi without GPS reads NCR's list; a city without the page is an empty list", async () => {
  const state = (sections) => `<script>window.__PRELOADED_STATE__ = JSON.parse(${JSON.stringify(JSON.stringify({ pages: { search: { "/kanpur/byob": { sections } } } }))});</script>`;
  const net = fakeNet({
    "https://www.zomato.com/ncr/drinks-and-nightlife": fx("zomato_ncr_drinks-and-nightlife.html"),
    "https://www.zomato.com/warangal/byob": fx("zomato_warangal_byob.html"),                     // 200, delivery kitchens
    "https://www.zomato.com/jaipur/drinks-and-nightlife": fx("zomato_jaipur_drinks-and-nightlife.html"), // 200 after a redirect, every dine-out place
    "https://www.zomato.com/hubli/drinks-and-nightlife": fx("zomato_hubli_drinks-and-nightlife.html"),
    "https://www.zomato.com/kanpur/byob": state({ SECTION_SEARCH_RESULT: [], SECTION_SEARCH_META_INFO: { searchMetaData: { totalResults: 0 } } }),
  });
  const r = await fetchVenueList("bar", { city: "delhi" });
  assert.deepEqual(net.calls, [{ url: "https://www.zomato.com/ncr/drinks-and-nightlife", cookie: null }]);
  assert.deepEqual([r.venues.length, r.local], [9, false]);
  assert.ok(!("filters" in r) && !("path" in r));
  assert.ok(net.db.has("out:list:bar:ncr:city"));
  for (const [kind, city, url] of [["byob", "warangal", "https://www.zomato.com/warangal/byob"], ["bar", "jaipur", "https://www.zomato.com/jaipur/drinks-and-nightlife"],
    ["byob", "gurgaon", "https://www.zomato.com/ncr/byob"]]) {                                     // no page at all: 404
    const none = await fetchVenueList(kind, { city });
    assert.deepEqual([none.venues, none.total, none.notFound, none.url], [[], 0, true, url], city);
  }
  assert.equal((await fetchVenueList("byob", { city: "warangal" })).fromCache, true);       // cached like any list
  const hubli = await fetchVenueList("bar", { city: "hubli-dharwad" });
  assert.deepEqual([hubli.venues.length, hubli.notFound], [4, undefined]);
  // A page that no longer says which filters it applied can't be trusted either way.
  await assert.rejects(fetchVenueList("byob", { city: "kanpur" }), /Zomato page format changed/);
  await assert.rejects(fetchVenueList("club", { city: "gurgaon" }), /No Zomato list/);
});

test("fetchVenue: one District GET, no cookie, 6 h cache, friendly errors", async () => {
  const soi = { zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city" };
  const net = fakeNet({
    "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city": fx("venue_soi7.html"),
    "https://www.district.in/dining/ncr/down-for-now": new HttpError(503, "x"),
    "https://www.district.in/dining/ncr/offline": new Error("timeout"),
  });
  const v = await fetchVenue(soi);
  assert.deepEqual(net.calls, [{ url: "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city", cookie: null }]);
  assert.equal(v.bookUrl, "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city/book");
  assert.deepEqual([v.name, v.bookable, v.fromCache], ["Soi 7 Pub & Brewery", true, false]);
  assert.ok(net.db.has("dv:ncr/soi-7-pub-brewery-dlf-cyber-city"));
  assert.equal((await fetchVenue(soi)).fromCache, true);
  net.tick(6 * HOUR + 1);
  assert.equal((await fetchVenue(soi)).fromCache, false);
  assert.equal(net.calls.length, 2);
  await assert.rejects(fetchVenue({ zcity: "ncr", slug: "gone" }), /District has no page for this place/);
  await assert.rejects(fetchVenue({ zcity: "ncr", slug: "down-for-now" }), /District returned 503/);
  await assert.rejects(fetchVenue({ zcity: "ncr", slug: "offline" }), /Network error: timeout/);
  const before = net.calls.length;
  await assert.rejects(fetchVenue({ zcity: "ncr", slug: "x?page=2" }), /doesn't look like a District page/);
  await assert.rejects(fetchVenue({ zcity: "../gw", slug: "x" }), /doesn't look like a District page/);
  assert.equal(net.calls.length, before);
});

test("fetchEventList: one listing page per genre, merged by slug, 3 h cache", async () => {
  const list = fx("events_nightlife-in-gurgaon.html");
  const net = fakeNet({
    "https://www.district.in/events/nightlife-in-gurgaon-book-tickets": list,
    "https://www.district.in/events/food-drinks-in-gurgaon-book-tickets": list,       // same events: de-duplicated
    "https://www.district.in/events/social-mixers-in-gurgaon-book-tickets": fx("events_nonsense-genre-in-gurgaon.html"),
  });
  const club = await fetchEventList(["nightlife"], { city: "gurgaon" });
  assert.deepEqual([club.events.length, net.calls.length, club.fromCache], [12, 1, false]);
  assert.deepEqual(club.urls, ["https://www.district.in/events/nightlife-in-gurgaon-book-tickets"]);
  assert.ok(net.db.has("ev:list:nightlife:gurgaon"));
  const food = await fetchEventList(["food-drinks", "social-mixers"], { city: "gurgaon" });
  assert.deepEqual([food.events.length, net.calls.length], [12, 3]);
  assert.equal((await fetchEventList(["nightlife"], { city: "gurgaon" })).fromCache, true);
  net.tick(3 * HOUR + 1);
  await fetchEventList(["nightlife"], { city: "gurgaon" });
  assert.equal(net.calls.length, 4);
  // No District event pages for the city: nothing is fetched.
  const none = await fetchEventList(["nightlife"], { city: "warangal" });
  assert.deepEqual([none.events, none.urls, net.calls.length], [[], [], 4]);
  await assert.rejects(fetchEventList(["nightlife"], { city: "noida" }), /District returned 404/);
});

test("fetchEventList: weekend pages have their own key", async () => {
  const net = fakeNet({ "https://www.district.in/events/nightlife-this-weekend-in-gurgaon": fx("events_nightlife-in-gurgaon.html") });
  await fetchEventList(["nightlife"], { city: "gurgaon", weekend: true });
  assert.deepEqual(net.calls.map((c) => c.url), ["https://www.district.in/events/nightlife-this-weekend-in-gurgaon"]);
  assert.ok(net.db.has("ev:list:nightlife:gurgaon:wk"));
});

test("fetchEvent: one GET of the event page, 1 h cache", async () => {
  const slug = "giada-brince-xlive-saturday-oct3-2026";
  const net = fakeNet({ [`https://www.district.in/events/${slug}-buy-tickets`]: fx("event_xlive.html") });
  const e = await fetchEvent(slug);
  assert.deepEqual([e.slug, e.url, e.priceFrom, e.tickets.length], [slug, `https://www.district.in/events/${slug}-buy-tickets`, 499, 3]);
  assert.ok(net.db.has(`ev:${slug}`));
  assert.equal((await fetchEvent(slug)).fromCache, true);
  net.tick(HOUR + 1);
  assert.equal((await fetchEvent(slug)).fromCache, false);
  assert.equal(net.calls.length, 2);
  await assert.rejects(fetchEvent("gone-oct1-2026"), /isn't on District any more/);
  await assert.rejects(fetchEvent("a/b"), /doesn't look like a District page/);
  for (const c of net.calls) assert.ok(!c.url.includes("?") && !c.url.includes("/gw/"), c.url);
});
