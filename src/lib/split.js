// ═══════════════════════════════════════════════════════════════════════════════
//  SPLIT THE BILL — per-person shares + UPI payment links.
//  "equal": everything ÷ everyone. "fair": food & supplies ÷ everyone, liquor
//  ÷ drinkers only (non-drinkers don't pay for the bar).
//  Shares are rounded up to the rupee, so the host never ends up short.
//
//  A party out (v1.5) adds two parts: `venue`, the venue's own estimate (cost for two
//  ÷ 2 a head × people, lib/outModel.js outSpend), and `tickets`, the tickets planned on
//  District. Both are split equally among everyone, in either mode: a bar bill doesn't
//  say who drank what, and District tickets are per person (the host buys them for the
//  group). Missing include keys count as on; at home both amounts are 0, so a party at
//  home splits exactly as before.
// ═══════════════════════════════════════════════════════════════════════════════
import { fmt } from "./format.js";
import { prettyWhen } from "./when.js";

const ALL_ON = { liquor: true, food: true, supplies: true, venue: true, tickets: true };
const OUT_KEYS = ["venue", "tickets"];

export function splitBill({ liquor = 0, food = 0, supplies = 0, venue = 0, tickets = 0, people = 1, drinkers = 1, mode = "fair", include = {} }) {
  const inc = { ...ALL_ON, ...include };
  const L = inc.liquor ? liquor : 0;
  const F = (inc.food ? food : 0) + (inc.supplies ? supplies : 0);
  const V = inc.venue ? venue || 0 : 0;
  const T = inc.tickets ? tickets || 0 : 0;
  const n = Math.max(1, Math.round(people));
  const d = Math.min(n, Math.max(0, Math.round(drinkers)));
  const total = L + F + V + T;
  const base = { total, people: n, drinkers: d, nonDrinkers: n - d, venue: V, tickets: T };
  if (mode === "fair" && d > 0) {
    const shared = (F + V + T) / n;
    return { mode, ...base, perDrinker: Math.ceil(shared + L / d), perNonDrinker: Math.ceil(shared) };
  }
  const each = Math.ceil(total / n);
  return { mode: "equal", ...base, perDrinker: each, perNonDrinker: each };
}

export const validVpa = (v) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(String(v || "").trim());

// Standard UPI deep link — opens GPay / PhonePe / Paytm with the amount filled in.
export const upiLink = ({ vpa, name, amount, note }) =>
  `upi://pay?pa=${encodeURIComponent(vpa.trim())}&pn=${encodeURIComponent(name || "Party host")}` +
  `&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent((note || "Party share").slice(0, 60))}`;

// App's `split` settings + the plan → who's splitting. null people/drinkers = use the plan's.
export function resolveSplit(split, plan) {
  const s = split || {};
  const people = Math.max(1, Math.round(s.people ?? plan?.guests ?? 1));
  const drinkers = Math.min(people, Math.max(0, Math.round(s.drinkers ?? plan?.drinkers ?? people)));
  return { people, drinkers, mode: s.mode === "equal" ? "equal" : "fair", include: { liquor: true, food: true, supplies: true, ...s.include } };
}

// One row per distinct share: drinkers + non-drinkers in a fair split where
// they differ, otherwise a single "everyone" row. Empty when there's nothing to split.
export function shareRows(r) {
  if (!r?.total) return [];
  if (r.mode === "fair" && r.drinkers > 0 && r.nonDrinkers > 0 && r.perDrinker !== r.perNonDrinker) {
    return [
      { key: "drinkers", label: "Drinkers", emoji: "🥃", count: r.drinkers, amount: r.perDrinker },
      { key: "sober", label: "Non-drinkers", emoji: "🥤", count: r.nonDrinkers, amount: r.perNonDrinker },
    ];
  }
  return [{ key: "everyone", label: "Everyone", emoji: "🎉", count: r.people, amount: r.perDrinker }];
}

// What a split covers, every part spelled out, for the labels (includedLabel, the payment card).
// At home: the switches as they are. On a night out (a venue or ticket amount): only the parts
// that are switched on and have something in them, so a bar night reads "the venue", not
// "liquor, food, supplies & the venue".
export function splitParts(include, totals = {}) {
  const inc = { ...ALL_ON, ...include };
  const out = OUT_KEYS.some((k) => (totals[k] || 0) > 0);
  return Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, !!inc[k] && (out ? (totals[k] || 0) > 0 : !OUT_KEYS.includes(k))]));
}

// "liquor, food & supplies". The venue and tickets are named only when `include` says so
// outright (splitParts), so a v1.4.1 include reads as before.
export function includedLabel(include) {
  const inc = { liquor: true, food: true, supplies: true, ...include };
  const parts = [inc.liquor && "liquor", inc.food && "food", inc.supplies && "supplies", inc.venue === true && "the venue", inc.tickets === true && "tickets"].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}` : parts[0] || "";
}

// Plain-text split for WhatsApp & co. No upi://pay links: NPCI has disallowed P2P payments
// started from such links since April 2024 (circular OC/76A), so guests pay the UPI ID —
// or scan the payment card's QR code (lib/paycard.js), which is still allowed.
// `venue`: the picked place's name on a night out; its estimate and the tickets get a line each.
export function splitMessage({ party, result, include, host, vpa, venue = "" }) {
  const rows = shareRows(result);
  const pay = validVpa(vpa);
  const who = (host || "").trim();
  const place = String(venue || "").trim();
  const name = (party?.name || "").trim() || (place ? "Night out" : "House party");
  const when = prettyWhen(party);
  const V = result.venue > 0 ? result.venue : 0, T = result.tickets > 0 ? result.tickets : 0;
  const lines = [`🎉 *${name}*${when ? ` — ${when}` : ""}`];
  if (place) lines.push(`📍 ${place}`);
  lines.push(`Splitting about ${fmt(result.total)} (${includedLabel(include)}, at planned prices) between ${result.people} of us.`);
  if (V) lines.push(`🍽️ Venue: about ${fmt(V)}, the venue's own estimate. The real bill comes at the table.`);
  if (T) lines.push(`🎟️ Tickets: ${fmt(T)} as planned on District, before its fee.`);
  if (rows.length > 1) {
    lines.push(V || T
      ? `Drinks you bring are split among the drinkers; ${[V && "the venue", T && "tickets"].filter(Boolean).join(" and ")} among everyone.`
      : "Drinks are split among the drinkers only.");
  }
  lines.push("");
  for (const r of rows) {
    lines.push(r.amount > 0 ? `${r.emoji} ${r.label} (${r.count}): *${fmt(r.amount)}* each` : `${r.emoji} ${r.label} (${r.count}): nothing to pay`);
  }
  // Livcheers prices are indicative and Zomato/Blinkit add taxes & delivery, so the shares are an estimate.
  lines.push("", "Based on planned prices — any difference gets settled after the party.");
  if (pay) lines.push("", `Pay by UPI to ${vpa.trim()}${who ? ` (${who})` : ""} — or scan the QR on the payment card.`);
  else if (who) lines.push("", `Pay ${who} 🙏`);
  return lines.join("\n");
}

// WhatsApp's own share link — opens its chat picker with the text filled in.
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
