import { useEffect, useMemo, useRef, useState } from "react";
import Sheet, { Qty, Skeleton } from "./Sheet.jsx";
import { fetchMenu } from "../lib/sources.js";
import { thumb } from "../lib/parse/zomato.js";
import { openZomatoRestaurant } from "../lib/order.js";
import { fmt } from "../lib/format.js";
import { Icon, VegMark } from "./Art.jsx";

// A restaurant's real Zomato menu. Picking items here puts the exact dishes in
// the food cart, so the Zomato hand-off carries every item and quantity.
// Items carry a price only when Zomato shows one (signed in — Plan → Zomato
// account, beta); everything else is estimated with the "cost for one".
export default function MenuSheet({ restaurant, loc, qtyOf, setQty, onClose, vegOnly: vegDefault = false, zomatoExact = false }) {
  const [state, setState] = useState({ loading: true });
  const [vegOnly, setVegOnly] = useState(vegDefault);
  const [section, setSection] = useState(null);
  const refs = useRef({});

  const load = (force = false) => {
    setState({ loading: true });
    fetchMenu(restaurant, { force, loc })
      // A menu cached before signing in to Zomato still has prices hidden — fetch it again.
      .then((m) => (m.fromCache && m.pricesHidden && zomatoExact ? fetchMenu(restaurant, { force: true, loc }).catch(() => m) : m))
      .then((m) => setState({ data: m })).catch((e) => setState({ error: e.message }));
  };
  useEffect(() => { load(false); }, [restaurant.resId]);

  const m = state.data;
  const menus = useMemo(() => (m?.menus || []).map((s) => ({ ...s, items: vegOnly ? s.items.filter((i) => i.veg === true) : s.items })).filter((s) => s.items.length), [m, vegOnly]);
  const unit = restaurant.costForOne || 0;
  // Footer total: exact menu prices where Zomato gave them, the cost-for-one estimate otherwise.
  let count = 0, total = 0, estimated = false;
  const seen = new Set();
  for (const s of m?.menus || []) for (const it of s.items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    const q = qtyOf(it.id);
    if (!q) continue;
    count += q;
    total += (it.price || unit) * q;
    if (!it.price) estimated = true;
  }

  return (
    <Sheet bare onClose={onClose}
      footer={
        <div className="row" style={{ gap: 10 }}>
          <div className="grow">
            <div className="h3">{count ? `${count} item${count > 1 ? "s" : ""} in cart` : "Pick dishes"}</div>
            <div className="tiny muted">
              {!count ? "Tap ADD on anything you like" : !total ? "Price shown at checkout in Zomato" : estimated ? `≈ ${fmt(total)} · estimate` : `${fmt(total)} · Zomato menu prices`}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => openZomatoRestaurant(restaurant)}>Zomato <Icon.external size={14} /></button>
          <button className="btn btn-zomato" onClick={onClose}>{count ? "Done" : "Close"}</button>
        </div>
      }>
      <div className="banner">
        {(m?.img || restaurant.img) && <img src={m?.img || restaurant.img} alt="" />}
        <button className="xbtn" onClick={onClose} style={{ position: "absolute", top: 12, right: 14, zIndex: 2, background: "rgba(20,12,10,.6)" }} aria-label="Close"><Icon.close size={18} /></button>
        <div className="cap">
          <div className="row" style={{ gap: 8 }}>
            <span className="logo logo-z">zomato</span>
            {(m?.rating || restaurant.rating) && <span className="rating">{m?.rating || restaurant.rating} ★</span>}
            {m?.reviews && <span className="tiny" style={{ color: "rgba(255,255,255,.8)" }}>{m.reviews} reviews</span>}
          </div>
          <div className="h1" style={{ fontSize: 25, marginTop: 6, textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>{restaurant.name}</div>
        </div>
      </div>

      <div className="small muted">{m?.cuisines || restaurant.cuisines?.join(", ")}</div>
      <div className="row wrap small" style={{ gap: 12, marginTop: 6, color: "var(--soft)" }}>
        {(m?.locality || restaurant.locality) && <span className="row" style={{ gap: 4 }}><Icon.pin size={14} /> {m?.locality || restaurant.locality}</span>}
        {restaurant.deliveryTime && <span className="row" style={{ gap: 4 }}><Icon.clock size={14} /> {restaurant.deliveryTime}</span>}
        {restaurant.costText && <span>{restaurant.costText}</span>}
      </div>
      {m?.timing && <div className="tiny dim" style={{ marginTop: 4 }}>Open {m.timing}</div>}

      {state.loading && <div style={{ marginTop: 16 }}><Skeleton h={100} n={4} /></div>}
      {state.error && (
        <div className="empty">
          <div className="t">Couldn't load the menu</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}</div>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-ghost" onClick={() => load(true)}>↻ Retry</button>
            <button className="btn btn-zomato" onClick={() => openZomatoRestaurant(restaurant)}>Open in Zomato</button>
          </div>
        </div>
      )}

      {m && (
        <>
          <div className="toggle" style={{ marginTop: 14 }} onClick={() => setVegOnly(!vegOnly)}>
            <span className="row"><VegMark veg /> Veg only</span>
            <span className={`switch ${vegOnly ? "on" : ""}`} />
          </div>
          <div className="chips" style={{ marginTop: 12, position: "sticky", top: -4, zIndex: 3, background: "linear-gradient(#1b1114 70%, transparent)", paddingTop: 8 }}>
            {menus.map((s) => (
              <button key={s.id} className={`chip ${section === s.id ? "on" : ""}`}
                onClick={() => { setSection(s.id); refs.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                {s.name} <span className="count">{s.items.length}</span>
              </button>
            ))}
          </div>
          {menus.map((s) => (
            <div key={s.id} ref={(el) => (refs.current[s.id] = el)} style={{ scrollMarginTop: 60 }}>
              <div className="kicker" style={{ margin: "18px 0 2px" }}>{s.name}</div>
              {s.items.map((it) => {
                const q = qtyOf(it.id);
                return (
                  <div key={`${s.id}:${it.id}`} className="menu-item">
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}>
                        <VegMark veg={it.veg} />
                        {it.top && <span className="pill" style={{ background: "rgba(245,192,74,.15)", color: "#f5c04a" }}>★ Highly rated</span>}
                        {it.spicy && <span className="tiny" title="Spicy">🌶️</span>}
                      </div>
                      <div className="h3" style={{ marginTop: 5, lineHeight: 1.25 }}>{it.name}</div>
                      {it.price ? <div className="data-price">{fmt(it.price)}</div> : null}
                      {it.desc && <div className="tiny muted clamp2" style={{ marginTop: 5, lineHeight: 1.5 }}>{it.desc}</div>}
                    </div>
                    <div className="pic">
                      {it.img ? <img src={thumb(it.img, 220)} alt="" loading="lazy" /> : <div className="noimg" style={{ display: "grid", placeItems: "center", fontSize: 30 }}>🍽️</div>}
                      <div className="addwrap">
                        {q > 0
                          ? <Qty value={q} onChange={(v) => setQty(it, v, s.name)} />
                          : <button className="addbtn" onClick={() => setQty(it, 1, s.name)}>ADD</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {m.pricesHidden && (
            <div className="note note-info" style={{ marginTop: 16 }}>
              Zomato shows item prices only inside its app, so the planner estimates with this restaurant's "{restaurant.costText || "cost for one"}". You'll see exact prices when you check out.
              <div className="data-hint">
                {zomatoExact
                  ? "Your Zomato sign-in seems to have expired — sign in again under Plan → Zomato account (beta)."
                  : "Tip: sign in to Zomato in the Plan tab (beta) to see exact prices here."}
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
