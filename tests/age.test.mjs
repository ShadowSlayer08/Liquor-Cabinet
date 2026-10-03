import { test } from "node:test";
import assert from "node:assert/strict";
import { AGE_LINE, RULES_CHECKED, RULES_NOTE, STATE_AGE, ageFor, ageText, ageLine, ageSummary, BYOB_RULES, byobRule, BAR_HOURS, usualClose } from "../src/lib/age.js";
import { CITY_STATE } from "../src/lib/drydays.js";
import { CITIES } from "../src/lib/parse/livcheers.js";

test("the age table: 10 states, each with an age, a source and a status", () => {
  const states = Object.keys(STATE_AGE);
  assert.equal(states.length, 10);
  for (const [state, a] of Object.entries(STATE_AGE)) {
    assert.ok(a.age >= 18 && a.age <= 25, state);
    assert.ok(a.source, `${state} has a source`);
    assert.ok(["confirmed", "likely"].includes(a.status), `${state} status`);
    assert.equal(typeof a.note, "string");
    if (a.beer) assert.ok(a.beer < a.age, `${state} beer age is the lower one`);
  }
  assert.equal(RULES_CHECKED, "2026-10");
  assert.match(RULES_NOTE, /not legal advice/);
  assert.match(AGE_LINE, /18 to 25/);
});

test("every Livcheers city resolves to a state with a drinking age", () => {
  assert.equal(CITIES.length, 30);
  assert.deepEqual(Object.keys(CITY_STATE).sort(), CITIES.map((c) => c.slug).sort());
  for (const { slug } of CITIES) {
    const a = ageFor(slug);
    assert.ok(a, `${slug} resolves`);
    assert.equal(a.state, CITY_STATE[slug]);
    assert.equal(a.checked, "2026-10");
  }
  assert.equal(ageFor("atlantis"), null);
  assert.equal(ageFor(null), null);
});

test("the ages the brief checks", () => {
  assert.equal(ageFor("delhi").age, 25);
  assert.equal(ageFor("delhi").status, "confirmed");
  const mumbai = ageFor("mumbai");
  assert.equal(mumbai.state, "Maharashtra");
  assert.equal(mumbai.age, 25);
  assert.equal(mumbai.beer, 21);
  assert.equal(mumbai.permit, true);
  assert.equal(mumbai.status, "likely");
  assert.equal(ageFor("pune").beer, 21);
  assert.equal(ageFor("jaipur").age, 18);
  assert.equal(ageFor("udaipur").age, 18);
  assert.equal(ageFor("gurgaon").age, 21);
  assert.equal(ageFor("noida").age, 21);
  assert.equal(ageFor("bangalore").age, 21);
  assert.equal(ageFor("goa").age, 21);
  assert.equal(ageFor("kolkata").spiritsOnly, true);
});

test("age lines say 'reportedly' where the source is secondary", () => {
  assert.equal(ageLine("gurgaon"), "Legal drinking age in Haryana: 21. Carry ID: bars and clubs check.");
  assert.equal(ageLine("delhi"), "Legal drinking age in Delhi: 25. Carry ID: bars and clubs check.");
  assert.equal(ageLine("mumbai"), "Legal drinking age in Maharashtra: reportedly 25 for spirits, 21 for beer and wine, plus a drinking permit. Carry ID: bars and clubs check.");
  assert.equal(ageText(ageFor("kolkata")), "reportedly 21 for spirits");
  assert.equal(ageText(null), "");
  assert.equal(ageLine("atlantis"), `${AGE_LINE}. Carry ID: bars and clubs check.`);
  for (const { slug } of CITIES) {
    const a = ageFor(slug);
    assert.equal(ageLine(slug).includes("reportedly"), a.status === "likely", slug);
  }
});

test("ages grouped for the legal notice, youngest first", () => {
  const g = ageSummary();
  assert.deepEqual(g.map((x) => x.age), [18, 21, 25]);
  assert.deepEqual(g[0].states.map((s) => s.state), ["Rajasthan"]);
  const top = g[2].states;
  assert.deepEqual(top.map((s) => s.state).sort(), ["Delhi", "Maharashtra"]);
  assert.equal(top.find((s) => s.state === "Maharashtra").text, "Maharashtra (21 for beer and wine)");
  assert.equal(top.find((s) => s.state === "Maharashtra").likely, true);
  assert.equal(g.flatMap((x) => x.states).length, 10);
});

test("BYOB rules: Delhi rule 12(b), Haryana taverns, Maharashtra permit, a default elsewhere", () => {
  const delhi = byobRule("delhi");
  assert.equal(delhi.state, "Delhi");
  assert.match(delhi.source, /rule 12\(b\)/);
  assert.match(delhi.text, /licensed for drinking/);
  assert.match(delhi.text, /NCR/);                       // the list still shows nearby NCR places
  const hr = byobRule("gurgaon");
  assert.match(hr.text, /tavern next to a liquor shop/);
  assert.match(hr.text, /doesn't sell or serve liquor/);
  assert.match(hr.text, /live music or dancing/);
  assert.equal(hr.until, "2027-03-31");
  assert.equal(byobRule("faridabad", "2027-03-31").text, hr.text);
  assert.match(byobRule("gurgaon", "2027-04-01").text, /ran to 2027, so it may have changed/);
  assert.match(byobRule("pune").text, /permit/);
  assert.match(byobRule("pune").text, /reportedly/);
  const def = byobRule("jaipur");
  assert.equal(def.state, "Rajasthan");
  assert.equal(def.text, "BYOB rules vary. Check with the venue that it's allowed.");
  assert.equal(def.status, "unknown");
  for (const { slug } of CITIES) assert.ok(byobRule(slug)?.text, slug);
  assert.equal(byobRule("atlantis").state, "");
  for (const r of Object.values(BYOB_RULES)) assert.ok(!/₹|corkage of \d/i.test(r.text), "no corkage numbers from us");
});

test("usual bar hours are only ever 'usually', and only where known", () => {
  const g = usualClose("gurgaon");
  assert.equal(g.close, "00:00");
  assert.match(g.text, /midnight/);
  assert.match(g.text, /2 am or later with a paid extension/);
  assert.equal(usualClose("faridabad").close, "00:00");
  assert.equal(usualClose("delhi").close, "01:00");
  assert.match(usualClose("delhi").text, /reportedly/);
  assert.equal(usualClose("mumbai").close, "01:30");
  assert.equal(usualClose("pune").close, "01:30");
  assert.match(usualClose("bangalore").text, /microbrewery pubs at 11:30 pm/);
  assert.equal(usualClose("goa").close, "23:00");
  assert.equal(usualClose("jaipur"), null);
  assert.equal(usualClose("thane"), null);
  assert.equal(usualClose("mysore"), null);
  for (const h of Object.values(BAR_HOURS)) {
    assert.match(h.text, /usually/);
    assert.match(h.close, /^\d\d:\d\d$/);
    assert.equal(h.text.includes("reportedly"), h.status === "likely", h.text);
  }
});
