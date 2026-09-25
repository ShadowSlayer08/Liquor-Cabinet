// ═══════════════════════════════════════════════════════════════════════════════
//  REMINDERS — phone notifications timed off the party start.
// ═══════════════════════════════════════════════════════════════════════════════
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./http.js";
import { dryDayOn, lastShoppingDay, prettyDate } from "./drydays.js";

const BASE_ID = 8100;
export const partyStart = (party) => (party?.date ? new Date(`${party.date}T${party.time || "20:00"}:00`) : null);

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

export async function scheduleReminders(reminders, enabled) {
  if (!isNative()) return { scheduled: 0, native: false };
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") throw new Error("Notifications are off for Liquor Cabinet");
  await cancelReminders();
  const due = reminders.filter((r) => enabled[r.key] !== false && !r.past);
  if (due.length) {
    await LocalNotifications.schedule({
      notifications: due.map((r) => ({
        id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true },
        smallIcon: "ic_stat_liquor", iconColor: "#D4872A", extra: { tab: r.key === "stock" ? "cart" : "food" },
      })),
    });
  }
  return { scheduled: due.length, native: true };
}

export async function cancelReminders() {
  if (!isNative()) return;
  const ids = Array.from({ length: 12 }, (_, i) => ({ id: BASE_ID + i }));
  try { await LocalNotifications.cancel({ notifications: ids }); } catch {}
}
