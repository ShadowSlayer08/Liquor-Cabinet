// [v1.4.1 · track C] Getting home safely — who's driving (they stay sober), ride apps opened
// with the party's location as the pickup, and the ride links for the guests' WhatsApp group.
// The app never books or tracks a ride (lib/rides.js). The "winddown" reminder lands here.
import { useMemo } from "react";
import { RIDE, pickupOf, ridePrefills, driversOf, homeSafeMessage } from "../../lib/rides.js";
import { lastCallAt } from "../../lib/reminderPlan.js";
import { prettyTime, clockOf } from "../../lib/when.js";
import { whatsappUrl } from "../../lib/split.js";
import { ageStr } from "../../lib/format.js";
import { openRide, openUrl, shareText, tap } from "../../lib/order.js";
import { Stepper } from "../Sheet.jsx";
import { Icon } from "../Art.jsx";

const BUTTONS = ["uber", "ola", "rapido"];

export default function RidesCard({ party, setParty, plan, loc, locating, onLocate, toast }) {
  const guests = Math.max(1, plan?.guests ?? party?.guests ?? 1);
  const drivers = Math.min(guests, plan?.drivers ?? driversOf(party));
  const pickup = pickupOf(loc);
  const lastCall = useMemo(() => lastCallAt(party), [party]);
  const title = (party?.name || "").trim() || "House party";
  const message = () => homeSafeMessage({ party, loc, host: party?.host, drivers });

  const ride = (id) => { tap(); openRide(id, loc); };
  const whatsapp = () => { tap(); openUrl(whatsappUrl(message())); };
  const shareAny = async () => { if ((await shareText(`${title} — getting home`, message())) === "copied") toast("Ride links copied to clipboard"); };

  return (
    <div className="card fade-up" id="rides">
      <div className="card-title">
        <span className="kicker">Getting home</span>
        {drivers > 0 && <span className="tiny muted">🔑 {drivers} driving</span>}
      </div>

      <div className="out-drivers">
        <div className="field grow">
          <label>Driving tonight (not drinking)</label>
          <Stepper value={drivers} min={0} max={guests} onChange={(v) => setParty((p) => ({ ...p, drivers: v }))} />
        </div>
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        {drivers > 0
          ? `${drivers === 1 ? "They get" : "They all get"} soft drinks and mocktails, and pay the non-drinker share in a Fair split.`
          : "Anyone driving stays sober — they're counted as not drinking."}
      </div>

      <div className="sep" />
      <div className="out-pickup">
        <Icon.pin size={18} className="gold" />
        <div className="grow small">
          {pickup ? (
            <>
              <div>Pickup: <b>{pickup.named ? pickup.label : "your location pin"}</b></div>
              <div className="tiny muted">From your last location fix{loc?.at ? ` · ${ageStr(loc.at)}` : ""}</div>
            </>
          ) : (
            <span className="muted">Turn on location to fill in the pickup.</span>
          )}
        </div>
        <button className="btn btn-ghost btn-xs" disabled={locating} onClick={() => { tap(); onLocate?.(); }}>
          {locating ? <span className="spin">◌</span> : pickup ? "Update" : "Use my location"}
        </button>
      </div>

      <div className="out-rides">
        {BUTTONS.map((id) => (
          <button key={id} className={`out-ride out-ride-${id}`} onClick={() => ride(id)}>
            <span className="out-ride-emoji" aria-hidden="true">{RIDE[id].emoji}</span>
            <span className="small b">{RIDE[id].name}</span>
            <span className="tiny muted">{ridePrefills(id, loc) ? "pickup filled in" : "set pickup in app"}</span>
          </button>
        ))}
      </div>
      <button className="out-driveu" onClick={() => ride("driveu")}>
        <span aria-hidden="true">{RIDE.driveu.emoji}</span>
        <span className="grow small"><b>Drove here?</b> <span className="muted">DriveU sends a driver for your car</span></span>
        <Icon.external size={14} />
      </button>
      <div className="tiny dim" style={{ marginTop: 8 }}>
        Your location fills the pickup; the app asks where you're going. Liquor Cabinet doesn't book rides.
      </div>
      {lastCall && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          <Icon.bell size={11} className="out-inline-icon" /> Last-call reminder at {prettyTime(clockOf(lastCall))} — switch it on under Reminders.
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn share-btn-wa grow" onClick={whatsapp}><Icon.share size={17} /> Ride links on WhatsApp</button>
        <button className="btn btn-ghost" onClick={shareAny}>Share…</button>
      </div>
    </div>
  );
}
