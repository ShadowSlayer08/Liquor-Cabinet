export const fmt = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");

export const ageStr = (ms) => {
  const d = Date.now() - ms;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.round(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)}h ago`;
  return `${Math.round(d / 86400000)}d ago`;
};

export const stars = (rating) => [1, 2, 3, 4, 5].map((i) => (i <= Math.round(rating || 0) ? "★" : "☆")).join("");

// ₹75,850 → "₹75.9k", ₹1,20,000 → "₹1.2L" (Indian lakh), negatives keep the sign.
export const fmtShort = (n) => {
  const v = Math.round(Number(n || 0)), a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 100000) return `${s}₹${(a / 100000).toFixed(a >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (a >= 1000) return `${s}₹${(a / 1000).toFixed(a >= 10000 ? 1 : 1).replace(/\.0$/, "")}k`;
  return `${s}₹${a}`;
};
