// ═══════════════════════════════════════════════════════════════════════════════
//  REMINDER PLAN — which reminders the party gets, and whether what's scheduled
//  on the phone still matches. Pure (no Capacitor), so node --test covers it;
//  lib/reminders.js does the actual scheduling.
//
//  App state `reminders`:
//    enabled        { [key]: false } — a reminder is on unless switched off
//    scheduledFor   "date time" the phone's reminders were last set for (null = none)
//    scheduledSig   what was set (keys + fire times), to spot changes since
//    keptFor        "date time" the user chose not to move reminders to (ask once)
//    scheduledPlace where they were set for: placeKey() — "home", "venue:<id>", "event:<slug>"
//    keptPlace      a place the user chose not to move reminders to (ask once)
//
//  A party out (v1.5, lib/outModel.js isOut) gets a different list: "Leave by" (travel time
//  from your last location fix to the pick), "Free cancellation ends" for a booked table,
//  last call from the venue's listed closing time, and settle-up as at home. The home-only
//  nudges (chill the beer, order mixers, starters and dinner on Zomato) are left out; a BYOB
//  night keeps "buy the bottles" and "chill" because you're bringing them.
//
//  Part-day dry days (Haryana's 26 Jan and 15 Aug, shut until 5 pm — lib/drydays.js): the
//  "buy today" nudge on such a day waits for the shops to open, and says so.
// ═══════════════════════════════════════════════════════════════════════════════
import { clock, dryDayOn, lastShoppingDay, prettyDate, shopsOpenAt, stateOf, todayISO, untilText } from "./drydays.js";
import { partyStart, partyWhen, prettyTime, clockOf } from "./when.js";
import { driversOf, outVenueName } from "./rides.js";
import { isOut, outPlace, kmBetween, travelMinutes } from "./outModel.js";

export const BASE_ID = 8100;

// "Fri, 2 Oct is Gandhi Jayanti — liquor shops will be shut." Only national and
// your own dry days are certain; festival/state days are "often" dry (lib/drydays.js).
// A part-day closure says when the shops open: "… liquor shops in Haryana will be shut until 5 pm."
export function dryNote(dry, date, citySlug) {
  const d = prettyDate(date);
  const state = stateOf(citySlug);
  if (dry.level === "national" && dry.until) return `${d} is ${dry.name} — liquor shops${state ? ` in ${state}` : ""} will be shut ${untilText(dry)}.`;
  if (dry.level === "national") return `${d} is ${dry.name} — liquor shops will be shut.`;
  if (dry.level === "custom") return `${d} is a dry day${dry.name && dry.name !== "Dry day" ? ` (${dry.name})` : ""} — liquor shops will be shut.`;
  return `${d} is ${dry.name} — often a dry day in ${state || "many states"}, so shops may be shut.`;
}

// "Buy your bottles today" on the last open day: at noon, or when the shops open on a part-day
// dry day (a noon nudge on Haryana's 26 Jan would find them shut until 5 pm).
function buyOn(day, note, citySlug, customDry) {
  const opens = shopsOpenAt(day, citySlug, customDry);
  return { at: new Date(`${day}T${opens || "12:00"}:00`), body: `${note} Buy your bottles today${opens ? ` after ${clock(opens)}` : ""}.` };
}

// When to buy the bottles: the day before, unless the party day or the day before is dry.
// A part-day closure the day before that's over by then (shut until 5 pm, nudge at 6) is no bar.
function stockReminder(party, citySlug, customDry, at) {
  const dry = dryDayOn(party.date, citySlug, customDry);
  if (dry) return buyOn(lastShoppingDay(party.date, citySlug, customDry), dryNote(dry, party.date, citySlug), citySlug, customDry);
  const eveAt = at(-24 * 60 - 120), eve = todayISO(eveAt);
  const eveDry = eve !== party.date ? dryDayOn(eve, citySlug, customDry) : null;
  if (!eveDry || (eveDry.until && clockOf(eveAt) >= eveDry.until)) return { at: eveAt, body: "Pick up the bottles on your Liquor Cabinet list." };
  // Shops are shut the day before: buy on the party morning if there's time, else the last open day.
  const morning = new Date(`${party.date}T11:00:00`);
  if (morning <= at(-180)) return { at: morning, body: `${dryNote(eveDry, eve, citySlug)} Pick up your bottles this morning.` };
  return buyOn(lastShoppingDay(eve, citySlug, customDry), dryNote(eveDry, eve, citySlug), citySlug, customDry);
}

// When the party ends, and last call 45 min before that — null without a date, and no last
// call for a party so short it would fall in the first hour. Hours as planParty clamps them.
export function partyEnd(party) {
  const start = partyStart(party);
  if (!start) return null;
  const hours = Math.min(12, Math.max(1, Number(party.hours) || 4));
  return new Date(start.getTime() + hours * 3600000);
}
export function lastCallAt(party) {
  const start = partyStart(party), end = partyEnd(party);
  if (!end) return null;
  const at = new Date(end.getTime() - 45 * 60000);
  return at.getTime() - start.getTime() >= 60 * 60000 ? at : null;
}

// Settle up the morning after: the first 11 am after the party ends, and never sooner than
// 2 h after the end (a 12-hour night that ends at 10 am gets its nudge at noon).
export function settleAt(party) {
  const end = partyEnd(party);
  if (!end) return null;
  const eleven = new Date(end);
  eleven.setHours(11, 0, 0, 0);
  if (eleven <= end) eleven.setDate(eleven.getDate() + 1);
  return new Date(Math.max(eleven.getTime(), end.getTime() + 2 * 3600000));
}

// ── A party out (v1.5) ───────────────────────────────────────────────────────

// A night you bring your own bottles to, decided by the pick, not by whichever outing-type chip
// is on now (out.kind — tapping BYOB to browse doesn't turn a club night into one): a venue
// picked off the BYOB list (pick.kind, from the Out tab's venuePick) or one District lists as
// BYOB. lib/out.js isByobPick says the same, so the Out tab and the Plan cards agree.
export const byobNight = (out) => isOut(out) && out.pick.type === "venue"
  && (out.pick.kind === "byob" || (out.pick.tags || []).some((t) => /\bbyob\b/i.test(String(t))));

// The Out tab's "Your night out" card (OutTab gives it this id).
const nightOut = () => ({ tab: "out", card: "night-out" });

// A last location fix further than this from the venue is probably not where you'll set off.
export const LEAVE_MAX_KM = 50;

// When to set off for the picked place: the start minus the travel time from your last location
// fix (outModel.travelMinutes), on a 5-minute mark. null without both pins, or when they're
// implausibly far apart. { at, minutes, km, place }
export function leaveBy(party, out, loc) {
  const start = partyStart(party), place = outPlace(out);
  const km = kmBetween(loc, place);
  if (!start || km == null || km > LEAVE_MAX_KM) return null;
  const minutes = travelMinutes(km);
  const at = new Date(start.getTime() - minutes * 60000);
  at.setMinutes(Math.floor(at.getMinutes() / 5) * 5, 0, 0);
  return { at, minutes, km, place: place.label };
}

// The venue's listed closing time ("HH:MM", lib/parse/district.js closingTime) on the party
// night: the first one after the start, so "01:30" for an 8 pm party is 1:30 the next morning.
// null when it isn't listed, or when it's more than 12 h on (a listing for another shift).
export function closesAt(party, closes) {
  const start = partyStart(party);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(closes || "").trim());
  if (!start || !m || Number(m[1]) > 24 || Number(m[2]) > 59) return null;
  const at = new Date(start);
  at.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (at <= start) at.setDate(at.getDate() + 1);
  return at.getTime() - start.getTime() <= 12 * 3600000 ? at : null;
}

// Last call on the night: 45 min before the venue's listed closing time when the party is out
// and the hours say; otherwise 45 min before the party's own end (lastCallAt). The same
// first-hour rule applies.
export function lastCallFor(party, out) {
  const close = isOut(out) ? closesAt(party, out.pick.closes) : null;
  if (!close) return lastCallAt(party);
  const at = new Date(close.getTime() - 45 * 60000);
  return at.getTime() - partyStart(party).getTime() >= 60 * 60000 ? at : null;
}

// District refunds a table booking cancelled at least 24 h ahead (never the convenience fee).
export const freeCancelUntil = (party) => {
  const start = partyStart(party);
  return start ? new Date(start.getTime() - 24 * 3600000) : null;
};

function lastCallBody(drivers, intro = "Put out water and soft drinks") {
  return `${intro}, and sort rides home${drivers ? ` (${drivers} driving tonight)` : ""}.`;
}

const settleReminder = (party) => ({
  key: "settle", title: "🧾 Settle up",
  body: "Enter what everyone actually paid. Liquor Cabinet works out who owes whom.",
  at: settleAt(party),
});

// The night-out list, in time order.
//  cancel   — a booked table: 2 h before free cancellation ends (24 h before the start), so
//             there's still time to act. Venues only: event tickets follow the organiser's terms.
//  stock    — BYOB only: buy the bottles you're bringing (dry days as at home)
//  chill    — BYOB only
//  leave    — "Leave by": start − travel time (leaveBy); none without a location fix
//  winddown — last call, from the venue's closing time when listed (lastCallFor)
//  settle   — the morning after, as at home
function outReminders(party, citySlug, customDry, out, loc, at) {
  const p = out.pick;
  const place = outVenueName(out) || "the venue";
  const list = [];
  if (out.booked && p.type === "venue") {
    list.push({
      key: "cancel", title: `⏳ Free cancellation ends at ${prettyTime(clockOf(freeCancelUntil(party)))}`,
      body: `District refunds a table cancelled at least 24 hours ahead, but not the convenience fee. Plans changed? Cancel in District before then.`,
      at: at(-26 * 60),
    });
  }
  if (byobNight(out)) {
    const stock = stockReminder(party, citySlug, customDry, at);
    list.push({ key: "stock", title: "🍾 Buy the bottles you're bringing", body: stock.body, at: stock.at });
    list.push({ key: "chill", title: "🧊 Chill the beer & wine", body: `Into the fridge now so they're cold when you get to ${place}.`, at: at(-180), extra: nightOut() });
  }
  const leave = leaveBy(party, out, loc);
  if (leave) {
    list.push({
      key: "leave", title: `🚕 Leave by ${prettyTime(clockOf(leave.at))}`,
      body: `About ${leave.minutes} min to ${place}. ${p.type === "event" ? "Be on time, and carry ID: the door checks." : "Be on time — the venue may give away a late table."}`,
      at: leave.at,
    });
  }
  const lastCall = lastCallFor(party, out);
  if (lastCall) {
    const close = closesAt(party, p.closes);
    list.push({
      key: "winddown", title: "🚕 Last call in 45 minutes",
      body: `${close ? `${place} closes at ${prettyTime(clockOf(close))} (listed hours). ` : ""}${lastCallBody(driversOf(party), "Order water, settle the tab")}`,
      at: lastCall,
    });
  }
  list.push(settleReminder(party));
  return list.sort((a, b) => a.at - b.at);
}

// Every reminder the party could use, with its fire time. New ones are appended, so the
// earlier ones keep their ids; there are at most 7, inside the 12 cancelReminders clears.
//  winddown — last call, 45 min before the end (lastCallAt)
//  settle   — the morning after (settleAt): enter the actual bills, see who owes whom
// `out` / `loc` (v1.5): a party out gets the night-out list above (at most 6 reminders).
export function buildReminders(party, citySlug, customDry = [], now = Date.now(), { out = null, loc = null } = {}) {
  const start = partyStart(party);
  if (!start) return [];
  const at = (mins) => new Date(start.getTime() + mins * 60000);
  const numbered = (list) => list.map((r, i) => ({ ...r, id: BASE_ID + i, past: r.at.getTime() < now }));
  if (isOut(out)) return numbered(outReminders(party, citySlug, customDry, out, loc, at));
  const stock = stockReminder(party, citySlug, customDry, at);
  const list = [
    { key: "stock", title: "🥃 Stock the bar today", body: stock.body, at: stock.at },
    { key: "chill", title: "🧊 Chill the beer & wine", body: "Into the fridge now so they're cold by party time.", at: at(-180) },
    { key: "blinkit", title: "🛒 Order mixers, ice & munchies", body: "Your Blinkit list is ready in Liquor Cabinet.", at: at(-75) },
    { key: "starters", title: "🍢 Order the starters", body: "Send your Zomato / Bistro order so it lands as guests arrive.", at: at(-40) },
  ];
  if (party.dinner) list.push({ key: "dinner", title: "🍛 Time to order dinner", body: "Mains take ~45 min — order now from your Zomato cart.", at: at(Math.max(90, (party.hours * 60) / 2 - 45)) });
  const lastCall = lastCallAt(party);
  if (lastCall) list.push({ key: "winddown", title: "🚕 Last call in 45 minutes", body: lastCallBody(driversOf(party)), at: lastCall });
  list.push(settleReminder(party));
  return numbered(list);
}

// Where a reminder's tap lands (lib/reminders.js puts it in the notification's `extra`;
// App's onChecklistTap reads it): the bottles list, a Plan card, the settle-up sheet, the
// Out tab's night-out card for "Leave by" and free cancellation, else Food. A reminder can
// carry its own `extra` (a BYOB night's "chill" goes to the Out tab, not Food).
export function reminderExtra(key) {
  if (key === "stock") return { tab: "cart", view: "liquor" };
  if (key === "winddown") return { tab: "plan", card: "rides" };
  if (key === "settle") return { tab: "plan", card: "settle" };
  if (key === "leave" || key === "cancel") return nightOut();
  return { tab: "food" };
}

export const isOn = (enabled, key) => (enabled || {})[key] !== false;

// Switched-on reminders with their fire times — changes when a toggle, the
// party's hours, dinner or a dry day moves something.
export const reminderSig = (list, enabled) => list.filter((r) => isOn(enabled, r.key)).map((r) => `${r.key}@${r.at.getTime()}`).join("|");

// Where the phone's reminders stand against the current plan.
//  scheduled — reminders are set for a party that hasn't passed yet
//  moved     — …but the party's date/time has changed since
//  dirty     — same time, but toggles/hours/dinner changed since
//  ask       — moved, and the user hasn't said "keep" for this new time
// A party whose date has passed is over (App rolls its date on), so its reminders don't count.
// `list` (buildReminders) is only needed for `dirty`.
export function reminderState(reminders, party, list = null, today = todayISO()) {
  const r = reminders || {};
  const when = partyWhen(party);
  const scheduled = typeof r.scheduledFor === "string" && r.scheduledFor.slice(0, 10) >= today;
  const moved = scheduled && r.scheduledFor !== when;
  const dirty = scheduled && !moved && !!list && r.scheduledSig != null && r.scheduledSig !== reminderSig(list, r.enabled);
  const ask = moved && !!when && r.keptFor !== when;
  return { when, scheduled, moved, dirty, ask };
}

// Where the party is, for reminders: "home", "venue:<resId>" or "event:<slug>".
export function placeKey(out) {
  if (!isOut(out)) return "home";
  const p = out.pick;
  return p.type === "event" ? `event:${p.slug || p.name}` : `venue:${p.resId ?? p.slug ?? p.name}`;
}

// Reminders set for one place while the party is now somewhere else (home ↔ out, or another
// venue): ask once per new place, like a date change (`state` = reminderState; a date change
// asks first). Reminders set before v1.5 were for home.
export function placeState(reminders, out, state) {
  const r = reminders || {};
  const place = placeKey(out);
  const changed = !!state?.scheduled && !state.moved && (r.scheduledPlace || "home") !== place;
  return { place, changed, ask: changed && r.keptPlace !== place };
}
