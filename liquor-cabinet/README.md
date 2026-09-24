# 🥃 Liquor Cabinet

An Android party planner built from `cellar-planner.jsx`. Pick bottles using live Livcheers prices for your city, work out how much food, mixers and ice the party needs, then order the food on **Zomato** and the supplies on **Blinkit**.

**Install:** download [`release/LiquorCabinet-1.0.apk`](release/LiquorCabinet-1.0.apk) on your phone and open it. Android will ask you to allow installs from that source. Needs Android 7.0 or newer.

## What's in the app

| Tab | What it does |
| --- | --- |
| 🥃 **Cabinet** | All 18 Livcheers categories (single malts, scotch, Indian whisky, gin, rum, vodka, tequila, beer, wines, champagne, liqueurs, sake, RTD…) for 30 cities. Filter by tier or origin, search, sort by price, rating or value. Tap a card to flip it and read the tasting notes. |
| 🍽️ **Food** | The food calculator. Enter guests, hours, drinkers %, vegetarian %, appetite, peg size and whether you're serving dinner. It checks whether your liquor cart covers the drinks you'll need, then works out mixers, ice, water, lemons, munchies, cups/plates/napkins, starter plates, main servings, breads and desserts. |
| 🛒 **Cart** | Liquor list plus the food & supplies cart. Zomato items are grouped by restaurant, with an **Order on Zomato** button for each. Blinkit supplies form a checklist with **Find on Blinkit** per item. Every list can be shared (WhatsApp, etc.). |
| 📊 **Plan** | Budget ring, spend breakdown (liquor, Zomato, Blinkit), shopping batches, price-database freshness and data sources. |

## Where the data comes from

The app does its own scraping on the phone, with no API keys and no AI calls. The original JSX asked Claude to web-search Livcheers; that's gone.

- **Livcheers (liquor).** Each `livcheers.com/<city>/category/<slug>` page carries the city's full product list in its Next.js flight payload. `src/lib/parse/livcheers.js` pulls out the `items` array: price, rating (taste / value / rebuy), tasting notes, country, bottle image and product link. Results are cached on the phone for 7 days ("Smart Sync"); "Force Refresh" downloads them again.
- **Zomato (food).** `zomato.com/<city>/delivery/dish-<dish>` pages list the restaurants delivering a dish, with rating, "₹X for one", delivery time and a `zomato://order/<id>` deeplink (`src/lib/parse/zomato.js`). Cached for 12 hours.
- **Groceries (Blinkit supplies).** Blinkit has no public price feed, so reference prices come from DMart's public product-search API (`src/lib/parse/dmart.js`). Cached for 24 hours. Ice uses a fixed estimate because DMart doesn't sell it.

## How ordering works

Neither Blinkit nor Zomato offers a public "add to cart" API, so the app hands off to them instead:

- **Zomato:** opens the chosen restaurant's menu directly in the Zomato app (`zomato://order/<resId>`), or on zomato.com if the app isn't installed. Your dish list is copied to the clipboard first.
- **Blinkit:** opens each supply as a Blinkit search (`blinkit.com/s/?q=…`) in the Blinkit app or website. Tick items off as you go. **Next item on Blinkit** steps through the list.

The hand-off lives in `android/app/src/main/java/.../ExternalAppPlugin.java`.

Liquor itself isn't sold on either service. The liquor list is for your local store and can be shared.

## Build it yourself

```bash
npm install
npm test               # parser + calculator tests (the parser tests hit the live sites)
npm run dev            # browser preview; a Vite proxy stands in for native HTTP
npm run icons          # regenerate launcher icons + splash from resources/logo-mark.svg
npm run apk            # → android/app/build/outputs/apk/release/LiquorCabinet-1.0-release.apk
```

You need Node 20+, JDK 21 and the Android SDK (platform 36) with `ANDROID_HOME` set. For a signed release build, create `android/keystore.properties` (git-ignored):

```
storeFile=keystore/your-key.jks
storePassword=…
keyAlias=…
keyPassword=…
```

Without that file, release builds are signed with the debug key.

## Notes

- Prices are indicative. Livcheers notes that some states (e.g. Haryana) have no MRP, so shops set their own prices. Zomato's "for one" is an average and the exact menu price shows in Zomato.
- Scrapers depend on each site's page structure. If a site changes, the scraper log says so ("page loaded but no products found") instead of failing silently.
- Please drink responsibly and only where it's legal.
