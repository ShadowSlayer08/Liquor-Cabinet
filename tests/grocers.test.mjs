import { test } from "node:test";
import assert from "node:assert/strict";
import { GROCERS, GROCER_IDS, grocerOf, grocerSearchUrl, blinkitSearchUrl } from "../src/lib/grocers.js";

test("every grocer has an app package and an https search link", () => {
  assert.deepEqual(GROCER_IDS, ["blinkit", "zepto", "instamart"]);
  for (const id of GROCER_IDS) {
    const g = GROCERS[id];
    assert.equal(g.id, id);
    assert.ok(g.name && g.logo);
    assert.ok(g.pkgs.length >= 1 && g.pkgs.every((p) => /^[a-z][\w.]+$/.test(p)));
    assert.match(g.home, /^https:\/\//);
    assert.match(g.search("soda"), /^https:\/\//);
    assert.ok(g.cls.logo && g.cls.btn && g.cls.head);
  }
  assert.deepEqual(GROCERS.blinkit.cls, { logo: "logo logo-b", btn: "btn-blinkit", head: "provider-b" });   // Blinkit looks as in v1.4
  assert.deepEqual(GROCERS.instamart.pkgs, ["in.swiggy.android.instamart", "in.swiggy.android"]);  // standalone app first
});

test("the Blinkit search link is unchanged from v1.4", () => {
  assert.equal(blinkitSearchUrl("Kinley Club Soda"), "https://blinkit.com/s/?q=Kinley%20Club%20Soda");
  assert.equal(grocerSearchUrl("blinkit", "Kinley Club Soda"), "https://blinkit.com/s/?q=Kinley%20Club%20Soda");
});

test("queries with &, %, # and Hindi are encoded", () => {
  const q = "Haldiram's Bhujia & Sev 100% #1 नमकीन";
  for (const id of GROCER_IDS) {
    const url = new URL(grocerSearchUrl(id, q));
    const key = id === "blinkit" ? "q" : "query";
    assert.equal(url.searchParams.get(key), q, id);
    assert.equal(url.hash, "", id);                 // # didn't end the URL
    assert.equal([...url.searchParams.keys()].filter((k) => k === key).length, 1, id);   // & didn't split it
  }
  assert.equal(grocerSearchUrl("zepto", "tonic water"), "https://www.zeptonow.com/search?query=tonic%20water");
  assert.equal(grocerSearchUrl("instamart", "ice"), "https://www.swiggy.com/instamart/search?custom_back=true&query=ice");
});

test("an unknown grocer falls back to Blinkit; no partner tokens", () => {
  assert.equal(grocerOf("bigbasket"), GROCERS.blinkit);
  assert.equal(grocerOf(undefined), GROCERS.blinkit);
  assert.equal(grocerSearchUrl(null, " soda "), blinkitSearchUrl("soda"));
  for (const id of GROCER_IDS) assert.doesNotMatch(grocerSearchUrl(id, "x"), /utm_|affiliate|ref=/);
});
