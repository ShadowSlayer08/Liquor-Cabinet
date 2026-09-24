// ═══════════════════════════════════════════════════════════════════════════════
//  LIVCHEERS PARSER  (pure functions — no network, unit-tested in tests/)
//
//  livcheers.com is a Next.js (app router) site. Every category page ships the
//  full product list for the city inside the React Server Components "flight"
//  payload: a series of  self.__next_f.push([1,"…"])  script tags. Concatenated,
//  that payload contains an  "items":[ … ]  array whose rows look like
//    { city_liquors:{price,priceCategory}, liquors:{displayName,size,slug,code,
//      tastingNotes,description}, liquor_groups:{averageOverallRating,…},
//      brands:{name}, country:{name,code}, liquor_types:{name}, category:{…} }
//  We pull that array out and normalise each row into the planner's item shape.
// ═══════════════════════════════════════════════════════════════════════════════

export const LC_BASE = "https://www.livcheers.com";
export const LC_IMG = "https://static.livcheers.com/static/content/images/liquor/";

// Cities Livcheers publishes prices for (from /select-city).
export const CITIES = [
  ["Agra", "agra"], ["Asansol", "asansol"], ["Bangalore", "bangalore"], ["Bhopal", "bhopal"],
  ["Delhi", "delhi"], ["Faridabad", "faridabad"], ["Ghaziabad", "ghaziabad"], ["Goa", "goa"],
  ["Gurgaon", "gurgaon"], ["Gwalior", "gwalior"], ["Hubli Dharwad", "hubli-dharwad"],
  ["Hyderabad", "hyderabad"], ["Indore", "indore"], ["Jabalpur", "jabalpur"], ["Jaipur", "jaipur"],
  ["Jodhpur", "jodhpur"], ["Kanpur", "kanpur"], ["Kolkata", "kolkata"], ["Kota", "kota"],
  ["Lucknow", "lucknow"], ["Mangalore", "mangalore"], ["Mumbai", "mumbai"], ["Mysore", "mysore"],
  ["Nagpur", "nagpur"], ["Nashik", "nashik"], ["Noida", "noida"], ["Pune", "pune"],
  ["Thane", "thane"], ["Udaipur", "udaipur"], ["Warangal", "warangal"],
].map(([name, slug]) => ({ name, slug }));

export const cityName = (slug) => CITIES.find((c) => c.slug === slug)?.name || slug;

// All Livcheers categories. `serve` drives the food calculator's drink maths:
//   kind  spirit → one drink = one peg (size chosen in the calculator)
//         shot   → 30 ml, beer → 330 ml, wine → 150 ml glass, sake → 90 ml, can → 1 unit
//   mixer what each drink is topped up with (150 ml per drink), if anything.
export const CATEGORIES = [
  { id: "malts",       slug: "single-malts",         label: "Single Malts",   emoji: "🥃", color: "#d4872a", serve: { kind: "spirit", mixer: "soda" }, sync: true },
  { id: "worldwhisky", slug: "world-whisky",         label: "World Whisky",   emoji: "🌍", color: "#b87c20", serve: { kind: "spirit", mixer: "soda" }, sync: true },
  { id: "scotch",      slug: "blended-scotch",       label: "Blended Scotch", emoji: "🏴", color: "#a8741c", serve: { kind: "spirit", mixer: "soda" }, sync: true },
  { id: "indian",      slug: "made-in-india-whisky", label: "Indian Whisky",  emoji: "🐅", color: "#c0602a", serve: { kind: "spirit", mixer: "soda" }, sync: false },
  { id: "gin",         slug: "gin",                  label: "Gin",            emoji: "🌿", color: "#20c970", serve: { kind: "spirit", mixer: "tonic" }, sync: true },
  { id: "tequila",     slug: "tequila",              label: "Tequila",        emoji: "🌵", color: "#e0c020", serve: { kind: "shot", mixer: null }, sync: true },
  { id: "rum",         slug: "rum",                  label: "Rum",            emoji: "🍹", color: "#e03060", serve: { kind: "spirit", mixer: "cola" }, sync: true },
  { id: "vodka",       slug: "vodka",                label: "Vodka",          emoji: "❄️", color: "#40a0f0", serve: { kind: "spirit", mixer: "lemon" }, sync: true },
  { id: "brandy",      slug: "brandy",               label: "Brandy",         emoji: "🍂", color: "#b0582a", serve: { kind: "spirit", mixer: "soda" }, sync: false },
  { id: "beer",        slug: "beers",                label: "Beer",           emoji: "🍺", color: "#e89020", serve: { kind: "beer", mixer: null }, sync: true },
  { id: "redwine",     slug: "red-wine",             label: "Red Wine",       emoji: "🍷", color: "#c03878", serve: { kind: "wine", mixer: null }, sync: true },
  { id: "whitewine",   slug: "white-wine",           label: "White Wine",     emoji: "🥂", color: "#d8c870", serve: { kind: "wine", mixer: null }, sync: false },
  { id: "rose",        slug: "rose-wine",            label: "Rosé",           emoji: "🌸", color: "#f07090", serve: { kind: "wine", mixer: null }, sync: false },
  { id: "sparkling",   slug: "sparkling-wine",       label: "Sparkling",      emoji: "✨", color: "#9cc4ec", serve: { kind: "wine", mixer: null }, sync: false },
  { id: "champagne",   slug: "champagne",            label: "Champagne",      emoji: "🍾", color: "#e8d088", serve: { kind: "wine", mixer: null }, sync: false },
  { id: "liqueur",     slug: "liqueurs",             label: "Liqueurs",       emoji: "🍸", color: "#9060e0", serve: { kind: "shot", mixer: null }, sync: false },
  { id: "sake",        slug: "sake",                 label: "Sake",           emoji: "🍶", color: "#d0d0c8", serve: { kind: "sake", mixer: null }, sync: false },
  { id: "rtd",         slug: "ready-to-drink",       label: "Ready to Drink", emoji: "🥤", color: "#40d0c0", serve: { kind: "can", mixer: null }, sync: false },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const TIER = {
  editors: { icon: "🏆", label: "Editor's Choice", bg: "#2a1500", fg: "#f0900a" },
  best:    { icon: "★",  label: "Best Pick",       bg: "#0a0a1e", fg: "#7090e8" },
  good:    { icon: "✓",  label: "Good Value",      bg: "#0a140a", fg: "#50904a" },
};

// Same rule as the original planner's prompt: top-rated premium bottles are
// Editor's Choice, well-rated ones Best Pick, everything else Good Value.
export function tierFor(rating, priceCategory) {
  if (rating >= 4.7 && (priceCategory === "luxury" || priceCategory === "premium")) return "editors";
  if (rating >= 4.4) return "best";
  return "good";
}

export function parseMl(size) {
  const m = String(size || "").toUpperCase().replace(/\s+/g, "").match(/([\d.]+)(ML|L|CL)/);
  if (!m) return 750;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === "L" ? n * 1000 : m[2] === "CL" ? n * 10 : n);
}

export const prettyVol = (size) => {
  const ml = parseMl(size);
  return ml >= 1000 && ml % 1000 === 0 ? `${ml / 1000} L` : `${ml} ml`;
};

export function flagEmoji(code) {
  const c = String(code || "").toLowerCase();
  if (c === "gb-sct") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  if (c === "gb-eng") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (c === "gb-wls") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
  if (!/^[a-z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// ── RSC flight extraction ────────────────────────────────────────────────────
export function extractFlight(html) {
  const re = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  let out = "";
  let m;
  while ((m = re.exec(html))) {
    try {
      const chunk = JSON.parse(m[1]);
      if (typeof chunk[1] === "string") out += chunk[1];
    } catch { /* non-JSON push (e.g. form state) — ignore */ }
  }
  return out;
}

// Index of the bracket that closes the one at `start`, respecting JSON strings.
export function matchBracket(s, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// RSC may replace repeated values with "$ref" strings — treat those as missing.
const val = (v) => (typeof v === "string" && v.startsWith("$") ? null : v);
const round1 = (n) => Math.round(n * 10) / 10;

export function normalizeRow(row, citySlug) {
  const L = row.liquors, C = row.city_liquors, G = row.liquor_groups || {};
  if (!L || !C) return null;
  const price = parseInt(val(C.price), 10);
  if (!price || !val(L.displayName)) return null;
  const rating = Number(val(G.averageOverallRating)) || 0;
  const priceCategory = val(C.priceCategory) || null;
  const country = row.country || {};
  return {
    id: String(L.id),
    code: val(L.code) || null,
    slug: val(L.slug) || "",
    name: String(L.displayName).trim(),
    brand: val(row.brands?.name) || "",
    sub: val(row.liquor_types?.name) || val(row.category?.name) || "",
    vol: prettyVol(L.size),
    ml: parseMl(L.size),
    price,
    rating: round1(rating),
    ratings: {
      taste: Number(val(G.averageTasteRating)) || null,
      value: Number(val(G.averageValueForMoneyRating)) || null,
      rebuy: Number(val(G.averageLikelihoodToBuyAgainRating)) || null,
    },
    origin: val(country.name) || "",
    flag: flagEmoji(val(country.code)),
    priceCategory,
    tier: tierFor(rating, priceCategory),
    notes: val(L.tastingNotes) || "",
    description: val(L.description) || "",
    url: `${LC_BASE}/${citySlug}/liquor/${val(L.slug) || ""}`,
    img: val(L.code) ? `${LC_IMG}${L.code}.webp` : null,
  };
}

export function parseCategoryHtml(html, citySlug) {
  const flight = extractFlight(html);
  const items = [];
  const seen = new Set();
  const re = /"items":\[/g;
  let m;
  while ((m = re.exec(flight))) {
    const start = m.index + m[0].length - 1;
    const end = matchBracket(flight, start);
    if (end < 0) continue;
    let rows;
    try { rows = JSON.parse(flight.slice(start, end + 1)); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const it = row && typeof row === "object" ? normalizeRow(row, citySlug) : null;
      if (it && !seen.has(it.id)) { seen.add(it.id); items.push(it); }
    }
    re.lastIndex = end;
  }
  return items.sort((a, b) => a.price - b.price);
}

export const categoryUrl = (citySlug, cat) => `${LC_BASE}/${citySlug}/category/${cat.slug}`;
