export const fmt = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");

export const ageStr = (ms) => {
  const d = Date.now() - ms;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.round(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)}h ago`;
  return `${Math.round(d / 86400000)}d ago`;
};

export const stars = (rating) => [1, 2, 3, 4, 5].map((i) => (i <= Math.round(rating || 0) ? "★" : "☆")).join("");
