import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startSettle, balances, transfers, settleSummary, settleMessage, normalizeSettle, expenseTotal,
  addPerson, removePerson, patchPerson, patchExpense, addExpense, removeExpense, pasteNames, newId, rupees,
} from "../src/lib/settle.js";
import { splitBill } from "../src/lib/split.js";

const person = (id, name, drinks = true, upi = "") => ({ id, name, drinks, upi });
const expense = (id, part, amount, paidBy, what = id) => ({ id, what, part, amount, paidBy, planned: false });
const settleOf = (people, expenses, mode = "fair") => ({ title: "House party", when: null, createdAt: 1, mode, paid: {}, people, expenses });

// A tiny seeded PRNG so the "random" cases are the same on every run.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test("Σ net is exactly 0 in paise for 100 random expense sets", () => {
  const rand = rng(42);
  for (let run = 0; run < 100; run++) {
    const n = 1 + Math.floor(rand() * 9);
    const people = Array.from({ length: n }, (_, i) => person(`p${i + 1}`, `P${i + 1}`, rand() < 0.6));
    const parts = ["liquor", "food", "supplies", "other"];
    const expenses = Array.from({ length: Math.floor(rand() * 7) }, (_, i) =>
      expense(`e${i + 1}`, parts[Math.floor(rand() * 4)], Math.floor(rand() * 20000), `p${1 + Math.floor(rand() * (n + 1))}`));  // sometimes a payer who isn't there
    const s = settleOf(people, expenses, rand() < 0.5 ? "fair" : "equal");
    const b = balances(s);
    assert.equal(b.reduce((t, x) => t + x.net, 0), 0, `run ${run}`);
    assert.equal(b.reduce((t, x) => t + x.paid, 0), expenseTotal(s) * 100, `run ${run}`);

    // Paying the transfers squares everyone within ₹1, with at most n − 1 payments.
    const ts = transfers(b);
    assert.ok(ts.length <= Math.max(0, n - 1), `run ${run}: ${ts.length} transfers for ${n}`);
    const after = Object.fromEntries(b.map((x) => [x.id, x.net]));
    for (const t of ts) {
      assert.ok(Number.isInteger(t.amount) && t.amount > 0);
      assert.notEqual(t.from, t.to);
      after[t.from] += t.amount * 100;
      after[t.to] -= t.amount * 100;
    }
    for (const [id, v] of Object.entries(after)) assert.ok(Math.abs(v) < 100, `run ${run}: ${id} left at ${v} paise`);
    assert.equal(new Set(ts.map((t) => t.key)).size, ts.length);
  }
});

test("host paid everything (fair) matches the split card within ₹1", () => {
  const people = [person("p1", "Arjun"), ...Array.from({ length: 9 }, (_, i) => person(`p${i + 2}`, `Guest ${i + 2}`, i + 2 <= 8))];
  const s = settleOf(people, [expense("e1", "liquor", 10000, "p1"), expense("e2", "food", 3000, "p1"), expense("e3", "supplies", 1000, "p1")]);
  const r = splitBill({ liquor: 10000, food: 3000, supplies: 1000, people: 10, drinkers: 8, mode: "fair" });
  const ts = transfers(balances(s));
  assert.equal(ts.length, 9);
  assert.ok(ts.every((t) => t.to === "p1"));
  for (const t of ts) {
    const drinks = people.find((p) => p.id === t.from).drinks;
    assert.ok(Math.abs(t.amount - (drinks ? r.perDrinker : r.perNonDrinker)) <= 1, `${t.from} pays ${t.amount}`);
  }
});

test("fair with nobody drinking splits everything equally; equal mode ignores drinking", () => {
  const people = [person("p1", "A", false), person("p2", "B", false), person("p3", "C", false)];
  const fair = balances(settleOf(people, [expense("e1", "liquor", 300, "p1")]));
  assert.deepEqual(fair.map((b) => b.share), [10000, 10000, 10000]);
  const mixed = [person("p1", "A", true), person("p2", "B", false)];
  assert.deepEqual(balances(settleOf(mixed, [expense("e1", "liquor", 500, "p2")])).map((b) => b.net), [-50000, 50000]);
  assert.deepEqual(balances(settleOf(mixed, [expense("e1", "liquor", 500, "p2")], "equal")).map((b) => b.net), [-25000, 25000]);
  // A rupee that doesn't divide: the paise still add up.
  const three = balances(settleOf(people, [expense("e1", "food", 100, "p2")]));
  assert.deepEqual(three.map((b) => b.share), [3334, 3333, 3333]);
});

test("several payers: fewest payments, greedy biggest-first", () => {
  const people = [person("p1", "Arjun"), person("p2", "Riya"), person("p3", "Kabir"), person("p4", "Meera", false), person("p5", "Dev")];
  const s = settleOf(people, [expense("e1", "liquor", 8000, "p1"), expense("e2", "food", 3500, "p2"), expense("e3", "supplies", 900, "p3")]);
  const ts = transfers(balances(s));
  assert.ok(ts.length <= 4);
  assert.deepEqual(ts[0], { from: "p5", to: "p1", amount: 2880, key: "p5>p1:2880" });   // Dev owes most, Arjun is owed most
});

test("zero expenses → no transfers; removing a payer reassigns their bills", () => {
  const people = [person("p1", "Arjun"), person("p2", "Riya"), person("p3", "Kabir")];
  assert.deepEqual(transfers(balances(settleOf(people, []))), []);
  assert.deepEqual(transfers(balances(settleOf(people, [expense("e1", "food", 0, "p2")]))), []);
  assert.deepEqual(balances(settleOf([], [expense("e1", "food", 100, "p1")])), []);

  const s = { ...settleOf(people, [expense("e1", "food", 900, "p2"), expense("e2", "liquor", 600, "p3")]), paid: { "p1>p2:300": true, "p3>p1:100": true } };
  const { settle: next, moved } = removePerson(s, "p2");
  assert.equal(moved, 1);
  assert.deepEqual(next.people.map((p) => p.id), ["p1", "p3"]);
  assert.equal(next.expenses.find((e) => e.id === "e1").paidBy, "p1");
  assert.equal(next.expenses.find((e) => e.id === "e2").paidBy, "p3");
  assert.deepEqual(next.paid, { "p3>p1:100": true });   // ticks involving Riya are gone
  assert.equal(removePerson(next, "nobody").moved, 0);
  // The last person can't be removed.
  const solo = removePerson(settleOf([person("p1", "A")], []), "p1").settle;
  assert.equal(solo.people.length, 1);
});

test("startSettle prefills from the plan: people, one bill per Zomato restaurant, a ₹0 Bistro row", () => {
  const foodCart = [
    { kind: "zomato", unitPrice: 300, qty: 2, restaurant: { resId: 11, name: "Biryani Blues" } },
    { kind: "zomato", unitPrice: 250.5, qty: 2, restaurant: { resId: 11, name: "Biryani Blues" } },
    { kind: "zomato", unitPrice: 199, qty: 3, restaurant: { resId: 22, name: "Wow! Momo" } },
    { kind: "bistro", qty: 4, name: "Samosa" },
    { kind: "blinkit", qty: 2, product: { price: 20 } },
  ];
  const party = { name: "Diwali night", host: "Arjun", upi: "arjun@okhdfc", date: "2026-11-07", time: "20:00" };
  const now = new Date("2026-11-07T23:00:00").getTime();
  const s = startSettle({ party, split: { mode: "fair" }, plan: { guests: 5, drinkers: 3 }, liquorTotal: 6400.4, foodCart, blinkitTotal: 840 }, now);
  assert.equal(s.title, "Diwali night");
  assert.equal(s.when, "2026-11-07 20:00");
  assert.equal(s.mode, "fair");
  assert.deepEqual(s.people.map((p) => [p.name, p.drinks]), [["Arjun", true], ["Guest 2", true], ["Guest 3", true], ["Guest 4", false], ["Guest 5", false]]);
  assert.equal(s.people[0].upi, "arjun@okhdfc");
  assert.deepEqual(s.expenses.map((e) => [e.what, e.part, e.amount]), [
    ["Bottles", "liquor", 6400], ["Biryani Blues", "food", 1101], ["Wow! Momo", "food", 597], ["Bistro", "food", 0], ["Supplies", "supplies", 840],
  ]);
  assert.ok(s.expenses.every((e) => e.paidBy === "p1" && e.planned));
  assert.deepEqual(settleSummary(s).transfers.map((t) => t.to), ["p1", "p1", "p1", "p1"]);

  // A split card override, parts left out, and an empty plan.
  const custom = startSettle({ party, split: { people: 3, drinkers: 1, mode: "equal", include: { liquor: false } }, plan: { guests: 10, drinkers: 8 }, liquorTotal: 5000, foodCart, blinkitTotal: 840 }, now);
  assert.equal(custom.people.length, 3);
  assert.equal(custom.mode, "equal");
  assert.ok(!custom.expenses.some((e) => e.part === "liquor"));
  const empty = startSettle({ party: {}, plan: { guests: 2, drinkers: 2 } }, now);
  assert.deepEqual(empty.expenses.map((e) => [e.what, e.amount]), [["Bottles", 0]]);
  assert.equal(empty.people[0].name, "Host");
  assert.equal(empty.title, "House party");
  assert.equal(startSettle().people.length, 1);
});

test("the morning after, a date that has rolled on isn't used", () => {
  const party = { name: "Match night", date: "2026-11-14", time: "20:00" };   // App rolled it to next Saturday
  const s = startSettle({ party, plan: { guests: 4, drinkers: 4 } }, new Date("2026-11-08T11:00:00").getTime());
  assert.equal(s.when, null);
  assert.doesNotMatch(settleMessage(s), /Nov/);
});

test("edits: amounts become actual, people come and go, names paste in", () => {
  let s = startSettle({ party: { host: "Arjun" }, plan: { guests: 4, drinkers: 3 }, liquorTotal: 4000 });
  s = patchExpense(s, "e1", { amount: "4210.6" });
  assert.deepEqual([s.expenses[0].amount, s.expenses[0].planned], [4211, false]);
  s = patchExpense(s, "e1", { what: "Bottles from Wine Point" });
  assert.equal(s.expenses[0].planned, false);
  assert.equal(patchExpense(s, "e1", { amount: -5 }).expenses[0].amount, 0);
  assert.equal(rupees(1e12), 10000000);

  s = addExpense(s);
  assert.deepEqual(s.expenses.map((e) => e.id), ["e1", "e2"]);
  assert.equal(s.expenses[1].paidBy, "p1");
  s = removeExpense(s, "e2");
  assert.equal(s.expenses.length, 1);

  const pasted = pasteNames(s, "1. Riya\n- Kabir, riya ,  Meera   Shah;Arjun\n\nDev");
  assert.deepEqual(pasted.settle.people.map((p) => p.name), ["Arjun", "Riya", "Kabir", "Meera Shah", "Dev"]);
  assert.deepEqual([pasted.renamed, pasted.added], [3, 1]);
  assert.equal(pasted.settle.people[4].id, "p5");
  assert.equal(pasteNames(s, " , \n").added, 0);

  s = addPerson(s);
  assert.equal(s.people.at(-1).name, "Guest 5");
  s = removePerson(s, "p2").settle;
  s = addPerson(s);
  assert.equal(s.people.at(-1).name, "Guest 6");   // "Guest 5" is still taken
  assert.equal(s.people.at(-1).id, "p6");
  assert.equal(patchPerson(s, "p3", { drinks: false }).people.find((p) => p.id === "p3").drinks, false);
  assert.equal(newId([{ id: "e2" }, { id: "e10" }, { id: "x99" }], "e"), "e11");
});

test("old or partial cfg is read safely", () => {
  assert.equal(normalizeSettle(null), null);
  assert.equal(settleSummary(undefined), null);
  const n = normalizeSettle({ people: [{ id: 1, name: "A" }, null], expenses: [{ id: "e1", amount: "250", part: "drinks" }] });
  assert.deepEqual(n.people, [{ id: "1", name: "A", drinks: true, upi: "" }]);
  assert.deepEqual(n.expenses[0], { id: "e1", what: "", part: "other", amount: 250, paidBy: "", planned: false });
  assert.equal(n.mode, "fair");
  assert.deepEqual(n.paid, {});
  const sum = settleSummary({ people: [{ id: "p1", name: "A" }], expenses: [] });
  assert.deepEqual([sum.transfers.length, sum.paid, sum.done, sum.total], [0, 0, true, 0]);
});

test("the WhatsApp text: payments, UPI IDs, ticks — and no upi:// links", () => {
  const people = [person("p1", "Arjun", true, "arjun@okhdfc"), person("p2", "Riya", true, "riya@ybl"), person("p3", "Kabir"), person("p4", "Meera", false)];
  const s = { ...settleOf(people, [expense("e1", "liquor", 6000, "p1"), expense("e2", "food", 2000, "p2")]), when: "2026-11-07 20:00", title: "Diwali night" };
  const sum = settleSummary(s);
  const withTick = { ...s, paid: { [sum.transfers[0].key]: true } };
  const msg = settleMessage(withTick);
  assert.match(msg, /Diwali night/);
  assert.match(msg, /Actual total ₹8,000 between 4 of us, drinks split among the drinkers/);
  assert.match(msg, /Paid: Arjun ₹6,000 · Riya ₹2,000/);
  assert.match(msg, /Kabir → Arjun ₹2,500 ✅ paid/);
  assert.match(msg, /Meera → /);
  assert.match(msg, /UPI for Arjun: arjun@okhdfc/);
  assert.match(msg, /Reply when you've paid/);
  assert.doesNotMatch(msg, /upi:\/\//i);
  assert.doesNotMatch(msg, /UPI for Riya/);   // Riya's share is more than her ₹2,000 food bill, so she pays rather than gets paid
  const square = settleMessage(settleOf(people, []));
  assert.match(square, /Everyone's square/);
  assert.doesNotMatch(square, /Reply when/);
});
