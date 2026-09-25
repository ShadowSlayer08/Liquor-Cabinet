// ═══════════════════════════════════════════════════════════════════════════════
//  PAYMENT CARD — the bill split as an image with a UPI QR per share, so guests
//  can scan and pay from any UPI app (a upi:// link in a chat usually isn't
//  tappable; a QR always works). Two QRs when drinkers and non-drinkers owe
//  different amounts. Same look as the invite (lib/canvas.js).
// ═══════════════════════════════════════════════════════════════════════════════
import QRCode from "qrcode";
import { fmt } from "./format.js";
import { upiLink, includedLabel } from "./split.js";
import {
  FONT, INK, font, loadFonts, loadSvg, makeCanvas, fitText, ellipsize, wrapLines, spaced,
  backdrop, panel, divider, goldGradient, roundRect, stack, fits,
} from "./canvas.js";

const W = 1080, H = 1350;
// Offsets inside a share panel: label, amount, "each", QR tile; the caption sits under the tile.
const P = { label: 30, amount: 66, each: 160, tile: 202, below: 70 };

// rows: shareRows(result) · title/when/host from the party · vpa must already be valid.
export async function drawPayCard({ title, when, host, vpa, rows, result, include }) {
  await loadFonts();
  const logo = await loadSvg("./logo-mark.svg", 200);
  const cx = W / 2, M = 104, CW = W - 2 * M;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  backdrop(ctx, W, H);
  ctx.textBaseline = "top";

  const two = rows.length > 1;
  const pw = two ? (CW - 26) / 2 : Math.min(CW, 620);
  const qrFor = (r, size) => (r.amount > 0
    ? QRCode.toCanvas(document.createElement("canvas"), upiLink({ vpa, name: host, amount: r.amount, note: title }),
      { errorCorrectionLevel: "M", margin: 1, width: size, color: { dark: INK.ink, light: INK.cream } })
    : null);

  const footerY = H - 104;
  const build = async (qr, titleLines, logoSize) => {
    const blocks = [];
    if (logo && logoSize) blocks.push({ h: logoSize + 20, draw: (y) => ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize) });
    blocks.push({ h: 48, draw: (y) => { font(ctx, 600, 26); ctx.fillStyle = INK.muted; ctx.textAlign = "center"; spaced(ctx, "SPLIT THE BILL", cx, y, 9); } });

    const t = fitText(ctx, title, { weight: 700, style: "italic", family: FONT.display, max: 92, min: 56, maxWidth: CW, maxLines: titleLines });
    const lh = Math.round(t.size * 1.14);
    blocks.push({ h: t.lines.length * lh + 10, draw: (y) => {
      font(ctx, 700, t.size, FONT.display, "italic"); ctx.textAlign = "center";
      t.lines.forEach((l, i) => {
        const w = Math.min(CW, ctx.measureText(l).width);
        ctx.fillStyle = goldGradient(ctx, cx - w / 2, y + i * lh, cx + w / 2, y + (i + 1) * lh);
        ctx.fillText(l, cx, y + i * lh);
      });
    } });
    const sub = [when, host && `Hosted by ${host}`].filter(Boolean).join(" · ");
    if (sub) blocks.push({ h: 48, draw: (y) => { font(ctx, 500, 34); ctx.fillStyle = INK.soft; ctx.textAlign = "center"; ctx.fillText(ellipsize(ctx, sub, CW), cx, y); } });
    blocks.push({ h: 40, draw: (y) => divider(ctx, cx, y + 18) });

    // One panel per share: who, how much, the QR to pay it.
    const tile = qr + 32;
    const ph = P.tile + tile + P.below;
    const codes = await Promise.all(rows.map((r) => qrFor(r, qr)));
    blocks.push({ h: ph + 24, draw: (y) => {
      rows.forEach((r, i) => {
        const px = two ? M + i * (pw + 26) : cx - pw / 2, pcx = px + pw / 2, ty = y + P.tile;
        panel(ctx, px, y, pw, ph);
        ctx.textAlign = "center";
        font(ctx, 600, 24); ctx.fillStyle = INK.gold;
        spaced(ctx, `${r.label.toUpperCase()} · ${r.count}`, pcx, y + P.label, 5);
        font(ctx, 700, 80); ctx.fillStyle = goldGradient(ctx, px, y + P.amount, px + pw, y + P.each);
        ctx.fillText(ellipsize(ctx, fmt(r.amount), pw - 40), pcx, y + P.amount);
        font(ctx, 400, 26); ctx.fillStyle = INK.muted;
        ctx.fillText(r.count > 1 ? "each" : "to pay", pcx, y + P.each);
        if (codes[i]) {
          roundRect(ctx, pcx - tile / 2, ty, tile, tile, 24);
          ctx.fillStyle = INK.cream;
          ctx.fill();
          ctx.drawImage(codes[i], pcx - qr / 2, ty + 16, qr, qr);
          font(ctx, 500, 26); ctx.fillStyle = INK.soft;
          ctx.fillText(ellipsize(ctx, `Scan to pay ${fmt(r.amount)}`, pw - 40), pcx, ty + tile + 18);
        } else {
          font(ctx, 700, 40, FONT.display, "italic"); ctx.fillStyle = INK.soft;
          ctx.fillText("Nothing to pay", pcx, ty + tile / 2 - 24);
        }
      });
    } });

    blocks.push({ h: 50, draw: (y) => { font(ctx, 600, 34); ctx.fillStyle = INK.text; ctx.textAlign = "center"; ctx.fillText(ellipsize(ctx, `UPI · ${vpa.trim()}`, CW), cx, y); } });
    const note = `About ${fmt(result.total)} for ${includedLabel(include)} at planned prices · ${result.people} ${result.people === 1 ? "person" : "people"}${two ? " · drinks split among drinkers" : ""}`;
    font(ctx, 400, 26);
    const nl = wrapLines(ctx, note, CW, 2);
    blocks.push({ h: nl.length * 36, draw: (y) => { font(ctx, 400, 26); ctx.fillStyle = INK.muted; ctx.textAlign = "center"; nl.forEach((l, i) => ctx.fillText(l, cx, y + i * 36)); } });
    return blocks;
  };

  // Shrink until it fits: a one-line title, smaller QRs, then no logo. The last step always fits.
  const top = 84, bottom = footerY - 24;
  const tries = two
    ? [[300, 2, 96], [300, 1, 96], [280, 1, 80], [280, 1, 0], [240, 1, 0]]
    : [[400, 2, 96], [360, 2, 96], [360, 1, 96], [340, 1, 80], [320, 1, 0], [280, 1, 0]];
  let blocks = null;
  for (const [qr, lines, logoSize] of tries) {
    blocks = await build(qr, lines, logoSize);
    if (fits(blocks, top, bottom)) break;
  }
  stack(blocks, top, bottom);

  font(ctx, 600, 22); ctx.fillStyle = INK.dim; ctx.textAlign = "center";
  spaced(ctx, "SCAN WITH ANY UPI APP · GPAY · PHONEPE · PAYTM", cx, footerY, 4);
  return canvas;
}
