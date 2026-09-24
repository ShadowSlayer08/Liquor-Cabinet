import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestCity, zomatoSlugFor, bistroServes, distanceKm } from "../src/lib/location.js";
import { parseDistance, thumb } from "../src/lib/parse/zomato.js";

test("GPS → nearest Livcheers city", () => {
  assert.equal(nearestCity(28.4169, 77.0431).slug, "gurgaon");   // Sector 57, Gurugram
  assert.equal(nearestCity(28.6315, 77.2167).slug, "delhi");     // Connaught Place
  assert.equal(nearestCity(12.9352, 77.6245).slug, "bangalore"); // Koramangala
  assert.equal(nearestCity(19.1136, 72.8697).slug, "mumbai");    // Andheri
  const chennai = nearestCity(13.0418, 80.2341);                 // not a Livcheers city → nearest, far away
  assert.ok(chennai.km > 250);
});

test("Zomato city names → URL slugs", () => {
  assert.equal(zomatoSlugFor("Delhi NCR"), "ncr");
  assert.equal(zomatoSlugFor("Bengaluru"), "bangalore");
  assert.equal(zomatoSlugFor("Chennai"), "chennai");
  assert.equal(zomatoSlugFor("Navi Mumbai"), "mumbai");
});

test("Bistro service cities", () => {
  assert.ok(bistroServes("gurgaon") && bistroServes("bangalore") && bistroServes("noida"));
  assert.ok(!bistroServes("jaipur"));
});

test("distance helpers", () => {
  assert.equal(parseDistance("1.1 km"), 1100);
  assert.equal(parseDistance("904 m"), 904);
  assert.equal(parseDistance(""), null);
  assert.ok(Math.abs(distanceKm(28.4595, 77.0266, 28.6139, 77.209) - 25) < 3);
  assert.ok(thumb("https://b.zmtcdn.com/a.jpg?x=1", 120).startsWith("https://b.zmtcdn.com/a.jpg?fit=around%7C120"));
});
