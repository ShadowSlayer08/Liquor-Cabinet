import { useMemo, useState } from "react";
import { CATEGORIES, CAT, cityName } from "../lib/parse/livcheers.js";
import { STALE_MS } from "../lib/sources.js";
import { fmt, fmtShort, ageStr } from "../lib/format.js";
import ProductCard, { BottleStage, TierPill } from "./ProductCard.jsx";
import ProductSheet from "./ProductSheet.jsx";
import { Bottle, CatBottle, Icon } from "./Art.jsx";
import { isPriceDrop } from "../lib/pricehist.js";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function CabinetTab({
  city, loc, catalog, ages, activeCat, setActiveCat, qtyOf, addItem, remItem, budgetLeft, openScraper,
  plan, spent, budget, bottles, onPairing,
}) {
  const [tierF, setTierF] = useState("All");
  const [origF, setOrigF] = useState("All");
  const [sortF, setSortF] = useState("default");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [limit, setLimit] = useState(40);
  const [open, setOpen] = useState(null); // { item, cat }

  const cm = CAT[activeCat] || CATEGORIES[0];
  const items = catalog[activeCat] || [];

  // "↓ Price drops" — bottles cheaper than at the previous sync (only offered when there are some).
  const [dropsOnly, setDropsOnly] = useState(false);
  const drops = useMemo(() => items.filter((x) => isPriceDrop(x)).length, [items]);
  const filtered = useMemo(() => {
    let r = [...items];
    if (dropsOnly && drops) r = r.filter((x) => isPriceDrop(x));
    if (tierF !== "All") r = r.filter((x) => x.tier === tierF);
    if (origF === "India") r = r.filter((x) => x.origin === "India");
    if (origF === "Intl") r = r.filter((x) => x.origin && x.origin !== "India");
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.name?.toLowerCase().includes(q) || x.brand?.toLowerCase().includes(q) || x.sub?.toLowerCase().includes(q));
    }
    if (sortF === "price_desc") r.sort((a, b) => b.price - a.price);
    if (sortF === "rating") r.sort((a, b) => b.rating - a.rating);
    if (sortF === "value") r.sort((a, b) => (b.ratings?.value || 0) - (a.ratings?.value || 0));
    return r;
  }, [items, tierF, origF, search, sortF, dropsOnly, drops]);

  // Editor's picks across every synced category.
  const picks = useMemo(() => {
    const all = [];
    for (const [cat, list] of Object.entries(catalog)) for (const it of list) if (it.tier === "editors" && it.img) all.push({ it, cat });
    return all.sort((a, b) => b.it.rating - a.it.rating || a.it.price - b.it.price).slice(0, 12);
  }, [catalog]);

  const coverage = plan.needed ? Math.min(1, plan.available / plan.needed) : 0;
  const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
  const stale = ages[activeCat] && Date.now() - ages[activeCat] > STALE_MS;
  const place = loc?.label || cityName(city);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero fade-up">
        <div className="hero-art" aria-hidden="true">
          <Bottle shape="decanter" color="#d4872a" height={118} />
          <div style={{ marginLeft: -14 }}><Bottle shape="wine" color="#9c1f4f" height={140} /></div>
          <div style={{ marginLeft: -14 }}><Bottle shape="gin" color="#23b377" height={104} glass /></div>
        </div>
        <div className="hero-body">
          <div className="kicker ellipsis">{greeting()} · {place}</div>
          <h1 className="h1" style={{ marginTop: 8 }}>Stock the <em>perfect</em> bar</h1>
          <div className="small muted" style={{ marginTop: 8 }}>Live prices from Livcheers for {cityName(city)}</div>
        </div>
        <div className="hero-stats">
          <div className="stat"><div className="v">{bottles}</div><div className="l">Bottles</div></div>
          <div className="stat"><div className="v" style={{ color: coverage >= 1 ? "var(--green)" : undefined }}>{plan.available ? `${Math.round(coverage * 100)}%` : "—"}</div><div className="l">Drinks covered</div></div>
          <div className="stat"><div className={`v ${budgetLeft < 0 ? "red" : "gold-text"}`}>{fmtShort(budgetLeft)}</div><div className="l">Budget left</div></div>
        </div>
        <div className="progress" style={{ position: "relative", zIndex: 1, marginTop: 12 }}>
          <div style={{ width: `${pct * 100}%`, background: pct > 0.92 ? "var(--red)" : "var(--grad-gold)" }} />
        </div>
      </section>

      {/* ── Categories ── */}
      <div className="section-head">
        <div><div className="kicker">The cellar</div><div className="h2">Browse by spirit</div></div>
        <button className="link" onClick={openScraper}>⚡ Sync prices</button>
      </div>
      <div className="scroll-x">
        {CATEGORIES.map((c) => {
          const n = catalog[c.id]?.length;
          const st = ages[c.id] && Date.now() - ages[c.id] > STALE_MS;
          return (
            <button key={c.id} className={`cat-tile ${c.id === activeCat ? "on" : ""}`} onClick={() => { setActiveCat(c.id); setLimit(40); }}
              style={{ background: `linear-gradient(165deg, ${c.color} 0%, color-mix(in srgb, ${c.color} 45%, #120a0c) 70%, #120a0c 100%)` }}>
              <span className="art"><CatBottle cat={c} height={84} /></span>
              <span className="name">{c.label}</span>
              <span className="cnt">{n ? `${n} bottles${st ? " · stale" : ""}` : "not synced"}</span>
            </button>
          );
        })}
      </div>

      {/* ── Editor's picks ── */}
      {picks.length >= 3 && (
        <>
          <div className="section-head">
            <div><div className="kicker">Top rated in {cityName(city)}</div><div className="h2">Editor's <em>picks</em></div></div>
          </div>
          <div className="scroll-x">
            {picks.map(({ it, cat }) => (
              <div role="button" tabIndex={0} key={`${cat}:${it.id}`} className="pick" onClick={() => setOpen({ item: it, cat })}>
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3 }}><TierPill tier={it.tier} /></div>
                <BottleStage item={it} cat={cat} artHeight={150} />
                <div className="body">
                  <div className="tiny" style={{ color: CAT[cat].color, fontWeight: 600 }}>{CAT[cat].label.toUpperCase()} · {it.flag} {it.origin}</div>
                  <div className="display b clamp2" style={{ fontSize: 16, marginTop: 3, minHeight: 38 }}>{it.name}</div>
                  <div className="between" style={{ marginTop: 8 }}>
                    <span><span className="stars">★ {it.rating}</span> <span className="tiny dim">· {it.vol}</span></span>
                    <b className="gold-text" style={{ fontSize: 17 }}>{fmt(it.price)}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Catalogue ── */}
      <div className="section-head">
        <div><div className="kicker">{cm.emoji} {filtered.length} of {items.length} bottles</div><div className="h2">{cm.label}</div></div>
        {ages[activeCat] && <span className="tiny" style={{ color: stale ? "var(--gold)" : "var(--dim)" }}>updated {ageStr(ages[activeCat])}</span>}
      </div>

      {items.length > 0 && (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="search"><Icon.search size={18} /><input className="input" placeholder={`Search ${cm.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <button className="icon-btn" onClick={() => setView(view === "grid" ? "list" : "grid")} aria-label="Toggle view">{view === "grid" ? <Icon.list size={20} /> : <Icon.grid size={20} />}</button>
          </div>
          <div className="chips">
            {drops > 0 && (
              <button className={`chip data-drops ${dropsOnly ? "on" : ""}`} onClick={() => setDropsOnly(!dropsOnly)}>↓ Price drops <span className="count">{drops}</span></button>
            )}
            {[["All", "All"], ["editors", "🏆 Editor's"], ["best", "★ Best"], ["good", "✓ Value"]].map(([k, l]) => (
              <button key={k} className={`chip ${tierF === k ? "on" : ""}`} onClick={() => setTierF(k)}>{l}</button>
            ))}
            {[["India", "🇮🇳 Indian"], ["Intl", "🌍 Imported"]].map(([k, l]) => (
              <button key={k} className={`chip ${origF === k ? "on" : ""}`} onClick={() => setOrigF(origF === k ? "All" : k)}>{l}</button>
            ))}
            <select className="chip" value={sortF} onChange={(e) => setSortF(e.target.value)} style={{ appearance: "none", paddingRight: 14 }}>
              <option value="default">↑ Price</option>
              <option value="price_desc">↓ Price</option>
              <option value="rating">★ Rating</option>
              <option value="value">₹ Value</option>
            </select>
          </div>
        </>
      )}

      {!items.length && (
        <div className="card empty fade-up">
          <div style={{ display: "flex", justifyContent: "center" }}><CatBottle cat={cm} height={120} /></div>
          <div className="t">No {cm.label} prices yet</div>
          <div className="small" style={{ marginBottom: 18 }}>Pull today's shelf prices for {cityName(city)} straight from Livcheers.</div>
          <button className="btn btn-gold" onClick={openScraper}><Icon.bolt size={18} /> Sync prices</button>
        </div>
      )}

      {items.length > 0 && view === "grid" && (
        <div className="grid">
          {filtered.slice(0, limit).map((item, i) => (
            <ProductCard key={item.id} item={item} cat={activeCat} index={i} qty={qtyOf(activeCat, item)}
              onAdd={() => addItem(activeCat, item)} onOpen={() => setOpen({ item, cat: activeCat })}
              canAfford={item.price <= budgetLeft} />
          ))}
        </div>
      )}

      {items.length > 0 && view === "list" && filtered.slice(0, limit).map((item) => {
        const q = qtyOf(activeCat, item);
        return (
          <div role="button" tabIndex={0} key={item.id} className="list-row" onClick={() => setOpen({ item, cat: activeCat })}>
            <BottleStage item={item} cat={activeCat} artHeight={64} />
            <div className="grow">
              <div className="display b ellipsis" style={{ fontSize: 15 }}>{item.name}</div>
              <div className="tiny muted ellipsis">{item.flag} {item.brand} · {item.vol}</div>
              <div className="row" style={{ marginTop: 4, gap: 8 }}><span className="stars">★ {item.rating}</span><b className="gold-text">{fmt(item.price)}</b></div>
            </div>
            {q > 0 && <span className="pill" style={{ background: "var(--grad-gold)", color: "#231404" }}>×{q}</span>}
            <button className="add-btn" onClick={(e) => { e.stopPropagation(); if (item.price <= budgetLeft) addItem(activeCat, item); }} style={item.price <= budgetLeft ? undefined : { opacity: 0.35 }}><Icon.plus size={18} /></button>
          </div>
        );
      })}

      {filtered.length > limit && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => setLimit(limit + 40)}>
          Show {Math.min(40, filtered.length - limit)} more · {filtered.length - limit} left
        </button>
      )}

      {open && (
        <ProductSheet item={open.item} cat={open.cat} city={city} qty={qtyOf(open.cat, open.item)} canAfford={open.item.price <= budgetLeft}
          onAdd={() => addItem(open.cat, open.item)} onRem={() => remItem(open.cat, open.item)} onClose={() => setOpen(null)}
          onPairing={(d) => { setOpen(null); onPairing?.(d); }} />
      )}
    </div>
  );
}
