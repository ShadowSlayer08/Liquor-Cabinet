// [v1.4.1 · track C] Getting home safely — who's driving (they stay sober), ride apps opened
// with the party's location as the pickup, and the ride links for the guests' WhatsApp group.
// The app never books or tracks a ride (lib/rides.js). The "winddown" reminder lands here.
// v1.5: on a party out the pickup is the picked venue (ridePickup), never home.
import { useMemo } from "react";
import { RIDE, pickupOf, ridePickup, ridePrefills, driversOf, homeSafeMessage, outVenueName } from "../../lib/rides.js";
import { lastCallFor, closesAt } from "../../lib/reminderPlan.js";
import { isOut } from "../../lib/outModel.js";
import { prettyTime, clockOf } from "../../lib/when.js";
import { whatsappUrl } from "../../lib/split.js";
import { ageStr } from "../../lib/format.js";
import { openRide, openUrl, shareText, tap } from "../../lib/order.js";
import { Stepper } from "../Sheet.jsx";
import { Icon } from "../Art.jsx";

const BUTTONS = ["uber", "ola", "rapido"];

export default function RidesCard({ party, setParty, plan, loc, locating, onLocate, toast, out }) {
  const guests = Math.max(1, plan?.guests ?? party?.guests ?? 1);
  const drivers = Math.min(guests, plan?.drivers ?? driversOf(party));
  const away = isOut(out);
  const venue = outVenueName(out);
  const from = ridePickup(out, loc);
  const pickup = pickupOf(from);
  const lastCall = useMemo(() => lastCallFor(party, out), [party, out]);
  const closing = away ? closesAt(party, out.pick.closes) : null;
  const title = (party?.name || "").trim() || (away ? "Night out" : "House party");
  const message = () => homeSafeMessage({ party, loc, host: party?.host, drivers, out });

  const ride = (id) => { tap(); openRide(id, from); };
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
          {away ? (
            <>
              <div>Pickup: <b>{venue || "the venue"}</b></div>
              <div className="tiny muted">{pickup ? "The venue you picked in the Out tab" : "The venue's location isn't known — set the pickup in the ride app."}</div>
            </>
          ) : pickup ? (
            <>
              <div>Pickup: <b>{pickup.named ? pickup.label : "your location pin"}</b></div>
              <div className="tiny muted">From your last location fix{loc?.at ? ` · ${ageStr(loc.at)}` : ""}</div>
            </>
          ) : (
            <span className="muted">Turn on location to fill in the pickup.</span>
          )}
        </div>
        {!away && (
          <button className="btn btn-ghost btn-xs" disabled={locating} onClick={() => { tap(); onLocate?.(); }}>
            {locating ? <span className="spin">◌</span> : pickup ? "Update" : "Use my location"}
          </button>
        )}
      </div>

      <div className="out-rides">
        {BUTTONS.map((id) => (
          <button key={id} className={`out-ride out-ride-${id}`} onClick={() => ride(id)}>
            <span className="out-ride-emoji" aria-hidden="true">{RIDE[id].emoji}</span>
            <span className="small b">{RIDE[id].name}</span>
            <span className="tiny muted">{ridePrefills(id, from) ? "pickup filled in" : "set pickup in app"}</span>
          </button>
        ))}
      </div>
      <button className="out-driveu" onClick={() => ride("driveu")}>
        <span aria-hidden="true">{RIDE.driveu.emoji}</span>
        <span className="grow small"><b>Drove here?</b> <span className="muted">DriveU sends a driver for your car</span></span>
        <Icon.external size={14} />
      </button>
      <div className="tiny dim" style={{ marginTop: 8 }}>
        {away && pickup ? "The venue fills the pickup" : away ? "Set the pickup in the ride app" : "Your location fills the pickup"}; the app asks where you're going. Liquor Cabinet doesn't book rides.
      </div>
      {lastCall && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          <Icon.bell size={11} className="out-inline-icon" /> Last-call reminder at {prettyTime(clockOf(lastCall))}{closing ? `, 45 min before ${venue || "the venue"} closes (listed hours)` : ""} — switch it on under Reminders.
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn share-btn-wa grow" onClick={whatsapp}><Icon.share size={17} /> Ride links on WhatsApp</button>
        <button className="btn btn-ghost" onClick={shareAny}>Share…</button>
      </div>
    </div>
  );
}
