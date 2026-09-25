import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminders, reminderSig, reminderState, isOn, BASE_ID } from "../src/lib/reminderPlan.js";
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
  assert.deepEqual(list.map((r) => r.key), ["stock", "chill", "blinkit", "starters", "dinner"]);
  assert.deepEqual(list.map((r) => r.id), [0, 1, 2, 3, 4].map((i) => BASE_ID + i));
  assert.equal(mins(list, "stock"), -24 * 60 - 120);
  assert.equal(mins(list, "chill"), -180);
  assert.equal(mins(list, "blinkit"), -75);
  assert.equal(mins(list, "starters"), -40);
  assert.equal(mins(list, "dinner"), 90);        // max(90, 4 h / 2 − 45 min)
  assert.ok(list.every((r) => r.past === false));
  assert.ok(buildReminders(party, "delhi", [], new Date("2027-06-12T19:00:00").getTime()).find((r) => r.key === "stock").past);
  assert.equal(buildReminders({ ...party, dinner: false }, "delhi").length, 4);
  assert.deepEqual(buildReminders({ ...party, date: null }, "delhi"), []);
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
  assert.equal(all.split("|").length, 5);
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
