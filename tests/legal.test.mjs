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
  assert.equal(serviceForHost("notzomato.com"), null);
  assert.equal(serviceForHost("zomato.com.evil.io"), null);
  assert.equal(serviceForHost(""), null);
  assert.ok(isAllowedHost("github.com") && !isAllowedHost("example.com"));
});

test("the notice is complete", () => {
  const names = LEGAL_SERVICES.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of ["Livcheers", "Zomato", "Blinkit / Bistro", "Google Maps", "WhatsApp", "Uber", "Ola", "Rapido", "DriveU", "Zepto", "Swiggy Instamart"]) {
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

// The README's "Data sources & legal notice" is the reference wording: it must name every service too.
test("README notice names the same services", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const start = readme.indexOf("## Data sources & legal notice");
  assert.ok(start >= 0, "README has the notice");
  const end = readme.indexOf("\n## ", start + 4);
  const section = readme.slice(start, end < 0 ? undefined : end).replace(/\*\*/g, "");
  assert.ok(section.includes(ISSUES_URL), "README links the issues page");
  for (const s of LEGAL_SERVICES) assert.ok(section.includes(s.name), `README notice names ${s.name}`);
});
