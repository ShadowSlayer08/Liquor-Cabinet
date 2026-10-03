# Liquor Cabinet — guide for Claude Code

Android + iOS party planner (React 19 + Vite 8 + Capacitor 8). Live liquor prices scraped from Livcheers, a budget optimiser ("Fill my bar"), cocktails and mocktails, suggestions from the bottles and guest prefs, a party food/drinks calculator with templates, dry days, bill split and settle-up, invites, reminders, rides home, and ordering hand-off to Zomato, Bistro and Blinkit / Zepto / Instamart. Started from `docs/original/cellar-planner.jsx` (a Claude-artifact prototype).

**Start here when resuming:** read `docs/HANDOFF.md` (current status, what's unverified on a real phone, ideas for next), then `docs/RESEARCH.md` (how each data source works and why).

## Commands

```bash
npm install
npm test            # node --test "tests/*.test.mjs" — offline unit tests + live Livcheers/Zomato parser tests
npm run dev         # browser preview; Vite proxies /proxy/livcheers|zomato to stand in for native HTTP
npm run build       # vite build → dist/
npm run icons       # regenerate launcher icons, adaptive layers, splash, notification icon from resources/logo-mark.svg
npm run apk         # vite build + cap sync + Gradle assembleRelease (scripts/gradle.mjs, works on Windows too)
npx cap sync          # after adding/removing a Capacitor plugin or changing capacitor.config.json (android + ios)
LC_SKIP_LIVE=1 npm test   # offline tests only (what CI runs)
```

CI (`.github/workflows/`): `android.yml` = offline tests + debug APK on every push; `ios.yml` = unsigned IPA (artifact) + a Simulator run that syncs prices and screenshots every tab (`scripts/ci/ios-screenshots.sh`; artifact `ios-simulator-screens`). **There's no Mac here — Swift only compiles in CI**: push, then `gh run watch`, `gh run download <id> -n ios-simulator-screens`. Swift gotcha: `/*` inside a `/** … */` comment opens a nested comment.

APK output: `android/app/build/outputs/apk/release/LiquorCabinet-<versionName>-release.apk`. Copy the one you ship to `release/LiquorCabinet-<version>.apk` (older ones are removed from `release/`).

Requirements: Node 20+, JDK 21 (`JAVA_HOME`), Android SDK platform 36 (`ANDROID_HOME` or `android/local.properties` with `sdk.dir=`). minSdk is 26 (Android 8.0) — `@capacitor/inappbrowser` requires it.
On the maintainer's Windows PC: JDK at `%LOCALAPPDATA%\Programs\jdk-21`, SDK at `%LOCALAPPDATA%\Android\Sdk`.

## Release signing & versioning

- `android/keystore.properties` + `android/keystore/liquor-cabinet.jks` sign release builds. Both are **git-ignored and must never be committed**. Without them, `assembleRelease` falls back to the debug key (such an APK won't install over the user's current one).
- Bump **both** `versionCode` and `versionName` in `android/app/build.gradle`, plus `version` in `package.json`, `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`, and the "Liquor Cabinet vX" line in `src/components/PlanTab.jsx`, for every APK you hand over. Current: v1.4.1 = versionCode 6 (iOS build 6).
- The user sideloads APKs (no Play Store — alcohol-app policies). GitHub: https://github.com/ShadowSlayer08/Liquor-Cabinet (public; renamed from liquor-cabinet, old URLs redirect) — push only when the user asks. Releases page carries the APK + unsigned IPA per version (`gh release create vX.Y …`). The README's "Data sources & legal notice" (free, non-profit, personal use) must stay accurate when data sources change.

## Architecture

```
src/
  App.jsx                 shell: topbar, 5 tabs, welcome screen, city picker, all persisted state (cfg: plan, carts, settle, grocer);
                          App-level sheets FillBarSheet / SettleSheet / LegalSheet; addItems(), goBar(kind), notification routing
  styles.css              design system (tokens in :root) — "midnight speakeasy"; v1.3 rules sit in per-feature blocks at the end
  components/
    Art.jsx               SVG bottle illustrations per category, line icons (Icon.*), Ring gauge, VegMark
    CabinetTab.jsx        hero (cocktails chip, Fill my bar, dry-day banner, store finder), category tiles, Editor's picks, product grid/list, price-drop filter
    BarTab.jsx            Cocktails | Mocktails, "Picked for your party", makeable first + party menu;  CocktailSheet.jsx = recipe + servings
    FillBarSheet.jsx      budget optimiser UI (mix, pins/skips) → addItems
    TemplatesRow.jsx / DriversField.jsx / GuestPrefs.jsx / GaugeActions.jsx   Food party-card pieces (templates, drivers, "Guests like…", gauge actions)
    SettleSheet.jsx       settle-up after the party (actual bills, fewest payments, UPI QR);  LegalSheet.jsx = in-app legal notice
    ProductCard.jsx       bottle "display case" card (BottleStage) + price-move pill
    ProductSheet.jsx      bottle detail: rating bars, price history, tasting notes, pairings
    ScraperPanel.jsx      Livcheers sync UI (terminal log)
    FoodTab.jsx           location card, party card (templates, name/date/time, drivers, DryDayBanner, guest prefs), drinks gauge, dishes ranked for the party
                          (illustrations only — no Zomato photos, the owner's choice) / Bistro items, supplies, mini-cart
    DishSheet.jsx         Zomato restaurants for a dish (GPS-localised, sortable)
    MenuSheet.jsx         a restaurant's real Zomato menu → exact items into the cart (exact ₹ when signed in)
    GrocerySheet.jsx      pick a product option for a supply; live Blinkit price check (phone, beta)
    CartTab.jsx           liquor list + store finder, food cart grouped by provider, grocer seg (Blinkit/Zepto/Instamart), "Send order" hand-offs (+ floating bubble)
    PlanTab.jsx           budget ring, spend donut, then the plan/ cards, location, batches, price DB, data sources
    plan/                 InviteCard, SplitCard (→ settle up), RemindersCard, RidesCard (getting home), DryDaysCard, ZomatoAccountCard, BubbleCard
    RemindersWatcher.jsx  App-level: offers to move reminders when the party date/time changes
    DryDayBanner.jsx      red/amber dry-day warning for a date
    Sheet.jsx             bottom sheet + Stepper/Qty/Spinner/Skeleton
  lib/
    parse/livcheers.js    pure parser: Next.js RSC flight → items; CATEGORIES (18), CITIES (30), TIER
    parse/zomato.js       pure parser: __PRELOADED_STATE__ → dish restaurants + restaurant menus (+ item prices when present)
    sources.js            scrapers + IndexedDB caching (Livcheers 7 d, Zomato 12 h, menus 6 h); price history on each sync
    pricehist.js          pure: price-change badges (≤14 d) + last 8 prices per bottle (`hist:city:cat`)
    http.js               getText(): CapacitorHttp natively (no CORS), Vite proxy in browser; cookie handling
    location.js           GPS → nearest Livcheers city + Zomato delivery zone (ltv/lty cookies); Bistro areas
    food.js               planParty() calculator (takes the cocktail menu; drivers + soft drinks), DEFAULT_PARTY/PREFS, GROCERIES (catalog, MRPs), BISTRO_ITEMS
    dishes.js             DISHES (60, tagged: cuisines, spice, protein, jainOk, finger, pairsCocktails), CUISINES, PROTEINS, suggestDishes()
    cocktails.js          COCKTAILS (75) + MOCKTAILS (22), TAGS, DRINK_TASTES, makeable(), cocktailUses(), menu helpers
    suggestDrinks.js / suggestFood.js / prefs.js   ranked picks with reasons from bottles + party.prefs (pure)
    optimise.js           fillBar(): MIXES, pins/skips, exact knapsack + trimmed fallback (pure)
    templates.js          party templates (festivalDate() from drydays.js)
    rides.js / settle.js / grocers.js   rides home links, settle-up maths, Blinkit/Zepto/Instamart (pure)
    legal.js              in-app legal notice; LEGAL_SERVICES must name every https host in src (tests/legal.test.mjs, also checks the README table)
    drydays.js            dry-day tiers per state, dryDayOn(), lastShoppingDay(), nextSaturday(), custom days
    split.js              splitBill(), upiLink(), validVpa(), WhatsApp text
    reminders.js          party-time reminders via local notifications (pure parts: reminderPlan.js, when.js) — incl. last call + settle up
    canvas.js             shared canvas drawing for invite.js (invite card) and paycard.js (UPI QR payment card)
    shareImage.js         canvas → Filesystem cache → Share sheet (download in the browser)
    zomatoAccount.js      in-app Zomato sign-in (InAppBrowser, isIsolated: false) / sign-out / verification
    blinkitLive.js        live Blinkit prices via WebRenderPlugin; CARD_SCRIPT + pure card-text parser
    bubble.js             floating order checklist via OrderBubblePlugin
    order.js              hand-offs (Zomato/Bistro/grocers/rides/Maps), checklist notification, share/clipboard, haptics
    store.js / back.js / format.js
android/app/src/main/java/com/shadowslayer/liquorcabinet/
    MainActivity.java     registers the three plugins below
    ExternalAppPlugin.java  open(url, pkg, fallback) / launch(pkg) / isInstalled(pkg)
    WebRenderPlugin.java    extract({url, script, timeoutMs, pollMs}) — hidden WebView behind the app, polls a script
    OrderBubblePlugin.java  canDraw / requestPermission / show({title, lines, done}) / hide — overlay bubble + checklist card
scripts/make-icons.mjs    all raster icons from the SVG logo (sharp)
scripts/gradle.mjs        runs the Gradle wrapper on any OS
ios/App/App/              (Capacitor iOS, SPM — CapApp-SPM/Package.swift is CLI-managed)
    SceneDelegate.swift   creates MainViewController (the template's Main.storyboard is not used)
    MainViewController.swift  registers the Swift plugins; Debug builds open LC_OPEN_URL (CI)
    ExternalAppPlugin.swift   same JS contract as the Java one; maps Android package names to zomato:// / comgooglemaps:// / universal links
    WebRenderPlugin.swift     hidden WKWebView behind the app's web view; injects lat/lon as navigator.geolocation
    CookieBridgePlugin.swift  iOS-only: copies/clears a site's WebKit cookies <-> HTTPCookieStorage (Zomato sign-in)
    Info.plist            location + Photos-add usage strings, LSApplicationQueriesSchemes, liquorcabinet:// scheme
```

## Conventions & gotchas

- Native plugins exist twice (Java + Swift) with **identical JS contracts**; OrderBubble is Android-only (`bubbleAvailable()` = `isAndroid()`). Gate platform differences with `isAndroid()` / `isIOS()` from `lib/http.js`.
- `cfg` (plan + carts) is stored with `@capacitor/preferences` on the phone (iOS can purge IndexedDB); everything else in IndexedDB is re-fetchable cache.
- Deep links: `liquorcabinet://tab/<cabinet|bar|food|cart|plan>[?view=liquor|food]` and `liquorcabinet://sync` (both platforms).
- The split's WhatsApp text has no `upi://pay` links (NPCI disallowed P2P intent payments in 2024); the payment card's QR codes are the way to pay.
- Parsers in `src/lib/parse/*` stay **pure** (no Capacitor imports) so `node --test` can run them.
- Every network call goes through `lib/http.js getText()`. Natively, Capacitor installs a global cookie handler backed by the WebView cookie store, so **never send a hand-written `Cookie` header** — pass `{ cookie }` and `getText` writes it into the store (`CapacitorCookies.setCookie`). In the browser it travels as `x-proxy-cookie` and `vite.config.js` converts it.
- The Vite proxy strips browser-only headers (`sec-*`, cookie, referer, origin); headless Chrome's `sec-ch-ua: HeadlessChrome` makes Zomato return 503.
- Blinkit/Zepto/Instamart/Bistro/Zomato have **no public cart API**; ride apps are only opened, never booked. Ordering = open the right page in their app + copy list + pinned checklist notification. Don't automate their UIs (ToS).
- Prices shown must be honest: Livcheers = indicative; Zomato = "cost for one" estimate unless the menu exposes prices; supplies = typical MRP from `GROCERIES`; Bistro = "price in app" (excluded from budget).
- A new external host needs a `LEGAL_SERVICES` entry in `lib/legal.js` **and** a row in the README's legal table, or `npm test` fails.
- Comment style: short header block per module explaining *why*; code reads like the surrounding code.
- UI copy: plain, friendly; ₹ via `fmt()` / `fmtShort()`.
- In this project's original cloud sandbox, Maven Central rate-limited Gradle; a machine-local `~/.gradle/init.d` mirror script was used. Locally you shouldn't need it.

## Testing

- `npm test` — offline tests always; `tests/parsers.live.test.mjs` hits livcheers.com and zomato.com (needs internet; can be slow).
- UI checks: `npm run dev` in a 375×812 / Pixel 7 viewport (v1.2 used Playwright with geolocation at Sector 57, Gurugram: 28.4595, 77.0266; v1.3 used the Claude desktop browser pane). Native-only paths (GPS permission, notifications, app hand-offs, image sharing, overlay bubble, hidden WebView, Zomato sign-in) must be checked on a real phone.
- blinkit.com answers curl with a Cloudflare 403 but renders in a real browser — that's how `CARD_SCRIPT` in lib/blinkitLive.js was checked (see tests/blinkit.test.mjs for the captured card texts).
