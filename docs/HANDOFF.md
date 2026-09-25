# Handoff — where things stand

_Updated 25 Sep 2026, at the end of the v1.3 session (local Claude Code on the user's Windows PC)._

## Shipped

| Version | APK | What |
| --- | --- | --- |
| v1.0 | (history) | JSX prototype → Capacitor Android app; own Livcheers scraper; food calculator; Blinkit/Zomato hand-off |
| v1.1 | (history) | Repo revamped (Keybase proof removed, app at root); DMart price source removed → built-in Blinkit catalog (MRP) |
| v1.2 | (history) | GPS → Zomato delivery zone; real Zomato menus; Bistro; order-checklist notifications; full "wow" redesign |
| **v1.3** | `release/LiquorCabinet-1.3.apk` (versionCode 4) | Bar tab + cocktails, dry days, price-drop badges, store finder, bill split + UPI QR card, invite card, reminders, exact Zomato prices (beta), live Blinkit prices (beta), floating order checklist (beta) |

Repo: **https://github.com/ShadowSlayer08/liquor-cabinet** (public, pushed at the user's request). The signing key (`android/keystore/`, `android/keystore.properties`) is git-ignored and never committed; the v1.3 APK is signed with the same key as v1.2 (cert SHA-256 `a3d9f3e7…98abd9`), so it installs over it.

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

Also: minSdk 26 (Android 8.0 — `@capacitor/inappbrowser` needs it); `npm test` uses a glob and `npm run apk` runs Gradle via `scripts/gradle.mjs` (both broke on Windows before).

## How it was checked

- `npm test` — 74 tests (offline units for every new pure module + live Livcheers/Zomato parser tests).
- Browser walkthrough (375×812) with live Livcheers/Zomato data: all 5 tabs, cocktail menu → Blinkit list, dry-day banners, price drops (seeded an older cache), split maths, invite + payment card images rendered, a real Zomato menu, v1.2 → v1.3 cfg upgrade, no console errors.
- Multi-agent code review (5 dimensions, each finding checked by two skeptics); confirmed findings fixed in `ea9db8f` and later commits.
- `gradlew assembleRelease` compiles the three native plugins cleanly.

## Not verified — needs a real phone

Nothing native has run on a device yet (same as v1.2). Check on the phone:
- Location permission, notifications (checklist + reminders firing at the right time, tap routing), haptics, app hand-offs (Zomato/Bistro/Blinkit/Maps/WhatsApp wa.me), image sharing (invite/payment card via the Share sheet).
- Zomato sign-in inside the in-app browser (OTP flow), whether `isIsolated: false` really shares the session with native requests, which price field signed-in menus use.
- Live Blinkit: whether blinkit.com loads in the hidden WebView on mobile data/Wi-Fi, whether "Detect my location" gets a location, and whether the cards parse.
- Floating bubble: overlay permission flow (Android 11+ opens the full app list), drag/tap, "Back to Liquor Cabinet" from the background.
- UPI QR codes scanning in GPay / PhonePe / Paytm with the amount filled in.

## Ideas for next

- Sync ticks from the floating bubble back into the Blinkit checklist (the plugin can `notifyListeners("toggle")`).
- A yearly refresh of festival dry days (or fetch the state excise lists).
- Lazy-load `qrcode` (≈55 kB) with `import()` if bundle size matters.

## Explicitly skipped (user agreed)

Auto-adding to other apps' carts via accessibility tricks (ToS risk); Play Store publishing.
