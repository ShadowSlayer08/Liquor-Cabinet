// ═══════════════════════════════════════════════════════════════════════════════
//  PARTY HISTORY — past parties, so the next plan starts from the last one (v1.6).
//  Each entry is a plan snapshot (lib/planSnapshot.js) plus what really happened:
//  the settle-up's real bills (lib/settle.js) and an `outcome` the host fills in —
//  what it actually cost if they know, how many bottles of each spirit were left
//  over, which ran out, a short note. Kept on the phone in its own durable key
//  ("history", lib/store.js), newest party first, capped.
//
//  The outcome is the only part the host types, so saving the same party again
//  (the auto-archive the day after, a second "Save this party") never replaces it.
//  A settle-up is one at a time and outlives the party date, so an entry only takes
//  one that belongs to it: the same name, on that night or in the weeks after.
//  Actual spend is never guessed: no filled-in settle-up and no figure from the
//  host means it's unknown.
//
//  After a party App rolls the date on to the coming Saturday and keeps the carts, so
//  an untouched plan would be archived again every week as a party that never
//  happened: addEntry() skips that one. When the list is full, the oldest parties
//  with nothing typed and no real bills go first, never the one just saved.
//
//  replayPlan() turns an entry back into a plan for App's applyPlan(): the same
//  settings with no date (it rolls on to the coming Saturday), today's prices,
//  leftovers off what to buy, a little more of what ran out, and a plain note for
//  every change. Nothing here changes its inputs.
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════
import { CAT, cityName } from "./parse/livcheers.js";
import { FAMILIES, familyOfCat } from "./cocktails.js";
import { hasPlan, restoreSnapshot, snapshotSummary } from "./planSnapshot.js";
import { normalizeSettle } from "./settle.js";
import { isOut, outSpend } from "./outModel.js";
import { homeParts } from "./split.js";
import { partyStart } from "./when.js";
import { nextSaturday, todayISO } from "./drydays.js";
import { fmt, fmtShort } from "./format.js";

export const HISTORY_MAX = 30;

const HOUR = 3600000, DAY = 24 * HOUR;
// A settle-up with no date of its own is a party's when it was started from 6 h before the
// party to three weeks after it. (The morning after, App has already rolled the date on, so
// settle.js leaves the date out.) 6 h is settle.js's own window: a settle-up started earlier
// than that before the plan's party gets no date, so it can never be that plan's, which is
// what keeps a Friday party's morning-after bills off the rolled-on Saturday plan.
const SETTLE_FROM = 6 * HOUR, SETTLE_TO = 21 * DAY;
const SOURCES = ["auto", "manual", "import"];
const plain = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const isoDay = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const clampInt = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fewer = (n) => (n === 1 ? "1 less" : `${n} fewer`);

/**
 * @typedef {object} HistoryEntry
 * @property {string} id          stable per party: `${date}|${name}` (a re-save replaces it); a co-host's plan gets "|import"
 * @property {number} savedAt
 * @property {object} snapshot    snapshotPlan() output (not the shared kind: keeps photos and the UPI ID)
 * @property {object|null} settle the settle-up as it was (lib/settle.js shape), for the actual spend
 * @property {"auto"|"manual"|"import"} source  archived when the date passed, saved by the host, or a co-host's plan
 * @property {Outcome} outcome    what the host says happened (normalizeOutcome)
 *
 * @typedef {object} Outcome
 * @property {number|null} spent        ₹ the host says it really cost (null = take the settle-up's, or unknown)
 * @property {Object<string, number>} left  spirit family → bottles left over
 * @property {string[]} ranOut          spirit families that ran out
 * @property {string} note
 * @property {number} editedAt
 */

export const entryId = (snapshot) => `${snapshot?.party?.date || "undated"}|${(snapshot?.party?.name || "Party").trim()}`;

// ── Spirit families ───────────────────────────────────────────────────────────
// Leftovers and "ran out" go by family (cocktails.js FAMILIES: any whisky, any gin…); sake and
// ready-to-drink have no family, so their category stands in.
export const familyKey = (cat) => familyOfCat(cat) || String(cat || "other");
export const familyLabel = (f) => FAMILIES[f]?.label || CAT[f]?.label || String(f);
// Beer and cans run out by the few, not by the bottle.
const byTheFew = (cat) => ["beer", "can"].includes(CAT[cat]?.serve?.kind);
const FAMILY_ORDER = Object.keys(FAMILIES);
const famRank = (f) => { const i = FAMILY_ORDER.indexOf(f); return i < 0 ? 99 : i; };

/** The families a plan bought, in the usual order: [{ id, label, bottles, lines: [{ key, cat, name, qty }] }] */
export function boughtFamilies(plan) {
  const out = {};
  for (const [key, l] of Object.entries(plan?.liquor || {})) {
    if (!l?.item || !(l.qty > 0)) continue;
    const f = familyKey(l.cat);
    const x = out[f] || (out[f] = { id: f, label: familyLabel(f), bottles: 0, lines: [] });
    x.bottles += l.qty;
    x.lines.push({ key, cat: l.cat, name: l.item.name, qty: l.qty });
  }
  return Object.values(out).sort((a, b) => famRank(a.id) - famRank(b.id));
}

// ── Reading entries ───────────────────────────────────────────────────────────

/** The entry's plan, checked (an old entry, or a co-host's plan kept here); null when it can't be read. */
export function entryPlan(entry) {
  if (!plain(entry) || !plain(entry.snapshot)) return null;
  try { return restoreSnapshot(entry.snapshot); } catch { return null; }
}

const dayOf = (e) => isoDay(e?.snapshot?.party?.date) || todayISO(new Date(Number(e?.savedAt) || 0));
// Newest party first (an undated one by when it was saved); the same day, the last saved first.
export const sortEntries = (list) => [...list].sort((a, b) => {
  const x = dayOf(a), y = dayOf(b);
  return x < y ? 1 : x > y ? -1 : (Number(b?.savedAt) || 0) - (Number(a?.savedAt) || 0);
});

/** What the list shows: readable entries, newest first, each with its checked plan. Garbage is skipped. */
export function readHistory(list) {
  return sortEntries((Array.isArray(list) ? list : []).filter((e) => plain(e) && typeof e.id === "string"))
    .map((entry) => ({ entry, plan: entryPlan(entry) }))
    .filter((r) => r.plan);
}

// ── Outcome (what the host says happened) ─────────────────────────────────────

export const EMPTY_OUTCOME = Object.freeze({ spent: null, left: Object.freeze({}), ranOut: Object.freeze([]), note: "", editedAt: 0 });

/**
 * A clean outcome. With the entry's plan, only families it bought count and leftovers can't
 * be more than were bought. A family that ran out has no leftovers.
 */
export function normalizeOutcome(o, plan = null) {
  const x = plain(o) ? o : {};
  const fams = plan ? new Map(boughtFamilies(plan).map((f) => [f.id, f.bottles])) : null;
  const ok = (f) => typeof f === "string" && f.length > 0 && f.length <= 20 && (!fams || fams.has(f));
  const ranOut = [...new Set(Array.isArray(x.ranOut) ? x.ranOut.filter(ok) : [])].slice(0, 30);
  const left = {};
  if (plain(x.left)) {
    for (const [f, n] of Object.entries(x.left)) {
      if (!ok(f) || ranOut.includes(f)) continue;
      const v = clampInt(n, 0, fams ? fams.get(f) : 500);
      if (v > 0) left[f] = v;
    }
  }
  const spent = x.spent == null || x.spent === "" ? null : clampInt(x.spent, 0, 1e8);
  return { spent: spent > 0 ? spent : null, left, ranOut, note: typeof x.note === "string" ? x.note.slice(0, 200) : "", editedAt: Number(x.editedAt) || 0 };
}

export const hasOutcome = (o) => {
  const x = normalizeOutcome(o);
  return x.spent != null || Object.keys(x.left).length > 0 || x.ranOut.length > 0 || !!x.note.trim();
};

/** n bottles of a family left over (0 clears it). Leftovers mean it didn't run out. */
export function withLeftover(outcome, family, n) {
  const o = normalizeOutcome(outcome);
  const left = { ...o.left };
  const v = clampInt(n, 0, 500) || 0;
  if (v > 0) left[family] = v; else delete left[family];
  return { ...o, left, ranOut: v > 0 ? o.ranOut.filter((f) => f !== family) : o.ranOut };
}

/** A family ran out (or didn't after all). Running out means nothing was left over. */
export function withRanOut(outcome, family, on = true) {
  const o = normalizeOutcome(outcome);
  const left = { ...o.left };
  if (on) delete left[family];
  return { ...o, left, ranOut: on ? [...new Set([...o.ranOut, family])] : o.ranOut.filter((f) => f !== family) };
}

/** One entry's outcome changed: `change` is a patch or (outcome) → outcome. Other entries stay as they are. */
export function updateOutcome(list, id, change, now = Date.now()) {
  return (Array.isArray(list) ? list : []).map((e) => {
    if (!plain(e) || e.id !== id) return e;
    const cur = normalizeOutcome(e.outcome);
    const next = typeof change === "function" ? change(cur) : { ...cur, ...change };
    return { ...e, outcome: { ...normalizeOutcome(next), editedAt: now } };
  });
}

// ── Settle-up ─────────────────────────────────────────────────────────────────

/**
 * Whether a settle-up is this party's: the same name (settle.js titles a nameless party
 * "House party" or "Night out") and either its own date, or started on the night or in the
 * three weeks after (from 6 h before, for one started ahead).
 */
export function settleBelongs(settle, snapshot) {
  const s = normalizeSettle(settle);
  const p = snapshot?.party;
  if (!s || !plain(p) || !isoDay(p.date)) return false;
  const name = String(p.name || "").trim().toLowerCase(), title = s.title.trim().toLowerCase();
  if (name ? title !== name : !["house party", "night out"].includes(title)) return false;
  if (s.when) return s.when.slice(0, 10) === p.date;
  const start = partyStart(p)?.getTime();
  if (!Number.isFinite(start) || !s.createdAt) return false;
  return s.createdAt >= start - SETTLE_FROM && s.createdAt <= start + SETTLE_TO;
}

/** The host has filled it in: a bill changed to what was really paid, or a payment ticked. */
export function settleFilled(settle) {
  const s = normalizeSettle(settle);
  return !!s && (s.expenses.some((e) => !e.planned && e.amount > 0) || Object.values(s.paid).some(Boolean));
}

// The newer settle-up, unless it's only the plan's figures again and the older one was filled in
// ("Start again from the plan" mustn't undo the real bills already kept here).
const pickSettle = (prev, next) => (next && (settleFilled(next) || !prev) ? next : prev || null);

/**
 * The current settle-up into the past party it belongs to (the newest), when that adds
 * something. Otherwise the same list back, so an effect can call it on every change.
 * A co-host's plan kept here never takes the host's settle-up.
 */
export function attachSettle(list, settle) {
  if (!Array.isArray(list) || !settle) return list;
  const rows = sortEntries(list.filter((e) => plain(e) && typeof e.id === "string" && e.source !== "import"));
  const hit = rows.find((e) => plain(e.snapshot) && settleBelongs(settle, e.snapshot));
  if (!hit) return list;
  const next = pickSettle(hit.settle, normalizeSettle(settle));
  if (next === hit.settle || JSON.stringify(next) === JSON.stringify(hit.settle)) return list;
  return list.map((e) => (e === hit ? { ...e, settle: next } : e));
}

// ── Entries in the list ───────────────────────────────────────────────────────

/** @returns {HistoryEntry} — a settle-up that isn't this party's is left out */
export const makeEntry = (snapshot, { settle = null, source = "manual", now = Date.now(), outcome = null } = {}) => ({
  id: source === "import" ? `${entryId(snapshot)}|import` : entryId(snapshot),
  savedAt: now,
  snapshot,
  settle: settle && settleBelongs(settle, snapshot) ? normalizeSettle(settle) : null,
  source: SOURCES.includes(source) ? source : "manual",
  outcome: normalizeOutcome(outcome),
});

/**
 * What a plan is, leaving out its date and the host's own name and UPI ID: the party
 * settings, every bottle, dish and supply with its quantity and price, the drinks menu and
 * the night out. Two snapshots with the same key are the same plan on another date.
 * null when the snapshot can't be read.
 */
export function planKey(snapshot) {
  let p;
  try { p = restoreSnapshot(snapshot); } catch { return null; }
  const { date: _d, host: _h, upi: _u, ...party } = p.party;
  const out = isOut(p.out)
    ? [p.out.kind, p.out.pick.type, p.out.pick.url || p.out.pick.name, (p.out.tickets || []).map((t) => [String(t.id ?? t.name), t.qty, t.price]).sort()]
    : null;
  return JSON.stringify([
    p.city, p.budget, party,
    Object.entries(p.liquor).map(([k, l]) => [k, l.qty, l.item.price]).sort(),
    p.food.map((l) => [l.key, l.qty, l.kind === "zomato" ? l.unitPrice : l.kind === "blinkit" ? l.product.price : 0]).sort(),
    p.cocktailMenu.map((m) => [m.id, m.servings]).sort(),
    out,
  ]);
}

const nameOf = (e) => String(e?.snapshot?.party?.name || "").trim().toLowerCase();
const kept = (e) => hasOutcome(e?.outcome) || settleFilled(e?.settle);

/**
 * The plan App archives by itself after a party is the plan it rolled on to the coming Saturday
 * and nobody touched: the same name and plan as the last party kept, on a later date, with no
 * settle-up of its own. That party never happened, so it isn't kept.
 */
function rolledOver(all, entry) {
  if (entry.source !== "auto" || entry.settle) return false;
  const day = isoDay(entry.snapshot?.party?.date);
  const key = planKey(entry.snapshot);
  if (!day || !key) return false;
  const last = sortEntries(all.filter((e) => e.source !== "import" && nameOf(e) === nameOf(entry)))[0];
  const lastDay = isoDay(last?.snapshot?.party?.date);
  return !!lastDay && lastDay < day && planKey(last.snapshot) === key;
}

/**
 * Newest party first; at most HISTORY_MAX. The same party saved again takes the new plan but
 * keeps the host's outcome and the filled-in settle-up. An untouched plan archived again by
 * itself is skipped (see rolledOver). Over the cap, the oldest party with nothing typed and no
 * real bills goes first, then the oldest; the entry being saved always stays.
 */
export function addEntry(list, entry) {
  const all = (Array.isArray(list) ? list : []).filter((e) => plain(e) && typeof e.id === "string");
  if (!plain(entry) || typeof entry.id !== "string") return all;
  const prev = all.find((e) => e.id === entry.id);
  if (!prev && rolledOver(all, entry)) return all;
  const next = !prev ? entry : {
    ...entry,
    source: SOURCES.includes(prev.source) ? prev.source : entry.source,
    outcome: hasOutcome(prev.outcome) ? normalizeOutcome(prev.outcome) : normalizeOutcome(entry.outcome),
    settle: pickSettle(prev.settle || null, entry.settle || null),
  };
  const rows = sortEntries([next, ...all.filter((e) => e.id !== entry.id)]);
  while (rows.length > HISTORY_MAX) {
    let drop = -1;
    for (let i = rows.length - 1; i >= 0 && drop < 0; i--) if (rows[i] !== next && !kept(rows[i])) drop = i;
    for (let i = rows.length - 1; i >= 0 && drop < 0; i--) if (rows[i] !== next) drop = i;
    rows.splice(drop, 1);
  }
  return rows;
}

export const removeEntry = (list, id) => (Array.isArray(list) ? list : []).filter((e) => e?.id !== id);

/**
 * Whether replacing this plan would lose something the host set up: anything in the carts, or
 * party details that aren't the app's defaults (a name, guests, prefs, a date other than the
 * coming Saturday). The host's own name and UPI ID don't count: "Plan again" keeps them.
 */
export function planInUse(snapshot, today = todayISO()) {
  if (hasPlan(snapshot)) return true;
  let p;
  try { p = restoreSnapshot(snapshot).party; } catch { return false; }
  const settings = ({ date: _d, host: _h, upi: _u, ...rest }) => JSON.stringify(rest);
  return settings(p) !== settings(restoreSnapshot({ v: 1 }).party) || (!!p.date && p.date !== nextSaturday(today));
}

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * What the plan said it would cost, counted the way the split card counts it: at home the
 * bottles (Livcheers, indicative), Zomato (estimates) and supplies (MRP); on a night out the
 * venue's estimate and the tickets, plus the bottles for a BYOB place. Bistro is priced in its app.
 */
export function plannedSpend(plan) {
  if (!plan) return { liquor: 0, food: 0, supplies: 0, venue: null, tickets: 0, total: 0, bistro: false, homeLeftOut: false };
  const home = homeParts(plan.out);
  const lines = plan.food || [];
  const liquor = Object.values(plan.liquor || {}).reduce((s, l) => s + (l.item?.price || 0) * (l.qty || 0), 0);
  const food = lines.filter((l) => l.kind === "zomato").reduce((s, l) => s + (l.unitPrice || 0) * (l.qty || 0), 0);
  const supplies = lines.filter((l) => l.kind === "blinkit").reduce((s, l) => s + (l.product?.price || 0) * (l.qty || 0), 0);
  const o = outSpend(plan.out, plan.party?.guests || 1);
  const counted = { liquor: home.liquor ? liquor : 0, food: home.food ? food : 0, supplies: home.supplies ? supplies : 0 };
  return {
    ...counted, venue: o.venue, tickets: o.tickets,
    total: counted.liquor + counted.food + counted.supplies + o.total,
    bistro: home.food && lines.some((l) => l.kind === "bistro"),
    homeLeftOut: (!home.liquor && liquor > 0) || (!home.food && food > 0) || (!home.supplies && supplies > 0),
  };
}
export const plannedTotal = (entry, plan = entryPlan(entry)) => plannedSpend(plan).total;

/**
 * What it really cost: the host's own figure, else a filled-in settle-up's bills, else unknown.
 * `planned` = settle-up bills still at the plan's figure (counted, and said so).
 * @returns {{ total: number|null, source: "you"|"settle"|null, people: number|null, planned: number }}
 */
export function actualSpend(entry, plan = entryPlan(entry)) {
  const o = normalizeOutcome(entry?.outcome);
  const s = normalizeSettle(entry?.settle);
  const people = s?.people.length || plan?.party?.guests || null;
  if (o.spent != null) return { total: o.spent, source: "you", people, planned: 0 };
  if (s && settleFilled(s)) {
    return { total: s.expenses.reduce((n, e) => n + e.amount, 0), source: "settle", people, planned: s.expenses.filter((e) => e.planned && e.amount > 0).length };
  }
  return { total: null, source: null, people, planned: 0 };
}
export const actualTotal = (entry, plan = entryPlan(entry)) => actualSpend(entry, plan).total;
export function perHead(entry, plan = entryPlan(entry)) {
  const a = actualSpend(entry, plan);
  return a.total != null && a.people > 0 ? Math.round(a.total / a.people) : null;
}

/** "12 guests · 6 bottles · planned ₹21.4k · spent ₹19.8k (₹1,650 a head)" */
export function summaryLine(entry, plan = entryPlan(entry)) {
  if (!plan) return "";
  const s = snapshotSummary(plan);
  const planned = plannedSpend(plan).total;
  const a = actualSpend(entry, plan);
  const head = a.total != null && a.people > 0 ? Math.round(a.total / a.people) : null;
  return [
    s.guests && plural(s.guests, "guest"),
    s.out && s.place,
    s.bottles > 0 && plural(s.bottles, "bottle"),
    s.dishes > 0 && plural(s.dishes, "dish", "dishes"),
    planned > 0 && `planned ${fmtShort(planned)}`,
    a.total != null && `spent ${fmtShort(a.total)}${head != null ? ` (${fmt(head)} a head)` : ""}`,
  ].filter(Boolean).join(" · ");
}

// ── Plan again ────────────────────────────────────────────────────────────────

/**
 * A past party as a new plan, restoreSnapshot()-shaped, for App's applyPlan():
 *  - the same party settings, date null (App rolls it on to the coming Saturday), and no host
 *    name or UPI ID, so applyPlan keeps the current ones (an old entry's UPI ID could be stale,
 *    and a co-host's plan names them, not you);
 *  - bottles re-priced from today's catalog (same cat:id; one Livcheers no longer lists, or
 *    lists with no price, keeps last time's price and is flagged; a party in another city keeps
 *    last time's prices, since the catalog here is this city's);
 *  - leftovers come off what to buy (you still have them), a family that ran out gets one more
 *    bottle (beer and cans: a few more);
 *  - cocktails, food and supplies as they were; a past event is dropped, a venue kept unbooked.
 * `merge: true` is for "Add to my plan" (applyPlan's "merge"), which keeps my party details and
 * my night out: `out` is null (mergePlans then keeps mine), the bottles take this city's prices
 * (they're added to this city's plan), and there are no notes about the date or the night out.
 * `notes` says what changed, in plain words; `changes` lists it for the UI.
 * @returns {object & { notes: string[], changes: object[] }}  throws when the entry can't be read
 */
export function replayPlan(entry, { catalog = {}, city = null, merge = false } = {}) {
  const base = entryPlan(entry);
  if (!base) throw new Error("This past party can't be opened");
  const outcome = normalizeOutcome(entry.outcome, base);
  const notes = [], changes = [];
  const liquor = {};
  for (const [key, l] of Object.entries(base.liquor)) liquor[key] = { ...l, item: { ...l.item } };
  const keysOf = (f) => Object.keys(liquor).filter((k) => familyKey(liquor[k].cat) === f && liquor[k].qty > 0);
  const most = (keys) => [...keys].sort((a, b) => liquor[b].qty - liquor[a].qty)[0];

  // Leftovers: one less to buy for each, taken from the bottle bought most of (one at a time).
  for (const fam of boughtFamilies(base)) {
    const n = Math.min(outcome.left[fam.id] || 0, fam.bottles);
    if (!n) continue;
    const keys = keysOf(fam.id), cut = {};
    for (let i = 0; i < n; i++) {
      const k = most(keys.filter((x) => liquor[x].qty > 0));
      liquor[k] = { ...liquor[k], qty: liquor[k].qty - 1 };
      cut[k] = (cut[k] || 0) + 1;
    }
    for (const [k, c] of Object.entries(cut)) changes.push({ kind: "less", key: k, name: liquor[k].item.name, by: c, qty: liquor[k].qty });
    if (keys.length === 1) {
      const k = keys[0], name = liquor[k].item.name;
      notes.push(liquor[k].qty === 0
        ? `${n} ${name} left from last time: that's all you bought, so none to buy`
        : `${n} ${name} left from last time, so ${fewer(n)} to buy`);
    } else {
      const each = Object.entries(cut).map(([k, c]) => `${fewer(c)} ${liquor[k].item.name}`).join(", ");
      notes.push(`${fam.label}: ${plural(n, "bottle")} left from last time, so ${fewer(n)} to buy (${each})`);
    }
  }

  // Ran out: one more of the bottle bought most of; beer and cans a few more.
  for (const f of outcome.ranOut) {
    const keys = keysOf(f);
    if (!keys.length) continue;
    const k = most(keys);
    const total = keys.reduce((s, x) => s + liquor[x].qty, 0);
    const more = byTheFew(liquor[k].cat) ? Math.max(4, Math.ceil(total * 0.2)) : 1;
    liquor[k] = { ...liquor[k], qty: Math.min(500, liquor[k].qty + more) };
    changes.push({ kind: "more", key: k, name: liquor[k].item.name, by: more, qty: liquor[k].qty });
    notes.push(`${familyLabel(f)} ran out last time: ${more} more ${liquor[k].item.name}`);
  }
  for (const k of Object.keys(liquor)) if (!(liquor[k].qty > 0)) delete liquor[k];

  // Today's prices. (The carts keep the prices they were filled at, so these are the ones the
  // new plan will show: a later sync doesn't change them.)
  const here = merge || !city || !base.city || base.city === city;
  const repriced = [], unsynced = new Set();
  for (const [key, l] of Object.entries(liquor)) {
    const items = here && Array.isArray(catalog?.[l.cat]) ? catalog[l.cat] : null;
    const live = items?.find((it) => it && String(it.id) === String(l.item.id));
    const price = Math.round(Number(live?.price));
    if (live && price > 0) {
      if (price !== l.item.price) repriced.push({ key, name: l.item.name, from: l.item.price, to: price, qty: l.qty });
      liquor[key] = { ...l, item: { ...l.item, price, img: live.img || l.item.img } };
    } else if (live) {
      changes.push({ kind: "unpriced", key, name: l.item.name, price: l.item.price });
      notes.push(`${l.item.name} has no price on Livcheers right now, so it keeps last time's ${fmt(l.item.price)}`);
    } else if (items?.length) {
      changes.push({ kind: "unlisted", key, name: l.item.name, price: l.item.price });
      notes.push(`${l.item.name} isn't on Livcheers right now, so it keeps last time's ${fmt(l.item.price)}: check it's still sold`);
    } else if (here) unsynced.add(l.cat);
  }
  for (const r of repriced) changes.push({ kind: "price", key: r.key, name: r.name, from: r.from, to: r.to });
  if (repriced.length && repriced.length <= 3) {
    for (const r of repriced) notes.push(`${r.name} is ${fmt(r.to)} now (${fmt(r.from)} last time)`);
  } else if (repriced.length) {
    const d = repriced.reduce((s, r) => s + (r.to - r.from) * r.qty, 0);
    notes.push(`New prices today for ${repriced.length} kinds of bottle: ${d === 0 ? "the same as last time" : `${fmt(Math.abs(d))} ${d > 0 ? "more" : "less"} than last time`}, in all`);
  }
  if (!here && Object.keys(liquor).length) {
    notes.push(`This party was in ${cityName(base.city)}, so its bottles keep last time's prices: today's ${cityName(base.city)} prices aren't loaded here`);
  } else if (unsynced.size) {
    const labels = [...unsynced].map((c) => CAT[c]?.label || c).join(", ");
    notes.push(`No ${labels} prices loaded yet, so those bottles keep last time's prices: sync first to get today's`);
  }

  // Food, supplies and cocktails as they were.
  const food = base.food.map((l) => ({ ...l, ordered: false }));
  if (food.some((l) => l.kind === "zomato")) notes.push("Food and supplies are as last time. Zomato restaurants and prices may have changed, so check each one before you order");
  else if (food.length) notes.push("Food and supplies are as last time");

  const party = { ...base.party, date: null, host: "", upi: "" };
  // Added to my plan: my party details and my night out stay as they are.
  if (merge) return { ...base, party, liquor, food, out: null, notes, changes };

  // The night out: a venue stays (book again), a past event goes.
  let out = { ...base.out, booked: false };
  if (isOut(base.out) && base.out.pick.type === "event") {
    notes.push(`${base.out.pick.name || "Last time's event"} has been and gone: pick a new night out on the Out tab`);
    out = { ...out, active: false, pick: null, tickets: [] };
  } else if (isOut(base.out)) {
    notes.push(`Same place: ${base.out.pick.name}. Book again on District for the new date`);
  }

  notes.push(`Planning again sets the date to the coming Saturday: change it on the ${isOut(out) ? "Out" : "Food"} tab`);
  return { ...base, party, liquor, food, out, notes, changes };
}
