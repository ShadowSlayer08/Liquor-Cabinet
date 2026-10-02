// ═══════════════════════════════════════════════════════════════════════════════
//  GUESTS' TASTES  (pure — unit-tested)
//
//  party.prefs = { drinks, cuisines, spice, avoid, jain } (DEFAULT_PREFS in food.js)
//  is edited in GuestPrefs.jsx and read by the food and drink suggestions. Saved
//  plans come from older versions or other tracks' templates, so everything here
//  takes whatever shape it's given and hands back a clean one.
// ═══════════════════════════════════════════════════════════════════════════════
import { DEFAULT_PREFS } from "./food.js";
import { CUISINES, PROTEINS, SPICE } from "./dishes.js";

const ids = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x))] : []);

export function normalizePrefs(prefs) {
  const p = prefs && typeof prefs === "object" ? prefs : {};
  return {
    ...DEFAULT_PREFS,
    ...p,
    drinks: ids(p.drinks),
    cuisines: ids(p.cuisines),
    spice: SPICE[p.spice] ? p.spice : DEFAULT_PREFS.spice,
    avoid: ids(p.avoid).filter((a) => a !== "veg"), // "no veg" would hide every veg dish
    jain: p.jain === true,
  };
}

// What guests can say nobody eats (the "Nobody eats…" chips): the usual ones first.
const AVOID_ORDER = ["mutton", "seafood", "egg", "chicken", "paneer"];
export const AVOIDABLE = [...new Set([...AVOID_ORDER, ...Object.keys(PROTEINS)])].filter((k) => PROTEINS[k] && k !== "veg");

// Adds or removes one id in a list field ("drinks", "cuisines", "avoid").
export function togglePref(prefs, key, id) {
  const p = normalizePrefs(prefs);
  const list = p[key] || [];
  return { ...p, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
}

export const hasPrefs = (prefs) => {
  const p = normalizePrefs(prefs);
  return !!(p.drinks.length || p.cuisines.length || p.avoid.length || p.jain || p.spice !== DEFAULT_PREFS.spice);
};

// ── Drink-vibe chips ─────────────────────────────────────────────────────────
// Cocktail tags come from lib/cocktails.js (TAGS). Today that's an array of strings; accept
// [{ id, label, emoji }] or { id: label | { label, emoji } } too, so new tags just show up.
const TAG_EMOJI = {
  classic: "🎩", easy: "👌", strong: "💪", refreshing: "🧊", party: "🎉", sweet: "🍬", warm: "☕", winter: "☕",
  light: "🌤️", brunch: "🥞", dessert: "🍮", "make-ahead": "⏱️", mocktail: "🍹", fruity: "🍓",
  tropical: "🍍", sour: "🍋", spicy: "🌶️", fizzy: "🫧", bitter: "🍊", creamy: "🥛", desi: "🪔", festive: "🎆",
};
const titleCase = (s) => { const t = String(s).replace(/[-_]+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

export function tagOptions(tags) {
  let list = [];
  if (Array.isArray(tags)) {
    list = tags.map((t) => (typeof t === "string" ? { id: t } : t && typeof t === "object" ? { ...t, id: t.id ?? t.tag ?? t.key } : null));
  } else if (tags && typeof tags === "object") {
    list = Object.entries(tags).map(([id, v]) => (typeof v === "string" ? { id, label: v } : { ...(v && typeof v === "object" ? v : {}), id }));
  }
  const seen = new Set();
  return list
    .filter((t) => t && typeof t.id === "string" && t.id && !seen.has(t.id) && seen.add(t.id))
    .map((t) => ({ id: t.id, label: typeof t.label === "string" && t.label ? t.label : titleCase(t.id), emoji: t.emoji || TAG_EMOJI[t.id] || "" }));
}

// ── One-line summary (the collapsed "Guests like…" row, the Food tab's hint) ─────
// "Refreshing & classic drinks · Chinese & street food · mild · no mutton or egg · Jain"
const and = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs.at(-1)}`);

export function prefsSummary(prefs, { tags = null, drinks = true } = {}) {
  const p = normalizePrefs(prefs);
  const tagLabel = Object.fromEntries(tagOptions(tags).map((t) => [t.id, t.label]));
  const parts = [];
  if (drinks && p.drinks.length) parts.push(`${and(p.drinks.map((id) => (tagLabel[id] || titleCase(id)).toLowerCase()))} drinks`);
  const cuisines = p.cuisines.filter((c) => CUISINES[c]).map((c) => CUISINES[c].noun || CUISINES[c].label);
  if (cuisines.length) parts.push(and(cuisines));
  if (p.spice !== DEFAULT_PREFS.spice) parts.push(p.spice === "hot" ? "spicy" : SPICE[p.spice].label.toLowerCase());
  const avoid = p.avoid.filter((a) => PROTEINS[a] && a !== "veg").map((a) => (PROTEINS[a].noun || PROTEINS[a].label).toLowerCase());
  if (avoid.length) parts.push(`no ${avoid.length > 1 ? `${avoid.slice(0, -1).join(", ")} or ${avoid.at(-1)}` : avoid[0]}`);
  if (p.jain) parts.push("Jain");
  const s = parts.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
