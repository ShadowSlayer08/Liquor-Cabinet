import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, TEMPLATE, applyTemplate, templateDate, templateMenu, orderTemplates, templateChanges, templateToast } from "../src/lib/templates.js";
import { festivalDate } from "../src/lib/drydays.js";
import { COCKTAIL } from "../src/lib/cocktails.js";
import { DEFAULT_PARTY } from "../src/lib/food.js";
import { MIXES } from "../src/lib/optimise.js";

// Mocktails another v1.4.1 track adds to cocktails.js; templates may name them before they exist.
const MOCKTAIL_IDS = ["virgin-mojito", "shikanji", "masala-cola", "virgin-colada", "cranberry-cooler", "roohafza-cooler", "ginger-fizz", "orange-fizz"];

const party = {
  ...DEFAULT_PARTY, name: "Rohan's do", date: "2026-10-10", time: "19:00", guests: 14, hours: 3, drinkersPct: 50,
  host: "Rohan", upi: "rohan@upi", drivers: 2, pegMl: 30, prefs: { ...DEFAULT_PARTY.prefs, spice: "hot", jain: true },
};
const menu = [{ id: "gnt", servings: 7 }];

test("festivalDate looks up the dry-day tables", () => {
  assert.equal(festivalDate("Diwali", "2026-09-26"), "2026-11-08");
  assert.equal(festivalDate("diwali", "2026-11-08"), "2026-11-08");   // on the day
  assert.equal(festivalDate("Diwali", "2026-11-09"), "2027-10-29");
  assert.equal(festivalDate("Holi", "2026-10-02"), "2027-03-22");
  assert.equal(festivalDate("Ganesh Chaturthi", "2027-01-01"), "2027-09-04");   // a state day
  assert.equal(festivalDate("Diwali", "2027-10-30"), null);                      // past the tables
  assert.equal(festivalDate("Christmas", "2026-10-02"), null);
  assert.equal(festivalDate("", "2026-10-02"), null);
  assert.equal(festivalDate(null), null);
});

test("templates are well-formed", () => {
  assert.ok(TEMPLATES.length >= 7);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const id of ["cricket", "diwali", "nye", "birthday", "dinner"]) assert.ok(TEMPLATE[id], id);
  for (const t of TEMPLATES) {
    assert.ok(t.label && t.name && t.what && t.emoji, t.id);
    assert.ok(MIXES[t.mix], `${t.id} mix`);
    for (const k of Object.keys(t.party)) assert.ok(k in DEFAULT_PARTY, `${t.id}.${k}`);
    if (t.date) assert.match(t.date, /^(festival:.+|\d{2}-\d{2})$/, t.id);
    for (const id of t.menu) assert.ok(COCKTAIL[id] || MOCKTAIL_IDS.includes(id), `${t.id} menu: ${id}`);
    assert.ok(t.menu.some((id) => COCKTAIL[id] && !COCKTAIL[id].mocktail), `${t.id} has a cocktail`);
  }
});

test("a template keeps the host, UPI, guests, drivers and tastes", () => {
  const { party: p } = applyTemplate({ party, cocktailMenu: menu, tpl: "diwali", today: "2026-09-26" });
  assert.equal(p.host, "Rohan");
  assert.equal(p.upi, "rohan@upi");
  assert.equal(p.guests, 14);
  assert.equal(p.drivers, 2);
  assert.equal(p.pegMl, 30);
  assert.deepEqual(p.prefs, party.prefs);
  assert.equal(p.name, "Diwali party");
  assert.equal(p.time, "20:00");
  assert.equal(p.hours, 5);
  assert.equal(p.vegPct, 70);
  assert.equal(p.mix, "mixed");
  // …unless the template is about guest count.
  const d = applyTemplate({ party, tpl: TEMPLATE.dinner, today: "2026-09-26" }).party;
  assert.equal(d.guests, 6);
  assert.equal(d.host, "Rohan");
  assert.equal(d.mix, "beerwine");
  // A template without a time or date keeps the party's.
  const b = applyTemplate({ party, tpl: "birthday", today: "2026-09-26" }).party;
  assert.equal(b.time, "19:00");
  assert.equal(b.date, "2026-10-10");
  // Old cfg without the v1.4.1 fields still works.
  const old = applyTemplate({ party: { guests: 8, hours: 4, name: "x" }, tpl: "cricket", today: "2026-09-26" }).party;
  assert.equal(old.guests, 8);
  assert.equal(old.drivers, 0);
  assert.equal(old.mix, "whisky");
});

test("festival and fixed dates", () => {
  const at = (id, today) => applyTemplate({ party, tpl: id, today }).party.date;
  assert.equal(at("diwali", "2026-09-26"), "2026-11-08");
  assert.equal(at("diwali", "2026-11-09"), "2027-10-29");
  assert.equal(at("nye", "2026-10-02"), "2026-12-31");
  assert.equal(at("nye", "2026-12-31"), "2026-12-31");
  assert.equal(at("nye", "2027-01-01"), "2027-12-31");
  assert.equal(at("holi", "2026-10-02"), "2027-03-22");
  assert.equal(templateDate(TEMPLATE.cricket, "2026-10-02"), null);
  // Past the dry-day tables: the date stays, with a note.
  const late = applyTemplate({ party, tpl: "diwali", today: "2028-01-05" });
  assert.equal(late.party.date, party.date);
  assert.match(late.note, /yearly update/);
  assert.match(templateToast(late, "gurgaon"), /^Diwali party set up\. Festival dates need a yearly update/);
});

test("the menu changes only when asked, and unknown ids are skipped", () => {
  const kept = applyTemplate({ party, cocktailMenu: menu, tpl: "nye", today: "2026-10-02" });
  assert.equal(kept.cocktailMenu, menu);
  const swapped = applyTemplate({ party, cocktailMenu: menu, tpl: "nye", today: "2026-10-02", replaceMenu: true });
  assert.ok(!swapped.cocktailMenu.some((m) => m.id === "gnt"));
  assert.ok(swapped.cocktailMenu.some((m) => m.id === "mojito"));
  for (const m of swapped.cocktailMenu) {
    assert.ok(COCKTAIL[m.id], `${m.id} is known`);
    assert.ok(Number.isInteger(m.servings) && m.servings >= 1, m.id);
  }
  // Ids that don't exist (yet) are dropped rather than put on the menu.
  const odd = { ...TEMPLATE.nye, menu: ["no-such-drink", "mojito", "mojito", "virgin-mojito"] };
  const ids = templateMenu(odd, party).map((m) => m.id);
  assert.ok(ids.includes("mojito") && !ids.includes("no-such-drink"));
  assert.equal(ids.filter((id) => id === "mojito").length, 1);
  assert.equal(ids.includes("virgin-mojito"), !!COCKTAIL["virgin-mojito"]);
  assert.deepEqual(templateMenu({ menu: ["nope"] }, party), []);
  // Half the planned drinks go to the cocktails: 14 guests, 50% → 7 drinkers × 5 drinks (4 h) = 35 → 17.5 → 9 each over two.
  const two = templateMenu({ menu: ["mojito", "gnt"] }, { ...party, hours: 4 });
  assert.deepEqual(two, [{ id: "mojito", servings: 9 }, { id: "gnt", servings: 9 }]);
});

test("unknown templates and empty input are harmless", () => {
  const r = applyTemplate({ party, cocktailMenu: menu, tpl: "nope" });
  assert.equal(r.party.name, party.name);
  assert.equal(r.cocktailMenu, menu);
  assert.equal(r.note, null);
  assert.ok(applyTemplate().party.guests > 0);
});

test("chip order, change list and toast", () => {
  const order = orderTemplates("2026-10-02");
  assert.equal(order[0].id, "diwali");                    // 37 days away
  assert.equal(order.length, TEMPLATES.length);
  assert.equal(new Set(order).size, TEMPLATES.length);
  assert.equal(orderTemplates("2026-12-01")[0].id, "nye");
  assert.equal(orderTemplates("2026-06-01")[0].id, TEMPLATES[0].id);   // nothing soon: listed order

  const next = applyTemplate({ party, tpl: "diwali", today: "2026-09-26" }).party;
  const ch = templateChanges(party, next);
  const keys = ch.map((c) => c.key);
  assert.ok(keys.includes("date") && keys.includes("hours") && keys.includes("mix"));
  assert.ok(!keys.includes("guests"));                    // unchanged → not listed
  assert.equal(ch.find((c) => c.key === "mix").to, "Mixed bar");
  assert.equal(ch.find((c) => c.key === "hours").from, "3 h");

  const msg = templateToast({ party: next, note: null }, "gurgaon");
  assert.match(msg, /^Diwali party set for .*8 Nov — it's often a dry day, buy bottles by .*7 Nov$/);
  const nye = applyTemplate({ party, tpl: "nye", today: "2026-10-02" });
  assert.match(templateToast(nye, "gurgaon"), /^New Year's Eve set for .*31 Dec 🎉$/);
});
