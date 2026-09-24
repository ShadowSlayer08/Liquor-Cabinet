// Generates every launcher icon, adaptive-icon layer, splash screen and web icon
// from resources/logo-mark.svg.   Run: npm run icons   (after `npx cap add android`)
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const RES = join(ROOT, "android/app/src/main/res");
const MARK = readFileSync(join(ROOT, "resources/logo-mark.svg"));

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const mark = (px) => sharp(MARK, { density: Math.max(72, Math.ceil((px / 512) * 72 * 2)) }).resize(px, px).png().toBuffer();

const bgSvg = (w, h, shape = "rect") => {
  const r = Math.min(w, h);
  const clip =
    shape === "circle" ? `<circle cx="${w / 2}" cy="${h / 2}" r="${r / 2}" fill="url(#g)"/>` :
    shape === "rounded" ? `<rect width="${w}" height="${h}" rx="${r * 0.22}" fill="url(#g)"/>` :
    `<rect width="${w}" height="${h}" fill="url(#g)"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><radialGradient id="g" cx="50%" cy="42%" r="${shape === "rect" && w !== h ? 45 : 62}%">
      <stop offset="0" stop-color="#3b2008"/><stop offset=".6" stop-color="#140a04"/><stop offset="1" stop-color="#070504"/>
    </radialGradient></defs>${clip}</svg>`);
};

async function composite(w, h, shape, markPx, top, extra = []) {
  const m = await mark(markPx);
  return sharp(bgSvg(w, h, shape))
    .composite([{ input: m, left: Math.round((w - markPx) / 2), top: Math.round(top ?? (h - markPx) / 2) }, ...extra])
    .png();
}

async function launcherIcons() {
  for (const [d, s] of Object.entries(DENSITIES)) {
    const dir = join(RES, `mipmap-${d}`);
    const legacy = Math.round(48 * s), fg = Math.round(108 * s);
    await (await composite(legacy, legacy, "rounded", Math.round(legacy * 0.86))).toFile(join(dir, "ic_launcher.png"));
    await (await composite(legacy, legacy, "circle", Math.round(legacy * 0.84))).toFile(join(dir, "ic_launcher_round.png"));
    // Adaptive layers: 108dp canvas, artwork kept inside the 66dp safe zone.
    const mk = Math.round(fg * 0.66);
    const fgBuf = await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await mark(mk), left: Math.round((fg - mk) / 2), top: Math.round((fg - mk) / 2) }]).png().toBuffer();
    writeFileSync(join(dir, "ic_launcher_foreground.png"), fgBuf);
    await sharp(bgSvg(fg, fg, "rect")).png().toFile(join(dir, "ic_launcher_background.png"));
    // Monochrome layer for Android 13 themed icons: the bright line-art (frame, bottles,
    // glass) in white; the dark cabinet interior stays transparent.
    const alpha = await sharp(fgBuf).flatten({ background: "#000000" }).greyscale().threshold(70).extractChannel(0).toBuffer();
    await sharp({ create: { width: fg, height: fg, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toFile(join(dir, "ic_launcher_monochrome.png"));
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  writeFileSync(join(RES, "mipmap-anydpi-v26/ic_launcher.xml"), adaptive);
  writeFileSync(join(RES, "mipmap-anydpi-v26/ic_launcher_round.xml"), adaptive);
  // Template leftovers no longer referenced by the adaptive icon.
  for (const f of ["drawable/ic_launcher_background.xml", "drawable-v24/ic_launcher_foreground.xml"]) {
    if (existsSync(join(RES, f))) rmSync(join(RES, f));
  }
}

// Status-bar icon for the order-checklist notification: white line-art, 24dp.
async function notificationIcons() {
  const { mkdirSync } = await import("node:fs");
  for (const [d, s] of Object.entries(DENSITIES)) {
    const px = Math.round(24 * s), art = Math.round(px * 1.18);
    const buf = await sharp(await mark(art)).extract({ left: Math.round((art - px) / 2), top: Math.round((art - px) / 2), width: px, height: px }).png().toBuffer();
    const alpha = await sharp(buf).flatten({ background: "#000000" }).greyscale().threshold(70).extractChannel(0).toBuffer();
    const dir = join(RES, `drawable-${d}`);
    mkdirSync(dir, { recursive: true });
    await sharp({ create: { width: px, height: px, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toFile(join(dir, "ic_stat_liquor.png"));
  }
}

async function splash(w, h) {
  const r = Math.min(w, h);
  const markPx = Math.round(r * 0.36);
  const top = Math.round(h / 2 - markPx * 0.72);
  const fs = Math.round(r * 0.055);
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cf6a"/><stop offset="1" stop-color="#c9731c"/></linearGradient></defs>
    <text x="${w / 2}" y="${top + markPx + fs * 1.5}" text-anchor="middle" font-family="DejaVu Serif, Liberation Serif, serif" font-weight="bold" font-size="${fs}" letter-spacing="${fs * 0.12}" fill="url(#t)">LIQUOR CABINET</text>
    <text x="${w / 2}" y="${top + markPx + fs * 2.6}" text-anchor="middle" font-family="DejaVu Serif, Liberation Serif, serif" font-size="${Math.round(fs * 0.4)}" letter-spacing="${fs * 0.25}" fill="#8f8270">PARTY PLANNER</text>
  </svg>`);
  return composite(w, h, "rect", markPx, top, [{ input: text }]);
}

async function splashScreens() {
  for (const dir of readdirSync(RES).filter((d) => d.startsWith("drawable"))) {
    const file = join(RES, dir, "splash.png");
    if (!existsSync(file)) continue;
    const { width, height } = await sharp(file).metadata();
    const buf = await (await splash(width, height)).png().toBuffer();
    writeFileSync(file, buf);
  }
}

async function webIcons() {
  await (await composite(64, 64, "rounded", 58)).toFile(join(ROOT, "public/favicon.png"));
  await (await composite(512, 512, "rounded", 470)).toFile(join(ROOT, "public/icon-512.png"));
  await (await composite(512, 512, "rect", 440)).toFile(join(ROOT, "resources/icon-512.png"));
}

await webIcons();
if (existsSync(RES)) {
  await launcherIcons();
  await splashScreens();
  await notificationIcons();
  console.log("Android icons + splash screens written to", RES);
}
console.log("Web icons written to public/");
