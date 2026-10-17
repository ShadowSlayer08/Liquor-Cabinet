// lib/planSnapshot.js — one plan as data, for party history and co-host sharing (v1.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotPlan, restoreSnapshot, mergePlans, snapshotSummary, hasPlan, SNAPSHOT_V } from "../src/lib/planSnapshot.js";

const state = {
  city: "gurgaon", budget: 20000,
  party: { name: "Diwali party", date: "2026-11-08", time: "20:00", guests: 12, host: "Asha", upi: "asha@okaxis", prefs: { drinks: ["strong"], spice: "hot" } },
  liquor: { "malts:1": { cat: "malts", qty: 2, item: { id: "1", name: "Glenlivet 12", price: 4000, ml: 750, img: "https://static.livcheers.com/a.webp", url: "https://www.livcheers.com/gurgaon/liquor/glenlivet-12" } } },
  cocktailMenu: [{ id: "mojito", servings: 6 }, { id: "gin-tonic", servings: 0 }],
  food: [
    { key: "b:ice", kind: "blinkit", name: "Ice", qty: 3, product: { id: "p1", name: "Ice 1 kg", price: 60 } },
    { key: "z:9:dish-biryani", kind: "zomato", name: "Biryani", qty: 4, unitPrice: 300, img: "https://b.zmtcdn.com/x.jpg",
      restaurant: { resId: 9, name: "Biryani Blues", orderUrl: "https://www.zomato.com/ncr/biryani-blues/order", appLink: "zomato://order/9", img: "https://b.zmtcdn.com/r.jpg" } },
  ],
  out: null,
};

test("a shared snapshot leaves out the UPI ID and photos", () => {
  const s = snapshotPlan(state, { share: true });
  assert.equal(s.v, SNAPSHOT_V);
  assert.ok(!("upi" in s.party));
  assert.equal(s.party.host, "Asha");
  assert.equal(s.liquor[0].item.img, undefined);
  assert.equal(s.food[1].img, undefined);
  assert.equal(s.food[1].restaurant.img, undefined);
  assert.deepEqual(s.cocktailMenu, [{ id: "mojito", servings: 6 }]);   // 0 servings dropped
  assert.ok(!JSON.stringify(s).includes("asha@okaxis"));
});

test("a history snapshot keeps them; a round trip restores the plan", () => {
  const s = snapshotPlan(state);
  assert.equal(s.party.upi, "asha@okaxis");
  const r = restoreSnapshot(JSON.parse(JSON.stringify(s)));
  assert.equal(r.city, "gurgaon");
  assert.equal(r.budget, 20000);
  assert.equal(r.party.name, "Diwali party");
  assert.equal(r.party.guests, 12);
  assert.equal(r.party.prefs.spice, "hot");
  assert.equal(r.liquor["malts:1"].qty, 2);
  assert.equal(r.liquor["malts:1"].item.img, "https://static.livcheers.com/a.webp");
  assert.equal(r.food.length, 2);
  assert.equal(r.food[1].restaurant.orderUrl, "https://www.zomato.com/ncr/biryani-blues/order");
  assert.ok(r.food.every((l) => l.ordered === false));
});

test("restore checks what came from another phone", () => {
  const bad = snapshotPlan(state, { share: true });
  bad.city = "atlantis";
  bad.party.guests = 99999;
  bad.party.date = "next friday";
  bad.liquor.push({ cat: "gin", qty: 3, item: { id: "x", name: "", price: 1 } });                     // no name → dropped
  bad.liquor[0].item.url = "javascript:alert(1)";
  bad.food[1].restaurant.orderUrl = "https://evil.example/order";
  bad.food[1].restaurant.appLink = "intent://evil#Intent;end";
  bad.food.push({ key: "z:1", kind: "uber", qty: 1 });                                                  // unknown kind → dropped
  bad.food.push({ key: "b:ice", kind: "blinkit", qty: 9, product: { id: "p", name: "dup", price: 1 } }); // duplicate key → dropped
  const r = restoreSnapshot(bad);
  assert.equal(r.city, null);
  assert.equal(r.party.guests, 500);
  assert.equal(r.party.date, null);
  assert.deepEqual(Object.keys(r.liquor), ["malts:1"]);
  assert.equal(r.liquor["malts:1"].item.url, "");
  assert.equal(r.food[1].restaurant.orderUrl, "");
  assert.equal(r.food[1].restaurant.appLink, "");
  assert.equal(r.food.length, 2);
  assert.equal(r.food[0].qty, 3);
});

test("not a plan, or a plan from a newer app", () => {
  assert.throws(() => restoreSnapshot(null), /isn't a Liquor Cabinet plan/);
  assert.throws(() => restoreSnapshot({ party: {} }), /isn't a Liquor Cabinet plan/);
  assert.throws(() => restoreSnapshot({ v: SNAPSHOT_V + 1 }), /newer Liquor Cabinet/);
});

test("merge: everything from both, the larger quantity, my party details", () => {
  const mine = restoreSnapshot(snapshotPlan(state));
  const theirs = restoreSnapshot(snapshotPlan({
    ...state, party: { ...state.party, name: "Their name", guests: 30 },
    liquor: { "malts:1": { ...state.liquor["malts:1"], qty: 5 }, "beer:7": { cat: "beer", qty: 12, item: { id: "7", name: "Bira White", price: 250, ml: 500 } } },
    cocktailMenu: [{ id: "mojito", servings: 2 }, { id: "margarita", servings: 8 }],
    food: [{ key: "b:ice", kind: "blinkit", name: "Ice", qty: 5, product: { id: "p1", name: "Ice 1 kg", price: 60 } }],
  }, { share: true }));
  const m = mergePlans(mine, theirs);
  assert.equal(m.party.name, "Diwali party");
  assert.equal(m.party.guests, 12);
  assert.equal(m.liquor["malts:1"].qty, 5);
  assert.equal(m.liquor["beer:7"].qty, 12);
  assert.deepEqual(m.cocktailMenu.map((c) => [c.id, c.servings]), [["mojito", 6], ["margarita", 8]]);
  assert.equal(m.food.find((l) => l.key === "b:ice").qty, 5);
  assert.equal(m.food.length, 2);
});

test("summary and hasPlan", () => {
  const r = restoreSnapshot(snapshotPlan(state));
  const s = snapshotSummary(r);
  assert.equal(s.bottles, 2);
  assert.equal(s.bottleCost, 8000);
  assert.equal(s.foodCost, 4 * 300 + 3 * 60);
  assert.equal(s.dishes, 1);
  assert.equal(s.supplies, 1);
  assert.ok(hasPlan(r));
  assert.ok(!hasPlan(restoreSnapshot(snapshotPlan({ party: {} }))));
});
