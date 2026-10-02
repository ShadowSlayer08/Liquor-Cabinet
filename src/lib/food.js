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
//    • non-drinkers (designated drivers included) drink at the same pace: a 250 ml
//      soft drink or juice each time, or a mocktail from the party menu
//    • starters: ~6 pieces/guest before dinner, ~12 for a snacks-only party (4 h)
//    • mains: one "for one" Zomato serving per guest; 2–3 breads each
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { cocktailUses, servingsByFamily, familyOfCat, menuSummary } from "./cocktails.js";
export { DISHES, DISH, COURSES, suggestDishes } from "./dishes.js";

export const MIXER_PER_DRINK = 150; // ml
export const SOFT_PER_DRINK = 250;  // ml — one soft drink or juice for a non-drinker
export const PIECES_PER_PLATE = 8;  // a typical Zomato starter plate

export const APPETITE = {
  light:   { label: "Light",   f: 0.8 },
  regular: { label: "Regular", f: 1 },
  hungry:  { label: "Hungry",  f: 1.25 },
};

// `name`, `date` (ISO, null = the coming Saturday — set by App), `time`, `host` and `upi`
// describe the party itself: dry-day checks, reminders, the invite card and bill split.
// `drivers` stay sober to drive (they count as non-drinkers); `mix` is the bar style a template
// or the budget optimiser picked; `prefs` are the guests' tastes that steer the cocktail,
// mocktail and food suggestions (lib/suggestDrinks.js, lib/suggestFood.js).
export const DEFAULT_PREFS = {
  drinks: [],         // drink tags they like, e.g. "refreshing", "sweet", "strong", "classic" (see DRINK_TASTES / TAGS in cocktails.js)
  cuisines: [],       // food styles they like, e.g. "north-indian", "chinese", "street", "continental" (see CUISINES in dishes.js)
  spice: "medium",    // "mild" | "medium" | "hot"
  avoid: [],          // proteins nobody should be served, e.g. "mutton", "seafood", "egg" (see dishes.js)
  jain: false,        // no onion / garlic / root vegetables
};
export const DEFAULT_PARTY = {
  guests: 10, hours: 4, drinkersPct: 80, vegPct: 40, appetite: "regular", dinner: true, pegMl: 60,
  name: "House party", date: null, time: "20:00", host: "", upi: "",
  drivers: 0, mix: null, prefs: DEFAULT_PREFS,
};

export const MIXERS = {
  soda:  { label: "Club soda",       emoji: "🫧" },
  tonic: { label: "Tonic water",     emoji: "🍋" },
  cola:  { label: "Cola",            emoji: "🥤" },
  lemon: { label: "Lemon-lime soda", emoji: "🍈" },
};

// Zomato dishes, courses and pairing live in lib/dishes.js (re-exported here).

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
  // For the guests who aren't drinking (on top of the cola and lemon-lime soda above).
  { id: "juice", name: "Fruit juice", emoji: "🧃", group: "soft", unit: "ml", options: [
    opt("real-mixed-fruit-1l", "Real Fruit Power Mixed Fruit Juice", 1000, "ml", "1 L", 125),
    opt("tropicana-orange-1l", "Tropicana 100% Orange Juice", 1000, "ml", "1 L", 135),
    opt("maaza-1200", "Maaza Mango Drink", 1200, "ml", "1.2 L", 75),
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
  // Cocktail & mocktail extras — only needed when those drinks are on the party menu.
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
  // v1.4.1: the bigger cocktail list and the mocktails (MRPs looked up on blinkit.com product pages, Oct 2026).
  { id: "mango", name: "Mango drink", emoji: "🥭", group: "cocktail", unit: "ml", options: [opt("maaza-mango-1200", "Maaza Mango Drink", 1200, "ml", "1.2 L", 75)] },
  { id: "guava", name: "Guava juice", emoji: "🍐", group: "cocktail", unit: "ml", options: [opt("real-guava-1l", "Real Fruit Power Guava Juice", 1000, "ml", "1 L", 115)] },
  { id: "coconutwater", name: "Coconut water", emoji: "🥥", group: "cocktail", unit: "ml", options: [opt("real-activ-coconut-1l", "Real Activ Coconut Water", 1000, "ml", "1 L", 178, "coconut water")] },
  { id: "roohafza", name: "Rooh Afza", emoji: "🌹", group: "cocktail", unit: "ml", options: [opt("roohafza-750", "Hamdard Rooh Afza Rose Sharbat", 750, "ml", "750 ml", 170)] },
  { id: "kalakhatta", name: "Kala khatta syrup", emoji: "🍇", group: "cocktail", unit: "ml", options: [opt("mapro-kala-khatta-750", "Mapro Kala Khatta Squash", 750, "ml", "750 ml", 198, "kala khatta syrup")] },
  { id: "aampanna", name: "Aam panna syrup", emoji: "🥭", group: "cocktail", unit: "ml", options: [opt("hitkary-aam-panna-700", "Hitkary Aam Panna Sharbat", 700, "ml", "700 ml", 195, "aam panna")] },
  { id: "thandai", name: "Thandai syrup", emoji: "🥛", group: "cocktail", unit: "ml", options: [
    opt("haldiram-thandai-750", "Haldiram's Kesaria Thandai Syrup", 750, "ml", "750 ml", 305),
    opt("guruji-thandai-750", "Guruji Kesharia Thandai Syrup", 750, "ml", "750 ml", 350),
  ] },
  { id: "grenadine", name: "Grenadine syrup", emoji: "🍒", group: "cocktail", unit: "ml", options: [
    opt("teisseire-grenadine-700", "Mathieu Teisseire Grenadine Syrup", 700, "ml", "700 ml", 690),
    opt("monin-grenadine-700", "Monin Grenadine Syrup", 700, "ml", "700 ml", 895),
  ] },
  { id: "chaatmasala", name: "Chaat masala", emoji: "🧂", group: "cocktail", unit: "g", options: [opt("mdh-chaat-masala-100", "MDH Chunky Chaat Masala", 100, "g", "100 g", 94)] },
  { id: "jaljeera", name: "Jaljeera masala", emoji: "🌿", group: "cocktail", unit: "g", options: [
    opt("catch-jaljeera-100", "Catch Jaljeera Masala", 100, "g", "100 g", 70),
    opt("everest-jaljeera-100", "Everest Jaljeera Masala", 100, "g", "100 g", 68),
  ] },
  { id: "coffee", name: "Instant coffee", emoji: "☕", group: "cocktail", unit: "g", options: [
    opt("nescafe-classic-45", "Nescafé Classic Instant Coffee", 45, "g", "45 g", 235),
    opt("nescafe-classic-24", "Nescafé Classic Instant Coffee", 24, "g", "24 g", 124),
  ] },
  { id: "cream", name: "Fresh cream", emoji: "🍦", group: "cocktail", unit: "ml", options: [opt("amul-fresh-cream-250", "Amul Fresh Cream", 250, "ml", "250 ml", 75)] },
  { id: "tomatoes", name: "Tomatoes", emoji: "🍅", group: "cocktail", unit: "pc", options: [opt("tomato-500", "Tomato (Tamatar)", 6, "pc", "500 g (~6 pcs)", 30, "tomato")] },
  { id: "ginger", name: "Fresh ginger", emoji: "🫚", group: "cocktail", unit: "g", options: [opt("ginger-100", "Ginger (Adrak)", 100, "g", "100 g", 20, "ginger")] },
  { id: "greenchilli", name: "Green chillies", emoji: "🌶️", group: "cocktail", unit: "pc", options: [opt("green-chilli-100", "Green Chilli (Hari Mirch)", 25, "pc", "100 g (~25 pcs)", 15, "green chilli")] },
  { id: "cinnamon", name: "Cinnamon sticks", emoji: "🪵", group: "cocktail", unit: "g", options: [opt("cinnamon-50", "Cinnamon Sticks (Dalchini)", 50, "g", "50 g", 60, "cinnamon sticks")] },
];
export const GROCERY = Object.fromEntries(GROCERIES.map((g) => [g.id, g]));

export const GROUPS = {
  mixers:   { label: "Mixers & water", emoji: "🥤" },
  soft:     { label: "Soft drinks",    emoji: "🧃" },
  ice:      { label: "Ice",            emoji: "🧊" },
  garnish:  { label: "Garnish",        emoji: "🍋" },
  munchies: { label: "Munchies",       emoji: "🥜" },
  supplies: { label: "Party supplies", emoji: "🥛" },
  cocktail: { label: "Cocktail & mocktail extras", emoji: "🍸" },
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
 * @param party        { guests, hours, drinkersPct, drivers, vegPct, appetite, dinner, pegMl } (+ name/date/time/host/upi/prefs, unused here)
 * @param liquorLines  [{ cat, ml, qty }] — the liquor cart
 * @param menu         [{ id, servings }] — cocktails and mocktails on the party menu (lib/cocktails.js)
 */
export function planParty(party, liquorLines = [], menu = []) {
  const p = { ...DEFAULT_PARTY, ...party };
  const guests = Math.max(1, Math.round(p.guests));
  const hours = clamp(p.hours, 1, 12);
  const appetite = APPETITE[p.appetite]?.f || 1;
  // Designated drivers never drink, whatever the drinking % says.
  const drivers = clamp(Math.round(Number(p.drivers) || 0), 0, guests);
  const drinkers = Math.min(Math.round((guests * clamp(p.drinkersPct, 0, 100)) / 100), guests - drivers);
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
  // Non-drinkers keep the drinkers' pace with soft drinks and juice; mocktails on the
  // menu replace some of those, the way cocktails replace plain mixer.
  const mocktailServings = menuSummary(menu).mocktails;
  const softPlanned = Math.ceil(nonDrinkers * perDrinker);
  const softDrinks = Math.max(0, softPlanned - mocktailServings);
  const soft = { planned: softPlanned, drinks: softDrinks, ml: softDrinks * SOFT_PER_DRINK };
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
    guests, hours, drinkers, nonDrinkers, drivers, perDrinker, needed, available, poured, byCat,
    shortfall: Math.max(0, needed - available),
    mixerMl, soft, iceKg, waterMl, limes,
    starters: { pieces, plates, veg: vegPlates, nonveg: plates - vegPlates },
    mains: { servings: mainServings, veg: vegMains, nonveg: mainServings - vegMains, breads },
    desserts,
    munchies, munchiesG,
    supplies: { cups, plates: paperPlates, napkins },
    cocktailServings, mocktailServings, cocktailUses: cocktailUses(menu),
  };
}

// What to buy on Blinkit: grocery id → amount in that grocery's unit.
// Soft drinks for non-drinkers: 35% cola, 35% lemon-lime soda, 30% juice.
// Cocktail and mocktail ingredients are added on top; ice is already sized for every drink.
export function groceryNeeds(plan) {
  const softMl = plan.soft?.ml || 0;
  const needs = {
    soda: plan.mixerMl.soda, tonic: plan.mixerMl.tonic,
    cola: plan.mixerMl.cola + Math.round(softMl * 0.35), lemon: plan.mixerMl.lemon + Math.round(softMl * 0.35),
    juice: Math.round(softMl * 0.3),
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
