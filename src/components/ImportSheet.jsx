// [v1.6 · Co-host] A plan from a co-host (a liquorcabinet://plan link, a pasted message or a
// file): preview it, then use theirs, add their items to mine, or keep it in Past parties.
// (Foundation stub — track S builds the preview and the choices.)
// Props (App): input (link / text / file contents), mine (this plan, restoreSnapshot() shape),
// onApply(restored, "replace"|"merge"), onSave(restored), onClose, toast.
import Sheet from "./Sheet.jsx";
import { decodePlan } from "../lib/planShare.js";
import { restoreSnapshot, snapshotSummary } from "../lib/planSnapshot.js";

export default function ImportSheet({ input, onApply, onClose }) {
  let plan = null, error = "";
  try { plan = restoreSnapshot(decodePlan(input)); } catch (e) { error = e?.message || "Couldn't read that plan"; }
  const s = plan && snapshotSummary(plan);
  return (
    <Sheet title="A plan from a co-host" onClose={onClose}>
      {error ? <div className="muted">{error}</div> : (
        <>
          <div className="small">{s.name} · {s.bottles} bottles · {s.dishes} dishes</div>
          <button className="btn btn-gold btn-block" style={{ marginTop: 12 }} onClick={() => onApply(plan, "replace")}>Use their plan</button>
        </>
      )}
    </Sheet>
  );
}
