import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMenuPage, menuPrice, hasExactPrices } from "../src/lib/parse/zomato.js";

// A minimal restaurant /order page: window.__PRELOADED_STATE__ = JSON.parse("…") as Zomato serves it.
const page = (items, { blocker = false } = {}) => {
  const state = {
    pages: {
      restaurant: {
        12345: {
          sections: {
            SECTION_BASIC_INFO: {
              res_id: 12345, name: "Test Kitchen", cuisine_string: "North Indian, Mughlai", res_thumb: "https://b.zmtcdn.com/x.jpg",
              timing: { timing_desc: "11am – 11pm" }, rating_new: { ratings: { DELIVERY: { rating: "4.2", reviewCount: "1,024" } } },
            },
            SECTION_RES_HEADER_DETAILS: { LOCALITY: { text: "Sector 57, Gurgaon" } },
          },
          order: {
            price_login_blocker: blocker,
            menuList: { menus: [{ menu: { id: "m1", name: "Starters", categories: [{ category: { items: items.map((item) => ({ item })) } }] } }] },
          },
        },
      },
    },
  };
  return `<html><script>window.__PRELOADED_STATE__ = JSON.parse(${JSON.stringify(JSON.stringify(state))});</script></html>`;
};
const prices = (menu) => Object.fromEntries(menu.menus[0].items.map((i) => [i.name, i.price]));

test("menuPrice normalises numbers and rupee strings", () => {
  assert.equal(menuPrice(240), 240);
  assert.equal(menuPrice(249.5), 249.5);
  assert.equal(menuPrice("₹240"), 240);
  assert.equal(menuPrice("240.00"), 240);
  assert.equal(menuPrice("₹1,240"), 1240);
  for (const v of [0, "0", "₹0", null, undefined, "", "free", NaN, -20, {}]) assert.equal(menuPrice(v), null, String(v));
});

test("signed-in menu: exact prices from whichever field carries them", () => {
  const m = parseMenuPage(page([
    { id: 1, name: "Paneer Tikka", price: 240, dietary_slugs: ["veg"] },
    { id: 2, name: "Chicken Tikka", price: 0, display_price: "₹320", dietary_slugs: ["non-veg"] },
    { id: 3, name: "Dal Makhani", price: null, min_price: "240.00" },
    { id: 4, name: "Family Biryani", default_price: "₹1,240" },
    { id: 5, name: "Mineral Water" },
  ]));
  assert.equal(m.name, "Test Kitchen");
  assert.equal(m.resId, "12345");
  assert.equal(m.pricesHidden, false);
  assert.deepEqual(prices(m), { "Paneer Tikka": 240, "Chicken Tikka": 320, "Dal Makhani": 240, "Family Biryani": 1240, "Mineral Water": null });
  assert.equal(m.menus[0].items[0].veg, true);
  assert.equal(m.menus[0].items[1].veg, false);
  assert.ok(hasExactPrices(m));
});

test("logged-out menu: price_login_blocker hides prices", () => {
  const m = parseMenuPage(page([
    { id: 1, name: "Paneer Tikka", price: 0 },
    { id: 2, name: "Chicken Tikka", display_price: "" },
  ], { blocker: true }));
  assert.equal(m.pricesHidden, true);
  assert.deepEqual(prices(m), { "Paneer Tikka": null, "Chicken Tikka": null });
  assert.ok(!hasExactPrices(m));
});

test("no blocker but no prices either is not an exact-price menu", () => {
  const m = parseMenuPage(page([{ id: 1, name: "Paneer Tikka" }]));
  assert.equal(m.pricesHidden, false);
  assert.ok(!hasExactPrices(m));
  // Prices behind the blocker don't count, even if some leak through.
  assert.ok(!hasExactPrices(parseMenuPage(page([{ id: 1, name: "Paneer Tikka", price: 240 }], { blocker: true }))));
  assert.ok(!hasExactPrices(null));
});

test("pages without a menu parse to null", () => {
  assert.equal(parseMenuPage("<html>nothing here</html>"), null);
});
