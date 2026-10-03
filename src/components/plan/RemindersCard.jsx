// [v1.3 · item 7] Party reminders — local notifications timed off the party start.
// Each can be switched off; "Set reminders" puts the switched-on ones on the phone.
// v1.5: a party out gets "Leave by", free cancellation and the venue's last call instead
// of the home nudges (lib/reminderPlan.js); what's set remembers the place too.
import { useMemo, useState } from "react";
import { buildReminders, reminderSig, reminderState, placeKey, isOn, LEAVE_MAX_KM } from "../../lib/reminderPlan.js";
import { scheduleReminders, cancelReminders } from "../../lib/reminders.js";
import { isOut, outPlace } from "../../lib/outModel.js";
import { pickupOf, outVenueName } from "../../lib/rides.js";
import { prettyWhen, prettyTime, clockOf } from "../../lib/when.js";
import { prettyDate, todayISO } from "../../lib/drydays.js";
import { isNative } from "../../lib/http.js";
import { tap, buzz } from "../../lib/order.js";
import { Icon } from "../Art.jsx";

export default function RemindersCard({ party, city, customDry, reminders, setReminders, toast, out, loc }) {
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => buildReminders(party, city, customDry, Date.now(), { out, loc }), [party, city, customDry, out, loc]);
  const enabled = reminders?.enabled || {};
  const st = reminderState(reminders, party, list);
  const native = isNative();
  const away = isOut(out);
  const venue = outVenueName(out);
  // Why a night out has no "Leave by": no pin for the venue, no location fix, or a fix far away.
  const noLeave = away && !list.some((r) => r.key === "leave") && (!outPlace(out)
    ? "The venue's location isn't known, so there's no “Leave by” reminder."
    : !pickupOf(loc) ? "Tap Use my location (Location, below) to get a “Leave by” reminder."
      : `Your last location fix is over ${LEAVE_MAX_KM} km from the venue. Update it (Location, below) for a “Leave by” reminder.`);

  const toggle = (key) => { tap(); setReminders((r) => ({ ...r, enabled: { ...r?.enabled, [key]: !isOn(r?.enabled, key) } })); };

  const schedule = async () => {
    if (busy) return;
    tap(); setBusy(true);
    try {
      const res = await scheduleReminders(list, enabled);
      if (!res.native) { toast("Reminders work in the phone app"); return; }
      const sig = reminderSig(list, enabled);
      setReminders((r) => ({
        ...r, scheduledFor: res.scheduled ? st.when : null, scheduledSig: res.scheduled ? sig : null,
        scheduledPlace: res.scheduled ? placeKey(out) : null, keptFor: null, keptPlace: null,
      }));
      if (res.scheduled) { buzz(); toast(`${res.scheduled} reminder${res.scheduled === 1 ? "" : "s"} set`); }
      else toast("No upcoming reminders are switched on");
    } catch (e) {
      toast(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    tap();
    await cancelReminders();
    setReminders((r) => ({ ...r, scheduledFor: null, scheduledSig: null, scheduledPlace: null, keptFor: null, keptPlace: null }));
    toast("Reminders cancelled");
  };

  return (
    <div className="card fade-up">
      <div className="card-title">
        <span className="kicker">Reminders</span>
        {st.scheduled && <span className="pill" style={{ background: "rgba(52,217,143,.14)", color: "var(--green)" }}><Icon.bell size={12} /> On</span>}
      </div>
      {list.length === 0 ? (
        <div className="small muted">Pick a party date in the Food tab to plan reminders.</div>
      ) : (
        <>
          <div className="small muted">Nudges on your phone before and after the party · {prettyWhen(party)}{away && venue ? ` · at ${venue}` : ""}</div>
          <div style={{ marginTop: 4 }}>
            {list.map((r) => {
              const on = isOn(enabled, r.key);
              return (
                <div key={r.key} className={`line-item ${r.past ? "done" : ""}`}>
                  <div className="share-rem-when">
                    <div className="tiny muted">{prettyDate(todayISO(r.at))}</div>
                    <div className="small b">{prettyTime(clockOf(r.at))}</div>
                  </div>
                  <div className="grow">
                    <div className="small b">{r.title}</div>
                    <div className="tiny muted clamp2">{r.body}</div>
                  </div>
                  {r.past
                    ? <span className="pill share-passed">passed</span>
                    : <button className={`switch ${on ? "on" : ""}`} role="switch" aria-checked={on} aria-label={r.title} onClick={() => toggle(r.key)} />}
                </div>
              );
            })}
          </div>
          {noLeave && <div className="tiny dim" style={{ marginTop: 6 }}>{noLeave}</div>}

          {!native ? (
            <div className="note note-info" style={{ marginTop: 12 }}>Reminders are phone notifications — they work in the phone app.</div>
          ) : st.moved ? (
            <div className="note note-warn" style={{ marginTop: 12 }}>Set for the old time ({prettyWhen(reminders.scheduledFor)}). Tap Set reminders to move them.</div>
          ) : st.dirty ? (
            <div className="note note-warn" style={{ marginTop: 12 }}>Changes not applied — tap Set reminders again.</div>
          ) : st.scheduled ? (
            <div className="note note-ok" style={{ marginTop: 12 }}>✓ Reminders set for {prettyWhen(reminders.scheduledFor)}</div>
          ) : null}

          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn btn-gold grow" disabled={busy} onClick={schedule}>
              {busy ? <span className="spin">◌</span> : <Icon.bell size={17} />} Set reminders
            </button>
            {st.scheduled && <button className="btn btn-ghost" onClick={cancel}>Cancel reminders</button>}
          </div>
        </>
      )}
    </div>
  );
}
