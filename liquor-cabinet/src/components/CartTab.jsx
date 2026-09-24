import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, cityName } from "../lib/parse/livcheers.js";
import { COURSES, GROUPS } from "../lib/food.js";
import { fmt } from "../lib/format.js";
import { openBlinkitSearch, openZomatoRestaurant, openUrl, shareText, copyText, isInstalled, BLINKIT, ZOMATO } from "../lib/order.js";

export default function CartTab({
  city, view, setView, liquorLines, liquorTotal, addItem, remItem, clearLiquor, batches, activeBatch,
  foodCart, updateFood, removeFood, clearFood, toast,
}) {
  const [apps, setApps] = useState({});
  useEffect(() => {
    Promise.all([isInstalled(ZOMATO), isInstalled(BLINKIT)]).then(([z, b]) => setApps({ zomato: z, blinkit: b }));
  }, []);

  // ── Liquor ──
  const liquorText = () => {
    const lines = [`🥃 Liquor Cabinet — ${cityName(city)}`, ""];
    for (const c of CATEGORIES) {
      const ls = liquorLines.filter((l) => l.cat === c.id);
      if (!ls.length) continue;
      lines.push(`${c.emoji} ${c.label}`);
      ls.forEach((l) => lines.push(`  ${l.qty} × ${l.item.name} (${l.item.vol}) — ${fmt(l.item.price * l.qty)}`));
    }
    lines.push("", `Total: ${fmt(liquorTotal)} (Livcheers indicative prices)`);
    return lines.join("\n");
  };

  // ── Food ──
  const zomatoGroups = useMemo(() => {
    const m = new Map();
    for (const l of foodCart.filter((x) => x.kind === "zomato")) {
      const k = l.restaurant.resId;
      if (!m.has(k)) m.set(k, { restaurant: l.restaurant, lines: [] });
      m.get(k).lines.push(l);
    }
    return [...m.values()];
  }, [foodCart]);
  const blinkitLines = foodCart.filter((x) => x.kind === "blinkit");
  const blinkitTotal = blinkitLines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const zomatoTotal = foodCart.filter((x) => x.kind === "zomato").reduce((s, l) => s + l.unitPrice * l.servings, 0);

  const blinkitText = () => [
    `🛒 Party supplies — ${cityName(city)}`, "",
    ...blinkitLines.map((l) => `☐ ${l.qty} × ${l.product.name} (${l.product.packText})`),
    "", `≈ ${fmt(blinkitTotal)}`,
  ].join("\n");

  const zomatoText = () => [
    `🍽️ Food order — ${cityName(city)}`, "",
    ...zomatoGroups.flatMap((g) => [`${g.restaurant.name}:`, ...g.lines.map((l) => `  ${l.servings} × ${l.name}`)]),
    "", `≈ ${fmt(zomatoTotal)}`,
  ].join("\n");

  const markGroup = (lines, ordered) => lines.forEach((l) => updateFood(l.key, { ordered }));

  const orderZomato = async (g) => {
    await copyText(g.lines.map((l) => `${l.servings} × ${l.name}`).join(", "));
    toast(`Opening ${g.restaurant.name} on Zomato — order copied to clipboard`);
    openZomatoRestaurant(g.restaurant);
  };

  const share = async (title, text) => {
    const r = await shareText(title, text);
    if (r === "copied") toast("List copied to clipboard");
  };

  const liqCount = liquorLines.reduce((s, l) => s + l.qty, 0);

  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={view === "liquor" ? "on" : ""} onClick={() => setView("liquor")}>🥃 Liquor · {liqCount}</button>
        <button className={view === "food" ? "on" : ""} onClick={() => setView("food")}>🍽️ Food & supplies · {foodCart.length}</button>
      </div>

      {view === "liquor" && (
        liquorLines.length === 0 ? (
          <div className="empty"><div className="big">🥃</div><div className="t">Your liquor cart is empty</div><div className="small">Add bottles from the Cabinet tab.</div></div>
        ) : (
          <>
            {CATEGORIES.filter((c) => liquorLines.some((l) => l.cat === c.id)).map((c) => {
              const ls = liquorLines.filter((l) => l.cat === c.id);
              const tot = ls.reduce((s, l) => s + l.item.price * l.qty, 0);
              return (
                <div key={c.id} className="card" style={{ padding: "10px 12px" }}>
                  <div className="between tiny" style={{ color: c.color, letterSpacing: 2, borderBottom: `1px solid ${c.color}25`, paddingBottom: 5, marginBottom: 4 }}>
                    <span>{c.emoji} {c.label.toUpperCase()}</span><span>{fmt(tot)}</span>
                  </div>
                  {ls.map((l) => (
                    <div key={l.key} className="line-item">
                      {l.item.img ? <img className="thumb contain" src={l.item.img} alt="" loading="lazy" /> : <div className="emo">{c.emoji}</div>}
                      <div className="grow" onClick={() => openUrl(l.item.url)}>
                        <div className="small ellipsis" style={{ fontWeight: 700 }}>{l.item.name}</div>
                        <div className="tiny muted">{l.item.vol} · {fmt(l.item.price)} {l.stale && <span className="gold">· price from earlier sync</span>}</div>
                      </div>
                      <div className="qty">
                        <button onClick={() => remItem(l.cat, l.item)}>−</button>
                        <span className="n" style={{ color: c.color }}>{l.qty}</span>
                        <button className="plus" style={{ background: c.color, borderColor: c.color }} onClick={() => addItem(l.cat, l.item)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="card">
              <div className="between"><span className="muted">Total ({liqCount} bottles)</span><span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold2)" }}>{fmt(liquorTotal)}</span></div>
              <div className="tiny dim" style={{ marginTop: 4 }}>Livcheers indicative store prices for {cityName(city)}. Liquor isn't sold on Blinkit/Zomato — buy at your local store.</div>
              <div className="sep" />
              <div className="between small"><span className="muted">Active batch</span><span>{batches[activeBatch]?.name} · {Object.values(batches[activeBatch]?.items || {}).reduce((s, q) => s + q, 0)} bottles</span></div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-gold grow" onClick={() => share("Liquor list", liquorText())}>↗ Share list</button>
                <button className="btn btn-ghost" onClick={() => { if (confirm("Clear the liquor cart?")) clearLiquor(); }}>Clear</button>
              </div>
            </div>
          </>
        )
      )}

      {view === "food" && (
        foodCart.length === 0 ? (
          <div className="empty"><div className="big">🍽️</div><div className="t">No food or supplies yet</div><div className="small">Use the Food tab to calculate what you need.</div></div>
        ) : (
          <>
            {/* Zomato — one order per restaurant */}
            {zomatoGroups.map((g) => {
              const tot = g.lines.reduce((s, l) => s + l.unitPrice * l.servings, 0);
              const allDone = g.lines.every((l) => l.ordered);
              return (
                <div key={g.restaurant.resId} className={`order-group ${allDone ? "done" : ""}`}>
                  <div className="brandbar z">
                    <span className="logo-z">zomato</span>
                    <span className="grow ellipsis">{g.restaurant.name}</span>
                    {g.restaurant.rating && <span className="rating">{g.restaurant.rating}★</span>}
                  </div>
                  <div className="body">
                    <div className="tiny muted" style={{ marginTop: 6 }}>{[g.restaurant.locality, g.restaurant.deliveryTime && `🛵 ${g.restaurant.deliveryTime}`, g.restaurant.costText].filter(Boolean).join(" · ")}</div>
                    {g.lines.map((l) => (
                      <div key={l.key} className="line-item">
                        <div className="emo">{l.emoji}</div>
                        <div className="grow">
                          <div className="small" style={{ fontWeight: 700 }}>{l.name}</div>
                          <div className="tiny muted">{COURSES[l.course]?.label} · ≈ {fmt(l.unitPrice)} × {l.servings}</div>
                        </div>
                        <div className="qty">
                          <button onClick={() => (l.servings <= 1 ? removeFood(l.key) : updateFood(l.key, { servings: l.servings - 1 }))}>−</button>
                          <span className="n" style={{ color: "#f07080" }}>{l.servings}</span>
                          <button className="plus" style={{ background: "var(--zomato)", borderColor: "var(--zomato)", color: "#fff" }} onClick={() => updateFood(l.key, { servings: l.servings + 1 })}>+</button>
                        </div>
                      </div>
                    ))}
                    <div className="between" style={{ marginTop: 8 }}>
                      <span className="row small" onClick={() => markGroup(g.lines, !allDone)} style={{ cursor: "pointer" }}>
                        <span className={`check ${allDone ? "on" : ""}`}>{allDone ? "✓" : ""}</span> Ordered
                      </span>
                      <span style={{ fontWeight: 700 }}>≈ {fmt(tot)}</span>
                    </div>
                    <button className="btn btn-zomato btn-block" style={{ marginTop: 10 }} onClick={() => orderZomato(g)}>
                      Order on Zomato {apps.zomato ? "(app)" : ""} ↗
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Blinkit — one list */}
            {blinkitLines.length > 0 && (
              <div className="order-group">
                <div className="brandbar b">
                  <span className="logo-b">blinkit</span>
                  <span className="grow">Party supplies</span>
                  <span className="small">{blinkitLines.filter((l) => l.ordered).length}/{blinkitLines.length} done</span>
                </div>
                <div className="body">
                  {Object.entries(GROUPS).map(([gid]) => blinkitLines.filter((l) => l.group === gid).map((l) => (
                    <div key={l.key} className={`line-item ${l.ordered ? "done" : ""}`}>
                      <span className={`check ${l.ordered ? "on" : ""}`} onClick={() => updateFood(l.key, { ordered: !l.ordered })}>{l.ordered ? "✓" : ""}</span>
                      {l.product.img ? <img className="thumb contain" src={l.product.img} alt="" loading="lazy" /> : <div className="emo">{l.emoji}</div>}
                      <div className="grow">
                        <div className="small ellipsis" style={{ fontWeight: 700 }}>{l.product.name}</div>
                        <div className="tiny muted">{l.product.packText} · {fmt(l.product.price)} × {l.qty} = {fmt(l.product.price * l.qty)}</div>
                        <div className="row" style={{ marginTop: 5, gap: 6 }}>
                          <div className="qty">
                            <button style={{ width: 24, height: 24 }} onClick={() => (l.qty <= 1 ? removeFood(l.key) : updateFood(l.key, { qty: l.qty - 1 }))}>−</button>
                            <span className="n small">{l.qty}</span>
                            <button style={{ width: 24, height: 24 }} onClick={() => updateFood(l.key, { qty: l.qty + 1 })}>+</button>
                          </div>
                          <button className="btn btn-sm btn-blinkit" style={{ marginLeft: "auto" }} onClick={() => { updateFood(l.key, { ordered: true }); openBlinkitSearch(l.query); }}>
                            Find on Blinkit ↗
                          </button>
                        </div>
                      </div>
                    </div>
                  )))}
                  <div className="between" style={{ marginTop: 10 }}>
                    <span className="muted small">Estimated total</span><span style={{ fontWeight: 700 }}>≈ {fmt(blinkitTotal)}</span>
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn-blinkit grow" onClick={() => { const next = blinkitLines.find((l) => !l.ordered); if (next) { updateFood(next.key, { ordered: true }); openBlinkitSearch(next.query); } else toast("Everything is marked as ordered"); }}>
                      Next item on Blinkit ↗
                    </button>
                    <button className="btn btn-ghost" onClick={() => share("Party supplies", blinkitText())}>↗ Share</button>
                  </div>
                  <div className="tiny dim" style={{ marginTop: 8 }}>
                    Blinkit has no public cart API, so each item opens as a search in the Blinkit {apps.blinkit ? "app" : "app / website"} — add it there, come back, tap the next one.
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="between small"><span className="muted">Zomato food</span><span>{fmt(zomatoTotal)}</span></div>
              <div className="between small" style={{ marginTop: 4 }}><span className="muted">Blinkit supplies</span><span>{fmt(blinkitTotal)}</span></div>
              <div className="sep" />
              <div className="between"><span className="muted">Food total</span><span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold2)" }}>≈ {fmt(zomatoTotal + blinkitTotal)}</span></div>
              <div className="row" style={{ marginTop: 12 }}>
                {zomatoGroups.length > 0 && <button className="btn btn-ghost grow" onClick={() => share("Food order", zomatoText())}>↗ Share food order</button>}
                <button className="btn btn-ghost" onClick={() => { if (confirm("Clear food & supplies?")) clearFood(); }}>Clear</button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
