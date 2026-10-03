// ═══════════════════════════════════════════════════════════════════════════════
//  AGE, BYOB & BAR HOURS — the rules a night out must respect, per state.
//  India has no single drinking age: each state's excise law sets it (18 to 25),
//  bars check ID, and BYOB is regulated differently in each state. Every entry
//  carries a source and a `checked` date, and needs the same yearly look as the
//  dry days (lib/drydays.js). Shown as information, never as legal advice.
//  Pure (no Capacitor), so node --test covers it.
//
//  status "confirmed" = read in the statute, rules or policy itself;
//         "likely"    = secondary sources only, so the copy says "reportedly".
//  All 30 Livcheers cities fall in the 10 states below (CITY_STATE in drydays.js).
// ═══════════════════════════════════════════════════════════════════════════════
import { stateOf, todayISO } from "./drydays.js";

export const AGE_LINE = "For adults of legal drinking age (18 to 25, depending on the state)";
export const RULES_CHECKED = "2026-10";
export const RULES_NOTE = "From each state's excise law or policy as of Oct 2026. Information, not legal advice; the venue has the final word on entry.";
const CARRY_ID = "Carry ID: bars and clubs check.";

// beer: a lower age for beer and wine, where the state has one. permit: drinking also needs
// a personal permit. spiritsOnly: the law read gives the age for spirits; beer isn't clear.
// Delhi: a Sep 2025 panel weighed 21 for beer; not adopted as far as we found. Recheck yearly.
export const STATE_AGE = {
  Delhi: { age: 25, source: "Delhi Excise Act 2009 s.23; Excise Rules 2010 rule 20 (upheld by the Delhi High Court, 2019)", status: "confirmed", note: "25 for beer and wine too." },
  Haryana: { age: 21, source: "Haryana Excise (Amendment) Act 2021; Excise Policy 2025-27", status: "confirmed", note: "" },
  "Uttar Pradesh": { age: 21, source: "UP Excise Act 1910 s.22", status: "confirmed", note: "" },
  Maharashtra: { age: 25, beer: 21, permit: true, source: "Maharashtra Prohibition Act 1949 (secondary sources)", status: "likely", note: "Reportedly 21 for beer and wine, and drinking needs a personal permit." },
  Karnataka: { age: 21, source: "Karnataka Excise Licences (General Conditions) Rules, rule 10(1)(e); the Act itself says 18", status: "confirmed", note: "The Act says 18; the licence rules say 21." },
  Telangana: { age: 21, source: "Telangana (AP) Excise Act 1968 s.36(1)(g)", status: "confirmed", note: "" },
  "West Bengal": { age: 21, spiritsOnly: true, source: "Bengal Excise Act 1909 s.51(1)(c)", status: "likely", note: "21 for spirits; the age for beer isn't clear." },
  Rajasthan: { age: 18, source: "Rajasthan Excise Act 1950 s.22(1)(a)", status: "confirmed", note: "" },
  "Madhya Pradesh": { age: 21, source: "MP Excise Act 1915 s.23", status: "confirmed", note: "" },
  Goa: { age: 21, source: "Goa Excise Duty Act 1964 s.19(a) (raised from 18 in 1976)", status: "confirmed", note: "" },
};

/** @returns {{ state: string, age: number, beer?: number, permit?: boolean, spiritsOnly?: boolean, note: string, source: string, checked: string, status: string }|null} */
export function ageFor(citySlug) {
  const state = stateOf(citySlug);
  const a = state && STATE_AGE[state];
  return a ? { state, ...a, checked: RULES_CHECKED } : null;
}

// "21", "reportedly 25 for spirits, 21 for beer and wine, plus a drinking permit".
export function ageText(a) {
  if (!a) return "";
  let t = a.beer ? `${a.age} for spirits, ${a.beer} for beer and wine` : a.spiritsOnly ? `${a.age} for spirits` : String(a.age);
  if (a.permit) t += ", plus a drinking permit";
  return a.status === "confirmed" ? t : `reportedly ${t}`;
}

// The Out tab's age strip: "Legal drinking age in Haryana: 21. Carry ID: bars and clubs check."
export function ageLine(citySlug) {
  const a = ageFor(citySlug);
  return a ? `Legal drinking age in ${a.state}: ${ageText(a)}. ${CARRY_ID}` : `${AGE_LINE}. ${CARRY_ID}`;
}

// The states grouped by age, youngest first, for the legal notice: [{ age, states: [{ state, text }] }].
export function ageSummary() {
  const groups = new Map();
  for (const [state, a] of Object.entries(STATE_AGE)) {
    if (!groups.has(a.age)) groups.set(a.age, []);
    groups.get(a.age).push({ state, text: a.beer ? `${state} (${a.beer} for beer and wine)` : state, likely: a.status !== "confirmed" });
  }
  return [...groups].sort(([x], [y]) => x - y).map(([age, states]) => ({ age, states }));
}

// ── BYOB ─────────────────────────────────────────────────────────────────────
// Corkage is never a number from us: the venue sets it.
export const BYOB_RULES = {
  Delhi: {
    text: "Delhi doesn't allow liquor to be taken into a place that serves food or drink unless it's licensed for drinking. The BYOB places listed are in nearby NCR towns, where their own state's rules apply, so check with the venue.",
    source: "Delhi Excise Rules 2010, rule 12(b)", status: "confirmed",
  },
  Haryana: {
    text: "In Haryana, a BYOB place is a licensed tavern next to a liquor shop. It doesn't sell or serve liquor, and can't have live music or dancing.",
    source: "Haryana Excise Policy 2025-27, §1.4 (in force to 31 Mar 2027)", status: "confirmed", until: "2027-03-31",
  },
  Maharashtra: {
    text: "Drinking in Maharashtra reportedly needs a personal permit and a licensed place. Check with the venue.",
    source: "Maharashtra Prohibition Act 1949 (secondary sources)", status: "likely",
  },
};
const BYOB_DEFAULT = { text: "BYOB rules vary. Check with the venue that it's allowed.", source: "", status: "unknown" };

/** @returns {{ state: string, text: string, source: string, status: string, checked: string, until?: string }|null} */
export function byobRule(citySlug, on = todayISO()) {
  const state = stateOf(citySlug) || "";
  const r = BYOB_RULES[state] || BYOB_DEFAULT;
  // A rule with an end date (Haryana's policy year) gets a nudge once it may have changed —
  // by today's date by default, so an install that isn't updated still says so.
  const stale = r.until && on && on > r.until;
  const text = stale ? `${r.text} That policy ran to ${r.until.slice(0, 4)}, so it may have changed.` : r.text;
  return { state, ...r, text, checked: RULES_CHECKED };
}

// ── Usual bar hours ──────────────────────────────────────────────────────────
// Only ever shown as "usually": the venue's own listed hours win. Keyed by city slug first,
// then state. close = the usual closing time, "HH:MM" (after midnight = that night).
export const BAR_HOURS = {
  Haryana: { close: "00:00", text: "Bars in Haryana usually close at midnight; in Gurugram and Faridabad many stay open to 2 am or later with a paid extension.", source: "Haryana Excise Policy 2025-27, 9.8.8", status: "confirmed" },
  Delhi: { close: "01:00", text: "Restaurant bars in Delhi usually close at 1 am (reportedly).", source: "L-17 licence hours (secondary sources)", status: "likely" },
  mumbai: { close: "01:30", text: "Bars in Mumbai usually close at 1:30 am (reportedly).", source: "Secondary sources (2020)", status: "likely" },
  pune: { close: "01:30", text: "Bars in Pune usually close at 1:30 am (reportedly).", source: "Secondary sources", status: "likely" },
  bangalore: { close: "01:00", text: "Bars and clubs in Bengaluru usually close at 1 am, microbrewery pubs at 11:30 pm (reportedly).", source: "Karnataka Government Order of 29 Jul 2024 (secondary sources)", status: "likely" },
  Goa: { close: "23:00", text: "Bars in Goa usually close at 11 pm, later with a paid extension.", source: "Goa Excise Duty Rules, rule 99", status: "confirmed" },
};

/** @returns {{ text: string, close: string, source: string, status: string, checked: string }|null} "usually closes …" — the venue's own hours win */
export function usualClose(citySlug) {
  const h = BAR_HOURS[citySlug] || BAR_HOURS[stateOf(citySlug)];
  return h ? { ...h, checked: RULES_CHECKED } : null;
}
