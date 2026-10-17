// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN SNAPSHOT — one party plan as plain data (v1.6).
//
//  Party history keeps one per past party, and co-host sharing sends one to
//  another phone (QR code, link or file). Both use this shape, so a past party
//  and a friend's plan open the same way ("Plan again" / "Use their plan").
//  A snapshot holds the party details, the bottles, the cocktail menu, the food,
//  supplies and Bistro lines, the night out and the budget — never the GPS fix,
//  and a shared one never the host's UPI ID. restoreSnapshot() checks everything,
//  because a shared plan comes from another phone: unknown fields are dropped,
//  numbers are clamped, and only links to the sites the app already uses survive.
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════
import { CITIES } from "./parse/livcheers.js";
import { DEFAULT_PARTY, DEFAULT_PREFS } from "./food.js";
import { DEFAULT_OUT, withOut } from "./outModel.js";

export const SNAPSHOT_V = 1;

const CITY_SLUGS = new Set(CITIES.map((c) => c.slug));
const PARTY_KEYS = ["name", "date", "time", "guests", "hours", "drinkersPct", "vegPct", "appetite", "dinner", "pegMl", "drivers", "mix", "prefs", "host", "upi"];

// ── helpers ───────────────────────────────────────────────────────────────────
const str = (v, max = 160) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
const num = (v, lo = 0, hi = 1e7) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const int = (v, lo = 0, hi = 1e6) => { const n = num(v, lo, hi); return n == null ? null : Math.round(n); };
const iso = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const hhmm = (v) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);
const link = (v, prefixes) => (typeof v === "string" && v.length < 600 && !/[\s"'<>]/.test(v) && prefixes.some((p) => v.startsWith(p)) ? v : "");
const ZOMATO_LINKS = ["https://www.zomato.com/", "zomato://"];
const LIVCHEERS_LINKS = ["https://www.livcheers.com/"];
const LIVCHEERS_IMG = ["https://static.livcheers.com/"];
const DISTRICT_LINKS = ["https://www.district.in/"];
const plain = (o) => o && typeof o === "object" && !Array.isArray(o);

// ── snapshot (state → data) ───────────────────────────────────────────────────

/**
 * The plan as data. `share: true` leaves out what only this phone needs or shouldn't pass on:
 * the UPI ID, product photos and Zomato restaurant photos (they're fetched again).
 * @param {{ city, budget, party, liquor, cocktailMenu, food, out }} s  App state (liquor = { "cat:id": { cat, qty, item } })
 */
export function snapshotPlan(s = {}, { share = false, now = Date.now() } = {}) {
  const party = {};
  for (const k of PARTY_KEYS) if (s.party?.[k] !== undefined) party[k] = s.party[k];
  if (share) delete party.upi;
  const liquor = Object.values(s.liquor || {}).filter((l) => l?.item && l.qty > 0).map((l) => ({
    cat: l.cat, qty: l.qty,
    item: { id: l.item.id, name: l.item.name, brand: l.item.brand, sub: l.item.sub, vol: l.item.vol, ml: l.item.ml, price: l.item.price, url: l.item.url, flag: l.item.flag, ...(share ? {} : { img: l.item.img }) },
  }));
  const food = (s.food || []).map((l) => {
    const { img, ...rest } = l || {};
    if (share && rest.restaurant) { const { img: _i, ...r } = rest.restaurant; rest.restaurant = r; }
    return share ? rest : l;
  });
  return {
    v: SNAPSHOT_V, savedAt: now, city: s.city || null, budget: s.budget ?? null,
    party, liquor, cocktailMenu: (s.cocktailMenu || []).filter((m) => m && m.servings > 0).map((m) => ({ id: m.id, servings: m.servings })),
    food, out: s.out ? { ...s.out } : null,
  };
}

// ── restore (data → state pieces, checked) ────────────────────────────────────

function restoreParty(p) {
  const x = plain(p) ? p : {};
  const prefs = plain(x.prefs) ? x.prefs : {};
  return {
    ...DEFAULT_PARTY,
    name: str(x.name, 60) || DEFAULT_PARTY.name,
    date: iso(x.date), time: hhmm(x.time) || DEFAULT_PARTY.time,
    guests: int(x.guests, 1, 500) ?? DEFAULT_PARTY.guests,
    hours: num(x.hours, 1, 24) ?? DEFAULT_PARTY.hours,
    drinkersPct: int(x.drinkersPct, 0, 100) ?? DEFAULT_PARTY.drinkersPct,
    vegPct: int(x.vegPct, 0, 100) ?? DEFAULT_PARTY.vegPct,
    appetite: ["light", "regular", "hungry"].includes(x.appetite) ? x.appetite : DEFAULT_PARTY.appetite,
    dinner: typeof x.dinner === "boolean" ? x.dinner : DEFAULT_PARTY.dinner,
    pegMl: x.pegMl === 30 ? 30 : 60,
    drivers: int(x.drivers, 0, 100) ?? 0,
    mix: typeof x.mix === "string" ? str(x.mix, 20) : null,
    host: str(x.host, 60), upi: str(x.upi, 80),
    prefs: {
      ...DEFAULT_PREFS,
      drinks: Array.isArray(prefs.drinks) ? prefs.drinks.filter((t) => typeof t === "string").slice(0, 20).map((t) => str(t, 30)) : [],
      cuisines: Array.isArray(prefs.cuisines) ? prefs.cuisines.filter((t) => typeof t === "string").slice(0, 20).map((t) => str(t, 30)) : [],
      spice: ["mild", "medium", "hot"].includes(prefs.spice) ? prefs.spice : DEFAULT_PREFS.spice,
      avoid: Array.isArray(prefs.avoid) ? prefs.avoid.filter((t) => typeof t === "string").slice(0, 20).map((t) => str(t, 30)) : [],
      jain: !!prefs.jain,
    },
  };
}

function restoreLiquor(lines) {
  const out = {};
  for (const l of Array.isArray(lines) ? lines.slice(0, 200) : []) {
    const it = l?.item;
    const qty = int(l?.qty, 0, 500);
    if (!plain(it) || typeof l.cat !== "string" || it.id == null || !qty) continue;
    const item = {
      id: str(it.id, 40), name: str(it.name, 120), brand: str(it.brand, 60), sub: str(it.sub, 60), vol: str(it.vol, 20),
      ml: int(it.ml, 0, 10000) || 750, price: int(it.price, 0, 1e6) || 0, url: link(it.url, LIVCHEERS_LINKS), flag: str(it.flag, 8),
      img: link(it.img, LIVCHEERS_IMG) || null,
    };
    if (!item.name) continue;
    const key = `${str(l.cat, 20)}:${item.id}`;
    out[key] = { cat: str(l.cat, 20), qty: (out[key]?.qty || 0) + qty, item };
  }
  return out;
}

function restoreRestaurant(r) {
  if (!plain(r)) return null;
  return {
    resId: int(r.resId, 0, 1e12), name: str(r.name, 120), appLink: link(r.appLink, ZOMATO_LINKS), orderUrl: link(r.orderUrl, ZOMATO_LINKS),
    rating: num(r.rating, 0, 5), deliveryTime: str(r.deliveryTime, 30), locality: str(r.locality, 80), costText: str(r.costText, 40),
    costForOne: int(r.costForOne, 0, 1e5), distance: str(r.distance, 20),
    cuisines: Array.isArray(r.cuisines) ? r.cuisines.slice(0, 8).map((c) => str(c, 30)) : [],
  };
}

function restoreFood(lines) {
  const out = [], seen = new Set();
  for (const l of Array.isArray(lines) ? lines.slice(0, 300) : []) {
    if (!plain(l) || !["zomato", "blinkit", "bistro"].includes(l.kind) || typeof l.key !== "string") continue;
    const key = str(l.key, 120);
    if (seen.has(key)) continue;
    const qty = int(l.qty, 0, 1000);
    if (!qty) continue;
    const base = { key, kind: l.kind, name: str(l.name, 120), qty, ordered: false, emoji: str(l.emoji, 8) };
    if (l.kind === "zomato") {
      const restaurant = restoreRestaurant(l.restaurant);
      if (!restaurant) continue;
      out.push({ ...base, itemId: str(l.itemId, 60), veg: typeof l.veg === "boolean" ? l.veg : null, unitPrice: int(l.unitPrice, 0, 1e5) || 0, exact: !!l.exact,
        course: str(l.course, 20), section: str(l.section, 60), dishId: str(l.dishId, 40), restaurant });
    } else if (l.kind === "blinkit") {
      const p = plain(l.product) ? l.product : null;
      if (!p) continue;
      out.push({ ...base, groceryId: str(l.groceryId, 40), group: str(l.group, 40),
        product: { id: str(p.id, 60), name: str(p.name, 120), packText: str(p.packText, 40), price: int(p.price, 0, 1e5) || 0, pack: num(p.pack, 0, 1e5) } });
    } else {
      out.push({ ...base, itemId: str(l.itemId, 60), veg: typeof l.veg === "boolean" ? l.veg : null });
    }
    seen.add(key);
  }
  return out;
}

function restoreOut(o) {
  if (!plain(o)) return { ...DEFAULT_OUT };
  const w = withOut(o);
  const p = plain(w.pick) ? w.pick : null;
  const pick = p && (p.type === "venue" || p.type === "event") ? {
    ...p, type: p.type, name: str(p.name, 120), url: link(p.url, DISTRICT_LINKS),
    lat: num(p.lat, -90, 90), lon: num(p.lon, -180, 180),
  } : null;
  return { ...w, active: !!w.active && !!pick, pick, perHead: int(w.perHead, 0, 1e6), corkage: int(w.corkage, 0, 1e5),
    tickets: (w.tickets || []).slice(0, 30).filter(plain).map((t) => ({ ...t, name: str(t.name, 80), price: int(t.price, 0, 1e6) || 0, qty: int(t.qty, 0, 100) || 0 })) };
}

/**
 * A snapshot back into state pieces, checked (it may have come from another phone).
 * @returns {{ v, savedAt, city, budget, party, liquor, cocktailMenu, food, out }}  throws when it isn't a plan at all
 */
export function restoreSnapshot(snap) {
  if (!plain(snap) || typeof snap.v !== "number") throw new Error("That isn't a Liquor Cabinet plan");
  if (snap.v > SNAPSHOT_V) throw new Error("This plan is from a newer Liquor Cabinet — update the app to open it");
  return {
    v: SNAPSHOT_V,
    savedAt: int(snap.savedAt, 0, 1e14) || null,
    city: CITY_SLUGS.has(snap.city) ? snap.city : null,
    budget: int(snap.budget, 0, 1e8),
    party: restoreParty(snap.party),
    liquor: restoreLiquor(snap.liquor),
    cocktailMenu: (Array.isArray(snap.cocktailMenu) ? snap.cocktailMenu.slice(0, 100) : [])
      .filter((m) => plain(m) && typeof m.id === "string" && int(m.servings, 1, 1000)).map((m) => ({ id: str(m.id, 40), servings: int(m.servings, 1, 1000) })),
    food: restoreFood(snap.food),
    out: restoreOut(snap.out),
  };
}

// ── merge (two restored plans → one) ──────────────────────────────────────────

/**
 * "Add their items to mine": every bottle, dish, supply and cocktail from both, the larger
 * quantity where both have it. The party details, budget and night out stay mine (theirs
 * fill in only what I haven't set). Both arguments are restoreSnapshot() results.
 */
export function mergePlans(mine, theirs) {
  const liquor = { ...mine.liquor };
  for (const [k, l] of Object.entries(theirs.liquor || {})) liquor[k] = liquor[k] ? { ...liquor[k], qty: Math.max(liquor[k].qty, l.qty) } : l;
  const food = [...(mine.food || [])];
  for (const l of theirs.food || []) {
    const i = food.findIndex((x) => x.key === l.key);
    if (i < 0) food.push(l); else if (l.qty > food[i].qty) food[i] = { ...food[i], qty: l.qty };
  }
  const menu = [...(mine.cocktailMenu || [])];
  for (const m of theirs.cocktailMenu || []) {
    const i = menu.findIndex((x) => x.id === m.id);
    if (i < 0) menu.push(m); else if (m.servings > menu[i].servings) menu[i] = { ...menu[i], servings: m.servings };
  }
  return {
    ...mine,
    city: mine.city || theirs.city, budget: mine.budget ?? theirs.budget,
    liquor, food, cocktailMenu: menu,
    out: mine.out?.pick ? mine.out : theirs.out || mine.out,
  };
}

// ── summary (for previews and the history list) ───────────────────────────────

export function snapshotSummary(s) {
  const liquor = Object.values(s?.liquor || {});
  const food = s?.food || [];
  const bottles = liquor.reduce((n, l) => n + (l.qty || 0), 0);
  const bottleCost = liquor.reduce((n, l) => n + (l.item?.price || 0) * (l.qty || 0), 0);
  const foodCost = food.reduce((n, l) => n + (l.kind === "zomato" ? (l.unitPrice || 0) * l.qty : l.kind === "blinkit" ? (l.product?.price || 0) * l.qty : 0), 0);
  return {
    name: s?.party?.name || "Party", date: s?.party?.date || null, guests: s?.party?.guests || null,
    bottles, bottleCost, dishes: food.filter((l) => l.kind !== "blinkit").length, supplies: food.filter((l) => l.kind === "blinkit").length,
    foodCost, cocktails: (s?.cocktailMenu || []).length, out: !!(s?.out?.active && s.out.pick), place: s?.out?.pick?.name || "",
    total: bottleCost + foodCost,
  };
}

// Whether a plan has anything worth keeping (bottles, food, supplies or a night out).
export const hasPlan = (s) => !!(Object.keys(s?.liquor || {}).length || (s?.food || []).length || (s?.cocktailMenu || []).length || s?.out?.pick);
