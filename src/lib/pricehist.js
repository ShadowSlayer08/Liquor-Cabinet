// ═══════════════════════════════════════════════════════════════════════════════
//  PRICE HISTORY  (pure — unit-tested)
//
//  Livcheers only ever shows today's price. On every fresh sync the new scrape is
//  compared with the cached one, bottle by bottle (by id):
//   • a price that moved gets prevPrice / prevPriceAt / priceChangedAt, which
//     drive the "↓ ₹200" badge for two weeks;
//   • hist:<city>:<cat> keeps { id: [[t, price], …] } — one entry per price
//     actually seen, the last 8 per bottle — so the bottle page can say when each
//     price was first seen. Bottles that drop off the list drop out of it too.
// ═══════════════════════════════════════════════════════════════════════════════

export const BADGE_MS = 14 * 86400 * 1000;
export const HIST_LEN = 8;

export const histKey = (city, catId) => `hist:${city}:${catId}`;

// When a price was first seen: the latest history entry carrying it.
const seenAt = (entries, price) => {
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] === price) return entries[i][0];
  return null;
};

// `cached` is the stored { items, fetchedAt } from the previous sync (or null).
export function applyPriceHistory(newItems, cached, hist, now = Date.now()) {
  const before = new Map((cached?.items || []).map((it) => [it.id, it]));
  const cachedAt = cached?.fetchedAt || now;
  const nextHist = {};

  const items = newItems.map((raw) => {
    const { prevPrice: _p, prevPriceAt: _pa, priceChangedAt: _pc, ...it } = raw;
    const was = before.get(it.id);
    const past = Array.isArray(hist?.[it.id]) ? hist[it.id] : [];

    // History: seed from the cached price when there's none yet, then record today's price if it's new.
    const entries = past.length ? [...past] : was?.price ? [[cachedAt, was.price]] : [];
    if (!entries.length || entries[entries.length - 1][1] !== it.price) entries.push([now, it.price]);
    nextHist[it.id] = entries.slice(-HIST_LEN);

    if (was?.price && was.price !== it.price) {
      return { ...it, prevPrice: was.price, prevPriceAt: seenAt(past, was.price) ?? cachedAt, priceChangedAt: now };
    }
    if (was?.prevPrice && was.priceChangedAt && now - was.priceChangedAt <= BADGE_MS) {
      return { ...it, prevPrice: was.prevPrice, prevPriceAt: was.prevPriceAt, priceChangedAt: was.priceChangedAt };
    }
    return it;
  });

  return { items, hist: nextHist };
}

// Signed change since the previous price (negative = cheaper), while the badge is fresh.
export const priceMove = (it, now = Date.now()) =>
  it?.prevPrice && it.priceChangedAt && now - it.priceChangedAt <= BADGE_MS ? it.price - it.prevPrice : 0;

export const isPriceDrop = (it, now) => priceMove(it, now) < 0;

// 1726000000000 → "10 Sep"
export const histDate = (t) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
