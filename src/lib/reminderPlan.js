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
import { dryDayOn, lastShoppingDay, prettyDate, todayISO } from "./drydays.js";
import { partyStart, partyWhen } from "./when.js";

export const BASE_ID = 8100;

// Every reminder the party could use, with its fire time.
export function buildReminders(party, citySlug, customDry = []) {
  const start = partyStart(party);
  if (!start) return [];
  const at = (mins) => new Date(start.getTime() + mins * 60000);
  const dry = dryDayOn(party.date, citySlug, customDry);
  const buyDay = dry ? lastShoppingDay(party.date, citySlug, customDry) : null;
  const stockAt = buyDay ? new Date(`${buyDay}T12:00:00`) : at(-24 * 60 - 120);
  const list = [
    { key: "stock", title: "🥃 Stock the bar today",
      body: dry ? `${prettyDate(party.date)} is ${dry.name} — shops will be shut. Buy your bottles today.` : "Pick up the bottles on your Liquor Cabinet list.", at: stockAt },
    { key: "chill", title: "🧊 Chill the beer & wine", body: "Into the fridge now so they're cold by party time.", at: at(-180) },
    { key: "blinkit", title: "🛒 Order mixers, ice & munchies", body: "Your Blinkit list is ready in Liquor Cabinet.", at: at(-75) },
    { key: "starters", title: "🍢 Order the starters", body: "Send your Zomato / Bistro order so it lands as guests arrive.", at: at(-40) },
  ];
  if (party.dinner) list.push({ key: "dinner", title: "🍛 Time to order dinner", body: "Mains take ~45 min — order now from your Zomato cart.", at: at(Math.max(90, (party.hours * 60) / 2 - 45)) });
  return list.map((r, i) => ({ ...r, id: BASE_ID + i, past: r.at.getTime() < Date.now() }));
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
