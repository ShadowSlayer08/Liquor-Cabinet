import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteData, inviteText } from "../src/lib/invite.js";
import { wrapLines, ellipsize, fitText } from "../src/lib/canvas.js";
import { entryLine } from "../src/lib/invite.js";
import { DEFAULT_OUT, slimVenue, slimEvent } from "../src/lib/outModel.js";

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

// ── v1.5: a party out ────────────────────────────────────────────────────────
const SOI7_URL = "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city";
const soi7 = slimVenue({
  resId: 18383940, zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city", name: "Soi 7 Pub & Brewery", locality: "DLF Cyber City",
  lat: 28.495, lon: 77.0895, costForTwo: 2400, amenities: ["Full bar available", "DJ"], bookable: true, closes: "01:00",
}, SOI7_URL);
const xlive = slimEvent({
  slug: "giada-brince-xlive-saturday-oct3-2026", name: "Giada Brince at XLive", venue: "XLive", locality: "Sector 29",
  lat: 28.4683, lon: 77.064, start: "2026-10-03T15:30:00Z", priceFrom: 1500, rules: { ageEntry: 21, stag: "Not allowed" },
}, "https://www.district.in/events/giada-brince-xlive-saturday-oct3-2026-buy-tickets");
const outAt = (pick, more = {}) => ({ ...DEFAULT_OUT, active: true, pick, ...more });
const homeStuff = {
  city: "gurgaon", loc: { label: "Sector 57, Gurugram" },
  cocktailMenu: [{ id: "gnt", servings: 10 }, { id: "virgin-mojito", servings: 4 }],
  liquorLines: [bottle("Glenlivet 12", 5000, 1), bottle("Kingfisher Ultra", 150, 12)],
  foodCart: [{ key: "z1", kind: "zomato", name: "Paneer Tikka" }],
};

test("out at a venue: the venue and its District link, not the home address or the home menu", () => {
  const d = inviteData({ party, ...homeStuff, out: outAt(soi7) });
  assert.equal(d.title, "Diwali bash");
  assert.equal(d.venue, "Soi 7 Pub & Brewery, DLF Cyber City");
  assert.equal(d.url, SOI7_URL);
  assert.equal(d.event, "");
  assert.equal(d.entry, "");
  assert.deepEqual(d.bar, { kind: "bottles", items: [], more: 0 });   // the bar serves its own drinks
  assert.deepEqual(d.food, { items: [], more: 0 });
  assert.equal(d.mocktails, false);
  const text = inviteText(d);
  assert.match(text, /📍 Soi 7 Pub & Brewery, DLF Cyber City/);
  assert.match(text, /🔗 https:\/\/www\.district\.in\/dining\/ncr\/soi-7-pub-brewery-dlf-cyber-city$/m);
  assert.doesNotMatch(text, /Sector 57|Mocktails|Entry/);
  assert.equal(inviteData({ party: { ...party, name: "" }, ...homeStuff, out: outAt(soi7) }).title, "Night out");
});

test("out inactive (or nothing picked): the invite is exactly the home one", () => {
  const home = inviteData({ party, ...homeStuff });
  assert.deepEqual(inviteData({ party, ...homeStuff, out: { ...outAt(soi7), active: false } }), home);
  assert.deepEqual(inviteData({ party, ...homeStuff, out: { ...DEFAULT_OUT, active: true } }), home);
  assert.deepEqual(inviteData({ party, ...homeStuff, out: null }), home);
  assert.equal(home.venue, "Sector 57, Gurugram");
  assert.equal(home.url, "");
  assert.equal(inviteText(home), inviteText({ ...home, event: undefined, entry: undefined, url: undefined }));
});

test("a club night: the event, its venue, the organiser's age rule and the event page", () => {
  const d = inviteData({ party, ...homeStuff, out: outAt(xlive, { kind: "club" }) });
  assert.equal(d.event, "Giada Brince at XLive");
  assert.equal(d.venue, "XLive, Sector 29");
  assert.equal(d.entry, "Entry 21+ (organiser's rule). Carry ID.");
  const text = inviteText(d);
  assert.match(text, /🎟️ Giada Brince at XLive\n📍 XLive, Sector 29\n🆔 Entry 21\+ \(organiser's rule\)\. Carry ID\./);
  assert.match(text, /🔗 https:\/\/www\.district\.in\/events\/giada-brince-xlive-saturday-oct3-2026-buy-tickets/);
  assert.equal(entryLine(null), "");
  assert.equal(entryLine(0), "");
  assert.equal(entryLine("18"), "Entry 18+ (organiser's rule). Carry ID.");
  // No age rule on the event → no entry line.
  assert.equal(inviteData({ party, out: outAt({ ...xlive, ageEntry: null }) }).entry, "");
});

test("a BYOB night lists the bottles you're bringing; links are www.district.in only", () => {
  const byob = inviteData({ party, ...homeStuff, out: outAt({ ...soi7, tags: [], kind: "byob" }) });   // picked off the BYOB list
  assert.deepEqual(byob.bar, { kind: "byob", items: ["Glenlivet 12", "Kingfisher Ultra"], more: 0 });
  assert.deepEqual(byob.food.items, []);
  // A venue District lists as BYOB counts too, whatever chip is on now.
  assert.equal(inviteData({ party, ...homeStuff, out: outAt({ ...soi7, tags: ["BYOB"] }, { kind: "bar" }) }).bar.kind, "byob");
  // The chip alone doesn't make it BYOB: a club night or a bar stays as picked when the host taps BYOB to browse…
  assert.deepEqual(inviteData({ party, ...homeStuff, out: outAt(xlive, { kind: "byob" }) }).bar, { kind: "bottles", items: [], more: 0 });
  assert.deepEqual(inviteData({ party, ...homeStuff, out: outAt({ ...soi7, kind: "bar" }, { kind: "byob" }) }).bar, { kind: "bottles", items: [], more: 0 });
  // …and a BYOB pick keeps its bottles when the chip moves on.
  assert.equal(inviteData({ party, ...homeStuff, out: outAt({ ...soi7, tags: [], kind: "byob" }, { kind: "club" }) }).bar.kind, "byob");
  // A missing URL is rebuilt from the slug; anything not on www.district.in is dropped.
  assert.equal(inviteData({ party, out: outAt({ ...soi7, url: "" }) }).url, SOI7_URL);
  assert.equal(inviteData({ party, out: outAt({ ...xlive, url: "" }) }).url, "https://www.district.in/events/giada-brince-xlive-saturday-oct3-2026-buy-tickets");
  assert.equal(inviteData({ party, out: outAt({ ...soi7, url: "https://example.com/soi7" }) }).url, "");
  assert.equal(inviteData({ party, out: outAt({ ...soi7, url: "", slug: "" }) }).url, "");
  // A venue whose name already says the locality isn't repeated.
  assert.equal(inviteData({ party, out: outAt({ ...soi7, name: "Soi 7, DLF Cyber City" }) }).venue, "Soi 7, DLF Cyber City");
});
