// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS — drawing helpers shared by the invite and the payment card, so both
//  images look like the app: warm near-black, amber/wine glows, gold type.
//  No Capacitor here (the DOM is only touched when a function runs), so node
//  can test the text layout with a fake context.
// ═══════════════════════════════════════════════════════════════════════════════

// Same families the app loads in main.jsx (@fontsource).
export const FONT = {
  display: '"Playfair Display", Georgia, serif',
  ui: '"Outfit Variable", "Outfit", system-ui, sans-serif',
};
export const INK = {
  bg: "#0b0708", text: "#f8f0e3", soft: "#dccfbb", muted: "#a39581", dim: "#74685a", gold: "#e7a846",
  panel: "rgba(255, 255, 255, .05)", stroke: "rgba(255, 244, 225, .13)", cream: "#fff8ec", ink: "#140c06",
};

export const font = (ctx, weight, size, family = FONT.ui, style = "normal") => { ctx.font = `${style} ${weight} ${size}px ${family}`; };

// Canvas text doesn't wait for web fonts — load them first or the card falls back to Georgia.
export async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const specs = ['700 72px "Playfair Display"', 'italic 700 72px "Playfair Display"', '600 32px "Outfit Variable"'];
  const all = Promise.all(specs.map((f) => document.fonts.load(f, "Aa ₹").catch(() => null)));
  await Promise.race([all, new Promise((r) => setTimeout(r, 3000))]);
}

// Resolves null (never throws) when the image can't be loaded.
export function loadImage(src, timeout = 4000) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const end = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => end(null), timeout);
    img.onload = () => end(img);
    img.onerror = () => end(null);
    img.src = src;
  });
}

// The logo SVG has only a viewBox; give it a real size so every WebView draws it square.
async function fetchSvg(src, size) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = (await res.text()).replace(/<svg\b(?![^>]*\swidth=)/, `<svg width="${size}" height="${size}"`);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    if (img) return img;
  } catch {}
  return loadImage(src);
}
const svgCache = new Map();
export function loadSvg(src, size) {
  const k = `${src}@${size}`;
  if (!svgCache.has(k)) svgCache.set(k, fetchSvg(src, size).then((img) => { if (!img) svgCache.delete(k); return img; }));
  return svgCache.get(k);
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// ── Text ────────────────────────────────────────────────────────────────────
export function ellipsize(ctx, text, maxWidth) {
  let s = String(text ?? "");
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// Greedy word wrap. A single word wider than the line stays whole (callers cut it).
function wordWrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const w of String(text ?? "").trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (!line || ctx.measureText(next).width <= maxWidth) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Word-wraps into at most `maxLines`; whatever doesn't fit ends in "…".
export function wrapLines(ctx, text, maxWidth, maxLines = Infinity) {
  const lines = wordWrap(ctx, text, maxWidth);
  if (lines.length > maxLines) lines.splice(maxLines - 1, lines.length, lines.slice(maxLines - 1).join(" "));
  return lines.map((l) => ellipsize(ctx, l, maxWidth));
}

// Largest size (stepping down from `max`) at which the text wraps into `maxLines` uncut.
export function fitText(ctx, text, { weight = 700, family = FONT.display, style = "normal", max, min, maxWidth, maxLines }) {
  for (let size = max; size > min; size -= 4) {
    font(ctx, weight, size, family, style);
    const lines = wordWrap(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { size, lines };
  }
  font(ctx, weight, min, family, style);
  return { size: min, lines: wrapLines(ctx, text, maxWidth, maxLines) };
}

// Letter-spaced caps (kickers). Falls back to plain text where letterSpacing isn't supported.
export function spaced(ctx, text, x, y, spacing) {
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    // letterSpacing adds space after the last glyph too — shift centred text back by half of it.
    const dx = ctx.textAlign === "center" ? spacing / 2 : 0;
    ctx.fillText(text, x + dx, y);
    ctx.letterSpacing = "0px";
  } else ctx.fillText(text, x, y);
}

// ── Surfaces ────────────────────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// The app's --grad-gold, laid across a box.
export function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#fbe29a");
  g.addColorStop(0.48, "#eaa447");
  g.addColorStop(1, "#b9651b");
  return g;
}

function glow(ctx, x, y, r, [R, G, B, a], w, h) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${R}, ${G}, ${B}, ${a})`);
  g.addColorStop(1, `rgba(${R}, ${G}, ${B}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Near-black with the app's slow amber/wine aurora, a vignette and a thin gold frame.
export function backdrop(ctx, w, h) {
  ctx.fillStyle = INK.bg;
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.12, h * 0.06, w * 0.85, [184, 98, 26, 0.55], w, h);
  glow(ctx, w * 1.02, h * 0.5, w * 0.75, [122, 24, 64, 0.5], w, h);
  glow(ctx, w * 0.25, h * 1.05, w * 0.8, [96, 44, 12, 0.5], w, h);
  const v = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.35, w / 2, h * 0.5, w);
  v.addColorStop(0, "rgba(11, 7, 8, 0)");
  v.addColorStop(1, "rgba(11, 7, 8, .72)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = goldGradient(ctx, 0, 0, w, h);
  ctx.globalAlpha = 0.55;
  roundRect(ctx, 34, 34, w - 68, h - 68, 38);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  roundRect(ctx, 46, 46, w - 92, h - 92, 30);
  ctx.stroke();
  ctx.restore();
}

// Glass panel like .card.
export function panel(ctx, x, y, w, h, r = 34) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = INK.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK.stroke;
  ctx.stroke();
  ctx.restore();
}

// ——◆—— divider.
export function divider(ctx, cx, y, half = 150) {
  ctx.save();
  ctx.strokeStyle = INK.gold;
  ctx.fillStyle = INK.gold;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - half, y); ctx.lineTo(cx - 18, y);
  ctx.moveTo(cx + 18, y); ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y - 7); ctx.lineTo(cx + 7, y); ctx.lineTo(cx, y + 7); ctx.lineTo(cx - 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Stacks blocks ({ h, draw(y) }) vertically centred between top and bottom.
export function stack(blocks, top, bottom) {
  const total = blocks.reduce((s, b) => s + b.h, 0);
  let y = top + Math.max(0, (bottom - top - total) / 2);
  for (const b of blocks) { b.draw(y); y += b.h; }
  return total;
}
export const fits = (blocks, top, bottom) => blocks.reduce((s, b) => s + b.h, 0) <= bottom - top;

// Small preview for an <img> (the full-size canvas stays for sharing).
export function previewUrl(canvas, width = 432) {
  const h = Math.round((canvas.height / canvas.width) * width);
  const c = makeCanvas(width, h);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, width, h);
  return c.toDataURL("image/jpeg", 0.88);
}
