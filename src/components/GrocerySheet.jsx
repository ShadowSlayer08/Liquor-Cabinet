import { useEffect, useRef, useState } from "react";
import Sheet, { Spinner } from "./Sheet.jsx";
import { packsFor, formatAmount } from "../lib/food.js";
import { openBlinkitSearch, tap } from "../lib/order.js";
import { blinkitLive, liveAvailable, liveOption } from "../lib/blinkitLive.js";
import { fmt } from "../lib/format.js";
import { Icon } from "./Art.jsx";

const hhmm = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

// Product choices for one party-supply item, ordered on Blinkit: the usual MRP options, plus
// (phone only, beta) live prices read off Blinkit's own search page. MRP stays the fallback.
export default function GrocerySheet({ grocery, need, selectedId, onPick, onClose }) {
  const [live, setLive] = useState(null); // null · "loading" · "failed" · { options, at }
  const run = useRef(0);                  // ignores a lookup that finishes after the sheet moved on
  useEffect(() => { setLive(null); return () => { run.current++; }; }, [grocery.id]);
  // Several product options → search the supply ("Club soda"); one → its own search term ("paper glass").
  const query = grocery.options.length > 1 ? grocery.name : grocery.options[0].blinkit;

  const checkLive = async () => {
    const id = ++run.current;
    tap();
    setLive("loading");
    try {
      const items = await blinkitLive(query);
      if (id === run.current) setLive({ options: items.map((it) => liveOption(it, grocery.unit, grocery.options[0])), at: Date.now() });
    } catch (e) {
      console.warn("blinkitLive", e);
      if (id === run.current) setLive("failed");
    }
  };

  const option = (p, meta) => {
    const packs = Math.max(1, packsFor(need, p));
    const on = p.id === selectedId;
    return (
      <div key={p.id} className="line-item">
        {p.img ? <img className="nat-img" src={p.img} alt="" loading="lazy" /> : <div className="emo">{grocery.emoji}</div>}
        <div className="grow">
          <div className="small clamp2" style={{ fontWeight: 700 }}>{p.name} {on && <span className="green tiny">✓ selected</span>}</div>
          {meta}
        </div>
        <button className="btn btn-sm btn-blinkit" onClick={() => onPick(p, packs)}>
          ×{packs} · {fmt(p.price * packs)}
        </button>
      </div>
    );
  };

  return (
    <Sheet
      title={`${grocery.emoji} ${grocery.name}`}
      subtitle={need ? `You need about ${formatAmount(need, grocery.unit)}` : "Pick a product"}
      onClose={onClose}
      footer={<button className="btn btn-blinkit btn-block" onClick={() => openBlinkitSearch(grocery.options[0].blinkit)}>Browse “{grocery.name}” on Blinkit ↗</button>}
    >
      {!liveAvailable() ? (
        <button className="btn btn-ghost btn-sm btn-block" disabled>Live Blinkit prices · Android app only</button>
      ) : live === "loading" ? (
        <Spinner label="Reading prices off Blinkit… (a few seconds)" />
      ) : live?.options ? (
        <div className="nat-live-box">
          <div className="between">
            <span className="kicker">Live on Blinkit <span className="pill nat-beta">beta</span></span>
            <button className="tiny gold" onClick={checkLive}>Check again</button>
          </div>
          {live.options.map((p) => option(p, <div className="tiny muted">{p.packText} · {fmt(p.price)} · <span className="nat-live">live · checked {hhmm(live.at)}</span></div>))}
          <div className="tiny dim" style={{ marginTop: 6 }}>Read from Blinkit's search for your location just now — the app can still change it at checkout.</div>
        </div>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm btn-block" onClick={checkLive}><Icon.bolt size={14} /> Check live price on Blinkit (beta)</button>
          {live === "failed" && <div className="note note-warn" style={{ marginTop: 10 }}>Couldn't read Blinkit right now — MRP shown.</div>}
        </>
      )}

      <div className="kicker" style={{ marginTop: 16 }}>Usual MRP</div>
      {grocery.options.map((p) => option(p, (
        <>
          <div className="tiny muted">{p.packText} · MRP ≈ {fmt(p.price)}</div>
          <button className="tiny gold" onClick={() => openBlinkitSearch(p.blinkit)}>See live price on Blinkit ↗</button>
        </>
      )))}
      <div className="tiny dim" style={{ marginTop: 10 }}>Prices are the usual printed MRP — Blinkit shows the exact price (often a little lower) when you open the item.</div>
    </Sheet>
  );
}
