import { useState } from "react";
import { CAT, TIER } from "../lib/parse/livcheers.js";
import { fmt } from "../lib/format.js";
import { CatBottle, Icon } from "./Art.jsx";

// Bottle photo in a lit display case, falling back to drawn art while loading / on error.
export function BottleStage({ item, cat, className = "stage", artHeight = 110, style }) {
  const [state, setState] = useState("loading"); // loading | ok | failed
  const c = CAT[cat];
  return (
    <div className={className} style={{ "--c": c?.color, ...style }}>
      {(state !== "ok" || !item.img) && (
        <div className="ph" style={{ opacity: state === "loading" && item.img ? 0.35 : 0.9 }}><CatBottle cat={c} height={artHeight} /></div>
      )}
      {item.img && state !== "failed" && (
        <img src={item.img} alt={item.name} loading="lazy" style={{ opacity: state === "ok" ? 1 : 0 }}
          onLoad={() => setState("ok")} onError={() => setState("failed")} />
      )}
    </div>
  );
}

export const TierPill = ({ tier }) => {
  const t = TIER[tier] || TIER.good;
  return <span className="pill pill-glass">{t.icon} {t.label}</span>;
};

export default function ProductCard({ item, cat, qty, onAdd, onOpen, canAfford, index = 0 }) {
  const c = CAT[cat];
  const [bump, setBump] = useState(0);
  const add = (e) => { e.stopPropagation(); if (!canAfford) return; setBump((b) => b + 1); onAdd(); };
  return (
    <div role="button" tabIndex={0} className={`pc fade-up ${qty > 0 ? "in" : ""}`} style={{ "--c": c.color, animationDelay: `${Math.min(index * 35, 280)}ms` }} onClick={onOpen}>
      <div className="badges">
        <TierPill tier={item.tier} />
        <span className="pill pill-glass" title={item.origin}>{item.flag}</span>
      </div>
      <BottleStage item={item} cat={cat} />
      {qty > 0 && <span key={bump} className="qty-badge pop">{qty}</span>}
      <div className="body">
        <div className="name clamp2">{item.name}</div>
        <div className="meta ellipsis">{item.brand} · {item.sub}</div>
        <div className="row" style={{ gap: 6, marginTop: 5 }}>
          <span className="stars">★ {item.rating || "–"}</span>
          <span className="tiny dim">· {item.vol}</span>
        </div>
        <div className="foot">
          <span className="price gold-text">{fmt(item.price)}</span>
          <button className="add-btn" aria-label={`Add ${item.name}`} onClick={add} style={canAfford ? undefined : { opacity: 0.35 }}>
            <Icon.plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
