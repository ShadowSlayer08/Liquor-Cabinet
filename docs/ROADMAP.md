# Roadmap — after v1.3

_Written 26 Sep 2026 from four research passes (iOS portability, cross-platform options, feature ideas, legal/policy). Effort: S ≤ 1 day · M 2–5 days · L 1–3 weeks._

## Where we are

- **v1.3 (Android)** shipped: cocktails, dry days, price drops, bill split + UPI QR, invites, reminders, beta Zomato exact prices / live Blinkit prices / floating checklist. Sideloaded APK; nothing native has been tested on a real phone yet.
- **iOS is in progress** on branch `ios` (see Phase 4) — the existing Capacitor app, not a rewrite. GitHub Actions builds an unsigned IPA and runs it in the iOS Simulator.
- **CI** runs the unit tests and a debug APK build on every push (`.github/workflows/android.yml`).

## Phase 0 — Prove it on real phones (M)

The single most valuable next step: every later phase inherits these native paths.

| Check | Android | iPhone |
| --- | --- | --- |
| GPS → Zomato zone, restaurants near you | ☐ | ☐ |
| Checklist + reminder notifications (timing, tap → right tab) | ☐ | ☐ |
| Hand-offs: Zomato restaurant, Bistro, Blinkit search, Google Maps, WhatsApp | ☐ | ☐ |
| Invite / payment card → Share sheet → WhatsApp, Save to Photos | ☐ | ☐ |
| UPI QR scans in GPay / PhonePe / Paytm with the amount filled in | ☐ | ☐ |
| Zomato sign-in (OTP) → menus show exact prices; sign-out clears it | ☐ | ☐ |
| Live Blinkit price on mobile data and Wi-Fi | ☐ | ☐ |
| Floating checklist bubble (drag, tick, "Back to Liquor Cabinet") | ☐ | n/a |
| Upgrade over the previous version keeps carts and the party | ☐ | — |

## Phase 1 — Foundations (≈ 1 week)

| Item | Why | Effort |
| --- | --- | --- |
| **Release automation** — v1.4 is on the GitHub Releases page (APK + IPA, published by hand); next: a tag builds and attaches both in CI (keystore from encrypted secrets) and APKs stop being committed to git | One-command releases; the repo stops growing ~12 MB per release | M |
| **In-app "update available"** (checks the GitHub Releases API on launch, links the new APK) | Sideloaded users never hear about updates otherwise | S |
| **Single-source version** (package.json → Gradle + Xcode + Plan tab; CI refuses a lower versionCode) | The 4-place manual bump is error-prone | S |
| **Android developer verification** — register the package + signing key before Google's 2027 global rollout for sideloaded apps; back the keystore up offline | Otherwise installs need an "advanced flow" or ADB | S |
| **Error screen + opt-in error report** (React error boundary; copy details to share) | A render exception currently blanks the app | S |
| **APK diet** (R8, drop unused plugin assets) — 12 MB → ~5 MB | Faster to share over WhatsApp | S |
| **Dependabot** for npm + Gradle + GitHub Actions | Security fixes arrive as PRs | S |
| **PRIVACY.md** (what goes to Livcheers, Zomato, Blinkit, Google Maps, WhatsApp; nothing to us) | Honest disclosure; the welcome copy is now fixed | S |

## Phase 2 — Product (pick in this order)

| Item | Value | Effort |
| --- | --- | --- |
| **Budget optimiser** — "fill my bar for ₹X": best bottle mix for drinks needed × ratings within budget, from live city prices | The question every host actually has | M |
| **Mocktails + drinks for non-drinkers** (added to the Bar tab and the Blinkit list) | Inclusive and responsible, little effort | S |
| **Getting home safely** — cab hand-offs (Uber/Ola/Rapido), designated drivers in the plan, a "wind down" reminder | The most responsible thing a party app can add | M |
| **Settle up after the party** — actual bills, who paid what, who owes whom (with the QR card) | Closes the loop the split card promises | M |
| **Guest list with WhatsApp RSVP** (no backend: RSVP links carry the answer back in the message) | Plan around who's coming, names flow into the split | M |
| **Zepto / Swiggy Instamart hand-offs** alongside Blinkit | Not everyone uses Blinkit | S |
| **Party templates** (cricket night, Diwali, New Year's Eve, birthday) | A good plan in one tap | S |
| **Several parties + archive** (reuse last year's Diwali) | Stop overwriting the only plan | M |
| **Share a plan with a co-host** (plan in a link / QR, import on their phone) | Co-planning without a server | M |

## Phase 3 — Data & safety

| Item | Why | Effort |
| --- | --- | --- |
| **Prohibition states + legal drinking age** — red banner and no store finder in Bihar, Gujarat, Nagaland, Mizoram, Lakshadweep (and Manipur districts); a one-time "I'm of legal drinking age in my state" instead of a flat "21+" | Don't cheerfully plan purchases where alcohol is illegal | M |
| **Remote data pack** — dry days (incl. election bans), grocery MRPs as a JSON file in the repo the app fetches | Festival dry days in `lib/drydays.js` only cover 2026–2027 | M |
| **Scraper resilience** — keep last-known prices with an honest note when a page changes; a weekly CI canary that tells the owner | Livcheers/Zomato page changes shouldn't mean empty screens | M |

## Phase 4 — iOS (in progress, branch `ios`)

**Decision: keep Capacitor and add iOS — no Flutter rewrite.** A rewrite would not remove a single iOS limitation (no drawing over other apps, no launching apps by package name, Apple's signing rules are framework-independent) and would throw away ~8k working lines and the tests: Flutter ≈ 10–16 weeks vs Capacitor iOS ≈ 2–3 weeks.

| Option | Reuses | Effort | Verdict |
| --- | --- | --- | --- |
| **Capacitor + iOS** (chosen) | ~93 % (all UI, logic, tests) | 2–3 weeks | ✅ |
| Flutter rewrite | ~0 % | 10–16 weeks | Only if a full redesign or heavy native features come anyway |
| React Native / Expo | ~35–45 % (pure lib/) | 6–10 weeks | No gain for a lists-and-cards app |
| Hosted web app / PWA | ~85–90 % | 1–2 weeks | Needs a server proxy; Zomato/Blinkit block datacenter IPs |

**Done so far:** iOS platform (SPM), Swift ports of the app hand-offs and the live-Blinkit reader, a cookie bridge for the Zomato sign-in, iPhone-aware UI (no bubble), durable storage for the plan, iOS icon/splash, CI that builds an unsigned IPA and screenshots every tab in the Simulator.

**Still to do**
1. Real-iPhone test (Phase 0 column).
2. **Distribution** — iPhones can't install an IPA like an APK; it must be signed:
   - *Free Apple ID* (Sideloadly / AltStore): the app runs 7 days, then re-sign; max 3 apps. Fine for your own phone.
   - *Apple Developer Program* (US$99/yr): Ad Hoc builds for up to 100 registered iPhones for a year, or TestFlight. Not planned (owner's decision) — everyone sideloads the unsigned IPA with their own Apple ID.
   - App Store: not planned (scraped third-party data would likely be rejected under guideline 5.2.2).
3. *Optional* **Live Activity** as the iPhone version of the floating checklist (Lock Screen / Dynamic Island, ActivityKit) — M/L, needs a widget extension.

## Decided (26 Sep 2026)

The owner declined all five open questions, so things stay as they are: no LICENSE file, no paid Apple Developer account (iPhone = sideloaded unsigned IPA), no request to Livcheers, the Blinkit/Zomato beta features stay as they are, and commits keep the current email. Instead, the README carries a "Data sources & legal notice" section: free, non-profit, personal use; data fetched on-device only; not affiliated; takedown requests via issues.

## Parked

Google Play listing (possible only without scraped data); a backend or accounts (DPDP Act duties from May 2027 — avoid until needed); home-screen widget; Hindi/regional languages (after Phase 2); sponsored or affiliate bottles (liquor surrogate-advertising rules — stay commercially neutral).
