import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { CATEGORIES, CITIES, cityName } from "./lib/parse/livcheers.js";
import { loadCachedCatalog, STALE_MS } from "./lib/sources.js";
import { store } from "./lib/store.js";
import { DEFAULT_PARTY, planParty } from "./lib/food.js";
import { nextSaturday, todayISO } from "./lib/drydays.js";
import { locate } from "./lib/location.js";
import { handleBack } from "./lib/back.js";
import { isNative } from "./lib/http.js";
import { onChecklistTap, tap } from "./lib/order.js";
import { onBubbleToggle } from "./lib/bubble.js";
import ScraperPanel from "./components/ScraperPanel.jsx";
import CabinetTab from "./components/CabinetTab.jsx";
import BarTab from "./components/BarTab.jsx";
import FoodTab from "./components/FoodTab.jsx";
import CartTab from "./components/CartTab.jsx";
import PlanTab from "./components/PlanTab.jsx";
import RemindersWatcher from "./components/RemindersWatcher.jsx";
import Sheet from "./components/Sheet.jsx";
import { Icon } from "./components/Art.jsx";

const TABS = [
  { id: "cabinet", icon: Icon.cabinet, label: "Cabinet" },
  { id: "bar", icon: Icon.cocktail, label: "Bar" },
  { id: "food", icon: Icon.food, label: "Food" },
  { id: "cart", icon: Icon.bag, label: "Cart" },
  { id: "plan", icon: Icon.chart, label: "Plan" },
];

// Only what the cart needs to survive a re-scrape or a city switch.
const slim = (it) => ({ id: it.id, name: it.name, brand: it.brand, sub: it.sub, vol: it.vol, ml: it.ml, price: it.price, img: it.img, url: it.url, flag: it.flag });
// A party date that has already passed rolls on to the coming Saturday.
const withDate = (p) => ({ ...p, date: p.date && p.date >= todayISO() ? p.date : nextSaturday() });
const DEFAULT_SPLIT = { include: { liquor: true, food: true, supplies: true }, people: null, drinkers: null, mode: "fair" };
// v1.0/1.1 food lines used `servings`; everything is `qty` now.
const migrateFood = (lines) => (lines || []).map((l) => (l.qty == null && l.servings != null ? { ...l, qty: l.servings, restaurant: l.restaurant && { ...l.restaurant, costForOne: l.restaurant.costForOne ?? l.unitPrice } } : l));

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const [tab, setTab] = useState("cabinet");
  const [city, setCity] = useState("gurgaon");
  const [loc, setLoc] = useState(null);           // GPS + Zomato delivery zone (lib/location.js)
  const [locating, setLocating] = useState(false);
  const [budget, setBudget] = useState(80000);
  const [catalog, setCatalog] = useState({});
  const [ages, setAges] = useState({});
  const [activeCat, setActiveCat] = useState("malts");
  const [liquor, setLiquor] = useState({});       // "cat:id" → { cat, qty, item }
  const [batches, setBatches] = useState([{ name: "Batch 1", items: {} }]);
  const [activeBatch, setActiveBatch] = useState(0);
  const [food, setFood] = useState([]);           // Zomato + Bistro + Blinkit lines
  const [party, setParty] = useState(() => withDate(DEFAULT_PARTY));
  const [cocktailMenu, setCocktailMenu] = useState([]); // [{ id, servings }] — lib/cocktails.js
  const [customDry, setCustomDry] = useState([]);       // [{ date, name }] — dry days the user adds
  const [reminders, setReminders] = useState({ enabled: {}, scheduledFor: null }); // scheduledFor = "date time" last scheduled
  const [split, setSplit] = useState(DEFAULT_SPLIT);    // bill split settings (people/drinkers null = from the plan)
  const [bubble, setBubble] = useState(false);          // floating order checklist over other apps
  const [zomatoExact, setZomatoExact] = useState(false); // signed in to Zomato in-app → exact menu prices
  const [syncIds, setSyncIds] = useState(CATEGORIES.filter((c) => c.sync).map((c) => c.id));
  const [showScraper, setShowScraper] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [cartView, setCartView] = useState("liquor");
  const [toastMsg, setToastMsg] = useState(null);

  // ── Restore on launch ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const cfg = (await store.get("cfg")) || {};
      const c = cfg.city && CITIES.some((x) => x.slug === cfg.city) ? cfg.city : "gurgaon";
      setCity(c);
      if (cfg.budget) setBudget(cfg.budget);
      if (cfg.liquor) setLiquor(cfg.liquor);
      if (cfg.batches?.length) setBatches(cfg.batches);
      if (cfg.activeBatch != null) setActiveBatch(cfg.activeBatch);
      if (cfg.food) setFood(migrateFood(cfg.food));
      if (cfg.party) setParty(withDate({ ...DEFAULT_PARTY, ...cfg.party }));
      if (cfg.cocktailMenu) setCocktailMenu(cfg.cocktailMenu);
      if (cfg.customDry) setCustomDry(cfg.customDry);
      if (cfg.reminders) setReminders(cfg.reminders);
      if (cfg.split) setSplit({ ...DEFAULT_SPLIT, ...cfg.split, include: { ...DEFAULT_SPLIT.include, ...cfg.split.include } });
      if (cfg.bubble != null) setBubble(cfg.bubble);
      if (cfg.zomatoExact != null) setZomatoExact(cfg.zomatoExact);
      if (cfg.syncIds) setSyncIds(cfg.syncIds);
      if (cfg.activeCat) setActiveCat(cfg.activeCat);
      if (cfg.loc) setLoc(cfg.loc);
      const { catalog, ages } = await loadCachedCatalog(c, CATEGORIES);
      setCatalog(catalog); setAges(ages);
      // First launch (or upgrading from a version without onboarding) → welcome screen.
      setOnboarded(!!cfg.onboarded || (!!Object.keys(catalog).length && !!cfg.loc));
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) store.set("cfg", {
      city, loc, budget, liquor, batches, activeBatch, food, party, syncIds, activeCat, onboarded,
      cocktailMenu, customDry, reminders, split, bubble, zomatoExact,
    });
  }, [ready, city, loc, budget, liquor, batches, activeBatch, food, party, syncIds, activeCat, onboarded,
    cocktailMenu, customDry, reminders, split, bubble, zomatoExact]);

  // ── Android back button + notification taps ──────────────────────────────
  useEffect(() => {
    if (!isNative()) return;
    const sub = CapApp.addListener("backButton", () => {
      if (handleBack()) return;
      if (tab !== "cabinet") setTab("cabinet");
      else CapApp.exitApp();
    });
    return () => { sub.then((s) => s.remove()); };
  }, [tab]);
  // Ticking a Blinkit line in the floating bubble ticks it in the cart too (App stays mounted
  // while you're in Blinkit; the Cart tab may not be).
  useEffect(() => onBubbleToggle((key, done) => {
    if (key.startsWith("b:")) setFood((p) => p.map((l) => (l.key === key ? { ...l, ordered: done } : l)));
  }), []);
  // liquorcabinet://tab/<tab>[?view=liquor|food] opens a tab and liquorcabinet://sync runs a
  // Smart Sync — for links from outside the app (and CI, which uses them to load prices and
  // screenshot every tab in the iOS Simulator).
  useEffect(() => {
    if (!isNative()) return;
    const open = (url) => {
      if (/^liquorcabinet:\/\/sync/.test(url || "")) { setOnboarded(true); setAutoSync(true); setShowScraper(true); return; }
      const m = /^liquorcabinet:\/\/tab\/(cabinet|bar|food|cart|plan)(?:\?view=(liquor|food))?/.exec(url || "");
      if (!m) return;
      if (m[2]) setCartView(m[2]);
      setOnboarded(true); // a link to a tab should show that tab, not the first-run welcome
      setTab(m[1]);
      window.scrollTo({ top: 0 });
    };
    CapApp.getLaunchUrl().then((r) => open(r?.url)).catch(() => {});
    const sub = CapApp.addListener("appUrlOpen", (e) => open(e.url));
    return () => { sub.then((s) => s.remove()); };
  }, []);
  // Order checklists open Cart → Food; reminders name their tab ({ tab, view }).
  useEffect(() => onChecklistTap((x) => {
    if (x?.tab === "food") setTab("food");
    else { setCartView(x?.view || "food"); setTab("cart"); }
    window.scrollTo({ top: 0 });
  }), []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(window.__lcToast);
    window.__lcToast = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const switchCity = async (slug) => {
    setCity(slug);
    const { catalog, ages } = await loadCachedCatalog(slug, CATEGORIES);
    setCatalog(catalog); setAges(ages);
    return Object.keys(catalog).length;
  };

  // Manual choice. A city far from your GPS fix means you're planning elsewhere → drop GPS.
  const pickCity = async (slug) => {
    setShowCity(false);
    if (loc && loc.citySlug !== slug) setLoc(null);
    if (slug === city) return;
    const n = await switchCity(slug);
    toast(n ? `Loaded saved ${cityName(slug)} prices` : `No ${cityName(slug)} prices yet — tap ⚡ to sync`);
  };

  const detectLocation = async () => {
    setLocating(true);
    try {
      const l = await locate();
      setLoc(l);
      if (l.citySlug !== city) await switchCity(l.citySlug);
      toast(`📍 ${l.label || cityName(l.citySlug)}${l.cityKm > 80 ? ` · prices from ${cityName(l.citySlug)}` : ""}`);
      return l;
    } catch (e) {
      toast(/denied|permission/i.test(e.message) ? "Location is off — pick your city instead" : `Couldn't get your location (${e.message})`);
      return null;
    } finally {
      setLocating(false);
    }
  };

  // ── Liquor cart ────────────────────────────────────────────────────────────
  const lkey = (cat, item) => `${cat}:${item.id}`;
  const qtyOf = (cat, item) => liquor[lkey(cat, item)]?.qty || 0;
  const addItem = (cat, item) => {
    const k = lkey(cat, item);
    tap();
    setLiquor((p) => ({ ...p, [k]: { cat, item: slim(item), qty: (p[k]?.qty || 0) + 1 } }));
    setBatches((bs) => bs.map((b, i) => (i === activeBatch ? { ...b, items: { ...b.items, [k]: (b.items[k] || 0) + 1 } } : b)));
  };
  const remItem = (cat, item) => {
    const k = lkey(cat, item);
    setLiquor((p) => {
      if (!p[k]) return p;
      const n = { ...p };
      if (n[k].qty <= 1) delete n[k]; else n[k] = { ...n[k], qty: n[k].qty - 1 };
      return n;
    });
    setBatches((bs) => {
      let idx = bs[activeBatch]?.items[k] ? activeBatch : -1;
      for (let i = bs.length - 1; idx < 0 && i >= 0; i--) if (bs[i].items[k]) idx = i;
      if (idx < 0) return bs;
      return bs.map((b, i) => {
        if (i !== idx) return b;
        const items = { ...b.items };
        if (items[k] <= 1) delete items[k]; else items[k]--;
        return { ...b, items };
      });
    });
  };
  const clearLiquor = () => { setLiquor({}); setBatches((bs) => bs.map((b) => ({ ...b, items: {} }))); };

  const handleScraperData = useCallback((results) => {
    const cm = {}, am = {};
    Object.entries(results).forEach(([id, r]) => { if (r.items?.length) { cm[id] = r.items; am[id] = r.fetchedAt; } });
    setCatalog((p) => ({ ...p, ...cm }));
    setAges((p) => ({ ...p, ...am }));
  }, []);

  const liquorLines = useMemo(() => {
    const index = {};
    for (const [cat, items] of Object.entries(catalog)) for (const it of items) index[`${cat}:${it.id}`] = it;
    return Object.entries(liquor).map(([key, v]) => {
      const live = index[key];
      return { key, cat: v.cat, qty: v.qty, item: live ? { ...v.item, price: live.price, img: live.img || v.item.img } : v.item, stale: !live };
    });
  }, [liquor, catalog]);
  const liquorTotal = liquorLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const catSpend = useMemo(() => {
    const m = {};
    liquorLines.forEach((l) => { m[l.cat] = (m[l.cat] || 0) + l.item.price * l.qty; });
    return m;
  }, [liquorLines]);

  // ── Food cart ──────────────────────────────────────────────────────────────
  const upsertFood = useCallback((line) => setFood((p) => {
    const i = p.findIndex((l) => l.key === line.key);
    if (i < 0) return [...p, line];
    const n = [...p];
    n[i] = { ...p[i], ...line };
    return n;
  }), []);
  const updateFood = (key, patch) => setFood((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeFood = (key) => setFood((p) => p.filter((l) => l.key !== key));
  const zomatoTotal = food.filter((l) => l.kind === "zomato").reduce((s, l) => s + (l.unitPrice || 0) * (l.qty || 0), 0);
  const blinkitTotal = food.filter((l) => l.kind === "blinkit").reduce((s, l) => s + l.product.price * l.qty, 0);

  const plan = useMemo(() => planParty(party, liquorLines.map((l) => ({ cat: l.cat, ml: l.item.ml, qty: l.qty })), cocktailMenu), [party, liquorLines, cocktailMenu]);
  const liquorCats = [...new Set(liquorLines.map((l) => l.cat))];
  const spent = liquorTotal + zomatoTotal + blinkitTotal;
  const left = budget - spent;
  const staleCount = Object.values(ages).filter((t) => Date.now() - t > STALE_MS).length;
  const bottles = liquorLines.reduce((s, l) => s + l.qty, 0);
  const foodCount = food.length; // distinct dishes / products

  const addBatch = () => { setBatches((bs) => [...bs, { name: `Batch ${bs.length + 1}`, items: {} }]); setActiveBatch(batches.length); };
  const clearCache = async () => {
    for (const prefix of ["price:", "hist:", "zomato:", "menu:", "dishphoto:"]) for (const k of await store.list(prefix)) await store.del(k);
    setCatalog({}); setAges({});
    toast("Cached data cleared");
  };
  const goTab = (t) => { setTab(t); window.scrollTo({ top: 0 }); };

  if (!ready) {
    return (
      <div className="welcome" style={{ background: "var(--bg)" }}>
        <img src="./logo-mark.svg" alt="" style={{ width: 110, height: 110 }} />
      </div>
    );
  }

  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="vignette" aria-hidden="true" />
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <button className="brand" onClick={() => setShowCity(true)}>
              <img src="./logo-mark.svg" alt="" />
              <div style={{ minWidth: 0 }}>
                <div className="brand-name">Liquor <em>Cabinet</em></div>
                <div className="loc-chip"><Icon.pin size={12} /><span>{loc?.label || cityName(city)}</span><span className="dim">▾</span></div>
              </div>
            </button>
            <button className="icon-btn" onClick={detectLocation} disabled={locating} aria-label="Use my location">
              {locating ? <span className="spin">◌</span> : <Icon.locate size={20} />}
            </button>
            <button className="icon-btn gold" onClick={() => setShowScraper(true)} aria-label="Sync Livcheers prices">
              <Icon.bolt size={20} />{staleCount > 0 && <span className="dot" />}
            </button>
          </div>
        </header>

        <main className="main">
          {tab === "cabinet" && (
            <CabinetTab city={city} loc={loc} catalog={catalog} ages={ages} activeCat={activeCat} setActiveCat={setActiveCat}
              qtyOf={qtyOf} addItem={addItem} remItem={remItem} budgetLeft={left} openScraper={() => setShowScraper(true)}
              plan={plan} spent={spent} budget={budget} bottles={bottles} onPairing={() => goTab("food")}
              party={party} liquorCats={liquorCats} cocktailMenu={cocktailMenu} customDry={customDry} onBar={() => goTab("bar")} toast={toast} />
          )}
          {tab === "bar" && (
            <BarTab city={city} liquorCats={liquorCats} cocktailMenu={cocktailMenu} setCocktailMenu={setCocktailMenu} plan={plan} party={party}
              toast={toast} goCabinet={() => goTab("cabinet")} goFood={() => goTab("food")} />
          )}
          {tab === "food" && (
            <FoodTab city={city} loc={loc} locating={locating} onLocate={detectLocation} party={party} setParty={setParty} plan={plan}
              liquorCats={liquorCats} foodCart={food} upsertFood={upsertFood} removeFood={removeFood} toast={toast}
              goToCart={() => { setCartView("food"); goTab("cart"); }}
              customDry={customDry} cocktailMenu={cocktailMenu} zomatoExact={zomatoExact} />
          )}
          {tab === "cart" && (
            <CartTab city={city} view={cartView} setView={setCartView}
              liquorLines={liquorLines} liquorTotal={liquorTotal} addItem={addItem} remItem={remItem} clearLiquor={clearLiquor}
              batches={batches} activeBatch={activeBatch}
              foodCart={food} updateFood={updateFood} removeFood={removeFood} clearFood={() => setFood([])} toast={toast}
              bubble={bubble} />
          )}
          {tab === "plan" && (
            <PlanTab city={city} loc={loc} locating={locating} onLocate={detectLocation} budget={budget} saveBudget={setBudget}
              spent={spent} catSpend={catSpend} zomatoTotal={zomatoTotal} blinkitTotal={blinkitTotal} plan={plan}
              batches={batches} activeBatch={activeBatch} setActiveBatch={setActiveBatch} addBatch={addBatch}
              ages={ages} openScraper={() => setShowScraper(true)} clearCache={clearCache} openCity={() => setShowCity(true)}
              party={party} setParty={setParty} customDry={customDry} setCustomDry={setCustomDry} cocktailMenu={cocktailMenu}
              liquorLines={liquorLines} liquorTotal={liquorTotal} foodCart={food}
              reminders={reminders} setReminders={setReminders} split={split} setSplit={setSplit}
              bubble={bubble} setBubble={setBubble} zomatoExact={zomatoExact} setZomatoExact={setZomatoExact} toast={toast} />
          )}
        </main>

        <nav className="nav">
          {TABS.map((t) => {
            const badge = t.id === "cart" ? bottles + foodCount : 0;
            const I = t.icon;
            return (
              <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { tap(); goTab(t.id); }}>
                <I size={22} />
                {t.label}
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {!onboarded && (
        <Welcome locating={locating}
          onLocate={async () => { await detectLocation(); setOnboarded(true); setShowScraper(true); }}
          onManual={() => { setOnboarded(true); setShowCity(true); }} />
      )}
      {showCity && (
        <CityPicker city={city} loc={loc} locating={locating} onPick={pickCity} onClose={() => setShowCity(false)}
          onLocate={async () => { setShowCity(false); await detectLocation(); }} />
      )}
      {showScraper && <ScraperPanel city={city} syncIds={syncIds} setSyncIds={setSyncIds} onData={handleScraperData} autoStart={autoSync}
        onClose={() => { setShowScraper(false); setAutoSync(false); }} />}
      <RemindersWatcher party={party} city={city} customDry={customDry} reminders={reminders} setReminders={setReminders} toast={toast} />
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}

function Welcome({ locating, onLocate, onManual }) {
  return (
    <div className="welcome">
      <img src="./logo-mark.svg" alt="" />
      <div className="kicker" style={{ marginTop: 18 }}>Party planner</div>
      <h1 className="h1" style={{ fontSize: 38, marginTop: 8 }}>Liquor <em>Cabinet</em></h1>
      <p className="muted" style={{ maxWidth: 320, marginTop: 12, lineHeight: 1.6 }}>
        Live bottle prices from Livcheers, a party food calculator, and one-tap ordering on Zomato, Bistro & Blinkit.
      </p>
      <div style={{ width: "100%", maxWidth: 340, marginTop: 30, display: "grid", gap: 10 }}>
        <button className="btn btn-gold btn-block" disabled={locating} onClick={onLocate}>
          {locating ? <span className="spin">◌</span> : <Icon.pin size={18} />} Use my location
        </button>
        <button className="btn btn-ghost btn-block" onClick={onManual}>Choose my city</button>
      </div>
      <div className="tiny dim" style={{ marginTop: 18, maxWidth: 300 }}>Location is used only on your phone, to show restaurants that deliver to you. 21+ · Drink responsibly.</div>
    </div>
  );
}

function CityPicker({ city, loc, locating, onPick, onClose, onLocate }) {
  return (
    <Sheet title="Where's the party?" subtitle="Livcheers publishes prices for these cities" onClose={onClose}>
      <button className="btn btn-gold btn-block" disabled={locating} onClick={onLocate} style={{ marginBottom: 14 }}>
        <Icon.locate size={18} /> {loc ? `Update — ${loc.label || cityName(loc.citySlug)}` : "Use my current location"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 8 }}>
        {CITIES.map((c) => (
          <button key={c.slug} className={`chip ${c.slug === city ? "on" : ""}`} style={{ justifyContent: "center", padding: "11px 12px" }} onClick={() => onPick(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
