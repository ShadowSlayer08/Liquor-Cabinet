// Fill my bar for ₹X — the budget optimiser (lib/optimise.js). "I have ₹15k and 12 people,
// what do I buy?": the best-rated bottles from the city's Livcheers prices that cover the
// drinks within the amount, one tap into the cart and the active batch. Swap a bottle, or
// skip a spirit and its drinks go to the others. Neutral: ratings and prices only.
import { useMemo, useState } from "react";
import Sheet, { Stepper } from "./Sheet.jsx";
import { BottleStage } from "./ProductCard.jsx";
import { CAT, cityName } from "../lib/parse/livcheers.js";
import { COCKTAIL, FAMILIES } from "../lib/cocktails.js";
import { MIXES, fillBar, haveByFamily, joinLabels } from "../lib/optimise.js";
import { fmt, fmtShort } from "../lib/format.js";
import { tap } from "../lib/order.js";
import { Icon } from "./Art.jsx";

const VALUE_CATS = ["indian", "brandy"];   // not synced by default, and often the best value
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function FillBarSheet({ catalog, city, plan, party, budget, spent, cocktailMenu, batchName, addItems, toast, onClose, openScraper, openScraperWith }) {
  const left = budget - spent;
  const gap = plan.available > 0 && plan.shortfall > 0;
  const covered = plan.available > 0 && plan.shortfall === 0;
  const hasCocktails = (cocktailMenu || []).some((m) => m?.servings > 0 && COCKTAIL[m.id] && !COCKTAIL[m.id].mocktail);
  const mixes = Object.entries(MIXES).filter(([k]) => k !== "menu" || hasCocktails);

  const [amount, setAmount] = useState(() => String(left > 0 ? left : 10000));
  const [drinks, setDrinks] = useState(() => Math.max(1, gap ? plan.shortfall : plan.needed));
  const [mix, setMix] = useState(() => (MIXES[party?.mix] && (party.mix !== "menu" || hasCocktails) ? party.mix : "mixed"));
  const [pins, setPins] = useState({});    // family → "cat:id" the host swapped in
  const [seen, setSeen] = useState({});    // family → bottles already shown, so Swap walks the list
  const [skip, setSkip] = useState([]);    // families the host doesn't want

  const money = parseInt(amount, 10) || 0;
  const have = useMemo(() => haveByFamily(plan.byCat), [plan.byCat]);
  const synced = Object.values(catalog || {}).some((l) => l?.length);
  const r = useMemo(
    () => fillBar({ catalog, drinks, budget: money, mix, pegMl: party?.pegMl, menu: cocktailMenu, have, skip, pins }),
    [catalog, drinks, money, mix, party?.pegMl, cocktailMenu, have, skip, pins],
  );
  const bottles = r.lines.reduce((s, l) => s + l.qty, 0);
  const changed = skip.length > 0 || Object.keys(pins).length > 0;

  const pickMix = (k) => { tap(); setMix(k); setPins({}); setSeen({}); };
  const swap = (l) => {
    const alts = r.alternatives[l.family] || [];
    if (!alts.length) return;
    tap();
    const was = [...(seen[l.family] || []), l.key];
    const next = alts.find((a) => !was.includes(a.key));
    // Every alternative shown once → start the walk again from the best one.
    setSeen({ ...seen, [l.family]: next ? was : [l.key] });
    setPins({ ...pins, [l.family]: (next || alts[0]).key });
  };
  const drop = (f) => { tap(); setSkip([...skip, f]); const { [f]: _, ...rest } = pins; setPins(rest); };
  const reset = () => { tap(); setSkip([]); setPins({}); setSeen({}); };
  const add = () => {
    if (!r.lines.length) return;
    addItems(r.lines.map((l) => ({ cat: l.cat, item: l.item, qty: l.qty })));
    toast(`Added ${plural(bottles, "bottle")} (≈${fmt(r.cost)}) to ${batchName || "your cart"}`);
    onClose();
  };

  const unsyncedLabels = r.unsynced.map((c) => CAT[c]?.label);
  const footer = synced ? (
    <button className="btn btn-gold btn-block" disabled={!r.lines.length} onClick={add}>
      <Icon.plus size={17} /> {r.lines.length ? `Add ${plural(bottles, "bottle")} · ${fmt(r.cost)}` : "Nothing fits yet"}
    </button>
  ) : null;

  // .opt-fill lets the sync panel (rendered before this sheet in App) open on top of it.
  return (
    <Sheet title="Fill my bar" subtitle="The best-rated bottles that fit your budget" onClose={onClose} footer={footer}>
      <span className="opt-fill" hidden />
      {!synced ? (
        <div className="empty" style={{ padding: "24px 8px" }}>
          <div style={{ fontSize: 44 }}>🥃</div>
          <div className="t">Sync prices first</div>
          <div className="small" style={{ marginBottom: 18 }}>The optimiser picks from Livcheers prices and ratings for {cityName(city)}.</div>
          <button className="btn btn-gold" onClick={openScraper}><Icon.bolt size={18} /> Sync prices</button>
        </div>
      ) : (
        <>
          {/* ── Inputs ── */}
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Spend up to</label>
              <div className="opt-money">
                <span aria-hidden="true">₹</span>
                <input className="input" inputMode="numeric" aria-label="Spend up to, in rupees" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))} />
              </div>
            </div>
            <div className="field"><label>{gap ? "Drinks still to cover" : "Drinks to cover"}</label><Stepper value={drinks} onChange={setDrinks} min={1} max={2000} /></div>
          </div>
          <div className="chips opt-quick">
            {left > 0 && <button className={`chip ${money === left ? "on" : ""}`} onClick={() => setAmount(String(left))}>Budget left · {fmtShort(left)}</button>}
            {[5000, 10000, 20000, 50000].map((v) => (
              <button key={v} className={`chip ${money === v ? "on" : ""}`} onClick={() => setAmount(String(v))}>{fmtShort(v)}</button>
            ))}
          </div>
          {left <= 0 && <div className="note note-warn" style={{ marginBottom: 10 }}>{left < 0 ? `You're already ${fmt(-left)} over your budget.` : "Your budget is all spent."} Set an amount for this run.</div>}
          {covered && <div className="note note-info" style={{ marginBottom: 10 }}>Your cart already covers the {plan.needed} drinks planned. This plans {plural(drinks, "more drink")}.</div>}

          <div className="kicker" style={{ margin: "4px 0 8px" }}>Bar style · {party?.pegMl || 60} ml pegs</div>
          <div className="chips" style={{ marginBottom: 6 }}>
            {mixes.map(([k, m]) => <button key={k} className={`chip ${mix === k ? "on" : ""}`} onClick={() => pickMix(k)}>{m.label}</button>)}
          </div>

          {/* ── Notes ── */}
          {r.fellBack && <div className="note note-info" style={{ marginBottom: 10 }}>Nothing's synced for {MIXES[mix].label.toLowerCase()} yet, so this is a mixed bar.</div>}
          {r.unsynced.length > 0 && (
            <div className="note note-info opt-note" style={{ marginBottom: 10 }}>
              <span className="grow">
                {joinLabels(unsyncedLabels)} {unsyncedLabels.length === 1 ? "isn't" : "aren't"} synced yet.
                {r.unsynced.some((c) => VALUE_CATS.includes(c)) ? " They're often the best value." : ""}
              </span>
              <button className="btn btn-xs btn-ghost" onClick={() => openScraperWith(r.unsynced)}><Icon.bolt size={13} /> Sync them</button>
            </div>
          )}

          {/* ── Result ── */}
          {r.lines.length > 0 && (
            <div className="opt-sum fade-up">
              <div><div className="v">{r.drinks}</div><div className="l">drinks</div></div>
              <div><div className="v gold-text">{fmtShort(r.cost)}</div><div className="l">of {fmtShort(money)}</div></div>
              <div><div className="v">{fmtShort(r.left)}</div><div className="l">left</div></div>
              <div><div className="v">★ {r.rating.toFixed(1)}</div><div className="l">avg rating</div></div>
            </div>
          )}
          {!r.feasible && r.lines.length > 0 && (
            <div className="note note-warn" style={{ marginBottom: 10 }}>
              {fmt(money)} covers about <b>{r.drinks}</b> of {r.target} drinks. Raise the amount{(party?.pegMl || 60) === 60 ? " or switch to 30 ml pegs (Food tab)" : ""}.
            </div>
          )}
          {r.lines.length > 0 && r.target > drinks && (
            <div className="note note-info" style={{ marginBottom: 10 }}>Your cocktail menu needs spirits the cart doesn't cover yet, so this plans {r.target} drinks.</div>
          )}
          {r.feasible && r.trimmed && (
            <div className="note note-info" style={{ marginBottom: 10 }}>{fmt(money)} is tight for a full {MIXES[r.mix].label.toLowerCase()}, so this sticks to fewer spirits.</div>
          )}
          {!r.lines.length && (
            <div className="note note-warn" style={{ marginBottom: 10 }}>
              {money > 0 ? `${fmt(money)} doesn't buy a bottle from what's synced for ${cityName(city)}. Raise the amount.` : "Enter how much you'd like to spend."}
            </div>
          )}

          {r.lines.map((l) => {
            const alts = r.alternatives[l.family] || [];
            return (
              <div key={l.family} className="list-row opt-line fade-up">
                <BottleStage item={l.item} cat={l.cat} artHeight={64} />
                <div className="grow">
                  <div className="tiny b" style={{ color: CAT[l.cat]?.color }}>{FAMILIES[l.family]?.label.toUpperCase()} · {plural(l.need, "drink")}</div>
                  <div className="display b clamp2" style={{ fontSize: 15, lineHeight: 1.2, marginTop: 2 }}>{l.item.name}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{l.item.vol} · {l.qty} × {fmt(l.item.price)} = <b className="soft">{fmt(l.cost)}</b></div>
                  <div className="tiny muted">≈ {fmt(l.costPerDrink)} a drink · {l.unrated ? <span className="gold">unrated</span> : <span className="stars">★ {l.q}</span>}</div>
                  <div className="opt-acts">
                    {alts.length > 0 && <button className="btn btn-xs btn-ghost" onClick={() => swap(l)}>⇄ Swap</button>}
                    <button className="btn btn-xs btn-ghost" onClick={() => drop(l.family)} aria-label={`No ${FAMILIES[l.family]?.label}`}><Icon.close size={12} /> No {FAMILIES[l.family]?.label.toLowerCase()}</button>
                  </div>
                </div>
              </div>
            );
          })}

          {changed && (
            <div className="row wrap opt-skipped">
              {skip.map((f) => (
                <button key={f} className="chip" onClick={() => { tap(); setSkip(skip.filter((x) => x !== f)); }}>↺ {FAMILIES[f]?.label}</button>
              ))}
              <button className="link small gold" onClick={reset}>Undo my changes</button>
            </div>
          )}

          <div className="tiny dim" style={{ marginTop: 12, lineHeight: 1.5 }}>
            Livcheers indicative prices for {cityName(city)}. Shops may charge differently. Ratings from Livcheers; unrated bottles count as 3.5★. No sponsored picks.
          </div>
        </>
      )}
    </Sheet>
  );
}
