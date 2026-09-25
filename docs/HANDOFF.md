# Handoff — where things stand

_Written at the end of the original cloud session (25 Sep 2026) so a new local Claude Code session can continue exactly here._

## Shipped

| Version | APK | What |
| --- | --- | --- |
| v1.0 | (history) | JSX prototype → Capacitor Android app; own Livcheers scraper; food calculator; Blinkit/Zomato hand-off |
| v1.1 | (history) | Repo revamped (Keybase proof removed, app at root); DMart price source removed → built-in Blinkit catalog (MRP) |
| **v1.2** | `release/LiquorCabinet-1.2.apk` (versionCode 3) | GPS → Zomato delivery zone; real Zomato menus; Bistro; order-checklist notifications; full "wow" redesign |

The user loved v1.2 ("chef kiss"). v1.2 was **never tested on a real phone** — only in a Pixel 7 browser viewport. Native-only paths still unverified: location permission, checklist notification, opening Zomato/Bistro/Blinkit apps, haptics.

Git: all work is committed locally on branch `claude/liquor-cabinet-apk-build-ng7dq6`. The user said **no GitHub** (the cloud push was blocked anyway). Don't push unless asked.

## In progress: v1.3 — "build all" (user asked for all ten)

### Done so far (committed in `6a430e4`, tests green)
- `src/lib/cocktails.js` — 28 cocktails, `makeable(catIds)`, `cocktailUses(menu)`, `servingsByFamily(menu)`.
- `src/lib/food.js` — `planParty(party, lines, menu)` now takes the cocktail menu: cocktail servings **replace** the default mixer for that spirit family (no double-counted tonic/soda); `groceryNeeds` adds cocktail ingredients (ice uses max, not sum). New `GROCERIES` group `cocktail` (mint, sugar, oranges, cucumber, ginger ale, orange/cranberry/pineapple juice, coconut milk, honey, salt, milk).
- `src/lib/drydays.js` — tiers `national` (26 Jan/15 Aug/2 Oct, certain) · `often` (big festivals, "check your state") · `state` (e.g. Maharashtra Day) · `custom` (user-added, e.g. election bans). `CITY_STATE` maps the 30 cities. Helpers `dryDayOn`, `upcomingDryDays`, `lastShoppingDay`, `confirmUrl` (Google search link to verify).
- `src/lib/split.js` — `splitBill()` equal / "fair" (liquor only among drinkers), `upiLink()`, `validVpa()`.
- `src/lib/reminders.js` — `buildReminders(party, city, customDry)` (stock the bar / chill / Blinkit / starters / dinner), `scheduleReminders`, `cancelReminders` (ids 8100–8111).
- `src/lib/http.js` — **bug fix**: natively, cookies (`ltv`/`lty` Zomato location) are written via `CapacitorCookies.setCookie` instead of a hand-written `Cookie` header (Capacitor's global cookie handler would otherwise add a second, clashing Cookie header). This also makes an in-app Zomato login carry over to native requests.
- Packages installed: `@capacitor/inappbrowser@4`, `@capacitor/filesystem@8`, `qrcode@1.5`.
- Tests: `tests/cocktails.test.mjs` (cocktails, mixer replacement, dry days).

### Still to build (specs)

New party fields needed first (in `DEFAULT_PARTY` + Food tab party card): `date` (ISO, default next Saturday), `time` ("20:00"), `name` ("House party"), and in Plan: `host`, `upi`. `customDry: [{date, name}]` in App cfg.

1. **Cocktails UI** — add a 5th tab **Bar** (between Cabinet and Food; icon = cocktail glass). Grid of `makeable(liquorCats)` cards (makeable first; others dimmed with "needs Vodka"). Tap → recipe sheet: glass, spirit, ingredients (from `uses`), steps, servings stepper → "Add to party menu". Menu stored as `cocktailMenu: [{id, servings}]` in cfg and passed to `planParty(..., menu)`; supplies then show up automatically in the Food tab's Blinkit list (group "Cocktail extras"). Cabinet hero: chip "🍸 N cocktails you can make".
2. **Dry days UI** — date/time inputs in the Food tab party card. If `dryDayOn(date, city, customDry)`: banner (national = red "shops closed, buy by {lastShoppingDay}"; often/state = amber "often a dry day in {state} — check" + confirm link). Same banner in Cabinet hero. Plan tab card "Dry days ahead" (`upcomingDryDays`) + "Add a dry day" (date + label).
3. **Price-drop badges** — in `sources.scrapeCategory`, before saving, diff new items vs cached by `id`: set `prevPrice`/`priceChangedAt` (carry forward ≤14 days); keep `hist:${city}:${cat}` → `{id: [[t, price]…last 8]}`. Card pill "↓ ₹200" (green) / "↑ ₹150" (red); chip filter "↓ Price drops"; ProductSheet line "₹2,450 (10 Sep) → ₹2,250 (24 Sep)". Add a unit test for the diff.
4. **Liquor store finder** — `openUrl("https://www.google.com/maps/search/?api=1&query=liquor+store+near+me")` via ExternalApp with pkg `com.google.android.apps.maps`. Buttons in Cart (liquor view) and Cabinet hero.
5. **Split the bill** — Plan card: include toggles (liquor/food/supplies), people (default guests), drinkers (default plan.drinkers), mode seg Equal | Fair, host name + UPI ID (`validVpa`). Show per-drinker / per-non-drinker. "Share on WhatsApp" text with amounts + `upiLink`; "Share payment card" = canvas image with a QR (`qrcode` → data URL) of the UPI link.
6. **Invite card** — canvas 1080×1350 in the app's style (dark bg, amber/wine glows, logo from `./logo-mark.svg`, Playfair title in gold): party name, date/time, venue (`loc.label`), "On the bar" (cocktail menu or top bottles), "Food" (dish names), host. `await document.fonts.load(...)` before drawing. Share via `Filesystem.writeFile({directory: Cache})` → `Share.share({ files: [uri] })` (FileProvider cache-path already configured); browser fallback = download.
7. **Reminders UI** — Plan card listing `buildReminders(...)` with times + toggles → "Set reminders" (`scheduleReminders`). Persist enabled keys. Re-schedule when party date/time changes (ask first).
8. **Exact Zomato prices (beta)** — Plan card "Zomato account": `InAppBrowser.openInWebView({ url: "https://www.zomato.com/", options: { ...DefaultWebViewOptions, showURL: false, closeButtonText: "Done", clearCache: false, clearSessionCache: false, android: { ...DefaultAndroidWebViewOptions, isIsolated: false } } })` — **`isIsolated: false` is essential** (default true runs in a separate process with a separate cookie store). After `browserClosed`, force-refetch a menu; if `pricesHidden === false` show "✓ exact prices on". In `parse/zomato.js parseMenuPage`, read `price ?? display_price ?? min_price ?? default_price` per item when present; MenuSheet shows exact ₹ and cart `unitPrice` uses it. Logout = `CapacitorCookies.clearCookies({ url: "https://www.zomato.com" })`. Unverified (no Zomato account in the sandbox) — label beta.
9. **Live Blinkit prices (beta)** — native `WebRenderPlugin.extract({ url, script, timeoutMs, pollMs })`: offscreen WebView (INVISIBLE, attached to the activity root), JS + DOM storage on, `onGeolocationPermissionsShowPrompt` → grant, poll `evaluateJavascript(script)` until it returns non-empty JSON or timeout, then destroy. Script: click a "Detect my location" button once if present; collect product cards near "ADD" buttons (name = longest non-price line, price = min ₹ value, pack regex, img). JS wrapper `blinkitLive(query)`; GrocerySheet gets a "Check live price on Blinkit" button (phone only). Fallback: keep MRP. Blinkit blocks datacenter IPs (Cloudflare) so this can only be tested on a phone.
10. **Floating order bubble** — native `OrderBubblePlugin`: `canDraw()`, `requestPermission()` (ACTION_MANAGE_OVERLAY_PERMISSION), `show({title, lines})`, `hide()`. WindowManager overlay (TYPE_APPLICATION_OVERLAY), draggable gold bubble with count → tap expands a checklist card (tap line toggles ☐/☑), "Back to Liquor Cabinet" + close. Manifest: `SYSTEM_ALERT_WINDOW`. Plan toggle "Floating checklist over other apps"; Cart "Send order" shows it in addition to the notification. Register in `MainActivity`.

Then: bump to **v1.3 / versionCode 4**, update README + PlanTab version line, `npm test`, browser walkthrough, `npm run apk`, copy APK to `release/`.

### Explicitly skipped (user agreed)
Auto-adding to other apps' carts via accessibility tricks (ToS risk); Play Store publishing; GitHub releases.

## Starter prompt for the new local session

> Read CLAUDE.md, docs/HANDOFF.md and docs/RESEARCH.md. We're continuing Liquor Cabinet v1.3 from the "Still to build" list in HANDOFF.md — build items 1–10 in order, keep tests green, then bump to v1.3 (versionCode 4) and build the release APK with `npm run apk`. Don't push to GitHub. The signing key is in android/keystore (git-ignored).
