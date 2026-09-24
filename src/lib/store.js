// ═══════════════════════════════════════════════════════════════════════════════
//  STORAGE — IndexedDB (via idb-keyval). Replaces the artifact-only
//  window.storage from the original planner; survives app restarts and has
//  room for the full scraped catalog (several MB).
// ═══════════════════════════════════════════════════════════════════════════════
import { get, set, del, keys, clear } from "idb-keyval";

export const store = {
  async get(key) {
    try { return (await get(key)) ?? null; } catch { return null; }
  },
  async set(key, val) {
    try { await set(key, val); } catch (e) { console.warn("store.set", key, e); }
  },
  async del(key) {
    try { await del(key); } catch {}
  },
  async list(prefix = "") {
    try { return (await keys()).filter((k) => String(k).startsWith(prefix)); } catch { return []; }
  },
  async clearAll() {
    try { await clear(); } catch {}
  },
};
