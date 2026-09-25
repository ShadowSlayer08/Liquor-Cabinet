import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPriceHistory, priceMove, isPriceDrop, histKey, BADGE_MS, HIST_LEN } from "../src/lib/pricehist.js";

const DAY = 86400 * 1000;
const T0 = Date.UTC(2026, 8, 10);           // 10 Sep 2026
const bottle = (id, price) => ({ id, name: `Bottle ${id}`, price });
// One sync: fresh scrape → { items, hist } saved exactly like sources.scrapeCategory does.
const sync = (prev, items, now) => {
  const r = applyPriceHistory(items, prev && { items: prev.items, fetchedAt: prev.at }, prev?.hist, now);
  return { ...r, at: now };
};

test("first sync records one history entry per bottle and no badges", () => {
  const s = sync(null, [bottle("a", 2450), bottle("b", 900)], T0);
  assert.deepEqual(s.hist, { a: [[T0, 2450]], b: [[T0, 900]] });
  for (const it of s.items) assert.equal(it.prevPrice, undefined);
  assert.equal(priceMove(s.items[0], T0), 0);
  assert.equal(histKey("gurgaon", "malts"), "hist:gurgaon:malts");
});

test("a price drop sets prevPrice with the dates of both prices", () => {
  const s1 = sync(null, [bottle("a", 2450)], T0);
  const t1 = T0 + 14 * DAY;
  const s2 = sync(s1, [bottle("a", 2250)], t1);
  const a = s2.items[0];
  assert.equal(a.prevPrice, 2450);
  assert.equal(a.prevPriceAt, T0);
  assert.equal(a.priceChangedAt, t1);
  assert.equal(priceMove(a, t1), -200);
  assert.ok(isPriceDrop(a, t1));
  assert.deepEqual(s2.hist.a, [[T0, 2450], [t1, 2250]]);
});

test("a price rise is a positive move, not a drop", () => {
  const s1 = sync(null, [bottle("a", 1000)], T0);
  const s2 = sync(s1, [bottle("a", 1150)], T0 + DAY);
  assert.equal(priceMove(s2.items[0], T0 + DAY), 150);
  assert.ok(!isPriceDrop(s2.items[0], T0 + DAY));
});

test("an unchanged price carries the badge forward for 14 days, then drops it", () => {
  const s1 = sync(null, [bottle("a", 2450)], T0);
  const changed = T0 + 2 * DAY;
  const s2 = sync(s1, [bottle("a", 2250)], changed);
  const s3 = sync(s2, [bottle("a", 2250)], changed + 10 * DAY);
  assert.equal(s3.items[0].prevPrice, 2450);
  assert.equal(s3.items[0].prevPriceAt, T0);
  assert.equal(s3.items[0].priceChangedAt, changed);
  assert.deepEqual(s3.hist.a, [[T0, 2450], [changed, 2250]]);   // no duplicate entry for the same price

  const s4 = sync(s3, [bottle("a", 2250)], changed + BADGE_MS + DAY);
  assert.equal(s4.items[0].prevPrice, undefined);
  assert.equal(s4.items[0].priceChangedAt, undefined);
});

test("a stale badge reads as no move even before the next sync", () => {
  const s1 = sync(null, [bottle("a", 2450)], T0);
  const s2 = sync(s1, [bottle("a", 2250)], T0 + DAY);
  assert.equal(priceMove(s2.items[0], T0 + DAY + BADGE_MS), -200);
  assert.equal(priceMove(s2.items[0], T0 + 2 * DAY + BADGE_MS), 0);
});

test("history keeps the last 8 prices and forgets delisted bottles", () => {
  let s = sync(null, [bottle("a", 1000), bottle("gone", 500)], T0);
  for (let i = 1; i <= 10; i++) s = sync(s, [bottle("a", 1000 + i * 10)], T0 + i * DAY);
  assert.equal(s.hist.a.length, HIST_LEN);
  assert.deepEqual(s.hist.a.at(-1), [T0 + 10 * DAY, 1100]);
  assert.deepEqual(s.hist.a[0], [T0 + 3 * DAY, 1030]);
  assert.equal(s.hist.gone, undefined);
  // The previous price's date still comes from history.
  assert.equal(s.items[0].prevPrice, 1090);
  assert.equal(s.items[0].prevPriceAt, T0 + 9 * DAY);
});

test("a cache from before price history seeds it from the cached sync", () => {
  const cached = { items: [bottle("a", 3000)], fetchedAt: T0 };
  const r = applyPriceHistory([bottle("a", 2800), bottle("new", 700)], cached, null, T0 + 5 * DAY);
  assert.deepEqual(r.hist.a, [[T0, 3000], [T0 + 5 * DAY, 2800]]);
  assert.equal(r.items[0].prevPrice, 3000);
  assert.equal(r.items[0].prevPriceAt, T0);
  assert.equal(r.items[1].prevPrice, undefined);            // new bottle: no badge
  assert.deepEqual(r.hist.new, [[T0 + 5 * DAY, 700]]);
});

test("badge fields on incoming items are ignored", () => {
  const stray = { ...bottle("a", 900), prevPrice: 5000, prevPriceAt: 1, priceChangedAt: T0 };
  const r = applyPriceHistory([stray], null, {}, T0);
  assert.equal(r.items[0].prevPrice, undefined);
  assert.equal(r.items[0].price, 900);
});
