// ═══════════════════════════════════════════════════════════════════════════════
//  ORDER BUBBLE — the order checklist as a gold bubble floating over Zomato,
//  Bistro and Blinkit (Android "display over other apps"), so items can be
//  ticked off without pulling down the notification shade. The bubble keeps
//  out of the way while Liquor Cabinet itself is on screen.
//  Native side: android/…/OrderBubblePlugin.java. Every call here is a safe
//  no-op that resolves false in the browser or when Android says no.
// ═══════════════════════════════════════════════════════════════════════════════
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./http.js";

const OrderBubble = registerPlugin("OrderBubble");

export const bubbleAvailable = () => isNative();

export async function canDrawOverlay() {
  if (!isNative()) return false;
  try { return !!(await OrderBubble.canDraw()).granted; } catch { return false; }
}

// Opens Android's "Display over other apps" screen; true if it opened. Re-check with
// canDrawOverlay() when the app resumes.
export async function requestOverlay() {
  if (!isNative()) return false;
  try { return !!(await OrderBubble.requestPermission()).opened; } catch { return false; }
}

// Checklist lines may carry the notification's ✅ / ⬜ marks; the bubble draws its own tick boxes.
export function bubbleLines(lines) {
  const out = { lines: [], done: [] };
  for (const l of lines || []) {
    const s = String(l), m = /^(✅|⬜)\s*/u.exec(s);
    out.lines.push(m ? s.slice(m[0].length) : s);
    out.done.push(m?.[1] === "✅");
  }
  return out;
}

// Shows (or replaces) the floating checklist. It appears once you switch to another app.
export async function showBubble(title, lines) {
  if (!isNative() || !lines?.length) return false;
  try { await OrderBubble.show({ title, ...bubbleLines(lines) }); return true; } catch (e) { console.warn("OrderBubble.show", e); return false; }
}

export async function hideBubble() {
  if (!isNative()) return false;
  try { await OrderBubble.hide(); return true; } catch { return false; }
}
