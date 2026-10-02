// ═══════════════════════════════════════════════════════════════════════════════
//  PARTY TEMPLATES  (pure — unit-tested)
//
//  Setting up a party means touching about ten controls across Food and Bar. A
//  template sets the sensible ones in one tap — date, time, hours, who's drinking,
//  dinner or snacks, the bar style the budget optimiser starts from (party.mix)
//  and a suggested cocktail + mocktail menu — and everything stays editable.
//  It never touches the carts, and keeps the host, UPI id, guests (unless the
//  template is about guest count), designated drivers and the guests' tastes.
//  Festival dates come from lib/drydays.js, so a Diwali party also brings up the
//  dry-day warning and "buy by" day; those tables cover 2026–27 and need the same
//  yearly update. Cocktail ids the app doesn't know (yet) are skipped.
// ═══════════════════════════════════════════════════════════════════════════════
import { COCKTAIL } from "./cocktails.js";
import { DEFAULT_PARTY, planParty } from "./food.js";
import { dryDayOn, festivalDate, lastShoppingDay, prettyDate, todayISO } from "./drydays.js";
import { MIXES } from "./optimise.js";

// date: "festival:<name in drydays.js>" | "MM-DD" (the next one) | absent (keep the party's date).
// `party` holds only what the template has an opinion on; `what` reads "Set up {what}?".
export const TEMPLATES = [
  { id: "cricket", label: "Match night", emoji: "🏏", name: "Match night", what: "a match night",
    party: { time: "19:30", hours: 4, dinner: false, drinkersPct: 90, appetite: "hungry" },
    menu: ["highball", "shandy", "masala-cola"], mix: "whisky" },
  { id: "diwali", label: "Diwali", emoji: "🪔", name: "Diwali party", what: "a Diwali party", date: "festival:Diwali",
    party: { time: "20:00", hours: 5, dinner: true, vegPct: 70, drinkersPct: 70 },
    menu: ["whisky-sour", "sangria", "roohafza-cooler"], mix: "mixed" },
  { id: "nye", label: "New Year's Eve", emoji: "🎆", name: "New Year's Eve", what: "a New Year's Eve party", date: "12-31",
    party: { time: "21:00", hours: 5, dinner: true },
    menu: ["mimosa", "mojito", "virgin-mojito"], mix: "mixed" },
  { id: "birthday", label: "Birthday", emoji: "🎂", name: "Birthday party", what: "a birthday party",
    party: { hours: 4, dinner: true },
    menu: ["cosmo", "pina-colada", "virgin-colada"], mix: "menu" },
  { id: "dinner", label: "Dinner party", emoji: "🍽️", name: "Dinner party", what: "a dinner party",
    party: { guests: 6, time: "20:00", hours: 3, dinner: true, drinkersPct: 100 },
    menu: ["sangria", "spritzer"], mix: "beerwine" },
  { id: "game", label: "Game night", emoji: "🎲", name: "Game night", what: "a game night",
    party: { hours: 4, dinner: false, drinkersPct: 80, appetite: "regular" },
    menu: ["rum-coke", "gnt", "masala-cola"], mix: "mixed" },
  { id: "holi", label: "Holi brunch", emoji: "🎨", name: "Holi brunch", what: "a Holi brunch", date: "festival:Holi",
    party: { time: "11:00", hours: 5, dinner: false, vegPct: 80, drinkersPct: 70, appetite: "hungry" },
    menu: ["shandy", "screwdriver", "shikanji", "orange-fizz"], mix: "light" },
];
export const TEMPLATE = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

const yearOf = (iso) => Number(String(iso).slice(0, 4));

// When a template's date falls: an ISO date, or null (no date, or a festival past the tables).
export function templateDate(tpl, today = todayISO()) {
  const d = tpl?.date;
  if (!d) return null;
  if (d.startsWith("festival:")) return festivalDate(d.slice(9), today);
  if (!/^\d{2}-\d{2}$/.test(d)) return null;
  const y = yearOf(today);
  return `${y}-${d}` >= today ? `${y}-${d}` : `${y + 1}-${d}`;
}

// The chips row: a dated template coming up within `soonDays` goes first (soonest first),
// then the rest in their listed order.
export function orderTemplates(today = todayISO(), soonDays = 60) {
  const until = (t) => {
    const d = templateDate(t, today);
    return d ? (new Date(`${d}T12:00:00`) - new Date(`${today}T12:00:00`)) / 864e5 : Infinity;
  };
  const soon = TEMPLATES.filter((t) => until(t) <= soonDays).sort((a, b) => until(a) - until(b));
  return [...soon, ...TEMPLATES.filter((t) => !soon.includes(t))];
}

// The template's menu as [{ id, servings }]: half the planned drinks spread over its cocktails,
// half the non-drinkers' drinks over its mocktails, at least one each. Unknown ids are skipped.
export function templateMenu(tpl, party) {
  const ids = [...new Set((tpl?.menu || []).filter((id) => COCKTAIL[id]))];
  const cocktails = ids.filter((id) => !COCKTAIL[id].mocktail), mocktails = ids.filter((id) => COCKTAIL[id].mocktail);
  const plan = planParty(party, [], []);
  const notDrinking = plan.nonDrinkers ?? Math.max(0, plan.guests - plan.drinkers);
  const each = (total, n) => Math.max(1, Math.round((total * 0.5) / n));
  return [
    ...cocktails.map((id) => ({ id, servings: each(plan.needed, cocktails.length) })),
    ...mocktails.map((id) => ({ id, servings: each(notDrinking * plan.perDrinker, mocktails.length) })),
  ];
}

/**
 * @param party        the current party (App state)
 * @param cocktailMenu the current menu [{ id, servings }]
 * @param tpl          a TEMPLATES entry (or its id)
 * @param today        ISO date, for festival / MM-DD dates
 * @param replaceMenu  swap the cocktail menu for the template's (otherwise it's left alone)
 * @returns { party, cocktailMenu, note } — note is set when the template's date couldn't be worked out
 */
export function applyTemplate({ party, cocktailMenu = [], tpl, today = todayISO(), replaceMenu = false } = {}) {
  const t = typeof tpl === "string" ? TEMPLATE[tpl] : tpl;
  const cur = { ...DEFAULT_PARTY, ...(party || {}) };
  if (!t) return { party: cur, cocktailMenu: cocktailMenu || [], note: null };
  const next = { ...cur, ...t.party, name: t.name, mix: MIXES[t.mix] ? t.mix : null };
  // Who's coming and how they pay stays the host's: only a template about guest count changes it.
  for (const k of ["host", "upi", "drivers", "prefs", "pegMl"]) if (k in cur) next[k] = cur[k];
  if (!("guests" in (t.party || {}))) next.guests = cur.guests;

  let note = null;
  if (t.date) {
    const d = templateDate(t, today);
    if (d) next.date = d;
    else note = "Festival dates need a yearly update — pick the date yourself";
  }
  const menu = replaceMenu ? templateMenu(t, next) : cocktailMenu || [];
  return { party: next, cocktailMenu: menu, note };
}

// What the confirm sheet lists: the party fields that would change, in plain words.
const SHOW = [
  ["date", "Date", (v) => prettyDate(v)],
  ["time", "Time", (v) => v],
  ["guests", "Guests", (v) => String(v)],
  ["hours", "Hours", (v) => `${v} h`],
  ["drinkersPct", "Drinking", (v) => `${v}%`],
  ["vegPct", "Vegetarian", (v) => `${v}%`],
  ["appetite", "Appetite", (v) => v[0].toUpperCase() + v.slice(1)],
  ["dinner", "Food", (v) => (v ? "Dinner" : "Snacks only")],
  ["mix", "Bar style", (v) => MIXES[v]?.label || "—"],
];
export function templateChanges(before, after) {
  return SHOW.filter(([k]) => after?.[k] != null && after[k] !== before?.[k])
    .map(([k, label, f]) => ({ key: k, label, from: before?.[k] != null ? f(before[k]) : "—", to: f(after[k]) }));
}

// The toast after applying: when it is, and the dry-day "buy by" day if the date is one.
export function templateToast({ party, note }, citySlug, custom = []) {
  if (note) return `${party.name} set up. ${note}.`;
  const when = `${party.name} set for ${prettyDate(party.date)}`;
  const dry = dryDayOn(party.date, citySlug, custom);
  if (!dry) return `${when} 🎉`;
  const certain = dry.level === "national" || dry.level === "custom";   // festival and state days vary
  const by = lastShoppingDay(party.date, citySlug, custom);
  return `${when} — it's ${certain ? "" : "often "}a dry day, buy bottles by ${prettyDate(by)}`;
}
