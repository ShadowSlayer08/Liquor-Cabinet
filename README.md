<p align="center">
  <img src="resources/icon-512.png" width="120" alt="Liquor Cabinet logo">
</p>

<h1 align="center">Liquor Cabinet</h1>

<p align="center">
  An Android party planner. Stock the bar with live <b>Livcheers</b> prices, work out the food with the calculator,<br>
  then order from restaurants near you on <b>Zomato</b>, 10-minute snacks on <b>Bistro</b> and supplies on <b>Blinkit</b>.
</p>

<p align="center">
  <a href="release/LiquorCabinet-1.2.apk"><b>⬇ Download the APK (v1.2)</b></a>
</p>

---

## Install

1. On your Android phone, download [`release/LiquorCabinet-1.2.apk`](release/LiquorCabinet-1.2.apk).
2. Open it. When Android asks, allow installs from that source.
3. Launch **Liquor Cabinet**, tap **Use my location**, then **⚡ Smart Sync** to pull today's prices.

It needs Android 7.0 or newer and an internet connection. v1.2 installs over v1.0/v1.1 and keeps your carts.
It asks for **location** (restaurants that deliver to you) and **notifications** (your order checklist); both are optional.

## What it does

| Tab | |
| --- | --- |
| 🥃 **Cabinet** | A hero dashboard (bottles, drinks covered, budget left), illustrated category tiles and an **Editor's picks** carousel. Every Livcheers category (single malts, blended scotch, Indian whisky, world whisky, gin, rum, vodka, tequila, brandy, beer, red/white/rosé/sparkling wine, champagne, liqueurs, sake, ready-to-drink) with prices for 30 Indian cities. Filter by Editor's Choice / Best Pick / Good Value or India vs imported, search, and sort by price, rating or value for money. Bottles sit in a lit display case; tap one for its full page with rating bars (taste, value, buy-again), tasting notes and food pairings. |
| 🍽️ **Food** | The calculator. Set guests, hours, how many are drinking, vegetarian share, appetite, peg size (30/60 ml) and whether there's dinner. It tells you whether your bottles cover the night, then works out mixers, ice, water, lemons, munchies, cups/plates/napkins, starter plates, main servings, breads and desserts. Dishes that pair with what's in your cabinet are marked 🍸. Pick a dish to see Zomato restaurants that deliver **to your GPS location** (nearest, top-rated or cheapest), open a restaurant's **real menu** with photos and add exact dishes. A **Bistro** tab lists 10-minute snacks where Bistro operates (Gurugram, Delhi-NCR, Noida, Bengaluru). |
| 🛒 **Cart** | Your liquor list plus the food & supplies cart: exact Zomato dishes grouped by restaurant, the Bistro order and the Blinkit checklist, each with a **Send order** button. Any list can be shared on WhatsApp. |
| 📊 **Plan** | Budget ring, a spend donut chart, location settings, shopping batches and how fresh the price data is. |

## Where the data comes from

The app collects its own data on the phone. There are no API keys and no AI services involved.

- **Liquor: Livcheers.** The app reads each `livcheers.com/<city>/category/<type>` page directly and pulls out every product: price, ratings (taste, value, rebuy), tasting notes, origin, bottle photo and product link. Prices are stored on the phone for 7 days; **Force Refresh** downloads them again.
- **Location.** Your phone's GPS picks the nearest Livcheers city, and Zomato's own location service turns it into your delivery zone. Every Zomato request then carries that zone, so restaurants and distances are for your address, not the city centre.
- **Food: Zomato.** For each dish, the app loads Zomato's page for it and lists the restaurants that deliver it to you, with rating, "₹X for one", delivery time and distance (refreshed every 12 hours). Restaurant menus (dishes, photos, veg tags) come from the restaurant's Zomato page. Zomato hides item prices from logged-out visitors, so dishes are estimated with the restaurant's "cost for one".
- **Food: Bistro.** Bistro publishes no menu or prices online, so it has a list of its canteen-style items, marked "price in app".
- **Supplies: Blinkit.** Blinkit blocks automated price lookups, so the planner comes with a list of common mixers, snacks, ice and disposables at their usual MRP. Blinkit shows the exact price when you open the item.

## Ordering

Zomato, Bistro and Blinkit don't let other apps add items to your cart, so Liquor Cabinet does the next best thing. It opens exactly the right place in their apps, copies your list, and **pins an order checklist to your notifications**, so every item and quantity is one swipe away while you add them:

- **Zomato:** opens the chosen restaurant's menu in the Zomato app (`zomato://order/<id>`), or zomato.com if the app isn't installed.
- **Bistro:** launches the Bistro app (`com.blinkit.bistro`), or bistro.blinkit.com.
- **Blinkit:** opens each supply as a Blinkit search. `blinkit.com` links are verified to open in the Blinkit app. Each item you open is ticked off in the checklist notification; **Next item on Blinkit** moves down the list.

Liquor itself isn't sold on either service. Share the liquor list and buy from your local store.

## Project layout

```
src/
  App.jsx                 app shell: header, tabs, carts, persistence
  components/             Cabinet, Food, Cart, Plan tabs + sheets
  lib/parse/livcheers.js  Livcheers page parser (categories, cities, tiers)
  lib/parse/zomato.js     Zomato dish-page + restaurant-menu parser
  lib/location.js         GPS → nearest city + Zomato delivery zone, Bistro areas
  lib/food.js             party calculator, dishes, Blinkit supply list
  lib/sources.js          scrapers with on-device caching
  lib/order.js            Zomato / Bistro / Blinkit hand-off, checklist notification, haptics
android/                  Capacitor Android project (ExternalAppPlugin opens Zomato / Bistro / Blinkit)
resources/logo-mark.svg   the logo; `npm run icons` renders every icon + splash from it
docs/                     HANDOFF.md (status + v1.3 plan), RESEARCH.md (data sources), original JSX, screenshots
CLAUDE.md                 guide for Claude Code sessions
tests/                    calculator tests + live parser tests
release/                  the built APK
```

## Build from source

You need Node 20+, JDK 21 and the Android SDK (platform 36) with `ANDROID_HOME` set.

```bash
npm install
npm test          # calculator + location tests, live Livcheers/Zomato parser tests
npm run dev       # preview in a desktop browser (a dev proxy stands in for native HTTP)
npm run icons     # regenerate launcher icons and splash screens from the logo
npm run apk       # → android/app/build/outputs/apk/release/LiquorCabinet-<version>-release.apk
```

To sign a release, create `android/keystore.properties` (git-ignored). Without it, release builds are signed with the debug key.

```
storeFile=keystore/your-key.jks
storePassword=…
keyAlias=…
keyPassword=…
```

## Notes

- Prices are indicative. In some states (e.g. Haryana) there is no MRP on liquor and shops set their own prices. Zomato's "for one" is an average, and exact menu prices show in Zomato.
- If Livcheers or Zomato changes its pages, the scraper log says so ("page loaded but no products found") instead of failing silently.
- Drink responsibly, and only where it's legal for you.
