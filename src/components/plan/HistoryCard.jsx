// [v1.6 · History] Past parties — what was bought and really spent, to start the next plan
// from. (Foundation stub — track H builds the list, the detail sheet and "Plan again".)
// Props (PlanTab): history, setHistory, snapshot (this plan, snapshotPlan()), settle,
// applyPlan(restored, "replace"|"merge"), catalog, city, toast.
import { snapshotSummary } from "../../lib/planSnapshot.js";

export default function HistoryCard({ history = [] }) {
  return (
    <div className="card fade-up" id="history">
      <div className="card-title"><span className="kicker">Past parties</span><span className="tiny muted">{history.length || "none yet"}</span></div>
      {history.slice(0, 3).map((e) => {
        const s = snapshotSummary(e.snapshot);
        return <div key={e.id} className="small">{s.name} · {s.date || "no date"}</div>;
      })}
    </div>
  );
}
