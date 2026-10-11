import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitBill, resolveSplit, shareRows, splitMessage, whatsappUrl, includedLabel, validVpa, upiLink,
} from "../src/lib/split.js";
import { splitParts, homeParts } from "../src/lib/split.js";
import { DEFAULT_OUT, slimVenue, slimEvent, outSpend } from "../src/lib/outModel.js";

const totals = { liquor: 8000, food: 3000, supplies: 1000 };

test("fair split: liquor among drinkers only", () => {
  const r = splitBill({ ...totals, people: 10, drinkers: 8, mode: "fair" });
  assert.equal(r.total, 12000);
  assert.equal(r.perNonDrinker, 400);          // 4000 / 10
  assert.equal(r.perDrinker, 1400);            // 400 + 8000 / 8
  assert.deepEqual(shareRows(r).map((x) => [x.key, x.count, x.amount]), [["drinkers", 8, 1400], ["sober", 2, 400]]);
});

test("equal split, rounding up", () => {
  const r = splitBill({ ...totals, people: 7, drinkers: 3, mode: "equal" });
  assert.equal(r.perDrinker, Math.ceil(12000 / 7));
  assert.equal(r.perNonDrinker, r.perDrinker);
  assert.deepEqual(shareRows(r).map((x) => [x.key, x.count]), [["everyone", 7]]);
  assert.ok(r.perDrinker * 7 >= r.total);
});

test("edge cases: nobody drinking, everyone drinking, liquor left out, nothing planned", () => {
  const none = splitBill({ ...totals, people: 5, drinkers: 0, mode: "fair" });
  assert.equal(none.mode, "equal");            // fair needs a drinker; falls back to equal
  assert.equal(shareRows(none).length, 1);
  const all = splitBill({ ...totals, people: 4, drinkers: 4, mode: "fair" });
  assert.equal(all.nonDrinkers, 0);
  assert.deepEqual(shareRows(all).map((x) => [x.key, x.amount]), [["everyone", 3000]]);
  const noLiquor = splitBill({ ...totals, people: 4, drinkers: 2, mode: "fair", include: { liquor: false } });
  assert.equal(noLiquor.total, 4000);
  assert.equal(shareRows(noLiquor).length, 1);
  assert.deepEqual(shareRows(splitBill({ people: 4, drinkers: 2 })), []);
  // only liquor → non-drinkers owe nothing
  const onlyLiquor = splitBill({ ...totals, people: 4, drinkers: 2, mode: "fair", include: { food: false, supplies: false } });
  assert.deepEqual(shareRows(onlyLiquor).map((x) => x.amount), [4000, 0]);
});

test("resolveSplit: plan defaults, overrides and clamping", () => {
  const plan = { guests: 10, drinkers: 8 };
  assert.deepEqual(resolveSplit({ people: null, drinkers: null, mode: "fair", include: { liquor: true, food: true, supplies: true } }, plan),
    { people: 10, drinkers: 8, mode: "fair", include: { liquor: true, food: true, supplies: true } });
  const r = resolveSplit({ people: 6, drinkers: null, mode: "equal", include: { food: false } }, plan);
  assert.equal(r.people, 6);
  assert.equal(r.drinkers, 6);                 // plan's 8 drinkers clamped to 6 people
  assert.equal(r.mode, "equal");
  assert.deepEqual(r.include, { liquor: true, food: false, supplies: true });
  assert.equal(resolveSplit({ people: 0, drinkers: -3 }, plan).people, 1);
  assert.equal(resolveSplit({ people: 0, drinkers: -3 }, plan).drinkers, 0);
  assert.equal(resolveSplit(undefined, plan).mode, "fair");
});

test("UPI helpers", () => {
  assert.ok(validVpa("rish.b@okhdfc"));
  assert.ok(validVpa("  9876543210@ybl "));
  assert.ok(!validVpa("rish"));
  assert.ok(!validVpa("rish@"));
  assert.ok(!validVpa("@okhdfc"));
  assert.equal(upiLink({ vpa: "rish@okhdfc", name: "Rish B", amount: 1400, note: "House party" }),
    "upi://pay?pa=rish%40okhdfc&pn=Rish%20B&am=1400.00&cu=INR&tn=House%20party");
});

test("split message", () => {
  const party = { name: "Diwali bash", date: "2026-11-07", time: "20:30" };
  const result = splitBill({ ...totals, people: 10, drinkers: 8, mode: "fair" });
  const include = { liquor: true, food: true, supplies: true };
  const msg = splitMessage({ party, result, include, host: "Rish", vpa: "rish@okhdfc" });
  assert.match(msg, /\*Diwali bash\*/);
  assert.match(msg, /8:30 pm/);
  assert.match(msg, /Splitting about ₹12,000 \(liquor, food & supplies, at planned prices\) between 10 of us/);
  assert.match(msg, /Based on planned prices/);
  assert.match(msg, /Drinkers \(8\): \*₹1,400\* each/);
  assert.match(msg, /Non-drinkers \(2\): \*₹400\* each/);
  assert.doesNotMatch(msg, /upi:\/\//);                     // NPCI: no P2P intent links
  assert.match(msg, /Pay by UPI to rish@okhdfc \(Rish\)/);
  // No valid UPI → amounts only, no pay links
  const bare = splitMessage({ party, result, include, host: "Rish", vpa: "rish" });
  assert.doesNotMatch(bare, /upi:\/\//);
  assert.match(bare, /Pay Rish/);
  // Nothing owed by non-drinkers → no ₹0 pay link
  const onlyLiquor = splitBill({ ...totals, people: 4, drinkers: 2, mode: "fair", include: { food: false, supplies: false } });
  const m2 = splitMessage({ party: { name: " " }, result: onlyLiquor, include: { food: false, supplies: false }, host: "", vpa: "rish@okhdfc" });
  assert.match(m2, /\*House party\*/);
  assert.match(m2, /\(liquor, at planned prices\)/);
  assert.match(m2, /Non-drinkers \(2\): nothing to pay/);
  assert.doesNotMatch(m2, /upi:\/\//);
});

test("labels & WhatsApp link", () => {
  assert.equal(includedLabel({}), "liquor, food & supplies");
  assert.equal(includedLabel({ liquor: false }), "food & supplies");
  assert.equal(includedLabel({ food: false, supplies: false }), "liquor");
  assert.equal(whatsappUrl("a & b\nc"), "https://wa.me/?text=a%20%26%20b%0Ac");
});

// ── v1.5: a party out ────────────────────────────────────────────────────────
const soi7 = slimVenue({ resId: 18383940, zcity: "ncr", slug: "soi-7", name: "Soi 7 Pub & Brewery", lat: 28.495, lon: 77.0895, costForTwo: 2400 });
const xlive = slimEvent({ slug: "giada-brince-xlive", name: "Giada Brince at XLive", venue: "XLive" });
const outAt = (pick, more = {}) => ({ ...DEFAULT_OUT, active: true, pick, ...more });
const night = { liquor: 0, food: 0, supplies: 0 };

test("out: the venue estimate and the tickets are split among everyone", () => {
  const spend = outSpend(outAt(soi7, { tickets: [{ id: "t1", name: "Entry", price: 1000, qty: 6 }] }), 10);
  assert.deepEqual([spend.venue, spend.tickets], [12000, 6000]);   // ₹2,400 for two → ₹1,200 a head × 10
  const r = splitBill({ ...night, venue: spend.venue, tickets: spend.tickets, people: 10, drinkers: 8, mode: "fair" });
  assert.deepEqual([r.total, r.venue, r.tickets, r.perDrinker, r.perNonDrinker], [18000, 12000, 6000, 1800, 1800]);
  assert.deepEqual(shareRows(r).map((x) => [x.key, x.count, x.amount]), [["everyone", 10, 1800]]);
  // BYOB: bottles you bring among the drinkers, the venue among everyone.
  const byob = splitBill({ ...night, liquor: 4000, venue: 6000, people: 10, drinkers: 8, mode: "fair" });
  assert.deepEqual([byob.perDrinker, byob.perNonDrinker], [1100, 600]);   // 600 + 4000 / 8
  assert.equal(splitBill({ ...night, liquor: 4000, venue: 6000, people: 10, drinkers: 8, mode: "equal" }).perDrinker, 1000);
  // Missing include keys count as on (App's DEFAULT_SPLIT has none); switched off, they're out.
  assert.equal(splitBill({ ...night, venue: 12000, tickets: 6000, people: 10, include: { liquor: true, food: true, supplies: true } }).total, 18000);
  const noVenue = splitBill({ ...night, venue: 12000, tickets: 6000, people: 10, include: { venue: false } });
  assert.deepEqual([noVenue.total, noVenue.venue, noVenue.tickets], [6000, 0, 6000]);
  assert.equal(splitBill({ ...night, venue: 12000, tickets: 6000, people: 10, include: { venue: false, tickets: false } }).total, 0);
  // At home both are 0, so a home split is unchanged.
  const home = splitBill({ ...totals, venue: outSpend(null, 10).venue || 0, tickets: outSpend(null, 10).tickets, people: 10, drinkers: 8 });
  assert.deepEqual([home.total, home.perDrinker, home.perNonDrinker], [12000, 1400, 400]);
});

test("out: labels name only the parts with something in them; home labels are unchanged", () => {
  const homeParts = splitParts({ liquor: true, food: false, supplies: true }, totals);
  assert.deepEqual(homeParts, { liquor: true, food: false, supplies: true, venue: false, tickets: false });
  assert.equal(includedLabel(homeParts), "liquor & supplies");
  assert.equal(includedLabel(splitParts({}, { liquor: 0, food: 0, supplies: 0 })), "liquor, food & supplies");   // as v1.4.1
  assert.equal(includedLabel(splitParts({}, { ...night, venue: 12000, tickets: 6000 })), "the venue & tickets");
  assert.equal(includedLabel(splitParts({}, { ...night, liquor: 4000, venue: 6000 })), "liquor & the venue");
  assert.equal(includedLabel(splitParts({ venue: false }, { ...night, venue: 12000, tickets: 6000 })), "tickets");
  assert.equal(includedLabel({ venue: true }), "liquor, food, supplies & the venue");
  assert.equal(includedLabel({ liquor: true, food: true, supplies: true }), "liquor, food & supplies");
});

test("out: the WhatsApp text lists the venue estimate and tickets, with no upi:// links", () => {
  const party = { name: "", date: "2026-11-07", time: "20:30" };
  const result = splitBill({ ...night, venue: 12000, tickets: 6000, people: 10, drinkers: 8, mode: "fair" });
  const include = splitParts({}, { ...night, venue: 12000, tickets: 6000 });
  const msg = splitMessage({ party, result, include, host: "Rish", vpa: "rish@okhdfc", venue: "Soi 7 Pub & Brewery" });
  assert.match(msg, /^🎉 \*Night out\* — .*8:30 pm\n📍 Soi 7 Pub & Brewery\n/);
  assert.match(msg, /Splitting about ₹18,000 \(the venue & tickets, at planned prices\) between 10 of us\./);
  assert.match(msg, /🍽️ Venue: about ₹12,000, the venue's own estimate\. The real bill comes at the table\./);
  assert.match(msg, /🎟️ Tickets: ₹6,000 as planned on District, before its fee\./);
  assert.match(msg, /Everyone \(10\): \*₹1,800\* each/);
  assert.doesNotMatch(msg, /Drinks/);
  assert.doesNotMatch(msg, /upi:\/\//);
  assert.match(msg, /Pay by UPI to rish@okhdfc \(Rish\)/);
  // BYOB: the bottles go to the drinkers, and the text says who pays for what.
  const byob = splitBill({ ...night, liquor: 4000, venue: 6000, people: 10, drinkers: 8, mode: "fair" });
  const m2 = splitMessage({ party: { name: "Ebowla night" }, result: byob, include: splitParts({}, { ...night, liquor: 4000, venue: 6000 }), host: "", vpa: "", venue: "Ebowla" });
  assert.match(m2, /\*Ebowla night\*\n📍 Ebowla\n/);
  assert.match(m2, /\(liquor & the venue, at planned prices\)/);
  assert.match(m2, /Drinks you bring are split among the drinkers; the venue among everyone\./);
  assert.doesNotMatch(m2, /Tickets:/);
  // A club night: tickets only.
  const club = splitBill({ ...night, tickets: outSpend(outAt(xlive, { tickets: [{ price: 3000, qty: 2 }, { price: 1500, qty: 0 }] }), 4).tickets, people: 4, drinkers: 4 });
  assert.equal(club.total, 6000);
  assert.match(splitMessage({ party: {}, result: club, include: splitParts({}, { ...night, tickets: 6000 }), venue: "XLive" }), /\(tickets, at planned prices\)/);
});

test("out: the home carts stay home, except a BYOB night's bottles", () => {
  const all = { liquor: true, food: true, supplies: true };
  assert.deepEqual(homeParts(null), all);
  assert.deepEqual(homeParts({ ...outAt(soi7), active: false }), all);
  assert.deepEqual(homeParts({ ...DEFAULT_OUT, active: true }), all);                     // nothing picked yet
  assert.deepEqual(homeParts(outAt(soi7)), { liquor: false, food: false, supplies: false });
  assert.deepEqual(homeParts(outAt(xlive)), { liquor: false, food: false, supplies: false });
  assert.deepEqual(homeParts(outAt({ ...soi7, kind: "byob" })), { liquor: true, food: false, supplies: false });
  assert.deepEqual(homeParts(outAt({ ...soi7, tags: ["BYOB"] })), { liquor: true, food: false, supplies: false });
  assert.deepEqual(homeParts(outAt(xlive, { kind: "byob" })), { liquor: false, food: false, supplies: false });   // the chip alone isn't BYOB

  // A bar night with a ₹6,000 bottle cart and ₹400 of supplies still in the app: the split is the venue
  // alone, with the shared switches untouched (SplitCard counts the home carts as ₹0).
  const cart = { liquor: 6000, food: 1500, supplies: 400 };
  const count = (out) => { const h = homeParts(out); return { liquor: h.liquor ? cart.liquor : 0, food: h.food ? cart.food : 0, supplies: h.supplies ? cart.supplies : 0 }; };
  const bar = outAt(soi7), venue = outSpend(bar, 6).venue;
  const r = splitBill({ ...count(bar), venue, people: 6, drinkers: 4, mode: "fair" });
  assert.deepEqual([r.total, r.perDrinker, r.perNonDrinker], [7200, 1200, 1200]);
  const msg = splitMessage({ party: {}, result: r, include: splitParts({}, { ...count(bar), venue }, true), venue: "Soi 7 Pub & Brewery" });
  assert.match(msg, /Splitting about ₹7,200 \(the venue, at planned prices\)/);
  assert.doesNotMatch(msg, /liquor|food|supplies/);
  // BYOB: the bottles come along, among the drinkers; food and supplies don't.
  const byob = outAt({ ...soi7, kind: "byob" });
  const b = splitBill({ ...count(byob), venue, people: 6, drinkers: 4, mode: "fair" });
  assert.deepEqual([b.total, b.perDrinker, b.perNonDrinker], [13200, 2700, 1200]);   // 1200 + 6000 / 4
  // No venue estimate: a BYOB night with only bottles reads "liquor", not the home parts.
  assert.equal(includedLabel(splitParts({}, { ...count(byob), venue: 0, tickets: 0 }, true)), "liquor");
  assert.equal(includedLabel(splitParts({}, { liquor: 0, food: 0, supplies: 0 })), "liquor, food & supplies");   // home, as v1.4.1
});
