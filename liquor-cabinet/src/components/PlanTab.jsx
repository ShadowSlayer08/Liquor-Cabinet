import { useState } from "react";
import BudgetRing from "./BudgetRing.jsx";
import { CATEGORIES, CAT, cityName } from "../lib/parse/livcheers.js";
import { STALE_MS } from "../lib/sources.js";
import { fmt, ageStr } from "../lib/format.js";

export default function PlanTab({
  city, budget, saveBudget, spent, catSpend, zomatoTotal, blinkitTotal, plan,
  batches, activeBatch, setActiveBatch, addBatch, ages, openScraper, clearCache,
}) {
  const [draft, setDraft] = useState(String(budget));
  const [editing, setEditing] = useState(false);

  const rows = [
    ...CATEGORIES.filter((c) => catSpend[c.id]).map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}`, color: c.color, v: catSpend[c.id] })),
    zomatoTotal ? { id: "zomato", label: "🍽️ Zomato food", color: "#e23744", v: zomatoTotal } : null,
    blinkitTotal ? { id: "blinkit", label: "🛒 Blinkit supplies", color: "#f8cb46", v: blinkitTotal } : null,
  ].filter(Boolean);

  const synced = CATEGORIES.filter((c) => ages[c.id]);

  return (
    <div>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <BudgetRing spent={spent} total={budget} />
        <div className="grow">
          <div className="card-title" style={{ marginBottom: 4 }}>Party budget</div>
          {editing ? (
            <div className="row">
              <input className="input" inputMode="numeric" value={draft} autoFocus onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && (saveBudget(Number(draft) || budget), setEditing(false))} />
              <button className="btn btn-gold btn-sm" onClick={() => { saveBudget(Number(draft) || budget); setEditing(false); }}>✓</button>
            </div>
          ) : (
            <button style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }} onClick={() => { setDraft(String(budget)); setEditing(true); }}>
              {fmt(budget)} <span className="small gold">✎</span>
            </button>
          )}
          <div className="small muted" style={{ marginTop: 6 }}>{plan.guests} guests · {plan.hours} h · {cityName(city)}</div>
          <div className="small muted">≈ {fmt(spent / Math.max(1, plan.guests))} per guest</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Where the money goes <span className="right">{fmt(spent)}</span></div>
        {rows.length === 0 && <div className="small dim">Nothing in your carts yet.</div>}
        {rows.map((r) => (
          <div key={r.id} style={{ marginBottom: 9 }}>
            <div className="between small" style={{ marginBottom: 3 }}><span className="muted">{r.label}</span><span style={{ color: r.color }}>{fmt(r.v)}</span></div>
            <div className="bar" style={{ height: 4 }}><div style={{ width: `${Math.min(100, (r.v / Math.max(budget, spent)) * 100)}%`, background: r.color }} /></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Batches</div>
        {batches.map((b, i) => (
          <button key={i} className="between" onClick={() => setActiveBatch(i)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: activeBatch === i ? "#1c1611" : "transparent", color: activeBatch === i ? "var(--gold)" : "var(--muted)", marginBottom: 2 }}>
            <span>{activeBatch === i ? "▶ " : ""}{b.name}</span>
            <span className="small">{Object.values(b.items || {}).reduce((s, q) => s + q, 0)} bottles</span>
          </button>
        ))}
        <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6, borderStyle: "dashed" }} onClick={addBatch}>+ New batch</button>
        <div className="tiny dim" style={{ marginTop: 6 }}>Bottles you add go into the active batch — handy for splitting a shopping run across stores or days.</div>
      </div>

      <div className="card">
        <div className="card-title">Price database <button className="btn btn-gold btn-sm" onClick={openScraper}>⚡ Scrape</button></div>
        {synced.length === 0 && <div className="small dim">No prices synced for {cityName(city)} yet.</div>}
        {synced.map((c) => {
          const stale = Date.now() - ages[c.id] > STALE_MS;
          return (
            <div key={c.id} className="between small" style={{ padding: "3px 0" }}>
              <span style={{ color: stale ? "#a07a30" : "var(--muted)" }}>{c.emoji} {c.label}</span>
              <span style={{ color: stale ? "#a07a30" : "var(--dim)" }}>{ageStr(ages[c.id])}{stale ? " ⚠" : ""}</span>
            </div>
          );
        })}
        <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => { if (confirm("Delete all cached prices? Your carts are kept.")) clearCache(); }}>
          Clear cached prices
        </button>
      </div>

      <div className="card small muted" style={{ lineHeight: 1.6 }}>
        <div className="card-title">Data sources</div>
        <div>🥃 <b className="gold">Livcheers</b> — liquor prices, ratings & tasting notes, scraped straight from livcheers.com category pages.</div>
        <div>🍽️ <b style={{ color: "#f07080" }}>Zomato</b> — live restaurants, ratings and “cost for one” per dish in your city; orders open in the Zomato app.</div>
        <div>🛒 <b style={{ color: "var(--blinkit)" }}>Blinkit</b> — supplies open as Blinkit searches; reference prices are DMart's live shelf prices.</div>
        <div className="tiny dim" style={{ marginTop: 8 }}>Liquor Cabinet v1.0 · Prices are indicative. Please drink responsibly and only where legal (21+ in most states).</div>
      </div>
    </div>
  );
}
