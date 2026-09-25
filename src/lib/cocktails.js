// ═══════════════════════════════════════════════════════════════════════════════
//  COCKTAILS — what you can mix with the bottles in your cabinet.
//  `needs` are spirit families (any bottle from the family counts).
//  `uses` are Blinkit supplies per serving (ids from GROCERIES in food.js):
//  ml for liquids, g for solids, pc for pieces. Adding a cocktail to the party
//  menu feeds these straight into the Blinkit list.
// ═══════════════════════════════════════════════════════════════════════════════

export const FAMILIES = {
  whisky: { label: "Whisky", cats: ["malts", "worldwhisky", "scotch", "indian"] },
  gin: { label: "Gin", cats: ["gin"] },
  vodka: { label: "Vodka", cats: ["vodka"] },
  rum: { label: "Rum", cats: ["rum"] },
  tequila: { label: "Tequila", cats: ["tequila"] },
  brandy: { label: "Brandy", cats: ["brandy"] },
  beer: { label: "Beer", cats: ["beer"] },
  redwine: { label: "Red wine", cats: ["redwine"] },
  whitewine: { label: "White / rosé", cats: ["whitewine", "rose"] },
  bubbly: { label: "Sparkling", cats: ["sparkling", "champagne"] },
  liqueur: { label: "Liqueur", cats: ["liqueur"] },
};
export const familyOfCat = (catId) => Object.keys(FAMILIES).find((f) => FAMILIES[f].cats.includes(catId)) || null;

const C = (id, name, emoji, color, needs, spirit, glass, uses, steps, tags = []) => ({ id, name, emoji, color, needs, spirit, glass, uses, steps, tags });

export const COCKTAILS = [
  C("highball", "Whisky Highball", "🥃", "#d4872a", ["whisky"], "60 ml whisky", "Highball",
    { soda: 150, ice: 150, limes: 0.25 }, ["Fill a tall glass with ice.", "Pour 60 ml whisky.", "Top with chilled soda, stir once, lemon wedge."], ["classic", "easy"]),
  C("whisky-sour", "Whisky Sour", "🍋", "#e0a93a", ["whisky"], "60 ml whisky", "Rocks",
    { limes: 1, sugar: 15, ice: 120 }, ["Shake whisky, juice of 1 lemon and 15 g sugar with ice.", "Strain over fresh ice.", "Garnish with a lemon wheel."], ["classic"]),
  C("old-fashioned", "Old Fashioned", "🍊", "#b8621a", ["whisky"], "60 ml whisky", "Rocks",
    { sugar: 5, oranges: 0.25, ice: 100 }, ["Stir 5 g sugar with a splash of water until dissolved.", "Add 60 ml whisky and a big ice cube, stir 20 s.", "Twist an orange peel over the top."], ["classic", "strong"]),
  C("whisky-ginger", "Whisky Ginger", "🫚", "#c78a3a", ["whisky"], "60 ml whisky", "Highball",
    { gingerale: 150, ice: 150, limes: 0.25 }, ["Ice in a tall glass, 60 ml whisky.", "Top with ginger ale.", "Squeeze of lime."], ["easy"]),
  C("hot-toddy", "Hot Toddy", "☕", "#a55a1c", ["whisky"], "45 ml whisky", "Mug",
    { honey: 15, limes: 0.5 }, ["Stir 15 g honey into 120 ml hot water.", "Add 45 ml whisky and half a lemon's juice.", "Serve warm."], ["winter"]),
  C("gnt", "Gin & Tonic", "🌿", "#20c970", ["gin"], "60 ml gin", "Balloon",
    { tonic: 150, ice: 150, limes: 0.25, cucumber: 15 }, ["Fill a balloon glass with ice.", "60 ml gin, top with tonic.", "Lime wedge and cucumber ribbon."], ["classic", "easy"]),
  C("tom-collins", "Tom Collins", "🍋", "#7fd6a0", ["gin"], "60 ml gin", "Collins",
    { limes: 1, sugar: 15, soda: 120, ice: 150 }, ["Shake gin, lemon juice and sugar with ice.", "Strain into an iced tall glass.", "Top with soda."], ["refreshing"]),
  C("gin-rickey", "Gin Rickey", "🍈", "#4fc98a", ["gin"], "60 ml gin", "Highball",
    { limes: 0.5, soda: 150, ice: 150 }, ["Ice, 60 ml gin, juice of half a lime.", "Top with soda.", "Drop the lime shell in."], ["refreshing", "easy"]),
  C("screwdriver", "Screwdriver", "🍊", "#f0a030", ["vodka"], "60 ml vodka", "Highball",
    { orangejuice: 150, ice: 150 }, ["Ice in a tall glass.", "60 ml vodka, top with orange juice.", "Stir."], ["easy"]),
  C("moscow-mule", "Moscow Mule", "🫚", "#c9a060", ["vodka"], "60 ml vodka", "Copper mug",
    { gingerale: 150, limes: 0.5, ice: 150, mint: 2 }, ["Ice in a mug.", "60 ml vodka, juice of half a lime.", "Top with ginger ale, mint sprig."], ["refreshing"]),
  C("cosmo", "Cosmopolitan", "🍸", "#e0487a", ["vodka"], "45 ml vodka", "Martini",
    { cranberry: 60, limes: 0.5, ice: 100 }, ["Shake vodka, cranberry and lime with ice.", "Strain into a chilled martini glass."], ["party"]),
  C("vodka-lemonade", "Vodka Lemonade", "🍋", "#9ad0f0", ["vodka"], "60 ml vodka", "Highball",
    { lemon: 150, limes: 0.25, ice: 150, mint: 1 }, ["Ice, 60 ml vodka.", "Top with lemon-lime soda.", "Lemon wheel, mint."], ["easy"]),
  C("rum-coke", "Rum & Coke", "🥤", "#8a2b3c", ["rum"], "60 ml rum", "Highball",
    { cola: 150, ice: 150, limes: 0.25 }, ["Ice in a tall glass.", "60 ml rum, top with cola.", "Squeeze of lime — now it's a Cuba Libre."], ["classic", "easy"]),
  C("mojito", "Mojito", "🌱", "#3fbf6a", ["rum"], "60 ml white rum", "Highball",
    { mint: 4, limes: 1, sugar: 15, soda: 90, ice: 150 }, ["Muddle 8 mint leaves, lime wedges and sugar.", "Add rum and crushed ice.", "Top with soda, stir, mint sprig."], ["refreshing", "party"]),
  C("daiquiri", "Daiquiri", "🍹", "#e8e0b0", ["rum"], "60 ml rum", "Coupe",
    { limes: 1, sugar: 15, ice: 100 }, ["Shake rum, lime juice and sugar hard with ice.", "Strain into a chilled coupe."], ["classic"]),
  C("pina-colada", "Piña Colada", "🍍", "#f4d35e", ["rum"], "60 ml rum", "Hurricane",
    { pineapple: 120, coconutmilk: 45, ice: 150 }, ["Blend rum, pineapple juice, coconut milk and ice.", "Pour into a tall glass, pineapple wedge."], ["party", "sweet"]),
  C("hot-rum", "Hot Rum (Old Monk style)", "🔥", "#6b2a12", ["rum"], "60 ml dark rum", "Mug",
    { honey: 15, limes: 0.25 }, ["Hot water, 15 g honey, a squeeze of lemon.", "Add 60 ml dark rum.", "A pinch of cinnamon if you have it."], ["winter"]),
  C("tequila-shot", "Tequila Shots", "🌵", "#e0c020", ["tequila"], "30 ml tequila", "Shot",
    { limes: 0.5, salt: 2 }, ["Lick salt, shoot the tequila, bite the lime."], ["party", "easy"]),
  C("margarita", "Margarita", "🍸", "#b8e04a", ["tequila"], "50 ml tequila", "Margarita",
    { limes: 1, sugar: 10, salt: 3, ice: 120 }, ["Salt the rim.", "Shake tequila, lime juice and sugar with ice.", "Strain over ice."], ["classic", "party"]),
  C("paloma", "Paloma", "🩷", "#f39ab0", ["tequila"], "50 ml tequila", "Highball",
    { lemon: 150, limes: 0.5, salt: 1, ice: 150 }, ["Salt-rimmed glass, ice.", "Tequila and lime juice, top with lemon-lime soda."], ["refreshing"]),
  C("brandy-ginger", "Brandy Ginger", "🍂", "#b0582a", ["brandy"], "60 ml brandy", "Highball",
    { gingerale: 150, ice: 150 }, ["Ice, 60 ml brandy, top with ginger ale."], ["easy"]),
  C("brandy-honey", "Brandy, Honey & Hot Water", "🍯", "#8a4a1a", ["brandy"], "45 ml brandy", "Mug",
    { honey: 15, limes: 0.25 }, ["Hot water with honey and a squeeze of lemon.", "Add brandy — the winter-night classic."], ["winter"]),
  C("shandy", "Beer Shandy", "🍺", "#e8b020", ["beer"], "200 ml beer", "Pint",
    { lemon: 150 }, ["Half a glass of chilled beer.", "Top with lemon-lime soda."], ["easy", "refreshing"]),
  C("sangria", "Sangria", "🍷", "#9c1f4f", ["redwine"], "90 ml red wine", "Wine glass",
    { orangejuice: 60, lemon: 60, oranges: 0.25, ice: 100 }, ["Mix wine, orange juice and orange slices; chill an hour.", "Serve over ice, top with a splash of lemon-lime soda."], ["party", "make-ahead"]),
  C("spritzer", "White Wine Spritzer", "🥂", "#e8d890", ["whitewine"], "120 ml white wine", "Wine glass",
    { soda: 60, ice: 80 }, ["Ice, white wine, top with soda."], ["easy", "light"]),
  C("mimosa", "Mimosa", "🍾", "#f5b041", ["bubbly"], "90 ml sparkling wine", "Flute",
    { orangejuice: 90 }, ["Half orange juice, half chilled bubbly."], ["brunch", "easy"]),
  C("white-russian", "White Russian", "🥛", "#e8dcc8", ["vodka", "liqueur"], "45 ml vodka + 30 ml coffee liqueur", "Rocks",
    { milk: 60, ice: 100 }, ["Ice, vodka and coffee liqueur.", "Float milk or cream on top."], ["dessert"]),
  C("liqueur-rocks", "Liqueur on the Rocks", "🧊", "#9060e0", ["liqueur"], "60 ml liqueur", "Rocks",
    { ice: 100 }, ["Pour over a big ice cube. Sip."], ["dessert", "easy"]),
];
export const COCKTAIL = Object.fromEntries(COCKTAILS.map((c) => [c.id, c]));

// Families in the cabinet → which cocktails are makeable.
export function makeable(catIds) {
  const fams = new Set(catIds.map(familyOfCat).filter(Boolean));
  return COCKTAILS.map((c) => ({ ...c, can: c.needs.every((f) => fams.has(f)), missing: c.needs.filter((f) => !fams.has(f)) }));
}

// Supplies for a party menu: [{ id, servings }] → { groceryId: amount }.
export function cocktailUses(menu = []) {
  const out = {};
  for (const m of menu) {
    const c = COCKTAIL[m.id];
    if (!c || !m.servings) continue;
    for (const [g, amt] of Object.entries(c.uses)) out[g] = (out[g] || 0) + amt * m.servings;
  }
  for (const k of Object.keys(out)) out[k] = Math.ceil(out[k]);
  return out;
}

// Cocktail servings per spirit family (the first family is the base spirit).
export function servingsByFamily(menu = []) {
  const out = {};
  for (const m of menu) { const c = COCKTAIL[m.id]; if (c) out[c.needs[0]] = (out[c.needs[0]] || 0) + (m.servings || 0); }
  return out;
}

// ── Bar tab ──────────────────────────────────────────────────────────────────
// Filter chips: every tag in the order it first appears.
export const TAGS = [...new Set(COCKTAILS.flatMap((c) => c.tags))];

// The Bar grid: what you can make first (recipe order kept), then the rest.
export function barList(catIds = [], tag = null) {
  const all = makeable(catIds).filter((c) => !tag || c.tags.includes(tag));
  return [...all.filter((c) => c.can), ...all.filter((c) => !c.can)];
}

// The party menu as cocktails. Old or unknown ids and empty entries are skipped;
// a cocktail listed twice is counted once with both servings (as cocktailUses does).
export function menuSummary(menu = []) {
  const byId = new Map();
  for (const m of menu || []) {
    if (!m || !COCKTAIL[m.id] || !(m.servings > 0)) continue;
    byId.set(m.id, (byId.get(m.id) || 0) + m.servings);
  }
  const items = [...byId].map(([id, servings]) => ({ ...COCKTAIL[id], servings }));
  return { items, total: items.reduce((s, c) => s + c.servings, 0) };
}

// Sets a cocktail's servings on the menu; 0 takes it off. Other entries stay as they are.
export function withServings(menu = [], id, servings) {
  const list = (menu || []).filter(Boolean);
  if (!(servings > 0)) return list.filter((m) => m.id !== id);
  return list.some((m) => m.id === id) ? list.map((m) => (m.id === id ? { ...m, servings } : m)) : [...list, { id, servings }];
}

// One glass worth of a supply: "150 ml", "15 g", "¼ pc".
const FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
export function perServing(amount, unit) {
  if (unit !== "pc") return `${amount} ${unit}`;
  const whole = Math.floor(amount), frac = FRACTIONS[Math.round((amount - whole) * 100) / 100];
  const n = frac ? `${whole || ""}${frac}` : String(Math.round(amount * 100) / 100);
  return `${n} ${amount > 1 ? "pcs" : "pc"}`;
}
