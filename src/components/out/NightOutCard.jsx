// [v1.5 · Out] "Your night out": the picked place, when, for how many, and what it costs —
// each line tagged exact, estimate or unknown (lib/out.js outingCost) — the share a head
// against the budget, when to leave (straight-line distance, lib/outModel.js travelMinutes),
// a "Booked on District" tick, and shortcuts to the Plan cards that use the venue.
// Reminders and Plan links scroll here by its id, "night-out".
import { useMemo } from "react";
import { outingCost, leaveBy, kmText, isByobPick } from "../../lib/out.js";
import { prettyTime, prettyWhen, clockOf } from "../../lib/when.js";
import { fmt, ageStr } from "../../lib/format.js";
import { openDistrict, tap } from "../../lib/order.js";
import { Icon, VenueArt } from "../Art.jsx";

const KIND_TAG = { exact: "exact", estimate: "estimate", unknown: "unknown" };
const SHORTCUTS = [["invite", "💌", "Invite"], ["split", "🧾", "Split"], ["rides", "🚕", "Getting home"]];

export default function NightOutCard({ out, setOut, party, loc, locating, onLocate, liquorLines, goPlanCard, onOpen, toast }) {
  const pick = out.pick;
  const cost = useMemo(() => outingCost({ out, party, liquorLines }), [out, party, liquorLines]);
  if (!pick) return null;
  const go = leaveBy({ party, from: loc, to: pick });
  const hasGeo = pick.lat != null && pick.lon != null;
  const art = pick.type === "event" ? (pick.outKind === "events" ? "events" : "club") : isByobPick(pick) ? "byob" : "bar";
  const cap = out.perHead;
  const over = cap > 0 && cost.perHead > cap;
  const where = pick.type === "event" ? [pick.venue, pick.locality].filter(Boolean).join(" · ") : pick.locality;
  const exactTickets = cost.lines.some((l) => l.id === "tickets" && l.kind === "exact" && l.amount > 0);
  const asOf = pick.fetchedAt ? (Date.now() - pick.fetchedAt < 12 * 3600000 ? prettyTime(clockOf(new Date(pick.fetchedAt))) : ageStr(pick.fetchedAt)) : "";

  const clear = () => {
    if (!confirm(`Clear ${pick.name} from the plan? Your bottles and food stay.`)) return;
    setOut((o) => ({ ...o, active: false, pick: null, tickets: [], booked: false, corkage: null }));
    toast?.("Night out cleared — the party's at home");
  };

  return (
    <div className="card fade-up ot-night" id="night-out">
      <div className="card-title">
        <span className="kicker">Your night out</span>
        <span className={`pill ${out.active ? "ot-pill-pick" : "ot-pill-why"}`}>{out.active ? "The party's here" : "Saved · party at home"}</span>
      </div>

      <button className="ot-night-pick" onClick={() => { tap(); onOpen?.(pick); }} aria-label={`Open ${pick.name}`}>
        <VenueArt kind={art} size={54} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="h3 ellipsis" style={{ display: "block" }}>{pick.name}</span>
          {where && <span className="tiny muted ellipsis" style={{ display: "block" }}>{where}</span>}
          <span className="tiny soft" style={{ display: "block" }}>{prettyWhen(party) || "Set a date"} · {party?.guests || 1} people</span>
        </span>
        <Icon.chevron size={16} />
      </button>
      {!out.active && (
        <button className="btn btn-gold btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => { tap(); setOut((o) => ({ ...o, active: true })); }}>
          Make it the party
        </button>
      )}

      <div className="ot-lines">
        {cost.lines.map((l) => (
          <div key={l.id} className="ot-line">
            <span className="grow small soft">{l.label}</span>
            <span className={`ot-kind ot-kind-${KIND_TAG[l.kind]}`}>{l.kind}</span>
            <b className="small ot-amount">{l.amount == null ? "?" : fmt(l.amount)}</b>
          </div>
        ))}
      </div>

      <div className="ot-sum">
        <div>
          <div className="kicker">A head, about</div>
          <div className="h2">{fmt(cost.perHead)}</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div className="small b">{fmt(cost.total)} in all{cost.unknown ? " + the ?s" : ""}</div>
          <div className={`tiny ${!cap ? "muted" : over ? "red" : "green"}`}>
            {!cap ? "No budget a head set" : over ? `${fmt(cost.perHead - cap)} over your ${fmt(cap)}` : `Within your ${fmt(cap)} a head`}
          </div>
        </div>
      </div>
      {exactTickets && asOf && <div className="tiny dim" style={{ marginTop: 6 }}>Ticket prices as on District at {asOf}; any fee and GST are added at checkout.</div>}

      <div className="ot-go">
        <Icon.route size={18} className="gold" />
        {go ? (
          <span className="grow small">Leave by <b className="gold">{prettyTime(go.time)}</b> <span className="muted">· about {go.minutes} min for {kmText(go.km)}</span></span>
        ) : !loc && hasGeo ? (
          <>
            <span className="grow tiny muted">Use your location to see when to leave.</span>
            <button className="btn btn-ghost btn-xs" disabled={locating} onClick={() => { tap(); onLocate?.(); }}>{locating ? <span className="spin">◌</span> : "Locate"}</button>
          </>
        ) : (
          <span className="grow tiny muted">No map pin for this place yet — open it to load one.</span>
        )}
      </div>
      {pick.closes && <div className="tiny muted" style={{ marginTop: 4 }}><Icon.clock size={11} className="out-inline-icon" /> Closes {prettyTime(pick.closes)} (listed hours)</div>}

      <div className="ot-booked">
        <button className="ot-booked-tick" role="checkbox" aria-checked={!!out.booked} onClick={() => { tap(); setOut((o) => ({ ...o, booked: !o.booked })); }}>
          <span className={`check ${out.booked ? "on" : ""}`}>{out.booked && <Icon.check size={14} />}</span>
          <span className="grow">
            <span className="small b">Booked on District</span><br />
            <span className="tiny muted">{out.booked ? "Changes and refunds go through District." : pick.type === "event" ? "Tick it once the tickets are bought" : "Tick it once the table is booked"}</span>
          </span>
        </button>
        {pick.url && (
          <button className="btn btn-xs ot-btn-district" onClick={() => { tap(); openDistrict({ web: pick.url }); }}>
            District <Icon.external size={12} />
          </button>
        )}
      </div>

      <div className="ot-shortcuts">
        {SHORTCUTS.map(([id, emoji, label]) => (
          <button key={id} className="chip" onClick={() => { tap(); goPlanCard?.(id); }}><span aria-hidden="true">{emoji}</span> {label}</button>
        ))}
        <button className="chip ot-clear" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
