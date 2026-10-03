// ═══════════════════════════════════════════════════════════════════════════════
//  SETTLE UP — after the party: the actual bills, who paid them, and the fewest
//  payments that square everyone up. It starts from the plan (startSettle), then
//  the host edits it to what was really paid. One settle-up at a time, kept on
//  the phone in cfg, so it survives the party date rolling on to next Saturday.
//
//  App state `settle` (null = none):
//    { title, when, createdAt, mode: "fair" | "equal", paid: { [transferKey]: true },
//      people:   [{ id, name, drinks, upi }],
//      expenses: [{ id, what, part: "liquor" | "food" | "supplies" | "other", amount, paidBy, planned }] }
//  Amounts are whole rupees. Shares are worked out in paise so nothing is lost to
//  rounding; payments are rounded to the rupee. "fair" splits liquor among the
//  drinkers (everyone, if nobody drank) and the rest among everyone, like split.js.
//  Shared text has no upi:// links (NPCI, see split.js); the sheet shows a QR instead.
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════
import { fmt } from "./format.js";
import { resolveSplit, validVpa } from "./split.js";
import { partyStart, partyWhen, prettyWhen } from "./when.js";

export const PARTS = {
  liquor:   { label: "Liquor",   emoji: "🥃" },
  food:     { label: "Food",     emoji: "🍽️" },
  supplies: { label: "Supplies", emoji: "🛒" },
  other:    { label: "Other",    emoji: "🧾" },
};
export const MAX_AMOUNT = 10000000; // ₹1 crore — a typo guard, not a limit anyone should hit
const MAX_PEOPLE = 100;             // a bigger party doesn't settle up person by person

// Whole, non-negative rupees.
export const rupees = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_AMOUNT) : 0;
};

const GUEST = /^Guest \d+$/;
const nameOf = (p) => String(p?.name || "").trim();

// "p4" after p1..p3 (ids stay unique when people come and go).
export function newId(list, prefix) {
  let max = 0;
  for (const x of list || []) {
    const id = String(x?.id || "");
    if (!id.startsWith(prefix)) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

// A stored settle-up with every field present (old or hand-edited cfg can miss some); null stays null.
export function normalizeSettle(s) {
  if (!s || typeof s !== "object") return null;
  const people = (Array.isArray(s.people) ? s.people : []).filter((p) => p && p.id != null)
    .map((p) => ({ id: String(p.id), name: String(p.name ?? ""), drinks: p.drinks !== false, upi: String(p.upi ?? "") }));
  const expenses = (Array.isArray(s.expenses) ? s.expenses : []).filter((e) => e && e.id != null)
    .map((e) => ({
      id: String(e.id), what: String(e.what ?? ""), part: PARTS[e.part] ? e.part : "other",
      amount: rupees(e.amount), paidBy: e.paidBy == null ? "" : String(e.paidBy), planned: !!e.planned,
    }));
  return {
    title: String(s.title || "").trim() || "House party",
    when: typeof s.when === "string" ? s.when : null,
    createdAt: Number(s.createdAt) || 0,
    mode: s.mode === "equal" ? "equal" : "fair",
    paid: s.paid && typeof s.paid === "object" ? s.paid : {},
    people, expenses,
  };
}

// A fresh settle-up from the plan: the host plus "Guest 2…N" (the first `drinkers` of them
// drinking, as in the split card), and one expense per planned bill, all paid by the host.
// Parts left out of the split card stay out. Bistro is priced in its app, so it starts at ₹0.
export function startSettle({ party, split, plan, liquorTotal = 0, foodCart = [], blinkitTotal = 0 } = {}, now = Date.now()) {
  const r = resolveSplit(split, plan);
  const n = Math.min(r.people, MAX_PEOPLE);
  const host = String(party?.host || "").trim() || "Host";
  const people = Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`, name: i === 0 ? host : `Guest ${i + 1}`, drinks: i < r.drinkers, upi: i === 0 ? String(party?.upi || "").trim() : "",
  }));

  const expenses = [];
  const add = (what, part, amount) => expenses.push({ id: `e${expenses.length + 1}`, what, part, amount: rupees(amount), paidBy: "p1", planned: true });
  const lines = Array.isArray(foodCart) ? foodCart : [];
  if (r.include.liquor && liquorTotal > 0) add("Bottles", "liquor", liquorTotal);
  if (r.include.food) {
    const rest = new Map();
    for (const l of lines) {
      if (l?.kind !== "zomato") continue;
      const key = l.restaurant?.resId ?? l.restaurant?.name ?? "zomato";
      const cur = rest.get(key) || { name: String(l.restaurant?.name || "").trim() || "Zomato order", total: 0 };
      cur.total += (Number(l.unitPrice) || 0) * (Number(l.qty) || 0);
      rest.set(key, cur);
    }
    for (const { name, total } of rest.values()) add(name, "food", total);
    if (lines.some((l) => l?.kind === "bistro")) add("Bistro", "food", 0);
  }
  if (r.include.supplies && blinkitTotal > 0) add("Supplies", "supplies", blinkitTotal);
  if (!expenses.length) add("Bottles", "liquor", 0);

  // The morning after, App has already rolled the party date on to next Saturday, so a date
  // still ahead isn't the party being settled: leave it out rather than show the wrong day.
  const start = partyStart(party);
  return {
    title: String(party?.name || "").trim() || "House party",
    when: start && start.getTime() <= now + 6 * 3600000 ? partyWhen(party) : null,
    createdAt: now,
    mode: r.mode,
    paid: {},
    people, expenses,
  };
}

export const expenseTotal = (settle) => (normalizeSettle(settle)?.expenses || []).reduce((s, e) => s + e.amount, 0);

// Per person, in paise: what they paid, their share, and net (+ gets money back, − owes).
// Remainder paise go to the first sharers in list order, so Σ net is exactly 0.
// An expense whose payer has been removed counts as paid by the first person.
export function balances(settle) {
  const s = normalizeSettle(settle);
  if (!s || !s.people.length) return [];
  const { people } = s;
  const index = new Map(people.map((p, i) => [p.id, i]));
  const paid = people.map(() => 0), share = people.map(() => 0);
  const everyone = people.map((_, i) => i);
  const drinkers = everyone.filter((i) => people[i].drinks);
  for (const e of s.expenses) {
    const amt = e.amount * 100;
    if (!amt) continue;
    paid[index.get(e.paidBy) ?? 0] += amt;
    const among = s.mode === "fair" && e.part === "liquor" && drinkers.length ? drinkers : everyone;
    const base = Math.floor(amt / among.length);
    let extra = amt - base * among.length;
    for (const i of among) {
      share[i] += base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
    }
  }
  return people.map((p, i) => ({ id: p.id, name: nameOf(p), paid: paid[i], share: share[i], net: paid[i] - share[i] }));
}

// Who pays whom, in whole rupees: each net is rounded so they still add up to zero (floor,
// then +₹1 for the largest remainders — so nobody is off by a rupee or more), then the
// biggest debtor pays the biggest creditor. Each payment squares at least one person, so
// n people need at most n − 1. `key` identifies a payment for its "Paid" tick.
export function transfers(bals) {
  const list = (bals || []).filter((b) => b && Number.isFinite(b.net));
  const net = list.map((b) => Math.floor(b.net / 100));
  const rem = list.map((b, i) => b.net - net[i] * 100);
  let up = Math.round(rem.reduce((s, r) => s + r, 0) / 100);
  const order = rem.map((_, i) => i).sort((a, b) => rem[b] - rem[a] || a - b);
  for (const i of order) {
    if (up <= 0) break;
    net[i]++;
    up--;
  }
  const out = [];
  for (let step = 0; step < list.length; step++) {
    let d = -1, c = -1;
    net.forEach((v, i) => {
      if (v < 0 && (d < 0 || v < net[d])) d = i;
      if (v > 0 && (c < 0 || v > net[c])) c = i;
    });
    if (d < 0 || c < 0) break;
    const amount = Math.min(-net[d], net[c]);
    net[d] += amount;
    net[c] -= amount;
    out.push({ from: list[d].id, to: list[c].id, amount, key: `${list[d].id}>${list[c].id}:${amount}` });
  }
  return out;
}

// Everything the sheet and the split card show, in one go.
export function settleSummary(settle) {
  const s = normalizeSettle(settle);
  if (!s) return null;
  const bals = balances(s);
  const ts = transfers(bals);
  const paid = ts.filter((t) => s.paid[t.key]).length;
  return { settle: s, balances: bals, transfers: ts, paid, total: expenseTotal(s), done: paid === ts.length };
}

// ── Edits (each returns a new settle-up) ─────────────────────────────────────
export function addPerson(settle, name) {
  const s = normalizeSettle(settle);
  const taken = new Set(s.people.map((p) => nameOf(p).toLowerCase()));
  let n = s.people.length + 1;
  while (taken.has(`guest ${n}`)) n++;
  const person = { id: newId(s.people, "p"), name: String(name || "").trim() || `Guest ${n}`, drinks: true, upi: "" };
  return { ...s, people: [...s.people, person] };
}

// Removes a person; whatever they paid moves to the first person left (`moved` = how many
// bills). Ticks on their payments go too, so a later person reusing the id starts clean.
export function removePerson(settle, id) {
  const s = normalizeSettle(settle);
  if (!s.people.some((p) => p.id === id) || s.people.length <= 1) return { settle: s, moved: 0 };
  const people = s.people.filter((p) => p.id !== id);
  const ids = new Set(people.map((p) => p.id));
  let moved = 0;
  const expenses = s.expenses.map((e) => {
    if (ids.has(e.paidBy)) return e;
    if (e.paidBy === id && e.amount > 0) moved++;
    return { ...e, paidBy: people[0].id };
  });
  const paid = Object.fromEntries(Object.entries(s.paid).filter(([k]) => {
    const [from, to] = k.split(":")[0].split(">");
    return from !== id && to !== id;
  }));
  return { settle: { ...s, people, expenses, paid }, moved };
}

export function patchPerson(settle, id, patch) {
  const s = normalizeSettle(settle);
  return { ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

// Editing the amount turns a planned figure into an actual one.
export function patchExpense(settle, id, patch) {
  const s = normalizeSettle(settle);
  const fix = "amount" in patch ? { amount: rupees(patch.amount), planned: false } : {};
  return { ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch, ...fix } : e)) };
}

export function addExpense(settle) {
  const s = normalizeSettle(settle);
  const e = { id: newId(s.expenses, "e"), what: "", part: "other", amount: 0, paidBy: s.people[0]?.id || "", planned: false };
  return { ...s, expenses: [...s.expenses, e] };
}

export function removeExpense(settle, id) {
  const s = normalizeSettle(settle);
  return { ...s, expenses: s.expenses.filter((e) => e.id !== id) };
}

// Names pasted from a chat ("Riya, Kabir" or one per line, bullets and numbers allowed):
// they replace the "Guest n" placeholders in order, then any extra become new people.
// Names already on the list are skipped.
export function pasteNames(settle, text) {
  const s = normalizeSettle(settle);
  const seen = new Set(s.people.map((p) => nameOf(p).toLowerCase()));
  const names = [];
  for (const raw of String(text || "").split(/[\n,;]+/)) {
    const n = raw.replace(/^\s*(?:[-*•]+|\d+[.)])\s*/u, "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    names.push(n);
  }
  let i = 0, renamed = 0, added = 0;
  const people = s.people.map((p) => {
    if (i >= names.length || !GUEST.test(nameOf(p))) return p;
    renamed++;
    return { ...p, name: names[i++] };
  });
  let next = { ...s, people };
  while (i < names.length) { next = addPerson(next, names[i++]); added++; }
  return { settle: next, renamed, added };
}

// ── Sharing ──────────────────────────────────────────────────────────────────
// Plain text for WhatsApp & co: the payments, and the UPI IDs to pay (no upi:// links).
export function settleMessage(settle, ts) {
  const s = normalizeSettle(settle);
  if (!s) return "";
  const bals = balances(s);
  const pays = ts || transfers(bals);
  const byId = new Map(s.people.map((p, i) => [p.id, nameOf(p) || `Person ${i + 1}`]));
  const who = (id) => byId.get(id) || "Someone";
  const when = prettyWhen(s.when);
  const total = expenseTotal(s);
  const someSober = s.people.some((p) => !p.drinks) && s.people.some((p) => p.drinks);
  const drinksApart = s.mode === "fair" && someSober && s.expenses.some((e) => e.part === "liquor" && e.amount > 0);

  const lines = [
    `🧾 *${s.title}* — settling up${when ? ` (${when})` : ""}`,
    `Actual total ${fmt(total)} between ${s.people.length} of us${drinksApart ? ", drinks split among the drinkers" : ""}.`,
  ];
  const payers = bals.filter((b) => b.paid > 0).map((b) => `${who(b.id)} ${fmt(b.paid / 100)}`);
  if (payers.length) lines.push(`Paid: ${payers.join(" · ")}`);
  lines.push("");
  if (!pays.length) lines.push("Everyone's square, nothing to pay 🎉");
  for (const t of pays) lines.push(`${who(t.from)} → ${who(t.to)} ${fmt(t.amount)}${s.paid[t.key] ? " ✅ paid" : ""}`);
  const upis = [...new Set(pays.map((t) => t.to))]
    .map((id) => s.people.find((p) => p.id === id))
    .filter((p) => p && validVpa(p.upi));
  if (upis.length) {
    lines.push("");
    for (const p of upis) lines.push(`UPI for ${who(p.id)}: ${p.upi.trim()}`);
  }
  if (pays.some((t) => !s.paid[t.key])) lines.push("", "Rounded to the rupee. Reply when you've paid 🙏");
  return lines.join("\n");
}
