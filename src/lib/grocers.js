// ═══════════════════════════════════════════════════════════════════════════════
//  GROCERS — the 10-minute apps the supplies run can go to: Blinkit, Zepto and
//  Swiggy Instamart. Coverage and offers differ by neighbourhood, so the host
//  picks one; the list itself doesn't change (lines stay kind "blinkit").
//  Each is a search link: verified Android App Links / iOS universal links open
//  the app when it's installed, the website otherwise (checked 26 Sep 2026:
//  zepto.com + zeptonow.com and swiggy.com /.well-known files claim these paths).
//  None of them has a cart API, and only Blinkit's prices are ever read (beta,
//  lib/blinkitLive.js) — for Zepto and Instamart the catalog MRPs are estimates.
//  Pure (no Capacitor), so node --test covers it; lib/order.js opens the links.
// ═══════════════════════════════════════════════════════════════════════════════
const enc = encodeURIComponent;

export const blinkitSearchUrl = (q) => `https://blinkit.com/s/?q=${enc(q)}`;

// `pkgs` in order of preference (Android): Instamart's own app first, then the Swiggy app.
// `cls`: the logo, button and card-header classes (Blinkit keeps its v1.4 look; the others
// take their colour from styles.css, block "v1.4.1 · C").
export const GROCERS = {
  blinkit: {
    id: "blinkit", name: "Blinkit", logo: "blinkit", pkgs: ["com.grofers.customerapp"],
    home: "https://blinkit.com/", search: blinkitSearchUrl,
    cls: { logo: "logo logo-b", btn: "btn-blinkit", head: "provider-b" },
  },
  zepto: {
    id: "zepto", name: "Zepto", logo: "zepto", pkgs: ["com.zeptoconsumerapp"],
    home: "https://www.zeptonow.com/", search: (q) => `https://www.zeptonow.com/search?query=${enc(q)}`,
    cls: { logo: "logo out-logo out-g-zepto", btn: "out-btn out-g-zepto", head: "out-head out-g-zepto" },
  },
  instamart: {
    id: "instamart", name: "Instamart", logo: "instamart", pkgs: ["in.swiggy.android.instamart", "in.swiggy.android"],
    home: "https://www.swiggy.com/instamart", search: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc(q)}`,
    cls: { logo: "logo out-logo out-g-instamart", btn: "out-btn out-g-instamart", head: "out-head out-g-instamart" },
  },
};
export const GROCER_IDS = Object.keys(GROCERS);

// An unknown id (old cfg, a typo) means Blinkit, the app's original grocer.
export const grocerOf = (id) => GROCERS[id] || GROCERS.blinkit;
export const grocerSearchUrl = (id, query) => grocerOf(id).search(String(query ?? "").trim());
