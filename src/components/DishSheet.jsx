import { useEffect, useMemo, useState } from "react";
import Sheet, { Stepper, Skeleton } from "./Sheet.jsx";
import { fetchDish } from "../lib/sources.js";
import { cityName } from "../lib/parse/livcheers.js";
import { openZomatoUrl } from "../lib/order.js";
import { fmt, ageStr } from "../lib/format.js";
import { Icon } from "./Art.jsx";

// Live list of Zomato restaurants delivering a dish — to your exact location when GPS is on.
export default function DishSheet({ dish, city, loc, suggested, inCart, onQuickAdd, onOpenMenu, onClose }) {
  const [state, setState] = useState({ loading: true });
  const [servings, setServings] = useState(Math.max(1, suggested || 1));
  const [sort, setSort] = useState(loc?.zomato ? "near" : "top");

  const load = (force = false) => {
    setState({ loading: true });
    fetchDish(city, dish, { force, loc }).then((d) => setState({ data: d })).catch((e) => setState({ error: e.message }));
  };
  useEffect(() => { load(false); }, [dish.id, city, loc?.zomato?.entityId]);

  const d = state.data;
  const list = useMemo(() => {
    const r = [...(d?.restaurants || [])];
    if (sort === "near") r.sort((a, b) => (a.meters ?? 1e9) - (b.meters ?? 1e9));
    if (sort === "top") r.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sort === "cheap") r.sort((a, b) => (a.costForOne ?? 1e9) - (b.costForOne ?? 1e9));
    return r;
  }, [d, sort]);

  const where = loc?.zomato && d?.local ? loc.label : cityName(city);
  return (
    <Sheet title={`${dish.emoji} ${dish.name}`} subtitle={<span className="row" style={{ gap: 5 }}><Icon.pin size={13} /> Delivering to {where}</span>} onClose={onClose}>
      <div className="card" style={{ padding: 14 }}>
        <div className="between">
          <div>
            <div className="h3">Servings</div>
            <div className="tiny muted">Suggested for your party: {suggested}</div>
          </div>
          <div style={{ width: 150 }}><Stepper value={servings} onChange={setServings} min={1} max={200} /></div>
        </div>
        {d?.medianCostForOne && (
          <div className="note note-ok" style={{ marginTop: 12 }}>
            Typical here: <b>{fmt(d.medianCostForOne)}</b> per person → about <b>{fmt(d.medianCostForOne * servings)}</b> for {servings}
          </div>
        )}
      </div>

      {!!d?.restaurants?.length && (
        <div className="seg" style={{ marginBottom: 12 }}>
          {[["near", "📍 Nearest"], ["top", "★ Top rated"], ["cheap", "₹ Cheapest"]].map(([k, l]) => (
            <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
      )}

      {state.loading && <Skeleton h={200} n={2} />}
      {state.error && (
        <div className="empty">
          <div className="t">Couldn't reach Zomato</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}</div>
          <button className="btn btn-ghost" onClick={() => load(true)}>↻ Try again</button>
        </div>
      )}
      {d?.notFound && (
        <div className="empty">
          <div className="t">No {dish.name} page on Zomato here</div>
          <button className="btn btn-zomato" style={{ marginTop: 12 }} onClick={() => openZomatoUrl(d.webUrl)}>Search on Zomato <Icon.external size={16} /></button>
        </div>
      )}

      {list.map((r, i) => {
        const n = inCart(r.resId);
        return (
          <div key={r.resId} className="rest-card fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="img" onClick={() => onOpenMenu(r)}>
              {r.img && <img src={r.img} alt="" loading="lazy" />}
              <div className="tags">
                <span className="pill pill-glass"><Icon.clock size={12} /> {r.deliveryTime || "—"}{r.distance ? ` · ${r.distance}` : ""}</span>
                {r.rating && <span className="rating">{r.rating} ★</span>}
              </div>
            </div>
            <div className="info">
              <div className="between">
                <div className="h3 ellipsis">{r.name}</div>
                {n > 0 && <span className="pill" style={{ background: "rgba(226,55,68,.18)", color: "#ff8a92" }}>{n} in cart</span>}
              </div>
              <div className="tiny muted ellipsis" style={{ marginTop: 2 }}>{r.cuisines.slice(0, 3).join(" · ")}{r.locality ? ` — ${r.locality}` : ""}</div>
              <div className="between" style={{ marginTop: 10 }}>
                <span className="small" style={{ color: "#ffb0b6" }}>{r.costText || "—"}</span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => onOpenMenu(r)}>Menu <Icon.chevron size={14} /></button>
                  <button className="btn btn-sm btn-zomato" disabled={!r.serviceable} onClick={() => onQuickAdd(r, servings)}>
                    <Icon.plus size={14} /> {servings}{r.costForOne ? ` · ${fmt(r.costForOne * servings)}` : ""}
                  </button>
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {list.length > 0 && (
        <div className="between tiny dim" style={{ marginTop: 4 }}>
          <span>Prices are Zomato's "for one" estimate; exact prices show in Zomato.</span>
          <button className="gold" onClick={() => load(true)}>↻ {d.fromCache ? ageStr(d.fetchedAt) : "refresh"}</button>
        </div>
      )}
    </Sheet>
  );
}
