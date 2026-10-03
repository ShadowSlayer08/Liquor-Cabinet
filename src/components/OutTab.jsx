// ═══════════════════════════════════════════════════════════════════════════════
//  OUT TAB — plan a party outside: bars & pubs, club nights, BYOB places and food &
//  drink events near you, booked in District. (v1.5 foundation stub — track B builds it.)
//  Props come from App.jsx; shapes in lib/outModel.js.
// ═══════════════════════════════════════════════════════════════════════════════
import { OUT_KINDS } from "../lib/outModel.js";

export default function OutTab({ out }) {
  return (
    <div className="fade-up">
      <div className="kicker">Bars · clubs · BYOB</div>
      <h1 className="h1">Party <em>out</em></h1>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="muted">Plan a party at a bar, a club night or a BYOB place — {OUT_KINDS.map((k) => k.label).join(", ")}.</div>
        <div className="tiny dim" style={{ marginTop: 6 }}>{out?.active ? "The party is out." : "The party is at home."}</div>
      </div>
    </div>
  );
}
