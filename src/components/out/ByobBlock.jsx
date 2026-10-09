// [v1.5 · Out] Bring your own: the state's BYOB rule (lib/age.js), the bottles in your
// Cabinet that come along (indicative Livcheers prices), and the corkage the venue quoted.
// Corkage is never a number from us — only what the host types after asking the venue.
import { byobRule } from "../../lib/age.js";
import { bottlesOf } from "../../lib/out.js";
import { fmt } from "../../lib/format.js";
import { tap } from "../../lib/order.js";
import { Icon } from "../Art.jsx";

export default function ByobBlock({ city, liquorLines, corkage, onCorkage, openFill }) {
  const rule = byobRule(city);
  const { bottles, total } = bottlesOf(liquorLines);
  const top = [...(liquorLines || [])].sort((a, b) => b.qty - a.qty).slice(0, 4);
  const more = (liquorLines?.length || 0) - top.length;
  const type = (raw) => {
    const d = String(raw).replace(/\D/g, "").slice(0, 5);
    onCorkage(d === "" ? null : Number(d));
  };

  return (
    <div className="ot-byob">
      <div className="kicker ot-byob-k">🍾 Bring your own</div>
      {rule?.text && <div className="note note-warn" style={{ marginBottom: 10 }}>{rule.text}</div>}

      <div className="between">
        <span className="h3">From your Cabinet</span>
        <b className="small">{bottles ? `${bottles} bottle${bottles === 1 ? "" : "s"} · ≈ ${fmt(total)}` : "Nothing yet"}</b>
      </div>
      {bottles > 0 ? (
        <div className="ot-bring">
          {top.map((l) => (
            <div key={l.key} className="between tiny">
              <span className="soft ellipsis">{l.qty} × {l.item?.name || "Bottle"}</span>
              <span className="muted">{fmt((l.item?.price || 0) * l.qty)}</span>
            </div>
          ))}
          {more > 0 && <div className="tiny dim">+ {more} more in your cart</div>}
          <div className="tiny dim" style={{ marginTop: 4 }}>Indicative Livcheers prices — you buy them at a shop before the party.</div>
        </div>
      ) : (
        <div className="tiny muted" style={{ margin: "4px 0 2px" }}>Fill my bar picks bottles for a budget, ready to bring.</div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label>Corkage the venue quoted</label>
        <div className="row">
          <span className="ot-amt"><span>₹</span><input className="input" inputMode="numeric" placeholder="Ask" aria-label="Corkage a bottle, in rupees"
            value={corkage ?? ""} onChange={(e) => type(e.target.value)} /></span>
          <span className="tiny muted grow">
            {corkage != null
              ? (bottles ? <>a bottle × {bottles} = <b className="soft">{fmt(corkage * bottles)}</b></> : "a bottle")
              : "a bottle — set by the venue, ask when you book"}
          </span>
        </div>
      </div>

      {openFill && (
        <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => { tap(); openFill(); }}>
          <Icon.sparkle size={15} /> {bottles ? "Fill my bar for the rest" : "Fill my bar"}
        </button>
      )}
    </div>
  );
}
