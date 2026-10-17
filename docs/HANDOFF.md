# Handoff — where things stand

_Updated 17 Oct 2026, v1.5.1 (popular picks, small parties) — local Claude Code on the user's Windows PC. The owner planned to pause the project after this release; v1.6 candidates are under "Ideas for next"._

## Shipped

| Version | APK | What |
| --- | --- | --- |
| v1.0 | (history) | JSX prototype → Capacitor Android app; own Livcheers scraper; food calculator; Blinkit/Zomato hand-off |
| v1.1 | (history) | Repo revamped (Keybase proof removed, app at root); DMart price source removed → built-in Blinkit catalog (MRP) |
| v1.2 | (history) | GPS → Zomato delivery zone; real Zomato menus; Bistro; order-checklist notifications; full "wow" redesign |
| v1.3 | (history) | Bar tab + cocktails, dry days, price-drop badges, store finder, bill split + UPI QR card, invite card, reminders, exact Zomato prices (beta), live Blinkit prices (beta), floating order checklist (beta) |
| v1.4 | (history) | iPhone (Capacitor iOS, Swift plugins, CI-built unsigned IPA), no upi:// links (NPCI), honest location copy, cfg in native storage, liquorcabinet:// links |
| v1.4.1 | (history) | Fill my bar (budget optimiser), 75 cocktails + 22 mocktails, suggestions from bottles and guest prefs, 60 dishes, party templates, getting home (drivers + ride apps), settle up, Zepto / Instamart, in-app legal notice |
| v1.5 | (history) | Out tab: bars & pubs, club nights, BYOB places and events with District (lists from Zomato/District pages, booking hand-off), night-out costs and leave-by, invite/reminders/rides/split follow the outing, state drinking ages + BYOB rules + bars-on-dry-days; Fill my bar asks a short quiz and picks popular bottles |
| **v1.5.1** | `release/LiquorCabinet-1.5.1.apk` (versionCode 8) + `release/LiquorCabinet-1.5.1-unsigned.ipa` (iOS build 8) | Cabinet "Crowd favourites" + 🏆/★ badges by Livcheers popularity; Fill my bar folds tiny families into other bottles for small parties (Add them back) |

Repo: **https://github.com/ShadowSlayer08/Liquor-Cabinet** (public, pushed at the user's request). The signing key (`android/keystore/`, `android/keystore.properties`) is git-ignored and never committed; every APK since v1.2 is signed with the same key (cert SHA-256 `a3d9f3e7…98abd9`), so it installs over it.

## v1.5.1 — popular picks, small parties (what was built)

- **Crowd favourites & badges** (`lib/editorsPicks.js`: `withTiers`, `crowdFavourites`; `tierFor` in `parse/livcheers.js`; CabinetTab reads `withTiers(catalog)` so the grid, filter chips and bottle sheet agree). 🏆 needs ≥ 4.7★, premium/luxury and a popularity rank ≤ #200 (or 2× the family's best); ★ needs ≥ 4.4★ and ≤ #350 (or 2.5×); ranks can come from the bottle, a same-brand bottle or a staple. Gurgaon: 🏆 80 → 29, ★ 1,058 → 214; no lone 5★ bottle keeps a badge. The strip: 12 full-size, plain bottles with photos, ≤ 3 per category / 4 per family / 1 per brand, each with a reason ("Most popular whisky", "A household name"); kicker "Popular on Livcheers · <city>" (the rank is all-India, so not "popular in <city>"). Caches from before ranks keep the old rule and strip, with a "See what's popular" sync link.
- **Small parties** (`foldSmall` in `optimise.js`): a family whose drinks are a third of a bottle or less is poured from another bottle of its kind (spirits together, red/white wine together, bubbly on its own), never a "lots" family, a cocktail-menu minimum, a pin or the last family; a "some" family only into spare pours. The sheet says so with **Add it/them back** (`UNFOLD_ALL`, no re-folding that visit). Tight budgets also try the plan from before folding and keep whichever covers more; the quiz's shots tequila folds first and never stands in for the host's picks. Lots of wine: red and white count as "some" for each other (`profileFromQuiz().some`). 6,000 random tight asks: never fewer drinks than v1.5; with folding off, identical to v1.5.
- Checked: 339 offline tests; browser — the strip (JW Red, Bira, Absolut, Old Monk XXX, Bombay Sapphire, Jacob's Creek, Ballantine's, Budweiser, Bacardi White, Blenders Pride, Carlsberg Elephant, Jameson), a 10-drink mixed bar = JW Black + Corona with the fold note, Add them back → 5 bottles; no console errors.

## v1.5 — party out with District (what was built)

Research first (four agents + independent verifiers; condensed in `docs/RESEARCH.md` "District"), then a foundation (`d7531f5`…`561156d`: 6th tab, `cfg.out`, `lib/outModel.js` contract, District URL builders, `openDistrict`, native link setup, legal rows) and four parallel tracks, each adversarially reviewed and fixed:

- **A — data** (`lib/parse/district.js`, `parseVenueList(Page)`/`isVenueList` in `parse/zomato.js`, `lib/outSources.js`, 16 trimmed fixtures in `tests/fixtures/district/`): District venue pages (JSON-LD first, flight extras optional), event lists and event pages (shows, tickets with District's buyable rule, cover vs entry fee incl. "non-redeemable", gate cover from the ticket text, door rules). Review found Zomato serving a **stand-in list with a 200** for cities without bars/BYOB pages (Jaipur's "bars" = 6,292 restaurants, Warangal's "BYOB" = delivery kitchens): `isVenueList` checks the applied filters and the app shows "nothing listed" instead.
- **B — Out tab UI** (`OutTab.jsx`, `components/out/*`, `lib/out.js`): plan card (home | out, outing type, budget a head, big group, bars dry-day banner, state age line), venue and event lists and sheets, BYOB block (Cabinet bottles + corkage), "Your night out" (`#night-out`). Planned tickets survive a sell-out for the picked show; weekly runs vs one-night events; one BYOB rule (`isByobPick` = `reminderPlan.byobNight`).
- **C — rules & legal** (`lib/age.js`, `barsDryOn`/`shopsOpenAt` in `drydays.js`, `DryDayBanner mode="bars"`, legal copy, README): ages 18–25 by state with sources and `checked: "2026-10"`, BYOB rules (Delhi Rule 12(b), Haryana licensed taverns to 31 Mar 2027), usual bar hours, Delhi bars shut only on national days, Haryana 26 Jan / 15 Aug dry until 17:00.
- **D — plan cards follow a party out** (invite, reminders, rides, split, settle): venue + District link on the invite, "Leave by" / "Free cancellation ends" / last call from the venue's listed close, pickup at the venue, venue and ticket parts in the split and settle-up; home carts stay out of a non-BYOB night.

Lead fixes from the browser check: without a zone, Zomato's list is its default area — the tab says "Across Delhi NCR" and drops its distances; a party date changed on any tab redoes the pick's closing time (`outForDate` in App).

**Fill my bar rework** (the owner: "a weak feature… ask some questions, then suggest; the suggested drinks are not good"). The old optimiser maximised Livcheers rating × drinks, and ratings carry no vote counts, so lone 5★ bottles won (Glen Victory, Xclamation Rum, Blue Moon vodka). Research on 3,900 real bottles: `city_liquors.rank` is one all-India popularity list (Bira #1, JW Red #4, Blenders Pride #19, Absolut #23); every 5.0★ bottle is unranked. Now:
- `lib/barScore.js` — the score: popularity from rank (own → same-brand bottle nearest in price → a short staples list matched by name: Old Monk XXX, McDowell's Celebration, Jose Cuervo Especial, core Sula), rating shrunk toward the family mean, a per-city price ladder with tier bands (Easy / Crowd favourites / Treat them / Top shelf), type and origin fit, a popularity gate (#350 or 2.5× the family's best), flavour detection. Catalogs cached before ranks were parsed are marked stale on load (`loadPrices` in App) and scored with a stopgap per category until re-synced.
- `lib/barQuiz.js` + `components/fillbar/BarQuiz.jsx` — five skippable questions, answers in `cfg.barQuiz` (templates pre-fill, never overwrite answered families); `FillBarSheet.jsx` results with reasons (`PickLine.jsx`), swaps, "their usual" brands, budget chips.
- `lib/optimise.js` — the exact knapsack now maximises score × drinks; "Let the budget decide" auto tier (never drops a tier as money rises); two labels for the biggest family; cocktail minimums kept; optional shots tequila.
- Tests on a real Gurgaon catalog (`tests/fixtures/livcheers/`) assert household names at ₹8k / ₹15k / ₹40k, origin filters, no flavoured bottles unless shots/cocktails, and every old budget guarantee; an adversarial review ran 400 random asks on Gurgaon, a rankless catalog and live Mumbai.
- Lead fixes: Indian whisky syncs by default (a pre-v1.5 cfg gets it added once); each "How fancy?" tier shows its own example bottle.

### How v1.5 was checked

- `npm test` (offline + live District/Zomato parser tests), `npx vite build`.
- Browser (375×812, live data, GPS stubbed to Sector 57 Gurugram): bars & pubs and BYOB lists with real distances, a BYOB venue sheet from its District page (amenities, listed hours "closes 4 am", offers "as of", not bookable → "Open in District"), club nights on the party date, an event sheet (male/female/couple entry tickets, door rules, legal age, fee line), "Make this the party" → night-out card (leave by, last call), Plan cards (invite, split = venue estimate only, rides pickup at the venue, reminders). No console errors, no images, no horizontal scroll.
- Browser, Fill my bar: the five-question quiz → whisky-heavy, mixers, crowd favourites, Indian, 40 drinks → Blenders Pride ×2, Smirnoff, Bira White ×4 (₹3,400) after syncing Indian whisky from the sheet's prompt; swaps and "their usual" brands with ₹ differences; distinct "How fancy?" examples per tier (Royal Stag / Blenders Pride / JW Blonde / Indri).
- Android emulator (Android 16): the signed v1.5 APK installed **over v1.4.1** (data kept, `USE_EXACT_ALARM` granted); Out tab bar list and a District venue page over native HTTP (amenities, "closes 2 am", offers with slots left, "Book a table on District"); with District not installed, the hand-off opened the page in Chrome.

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

v1.5 (District):
- With District installed: does `https://www.district.in/dining/<zcity>/<slug>/book` (and `/events/<slug>-buy-tickets`) open the District app on Android (explicit-package intent) and iPhone (universal link)? Does `edition://r/<resId>` open a venue (decides `USE_EDITION` in `lib/order.js`)? Without District: the page opens in the browser.
- CapacitorHttp GETs of www.district.in on mobile data (Akamai never challenged desktop IPs); Zomato bars/BYOB lists localised by the zone cookie on the phone.
- "Leave by", "Free cancellation ends" and venue last-call notifications firing and routing to the Out tab's night-out card; Uber/Ola with the venue as pickup.
- Law data to recheck yearly (`lib/age.js`, `lib/drydays.js`): Delhi beer-21 proposal, Maharashtra/West Bengal ages (secondary sources), Haryana tavern rules after 31 Mar 2027, whether festival dry days shut bars outside Delhi/Haryana.

Earlier versions:

Nothing native has run on a device yet (same as v1.2). Check on the phone:
- Location permission, notifications (checklist + reminders firing at the right time, tap routing), haptics, app hand-offs (Zomato/Bistro/Blinkit/Maps/WhatsApp wa.me), image sharing (invite/payment card via the Share sheet).
- Zomato sign-in inside the in-app browser (OTP flow), whether `isIsolated: false` really shares the session with native requests, which price field signed-in menus use.
- Live Blinkit: whether blinkit.com loads in the hidden WebView on mobile data/Wi-Fi, whether "Detect my location" gets a location, and whether the cards parse.
- Floating bubble: overlay permission flow (Android 11+ opens the full app list), drag/tap, "Back to Liquor Cabinet" from the background.
- UPI QR codes scanning in GPay / PhonePe / Paytm with the amount filled in (split and settle-up).
- v1.4.1 hand-offs: Uber / Ola opening with the pickup filled in, Rapido / DriveU launching, Zepto / Instamart search links opening in their apps (Android packages and iOS schemes are guesses checked against assetlinks / docs, not on a phone with the apps installed).
- The "last call" and "settle up" reminders firing and routing to the Getting home card / settle-up sheet.

## Ideas for next

Candidates for a v1.6, in the order suggested to the owner:
- **Real-phone hardening** (most valuable): run the "Not verified" list above on the owner's phone and fix what breaks; a small self-test screen in the Plan tab (open each hand-off, schedule a test reminder in 1 minute, fetch one page per source) would make it quick. Decides `USE_EDITION` for District links.
- **Party history**: keep past parties (what was bought, what was actually spent from settle-up, what ran out) so the next plan starts from them.
- **Share a plan with a co-host** without a server: the plan as a QR code / file the other phone imports.
- **Rules freshness**: the 2027 dry-day dates and the Haryana BYOB policy (to 31 Mar 2027) need a yearly refresh — warn in the app when `RULES_CHECKED` / the dry-day tables get old.
- District `/gw/` APIs (table slots, cover charges, BYOB-by-tag lists) as an opt-in beta, if the owner wants it (see RESEARCH.md).

- Sync ticks from the floating bubble back into the Blinkit checklist (the plugin can `notifyListeners("toggle")`).
- A yearly refresh of festival dry days (or fetch the state excise lists).
- Lazy-load `qrcode` (≈55 kB) with `import()` if bundle size matters.

## Explicitly skipped (user agreed)

Auto-adding to other apps' carts via accessibility tricks (ToS risk); Play Store publishing.
