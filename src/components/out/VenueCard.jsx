// [v1.5 · Out] A bar or BYOB place in the list: an illustration (never a photo), the cost as
// the venue's own estimate, District's offer, and why it suits the party (lib/out.js rankVenues).
import { VenueArt, Icon } from "../Art.jsx";
import { costForTwoText, countText, kmText, offerText, timingText } from "../../lib/out.js";
import { fmt } from "../../lib/format.js";

export default function VenueCard({ v, kind, picked, budget, onOpen, delay = 0 }) {
  const km = kmText(v.distanceKm);
  const timing = timingText(v.timing);
  const why = (v.reasons || []).filter((r) => r !== km && !r.startsWith("Closed"));
  return (
    <button className={`ot-card fade-up ${picked ? "on" : ""} ${v.closed ? "off" : ""}`} style={{ animationDelay: `${Math.min(delay, 12) * 35}ms` }}
      onClick={() => onOpen(v)} aria-label={`${v.name}${v.reasons?.length ? ` — ${v.reasons.join(", ")}` : ""}`}>
      <VenueArt kind={kind} size={58} />
      <span className="grow ot-card-body">
        <span className="ot-card-top">
          <span className="ot-name ellipsis">{v.name}</span>
          {typeof v.rating === "number" && v.rating > 0 && (
            <span className="ot-rate"><Icon.star size={10} /> {v.rating.toFixed(1)}{v.votes ? <span className="ot-votes"> ({countText(v.votes)})</span> : null}</span>
          )}
        </span>
        {(v.locality || km) && <span className="tiny muted ellipsis">{[v.locality, km].filter(Boolean).join(" · ")}</span>}
        <span className="ot-cost ellipsis">{costForTwoText(v.costForTwo)}{timing ? <span className="dim"> · {timing}</span> : null}</span>
        <span className="ot-tags">
          {picked && <span className="pill ot-pill-pick"><Icon.check size={10} /> The party</span>}
          {v.closed && <span className="pill ot-pill-over">Closed that day</span>}
          {v.fit === "over" && <span className="pill ot-pill-over">Over {fmt(budget)} a head</span>}
          {v.offer && <span className="pill ot-pill-offer">{offerText(v.offer)} · District</span>}
          {why.slice(0, 2).map((r) => <span key={r} className="pill ot-pill-why">{r}</span>)}
        </span>
      </span>
    </button>
  );
}
