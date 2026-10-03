// ═══════════════════════════════════════════════════════════════════════════════
//  RIDES HOME — designated drivers and ride hand-offs with the pickup filled in.
//  The app never books or tracks a ride: it opens Uber / Ola with the party's
//  location as the pickup (the rider picks the drop in their app), Rapido and
//  DriveU just open (no documented links). Links are plain https so WhatsApp
//  makes them tappable, and carry no partner/utm tokens (Ola's utm_source is an
//  affiliate id). Checked 26 Sep 2026: m.uber.com and book.olacabs.com
//  assetlinks name com.ubercab / com.olacabs.customer; Uber's iOS
//  apple-app-site-association covers /looking, Ola's only /app/* (Safari then).
//  Pure (no Capacitor), so node --test covers it; lib/order.js opens the links.
// ═══════════════════════════════════════════════════════════════════════════════
import { prettyWhen } from "./when.js";

// `launch`: no pickup link — the app opens (Android: by package; iOS: its universal link) or `home`.
export const RIDES = [
  { id: "uber", name: "Uber", pkg: "com.ubercab", home: "https://m.uber.com/looking", emoji: "🚗" },
  { id: "ola", name: "Ola", pkg: "com.olacabs.customer", home: "https://book.olacabs.com/", emoji: "🚕" },
  { id: "rapido", name: "Rapido", pkg: "com.rapido.passenger", home: "https://rapido.bike/", emoji: "🛵", launch: true },
  { id: "driveu", name: "DriveU", pkg: "com.humblemobile.consumer", home: "https://www.driveu.in/", emoji: "🔑", launch: true, note: "a driver for your own car" },
];
export const RIDE = Object.fromEntries(RIDES.map((r) => [r.id, r]));

const r4 = (n) => Math.round(n * 1e4) / 1e4; // ~11 m: plenty for a pickup pin

// The GPS fix as a pickup, or null when there's no usable fix. `named`: Zomato gave the
// spot a name ("Sector 57"); otherwise the pin is all there is.
export function pickupOf(loc) {
  const lat = Number(loc?.lat), lon = Number(loc?.lon);
  if (loc?.lat == null || loc?.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const label = String(loc.label || "").trim();
  return { lat: r4(lat), lon: r4(lon), label: label || "Party pickup", named: !!label };
}

// Drivers stay sober, so they can't outnumber the guests (when the party says how many).
export function driversOf(party) {
  const d = Math.max(0, Math.round(Number(party?.drivers) || 0));
  const guests = Math.round(Number(party?.guests));
  return Number.isFinite(guests) && guests >= 1 ? Math.min(guests, d) : d;
}

// The link that opens a ride app — with the pickup where the app takes one.
export function rideLink(id, loc) {
  const r = RIDE[id];
  if (!r) return null;
  const p = pickupOf(loc);
  if (id === "uber" && p) {
    return `https://m.uber.com/looking?pickup=${encodeURIComponent(JSON.stringify({ latitude: p.lat, longitude: p.lon, addressLine1: p.label }))}`;
  }
  if (id === "ola" && p) {
    return `https://book.olacabs.com/?lat=${p.lat}&lng=${p.lon}&pickup_name=${encodeURIComponent(p.label)}`;
  }
  return r.home;
}

// Does this ride open with the pickup filled in?
export const ridePrefills = (id, loc) => !!pickupOf(loc) && !RIDE[id]?.launch;

const plural = (n, one, many) => (n === 1 ? one : many);

// Plain text for WhatsApp & co: https links only (chat apps don't linkify custom schemes).
export function homeSafeMessage({ party, loc, host, drivers = 0 } = {}) {
  const name = String(party?.name || "").trim() || "the party";
  const when = prettyWhen(party);
  const p = pickupOf(loc);
  const who = String(host || "").trim() || "the host";
  const d = Math.max(0, Math.round(Number(drivers) || 0));
  const lines = [`🚕 *Getting home from ${name}*${when ? ` — ${when}` : ""}`];
  if (p?.named) lines.push(`Pickup: ${p.label}`);
  lines.push("");
  for (const id of ["uber", "ola", "rapido"]) lines.push(`${RIDE[id].name}: ${rideLink(id, loc)}`);
  lines.push(`Drove here? DriveU sends a driver for your car: ${RIDE.driveu.home}`);
  lines.push("", `Please don't drive if you've been drinking.${d ? ` ${d} of us ${plural(d, "is", "are")} driving tonight.` : ""}`);
  lines.push(`Text ${who} when you're home 🏠`);
  return lines.join("\n");
}
