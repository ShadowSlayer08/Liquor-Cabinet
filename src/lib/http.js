// ═══════════════════════════════════════════════════════════════════════════════
//  HTTP — one GET helper for every scraper in the app.
//  • On Android the request goes through CapacitorHttp (native networking), so
//    cross-origin sites like livcheers.com / zomato.com just work.
//  • In a desktop browser (npm run dev) it goes through the Vite dev proxy.
// ═══════════════════════════════════════════════════════════════════════════════
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

const DEV_PROXY = {
  "https://www.livcheers.com": "/proxy/livcheers",
  "https://www.zomato.com": "/proxy/zomato",
};

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

export const isNative = () => Capacitor.isNativePlatform();

export async function getText(url, { timeout = 30000, headers = {} } = {}) {
  if (isNative()) {
    const res = await CapacitorHttp.get({
      url,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        ...headers,
      },
      responseType: "text",
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    if (res.status >= 400) throw new HttpError(res.status, url);
    return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  }

  const origin = Object.keys(DEV_PROXY).find((o) => url.startsWith(o));
  const target = origin ? DEV_PROXY[origin] + url.slice(origin.length) : url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(target, { signal: ctrl.signal, headers });
    if (!res.ok) throw new HttpError(res.status, url);
    return await res.text();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`Timed out after ${timeout / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getJSON(url, opts) {
  return JSON.parse(await getText(url, opts));
}
