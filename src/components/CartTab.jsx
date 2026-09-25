import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, cityName } from "../lib/parse/livcheers.js";
import { COURSES, GROUPS } from "../lib/food.js";
import { thumb } from "../lib/parse/zomato.js";
import { fmt } from "../lib/format.js";
import {
  openBlinkitSearch, openZomatoRestaurant, openBistro, openUrl, shareText, copyText, isInstalled, postChecklist,
  CHECKLIST_IDS, zomatoChecklistId, BLINKIT, ZOMATO, BISTRO, buzz,
} from "../lib/order.js";
import { showBubble } from "../lib/bubble.js";
import { BottleStage } from "./ProductCard.jsx";
import { Qty } from "./Sheet.jsx";
import { Icon, VegMark } from "./Art.jsx";

export default function CartTab({
  city, view, setView, liquorLines, liquorTotal, addItem, remItem, clearLiquor, batches, activeBatch,
  foodCart, updateFood, removeFood, clearFood, toast, bubble,
}) {
  const [apps, setApps] = useState({});
  useEffect(() => {
    Promise.all([isInstalled(ZOMATO), isInstalled(BLINKIT), isInstalled(BISTRO)]).then(([z, b, s]) => setApps({ zomato: z, blinkit: b, bistro: s }));
  }, []);

  const zomatoGroups = useMemo(() => {
    const m = new Map();
    for (const l of foodCart.filter((x) => x.kind === "zomato")) {
      const k = l.restaurant.resId;
      if (!m.has(k)) m.set(k, { restaurant: l.restaurant, lines: [] });
      m.get(k).lines.push(l);
    }
    return [...m.values()];
  }, [foodCart]);
  const bistroLines = foodCart.filter((x) => x.kind === "bistro");
  const blinkitLines = foodCart.filter((x) => x.kind === "blinkit");
  const zomatoTotal = zomatoGroups.reduce((s, g) => s + g.lines.reduce((t, l) => t + l.unitPrice * l.qty, 0), 0);
  const blinkitTotal = blinkitLines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const liqCount = liquorLines.reduce((s, l) => s + l.qty, 0);
  const foodCount = foodCart.length;

  const setQty = (l, q) => (q <= 0 ? removeFood(l.key) : updateFood(l.key, { qty: q }));
  const orderLines = (lines) => lines.map((l) => `${l.qty} × ${l.name}`);
  const blinkitChecklist = (lines) => lines.map((l) => `${l.ordered ? "✅" : "⬜"} ${l.qty} × ${l.product.name} (${l.product.packText})`);

  // ── Hand-offs ──
  const sendZomato = async (g) => {
    const lines = orderLines(g.lines);
    await copyText(`${g.restaurant.name}\n${lines.join("\n")}`);
    const pinned = await postChecklist(zomatoChecklistId(g.restaurant.resId), `Zomato · ${g.restaurant.name}`, lines, `${lines.length} dishes to add`);
    if (bubble) await showBubble(`Zomato · ${g.restaurant.name}`, lines);
    buzz();
    toast(pinned ? "Order pinned to your notifications & copied — opening Zomato" : "Order copied — opening Zomato");
    g.lines.forEach((l) => updateFood(l.key, { ordered: true }));
    openZomatoRestaurant(g.restaurant);
  };
  const sendBistro = async () => {
    const lines = orderLines(bistroLines);
    await copyText(`Bistro order\n${lines.join("\n")}`);
    const pinned = await postChecklist(CHECKLIST_IDS.bistro, "Bistro order", lines, `${lines.length} items to add`);
    if (bubble) await showBubble("Bistro order", lines);
    buzz();
    toast(pinned ? "Order pinned to your notifications & copied — opening Bistro" : "Order copied — opening Bistro");
    bistroLines.forEach((l) => updateFood(l.key, { ordered: true }));
    openBistro();
  };
  const findOnBlinkit = async (l) => {
    const next = blinkitLines.map((x) => (x.key === l.key ? { ...x, ordered: true } : x));
    updateFood(l.key, { ordered: true });
    await postChecklist(CHECKLIST_IDS.blinkit, `Blinkit list · ${next.filter((x) => x.ordered).length}/${next.length} done`, blinkitChecklist(next), "Tap to come back for the next item");
    if (bubble) await showBubble("Blinkit list", blinkitChecklist(next)); // nextBlinkit() lands here too
    openBlinkitSearch(l.query);
  };
  const nextBlinkit = () => {
    const next = blinkitLines.find((l) => !l.ordered);
    if (next) findOnBlinkit(next); else toast("Everything's ticked off 🎉");
  };

  const share = async (title, text) => { if ((await shareText(title, text)) === "copied") toast("List copied to clipboard"); };
  const liquorText = () => [
    `🥃 Liquor Cabinet — ${cityName(city)}`, "",
    ...CATEGORIES.flatMap((c) => {
      const ls = liquorLines.filter((l) => l.cat === c.id);
      return ls.length ? [`${c.emoji} ${c.label}`, ...ls.map((l) => `  ${l.qty} × ${l.item.name} (${l.item.vol}) — ${fmt(l.item.price * l.qty)}`)] : [];
    }),
    "", `Total: ${fmt(liquorTotal)} (Livcheers indicative prices)`,
  ].join("\n");
  const foodText = () => [
    `🍽️ Party food — ${cityName(city)}`, "",
    ...zomatoGroups.flatMap((g) => [`Zomato · ${g.restaurant.name}`, ...orderLines(g.lines).map((x) => `  ${x}`)]),
    ...(bistroLines.length ? ["Bistro", ...orderLines(bistroLines).map((x) => `  ${x}`)] : []),
    ...(blinkitLines.length ? ["Blinkit", ...blinkitLines.map((l) => `  ${l.qty} × ${l.product.name} (${l.product.packText})`)] : []),
    "", `≈ ${fmt(zomatoTotal + blinkitTotal)}`,
  ].join("\n");

  return (
    <div>
      <div className="section-head" style={{ marginTop: 14 }}>
        <div><div className="kicker">Your order</div><div className="h1" style={{ fontSize: 28 }}>The <em>cart</em></div></div>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={view === "liquor" ? "on" : ""} onClick={() => setView("liquor")}>🥃 Bottles · {liqCount}</button>
        <button className={view === "food" ? "on" : ""} onClick={() => setView("food")}>🍽️ Food & supplies · {foodCount}</button>
      </div>

      {/* ── Liquor ── */}
      {view === "liquor" && (liquorLines.length === 0 ? (
        <div className="card empty"><div style={{ fontSize: 44 }}>🥃</div><div className="t">Your cabinet is empty</div><div className="small">Add bottles from the Cabinet tab.</div></div>
      ) : (
        <>
          {CATEGORIES.filter((c) => liquorLines.some((l) => l.cat === c.id)).map((c) => {
            const ls = liquorLines.filter((l) => l.cat === c.id);
            return (
              <div key={c.id} className="fade-up">
                <div className="between" style={{ margin: "6px 4px 8px" }}>
                  <span className="kicker" style={{ color: c.color }}>{c.emoji} {c.label}</span>
                  <span className="small b">{fmt(ls.reduce((s, l) => s + l.item.price * l.qty, 0))}</span>
                </div>
                {ls.map((l) => (
                  <div key={l.key} className="list-row">
                    <BottleStage item={l.item} cat={l.cat} artHeight={64} />
                    <div className="grow" onClick={() => openUrl(l.item.url)}>
                      <div className="display b ellipsis" style={{ fontSize: 15 }}>{l.item.name}</div>
                      <div className="tiny muted">{l.item.vol} · {fmt(l.item.price)} each{l.stale ? " · earlier price" : ""}</div>
                      <b className="gold-text">{fmt(l.item.price * l.qty)}</b>
                    </div>
                    <Qty value={l.qty} onChange={(v) => (v > l.qty ? addItem(l.cat, l.item) : remItem(l.cat, l.item))} />
                  </div>
                ))}
              </div>
            );
          })}
          <div className="card" style={{ marginTop: 10 }}>
            <div className="between"><span className="muted">{liqCount} bottles</span><span className="h2 gold-text" style={{ fontFamily: "var(--ui)" }}>{fmt(liquorTotal)}</span></div>
            <div className="tiny dim" style={{ marginTop: 6 }}>Livcheers indicative store prices for {cityName(city)}. Liquor isn't sold on Zomato, Bistro or Blinkit — share the list and pick it up from your local store.</div>
            <div className="sep" />
            <div className="between small"><span className="muted">Active batch</span><span>{batches[activeBatch]?.name} · {Object.values(batches[activeBatch]?.items || {}).reduce((s, q) => s + q, 0)} bottles</span></div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-gold grow" onClick={() => share("Liquor list", liquorText())}><Icon.share size={17} /> Share list</button>
              <button className="btn btn-ghost" onClick={() => { if (confirm("Clear the liquor cart?")) clearLiquor(); }}>Clear</button>
            </div>
          </div>
        </>
      ))}

      {/* ── Food ── */}
      {view === "food" && (foodCart.length === 0 ? (
        <div className="card empty"><div style={{ fontSize: 44 }}>🍽️</div><div className="t">Nothing to order yet</div><div className="small">Plan food, mixers and ice in the Food tab.</div></div>
      ) : (
        <>
          <div className="note note-info" style={{ marginBottom: 14 }}>
            <b>How ordering works:</b> tap a Send button — Liquor Cabinet opens the restaurant or app, copies your list, and pins it to your notifications so every item and quantity is one swipe away while you add them.
          </div>

          {zomatoGroups.map((g) => {
            const tot = g.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
            const sent = g.lines.every((l) => l.ordered);
            return (
              <div key={g.restaurant.resId} className="card flush fade-up">
                <div className="provider-head provider-z">
                  <span className="logo logo-z">zomato</span>
                  <span className="grow">
                    <span className="h3 ellipsis" style={{ display: "block" }}>{g.restaurant.name}</span>
                    <span className="tiny muted">{[g.restaurant.locality, g.restaurant.deliveryTime && `🛵 ${g.restaurant.deliveryTime}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {g.restaurant.rating && <span className="rating">{g.restaurant.rating} ★</span>}
                </div>
                <div className="provider-body">
                  {g.lines.map((l) => (
                    <div key={l.key} className="line-item">
                      {l.img ? <img className="thumb" src={thumb(l.img, 120)} alt="" loading="lazy" /> : <div className="emo">{l.emoji}</div>}
                      <div className="grow">
                        <div className="row" style={{ gap: 6 }}><VegMark veg={l.veg} /><span className="small b clamp2">{l.name}</span></div>
                        <div className="tiny muted ellipsis">{l.section || COURSES[l.course]?.label} · ≈ {fmt(l.unitPrice)} each</div>
                      </div>
                      <Qty value={l.qty} onChange={(v) => setQty(l, v)} color="#ff8a92" />
                    </div>
                  ))}
                  <div className="between" style={{ marginTop: 10 }}>
                    <span className="tiny muted">{sent ? "✓ Sent to Zomato" : `${g.lines.reduce((s, l) => s + l.qty, 0)} items`}</span>
                    <b>≈ {fmt(tot)}</b>
                  </div>
                  <button className="btn btn-zomato btn-block" style={{ marginTop: 12 }} onClick={() => sendZomato(g)}>
                    {sent ? "Open again in Zomato" : "Send order to Zomato"} {apps.zomato ? "app" : ""} <Icon.external size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {bistroLines.length > 0 && (
            <div className="card flush fade-up">
              <div className="provider-head provider-s">
                <span className="logo logo-s">bistro</span>
                <span className="grow small muted">10-minute snacks & meals</span>
              </div>
              <div className="provider-body">
                {bistroLines.map((l) => (
                  <div key={l.key} className="line-item">
                    <div className="emo" style={{ background: "rgba(255,122,26,.14)" }}>{l.emoji}</div>
                    <div className="grow"><div className="row" style={{ gap: 6 }}><VegMark veg={l.veg === "both" ? null : l.veg} /><span className="small b">{l.name}</span></div><div className="tiny muted">Price in Bistro app</div></div>
                    <Qty value={l.qty} onChange={(v) => setQty(l, v)} color="var(--bistro)" />
                  </div>
                ))}
                <button className="btn btn-bistro btn-block" style={{ marginTop: 12 }} onClick={sendBistro}>
                  Send order to Bistro {apps.bistro ? "app" : ""} <Icon.external size={16} />
                </button>
              </div>
            </div>
          )}

          {blinkitLines.length > 0 && (
            <div className="card flush fade-up">
              <div className="provider-head provider-b">
                <span className="logo logo-b">blinkit</span>
                <span className="grow small muted">Party supplies</span>
                <span className="pill" style={{ background: "rgba(52,217,143,.14)", color: "var(--green)" }}>{blinkitLines.filter((l) => l.ordered).length}/{blinkitLines.length} done</span>
              </div>
              <div className="provider-body">
                {Object.keys(GROUPS).flatMap((gid) => blinkitLines.filter((l) => l.group === gid)).map((l) => (
                  <div key={l.key} className={`line-item ${l.ordered ? "done" : ""}`}>
                    <button className={`check ${l.ordered ? "on" : ""}`} onClick={() => updateFood(l.key, { ordered: !l.ordered })} aria-label="Done">{l.ordered && <Icon.check size={14} />}</button>
                    <div className="emo" style={{ background: "rgba(248,203,70,.1)", width: 40, height: 40, fontSize: 19 }}>{l.emoji}</div>
                    <div className="grow">
                      <div className="small b ellipsis">{l.product.name}</div>
                      <div className="tiny muted">{l.product.packText} · {fmt(l.product.price)} × {l.qty}</div>
                      <div className="row" style={{ marginTop: 6, gap: 8 }}>
                        <Qty value={l.qty} onChange={(v) => setQty(l, v)} />
                        <button className="btn btn-xs btn-blinkit" style={{ marginLeft: "auto" }} onClick={() => findOnBlinkit(l)}>Find <Icon.external size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="between" style={{ marginTop: 10 }}><span className="tiny muted">Estimated (MRP)</span><b>≈ {fmt(blinkitTotal)}</b></div>
                <button className="btn btn-blinkit btn-block" style={{ marginTop: 12 }} onClick={nextBlinkit}>
                  {blinkitLines.some((l) => l.ordered) ? "Next item on Blinkit" : "Start Blinkit run"} <Icon.external size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="between small"><span className="muted">Zomato food</span><span>{fmt(zomatoTotal)}</span></div>
            {bistroLines.length > 0 && <div className="between small" style={{ marginTop: 4 }}><span className="muted">Bistro</span><span className="dim">priced in app</span></div>}
            <div className="between small" style={{ marginTop: 4 }}><span className="muted">Blinkit supplies</span><span>{fmt(blinkitTotal)}</span></div>
            <div className="sep" />
            <div className="between"><span className="muted">Food total</span><span className="h2 gold-text" style={{ fontFamily: "var(--ui)" }}>≈ {fmt(zomatoTotal + blinkitTotal)}</span></div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost grow" onClick={() => share("Party food", foodText())}><Icon.share size={17} /> Share</button>
              <button className="btn btn-ghost" onClick={() => { if (confirm("Clear food & supplies?")) clearFood(); }}>Clear</button>
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
