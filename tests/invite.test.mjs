import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteData, inviteText } from "../src/lib/invite.js";
import { wrapLines, ellipsize, fitText } from "../src/lib/canvas.js";

const party = { name: "  Diwali bash ", date: "2026-11-07", time: "20:30", host: " Rish " };
const bottle = (name, price, qty) => ({ key: name, cat: "malts", qty, item: { name, price } });

test("invite shows the cocktail menu, skipping unknown ids and empty servings", () => {
  const d = inviteData({
    party, city: "gurgaon", loc: { label: "Sector 57, Gurugram" },
    cocktailMenu: [{ id: "gnt", servings: 10 }, { id: "nope", servings: 5 }, { id: "mojito", servings: 0 }, { id: "margarita" }, { id: "gnt", servings: 2 }, null],
    liquorLines: [bottle("Glenlivet 12", 5000, 1)],
  });
  assert.equal(d.title, "Diwali bash");
  assert.equal(d.host, "Rish");
  assert.equal(d.venue, "Sector 57, Gurugram");
  assert.equal(d.time, "8:30 pm");
  assert.match(d.date, /Saturday/);
  assert.deepEqual(d.bar, { kind: "cocktails", items: ["Gin & Tonic", "Margarita"], more: 0 });
});

test("without a menu the priciest bottles go on the bar", () => {
  const liquorLines = [bottle("A", 1000, 1), bottle("B", 3000, 2), bottle("C", 500, 1), bottle("D", 2000, 1), bottle("E", 900, 1), bottle("F", 4000, 1), bottle("b", 1, 1)];
  const d = inviteData({ party: { ...party, name: "", host: "" }, city: "gurgaon", loc: null, cocktailMenu: [], liquorLines });
  assert.equal(d.title, "House party");
  assert.equal(d.host, "");
  assert.equal(d.venue, "Gurgaon");
  assert.deepEqual(d.bar, { kind: "bottles", items: ["B", "F", "D", "A", "E"], more: 1 });   // "b" is a duplicate of "B"
});

test("food = de-duplicated Zomato + Bistro dishes, up to 6", () => {
  const foodCart = ["Paneer Tikka", "paneer tikka", "Chicken 65", "Veg Momos", "Dal Makhani", "Butter Naan", "Gulab Jamun", "Brownie"]
    .map((name, i) => ({ key: `z${i}`, kind: i === 3 ? "bistro" : "zomato", name }))
    .concat([{ key: "b:ice", kind: "blinkit", name: "Ice cubes" }]);
  const d = inviteData({ party, city: "gurgaon", foodCart });
  assert.deepEqual(d.food.items, ["Paneer Tikka", "Chicken 65", "Veg Momos", "Dal Makhani", "Butter Naan", "Gulab Jamun"]);
  assert.equal(d.food.more, 1);
  assert.deepEqual(inviteData({ party, city: "gurgaon" }).food, { items: [], more: 0 });
});

test("share caption", () => {
  const d = inviteData({ party, city: "gurgaon", loc: { label: "Sector 57" } });
  const text = inviteText(d);
  assert.match(text, /You're invited: Diwali bash/);
  assert.match(text, /8:30 pm/);
  assert.match(text, /📍 Sector 57/);
  assert.match(text, /— Rish/);
});

// A fake 2D context: every character is 10 px wide.
const ctx = { font: "", measureText: (s) => ({ width: String(s).length * 10 }) };

test("text wrapping never runs past the width or line count", () => {
  assert.deepEqual(wrapLines(ctx, "the quick brown fox", 100), ["the quick", "brown fox"]);
  assert.deepEqual(wrapLines(ctx, "the quick brown fox jumps", 100, 2), ["the quick", "brown fox…"]);
  assert.deepEqual(wrapLines(ctx, "the quick brown foxes jump", 100, 2), ["the quick", "brown fox…"]);
  assert.deepEqual(wrapLines(ctx, "supercalifragilistic", 100), ["supercali…"]);
  assert.deepEqual(wrapLines(ctx, "", 100), []);
  assert.equal(ellipsize(ctx, "short", 100), "short");
  for (const l of wrapLines(ctx, "a very long party name that goes on and on and on", 120, 3)) assert.ok(l.length * 10 <= 120, l);
});

test("fitText shrinks before it cuts", () => {
  const sized = { font: "", measureText(s) { const px = Number(/(\d+)px/.exec(this.font)[1]); return { width: String(s).length * px * 0.5 }; } };
  const a = fitText(sized, "House party", { max: 120, min: 60, maxWidth: 800, maxLines: 1 });
  assert.equal(a.size, 120);                    // 11 × 60 = 660 px fits
  const b = fitText(sized, "A really rather long party name", { max: 120, min: 60, maxWidth: 800, maxLines: 1 });
  assert.ok(b.size < 120 && b.lines.length === 1);
  const c = fitText(sized, "A really rather long party name that will not fit on one line at all", { max: 120, min: 60, maxWidth: 800, maxLines: 2 });
  assert.equal(c.size, 60);
  assert.equal(c.lines.length, 2);
  assert.ok(c.lines[1].endsWith("…"));
});
