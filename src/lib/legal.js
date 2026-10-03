// ═══════════════════════════════════════════════════════════════════════════════
//  LEGAL NOTICE & PRIVACY  (pure — unit-tested)
//
//  The README's "Data sources & legal notice", in the app's plain voice, for the
//  people who sideload the app and never see the README. LEGAL_SERVICES must name
//  every service the app talks to: tests/legal.test.mjs scans the source for
//  https hosts and fails when one isn't covered here, so a new hand-off can't ship
//  without being named. Edit this file and the README section together.
// ═══════════════════════════════════════════════════════════════════════════════

export const REPO_URL = "https://github.com/ShadowSlayer08/Liquor-Cabinet";
export const ISSUES_URL = `${REPO_URL}/issues`;

// `hosts` cover their subdomains (www., m., static. …).
export const LEGAL_SERVICES = [
  { name: "Livcheers", hosts: ["livcheers.com", "static.livcheers.com"], use: "Liquor prices, ratings and tasting notes for your city" },
  { name: "Zomato", hosts: ["zomato.com"], use: "Your delivery zone, restaurants that deliver a dish to you and their menus; opening your order in Zomato" },
  { name: "Blinkit / Bistro", hosts: ["blinkit.com", "bistro.blinkit.com"], use: "Opening your supply list or order in their apps; an optional live price check (beta)" },
  { name: "Zepto", hosts: ["zeptonow.com", "zepto.com"], use: "Opening your supply list in Zepto, if you pick it" },
  { name: "Swiggy Instamart", hosts: ["swiggy.com"], use: "Opening your supply list in Instamart, if you pick it" },
  { name: "Google Maps", hosts: ["google.com"], use: "Liquor stores near you, and the dry-day check (a Google search)" },
  { name: "WhatsApp", hosts: ["wa.me"], use: "Sharing lists, invites, ride links and the bill split" },
  { name: "Uber", hosts: ["m.uber.com"], use: "Opening a ride home with your pickup filled in" },
  { name: "Ola", hosts: ["book.olacabs.com"], use: "Opening a ride home with your pickup filled in" },
  { name: "Rapido", hosts: ["rapido.bike"], use: "Opening the Rapido app for a ride home" },
  { name: "DriveU", hosts: ["driveu.in"], use: "Opening DriveU for a driver for your own car" },
];

// Hosts that aren't a data source: the project's own GitHub page. (Fonts are bundled, not fetched.)
export const LEGAL_ALLOWED_HOSTS = ["github.com"];

const covers = (host, h) => host === h || host.endsWith(`.${h}`);
// The service a host belongs to (www.zomato.com → Zomato), or null.
export function serviceForHost(host) {
  const x = String(host || "").toLowerCase().replace(/\.$/, "");
  return LEGAL_SERVICES.find((s) => s.hosts.some((h) => covers(x, h))) || null;
}
export const isAllowedHost = (host) => LEGAL_ALLOWED_HOSTS.some((h) => covers(String(host || "").toLowerCase(), h));

export const LEGAL_INTRO = "Liquor Cabinet is a free hobby project: no ads, subscriptions, affiliate links or sponsored bottles. It doesn't make money in any way.";

// "Your data" — what leaves the phone, and when.
export const LEGAL_DATA = [
  "The app connects to these services from your phone, only when you use the feature, and keeps what it fetches only on this phone.",
  "There's no Liquor Cabinet server: nothing is collected, sold or shared by this project.",
  "Your location goes to Zomato, rounded to about 10 m, to find restaurants that deliver to you, and to a ride app as the pickup when you open one.",
  "Zomato sign-in and live Blinkit prices (beta) use your own account and connection.",
  "The services still see what any website sees, like your IP address. Clear cached data any time in the Plan tab.",
];

export const LEGAL_POINTS = [
  { id: "affiliation", title: "Not affiliated", text: "Liquor Cabinet isn't affiliated with, endorsed or sponsored by any of these services. Product names, prices, ratings, menus, logos and trademarks belong to their owners." },
  { id: "terms", title: "Their terms still apply", text: "Using a service through the app is subject to that service's own terms of use, and you're responsible for how you use it." },
  { id: "prices", title: "Prices are indicative", text: "Prices and availability can be out of date. The shop, restaurant or app has the final word." },
  { id: "takedown", title: "Represent one of these services?", text: "If you'd like the app to stop using your data or change how it does, open an issue on GitHub. It will be honoured promptly." },
  { id: "age", title: "Adults only", text: "For adults of legal drinking age in their state. Not for use where alcohol is prohibited. Please drink responsibly." },
  { id: "warranty", title: "No warranty", text: "The app and its source are provided as is, without warranty of any kind. This notice is not legal advice." },
];
