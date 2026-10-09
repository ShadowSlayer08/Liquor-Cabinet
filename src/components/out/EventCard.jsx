// [v1.5 · Out] A club night or food & drink event from District's listing: when, where, the
// cheapest ticket District lists and how far it is (lib/out.js eventsForDate). A run over
// several weeks that takes in the party's date gets a softer pill than a night that's on it:
// its page says which nights it's on. No photos.
import { VenueArt, Icon } from "../Art.jsx";
import { eventPriceText, eventWhenText, kmText, RUN_REASON } from "../../lib/out.js";
import { fmt } from "../../lib/format.js";

export default function EventCard({ e, kind, picked, budget, onOpen, delay = 0 }) {
  const km = kmText(e.km);
  const why = (e.reasons || []).filter((r) => r !== km && r !== "On your date" && r !== RUN_REASON && r !== "Free");
  return (
    <button className={`ot-card fade-up ${picked ? "on" : ""}`} style={{ animationDelay: `${Math.min(delay, 12) * 35}ms` }}
      onClick={() => onOpen(e)} aria-label={`${e.name}${e.reasons?.length ? ` — ${e.reasons.join(", ")}` : ""}`}>
      <VenueArt kind={kind === "club" ? "club" : "events"} size={58} />
      <span className="grow ot-card-body">
        <span className="ot-name clamp2">{e.name}</span>
        {(e.venue || e.locality) && <span className="tiny muted ellipsis">{[e.venue, e.locality].filter(Boolean).join(" · ")}</span>}
        <span className="ot-when tiny soft"><Icon.calendar size={12} /> {eventWhenText(e.start, e.end) || "Date on District"}</span>
        <span className="ot-cost ellipsis">{eventPriceText(e.priceFrom)}{km ? <span className="dim"> · {km}</span> : null}</span>
        <span className="ot-tags">
          {picked && <span className="pill ot-pill-pick"><Icon.check size={10} /> The party</span>}
          {e.onDate && <span className="pill ot-pill-date">On your date</span>}
          {e.onRun && <span className="pill ot-pill-run" title={RUN_REASON}>Runs through your date</span>}
          {e.fit === "over" && <span className="pill ot-pill-over">Over {fmt(budget)} a head</span>}
          {why.slice(0, 1).map((r) => <span key={r} className="pill ot-pill-why">{r}</span>)}
        </span>
      </span>
    </button>
  );
}
