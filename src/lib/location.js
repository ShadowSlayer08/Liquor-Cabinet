// ═══════════════════════════════════════════════════════════════════════════════
//  LOCATION — GPS → nearest Livcheers city + your exact Zomato delivery zone.
//
//  Zomato's /webroutes/location/get turns lat/lon into a delivery "subzone".
//  Sending that zone as the ltv/lty cookies makes Zomato's dish and menu pages
//  list restaurants that deliver to *you*, with real distances.
// ═══════════════════════════════════════════════════════════════════════════════
import { Geolocation } from "@capacitor/geolocation";
import { getText, isNative } from "./http.js";

// City centres for the 30 Livcheers cities.
export const CITY_COORDS = {
  agra: [27.1767, 78.0081], asansol: [23.6739, 86.9524], bangalore: [12.9716, 77.5946], bhopal: [23.2599, 77.4126],
  delhi: [28.6139, 77.209], faridabad: [28.4089, 77.3178], ghaziabad: [28.6692, 77.4538], goa: [15.4909, 73.8278],
  gurgaon: [28.4595, 77.0266], gwalior: [26.2183, 78.1828], "hubli-dharwad": [15.3647, 75.124], hyderabad: [17.385, 78.4867],
  indore: [22.7196, 75.8577], jabalpur: [23.1815, 79.9864], jaipur: [26.9124, 75.7873], jodhpur: [26.2389, 73.0243],
  kanpur: [26.4499, 80.3319], kolkata: [22.5726, 88.3639], kota: [25.2138, 75.8648], lucknow: [26.8467, 80.9462],
  mangalore: [12.9141, 74.856], mumbai: [19.076, 72.8777], mysore: [12.2958, 76.6394], nagpur: [21.1458, 79.0882],
  nashik: [19.9975, 73.7898], noida: [28.5355, 77.391], pune: [18.5204, 73.8567], thane: [19.2183, 72.9781],
  udaipur: [24.5854, 73.7125], warangal: [17.9689, 79.5941],
};

export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat, lon) {
  let best = null;
  for (const [slug, [clat, clon]] of Object.entries(CITY_COORDS)) {
    const km = distanceKm(lat, lon, clat, clon);
    if (!best || km < best.km) best = { slug, km };
  }
  return best;
}

// Zomato city name → the slug its URLs use.
const ZOMATO_SLUGS = {
  "delhi ncr": "ncr", bengaluru: "bangalore", bangalore: "bangalore", mysuru: "mysore", mangaluru: "mangalore",
  hubballi: "hubli", "hubli-dharwad": "hubli", "navi mumbai": "mumbai", thane: "mumbai", gurugram: "ncr",
};
export function zomatoSlugFor(cityName) {
  const k = String(cityName || "").trim().toLowerCase();
  return ZOMATO_SLUGS[k] || k.replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

// Bistro (Blinkit's 10-minute food app) runs in parts of these cities.
const BISTRO_CITIES = new Set(["gurgaon", "delhi", "noida", "ghaziabad", "faridabad", "bangalore"]);
export const bistroServes = (citySlug) => BISTRO_CITIES.has(citySlug);

export async function getPosition() {
  if (isNative()) {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") throw new Error("Location permission denied");
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

export async function zomatoZone(lat, lon) {
  // ~11 m precision is plenty for a delivery zone; no need to send Zomato your exact spot.
  const json = JSON.parse(await getText(`https://www.zomato.com/webroutes/location/get?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { timeout: 20000 }));
  const d = json?.locationDetails;
  if (!d?.entityId) throw new Error("Zomato doesn't recognise this location");
  return {
    entityId: d.entityId, entityType: d.entityType, cityId: d.cityId, cityName: d.cityName,
    city: zomatoSlugFor(d.cityName), label: d.orderLocationName || d.entityName || d.displayTitle || d.cityName,
    serviceable: d.o2Serviceable !== false,
  };
}

// Full detection: GPS → { lat, lon, citySlug, cityKm, label, zomato }.
export async function locate() {
  const { lat, lon, accuracy } = await getPosition();
  const near = nearestCity(lat, lon);
  let zomato = null;
  try { zomato = await zomatoZone(lat, lon); } catch (e) { console.warn("zomatoZone", e); }
  return { lat, lon, accuracy, citySlug: near.slug, cityKm: Math.round(near.km), label: zomato?.label || null, zomato, at: Date.now() };
}

// Cookie that makes Zomato answer for this exact delivery zone.
export const zomatoCookie = (loc) => (loc?.zomato?.entityId ? `ltv=${loc.zomato.entityId}; lty=${loc.zomato.entityType}` : null);
