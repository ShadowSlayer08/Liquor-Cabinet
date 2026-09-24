import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { CATEGORIES, CITIES, cityName } from "./lib/parse/livcheers.js";
import { loadCachedCatalog, STALE_MS } from "./lib/sources.js";
import { store } from "./lib/store.js";
import { DEFAULT_PARTY, planParty } from "./lib/food.js";
import { fmt } from "./lib/format.js";
import { handleBack } from "./lib/back.js";
import { isNative } from "./lib/http.js";
import ScraperPanel from "./components/ScraperPanel.jsx";
import CabinetTab from "./components/CabinetTab.jsx";
import FoodTab from "./components/FoodTab.jsx";
import CartTab from "./components/CartTab.jsx";
import PlanTab from "./components/PlanTab.jsx";
import Sheet from "./components/Sheet.jsx";

const TABS = [
  { id: "cabinet", icon: "🥃", label: "Cabinet" },
  { id: "food", icon: "🍽️", label: "Food" },
  { id: "cart", icon: "🛒", label: "Cart" },
  { id: "plan", icon: "📊", label: "Plan" },
];

// Only what the cart needs to survive a re-scrape or a city switch.
const slim = (it) => ({ id: it.id, name: it.name, brand: it.brand, sub: it.sub, vol: it.vol, ml: it.ml, price: it.price, img: it.img, url: it.url, flag: it.flag });

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("cabinet");
  const [city, setCity] = useState("gurgaon");
  const [budget, setBudget] = useState(80000);
  const [catalog, setCatalog] = useState({});   // catId → items[]
  const [ages, setAges] = useState({});         // catId → fetchedAt
  const [activeCat, setActiveCat] = useState("malts");
  const [liquor, setLiquor] = useState({});     // "cat:id" → { cat, qty, item }
  const [batches, setBatches] = useState([{ name: "Batch 1", items: {} }]);
  const [activeBatch, setActiveBatch] = useState(0);
  const [food, setFood] = useState([]);         // food-cart lines (Zomato + Blinkit)
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [syncIds, setSyncIds] = useState(CATEGORIES.filter((c) => c.sync).map((c) => c.id));
  const [showScraper, setShowScraper] = useState(false);
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
      if (cfg.food) setFood(cfg.food);
      if (cfg.party) setParty({ ...DEFAULT_PARTY, ...cfg.party });
      if (cfg.syncIds) setSyncIds(cfg.syncIds);
      if (cfg.activeCat) setActiveCat(cfg.activeCat);
      const { catalog, ages } = await loadCachedCatalog(c, CATEGORIES);
      setCatalog(catalog); setAges(ages);
      setReady(true);
      if (!Object.keys(catalog).length) setShowScraper(true); // first launch → offer a sync
    })();
  }, []);

  // ── Persist (after restore, so defaults never overwrite saved data) ────────
  useEffect(() => {
    if (ready) store.set("cfg", { city, budget, liquor, batches, activeBatch, food, party, syncIds, activeCat });
  }, [ready, city, budget, liquor, batches, activeBatch, food, party, syncIds, activeCat]);

  // ── Android back button ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative()) return;
    const sub = CapApp.addListener("backButton", () => {
      if (handleBack()) return;
      if (tab !== "cabinet") setTab("cabinet");
      else CapApp.exitApp();
    });
    return () => { sub.then((s) => s.remove()); };
  }, [tab]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(window.__lcToast);
    window.__lcToast = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const changeCity = async (slug) => {
    setShowCity(false);
    if (slug === city) return;
    setCity(slug);
    const { catalog, ages } = await loadCachedCatalog(slug, CATEGORIES);
    setCatalog(catalog); setAges(ages);
    toast(Object.keys(catalog).length ? `Loaded saved ${cityName(slug)} prices` : `No ${cityName(slug)} prices yet — tap ⚡ Scrape`);
  };

  // ── Liquor cart ────────────────────────────────────────────────────────────
  const lkey = (cat, item) => `${cat}:${item.id}`;
  const qtyOf = (cat, item) => liquor[lkey(cat, item)]?.qty || 0;

  const addItem = (cat, item) => {
    const k = lkey(cat, item);
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
    // Take it out of the active batch, or the latest batch that holds it.
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

  // Cart lines use the latest scraped price when the bottle is in the current catalog.
  const liquorLines = useMemo(() => {
    const index = {};
    for (const [cat, items] of Object.entries(catalog)) for (const it of items) index[`${cat}:${it.id}`] = it;
    return Object.entries(liquor).map(([key, v]) => {
      const live = index[key];
      return { key, cat: v.cat, qty: v.qty, item: live ? { ...v.item, price: live.price } : v.item, stale: !live };
    });
  }, [liquor, catalog]);

  const liquorTotal = liquorLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const catSpend = useMemo(() => {
    const m = {};
    liquorLines.forEach((l) => { m[l.cat] = (m[l.cat] || 0) + l.item.price * l.qty; });
    return m;
  }, [liquorLines]);

  // ── Food cart ──────────────────────────────────────────────────────────────
  const addFood = useCallback((line) => setFood((p) => [...p.filter((l) => l.key !== line.key), line]), []);
  const updateFood = (key, patch) => setFood((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeFood = (key) => setFood((p) => p.filter((l) => l.key !== key));
  const zomatoTotal = food.filter((l) => l.kind === "zomato").reduce((s, l) => s + l.unitPrice * l.servings, 0);
  const blinkitTotal = food.filter((l) => l.kind === "blinkit").reduce((s, l) => s + l.product.price * l.qty, 0);

  const plan = useMemo(() => planParty(party, liquorLines.map((l) => ({ cat: l.cat, ml: l.item.ml, qty: l.qty }))), [party, liquorLines]);
  const liquorCats = [...new Set(liquorLines.map((l) => l.cat))];

  const spent = liquorTotal + zomatoTotal + blinkitTotal;
  const left = budget - spent;
  const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
  const barColor = pct > 0.92 ? "#e84040" : pct > 0.7 ? "#e8c030" : "#22c97a";
  const staleCount = Object.values(ages).filter((t) => Date.now() - t > STALE_MS).length;
  const bottles = liquorLines.reduce((s, l) => s + l.qty, 0);

  const addBatch = () => {
    setBatches((bs) => [...bs, { name: `Batch ${bs.length + 1}`, items: {} }]);
    setActiveBatch(batches.length);
  };

  const clearCache = async () => {
    for (const k of await store.list("price:")) await store.del(k);
    for (const k of await store.list("zomato:")) await store.del(k);
    for (const k of await store.list("grocery:")) await store.del(k);
    setCatalog({}); setAges({});
    toast("Cached prices cleared");
  };

  if (!ready) {
    return (
      <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
        <img src="./logo-mark.svg" alt="" style={{ width: 96, height: 96, animation: "pulse 1.4s infinite" }} />
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="brand-row">
            <div className="brand">
              <img src="./logo-mark.svg" alt="" />
              <div style={{ minWidth: 0 }}>
                <div className="brand-kicker">PARTY PLANNER</div>
                <div className="brand-name">Liquor <span>Cabinet</span></div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCity(true)}>📍 {cityName(city)} ▾</button>
            <button className="btn btn-gold btn-sm" onClick={() => setShowScraper(true)} title="Scrape Livcheers">
              ⚡{staleCount > 0 && <span style={{ fontSize: 9 }}>{staleCount}</span>}
            </button>
          </div>
          <div className="budget-row" onClick={() => setTab("plan")}>
            <div className="budget-meta">
              <span><b style={{ color: barColor }}>{fmt(spent)}</b> spent · {bottles} btl{food.length ? ` · ${food.length} food` : ""}</span>
              <span>{left >= 0 ? `${fmt(left)} left of ${fmt(budget)}` : <b className="red">{fmt(-left)} over budget</b>}</span>
            </div>
            <div className="bar"><div style={{ width: `${pct * 100}%`, background: barColor }} /></div>
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="main">
        {tab === "cabinet" && (
          <CabinetTab city={city} catalog={catalog} ages={ages} activeCat={activeCat} setActiveCat={setActiveCat}
            qtyOf={qtyOf} addItem={addItem} remItem={remItem} budgetLeft={left} openScraper={() => setShowScraper(true)} />
        )}
        {tab === "food" && (
          <FoodTab city={city} party={party} setParty={setParty} plan={plan} liquorCats={liquorCats}
            foodCart={food} addFood={addFood} toast={toast} goToCart={() => { setCartView("food"); setTab("cart"); }} />
        )}
        {tab === "cart" && (
          <CartTab city={city} view={cartView} setView={setCartView}
            liquorLines={liquorLines} liquorTotal={liquorTotal} addItem={addItem} remItem={remItem} clearLiquor={clearLiquor}
            batches={batches} activeBatch={activeBatch}
            foodCart={food} updateFood={updateFood} removeFood={removeFood} clearFood={() => setFood([])} toast={toast} />
        )}
        {tab === "plan" && (
          <PlanTab city={city} budget={budget} saveBudget={setBudget} spent={spent} catSpend={catSpend}
            zomatoTotal={zomatoTotal} blinkitTotal={blinkitTotal} plan={plan}
            batches={batches} activeBatch={activeBatch} setActiveBatch={setActiveBatch} addBatch={addBatch}
            ages={ages} openScraper={() => setShowScraper(true)} clearCache={clearCache} />
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="nav">
        <div className="nav-inner">
          {TABS.map((t) => {
            const badge = t.id === "cart" ? bottles + food.length : 0;
            return (
              <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
                <span className="ico">{t.icon}</span>
                {t.label}
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {showCity && <CityPicker city={city} onPick={changeCity} onClose={() => setShowCity(false)} />}
      {showScraper && (
        <ScraperPanel city={city} syncIds={syncIds} setSyncIds={setSyncIds} onData={handleScraperData} onClose={() => setShowScraper(false)} />
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function CityPicker({ city, onPick, onClose }) {
  return (
    <Sheet title="📍 Choose your city" subtitle="Cities Livcheers publishes prices for" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
        {CITIES.map((c) => (
          <button key={c.slug} className="chip" onClick={() => onPick(c.slug)}
            style={{ justifyContent: "center", ...(c.slug === city ? { background: "var(--gold)", color: "#000", borderColor: "var(--gold)", fontWeight: 700 } : {}) }}>
            {c.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
