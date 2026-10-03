// [v1.3 · item 7] Watches the party date/time from anywhere in the app and offers to
// re-schedule reminders that were set for an earlier time. It asks first — a small
// card above the tab bar once the new time has stopped changing — and renders
// nothing otherwise. "Keep" is remembered for that date/time, so it asks once.
// v1.5: the same for the party's place — reminders set for home (or another venue) while
// the party is now out somewhere else (lib/reminderPlan.js placeState), asked once per place.
import { useEffect, useState } from "react";
import { buildReminders, reminderSig, reminderState, placeState } from "../lib/reminderPlan.js";
import { scheduleReminders } from "../lib/reminders.js";
import { outVenueName } from "../lib/rides.js";
import { prettyWhen } from "../lib/when.js";
import { tap, buzz } from "../lib/order.js";
import { Icon } from "./Art.jsx";

const SETTLE_MS = 1500; // date/time inputs change on every keystroke

export default function RemindersWatcher({ party, city, customDry, reminders, setReminders, toast, out, loc }) {
  const st = reminderState(reminders, party);
  const ps = placeState(reminders, out, st);
  const { when } = st;
  const ask = st.ask || ps.ask;
  const key = `${when} ${ps.place}`;
  const [settled, setSettled] = useState(null); // `key` once it has held still
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setSettled(key), SETTLE_MS);
    return () => { clearTimeout(t); setSettled(null); };
  }, [ask, key]);

  if (!ask || settled !== key) return null;

  const venue = outVenueName(out);
  const move = async () => {
    if (busy) return;
    tap(); setBusy(true);
    const list = buildReminders(party, city, customDry, Date.now(), { out, loc });
    const enabled = reminders?.enabled || {};
    try {
      const res = await scheduleReminders(list, enabled);
      if (!res.native) {
        setReminders((r) => ({ ...r, scheduledFor: null, scheduledSig: null, scheduledPlace: null, keptFor: null, keptPlace: null }));
        toast("Reminders work in the phone app");
        return;
      }
      setReminders((r) => ({
        ...r, scheduledFor: res.scheduled ? when : null, scheduledSig: res.scheduled ? reminderSig(list, enabled) : null,
        scheduledPlace: res.scheduled ? ps.place : null, keptFor: null, keptPlace: null,
      }));
      buzz();
      toast(!res.scheduled ? "Those times have passed — no reminders to move"
        : st.ask ? `Reminders moved to ${prettyWhen(when)}` : `Reminders moved to ${venue || "the party at home"}`);
    } catch (e) {
      toast(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const keep = () => { tap(); setReminders((r) => ({ ...r, ...(st.ask ? { keptFor: when } : {}), ...(ps.ask ? { keptPlace: ps.place } : {}) })); };

  return (
    <div className="minicart share-ask" role="dialog" aria-label="Move reminders">
      <Icon.bell size={20} className="gold" />
      <div className="grow small">
        {st.ask
          ? <>Party moved to <b>{prettyWhen(when)}</b> — move your reminders too?</>
          : venue ? <>Party's now at <b>{venue}</b> — move your reminders too?</> : <>Party's back at home — move your reminders too?</>}
      </div>
      <div className="share-ask-actions">
        <button className="btn btn-ghost btn-sm" onClick={keep}>Keep</button>
        <button className="btn btn-gold btn-sm" disabled={busy} onClick={move}>{busy ? <span className="spin">◌</span> : "Move them"}</button>
      </div>
    </div>
  );
}
