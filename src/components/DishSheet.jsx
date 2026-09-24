import { useEffect, useState } from "react";
import Sheet, { Stepper, Spinner } from "./Sheet.jsx";
import { fetchDish } from "../lib/sources.js";
import { cityName } from "../lib/parse/livcheers.js";
import { openZomatoRestaurant, openZomatoUrl } from "../lib/order.js";
import { fmt, ageStr } from "../lib/format.js";

// Live list of Zomato restaurants delivering a dish in the selected city.
export default function DishSheet({ dish, city, suggested, onAdd, onClose }) {
  const [state, setState] = useState({ loading: true });
  const [servings, setServings] = useState(Math.max(1, suggested || 1));

  const load = (force = false) => {
    setState({ loading: true });
    fetchDish(city, dish, { force })
      .then((d) => setState({ data: d }))
      .catch((e) => setState({ error: e.message }));
  };
  useEffect(() => { load(false); }, [dish.id, city]);

  const d = state.data;
  return (
    <Sheet
      title={`${dish.emoji} ${dish.name}`}
      subtitle={`Delivering in ${cityName(city)} · live from Zomato`}
      onClose={onClose}
    >
      <div className="between" style={{ marginBottom: 10 }}>
        <div>
          <div className="small">Servings</div>
          <div className="tiny muted">Suggested for your party: {suggested}</div>
        </div>
        <div style={{ width: 150 }}><Stepper value={servings} onChange={setServings} min={1} max={200} /></div>
      </div>
      {d?.medianCostForOne && (
        <div className="ok-box" style={{ marginBottom: 8 }}>
          Typical price here: <b>{fmt(d.medianCostForOne)}</b> per person → about <b>{fmt(d.medianCostForOne * servings)}</b> for {servings}
        </div>
      )}

      {state.loading && <Spinner label="Fetching restaurants from Zomato…" />}
      {state.error && (
        <div className="empty" style={{ padding: "30px 0" }}>
          <div className="t">Couldn't reach Zomato</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}</div>
          <button className="btn btn-ghost" onClick={() => load(true)}>↻ Retry</button>
        </div>
      )}
      {d?.notFound && (
        <div className="empty" style={{ padding: "30px 0" }}>
          <div className="t">Zomato has no {dish.name} page for {cityName(city)}</div>
          <button className="btn btn-zomato" style={{ marginTop: 12 }} onClick={() => openZomatoUrl(d.webUrl)}>Search on Zomato ↗</button>
        </div>
      )}

      {d?.restaurants?.map((r) => (
        <div key={r.resId} className="rest">
          {r.img ? <img src={r.img} alt="" loading="lazy" /> : <div style={{ width: 64, height: 64, borderRadius: 10, background: "#1a1510" }} />}
          <div className="grow">
            <div className="between">
              <div className="ellipsis" style={{ fontWeight: 700 }}>{r.name}</div>
              {r.rating && <span className="rating">{r.rating}★</span>}
            </div>
            <div className="tiny muted ellipsis">{r.cuisines.slice(0, 3).join(", ")}</div>
            <div className="tiny dim ellipsis">{[r.locality, r.distance, r.deliveryTime && `🛵 ${r.deliveryTime}`].filter(Boolean).join(" · ")}</div>
            <div className="between" style={{ marginTop: 6 }}>
              <span className="small" style={{ color: "#f0b0b5" }}>{r.costText || "—"}</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => openZomatoRestaurant(r)}>Menu ↗</button>
                <button className="btn btn-sm btn-zomato" disabled={!r.serviceable} onClick={() => onAdd(r, servings)}>
                  + Add {r.costForOne ? fmt(r.costForOne * servings) : ""}
                </button>
              </span>
            </div>
          </div>
        </div>
      ))}
      {d?.restaurants?.length > 0 && (
        <div className="between tiny dim" style={{ marginTop: 10 }}>
          <span>Prices are Zomato's “for one” estimate — exact menu prices show in Zomato.</span>
          <button className="gold" onClick={() => load(true)}>↻ {d.fromCache ? ageStr(d.fetchedAt) : "refresh"}</button>
        </div>
      )}
    </Sheet>
  );
}
