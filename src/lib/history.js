// ═══════════════════════════════════════════════════════════════════════════════
//  PARTY HISTORY — past parties, so the next plan starts from the last one (v1.6).
//  Each entry is a plan snapshot (lib/planSnapshot.js) plus what really happened:
//  the actual spend from settle-up, and what was left over or ran out. Kept on the
//  phone in its own durable key ("history", lib/store.js), newest first, capped.
//  (v1.6 foundation stub — track H builds the outcome, leftovers and replay logic.)
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════

export const HISTORY_MAX = 30;

/**
 * @typedef {object} HistoryEntry
 * @property {string} id          stable per party: `${date}|${name}` (a re-save replaces it)
 * @property {number} savedAt
 * @property {object} snapshot    snapshotPlan() output (not the shared kind: keeps photos and the UPI ID)
 * @property {object|null} settle the settle-up as it was (lib/settle.js shape), for the actual spend
 * @property {"auto"|"manual"|"import"} source  archived when the date passed, saved by the host, or a co-host's plan
 */

export const entryId = (snapshot) => `${snapshot?.party?.date || "undated"}|${(snapshot?.party?.name || "Party").trim()}`;

/** @returns {HistoryEntry} */
export const makeEntry = (snapshot, { settle = null, source = "manual", now = Date.now() } = {}) =>
  ({ id: entryId(snapshot), savedAt: now, snapshot, settle, source });

// Newest first; the same party saved again replaces its entry; at most HISTORY_MAX.
export const addEntry = (list, entry) => [entry, ...(Array.isArray(list) ? list : []).filter((e) => e?.id !== entry.id)].slice(0, HISTORY_MAX);

export const removeEntry = (list, id) => (Array.isArray(list) ? list : []).filter((e) => e?.id !== id);
