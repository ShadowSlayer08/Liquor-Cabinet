import { test } from "node:test";
import assert from "node:assert/strict";
import { barsDryOn, barsDryText, clock, dryDayOn, dryDaysFor, lastShoppingDay, shopsOpenAt, untilText, upcomingDryDays } from "../src/lib/drydays.js";

const election = [{ date: "2026-10-10", name: "Election" }];

test("dryDayOn keeps its shape; only Haryana's 26 Jan and 15 Aug gain until 17:00", () => {
  assert.deepEqual(dryDayOn("2026-10-02", "delhi"), { date: "2026-10-02", name: "Gandhi Jayanti", level: "national" });
  assert.deepEqual(dryDayOn("2026-10-02", "gurgaon"), { date: "2026-10-02", name: "Gandhi Jayanti", level: "national" });   // full day
  assert.deepEqual(dryDayOn("2027-01-26", "delhi"), { date: "2027-01-26", name: "Republic Day", level: "national" });
  assert.deepEqual(dryDayOn("2027-01-26", "gurgaon"), { date: "2027-01-26", name: "Republic Day", level: "national", until: "17:00" });
  assert.deepEqual(dryDayOn("2027-08-15", "faridabad"), { date: "2027-08-15", name: "Independence Day", level: "national", until: "17:00" });
  assert.deepEqual(dryDayOn("2026-11-08", "delhi"), { date: "2026-11-08", name: "Diwali", level: "often" });
  assert.deepEqual(dryDayOn("2026-10-10", "delhi", election), { date: "2026-10-10", name: "Election", level: "custom" });
  assert.equal(dryDayOn("2026-10-03", "delhi"), null);
  assert.equal(dryDayOn("", "delhi"), null);
  // An election ban on a part-day holiday shuts the shops all day.
  assert.equal(dryDayOn("2027-01-26", "gurgaon", [{ date: "2027-01-26", name: "Election" }]).level, "custom");
  // Every year, not just the ones in the tables.
  assert.equal(dryDayOn("2031-08-15", "gurgaon").until, "17:00");
  assert.equal(dryDayOn("2031-08-15", "pune").until, undefined);
});

test("a dry-until-5-pm day is still a shopping day in the evening", () => {
  assert.equal(lastShoppingDay("2027-01-27", "gurgaon"), "2027-01-26");
  assert.equal(lastShoppingDay("2027-01-27", "delhi"), "2027-01-25");
  assert.equal(lastShoppingDay("2027-01-26", "gurgaon"), "2027-01-25");
  assert.equal(lastShoppingDay("2026-10-03", "gurgaon"), "2026-10-01");                       // 2 Oct: full day
  assert.equal(lastShoppingDay("2027-01-27", "gurgaon", [{ date: "2027-01-26", name: "Election" }]), "2027-01-25");
});

test("shopsOpenAt says when a part-day dry day opens, so 'buy by' can say 'after 5 pm'", () => {
  const day = lastShoppingDay("2027-01-27", "gurgaon", [{ date: "2027-01-27", name: "Election" }]);
  assert.equal(day, "2027-01-26");
  assert.equal(shopsOpenAt(day, "gurgaon"), "17:00");
  assert.equal(shopsOpenAt("2027-08-15", "faridabad"), "17:00");
  assert.equal(shopsOpenAt("2027-01-26", "delhi"), null);                                    // shut all day
  assert.equal(shopsOpenAt("2026-10-02", "gurgaon"), null);                                  // shut all day
  assert.equal(shopsOpenAt("2026-10-03", "gurgaon"), null);                                  // not dry
  assert.equal(shopsOpenAt("2027-01-26", "gurgaon", [{ date: "2027-01-26", name: "Election" }]), null);
  // Whatever lastShoppingDay returns is open at some point: all day, or from shopsOpenAt.
  for (const city of ["gurgaon", "delhi", "pune"]) {
    for (let m = 1; m <= 12; m++) {
      const date = `2027-${String(m).padStart(2, "0")}-${m === 1 ? "27" : m === 8 ? "16" : "10"}`;
      const d = lastShoppingDay(date, city);
      const dry = dryDayOn(d, city);
      assert.ok(!dry || dry.until === shopsOpenAt(d, city), `${city} ${date}`);
    }
  }
});

test("lists carry until, so the Plan card can show it", () => {
  const hr = dryDaysFor("gurgaon", [], [2027]).filter((d) => d.level === "national");
  assert.deepEqual(hr.map((d) => d.until || null), ["17:00", "17:00", null]);
  assert.equal(upcomingDryDays("gurgaon", [], "2027-01-01", 1)[0].until, "17:00");
  assert.equal(upcomingDryDays("delhi", [], "2027-01-01", 1)[0].until, undefined);
});

test("clock and untilText", () => {
  assert.equal(clock("17:00"), "5 pm");
  assert.equal(clock("01:30"), "1:30 am");
  assert.equal(clock("00:00"), "12 am");
  assert.equal(clock("12:05"), "12:05 pm");
  assert.equal(clock(""), "");
  assert.equal(untilText(dryDayOn("2027-01-26", "gurgaon")), "until 5 pm");
  assert.equal(untilText(dryDayOn("2027-01-26", "delhi")), "");
  assert.equal(untilText(null), "");
});

test("bars in Delhi shut only on the national days (Excise Rules, rule 52)", () => {
  assert.deepEqual(barsDryOn("2026-11-08", "delhi"), { name: "Diwali", level: "often", dry: false, shopsOnly: true });
  assert.deepEqual(barsDryOn("2026-11-24", "delhi"), { name: "Guru Nanak Jayanti", level: "often", dry: false, shopsOnly: true });
  assert.deepEqual(barsDryOn("2026-10-02", "delhi"), { name: "Gandhi Jayanti", level: "national", dry: true });
  assert.equal(barsDryOn("2027-01-26", "delhi").until, undefined);
  assert.equal(barsDryOn("2026-10-03", "delhi"), null);
  assert.equal(barsDryOn(null, "delhi"), null);
});

test("bars in Haryana: 26 Jan and 15 Aug until 5 pm, 2 Oct all day", () => {
  assert.deepEqual(barsDryOn("2027-01-26", "gurgaon"), { name: "Republic Day", level: "national", dry: true, until: "17:00" });
  assert.deepEqual(barsDryOn("2027-08-15", "faridabad"), { name: "Independence Day", level: "national", dry: true, until: "17:00" });
  assert.deepEqual(barsDryOn("2026-10-02", "gurgaon"), { name: "Gandhi Jayanti", level: "national", dry: true });
  assert.equal(barsDryOn("2026-11-08", "gurgaon").dry, "check");        // festival days: check, as on the Food tab
});

test("your own dry days (election bans) shut bars too; elsewhere it's 'check'", () => {
  assert.deepEqual(barsDryOn("2026-10-10", "delhi", election), { name: "Election", level: "custom", dry: true });
  assert.equal(barsDryOn("2026-10-10", "mumbai", election).dry, true);
  assert.equal(barsDryOn("2026-10-10", "mumbai", null), null);
  // A full-day election ban beats Haryana's part-day closure.
  assert.deepEqual(barsDryOn("2027-01-26", "gurgaon", [{ date: "2027-01-26", name: "Election" }]), { name: "Election", level: "custom", dry: true });
  // And beats Delhi's shops-only festival day.
  assert.equal(barsDryOn("2026-11-08", "delhi", [{ date: "2026-11-08", name: "Election" }]).dry, true);
  assert.deepEqual(barsDryOn("2026-10-02", "mumbai"), { name: "Gandhi Jayanti", level: "national", dry: "check" });
  assert.deepEqual(barsDryOn("2026-11-08", "bangalore"), { name: "Diwali", level: "often", dry: "check" });
  assert.equal(barsDryOn("2027-05-01", "pune").dry, "check");           // Maharashtra Day
  assert.equal(barsDryOn("2027-05-01", "delhi"), null);
});

test("what the bars banner says", () => {
  const t = (date, city, custom = [], today = "2026-09-01") => barsDryText(barsDryOn(date, city, custom), date, city, today);
  assert.equal(t("2026-10-03", "delhi"), null);
  assert.deepEqual(t("2026-10-02", "delhi"), { tone: "danger", lead: "Fri, 2 Oct is Gandhi Jayanti", text: "bars and liquor shops in Delhi are shut all day.", check: false });
  assert.deepEqual(t("2026-11-08", "delhi"), { tone: "ok", lead: "Sun, 8 Nov is Diwali", text: "liquor shops may be shut, but licensed bars in Delhi stay open.", check: false });
  assert.deepEqual(t("2027-01-26", "gurgaon"), { tone: "warn", lead: "Tue, 26 Jan is Republic Day", text: "bars and liquor shops in Haryana are shut until 5 pm.", check: false });
  assert.equal(t("2026-10-10", "delhi", election).lead, "Sat, 10 Oct is a dry day (Election)");
  assert.equal(t("2026-10-10", "delhi", election).tone, "danger");
  assert.equal(t("2026-10-10", "delhi", [{ date: "2026-10-10" }]).lead, "Sat, 10 Oct is a dry day");
  const mum = t("2026-10-02", "mumbai");
  assert.equal(mum.tone, "warn");
  assert.equal(mum.check, true);
  assert.match(mum.text, /bars may be too, so check/);
  assert.match(t("2026-11-08", "mumbai").text, /often a dry day in Maharashtra/);
  assert.equal(t("2026-10-02", "delhi", [], "2026-10-02").lead, "Today is Gandhi Jayanti");
  assert.equal(barsDryText(null, "2026-10-02", "delhi"), null);
});
