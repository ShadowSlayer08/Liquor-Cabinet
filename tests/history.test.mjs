// lib/history.js — past parties: entries, outcome, actual spend, and "Plan again" (v1.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entryId, makeEntry, addEntry, removeEntry, HISTORY_MAX, readHistory, entryPlan, boughtFamilies,
  normalizeOutcome, hasOutcome, withLeftover, withRanOut, updateOutcome,
  settleBelongs, settleFilled, attachSettle, plannedSpend, plannedTotal, actualSpend, actualTotal, perHead, summaryLine,
  replayPlan, planKey, planInUse,
} from "../src/lib/history.js";
import { snapshotPlan, restoreSnapshot, mergePlans } from "../src/lib/planSnapshot.js";
import { slimVenue, slimEvent, DEFAULT_OUT } from "../src/lib/outModel.js";
import { startSettle } from "../src/lib/settle.js";
import { DEFAULT_PARTY } from "../src/lib/food.js";
import { nextSaturday, addDays } from "../src/lib/drydays.js";

const DAY = 86400000;
const at = (iso, hhmm = "20:00") => new Date(`${iso}T${hhmm}:00`).getTime();
const bottle = (cat, id, name, price, qty, ml = 750) => [`${cat}:${id}`, { cat, qty, item: { id, name, price, ml, url: `https://www.livcheers.com/gurgaon/liquor/${id}` } }];

const state = {
  city: "gurgaon", budget: 25000,
  party: { name: "Diwali party", date: "2026-11-08", time: "20:00", guests: 12, host: "Asha", upi: "asha@okaxis" },
  liquor: Object.fromEntries([
    bottle("malts", "g12", "Glenlivet 12", 4000, 2),
    bottle("indian", "bd", "Black Dog", 1800, 3),
    bottle("gin", "bom", "Bombay Sapphire", 2600, 1),
    bottle("beer", "bira", "Bira White", 250, 24, 500),
  ]),
  cocktailMenu: [{ id: "mojito", servings: 6 }],
  food: [
    { key: "b:ice", kind: "blinkit", name: "Ice", qty: 3, ordered: true, product: { id: "p1", name: "Ice 1 kg", price: 60 } },
    { key: "z:9:biryani", kind: "zomato", name: "Biryani", qty: 4, unitPrice: 300, ordered: true,
      restaurant: { resId: 9, name: "Biryani Blues", orderUrl: "https://www.zomato.com/ncr/biryani-blues/order" } },
  ],
  out: null,
};
const snap = (over = {}) => snapshotPlan({ ...state, ...over, party: { ...state.party, ...over.party } }, { now: at("2026-11-08", "12:00") });

// A settle-up as settle.js makes it, then filled in by the host.
const settleOf = ({ title = "Diwali party", when = null, createdAt = at("2026-11-09", "10:00"), planned = false, paid = {} } = {}) => ({
  title, when, createdAt, mode: "fair", paid,
  people: Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, name: i ? `Guest ${i + 1}` : "Asha", drinks: true, upi: "" })),
  expenses: [
    { id: "e1", what: "Bottles", part: "liquor", amount: 18000, paidBy: "p1", planned },
    { id: "e2", what: "Biryani Blues", part: "food", amount: 1500, paidBy: "p2", planned: true },
  ],
});

const catalog = {
  malts: [{ id: "g12", name: "Glenlivet 12", price: 4300, img: "https://static.livcheers.com/g12.webp" }],
  indian: [{ id: "bd", name: "Black Dog", price: 1800 }],
  gin: [{ id: "tanq", name: "Tanqueray", price: 2900 }],          // Bombay Sapphire no longer listed
  // beer not synced at all
};

// ── Entries ───────────────────────────────────────────────────────────────────

test("entry ids: date and name, one per party; a co-host's plan gets its own", () => {
  assert.equal(entryId(snap()), "2026-11-08|Diwali party");
  assert.equal(entryId(snap({ party: { name: "  Diwali party " } })), "2026-11-08|Diwali party");
  assert.equal(entryId({ party: {} }), "undated|Party");
  assert.equal(entryId(null), "undated|Party");
  assert.equal(makeEntry(snap(), { now: 5 }).id, "2026-11-08|Diwali party");
  assert.equal(makeEntry(snap(), { source: "import" }).id, "2026-11-08|Diwali party|import");
  assert.equal(makeEntry(snap(), { source: "weird" }).source, "manual");
  assert.deepEqual(makeEntry(snap()).outcome, normalizeOutcome(null));
});

test("addEntry: the same party replaces its entry, newest party first, capped", () => {
  let h = [];
  h = addEntry(h, makeEntry(snap({ party: { date: "2026-10-10", name: "A" } }), { now: 1 }));
  h = addEntry(h, makeEntry(snap({ party: { date: "2026-11-08" } }), { now: 2 }));
  h = addEntry(h, makeEntry(snap({ party: { date: "2026-09-01", name: "Old" } }), { now: 3 }));
  assert.deepEqual(h.map((e) => e.id), ["2026-11-08|Diwali party", "2026-10-10|A", "2026-09-01|Old"]);
  h = addEntry(h, makeEntry(snap({ party: { date: "2026-10-10", name: "A", guests: 30 } }), { now: 4 }));
  assert.equal(h.length, 3);
  assert.equal(h.find((e) => e.id === "2026-10-10|A").snapshot.party.guests, 30);   // the new plan

  let big = [];
  for (let i = 0; i < HISTORY_MAX + 5; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 7 * DAY).toISOString().slice(0, 10);
    big = addEntry(big, makeEntry(snap({ party: { date: d } }), { now: i }));
  }
  assert.equal(big.length, HISTORY_MAX);
  assert.ok(big[0].snapshot.party.date > big[HISTORY_MAX - 1].snapshot.party.date);
  assert.ok(!big.some((e) => e.snapshot.party.date === "2025-01-01"));                // the oldest party went
  assert.deepEqual(removeEntry(h, "2026-10-10|A").map((e) => e.id), ["2026-11-08|Diwali party", "2026-09-01|Old"]);
});

test("re-saving a party keeps what the host typed and the filled-in settle-up", () => {
  const first = makeEntry(snap(), { settle: settleOf(), now: at("2026-11-09", "11:00") });
  assert.ok(first.settle);
  let h = addEntry([], first);
  h = updateOutcome(h, first.id, (o) => withRanOut(withLeftover(o, "whisky", 1), "beer"), 99);
  h = updateOutcome(h, first.id, { note: "Ice ran out by 11" });
  // the day after, App archives the same party again, with no settle-up any more
  h = addEntry(h, makeEntry(snap(), { settle: null, source: "auto", now: at("2026-11-10", "09:00") }));
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].outcome.left, { whisky: 1 });
  assert.deepEqual(h[0].outcome.ranOut, ["beer"]);
  assert.equal(h[0].outcome.note, "Ice ran out by 11");
  assert.equal(h[0].settle.expenses[0].amount, 18000);
  assert.equal(h[0].source, "manual");
  // "Start again from the plan" (only planned figures) doesn't undo the real bills either
  h = addEntry(h, makeEntry(snap(), { settle: settleOf({ planned: true, createdAt: at("2026-11-10", "10:00") }) }));
  assert.equal(h[0].settle.expenses[0].planned, false);
  // a newer filled-in one does replace it
  const newer = settleOf({ createdAt: at("2026-11-10", "12:00") });
  newer.expenses[0].amount = 17500;
  h = addEntry(h, makeEntry(snap(), { settle: newer }));
  assert.equal(h[0].settle.expenses[0].amount, 17500);
  assert.equal(h[0].outcome.note, "Ice ran out by 11");
});

test("a settle-up belongs to its own party only", () => {
  const s = snap();
  assert.ok(settleBelongs(settleOf({ when: "2026-11-08 20:00" }), s));                    // on the night
  assert.ok(settleBelongs(settleOf({ createdAt: at("2026-11-09", "10:00") }), s));        // the morning after (no date by then)
  assert.ok(!settleBelongs(settleOf({ when: "2026-11-15 20:00" }), s));                   // another night
  assert.ok(!settleBelongs(settleOf({ title: "Birthday" }), s));                          // another party
  assert.ok(!settleBelongs(settleOf({ createdAt: at("2026-10-30") }), s));                // a week before: an older party's
  assert.ok(!settleBelongs(settleOf({ createdAt: at("2026-12-15") }), s));                // long after
  assert.ok(settleBelongs(settleOf({ title: "House party" }), snap({ party: { name: "" } })));
  assert.ok(!settleBelongs(settleOf(), snap({ party: { date: null } })));
  assert.ok(!settleBelongs(null, s));
  // App's auto-archive hands over whatever settle-up is on the phone: someone else's is left out
  assert.equal(makeEntry(s, { settle: settleOf({ title: "Birthday" }) }).settle, null);
  assert.ok(settleFilled(settleOf()));
  assert.ok(!settleFilled(settleOf({ planned: true })));
  assert.ok(settleFilled(settleOf({ planned: true, paid: { "p2>p1:100": true } })));
});

test("attachSettle puts the morning-after settle-up into its party, once", () => {
  const h = addEntry(addEntry([], makeEntry(snap(), { now: 1 })), makeEntry(snap({ party: { date: "2026-10-10", name: "Other" } }), { now: 2 }));
  const s = settleOf();
  const h2 = attachSettle(h, s);
  assert.notEqual(h2, h);
  assert.equal(h2.find((e) => e.id === "2026-11-08|Diwali party").settle.expenses[0].amount, 18000);
  assert.equal(h2.find((e) => e.id === "2026-10-10|Other").settle, null);
  assert.equal(attachSettle(h2, s), h2);                                                  // nothing new: same list
  assert.equal(attachSettle(h, settleOf({ title: "Nobody's" })), h);
  assert.equal(attachSettle(h, null), h);
  const imp = addEntry([], makeEntry(snap(), { source: "import" }));
  assert.equal(attachSettle(imp, s), imp);                                                // a co-host's plan never takes mine
});

test("a Friday party's morning-after settle-up is the Friday party's, not the rolled-on Saturday plan's", () => {
  const fri = { ...state.party, name: "Friday bash", date: "2026-10-09", time: "21:00" };
  const sat = { ...fri, date: nextSaturday("2026-10-10") };                               // App rolls the date on at launch
  assert.equal(sat.date, "2026-10-10");
  const friday = snapshotPlan({ ...state, party: fri }), rolled = snapshotPlan({ ...state, party: sat });
  // Saturday 10:00, started from the rolled plan: its party is 11 h away, so settle.js gives it no date
  const s = startSettle({ party: sat, split: {}, plan: { guests: 10, drinkers: 10 }, liquorTotal: 5400 }, at("2026-10-10", "10:00"));
  assert.equal(s.when, null);
  s.expenses[0] = { ...s.expenses[0], amount: 5200, planned: false };
  assert.ok(settleBelongs(s, friday));
  assert.ok(!settleBelongs(s, rolled));
  assert.equal(makeEntry(rolled, { settle: s }).settle, null);

  // archived on Saturday's launch, settled, then Sunday's launch archives the rolled plan nobody touched
  let h = addEntry([], makeEntry(friday, { source: "auto", now: at("2026-10-10", "09:00") }));
  h = attachSettle(h, s);
  h = addEntry(h, makeEntry(rolled, { settle: s, source: "auto", now: at("2026-10-11", "09:00") }));
  assert.deepEqual(h.map((e) => [e.id, actualTotal(e)]), [["2026-10-09|Friday bash", 5200]]);
  // a later correction reaches the Friday party
  const fixed = { ...s, expenses: [{ ...s.expenses[0], amount: 5000 }] };
  h = attachSettle(h, fixed);
  assert.equal(actualTotal(h[0]), 5000);
  // "Save this party" on Saturday morning keeps the rolled plan without last night's bills
  const h2 = addEntry(h, makeEntry(rolled, { settle: fixed, source: "manual" }));
  assert.equal(h2.find((e) => e.id === "2026-10-10|Friday bash").settle, null);
  assert.equal(attachSettle(h2, fixed), h2);
});

// ── The plan rolled on after a party ──────────────────────────────────────────

test("planKey: the same plan on another date, whoever's name is on it", () => {
  const a = planKey(snap());
  assert.equal(planKey(snap({ party: { date: "2026-12-01", host: "Ravi", upi: "" } })), a);
  assert.notEqual(planKey(snap({ party: { guests: 13 } })), a);
  assert.notEqual(planKey(snap({ budget: 30000 })), a);
  const pricier = { ...state.liquor, "gin:bom": { ...state.liquor["gin:bom"], item: { ...state.liquor["gin:bom"].item, price: 2700 } } };
  assert.notEqual(planKey(snap({ liquor: pricier })), a);
  assert.notEqual(planKey(snap({ cocktailMenu: [{ id: "mojito", servings: 8 }] })), a);
  // the order things went into the carts doesn't matter
  assert.equal(planKey(snap({ liquor: Object.fromEntries(Object.entries(state.liquor).reverse()), food: [...state.food].reverse() })), a);
  // App's first archive reads the stored cfg as it is; the rolled plan has App's defaults filled in
  assert.equal(planKey(snapshotPlan({ ...state, party: { name: "X", date: "2026-10-09" } })),
    planKey(snapshotPlan({ ...state, party: { ...DEFAULT_PARTY, name: "X", date: "2026-10-17" }, out: { ...DEFAULT_OUT } })));
  assert.equal(planKey(null), null);
  assert.equal(planKey({ v: 99 }), null);
});

test("an untouched plan rolled on to next Saturday isn't archived again as a party every week", () => {
  const cfg = { ...state, party: { ...state.party, name: "Friday bash", date: "2026-10-09", time: "21:00" } };
  let party = cfg.party, h = [];
  // App on each launch: archive a passed date, then roll it on to the coming Saturday (carts kept)
  for (const today of ["2026-10-10", "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"]) {
    if (party.date >= today) continue;
    h = addEntry(h, makeEntry(snapshotPlan({ ...cfg, party }), { source: "auto", now: at(today, "09:00") }));
    party = { ...party, date: nextSaturday(today) };
  }
  assert.deepEqual(h.map((e) => e.id), ["2026-10-09|Friday bash"]);

  const next = (over = {}, parts = {}) => snapshotPlan({ ...cfg, ...parts, party: { ...cfg.party, date: "2026-11-07", ...over } });
  const n = h.length;
  // anything changed is a real party
  const more = { ...cfg.liquor, "gin:bom": { ...cfg.liquor["gin:bom"], qty: 2 } };
  assert.equal(addEntry(h, makeEntry(next({}, { liquor: more }), { source: "auto" })).length, n + 1);
  assert.equal(addEntry(h, makeEntry(next({ guests: 20 }), { source: "auto" })).length, n + 1);
  assert.equal(addEntry(h, makeEntry(next({ name: "Another bash" }), { source: "auto" })).length, n + 1);
  // the host saving it is kept
  assert.equal(addEntry(h, makeEntry(next(), { source: "manual" })).length, n + 1);
  // a settle-up of its own says that night happened
  const own = startSettle({ party: { ...cfg.party, date: "2026-11-07" }, split: {}, plan: { guests: 12 }, liquorTotal: 100 }, at("2026-11-07", "23:00"));
  assert.ok(own.when);
  assert.equal(addEntry(h, makeEntry(next(), { source: "auto", settle: own })).length, n + 1);
  // a co-host's plan with the same name isn't the last party
  const imp = addEntry([], makeEntry(snapshotPlan(cfg), { source: "import" }));
  assert.equal(addEntry(imp, makeEntry(next(), { source: "auto" })).length, 2);
  // an older date than the last party isn't a roll-over either
  assert.equal(addEntry(h, makeEntry(snapshotPlan({ ...cfg, party: { ...cfg.party, date: "2026-09-26" } }), { source: "auto" })).length, n + 1);
});

test("a full history drops the oldest party with nothing typed first, never the one just saved", () => {
  const day = (i) => addDays("2025-01-04", i * 7);
  const id = (i) => `${day(i)}|P${i}`;
  let h = [];
  for (let i = 0; i < HISTORY_MAX; i++) h = addEntry(h, makeEntry(snap({ party: { date: day(i), name: `P${i}` } }), { source: "auto", now: i }));
  assert.equal(h.length, HISTORY_MAX);
  h = updateOutcome(h, id(0), { note: "the first one" });
  h = updateOutcome(h, id(1), { spent: 9000 });
  h = h.map((e) => (e.id === id(2) ? { ...e, settle: settleOf({ title: "P2" }) } : e));        // real bills
  h = addEntry(h, makeEntry(snap({ party: { date: day(HISTORY_MAX), name: "New" } })));
  assert.equal(h.length, HISTORY_MAX);
  for (const i of [0, 1, 2]) assert.ok(h.some((e) => e.id === id(i)), `P${i} kept`);
  assert.ok(!h.some((e) => e.id === id(3)));                                               // the oldest with nothing typed went

  // a co-host's old plan saved now stays, though it's older than everything here
  const old = makeEntry(snap({ party: { date: "2020-01-04", name: "Ravi's" } }), { source: "import" });
  h = addEntry(h, old);
  assert.ok(h.some((e) => e.id === old.id));
  assert.ok(!h.some((e) => e.id === id(4)));
  assert.ok(h.some((e) => e.id === id(0)));

  // everything typed in: the oldest other party goes, still not the new one
  let full = h.map((e) => ({ ...e, outcome: normalizeOutcome({ note: "kept" }) }));
  const older = makeEntry(snap({ party: { date: "2019-06-01", name: "Older" } }), { source: "manual" });
  full = addEntry(full, older);
  assert.equal(full.length, HISTORY_MAX);
  assert.ok(full.some((e) => e.id === older.id));
  assert.ok(!full.some((e) => e.id === old.id));
});

// ── Money ─────────────────────────────────────────────────────────────────────

test("actual spend comes from the settle-up's real bills or the host, never invented", () => {
  const e = makeEntry(snap(), { settle: settleOf() });
  const a = actualSpend(e);
  assert.equal(a.total, 19500);
  assert.equal(a.source, "settle");
  assert.equal(a.people, 10);
  assert.equal(a.planned, 1);                                                             // Biryani Blues still at the plan's figure
  assert.equal(perHead(e), 1950);
  assert.equal(actualTotal(e), 19500);

  const none = makeEntry(snap());
  assert.equal(actualTotal(none), null);
  assert.equal(perHead(none), null);
  assert.equal(actualTotal(makeEntry(snap(), { settle: settleOf({ planned: true }) })), null);   // only the plan's figures

  const typed = { ...none, outcome: normalizeOutcome({ spent: 21000 }) };
  assert.deepEqual(actualSpend(typed), { total: 21000, source: "you", people: 12, planned: 0 });
  assert.equal(perHead(typed), 1750);

  // planned: bottles + Zomato + supplies at home
  assert.equal(plannedTotal(e), 2 * 4000 + 3 * 1800 + 2600 + 24 * 250 + 4 * 300 + 3 * 60);
  const line = summaryLine(e);
  assert.match(line, /12 guests/);
  assert.match(line, /30 bottles/);
  assert.match(line, /planned ₹23\.4k/);
  assert.match(line, /1 dish · /);
  assert.match(line, /spent ₹19\.5k \(₹1,950 a head\)/);
  assert.doesNotMatch(summaryLine(none), /spent/);
});

test("a night at a bar counts the venue's estimate, not the home carts", () => {
  const pick = slimVenue({ resId: 1, name: "Soi 7", locality: "Cyber Hub", costForTwo: 2400, lat: 28.5, lon: 77.1 }, "https://www.district.in/dining/x");
  const p = restoreSnapshot(snap({ out: { active: true, kind: "bar", pick, tickets: [] } }));
  const sp = plannedSpend(p);
  assert.equal(sp.liquor, 0);
  assert.equal(sp.venue, 1200 * 12);
  assert.equal(sp.total, 1200 * 12);
  assert.ok(sp.homeLeftOut);
  assert.match(summaryLine({ snapshot: snap({ out: { active: true, kind: "bar", pick, tickets: [] } }) }), /Soi 7/);
});

// ── Outcome ───────────────────────────────────────────────────────────────────

test("outcome: leftovers and 'ran out' exclude each other, clamped to what was bought", () => {
  let o = withLeftover(null, "whisky", 2);
  assert.deepEqual(o.left, { whisky: 2 });
  o = withRanOut(o, "whisky");
  assert.deepEqual(o.left, {});
  assert.deepEqual(o.ranOut, ["whisky"]);
  o = withLeftover(o, "whisky", 1);
  assert.deepEqual(o.ranOut, []);
  o = withLeftover(o, "whisky", 0);
  assert.deepEqual(o.left, {});
  assert.ok(!hasOutcome(o));
  assert.ok(hasOutcome({ note: "fun" }));

  const plan = entryPlan({ snapshot: snap() });
  const n = normalizeOutcome({ left: { whisky: 99, gin: 1, vodka: 3 }, ranOut: ["beer", "rum", 7], spent: "-5", note: 42 }, plan);
  assert.deepEqual(n.left, { whisky: 5, gin: 1 });                                        // 2 + 3 whisky bought; no vodka bought
  assert.deepEqual(n.ranOut, ["beer"]);
  assert.equal(n.spent, null);
  assert.equal(n.note, "");
  assert.deepEqual(boughtFamilies(plan).map((f) => [f.id, f.bottles]), [["whisky", 5], ["gin", 1], ["beer", 24]]);
});

// ── Plan again ────────────────────────────────────────────────────────────────

test("replay: today's prices; a bottle no longer listed keeps its old price and is flagged", () => {
  const r = replayPlan(makeEntry(snap()), { catalog, city: "gurgaon" });
  assert.equal(r.liquor["malts:g12"].item.price, 4300);
  assert.equal(r.liquor["malts:g12"].item.img, "https://static.livcheers.com/g12.webp");
  assert.equal(r.liquor["indian:bd"].item.price, 1800);
  assert.equal(r.liquor["gin:bom"].item.price, 2600);
  assert.equal(r.liquor["beer:bira"].item.price, 250);
  assert.ok(r.changes.some((c) => c.kind === "unlisted" && c.key === "gin:bom"));
  assert.ok(r.changes.some((c) => c.kind === "price" && c.key === "malts:g12" && c.from === 4000 && c.to === 4300));
  assert.ok(r.notes.includes("Glenlivet 12 is ₹4,300 now (₹4,000 last time)"));
  assert.ok(r.notes.some((n) => /Bombay Sapphire isn't on Livcheers right now, so it keeps last time's ₹2,600/.test(n)));
  assert.ok(r.notes.some((n) => /No Beer prices loaded yet/.test(n)));
  // same quantities without an outcome
  assert.deepEqual(Object.fromEntries(Object.entries(r.liquor).map(([k, l]) => [k, l.qty])), { "malts:g12": 2, "indian:bd": 3, "gin:bom": 1, "beer:bira": 24 });

  // a party in another city keeps its prices (they update once that city's load)
  const away = replayPlan(makeEntry(snap()), { catalog, city: "mumbai" });
  assert.equal(away.liquor["malts:g12"].item.price, 4000);
  assert.ok(away.notes.some((n) => /This party was in Gurgaon/.test(n)));
  assert.ok(!away.changes.some((c) => c.kind === "unlisted"));
});

test("replay: leftovers come off what to buy, what ran out gets more, with notes", () => {
  const e = { ...makeEntry(snap()), outcome: normalizeOutcome({ left: { gin: 1, whisky: 2 }, ranOut: ["beer"] }) };
  const r = replayPlan(e, { catalog, city: "gurgaon" });
  // gin: the only bottle was left over → nothing to buy
  assert.equal(r.liquor["gin:bom"], undefined);
  assert.ok(r.notes.includes("1 Bombay Sapphire left from last time: that's all you bought, so none to buy"));
  // whisky: 2 left, taken from the bottle bought most of first (3 Black Dog, 2 Glenlivet → 1 + 1)
  assert.equal(r.liquor["indian:bd"].qty, 2);
  assert.equal(r.liquor["malts:g12"].qty, 1);
  assert.ok(r.notes.some((n) => n.startsWith("Whisky: 2 bottles left from last time, so 2 fewer to buy (")));
  // beer ran out: a few more
  assert.equal(r.liquor["beer:bira"].qty, 24 + 5);                                         // max(4, 20% of 24)
  assert.ok(r.notes.includes("Beer ran out last time: 5 more Bira White"));

  const one = { ...makeEntry(snap()), outcome: normalizeOutcome({ left: { whisky: 1 }, ranOut: ["gin"] }) };
  const r1 = replayPlan(one, {});
  assert.equal(r1.liquor["indian:bd"].qty, 2);
  assert.ok(r1.notes.some((n) => /^Whisky: 1 bottle left from last time, so 1 less to buy \(1 less Black Dog\)$/.test(n)));
  assert.equal(r1.liquor["gin:bom"].qty, 2);
  assert.ok(r1.notes.includes("Gin ran out last time: 1 more Bombay Sapphire"));

  const single = snap({ liquor: Object.fromEntries([bottle("malts", "g12", "Glenlivet 12", 4000, 3), bottle("beer", "bira", "Bira White", 250, 6, 500)]) });
  const r2 = replayPlan({ ...makeEntry(single), outcome: { left: { whisky: 1 }, ranOut: ["beer"] } }, {});
  assert.equal(r2.liquor["malts:g12"].qty, 2);
  assert.ok(r2.notes.includes("1 Glenlivet 12 left from last time, so 1 less to buy"));
  assert.ok(r2.notes.includes("Beer ran out last time: 4 more Bira White"));
  assert.equal(r2.liquor["beer:bira"].qty, 10);
});

test("replay: date cleared, food as it was (with a word about Zomato), the night out redone", () => {
  const r = replayPlan(makeEntry(snap()), { catalog, city: "gurgaon" });
  assert.equal(r.party.date, null);
  assert.equal(r.party.name, "Diwali party");
  assert.equal(r.party.guests, 12);
  assert.equal(r.budget, 25000);
  assert.deepEqual(r.cocktailMenu, [{ id: "mojito", servings: 6 }]);
  assert.equal(r.food.length, 2);
  assert.ok(r.food.every((l) => l.ordered === false));
  assert.equal(r.food.find((l) => l.kind === "zomato").unitPrice, 300);
  assert.ok(r.notes.some((n) => /Zomato restaurants and prices may have changed/.test(n)));
  assert.ok(r.notes.some((n) => /coming Saturday/.test(n)));
  // restoreSnapshot()-shaped: it round-trips through the checker as it is
  const again = restoreSnapshot({ ...snapshotPlan(r), v: 1 });
  assert.equal(Object.keys(again.liquor).length, 4);

  const venue = slimVenue({ resId: 1, name: "Soi 7", costForTwo: 2400 }, "https://www.district.in/dining/x");
  const rv = replayPlan(makeEntry(snap({ out: { active: true, kind: "bar", pick: venue, booked: true, tickets: [] } })), {});
  assert.equal(rv.out.pick.name, "Soi 7");
  assert.equal(rv.out.booked, false);
  assert.ok(rv.notes.some((n) => /Same place: Soi 7\. Book again on District/.test(n)));

  const ev = slimEvent({ slug: "x", name: "Techno Night", start: "2026-11-08T15:00:00Z" }, "https://www.district.in/events/x");
  const re = replayPlan(makeEntry(snap({ out: { active: true, kind: "club", pick: ev, tickets: [{ id: "t", name: "Stag", price: 1500, qty: 2 }] } })), {});
  assert.equal(re.out.pick, null);
  assert.equal(re.out.active, false);
  assert.deepEqual(re.out.tickets, []);
  assert.ok(re.notes.some((n) => /Techno Night has been and gone/.test(n)));
});

test("replay never changes its inputs", () => {
  const e = { ...makeEntry(snap(), { settle: settleOf() }), outcome: normalizeOutcome({ left: { whisky: 2, gin: 1 }, ranOut: ["beer"] }) };
  const before = JSON.stringify(e), cat = JSON.stringify(catalog);
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  freeze(e); freeze(catalog);
  replayPlan(e, { catalog, city: "gurgaon" });
  addEntry([e], makeEntry(snap()));
  updateOutcome([e], e.id, { note: "x" });
  attachSettle([e], settleOf({ createdAt: at("2026-11-11") }));
  withLeftover(e.outcome, "whisky", 1);
  withRanOut(e.outcome, "gin");
  assert.equal(JSON.stringify(e), before);
  assert.equal(JSON.stringify(catalog), cat);
});

test("plan again keeps my name and UPI ID: the past party's are left out", () => {
  const r = replayPlan(makeEntry(snap()), {});                                              // my own party, with my old UPI ID
  assert.equal(r.party.host, "");
  assert.equal(r.party.upi, "");
  const shared = restoreSnapshot(snapshotPlan({ ...state, party: { ...state.party, host: "Cohost Ravi" } }, { share: true }));
  const ri = replayPlan(makeEntry(snapshotPlan(shared), { source: "import" }), {});         // a co-host's plan kept here
  assert.equal(ri.party.host, "");
  assert.equal(ri.party.upi, "");
  // App's applyPlan then takes mine: `next.party.host || party.host`
  const applied = { ...ri.party, host: ri.party.host || "Asha", upi: ri.party.upi || "asha@okhdfc" };
  assert.deepEqual([applied.host, applied.upi], ["Asha", "asha@okhdfc"]);
});

test("add to my plan keeps my party details and my night out", () => {
  const pick = slimVenue({ resId: 1, name: "Soi 7", locality: "Cyber Hub", costForTwo: 2400 }, "https://www.district.in/dining/x");
  const past = makeEntry(snap({ party: { name: "Bar night", date: "2026-10-03" }, out: { ...DEFAULT_OUT, active: true, kind: "bar", pick, booked: true } }));
  const m = replayPlan(past, { catalog, city: "gurgaon", merge: true });
  assert.equal(m.out, null);
  assert.ok(!m.notes.some((n) => /Saturday|Soi 7|District/.test(n)));
  const home = (out) => restoreSnapshot(snapshotPlan({ city: "gurgaon", budget: 20000, party: { name: "My house do", date: "2026-10-24", guests: 12 },
    liquor: {}, cocktailMenu: [], food: [], out }));
  const merged = mergePlans(home({ ...DEFAULT_OUT }), m);
  assert.equal(merged.out.active, false);
  assert.equal(merged.out.pick, null);
  assert.equal(merged.party.name, "My house do");
  assert.equal(merged.party.date, "2026-10-24");
  assert.equal(merged.liquor["malts:g12"].item.price, 4300);
  assert.equal(merged.liquor["indian:bd"].qty, 3);
  // my own night out stays as it is
  const mineOut = { ...DEFAULT_OUT, active: true, kind: "club", pick: slimVenue({ resId: 2, name: "Kitty Su" }, "https://www.district.in/dining/y") };
  assert.equal(mergePlans(home(mineOut), m).out.pick.name, "Kitty Su");
  // "Plan again" still keeps the venue to book again
  assert.equal(replayPlan(past, { catalog, city: "gurgaon" }).out.pick.name, "Soi 7");

  // a party from another city is added to this city's plan, so it takes this city's prices
  const mm = replayPlan(makeEntry(snap()), { catalog, city: "mumbai", merge: true });
  assert.equal(mm.liquor["malts:g12"].item.price, 4300);
  assert.ok(!mm.notes.some((n) => /This party was in/.test(n)));
});

test("replay notes: many new prices summed up; a listed bottle with no price keeps last time's", () => {
  const gins = Object.fromEntries([1, 2, 3, 4].map((i) => bottle("gin", `g${i}`, `Gin ${i}`, 1000, 1)));
  const gin = (prices) => ({ gin: prices.map((price, i) => ({ id: `g${i + 1}`, name: `Gin ${i + 1}`, price })) });
  const same = replayPlan(makeEntry(snap({ liquor: gins })), { catalog: gin([1100, 900, 1100, 900]), city: "gurgaon" });
  assert.ok(same.notes.includes("New prices today for 4 kinds of bottle: the same as last time, in all"), same.notes.join("\n"));
  const up = replayPlan(makeEntry(snap({ liquor: gins })), { catalog: gin([1100, 1300, 1100, 900]), city: "gurgaon" });
  assert.ok(up.notes.includes("New prices today for 4 kinds of bottle: ₹400 more than last time, in all"), up.notes.join("\n"));

  const r = replayPlan(makeEntry(snap()), { catalog: { ...catalog, gin: [{ id: "bom", name: "Bombay Sapphire", price: 0 }] }, city: "gurgaon" });
  assert.equal(r.liquor["gin:bom"].item.price, 2600);
  assert.ok(r.notes.includes("Bombay Sapphire has no price on Livcheers right now, so it keeps last time's ₹2,600"));
  assert.ok(r.changes.some((c) => c.kind === "unpriced" && c.key === "gin:bom"));
  assert.ok(!r.notes.some((n) => /Bombay Sapphire isn't on Livcheers/.test(n)));
});

test("planInUse: anything in the carts, or party details that aren't the defaults", () => {
  const today = "2026-10-18";
  const blank = snapshotPlan({ city: "gurgaon", budget: 80000, liquor: {}, food: [], cocktailMenu: [], out: { ...DEFAULT_OUT },
    party: { ...DEFAULT_PARTY, date: nextSaturday(today), host: "Asha", upi: "asha@okaxis" } });
  const withParty = (over) => ({ ...blank, party: { ...blank.party, ...over } });
  assert.equal(planInUse(blank, today), false);                                             // my name and UPI ID don't count
  assert.equal(planInUse(withParty({ name: "Diwali party" }), today), true);
  assert.equal(planInUse(withParty({ guests: 25 }), today), true);
  assert.equal(planInUse(withParty({ date: "2026-10-31" }), today), true);
  assert.equal(planInUse(withParty({ prefs: { ...blank.party.prefs, jain: true } }), today), true);
  assert.equal(planInUse(snap(), today), true);
  assert.equal(planInUse(null, today), false);
});

test("legacy and garbage entries don't crash anything", () => {
  const junk = [null, "x", 7, [], { id: 3 }, { id: "a" }, { id: "b", snapshot: "nope" }, { id: "c", snapshot: { v: 99 } },
    { id: "d", snapshot: { v: 1, party: { name: "Old one", date: "2025-12-31" }, liquor: "lots", food: { a: 1 } }, outcome: "great", settle: 5 }];
  const rows = readHistory(junk);
  assert.deepEqual(rows.map((r) => r.entry.id), ["d"]);
  assert.equal(Object.keys(rows[0].plan.liquor).length, 0);
  assert.equal(actualTotal(rows[0].entry, rows[0].plan), null);
  assert.equal(plannedTotal(rows[0].entry, rows[0].plan), 0);
  assert.match(summaryLine(rows[0].entry, rows[0].plan), /^\d+ guests$/);
  const r = replayPlan(rows[0].entry, { catalog });
  assert.deepEqual(r.liquor, {});
  assert.equal(r.party.date, null);

  assert.equal(entryPlan({ id: "c", snapshot: { v: 99 } }), null);
  assert.throws(() => replayPlan({ id: "x" }), /can't be opened/);
  assert.throws(() => replayPlan(null), /can't be opened/);
  assert.equal(summaryLine({ id: "x" }), "");
  assert.deepEqual(normalizeOutcome("great"), normalizeOutcome(null));
  const h = addEntry(junk, makeEntry(snap()));
  assert.deepEqual(h.map((e) => e.id).sort(), ["2026-11-08|Diwali party", "a", "b", "c", "d"]);
  assert.equal(addEntry(junk, null).length, 4);
  assert.equal(attachSettle(junk, settleOf()), junk);
  assert.deepEqual(updateOutcome("nope", "a", {}), []);
  assert.deepEqual(removeEntry(null, "a"), []);
});
