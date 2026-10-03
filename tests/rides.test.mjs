import { test } from "node:test";
import assert from "node:assert/strict";
import { RIDES, RIDE, rideLink, ridePrefills, pickupOf, driversOf, homeSafeMessage } from "../src/lib/rides.js";
import { ridePickup, outVenueName } from "../src/lib/rides.js";
import { DEFAULT_OUT, slimVenue, slimEvent } from "../src/lib/outModel.js";

const loc = { lat: 28.459512345, lon: 77.026634567, label: "Sector 57 & Golf Course #2, गुरुग्राम", citySlug: "gurgaon" };

test("the four ride apps", () => {
  assert.deepEqual(RIDES.map((r) => r.id), ["uber", "ola", "rapido", "driveu"]);
  assert.deepEqual(RIDES.map((r) => r.pkg), ["com.ubercab", "com.olacabs.customer", "com.rapido.passenger", "com.humblemobile.consumer"]);
  for (const r of RIDES) assert.match(r.home, /^https:\/\//);
  assert.ok(RIDE.rapido.launch && RIDE.driveu.launch && !RIDE.uber.launch && !RIDE.ola.launch);
});

test("Uber's pickup JSON round-trips (&, # and Hindi in the label)", () => {
  const url = new URL(rideLink("uber", loc));
  assert.equal(url.origin + url.pathname, "https://m.uber.com/looking");
  assert.equal(url.hash, "");
  const pickup = JSON.parse(url.searchParams.get("pickup"));
  assert.deepEqual(pickup, { latitude: 28.4595, longitude: 77.0266, addressLine1: loc.label });
  assert.deepEqual([...url.searchParams.keys()], ["pickup"]);   // no client_id, no utm
});

test("Ola takes lat/lng/pickup_name, rounded to 4 decimals", () => {
  const url = new URL(rideLink("ola", loc));
  assert.equal(url.origin + url.pathname, "https://book.olacabs.com/");
  assert.equal(url.searchParams.get("lat"), "28.4595");
  assert.equal(url.searchParams.get("lng"), "77.0266");
  assert.equal(url.searchParams.get("pickup_name"), loc.label);
  assert.equal(url.searchParams.get("utm_source"), null);
  assert.deepEqual(pickupOf({ lat: 12.97159, lon: 77.59456 }), { lat: 12.9716, lon: 77.5946, label: "Party pickup", named: false });
});

test("links without a location, and bad locations", () => {
  assert.equal(rideLink("uber", null), "https://m.uber.com/looking");
  assert.equal(rideLink("ola", undefined), "https://book.olacabs.com/");
  assert.equal(rideLink("rapido", loc), "https://rapido.bike/");
  assert.equal(rideLink("driveu", loc), "https://www.driveu.in/");
  assert.equal(rideLink("bluesmart", loc), null);
  for (const bad of [{}, { lat: "x", lon: 77 }, { lat: 0, lon: 0 }, { lat: 95, lon: 77 }, { lat: null, lon: 77 }]) {
    assert.equal(pickupOf(bad), null, JSON.stringify(bad));
  }
  assert.equal(rideLink("uber", { lat: null, lon: 77 }), "https://m.uber.com/looking");
  assert.ok(ridePrefills("uber", loc) && ridePrefills("ola", loc));
  assert.ok(!ridePrefills("rapido", loc) && !ridePrefills("uber", null));
  for (const r of RIDES) assert.doesNotMatch(rideLink(r.id, loc), /utm_|client_id|affiliate/);
});

test("drivers are clamped to the guests", () => {
  assert.equal(driversOf({ guests: 10, drivers: 2 }), 2);
  assert.equal(driversOf({ guests: 3, drivers: 9 }), 3);
  assert.equal(driversOf({ guests: 10, drivers: -1 }), 0);
  assert.equal(driversOf({ guests: 10, drivers: 1.6 }), 2);
  assert.equal(driversOf({ guests: 10 }), 0);
  assert.equal(driversOf({ guests: 10, drivers: "x" }), 0);
  assert.equal(driversOf({ drivers: 3 }), 3);                // no guest count to cap it
  assert.equal(driversOf(null), 0);
});

test("the WhatsApp message: https links only, falls back to 'the host'", () => {
  const party = { name: "Diwali night", date: "2026-11-07", time: "20:00" };
  const msg = homeSafeMessage({ party, loc, host: "", drivers: 2 });
  assert.match(msg, /Getting home from Diwali night/);
  assert.match(msg, /Pickup: Sector 57/);
  assert.match(msg, /2 of us are driving tonight/);
  assert.match(msg, /Text the host when you're home/);
  assert.match(msg, /Please don't drive if you've been drinking/);
  const links = msg.match(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi);
  assert.equal(links.length, 4);                       // Uber, Ola, Rapido, DriveU
  assert.ok(links.every((l) => l.startsWith("https://")));
  assert.doesNotMatch(msg, /upi:|uber:\/\/|olacabs:\/\//);
  // The Uber link in the text still carries the pickup.
  const uber = links.find((l) => l.startsWith("https://m.uber.com/"));
  assert.equal(JSON.parse(new URL(uber).searchParams.get("pickup")).latitude, 28.4595);

  const one = homeSafeMessage({ party, loc: null, host: "Arjun", drivers: 1 });
  assert.match(one, /1 of us is driving tonight/);
  assert.match(one, /Text Arjun when you're home/);
  assert.doesNotMatch(one, /Pickup:/);
  assert.match(homeSafeMessage({ party: {}, drivers: 0 }), /Getting home from the party\*\n/);
  assert.doesNotMatch(homeSafeMessage({ party }), /driving tonight/);
});

// ── v1.5: a party out ────────────────────────────────────────────────────────
const soi7 = slimVenue({ resId: 18383940, zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city", name: "Soi 7 Pub & Brewery", locality: "DLF Cyber City", lat: 28.49503, lon: 77.08951 });
const xlive = slimEvent({ slug: "giada-brince-xlive", name: "Giada Brince at XLive", venue: "XLive", lat: 28.4683, lon: 77.064 });
const outAt = (pick, more = {}) => ({ ...DEFAULT_OUT, active: true, pick, ...more });

test("out: rides start from the venue, never from home", () => {
  assert.deepEqual(ridePickup(outAt(soi7), loc), { lat: 28.49503, lon: 77.08951, label: "Soi 7 Pub & Brewery" });
  assert.equal(ridePickup({ ...outAt(soi7), active: false }, loc), loc);
  assert.equal(ridePickup(null, loc), loc);
  assert.equal(ridePickup(outAt({ ...soi7, lat: null }), loc), null);   // no venue pin: no pickup, not home
  assert.deepEqual(pickupOf(ridePickup(outAt(soi7), loc)), { lat: 28.495, lon: 77.0895, label: "Soi 7 Pub & Brewery", named: true });
  const uber = JSON.parse(new URL(rideLink("uber", ridePickup(outAt(soi7), loc))).searchParams.get("pickup"));
  assert.deepEqual(uber, { latitude: 28.495, longitude: 77.0895, addressLine1: "Soi 7 Pub & Brewery" });
  assert.equal(new URL(rideLink("ola", ridePickup(outAt(xlive), loc))).searchParams.get("pickup_name"), "XLive");
  assert.equal(rideLink("uber", ridePickup(outAt({ ...soi7, lat: null }), loc)), "https://m.uber.com/looking");
  assert.equal(outVenueName(outAt(soi7)), "Soi 7 Pub & Brewery");
  assert.equal(outVenueName(outAt(xlive)), "XLive");
  assert.equal(outVenueName(outAt({ ...xlive, venue: "" })), "Giada Brince at XLive");
  assert.equal(outVenueName({ ...outAt(soi7), active: false }), "");
});

test("out: the WhatsApp message names the venue and picks up there", () => {
  const party = { name: "Diwali night", date: "2026-11-07", time: "20:00" };
  const msg = homeSafeMessage({ party, loc, host: "Arjun", drivers: 1, out: outAt(soi7) });
  assert.match(msg, /^🚕 \*Getting home from Diwali night at Soi 7 Pub & Brewery\* — /);
  assert.match(msg, /\nPickup: Soi 7 Pub & Brewery\n/);
  assert.doesNotMatch(msg, /Sector 57|गुरुग्राम/);
  const uber = msg.match(/https:\/\/m\.uber\.com\/\S+/)[0];
  assert.equal(JSON.parse(new URL(uber).searchParams.get("pickup")).latitude, 28.495);
  assert.match(msg, /1 of us is driving tonight/);
  // No party name: the venue is the name. No venue pin: still named, links without a pickup.
  assert.match(homeSafeMessage({ party: {}, loc, out: outAt(soi7) }), /Getting home from Soi 7 Pub & Brewery\*/);
  const noPin = homeSafeMessage({ party, loc, out: outAt({ ...soi7, lat: null }) });
  assert.match(noPin, /Getting home from Diwali night at Soi 7 Pub & Brewery/);
  assert.doesNotMatch(noPin, /Pickup:/);
  assert.match(noPin, /Uber: https:\/\/m\.uber\.com\/looking\n/);
  // Not out: the v1.4.1 message, word for word.
  assert.equal(homeSafeMessage({ party, loc, host: "Arjun", drivers: 1, out: { ...outAt(soi7), active: false } }), homeSafeMessage({ party, loc, host: "Arjun", drivers: 1 }));
});
