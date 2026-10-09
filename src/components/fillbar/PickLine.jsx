// One Fill my bar pick: the bottle, why it's here (two short reasons), Swap and "No whisky".
// Swap opens the next best bottles that still fit and "Or their usual" — the family's
// best-known brands here; picking one also remembers it for next time (quiz favs).
import { BottleStage } from "../ProductCard.jsx";
import { CAT } from "../../lib/parse/livcheers.js";
import { FAMILIES } from "../../lib/cocktails.js";
import { reasonsFor } from "../../lib/barQuiz.js";
import { fmt } from "../../lib/format.js";
import { Icon } from "../Art.jsx";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const diff = (d) => (d === 0 ? "same" : d > 0 ? `+${fmt(d)}` : `−${fmt(-d)}`);

export default function PickLine({ line: l, pair, alts = [], brands = [], fav, reasonCtx, open, onToggle, onPin, onBrand, onSkip, onVariety }) {
  const label = FAMILIES[l.family]?.label || l.family;
  const reasons = reasonsFor(l, reasonCtx);
  return (
    <div className="list-row opt-line fade-up">
      <BottleStage item={l.item} cat={l.cat} artHeight={64} />
      <div className="grow">
        <div className="tiny b" style={{ color: CAT[l.cat]?.color }}>
          {label.toUpperCase()}{pair ? (l.slot ? " · 2ND LABEL" : " · 1ST LABEL") : ""} · {plural(l.need, "drink")}
        </div>
        <div className="display b clamp2" style={{ fontSize: 15, lineHeight: 1.2, marginTop: 2 }}>{l.item.name}</div>
        <div className="tiny muted" style={{ marginTop: 2 }}>{l.item.vol} · {l.qty} × {fmt(l.item.price)} = <b className="soft">{fmt(l.cost)}</b></div>
        {reasons.length > 0 && <div className="opt-why">{reasons.map((r) => <span key={r.kind}>{r.text}</span>)}</div>}
        <div className="opt-acts">
          {(alts.length > 0 || brands.length > 0) && (
            <button className={`btn btn-xs btn-ghost ${open ? "on" : ""}`} aria-expanded={open} onClick={onToggle}>⇄ Swap</button>
          )}
          {!l.slot && (
            <button className="btn btn-xs btn-ghost" onClick={onSkip} aria-label={`No ${label}`}><Icon.close size={12} /> No {label.toLowerCase()}</button>
          )}
          {onVariety && <button className="btn btn-xs btn-ghost" onClick={onVariety}>{pair ? `Just one ${label.toLowerCase()}` : `Two kinds of ${label.toLowerCase()}`}</button>}
        </div>

        {open && (
          <div className="opt-alts fade-up">
            {alts.length > 0 && <div className="kicker">Next best</div>}
            {alts.map((a) => {
              const why = reasonsFor(a, { ...reasonCtx, max: 1 })[0];
              return (
                <button key={a.key} className="opt-alt" onClick={() => onPin(a)}>
                  <span className="grow">
                    <span className="small b clamp2">{a.item.name}</span>
                    <span className="tiny muted">{a.item.vol} · {a.qty} × {fmt(a.item.price)}{why ? ` · ${why.text}` : ""}</span>
                  </span>
                  <span className={`tiny b opt-diff ${a.cost > l.cost ? "up" : "down"}`}>{diff(a.cost - l.cost)}</span>
                </button>
              );
            })}
            {brands.length > 0 && (
              <>
                <div className="kicker">Or their usual</div>
                <div className="opt-brands">
                  {brands.map((b) => (
                    <button key={b.key} className={`chip ${fav === b.key ? "on" : ""}`} aria-pressed={fav === b.key} onClick={() => onBrand(b)}>
                      {fav === b.key ? "★ " : ""}{b.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
