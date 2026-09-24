<p align="center">
  <img src="resources/icon-512.png" width="120" alt="Liquor Cabinet logo">
</p>

<h1 align="center">Liquor Cabinet</h1>

<p align="center">
  An Android party planner. Stock the bar with live <b>Livcheers</b> prices, work out the food with the calculator,<br>
  then order the food on <b>Zomato</b> and the supplies on <b>Blinkit</b>.
</p>

<p align="center">
  <a href="release/LiquorCabinet-1.1.apk"><b>⬇ Download the APK (v1.1)</b></a>
</p>

---

## Install

1. On your Android phone, download [`release/LiquorCabinet-1.1.apk`](release/LiquorCabinet-1.1.apk).
2. Open it. When Android asks, allow installs from that source.
3. Launch **Liquor Cabinet** and tap **⚡ Smart Sync** to pull today's prices for your city.

It needs Android 7.0 or newer and an internet connection. If you have v1.0, v1.1 installs over it and keeps your carts.

## What it does

| Tab | |
| --- | --- |
| 🥃 **Cabinet** | Every Livcheers category (single malts, blended scotch, Indian whisky, world whisky, gin, rum, vodka, tequila, brandy, beer, red/white/rosé/sparkling wine, champagne, liqueurs, sake, ready-to-drink) with prices for 30 Indian cities. Filter by Editor's Choice / Best Pick / Good Value or India vs imported, search, and sort by price, rating or value for money. Tap a bottle to flip it for tasting notes. |
| 🍽️ **Food** | The calculator. Set guests, hours, how many are drinking, vegetarian share, appetite, peg size (30/60 ml) and whether there's dinner. It tells you whether your bottles cover the night, then works out mixers, ice, water, lemons, munchies, cups/plates/napkins, starter plates, main servings, breads and desserts. Dishes that pair with what's in your cabinet are marked 🍸. |
| 🛒 **Cart** | Your liquor list plus the food & supplies cart. Zomato items are grouped by restaurant, each with an **Order on Zomato** button. Blinkit supplies form a tick-off checklist with **Find on Blinkit** per item. Any list can be shared on WhatsApp. |
| 📊 **Plan** | Budget ring, where the money goes, shopping batches and how fresh the price data is. |

## Where the data comes from

The app collects its own data on the phone. There are no API keys and no AI services involved.

- **Liquor: Livcheers.** The app reads each `livcheers.com/<city>/category/<type>` page directly and pulls out every product: price, ratings (taste, value, rebuy), tasting notes, origin, bottle photo and product link. Prices are stored on the phone for 7 days; **Force Refresh** downloads them again.
- **Food: Zomato.** For each dish, the app loads Zomato's city page for it and lists the restaurants that deliver it, with rating, "₹X for one", delivery time and distance. It refreshes every 12 hours.
- **Supplies: Blinkit.** Blinkit blocks automated price lookups, so the planner comes with a list of common mixers, snacks, ice and disposables at their usual MRP. Blinkit shows the exact price when you open the item.

## Ordering

Zomato and Blinkit don't let other apps add items to your cart, so Liquor Cabinet opens exactly the right page in their apps:

- **Zomato:** opens the chosen restaurant's menu in the Zomato app (`zomato://order/<id>`), or zomato.com if the app isn't installed. Your dish list is copied first so you can paste it into instructions.
- **Blinkit:** opens each supply as a Blinkit search in the app or website. Tick it off and tap **Next item on Blinkit** to move down the list.

Liquor itself isn't sold on either service. Share the liquor list and buy from your local store.

## Project layout

```
src/
  App.jsx                 app shell: header, tabs, carts, persistence
  components/             Cabinet, Food, Cart, Plan tabs + sheets
  lib/parse/livcheers.js  Livcheers page parser (categories, cities, tiers)
  lib/parse/zomato.js     Zomato dish-page parser
  lib/food.js             party calculator, dishes, Blinkit supply list
  lib/sources.js          scrapers with on-device caching
  lib/order.js            Zomato / Blinkit hand-off, share, clipboard
android/                  Capacitor Android project (ExternalAppPlugin opens Zomato/Blinkit)
resources/logo-mark.svg   the logo; `npm run icons` renders every icon + splash from it
tests/                    calculator tests + live parser tests
release/                  the built APK
```

## Build from source

You need Node 20+, JDK 21 and the Android SDK (platform 36) with `ANDROID_HOME` set.

```bash
npm install
npm test          # calculator tests + live Livcheers/Zomato parser tests
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
