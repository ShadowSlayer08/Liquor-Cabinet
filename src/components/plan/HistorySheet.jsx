// [v1.6 · History] One past party: what was bought, planned vs actually spent (each labelled
// for what it is), how it went (bottles left over and what ran out, per spirit family, plus
// a note), and "Plan again from this" / "Add to my plan".
// What the host types here goes straight into the entry (lib/history.js updateOutcome);
// saving the same party again never replaces it. Planning again goes through
// lib/history.js replayPlan(): today's prices, leftovers off the list, a bit more of what
// ran out, each change in plain words before anything is replaced.
// Props (HistoryCard): entry, plan (its checked plan), current (this plan, snapshotPlan()),
// setHistory, applyPlan(restored, "replace"|"merge"), catalog, city, toast, onClose.
import { useMemo, useState } from "react";
import Sheet, { Qty } from "../Sheet.jsx";
import {
  actualSpend, plannedSpend, boughtFamilies, normalizeOutcome, withLeftover, withRanOut, updateOutcome, removeEntry, replayPlan,
} from "../../lib/history.js";
import { hasPlan, snapshotSummary } from "../../lib/planSnapshot.js";
import { isOut } from "../../lib/outModel.js";
import { COCKTAIL } from "../../lib/cocktails.js";
import { CAT, cityName } from "../../lib/parse/livcheers.js";
import { prettyTime } from "../../lib/when.js";
import { prettyDate, todayISO } from "../../lib/drydays.js";
import { fmt } from "../../lib/format.js";
import { tap } from "../../lib/order.js";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function HistorySheet({ entry, plan, current, setHistory, applyPlan, catalog, city, toast, onClose }) {
  const [ask, setAsk] = useState(null);   // "replace" | "delete": the confirm on screen
  const [busy, setBusy] = useState(false);
  const outcome = normalizeOutcome(entry.outcome, plan);
  const fams = useMemo(() => boughtFamilies(plan), [plan]);
  const replay = useMemo(() => { try { return replayPlan(entry, { catalog, city }); } catch { return null; } }, [entry, catalog, city]);
  const sum = snapshotSummary(plan);
  const planned = plannedSpend(plan);
  const actual = actualSpend(entry, plan);
  const fromSettle = actualSpend({ ...entry, outcome: { ...outcome, spent: null } }, plan); // what the settle-up says on its own
  const head = actual.total != null && actual.people > 0 ? Math.round(actual.total / actual.people) : null;
  const mine = snapshotSummary(current);
  const away = isOut(plan.out);
  const edit = (change) => setHistory((h) => updateOutcome(h, entry.id, change));

  // ── What was bought ──
  const bottles = Object.values(plan.liquor);
  const zomato = plan.food.filter((l) => l.kind === "zomato");
  const bistro = plan.food.filter((l) => l.kind === "bistro");
  const supplies = plan.food.filter((l) => l.kind === "blinkit");
  const tickets = away ? (plan.out.tickets || []).filter((t) => t.qty > 0) : [];

  // ── Money, labelled honestly ──
  const plannedNote = away
    ? [planned.venue != null && "the venue's estimate", planned.tickets > 0 && "tickets as planned", planned.liquor > 0 && "bottles you'd bring"].filter(Boolean).join(", ") || "nothing priced"
    : `Livcheers prices (indicative), Zomato estimates, supplies at MRP${planned.bistro ? "; Bistro not included" : ""}`;
  const people = actual.people ? ` · ${plural(actual.people, "person", "people")}` : "";
  const actualNote = actual.source === "settle"
    ? `from your settle-up${people}${actual.planned ? ` · ${plural(actual.planned, "bill")} still at the planned figure` : ""}`
    : actual.source === "you" ? `as you entered it${people}`
      : "Settle up after a party, or add it below";
  const diff = actual.total != null && planned.total > 0 ? actual.total - planned.total : null;

  // ── Plan again ──
  const go = async (mode) => {
    if (!replay || busy) return;
    tap();
    setBusy(true);
    try {
      await applyPlan(replay, mode);
      toast(mode === "merge" ? `Added ${sum.name}'s bottles, food and drinks to your plan` : `Planning again from ${sum.name}: it's set for the coming Saturday`);
      onClose();
    } catch {
      setBusy(false);
      toast("Couldn't open that party");
    }
  };
  const del = () => {
    tap();
    setHistory((h) => removeEntry(h, entry.id));
    toast("Deleted from Past parties");
    onClose();
  };

  const d = plan.party.date;
  const when = d ? [prettyDate(d, d.slice(0, 4) === todayISO().slice(0, 4) ? undefined : { day: "numeric", month: "short", year: "numeric" }), prettyTime(plan.party.time)].filter(Boolean).join(" · ") : "No date";
  const subtitle = [when, sum.guests && plural(sum.guests, "guest"), plan.city && cityName(plan.city)].filter(Boolean).join(" · ");
  const mineText = [mine.bottles && plural(mine.bottles, "bottle"), mine.dishes && plural(mine.dishes, "dish", "dishes"),
    mine.supplies && plural(mine.supplies, "supply", "supplies"), mine.out && mine.place].filter(Boolean).join(", ");

  const footer = ask === "replace" ? (
    <div>
      <div className="small hist-ask">This replaces your current plan{mineText ? ` (${mineText})` : ""} with {sum.name}. Your name and UPI ID stay.</div>
      <div className="hist-acts">
        <button className="btn btn-gold" disabled={busy} onClick={() => go("replace")}>{busy ? <span className="spin">◌</span> : null} Replace my plan</button>
        <button className="btn btn-ghost" onClick={() => setAsk(null)}>Cancel</button>
      </div>
    </div>
  ) : (
    <div className="hist-acts">
      <button className="btn btn-gold" disabled={!replay || busy} onClick={() => (hasPlan(current) ? (tap(), setAsk("replace")) : go("replace"))}>Plan again from this</button>
      <button className="btn btn-ghost" disabled={!replay || busy} onClick={() => go("merge")}>Add to my plan</button>
    </div>
  );

  return (
    <Sheet title={sum.name} subtitle={subtitle} onClose={onClose} footer={footer}>
      <div className="hist-sheet">
        {/* ── Planned vs actual ── */}
        <div className="hist-totals">
          <div className="hist-total">
            <div className="kicker">Planned</div>
            <div className="h2">{fmt(planned.total)}</div>
            <div className="tiny muted">{plannedNote}</div>
          </div>
          <div className="hist-total">
            <div className="kicker">Actually spent</div>
            {actual.total != null ? <div className="h2 gold-text">{fmt(actual.total)}</div> : <div className="h2 dim">Not known</div>}
            <div className="tiny muted">{actualNote}</div>
          </div>
        </div>
        {actual.total != null && (
          <div className="between small hist-head">
            <span className="muted">{head != null ? `${fmt(head)} a head` : ""}</span>
            {diff != null && <span className={diff > 0 ? "red" : "green"}>{diff === 0 ? "right on plan" : `${fmt(Math.abs(diff))} ${diff > 0 ? "over" : "under"} plan`}</span>}
          </div>
        )}
        {planned.homeLeftOut && <div className="tiny dim hist-head">A night out: the bottles and food in the carts below weren't counted in the plan.</div>}

        {/* ── What was bought ── */}
        {bottles.length > 0 && (
          <>
            <div className="hist-sec"><span className="kicker">Bottles · {sum.bottles}</span><span className="small b">{fmt(sum.bottleCost)}</span></div>
            {bottles.map((l) => (
              <div key={`${l.cat}:${l.item.id}`} className="hist-line">
                <span className="hist-emo" aria-hidden="true">{CAT[l.cat]?.emoji || "🍾"}</span>
                <div className="grow">
                  <div className="small ellipsis">{l.qty} × {l.item.name}</div>
                  <div className="tiny muted">{[l.item.vol, `${fmt(l.item.price)} each`].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="small b">{fmt(l.item.price * l.qty)}</span>
              </div>
            ))}
          </>
        )}

        {plan.cocktailMenu.length > 0 && (
          <>
            <div className="hist-sec"><span className="kicker">Drinks menu</span></div>
            <div className="hist-tags">
              {plan.cocktailMenu.map((m) => (
                <span key={m.id} className="pill hist-pill">{COCKTAIL[m.id]?.emoji} {COCKTAIL[m.id]?.name || m.id} × {m.servings}</span>
              ))}
            </div>
          </>
        )}

        {(zomato.length > 0 || bistro.length > 0 || supplies.length > 0) && (
          <>
            <div className="hist-sec"><span className="kicker">Food & supplies</span>{sum.foodCost > 0 && <span className="small b">{fmt(sum.foodCost)}</span>}</div>
            {zomato.map((l) => (
              <div key={l.key} className="hist-line">
                <span className="hist-emo" aria-hidden="true">{l.emoji || "🍽️"}</span>
                <div className="grow">
                  <div className="small ellipsis">{l.qty} × {l.name}</div>
                  <div className="tiny muted ellipsis">{l.restaurant.name || "Zomato"} · {l.exact ? "Zomato price" : "Zomato estimate"}</div>
                </div>
                <span className="small b">{l.unitPrice ? fmt(l.unitPrice * l.qty) : "on Zomato"}</span>
              </div>
            ))}
            {bistro.map((l) => (
              <div key={l.key} className="hist-line">
                <span className="hist-emo" aria-hidden="true">{l.emoji || "🍱"}</span>
                <div className="grow"><div className="small ellipsis">{l.qty} × {l.name}</div><div className="tiny muted">Bistro</div></div>
                <span className="tiny muted">price in app</span>
              </div>
            ))}
            {supplies.map((l) => (
              <div key={l.key} className="hist-line">
                <span className="hist-emo" aria-hidden="true">{l.emoji || "🛒"}</span>
                <div className="grow">
                  <div className="small ellipsis">{l.qty} × {l.product.name || l.name}</div>
                  <div className="tiny muted">{[l.product.packText, "usual MRP"].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="small b">{fmt(l.product.price * l.qty)}</span>
              </div>
            ))}
          </>
        )}

        {away && (
          <>
            <div className="hist-sec"><span className="kicker">Night out</span></div>
            <div className="hist-line">
              <span className="hist-emo" aria-hidden="true">{plan.out.pick.type === "event" ? "🎟️" : "📍"}</span>
              <div className="grow">
                <div className="small ellipsis">{plan.out.pick.name}</div>
                <div className="tiny muted ellipsis">
                  {[plan.out.pick.type === "event" ? plan.out.pick.venue : plan.out.pick.locality, plan.out.booked && "booked on District"].filter(Boolean).join(" · ") || "on District"}
                </div>
              </div>
              {planned.venue != null && <span className="small b">{fmt(planned.venue)}</span>}
            </div>
            {tickets.map((t, i) => (
              <div key={t.id || i} className="hist-line">
                <span className="hist-emo" aria-hidden="true">🎟️</span>
                <div className="grow"><div className="small ellipsis">{t.qty} × {t.name}</div><div className="tiny muted">tickets as planned</div></div>
                <span className="small b">{fmt(t.price * t.qty)}</span>
              </div>
            ))}
          </>
        )}

        {!bottles.length && !plan.food.length && !plan.cocktailMenu.length && !away && (
          <div className="small muted hist-head">Nothing was in this plan.</div>
        )}

        {/* ── How it went ── */}
        <div className="hist-sec"><span className="kicker">How it went</span>{outcome.editedAt > 0 && <span className="tiny dim">saved</span>}</div>
        <div className="field">
          <label htmlFor="hist-spent">Actually spent, in all</label>
          <div className="hist-amt">
            <span>₹</span>
            <input id="hist-spent" className="input" inputMode="numeric" value={outcome.spent ?? ""} aria-label="What the party actually cost"
              placeholder={fromSettle.total != null ? String(fromSettle.total) : "not known"}
              onChange={(ev) => { const v = ev.target.value.replace(/\D/g, "").slice(0, 8); edit((o) => ({ ...o, spent: v ? Number(v) : null })); }} />
          </div>
          <div className="tiny muted hist-help">
            {fromSettle.total != null ? `Your settle-up says ${fmt(fromSettle.total)}. Type a total only if it was different.` : "Leave it empty if you don't know. Nothing is guessed."}
          </div>
        </div>

        {fams.length > 0 && (
          <>
            <div className="tiny muted hist-help">Bottles left over, or what ran out. Planning again uses these.</div>
            {fams.map((f) => {
              const left = outcome.left[f.id] || 0, ran = outcome.ranOut.includes(f.id);
              return (
                <div key={f.id} className="hist-fam">
                  <div className="grow">
                    <div className="small b ellipsis">{f.label}</div>
                    <div className="tiny muted ellipsis">{f.bottles} bought · {f.lines.length === 1 ? f.lines[0].name : `${f.lines.length} kinds`}</div>
                  </div>
                  <div className="hist-left">
                    <Qty value={left} onChange={(n) => edit((o) => withLeftover(o, f.id, Math.min(n, f.bottles)))} />
                    <span className="tiny muted">left over</span>
                  </div>
                  <button className={`chip hist-ran ${ran ? "on" : ""}`} aria-pressed={ran} onClick={() => { tap(); edit((o) => withRanOut(o, f.id, !ran)); }}>
                    Ran out
                  </button>
                </div>
              );
            })}
          </>
        )}

        <div className="field hist-note-field">
          <label htmlFor="hist-note">Note</label>
          <textarea id="hist-note" className="input hist-note" rows={2} maxLength={200} value={outcome.note}
            placeholder="e.g. Ice ran out by 11, nobody touched the rosé"
            onChange={(ev) => { const v = ev.target.value; edit((o) => ({ ...o, note: v })); }} />
        </div>

        {/* ── Plan again ── */}
        <div className="hist-sec"><span className="kicker">If you plan again from this</span></div>
        {replay ? (
          <ul className="hist-notes">{replay.notes.map((n, i) => <li key={i}>{n}.</li>)}</ul>
        ) : (
          <div className="small muted">This party can't be planned again.</div>
        )}
        <div className="tiny dim hist-help">
          <b>Plan again</b> replaces your plan with this one. <b>Add to my plan</b> keeps your party details and adds its bottles, food and drinks to yours.
        </div>

        <div className="hist-foot">
          {ask === "delete" ? (
            <div className="row">
              <span className="small grow">Delete {sum.name} from Past parties?</span>
              <button className="btn btn-ghost btn-sm red" onClick={del}>Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAsk(null)}>Keep</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm btn-block" onClick={() => { tap(); setAsk("delete"); }}>Delete this party</button>
          )}
          <div className="tiny dim hist-saved">
            {entry.source === "auto" ? "Saved by itself after the party" : entry.source === "import" ? "A co-host's plan you kept" : "Saved by you"}
            {Number(entry.savedAt) > 0 ? ` · ${prettyDate(todayISO(new Date(entry.savedAt)))}` : ""} · kept on this phone only
          </div>
        </div>
      </div>
    </Sheet>
  );
}
