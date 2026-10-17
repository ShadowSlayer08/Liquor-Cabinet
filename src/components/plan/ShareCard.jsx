// [v1.6 · Co-host] Send this plan to a co-host as a QR code, link or file — no server —
// and import theirs. (Foundation stub — track S builds the QR, file and import controls.)
// Props (PlanTab): snapshot (this plan, shareable: snapshotPlan(…, { share: true })), openImport(text), toast.
export default function ShareCard() {
  return (
    <div className="card fade-up" id="share">
      <div className="card-title"><span className="kicker">Plan with a co-host</span></div>
      <div className="tiny muted">Send your plan as a QR code or a file.</div>
    </div>
  );
}
