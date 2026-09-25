// ═══════════════════════════════════════════════════════════════════════════════
//  DRY DAYS — days liquor shops stay shut.
//
//  India has no single list: each state's excise department notifies its own
//  (often quarterly), plus ad-hoc election bans. So the app works in tiers:
//    national — 26 Jan, 15 Aug, 2 Oct: dry in every state (certain)
//    often    — big festivals many states notify as dry (check your state)
//    state    — fixed state days (e.g. Maharashtra Day)
//    custom   — days you add yourself (e.g. an announced election ban)
//  Festival dates from the Hindu panchang / public calendars (2026–2027).
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

const NATIONAL = [
  ["2026-01-26", "Republic Day"], ["2026-08-15", "Independence Day"], ["2026-10-02", "Gandhi Jayanti"],
  ["2027-01-26", "Republic Day"], ["2027-08-15", "Independence Day"], ["2027-10-02", "Gandhi Jayanti"],
  ["2028-01-26", "Republic Day"],
];

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

export function dryDaysFor(citySlug, custom = []) {
  const state = stateOf(citySlug);
  return [
    ...NATIONAL.map(([date, name]) => ({ date, name, level: "national" })),
    ...OFTEN.map(([date, name]) => ({ date, name, level: "often" })),
    ...STATE_DAYS.filter(([, , states]) => state && states.includes(state)).map(([date, name]) => ({ date, name, level: "state" })),
    ...custom.map((c) => ({ date: c.date, name: c.name || "Dry day", level: "custom" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

// The most serious entry for a date, or null.
const RANK = { national: 0, custom: 1, state: 2, often: 3 };
export function dryDayOn(date, citySlug, custom = []) {
  if (!date) return null;
  const hits = dryDaysFor(citySlug, custom).filter((d) => d.date === date);
  return hits.sort((a, b) => RANK[a.level] - RANK[b.level])[0] || null;
}

export function upcomingDryDays(citySlug, custom = [], fromDate = todayISO(), n = 6) {
  return dryDaysFor(citySlug, custom).filter((d) => d.date >= fromDate).slice(0, n);
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
