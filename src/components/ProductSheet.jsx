import { Fragment, useEffect, useState } from "react";
import Sheet, { Qty } from "./Sheet.jsx";
import { BottleStage, PriceMove, TierPill } from "./ProductCard.jsx";
import { CAT } from "../lib/parse/livcheers.js";
import { suggestDishes } from "../lib/food.js";
import { fmt } from "../lib/format.js";
import { openUrl } from "../lib/order.js";
import { histDate, histKey } from "../lib/pricehist.js";
import { store } from "../lib/store.js";
import { Icon } from "./Art.jsx";

function RatingBar({ label, value }) {
  const v = Number(value) || 0;
  return (
    <div className="bar-rating">
      <span className="muted">{label}</span>
      <div className="track"><div style={{ width: `${(v / 5) * 100}%` }} /></div>
      <span className="b" style={{ textAlign: "right" }}>{v ? v.toFixed(1) : "–"}</span>
    </div>
  );
}

// Prices this bottle had on past syncs: "₹2,450 (10 Sep) → ₹2,250 (24 Sep)".
function PriceHistory({ item, city, cat }) {
  const key = `${city}:${cat}:${item.id}`;
  const [loaded, setLoaded] = useState(null); // { key, entries }
  useEffect(() => {
    if (!city) return;
    let live = true;
    store.get(histKey(city, cat)).then((h) => { if (live) setLoaded({ key, entries: h?.[item.id] || [] }); });
    return () => { live = false; };
  }, [key]);
  const hist = loaded?.key === key ? loaded.entries : [];
  const steps = hist.length > 1 ? hist.slice(-4)
    : item.prevPrice ? [[item.prevPriceAt, item.prevPrice], [item.priceChangedAt, item.price]] : null;
  if (!steps) return null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-title"><span className="kicker">Price history</span><PriceMove item={item} /></div>
      <div className="data-steps">
        {steps.map(([t, p], i) => (
          <Fragment key={`${t}:${i}`}>
            {i > 0 && <span className="dim">→</span>}
            <span className={i === steps.length - 1 ? "b" : "muted"}>{fmt(p)}{t ? <span className="tiny dim"> ({histDate(t)})</span> : null}</span>
          </Fragment>
        ))}
      </div>
      <div className="tiny dim" style={{ marginTop: 8 }}>Livcheers shelf prices, as seen each time you synced.</div>
    </div>
  );
}

// Full bottle page: big lit display, ratings, tasting notes, food pairings.
export default function ProductSheet({ item, cat, qty, onAdd, onRem, canAfford, onClose, onPairing, city }) {
  const c = CAT[cat];
  const pairs = suggestDishes([cat]).filter((d) => d.score > 0).slice(0, 6);
  return (
    <Sheet bare onClose={onClose}
      footer={
        <div className="row" style={{ gap: 12 }}>
          <div className="grow">
            <div className="tiny muted">{item.vol} · Livcheers price</div>
            <div className="h2 gold-text" style={{ fontFamily: "var(--ui)" }}>{fmt(item.price)}</div>
          </div>
          {qty > 0 && <Qty value={qty} onChange={(v) => (v > qty ? onAdd() : onRem())} />}
          <button className="btn btn-gold" disabled={!canAfford} onClick={onAdd}>
            <Icon.plus size={18} /> {qty > 0 ? "One more" : "Add to cabinet"}
          </button>
        </div>
      }>
      <div style={{ position: "relative" }}>
        <BottleStage item={item} cat={cat} className="stage pd-stage" artHeight={220} />
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 3 }} className="between">
          <TierPill tier={item.tier} />
          <button className="xbtn" style={{ background: "rgba(20,12,10,.6)" }} onClick={onClose} aria-label="Close"><Icon.close size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "16px 0 4px" }}>
        <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
          <span className="pill" style={{ background: `${c.color}26`, color: c.color }}>{c.emoji} {c.label}</span>
          {item.sub && <span className="pill" style={{ background: "var(--panel-2)", color: "var(--soft)" }}>{item.sub}</span>}
          {item.origin && <span className="pill" style={{ background: "var(--panel-2)", color: "var(--soft)" }}>{item.flag} {item.origin}</span>}
        </div>
        <div className="h1" style={{ fontSize: 26 }}>{item.name}</div>
        <div className="muted" style={{ marginTop: 4 }}>{item.brand}</div>
      </div>

      <PriceHistory item={item} city={city} cat={cat} />

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">
          <span className="kicker">Drinkers' ratings</span>
          <span className="row" style={{ gap: 4 }}><span className="stars" style={{ fontSize: 14 }}>★</span><b style={{ fontSize: 18 }}>{item.rating || "–"}</b><span className="tiny muted">/ 5</span></span>
        </div>
        <RatingBar label="Taste" value={item.ratings?.taste} />
        <RatingBar label="Value" value={item.ratings?.value} />
        <RatingBar label="Buy again" value={item.ratings?.rebuy} />
      </div>

      {(item.notes || item.description) && (
        <div className="card">
          <div className="kicker" style={{ marginBottom: 8 }}>Tasting notes</div>
          {item.notes && <div className="display" style={{ fontSize: 15.5, fontStyle: "italic", lineHeight: 1.6, color: "#f1e2c8" }}>“{item.notes}”</div>}
          {item.description && <div className="small muted" style={{ marginTop: 10, lineHeight: 1.6 }}>{item.description}</div>}
        </div>
      )}

      {pairs.length > 0 && (
        <>
          <div className="kicker" style={{ margin: "6px 2px 10px" }}>Pairs beautifully with</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {pairs.map((d) => <button key={d.id} className="chip" onClick={() => onPairing?.(d)}>{d.emoji} {d.name}</button>)}
          </div>
        </>
      )}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => openUrl(item.url)}>
        View on Livcheers <Icon.external size={16} />
      </button>
    </Sheet>
  );
}
