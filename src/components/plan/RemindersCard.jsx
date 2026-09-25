// [v1.3 · item 7] Party reminders — local notifications timed off the party start.
// Each can be switched off; "Set reminders" puts the switched-on ones on the phone.
import { useMemo, useState } from "react";
import { buildReminders, reminderSig, reminderState, isOn } from "../../lib/reminderPlan.js";
import { scheduleReminders, cancelReminders } from "../../lib/reminders.js";
import { prettyWhen, prettyTime, clockOf } from "../../lib/when.js";
import { prettyDate, todayISO } from "../../lib/drydays.js";
import { isNative } from "../../lib/http.js";
import { tap, buzz } from "../../lib/order.js";
import { Icon } from "../Art.jsx";

export default function RemindersCard({ party, city, customDry, reminders, setReminders, toast }) {
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => buildReminders(party, city, customDry), [party, city, customDry]);
  const enabled = reminders?.enabled || {};
  const st = reminderState(reminders, party, list);
  const native = isNative();

  const toggle = (key) => { tap(); setReminders((r) => ({ ...r, enabled: { ...r?.enabled, [key]: !isOn(r?.enabled, key) } })); };

  const schedule = async () => {
    if (busy) return;
    tap(); setBusy(true);
    try {
      const res = await scheduleReminders(list, enabled);
      if (!res.native) { toast("Reminders work in the Android app"); return; }
      const sig = reminderSig(list, enabled);
      setReminders((r) => ({ ...r, scheduledFor: res.scheduled ? st.when : null, scheduledSig: res.scheduled ? sig : null, keptFor: null }));
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
    setReminders((r) => ({ ...r, scheduledFor: null, scheduledSig: null, keptFor: null }));
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
          <div className="small muted">Nudges on your phone before the party · {prettyWhen(party)}</div>
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

          {!native ? (
            <div className="note note-info" style={{ marginTop: 12 }}>Reminders are phone notifications — they work in the Android app.</div>
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
