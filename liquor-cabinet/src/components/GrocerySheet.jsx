import { useEffect, useState } from "react";
import Sheet, { Spinner } from "./Sheet.jsx";
import { fetchGrocery } from "../lib/sources.js";
import { packsFor, formatAmount, blinkitQuery } from "../lib/food.js";
import { openBlinkitSearch } from "../lib/order.js";
import { fmt } from "../lib/format.js";

// Live product options for one party-supply item (prices from DMart, ordered on Blinkit).
export default function GrocerySheet({ grocery, need, onPick, onClose }) {
  const [state, setState] = useState({ loading: true });

  const load = (force = false) => {
    setState({ loading: true });
    fetchGrocery(grocery, { force }).then((d) => setState({ data: d })).catch((e) => setState({ error: e.message }));
  };
  useEffect(() => { load(false); }, [grocery.id]);

  const d = state.data;
  return (
    <Sheet
      title={`${grocery.emoji} ${grocery.name}`}
      subtitle={need ? `You need about ${formatAmount(need, grocery.unit)}` : "Pick a product"}
      onClose={onClose}
      footer={<button className="btn btn-blinkit btn-block" onClick={() => openBlinkitSearch(grocery.blinkit || grocery.query || grocery.name)}>Browse “{grocery.name}” on Blinkit ↗</button>}
    >
      {state.loading && <Spinner label="Checking live prices…" />}
      {state.error && (
        <div className="empty" style={{ padding: "30px 0" }}>
          <div className="t">Couldn't load prices</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}</div>
          <button className="btn btn-ghost" onClick={() => load(true)}>↻ Retry</button>
        </div>
      )}
      {d && !d.products.length && <div className="empty"><div className="t">No matching products right now</div></div>}
      {d?.products.map((p) => {
        const packs = Math.max(1, packsFor(need, p));
        return (
          <div key={p.id} className="line-item">
            {p.img ? <img className="thumb contain" src={p.img} alt="" loading="lazy" /> : <div className="emo">{grocery.emoji}</div>}
            <div className="grow">
              <div className="small" style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="tiny muted">
                {p.packText} · {fmt(p.price)} {p.mrp > p.price && <s className="dim">{fmt(p.mrp)}</s>}
                {p.fallback && " · estimate"}
              </div>
              <div className="tiny dim">Blinkit search: “{blinkitQuery(grocery, p)}”</div>
            </div>
            <button className="btn btn-sm btn-blinkit" onClick={() => onPick(p, packs)}>
              ×{packs} · {fmt(p.price * packs)}
            </button>
          </div>
        );
      })}
      {d?.live && <div className="tiny dim" style={{ marginTop: 10 }}>Live shelf prices from DMart as a reference — Blinkit's price may differ slightly.</div>}
    </Sheet>
  );
}
