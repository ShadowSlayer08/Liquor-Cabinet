# Research notes — how each data source works

Findings from the original session (Sep 2026), with what was verified and what wasn't.

## Livcheers (liquor prices) — verified

- Pages: `https://www.livcheers.com/<city>/category/<slug>` (Next.js app router). The full product list for the city is inside the RSC "flight" payload: concatenate every `self.__next_f.push([1,"…"])` string, find `"items":[`, bracket-match, `JSON.parse`.
- Row shape: `city_liquors{price, priceCategory}`, `liquors{id, code, displayName, size, slug, tastingNotes, description}`, `liquor_groups{averageOverallRating, averageTasteRating, averageValueForMoneyRating, averageLikelihoodToBuyAgainRating}`, `brands{name}`, `country{name, code}`, `liquor_types{name}`.
- Product link `https://www.livcheers.com/<city>/liquor/<slug>`; image `https://static.livcheers.com/static/content/images/liquor/<code>.webp` (small, 225–700 px, white background → the app multiply-blends it onto a warm backdrop). No larger image exists.
- 18 category slugs (single-malts, world-whisky, blended-scotch, made-in-india-whisky, gin, tequila, rum, vodka, brandy, beers, red-wine, white-wine, rose-wine, sparkling-wine, champagne, liqueurs, sake, ready-to-drink) and 30 cities (from `/select-city`). Gurgaon single malts ≈ 174 items, ~800 KB HTML.

## Zomato (food) — verified

- Dish pages: `https://www.zomato.com/<zcity>/delivery/dish-<dish>` (some dishes only exist as `/<zcity>/restaurants/<cuisine>`). Server-rendered `window.__PRELOADED_STATE__ = JSON.parse("…")`; restaurants at `pages.search[<path>].sections.SECTION_SEARCH_RESULT[].info` (+ `.order.deliveryTime`, `.cardAction.clickActionDeeplink` → `zomato://order/<resId>`).
- Zomato city slugs: NCR cities → `ncr`; Bengaluru → `bangalore`; etc. (`location.js zomatoSlugFor`).
- **GPS localisation:** `GET https://www.zomato.com/webroutes/location/get?lat=..&lon=..` → `locationDetails.{entityId, entityType, cityName, orderLocationName}`. Sending cookies `ltv=<entityId>; lty=<entityType>` localises dish and menu pages (Sector 57 Gurugram → Gurgaon restaurants 1–3 km away; Chennai T. Nagar → 112 m). The URL's city slug must match the zone's city. A `locus` cookie *breaks* results — don't send it.
- Restaurant menus: `https://www.zomato.com/<zcity>/<restaurant-slug>/order` → `pages.restaurant[<resId>].order.menuList.menus[].menu.categories[].category.items[].item` (`id, name, desc, item_image_url, dietary_slugs, tag_slugs`). **Item prices are hidden for logged-out visitors** (`order.price_login_blocker: true`) — hence v1.3 item 8.
- Headless Chrome's `sec-ch-ua: "HeadlessChrome"` header → 503; native requests don't send it.

## Blinkit / Bistro (ordering) — partly verified

- No public price feed; `blinkit.com` and its APIs return Cloudflare 403 from datacenter IPs (so live prices can only be tried from a phone — v1.3 item 9).
- Verified via Google's Digital Asset Links API: `https://blinkit.com` is an App Link for `com.grofers.customerapp`, `https://bistro.blinkit.com` for `com.blinkit.bistro`. So `https://blinkit.com/s/?q=<query>` should open the Blinkit app (whether its intent filter covers `/s/` is unverified).
- Bistro (Blinkit's 10-minute food app, package `com.blinkit.bistro`) runs in parts of Gurugram, Delhi-NCR, Noida and Bengaluru; no public menu or prices. Sources: [Play Store](https://play.google.com/store/apps/details?id=com.blinkit.bistro), [bistro.blinkit.com](https://bistro.blinkit.com/), [Business Standard](https://www.business-standard.com/industry/news/race-for-instant-food-heats-up-blinkit-launches-bistro-to-rival-zepto-cafe-124121300393_1.html).
- DMart's public search API worked for live grocery prices but the user asked to remove DMart (v1.1).

## Dry days — sources disagree

- National dry days (26 Jan, 15 Aug, 2 Oct) are certain. Everything else is notified per state, often quarterly, plus ad-hoc election bans.
- Delhi 2026 official orders: Q1 = 26 Jan, 15 Feb, 21 Mar, 26 Mar, 31 Mar (Holi removed — [Tribune](https://www.tribuneindia.com/news/delhi/delhi-govt-removes-holi-from-2026-dry-day-list/)); May–Sep = Buddha Purnima, Bakrid, Muharram, 15 Aug, Janmashtami ([Delhi Excise](https://excise.delhi.gov.in/excise/dry-day-order-dated-24042026)). Aggregator sites (isitadryday.in) list more days than the official orders → not used as a source of truth.
- 2027 festival dates (Drik Panchang / [DevDarsha](https://devdarsha.com/india-hindu-festival-dates-2027)): Maha Shivratri 6 Mar, Holi 22 Mar, Ram Navami 15 Apr, Janmashtami 25 Aug, Ganesh Chaturthi 4 Sep, Dussehra 9 Oct, Diwali 29 Oct, Guru Nanak Jayanti 14 Nov.

## Capacitor specifics that matter

- `CapacitorCookies` plugin always installs a global `CookieHandler` backed by the WebView cookie store (regardless of its `enabled` flag) → native HTTP sends/stores WebView cookies. Write cookies with `CapacitorCookies.setCookie` rather than a manual header.
- `@capacitor/inappbrowser` `openInWebView` runs in an **isolated process by default** (`android.isIsolated`, default true) → separate cookie store. Set `isIsolated: false` to share logins with the app.
- `SystemBars` (core in Capacitor 8) injects `--safe-area-inset-*` CSS vars (`insetsHandling: "css"`).
