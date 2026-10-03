// ═══════════════════════════════════════════════════════════════════════════════
//  DRY DAYS — days liquor shops stay shut.
//
//  India has no single list: each state's excise department notifies its own
//  (often quarterly), plus ad-hoc election bans. So the app works in tiers:
//    national — 26 Jan, 15 Aug, 2 Oct: dry in every state (certain)
//    often    — big festivals many states notify as dry (check your state)
//    state    — fixed state days (e.g. Maharashtra Day)
//    custom   — days you add yourself (e.g. an announced election ban)
//  National days repeat every year; festival dates (Hindu panchang / public
//  calendars) move, so OFTEN / STATE_DAYS cover 2026–2027 and need a yearly update.
//
//  Some closures are part-day: Haryana shuts shops and bars on 26 Jan and 15 Aug only
//  until 5 pm (Excise Policy 2025-27, 2.13.1), so those entries carry until: "17:00"
//  and still count as a shopping day in the evening.
//
//  Bars (v1.5 "Out" tab) don't always shut with the shops — barsDryOn() below:
//    Delhi    — licensed bars shut only on 26 Jan, 15 Aug and 2 Oct (Excise Rules 2010,
//               rule 52); on every other dry day only the shops do
//    Haryana  — the same days and hours as the shops (policy 2.13.1)
//    custom   — usually an election ban, which shuts bars too (RP Act 1951, s.135C)
//    elsewhere — not known, so shown as "check"
// ═══════════════════════════════════════════════════════════════════════════════

export const CITY_STATE = {
  agra: "Uttar Pradesh", asansol: "West Bengal", bangalore: "Karnataka", bhopal: "Madhya Pradesh", delhi: "Delhi",
  faridabad: "Haryana", ghaziabad: "Uttar Pradesh", goa: "Goa", gurgaon: "Haryana", gwalior: "Madhya Pradesh",
  "hubli-dharwad": "Karnataka", hyderabad: "Telangana", indore: "Madhya Pradesh", jabalpur: "Madhya Pradesh",
  jaipur: "Rajasthan", jodhpur: "Rajasthan", kanpur: "Uttar Pradesh", kolkata: "West Bengal", kota: "Rajasthan",
  lucknow: "Uttar Pradesh", mangalore: "Karnataka", mumbai: "Maharashtra", mysore: "Karnataka", nagpur: "Maharashtra",
  nashik: "Maharashtra", noida: "Uttar Pradesh", pune: "Maharashtra", thane: "Maharashtra", udaipur: "Rajasthan",
  warangal: "Telangana",
};

const NATIONAL = [["01-26", "Republic Day"], ["08-15", "Independence Day"], ["10-02", "Gandhi Jayanti"]];
// National days a state shuts only part of the day: { state: { "MM-DD": "HH:MM" it ends } }.
const PART_DAY = { Haryana: { "01-26": "17:00", "08-15": "17:00" } };
const yearOf = (iso) => Number(String(iso).slice(0, 4));

const OFTEN = [
  ["2026-10-20", "Dussehra"], ["2026-11-08", "Diwali"], ["2026-11-24", "Guru Nanak Jayanti"],
  ["2027-03-06", "Maha Shivratri"], ["2027-03-22", "Holi"], ["2027-03-26", "Good Friday"], ["2027-04-14", "Ambedkar Jayanti"],
  ["2027-04-15", "Ram Navami"], ["2027-08-25", "Janmashtami"], ["2027-10-09", "Dussehra"], ["2027-10-29", "Diwali"],
  ["2027-11-14", "Guru Nanak Jayanti"],
];

const STATE_DAYS = [
  ["2027-05-01", "Maharashtra Day", ["Maharashtra"]],
  ["2027-09-04", "Ganesh Chaturthi", ["Maharashtra", "Karnataka", "Telangana", "Goa"]],
];

export const stateOf = (citySlug) => CITY_STATE[citySlug] || null;

// Every known dry day for the city; national days for `years` (default: last year to two years out).
// A part-day closure carries until: "HH:MM" (shops and bars open again then).
export function dryDaysFor(citySlug, custom = [], years = null) {
  const state = stateOf(citySlug);
  const y = yearOf(todayISO());
  const national = (yr, md, name) => {
    const until = PART_DAY[state]?.[md];
    return until ? { date: `${yr}-${md}`, name, level: "national", until } : { date: `${yr}-${md}`, name, level: "national" };
  };
  return [
    ...(years || [y - 1, y, y + 1, y + 2]).flatMap((yr) => NATIONAL.map(([md, name]) => national(yr, md, name))),
    ...OFTEN.map(([date, name]) => ({ date, name, level: "often" })),
    ...STATE_DAYS.filter(([, , states]) => state && states.includes(state)).map(([date, name]) => ({ date, name, level: "state" })),
    ...(custom || []).filter((c) => c?.date).map((c) => ({ date: c.date, name: c.name || "Dry day", level: "custom" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

// The most serious entry for a date, or null: { date, name, level, until? }. A part-day
// closure ranks after a full-day one you added (an election ban on 26 Jan in Haryana).
const RANK = { national: 0, custom: 1, state: 2, often: 3 };
const rank = (d) => RANK[d.level] + (d.until ? 1.5 : 0);
export function dryDayOn(date, citySlug, custom = []) {
  if (!date) return null;
  const hits = dryDaysFor(citySlug, custom, [yearOf(date)]).filter((d) => d.date === date);
  return hits.sort((a, b) => rank(a) - rank(b))[0] || null;
}

// "17:00" → "5 pm";  untilText(dry) → "until 5 pm" for a part-day closure, else "".
export function clock(hhmm) {
  const t = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  if (!t) return "";
  const h = Number(t[1]), m = Number(t[2]);
  return `${h % 12 || 12}${m ? `:${t[2]}` : ""} ${h < 12 ? "am" : "pm"}`;
}
export const untilText = (dry) => (dry?.until ? `until ${clock(dry.until)}` : "");

// ── Bars on a dry day (v1.5 "Out" tab) ───────────────────────────────────────
// null when it isn't a dry day, else { dry, name, level, shopsOnly?, until? }:
//   dry true       bars are shut (until: "HH:MM" when only until then)
//   dry "check"    shops are (or may be) shut; whether bars are isn't known here
//   dry false      shopsOnly: the shops are shut, licensed bars stay open (Delhi)
const BARS_SHUT_ON_NATIONAL = ["Delhi", "Haryana"];
const barsRank = (v) => (v.dry === true ? (v.until ? 1 : 0) : v.dry === "check" ? 2 : 3);
export function barsDryOn(date, citySlug, custom = []) {
  if (!date) return null;
  const state = stateOf(citySlug);
  const verdicts = dryDaysFor(citySlug, custom, [yearOf(date)]).filter((d) => d.date === date).map((d) => {
    const v = { name: d.name, level: d.level };
    if (d.level === "custom") return { ...v, dry: true };
    if (d.level === "national" && BARS_SHUT_ON_NATIONAL.includes(state)) return d.until ? { ...v, dry: true, until: d.until } : { ...v, dry: true };
    if (state === "Delhi") return { ...v, dry: false, shopsOnly: true };
    return { ...v, dry: "check" };
  });
  return verdicts.sort((a, b) => barsRank(a) - barsRank(b) || RANK[a.level] - RANK[b.level])[0] || null;
}

// What the bars banner says for barsDryOn(): { tone: "danger"|"warn"|"ok", lead, text, check }.
// The lead is the bold part ("Fri, 2 Oct is Gandhi Jayanti"); check = offer the search link.
export function barsDryText(r, date, citySlug, today = todayISO()) {
  if (!r) return null;
  const state = stateOf(citySlug);
  const where = state ? ` in ${state}` : "";
  const named = r.level === "custom" ? `a dry day${r.name && r.name !== "Dry day" ? ` (${r.name})` : ""}` : r.name;
  const lead = `${date === today ? "Today" : prettyDate(date)} is ${named}`;
  if (r.dry === true && r.until) return { tone: "warn", lead, text: `bars and liquor shops${where} are shut until ${clock(r.until)}.`, check: false };
  if (r.dry === true) return { tone: "danger", lead, text: r.level === "custom" ? "bars are shut too, not just liquor shops." : `bars and liquor shops${where} are shut all day.`, check: false };
  if (r.shopsOnly) return { tone: "ok", lead, text: `liquor shops may be shut, but licensed bars${where} stay open.`, check: false };
  if (r.level === "national") return { tone: "warn", lead, text: "liquor shops are shut across India; bars may be too, so check.", check: true };
  return { tone: "warn", lead, text: `often a dry day${where}: shops may be shut, and bars too, so check.`, check: true };
}

// The next date of a festival in the tables above (e.g. "Diwali"), on or after `from` — for
// party templates. null once the tables run out: they need the same yearly update.
export function festivalDate(name, from = todayISO()) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  const dates = [...OFTEN, ...STATE_DAYS].filter(([date, nm]) => nm.toLowerCase() === n && date >= from).map(([date]) => date);
  return dates.sort()[0] || null;
}

export function upcomingDryDays(citySlug, custom = [], fromDate = todayISO(), n = 6) {
  const y = yearOf(fromDate);
  return dryDaysFor(citySlug, custom, [y, y + 1, y + 2]).filter((d) => d.date >= fromDate).slice(0, n);
}

export function todayISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

// Default party date: the coming Saturday (today, if it's Saturday).
export const nextSaturday = (from = todayISO()) => addDays(from, (6 - new Date(`${from}T12:00:00`).getDay() + 7) % 7);

export const prettyDate = (iso, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", opts) : "";

// "Buy by …": the last shopping day before `date` that isn't itself a dry day. A part-day
// dry day (Haryana's "until 5 pm") still is one: the shops open in the evening, so pair it
// with shopsOpenAt() — "Buy by Tue, 26 Jan (after 5 pm)", and no noon reminder that day.
export function lastShoppingDay(date, citySlug, custom = []) {
  const shutAllDay = (iso) => { const dry = dryDayOn(iso, citySlug, custom); return !!dry && !dry.until; };
  let d = addDays(date, -1);
  for (let i = 0; i < 7 && shutAllDay(d); i++) d = addDays(d, -1);
  return d;
}

// "17:00" when the shops are shut only until then that day (a part-day dry day), else null.
// null also covers a day shut all day; lastShoppingDay() never returns one of those.
export const shopsOpenAt = (iso, citySlug, custom = []) => dryDayOn(iso, citySlug, custom)?.until || null;

export const confirmUrl = (date, citySlug) =>
  `https://www.google.com/search?q=${encodeURIComponent(`dry day ${prettyDate(date, { day: "numeric", month: "long", year: "numeric" })} ${stateOf(citySlug) || ""}`)}`;

// The state's own list for the year (excise departments publish it, often quarterly).
export const stateListUrl = (citySlug, year = new Date().getFullYear()) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${stateOf(citySlug) || "India"} dry days list ${year}`)}`;

// ── Dry days you add yourself ────────────────────────────────────────────────
// Returns the same array when there's nothing to add (no date, or already listed),
// so the caller can tell a duplicate apart.
export function addCustomDry(list = [], date, name) {
  if (!date) return list;
  const entry = { date, name: String(name || "").trim() || "Dry day" };
  if ((list || []).some((d) => d?.date === entry.date && (d.name || "Dry day") === entry.name)) return list;
  return [...(list || []), entry].filter((d) => d?.date).sort((a, b) => a.date.localeCompare(b.date));
}

export const removeCustomDry = (list = [], date, name) =>
  (list || []).filter((d) => !(d?.date === date && (d.name || "Dry day") === name));
