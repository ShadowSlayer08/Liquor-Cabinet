import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQuiz, seedQuiz, profileFromQuiz, stepsFor, quizSummary, reasonsFor, resolveMoney, cycleFamily, familySplit,
  syncCatsFor, menuByFamily, templateLabel, COCKTAIL_SHARES, DEFAULT_QUIZ, STEPS,
} from "../src/lib/barQuiz.js";
import { fillBar, MIXES } from "../src/lib/optimise.js";
import { applyTemplate } from "../src/lib/templates.js";
import { loadCatalog } from "./fixtures/livcheers/catalog.mjs";

const GGN = loadCatalog();

test("normalizeQuiz takes any shape and hands back a clean one", () => {
  for (const junk of [null, undefined, "x", 3, [], { v: 9 }]) assert.deepEqual(normalizeQuiz(junk), DEFAULT_QUIZ, JSON.stringify(junk));
  const q = normalizeQuiz({
    families: { whisky: 2, beer: "1", nope: 2, rum: 5, gin: 0 }, style: ["mix", "dance", "sip", "mix"], tier: "cheap", origin: "mars",
    money: { kind: "head", value: -3 }, favs: { whisky: "Royal Stag", nope: "x", rum: 12 }, answered: ["style", "x", "families"], variety: 0, seededMix: "nope",
  });
  assert.deepEqual(q.families, { whisky: 2, beer: 1 });
  assert.deepEqual(q.style, ["sip", "mix"]);
  assert.equal(q.tier, "auto");
  assert.equal(q.origin, "any");
  assert.deepEqual(q.money, { kind: "left" });
  assert.deepEqual(q.favs, { whisky: "royalstag" });
  assert.deepEqual(q.answered, ["families", "style"]);
  assert.equal(q.variety, true);          // only an explicit false turns it off
  assert.equal(q.seededMix, null);
  assert.equal(normalizeQuiz({ families: {} }).families, null);
  assert.deepEqual(normalizeQuiz({ money: { kind: "amount", value: "15000" } }).money, { kind: "amount", value: 15000 });
  assert.deepEqual(normalizeQuiz({ style: [] }).style, []);       // "however they like" is an answer too
  assert.equal(normalizeQuiz({ variety: false }).variety, false);
  // Round trip.
  assert.deepEqual(normalizeQuiz(normalizeQuiz(q)), q);
});

test("Q1 chips cycle off → some → lots → off", () => {
  let f = cycleFamily(null, "whisky");
  assert.deepEqual(f, { whisky: 1 });
  f = cycleFamily(f, "whisky");
  assert.deepEqual(f, { whisky: 2 });
  f = cycleFamily(cycleFamily(f, "beer"), "whisky");
  assert.deepEqual(f, { beer: 1 });
  assert.equal(cycleFamily(cycleFamily(f, "beer"), "beer"), null);   // back to "not sure"
  assert.equal(cycleFamily(null, "nope"), null);
});

test("seeding: last answers, then the template, then the guests' tastes, then defaults", () => {
  const tastes = { drinks: ["fruity", "sweet", "refreshing"] };
  // Nothing saved, no template: the tastes (two+ families hinted).
  const t = seedQuiz({ party: { mix: null, prefs: tastes } });
  assert.equal(t.from, "tastes");
  assert.deepEqual(t.answers.families, { beer: 1, rum: 2, vodka: 2, gin: 1 });
  assert.deepEqual(t.answers.style, ["mix", "cocktails"]);
  // One family hinted isn't enough to guess the bar: "not sure", but the style still comes through.
  const one = seedQuiz({ party: { prefs: { drinks: ["strong"] } } });
  assert.equal(one.answers.families, null);
  assert.deepEqual(one.answers.style, ["sip"]);
  // A template beats the tastes.
  const tpl = seedQuiz({ party: { mix: "whisky", name: "Match night", prefs: tastes } });
  assert.equal(tpl.from, "template");
  assert.deepEqual(tpl.answers.families, { whisky: 2, rum: 1, beer: 1 });
  assert.equal(tpl.answers.seededMix, "whisky");
  assert.equal(templateLabel({ mix: "whisky", name: "Match night" }), "Match night");
  assert.equal(templateLabel({ mix: "whisky", name: "Rahul's 30th" }), "Whisky night");
  // Saved answers beat both while the template hasn't changed…
  const saved = { families: { gin: 2 }, style: ["sip"], seededMix: "whisky", tier: "premium", origin: "imported", money: { kind: "amount", value: 9000 }, favs: { gin: "bombaysapphire" }, answered: ["families", "style", "vibe"] };
  const kept = seedQuiz({ saved, party: { mix: "whisky", prefs: tastes } });
  assert.equal(kept.from, "saved");
  assert.equal(kept.reseeded, false);
  assert.deepEqual(kept.answers.families, { gin: 2 });
  // …and with no template at all.
  assert.deepEqual(seedQuiz({ saved, party: { prefs: tastes } }).answers.families, { gin: 2 });
  // A template applied since: what they drink and how come from it, the rest stays the host's.
  const re = seedQuiz({ saved, party: { mix: "beerwine", name: "Dinner party" } });
  assert.equal(re.reseeded, true);
  assert.deepEqual(re.answers.families, { beer: 2, wine: 2 });
  assert.deepEqual(re.answers.style, []);
  assert.equal(re.answers.seededMix, "beerwine");
  assert.equal(re.answers.tier, "premium");
  assert.equal(re.answers.origin, "imported");
  assert.deepEqual(re.answers.money, { kind: "amount", value: 9000 });
  assert.deepEqual(re.answers.favs, { gin: "bombaysapphire" });
  assert.deepEqual(re.answers.answered, ["vibe"]);
  // Nothing at all: the defaults.
  assert.deepEqual(seedQuiz({}).answers, DEFAULT_QUIZ);
});

test("seeding from real templates and a cocktail menu", () => {
  const { party, cocktailMenu } = applyTemplate({ party: {}, tpl: "birthday", replaceMenu: true, today: "2026-10-10" });
  const s = seedQuiz({ party, cocktailMenu });
  assert.equal(party.mix, "menu");
  assert.deepEqual(s.answers.style, ["cocktails"]);
  // Cosmo (vodka) and Piña Colada (rum) with the same servings: the bigger family is "lots", and a
  // tie goes to the chips' order (rum before vodka).
  assert.deepEqual(s.answers.families, { rum: 2, vodka: 1 });
  // Every template's bar style seeds something sensible.
  for (const mix of Object.keys(MIXES)) assert.doesNotThrow(() => profileFromQuiz(seedQuiz({ party: { mix } }).answers), mix);
  // A menu with only mocktails: "not sure".
  assert.equal(seedQuiz({ party: { mix: "menu" }, cocktailMenu: [{ id: "virgin-mojito", servings: 8 }] }).answers.families, null);
});

test("answers → shares: lots and some, wine, shots, not sure", () => {
  const p = profileFromQuiz({ families: { whisky: 2, beer: 1 }, style: ["mix"] });
  assert.deepEqual(p.shares, { whisky: 0.75, beer: 0.25 });
  assert.deepEqual(p.keep, ["whisky", "beer"]);
  assert.deepEqual(p.profile.style, { sip: false, mix: true, cocktails: false, shots: false });
  // Wine splits 60/40 into red and white.
  const w = profileFromQuiz({ families: { wine: 2, beer: 2 } });
  assert.deepEqual(w.shares, { redwine: 0.3, whitewine: 0.2, beer: 0.5 });
  assert.deepEqual(w.keep.sort(), ["beer", "redwine", "whitewine"]);
  // Shots with no tequila or vodka add a bit of tequila — not one the host asked for, so not kept.
  const s = profileFromQuiz({ families: { whisky: 2 }, style: ["shots"] });
  assert.deepEqual(s.shares, { whisky: 0.75, tequila: 0.25 });
  assert.deepEqual(s.auto, ["tequila"]);
  assert.deepEqual(s.keep, ["whisky"]);
  assert.deepEqual(profileFromQuiz({ families: { vodka: 1 }, style: ["shots"] }).shares, { vodka: 1 });
  // Not sure: the mixed bar, or the cocktail spirits for a cocktails-only crowd.
  assert.deepEqual(profileFromQuiz({ families: null, style: ["mix"] }).shares, MIXES.mixed.shares);
  assert.deepEqual(profileFromQuiz({ families: null, style: ["cocktails"] }).shares, COCKTAIL_SHARES);
  assert.deepEqual(profileFromQuiz({ families: null, style: ["cocktails", "mix"] }).shares, MIXES.mixed.shares);
  assert.deepEqual(profileFromQuiz({}).keep, []);
  // The rest of the profile passes through.
  const full = profileFromQuiz({ tier: "premium", origin: "desi", favs: { whisky: "Royal Stag" }, variety: false });
  assert.deepEqual(full.profile, { tier: "premium", style: { sip: false, mix: true, cocktails: false, shots: false }, origin: "desi", favs: { whisky: "royalstag" }, variety: false });
  // The live split under Q1 adds up, in the chips' families.
  const split = familySplit({ families: { whisky: 2, wine: 1, beer: 1 } });
  assert.deepEqual(split.map((x) => x.id), ["whisky", "beer", "wine"]);
  assert.equal(split.reduce((s, x) => s + x.pct, 0), 100);
  // Syncing for a whisky crowd includes Indian whisky (not synced by default).
  assert.ok(syncCatsFor({ families: { whisky: 2 } }).includes("indian"));
  assert.ok(syncCatsFor({}).includes("indian"));
  assert.deepEqual(syncCatsFor({ families: { wine: 1 } }), ["redwine", "whitewine", "rose"]);
});

test("Q4 only shows up when a spirit or wine they drink comes both ways", () => {
  assert.deepEqual(stepsFor({}), STEPS);
  assert.deepEqual(stepsFor({ families: { beer: 2, tequila: 1 } }), ["families", "style", "vibe", "budget"]);
  assert.deepEqual(stepsFor({ families: { bubbly: 1 } }), ["families", "style", "vibe", "budget"]);
  assert.ok(stepsFor({ families: { whisky: 1 } }).includes("origin"));
  // What's synced wins over the built-in guess.
  assert.ok(!stepsFor({ families: { gin: 1 } }, { desiShare: { gin: 0.05 } }).includes("origin"));
});

test("the budget: their pick, else what's left, else the full bar, else ₹10k", () => {
  assert.equal(resolveMoney({ kind: "amount", value: 15000 }, { left: 9000 }), 15000);
  assert.equal(resolveMoney({ kind: "left" }, { left: 9000, enough: 4400 }), 9000);
  assert.equal(resolveMoney({ kind: "left" }, { left: -200, enough: 4400 }), 4400);
  assert.equal(resolveMoney({ kind: "left" }, { left: 0 }), 10000);
  assert.equal(resolveMoney({ kind: "head", value: 1000 }, { drinkers: 8 }), 8000);
  assert.equal(resolveMoney({ kind: "head", value: 1000 }, { drinkers: 0, left: 5000 }), 5000);
  assert.equal(resolveMoney({ kind: "enough" }, { left: 9000, enough: 4400 }), 4400);
  assert.equal(resolveMoney(null, {}), 10000);
});

test("the answers strip", () => {
  const labels = (a, o) => quizSummary(a, o).map((c) => c.label);
  assert.deepEqual(labels({ families: { whisky: 2, beer: 1 }, style: ["mix"], tier: "classic", origin: "desi" }, { amount: 12000 }),
    ["🥃 Whisky-heavy", "🥤 With mixers", "✨ Crowd favourites", "🇮🇳 Indian", "💰 ₹12k"]);
  assert.deepEqual(labels({ families: { whisky: 2, beer: 2 }, style: ["sip", "mix"] }, { amount: 12000, tier: "classic", steps: ["families", "style", "vibe", "budget"] }),
    ["🥃 Whisky & beer", "🧊 Neat & mixers", "✨ Crowd favourites · fits ₹12k", "💰 ₹12k"]);
  assert.deepEqual(labels({}, {}), ["🍹 Mixed bar", "🥤 With mixers", "✨ Best for my budget", "🌐 Made anywhere"]);
  assert.equal(labels({ families: { gin: 1 } }, {})[0], "🌿 Gin only");
  assert.equal(labels({ families: { gin: 1, rum: 1, beer: 1 } }, {})[0], "🍺 Beer, rum +1");
  assert.deepEqual(quizSummary({}, {}).map((c) => c.step), ["families", "style", "vibe", "origin"]);
});

test("reasons: short, honest, never two of a kind", () => {
  const base = { family: "vodka", cat: "vodka", costPerDrink: 117, item: { name: "Absolut Vodka", brand: "Absolut", rating: 4.6, origin: "Sweden", flag: "🇸🇪", sub: "Plain" } };
  const texts = (line, ctx) => reasonsFor(line, ctx).map((r) => r.text);
  assert.deepEqual(texts({ ...base, from: "own", rank: 23, pos: 1 }, { profile: { style: { mix: true } } }), ["Most popular vodka on Livcheers", "Great with mixers"]);
  assert.deepEqual(texts({ ...base, from: "own", rank: 23, pos: 18 }, {}), ["Top-25 vodka on Livcheers", "Imported · Sweden 🇸🇪"]);
  assert.deepEqual(texts({ ...base, from: "own", rank: 300, pos: 40 }, { profile: { style: {} } }), ["4.6★ on Livcheers", "Imported · Sweden 🇸🇪"]);
  // A borrowed rank or a household name says so, and a rating without a rank is never shown.
  assert.deepEqual(texts({ ...base, from: "brand", rank: 69, pos: null }, {}), ["Popular brand", "Imported · Sweden 🇸🇪"]);
  const monk = { family: "rum", cat: "rum", costPerDrink: 48, cheap: true, from: "staple", rank: 60, pos: null, item: { name: "Old Monk XXX", brand: "Old Monk", rating: 4.7, origin: "India", sub: "Dark" } };
  assert.deepEqual(texts(monk, {}), ["A household name", "≈ ₹48 a drink"]);
  assert.deepEqual(texts({ ...monk, from: null, rank: null }, { profile: { origin: "desi" } }), ["Made in India", "≈ ₹48 a drink"]);
  // Their usual and the cocktail menu come first.
  const menu = menuByFamily([{ id: "mojito", servings: 8 }, { id: "virgin-mojito", servings: 4 }]);
  assert.deepEqual(menu, { rum: ["Mojito"] });
  assert.deepEqual(texts(monk, { menu, profile: { favs: { rum: "oldmonk" } } }), ["Their usual", "For your Mojitos"]);
  assert.deepEqual(texts(monk, { menu: menuByFamily([{ id: "mojito", servings: 8 }, { id: "rum-coke", servings: 4 }]) })[0], "For your cocktail menu");
  assert.equal(reasonsFor(null).length, 0);
  // On real picks: every line, every answer.
  for (const tier of ["auto", "value", "classic", "premium", "top"]) for (const origin of ["any", "desi", "imported"]) for (const style of [{ mix: true }, { sip: true }, { cocktails: true, shots: true }]) {
    const profile = { tier, origin, style };
    const r = fillBar({ catalog: GGN, drinks: 60, budget: 20000, shares: MIXES.mixed.shares, profile, menu: [{ id: "mojito", servings: 10 }] });
    for (const l of [...r.lines, ...Object.values(r.alternatives).flat()]) {
      const rs = reasonsFor(l, { profile, menu: menuByFamily([{ id: "mojito", servings: 10 }]) });
      const label = `${l.item.name} (${l.from} #${l.rank}): ${rs.map((x) => x.text).join(" · ")}`;
      assert.ok(rs.length >= 1 && rs.length <= 2, label);
      assert.equal(new Set(rs.map((x) => x.kind)).size, rs.length, label);
      if (l.from !== "own") assert.ok(!rs.some((x) => /on Livcheers/.test(x.text)), label);
      for (const x of rs) assert.ok(x.text.length <= 40, label);
    }
  }
});
