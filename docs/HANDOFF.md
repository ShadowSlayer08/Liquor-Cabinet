# Handoff — where things stand

_Updated 2 Oct 2026, v1.4.1 (host features) — local Claude Code on the user's Windows PC._

## Shipped

| Version | APK | What |
| --- | --- | --- |
| v1.0 | (history) | JSX prototype → Capacitor Android app; own Livcheers scraper; food calculator; Blinkit/Zomato hand-off |
| v1.1 | (history) | Repo revamped (Keybase proof removed, app at root); DMart price source removed → built-in Blinkit catalog (MRP) |
| v1.2 | (history) | GPS → Zomato delivery zone; real Zomato menus; Bistro; order-checklist notifications; full "wow" redesign |
| v1.3 | (history) | Bar tab + cocktails, dry days, price-drop badges, store finder, bill split + UPI QR card, invite card, reminders, exact Zomato prices (beta), live Blinkit prices (beta), floating order checklist (beta) |
| v1.4 | (history) | iPhone (Capacitor iOS, Swift plugins, CI-built unsigned IPA), no upi:// links (NPCI), honest location copy, cfg in native storage, liquorcabinet:// links |
| **v1.4.1** | `release/LiquorCabinet-1.4.1.apk` (versionCode 6) + `release/LiquorCabinet-1.4.1-unsigned.ipa` (iOS build 6) | Fill my bar (budget optimiser), 75 cocktails + 22 mocktails, suggestions from bottles and guest prefs, 60 dishes, party templates, getting home (drivers + ride apps), settle up, Zepto / Instamart, in-app legal notice |

Repo: **https://github.com/ShadowSlayer08/Liquor-Cabinet** (public, pushed at the user's request). The signing key (`android/keystore/`, `android/keystore.properties`) is git-ignored and never committed; every APK since v1.2 is signed with the same key (cert SHA-256 `a3d9f3e7…98abd9`), so it installs over it.

## v1.4.1 — host features (what was built)

Built as a foundation commit (`b15a143`: party `drivers`/`prefs`/`mix`, `settle` + `grocer` in cfg, component stubs, ride/grocer app links in the manifest and the Swift plugin) and four parallel tracks with strict file ownership, merged into `v1.4.1`:

1. **Fill my bar** — `lib/optimise.js` `fillBar()` (pure, tested): MIXES (mixed / whisky night / beer & wine / light & easy / match my cocktails) set the share per family; pins, skips and excludes; an exact knapsack over rated bottles with a trimmed fallback. `FillBarSheet.jsx` from the Cabinet hero chip, the Food gauge (`GaugeActions.jsx`) and the empty cart; App `addItems()` adds cart + batch in one go.
2. **Mocktails & more cocktails** — `lib/cocktails.js`: 75 cocktails + 22 mocktails (`mocktail: true`), TAGS (17) and DRINK_TASTES; `planParty` adds soft drinks for non-drinkers and drivers (`soft {drinks, ml}`). BarTab Cocktails | Mocktails seg (App `barKind` / `goBar(kind)`).
3. **Suggestions** — `lib/suggestDrinks.js` and `lib/suggestFood.js` rank with reasons ("Pairs with your whisky", "Your guests like Chinese"); `lib/prefs.js` + `GuestPrefs.jsx` ("Guests like…": drinks, cuisines, spice, nobody eats…, Jain) stored as `party.prefs`. Dishes moved to `lib/dishes.js` (60, tagged by cuisine, spice, protein, Jain, finger food, cocktail pairing). Dish tiles always show the illustration (the owner didn't want Zomato photos swapped in — `sources.js` no longer saves `dishphoto:` keys).
4. **Party templates** — `lib/templates.js` (7) + `TemplatesRow.jsx`; `festivalDate()` in drydays.js puts Diwali/Holi on their next date (same yearly table update as the dry days).
5. **Getting home** — `lib/rides.js`: Uber (`m.uber.com/looking`) and Ola (`book.olacabs.com`) with the party pin as pickup, Rapido and DriveU just open; `DriversField.jsx` (drivers count as not drinking), `plan/RidesCard.jsx` (id `rides`) with a WhatsApp "home safe" message. Reminder "winddown" (last call, 45 min before the end) routes to the card.
6. **Settle up** — `lib/settle.js` (pure, paise-exact, fewest transfers, fair/equal like split.js) + `SettleSheet.jsx` (a UPI QR per payment, no upi:// in shared text); started from SplitCard, reminder "settle" the morning after (11:00).
7. **More grocery apps** — `lib/grocers.js` (Blinkit / Zepto / Instamart, `grocerOf`); the Cart's grocer seg sends the supplies run there (`openGrocerSearch` in order.js).
8. **Legal notice in the app** — `lib/legal.js` + `LegalSheet.jsx` (Plan footer, welcome screen). `tests/legal.test.mjs` scans the source for https hosts and fails when one isn't in `LEGAL_SERVICES` — and checks the README table names them all.

Also: location falls back to a GPS fix when there's no quick network fix (`aa1066e`, found on the emulator).

**Reminders on time** (found on the emulator): `@capacitor/local-notifications` asks for exact alarms by default, so on Android 14+ "Set reminders" — and even the order checklist — opened the system "Alarms & reminders" screen unannounced, and declining it gave alarms a 1-hour delivery window. The manifest now declares `USE_EXACT_ALARM` (granted at install on Android 13+; Play would restrict it, but the app is sideloaded), reminders pass `isExactNotification` only when exact alarms are allowed, and the checklist passes `false`. A reminder tap that cold-starts the app now waits for the Plan tab before scrolling to its card (`focusCard` in App.jsx).

### How v1.4.1 was checked

- `npm test` — 168 tests (164 offline + 4 live parser tests skipped offline; the live ones pass). The legal test fails if a source host or the README table misses a service.
- Browser (375×812): every new feature — Fill my bar (7 bottles, ₹7,410, ★5.0), 39 makeable cocktails / 22 mocktails with "Picked for your party", templates, drivers, guest prefs (Chinese → momos and chilli chicken first; "nobody eats mutton" removes mutton dishes), Getting home, settle-up, legal sheet; no console errors; dish tiles show no images.
- **Android emulator** (AVD `LC_Pixel7`, Android 16, the signed release APK): welcome + legal sheet, GPS → Sector 57 Gurugram, Smart Sync (2,128 products), Fill my bar → 7 bottles added, Bar (cocktails + mocktails, picks), Food (templates, Driving tonight, dry-day banner), Plan → Getting home card, reminders scheduled as exact alarms (`dumpsys alarm`: window=0, `policy_permission`), a last-call reminder fired on the minute, and moving the party offered to move the reminders. The tap → Getting home on a cold start was fixed after that run and re-checked in the browser only (the emulator session ended).
- iOS CI (Simulator): all tabs render with the v1.4.1 features; the Swift scheme mappings for the ride and grocer apps compile.

## v1.3 — what was built (HANDOFF items 1–10)

1. **Cocktails** — 5th tab **Bar** (`BarTab.jsx`, `CocktailSheet.jsx`): makeable first, recipe sheet with servings → `cocktailMenu` in cfg → `planParty(…, menu)`; supplies land under Blinkit "Cocktail extras". Cabinet hero chip "🍸 N cocktails you can make".
2. **Dry days** — party name/date/time in the Food party card; `DryDayBanner` (national/custom red with "buy by", festival/state amber "check", plus a heads-up when the *day before* the party is a certain dry day) in Food and the Cabinet hero; Plan card "Dry days ahead" + add your own. National days are generated for any year; festival dates cover 2026–2027 (**update `OFTEN`/`STATE_DAYS` in `lib/drydays.js` each year**).
3. **Price drops** — `lib/pricehist.js` (pure, tested) diffs each fresh scrape against the cache: `prevPrice/prevPriceAt/priceChangedAt` (badge ≤ 14 days) + `hist:city:cat` (last 8 prices). Card pill, "↓ Price drops" chip, ProductSheet history line.
4. **Store finder** — `findLiquorStores()` → Google Maps "liquor store near me" (Cart liquor view + Cabinet hero).
5. **Split the bill** — Plan card: include toggles, people/drinkers, Equal | Fair, host + UPI (`validVpa`); WhatsApp text via wa.me with UPI links; payment card image with a QR per share (`lib/paycard.js`). Amounts are labelled as planned prices.
6. **Invite card** — `lib/invite.js` draws 1080×1350 in the app's style (`lib/canvas.js` shared helpers); `lib/shareImage.js` → Filesystem cache → Share (download in the browser).
7. **Reminders** — Plan card with per-reminder toggles; `RemindersWatcher` asks (in-app prompt) to move reminders when the party date/time changes. The stock-the-bar reminder avoids dry days (party day *and* the day before). Notification taps route to the tab they name (App `onChecklistTap`).
8. **Exact Zomato prices (beta)** — Plan card "Zomato account": `InAppBrowser.openInWebView` with `isIsolated: false`; after close, force-refetches a menu to verify (`lib/zomatoAccount.js`). `parseMenuPage` reads `price ?? display_price ?? min_price ?? default_price`; exact lines carry `exact: true` (no "≈"). Sign-out clears Zomato cookies (falls back to clearing all cookies if some survive) and cached menus.
9. **Live Blinkit prices (beta)** — `WebRenderPlugin` (hidden WebView *underneath* the app's WebView, kept VISIBLE so Chromium doesn't throttle it) + `lib/blinkitLive.js` (`CARD_SCRIPT` + pure parser). The card-finding logic was checked against the live blinkit.com page in a real browser: price and ADD share a row, so the script grows to the largest ancestor holding one ADD. GrocerySheet "Check live price on Blinkit (beta)"; live picks stay live in the Food tab/cart and are labelled.
10. **Floating order bubble (beta)** — `OrderBubblePlugin` (TYPE_APPLICATION_OVERLAY, draggable gold bubble → checklist card, "Back to Liquor Cabinet", hidden while the app itself is in front); `lib/bubble.js`; Plan toggle requests "display over other apps"; Cart hand-offs show it alongside the notification.

Also: minSdk 26 (Android 8.0 — `@capacitor/inappbrowser` needs it; its camera/microphone permissions are stripped in AndroidManifest.xml); `npm test` uses a glob and `npm run apk` runs Gradle via `scripts/gradle.mjs` (both broke on Windows before).

## How it was checked

- `npm test` — 74 tests (offline units for every new pure module + live Livcheers/Zomato parser tests).
- Browser walkthrough (375×812) with live Livcheers/Zomato data: all 5 tabs, cocktail menu → Blinkit list, dry-day banners, price drops (seeded an older cache), split maths, invite + payment card images rendered, a real Zomato menu, v1.2 → v1.3 cfg upgrade, no console errors.
- Multi-agent code review (5 dimensions, each finding checked by two skeptics); confirmed findings fixed in `ea9db8f` and later commits.
- `gradlew assembleRelease` compiles the three native plugins cleanly.

## iOS (v1.4)

Capacitor iOS added (SPM) with Swift ports of ExternalApp and WebRender, a new CookieBridge plugin (iOS keeps WebKit and URLSession cookies apart — needed for the Zomato sign-in), MainViewController registration (via SceneDelegate), Info.plist, iOS icon/splash (`npm run icons ios`), and iPhone-aware JS (no bubble; full checklist in the notification body; Safari UA; cfg in Preferences; no input zoom). CI (`ios.yml`) builds an unsigned IPA and screenshots every tab in the Simulator. Every tab, a live Livcheers sync (1,407 products), the invite canvas, native storage and the Swift hand-off plugin were checked in the iOS Simulator (CI screenshots). Plan and options: `docs/ROADMAP.md` Phase 4. Nothing has run on a real iPhone yet.

## Not verified — needs a real phone

Nothing native has run on a device yet (same as v1.2). Check on the phone:
- Location permission, notifications (checklist + reminders firing at the right time, tap routing), haptics, app hand-offs (Zomato/Bistro/Blinkit/Maps/WhatsApp wa.me), image sharing (invite/payment card via the Share sheet).
- Zomato sign-in inside the in-app browser (OTP flow), whether `isIsolated: false` really shares the session with native requests, which price field signed-in menus use.
- Live Blinkit: whether blinkit.com loads in the hidden WebView on mobile data/Wi-Fi, whether "Detect my location" gets a location, and whether the cards parse.
- Floating bubble: overlay permission flow (Android 11+ opens the full app list), drag/tap, "Back to Liquor Cabinet" from the background.
- UPI QR codes scanning in GPay / PhonePe / Paytm with the amount filled in (split and settle-up).
- v1.4.1 hand-offs: Uber / Ola opening with the pickup filled in, Rapido / DriveU launching, Zepto / Instamart search links opening in their apps (Android packages and iOS schemes are guesses checked against assetlinks / docs, not on a phone with the apps installed).
- The "last call" and "settle up" reminders firing and routing to the Getting home card / settle-up sheet.

## Ideas for next

- Sync ticks from the floating bubble back into the Blinkit checklist (the plugin can `notifyListeners("toggle")`).
- A yearly refresh of festival dry days (or fetch the state excise lists).
- Lazy-load `qrcode` (≈55 kB) with `import()` if bundle size matters.

## Explicitly skipped (user agreed)

Auto-adding to other apps' carts via accessibility tricks (ToS risk); Play Store publishing.
