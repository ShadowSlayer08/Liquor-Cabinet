// ═══════════════════════════════════════════════════════════════════════════════
//  WHEN — the party's date & time as the rest of the app reads them.
//  `party.date` is ISO ("2026-09-26"), `party.time` is "HH:MM" (an empty time
//  means 8 pm, the same default reminders use). The "date time" key is what
//  reminders remember they were scheduled for. Pure, so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════
import { prettyDate } from "./drydays.js";

const DEFAULT_TIME = "20:00";

export const partyStart = (party) => (party?.date ? new Date(`${party.date}T${party.time || DEFAULT_TIME}:00`) : null);

// "2026-09-26 20:00" — null until the party has a date.
export const partyWhen = (party) => (party?.date ? `${party.date} ${party.time || DEFAULT_TIME}` : null);

// "20:00" → "8:00 pm", "00:30" → "12:30 am".
export function prettyTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

// A Date → "20:00" in local time.
export const clockOf = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// "2026-09-26 20:00" (or a party) → "Sat, 26 Sept · 8:00 pm".
export function prettyWhen(whenOrParty) {
  const key = typeof whenOrParty === "string" ? whenOrParty : partyWhen(whenOrParty);
  if (!key) return "";
  const [date, time] = key.split(" ");
  return [prettyDate(date), prettyTime(time)].filter(Boolean).join(" · ");
}
