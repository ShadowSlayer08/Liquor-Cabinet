// Recipe card for one cocktail: what goes into a glass, how to make it, and how many to
// put on the party menu. The servings size the cocktail extras on the Blinkit list.
import { useState } from "react";
import Sheet, { Stepper } from "./Sheet.jsx";
import { FAMILIES, cocktailUses, perServing } from "../lib/cocktails.js";
import { GROCERY, formatAmount } from "../lib/food.js";
import { CAT } from "../lib/parse/livcheers.js";
import { Icon } from "./Art.jsx";

const famLabels = (fams) => fams.map((f) => FAMILIES[f]?.label || f).join(" + ");

export default function CocktailSheet({ cocktail: c, servings, suggested, plan, onSave, onRemove, onClose, goCabinet }) {
  const [n, setN] = useState(servings || suggested || 1);
  const spiritEmoji = CAT[FAMILIES[c.needs[0]]?.cats[0]]?.emoji || "🥃";
  const uses = Object.entries(c.uses).filter(([g]) => GROCERY[g]);
  const totals = Object.entries(cocktailUses([{ id: c.id, servings: n }])).filter(([g]) => GROCERY[g]);

  const footer = c.can ? (
    servings ? (
      <div className="row">
        <button className="btn btn-ghost" onClick={onRemove}>Remove from menu</button>
        <button className="btn btn-gold grow" onClick={() => onSave(n)}><Icon.check size={17} /> Update menu</button>
      </div>
    ) : (
      <button className="btn btn-gold btn-block" onClick={() => onSave(n)}><Icon.plus size={17} /> Add to party menu · ×{n}</button>
    )
  ) : (
    <div className="row">
      {servings > 0 && <button className="btn btn-ghost" onClick={onRemove}>Remove from menu</button>}
      <button className="btn btn-gold grow" onClick={goCabinet}><Icon.cabinet size={17} /> Browse the cabinet</button>
    </div>
  );

  return (
    <Sheet title={c.name} subtitle={`${/glass|mug/i.test(c.glass) ? c.glass : `${c.glass} glass`} · ${c.spirit}`} onClose={onClose} footer={footer}>
      <div className="bar-sheet-hero" style={{ "--c": c.color }}>
        <span className="bar-glow bar-glow-lg"><span className="bar-emoji">{c.emoji}</span></span>
        <div className="row wrap" style={{ gap: 6, justifyContent: "center" }}>
          {c.tags.map((t) => <span key={t} className="pill" style={{ background: "var(--panel-2)", color: "var(--soft)" }}>{t}</span>)}
          {servings > 0 && <span className="pill bar-onmenu-pill">on the menu ×{servings}</span>}
        </div>
      </div>

      {!c.can && (
        <div className="note note-warn" style={{ marginBottom: 14 }}>
          Needs <b>{famLabels(c.missing)}</b> — add a bottle to your cabinet to put this on the party menu.
        </div>
      )}

      <div className="card">
        <div className="card-title"><span className="kicker">In one glass</span><span className="tiny muted">{c.glass}</span></div>
        <div className="line-item">
          <div className="emo">{spiritEmoji}</div>
          <div className="grow"><div className="h3">{famLabels(c.needs)}</div><div className={`tiny ${c.can ? "green" : "red"}`}>{c.can ? "✓ in your cabinet" : `${famLabels(c.missing)} not in your cabinet`}</div></div>
          <span className="small gold" style={{ textAlign: "right", maxWidth: "48%" }}>{c.spirit}</span>
        </div>
        {uses.map(([g, amt]) => (
          <div key={g} className="line-item">
            <div className="emo">{GROCERY[g].emoji}</div>
            <div className="grow h3">{GROCERY[g].name}</div>
            <span className="small gold">{perServing(amt, GROCERY[g].unit)}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="kicker" style={{ marginBottom: 10 }}>How to make it</div>
        <ol className="bar-steps">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>

      {c.can && (
        <div className="card">
          <div className="field"><label>Servings for the party</label><Stepper value={n} onChange={setN} min={1} max={500} /></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>{plan.drinkers} {plan.drinkers === 1 ? "drinker" : "drinkers"} · {plan.needed} {plan.needed === 1 ? "drink" : "drinks"} planned over {plan.hours} h</div>
          {totals.length > 0 && (
            <>
              <div className="kicker" style={{ margin: "14px 0 8px" }}>For {n} you'll need</div>
              <div className="chips" style={{ marginBottom: -8 }}>
                {totals.map(([g, amt]) => <span key={g} className="chip">{GROCERY[g].emoji} {GROCERY[g].name} <b className="gold">{formatAmount(amt, GROCERY[g].unit)}</b></span>)}
              </div>
              <div className="tiny dim" style={{ marginTop: 8 }}>Added to the Blinkit list in the Food tab once it's on the menu.</div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
