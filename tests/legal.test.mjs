import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL_SERVICES, LEGAL_POINTS, LEGAL_DATA, ISSUES_URL, REPO_URL, serviceForHost, isAllowedHost } from "../src/lib/legal.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const walk = (dir, exts) => {
  let out = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out = out.concat(walk(p, exts));
    else if (exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
};
const hostsIn = (text) => [...text.matchAll(/https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)].map((m) => m[1].toLowerCase());

test("every service the app talks to is named in the legal notice", () => {
  const files = [
    ...walk(join(ROOT, "src"), [".js", ".jsx"]),
    ...walk(join(ROOT, "android/app/src/main/java"), [".java"]),
    ...walk(join(ROOT, "ios/App/App"), [".swift"]),
  ];
  assert.ok(files.length > 20, "found the source");
  const seen = new Set();
  for (const f of files) {
    for (const host of hostsIn(readFileSync(f, "utf8"))) {
      seen.add(host);
      assert.ok(serviceForHost(host) || isAllowedHost(host), `${relative(ROOT, f)} talks to ${host}, which lib/legal.js (and the README notice) doesn't name`);
    }
  }
  for (const h of ["www.livcheers.com", "www.zomato.com", "blinkit.com", "wa.me"]) assert.ok(seen.has(h), `scan sees ${h}`);
});

test("hosts map to services, subdomains included", () => {
  assert.equal(serviceForHost("www.zomato.com").name, "Zomato");
  assert.equal(serviceForHost("link.zomato.com").name, "Zomato");
  assert.equal(serviceForHost("static.livcheers.com").name, "Livcheers");
  assert.equal(serviceForHost("bistro.blinkit.com").name, "Blinkit / Bistro");
  assert.equal(serviceForHost("WWW.SWIGGY.COM").name, "Swiggy Instamart");
  assert.equal(serviceForHost("m.uber.com").name, "Uber");
  assert.equal(serviceForHost("www.driveu.in").name, "DriveU");
  assert.equal(serviceForHost("www.district.in").name, "District");
  assert.equal(serviceForHost("district.in").name, "District");
  assert.equal(serviceForHost("notdistrict.in"), null);
  assert.equal(serviceForHost("notzomato.com"), null);
  assert.equal(serviceForHost("zomato.com.evil.io"), null);
  assert.equal(serviceForHost(""), null);
  assert.ok(isAllowedHost("github.com") && !isAllowedHost("example.com"));
});

test("the notice is complete", () => {
  const names = LEGAL_SERVICES.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of ["Livcheers", "Zomato", "District", "Blinkit / Bistro", "Google Maps", "WhatsApp", "Uber", "Ola", "Rapido", "DriveU", "Zepto", "Swiggy Instamart"]) {
    assert.ok(names.includes(n), n);
  }
  for (const s of LEGAL_SERVICES) assert.ok(s.hosts.length && s.use, s.name);
  const all = [...LEGAL_DATA, ...LEGAL_POINTS.map((p) => p.text)].join(" ");
  for (const phrase of ["legal drinking age", "not legal advice", "affiliated", "no Liquor Cabinet server", "only on this phone", "about 10 m"]) {
    assert.ok(all.includes(phrase), phrase);
  }
  assert.equal(REPO_URL, "https://github.com/ShadowSlayer08/Liquor-Cabinet");
  assert.equal(ISSUES_URL, `${REPO_URL}/issues`);
});

// v1.5 Out tab: District is read by venue and city only, and going out has its own terms.
test("the notice covers going out with District", () => {
  assert.ok(LEGAL_DATA.some((t) => t.includes("your location isn't sent to District")), "location sentence names District");
  const outing = LEGAL_POINTS.find((p) => p.id === "outing");
  assert.ok(outing, "an 'outing' point");
  for (const phrase of ["between you, District and the venue", "not convenience fees", "venue's call", "organiser's rule, not the legal age"]) {
    assert.ok(outing.text.includes(phrase), phrase);
  }
  assert.match(LEGAL_POINTS.find((p) => p.id === "age").text, /18 to 25/);
  assert.match(LEGAL_SERVICES.find((s) => s.name === "Zomato").use, /bars and BYOB places/);
});

// The README's "Data sources & legal notice" is the reference wording: it must name every service too.
test("README notice names the same services", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const start = readme.indexOf("## Data sources & legal notice");
  assert.ok(start >= 0, "README has the notice");
  const end = readme.indexOf("\n## ", start + 4);
  const section = readme.slice(start, end < 0 ? undefined : end).replace(/\*\*/g, "");
  assert.ok(section.includes(ISSUES_URL), "README links the issues page");
  for (const s of LEGAL_SERVICES) assert.ok(section.includes(s.name), `README notice names ${s.name}`);
  // The table row says what the app does with District in the same words as lib/legal.js.
  const district = LEGAL_SERVICES.find((s) => s.name === "District");
  assert.ok(section.includes(`| District (district.in) | ${district.use} |`), "README District row matches legal.js");
  assert.match(section, /not affiliated with, endorsed by or sponsored by[^.]*District/, "District in the not-affiliated list");
  assert.ok(section.includes("your location isn't sent to District"), "README says District doesn't get your location");
});

test("README describes the Out tab and District in its data and ordering sections", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const part = (h) => {
    const start = readme.indexOf(`## ${h}`);
    assert.ok(start >= 0, `README has "${h}"`);
    const end = readme.indexOf("\n## ", start + 4);
    return readme.slice(start, end < 0 ? undefined : end);
  };
  assert.match(part("What it does"), /\| .*\*\*Out\*\* \|/);
  assert.match(part("Where the data comes from"), /District/);
  assert.match(part("Ordering"), /District/);
  assert.match(part("Notes"), /drinking age varies by state, from 18 [^.]*to 25/);
  assert.match(part("Notes"), /BYOB is regulated/);
});
