import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rankVenues, eventsForDate, outingCost, leaveBy, minusMinutes, travelMinutes, kmBetween, kmText, countText,
  istDate, istClock, onNight, dayHours, hoursText, closedOn, weekday, showFor, alignParty, venuePick, eventPick,
  doorRules, ticketKindLabel, serviceText, gateCoverText, ticketPeople, gateCoverTotal, planTicket, clampQty,
  refreshTickets, bottlesOf, isByobPick, venueKey, costForTwoText, eventPriceText, feeText, ageLine,
  offerText, eventWhenText, freshEventPick, directionsUrl,
} from "../src/lib/out.js";
import { DEFAULT_OUT } from "../src/lib/outModel.js";

const SEC57 = { lat: 28.4595, lon: 77.0266 };          // Sector 57, Gurugram
const NOW = Date.parse("2026-10-03T12:00:00Z");
const party = { guests: 10, date: "2026-10-10", time: "20:00" }; // a Saturday

const v = (o) => ({ resId: 0, name: "", zcity: "ncr", slug: "", locality: "", costForTwo: null, rating: null, votes: null, distanceKm: null, timing: "", offer: "", promoted: false, cuisines: [], ...o });
const VENUES = [
  v({ resId: 1, name: "Soi 7 Pub & Brewery", slug: "soi-7-pub-brewery-dlf-cyber-city", locality: "DLF Cyber City", costForTwo: 2800, rating: 4.3, votes: 7512, distanceKm: 6.2, offer: "FLAT 20% OFF" }),
  v({ resId: 2, name: "Cheap Tavern", slug: "cheap-tavern-sector-29", costForTwo: 1200, rating: 3.9, distanceKm: 4.1 }),
  v({ resId: 3, name: "Mystery Bar", slug: "mystery-bar", costForTwo: null, rating: 4.0, distanceKm: 2 }),
  v({ resId: 4, name: "Near Pub", slug: "near-pub", costForTwo: 2000, rating: 4.1, distanceKm: 1.2 }),
  v({ resId: 5, name: "Club Ebowla BYOB", slug: "club-ebowla-byob-sector-30-gurgaon", costForTwo: 1000, rating: 4.0, distanceKm: 8 }),
];
const names = (rows) => rows.map((r) => r.name);

// ── Venues ──────────────────────────────────────────────────────────────────

test("venues: within the budget a head first, then unknown cost, then over; nearest first inside each", () => {
  const rows = rankVenues(VENUES, { budgetPerHead: 1000, people: 10 });
  assert.deepEqual(names(rows), ["Near Pub", "Cheap Tavern", "Club Ebowla BYOB", "Mystery Bar", "Soi 7 Pub & Brewery"]);
  assert.deepEqual(rows.map((r) => r.fit), ["fits", "fits", "fits", "unknown", "over"]);
  assert.equal(rows[0].perHead, 1000);                    // ₹2,000 for two ÷ 2 — exactly the cap still fits
  assert.equal(rows[0].partyCost, 10000);
  assert.equal(rows.at(-1).perHead, 1400);
  assert.equal(rows[3].perHead, null);
});

test("venues: the budget filter drops only the ones over it", () => {
  const rows = rankVenues(VENUES, { budgetPerHead: 1000, fitsOnly: true });
  assert.ok(!names(rows).includes("Soi 7 Pub & Brewery"));
  assert.ok(names(rows).includes("Mystery Bar"), "an unlisted cost isn't over the budget");
  assert.equal(rows.length, 4);
  // no budget: nothing is filtered or marked, nearest first
  const all = rankVenues(VENUES, { fitsOnly: true });
  assert.equal(all.length, 5);
  assert.ok(all.every((r) => r.fit === null));
  assert.deepEqual(names(all).slice(0, 2), ["Near Pub", "Mystery Bar"]);
});

test("venues: bottles you bring count against a BYOB budget", () => {
  const rows = rankVenues(VENUES, { budgetPerHead: 1000, kind: "byob", extraPerHead: 600 });
  const ebowla = rows.find((r) => r.resId === 5);
  assert.equal(ebowla.perHead, 1100);
  assert.equal(ebowla.fit, "over");
  assert.ok(ebowla.reasons.includes("BYOB: bring your Cabinet"));
});

test("venues: reasons say why — budget, distance, BYOB, bookings", () => {
  const details = { "ncr/club-ebowla-byob-sector-30-gurgaon": { amenities: ["BYOB", "Large group seating", "DJ"], bookable: true, hours: [] } };
  const rows = rankVenues(VENUES, { budgetPerHead: 1300, details });
  const ebowla = rows.find((r) => r.resId === 5);
  assert.deepEqual(ebowla.reasons, ["Fits ₹1,300 a head", "8 km", "BYOB: bring your Cabinet", "Takes table bookings"]);
  assert.equal(ebowla.bookable, true);
  const near = rows.find((r) => r.resId === 4);
  assert.deepEqual(near.reasons, ["Fits ₹1,300 a head", "1.2 km"]);
  assert.equal(near.bookable, null, "not known until its District page is opened");
  const soi = rows.find((r) => r.resId === 1);
  assert.deepEqual(soi.reasons, ["6.2 km"], "₹1,400 a head is over ₹1,300: no budget reason");
  assert.equal(soi.fit, "over");
});

test("venues: Big group puts large-group places first and says so", () => {
  const details = {
    "ncr/club-ebowla-byob-sector-30-gurgaon": { amenities: ["BYOB", "Large group seating"], bookable: false },
    "ncr/cheap-tavern-sector-29": { amenities: ["Private dining area"], bookable: true },
  };
  const rows = rankVenues(VENUES, { bigGroup: true, details });
  assert.deepEqual(names(rows).slice(0, 2), ["Cheap Tavern", "Club Ebowla BYOB"]);
  assert.equal(rows[0].reasons[0], "Private dining area");
  assert.equal(rows[1].reasons[0], "Large group seating");
  assert.ok(rows[0].big && !rows[2].big);
  // without the toggle the same details don't jump the queue
  assert.equal(rankVenues(VENUES, { details })[0].name, "Near Pub");
});

test("venues: a place whose listed hours skip the party's day goes last", () => {
  const details = { "ncr/near-pub": { amenities: [], hours: [{ day: "Monday", opens: "12:00", closes: "23:00" }] } };
  const rows = rankVenues(VENUES, { date: party.date, details });
  assert.equal(rows.at(-1).name, "Near Pub");
  assert.ok(rows.at(-1).closed);
  assert.ok(rows.at(-1).reasons.includes("Closed on Saturdays (listed hours)"));
  assert.ok(!rankVenues(VENUES, { details })[0].closed, "no date, no check");
});

test("venues: empty and odd input", () => {
  assert.deepEqual(rankVenues([]), []);
  assert.deepEqual(rankVenues(null), []);
  assert.equal(rankVenues([null, v({ name: "X" })]).length, 1);
  assert.equal(venueKey(VENUES[0]), "ncr/soi-7-pub-brewery-dlf-cyber-city");
  assert.equal(venueKey({ resId: 9 }), "9");
});

test("listed hours: the after-midnight row joins the evening, closed days are spotted", () => {
  const hours = [
    { day: "Saturday", opens: "13:00", closes: "23:59" },
    { day: "Saturday", opens: "00:00", closes: "02:00" },
    { day: "Sunday", opens: "12:00", closes: "23:00" },
  ];
  assert.equal(weekday("2026-10-10"), "Saturday");
  assert.deepEqual(dayHours(hours, "2026-10-10"), [{ opens: "13:00", closes: "02:00" }]);
  assert.equal(hoursText(dayHours(hours, "2026-10-10")), "1:00 pm – 2:00 am");
  assert.deepEqual(dayHours(hours, "2026-10-11"), [{ opens: "12:00", closes: "23:00" }]);
  assert.deepEqual(dayHours(hours, "2026-10-12"), []);
  assert.ok(closedOn(hours, "2026-10-12"));
  assert.ok(!closedOn([], "2026-10-12"), "no hours listed isn't 'closed'");
  // lunch and dinner stay two spans
  const split = [{ day: "Friday", opens: "19:00", closes: "23:30" }, { day: "Friday", opens: "12:00", closes: "15:30" }];
  assert.equal(hoursText(dayHours(split, "2026-10-09")), "12:00 pm – 3:30 pm, 7:00 pm – 11:30 pm");
});

test("venuePick keeps what the summary, invite and rides need", () => {
  const d = { resId: 5, name: "Club Ebowla BYOB", lat: 28.4593, lon: 77.0614, address: "Sector 30", phone: "+91 98100 00000", amenities: ["BYOB"], bookable: true, hours: [], costForTwo: null, fetchedAt: 123 };
  const p = venuePick(VENUES[4], d, { kind: "byob", date: party.date });
  assert.equal(p.type, "venue");
  assert.equal(p.url, "https://www.district.in/dining/ncr/club-ebowla-byob-sector-30-gurgaon");
  assert.equal(p.costForTwo, 1000, "the list's cost when the page has none");
  assert.equal(p.outKind, "byob");
  assert.deepEqual([p.lat, p.lon, p.bookable, p.phone, p.fetchedAt], [28.4593, 77.0614, true, "+91 98100 00000", 123]);
  assert.equal(typeof p.closes, "string");
  assert.ok(isByobPick(p));
  // the page couldn't be read: the list card alone still makes a pick
  const bare = venuePick(VENUES[0], null, { kind: "bar" });
  assert.equal(bare.name, "Soi 7 Pub & Brewery");
  assert.equal(bare.lat, null);
  assert.ok(!isByobPick(bare));
  assert.ok(isByobPick({ type: "venue", tags: ["Full bar available", "BYOB"] }));
});

// ── Events ──────────────────────────────────────────────────────────────────

const ev = (o) => ({ slug: "", name: "", venue: "", locality: "", lat: null, lon: null, start: "", end: "", priceFrom: null, ...o });
const EVENTS = [
  ev({ slug: "fri-late", name: "Friday Late", lat: 28.4950, lon: 77.0890, start: "2026-10-09T16:30:00Z", end: "2026-10-09T22:30:00Z", priceFrom: 999 }),     // Fri 10 pm – Sat 4 am
  ev({ slug: "sat-night", name: "Saturday Night", lat: 28.4950, lon: 77.0890, start: "2026-10-10T15:30:00Z", end: "2026-10-10T21:30:00Z", priceFrom: 1800 }), // Sat 9 pm – Sun 3 am
  ev({ slug: "noida-sat", name: "Noida Saturday", lat: 28.5700, lon: 77.3210, start: "2026-10-10T15:30:00Z", end: "2026-10-10T20:30:00Z", priceFrom: 500 }),
  ev({ slug: "month-run", name: "Month of Brews", lat: 28.4700, lon: 77.0400, start: "2026-10-07T12:30:00Z", end: "2026-11-04T17:30:00Z", priceFrom: 0 }),
  ev({ slug: "no-pin", name: "Sunday Brunch", start: "2026-10-11T07:00:00Z", end: "2026-10-11T11:00:00Z", priceFrom: 2500 }),
  ev({ slug: "over", name: "Last Week", lat: 28.4950, lon: 77.0890, start: "2026-10-01T15:30:00Z", end: "2026-10-01T20:30:00Z", priceFrom: 700 }),
  ev({ slug: "sat-pricey", name: "VIP Saturday", lat: 28.4600, lon: 77.0300, start: "2026-10-10T16:30:00Z", end: "2026-10-10T21:30:00Z", priceFrom: 4000 }),
];

test("events: the party's night by IST, an after-midnight finish belongs to the evening before", () => {
  assert.ok(onNight("2026-10-10T15:30:00Z", "2026-10-10T21:30:00Z", "2026-10-10"));
  assert.ok(!onNight("2026-10-09T16:30:00Z", "2026-10-09T22:30:00Z", "2026-10-10"), "Friday 10 pm – Saturday 4 am is Friday's night");
  assert.ok(onNight("2026-10-07T12:30:00Z", "2026-11-04T17:30:00Z", "2026-10-10"), "a month-long run covers the date");
  assert.ok(onNight("2026-10-10T05:30:00Z", "", "2026-10-10"), "11 am brunch, no end given");
  assert.ok(!onNight("2026-10-11T01:00:00Z", "", "2026-10-10"), "6:30 am Sunday is the next day");
  assert.ok(!onNight("garbage", "", "2026-10-10"));
  assert.equal(istDate("2026-10-10T19:00:00Z"), "2026-10-11");
  assert.equal(istClock("2026-10-10T15:30:00Z"), "21:00");
  assert.equal(istDate("nope"), "");
});

test("events: the 25 km cut, events already over dropped, the party's night first", () => {
  const rows = eventsForDate(EVENTS, party.date, SEC57, 25, { now: NOW });
  const slugs = rows.map((r) => r.slug);
  assert.ok(!slugs.includes("noida-sat"), "Noida is ~30 km from Sector 57");
  assert.ok(kmBetween(SEC57, EVENTS[2]) > 25);
  assert.ok(!slugs.includes("over"), "already over");
  assert.ok(slugs.includes("no-pin"), "no map pin: can't tell, so it stays");
  assert.deepEqual(rows.filter((r) => r.onDate).map((r) => r.slug).sort(), ["month-run", "sat-night", "sat-pricey"]);
  assert.ok(rows.slice(0, 3).every((r) => r.onDate), "the party's night comes first");
  // on the night: nearest first; other nights: soonest first
  assert.deepEqual(slugs, ["sat-pricey", "month-run", "sat-night", "fri-late", "no-pin"]);
  const sat = rows.find((r) => r.slug === "sat-night");
  assert.ok(sat.km > 5 && sat.km < 10);
  assert.deepEqual(sat.reasons, ["On your date", kmText(sat.km)]);
  assert.equal(rows.find((r) => r.slug === "no-pin").km, null);
});

test("events: within the budget a head before the ones over it, on the night", () => {
  const rows = eventsForDate(EVENTS, party.date, SEC57, 25, { now: NOW, budgetPerHead: 2000 });
  assert.deepEqual(rows.filter((r) => r.onDate).map((r) => r.slug), ["month-run", "sat-night", "sat-pricey"]);
  assert.deepEqual(rows.map((r) => r.fit).slice(0, 3), ["fits", "fits", "over"]);
  assert.ok(rows[0].reasons.includes("Free"));
  assert.ok(rows[1].reasons.includes("Fits ₹2,000 a head"));
});

test("events: no location = no distance cut; a wider radius lets Noida in", () => {
  assert.ok(eventsForDate(EVENTS, party.date, null, 25, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.ok(eventsForDate(EVENTS, party.date, SEC57, 50, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.ok(eventsForDate(EVENTS, party.date, SEC57, null, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.deepEqual(eventsForDate([], party.date, SEC57), []);
  assert.deepEqual(eventsForDate(undefined, party.date, SEC57), []);
});

test("shows: the party's night preselected, else the next one; a move offered for another night", () => {
  const shows = [
    { start: "2026-10-03T15:30:00Z", end: "2026-10-03T20:30:00Z" },
    { start: "2026-10-10T15:30:00Z", end: "2026-10-10T20:30:00Z" },
    { start: "2026-10-17T15:30:00Z", end: "2026-10-17T20:30:00Z" },
  ];
  assert.equal(showFor(shows, "2026-10-10", NOW), 1);
  assert.equal(showFor(shows, "2026-10-12", NOW), 0, "3 Oct's show hasn't ended at noon UTC");
  assert.equal(showFor(shows, "2026-10-12", Date.parse("2026-10-05T00:00:00Z")), 1);
  assert.equal(showFor([], "2026-10-10"), -1);
  assert.equal(alignParty(shows[1], party), null);
  assert.deepEqual(alignParty(shows[2], party), { date: "2026-10-17", time: "21:00" });
  assert.equal(alignParty({ start: "2026-10-12T05:00:00Z", end: "2026-10-20T17:00:00Z" }, party), null, "a festival run isn't a single night");
  assert.equal(alignParty({}, party), null);
});

test("eventPick keeps the chosen show, the fee and the organiser's door rules", () => {
  const d = {
    slug: "sat-night", name: "Saturday Night", description: "", venue: "Room XO", address: "Sector 29", lat: 28.47, lon: 77.06,
    shows: [{ start: "2026-10-03T15:30:00Z", end: "2026-10-03T20:30:00Z" }, { start: "2026-10-10T15:30:00Z", end: "2026-10-10T20:30:00Z" }],
    rules: { ageEntry: 21, stag: "Stag entry not allowed", id: "", dress: "", reentry: "" }, tickets: [], priceFrom: 1800, feePct: 0.07,
  };
  const p = eventPick(EVENTS[1], d, d.shows[1], { kind: "club" });
  assert.equal(p.type, "event");
  assert.equal(p.url, "https://www.district.in/events/sat-night-buy-tickets");
  assert.equal(p.start, "2026-10-10T15:30:00Z");
  assert.deepEqual([p.venue, p.priceFrom, p.ageEntry, p.stag, p.feePct, p.outKind], ["Room XO", 1800, 21, "Stag entry not allowed", 0.07, "club"]);
  const bare = eventPick(EVENTS[1], null, null);
  assert.equal(bare.start, EVENTS[1].start);
  assert.equal(bare.feePct, 0);
  // reopening the picked event refreshes its price and rules, not the chosen show
  const fresh = freshEventPick(p, { ...d, priceFrom: 2000, rules: { ...d.rules, ageEntry: 25 }, fetchedAt: 456 });
  assert.deepEqual([fresh.start, fresh.priceFrom, fresh.ageEntry, fresh.fetchedAt, fresh.outKind], ["2026-10-10T15:30:00Z", 2000, 25, 456, "club"]);
  assert.equal(freshEventPick(p, null), p);
});

test("door rules read as the organiser's, with labels where the text has none", () => {
  assert.deepEqual(doorRules({ ageEntry: 21, stag: "Stag entry not allowed", id: "Govt ID required", dress: "Smart casuals", reentry: "No re-entry" }),
    ["Entry 21+ (organiser's rule)", "Stag entry not allowed", "Govt ID required", "Dress code: Smart casuals", "No re-entry"]);
  assert.deepEqual(doorRules({ ageEntry: null, stag: "", id: "", dress: "", reentry: "" }), []);
  assert.deepEqual(doorRules(null), []);
});

// ── Tickets ─────────────────────────────────────────────────────────────────

test("tickets: kinds, cover vs entry, gate cover from the text, people per ticket", () => {
  assert.equal(ticketKindLabel({ kind: "couple" }), "Couple");
  assert.equal(ticketKindLabel({ kind: "group", groupSize: 5 }), "Group of 5");
  assert.equal(ticketKindLabel({ kind: "general" }), "");
  assert.equal(serviceText("cover"), "Cover: redeemable on food & drinks");
  assert.equal(serviceText("entry"), "Entry fee");
  assert.equal(serviceText(null), "");
  assert.equal(gateCoverText({ amount: 1500, per: "person" }), "+ ₹1,500 at the gate a person (event's text)");
  assert.equal(gateCoverText({ amount: 2500, per: "couple" }), "+ ₹2,500 at the gate a couple (event's text)");
  assert.equal(gateCoverText(null), "");
  assert.equal(ticketPeople({ kind: "couple" }), 2);
  assert.equal(ticketPeople({ kind: "group", groupSize: 6 }), 6);
  assert.equal(ticketPeople({ kind: "stag" }), 1);
  assert.equal(gateCoverTotal({ kind: "couple", qty: 2, gateCover: { amount: 1000, per: "person" } }), 4000);
  assert.equal(gateCoverTotal({ kind: "couple", qty: 2, gateCover: { amount: 2500, per: "couple" } }), 5000);
  assert.equal(gateCoverTotal({ kind: "stag", qty: 3, gateCover: { amount: 1500, per: null } }), 4500);
  assert.equal(gateCoverTotal({ kind: "stag", qty: 0, gateCover: { amount: 1500, per: "person" } }), 0);
});

test("tickets: the qty stepper stays inside District's per-order limits", () => {
  const t = { min: 2, max: 6 };
  assert.equal(clampQty(t, 1, 0), 2, "first tap jumps to the minimum");
  assert.equal(clampQty(t, 7, 6), 6);
  assert.equal(clampQty(t, 1, 2), 0, "below the minimum = none");
  assert.equal(clampQty(t, 4, 5), 4);
  assert.equal(clampQty({}, 1, 0), 1);
  assert.equal(clampQty({}, 11, 10), 10, "no max given: 10");
  assert.equal(clampQty(t, 0, 3), 0);
});

test("tickets: planned ones keep their shape and take fresh prices by id", () => {
  const t = { id: "a", name: "Couple Entry", price: 2000, min: 1, max: 4, buyable: true, kind: "couple", groupSize: 2, service: "cover", gateCover: null, description: "" };
  const p = planTicket(t, 2);
  assert.deepEqual(p, { id: "a", name: "Couple Entry", price: 2000, qty: 2, kind: "couple", service: "cover", gateCover: null, groupSize: 2 });
  const fresh = refreshTickets([p, { id: "gone", name: "Old", price: 100, qty: 1 }], [{ ...t, price: 2200 }]);
  assert.equal(fresh[0].price, 2200);
  assert.equal(fresh[0].qty, 2);
  assert.equal(fresh[1].price, 100);
});

// ── The night's cost ────────────────────────────────────────────────────────

const lines = [
  { key: "malts:1", cat: "malts", qty: 2, item: { price: 3000 } },
  { key: "beer:2", cat: "beer", qty: 6, item: { price: 200 } },
];

test("cost: a bar is the venue's estimate a head, nothing to bring", () => {
  const out = { ...DEFAULT_OUT, active: true, pick: venuePick(VENUES[0], null, { kind: "bar" }) };
  const c = outingCost({ out, party, liquorLines: lines });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [["venue", "estimate", 14000]]);
  assert.equal(c.lines[0].label, "₹2,800 for two × 10 (the venue's estimate)");
  assert.equal(c.total, 14000);
  assert.equal(c.perHead, 1400);
  assert.equal(c.unknown, false);
});

test("cost: an unlisted venue cost is unknown, not zero", () => {
  const out = { ...DEFAULT_OUT, active: true, pick: venuePick(VENUES[2], null) };
  const c = outingCost({ out, party });
  assert.deepEqual(c.lines.map((l) => [l.kind, l.amount]), [["unknown", null]]);
  assert.equal(c.total, 0);
  assert.ok(c.unknown);
});

test("cost: BYOB adds the bottles you bring (estimate) and corkage only once quoted", () => {
  const pick = venuePick(VENUES[4], { amenities: ["BYOB"], hours: [] }, { kind: "byob" });
  const base = { ...DEFAULT_OUT, active: true, pick };
  const c = outingCost({ out: base, party, liquorLines: lines });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [
    ["venue", "estimate", 5000], ["bottles", "estimate", 7200], ["corkage", "unknown", null],
  ]);
  assert.equal(c.lines[1].label, "8 bottles you bring (indicative prices)");
  assert.equal(c.total, 12200);
  assert.equal(c.perHead, 1220);
  assert.ok(c.unknown);
  const q = outingCost({ out: { ...base, corkage: 300 }, party, liquorLines: lines });
  assert.deepEqual(q.lines.at(-1), { id: "corkage", label: "Corkage ₹300 × 8 (the venue's quote)", amount: 2400, kind: "estimate" });
  assert.equal(q.total, 14600);
  assert.equal(q.unknown, false);
  const free = outingCost({ out: { ...base, corkage: 0 }, party, liquorLines: lines });
  assert.equal(free.lines.at(-1).amount, 0, "a venue that charges no corkage");
  // an empty cabinet: no bottle or corkage lines
  assert.deepEqual(outingCost({ out: base, party, liquorLines: [] }).lines.map((l) => l.id), ["venue"]);
});

test("cost: planned tickets are exact; the fee and the gate cover are estimates", () => {
  const pick = { ...eventPick(EVENTS[1], { feePct: 0.07, rules: {}, shows: [] }, null), outKind: "club" };
  const tickets = [
    planTicket({ id: "c", name: "Couple", price: 3000, kind: "couple", groupSize: 2, service: "entry", gateCover: { amount: 2500, per: "couple" } }, 3),
    planTicket({ id: "s", name: "Female Stag", price: 1000, kind: "female", service: "cover", gateCover: null }, 4),
    planTicket({ id: "x", name: "Not going", price: 9000, kind: "stag" }, 0),
  ];
  const c = outingCost({ out: { ...DEFAULT_OUT, active: true, pick, tickets }, party });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [
    ["tickets", "exact", 13000], ["fee", "estimate", Math.round(13000 * 0.07 * 1.18)], ["gate", "estimate", 7500],
  ]);
  assert.equal(c.lines[0].label, "7 tickets on District");
  assert.equal(c.lines[1].label, "District fee (up to 7% + GST)");
  assert.equal(c.total, 13000 + 1074 + 7500);
  assert.equal(c.perHead, Math.round(c.total / 10));
});

test("cost: an event before tickets are picked — from-price × people, free, or unknown", () => {
  const out = (priceFrom) => ({ ...DEFAULT_OUT, active: true, pick: { ...eventPick({ ...EVENTS[1], priceFrom }, null, null) } });
  assert.deepEqual(outingCost({ out: out(999), party }).lines.map((l) => [l.kind, l.amount]), [["estimate", 9990]]);
  assert.deepEqual(outingCost({ out: out(0), party }).lines.map((l) => [l.kind, l.amount]), [["exact", 0]]);
  assert.deepEqual(outingCost({ out: out(null), party }).lines.map((l) => [l.kind, l.amount]), [["unknown", null]]);
});

test("cost: per head rounds, works when the party is set to Home, and nothing picked is nothing", () => {
  const pick = venuePick(v({ name: "Odd", slug: "odd", costForTwo: 1001 }), null);
  const c = outingCost({ out: { ...DEFAULT_OUT, active: false, pick }, party: { guests: 3 } });
  assert.equal(c.total, Math.round(500.5 * 3));
  assert.equal(c.perHead, Math.round(c.total / 3));
  assert.deepEqual(outingCost({ out: DEFAULT_OUT, party }), { lines: [], total: 0, perHead: 0, people: 10, unknown: false });
  assert.equal(outingCost({ out: DEFAULT_OUT, party: { guests: 0 } }).people, 1);
  assert.equal(outingCost().people, 1);
});

test("bottles you bring", () => {
  assert.deepEqual(bottlesOf(lines), { bottles: 8, total: 7200 });
  assert.deepEqual(bottlesOf([]), { bottles: 0, total: 0 });
  assert.deepEqual(bottlesOf(null), { bottles: 0, total: 0 });
});

// ── Getting there ───────────────────────────────────────────────────────────

test("travel time rounds up to 5 minutes; leave-by counts back from the party's time", () => {
  assert.equal(travelMinutes(null), null);
  assert.equal(travelMinutes(0), 10);
  assert.equal(travelMinutes(5), 35);                      // 10 + 5 × 1.4 / 20 × 60 = 31 → 35
  assert.equal(travelMinutes(7.3), 45);                    // 10 + 30.66 = 40.7 → 45
  assert.equal(minusMinutes("20:00", 25), "19:35");
  assert.equal(minusMinutes("00:20", 25), "23:55");
  assert.equal(minusMinutes("9:05", 5), "09:00");
  assert.equal(minusMinutes("", 5), "");
  const to = { lat: 28.4950, lon: 77.0890 };
  const l = leaveBy({ party, from: SEC57, to });
  assert.equal(l.minutes, travelMinutes(kmBetween(SEC57, to)));
  assert.equal(l.time, minusMinutes("20:00", l.minutes));
  assert.equal(leaveBy({ party, from: null, to }), null);
  assert.equal(leaveBy({ party, from: SEC57, to: { lat: null, lon: null } }), null);
  assert.equal(leaveBy({ party: {}, from: SEC57, to: SEC57 }).time, "19:50", "no time set = 8 pm");
  assert.equal(directionsUrl(28.4593, 77.0614), "https://www.google.com/maps/dir/?api=1&destination=28.4593,77.0614");
  assert.equal(directionsUrl(null, 77), null);
});

test("labels are honest and short", () => {
  assert.equal(kmText(0.83), "850 m");
  assert.equal(kmText(0.01), "50 m");
  assert.equal(kmText(2.84), "2.8 km");
  assert.equal(kmText(3), "3 km");
  assert.equal(kmText(12.4), "12 km");
  assert.equal(kmText(null), "");
  assert.equal(countText(980), "980");
  assert.equal(countText(1234), "1.2k");
  assert.equal(countText(7512), "7.5k");
  assert.equal(countText(12000), "12k");
  assert.equal(countText(null), "");
  assert.equal(costForTwoText(2400), "₹2,400 for two (estimate)");
  assert.equal(costForTwoText(null), "Cost not listed");
  assert.equal(eventPriceText(999), "from ₹999");
  assert.equal(eventPriceText(0), "Free");
  assert.equal(eventPriceText(null), "Price on District");
  assert.equal(feeText(0.07), "+ District fee up to 7% + GST where charged");
  assert.equal(feeText(0.059), "+ District fee up to 5.9% + GST where charged");
  assert.equal(feeText(0), "+ any District fee and GST, shown at checkout");
  assert.equal(ageLine({ state: "Haryana", age: 21 }), "Legal drinking age in Haryana: 21. Carry ID: bars and clubs check.");
  assert.equal(ageLine({ state: "Maharashtra", age: 25, beer: 21 }), "Legal drinking age in Maharashtra: 25 (21 for beer). Carry ID: bars and clubs check.");
  assert.equal(ageLine(null), "");
  assert.equal(offerText("FLAT \\n20% OFF"), "Flat 20% off");
  assert.equal(offerText("10% OFF"), "10% off");
  assert.equal(offerText("Flat 15% off on bill"), "Flat 15% off on bill");
  assert.equal(offerText(null), "");
  assert.match(eventWhenText("2026-10-10T15:30:00Z", "2026-10-10T21:30:00Z"), /10.*Oct.* · 9:00 pm$/);
  assert.match(eventWhenText("2026-10-07T12:30:00Z", "2026-11-04T17:30:00Z"), /^7 Oct.* – 4 Nov/);
  assert.equal(eventWhenText("", ""), "");
});
