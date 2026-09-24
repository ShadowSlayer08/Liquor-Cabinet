import { useState } from "react";
import { CAT, TIER } from "../lib/parse/livcheers.js";
import { fmt } from "../lib/format.js";
import { openUrl } from "../lib/order.js";

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT CARD — tap to flip for tasting notes (hover flip doesn't exist on phones)
// ═══════════════════════════════════════════════════════════════════════════════
export default function ProductCard({ item, cat, qty, onAdd, onRem, canAfford }) {
  const [flipped, setFlipped] = useState(false);
  const [img, setImg] = useState("loading"); // loading | ok | failed
  const cm = CAT[cat];
  const t = TIER[item.tier] || TIER.good;
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };

  return (
    <div className={`pcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)}>
      <div className="pcard-inner">
        {/* FRONT */}
        <div className="pface" style={{
          background: `linear-gradient(160deg, ${cm.color}1c 0%, #0b0907 55%)`,
          border: `1px solid ${qty > 0 ? cm.color + "a0" : "#211b15"}`,
          boxShadow: qty > 0 ? `0 0 18px ${cm.color}40` : "none",
        }}>
          <div className="between">
            <span className="pill" style={{ background: t.bg, color: t.fg, fontSize: 8 }}>{t.icon} {t.label}</span>
            <span className="tiny muted" title={item.origin}>{item.flag}</span>
          </div>
          <div className="pimg">
            {(!item.img || img !== "ok") && <span style={{ fontSize: 42, position: item.img && img === "loading" ? "absolute" : "static", opacity: .5 }}>{cm.emoji}</span>}
            {item.img && img !== "failed" && (
              <img src={item.img} alt="" loading="lazy" style={{ opacity: img === "ok" ? 1 : 0, transition: "opacity .3s" }}
                onLoad={() => setImg("ok")} onError={() => setImg("failed")} />
            )}
          </div>
          <div className="tiny ellipsis" style={{ color: cm.color, opacity: .85 }}>{item.brand} · {item.sub}</div>
          <div className="pname" style={{ flex: 1, marginTop: 2 }}>{item.name}</div>
          <div className="stars" style={{ margin: "4px 0" }}>
            {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ color: i <= Math.round(item.rating || 0) ? "#e8c030" : "#2a241e" }}>★</span>)}
            <span className="dim" style={{ fontSize: 9, marginLeft: 3 }}>{item.rating || "–"}</span>
          </div>
          <div className="between" style={{ alignItems: "flex-end" }}>
            <div>
              <div className="pprice" style={{ color: cm.color }}>{fmt(item.price)}</div>
              <div className="tiny dim">{item.vol}</div>
            </div>
            <div className="qty" onClick={(e) => e.stopPropagation()}>
              {qty > 0 && <>
                <button onClick={stop(onRem)}>−</button>
                <span className="n" style={{ color: cm.color }}>{qty}</span>
              </>}
              <button className="plus" onClick={stop(canAfford ? onAdd : null)}
                style={{ background: qty > 0 || canAfford ? cm.color : "#1a1510", borderColor: cm.color, opacity: canAfford ? 1 : 0.35 }}>+</button>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="pface back" style={{ background: `linear-gradient(135deg, ${cm.color}22 0%, #0f0c0a 60%, #080706 100%)`, border: `1px solid ${cm.color}50` }}>
          <div style={{ overflowY: "auto", minHeight: 0 }}>
            <div className="tiny" style={{ color: cm.color, letterSpacing: 2, marginBottom: 6 }}>TASTING NOTES</div>
            <div style={{ fontSize: 11.5, color: "#e0d4c0", fontStyle: "italic", lineHeight: 1.55 }}>
              {item.notes || item.description || "No tasting notes on Livcheers yet."}
            </div>
          </div>
          <div>
            {item.ratings?.taste && (
              <div className="between tiny muted" style={{ margin: "8px 0 6px" }}>
                <span>Taste {item.ratings.taste}</span><span>Value {item.ratings.value}</span><span>Rebuy {item.ratings.rebuy}</span>
              </div>
            )}
            <button className="btn btn-sm btn-block" onClick={stop(() => openUrl(item.url))}
              style={{ background: `${cm.color}18`, border: `1px solid ${cm.color}50`, color: cm.color }}>
              View on Livcheers ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
