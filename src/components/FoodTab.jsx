import { useMemo, useState } from "react";
import { Stepper } from "./Sheet.jsx";
import DishSheet from "./DishSheet.jsx";
import GrocerySheet from "./GrocerySheet.jsx";
import {
  APPETITE, COURSES, GROCERIES, GROUPS, MIXERS, groceryNeeds, packsFor, formatAmount, suggestDishes, blinkitQuery,
} from "../lib/food.js";
import { CAT } from "../lib/parse/livcheers.js";
import { fmt } from "../lib/format.js";

// ═══════════════════════════════════════════════════════════════════════════════
//  FOOD CALCULATOR — party inputs → quantities → live-priced food cart
// ═══════════════════════════════════════════════════════════════════════════════
export default function FoodTab({ city, party, setParty, plan, liquorCats, foodCart, addFood, goToCart, toast }) {
  const [dishOpen, setDishOpen] = useState(null);
  const [groceryOpen, setGroceryOpen] = useState(null);
  const set = (k) => (v) => setParty({ ...party, [k]: v });

  const needs = useMemo(() => groceryNeeds(plan), [plan]);
  const neededGroceries = GROCERIES.filter((g) => needs[g.id] > 0);

  const inCart = (key) => foodCart.some((l) => l.key === key);
  // The product shown for a supply: whatever is in the cart, else the first option.
  const chosen = (g) => {
    const line = foodCart.find((l) => l.key === `b:${g.id}`);
    return g.options.find((o) => o.id === line?.product.id) || g.options[0];
  };
  const groceryLine = (g, product, packs) => ({
    key: `b:${g.id}`, kind: "blinkit", groceryId: g.id, name: g.name, emoji: g.emoji, group: g.group,
    product: { id: product.id, name: product.name, packText: product.packText, price: product.price },
    qty: packs, query: blinkitQuery(g, product), ordered: false,
  });

  const fillGroceries = () => {
    for (const g of neededGroceries) {
      const p = chosen(g);
      addFood(groceryLine(g, p, packsFor(needs[g.id], p)));
    }
    toast(`Added ${neededGroceries.length} party supplies to your Blinkit list`);
  };

  const suggestedServings = (dish) => {
    if (dish.course === "starter") return Math.max(1, Math.ceil(plan.starters.plates / 3));
    if (dish.course === "main") return Math.max(1, Math.ceil(plan.mains.servings / 2));
    return Math.max(1, plan.desserts);
  };

  const coverage = plan.needed ? Math.min(1, plan.available / plan.needed) : 1;
  const groceryTotal = neededGroceries.reduce((s, g) => { const p = chosen(g); return s + p.price * packsFor(needs[g.id], p); }, 0);
  const foodCount = foodCart.length;
  const foodTotal = foodCart.reduce((s, l) => s + (l.kind === "zomato" ? l.unitPrice * l.servings : l.product.price * l.qty), 0);

  return (
    <div>
      {/* ── Party details ── */}
      <div className="card">
        <div className="card-title">Party details</div>
        <div className="form-grid">
          <div className="field"><label>Guests</label><Stepper value={party.guests} onChange={set("guests")} min={1} max={500} /></div>
          <div className="field"><label>Hours</label><Stepper value={party.hours} onChange={set("hours")} min={1} max={12} /></div>
          <div className="field">
            <label>Drinking · {party.drinkersPct}%</label>
            <input type="range" min={0} max={100} step={5} value={party.drinkersPct} onChange={(e) => set("drinkersPct")(+e.target.value)} />
          </div>
          <div className="field">
            <label>Vegetarian · {party.vegPct}%</label>
            <input type="range" min={0} max={100} step={5} value={party.vegPct} onChange={(e) => set("vegPct")(+e.target.value)} />
          </div>
          <div className="field">
            <label>Appetite</label>
            <div className="seg">{Object.entries(APPETITE).map(([k, a]) => <button key={k} className={party.appetite === k ? "on" : ""} onClick={() => set("appetite")(k)}>{a.label}</button>)}</div>
          </div>
          <div className="field">
            <label>Peg size</label>
            <div className="seg">{[30, 60].map((ml) => <button key={ml} className={party.pegMl === ml ? "on" : ""} onClick={() => set("pegMl")(ml)}>{ml} ml</button>)}</div>
          </div>
        </div>
        <div className="toggle" style={{ marginTop: 12 }} onClick={() => set("dinner")(!party.dinner)}>
          <div><div>Serving dinner</div><div className="tiny muted">{party.dinner ? "Starters + main course + dessert" : "Snacks-only party"}</div></div>
          <div className={`switch ${party.dinner ? "on" : ""}`} />
        </div>
      </div>

      {/* ── Drinks check ── */}
      <div className="card">
        <div className="card-title">Drinks check <span className="right">{plan.drinkers} drinkers × {plan.perDrinker} drinks</span></div>
        <div className="stat-grid">
          <div className="stat"><div className="v">{plan.needed}</div><div className="l">Drinks needed</div></div>
          <div className="stat"><div className="v" style={{ color: coverage >= 1 ? "var(--green)" : "var(--gold2)" }}>{plan.available}</div><div className="l">In your cart</div></div>
          <div className="stat"><div className="v">{Math.round(coverage * 100)}%</div><div className="l">Covered</div></div>
        </div>
        <div style={{ marginTop: 10 }}>
          {plan.available === 0 ? (
            <div className="warn-box">Your liquor cart is empty — add bottles in the Cabinet tab. Mixers below assume a typical whisky/rum/gin mix.</div>
          ) : plan.shortfall > 0 ? (
            <div className="warn-box">About <b>{plan.shortfall}</b> drinks short — roughly <b>{Math.ceil(plan.shortfall / Math.floor(750 / party.pegMl))}</b> more 750 ml spirit bottle(s) at {party.pegMl} ml pegs.</div>
          ) : (
            <div className="ok-box">You're covered, with ~{plan.available - plan.needed} drinks to spare.</div>
          )}
        </div>
        {plan.available > 0 && (
          <div className="row small muted" style={{ flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {Object.entries(plan.byCat).map(([id, n]) => <span key={id}>{CAT[id].emoji} {CAT[id].label}: <b className="gold">{n}</b></span>)}
          </div>
        )}
      </div>

      {/* ── Bar supplies & snacks (Blinkit) ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="brandbar b">
          <span className="logo-b">blinkit</span>
          <span className="grow">Bar supplies & munchies</span>
          <span className="small">{fmt(groceryTotal)}</span>
        </div>
        <div style={{ padding: "4px 14px 14px" }}>
          {Object.entries(GROUPS).map(([gid, grp]) => {
            const rows = neededGroceries.filter((g) => g.group === gid);
            if (!rows.length) return null;
            return (
              <div key={gid}>
                <div className="tiny muted" style={{ letterSpacing: 2, margin: "10px 0 2px" }}>{grp.label.toUpperCase()}</div>
                {rows.map((g) => {
                  const p = chosen(g);
                  const packs = packsFor(needs[g.id], p);
                  const added = inCart(`b:${g.id}`);
                  return (
                    <div key={g.id} className="line-item" onClick={() => setGroceryOpen(g)} style={{ cursor: "pointer" }}>
                      <div className="emo">{g.emoji}</div>
                      <div className="grow">
                        <div className="between">
                          <span style={{ fontWeight: 700 }}>{g.name}</span>
                          <span className="gold small">{formatAmount(needs[g.id], g.unit)}</span>
                        </div>
                        <div className="tiny muted ellipsis">{p.name} · {p.packText} × {packs}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 58 }}>
                        <div className="small" style={{ fontWeight: 700 }}>{fmt(p.price * packs)}</div>
                        <div className="tiny" style={{ color: added ? "var(--green)" : "var(--dim)" }}>{added ? "✓ in cart" : "change ›"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <button className="btn btn-blinkit btn-block" style={{ marginTop: 12 }} onClick={fillGroceries}>
            ＋ Add all supplies to cart
          </button>
          <div className="tiny dim" style={{ marginTop: 6, textAlign: "center" }}>
            Mixers: {Object.entries(plan.mixerMl).filter(([, v]) => v).map(([k, v]) => `${MIXERS[k].label} ${formatAmount(v, "ml")}`).join(" · ") || "none"} · prices ≈ MRP, exact price on Blinkit
          </div>
        </div>
      </div>

      {/* ── Food (Zomato) ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="brandbar z">
          <span className="logo-z">zomato</span>
          <span className="grow">Food to order</span>
        </div>
        <div style={{ padding: "10px 14px 14px" }}>
          <div className="stat-grid">
            <div className="stat"><div className="v">{plan.starters.plates}</div><div className="l">Starter plates</div><div className="tiny dim">{plan.starters.veg} veg · {plan.starters.nonveg} non-veg</div></div>
            <div className="stat"><div className="v">{plan.mains.servings || "—"}</div><div className="l">Main servings</div><div className="tiny dim">{party.dinner ? `${plan.mains.veg} veg · ${plan.mains.breads} breads` : "no dinner"}</div></div>
            <div className="stat"><div className="v">{plan.desserts}</div><div className="l">Desserts</div><div className="tiny dim">{plan.starters.pieces} pcs starters</div></div>
          </div>

          {Object.entries(COURSES).map(([course, c]) => {
            if (course === "main" && !party.dinner) return null;
            const dishes = suggestDishes(liquorCats, course);
            return (
              <div key={course}>
                <div className="between" style={{ margin: "14px 0 8px" }}>
                  <span className="tiny muted" style={{ letterSpacing: 2 }}>{c.emoji} {c.label.toUpperCase()}</span>
                  {liquorCats.length > 0 && course === "starter" && <span className="tiny gold">🍸 = pairs with your drinks</span>}
                </div>
                <div className="dish-grid">
                  {dishes.map((dsh) => {
                    const added = foodCart.some((l) => l.kind === "zomato" && l.dishId === dsh.id);
                    return (
                      <button key={dsh.id} className={`dish ${added ? "in" : ""}`} onClick={() => setDishOpen(dsh)}>
                        {dsh.score > 0 && <span className="pair">🍸</span>}
                        <div className="e">{dsh.emoji}</div>
                        <div className="n">{dsh.name}</div>
                        <div className="tiny" style={{ marginTop: 3, color: dsh.veg === true ? "#3aa655" : dsh.veg === false ? "#c0392b" : "#b08a30" }}>
                          {dsh.veg === true ? "veg" : dsh.veg === false ? "non-veg" : "veg / non-veg"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {foodCount > 0 && (
        <button className="btn btn-gold btn-block" onClick={goToCart}>
          🛒 Food cart · {foodCount} item{foodCount > 1 ? "s" : ""} · {fmt(foodTotal)} — order now
        </button>
      )}

      {dishOpen && (
        <DishSheet dish={dishOpen} city={city} suggested={suggestedServings(dishOpen)} onClose={() => setDishOpen(null)}
          onAdd={(r, servings) => {
            addFood({
              key: `z:${r.resId}:${dishOpen.id}`, kind: "zomato", dishId: dishOpen.id, name: dishOpen.name, emoji: dishOpen.emoji,
              course: dishOpen.course, veg: dishOpen.veg, servings, unitPrice: r.costForOne || 0,
              restaurant: { resId: r.resId, name: r.name, appLink: r.appLink, orderUrl: r.orderUrl, rating: r.rating, deliveryTime: r.deliveryTime, locality: r.locality, costText: r.costText, img: r.img },
              ordered: false,
            });
            toast(`${dishOpen.name} from ${r.name} added`);
            setDishOpen(null);
          }} />
      )}
      {groceryOpen && (
        <GrocerySheet grocery={groceryOpen} need={needs[groceryOpen.id]} selectedId={chosen(groceryOpen).id} onClose={() => setGroceryOpen(null)}
          onPick={(p, packs) => {
            addFood(groceryLine(groceryOpen, p, packs));
            toast(`${groceryOpen.name} added to Blinkit list`);
            setGroceryOpen(null);
          }} />
      )}
    </div>
  );
}
