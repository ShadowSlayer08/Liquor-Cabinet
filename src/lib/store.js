// ═══════════════════════════════════════════════════════════════════════════════
//  STORAGE — IndexedDB (via idb-keyval). Replaces the artifact-only
//  window.storage from the original planner; survives app restarts and has
//  room for the full scraped catalog (several MB).
//  iOS may clear a web view's IndexedDB when the phone runs low on space. Prices
//  and menus can simply be fetched again, but the party plan and carts ("cfg")
//  can't — so on the phone that one key lives in native storage
//  (@capacitor/preferences: UserDefaults / SharedPreferences), copied over from
//  IndexedDB the first time it's read.
// ═══════════════════════════════════════════════════════════════════════════════
import { get, set, del, keys, clear } from "idb-keyval";
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./http.js";

const DURABLE = new Set(["cfg"]);
const durable = (key) => DURABLE.has(key) && isNative();

async function getDurable(key) {
  const { value } = await Preferences.get({ key });
  if (value != null) return JSON.parse(value);
  const old = (await get(key)) ?? null;                       // saved by v1.3 or earlier
  if (old != null) await Preferences.set({ key, value: JSON.stringify(old) });
  return old;
}

export const store = {
  async get(key) {
    try { return durable(key) ? await getDurable(key) : (await get(key)) ?? null; } catch { return null; }
  },
  async set(key, val) {
    try {
      if (durable(key)) await Preferences.set({ key, value: JSON.stringify(val) });
      else await set(key, val);
    } catch (e) { console.warn("store.set", key, e); }
  },
  async del(key) {
    try { if (durable(key)) await Preferences.remove({ key }); await del(key); } catch {}
  },
  async list(prefix = "") {
    try { return (await keys()).filter((k) => String(k).startsWith(prefix)); } catch { return []; }
  },
  async clearAll() {
    try { await clear(); if (isNative()) await Preferences.clear(); } catch {}
  },
};
