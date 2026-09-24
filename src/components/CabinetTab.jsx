import { useMemo, useState } from "react";
import { CATEGORIES, CAT, TIER, cityName } from "../lib/parse/livcheers.js";
import { STALE_MS } from "../lib/sources.js";
import { fmt, ageStr } from "../lib/format.js";
import ProductCard from "./ProductCard.jsx";

export default function CabinetTab({ city, catalog, ages, activeCat, setActiveCat, qtyOf, addItem, remItem, budgetLeft, openScraper }) {
  const [tierF, setTierF] = useState("All");
  const [origF, setOrigF] = useState("All");
  const [sortF, setSortF] = useState("default");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [limit, setLimit] = useState(60);

  const cm = CAT[activeCat] || CATEGORIES[0];
  const items = catalog[activeCat] || [];

  const filtered = useMemo(() => {
    let r = [...items];
    if (tierF !== "All") r = r.filter((x) => x.tier === tierF);
    if (origF === "India") r = r.filter((x) => x.origin === "India");
    if (origF === "Intl") r = r.filter((x) => x.origin && x.origin !== "India");
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.name?.toLowerCase().includes(q) || x.brand?.toLowerCase().includes(q) || x.sub?.toLowerCase().includes(q));
    }
    if (sortF === "price_asc") r.sort((a, b) => a.price - b.price);
    if (sortF === "price_desc") r.sort((a, b) => b.price - a.price);
    if (sortF === "rating") r.sort((a, b) => b.rating - a.rating);
    if (sortF === "value") r.sort((a, b) => (b.ratings?.value || 0) - (a.ratings?.value || 0));
    return r;
  }, [items, tierF, origF, search, sortF]);

  const stale = ages[activeCat] && Date.now() - ages[activeCat] > STALE_MS;
  const shown = filtered.slice(0, limit);

  return (
    <div>
      {/* Category tabs */}
      <div className="chips" style={{ marginBottom: 4 }}>
        {CATEGORIES.map((c) => {
          const on = c.id === activeCat;
          const n = catalog[c.id]?.length;
          const st = ages[c.id] && Date.now() - ages[c.id] > STALE_MS;
          return (
            <button key={c.id} className={`chip ${on ? "on" : ""}`} onClick={() => { setActiveCat(c.id); setLimit(60); }}
              style={on ? { background: c.color, borderColor: c.color, boxShadow: `0 0 14px ${c.color}40` } : n ? { borderColor: "#2a221b", color: "#b0a38e" } : undefined}>
              {c.emoji} {c.label}
              {n ? <span className="count">{n}</span> : null}
              {st && !on ? <span style={{ fontSize: 9, color: "#a07a30" }}>⚠</span> : null}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="filters">
        {[["All", "All"], ["editors", "🏆"], ["best", "★ Best"], ["good", "✓ Value"]].map(([k, l]) => (
          <button key={k} className={`fbtn ${tierF === k ? "on" : ""}`} onClick={() => setTierF(k)}>{l}</button>
        ))}
        <span style={{ width: 1, height: 14, background: "#221c16" }} />
        {[["All", "All"], ["India", "🇮🇳"], ["Intl", "🌍 Intl"]].map(([k, l]) => (
          <button key={k} className={`fbtn ${origF === k ? "on" : ""}`} onClick={() => setOrigF(k)}>{l}</button>
        ))}
      </div>
      <div className="filters">
        <input className="input search" placeholder={`Search ${cm.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={sortF} onChange={(e) => setSortF(e.target.value)}>
          <option value="default">Price ↑ (default)</option>
          <option value="price_desc">Price ↓</option>
          <option value="rating">Rating ↓</option>
          <option value="value">Value for money</option>
        </select>
        <button className="fbtn" style={{ fontSize: 14, padding: "5px 11px" }} onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}>
          {viewMode === "grid" ? "☰" : "⊞"}
        </button>
      </div>

      {/* Status */}
      <div className="status-line">
        <span>{filtered.length} items · {cm.label} · {cityName(city)}</span>
        {ages[activeCat] && (
          <span style={{ color: stale ? "#a07a30" : undefined }}>💾 {ageStr(ages[activeCat])}{stale ? " · stale" : ""}</span>
        )}
      </div>

      {/* Empty */}
      {!items.length && (
        <div className="empty">
          <div className="big">{cm.emoji}</div>
          <div className="t">No {cm.label} prices for {cityName(city)} yet</div>
          <div className="small" style={{ marginBottom: 18 }}>Tap <b className="gold">⚡ Scrape</b> to pull live prices from Livcheers</div>
          <button className="btn btn-gold" onClick={openScraper}>⚡ Open Scraper</button>
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && viewMode === "grid" && (
        <div className="grid">
          {shown.map((item, i) => {
            const q = qtyOf(activeCat, item);
            return (
              <div key={item.id} className="fade-up" style={{ animationDelay: `${Math.min(i * 18, 180)}ms` }}>
                <ProductCard item={item} cat={activeCat} qty={q}
                  onAdd={() => addItem(activeCat, item)} onRem={() => remItem(activeCat, item)}
                  canAfford={item.price <= budgetLeft} />
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {items.length > 0 && viewMode === "table" && (
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th></th><th>NAME</th><th>SIZE</th><th>PRICE</th><th style={{ textAlign: "right" }}></th></tr></thead>
            <tbody>
              {shown.map((item) => {
                const q = qtyOf(activeCat, item), t = TIER[item.tier] || TIER.good;
                return (
                  <tr key={item.id} style={{ background: q > 0 ? cm.color + "10" : "transparent" }}>
                    <td><span className="pill" style={{ background: t.bg, color: t.fg }}>{t.icon}</span></td>
                    <td>
                      <div style={{ color: q > 0 ? "#f0e8d0" : "#c8bba5", fontWeight: q > 0 ? 700 : 400 }}>{item.name}</div>
                      <div className="tiny dim">{item.flag} {item.brand} · ★ {item.rating}</div>
                    </td>
                    <td className="dim small">{item.vol}</td>
                    <td style={{ color: cm.color, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(item.price)}</td>
                    <td>
                      <div className="qty" style={{ justifyContent: "flex-end" }}>
                        {q > 0 && <><button onClick={() => remItem(activeCat, item)}>−</button><span className="n" style={{ color: cm.color }}>{q}</span></>}
                        <button className="plus" onClick={() => item.price <= budgetLeft && addItem(activeCat, item)}
                          style={{ background: cm.color, borderColor: cm.color, opacity: item.price <= budgetLeft ? 1 : 0.35 }}>+</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > limit && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => setLimit(limit + 60)}>
          Show more ({filtered.length - limit} left)
        </button>
      )}
    </div>
  );
}
