// ═══════════════════════════════════════════════════════════════════════════════
//  FILL MY BAR QUIZ — five quick questions → what the optimiser needs
//  (pure — unit-tested in tests/barQuiz.test.mjs)
//
//  What do they drink, how, how fancy, Indian or imported, and how much? The
//  answers describe the host's crowd rather than one party, so they're saved in
//  cfg.barQuiz (App), outside `party`. seedQuiz() pre-fills them: last time's
//  answers, then the party template (party.mix), then the guests' tastes
//  (party.prefs.drinks — still edited only in GuestPrefs), then the defaults. A
//  template applied since the last answers re-seeds what they drink and how.
//  profileFromQuiz() turns the answers into family shares, the families to keep
//  and the scoring profile for lib/optimise.js; reasonsFor() writes the two short
//  "why this bottle" pills, and never claims Livcheers popularity it doesn't have.
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT } from "./parse/livcheers.js";
import { COCKTAIL, FAMILIES, servingsByFamily } from "./cocktails.js";
import { MIXES } from "./optimise.js";
import { TIERS, BRAND_KNOWN, brandKey, importedLevel, originApplies, typeOf } from "./barScore.js";
import { TEMPLATES } from "./templates.js";
import { fmt, fmtShort } from "./format.js";

// Q1 chips. `fams` are the optimiser's families ("wine" is quiz-only: red + white).
export const QUIZ_FAMILIES = [
  { id: "whisky", label: "Whisky", cat: "malts", fams: ["whisky"] },
  { id: "beer", label: "Beer", cat: "beer", fams: ["beer"] },
  { id: "rum", label: "Rum", cat: "rum", fams: ["rum"] },
  { id: "vodka", label: "Vodka", cat: "vodka", fams: ["vodka"] },
  { id: "gin", label: "Gin", cat: "gin", fams: ["gin"] },
  { id: "wine", label: "Wine", cat: "redwine", fams: ["redwine", "whitewine"] },
  { id: "tequila", label: "Tequila", cat: "tequila", fams: ["tequila"] },
  { id: "bubbly", label: "Bubbly", cat: "champagne", fams: ["bubbly"] },
  { id: "brandy", label: "Brandy", cat: "brandy", fams: ["brandy"] },
].map((f) => ({ ...f, emoji: CAT[f.cat]?.emoji || "🍾", color: CAT[f.cat]?.color || "#e7a846" }));
export const QUIZ_FAMILY = Object.fromEntries(QUIZ_FAMILIES.map((f) => [f.id, f]));
const quizFamilyOf = (f) => QUIZ_FAMILIES.find((q) => q.fams.includes(f))?.id || null;

export const STYLES = [
  { id: "sip", label: "Neat or on the rocks", short: "neat", emoji: "🧊" },
  { id: "mix", label: "With soda, cola or tonic", short: "mixers", emoji: "🥤" },
  { id: "cocktails", label: "Cocktails", short: "cocktails", emoji: "🍸" },
  { id: "shots", label: "Shots", short: "shots", emoji: "🔥" },
];
const STYLE_IDS = STYLES.map((s) => s.id);

// Q3. Examples for when nothing is synced yet (the sheet shows live ones with prices).
export const VIBES = [
  { id: "auto", label: "Let the budget decide", line: "The fanciest bar your budget covers" },
  { id: "value", label: TIERS.value.label, eg: ["Royal Stag", "Magic Moments"] },
  { id: "classic", label: TIERS.classic.label, eg: ["Johnnie Walker Red", "Absolut"] },
  { id: "premium", label: TIERS.premium.label, eg: ["Black Label", "Grey Goose"] },
  { id: "top", label: TIERS.top.label, eg: ["Johnnie Walker Gold", "Monkey Shoulder"] },
];
export const ORIGINS = [
  { id: "desi", label: "Indian is great", short: "Indian", emoji: "🇮🇳" },
  { id: "imported", label: "Imported, please", short: "Imported", emoji: "🌍" },
  { id: "any", label: "Doesn't matter", short: "Made anywhere", emoji: "🤷" },
];
export const STEPS = ["families", "style", "vibe", "origin", "budget"];
export const HEAD_AMOUNTS = [500, 1000, 1500, 2500];
const LOTS = 3, SOME = 1;

// What a template's bar style (party.mix) means as answers. "mixed" = not sure (MIXES.mixed).
export const MIX_SEEDS = {
  mixed:    { families: null, style: ["mix"] },
  whisky:   { families: { whisky: 2, rum: 1, beer: 1 }, style: ["mix"] },
  beerwine: { families: { beer: 2, wine: 2 }, style: [] },
  light:    { families: { beer: 2, vodka: 1, rum: 1, gin: 1 }, style: ["mix"] },
  menu:     { families: "menu", style: ["cocktails"] },
};
// The guests' tastes (Food tab → Guests like…) as hints: a style and the families they point to.
export const TASTE_HINTS = {
  strong: { style: "sip", families: ["whisky"] },
  classic: { style: null, families: ["whisky", "gin"] },
  warm: { style: "sip", families: ["whisky", "rum"] },
  refreshing: { style: "mix", families: ["beer", "gin"] },
  light: { style: "mix", families: ["beer", "vodka"] },
  fruity: { style: "cocktails", families: ["vodka", "rum"] },
  sweet: { style: "cocktails", families: ["rum", "vodka"] },
  sour: { style: "cocktails", families: ["whisky", "gin"] },
  spicy: { style: "cocktails", families: ["tequila"] },
  creamy: { style: "cocktails", families: [] },
  desi: { style: "mix", families: ["whisky", "rum"] },
};
// "Not sure" + cocktails only: the spirits cocktails are made of.
export const COCKTAIL_SHARES = { vodka: 0.35, rum: 0.30, gin: 0.20, tequila: 0.15 };
// Families with well-known bottles made here and imported, for when they aren't synced yet (Gurgaon
// and Mumbai, Oct 2026 — no well-known imported rum; beer and tequila ignore the answer).
const ORIGIN_GUESS = new Set(["whisky", "vodka", "gin", "brandy", "redwine", "whitewine", "bubbly"]);

export const DEFAULT_QUIZ = { v: 1, families: null, seededMix: null, style: ["mix"], tier: "auto", origin: "any", money: { kind: "left" }, favs: {}, answered: [], variety: true };

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

// Any saved shape (older versions, junk) → a clean set of answers.
export function normalizeQuiz(x) {
  const q = isObj(x) ? x : {};
  let families = null;
  if (isObj(q.families)) {
    const f = {};
    for (const { id } of QUIZ_FAMILIES) { const n = Number(q.families[id]); if (n === 1 || n === 2) f[id] = n; }
    if (Object.keys(f).length) families = f;
  }
  const m = isObj(q.money) ? q.money : {};
  const value = Math.min(1e7, Math.round(Number(m.value)));
  const money = m.kind === "left" || m.kind === "enough" ? { kind: m.kind }
    : (m.kind === "head" || m.kind === "amount") && value > 0 ? { kind: m.kind, value } : { kind: "left" };
  const favs = {};
  if (isObj(q.favs)) for (const [f, k] of Object.entries(q.favs)) if (FAMILIES[f] && typeof k === "string" && brandKey(k)) favs[f] = brandKey(k).slice(0, 60);
  return {
    v: 1,
    families,
    seededMix: typeof q.seededMix === "string" && MIXES[q.seededMix] ? q.seededMix : null,
    style: Array.isArray(q.style) ? STYLE_IDS.filter((s) => q.style.includes(s)) : [...DEFAULT_QUIZ.style],
    tier: q.tier === "auto" || TIERS[q.tier] ? q.tier : "auto",
    origin: ORIGINS.some((o) => o.id === q.origin) ? q.origin : "any",
    money,
    favs,
    answered: Array.isArray(q.answered) ? STEPS.filter((s) => q.answered.includes(s)) : [],
    variety: q.variety !== false,
  };
}

// Q1 chip taps: off → some → lots → off. "Not sure" (null) is its own chip.
export function cycleFamily(families, id) {
  if (!QUIZ_FAMILY[id]) return families || null;
  const f = { ...(families || {}) };
  const n = f[id] || 0;
  if (n === 2) delete f[id]; else f[id] = n + 1;
  return Object.keys(f).length ? f : null;
}

function familiesFromMenu(menu) {
  const out = {};
  for (const [f, n] of Object.entries(servingsByFamily((menu || []).filter((m) => m && COCKTAIL[m.id] && m.servings > 0)))) {
    const q = quizFamilyOf(f);
    if (q && n > 0) out[q] = (out[q] || 0) + n;
  }
  const order = (id) => QUIZ_FAMILIES.findIndex((q) => q.id === id);
  const ids = Object.keys(out).sort((a, b) => out[b] - out[a] || order(a) - order(b));
  return ids.length ? Object.fromEntries(ids.map((id, i) => [id, i === 0 ? 2 : 1])) : null;
}
function fromMix(mix, menu) {
  const s = MIX_SEEDS[mix];
  if (!s) return null;
  return { families: s.families === "menu" ? familiesFromMenu(menu) : s.families ? { ...s.families } : null, style: [...s.style] };
}
function fromTastes(drinks) {
  const tastes = (Array.isArray(drinks) ? drinks : []).filter((t) => TASTE_HINTS[t]);
  if (!tastes.length) return null;
  const count = {}, styles = new Set();
  for (const t of tastes) {
    if (TASTE_HINTS[t].style) styles.add(TASTE_HINTS[t].style);
    for (const f of TASTE_HINTS[t].families) count[f] = (count[f] || 0) + 1;
  }
  const hinted = Object.keys(count);
  return {
    families: hinted.length >= 2 ? Object.fromEntries(QUIZ_FAMILIES.filter((q) => count[q.id]).map((q) => [q.id, count[q.id] >= 2 ? 2 : 1])) : null,
    style: styles.size ? STYLE_IDS.filter((s) => styles.has(s)) : null,
  };
}
// The template's name for "From your Match night template" (the bar style's, if renamed).
export function templateLabel(party) {
  const t = TEMPLATES.find((x) => x.mix === party?.mix && x.name === party?.name);
  return t ? t.label : MIXES[party?.mix]?.label || "party";
}

/**
 * @returns { answers, from: "saved" | "template" | "tastes" | null, reseeded }
 *   reseeded: a template was applied since the last answers — what they drink and how came from it.
 */
export function seedQuiz({ saved = null, party = null, cocktailMenu = [] } = {}) {
  const mix = MIX_SEEDS[party?.mix] ? party.mix : null;
  const tpl = mix ? fromMix(mix, cocktailMenu) : null;
  if (isObj(saved)) {
    const s = normalizeQuiz(saved);
    if (!tpl || mix === s.seededMix) return { answers: s, from: "saved", reseeded: false };
    // The generic "Mixed bar" style says nothing the host's own answer doesn't.
    if (mix === "mixed" && s.answered.includes("families")) return { answers: { ...s, seededMix: mix }, from: "saved", reseeded: false };
    return { answers: { ...s, families: tpl.families, style: tpl.style, seededMix: mix, answered: s.answered.filter((k) => k !== "families" && k !== "style") }, from: "template", reseeded: true };
  }
  const base = normalizeQuiz({});
  if (tpl) return { answers: { ...base, families: tpl.families, style: tpl.style, seededMix: mix }, from: "template", reseeded: false };
  const t = fromTastes(party?.prefs?.drinks);
  if (t && (t.families || t.style)) return { answers: { ...base, families: t.families, style: t.style || base.style }, from: "tastes", reseeded: false };
  return { answers: base, from: null, reseeded: false };
}

/**
 * Answers → what fillBar() takes (the cocktail menu's servings go to fillBar as minimums).
 * @returns { shares: { family: share }, keep: [family], auto: [family added for them], profile }
 */
export function profileFromQuiz(answers) {
  const a = normalizeQuiz(answers);
  const style = Object.fromEntries(STYLE_IDS.map((s) => [s, a.style.includes(s)]));
  let shares, keep = [];
  const auto = [];
  if (!a.families) {
    shares = { ...(style.cocktails && !style.mix && !style.sip ? COCKTAIL_SHARES : MIXES.mixed.shares) };
  } else {
    shares = {};
    for (const [id, n] of Object.entries(a.families)) {
      const w = n === 2 ? LOTS : SOME;
      if (id === "wine") { shares.redwine = (shares.redwine || 0) + 0.6 * w; shares.whitewine = (shares.whitewine || 0) + 0.4 * w; }
      else shares[id] = (shares[id] || 0) + w;
      keep.push(...QUIZ_FAMILY[id].fams);
    }
    if (style.shots && !shares.tequila && !shares.vodka) { shares.tequila = SOME; auto.push("tequila"); }
  }
  const total = Object.values(shares).reduce((s, x) => s + x, 0) || 1;
  for (const f of Object.keys(shares)) shares[f] = Math.round((shares[f] / total) * 1000) / 1000;
  keep = [...new Set(keep)];
  return { shares, keep, auto, profile: { tier: a.tier, style, origin: a.origin, favs: { ...a.favs }, variety: a.variety } };
}

// The live split under Q1: [{ id, label, emoji, color, pct }] in quiz families.
export function familySplit(answers) {
  const { shares } = profileFromQuiz(answers);
  const out = {};
  for (const [f, s] of Object.entries(shares)) { const q = quizFamilyOf(f); if (q) out[q] = (out[q] || 0) + s; }
  return QUIZ_FAMILIES.filter((q) => out[q.id] > 0).map((q) => ({ ...q, pct: Math.round(out[q.id] * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

// Livcheers categories for the families they drink (Indian whisky included — it isn't synced by default).
export function syncCatsFor(answers) {
  return [...new Set(Object.keys(profileFromQuiz(answers).shares).flatMap((f) => FAMILIES[f]?.cats || []))];
}

// Q4 only when a spirit or wine they drink has well-known bottles both ways here: `choice` =
// { family: bool } from what's synced (barScore originChoice), else the built-in guess.
export function stepsFor(answers, { choice = {} } = {}) {
  const fams = Object.keys(profileFromQuiz(answers).shares);
  const ask = fams.some((f) => originApplies(f) && (f in choice ? !!choice[f] : ORIGIN_GUESS.has(f)));
  return STEPS.filter((s) => s !== "origin" || ask);
}

// The budget: what the host picked, else what's left of the plan's budget, else the chosen tier's
// full bar, else ₹10k.
export function resolveMoney(money, { left = 0, drinkers = 0, enough = 0 } = {}) {
  const m = normalizeQuiz({ money }).money;
  const fallback = left > 0 ? left : enough > 0 ? enough : 10000;
  if (m.kind === "amount") return m.value;
  if (m.kind === "head") return drinkers > 0 ? m.value * drinkers : fallback;
  if (m.kind === "enough") return enough > 0 ? enough : fallback;
  return fallback;
}

const and = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs.at(-1)}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The answers strip on the results: one chip per answer, [{ step, label }].
export function quizSummary(answers, { amount = null, tier = null, steps = STEPS } = {}) {
  const a = normalizeQuiz(answers);
  const out = [];
  if (!a.families) out.push({ step: "families", label: "🍹 Mixed bar" });
  else {
    const ids = QUIZ_FAMILIES.filter((q) => a.families[q.id]).sort((x, y) => a.families[y.id] - a.families[x.id]);
    const lots = ids.filter((q) => a.families[q.id] === 2);
    const name = (q, i) => (i === 0 ? q.label : q.label.toLowerCase());
    const label = ids.length === 1 ? `${ids[0].label} only`
      : lots.length === 1 ? `${lots[0].label}-heavy`
      : ids.length === 2 ? and(ids.map(name))
      : `${ids.slice(0, 2).map(name).join(", ")} +${ids.length - 2}`;
    out.push({ step: "families", label: `${ids[0].emoji} ${label}` });
  }
  const st = STYLES.filter((s) => a.style.includes(s.id));
  out.push({ step: "style", label: !st.length ? "🥂 However they like"
    : st.length === 1 && st[0].id === "mix" ? "🥤 With mixers"
    : `${st[0].emoji} ${cap(and(st.slice(0, 2).map((s) => s.short)))}${st.length > 2 ? " +1" : ""}` });
  const t = a.tier === "auto" ? tier : a.tier;
  out.push({ step: "vibe", label: `✨ ${t && TIERS[t] ? TIERS[t].label : "Best for my budget"}${a.tier === "auto" && t && TIERS[t] ? " · budget's pick" : ""}` });
  if (steps.includes("origin")) { const o = ORIGINS.find((x) => x.id === a.origin); out.push({ step: "origin", label: `${o.id === "any" ? "🌐" : o.emoji} ${o.short}` }); }
  if (amount > 0) out.push({ step: "budget", label: `💰 ${fmtShort(amount)}` });
  return out;
}

// "Bacardi White Rum" → "Bacardi White", for the tight "e.g." lines.
export function shortName(name) {
  const s = String(name || "").replace(/\b(blended|scotch|whisky|whiskey|vodka|rum|gin|tequila|beer|wine|can|bottle|pint)\b/gi, "").replace(/\s+/g, " ").trim();
  return s.length >= 3 ? s : String(name || "").trim();
}

// ── Why this bottle ──────────────────────────────────────────────────────────
const NOUN = { whisky: "whisky", gin: "gin", vodka: "vodka", rum: "rum", tequila: "tequila", brandy: "brandy", beer: "beer", redwine: "red wine", whitewine: "white/rosé", bubbly: "bubbly", liqueur: "liqueur" };
const plural = (name) => { const n = name.replace(/\s*\(.*\)$/, ""); return /s$/i.test(n) ? n : `${n}s`; };

// The cocktails on the menu each family is the base spirit of: { rum: ["Mojito"] }.
export function menuByFamily(menu = []) {
  const out = {};
  for (const m of menu || []) {
    const c = m && COCKTAIL[m.id];
    if (!c || c.mocktail || !(m.servings > 0) || !c.needs.length) continue;
    (out[c.needs[0]] ||= []).push(c.name);
  }
  return out;
}

function styleReason(line, style) {
  const f = line.family, type = typeOf(line.item).toLowerCase();
  const malt = line.cat === "malts" || /single malt/i.test(line.item?.name || "");
  const spirit = ["whisky", "rum", "vodka", "gin", "brandy"].includes(f);
  const fits = {
    sip: (f === "whisky" && (malt || line.cat === "worldwhisky")) || (f === "rum" && /dark|aged|gold/.test(type)) || (f === "tequila" && /reposado|a[nñ]ejo/.test(type)) || f === "brandy",
    mix: spirit && !malt && !line.flav,
    cocktails: ["vodka", "gin", "tequila"].includes(f) || (f === "rum" && /white/.test(type)),
    shots: f === "tequila" || (line.flav && ["vodka", "rum"].includes(f)) || f === "vodka",
  };
  const text = { sip: "Made for sipping", mix: "Great with mixers", cocktails: "Good in cocktails", shots: "Good for shots" };
  const s = STYLE_IDS.find((id) => style?.[id] && fits[id]);
  return s ? text[s] : null;
}

// "Top-10 gin" only means something when the city ranks plenty of them (≥ 3 × 10) and the bottle
// sits well up Livcheers' list (≤ #300).
const PLACES = [[1, "Most popular"], [3, "Top-3"], [10, "Top-10"], [25, "Top-25"]];
const PLACE_RANK = 300, PLACE_DEPTH = 3, POPULAR_RANK = 200;

/**
 * Up to `max` short reasons for a picked bottle, never two of a kind, in this order: their usual,
 * the cocktail menu, Livcheers popularity (only for a bottle Livcheers actually ranks — a borrowed
 * or household-name rank says so), its Livcheers rating (ranked bottles only), how they drink,
 * where it's from, and the price per drink when it's the cheapest in its band (or nothing else fits).
 * @param line  a fillBar line ({ family, item, rank, from, pos, of, flav, fav, cheap, costPerDrink, cat })
 * @param ctx   { profile: { style, origin, favs }, menu: menuByFamily(cocktailMenu) }
 * @returns [{ kind, text }]
 */
export function reasonsFor(line, { profile = {}, menu = {}, max = 2 } = {}) {
  if (!line?.item) return [];
  const out = [];
  const add = (kind, text) => { if (text && out.length < max && !out.some((r) => r.kind === kind)) out.push({ kind, text }); };
  const noun = NOUN[line.family] || "bottle";
  if (line.fav || (profile.favs?.[line.family] && profile.favs[line.family] === brandKey(line.item.brand))) add("fav", "Their usual");
  const drinks = menu[line.family] || [];
  if (drinks.length) add("menu", drinks.length === 1 ? `For your ${plural(drinks[0])}` : "For your cocktail menu");
  const ranked = line.from === "own" && line.rank > 0;
  const place = ranked && line.rank <= PLACE_RANK && line.pos > 0 ? PLACES.find(([n]) => line.pos <= n && (line.of || 0) >= PLACE_DEPTH * n) : null;
  if (place) add("pop", `${place[1]} ${noun} on Livcheers`);
  else if (ranked && line.rank <= POPULAR_RANK) add("pop", "Popular on Livcheers");
  else if (line.from === "brand" && line.rank <= BRAND_KNOWN) add("pop", "Popular brand");
  else if (line.from === "staple") add("pop", "A household name");
  // A rating only for a bottle Livcheers ranks, and not right after "… on Livcheers".
  if (ranked && line.item.rating >= 4.5 && !out.some((r) => r.kind === "pop")) add("rating", `${line.item.rating}★ on Livcheers`);
  add("style", styleReason(line, profile.style));
  const imp = importedLevel(line.item);
  if (imp === 1 && line.item.origin) add("origin", `Imported · ${line.item.origin}${line.item.flag ? ` ${line.item.flag}` : ""}`);
  else if (imp < 1 && (profile.origin === "desi" || profile.origin === "imported")) add("origin", "Made in India");
  // The price per drink when it's the cheapest in its band — or when nothing else can be said.
  if ((line.cheap || !out.length) && line.costPerDrink > 0) add("price", `≈ ${fmt(line.costPerDrink)} a drink`);
  return out;
}
