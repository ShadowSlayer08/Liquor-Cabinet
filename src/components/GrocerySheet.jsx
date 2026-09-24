import Sheet from "./Sheet.jsx";
import { packsFor, formatAmount } from "../lib/food.js";
import { openBlinkitSearch } from "../lib/order.js";
import { fmt } from "../lib/format.js";

// Product choices for one party-supply item, ordered on Blinkit.
export default function GrocerySheet({ grocery, need, selectedId, onPick, onClose }) {
  return (
    <Sheet
      title={`${grocery.emoji} ${grocery.name}`}
      subtitle={need ? `You need about ${formatAmount(need, grocery.unit)}` : "Pick a product"}
      onClose={onClose}
      footer={<button className="btn btn-blinkit btn-block" onClick={() => openBlinkitSearch(grocery.options[0].blinkit)}>Browse “{grocery.name}” on Blinkit ↗</button>}
    >
      {grocery.options.map((p) => {
        const packs = Math.max(1, packsFor(need, p));
        const on = p.id === selectedId;
        return (
          <div key={p.id} className="line-item">
            <div className="emo">{grocery.emoji}</div>
            <div className="grow">
              <div className="small" style={{ fontWeight: 700 }}>{p.name} {on && <span className="green tiny">✓ selected</span>}</div>
              <div className="tiny muted">{p.packText} · MRP ≈ {fmt(p.price)}</div>
              <button className="tiny gold" onClick={() => openBlinkitSearch(p.blinkit)}>See live price on Blinkit ↗</button>
            </div>
            <button className="btn btn-sm btn-blinkit" onClick={() => onPick(p, packs)}>
              ×{packs} · {fmt(p.price * packs)}
            </button>
          </div>
        );
      })}
      <div className="tiny dim" style={{ marginTop: 10 }}>Prices are the usual printed MRP — Blinkit shows the exact price (often a little lower) when you open the item.</div>
    </Sheet>
  );
}
