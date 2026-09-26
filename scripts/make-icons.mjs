// Generates every launcher icon, adaptive-icon layer, splash screen and web icon — Android,
// iOS and web — from resources/logo-mark.svg.
//   npm run icons              everything (after `npx cap add android` / `npx cap add ios`)
//   npm run icons -- ios       just one target: web | android | ios
// The splash title is set in DejaVu Serif (Linux's default serif, used for the committed
// images); where it isn't installed the text falls back to Georgia or the system serif.
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — on Windows the latter is "/E:/…", which fs can't open.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RES = join(ROOT, "android/app/src/main/res");
const XCASSETS = join(ROOT, "ios/App/App/Assets.xcassets");
const MARK = readFileSync(join(ROOT, "resources/logo-mark.svg"));
const BG = "#070504";

const targets = process.argv.slice(2);
const want = (t) => targets.length === 0 || targets.includes(t);

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
      <stop offset="0" stop-color="#3b2008"/><stop offset=".6" stop-color="#140a04"/><stop offset="1" stop-color="${BG}"/>
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
  const font = "DejaVu Serif, Liberation Serif, Georgia, serif";
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cf6a"/><stop offset="1" stop-color="#c9731c"/></linearGradient></defs>
    <text x="${w / 2}" y="${top + markPx + fs * 1.5}" text-anchor="middle" font-family="${font}" font-weight="bold" font-size="${fs}" letter-spacing="${fs * 0.12}" fill="url(#t)">LIQUOR CABINET</text>
    <text x="${w / 2}" y="${top + markPx + fs * 2.6}" text-anchor="middle" font-family="${font}" font-size="${Math.round(fs * 0.4)}" letter-spacing="${fs * 0.25}" fill="#8f8270">PARTY PLANNER</text>
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

// Asset-catalog Contents.json, spaced the way Xcode writes it so re-saving in Xcode is a no-op.
const writeContents = (dir, images) =>
  writeFileSync(join(dir, "Contents.json"), JSON.stringify({ images, info: { author: "xcode", version: 1 } }, null, 2).replace(/": /g, '" : ') + "\n");

// iOS icon: one 1024 px image — Xcode 14+ derives every other size from it. It has to be
// opaque (iOS fills an alpha channel with black, and App Store tools reject it) and square,
// because iOS applies its own rounded mask; the artwork sits like it does in resources/icon-512.png.
async function iosIcon() {
  const dir = join(XCASSETS, "AppIcon.appiconset");
  mkdirSync(dir, { recursive: true });
  const art = await (await composite(1024, 1024, "rect", Math.round(1024 * 0.86))).toBuffer();
  await sharp(art).flatten({ background: BG }).png().toFile(join(dir, "AppIcon-512@2x.png"));
  writeContents(dir, [{ filename: "AppIcon-512@2x.png", idiom: "universal", platform: "ios", size: "1024x1024" }]);
}

// iOS splash: LaunchScreen.storyboard (which @capacitor/splash-screen reuses after launch)
// aspect-fills this square image, so a portrait iPhone (19.5:9) shows only its middle ~46 %.
// That strip is drawn exactly like the Android portrait splash, then padded to a square with
// the background's edge colour. The same image serves 1x/2x/3x, as in Capacitor's template.
async function iosSplash() {
  const dir = join(XCASSETS, "Splash.imageset");
  mkdirSync(dir, { recursive: true });
  const size = 2732, strip = Math.round((size * 9) / 19.5);
  const pad = size - strip;
  const art = await (await splash(strip, size)).toBuffer();
  const png = await sharp(art)
    .extend({ left: Math.floor(pad / 2), right: Math.ceil(pad / 2), background: BG })
    .flatten({ background: BG })
    .png()
    .toBuffer();
  const files = ["splash-2732x2732-2.png", "splash-2732x2732-1.png", "splash-2732x2732.png"];
  for (const f of files) writeFileSync(join(dir, f), png);
  writeContents(dir, files.map((filename, i) => ({ idiom: "universal", filename, scale: `${i + 1}x` })));
}

async function webIcons() {
  await (await composite(64, 64, "rounded", 58)).toFile(join(ROOT, "public/favicon.png"));
  await (await composite(512, 512, "rounded", 470)).toFile(join(ROOT, "public/icon-512.png"));
  await (await composite(512, 512, "rect", 440)).toFile(join(ROOT, "resources/icon-512.png"));
}

if (want("web")) {
  await webIcons();
  console.log("Web icons written to public/ and resources/");
}
if (want("android") && existsSync(RES)) {
  await launcherIcons();
  await splashScreens();
  await notificationIcons();
  console.log("Android icons + splash screens written to", RES);
}
if (want("ios") && existsSync(XCASSETS)) {
  await iosIcon();
  await iosSplash();
  console.log("iOS app icon + splash written to", XCASSETS);
}
