import { useEffect, useMemo, useState } from "react";
import { Stepper, Qty } from "./Sheet.jsx";
import DishSheet from "./DishSheet.jsx";
import MenuSheet from "./MenuSheet.jsx";
import GrocerySheet from "./GrocerySheet.jsx";
import DryDayBanner from "./DryDayBanner.jsx";
import { todayISO } from "../lib/drydays.js";
import {
  APPETITE, COURSES, GROCERIES, GROUPS, MIXERS, BISTRO_ITEMS, groceryNeeds, packsFor, formatAmount, suggestDishes, blinkitQuery,
} from "../lib/food.js";
import { CAT, cityName } from "../lib/parse/livcheers.js";
import { bistroServes } from "../lib/location.js";
import { dishPhotos } from "../lib/sources.js";
import { openBistro, tap } from "../lib/order.js";
import { fmt } from "../lib/format.js";
import { Icon, Ring, VegMark } from "./Art.jsx";

const DISH_TINT = { starter: ["#b8452a", "#3a130c"], main: ["#b07a1c", "#3a2608"], dessert: ["#b03a6e", "#3a0c22"] };
const slimRest = (r) => ({ resId: r.resId, name: r.name, appLink: r.appLink, orderUrl: r.orderUrl, rating: r.rating, deliveryTime: r.deliveryTime, locality: r.locality, costText: r.costText, costForOne: r.costForOne, img: r.img, distance: r.distance, cuisines: r.cuisines });

export default function FoodTab({ city, loc, locating, onLocate, party, setParty, plan, liquorCats, foodCart, upsertFood, removeFood, goToCart, toast, customDry, zomatoExact }) {
  const [provider, setProvider] = useState("zomato");
  const [course, setCourse] = useState("starter");
  const [dishOpen, setDishOpen] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null); // { r, dish }
  const [groceryOpen, setGroceryOpen] = useState(null);
  const [photos, setPhotos] = useState({});
  const set = (k) => (v) => setParty({ ...party, [k]: v });

  const refreshPhotos = () => dishPhotos(suggestDishes([])).then(setPhotos);
  useEffect(() => { refreshPhotos(); }, []);

  const needs = useMemo(() => groceryNeeds(plan), [plan]);
  const neededGroceries = GROCERIES.filter((g) => needs[g.id] > 0);
  const lineOf = (key) => foodCart.find((l) => l.key === key);
  // A live Blinkit pick (GrocerySheet) isn't one of g.options, so the cart line's product is the choice.
  const chosen = (g) => {
    const cur = lineOf(`b:${g.id}`)?.product;
    return g.options.find((o) => o.id === cur?.id) || (cur?.live ? cur : g.options[0]);
  };
  const groceryLine = (g, p, qty) => ({
    key: `b:${g.id}`, kind: "blinkit", groceryId: g.id, name: g.name, emoji: g.emoji, group: g.group,
    product: { id: p.id, name: p.name, packText: p.packText, price: p.price, pack: p.pack, ...(p.live ? { live: true, blinkit: p.blinkit } : {}) },
    qty, query: blinkitQuery(g, p), ordered: false,
  });
  // Once supplies are in the cart, a changed plan (more guests, a cocktail on the menu) leaves
  // some lines missing or short: only those get updated, so ticked-off lines stay ticked.
  const suppliesInCart = neededGroceries.some((g) => lineOf(`b:${g.id}`));
  const staleGroceries = neededGroceries.filter((g) => lineOf(`b:${g.id}`)?.qty !== packsFor(needs[g.id], chosen(g)));
  const fillGroceries = () => {
    const todo = suppliesInCart ? staleGroceries : neededGroceries;
    for (const g of todo) { const p = chosen(g); upsertFood(groceryLine(g, p, packsFor(needs[g.id], p))); }
    tap();
    toast(!todo.length ? "Your Blinkit list is up to date" : suppliesInCart ? `Updated ${todo.length} ${todo.length === 1 ? "supply" : "supplies"} on your Blinkit list` : `Added ${todo.length} party supplies to your Blinkit list`);
  };
  const groceryTotal = neededGroceries.reduce((s, g) => { const p = chosen(g); return s + p.price * packsFor(needs[g.id], p); }, 0);

  // Zomato cart helpers
  const restCount = (resId) => foodCart.filter((l) => l.kind === "zomato" && l.restaurant.resId === resId).reduce((s, l) => s + l.qty, 0);
  const dishCount = (dishId) => foodCart.filter((l) => l.kind === "zomato" && l.dishId === dishId).reduce((s, l) => s + l.qty, 0);
  const setMenuQty = (r, dish, item, qty, section) => {
    const key = `z:${r.resId}:${item.id}`;
    if (qty <= 0) return removeFood(key);
    tap();
    // Exact menu price when Zomato showed one (signed in, beta), else the restaurant's cost-for-one estimate.
    upsertFood({
      key, kind: "zomato", itemId: item.id, name: item.name, img: item.img, veg: item.veg, qty,
      unitPrice: item.price || r.costForOne || 0, exact: !!item.price, course: dish.course, section, dishId: dish.id, emoji: dish.emoji, restaurant: slimRest(r), ordered: false,
    });
  };
  const quickAdd = (r, dish, servings) => {
    upsertFood({
      key: `z:${r.resId}:dish-${dish.id}`, kind: "zomato", itemId: `dish-${dish.id}`, name: dish.name, img: r.img, veg: dish.veg === true ? true : dish.veg === false ? false : null,
      qty: servings, unitPrice: r.costForOne || 0, course: dish.course, dishId: dish.id, emoji: dish.emoji, restaurant: slimRest(r), ordered: false,
    });
    tap();
    toast(`${servings} × ${dish.name} from ${r.name} added`);
  };
  const suggestedServings = (dish) =>
    dish.course === "starter" ? Math.max(1, Math.ceil(plan.starters.plates / 3)) : dish.course === "main" ? Math.max(1, Math.ceil(plan.mains.servings / 2)) : Math.max(1, plan.desserts);

  // Bistro
  const bistroHere = bistroServes(loc?.citySlug || city);
  const bistroQty = (id) => lineOf(`s:${id}`)?.qty || 0;
  const setBistro = (it, qty) => {
    const key = `s:${it.id}`;
    if (qty <= 0) return removeFood(key);
    tap();
    upsertFood({ key, kind: "bistro", itemId: it.id, name: it.name, emoji: it.emoji, veg: it.veg, qty, ordered: false });
  };

  const coverage = plan.needed ? Math.min(1, plan.available / plan.needed) : 0;
  const foodItems = foodCart.length;
  const foodTotal = foodCart.reduce((s, l) => s + (l.kind === "zomato" ? l.unitPrice * l.qty : l.kind === "blinkit" ? l.product.price * l.qty : 0), 0);
  const pctStyle = (v) => ({ "--p": `${v}%` });

  return (
    <div>
      <div className="section-head" style={{ marginTop: 14 }}>
        <div><div className="kicker">Food · mixers · ice</div><div className="h1" style={{ fontSize: 28 }}>Plan the <em>spread</em></div></div>
      </div>

      {/* ── Location ── */}
      <div className="card fade-up" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-btn gold" style={{ width: 44, height: 44 }}><Icon.pin size={20} /></div>
          <div className="grow">
            {loc ? (
              <>
                <div className="tiny muted">Delivering to</div>
                <div className="h3 ellipsis">{loc.label || cityName(loc.citySlug)}</div>
                <div className="tiny dim">{loc.zomato ? `Zomato · ${loc.zomato.cityName}` : "GPS location"}{bistroServes(loc.citySlug) ? " · Bistro area" : ""}</div>
              </>
            ) : (
              <>
                <div className="h3">Use your location</div>
                <div className="tiny muted">Restaurants that actually deliver to you, with real distances</div>
              </>
            )}
          </div>
          <button className="btn btn-sm btn-ghost" disabled={locating} onClick={onLocate}>
            {locating ? <span className="spin">◌</span> : <Icon.locate size={16} />} {loc ? "Update" : "Locate"}
          </button>
        </div>
      </div>

      {/* ── Party ── */}
      <div className="card fade-up">
        <div className="card-title"><span className="kicker">{party.date === todayISO() ? "Tonight's party" : "The party"}</span><span className="tiny muted">{plan.drinkers} drinking · {Math.round(party.vegPct)}% veg</span></div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Party name</label>
          <input className="input" value={party.name || ""} maxLength={60} placeholder="House party" aria-label="Party name" onChange={(e) => set("name")(e.target.value)} />
        </div>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          {/* An emptied date/time is ignored: dry days, reminders and the invite all need one. */}
          <div className="field"><label>Date</label><input type="date" className="input bar-date" aria-label="Party date" value={party.date || ""} min={todayISO()} onChange={(e) => e.target.value && set("date")(e.target.value)} /></div>
          <div className="field"><label>Time</label><input type="time" className="input bar-date" aria-label="Party time" value={party.time || ""} onChange={(e) => e.target.value && set("time")(e.target.value)} /></div>
        </div>
        <DryDayBanner date={party.date} city={city} customDry={customDry} style={{ marginBottom: 14 }} />
        <div className="form-grid">
          <div className="field"><label>Guests</label><Stepper value={party.guests} onChange={set("guests")} min={1} max={500} /></div>
          <div className="field"><label>Hours</label><Stepper value={party.hours} onChange={set("hours")} min={1} max={12} /></div>
          <div className="field">
            <label>Drinking · {party.drinkersPct}%</label>
            <input type="range" min={0} max={100} step={5} value={party.drinkersPct} style={pctStyle(party.drinkersPct)} onChange={(e) => set("drinkersPct")(+e.target.value)} />
          </div>
          <div className="field">
            <label>Vegetarian · {party.vegPct}%</label>
            <input type="range" min={0} max={100} step={5} value={party.vegPct} style={pctStyle(party.vegPct)} onChange={(e) => set("vegPct")(+e.target.value)} />
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
        <button className="toggle" style={{ marginTop: 14 }} onClick={() => set("dinner")(!party.dinner)}>
          <span><span className="h3">Serving dinner</span><br /><span className="tiny muted">{party.dinner ? "Starters, mains & dessert" : "Snacks-only party"}</span></span>
          <span className={`switch ${party.dinner ? "on" : ""}`} />
        </button>
      </div>

      {/* ── Drinks gauge ── */}
      <div className="card fade-up">
        <div className="gauge-row">
          <Ring value={coverage} size={104} label={plan.available ? `${Math.round(coverage * 100)}%` : "—"} sub="COVERED" color={coverage >= 1 ? "#34d98f" : undefined} />
          <div className="grow">
            <div className="kicker">Drinks check</div>
            <div className="h2" style={{ marginTop: 4 }}>{plan.available} <span className="muted" style={{ fontSize: 15 }}>of {plan.needed} drinks</span></div>
            <div className="tiny muted" style={{ marginTop: 4 }}>{plan.drinkers} drinkers × {plan.perDrinker} drinks over {plan.hours} h</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {plan.available === 0 ? (
            <div className="note note-warn">Your cabinet is empty — add bottles first. Mixers below assume a typical whisky / rum / gin night.</div>
          ) : plan.shortfall > 0 ? (
            <div className="note note-warn">About <b>{plan.shortfall}</b> drinks short — roughly <b>{Math.ceil(plan.shortfall / Math.floor(750 / party.pegMl))}</b> more 750 ml bottle(s) at {party.pegMl} ml pegs.</div>
          ) : (
            <div className="note note-ok">You're covered, with ~{plan.available - plan.needed} drinks to spare. 🥂</div>
          )}
        </div>
        {plan.available > 0 && (
          <div className="chips" style={{ marginTop: 10, marginBottom: -8 }}>
            {Object.entries(plan.byCat).map(([id, n]) => <span key={id} className="chip">{CAT[id].emoji} {CAT[id].label} <b className="gold">{n}</b></span>)}
          </div>
        )}
      </div>

      {/* ── Order food ── */}
      <div className="section-head"><div><div className="kicker">Order food</div><div className="h2">Starters to dessert</div></div></div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={provider === "zomato" ? "on" : ""} onClick={() => setProvider("zomato")}>🍽️ Zomato restaurants</button>
        <button className={provider === "bistro" ? "on" : ""} onClick={() => setProvider("bistro")}>⚡ Bistro · 10 min</button>
      </div>

      {provider === "zomato" && (
        <div className="card flush fade-up">
          <div className="provider-head provider-z">
            <span className="logo logo-z">zomato</span>
            <span className="grow small muted">Live restaurants{loc?.zomato ? " near you" : ` in ${cityName(city)}`}</span>
          </div>
          <div className="provider-body">
            <div className="hero-stats" style={{ marginTop: 0, marginBottom: 14 }}>
              <div className="stat"><div className="v">{plan.starters.plates}</div><div className="l">Starter plates</div></div>
              <div className="stat"><div className="v">{plan.mains.servings || "—"}</div><div className="l">Main servings</div></div>
              <div className="stat"><div className="v">{plan.desserts}</div><div className="l">Desserts</div></div>
            </div>
            <div className="seg" style={{ marginBottom: 12 }}>
              {Object.entries(COURSES).filter(([k]) => party.dinner || k !== "main").map(([k, c]) => (
                <button key={k} className={course === k ? "on" : ""} onClick={() => setCourse(k)}>{c.emoji} {c.label}</button>
              ))}
            </div>
            <div className="dish-grid">
              {suggestDishes(liquorCats, course).map((dsh, i) => {
                const n = dishCount(dsh.id), [c1, c2] = DISH_TINT[dsh.course];
                return (
                  <button key={dsh.id} className={`dish fade-up ${n ? "in" : ""}`} style={{ animationDelay: `${i * 25}ms`, background: `linear-gradient(160deg, ${c1}, ${c2})` }} onClick={() => setDishOpen(dsh)}>
                    {photos[dsh.id] ? <img src={photos[dsh.id]} alt="" loading="lazy" /> : <span className="e">{dsh.emoji}</span>}
                    {dsh.score > 0 && <span className="pair pill pill-glass">🍸</span>}
                    {n > 0 && <span className="in-badge pill" style={{ background: "var(--zomato)", color: "#fff" }}>{n}</span>}
                    <span className="n">{dsh.name}</span>
                    <span className="v row" style={{ gap: 4 }}>{dsh.veg === "both" ? <><VegMark veg /><VegMark veg={false} /></> : <VegMark veg={dsh.veg} />}</span>
                  </button>
                );
              })}
            </div>
            {liquorCats.length > 0 && <div className="tiny muted" style={{ marginTop: 10 }}>🍸 pairs with the bottles in your cabinet</div>}
          </div>
        </div>
      )}

      {provider === "bistro" && (
        <div className="card flush fade-up">
          <div className="provider-head provider-s">
            <span className="logo logo-s">bistro</span>
            <span className="grow small muted">Blinkit's 10-minute kitchen</span>
            <button className="btn btn-xs btn-bistro" onClick={openBistro}>Open app <Icon.external size={12} /></button>
          </div>
          <div className="provider-body">
            <div className={`note ${bistroHere ? "note-ok" : "note-warn"}`} style={{ marginBottom: 12 }}>
              {bistroHere
                ? <>Bistro delivers in parts of {cityName(loc?.citySlug || city)} — snacks & meals in about 10 minutes. The app confirms your exact address.</>
                : <>Bistro only runs in parts of Gurugram, Delhi-NCR, Noida and Bengaluru so far{loc ? ` — not near ${loc.label || cityName(loc.citySlug)} yet` : ""}. You can still plan with it.</>}
            </div>
            {BISTRO_ITEMS.map((it) => {
              const q = bistroQty(it.id);
              return (
                <div key={it.id} className="line-item">
                  <div className="emo" style={{ background: "rgba(255,122,26,.14)" }}>{it.emoji}</div>
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>{it.veg === "both" ? <><VegMark veg /><VegMark veg={false} /></> : <VegMark veg={it.veg} />}<span className="h3">{it.name}</span></div>
                    <div className="tiny muted">Price in Bistro app</div>
                  </div>
                  {q > 0 ? <Qty value={q} onChange={(v) => setBistro(it, v)} color="var(--bistro)" />
                    : <button className="btn btn-xs btn-bistro" onClick={() => setBistro(it, Math.max(1, Math.ceil(plan.guests / 2)))}><Icon.plus size={12} /> Add</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Blinkit supplies ── */}
      <div className="section-head"><div><div className="kicker">Bar supplies</div><div className="h2">Mixers, ice & munchies</div></div><b className="gold-text">{fmt(groceryTotal)}</b></div>
      <div className="card flush fade-up">
        <div className="provider-head provider-b">
          <span className="logo logo-b">blinkit</span>
          <span className="grow small muted">Delivered in minutes</span>
        </div>
        <div className="provider-body">
          {Object.entries(GROUPS).map(([gid, grp]) => {
            const rows = neededGroceries.filter((g) => g.group === gid);
            if (!rows.length) return null;
            return (
              <div key={gid}>
                <div className="kicker" style={{ margin: "12px 0 2px", fontSize: 9.5 }}>{grp.label}</div>
                {rows.map((g) => {
                  const p = chosen(g), packs = packsFor(needs[g.id], p), added = !!lineOf(`b:${g.id}`);
                  return (
                    <div key={g.id} className="line-item" onClick={() => setGroceryOpen(g)} style={{ cursor: "pointer" }}>
                      <div className="emo" style={{ background: "rgba(248,203,70,.1)" }}>{g.emoji}</div>
                      <div className="grow">
                        <div className="between"><span className="h3">{g.name}</span><span className="small gold">{formatAmount(needs[g.id], g.unit)}</span></div>
                        <div className="tiny muted ellipsis">{p.live && <span className="nat-live">live · </span>}{p.name} · {p.packText} × {packs}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 60 }}>
                        <div className="small b">{fmt(p.price * packs)}</div>
                        {added && lineOf(`b:${g.id}`).qty !== packs
                          ? <div className="tiny gold">×{lineOf(`b:${g.id}`).qty} in cart · update</div>
                          : <div className="tiny" style={{ color: added ? "var(--green)" : "var(--dim)" }}>{added ? "✓ in cart" : "change ›"}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <button className="btn btn-blinkit btn-block" style={{ marginTop: 14 }} onClick={fillGroceries}>{!suppliesInCart ? <><Icon.plus size={16} /> Add all supplies to cart</> : staleGroceries.length ? <>Update cart · {staleGroceries.length} changed</> : <><Icon.check size={16} /> All supplies in your cart</>}</button>
          <div className="tiny dim" style={{ marginTop: 8, textAlign: "center" }}>
            {Object.keys(MIXERS).filter((k) => needs[k] > 0).map((k) => `${MIXERS[k].label} ${formatAmount(needs[k], "ml")}`).join(" · ") || "No mixers needed"} · prices ≈ MRP{neededGroceries.some((g) => chosen(g).live) ? ", live where marked" : ""}
          </div>
        </div>
      </div>

      {foodItems > 0 && !dishOpen && !menuOpen && !groceryOpen && (
        <button className="minicart" onClick={goToCart}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span className="grow" style={{ textAlign: "left" }}>
            <span className="h3">{foodItems} item{foodItems > 1 ? "s" : ""} ready to order</span><br />
            <span className="tiny muted">≈ {fmt(foodTotal)} · Zomato, Bistro & Blinkit</span>
          </span>
          <span className="btn btn-gold btn-sm">Checkout <Icon.chevron size={14} /></span>
        </button>
      )}

      {dishOpen && (
        <DishSheet dish={dishOpen} city={city} loc={loc} suggested={suggestedServings(dishOpen)} inCart={restCount}
          onClose={() => { setDishOpen(null); refreshPhotos(); }}
          onQuickAdd={(r, n) => quickAdd(r, dishOpen, n)}
          onOpenMenu={(r) => setMenuOpen({ r, dish: dishOpen })} />
      )}
      {menuOpen && (
        <MenuSheet restaurant={menuOpen.r} loc={loc} vegOnly={party.vegPct >= 100} zomatoExact={zomatoExact}
          qtyOf={(itemId) => lineOf(`z:${menuOpen.r.resId}:${itemId}`)?.qty || 0}
          setQty={(item, q, section) => setMenuQty(menuOpen.r, menuOpen.dish, item, q, section)}
          onPriced={(items) => {
            for (const it of items) {
              const key = `z:${menuOpen.r.resId}:${it.id}`, l = lineOf(key);
              if (l && (!l.exact || l.unitPrice !== it.price)) upsertFood({ key, unitPrice: it.price, exact: true });
            }
          }}
          onClose={() => setMenuOpen(null)} />
      )}
      {groceryOpen && (
        <GrocerySheet grocery={groceryOpen} need={needs[groceryOpen.id]} selectedId={chosen(groceryOpen).id} onClose={() => setGroceryOpen(null)}
          onPick={(p, packs) => { upsertFood(groceryLine(groceryOpen, p, packs)); tap(); toast(`${groceryOpen.name} added to Blinkit list`); setGroceryOpen(null); }} />
      )}
    </div>
  );
}
