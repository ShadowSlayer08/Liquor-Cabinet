<p align="center">
  <img src="resources/icon-512.png" width="120" alt="Liquor Cabinet logo">
</p>

<h1 align="center">Liquor Cabinet</h1>

<p align="center">
  An Android party planner. Stock the bar with live <b>Livcheers</b> prices, mix cocktails from what you bought,<br>
  work out the food with the calculator, then order from restaurants near you on <b>Zomato</b>, 10-minute snacks on <b>Bistro</b> and supplies on <b>Blinkit</b>.
</p>

<p align="center">
  <a href="release/LiquorCabinet-1.4.apk"><b>⬇ Android APK (v1.4)</b></a> &nbsp;·&nbsp; <a href="release/LiquorCabinet-1.4-unsigned.ipa"><b>⬇ iPhone IPA (v1.4, beta)</b></a>
</p>

---

## Install

1. On your Android phone, download [`release/LiquorCabinet-1.4.apk`](release/LiquorCabinet-1.4.apk).
2. Open it. When Android asks, allow installs from that source.
3. Launch **Liquor Cabinet**, tap **Use my location**, then **⚡ Smart Sync** to pull today's prices.

It needs **Android 8.0 or newer** and an internet connection. v1.4 installs over v1.0–v1.3 and keeps your carts.
It asks for **location** (restaurants that deliver to you), **notifications** (order checklist and party reminders) and, only if you turn on the floating checklist, **display over other apps**. All are optional.

### iPhone (beta, sideload)

The same app runs on iPhone (iOS 15+). There's no App Store listing, and an iPhone won't install an app file the way Android does — it has to be signed with an Apple ID when you install it:

1. Download [`release/LiquorCabinet-1.4-unsigned.ipa`](release/LiquorCabinet-1.4-unsigned.ipa) (every push also builds one: [iOS workflow](https://github.com/ShadowSlayer08/liquor-cabinet/actions/workflows/ios.yml) → Artifacts).
2. Install it with [Sideloadly](https://sideloadly.io/) (Windows / Mac) or [AltStore](https://altstore.io/), signing in with your own Apple ID.
3. On the iPhone: Settings → General → VPN & Device Management → trust your Apple ID; on iOS 16+ also turn on Settings → Privacy & Security → **Developer Mode**.

With a free Apple ID the app runs for 7 days before it must be re-signed (AltStore can refresh it automatically), and you can have at most 3 sideloaded apps. A paid Apple Developer account (US$99/year) gives 1-year installs for up to 100 iPhones, or TestFlight. _At the time of writing._

Different on iPhone: there's no floating checklist bubble — iOS doesn't let apps draw over other apps — so the order checklist arrives as a notification. Everything else is the same app; the beta features (Zomato sign-in, live Blinkit prices) are as untested on iPhone as on Android.

## What's new in v1.4

- **iPhone** (beta): the same app on iOS 15+, installed by sideloading the IPA (see above). Built and tested in the iOS Simulator on GitHub's macOS runners — not yet on a real iPhone.
- **Paying your share**: the WhatsApp split message no longer contains `upi://pay` links (UPI has blocked person-to-person payments started from links since 2024) — it gives the UPI ID, and the payment card's QR codes still work.
- **Privacy**: the welcome screen now says plainly that your location goes to Zomato to find restaurants that deliver to you (and it's sent rounded to ~10 m).
- **Safer storage**: your party plan and carts are kept in the phone's own storage, not just the web view's.
- **Links**: `liquorcabinet://tab/bar`, `…/tab/cart?view=food`, `liquorcabinet://sync` open the app where you want it.

## What's new in v1.3

- **🍸 Bar tab** — 28 cocktails; the ones you can make with the bottles in your cabinet come first. Put a few on the party menu and their extras (mint, juices, ginger ale…) land on your Blinkit list, replacing the default mixer so nothing is counted twice.
- **🚫 Dry days** — set the party date and time. National dry days (26 Jan, 15 Aug, 2 Oct) show a red "buy by…" warning; festival and state days an amber "check your state" one. Add your own (e.g. an election ban) in the Plan tab.
- **↓ Price drops** — every sync remembers the last prices, so bottles that got cheaper (or dearer) get a badge, a **Price drops** filter and a price history.
- **📍 Find a liquor store** — opens Google Maps with liquor stores near you.
- **💸 Split the bill** — equal, or fair (only drinkers pay for the bar). Share the amounts on WhatsApp with UPI pay links, or as an image with a UPI QR code per share.
- **💌 Invite card** — a party invite image (name, date, venue, what's on the bar and the menu) to share anywhere.
- **⏰ Reminders** — notifications to stock the bar (a day early — or before a dry day), chill the beer, order mixers, starters and dinner. Change the party time and it offers to move them.
- **Exact Zomato prices (beta)** — sign in to Zomato once inside the app and restaurant menus show their real prices instead of a "cost for one" estimate.
- **Live Blinkit prices (beta)** — on the phone, a supply can be checked against Blinkit's own search page (your connection, your delivery location) instead of the usual MRP.
- **Floating checklist (beta)** — your order as a gold bubble on top of Zomato, Bistro and Blinkit; tap to open the list and tick items off as you add them.

## What it does

| Tab | |
| --- | --- |
| 🥃 **Cabinet** | A hero dashboard (bottles, drinks covered, budget left, cocktails you can make, dry-day warning, store finder), illustrated category tiles and an **Editor's picks** carousel. Every Livcheers category (single malts, blended scotch, Indian whisky, world whisky, gin, rum, vodka, tequila, brandy, beer, red/white/rosé/sparkling wine, champagne, liqueurs, sake, ready-to-drink) with prices for 30 Indian cities. Filter by Editor's Choice / Best Pick / Good Value, India vs imported, or **price drops**; search; sort by price, rating or value for money. Tap a bottle for rating bars, tasting notes, price history and food pairings. |
| 🍸 **Bar** | Cocktails you can make with your bottles (the rest show which spirit they need), recipes with per-glass ingredients and steps, and a party menu that feeds the Blinkit list. |
| 🍽️ **Food** | The calculator. Party name, date and time, guests, hours, how many are drinking, vegetarian share, appetite, peg size (30/60 ml) and whether there's dinner. It tells you whether your bottles cover the night, then works out mixers, ice, water, lemons, cocktail extras, munchies, cups/plates/napkins, starter plates, main servings, breads and desserts. Dishes that pair with your cabinet are marked 🍸. Pick a dish to see Zomato restaurants that deliver **to your GPS location**, open a restaurant's **real menu** and add exact dishes. A **Bistro** tab lists 10-minute snacks where Bistro operates. |
| 🛒 **Cart** | Your liquor list (share it, or find a store nearby) plus the food & supplies cart: exact Zomato dishes grouped by restaurant, the Bistro order and the Blinkit checklist, each with a **Send order** button. |
| 📊 **Plan** | Budget ring and spend donut, invite card, bill split, reminders, dry days ahead, location, shopping batches, Zomato account, floating checklist, and how fresh the price data is. |

## Where the data comes from

The app collects its own data on the phone. There are no API keys and no AI services involved.

- **Liquor: Livcheers.** The app reads each `livcheers.com/<city>/category/<type>` page directly and pulls out every product: price, ratings (taste, value, rebuy), tasting notes, origin, bottle photo and product link. Prices are stored on the phone for 7 days; **Force Refresh** downloads them again. Each sync is compared with the last one to spot price changes.
- **Location.** Your phone's GPS picks the nearest Livcheers city, and Zomato's own location service turns it into your delivery zone, so restaurants and distances are for your address.
- **Food: Zomato.** For each dish, the app loads Zomato's page for it and lists the restaurants that deliver it to you, with rating, "₹X for one", delivery time and distance. Restaurant menus come from the restaurant's Zomato page. Zomato hides item prices from logged-out visitors, so dishes are estimated with the restaurant's "cost for one" — unless you sign in to Zomato inside the app (beta).
- **Food: Bistro.** Bistro publishes no menu or prices online, so it has a list of its canteen-style items, marked "price in app".
- **Supplies: Blinkit.** Blinkit blocks automated price lookups, so the planner comes with common mixers, snacks, ice and disposables at their usual MRP. On the phone you can check a live price (beta): the app opens Blinkit's search page in a hidden browser on your own connection and reads the product cards.
- **Dry days.** National dry days are certain; everything else is notified by each state (often quarterly), so festival and state days are shown as "check", with a link to verify.

## Ordering

Zomato, Bistro and Blinkit don't let other apps add items to your cart, so Liquor Cabinet opens exactly the right place in their apps, copies your list, and **pins an order checklist to your notifications** — and, if you turn it on, a **floating checklist bubble** over their apps:

- **Zomato:** opens the chosen restaurant's menu in the Zomato app (`zomato://order/<id>`), or zomato.com.
- **Bistro:** launches the Bistro app (`com.blinkit.bistro`), or bistro.blinkit.com.
- **Blinkit:** opens each supply as a Blinkit search; **Next item on Blinkit** moves down the list.

Liquor itself isn't sold on any of them. Share the liquor list and tap **Find a liquor store near you**.

## Project layout

```
src/
  App.jsx                 app shell: header, 5 tabs, carts, persistence
  components/             Cabinet, Bar, Food, Cart, Plan tabs + sheets; plan/ holds the Plan tab's cards
  lib/parse/livcheers.js  Livcheers page parser (categories, cities, tiers)
  lib/parse/zomato.js     Zomato dish-page + restaurant-menu parser (menu prices when signed in)
  lib/location.js         GPS → nearest city + Zomato delivery zone, Bistro areas
  lib/food.js             party calculator, dishes, Blinkit supply list
  lib/cocktails.js        cocktails, what's makeable, cocktail supplies
  lib/drydays.js          dry-day tiers per state, custom dry days
  lib/pricehist.js        price-change badges and history between syncs
  lib/split.js            bill split + UPI links;  lib/paycard.js, invite.js, canvas.js, shareImage.js draw and share the images
  lib/reminders.js        party reminders (reminderPlan.js / when.js hold the pure parts)
  lib/blinkitLive.js      live Blinkit prices (beta);  lib/bubble.js floating checklist;  lib/zomatoAccount.js Zomato sign-in
  lib/sources.js          scrapers with on-device caching
  lib/order.js            Zomato / Bistro / Blinkit / Maps hand-off, checklist notification, haptics
android/                  Capacitor Android project; native plugins in app/src/main/java/…/liquorcabinet:
                          ExternalAppPlugin (open other apps), WebRenderPlugin (hidden page reader), OrderBubblePlugin (overlay)
ios/                      Capacitor iOS project (Swift Package Manager); ios/App/App has the Swift plugins:
                          ExternalAppPlugin, WebRenderPlugin, CookieBridgePlugin (Zomato sign-in cookies)
.github/workflows/        android.yml (tests + debug APK), ios.yml (unsigned IPA + Simulator screenshots)
resources/logo-mark.svg   the logo; `npm run icons` renders every icon + splash from it
docs/                     HANDOFF.md (status), ROADMAP.md (what's next), RESEARCH.md (data sources), original JSX, screenshots
CLAUDE.md                 guide for Claude Code sessions
tests/                    calculator, cocktails, dry days, split, reminders, invite, price history, Blinkit, Zomato menu + live parser tests
release/                  the built APK
```

## Build from source

You need Node 20+, JDK 21 and the Android SDK (platform 36). Point Gradle at the SDK with `ANDROID_HOME` or `android/local.properties` (`sdk.dir=…`, git-ignored).

```bash
npm install
npm test          # unit tests + live Livcheers/Zomato parser tests
npm run dev       # preview in a desktop browser (a dev proxy stands in for native HTTP)
npm run icons     # regenerate launcher icons and splash screens from the logo
npm run apk       # → android/app/build/outputs/apk/release/LiquorCabinet-<version>-release.apk
```

`npm run apk` works on Windows, macOS and Linux (it runs the Gradle wrapper through `scripts/gradle.mjs`).

**iOS** builds need Xcode on a Mac: `npx vite build && npx cap sync ios`, then open `ios/App/App.xcodeproj`. Without a Mac, push to GitHub — the iOS workflow builds the unsigned IPA on GitHub's macOS runners (free for public repos).

To sign a release, create `android/keystore.properties` (git-ignored). Without it, release builds are signed with the debug key.

```
storeFile=keystore/your-key.jks
storePassword=…
keyAlias=…
keyPassword=…
```

## Notes

- Prices are indicative. In some states (e.g. Haryana) there is no MRP on liquor and shops set their own prices. Zomato's "for one" is an average; exact menu prices show in Zomato (or in the app once you sign in).
- The beta features (Zomato sign-in, live Blinkit prices, floating checklist) depend on those sites and on Android behaviour that could only be fully checked on a real phone. If one doesn't work, the app falls back to the estimates.
- If Livcheers or Zomato changes its pages, the scraper log says so ("page loaded but no products found") instead of failing silently.
- Not affiliated with or endorsed by Livcheers, Zomato, Blinkit or Bistro.
- Drink responsibly, and only where it's legal for you.
