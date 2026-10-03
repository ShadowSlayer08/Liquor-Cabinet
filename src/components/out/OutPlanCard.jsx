// [v1.5 · Out] The Out tab's plan card: is the party at home or out, what kind of night, how
// many people, when, and the budget a head. People, date and time are the shared party's
// (the Food tab edits the same ones); the rest lives in cfg.out. Below: bar dry days for the
// date (DryDayBanner mode="bars") and the state's legal drinking age (lib/age.js).
import DryDayBanner from "../DryDayBanner.jsx";
import { Stepper } from "../Sheet.jsx";
import { OUT_KINDS } from "../../lib/outModel.js";
import { ageFor } from "../../lib/age.js";
import { ageLine } from "../../lib/out.js";
import { todayISO } from "../../lib/drydays.js";
import { cityName } from "../../lib/parse/livcheers.js";
import { tap } from "../../lib/order.js";
import { Icon } from "../Art.jsx";

export default function OutPlanCard({ city, loc, locating, onLocate, party, setParty, plan, out, setOut, customDry }) {
  const set = (k) => (v) => setParty((p) => ({ ...p, [k]: v }));
  const setO = (patch) => { tap(); setOut((o) => ({ ...o, ...patch })); };
  const age = ageLine(ageFor(city));
  const drinking = plan ? `${plan.drinkers} drinking${plan.drivers ? ` · ${plan.drivers} driving` : ""}` : "";

  return (
    <div className="card fade-up ot-plan">
      <div className="card-title">
        <span className="kicker">{party?.date === todayISO() ? "Tonight's party" : "The party"}</span>
        <span className="tiny muted">{drinking}</span>
      </div>

      <div className="field">
        <label>Party at</label>
        <div className="seg">
          <button className={!out.active ? "on" : ""} onClick={() => setO({ active: false })}>🏠 Home</button>
          <button className={out.active ? "on" : ""} onClick={() => setO({ active: true })}>📍 Out</button>
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          {out.active
            ? out.pick ? <>Invites, reminders, rides and the split use <b className="soft">{out.pick.name}</b>.</> : "Pick a place below, then tap “Make this the party”."
            : "Invites, reminders, rides and the split use your place."}
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Going to</label>
        <div className="ot-kinds">
          {OUT_KINDS.map((k) => (
            <button key={k.id} className={`chip ${out.kind === k.id ? "on" : ""}`} onClick={() => setO({ kind: k.id })}>
              <span aria-hidden="true">{k.emoji}</span> {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 14 }}>
        {/* An emptied date/time is ignored, as in the Food tab: dry days, reminders and the invite need one. */}
        <div className="field"><label>Date</label><input type="date" className="input bar-date" aria-label="Party date" value={party?.date || ""} min={todayISO()} onChange={(e) => e.target.value && set("date")(e.target.value < todayISO() ? todayISO() : e.target.value)} /></div>
        <div className="field"><label>Time</label><input type="time" className="input bar-date" aria-label="Party time" value={party?.time || ""} onChange={(e) => e.target.value && set("time")(e.target.value)} /></div>
        <div className="field"><label>People</label><Stepper value={party?.guests || 1} onChange={set("guests")} min={1} max={500} /></div>
        <div className="field">
          <label>A head{out.perHead ? "" : " · no cap"}</label>
          <Stepper value={out.perHead || 0} step={250} min={0} max={50000} onChange={(v) => setOut((o) => ({ ...o, perHead: v > 0 ? v : null }))} />
        </div>
      </div>

      <button className="toggle" style={{ marginTop: 14 }} onClick={() => setO({ bigGroup: !out.bigGroup })}>
        <span>
          <span className="h3">Big group</span><br />
          <span className="tiny muted">{out.bigGroup ? "Places District lists with group seating or private dining come first, once opened" : "Large-group seating and private dining first"}</span>
        </span>
        <span className={`switch ${out.bigGroup ? "on" : ""}`} />
      </button>

      <DryDayBanner mode="bars" date={party?.date} city={city} customDry={customDry} style={{ marginTop: 14 }} />
      {age && <div className="ot-age tiny"><Icon.idcard size={15} /><span>{age}</span></div>}

      {!loc && (
        <div className="ot-locate">
          <Icon.pin size={18} className="gold" />
          <span className="grow tiny muted">Use your location for places near you and when to leave. Without it, lists cover {cityName(city)}.</span>
          <button className="btn btn-ghost btn-xs" disabled={locating} onClick={() => { tap(); onLocate?.(); }}>
            {locating ? <span className="spin">◌</span> : <Icon.locate size={14} />} Locate
          </button>
        </div>
      )}
    </div>
  );
}
