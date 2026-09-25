// ═══════════════════════════════════════════════════════════════════════════════
//  SPLIT THE BILL — per-person shares + UPI payment links.
//  "equal": everything ÷ everyone. "fair": food & supplies ÷ everyone, liquor
//  ÷ drinkers only (non-drinkers don't pay for the bar).
// ═══════════════════════════════════════════════════════════════════════════════

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
