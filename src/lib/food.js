// ═══════════════════════════════════════════════════════════════════════════════
//  FOOD CALCULATOR  (pure — unit-tested)
//
//  Works out how much a party needs — drinks, mixers, ice, starters, mains,
//  munchies, disposables — from the guest list and what's in the liquor cart.
//  Cooked food is ordered on Zomato (live restaurants + prices per city);
//  mixers, ice, munchies and disposables on Blinkit.
//
//  Quantities follow common Indian party-catering rules of thumb:
//    • drinks: 2 in the first hour, then 1 per hour, per drinker
//    • mixer: 150 ml per spirit drink; ice ≈ 0.5 kg per drinker (+0.1 kg/h after 3 h)
//    • starters: ~6 pieces/guest before dinner, ~12 for a snacks-only party (4 h)
//    • mains: one "for one" Zomato serving per guest; 2–3 breads each
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { cocktailUses, servingsByFamily, familyOfCat } from "./cocktails.js";

export const MIXER_PER_DRINK = 150; // ml
export const PIECES_PER_PLATE = 8;  // a typical Zomato starter plate

export const APPETITE = {
  light:   { label: "Light",   f: 0.8 },
  regular: { label: "Regular", f: 1 },
  hungry:  { label: "Hungry",  f: 1.25 },
};

// `name`, `date` (ISO, null = the coming Saturday — set by App), `time`, `host` and `upi`
// describe the party itself: dry-day checks, reminders, the invite card and bill split.
export const DEFAULT_PARTY = {
  guests: 10, hours: 4, drinkersPct: 80, vegPct: 40, appetite: "regular", dinner: true, pegMl: 60,
  name: "House party", date: null, time: "20:00", host: "", upi: "",
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

// ── Blinkit party supplies ───────────────────────────────────────────────────
// Blinkit blocks automated price lookups, so each supply comes with a few common
// products and their usual printed price (MRP). Blinkit shows the exact price
// when you open the item. `blinkit` is the search term sent to Blinkit.
const opt = (id, name, amount, unit, packText, price, blinkit) => ({ id, name, pack: { count: 1, amount, unit }, packText, price, blinkit: blinkit || name });
export const GROCERIES = [
  { id: "soda", name: "Club soda", emoji: "🫧", group: "mixers", unit: "ml", options: [
    opt("kinley-soda-750", "Kinley Club Soda", 750, "ml", "750 ml", 20),
    opt("bisleri-soda-750", "Bisleri Soda", 750, "ml", "750 ml", 20),
    opt("schweppes-soda-300", "Schweppes Soda Water Can", 300, "ml", "300 ml", 45),
  ] },
  { id: "tonic", name: "Tonic water", emoji: "🍋", group: "mixers", unit: "ml", options: [
    opt("schweppes-tonic-300", "Schweppes Indian Tonic Water Can", 300, "ml", "300 ml", 60),
    opt("sepoy-tonic-200", "Sepoy & Co Indian Tonic Water", 200, "ml", "200 ml", 110),
    opt("svami-tonic-250", "Svami Tonic Water", 250, "ml", "250 ml", 70),
  ] },
  { id: "cola", name: "Cola", emoji: "🥤", group: "mixers", unit: "ml", options: [
    opt("coke-2250", "Coca-Cola", 2250, "ml", "2.25 L", 100),
    opt("thumsup-2250", "Thums Up", 2250, "ml", "2.25 L", 100),
    opt("coke-750", "Coca-Cola", 750, "ml", "750 ml", 40),
  ] },
  { id: "lemon", name: "Lemon-lime soda", emoji: "🍈", group: "mixers", unit: "ml", options: [
    opt("sprite-2250", "Sprite", 2250, "ml", "2.25 L", 100),
    opt("7up-2250", "7UP", 2250, "ml", "2.25 L", 100),
    opt("sprite-750", "Sprite", 750, "ml", "750 ml", 40),
  ] },
  { id: "water", name: "Drinking water", emoji: "💧", group: "mixers", unit: "ml", options: [
    opt("bisleri-5l", "Bisleri Packaged Drinking Water", 5000, "ml", "5 L", 80),
    opt("bisleri-1l", "Bisleri Packaged Drinking Water", 1000, "ml", "1 L", 20),
    opt("kinley-2l", "Kinley Packaged Drinking Water", 2000, "ml", "2 L", 35),
  ] },
  { id: "ice", name: "Ice cubes", emoji: "🧊", group: "ice", unit: "g", options: [
    opt("ice-1kg", "Ice Cubes", 1000, "g", "1 kg", 60),
  ] },
  { id: "limes", name: "Lemons", emoji: "🍋", group: "garnish", unit: "pc", options: [
    opt("lemon-250g", "Lemon (Nimbu)", 5, "pc", "250 g (~5 pcs)", 40, "lemon"),
  ] },
  { id: "chips", name: "Potato chips", emoji: "🥔", group: "munchies", unit: "g", options: [
    opt("lays-classic-90", "Lay's Classic Salted", 90, "g", "90 g", 50),
    opt("lays-magic-masala-90", "Lay's India's Magic Masala", 90, "g", "90 g", 50),
    opt("pringles-107", "Pringles Original", 107, "g", "107 g", 110),
  ] },
  { id: "namkeen", name: "Namkeen & bhujia", emoji: "🥨", group: "munchies", unit: "g", options: [
    opt("haldiram-aloo-bhujia-400", "Haldiram's Aloo Bhujia", 400, "g", "400 g", 120),
    opt("haldiram-bhujia-1kg", "Haldiram's Bhujia Sev", 1000, "g", "1 kg", 290),
    opt("haldiram-navrattan-400", "Haldiram's Navrattan Mixture", 400, "g", "400 g", 120),
  ] },
  { id: "peanuts", name: "Masala peanuts", emoji: "🥜", group: "munchies", unit: "g", options: [
    opt("haldiram-masala-peanuts-200", "Haldiram's Masala Peanuts", 200, "g", "200 g", 60),
    opt("jabsons-peanuts-160", "Jabsons Roasted Peanuts Classic Salted", 160, "g", "160 g", 70),
  ] },
  { id: "cashews", name: "Cashews", emoji: "🌰", group: "munchies", unit: "g", options: [
    opt("cashew-roasted-200", "Roasted & Salted Cashews", 200, "g", "200 g", 300, "roasted salted cashew"),
  ] },
  { id: "nachos", name: "Nachos", emoji: "🌮", group: "munchies", unit: "g", options: [
    opt("cornitos-150", "Cornitos Nacho Crisps Cheese & Herbs", 150, "g", "150 g", 90),
    opt("doritos-150", "Doritos Nacho Cheese", 150, "g", "150 g", 90),
  ] },
  { id: "cheese", name: "Cheese cubes", emoji: "🧀", group: "munchies", unit: "g", options: [
    opt("amul-cheese-cubes-200", "Amul Processed Cheese Cubes", 200, "g", "200 g", 130),
    opt("britannia-cheese-cubes-200", "Britannia Cheese Cubes", 200, "g", "200 g", 130),
  ] },
  { id: "cups", name: "Disposable glasses", emoji: "🥛", group: "supplies", unit: "pc", options: [
    opt("paper-glass-50", "Disposable Paper Glass 200 ml", 50, "pc", "50 pcs", 80, "paper glass"),
  ] },
  { id: "plates", name: "Paper plates", emoji: "🍽️", group: "supplies", unit: "pc", options: [
    opt("bagasse-plates-25", "Disposable Bagasse Plates", 25, "pc", "25 pcs", 150, "disposable plates"),
  ] },
  { id: "napkins", name: "Napkins", emoji: "🧻", group: "supplies", unit: "pc", options: [
    opt("tissue-napkins-100", "Tissue Paper Napkins", 100, "pc", "100 pcs", 50, "tissue napkins"),
  ] },
  // Cocktail extras — only needed when cocktails are on the party menu.
  { id: "mint", name: "Mint leaves", emoji: "🌱", group: "cocktail", unit: "g", options: [opt("mint-100", "Mint Leaves (Pudina)", 100, "g", "100 g", 20, "mint leaves")] },
  { id: "sugar", name: "Sugar", emoji: "🧂", group: "cocktail", unit: "g", options: [opt("sugar-1kg", "Sugar", 1000, "g", "1 kg", 55, "sugar 1kg")] },
  { id: "oranges", name: "Oranges", emoji: "🍊", group: "cocktail", unit: "pc", options: [opt("orange-4", "Orange (Santra)", 4, "pc", "4 pcs (~600 g)", 90, "orange")] },
  { id: "cucumber", name: "Cucumber", emoji: "🥒", group: "cocktail", unit: "g", options: [opt("cucumber-500", "Cucumber (Kheera)", 500, "g", "500 g", 35, "cucumber")] },
  { id: "gingerale", name: "Ginger ale", emoji: "🫚", group: "cocktail", unit: "ml", options: [
    opt("schweppes-ginger-300", "Schweppes Ginger Ale Can", 300, "ml", "300 ml", 60),
    opt("sepoy-ginger-200", "Sepoy & Co Ginger Ale", 200, "ml", "200 ml", 110),
  ] },
  { id: "orangejuice", name: "Orange juice", emoji: "🧃", group: "cocktail", unit: "ml", options: [opt("real-orange-1l", "Real Fruit Power Orange Juice", 1000, "ml", "1 L", 130)] },
  { id: "cranberry", name: "Cranberry juice", emoji: "🍒", group: "cocktail", unit: "ml", options: [opt("real-cranberry-1l", "Real Fruit Power Cranberry Juice", 1000, "ml", "1 L", 140)] },
  { id: "pineapple", name: "Pineapple juice", emoji: "🍍", group: "cocktail", unit: "ml", options: [opt("real-pineapple-1l", "Real Fruit Power Pineapple Juice", 1000, "ml", "1 L", 130)] },
  { id: "coconutmilk", name: "Coconut milk", emoji: "🥥", group: "cocktail", unit: "ml", options: [opt("dabur-coconut-200", "Dabur Hommade Coconut Milk", 200, "ml", "200 ml", 80, "coconut milk")] },
  { id: "honey", name: "Honey", emoji: "🍯", group: "cocktail", unit: "g", options: [opt("dabur-honey-250", "Dabur Honey", 250, "g", "250 g", 125)] },
  { id: "salt", name: "Salt", emoji: "🧂", group: "cocktail", unit: "g", options: [opt("tata-salt-1kg", "Tata Salt", 1000, "g", "1 kg", 28)] },
  { id: "milk", name: "Milk", emoji: "🥛", group: "cocktail", unit: "ml", options: [opt("amul-milk-500", "Amul Taaza Toned Milk", 500, "ml", "500 ml", 28, "amul milk")] },
];
export const GROCERY = Object.fromEntries(GROCERIES.map((g) => [g.id, g]));

export const GROUPS = {
  mixers:   { label: "Mixers & water", emoji: "🥤" },
  ice:      { label: "Ice",            emoji: "🧊" },
  garnish:  { label: "Garnish",        emoji: "🍋" },
  munchies: { label: "Munchies",       emoji: "🥜" },
  supplies: { label: "Party supplies", emoji: "🥛" },
  cocktail: { label: "Cocktail extras", emoji: "🍸" },
};

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
 * @param party        { guests, hours, drinkersPct, vegPct, appetite, dinner, pegMl } (+ name/date/time/host/upi, unused here)
 * @param liquorLines  [{ cat, ml, qty }] — the liquor cart
 * @param menu         [{ id, servings }] — cocktails on the party menu (lib/cocktails.js)
 */
export function planParty(party, liquorLines = [], menu = []) {
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
  // Drinks served as cocktails take their mixers from the cocktail recipe
  // instead of the default (e.g. no plain soda for a whisky that becomes a sour).
  // With an empty cart assume a typical Indian house party mix.
  const mixerMl = { soda: 0, tonic: 0, cola: 0, lemon: 0 };
  const famLeft = { ...servingsByFamily(menu) };
  const cocktailServings = Object.values(famLeft).reduce((s, n) => s + n, 0);
  let shots = 0, ginDrinks = 0;
  if (available) {
    for (const [id, n] of Object.entries(byCat)) {
      let share = (poured * n) / available;
      const fam = familyOfCat(id);
      if (fam && famLeft[fam] > 0) { const used = Math.min(share, famLeft[fam]); share -= used; famLeft[fam] -= used; }
      const mixer = CAT[id].serve.mixer;
      if (mixer) mixerMl[mixer] += share * MIXER_PER_DRINK;
      if (CAT[id].serve.kind === "shot") shots += share;
      if (id === "gin" || id === "vodka") ginDrinks += share;
    }
  } else {
    const plain = Math.max(0, poured - cocktailServings);
    mixerMl.soda = plain * 0.5 * MIXER_PER_DRINK;
    mixerMl.cola = plain * 0.25 * MIXER_PER_DRINK;
    mixerMl.tonic = plain * 0.15 * MIXER_PER_DRINK;
    mixerMl.lemon = plain * 0.1 * MIXER_PER_DRINK;
    ginDrinks = plain * 0.15;
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
    cocktailServings, cocktailUses: cocktailUses(menu),
  };
}

// What to buy on Blinkit: grocery id → amount in that grocery's unit.
// Cocktail ingredients are added on top; ice is already sized for every drink.
export function groceryNeeds(plan) {
  const needs = {
    soda: plan.mixerMl.soda, tonic: plan.mixerMl.tonic, cola: plan.mixerMl.cola, lemon: plan.mixerMl.lemon,
    water: plan.waterMl, ice: plan.iceKg * 1000, limes: plan.limes,
    ...plan.munchies,
    cups: plan.supplies.cups, plates: plan.supplies.plates, napkins: plan.supplies.napkins,
  };
  for (const [id, amt] of Object.entries(plan.cocktailUses || {})) {
    needs[id] = id === "ice" ? Math.max(needs.ice, amt) : (needs[id] || 0) + amt;
  }
  return needs;
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

// Blinkit search term for a chosen product.
export const blinkitQuery = (grocery, product) => product?.blinkit || product?.name || grocery.name;

// ── Bistro (Blinkit's 10-minute food app) ────────────────────────────────────
// Canteen-style snacks & meals from micro-kitchens inside Blinkit stores. Bistro
// doesn't publish a menu or prices online, so items are ideas you order in the
// Bistro app; they're shown as "price in app" and left out of the budget.
export const BISTRO_ITEMS = [
  { id: "samosa",           name: "Samosa",              emoji: "🔺", veg: true },
  { id: "vada-pav",         name: "Vada Pav",            emoji: "🍔", veg: true },
  { id: "veg-sandwich",     name: "Veg Grilled Sandwich", emoji: "🥪", veg: true },
  { id: "chicken-sandwich", name: "Chicken Sandwich",    emoji: "🥪", veg: false },
  { id: "paneer-wrap",      name: "Paneer Tikka Wrap",   emoji: "🌯", veg: true },
  { id: "chicken-wrap",     name: "Chicken Wrap",        emoji: "🌯", veg: false },
  { id: "momos",            name: "Momos",               emoji: "🥟", veg: "both" },
  { id: "rice-bowl",        name: "Rice Bowl",           emoji: "🍚", veg: "both" },
  { id: "brownie",          name: "Brownie & Pastries",  emoji: "🍫", veg: true },
  { id: "chai",             name: "Masala Chai",         emoji: "☕", veg: true },
  { id: "cold-coffee",      name: "Cold Coffee",         emoji: "🧋", veg: true },
];
