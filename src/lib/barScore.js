// ═══════════════════════════════════════════════════════════════════════════════
//  BOTTLE SCORE — how glad a host would be to put this bottle on the table
//  (pure — unit-tested through tests/optimise.test.mjs on a real Livcheers catalog)
//
//  Fill my bar used to maximise Livcheers rating × drinks. Ratings carry no vote
//  count, so an unknown bottle with three 5★ reviews beat Royal Stag and Absolut.
//  Livcheers also lists city_liquors.rank: one all-India popularity list (1 = most
//  popular, up to ≈ 900, with gaps, missing for most bottles). Per family, once per
//  catalog and peg size (familyContext):
//    rank    its own → STAPLES, household names Livcheers leaves unranked (by name,
//            near the entry's cheapest ₹/drink) → the same brand's ranked bottle
//            nearest in ₹/drink (× 3, within 1.6×) → none;
//    vetted  that rank (a brand's own, for a borrowed one) ≤ max(350, 2.5 × the family's
//            best): only vetted bottles are picked while the family has any;
//    pop     log rank against the family's most popular bottle (0 = no rank);
//    ladder  ₹/drink from the cheapest to the dearest of the family's 12 most popular
//            bottles in this city, so a city's taxes move the ladder, not the class.
//  Per bottle (scoreFamily), for the host's answers { tier, style, origin, favs }:
//    q       the rating shrunk toward the family mean — popularity is the confidence;
//    c       where its ₹/drink sits on the ladder → how well it fits the tier's band
//            (crowd favourites reach down to the family's most popular bottle);
//    score   (0.55·pop + 0.30·q + 0.15·lean) × band × typeFit × originFit;
//    typeFit how the crowd drinks: no single malt into cola, white rum for the
//            menu's Mojitos, Indian agave spirits a step behind real tequila;
//    and "Indian" / "Imported" filters a spirit or wine with a well-known bottle of
//    that kind here (beer and tequila ignore the answer).
//  No sponsored picks. STAPLES is a small hand-kept list (checked on Gurgaon, Mumbai
//  and Bangalore, Oct 2026) — give it a look when Livcheers' ranks change. A family
//  with a category cached before the parser kept `rank` runs on a stopgap (LEGACY)
//  until it's re-synced: old and new rows can't be compared fairly.
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { FAMILIES } from "./cocktails.js";
import { servingsInBottle } from "./food.js";

export const R0 = 1000;                          // just past the last rank Livcheers hands out (892)
const W = { pop: 0.55, q: 0.3, lean: 0.15 };
const W_SIP = { pop: 0.45, q: 0.4, lean: 0.15 };  // a neat-pour crowd: the liquid counts more than the name
const SHRINK = { n0: 0.25, n1: 4, borrowed: 0.5 }; // a borrowed rank vouches half as much for this bottle's rating
const Q_LO = 4.0, Q_SPAN = 1.0;                  // ranked bottles sit at 4.2–4.9★
const MU_DEFAULT = 4.4, UNRATED_DROP = 0.1;      // an unrated bottle counts as the family mean − 0.1
const BRAND = { decay: 3, ratio: 1.6 };          // a sibling's rank × 3, ₹/drink within 1.6×
export const RANK_KNOWN = 200;                   // a tier needs a bottle this popular (or ≤ 2 × the family's best)
export const BRAND_KNOWN = BRAND.decay * RANK_KNOWN;   // a borrowed rank this good: the brand ranks ≤ 200
const VET = { rank: 350, top: 2.5 };             // picks need a rank ≤ max(350, 2.5 × the family's best)
const ORIGIN_KNOWN = 300;                        // "Indian" / "Imported" filters when a bottle this popular (or ≤ 2 × the best) is that kind
const STAPLE_RATIO = 1.6;                        // a staple vouches for bottles ≤ 1.6× its entry's cheapest ₹/drink
const LADDER_N = 12, LADDER_MIN = 4;             // the ladder spans the 12 most popular full bottles (≥ 4 needed)
const FLOOR = 0.45;                              // bottles under 45% of the family's best are left out
const SANE = 0.35;                               // under 35% of the category's 10th-percentile ₹/ml = a price error
const MAX_SPIRIT_ML = 1000;                      // no 1.5–4.5 L showpieces
const FULL_ML = 700;
// No ranks at all (prices cached before the parser kept them): the number of bottles the city
// lists for the brand stands in, capped low — single-bottle brands get nothing.
const LEGACY = { cap: 0.5, skus: 6 };
export const FAV_BOOST = 1.15;                   // "their usual" brand's best-fitting bottle

// Household names Livcheers leaves unranked, as the rank they'd plausibly have. Matched by the
// start of the bottle's name (spaces and punctuation removed), never by brand alone — Jose Cuervo
// also sells an ₹11k Reserva and a ₹20k Extra Añejo, Old Monk a Legend and a Supreme — and only
// for bottles within 1.6× the ₹/drink of the cheapest bottle the same entry matches.
export const STAPLES = {
  rum: { "old monk xxx": 60, "very old vatted old monk": 60, "mcdowell celebration": 150, "mcdowells no1 celebration": 150, "contessa xxx": 400 },
  tequila: { "jose cuervo esp": 200 },
  redwine: { "sula samara": 250, "sula shiraz cabernet": 250, "sula cabernet shiraz": 250, "sula zinfandel": 250, "sula red zinfandel": 250 },
  whitewine: { "sula samara": 300, "sula chenin blanc": 300, "sula sauvignon blanc": 300, "sula zinfandel rose": 300 },
};

// Price bands on c (0 = the cheapest of the family's popular bottles — Royal Stag, Magic Moments,
// Old Monk — 1 = the dearest of them: JW Black, Grey Goose, Corona). `lean`: where in the band the
// tier likes to sit (−1 cheaper end, +1 dearer end); `below`: how fast the fit falls under the band.
export const TIERS = {
  value:   { label: "Easy on the wallet", short: "easy-on-the-wallet picks", lo: -0.6, hi: 0.3, lean: -1, below: 1.5 },
  classic: { label: "Crowd favourites", short: "crowd favourites", lo: 0.2, hi: 0.8, lean: 0, below: 2.5 },
  premium: { label: "Treat them", short: "a treat", lo: 0.8, hi: 1.3, lean: 1, below: 2.5 },
  top:     { label: "Top shelf", short: "top shelf", lo: 1.15, hi: 2.4, lean: 0, below: 3 },
};
export const TIER_IDS = ["value", "classic", "premium", "top"];
export const TIER_DOWN = { top: "premium", premium: "classic", classic: "value" };
const ABOVE = 1.6, BAND_MIN = 0.1;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const quantile = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Names and brands get compared a lot (brand siblings, places, swaps): remembered per string.
const memo = (fn, cache = new Map()) => (s) => {
  const k = String(s || "");
  let v = cache.get(k);
  if (v === undefined) { v = fn(k); if (cache.size > 20000) cache.clear(); cache.set(k, v); }
  return v;
};
export const norm = memo((s) => s.toLowerCase().replace(/seagram'?s\s+/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim());
export const brandKey = memo((s) => norm(s).replace(/ /g, ""));
const kindOf = (cat) => CAT[cat]?.serve.kind || "spirit";
const SPIRIT_KINDS = new Set(["spirit", "shot"]);
const isFull = (cat, ml) => kindOf(cat) === "beer" || kindOf(cat) === "can" || (ml || 750) >= FULL_ML;

// Pre-mixed cocktails filed under spirits (Pour'd LIIT, M2 Magic Moments 330 ml).
const PREMIX = /pour'?d|cocktail|\bliit\b|low alcohol|^m2 /i;
// Livcheers types Absolut Mandrin or MM Ginger Limon as "Plain", so flavours come from the name too.
const FLAVOUR = /\b(apple|orange|mandrin|mandarin|mango|lime|limon|lemon|citron|citrus|\w*berr(y|ies)|grapefruit|watermelon|melon|peach|vanill\w*|venill\w*|honey|fire|cinnamon|coffee|cafe|caf|chocolate|toffee|caramel|butterscotch|cucumber|passion\w*|kiwi|aniseed|jamun|mint|minty|ginger|pink|coconut|guava|pineapple|cherry|masala|chilli|mirchi|strawberr\w*|raspberr\w*|peppar|kurant|elderflower|rhubarb|currant|rose|lychee|litchi|kokum|flv|flavou?r\w*)\b/i;
// Bottles Livcheers files under the wrong type: what they really are.
const TYPE_FIX = [[/^mc ?dowell'?s?\s*(no\.?\s*1\s*)?celebration/i, "Dark"]];   // McDowell's No.1 Celebration: a dark rum, typed "White"
export const typeOf = (item) => {
  const name = String(item?.name || "");
  for (const [re, t] of TYPE_FIX) if (re.test(name)) return t;
  return String(item?.type || item?.sub || "");
};
export const flavoured = (cat, item) => SPIRIT_KINDS.has(kindOf(cat)) && (/flavou?red/i.test(typeOf(item)) || FLAVOUR.test(item?.name || ""));

// Bottles a host would buy for a party: a sane price, a party size, not a pre-mix.
function usable(cat, item, floorPerMl) {
  if (!item || item.id == null || !(item.price > 0)) return false;
  const kind = kindOf(cat), ml = item.ml || 750;
  if (floorPerMl && item.price / ml < SANE * floorPerMl) return false;
  if (kind === "beer") return ml >= 330 && ml <= 650;
  if (kind === "can") return true;
  if (SPIRIT_KINDS.has(kind) && PREMIX.test(item.name || "")) return false;
  return ml <= MAX_SPIRIT_ML;
}

// 0 = Indian, 0.5 = Scotch/bourbon bottled in India (Teacher's, Black Dog, 100 Pipers), 1 = imported.
export function importedLevel(item) {
  if (!/^india$/i.test(String(item?.origin || "").trim())) return 1;
  return /scotch|american|bourbon|japanese|irish/i.test(typeOf(item)) ? 0.5 : 0;
}

// Categories cached before the parser kept `rank` (it always sets the key, null or a number).
export const legacyCat = (items) => Array.isArray(items) && items.some(Boolean) && !items.some((i) => i && "rank" in i);
export const ranklessCats = (catalog) => Object.keys(catalog || {}).filter((cat) => legacyCat(catalog[cat]));

/** Per-family context, computed once per catalog and peg: usable rows with their effective rank,
 *  popularity and place in the family, the price ladder, the mean rating, which origins it has. */
export function familyContext(catalog, f, pegMl = 60) {
  const rows = [], legacyCats = [];
  (FAMILIES[f]?.cats || []).forEach((cat, ci) => {
    const items = (catalog?.[cat] || []).filter(Boolean);
    const floor = quantile(items.filter((i) => i.price > 0 && i.ml >= 650).map((i) => i.price / i.ml), 0.1);
    let used = 0;
    for (const item of items) {
      if (!usable(cat, item, floor)) continue;
      const s = servingsInBottle(cat, item.ml || 750, pegMl);
      if (s >= 1) { rows.push({ cat, ci, item, s, ppd: item.price / s, flav: flavoured(cat, item), full: isFull(cat, item.ml) }); used++; }
    }
    if (used && legacyCat(items)) legacyCats.push(cat);
  });
  // The catalog's order means nothing: the same bottles in any order give the same picks.
  rows.sort((a, b) => a.ci - b.ci || cmp(String(a.item.id), String(b.item.id)));
  const legacy = legacyCats.length > 0;

  // Effective rank: own → STAPLES (by name, near the entry's cheapest ₹/drink) → a ranked same-brand
  // bottle (same flavoured-ness, similar ₹/drink) × 3. `vouch` = the rank that vouches for the
  // bottle being known: its own, the staple's, or the brand's best bottle.
  const byBrand = {};
  for (const r of rows) if (r.item.rank > 0) (byBrand[brandKey(r.item.brand)] ||= []).push(r);
  const staples = Object.entries(STAPLES[f] || {}).map(([k, v]) => [brandKey(k), v]).sort((a, b) => b[0].length - a[0].length || cmp(a[0], b[0]));
  const stapleOf = (r) => (r.flav ? null : staples.find(([k]) => brandKey(r.item.name).startsWith(k)) || null);
  const stapleMin = {};
  for (const r of rows) { const st = stapleOf(r); if (st) stapleMin[st[0]] = Math.min(stapleMin[st[0]] ?? Infinity, r.ppd); }
  for (const r of rows) {
    r.rank = null; r.from = null; r.vouch = null;
    if (r.item.rank > 0) { r.rank = r.vouch = r.item.rank; r.from = "own"; continue; }
    const st = stapleOf(r);
    if (st && r.ppd <= STAPLE_RATIO * stapleMin[st[0]] + 1e-9) { r.rank = r.vouch = st[1]; r.from = "staple"; continue; }
    // The sibling nearest in ₹/drink (JW Black's ₹6k "Origin" edition goes by Double Black, not Black).
    const gap = (x) => Math.max(x.ppd, r.ppd) / Math.min(x.ppd, r.ppd);
    const sib = (byBrand[brandKey(r.item.brand)] || []).filter((x) => x.flav === r.flav && gap(x) <= BRAND.ratio)
      .sort((a, b) => gap(a) - gap(b) || a.item.rank - b.item.rank)[0];
    if (sib) { r.vouch = sib.item.rank; r.rank = Math.min(R0 - 1, r.vouch * BRAND.decay); r.from = "brand"; }
  }
  const own = rows.filter((r) => r.from === "own" && r.full && !r.flav);
  const ranked = rows.filter((r) => r.rank);
  const top = own.length ? Math.min(...own.map((r) => r.rank)) : ranked.length ? Math.min(...ranked.map((r) => r.rank)) : null;
  // ₹/drink of the family's most popular bottle: a crowd favourite whatever it costs (Camino in
  // Mumbai; Old Monk XXX in a rum shelf cached without ranks).
  const staplesHere = rows.filter((r) => r.from === "staple" && r.full && !r.flav);
  const bestStaple = staplesHere.length ? Math.min(...staplesHere.map((r) => r.rank)) : null;
  const anchor = own.length ? own.filter((r) => r.rank === top) : staplesHere.filter((r) => r.rank === bestStaple);
  const topPpd = anchor.length ? Math.min(...anchor.map((r) => r.ppd)) : null;
  const popOf = (rank) => (rank && top ? clamp(Math.log(R0 / rank) / Math.log(R0 / Math.min(top, R0 / 2)), 0, 1) : 0);
  for (const r of rows) r.pop = popOf(r.rank);
  if (legacy) {
    // Stopgap: the brand's number of bottles here, or a fresh category's rank on the same low scale.
    const skus = {};
    for (const r of rows) skus[brandKey(r.item.brand)] = (skus[brandKey(r.item.brand)] || 0) + 1;
    for (const r of rows) {
      if (r.from === "staple") continue;
      const bySkus = clamp(Math.log(skus[brandKey(r.item.brand)]) / Math.log(LEGACY.skus), 0, 1);
      r.pop = LEGACY.cap * Math.max(bySkus, r.from === "own" ? r.pop : 0);
    }
  }
  // Place among the city's ranked bottles of the family (by name, so sizes count once): "Top-3 rum".
  // Not while part of the family is cached without ranks (the list would be partial).
  const bestByName = new Map();
  if (!legacy) for (const r of rows) if (r.from === "own") { const k = norm(r.item.name); bestByName.set(k, Math.min(bestByName.get(k) ?? Infinity, r.rank)); }
  const ranks = [...bestByName.values()].sort((a, b) => a - b);
  const placeOf = (rank) => { let lo = 0, hi = ranks.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ranks[m] < rank) lo = m + 1; else hi = m; } return lo + 1; };
  for (const r of rows) { r.pos = !legacy && r.from === "own" ? placeOf(bestByName.get(norm(r.item.name))) : null; r.of = ranks.length; }

  // Vetted: popular enough to be picked. Old caches can't tell, so there the score's floor decides.
  const vetLimit = Math.max(VET.rank, VET.top * (top || 0));
  for (const r of rows) r.vetted = !legacy && r.vouch > 0 && r.vouch <= vetLimit;

  // Ladder: ₹/drink of the most popular full, unflavoured bottles (own rank or a staple). With part
  // of the family cached without ranks, the ranked part would skew it: the family's spread instead.
  const known = legacy ? [] : rows.filter((r) => r.full && !r.flav && r.from && r.from !== "brand").sort((a, b) => a.rank - b.rank).slice(0, LADDER_N).map((r) => r.ppd);
  const all = rows.filter((r) => r.full && !r.flav).map((r) => r.ppd);
  let lo = known.length >= LADDER_MIN ? Math.min(...known) : quantile(all, 0.1);
  let hi = known.length >= LADDER_MIN ? Math.max(...known) : quantile(all, 0.75);
  if (!(lo > 0)) lo = 1;
  if (!(hi > lo * 1.3)) hi = lo * 1.3;
  const rated = rows.filter((r) => r.from === "own" && r.item.rating > 0).map((r) => r.item.rating);
  const mu = rated.length >= 3 ? rated.reduce((s, x) => s + x, 0) / rated.length : MU_DEFAULT;
  // Made in India, Indian-bottled Scotch included (Gurgaon: whisky 0.35, beer 0.7, tequila 0.03).
  const desiShare = rows.filter((r) => importedLevel(r.item) < 1).length / Math.max(1, rows.length);
  // Which origins have a well-known bottle here (what "Indian" / "Imported" can keep): Fratelli and
  // Sula for red wine, but not Captain Morgan Spiced (#342) for an imported rum.
  const famous = (r) => r.full && !r.flav && r.vouch && r.from !== "brand" && r.vouch <= Math.max(ORIGIN_KNOWN, 2 * (top || 0));
  const origins = { desi: rows.some((r) => famous(r) && importedLevel(r.item) < 1), imported: rows.some((r) => famous(r) && importedLevel(r.item) === 1) };
  return { f, rows, top, topPpd, lo, hi, mu, legacy, legacyCats, desiShare, origins, known: known.length, vetted: rows.some((r) => r.vetted) };
}

// What the bottle is for vs how this crowd drinks.
export function typeFit(r, f, style = {}) {
  const t = typeOf(r.item).toLowerCase(), ml = r.item.ml || 750;
  const fun = style.cocktails || style.shots;
  if (r.flav) return style.shots && ["vodka", "rum", "tequila", "liqueur"].includes(f) ? 1 : style.cocktails ? 0.85 : 0.5;
  switch (f) {
    case "whisky": {
      const malt = r.cat === "malts" || /single malt/i.test(r.item.name), desiBlend = r.cat === "indian" && /blended indian/.test(t);
      if (style.sip && !style.mix) return malt ? 1.1 : r.cat === "worldwhisky" ? 1.05 : desiBlend ? 0.85 : 1;
      if (style.mix && !style.sip && !fun) return malt ? 0.85 : 1;          // nobody pours a single malt into cola
      return 1;
    }
    case "rum":
      if (/overproof/.test(t)) return 0.5;
      // The cocktail menu says which (style.menuRum): no dark rum in the Mojitos.
      if (style.menuRum === "white") return /white/.test(t) ? 1.1 : 0.85;
      if (style.menuRum === "dark") return /dark|aged|blended indian|gold|spiced/.test(t) ? 1.1 : 0.9;
      if (/white/.test(t)) return style.cocktails ? 1.05 : style.sip && !style.mix ? 0.85 : 1;
      if (/spiced/.test(t)) return 0.95;
      if (/dark|aged|blended indian|gold/.test(t)) return style.mix ? 1.05 : style.cocktails && !style.sip ? 0.95 : 1;   // Old Monk & cola
      return 1;
    case "tequila": {
      // Agave spirits made in India (Maya Pistola, El Goonda) are filed here but aren't tequila.
      const agave = importedLevel(r.item) < 1 ? 0.9 : 1;
      if (/mezcal|cafe|rosa|cristalino/.test(t)) return 0.6 * agave;
      if (/a[nñ]ejo|extra/.test(t)) return (style.sip ? 1.05 : 0.7) * agave;
      if (/reposado/.test(t)) return (style.sip ? 1 : 0.95) * agave;
      return (style.sip && !fun ? 0.85 : 1) * agave;                       // silver / blanco / gold / joven
    }
    case "gin":
      return /compound|genever|jenever|old tom/.test(`${t} ${norm(r.item.name)}`) ? 0.7 : 1;
    case "beer":
      if (/stout|porter|fruit|mead|bock|dunkel|sour|red ale|brown|belgian|smoked|schwarz|barley wine/.test(t)) return 0.75;
      return ml >= 650 ? 1 : ml >= 500 ? 0.95 : 0.9;                       // 650s and cans are the party sizes
    case "redwine": case "whitewine": case "bubbly":
      return /\bport\b|dessert|sweet|sparkler|late harvest/.test(`${t} ${norm(r.item.name)}`) ? 0.6 : 1;
    default: return 1;
  }
}

// Desi or imported. Beer ignores it (Corona, Budweiser and Heineken are brewed here, so "imported"
// would mean Druk or BrewDog) and so does tequila (Mexican by definition). Elsewhere, where the city
// has a well-known bottle of the wanted kind, it's a filter — "Indian" keeps bottles made in India
// (Indian-bottled Scotch too, a touch lower), "Imported" keeps imported ones; without one, only a
// nudge: there's no well-known imported rum, and Bacardi beats a rum nobody has heard of.
const ORIGIN_FAMS = new Set(["whisky", "vodka", "gin", "rum", "brandy", "redwine", "whitewine", "bubbly", "liqueur"]);
export const originApplies = (f) => ORIGIN_FAMS.has(f);
// The answer changes the picks: well-known bottles made here and imported (old caches: can't tell, ask).
export const originChoice = (ctx) => originApplies(ctx.f) && (ctx.legacy || (ctx.origins.desi && ctx.origins.imported));
const wanted = (item, origin) => (origin === "desi" ? importedLevel(item) < 1 : origin === "imported" ? importedLevel(item) === 1 : true);
export function originFilters(ctx, origin = "any") {
  if (!origin || origin === "any" || ctx.legacy || !originApplies(ctx.f)) return false;
  return !!ctx.origins[origin];
}
export const originOk = (item, ctx, origin = "any", filters = originFilters(ctx, origin)) => !filters || wanted(item, origin);
export function originFit(item, ctx, origin = "any") {
  if (!origin || origin === "any" || !originApplies(ctx.f)) return 1;
  const imp = importedLevel(item);
  if (origin === "desi") return imp === 0 ? 1 : imp === 0.5 ? 0.92 : 0.75;
  if (origin === "imported") return imp === 1 ? 1 : imp === 0.5 ? 0.9 : 0.7;
  return 1;
}

// `lo`: the band's low end, when it's moved (crowd favourites reach down to the family's most popular bottle).
export function bandFit(c, tier, lo) {
  const b = TIERS[tier] || TIERS.classic;
  lo = lo ?? b.lo;
  if (c < lo) return Math.max(BAND_MIN, 1 - b.below * (lo - c));
  if (c > b.hi) return Math.max(BAND_MIN / 2, 1 - ABOVE * (c - b.hi));
  return 1;
}
export const priceClass = (ctx, ppd) => Math.log(ppd / ctx.lo) / Math.log(ctx.hi / ctx.lo);
// 0…1: how well the bottle sits where this tier likes to be inside its band.
export function leanFit(c, tier) {
  const b = TIERS[tier] || TIERS.classic, pos = clamp((c - b.lo) / (b.hi - b.lo), 0, 1);
  return b.lean > 0 ? pos : b.lean < 0 ? 1 - pos : 0.5;
}
const weightsFor = (style = {}) => (style.sip && !style.mix && !style.cocktails && !style.shots ? W_SIP : W);

// The bottle for this crowd, before the price band.
function quality(ctx, r, profile) {
  const n = ctx.legacy ? 1 : SHRINK.n0 + SHRINK.n1 * r.pop * (r.from === "own" ? 1 : SHRINK.borrowed);
  const q = r.item.rating > 0 ? (n * r.item.rating + ctx.mu) / (n + 1) : ctx.mu - UNRATED_DROP;
  const qn = clamp((q - Q_LO) / Q_SPAN, 0, 1);
  const w = weightsFor(profile.style);
  const base = w.pop * r.pop + w.q * qn;
  const type = typeFit(r, ctx.f, profile.style), orig = originFit(r.item, ctx, profile.origin);
  return { q, qn, base, type, orig, quality: base * type * orig };
}

/**
 * Scores every usable bottle of the family at `tier`, stepping down a tier when nothing well
 * known sits in its band (top-shelf rum, premium beer). `ok` = vetted (while the family has a
 * vetted bottle) and above the floor — or "their usual".
 * @returns { tier, rows: [{ cat, item, s, ppd, rank, from, pos, of, flav, score, ok, fav, parts }] }
 */
export function scoreFamily(ctx, profile = {}, tier = "classic") {
  let t = TIERS[tier] ? tier : "classic";
  const w = weightsFor(profile.style);
  const filters = originFilters(ctx, profile.origin);
  const qs = ctx.rows.map((r) => ({ r, ...quality(ctx, r, profile), allowed: originOk(r.item, ctx, profile.origin, filters) }));
  if (!qs.some((x) => x.allowed)) for (const x of qs) x.allowed = true;
  const best = Math.max(0, ...qs.filter((x) => x.allowed).map((x) => x.quality));
  // Crowd favourites reach down to the family's most popular bottle, however cheap it is.
  const favLo = ctx.topPpd > 0 ? Math.min(TIERS.classic.lo, priceClass(ctx, ctx.topPpd)) : TIERS.classic.lo;
  for (;;) {
    const rows = qs.map((x) => {
      const c = priceClass(ctx, x.r.ppd), band = bandFit(c, t, t === "classic" ? favLo : undefined), lean = leanFit(c, t);
      return {
        cat: x.r.cat, item: x.r.item, s: x.r.s, ppd: x.r.ppd, rank: x.r.rank, from: x.r.from, pos: x.r.pos, of: x.r.of, flav: x.r.flav,
        score: (x.base + w.lean * lean) * band * x.type * x.orig, ok: x.allowed && x.quality >= FLOOR * best && (!ctx.vetted || x.r.vetted), fav: false,
        parts: { pop: x.r.pop, q: x.q, c, band, lean, type: x.type, orig: x.orig },
      };
    });
    const knownInBand = rows.some((o) => o.ok && o.parts.band >= 0.9 && o.parts.type >= 0.9 && !o.flav && o.rank && o.rank <= Math.max(RANK_KNOWN, 2 * (ctx.top || 0)));
    if (knownInBand || !TIER_DOWN[t] || ctx.legacy) {
      // The host's usual brand: its best-fitting bottle goes to the top of the family, whatever
      // the tier (it's what they drink), and is never left out. Money can still rule it out.
      const fav = profile.favs?.[ctx.f];
      const mine = fav ? rows.filter((o) => brandKey(o.item.brand) === fav && !o.flav).sort((a, b) => b.score - a.score || cmp(String(a.item.id), String(b.item.id)))[0] : null;
      if (mine) {
        const top = Math.max(0, ...rows.filter((o) => o.ok).map((o) => o.score));
        mine.score = Math.max(mine.score, top) * FAV_BOOST; mine.ok = true; mine.fav = true;
      }
      return { tier: t, rows };
    }
    t = TIER_DOWN[t];
  }
}

// The family's best-known brands sold in this city (own rank or a staple), most popular first.
export function topBrands(ctx, n = 6) {
  const best = new Map();
  for (const r of ctx.rows) {
    if (!r.rank || r.from === "brand" || r.flav) continue;
    const key = brandKey(r.item.brand || r.item.name.split(" ")[0]);
    if (!key) continue;
    const cur = best.get(key);
    if (!cur || r.rank < cur.rank) best.set(key, { key, label: r.item.brand || r.item.name.split(" ")[0], rank: r.rank });
  }
  return [...best.values()].sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : 1)).slice(0, n);
}
