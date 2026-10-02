import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminders, reminderSig, reminderState, reminderExtra, isOn, lastCallAt, settleAt, BASE_ID } from "../src/lib/reminderPlan.js";
import { partyStart, partyWhen, prettyTime, prettyWhen, clockOf } from "../src/lib/when.js";

const party = { date: "2027-06-12", time: "20:00", hours: 4, dinner: true };
const mins = (list, key) => (list.find((r) => r.key === key).at - partyStart(party)) / 60000;

test("party date & time helpers", () => {
  assert.equal(partyWhen(party), "2027-06-12 20:00");
  assert.equal(partyWhen({ date: "2027-06-12", time: "" }), "2027-06-12 20:00");
  assert.equal(partyWhen({ date: null }), null);
  assert.equal(partyStart({}), null);
  assert.equal(prettyTime("20:00"), "8:00 pm");
  assert.equal(prettyTime("00:30"), "12:30 am");
  assert.equal(prettyTime("12:05"), "12:05 pm");
  assert.equal(prettyTime(""), "");
  assert.equal(clockOf(new Date(2027, 5, 12, 7, 5)), "07:05");
  assert.match(prettyWhen("2027-06-12 21:15"), /12 .*· 9:15 pm$/);
  assert.equal(prettyWhen(null), "");
});

test("reminders are timed off the party start", () => {
  const list = buildReminders(party, "delhi", [], new Date("2027-06-01T09:00:00").getTime());   // a fixed "now"
  // v1.4.1 appended last call and settle-up, so the v1.4 reminders keep their ids.
  assert.deepEqual(list.map((r) => r.key), ["stock", "chill", "blinkit", "starters", "dinner", "winddown", "settle"]);
  assert.deepEqual(list.map((r) => r.id), [0, 1, 2, 3, 4, 5, 6].map((i) => BASE_ID + i));
  assert.ok(list.every((r) => r.id < BASE_ID + 12));   // cancelReminders clears 12
  assert.equal(mins(list, "stock"), -24 * 60 - 120);
  assert.equal(mins(list, "chill"), -180);
  assert.equal(mins(list, "blinkit"), -75);
  assert.equal(mins(list, "starters"), -40);
  assert.equal(mins(list, "dinner"), 90);        // max(90, 4 h / 2 − 45 min)
  assert.equal(mins(list, "winddown"), 4 * 60 - 45);
  assert.equal(list.find((r) => r.key === "settle").at.getTime(), new Date("2027-06-13T11:00:00").getTime());   // the morning after
  assert.ok(list.every((r) => r.past === false));
  assert.ok(buildReminders(party, "delhi", [], new Date("2027-06-12T19:00:00").getTime()).find((r) => r.key === "stock").past);
  const noDinner = buildReminders({ ...party, dinner: false }, "delhi");
  assert.deepEqual(noDinner.map((r) => r.key), ["stock", "chill", "blinkit", "starters", "winddown", "settle"]);
  assert.equal(mins(noDinner, "winddown"), 195);
  assert.deepEqual(buildReminders({ ...party, date: null }, "delhi"), []);
});

test("last call: 45 min before the end, with the drivers; none in a one-hour party", () => {
  const list = buildReminders({ ...party, hours: 6, drivers: 2 }, "delhi");
  const wd = list.find((r) => r.key === "winddown");
  assert.equal(mins(list, "winddown"), 6 * 60 - 45);
  assert.equal(wd.title, "🚕 Last call in 45 minutes");
  assert.equal(wd.body, "Put out water and soft drinks, and sort rides home (2 driving tonight).");
  assert.equal(buildReminders(party, "delhi").find((r) => r.key === "winddown").body, "Put out water and soft drinks, and sort rides home.");
  assert.match(buildReminders({ ...party, guests: 3, drivers: 9 }, "delhi").find((r) => r.key === "winddown").body, /\(3 driving tonight\)/);   // clamped to the guests
  assert.ok(!buildReminders({ ...party, hours: 1 }, "delhi").some((r) => r.key === "winddown"));
  assert.equal(lastCallAt({ ...party, hours: 1 }), null);
  assert.equal(lastCallAt({ ...party, hours: 2 }).getTime(), new Date("2027-06-12T21:15:00").getTime());
  assert.equal(lastCallAt({ ...party, hours: 99 }).getTime(), new Date("2027-06-13T07:15:00").getTime());   // 12 h at most
  assert.equal(lastCallAt({ date: null }), null);
});

test("settle-up: the first 11 am after the party, at least 2 h after it ends", () => {
  const at = (p) => settleAt({ ...party, ...p }).getTime();
  assert.equal(at({}), new Date("2027-06-13T11:00:00").getTime());
  assert.equal(at({ time: "12:30" }), new Date("2027-06-13T11:00:00").getTime());           // a lunch party: next morning
  assert.equal(at({ time: "01:00" }), new Date("2027-06-12T11:00:00").getTime());           // after midnight: that morning
  assert.equal(at({ time: "22:00", hours: 12 }), new Date("2027-06-13T12:00:00").getTime()); // ends 10 am → noon
  assert.equal(settleAt({ date: null }), null);
  const s = buildReminders(party, "delhi").find((r) => r.key === "settle");
  assert.equal(s.title, "🧾 Settle up");
  assert.equal(s.body, "Enter what everyone actually paid. Liquor Cabinet works out who owes whom.");
});

test("where a reminder's tap lands", () => {
  assert.deepEqual(reminderExtra("stock"), { tab: "cart", view: "liquor" });
  assert.deepEqual(reminderExtra("winddown"), { tab: "plan", card: "rides" });
  assert.deepEqual(reminderExtra("settle"), { tab: "plan", card: "settle" });
  for (const k of ["chill", "blinkit", "starters", "dinner", "unknown"]) assert.deepEqual(reminderExtra(k), { tab: "food" });
});

test("a dry party day moves the shopping reminder to the last open day", () => {
  const list = buildReminders({ ...party, date: "2027-10-02" }, "delhi", []);   // Gandhi Jayanti
  const stock = list.find((r) => r.key === "stock");
  assert.equal(stock.at.getTime(), new Date("2027-10-01T12:00:00").getTime());
  assert.match(stock.body, /Gandhi Jayanti/);
});

test("switches and the signature of what's set", () => {
  const list = buildReminders(party, "delhi");
  assert.ok(isOn({}, "chill"));
  assert.ok(!isOn({ chill: false }, "chill"));
  assert.ok(isOn(undefined, "chill"));
  const all = reminderSig(list, {});
  assert.equal(all.split("|").length, 7);
  assert.notEqual(reminderSig(list, { chill: false }), all);
  assert.equal(reminderSig(list, { chill: true }), all);
  // Longer party → dinner reminder later → different signature
  assert.notEqual(reminderSig(buildReminders({ ...party, hours: 8 }, "delhi"), {}), all);
});

test("reminder state: scheduled, moved, dirty, ask once, expired", () => {
  const list = buildReminders(party, "delhi");
  const today = "2027-06-01";
  const set = { enabled: {}, scheduledFor: "2027-06-12 20:00", scheduledSig: reminderSig(list, {}) };

  assert.deepEqual(reminderState({ enabled: {}, scheduledFor: null }, party, list, today),
    { when: "2027-06-12 20:00", scheduled: false, moved: false, dirty: false, ask: false });
  assert.deepEqual(reminderState(set, party, list, today),
    { when: "2027-06-12 20:00", scheduled: true, moved: false, dirty: false, ask: false });

  // A switch flipped after scheduling
  const flipped = { ...set, enabled: { blinkit: false } };
  assert.equal(reminderState(flipped, party, list, today).dirty, true);
  assert.equal(reminderState(flipped, party, null, today).dirty, false);   // no list → not checked

  // Party moved in the Food tab
  const moved = { ...party, time: "21:00" };
  const st = reminderState(set, moved, buildReminders(moved, "delhi"), today);
  assert.equal(st.moved, true);
  assert.equal(st.dirty, false);
  assert.equal(st.ask, true);
  assert.equal(reminderState({ ...set, keptFor: "2027-06-12 21:00" }, moved, null, today).ask, false);   // said "Keep"
  assert.equal(reminderState({ ...set, keptFor: "2027-06-12 21:00" }, { ...party, time: "22:00" }, null, today).ask, true);

  // Reminders for a party that's already over don't count
  assert.equal(reminderState(set, { ...party, date: "2027-06-19" }, null, "2027-06-13").scheduled, false);
  assert.equal(reminderState(set, { ...party, date: "2027-06-19" }, null, "2027-06-13").ask, false);
  assert.equal(reminderState(undefined, party).scheduled, false);
});

test("a dry day before the party moves the shopping reminder off it", () => {
  const at = (p) => buildReminders(p, "delhi", []).find((r) => r.key === "stock");
  // Sat 3 Oct 2026 at 8 pm: Fri 2 Oct is Gandhi Jayanti → shop on the party morning instead.
  const eve = at({ ...party, date: "2026-10-03" });
  assert.equal(eve.at.getTime(), new Date("2026-10-03T11:00:00").getTime());
  assert.match(eve.body, /Gandhi Jayanti — liquor shops will be shut\. Pick up your bottles this morning/);
  // A lunch party leaves no time that morning → the last open day before the dry day.
  const lunch = at({ ...party, date: "2026-10-03", time: "12:30" });
  assert.equal(lunch.at.getTime(), new Date("2026-10-01T12:00:00").getTime());
  assert.match(lunch.body, /Buy your bottles today/);
  // Your own dry day counts too.
  const own = buildReminders({ ...party, date: "2027-06-12" }, "delhi", [{ date: "2027-06-11", name: "Election" }]).find((r) => r.key === "stock");
  assert.equal(own.at.getTime(), new Date("2027-06-12T11:00:00").getTime());
  assert.match(own.body, /a dry day \(Election\)/);
});

test("festival dry days are worded as 'often', not certain", () => {
  const diwali = buildReminders({ ...party, date: "2026-11-08" }, "mumbai", []).find((r) => r.key === "stock");
  assert.match(diwali.body, /Diwali — often a dry day in Maharashtra, so shops may be shut/);
  const gj = buildReminders({ ...party, date: "2027-10-02" }, "delhi", []).find((r) => r.key === "stock");
  assert.match(gj.body, /liquor shops will be shut/);
});
