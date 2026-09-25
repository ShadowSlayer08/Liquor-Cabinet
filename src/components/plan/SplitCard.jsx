// [v1.3 · item 5] Split the bill — per-person shares, a WhatsApp message with UPI pay
// links, and a payment card image with a QR per share.
import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { splitBill, resolveSplit, shareRows, splitMessage, whatsappUrl, validVpa } from "../../lib/split.js";
import { prettyWhen } from "../../lib/when.js";
import { drawPayCard } from "../../lib/paycard.js";
import { shareImage } from "../../lib/shareImage.js";
import { openUrl, shareText, tap, buzz } from "../../lib/order.js";
import { Stepper } from "../Sheet.jsx";
import { Icon } from "../Art.jsx";

const PARTS = [["liquor", "🥃 Liquor"], ["food", "🍽️ Food"], ["supplies", "🛒 Supplies"]];
const rowSub = (r) => `each · ${r.key === "everyone" ? `${r.count} ${r.count === 1 ? "person" : "people"}` : `${r.count} ${r.key === "drinkers" ? "drinking" : "not drinking"}`}`;

export default function SplitCard({ party, setParty, plan, split, setSplit, liquorTotal, zomatoTotal, blinkitTotal, toast }) {
  const [busy, setBusy] = useState(false);
  const totals = { liquor: liquorTotal || 0, food: zomatoTotal || 0, supplies: blinkitTotal || 0 };
  const s = resolveSplit(split, plan);
  const result = splitBill({ ...totals, ...s });
  const rows = shareRows(result);
  const planned = totals.liquor + totals.food + totals.supplies;
  const host = party?.host || "", upi = party?.upi || "";
  const upiOk = validVpa(upi);
  const custom = split?.people != null || split?.drinkers != null;
  const title = (party?.name || "").trim() || "House party";

  const toggle = (k) => { tap(); setSplit((cur) => ({ ...cur, include: { liquor: true, food: true, supplies: true, ...cur?.include, [k]: !(cur?.include?.[k] ?? true) } })); };
  const setPeople = (v) => setSplit((cur) => ({ ...cur, people: v, drinkers: cur?.drinkers != null ? Math.min(cur.drinkers, v) : null }));
  const setField = (k) => (e) => { const v = e.target.value; setParty((p) => ({ ...p, [k]: v })); };
  const message = () => splitMessage({ party, result, include: s.include, host, vpa: upi });

  const whatsapp = () => { tap(); openUrl(whatsappUrl(message())); };
  const shareAny = async () => { if ((await shareText(`${title} — split`, message())) === "copied") toast("Split copied to clipboard"); };
  const payCard = async () => {
    if (busy) return;
    tap(); setBusy(true);
    try {
      const canvas = await drawPayCard({ title, when: prettyWhen(party), host: host.trim(), vpa: upi, rows, result, include: s.include });
      const caption = `${title}: ${rows.map((r) => `${r.label.toLowerCase()} ${fmt(r.amount)}${r.count > 1 ? " each" : ""}`).join(", ")}. UPI: ${upi.trim()}`;
      const res = await shareImage(canvas, "party-split.png", `${title} — split`, caption);
      if (res === "downloaded") toast("Payment card saved as an image");
      else if (res === "shared") buzz();
    } catch (e) {
      toast(`Couldn't make the payment card (${e?.message || e})`);
    } finally {
      setBusy(false);
    }
  };

  const note = s.mode === "fair" && result.total > 0 && rows.length === 1 && (
    result.drinkers === 0 ? "Nobody's drinking, so everyone pays the same."
      : result.drinkers === result.people ? "Everyone's drinking, so everyone pays the same."
        : "No liquor in this split, so everyone pays the same.");

  return (
    <div className="card fade-up">
      <div className="card-title"><span className="kicker">Split the bill</span>{result.total > 0 && <span className="small b">{fmt(result.total)}</span>}</div>

      <div className="row wrap">
        {PARTS.map(([k, label]) => (
          <button key={k} className={`chip ${s.include[k] ? "on" : ""}`} aria-pressed={s.include[k]} onClick={() => toggle(k)}>{label} · {fmt(totals[k])}</button>
        ))}
      </div>
      <div className="tiny dim" style={{ marginTop: 8 }}>Uses your planned prices (Livcheers indicative, Zomato estimates, Blinkit MRP). Bistro is priced in its app, so it isn't included.</div>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field"><label>People</label><Stepper value={s.people} onChange={setPeople} min={1} max={500} /></div>
        <div className="field"><label>Drinking</label><Stepper value={s.drinkers} onChange={(v) => setSplit((cur) => ({ ...cur, drinkers: v }))} min={0} max={s.people} /></div>
      </div>
      {custom && (
        <button className="tiny gold" style={{ marginTop: 8 }} onClick={() => setSplit((cur) => ({ ...cur, people: null, drinkers: null }))}>
          ↺ Use the plan ({plan.guests} guests · {plan.drinkers} drinking)
        </button>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label>How to split</label>
        <div className="seg">
          <button className={s.mode === "equal" ? "on" : ""} onClick={() => setSplit((cur) => ({ ...cur, mode: "equal" }))}>Equal</button>
          <button className={s.mode === "fair" ? "on" : ""} onClick={() => setSplit((cur) => ({ ...cur, mode: "fair" }))}>Fair</button>
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          {s.mode === "fair" ? "Fair: food & supplies split among everyone, liquor split among drinkers only." : "Equal: everyone pays the same share of everything."}
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field"><label>Host</label><input className="input" value={host} onChange={setField("host")} placeholder="Your name" maxLength={40} autoComplete="name" /></div>
        <div className="field">
          <label>UPI ID</label>
          <input className="input" value={upi} onChange={setField("upi")} placeholder="name@okhdfc" maxLength={80}
            inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </div>
      </div>
      <div className={`tiny ${!upi.trim() ? "dim" : upiOk ? "green" : "red"}`} style={{ marginTop: 6 }}>
        {!upi.trim() ? "Add your UPI ID to put pay links and QR codes on the split." : upiOk ? "✓ Pay links on" : "That doesn't look like a UPI ID, e.g. name@okhdfc"}
      </div>

      <div className="sep" />
      {planned === 0 ? (
        <div className="small muted">Nothing planned yet — add bottles and food, then split the bill here.</div>
      ) : result.total === 0 ? (
        <div className="small muted">Switch on liquor, food or supplies above to split them.</div>
      ) : (
        <>
          <div className={`share-amounts ${rows.length > 1 ? "two" : ""}`}>
            {rows.map((r) => (
              <div key={r.key} className="share-amt">
                <div className="kicker">{r.emoji} {r.label}</div>
                <div className="v gold-text">{fmt(r.amount)}</div>
                <div className="tiny muted">{rowSub(r)}</div>
              </div>
            ))}
          </div>
          {note && <div className="tiny muted" style={{ marginTop: 8 }}>{note}</div>}
          <div className="between small" style={{ marginTop: 10 }}><span className="muted">Total · shares rounded up to the rupee</span><b>{fmt(result.total)}</b></div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn share-btn-wa grow" onClick={whatsapp}><Icon.share size={17} /> Share on WhatsApp</button>
            <button className="btn btn-ghost" onClick={shareAny}>Share…</button>
          </div>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} disabled={!upiOk || busy} onClick={payCard}>
            {busy ? <span className="spin">◌</span> : <Icon.grid size={17} />} Share payment card
          </button>
          {!upiOk && <div className="tiny dim" style={{ marginTop: 6, textAlign: "center" }}>Add a valid UPI ID to make a payment card with QR codes.</div>}
        </>
      )}
    </div>
  );
}
