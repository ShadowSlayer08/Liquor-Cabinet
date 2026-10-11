// [v1.3 · item 5] Split the bill — per-person shares, a WhatsApp message with UPI pay
// links, and a payment card image with a QR per share.
// v1.5: a party out adds the venue (its own estimate) and the planned tickets, split among
// everyone (lib/split.js). The home carts don't come along (homeParts) — only a BYOB night's
// bottles — so they're counted as ₹0 rather than switched off in the shared split settings,
// which the next party at home would inherit. id="split": the Out tab's shortcut scrolls here.
import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { splitBill, resolveSplit, shareRows, splitMessage, splitParts, whatsappUrl, validVpa, homeParts } from "../../lib/split.js";
import { isOut, outSpend } from "../../lib/outModel.js";
import { outVenueName } from "../../lib/rides.js";
import { prettyWhen } from "../../lib/when.js";
import { drawPayCard } from "../../lib/paycard.js";
import { settleSummary } from "../../lib/settle.js";
import { shareImage } from "../../lib/shareImage.js";
import { openUrl, shareText, tap, buzz } from "../../lib/order.js";
import { Stepper } from "../Sheet.jsx";
import { Icon } from "../Art.jsx";

const PARTS = [["liquor", "🥃 Liquor"], ["food", "🍽️ Food"], ["supplies", "🛒 Supplies"]];
const rowSub = (r) => `each · ${r.key === "everyone" ? `${r.count} ${r.count === 1 ? "person" : "people"}` : `${r.count} ${r.key === "drinkers" ? "drinking" : "not drinking"}`}`;

export default function SplitCard({ party, setParty, plan, split, setSplit, liquorTotal, zomatoTotal, blinkitTotal, toast, settle, openSettle, out }) {
  const [busy, setBusy] = useState(false);
  const s = resolveSplit(split, plan);
  const away = isOut(out);
  const spend = outSpend(out, s.people); // venue: the venue's estimate for everyone splitting; tickets: as planned
  const home = homeParts(out);            // a night out leaves the home carts out, bar a BYOB night's bottles
  const totals = {
    liquor: home.liquor ? liquorTotal || 0 : 0, food: home.food ? zomatoTotal || 0 : 0, supplies: home.supplies ? blinkitTotal || 0 : 0,
    venue: spend.venue || 0, tickets: spend.tickets,
  };
  const result = splitBill({ ...totals, ...s });
  const rows = shareRows(result);
  const planned = totals.liquor + totals.food + totals.supplies + totals.venue + totals.tickets;
  const parts = splitParts(s.include, totals, away); // what the labels name
  const on = (k) => s.include[k] !== false;
  const chips = away ? [
    ...(spend.venue != null ? [["venue", "📍 Venue estimate"]] : []),
    ...(spend.tickets > 0 ? [["tickets", "🎟️ Tickets as planned"]] : []),
    ...(totals.liquor > 0 ? [["liquor", "🍾 Bottles you bring"]] : []),
  ] : PARTS;
  // The home carts a night out leaves out, for the note under the chips.
  const leftHome = away ? [!home.liquor && liquorTotal > 0 && "bottles", zomatoTotal > 0 && "food", blinkitTotal > 0 && "supplies"].filter(Boolean) : [];
  const venue = outVenueName(out);
  const host = party?.host || "", upi = party?.upi || "";
  const upiOk = validVpa(upi);
  const custom = split?.people != null || split?.drinkers != null;
  const title = (party?.name || "").trim() || (away ? "Night out" : "House party");
  const settleNow = settleSummary(settle); // null when there's no settle-up

  const toggle = (k) => { tap(); setSplit((cur) => ({ ...cur, include: { liquor: true, food: true, supplies: true, ...cur?.include, [k]: !(cur?.include?.[k] ?? true) } })); };
  // resolveSplit() caps drinkers at people on every render, so a custom drinker count survives typing.
  const setPeople = (v) => setSplit((cur) => ({ ...cur, people: v }));
  const setField = (k) => (e) => { const v = e.target.value; setParty((p) => ({ ...p, [k]: v })); };
  const message = () => splitMessage({ party, result, include: parts, host, vpa: upi, venue });

  const whatsapp = () => { tap(); openUrl(whatsappUrl(message())); };
  const shareAny = async () => { if ((await shareText(`${title} — split`, message())) === "copied") toast("Split copied to clipboard"); };
  const payCard = async () => {
    if (busy) return;
    tap(); setBusy(true);
    try {
      const canvas = await drawPayCard({ title, when: prettyWhen(party), host: host.trim(), vpa: upi, rows, result, include: parts });
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

  // What the venue and ticket figures are, in plain words (a night out only).
  const cft = away ? out.pick.costForTwo : null;
  const outNote = away && [
    spend.venue != null && `The venue's own estimate is ${fmt(cft)} for two, so about ${fmt(cft / 2)} a head; the real bill comes at the table.`,
    spend.venue == null && out.pick.type === "venue" && "The venue hasn't given a cost for two, so it isn't in the split; add the real bill when you settle up.",
    spend.tickets > 0 && "Tickets are at District's prices when you planned them, before its fee.",
    out.pick.type === "event" && !(spend.tickets > 0) && "Plan tickets in the Out tab to split them here.",
    totals.liquor > 0 && "Bottles you bring are at Livcheers' indicative prices.",
    leftHome.length > 0 && `Your carts (${leftHome.length > 1 ? `${leftHome.slice(0, -1).join(", ")} & ${leftHome[leftHome.length - 1]}` : leftHome[0]}) aren't counted on a night out.`,
  ].filter(Boolean).join(" ");

  return (
    <div className="card fade-up" id="split">
      <div className="card-title"><span className="kicker">Split the bill</span>{result.total > 0 && <span className="small b">{fmt(result.total)}</span>}</div>

      {chips.length > 0 && (
        <div className="row wrap">
          {chips.map(([k, label]) => (
            <button key={k} className={`chip ${on(k) ? "on" : ""}`} aria-pressed={on(k)} onClick={() => toggle(k)}>{label} · {fmt(totals[k])}</button>
          ))}
        </div>
      )}
      <div className="tiny dim" style={{ marginTop: 8 }}>
        {away ? outNote || "Pick a venue with a cost for two, or plan tickets in the Out tab, to split them here."
          : "Uses your planned prices (Livcheers indicative, Zomato estimates, Blinkit MRP). Bistro is priced in its app, so it isn't included."}
      </div>

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
          {s.mode !== "fair" ? "Equal: everyone pays the same share of everything."
            : away ? `Fair: the venue and tickets split among everyone${home.liquor ? ", bottles you bring among drinkers only" : ""}.`
              : "Fair: food & supplies split among everyone, liquor split among drinkers only."}
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
        {!upi.trim() ? "Add your UPI ID so guests can pay you, with QR codes on the payment card." : upiOk ? "✓ UPI ID added" : "That doesn't look like a UPI ID, e.g. name@okhdfc"}
      </div>

      <div className="sep" />
      {planned === 0 ? (
        <div className="small muted">{away ? "Nothing to split yet — the venue's estimate or your planned tickets show up here." : "Nothing planned yet — add bottles and food, then split the bill here."}</div>
      ) : result.total === 0 ? (
        <div className="small muted">{away ? "Switch on a part above to split it." : "Switch on liquor, food or supplies above to split them."}</div>
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

      {/* v1.4.1 · after the party: the actual bills, who paid, who owes whom (SettleSheet) */}
      <div className="sep" />
      {settleNow && !settleNow.done ? (
        <div className="out-settle-line">
          <span className="grow small">🧾 Settle-up in progress · <b>{settleNow.paid} of {settleNow.transfers.length}</b> paid</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { tap(); openSettle?.(); }}>Open</button>
        </div>
      ) : (
        <>
          <button className="btn btn-ghost btn-block" onClick={() => { tap(); openSettle?.(); }}>🧾 Settle up with actual amounts</button>
          <div className="tiny dim" style={{ marginTop: 6, textAlign: "center" }}>
            {settleNow?.transfers.length ? "✓ Everyone's paid on your last settle-up." : "After the party: enter what was really paid, and by whom."}
          </div>
        </>
      )}
    </div>
  );
}
