// ═══════════════════════════════════════════════════════════════════════════════
//  INVITE — a 1080×1350 party invite (Instagram/WhatsApp portrait) drawn on a
//  canvas in the app's own style. inviteData() picks what goes on it (pure,
//  tested); drawInvite() paints it and never runs past the canvas: long names
//  shrink, then wrap, then get cut with "…"; lists drop rows until they fit.
// ═══════════════════════════════════════════════════════════════════════════════
import { COCKTAIL } from "./cocktails.js";
import { cityName } from "./parse/livcheers.js";
import { prettyDate } from "./drydays.js";
import { prettyTime } from "./when.js";
import {
  FONT, INK, font, loadFonts, loadSvg, makeCanvas, wrapLines, fitText, ellipsize, spaced,
  backdrop, panel, divider, goldGradient, stack, fits,
} from "./canvas.js";

export const INVITE_W = 1080;
export const INVITE_H = 1350;

const uniq = (names) => {
  const seen = new Set();
  return names.map((n) => String(n || "").trim()).filter((n) => {
    const k = n.toLowerCase();
    if (!n || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const capped = (names, n) => ({ items: names.slice(0, n), more: Math.max(0, names.length - n) });

// What the invite says. Cocktails on the party menu go "on the bar"; without a
// menu, the priciest bottles in the cart do. Food = Zomato + Bistro dishes.
export function inviteData({ party, city, loc, cocktailMenu = [], liquorLines = [], foodCart = [] }) {
  const cocktails = uniq((cocktailMenu || []).filter((m) => m && (m.servings ?? 1) > 0).map((m) => COCKTAIL[m.id]?.name));
  const bottles = uniq([...(liquorLines || [])].filter((l) => l?.item?.name)
    .sort((a, b) => (b.item.price || 0) * (b.qty || 0) - (a.item.price || 0) * (a.qty || 0)).map((l) => l.item.name));
  const dishes = uniq((foodCart || []).filter((l) => l && (l.kind === "zomato" || l.kind === "bistro")).map((l) => l.name));
  return {
    title: (party?.name || "").trim() || "House party",
    date: party?.date ? prettyDate(party.date, { weekday: "long", day: "numeric", month: "long" }) : "",
    time: prettyTime(party?.time || "20:00"),
    venue: loc?.label || (city ? cityName(city) : ""),
    bar: cocktails.length ? { kind: "cocktails", ...capped(cocktails, 6) } : { kind: "bottles", ...capped(bottles, 5) },
    food: capped(dishes, 6),
    host: (party?.host || "").trim(),
  };
}

// The share-sheet caption that travels with the image.
export function inviteText(d) {
  return [
    `🎉 You're invited: ${d.title}`,
    d.date && `📅 ${d.date}${d.time ? `, ${d.time}` : ""}`,
    d.venue && `📍 ${d.venue}`,
    d.host && `— ${d.host}`,
  ].filter(Boolean).join("\n");
}

export async function drawInvite(d) {
  await loadFonts();
  const logo = await loadSvg("./logo-mark.svg", 280);
  const W = INVITE_W, H = INVITE_H, cx = W / 2, M = 104, CW = W - 2 * M;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  backdrop(ctx, W, H);
  ctx.textBaseline = "top";

  // Footer is pinned; everything else is centred in the space above it.
  const footerY = H - 104;
  const lists = [
    d.bar.items.length && { label: "On the bar", ...d.bar },
    d.food.items.length && { label: "Food", ...d.food },
  ].filter(Boolean);

  const build = (rows, titleLines, logoSize, titleMax) => {
    const blocks = [];
    if (logo && logoSize) blocks.push({ h: logoSize + 30, draw: (y) => ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize) });
    blocks.push({ h: 58, draw: (y) => { font(ctx, 600, 26); ctx.fillStyle = INK.muted; ctx.textAlign = "center"; spaced(ctx, "YOU'RE INVITED", cx, y, 9); } });

    const t = fitText(ctx, d.title, { weight: 700, style: "italic", family: FONT.display, max: titleMax, min: 60, maxWidth: CW, maxLines: titleLines });
    const lh = Math.round(t.size * 1.14);
    blocks.push({
      h: t.lines.length * lh + 22,
      draw: (y) => {
        font(ctx, 700, t.size, FONT.display, "italic");
        ctx.textAlign = "center";
        ctx.save();
        ctx.shadowColor = "rgba(231, 168, 70, .35)";
        ctx.shadowBlur = 36;
        t.lines.forEach((l, i) => {
          const w = Math.min(CW, ctx.measureText(l).width);
          ctx.fillStyle = goldGradient(ctx, cx - w / 2, y + i * lh, cx + w / 2, y + (i + 1) * lh);
          ctx.fillText(l, cx, y + i * lh);
        });
        ctx.restore();
      },
    });
    blocks.push({ h: 58, draw: (y) => divider(ctx, cx, y + 18) });

    if (d.date) blocks.push({ h: 64, draw: (y) => { font(ctx, 600, 48); ctx.fillStyle = INK.text; ctx.textAlign = "center"; ctx.fillText(ellipsize(ctx, d.date, CW), cx, y); } });
    if (d.time) blocks.push({ h: 56, draw: (y) => { font(ctx, 500, 38); ctx.fillStyle = INK.gold; ctx.textAlign = "center"; ctx.fillText(`${d.time} onwards`, cx, y); } });
    if (d.venue) {
      font(ctx, 400, 36);
      const v = wrapLines(ctx, d.venue, CW, 2);
      blocks.push({ h: v.length * 46 + 8, draw: (y) => { font(ctx, 400, 36); ctx.fillStyle = INK.soft; ctx.textAlign = "center"; v.forEach((l, i) => ctx.fillText(l, cx, y + 4 + i * 46)); } });
    }

    if (lists.length) {
      const shown = lists.map((l) => {
        const cut = l.items.length + (l.more ? 1 : 0) > rows;
        const items = l.items.slice(0, cut ? rows - 1 : rows);
        const more = l.more + (l.items.length - items.length);
        return { ...l, items, more };
      });
      const lines = Math.max(...shown.map((l) => l.items.length + (l.more ? 1 : 0)));
      const ph = 34 + 30 + 22 + lines * 48 + 22;
      blocks.push({ h: 36, draw: () => {} });
      blocks.push({ h: ph, draw: (y) => {
        const gap = 26;
        const pw = shown.length === 2 ? (CW - gap) / 2 : Math.min(CW, 640);
        shown.forEach((l, i) => {
          const px = shown.length === 2 ? M + i * (pw + gap) : cx - pw / 2;
          panel(ctx, px, y, pw, ph);
          ctx.textAlign = "left";
          font(ctx, 600, 24); ctx.fillStyle = INK.gold;
          spaced(ctx, l.label.toUpperCase(), px + 34, y + 34, 6);
          font(ctx, 400, 32);
          l.items.forEach((name, j) => {
            const iy = y + 34 + 30 + 22 + j * 48;
            ctx.save();
            ctx.fillStyle = INK.gold;
            ctx.translate(px + 40, iy + 19); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8);
            ctx.restore();
            ctx.fillStyle = INK.text;
            ctx.fillText(ellipsize(ctx, name, pw - 94), px + 60, iy);
          });
          if (l.more) { ctx.fillStyle = INK.muted; ctx.fillText(`+ ${l.more} more`, px + 60, y + 34 + 30 + 22 + l.items.length * 48); }
        });
      } });
    } else {
      blocks.push({ h: 104, draw: (y) => { font(ctx, 700, 42, FONT.display, "italic"); ctx.fillStyle = INK.soft; ctx.textAlign = "center"; ctx.fillText("Drinks, bites & good company", cx, y + 44); } });
    }

    if (d.host) {
      blocks.push({ h: 86, draw: (y) => {
        font(ctx, 700, 42, FONT.display, "italic"); ctx.fillStyle = INK.soft; ctx.textAlign = "center";
        ctx.fillText(ellipsize(ctx, `Hosted by ${d.host}`, CW), cx, y + 34);
      } });
    }
    return blocks;
  };

  // Shrink until it fits: a smaller title and logo first, then fewer list rows. The last step always fits.
  const top = 88, bottom = footerY - 24;
  const tries = [[6, 2, 150, 124], [6, 2, 130, 104], [5, 2, 130, 100], [5, 2, 110, 88], [4, 2, 110, 88], [3, 2, 96, 84], [3, 1, 96, 84], [2, 1, 0, 76], [1, 1, 0, 68]];
  let blocks = null;
  for (const [rows, titleLines, logoSize, titleMax] of tries) {
    blocks = build(rows, titleLines, logoSize, titleMax);
    if (fits(blocks, top, bottom)) break;
  }
  stack(blocks, top, bottom);

  font(ctx, 600, 22); ctx.fillStyle = INK.dim; ctx.textAlign = "center";
  spaced(ctx, "DRINK RESPONSIBLY", cx, footerY, 7);
  return canvas;
}
