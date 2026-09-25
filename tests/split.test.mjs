import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitBill, resolveSplit, shareRows, splitMessage, whatsappUrl, includedLabel, validVpa, upiLink,
} from "../src/lib/split.js";

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
  assert.match(msg, /Pay ₹1,400: upi:\/\/pay\?pa=rish%40okhdfc&pn=Rish&am=1400\.00/);
  assert.match(msg, /UPI ID: rish@okhdfc \(Rish\)/);
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
  assert.equal((m2.match(/upi:\/\//g) || []).length, 1);
});

test("labels & WhatsApp link", () => {
  assert.equal(includedLabel({}), "liquor, food & supplies");
  assert.equal(includedLabel({ liquor: false }), "food & supplies");
  assert.equal(includedLabel({ food: false, supplies: false }), "liquor");
  assert.equal(whatsappUrl("a & b\nc"), "https://wa.me/?text=a%20%26%20b%0Ac");
});
