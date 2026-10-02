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
export function dryDaysFor(citySlug, custom = [], years = null) {
  const state = stateOf(citySlug);
  const y = yearOf(todayISO());
  return [
    ...(years || [y - 1, y, y + 1, y + 2]).flatMap((yr) => NATIONAL.map(([md, name]) => ({ date: `${yr}-${md}`, name, level: "national" }))),
    ...OFTEN.map(([date, name]) => ({ date, name, level: "often" })),
    ...STATE_DAYS.filter(([, , states]) => state && states.includes(state)).map(([date, name]) => ({ date, name, level: "state" })),
    ...(custom || []).filter((c) => c?.date).map((c) => ({ date: c.date, name: c.name || "Dry day", level: "custom" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

// The most serious entry for a date, or null.
const RANK = { national: 0, custom: 1, state: 2, often: 3 };
export function dryDayOn(date, citySlug, custom = []) {
  if (!date) return null;
  const hits = dryDaysFor(citySlug, custom, [yearOf(date)]).filter((d) => d.date === date);
  return hits.sort((a, b) => RANK[a.level] - RANK[b.level])[0] || null;
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

// "Buy by …": the last shopping day before `date` that isn't itself a dry day.
export function lastShoppingDay(date, citySlug, custom = []) {
  let d = addDays(date, -1);
  for (let i = 0; i < 7 && dryDayOn(d, citySlug, custom); i++) d = addDays(d, -1);
  return d;
}

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
