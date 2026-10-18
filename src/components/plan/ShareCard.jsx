// [v1.6 · Co-host] Send this plan to a co-host as a QR code, link or file — no server —
// and import theirs. The QR carries the whole plan when it fits, else a lighter one (party,
// bottles, cocktails, night out; lib/planShare.js says which); the file and the link always
// carry everything. Importing (a file, the clipboard or the text box) goes through
// openImport(text) → App's ImportSheet, which checks the plan before anything changes.
// Props (PlanTab): snapshot (this plan, shareable: snapshotPlan(…, { share: true })), openImport(text), toast.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clipboard } from "@capacitor/clipboard";
import { encodePlan, planContents, planMessage, MAX_INPUT } from "../../lib/planShare.js";
import { hasPlan, snapshotSummary } from "../../lib/planSnapshot.js";
import { prettyWhen } from "../../lib/when.js";
import { shareImage } from "../../lib/shareImage.js";
import { shareFile } from "../../lib/shareFile.js";
import { copyText, tap, buzz } from "../../lib/order.js";
import { isNative } from "../../lib/http.js";
import {
  FONT, INK, font, loadFonts, loadSvg, makeCanvas, fitText, ellipsize, wrapLines, spaced, backdrop, divider, goldGradient, roundRect, stack, fits,
} from "../../lib/canvas.js";
import { Icon } from "../Art.jsx";

const QR_OPTS = { errorCorrectionLevel: "M", margin: 2, color: { dark: INK.ink, light: "#ffffff" } };

// The clipboard's text: Capacitor natively (no permission prompt on Android), else the browser's.
async function readClipboard() {
  if (isNative()) {
    try { const r = await Clipboard.read(); return typeof r?.value === "string" ? r.value : ""; } catch {}
  }
  try { return await navigator.clipboard.readText(); } catch { return null; }
}

const readFile = (file) => (typeof file.text === "function" ? file.text() : new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ""));
  r.onerror = () => reject(r.error);
  r.readAsText(file);
}));

export default function ShareCard({ snapshot, openImport, toast }) {
  const something = hasPlan(snapshot);
  const enc = useMemo(() => (something ? encodePlan(snapshot) : null), [snapshot, something]);
  const qr = enc?.qr || null;
  const s = snapshotSummary(snapshot);
  const title = s.name;
  const when = prettyWhen(snapshot?.party);
  const contents = planContents(snapshot, { food: !qr?.light });
  const [qrSrc, setQrSrc] = useState(null);
  const [busy, setBusy] = useState(null); // "qr" | "file" while the share sheet is up
  const [paste, setPaste] = useState("");
  const drawn = useRef(false);

  // Draw the QR at once the first time, then once typing (the party name) pauses.
  useEffect(() => {
    if (!qr?.link) { setQrSrc(null); drawn.current = false; return; }
    let live = true;
    const t = setTimeout(() => {
      QRCode.toDataURL(qr.link, { ...QR_OPTS, scale: 6 })
        .then((url) => { if (live) { drawn.current = true; setQrSrc(url); } })
        .catch(() => { if (live) setQrSrc("failed"); });
    }, drawn.current ? 400 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [qr?.link]);

  const shareQr = async () => {
    if (busy || !qr) return;
    tap(); setBusy("qr");
    try {
      const canvas = await drawPlanQr({ title, when, contents, link: qr.link, light: qr.light });
      const caption = `${title}: our party plan. Open it in Liquor Cabinet — scan the QR with your camera or Google Lens, or ask me for the file${qr.light ? " (it has the food too)" : ""}.`;
      const res = await shareImage(canvas, "party-plan-qr.png", `${title} — plan`, caption);
      if (res === "downloaded") toast("QR code saved as an image");
      else if (res === "shared") buzz();
    } catch (e) {
      toast(`Couldn't share the QR code (${e?.message || e})`);
    } finally {
      setBusy(null);
    }
  };

  const sendFile = async () => {
    if (busy || !enc) return;
    tap(); setBusy("file");
    try {
      const res = await shareFile(enc.json, enc.fileName, `${title} — plan`, `${title}: our party plan. In Liquor Cabinet: Plan → Import a plan → Choose the file.`);
      if (res === "downloaded") toast(`Saved as ${enc.fileName}`);
      else if (res === "shared") buzz();
    } catch (e) {
      toast(`Couldn't share the file (${e?.message || e})`);
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!enc) return;
    tap();
    if (await copyText(planMessage(snapshot, enc.link))) toast("Copied — paste it in a chat with your co-host");
    else toast("Couldn't copy the link — send it as a file instead");
  };

  // ── Import ──
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be chosen again
    if (!file) return;
    if (file.size > MAX_INPUT) { toast("That file is too big to be a Liquor Cabinet plan"); return; }
    try { openImport(await readFile(file)); } catch { toast("Couldn't read that file"); }
  };
  const pasteClipboard = async () => {
    tap();
    const text = await readClipboard();
    if (text == null) { toast("Couldn't read the clipboard — paste into the box below"); return; }
    if (!text.trim()) { toast("Nothing copied yet — copy their message first"); return; }
    openImport(text.slice(0, MAX_INPUT + 1));
  };
  const openPasted = () => { tap(); if (paste.trim()) { openImport(paste); setPaste(""); } };

  return (
    <div className="card fade-up" id="share">
      <div className="card-title"><span className="kicker">Plan with a co-host</span><span className="tiny muted">QR · file · link</span></div>

      {!something ? (
        <div className="ch-empty">
          <Icon.users size={26} />
          <div className="small soft">Nothing to share yet</div>
          <div className="tiny muted">Add bottles, cocktails or food (or pick a place in the Out tab), then send the whole plan to your co-host.</div>
        </div>
      ) : (
        <>
          {qr ? (
            <div className="ch-qr">
              {qrSrc === "failed" ? <div className="small muted ch-qr-skel ch-qr-fail">Couldn't draw the QR code — send the file instead.</div>
                : qrSrc ? <img className="ch-qr-img" src={qrSrc} alt={`QR code: ${title}`} /> : <div className="skel ch-qr-skel" />}
            </div>
          ) : (
            <div className="note note-info">Too much for one QR code — send it as a file or copy the link instead; both carry the whole plan.</div>
          )}
          <div className="ch-what">
            <div className="h3 ellipsis">{title}</div>
            {when && <div className="small soft">{when}</div>}
            {contents && <div className="tiny muted">{contents}</div>}
          </div>
          {qr?.light && (
            <div className="tiny gold ch-light">
              The whole plan is too big for one QR code, so this one has the party, bottles and cocktails{s.out ? " and the night out" : ""}. Send the file for the food and supplies.
            </div>
          )}
          {qr && <div className="tiny dim ch-scan">Your co-host scans it with their phone camera. If the camera only shows text, they copy it and paste it under Import a plan.</div>}

          <button className="btn btn-gold btn-block" style={{ marginTop: 12 }} disabled={!!busy} onClick={sendFile}>
            {busy === "file" ? <span className="spin">◌</span> : <Icon.share size={17} />} Send as a file
          </button>
          <div className="ch-acts">
            <button className="btn btn-ghost btn-sm" disabled={!!busy || !qr} onClick={shareQr}>
              {busy === "qr" ? <span className="spin">◌</span> : <Icon.grid size={15} />} Share the QR
            </button>
            <button className="btn btn-ghost btn-sm" onClick={copyLink}>🔗 Copy the link</button>
          </div>
        </>
      )}

      <div className="sep" />
      <div className="ch-import" id="import-plan">
        <div className="kicker">Import a plan</div>
        <div className="tiny muted" style={{ marginTop: 4 }}>Got a plan from a co-host? Scan their QR with your camera, or open their file or message here.</div>
        <div className="ch-acts">
          {/* A label opens the picker in every WebView (a script click on a hidden input doesn't everywhere). */}
          <label className="btn btn-ghost btn-sm" onClick={tap}>
            📄 Choose the file
            <input className="ch-file" type="file" accept=".json,application/json" onChange={onFile} />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={pasteClipboard}>📋 Paste</button>
        </div>
        <div className="ch-paste">
          <textarea className="input" rows={2} value={paste} maxLength={MAX_INPUT} placeholder="…or paste their message here"
            autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setPaste(e.target.value)} />
          {paste.trim() && <button className="btn btn-gold btn-sm btn-block" style={{ marginTop: 8 }} onClick={openPasted}>Open their plan</button>}
        </div>
      </div>

      <div className="ch-privacy tiny dim">
        <span>🔒 No server: nothing is uploaded, and the plan goes only where you send it.</span>
        <span>Your location and UPI ID are never in it.</span>
        <span>It's a copy — changes don't sync, so send it again after you edit.</span>
      </div>
    </div>
  );
}

// ── The QR as an image (1080 × 1350, the invite's look) ───────────────────────
const W = 1080, H = 1350;

async function drawPlanQr({ title, when, contents, link, light }) {
  await loadFonts();
  const logo = await loadSvg("./logo-mark.svg", 120);
  const cx = W / 2, M = 104, CW = W - 2 * M;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  backdrop(ctx, W, H);
  ctx.textBaseline = "top";

  const build = async (qrSize, logoSize, titleLines) => {
    const blocks = [];
    if (logo && logoSize) blocks.push({ h: logoSize + 18, draw: (y) => ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize) });
    blocks.push({ h: 46, draw: (y) => { font(ctx, 600, 26); ctx.fillStyle = INK.muted; ctx.textAlign = "center"; spaced(ctx, "OUR PARTY PLAN", cx, y, 9); } });
    const t = fitText(ctx, title, { weight: 700, style: "italic", family: FONT.display, max: 84, min: 52, maxWidth: CW, maxLines: titleLines });
    const lh = Math.round(t.size * 1.14);
    blocks.push({ h: t.lines.length * lh + 8, draw: (y) => {
      font(ctx, 700, t.size, FONT.display, "italic"); ctx.textAlign = "center";
      t.lines.forEach((l, i) => {
        const w = Math.min(CW, ctx.measureText(l).width);
        ctx.fillStyle = goldGradient(ctx, cx - w / 2, y + i * lh, cx + w / 2, y + (i + 1) * lh);
        ctx.fillText(l, cx, y + i * lh);
      });
    } });
    if (when) blocks.push({ h: 48, draw: (y) => { font(ctx, 500, 34); ctx.fillStyle = INK.soft; ctx.textAlign = "center"; ctx.fillText(ellipsize(ctx, when, CW), cx, y); } });
    blocks.push({ h: 40, draw: (y) => divider(ctx, cx, y + 18) });

    const code = await QRCode.toCanvas(document.createElement("canvas"), link, { ...QR_OPTS, color: { dark: INK.ink, light: INK.cream }, width: qrSize });
    const tile = qrSize + 40;
    blocks.push({ h: tile + 28, draw: (y) => {
      roundRect(ctx, cx - tile / 2, y, tile, tile, 28);
      ctx.fillStyle = INK.cream;
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(code, cx - qrSize / 2, y + 20, qrSize, qrSize);
      ctx.imageSmoothingEnabled = true;
    } });

    font(ctx, 500, 30);
    const cl = contents ? wrapLines(ctx, contents, CW, 2) : [];
    if (cl.length) blocks.push({ h: cl.length * 42 + 6, draw: (y) => { font(ctx, 500, 30); ctx.fillStyle = INK.text; ctx.textAlign = "center"; cl.forEach((l, i) => ctx.fillText(l, cx, y + i * 42)); } });
    if (light) {
      font(ctx, 400, 26);
      const nl = wrapLines(ctx, "The food and supplies are in the plan's file.", CW, 1);
      blocks.push({ h: 40, draw: (y) => { font(ctx, 400, 26); ctx.fillStyle = INK.gold; ctx.textAlign = "center"; nl.forEach((l) => ctx.fillText(l, cx, y)); } });
    }
    return blocks;
  };

  // Shrink until it fits: a one-line title, a smaller logo, then a smaller QR. The last step always fits.
  const footerY = H - 104, top = 84, bottom = footerY - 24;
  const tries = [[640, 88, 2], [640, 88, 1], [600, 72, 1], [560, 0, 1], [480, 0, 1]];
  let blocks = null;
  for (const [qrSize, logoSize, lines] of tries) {
    blocks = await build(qrSize, logoSize, lines);
    if (fits(blocks, top, bottom)) break;
  }
  stack(blocks, top, bottom);

  font(ctx, 600, 22); ctx.fillStyle = INK.dim; ctx.textAlign = "center";
  spaced(ctx, "SCAN TO OPEN IN LIQUOR CABINET · OR PLAN → IMPORT A PLAN", cx, footerY, 3);
  return canvas;
}
