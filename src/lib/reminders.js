// ═══════════════════════════════════════════════════════════════════════════════
//  REMINDERS — phone notifications timed off the party start.
//  The plan (which reminders, when) lives in reminderPlan.js so node can test it.
// ═══════════════════════════════════════════════════════════════════════════════
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./http.js";
import { BASE_ID, reminderExtra } from "./reminderPlan.js";

export { partyStart } from "./when.js";
export { buildReminders } from "./reminderPlan.js";

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
        smallIcon: "ic_stat_liquor", iconColor: "#D4872A",
        // Where a tap lands: the Cart's bottles list for the shopping reminder, Plan › Getting home
        // for last call, the settle-up sheet the morning after, else the Food tab.
        extra: reminderExtra(r.key),
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
