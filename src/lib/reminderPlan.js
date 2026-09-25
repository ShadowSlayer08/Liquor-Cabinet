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
// ═══════════════════════════════════════════════════════════════════════════════
import { dryDayOn, lastShoppingDay, prettyDate, stateOf, todayISO } from "./drydays.js";
import { partyStart, partyWhen } from "./when.js";

export const BASE_ID = 8100;

// "Fri, 2 Oct is Gandhi Jayanti — liquor shops will be shut." Only national and
// your own dry days are certain; festival/state days are "often" dry (lib/drydays.js).
export function dryNote(dry, date, citySlug) {
  const d = prettyDate(date);
  if (dry.level === "national") return `${d} is ${dry.name} — liquor shops will be shut.`;
  if (dry.level === "custom") return `${d} is a dry day${dry.name && dry.name !== "Dry day" ? ` (${dry.name})` : ""} — liquor shops will be shut.`;
  return `${d} is ${dry.name} — often a dry day in ${stateOf(citySlug) || "many states"}, so shops may be shut.`;
}

// When to buy the bottles: the day before, unless the party day or the day before is dry.
function stockReminder(party, citySlug, customDry, at) {
  const dry = dryDayOn(party.date, citySlug, customDry);
  if (dry) {
    const day = lastShoppingDay(party.date, citySlug, customDry);
    return { at: new Date(`${day}T12:00:00`), body: `${dryNote(dry, party.date, citySlug)} Buy your bottles today.` };
  }
  const eveAt = at(-24 * 60 - 120), eve = todayISO(eveAt);
  const eveDry = eve !== party.date ? dryDayOn(eve, citySlug, customDry) : null;
  if (!eveDry) return { at: eveAt, body: "Pick up the bottles on your Liquor Cabinet list." };
  // Shops are shut the day before: buy on the party morning if there's time, else the last open day.
  const morning = new Date(`${party.date}T11:00:00`);
  if (morning <= at(-180)) return { at: morning, body: `${dryNote(eveDry, eve, citySlug)} Pick up your bottles this morning.` };
  const day = lastShoppingDay(eve, citySlug, customDry);
  return { at: new Date(`${day}T12:00:00`), body: `${dryNote(eveDry, eve, citySlug)} Buy your bottles today.` };
}

// Every reminder the party could use, with its fire time.
export function buildReminders(party, citySlug, customDry = [], now = Date.now()) {
  const start = partyStart(party);
  if (!start) return [];
  const at = (mins) => new Date(start.getTime() + mins * 60000);
  const stock = stockReminder(party, citySlug, customDry, at);
  const list = [
    { key: "stock", title: "🥃 Stock the bar today", body: stock.body, at: stock.at },
    { key: "chill", title: "🧊 Chill the beer & wine", body: "Into the fridge now so they're cold by party time.", at: at(-180) },
    { key: "blinkit", title: "🛒 Order mixers, ice & munchies", body: "Your Blinkit list is ready in Liquor Cabinet.", at: at(-75) },
    { key: "starters", title: "🍢 Order the starters", body: "Send your Zomato / Bistro order so it lands as guests arrive.", at: at(-40) },
  ];
  if (party.dinner) list.push({ key: "dinner", title: "🍛 Time to order dinner", body: "Mains take ~45 min — order now from your Zomato cart.", at: at(Math.max(90, (party.hours * 60) / 2 - 45)) });
  return list.map((r, i) => ({ ...r, id: BASE_ID + i, past: r.at.getTime() < now }));
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
