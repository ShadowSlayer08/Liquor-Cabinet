// [v1.4.1 · track C] Settle up after the party — the actual bills, who paid them, and the
// fewest payments that square everyone up (lib/settle.js). Opened from the split card or the
// morning-after reminder; with nothing to settle yet it starts from the plan. Each payment
// gets a "Paid" tick and, when the person being paid has a UPI ID, a QR to scan from this
// screen (QR is fine; upi:// links in chats aren't — see split.js).
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Sheet from "./Sheet.jsx";
import {
  PARTS, startSettle, normalizeSettle, settleSummary, settleMessage,
  addPerson, removePerson, patchPerson, patchExpense, addExpense, removeExpense, pasteNames,
} from "../lib/settle.js";
import { upiLink, validVpa, whatsappUrl } from "../lib/split.js";
import { prettyWhen } from "../lib/when.js";
import { fmt } from "../lib/format.js";
import { openUrl, shareText, tap, buzz } from "../lib/order.js";
import { Icon } from "./Art.jsx";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function SettleSheet({ settle, setSettle, party, split, plan, liquorTotal, foodCart, blinkitTotal, toast, onClose }) {
  const fresh = () => startSettle({ party, split, plan, liquorTotal, foodCart, blinkitTotal });
  // Nothing to settle yet: start from the plan, snapshotted now (the party date rolls on later).
  const seed = useRef(null);
  if (!settle && !seed.current) seed.current = fresh();
  useEffect(() => { if (!settle && seed.current) setSettle(seed.current); }, [settle, setSettle]);

  const s = normalizeSettle(settle || seed.current);
  const sum = settleSummary(s);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [qrFor, setQrFor] = useState(null); // transfer key whose QR is open

  const edit = (fn) => setSettle((cur) => fn(cur || seed.current));
  const nameOf = (id) => {
    const i = s.people.findIndex((p) => p.id === id);
    return i < 0 ? "Someone" : s.people[i].name.trim() || `Person ${i + 1}`;
  };
  const net = Object.fromEntries(sum.balances.map((b) => [b.id, b.net]));
  const anyPlanned = s.expenses.some((e) => e.planned);
  const drinking = s.people.filter((p) => p.drinks).length;
  const fairNote = drinking === 0 ? "Fair: nobody's drinking, so everything is split among everyone."
    : drinking === s.people.length ? "Fair: everyone's drinking, so everyone pays the same."
      : "Fair: liquor is split among the drinkers, everything else among everyone.";

  // ── People ──
  const remove = (p) => {
    tap();
    const r = removePerson(s, p.id);
    setSettle(r.settle);
    if (!r.moved) return;
    const bills = plural(r.moved, "bill", "bills"), to = r.settle.people[0].name.trim() || "the first person";
    toast(p.name.trim() ? `${p.name.trim()}'s ${bills} moved to ${to}` : `${bills} moved to ${to}`);
  };
  const applyPaste = () => {
    const r = pasteNames(s, pasteText);
    if (!r.renamed && !r.added) { toast("No new names there"); return; }
    tap();
    setSettle(r.settle);
    setPasting(false); setPasteText("");
    toast([r.renamed && `${plural(r.renamed, "name", "names")} filled in`, r.added && `${r.added} added`].filter(Boolean).join(" · "));
  };

  // ── Payments ──
  const togglePaid = (key) => {
    tap();
    const paid = { ...s.paid };
    if (paid[key]) delete paid[key]; else paid[key] = true;
    setSettle({ ...s, paid });
    const left = sum.transfers.filter((t) => !paid[t.key]).length;
    if (!left && sum.transfers.length) { buzz(); toast("Everyone's paid — all squared up 🎉"); }
  };

  const message = () => settleMessage(s, sum.transfers);
  const whatsapp = () => { tap(); openUrl(whatsappUrl(message())); };
  const shareAny = async () => { if ((await shareText(`${s.title} — settling up`, message())) === "copied") toast("Settle-up copied to clipboard"); };
  const restart = () => {
    if (!confirm("Start again from the plan? Your changes here will be replaced.")) return;
    tap(); setQrFor(null); setSettle(fresh());
  };
  const clear = () => {
    if (!confirm("All settled? This clears the settle-up.")) return;
    tap(); onClose(); setSettle(null); toast("Settle-up cleared");
  };

  const when = prettyWhen(s.when);
  return (
    <Sheet title="Settle up" subtitle={`${s.title}${when ? ` · ${when}` : ""}`} onClose={onClose}
      footer={(
        <div className="row">
          <button className="btn share-btn-wa grow" onClick={whatsapp}><Icon.share size={17} /> Share on WhatsApp</button>
          <button className="btn btn-ghost" onClick={shareAny}>Share…</button>
        </div>
      )}>
      <div id="settle">
        <div className="out-total">
          <div>
            <div className="kicker">Actual total</div>
            <div className="h2 gold-text">{fmt(sum.total)}</div>
          </div>
          <div className="tiny muted" style={{ textAlign: "right" }}>
            {plural(s.people.length, "person", "people")}<br />
            {sum.transfers.length ? `${sum.paid} of ${plural(sum.transfers.length, "payment", "payments")} done` : "nothing to pay yet"}
          </div>
        </div>
        {anyPlanned && <div className="note note-warn" style={{ marginTop: 10 }}>Started from your plan. Change each bill to what was actually paid, and who paid it.</div>}

        {/* ── Bills ── */}
        <div className="out-sec"><span className="kicker">Bills</span></div>
        {s.expenses.map((e) => {
          const payer = s.people.some((p) => p.id === e.paidBy) ? e.paidBy : s.people[0]?.id;
          return (
            <div key={e.id} className="out-bill">
              <div className="row">
                <input className="input grow" value={e.what} placeholder="What for" maxLength={40} aria-label="What the bill was for"
                  onChange={(ev) => { const v = ev.target.value; edit((cur) => patchExpense(cur, e.id, { what: v })); }} />
                <label className="out-amt">
                  <span>₹</span>
                  <input className="input" inputMode="numeric" value={e.amount ? String(e.amount) : ""} placeholder="0" aria-label="Amount paid"
                    onChange={(ev) => { const v = ev.target.value.replace(/\D/g, ""); edit((cur) => patchExpense(cur, e.id, { amount: v })); }} />
                </label>
                <button className="bar-x" aria-label="Remove bill" onClick={() => { tap(); edit((cur) => removeExpense(cur, e.id)); }}><Icon.close size={14} /></button>
              </div>
              {e.planned && <span className="pill out-planned">planned · edit to what was actually paid</span>}
              <div className="seg out-parts">
                {Object.entries(PARTS).map(([k, part]) => (
                  <button key={k} className={e.part === k ? "on" : ""} aria-pressed={e.part === k}
                    onClick={() => edit((cur) => patchExpense(cur, e.id, { part: k }))}>{part.emoji} {part.label}</button>
                ))}
              </div>
              <div className="out-paidby">
                <span className="tiny muted">Paid by</span>
                <div className="chips out-chips">
                  {s.people.map((p, i) => (
                    <button key={p.id} className={`chip ${payer === p.id ? "on" : ""}`} aria-pressed={payer === p.id}
                      onClick={() => edit((cur) => patchExpense(cur, e.id, { paidBy: p.id }))}>{p.name.trim() || `Person ${i + 1}`}</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn btn-ghost btn-sm btn-block" onClick={() => { tap(); edit(addExpense); }}><Icon.plus size={14} /> Add a bill</button>

        {/* ── People ── */}
        <div className="out-sec">
          <span className="kicker">People · {s.people.length}</span>
          <button className="tiny gold" onClick={() => setPasting((v) => !v)}>{pasting ? "Cancel" : "Paste names"}</button>
        </div>
        {pasting && (
          <div className="out-paste">
            <textarea className="input" rows={3} value={pasteText} placeholder={"Riya, Kabir, Meera\n— or one name per line, straight from your chat"}
              onChange={(ev) => setPasteText(ev.target.value)} />
            <div className="tiny muted" style={{ margin: "6px 0 8px" }}>Names fill in the "Guest" rows in order; extra names are added.</div>
            <button className="btn btn-gold btn-sm btn-block" disabled={!pasteText.trim()} onClick={applyPaste}>Use these names</button>
          </div>
        )}
        {s.people.map((p, i) => {
          const showUpi = net[p.id] > 0 || p.upi.trim();
          const bad = p.upi.trim() && !validVpa(p.upi);
          return (
            <div key={p.id} className="out-person">
              <div className="row">
                <input className="input grow" value={p.name} placeholder={`Person ${i + 1}`} maxLength={40} aria-label="Name"
                  onChange={(ev) => { const v = ev.target.value; edit((cur) => patchPerson(cur, p.id, { name: v })); }} />
                <button className={`chip out-drink ${p.drinks ? "on" : ""}`} aria-pressed={p.drinks}
                  onClick={() => { tap(); edit((cur) => patchPerson(cur, p.id, { drinks: !p.drinks })); }}>{p.drinks ? "🥃 Drinking" : "🥤 Not drinking"}</button>
                {s.people.length > 1 && (
                  <button className="bar-x" aria-label={`Remove ${p.name.trim() || `person ${i + 1}`}`} onClick={() => remove(p)}><Icon.close size={14} /></button>
                )}
              </div>
              {showUpi && (
                <>
                  <input className="input out-upi" value={p.upi} placeholder="UPI ID to get paid (optional), e.g. name@okhdfc" maxLength={80}
                    inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="UPI ID"
                    onChange={(ev) => { const v = ev.target.value; edit((cur) => patchPerson(cur, p.id, { upi: v })); }} />
                  {bad && <div className="tiny red" style={{ marginTop: 4 }}>That doesn't look like a UPI ID, e.g. name@okhdfc</div>}
                </>
              )}
            </div>
          );
        })}
        <button className="btn btn-ghost btn-sm btn-block" onClick={() => { tap(); edit((cur) => addPerson(cur)); }}><Icon.plus size={14} /> Add person</button>

        <div className="field" style={{ marginTop: 18 }}>
          <label>How to split</label>
          <div className="seg">
            <button className={s.mode === "equal" ? "on" : ""} onClick={() => edit((cur) => ({ ...normalizeSettle(cur), mode: "equal" }))}>Equal</button>
            <button className={s.mode === "fair" ? "on" : ""} onClick={() => edit((cur) => ({ ...normalizeSettle(cur), mode: "fair" }))}>Fair</button>
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {s.mode === "fair" ? fairNote : "Equal: everyone pays the same share of everything."}
          </div>
        </div>

        {/* ── Result ── */}
        <div className="out-sec"><span className="kicker">Who owes whom</span></div>
        {sum.total === 0 ? (
          <div className="small muted">Enter what each bill actually came to, and who paid it.</div>
        ) : (
          <>
            <div className="out-bals">
              {sum.balances.map((b) => (
                <div key={b.id} className="out-bal">
                  <div className="grow">
                    <div className="small b ellipsis">{nameOf(b.id)}</div>
                    <div className="tiny muted">paid {fmt(b.paid / 100)} · share {fmt(b.share / 100)}</div>
                  </div>
                  {Math.abs(b.net) < 100
                    ? <span className="small dim">square</span>
                    : b.net > 0
                      ? <span className="small b green">gets back {fmt(b.net / 100)}</span>
                      : <span className="small b red">owes {fmt(-b.net / 100)}</span>}
                </div>
              ))}
            </div>

            {sum.transfers.length === 0 ? (
              <div className="note note-ok" style={{ marginTop: 12 }}>Everyone's square, nothing to pay 🎉</div>
            ) : (
              <div className="out-pays">
                {sum.transfers.map((t) => {
                  const to = s.people.find((p) => p.id === t.to);
                  const canQr = to && validVpa(to.upi);
                  const done = !!s.paid[t.key];
                  return (
                    <div key={t.key} className={`out-pay ${done ? "paid" : ""}`}>
                      <div className="row">
                        <button className={`check ${done ? "on" : ""}`} role="checkbox" aria-checked={done} aria-label="Paid" onClick={() => togglePaid(t.key)}>
                          {done && <Icon.check size={14} />}
                        </button>
                        <div className="grow small"><b>{nameOf(t.from)}</b> <span className="muted">pays</span> <b>{nameOf(t.to)}</b></div>
                        <b className="gold">{fmt(t.amount)}</b>
                        {canQr && !done && (
                          <button className="btn btn-ghost btn-xs" aria-expanded={qrFor === t.key} onClick={() => { tap(); setQrFor((k) => (k === t.key ? null : t.key)); }}>
                            {qrFor === t.key ? "Hide QR" : "Show QR"}
                          </button>
                        )}
                      </div>
                      {canQr && !done && qrFor === t.key && <UpiQr vpa={to.upi} name={nameOf(t.to)} amount={t.amount} note={s.title} />}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="tiny dim" style={{ marginTop: 8 }}>
              Rounded to the rupee. Tick a payment once it's made.{sum.transfers.some((t) => !validVpa(s.people.find((p) => p.id === t.to)?.upi)) ? " Add a UPI ID to someone who gets money back to show a QR for it." : ""}
            </div>
          </>
        )}

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm grow" onClick={restart}>↺ Start again from the plan</button>
          <button className="btn btn-ghost btn-sm grow" onClick={clear}>✓ All settled: clear</button>
        </div>
      </div>
    </Sheet>
  );
}

// A UPI QR for one payment, big enough to scan off this screen with GPay / PhonePe / Paytm.
function UpiQr({ vpa, name, amount, note }) {
  const text = upiLink({ vpa, name, amount, note });
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    setSrc(null);
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 480, color: { dark: "#1a1210", light: "#ffffff" } })
      .then((url) => { if (live) setSrc(url); })
      .catch(() => { if (live) setSrc("failed"); });
    return () => { live = false; };
  }, [text]);
  return (
    <div className="out-qr">
      {src === "failed"
        ? <div className="small muted">Couldn't draw the QR — pay {vpa.trim()} directly.</div>
        : src ? <img src={src} alt={`UPI QR: pay ${fmt(amount)} to ${name}`} /> : <div className="skel out-qr-skel" />}
      <div className="tiny muted" style={{ marginTop: 8 }}>Scan in any UPI app to pay <b>{fmt(amount)}</b> to {name} · {vpa.trim()}</div>
    </div>
  );
}
