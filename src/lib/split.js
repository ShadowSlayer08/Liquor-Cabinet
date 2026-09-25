// ═══════════════════════════════════════════════════════════════════════════════
//  SPLIT THE BILL — per-person shares + UPI payment links.
//  "equal": everything ÷ everyone. "fair": food & supplies ÷ everyone, liquor
//  ÷ drinkers only (non-drinkers don't pay for the bar).
//  Shares are rounded up to the rupee, so the host never ends up short.
// ═══════════════════════════════════════════════════════════════════════════════
import { fmt } from "./format.js";
import { prettyWhen } from "./when.js";

export function splitBill({ liquor = 0, food = 0, supplies = 0, people = 1, drinkers = 1, mode = "fair", include = {} }) {
  const inc = { liquor: true, food: true, supplies: true, ...include };
  const L = inc.liquor ? liquor : 0;
  const F = (inc.food ? food : 0) + (inc.supplies ? supplies : 0);
  const n = Math.max(1, Math.round(people));
  const d = Math.min(n, Math.max(0, Math.round(drinkers)));
  const total = L + F;
  if (mode === "fair" && d > 0) {
    const shared = F / n;
    return { mode, total, people: n, drinkers: d, nonDrinkers: n - d, perDrinker: Math.ceil(shared + L / d), perNonDrinker: Math.ceil(shared) };
  }
  const each = Math.ceil(total / n);
  return { mode: "equal", total, people: n, drinkers: d, nonDrinkers: n - d, perDrinker: each, perNonDrinker: each };
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

// "liquor, food & supplies"
export function includedLabel(include) {
  const inc = { liquor: true, food: true, supplies: true, ...include };
  const parts = [inc.liquor && "liquor", inc.food && "food", inc.supplies && "supplies"].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}` : parts[0] || "";
}

// Plain-text split for WhatsApp & co. Pay links only when the UPI ID looks valid.
export function splitMessage({ party, result, include, host, vpa }) {
  const rows = shareRows(result);
  const pay = validVpa(vpa);
  const who = (host || "").trim();
  const name = (party?.name || "").trim() || "House party";
  const when = prettyWhen(party);
  const lines = [
    `🎉 *${name}*${when ? ` — ${when}` : ""}`,
    `Splitting about ${fmt(result.total)} (${includedLabel(include)}, at planned prices) between ${result.people} of us.`,
  ];
  if (rows.length > 1) lines.push("Drinks are split among the drinkers only.");
  lines.push("");
  for (const r of rows) {
    lines.push(r.amount > 0 ? `${r.emoji} ${r.label} (${r.count}): *${fmt(r.amount)}* each` : `${r.emoji} ${r.label} (${r.count}): nothing to pay`);
    if (pay && r.amount > 0) lines.push(`Pay ${fmt(r.amount)}: ${upiLink({ vpa, name: who, amount: r.amount, note: name })}`);
  }
  // Livcheers prices are indicative and Zomato/Blinkit add taxes & delivery, so the shares are an estimate.
  lines.push("", "Based on planned prices — any difference gets settled after the party.");
  if (pay) lines.push("", `UPI ID: ${vpa.trim()}${who ? ` (${who})` : ""}`);
  else if (who) lines.push("", `Pay ${who} 🙏`);
  return lines.join("\n");
}

// WhatsApp's own share link — opens its chat picker with the text filled in.
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
