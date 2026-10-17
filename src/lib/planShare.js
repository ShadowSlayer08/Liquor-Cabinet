// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN SHARING — send a plan to a co-host with no server (v1.6).
//  A shared plan (snapshotPlan(…, { share: true })) is compressed into a link,
//  liquorcabinet://plan?v=1&d=<data>, that a QR code carries (the other phone's
//  camera opens the app on it), and is also sent as a small .json file or pasted.
//  decodePlan() accepts any of those and hands back the raw snapshot; the caller
//  checks it with restoreSnapshot(). Nothing leaves the phones but what the host shares.
//  (v1.6 foundation stub — track S writes encoding, compression and the size limits.)
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════

export const PLAN_LINK = "liquorcabinet://plan";

/**
 * @returns {{ link: string, bytes: number, fitsQr: boolean, json: string }}
 *   link = the deep link for the QR / message; json = the file's contents
 */
export function encodePlan(snapshot) {
  const json = JSON.stringify(snapshot);
  return { link: "", bytes: json.length, fitsQr: false, json };
}

/** @returns {object} the raw snapshot from a link, a pasted message or a file's text; throws when it isn't one */
export function decodePlan(input) {
  const text = String(input || "").trim();
  if (text.startsWith("{")) return JSON.parse(text);
  throw new Error("Couldn't read that plan");
}
