# Liquor Cabinet — guide for Claude Code

Android party planner (React 19 + Vite 8 + Capacitor 8). Live liquor prices scraped from Livcheers, a party food/drinks calculator, and ordering hand-off to Zomato, Bistro and Blinkit. Started from `docs/original/cellar-planner.jsx` (a Claude-artifact prototype).

**Start here when resuming:** read `docs/HANDOFF.md` (current status + the v1.3 build list with specs), then `docs/RESEARCH.md` (how each data source works and why).

## Commands

```bash
npm install
npm test            # node --test tests/ — calculator, cocktails, dry days, location (offline) + live Livcheers/Zomato parser tests
npm run dev         # browser preview; Vite proxies /proxy/livcheers|zomato to stand in for native HTTP
npm run build       # vite build → dist/
npm run icons       # regenerate launcher icons, adaptive layers, splash, notification icon from resources/logo-mark.svg
npm run apk         # vite build + cap sync + gradlew assembleRelease
npx cap sync android  # after adding/removing a Capacitor plugin or changing capacitor.config.json
```

APK output: `android/app/build/outputs/apk/release/LiquorCabinet-<versionName>-release.apk`. Copy the one you ship to `release/LiquorCabinet-<version>.apk` (older ones are removed from `release/`).

Requirements: Node 20+, JDK 21, Android SDK platform 36 (`ANDROID_HOME` set).

## Release signing & versioning

- `android/keystore.properties` + `android/keystore/liquor-cabinet.jks` sign release builds. Both are **git-ignored and must never be committed**. Without them, `assembleRelease` falls back to the debug key (such an APK won't install over the user's current one).
- Bump **both** `versionCode` and `versionName` in `android/app/build.gradle`, plus `version` in `package.json`, and the "Liquor Cabinet vX" line in `src/components/PlanTab.jsx`, for every APK you hand over. Current: v1.2 = versionCode 3.
- The user sideloads APKs (no Play Store — alcohol-app policies). Do not push to GitHub unless the user asks.

## Architecture

```
src/
  App.jsx                 shell: topbar, 4 tabs, welcome screen, city picker, all persisted state (IndexedDB key "cfg")
  styles.css              design system (tokens in :root) — "midnight speakeasy": Playfair Display + Outfit, gold gradient, glass cards
  components/
    Art.jsx               SVG bottle illustrations per category, line icons (Icon.*), Ring gauge, VegMark
    CabinetTab.jsx        hero, category tiles, Editor's picks, product grid/list
    ProductCard.jsx       bottle "display case" card (BottleStage: multiply-blended photo on warm backdrop)
    ProductSheet.jsx      bottle detail: rating bars, tasting notes, pairings
    ScraperPanel.jsx      Livcheers sync UI (terminal log)
    FoodTab.jsx           location card, party inputs, drinks gauge, Zomato dishes / Bistro items, Blinkit supplies, mini-cart
    DishSheet.jsx         Zomato restaurants for a dish (GPS-localised, sortable)
    MenuSheet.jsx         a restaurant's real Zomato menu → exact items into the cart
    GrocerySheet.jsx      pick a Blinkit product option for a supply
    CartTab.jsx           liquor list + food cart grouped by provider, "Send order" hand-offs
    PlanTab.jsx           budget ring, spend donut, location, batches, price DB, data sources
    Sheet.jsx             bottom sheet + Stepper/Qty/Spinner/Skeleton
  lib/
    parse/livcheers.js    pure parser: Next.js RSC flight → items; CATEGORIES (18), CITIES (30), TIER
    parse/zomato.js       pure parser: __PRELOADED_STATE__ → dish restaurants + restaurant menus
    sources.js            scrapers + IndexedDB caching (Livcheers 7 d, Zomato 12 h, menus 6 h)
    http.js               getText(): CapacitorHttp natively (no CORS), Vite proxy in browser; cookie handling
    location.js           GPS → nearest Livcheers city + Zomato delivery zone (ltv/lty cookies); Bistro areas
    food.js               planParty() calculator, DISHES (Zomato), GROCERIES (Blinkit catalog, MRPs), BISTRO_ITEMS
    order.js              hand-offs (Zomato/Bistro/Blinkit), checklist notification, share/clipboard, haptics
    cocktails.js          [v1.3] COCKTAILS, makeable(), cocktailUses()
    drydays.js            [v1.3] dry-day tiers per state, dryDayOn(), lastShoppingDay()
    split.js              [v1.3] splitBill(), upiLink(), validVpa()
    reminders.js          [v1.3] party-time reminders via local notifications
    store.js / back.js / format.js
android/app/src/main/java/com/shadowslayer/liquorcabinet/
    MainActivity.java     registers ExternalAppPlugin
    ExternalAppPlugin.java  open(url, pkg, fallback) / launch(pkg) / isInstalled(pkg)
scripts/make-icons.mjs    all raster icons from the SVG logo (sharp)
```

## Conventions & gotchas

- Parsers in `src/lib/parse/*` stay **pure** (no Capacitor imports) so `node --test` can run them.
- Every network call goes through `lib/http.js getText()`. Natively, Capacitor installs a global cookie handler backed by the WebView cookie store, so **never send a hand-written `Cookie` header** — pass `{ cookie }` and `getText` writes it into the store (`CapacitorCookies.setCookie`). In the browser it travels as `x-proxy-cookie` and `vite.config.js` converts it.
- The Vite proxy strips browser-only headers (`sec-*`, cookie, referer, origin); headless Chrome's `sec-ch-ua: HeadlessChrome` makes Zomato return 503.
- Blinkit/Bistro/Zomato have **no public cart API**. Ordering = open the right page in their app + copy list + pinned checklist notification. Don't automate their UIs (ToS).
- Prices shown must be honest: Livcheers = indicative; Zomato = "cost for one" estimate unless the menu exposes prices; Blinkit supplies = typical MRP from `GROCERIES`; Bistro = "price in app" (excluded from budget).
- Comment style: short header block per module explaining *why*; code reads like the surrounding code.
- UI copy: plain, friendly; ₹ via `fmt()` / `fmtShort()`.
- In this project's original cloud sandbox, Maven Central rate-limited Gradle; a machine-local `~/.gradle/init.d` mirror script was used. Locally you shouldn't need it.

## Testing

- `npm test` — offline tests always; `tests/parsers.live.test.mjs` hits livcheers.com and zomato.com (needs internet; can be slow).
- UI checks were done with Playwright (global install) against `npm run dev` in a Pixel 7 viewport with geolocation granted (Sector 57, Gurugram: 28.4595, 77.0266). Native-only paths (GPS permission, notifications, app hand-offs) must be checked on a real phone.
