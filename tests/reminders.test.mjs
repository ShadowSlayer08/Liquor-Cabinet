import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminders, reminderSig, reminderState, reminderExtra, isOn, lastCallAt, settleAt, BASE_ID } from "../src/lib/reminderPlan.js";
import { partyStart, partyWhen, prettyTime, prettyWhen, clockOf } from "../src/lib/when.js";
import { leaveBy, closesAt, lastCallFor, freeCancelUntil, placeKey, placeState, byobNight, LEAVE_MAX_KM } from "../src/lib/reminderPlan.js";
import { DEFAULT_OUT, slimVenue, slimEvent } from "../src/lib/outModel.js";
import { dryNote } from "../src/lib/reminderPlan.js";
import { dryDayOn } from "../src/lib/drydays.js";
import { templateToast } from "../src/lib/templates.js";

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

// ── v1.5: a party out ────────────────────────────────────────────────────────
const now = new Date("2027-06-01T09:00:00").getTime();
const T = (s) => new Date(s).getTime();
const home = { lat: 28.4595, lon: 77.0266, label: "Sector 57" };
const soi7 = slimVenue({
  resId: 18383940, zcity: "ncr", slug: "soi-7-pub-brewery-dlf-cyber-city", name: "Soi 7 Pub & Brewery", locality: "DLF Cyber City",
  lat: 28.495, lon: 77.0895, costForTwo: 2400, bookable: true, closes: "01:00",
}, "https://www.district.in/dining/ncr/soi-7-pub-brewery-dlf-cyber-city");
const xlive = slimEvent({ slug: "giada-brince-xlive", name: "Giada Brince at XLive", venue: "XLive", lat: 28.4683, lon: 77.064, rules: { ageEntry: 21 } });
const outAt = (pick, more = {}) => ({ ...DEFAULT_OUT, active: true, pick, ...more });
const outList = (out, p = party, loc = home) => buildReminders(p, "gurgaon", [], now, { out, loc });

test("out: the home-only nudges go; leave by, last call and settle-up stay", () => {
  const list = outList(outAt(soi7));
  assert.deepEqual(list.map((r) => r.key), ["leave", "winddown", "settle"]);
  assert.deepEqual(list.map((r) => r.id), [BASE_ID, BASE_ID + 1, BASE_ID + 2]);
  assert.equal(list.find((r) => r.key === "settle").at.getTime(), T("2027-06-13T11:00:00"));   // the morning after, as at home
  // Not out (switched off, or nothing picked): exactly the home list.
  const homeList = buildReminders(party, "gurgaon", [], now);
  assert.deepEqual(outList({ ...outAt(soi7), active: false }), homeList);
  assert.deepEqual(outList({ ...DEFAULT_OUT, active: true }), homeList);
  assert.deepEqual(buildReminders(party, "gurgaon", [], now, {}), homeList);
});

test("leave by: start − travel time, on a 5-minute mark; skipped without both pins", () => {
  // Sector 57 → Cyber City: 7.3 km → 10 + 7.3 × 1.4 / 20 × 60 = 40.7 → 45 min.
  const leave = outList(outAt(soi7)).find((r) => r.key === "leave");
  assert.equal(leave.at.getTime(), T("2027-06-12T19:15:00"));
  assert.equal(leave.title, "🚕 Leave by 7:15 pm");
  assert.equal(leave.body, "About 45 min to Soi 7 Pub & Brewery. Be on time — the venue may give away a late table.");
  // An odd start rounds down to the 5-minute mark before it.
  const odd = leaveBy({ ...party, time: "20:07" }, outAt(soi7), home);
  assert.deepEqual([odd.at.getTime(), odd.minutes, odd.place], [T("2027-06-12T19:20:00"), 45, "Soi 7 Pub & Brewery"]);
  // An event: its venue, and the door's ID check.
  const ev = outList(outAt(xlive, { kind: "club" })).find((r) => r.key === "leave");
  assert.equal(ev.at.getTime(), T("2027-06-12T19:30:00"));   // 3.8 km → 30 min
  assert.equal(ev.body, "About 30 min to XLive. Be on time, and carry ID: the door checks.");
  // No location fix, no venue pin, or a fix implausibly far away → no "Leave by".
  for (const [out, loc] of [[outAt(soi7), null], [outAt(soi7), {}], [outAt({ ...soi7, lat: null }), home], [outAt(soi7), { lat: 28.9, lon: 77.5 }]]) {
    assert.ok(!outList(out, party, loc).some((r) => r.key === "leave"), JSON.stringify(loc));
  }
  assert.equal(leaveBy(party, outAt(soi7), { lat: 28.9, lon: 77.5 }), null);                     // 67 km
  assert.ok(leaveBy(party, outAt(soi7), { lat: 28.6315, lon: 77.2167 }).km < LEAVE_MAX_KM);     // Connaught Place, 27 km
  assert.equal(leaveBy({ date: null }, outAt(soi7), home), null);
  assert.equal(leaveBy(party, { ...outAt(soi7), active: false }, home), null);
});

test("free cancellation: only for a booked table, 2 h before the 24-hour cut-off", () => {
  assert.ok(!outList(outAt(soi7)).some((r) => r.key === "cancel"));
  const list = outList(outAt(soi7, { booked: true }));
  assert.deepEqual(list.map((r) => r.key), ["cancel", "leave", "winddown", "settle"]);
  const c = list[0];
  assert.equal(c.at.getTime(), T("2027-06-11T18:00:00"));
  assert.equal(freeCancelUntil(party).getTime(), T("2027-06-11T20:00:00"));
  assert.equal(c.title, "⏳ Free cancellation ends at 8:00 pm");
  assert.match(c.body, /cancelled at least 24 hours ahead, but not the convenience fee/);
  assert.equal(freeCancelUntil({}), null);
  // Event tickets follow the organiser's terms, so a booked event gets none.
  assert.ok(!outList(outAt(xlive, { booked: true })).some((r) => r.key === "cancel"));
  // Booked with under 26 h to go: it has passed, so it isn't set.
  assert.ok(buildReminders(party, "gurgaon", [], T("2027-06-11T19:00:00"), { out: outAt(soi7, { booked: true }), loc: home }).find((r) => r.key === "cancel").past);
});

test("last call: 45 min before the venue's listed closing, after midnight too", () => {
  const wd = outList(outAt(soi7), { ...party, drivers: 2 }).find((r) => r.key === "winddown");
  assert.equal(wd.at.getTime(), T("2027-06-13T00:15:00"));   // closes 01:00 the next morning
  assert.equal(wd.title, "🚕 Last call in 45 minutes");
  assert.equal(wd.body, "Soi 7 Pub & Brewery closes at 1:00 am (listed hours). Order water, settle the tab, and sort rides home (2 driving tonight).");
  const close = (closes, p = party) => closesAt(p, closes)?.getTime() ?? null;
  assert.equal(close("01:00"), T("2027-06-13T01:00:00"));
  assert.equal(close("23:30"), T("2027-06-12T23:30:00"));
  assert.equal(close("02:00", { ...party, time: "23:00" }), T("2027-06-13T02:00:00"));
  assert.equal(close("24:00"), T("2027-06-13T00:00:00"));
  assert.equal(close("16:00"), null);   // 20 h on: a listing for another shift
  assert.equal(close(""), null);
  assert.equal(close("late"), null);
  assert.equal(close("25:00"), null);
  assert.equal(closesAt({ date: null }, "01:00"), null);
  // No listed hours (or an event, or not out): the party's own end, as at home.
  assert.equal(lastCallFor(party, outAt({ ...soi7, closes: "" })).getTime(), lastCallAt(party).getTime());
  assert.equal(lastCallFor(party, outAt(xlive)).getTime(), lastCallAt(party).getTime());
  assert.equal(lastCallFor(party, null).getTime(), lastCallAt(party).getTime());
  assert.equal(outList(outAt({ ...soi7, closes: "" })).find((r) => r.key === "winddown").body, "Order water, settle the tab, and sort rides home.");
  // Closing within the first 1¾ hours leaves no room for a last call.
  assert.equal(lastCallFor(party, outAt({ ...soi7, closes: "21:30" })), null);
  assert.ok(!outList(outAt({ ...soi7, closes: "21:30" })).some((r) => r.key === "winddown"));
});

test("a BYOB night keeps buying and chilling the bottles you bring", () => {
  const out = outAt({ ...soi7, kind: "byob" });   // picked off the BYOB list (venuePick sets pick.kind)
  assert.ok(byobNight(out));
  assert.ok(byobNight(outAt({ ...soi7, tags: ["BYOB", "DJ"] })));
  assert.ok(!byobNight(outAt(soi7)));
  assert.ok(!byobNight({ ...out, active: false }));
  const list = outList(out);
  assert.deepEqual(list.map((r) => r.key), ["stock", "chill", "leave", "winddown", "settle"]);
  assert.equal(list[0].title, "🍾 Buy the bottles you're bringing");
  assert.equal(list[0].at.getTime(), T("2027-06-11T18:00:00"));
  assert.equal(list[1].body, "Into the fridge now so they're cold when you get to Soi 7 Pub & Brewery.");
  assert.deepEqual(list[1].extra, { tab: "out", card: "night-out" });
  // A dry day still moves the bottle run.
  const gj = buildReminders({ ...party, date: "2027-10-02" }, "delhi", [], now, { out, loc: home }).find((r) => r.key === "stock");
  assert.equal(gj.at.getTime(), T("2027-10-01T12:00:00"));
  assert.match(gj.body, /Gandhi Jayanti/);
  // Everything a night out can have fits the 12 ids reminders.js cancels.
  const all = outList(outAt({ ...soi7, kind: "byob" }, { booked: true }));
  assert.equal(all.length, 6);
  assert.ok(all.every((r) => r.id < BASE_ID + 12));
});

test("BYOB comes from the pick, not the outing-type chip that's on now", () => {
  // A club night stays a club night when the host taps the BYOB chip to browse.
  const club = outAt(xlive, { kind: "byob" });
  assert.ok(!byobNight(club));
  assert.ok(!byobNight(outAt({ ...xlive, kind: "byob", tags: ["BYOB"] })));   // events never are
  assert.deepEqual(outList(club).map((r) => r.key), ["leave", "winddown", "settle"]);
  // A bar picked off the bars list: the chip changing doesn't add the bottle run (or dirty the reminders).
  assert.ok(!byobNight(outAt({ ...soi7, kind: "bar" }, { kind: "byob" })));
  assert.deepEqual(outList(outAt({ ...soi7, kind: "bar" }, { kind: "byob" })), outList(outAt({ ...soi7, kind: "bar" })));
  // A BYOB place picked off the BYOB list keeps its bottles when the chip moves on.
  const byob = outAt({ ...soi7, kind: "byob", tags: [] }, { kind: "club" });
  assert.ok(byobNight(byob));
  assert.deepEqual(outList(byob).map((r) => r.key), ["stock", "chill", "leave", "winddown", "settle"]);
});

// ── Dry days that end at 5 pm (Haryana's 26 Jan and 15 Aug) ──────────────────
test("a part-day dry day: the 'buy today' nudge waits for the shops to open", () => {
  const stock = (p, city = "gurgaon", custom = []) => buildReminders({ ...party, ...p }, city, custom, now).find((r) => r.key === "stock");
  const election = [{ date: "2027-01-27", name: "Election" }];
  // Party on an election day: the last open day is 26 Jan, shut until 5 pm → 5 pm, not noon.
  const onDay = stock({ date: "2027-01-27", time: "13:00" }, "gurgaon", election);
  assert.equal(onDay.at.getTime(), T("2027-01-26T17:00:00"));
  assert.match(onDay.body, /27 Jan is a dry day \(Election\) — liquor shops will be shut\. Buy your bottles today after 5 pm\.$/);
  // The day before is the election, with no time on the party morning → 26 Jan, after 5 pm.
  const eve = stock({ date: "2027-01-28", time: "12:30" }, "gurgaon", election);
  assert.equal(eve.at.getTime(), T("2027-01-26T17:00:00"));
  assert.match(eve.body, /Buy your bottles today after 5 pm\.$/);
  // In Delhi 26 Jan is shut all day, so it's the 25th at noon, as before.
  const delhi = stock({ date: "2027-01-27", time: "13:00" }, "delhi", election);
  assert.equal(delhi.at.getTime(), T("2027-01-25T12:00:00"));
  assert.match(delhi.body, /Buy your bottles today\.$/);
  // A party on 26 Jan itself: buy the day before, and the note says when the shops open.
  const repDay = stock({ date: "2027-01-26" });
  assert.equal(repDay.at.getTime(), T("2027-01-25T12:00:00"));
  assert.match(repDay.body, /26 Jan is Republic Day — liquor shops in Haryana will be shut until 5 pm\. Buy your bottles today\.$/);
  // The usual nudge the evening before (6 pm on 26 Jan) is after the shops open, so it stays.
  const after = stock({ date: "2027-01-27" });
  assert.equal(after.at.getTime(), T("2027-01-26T18:00:00"));
  assert.equal(after.body, "Pick up the bottles on your Liquor Cabinet list.");
  // …but at 4:30 pm they're still shut: the party morning instead.
  const before = stock({ date: "2027-01-27", time: "18:30" });
  assert.equal(before.at.getTime(), T("2027-01-27T11:00:00"));
  assert.match(before.body, /26 Jan is Republic Day — liquor shops in Haryana will be shut until 5 pm\. Pick up your bottles this morning\.$/);
  // The template toast names the same opening time for its "buy by" day.
  assert.match(templateToast({ party: { name: "Election-day lunch", date: "2027-01-27" }, note: null }, "gurgaon", election),
    /buy bottles by .*26 Jan \(after 5 pm\)$/);
  assert.match(templateToast({ party: { name: "Election-day lunch", date: "2027-01-27" }, note: null }, "delhi", election),
    /buy bottles by .*25 Jan$/);
});

test("dry-day notes: a part-day closure says when the shops open", () => {
  const note = (date, city, custom = []) => dryNote(dryDayOn(date, city, custom), date, city);
  assert.match(note("2027-01-26", "gurgaon"), /^.*26 Jan is Republic Day — liquor shops in Haryana will be shut until 5 pm\.$/);
  assert.match(note("2027-08-15", "faridabad"), /Independence Day — liquor shops in Haryana will be shut until 5 pm\.$/);
  assert.match(note("2026-10-02", "gurgaon"), /Gandhi Jayanti — liquor shops will be shut\.$/);   // 2 Oct: all day
  assert.match(note("2027-01-26", "delhi"), /Republic Day — liquor shops will be shut\.$/);
  // An election ban on 26 Jan outranks the part-day closure: shut all day.
  assert.match(note("2027-01-26", "gurgaon", [{ date: "2027-01-26", name: "Election" }]), /a dry day \(Election\) — liquor shops will be shut\.$/);
});

test("taps on night-out reminders land on the Out tab", () => {
  assert.deepEqual(reminderExtra("leave"), { tab: "out", card: "night-out" });
  assert.deepEqual(reminderExtra("cancel"), { tab: "out", card: "night-out" });
  assert.deepEqual(reminderExtra("winddown"), { tab: "plan", card: "rides" });
});

test("reminders remember their place, and a new one asks once", () => {
  assert.equal(placeKey(null), "home");
  assert.equal(placeKey({ ...outAt(soi7), active: false }), "home");
  assert.equal(placeKey(outAt(soi7)), "venue:18383940");
  assert.equal(placeKey(outAt(xlive)), "event:giada-brince-xlive");
  const today = "2027-06-01";
  const set = { enabled: {}, scheduledFor: "2027-06-12 20:00" };   // set before v1.5: no place = home
  const st = reminderState(set, party, null, today);
  assert.deepEqual(placeState(set, null, st), { place: "home", changed: false, ask: false });
  assert.deepEqual(placeState(set, outAt(soi7), st), { place: "venue:18383940", changed: true, ask: true });
  assert.equal(placeState({ ...set, keptPlace: "venue:18383940" }, outAt(soi7), st).ask, false);   // said "Keep"
  assert.equal(placeState({ ...set, scheduledPlace: "venue:18383940" }, outAt(soi7), st).changed, false);
  assert.equal(placeState({ ...set, scheduledPlace: "venue:18383940" }, null, st).ask, true);      // back home
  // A date change asks first; nothing set, nothing to ask.
  assert.equal(placeState(set, outAt(soi7), reminderState(set, { ...party, time: "21:00" }, null, today)).changed, false);
  assert.equal(placeState({}, outAt(soi7), reminderState({}, party, null, today)).changed, false);
});
