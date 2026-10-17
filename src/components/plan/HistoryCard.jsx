// [v1.6 · History] Past parties — what was bought and really spent, to start the next plan
// from. A party lands here by itself after its date (App archives it before the date rolls
// on); "Save this party" keeps the current plan now. A row opens HistorySheet: what was
// bought, planned vs actual, how it went, and "Plan again".
// The settle-up is one at a time and usually gets filled in the morning after, when the party
// is already here, so an effect copies it into the party it belongs to (lib/history.js
// attachSettle): clearing the settle-up later doesn't lose the actual spend.
// Props (PlanTab): history, setHistory, snapshot (this plan, snapshotPlan()), settle,
// applyPlan(restored, "replace"|"merge"), saveToHistory(snap, meta), catalog, city, toast.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { readHistory, entryId, plannedSpend, actualSpend, attachSettle } from "../../lib/history.js";
import { hasPlan, snapshotSummary } from "../../lib/planSnapshot.js";
import { prettyDate, todayISO } from "../../lib/drydays.js";
import { fmt, fmtShort } from "../../lib/format.js";
import { tap } from "../../lib/order.js";
import { Icon } from "../Art.jsx";
import HistorySheet from "./HistorySheet.jsx";

const FEW = 3; // rows before "See all"

export default function HistoryCard({ history = [], setHistory, snapshot, settle, applyPlan, saveToHistory, catalog, city, toast }) {
  const [all, setAll] = useState(false);
  const [openId, setOpenId] = useState(null);
  const rows = useMemo(() => readHistory(history), [history]);
  useEffect(() => { if (settle && setHistory) setHistory((h) => attachSettle(h, settle)); }, [settle, setHistory]);

  const canSave = hasPlan(snapshot);
  const saved = Array.isArray(history) && history.some((e) => e?.id === entryId(snapshot));
  const save = () => {
    if (!canSave) { toast("Add bottles, food or a night out first"); return; }
    tap();
    saveToHistory(snapshot, { settle, source: "manual" });
    toast(saved ? "Saved again with your latest plan" : "Saved to Past parties");
  };
  const open = rows.find((r) => r.entry.id === openId);
  const shown = all ? rows : rows.slice(0, FEW);

  return (
    <div className="card fade-up" id="history">
      <div className="card-title"><span className="kicker">Past parties</span><span className="tiny muted">{rows.length || "none yet"}</span></div>

      {rows.length === 0 ? (
        <div className="small muted hist-empty">
          Your parties land here by themselves once their date has passed: what you bought, and what it really cost once you settle up.
          Next time, plan again from one in a tap.
        </div>
      ) : (
        <div className="hist-list">
          {shown.map(({ entry, plan }) => <Row key={entry.id} entry={entry} plan={plan} onOpen={() => { tap(); setOpenId(entry.id); }} />)}
        </div>
      )}
      {rows.length > FEW && (
        <button className="tiny gold hist-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `See all ${rows.length}`}</button>
      )}

      <button className="btn btn-ghost btn-block hist-save" disabled={!canSave} onClick={save}>
        <Icon.plus size={16} /> {saved ? "Save this party again" : "Save this party"}
      </button>
      <div className="tiny dim hist-save-note">
        {!canSave ? "Add bottles, food or a night out to save this plan."
          : saved ? "Already saved: saving again keeps your notes and puts in the latest plan."
            : "Keeps a copy of this plan now. It's saved again by itself after the party."}
      </div>

      {/* The card animates in (.fade-up), which would trap a fixed overlay inside it: the sheet goes to <body>. */}
      {open && createPortal(
        <HistorySheet entry={open.entry} plan={open.plan} current={snapshot} setHistory={setHistory} applyPlan={applyPlan}
          catalog={catalog} city={city} toast={toast} onClose={() => setOpenId(null)} />,
        document.body,
      )}
    </div>
  );
}

function Row({ entry, plan, onOpen }) {
  const s = snapshotSummary(plan);
  const planned = plannedSpend(plan).total;
  const a = actualSpend(entry, plan);
  const head = a.total != null && a.people > 0 ? Math.round(a.total / a.people) : null;
  const d = s.date;
  const thisYear = d && d.slice(0, 4) === todayISO().slice(0, 4);
  const sub = [
    d && !thisYear && d.slice(0, 4),
    s.guests && `${s.guests} ${s.guests === 1 ? "guest" : "guests"}`,
    s.out ? `out at ${s.place}` : s.bottles > 0 && `${s.bottles} ${s.bottles === 1 ? "bottle" : "bottles"}`,
    entry.source === "import" && "a co-host's plan",
  ].filter(Boolean).join(" · ");
  return (
    <button className="hist-row" onClick={onOpen}>
      <div className="hist-day">
        {d ? <><b>{Number(d.slice(8, 10))}</b><span>{prettyDate(d, { month: "short" })}</span></> : <span>no date</span>}
      </div>
      <div className="grow">
        <div className="small b ellipsis">{s.name}</div>
        {sub && <div className="tiny muted ellipsis">{sub}</div>}
        <div className="hist-money tiny">
          <span className="soft">Planned <b>{fmtShort(planned)}</b></span>
          {a.total != null && <span className="gold">Spent <b>{fmtShort(a.total)}</b>{head != null && ` · ${fmt(head)} a head`}</span>}
        </div>
      </div>
      <span className="hist-chev"><Icon.chevron size={16} /></span>
    </button>
  );
}
