// ═══════════════════════════════════════════════════════════════════════════════
//  FOOD CALCULATOR  (pure — unit-tested)
//
//  Works out how much a party needs — drinks, mixers, ice, starters, mains,
//  munchies, disposables — from the guest list and what's in the liquor cart.
//  Cooked food is ordered on Zomato (live restaurants + prices per city);
//  groceries/mixers/ice on Blinkit (live reference prices from DMart).
//
//  Quantities follow common Indian party-catering rules of thumb:
//    • drinks: 2 in the first hour, then 1 per hour, per drinker
//    • mixer: 150 ml per spirit drink; ice ≈ 0.5 kg per drinker (+0.1 kg/h after 3 h)
//    • starters: ~6 pieces/guest before dinner, ~12 for a snacks-only party (4 h)
//    • mains: one "for one" Zomato serving per guest; 2–3 breads each
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";

export const MIXER_PER_DRINK = 150; // ml
export const PIECES_PER_PLATE = 8;  // a typical Zomato starter plate

export const APPETITE = {
  light:   { label: "Light",   f: 0.8 },
  regular: { label: "Regular", f: 1 },
  hungry:  { label: "Hungry",  f: 1.25 },
};

export const DEFAULT_PARTY = {
  guests: 10, hours: 4, drinkersPct: 80, vegPct: 40, appetite: "regular", dinner: true, pegMl: 60,
};

export const MIXERS = {
  soda:  { label: "Club soda",       emoji: "🫧" },
  tonic: { label: "Tonic water",     emoji: "🍋" },
  cola:  { label: "Cola",            emoji: "🥤" },
  lemon: { label: "Lemon-lime soda", emoji: "🍈" },
};

// ── Zomato dishes ────────────────────────────────────────────────────────────
// `path` is the Zomato city page listing restaurants that deliver the dish.
// veg: true | false | "both" (the dish comes in veg and non-veg versions).
// `pairs` lists liquor categories the dish goes well with.
const WHISKY = ["malts", "worldwhisky", "scotch", "indian", "brandy"];
const WINE = ["redwine", "whitewine", "rose", "sparkling", "champagne"];
export const DISHES = [
  { id: "tandoori-chicken", name: "Tandoori Chicken", emoji: "🍗", course: "starter", veg: false, path: "delivery/dish-tandoori-chicken", pairs: [...WHISKY, "rum", "beer"] },
  { id: "kebab",            name: "Kebabs",           emoji: "🍢", course: "starter", veg: false, path: "restaurants/kebab",              pairs: [...WHISKY, "rum"] },
  { id: "paneer",           name: "Paneer Tikka & more", emoji: "🧀", course: "starter", veg: true, path: "delivery/dish-paneer",        pairs: [...WHISKY, "gin", "beer"] },
  { id: "chilli-chicken",   name: "Chilli Chicken",   emoji: "🌶️", course: "starter", veg: false, path: "delivery/dish-chilli-chicken",   pairs: ["rum", "vodka", "beer", "indian"] },
  { id: "momos",            name: "Momos",            emoji: "🥟", course: "starter", veg: "both", path: "delivery/dish-momos",           pairs: ["vodka", "beer", "sake", "rum"] },
  { id: "chaat",            name: "Chaat",            emoji: "🥗", course: "starter", veg: true,  path: "delivery/dish-chaat",            pairs: ["vodka", "gin", "beer"] },
  { id: "samosa",           name: "Samosa",           emoji: "🔺", course: "starter", veg: true,  path: "delivery/dish-samosa",           pairs: ["beer", "rum", "indian"] },
  { id: "rolls",            name: "Rolls",            emoji: "🌯", course: "starter", veg: "both", path: "delivery/dish-rolls",           pairs: ["tequila", "beer", "rtd"] },
  { id: "shawarma",         name: "Chicken Shawarma", emoji: "🥙", course: "starter", veg: false, path: "delivery/dish-chicken-shawarma", pairs: ["tequila", "beer", "vodka"] },
  { id: "fish",             name: "Fish Fry & Tikka", emoji: "🐟", course: "starter", veg: false, path: "delivery/dish-fish",             pairs: ["gin", "sake", ...WINE, "malts"] },
  { id: "pizza",            name: "Pizza",            emoji: "🍕", course: "starter", veg: "both", path: "delivery/dish-pizza",           pairs: ["beer", ...WINE, "rtd", "tequila"] },
  { id: "burger",           name: "Burgers",          emoji: "🍔", course: "starter", veg: "both", path: "delivery/dish-burger",          pairs: ["beer", "rtd", "rum"] },
  { id: "sandwich",         name: "Sandwiches",       emoji: "🥪", course: "starter", veg: "both", path: "delivery/dish-sandwich",        pairs: ["gin", ...WINE] },
  { id: "salad",            name: "Salads",           emoji: "🥬", course: "starter", veg: true,  path: "delivery/dish-salad",            pairs: ["gin", ...WINE, "vodka"] },
  { id: "biryani",          name: "Chicken Biryani",  emoji: "🍛", course: "main", veg: false, path: "delivery/dish-chicken-biryani",     pairs: [...WHISKY, "beer", "rum"] },
  { id: "mutton-biryani",   name: "Mutton Biryani",   emoji: "🍖", course: "main", veg: false, path: "delivery/dish-mutton-biryani",      pairs: [...WHISKY, "rum"] },
  { id: "veg-biryani",      name: "Veg Biryani",      emoji: "🍚", course: "main", veg: true,  path: "delivery/dish-veg-biryani",         pairs: [...WHISKY, "beer"] },
  { id: "butter-chicken",   name: "Butter Chicken",   emoji: "🍲", course: "main", veg: false, path: "delivery/dish-butter-chicken",      pairs: [...WHISKY, "redwine", "beer"] },
  { id: "dal-makhani",      name: "Dal Makhani",      emoji: "🥣", course: "main", veg: true,  path: "delivery/dish-dal-makhani",         pairs: [...WHISKY, "redwine"] },
  { id: "kadhai-paneer",    name: "Kadhai Paneer",    emoji: "🫕", course: "main", veg: true,  path: "delivery/dish-kadhai-paneer",       pairs: [...WHISKY, "beer"] },
  { id: "north-indian",     name: "North Indian Meal", emoji: "🍱", course: "main", veg: "both", path: "delivery/dish-north-indian-meal", pairs: [...WHISKY, "beer", "rum"] },
  { id: "fried-rice",       name: "Fried Rice & Noodles", emoji: "🍜", course: "main", veg: "both", path: "delivery/dish-fried-rice",     pairs: ["vodka", "beer", "sake", "rum"] },
  { id: "gulab-jamun",      name: "Gulab Jamun",      emoji: "🟤", course: "dessert", veg: true, path: "delivery/dish-gulab-jamun",       pairs: ["liqueur", "brandy", "rum"] },
  { id: "ice-cream",        name: "Ice Cream",        emoji: "🍨", course: "dessert", veg: true, path: "delivery/dish-ice-cream",         pairs: ["liqueur", "rum", ...WINE] },
  { id: "cake",             name: "Cake",             emoji: "🎂", course: "dessert", veg: true, path: "delivery/dish-cake",              pairs: ["champagne", "sparkling", "liqueur"] },
];
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export const COURSES = {
  starter: { label: "Starters",    emoji: "🍢" },
  main:    { label: "Main course", emoji: "🍛" },
  dessert: { label: "Desserts",    emoji: "🍨" },
};

// ── Blinkit groceries (live reference prices from DMart) ─────────────────────
// unit: what the calculator measures (ml / g / pc). `must` / `not` filter the
// live search results so e.g. "club soda" never picks baking soda.
export const GROCERIES = [
  { id: "soda",    name: "Club soda",          emoji: "🫧", group: "mixers",   unit: "ml", query: "club soda",       must: ["soda"],               not: ["eating", "baking"] },
  { id: "tonic",   name: "Tonic water",        emoji: "🍋", group: "mixers",   unit: "ml", query: "tonic water",     must: ["tonic"] },
  { id: "cola",    name: "Cola",               emoji: "🥤", group: "mixers",   unit: "ml", query: "coca cola",       must: ["cola"] },
  { id: "lemon",   name: "Lemon-lime soda",    emoji: "🍈", group: "mixers",   unit: "ml", query: "sprite",          must: ["sprite", "7up", "lemon"] },
  { id: "water",   name: "Drinking water",     emoji: "💧", group: "mixers",   unit: "ml", query: "bisleri water",   must: ["water"],              not: ["chestnut"] },
  { id: "ice",     name: "Ice cubes",          emoji: "🧊", group: "ice",      unit: "g",  query: null, blinkit: "ice cubes",
    fallback: { name: "Ice cubes (1 kg pack)", price: 60, pack: { count: 1, amount: 1000, unit: "g" }, packText: "1 kg" } },
  { id: "limes",   name: "Lemons",             emoji: "🍋", group: "garnish",  unit: "pc", query: "fresh lemon",     must: ["lemon"],              not: ["squeezer", "juice", "concentrate"] },
  { id: "chips",   name: "Potato chips",       emoji: "🥔", group: "munchies", unit: "g",  query: "potato chips",    must: ["chips", "potato"] },
  { id: "namkeen", name: "Namkeen & bhujia",   emoji: "🥨", group: "munchies", unit: "g",  query: "haldiram bhujia", must: ["bhujia", "namkeen", "mixture", "sev"] },
  { id: "peanuts", name: "Masala peanuts",     emoji: "🥜", group: "munchies", unit: "g",  query: "masala peanuts",  must: ["peanut", "groundnut", "sing"] },
  { id: "cashews", name: "Cashews",            emoji: "🌰", group: "munchies", unit: "g",  query: "cashew",          must: ["kaju", "cashew"] },
  { id: "nachos",  name: "Nachos",             emoji: "🌮", group: "munchies", unit: "g",  query: "nacho chips",     must: ["nacho", "doritos"] },
  { id: "cheese",  name: "Cheese cubes",       emoji: "🧀", group: "munchies", unit: "g",  query: "cheese cubes",    must: ["cheese"] },
  { id: "cups",    name: "Disposable glasses", emoji: "🥛", group: "supplies", unit: "pc", query: "paper glass",     must: ["glass", "cup"],       not: ["tray"] },
  { id: "plates",  name: "Paper plates",       emoji: "🍽️", group: "supplies", unit: "pc", query: "paper plates",    must: ["plate"] },
  { id: "napkins", name: "Napkins",            emoji: "🧻", group: "supplies", unit: "pc", query: "tissue napkins",  must: ["napkin", "serviette", "tissue"], not: ["kitchen"] },
];
export const GROCERY = Object.fromEntries(GROCERIES.map((g) => [g.id, g]));

export const GROUPS = {
  mixers:   { label: "Mixers & water", emoji: "🥤" },
  ice:      { label: "Ice",            emoji: "🧊" },
  garnish:  { label: "Garnish",        emoji: "🍋" },
  munchies: { label: "Munchies",       emoji: "🥜" },
  supplies: { label: "Party supplies", emoji: "🥛" },
};

// Keep only live results that are actually the thing we asked for.
export function pickProducts(grocery, products) {
  const ok = products.filter((p) => {
    const n = `${p.name} ${p.fullName || ""}`.toLowerCase();
    if (!p.inStock) return false;
    if (grocery.must && !grocery.must.some((w) => n.includes(w))) return false;
    if (grocery.not && grocery.not.some((w) => n.includes(w))) return false;
    if (p.pack && p.pack.unit !== grocery.unit) return false;
    return true;
  });
  return ok.length ? ok : [];
}

// ── Drinks maths ─────────────────────────────────────────────────────────────
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const drinksPerDrinker = (hours) => (hours <= 0 ? 0 : 2 + Math.max(0, hours - 1));

export function servingsInBottle(catId, ml, pegMl = 60) {
  const kind = CAT[catId]?.serve.kind || "spirit";
  switch (kind) {
    case "spirit": return Math.floor(ml / pegMl);
    case "shot":   return Math.floor(ml / 30);
    case "beer":   return Math.max(1, Math.round(ml / 330));
    case "wine":   return Math.floor(ml / 150);
    case "sake":   return Math.floor(ml / 90);
    case "can":    return 1;
    default:       return Math.floor(ml / pegMl);
  }
}

/**
 * @param party        { guests, hours, drinkersPct, vegPct, appetite, dinner, pegMl }
 * @param liquorLines  [{ cat, ml, qty }] — the liquor cart
 */
export function planParty(party, liquorLines = []) {
  const p = { ...DEFAULT_PARTY, ...party };
  const guests = Math.max(1, Math.round(p.guests));
  const hours = clamp(p.hours, 1, 12);
  const appetite = APPETITE[p.appetite]?.f || 1;
  const drinkers = Math.round((guests * clamp(p.drinkersPct, 0, 100)) / 100);
  const perDrinker = drinksPerDrinker(hours);
  const needed = Math.ceil(drinkers * perDrinker);

  const byCat = {};
  for (const l of liquorLines) {
    if (!CAT[l.cat] || !l.qty) continue;
    byCat[l.cat] = (byCat[l.cat] || 0) + servingsInBottle(l.cat, l.ml, p.pegMl) * l.qty;
  }
  const available = Object.values(byCat).reduce((s, n) => s + n, 0);
  const poured = available ? Math.min(needed, available) : needed;

  // Mixers follow what will actually be poured, in proportion to what's stocked.
  // With an empty cart assume a typical Indian house party mix.
  const mixerMl = { soda: 0, tonic: 0, cola: 0, lemon: 0 };
  let shots = 0, ginDrinks = 0;
  if (available) {
    for (const [id, n] of Object.entries(byCat)) {
      const share = (poured * n) / available;
      const mixer = CAT[id].serve.mixer;
      if (mixer) mixerMl[mixer] += share * MIXER_PER_DRINK;
      if (CAT[id].serve.kind === "shot") shots += share;
      if (id === "gin" || id === "vodka") ginDrinks += share;
    }
  } else {
    mixerMl.soda = poured * 0.5 * MIXER_PER_DRINK;
    mixerMl.cola = poured * 0.25 * MIXER_PER_DRINK;
    mixerMl.tonic = poured * 0.15 * MIXER_PER_DRINK;
    mixerMl.lemon = poured * 0.1 * MIXER_PER_DRINK;
    ginDrinks = poured * 0.15;
  }
  for (const k of Object.keys(mixerMl)) mixerMl[k] = Math.round(mixerMl[k]);

  const nonDrinkers = guests - drinkers;
  const iceKg = Math.ceil(drinkers * (0.5 + 0.1 * Math.max(0, hours - 3)) + nonDrinkers * 0.2);
  const waterMl = Math.round(guests * (0.5 + 0.15 * hours) * 1000);
  const limes = Math.ceil(shots / 3 + ginDrinks / 6 + guests / 4);

  // ── Food ──
  const timeF = clamp(hours / 4, 0.75, 1.5);
  const pieces = Math.round(guests * (p.dinner ? 6 : 12) * timeF * appetite);
  const plates = Math.max(1, Math.ceil(pieces / PIECES_PER_PLATE));
  // Veg guests only eat veg; non-veg guests happily eat some veg too.
  const vegShare = clamp(p.vegPct / 100 + (1 - p.vegPct / 100) * 0.3, 0, 1);
  const vegPlates = Math.round(plates * vegShare);
  const mainServings = p.dinner ? Math.ceil(guests * appetite) : 0;
  const vegMains = Math.round(mainServings * (p.vegPct / 100));
  const breads = p.dinner ? Math.ceil(guests * 2.5 * appetite) : 0;
  const desserts = p.dinner ? guests : Math.ceil(guests / 2);

  const munchiesG = Math.round(guests * 60 * clamp(hours / 3, 0.75, 2) * appetite * (p.dinner ? 0.7 : 1));
  const hasTequila = (byCat.tequila || 0) > 0;
  const hasWine = ["redwine", "whitewine", "rose", "sparkling", "champagne"].some((c) => byCat[c]);
  const munchies = {
    chips:   Math.round(munchiesG * (hasTequila ? 0.2 : 0.35)),
    namkeen: Math.round(munchiesG * 0.3),
    peanuts: Math.round(munchiesG * (hasWine ? 0.15 : 0.25)),
    cashews: Math.round(munchiesG * 0.1),
    nachos:  hasTequila ? Math.round(munchiesG * 0.15) : 0,
    cheese:  hasWine ? Math.round(munchiesG * 0.1) : 0,
  };

  const cups = Math.ceil(drinkers * perDrinker * 0.5 + guests);
  const paperPlates = guests * (p.dinner ? 3 : 2);
  const napkins = guests * 4;

  return {
    guests, hours, drinkers, perDrinker, needed, available, poured, byCat,
    shortfall: Math.max(0, needed - available),
    mixerMl, iceKg, waterMl, limes,
    starters: { pieces, plates, veg: vegPlates, nonveg: plates - vegPlates },
    mains: { servings: mainServings, veg: vegMains, nonveg: mainServings - vegMains, breads },
    desserts,
    munchies, munchiesG,
    supplies: { cups, plates: paperPlates, napkins },
  };
}

// What to buy on Blinkit: grocery id → amount in that grocery's unit.
export function groceryNeeds(plan) {
  return {
    soda: plan.mixerMl.soda, tonic: plan.mixerMl.tonic, cola: plan.mixerMl.cola, lemon: plan.mixerMl.lemon,
    water: plan.waterMl, ice: plan.iceKg * 1000, limes: plan.limes,
    ...plan.munchies,
    cups: plan.supplies.cups, plates: plan.supplies.plates, napkins: plan.supplies.napkins,
  };
}

export function packsFor(amount, product) {
  if (!amount || amount <= 0) return 0;
  const size = product?.pack?.amount;
  if (!size) return 1;
  return Math.max(1, Math.ceil(amount / size));
}

export function formatAmount(amount, unit) {
  if (unit === "ml") return amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 ? 1 : 0)} L` : `${amount} ml`;
  if (unit === "g") return amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 ? 1 : 0)} kg` : `${amount} g`;
  return `${amount} pcs`;
}

// Dishes ranked by how well they pair with the liquor categories in the cart.
export function suggestDishes(catIds, course) {
  const set = new Set(catIds);
  return DISHES.filter((d) => !course || d.course === course)
    .map((d) => ({ ...d, score: d.pairs.filter((c) => set.has(c)).length }))
    .sort((a, b) => b.score - a.score);
}

// Short Blinkit search term for a product ("Lay's Magic Masala Potato Chips : 80 g" → "Lay's Magic Masala Potato Chips").
export function blinkitQuery(grocery, product) {
  if (!product || product.fallback) return grocery.blinkit || grocery.query || grocery.name;
  return product.name.replace(/\s*[-–(].*$/, "").split(/\s+/).slice(0, 5).join(" ");
}
