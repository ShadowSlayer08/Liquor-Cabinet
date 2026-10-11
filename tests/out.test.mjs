import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  rankVenues, eventsForDate, outingCost, nightTimes, travelMinutes, kmBetween, kmText, countText,
  istDate, istClock, onNight, dayHours, hoursText, closedOn, weekday, showFor, showOver, alignParty, venuePick, pickForDate, eventPick, timingText,
  doorRules, stagText, ticketKindLabel, serviceText, gateCoverText, ticketPeople, gateCoverTotal, planTicket, plannedTickets, clampQty,
  refreshTickets, bottlesOf, isByobPick, venueKey, costForTwoText, eventPriceText, feeText, venueListNote, pickNote,
  offerText, eventWhenText, freshEventPick, directionsUrl, ticketKey, matchTicket, qtyFromPlan, ticketsForStart, outForDate, RUN_REASON,
  keptTicket, showOnDate,
} from "../src/lib/out.js";
import { DEFAULT_OUT } from "../src/lib/outModel.js";
import { leaveBy, closesAt, lastCallFor, byobNight, LEAVE_MAX_KM } from "../src/lib/reminderPlan.js";
import { clockOf } from "../src/lib/when.js";
import { parseVenuePage, parseEventPage, parseEventList, parseEventData, ticketsForShow } from "../src/lib/parse/district.js";
import { parseVenueListPage } from "../src/lib/parse/zomato.js";

const fx = (f) => readFileSync(new URL(`./fixtures/district/${f}`, import.meta.url), "utf8");

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

// Soi 7's listed hours (District files the after-midnight part under the same day).
const LATE = (day, late) => [{ day, opens: "13:00", closes: "23:59" }, { day, opens: "00:00", closes: late }];
const SOI7_HOURS = [...LATE("Monday", "02:00"), ...LATE("Saturday", "03:00"), ...LATE("Sunday", "03:00")];

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
  // on the bars list the bottles count only where District lists BYOB, as in the night's cost lines
  const details = { "ncr/club-ebowla-byob-sector-30-gurgaon": { amenities: ["BYOB"], hours: [] } };
  const bars = rankVenues(VENUES, { budgetPerHead: 1000, kind: "bar", extraPerHead: 600, details });
  assert.equal(bars.find((r) => r.resId === 5).perHead, 1100);
  assert.equal(bars.find((r) => r.resId === 2).perHead, 600, "a bar that isn't BYOB: no bottles to bring");
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

test("venue list note: Zomato's BYOB page is thin outside Delhi NCR", () => {
  assert.equal(venueListNote({ kind: "byob", zcity: "ncr" }), "");
  assert.equal(venueListNote({ kind: "byob", zcity: "bangalore" }), "Few BYOB places are listed for this city on Zomato.");
  assert.equal(venueListNote({ kind: "byob", zcity: "sohna" }), "Few BYOB places are listed for this city on Zomato.");
  assert.equal(venueListNote({ kind: "bar", zcity: "bangalore" }), "", "bars are listed everywhere");
  assert.equal(venueListNote({ kind: "byob", zcity: "" }), "");
  assert.equal(venueListNote(), "");
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
  assert.equal(p.kind, "byob", "the outing type rides along (reminderPlan's byobNight, the art)");
  assert.deepEqual([p.lat, p.lon, p.bookable, p.phone, p.fetchedAt], [28.4593, 77.0614, true, "+91 98100 00000", 123]);
  assert.equal(p.closes, "", "no listed hours, no closing time");
  assert.equal(p.closesFor, null);
  assert.ok(isByobPick(p));
  // the page couldn't be read: the list card alone still makes a pick
  const bare = venuePick(VENUES[0], null, { kind: "bar" });
  assert.equal(bare.name, "Soi 7 Pub & Brewery");
  assert.equal(bare.lat, null);
  assert.equal(bare.url, "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city");
  assert.ok(!isByobPick(bare));
  assert.ok(isByobPick({ type: "venue", tags: ["Full bar available", "BYOB"] }));
  assert.ok(!isByobPick({ type: "event", kind: "byob" }), "only a venue is a BYOB night");
});

test("venuePick: the closing time for the party's night, the first phone, the page's own city and slug", () => {
  const d = { name: "Soi 7 Pub & Brewery", zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city", locality: "DLF Cyber City",
    phone: "+918130261700", phones: ["+918130261700", "+917678431199"], hours: SOI7_HOURS, amenities: ["Full bar available"] };
  const p = venuePick({ name: "Soi 7", resId: 305281 }, d, { kind: "bar", date: party.date });
  assert.equal(p.closes, "03:00", "Saturday 13:00–23:59 plus 00:00–03:00 is a 3 am close");
  assert.equal(p.closesFor, party.date);
  assert.deepEqual(p.hours, SOI7_HOURS, "kept, so a new party date can redo the closing time");
  assert.equal(p.phone, "+918130261700");
  assert.equal(p.name, "Soi 7 Pub & Brewery", "the page's name wins");
  assert.equal(p.locality, "DLF Cyber City");
  assert.equal(p.url, "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city");
  // refreshing the pick from a later read keeps its hours when the new read has none
  const again = venuePick(p, { ...d, hours: [] }, { kind: p.kind, date: "2026-10-12" });
  assert.equal(again.closes, "02:00", "Monday's late row");
  assert.deepEqual(again.hours, SOI7_HOURS);
  // no date: the closing time it had stays
  assert.equal(venuePick(p, null, { kind: "bar" }).closes, "03:00");
  // no zcity/slug anywhere: no District link made up
  assert.equal(venuePick({ name: "Odd" }, null).url, "");
});

test("pickForDate redoes a venue's closing time for a new date, and leaves everything else alone", () => {
  const p = venuePick(VENUES[0], { hours: SOI7_HOURS }, { kind: "bar", date: party.date });
  assert.equal(p.closes, "03:00");
  assert.equal(pickForDate(p, party.date), p, "same date: the same object (setOut bails out)");
  const mon = pickForDate(p, "2026-10-12");
  assert.notEqual(mon, p);
  assert.deepEqual([mon.closes, mon.closesFor], ["02:00", "2026-10-12"]);
  assert.equal(pickForDate(mon, "2026-10-13").closes, "", "Tuesday isn't listed");
  const noHours = venuePick(VENUES[0], null, { date: party.date });
  assert.equal(pickForDate(noHours, "2026-10-12"), noHours);
  const ev = { type: "event", start: "2026-10-10T15:30:00Z" };
  assert.equal(pickForDate(ev, "2026-10-12"), ev);
  assert.equal(pickForDate(null, party.date), null);
  assert.equal(pickForDate(p, null), p);
  // the whole cfg.out, for App's setOut: the same object when nothing changes
  const out = { ...DEFAULT_OUT, active: true, pick: p };
  assert.equal(outForDate(out, party.date), out);
  const moved = outForDate(out, "2026-10-12");
  assert.deepEqual([moved.pick.closes, moved.active], ["02:00", true]);
  assert.equal(outForDate(DEFAULT_OUT, party.date), DEFAULT_OUT);
  // the reminders follow: a Monday party's last call is 1:15 am, not Saturday's 2:15
  assert.equal(clockOf(lastCallFor({ ...party, date: "2026-10-12" }, moved)), "01:15");
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
  assert.deepEqual(rows.filter((r) => r.onDate).map((r) => r.slug).sort(), ["sat-night", "sat-pricey"]);
  assert.ok(rows.slice(0, 2).every((r) => r.onDate), "the party's night comes first");
  // on the night: nearest first; then the month-long run that takes in the date; other nights: soonest first
  assert.deepEqual(slugs, ["sat-pricey", "sat-night", "month-run", "fri-late", "no-pin"]);
  const sat = rows.find((r) => r.slug === "sat-night");
  assert.ok(sat.km > 5 && sat.km < 10);
  assert.deepEqual(sat.reasons, ["On your date", kmText(sat.km)]);
  assert.deepEqual([sat.run, sat.onRun], [false, false]);
  const run = rows.find((r) => r.slug === "month-run");
  assert.deepEqual([run.onDate, run.run, run.onRun], [false, true, true]);
  assert.equal(run.reasons[0], "Runs through your date: check its nights");
  assert.ok(!run.reasons.includes("On your date"));
  assert.equal(rows.find((r) => r.slug === "no-pin").km, null);
});

test("events: within the budget a head before the ones over it, on the night", () => {
  const rows = eventsForDate(EVENTS, party.date, SEC57, 25, { now: NOW, budgetPerHead: 2000 });
  assert.deepEqual(rows.filter((r) => r.onDate).map((r) => r.slug), ["sat-night", "sat-pricey"]);
  assert.deepEqual(rows.map((r) => r.fit).slice(0, 3), ["fits", "over", "fits"]);
  assert.ok(rows[0].reasons.includes("Fits ₹2,000 a head"));
  assert.equal(rows[2].slug, "month-run", "a free run still comes after the nights that are on the date");
  assert.ok(rows[2].reasons.includes("Free"));
});

test("events: no location = no distance cut; a wider radius lets Noida in", () => {
  assert.ok(eventsForDate(EVENTS, party.date, null, 25, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.ok(eventsForDate(EVENTS, party.date, SEC57, 50, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.ok(eventsForDate(EVENTS, party.date, SEC57, null, { now: NOW }).some((r) => r.slug === "noida-sat"));
  assert.deepEqual(eventsForDate([], party.date, SEC57), []);
  assert.deepEqual(eventsForDate(undefined, party.date, SEC57), []);
});

test("shows: the picked one, else the party's night, else the next one; a move offered for another night", () => {
  const shows = [
    { start: "2026-10-03T15:30:00Z", end: "2026-10-03T20:30:00Z" },
    { start: "2026-10-10T15:30:00Z", end: "2026-10-10T20:30:00Z" },
    { start: "2026-10-17T15:30:00Z", end: "2026-10-17T20:30:00Z" },
  ];
  assert.equal(showFor(shows, "2026-10-10", NOW), 1);
  assert.equal(showFor(shows, "2026-10-12", NOW), 0, "3 Oct's show hasn't ended at noon UTC");
  assert.equal(showFor(shows, "2026-10-12", Date.parse("2026-10-05T00:00:00Z")), 1);
  assert.equal(showFor([], "2026-10-10"), -1);
  // reopening a picked event keeps its show, even when the party's date points elsewhere
  assert.equal(showFor(shows, "2026-10-10", NOW, "2026-10-17T15:30:00.000Z"), 2);
  assert.equal(showFor(shows, "2026-10-10", NOW, "2026-12-01T15:30:00Z"), 1, "a show that's gone: back to the party's night");
  assert.equal(showFor(shows, "2026-10-10", NOW, "nonsense"), 1);
  // making a show the party moves the party to its start: another night, or just a later time
  assert.deepEqual(alignParty(shows[2], party, NOW), { date: "2026-10-17", time: "21:00" });
  assert.deepEqual(alignParty(shows[1], party, NOW), { date: "2026-10-10", time: "21:00" }, "doors at 9 pm, not the party's 8 pm");
  assert.equal(alignParty(shows[1], { ...party, time: "21:00" }, NOW), null, "already set for it");
  assert.equal(alignParty({ start: "2026-10-12T05:00:00Z", end: "2026-10-20T17:00:00Z" }, party, NOW), null, "a festival run isn't a single night");
  assert.equal(alignParty(shows[0], party, Date.parse("2026-10-05T00:00:00Z")), null, "never back to a show that's over");
  assert.equal(alignParty({}, party, NOW), null);
});

test("shows: over once they've ended (four hours after the start when no end is given)", () => {
  const show = { start: "2026-10-03T15:30:00Z", end: "2026-10-03T20:30:00Z" };
  assert.equal(showOver(show, Date.parse("2026-10-03T20:00:00Z")), false);
  assert.equal(showOver(show, Date.parse("2026-10-03T21:00:00Z")), true);
  assert.equal(showOver({ start: "2026-10-03T15:30:00Z" }, Date.parse("2026-10-03T19:00:00Z")), false);
  assert.equal(showOver({ start: "2026-10-03T15:30:00Z" }, Date.parse("2026-10-03T19:31:00Z")), true);
  assert.equal(showOver(null, NOW), false);
  assert.equal(showOver({ start: "soon" }, NOW), false);
});

test("eventPick keeps the chosen show, the fee and the organiser's door rules", () => {
  const d = {
    slug: "sat-night", name: "Saturday Night", description: "", venue: "Room XO", locality: "Sector 29", address: "Sector 29", lat: 28.47, lon: 77.06,
    shows: [{ start: "2026-10-03T15:30:00Z", end: "2026-10-03T20:30:00Z" }, { start: "2026-10-10T15:30:00Z", end: "2026-10-10T20:30:00Z" }],
    rules: { ageEntry: 21, stag: "Stag entry not allowed", id: "", dress: "", reentry: "" }, tickets: [], priceFrom: 1800, feePct: 0.07,
  };
  const p = eventPick(EVENTS[1], d, d.shows[1], { kind: "club" });
  assert.equal(p.type, "event");
  assert.equal(p.url, "https://www.district.in/events/sat-night-buy-tickets");
  assert.equal(p.start, "2026-10-10T15:30:00Z");
  assert.deepEqual([p.venue, p.priceFrom, p.ageEntry, p.stag, p.feePct, p.kind], ["Room XO", 1800, 21, "Stag entry not allowed", 0.07, "club"]);
  assert.equal(p.locality, "Sector 29", "the page's locality when the list card has none");
  const bare = eventPick(EVENTS[1], null, null);
  assert.equal(bare.start, EVENTS[1].start);
  assert.equal(bare.feePct, 0);
  assert.equal(bare.kind, "club");
  assert.equal(eventPick({ name: "No slug" }, null, null).url, "", "no slug, no made-up link");
  // only District's flag says stags can't come in: the pick still carries it (the invite reads pick.stag)
  const flagged = eventPick(EVENTS[1], { ...d, rules: { ...d.rules, stag: "", stagAllowed: false } }, null, { kind: "events" });
  assert.deepEqual([flagged.stag, flagged.kind], ["Stag entry not allowed", "events"]);
  // reopening the picked event refreshes its price and rules, not the chosen show
  const fresh = freshEventPick(p, { ...d, priceFrom: 2000, rules: { ...d.rules, ageEntry: 25 }, fetchedAt: 456 });
  assert.deepEqual([fresh.start, fresh.priceFrom, fresh.ageEntry, fresh.fetchedAt, fresh.kind], ["2026-10-10T15:30:00Z", 2000, 25, 456, "club"]);
  assert.equal(freshEventPick(p, { ...d, rules: { ageEntry: 21, stag: "", stagAllowed: true } }).stag, "Stags allowed");
  assert.equal(freshEventPick(p, null), p);
});

test("pickNote: a show on another night, a venue closed that day", () => {
  const show = eventPick(EVENTS[1], null, null);          // Saturday 10 Oct, 9 pm
  assert.equal(pickNote(show, party.date), "");
  assert.match(pickNote(show, "2026-10-17"), /^This show is on .*10.*Oct.*, not the party's date\. Open it to pick another show\.$/);
  const venue = venuePick(VENUES[0], { hours: SOI7_HOURS }, { date: party.date });
  assert.equal(pickNote(venue, party.date), "");
  assert.equal(pickNote(venue, "2026-10-13"), "Closed on Tuesdays, going by its listed hours.");
  assert.equal(pickNote(venuePick(VENUES[0], null), "2026-10-13"), "", "no listed hours: nothing to say");
  assert.equal(pickNote(null, party.date), "");
  assert.equal(pickNote(show, null), "");
});

test("pickNote: a show that starts after midnight is on the party's date, before and after picking it", () => {
  const late = { start: "2026-10-10T19:00:00Z", end: "2026-10-10T23:00:00Z" };   // 12:30 am on Sun 11 Oct, IST
  assert.equal(istDate(late.start), "2026-10-11");
  assert.ok(onNight(late.start, late.end, party.date), "Saturday's night");
  assert.ok(showOnDate(late, party.date), "the sheet says \"your date\"");
  // making it the party moves the party to its real start, so the reminders count back from then
  const move = alignParty(late, party, NOW);
  assert.deepEqual(move, { date: "2026-10-11", time: "00:30" });
  const pick = eventPick(EVENTS[1], null, late);
  assert.equal(pickNote(pick, party.date), "");
  assert.equal(pickNote(pick, move.date), "", "no warning right after picking it");
  assert.ok(showOnDate(late, move.date), "still \"your date\" when the sheet is opened again");
  assert.match(pickNote(pick, "2026-10-12"), /not the party's date/);
  assert.ok(!showOnDate(late, "2026-10-12"));
  assert.ok(!showOnDate(late, "2026-10-09"));
  assert.ok(!showOnDate(null, party.date));
  assert.ok(!showOnDate(late, null));
});

test("door rules read as the organiser's, with labels where the text has none", () => {
  assert.deepEqual(doorRules({ ageEntry: 21, stag: "Stag entry not allowed", id: "Govt ID required", dress: "Smart casuals", reentry: "No re-entry" }),
    ["Entry 21+ (organiser's rule)", "Stag entry not allowed", "Govt ID required", "Dress code: Smart casuals", "No re-entry"]);
  assert.deepEqual(doorRules({ ageEntry: null, stag: "", id: "", dress: "", reentry: "" }), []);
  assert.deepEqual(doorRules(null), []);
  // District's stag flag when the organiser wrote nothing; their words win when they did
  assert.deepEqual(doorRules({ ageEntry: 18, stag: "", stagAllowed: false }), ["Entry 18+ (organiser's rule)", "Stag entry not allowed"]);
  assert.equal(stagText({ stag: "", stagAllowed: true }), "Stags allowed");
  assert.equal(stagText({ stag: "Couples only", stagAllowed: false }), "Stag entry: Couples only");
  assert.equal(stagText({ stag: "", stagAllowed: null }), "");
  assert.equal(stagText(null), "");
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
  // per person = amount × the people one ticket admits × tickets
  assert.equal(gateCoverTotal({ kind: "group", groupSize: 5, qty: 2, gateCover: { amount: 1000, per: "person" } }), 10000);
  assert.equal(gateCoverTotal({ kind: "general", groupSize: null, qty: 1, gateCover: { amount: 1000, per: "person" } }), 1000);
  assert.equal(gateCoverTotal({ kind: "general", qty: 1, gateCover: null }), 0);
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

test("tickets: planned ones keep their shape and take fresh prices — by id, by name and price, or by a name only one has", () => {
  const t = { id: "a", name: "Couple Entry", price: 2000, min: 1, max: 4, buyable: true, kind: "couple", groupSize: 2, service: "cover", gateCover: null, description: "" };
  const p = planTicket(t, 2);
  assert.deepEqual(p, { id: "a", name: "Couple Entry", price: 2000, qty: 2, kind: "couple", service: "cover", gateCover: null, groupSize: 2 });
  const fresh = refreshTickets([p, { id: "gone", name: "Old", price: 100, qty: 1 }], [{ ...t, price: 2200 }]);
  assert.equal(fresh[0].price, 2200);
  assert.equal(fresh[0].qty, 2);
  assert.equal(fresh[1].price, 100);
  // next week's show: a new id, same name and price
  const nextWeek = refreshTickets([p], [{ ...t, id: "b" }]);
  assert.deepEqual([nextWeek[0].id, nextWeek[0].price, nextWeek[0].qty], ["b", 2000, 2]);
  // a new id and a new price: the only "Couple Entry" there is
  const moved = refreshTickets([p], [{ ...t, id: "c", name: "COUPLE  ENTRY ", price: 2400 }, { ...t, id: "d", name: "Stag", price: 1500 }]);
  assert.deepEqual([moved[0].id, moved[0].price], ["c", 2400]);
  // two of that name at other prices: can't tell which, so the plan stays as it was
  const two = [{ ...t, id: "e", price: 2400 }, { ...t, id: "f", price: 2600 }];
  assert.equal(refreshTickets([p], two)[0], p);
  assert.equal(matchTicket(p, two), null);
  assert.equal(matchTicket(null, two), null);
  assert.equal(matchTicket(p, null), null);
  assert.equal(ticketKey({ name: " Couple  Entry", price: 2000 }), "couple entry|2000");
  assert.equal(ticketKey({ name: "Guestlist" }), "guestlist|0");
});

test("tickets: a weekly night's plan survives its first show dropping off the page", () => {
  // The Inner Room: 7 weekly shows, each with its own ticket ids. A plan made for the third
  // show (21 Oct) holds the ids of the first (7 Oct), which district.js lists the tickets under.
  const raw = JSON.parse(fx("event_inner-room.json")).data;
  const before = parseEventData(raw);
  const third = before.shows[2].start;
  const tix = ticketsForStart(before, third);
  const couple = tix.find((t) => t.name === "COUPLE");
  const plan = plannedTickets(tix, { [ticketKey(couple)]: 2 });
  assert.deepEqual(plan.map((t) => [t.name, t.qty, t.price]), [["COUPLE", 2, 2999]]);
  // a week on, 7 Oct is over and gone: the ticket's id is now the 14 Oct show's
  const first = Math.min(...raw.venue.shows.map((s) => s.start_utc_timestamp));
  const after = parseEventData({ ...raw, venue: { ...raw.venue, shows: raw.venue.shows.filter((s) => s.start_utc_timestamp !== first) } });
  assert.equal(after.shows.length, 6);
  const now = ticketsForStart(after, third);
  const again = now.find((t) => t.name === "COUPLE");
  assert.notEqual(again.id, couple.id, "District's ids moved on");
  // the sheet still shows the plan, the night-out card's prices still refresh
  const qty = qtyFromPlan(now, plan);
  assert.deepEqual(qty, { [ticketKey(again)]: 2 });
  assert.deepEqual(plannedTickets(now, qty).map((t) => [t.id, t.qty]), [[again.id, 2]]);
  assert.deepEqual(refreshTickets(plan, now).map((t) => [t.id, t.qty, t.price]), [[again.id, 2, 2999]]);
  // the picked show, found by its start: it's now the second in the list, not the third
  assert.equal(showFor(after.shows, "2026-10-03", NOW, third), 1);
  assert.equal(after.shows[1].start, third);
  // a show that's no longer listed has no tickets to refresh from; no shows listed = all of them
  assert.deepEqual(ticketsForStart(after, "2026-10-07T14:30:00.000Z"), []);
  assert.deepEqual(ticketsForStart({ shows: [], tickets: [couple] }, third), [couple]);
  assert.deepEqual(ticketsForStart(null, third), []);
  assert.deepEqual(qtyFromPlan(now, null), {});
  assert.deepEqual(qtyFromPlan([], plan), { [ticketKey(plan[0])]: 2 }, "nothing to match yet: the plan's own keys");
});

test("tickets: the plan for a show keeps only what that show sells, with a qty", () => {
  // A weekly night: District lists each ticket once, with the shows it's sold for (parse/district.js).
  const details = {
    shows: [{ start: "2026-10-03T15:30:00Z" }, { start: "2026-10-10T15:30:00Z" }],
    tickets: [
      { id: "stag", name: "Stag", price: 1500, min: 1, max: 10, buyable: true, kind: "stag", groupSize: 1, shows: [0, 1], buyableIn: [1] },
      { id: "couple", name: "Couple", price: 2500, min: 1, max: 10, buyable: true, kind: "couple", groupSize: 2, shows: [0, 1], buyableIn: [0, 1] },
      { id: "early", name: "Early bird", price: 999, min: 1, max: 10, buyable: true, kind: "general", groupSize: null, shows: [0], buyableIn: [0] },
    ],
  };
  const qty = { "stag|1500": 2, "couple|2500": 1, "early bird|999": 3 };
  assert.deepEqual(plannedTickets(ticketsForShow(details, 1), qty).map((t) => [t.id, t.qty]), [["stag", 2], ["couple", 1]],
    "the early-bird ticket isn't sold for the 10th");
  assert.deepEqual(plannedTickets(ticketsForShow(details, 0), qty).map((t) => t.id), ["couple", "early"],
    "stag is sold out for the 3rd");
  assert.deepEqual(plannedTickets(ticketsForShow(details, 1), { "couple|2500": 0 }), []);
  assert.deepEqual(plannedTickets(ticketsForShow(details, 1), { couple: 1 }), [], "quantities go by name and price, not id");
  assert.deepEqual(plannedTickets(null, qty), []);
  assert.deepEqual(plannedTickets(ticketsForShow(details, 1), null), []);
});

test("tickets: a planned ticket that sells out stays in the plan for its show", () => {
  const details = {
    shows: [{ start: "2026-10-03T15:30:00Z" }, { start: "2026-10-10T15:30:00Z" }],
    tickets: [
      { id: "stag", name: "Stag", price: 1500, min: 1, max: 10, buyable: true, kind: "stag", groupSize: 1, shows: [0, 1], buyableIn: [1] },
      { id: "couple", name: "Couple", price: 2500, min: 1, max: 10, buyable: true, kind: "couple", groupSize: 2, shows: [0, 1], buyableIn: [0, 1] },
    ],
  };
  // planned for the 10th (and most likely bought): Couple × 2 at ₹2,500
  const plan = plannedTickets(ticketsForShow(details, 1), { "couple|2500": 2 });
  assert.deepEqual(plan.map((t) => [t.name, t.qty, t.price]), [["Couple", 2, 2500]]);
  // a later read: Couple is sold out for the 10th
  const later = { ...details, tickets: details.tickets.map((t) => (t.id === "couple" ? { ...t, buyableIn: [0] } : t)) };
  const tix = ticketsForShow(later, 1);
  const couple = tix.find((t) => t.id === "couple"), stag = tix.find((t) => t.id === "stag");
  assert.equal(couple.buyable, false);
  const qty = qtyFromPlan(tix, plan);
  assert.deepEqual(qty, { "couple|2500": 2 });
  assert.deepEqual(plannedTickets(tix, qty), [], "without the saved plan: only what's on sale");
  // "The party · update", or a stepper on the picked show: the saved plan keeps it
  const kept = plannedTickets(tix, qty, { keep: plan });
  assert.deepEqual(kept.map((t) => [t.name, t.qty, t.price]), [["Couple", 2, 2500]]);
  assert.ok(keptTicket(couple, kept), "the sheet shows it as planned, not on sale now");
  assert.ok(!keptTicket(stag, kept), "a ticket on sale is never a kept one");
  assert.ok(!keptTicket(couple, []));
  assert.deepEqual(plannedTickets(tix, { ...qty, "stag|1500": 1 }, { keep: plan }).map((t) => [t.id, t.qty]), [["stag", 1], ["couple", 2]]);
  assert.deepEqual(plannedTickets(tix, { ...qty, "couple|2500": 0 }, { keep: plan }), [], "Remove takes it off");
  // the night-out card keeps its exact ticket line rather than "Tickets from ₹X × people"
  const pick = eventPick(EVENTS[1], null, { start: details.shows[1].start, end: "" });
  const c = outingCost({ out: { ...DEFAULT_OUT, active: true, pick, tickets: kept }, party });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [["tickets", "exact", 5000]]);
  // a qty left from browsing another show doesn't bring in a ticket that show doesn't sell
  assert.deepEqual(plannedTickets(ticketsForShow(details, 0), { "stag|1500": 2 }, { keep: plan }), [],
    "stag isn't on sale for the 3rd, and it wasn't in the plan");
  assert.deepEqual(plannedTickets(tix, qty, { keep: [] }), []);
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
  // the label multiplies what the amount multiplies: ₹1,400 × 10 = ₹14,000
  assert.equal(c.lines[0].label, "About ₹1,400 a head × 10 (the venue's ₹2,800 for two, an estimate)");
  assert.equal(c.total, 14000);
  assert.equal(c.perHead, 1400);
  assert.equal(c.unknown, false);
  assert.equal(c.admits, null, "no tickets planned");
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
  // a bar that isn't BYOB: a typed corkage doesn't count
  const bar = { ...DEFAULT_OUT, active: true, pick: venuePick(VENUES[0], null, { kind: "bar" }), corkage: 300 };
  assert.deepEqual(outingCost({ out: bar, party, liquorLines: lines }).lines.map((l) => l.id), ["venue"]);
});

test("BYOB goes by the pick, not the chip you browse with: the night-out card, invite and reminders agree", () => {
  const club = venuePick(VENUES[4], null, { kind: "byob" });   // Club Ebowla off the BYOB list; District doesn't tag it BYOB
  const pub = venuePick(VENUES[0], null, { kind: "bar" });
  const tagged = venuePick(VENUES[1], { amenities: ["BYOB"] }, { kind: "bar" });
  const night = eventPick(EVENTS[1], null, null, { kind: "club" });
  for (const [pick, want] of [[club, true], [pub, false], [tagged, true], [night, false]]) {
    for (const chip of ["bar", "byob", "club", "events"]) {
      const out = { ...DEFAULT_OUT, active: true, kind: chip, pick };
      const why = `${pick.name}, browsing ${chip}`;
      assert.equal(isByobPick(out.pick), want, why);
      assert.equal(byobNight(out), want, `${why}: the invite's bottle list and the bottle reminders`);
      assert.equal(outingCost({ out, party, liquorLines: lines }).lines.some((l) => l.id === "bottles"), want, `${why}: the cost lines`);
    }
  }
});

test("cost: planned tickets are exact; the fee and the gate cover are estimates", () => {
  const pick = eventPick(EVENTS[1], { feePct: 0.07, rules: {}, shows: [] }, null);
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
  assert.equal(c.admits, 3 * 2 + 4, "3 couple tickets and 4 single ones let in 10");
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
  assert.deepEqual(outingCost({ out: DEFAULT_OUT, party }), { lines: [], total: 0, perHead: 0, people: 10, admits: null, unknown: false });
  assert.equal(outingCost({ out: DEFAULT_OUT, party: { guests: 0 } }).people, 1);
  assert.equal(outingCost().people, 1);
});

test("bottles you bring", () => {
  assert.deepEqual(bottlesOf(lines), { bottles: 8, total: 7200 });
  assert.deepEqual(bottlesOf([]), { bottles: 0, total: 0 });
  assert.deepEqual(bottlesOf(null), { bottles: 0, total: 0 });
});

// ── Getting there ───────────────────────────────────────────────────────────

test("travel time rounds up to 5 minutes; directions go to the pin", () => {
  assert.equal(travelMinutes(null), null);
  assert.equal(travelMinutes(0), 10);
  assert.equal(travelMinutes(5), 35);                      // 10 + 5 × 1.4 / 20 × 60 = 31 → 35
  assert.equal(travelMinutes(7.3), 45);                    // 10 + 30.66 = 40.7 → 45
  assert.equal(directionsUrl(28.4593, 77.0614), "https://www.google.com/maps/dir/?api=1&destination=28.4593,77.0614");
  assert.equal(directionsUrl(null, 77), null);
});

test("night times: leave by and last call are the reminders' own sums", () => {
  const soi7 = venuePick(v({ name: "Soi 7", slug: "soi-7-pub-brewery-dlf-cyber-city" }), { lat: 28.4956, lon: 77.0884, hours: SOI7_HOURS }, { date: party.date });
  const out = { ...DEFAULT_OUT, active: true, pick: soi7 };
  const t = nightTimes(party, out, SEC57);
  const want = leaveBy(party, out, SEC57);
  assert.equal(t.go.at.getTime(), want.at.getTime(), "the card and the reminder agree");
  assert.equal(t.go.minutes, travelMinutes(kmBetween(SEC57, soi7)));
  assert.equal(t.go.at.getMinutes() % 5, 0, "on a 5-minute mark");
  assert.ok(t.go.at < new Date(`${party.date}T20:00:00`));
  assert.equal(t.noLeave, "");
  assert.equal(clockOf(t.close), "03:00");
  assert.equal(t.close.getTime(), closesAt(party, "03:00").getTime());
  assert.equal(t.lastCall.getTime(), lastCallFor(party, out).getTime());
  assert.equal(clockOf(t.lastCall), "02:15");
  // saved while the party's at home: the card still shows when to leave
  assert.equal(nightTimes(party, { ...out, active: false }, SEC57).go.at.getTime(), want.at.getTime());
  // the party moved to a Monday on another tab: the closing time follows the listed hours
  const mon = { ...party, date: "2026-10-12" };
  assert.equal(clockOf(nightTimes(mon, out, SEC57).close), "02:00");
  assert.equal(clockOf(nightTimes(mon, out, SEC57).lastCall), "01:15");
  assert.equal(nightTimes({ ...party, date: "2026-10-13" }, out, SEC57).close, null, "not listed for Tuesday");
});

test("night times: why there's no leave-by", () => {
  const pinned = { ...DEFAULT_OUT, active: true, pick: venuePick(VENUES[0], { lat: 28.4956, lon: 77.0884 }) };
  assert.equal(nightTimes(party, pinned, null).noLeave, "locate");
  assert.equal(nightTimes(party, pinned, { label: "Gurugram" }).noLeave, "locate");
  assert.equal(nightTimes({ guests: 4 }, pinned, SEC57).noLeave, "date");
  const far = nightTimes(party, pinned, { lat: 28.9, lon: 77.5 });                // ~67 km off
  assert.deepEqual([far.go, far.noLeave], [null, "far"]);
  assert.ok(kmBetween({ lat: 28.9, lon: 77.5 }, pinned.pick) > LEAVE_MAX_KM);
  const unpinned = { ...DEFAULT_OUT, active: true, pick: venuePick(VENUES[0], null) };
  assert.equal(nightTimes(party, unpinned, SEC57).noLeave, "pin");
  assert.equal(nightTimes(party, unpinned, SEC57).close, null, "no listed hours, no closing time");
  assert.deepEqual(nightTimes(party, DEFAULT_OUT, SEC57), { go: null, close: null, lastCall: null, noLeave: "" });
  assert.deepEqual(nightTimes(party, null, SEC57), { go: null, close: null, lastCall: null, noLeave: "" });
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
  assert.equal(timingText("Opens at 5pm"), "Opens at 5pm");
  assert.equal(timingText("Opens in 14 minutes"), "", "a countdown is stale in a list kept 12 hours");
  assert.equal(timingText("Closes in 1 hour"), "");
  assert.equal(timingText("Closes in 30 mins"), "");
  assert.equal(timingText(""), "");
  assert.equal(timingText(null), "");
  assert.equal(costForTwoText(2400), "₹2,400 for two (estimate)");
  assert.equal(costForTwoText(null), "Cost not listed");
  assert.equal(eventPriceText(999), "from ₹999");
  assert.equal(eventPriceText(0), "Free");
  assert.equal(eventPriceText(null), "Price on District");
  assert.equal(feeText(0.07), "+ District fee up to 7% + GST where charged");
  assert.equal(feeText(0.059), "+ District fee up to 5.9% + GST where charged");
  assert.equal(feeText(0), "+ any District fee and GST, shown at checkout");
  assert.equal(offerText("FLAT \\n20% OFF"), "Flat 20% off");
  assert.equal(offerText("FLAT\n15% OFF "), "Flat 15% off", "a real newline too");
  assert.equal(offerText("1+1 ON BEER &amp; COCKTAILS"), "1+1 on beer & cocktails", "entities decoded (district.js cleanOffer)");
  assert.equal(offerText("10% OFF"), "10% off");
  assert.equal(offerText("Flat 15% off on bill"), "Flat 15% off on bill");
  assert.equal(offerText(null), "");
  assert.match(eventWhenText("2026-10-10T15:30:00Z", "2026-10-10T21:30:00Z"), /10.*Oct.* · 9:00 pm$/);
  assert.match(eventWhenText("2026-10-07T12:30:00Z", "2026-11-04T17:30:00Z"), /^7 Oct.* – 4 Nov/);
  assert.equal(eventWhenText("", ""), "");
});

// ── With District's and Zomato's own pages (tests/fixtures/district) ───────────

test("fixtures: Gurugram's BYOB list, ranked with what two venue pages say", () => {
  const list = parseVenueListPage(fx("zomato_ncr_byob.html")).venues;
  assert.equal(list.length, 9);
  const ebowla = parseVenuePage(fx("venue_ebowla_20855103.html"));
  const club = parseVenuePage(fx("venue_clubebowla_21568340.html"));
  const details = { [venueKey(ebowla)]: ebowla, [venueKey(club)]: club };
  const rows = rankVenues(list, { kind: "byob", budgetPerHead: 1000, people: 10, bigGroup: true, details, date: party.date });
  assert.equal(rows.length, 9);
  assert.deepEqual(names(rows).slice(0, 2).sort(), ["Club Ebowla BYOB", "Ebowla Club & BYOB"], "group seating / private dining first");
  const e = rows.find((r) => r.slug === "ebowla-club-byob-sector-30-gurgaon");
  assert.deepEqual(e.reasons, ["Private dining area", "Fits ₹1,000 a head", "2.8 km", "BYOB: bring your Cabinet"]);
  assert.equal(e.bookable, false, "no table bookings on District");
  const c = rows.find((r) => r.slug === "club-ebowla-byob-sector-30-gurgaon");
  assert.ok(c.reasons.includes("Takes table bookings"));
  assert.equal(c.perHead, 1000);
  assert.ok(rows.every((r) => r.byob), "everything on the BYOB list is BYOB");
  // not opened yet: nothing known about bookings
  assert.equal(rows.find((r) => r.slug === "machan-sector-29").bookable, null);
});

test("fixtures: making Club Ebowla the party, and what the night costs", () => {
  const card = parseVenueListPage(fx("zomato_ncr_byob.html")).venues.find((x) => x.slug === "club-ebowla-byob-sector-30-gurgaon");
  const d = parseVenuePage(fx("venue_clubebowla_21568340.html"));
  const pick = venuePick(card, d, { kind: "byob", date: party.date });
  assert.equal(pick.url, "https://www.district.in/dining/ncr/club-ebowla-byob-sector-30-gurgaon");
  assert.ok(!pick.url.includes("?"));
  assert.deepEqual([pick.closes, pick.bookable, pick.phone, pick.kind, pick.resId], ["04:00", true, "+919253999997", "byob", 21568340]);
  assert.ok(isByobPick(pick), "District doesn't tag it BYOB, but it was picked off the BYOB list");
  const out = { ...DEFAULT_OUT, active: true, kind: "byob", pick, corkage: 400 };
  const c = outingCost({ out, party, liquorLines: lines });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [["venue", "estimate", 10000], ["bottles", "estimate", 7200], ["corkage", "estimate", 3200]]);
  assert.equal(c.perHead, 2040);
  const t = nightTimes(party, out, SEC57);
  assert.equal(clockOf(t.close), "04:00");
  assert.equal(clockOf(t.lastCall), "03:15");
  assert.ok(t.go.minutes >= 15 && t.go.minutes <= 30);
});

test("fixtures: an X LIVE night — couple and male passes, the gate cover, the organiser's rules", () => {
  const d = parseEventPage(fx("event_xlive.html"));
  const tix = ticketsForShow(d, 0);
  const key = (kind) => ticketKey(tix.find((t) => t.kind === kind));
  const planned = plannedTickets(tix, { [key("couple")]: 2, [key("male")]: 1 });
  const pick = eventPick({ slug: d.slug, name: d.name }, d, d.shows[0], { kind: "club" });
  assert.equal(pick.url, "https://www.district.in/events/giada-brince-xlive-saturday-oct3-2026-buy-tickets");
  assert.deepEqual([pick.ageEntry, pick.stag, pick.venue], [21, "Stag entry is not allowed at this event", "X LIVE"]);
  const night = { date: "2026-10-03", time: "22:30", guests: 6 };
  assert.equal(pickNote(pick, night.date), "");
  const c = outingCost({ out: { ...DEFAULT_OUT, active: true, kind: "club", pick, tickets: planned }, party: night });
  assert.deepEqual(c.lines.map((l) => [l.id, l.kind, l.amount]), [
    ["tickets", "exact", 2 * 999 + 1299], ["fee", "estimate", Math.round(3297 * 0.06 * 1.18)], ["gate", "estimate", 2 * 2500 + 1500],
  ]);
  assert.equal(c.admits, 5, "two couples and a man: one of the six has no ticket yet");
  assert.deepEqual(doorRules(d.rules), [
    "Entry 21+ (organiser's rule)", "Stag entry is not allowed at this event",
    "ID (Aadhaar/PAN/DL/Passport) is required for entry", "Re-entry not allowed once exited",
  ]);
  assert.equal(feeText(d.feePct), "+ District fee up to 6% + GST where charged");
});

test("fixtures: Room XO's group of 5 pays the ₹1,000 gate cover for each of the five", () => {
  const d = parseEventPage(fx("event_roomxo.html"));
  const group = ticketsForShow(d, 0).find((t) => t.kind === "group");
  assert.equal(group.groupSize, 5);
  assert.equal(gateCoverTotal(planTicket(group, 1)), 5000);
  assert.equal(gateCoverText(group.gateCover), "+ ₹1,000 at the gate a person (event's text)");
  assert.equal(eventPriceText(d.priceFrom), "from ₹1,800");
});

test("fixtures: Gurugram's club nights near Sector 57, the party's night first", () => {
  const list = parseEventList(fx("events_nightlife-in-gurgaon.html"));
  assert.ok(list.length >= 10);
  const date = istDate(list[0].start);
  const rows = eventsForDate(list, date, SEC57, 25, { now: Date.parse(list[0].start) - 86400000 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.km == null || r.km <= 25));
  const firstOther = rows.findIndex((r) => !r.onDate);
  assert.ok(rows[0].onDate);
  assert.ok(firstOther === -1 || rows.slice(firstOther).every((r) => !r.onDate), "no event on the date after one that isn't");
});

test("fixtures: Gonzo's karaoke, listed 3 Oct – 16 Dec, isn't 'on your date' for a Saturday", () => {
  const list = parseEventList(fx("events_nightlife-in-gurgaon.html"));
  const sat = "2026-10-03";
  const rows = eventsForDate(list, sat, SEC57, 25, { now: Date.parse("2026-10-02T12:00:00Z") });
  const karaoke = rows.find((r) => r.slug === "karaoke-night-at-gonzo-oct15-2025");
  assert.ok(karaoke, "it's within 25 km");
  assert.deepEqual([karaoke.onDate, karaoke.run, karaoke.onRun], [false, true, true]);
  assert.equal(karaoke.reasons[0], RUN_REASON);
  // every single night on the 3rd comes before every run that takes it in
  const nights = rows.filter((r) => r.onDate), runs = rows.filter((r) => r.onRun);
  assert.ok(nights.length >= 4 && runs.length >= 1);
  assert.ok(nights.every((r) => !r.run));
  const last = Math.max(...nights.map((r) => rows.indexOf(r)));
  assert.ok(runs.every((r) => rows.indexOf(r) > last));
  // a run that doesn't take the date in is just another night
  const corporate = rows.find((r) => r.slug === "corporate-night-feb23-2026");
  if (corporate) assert.deepEqual([corporate.run, corporate.onRun, corporate.onDate], [true, false, false]);
});
