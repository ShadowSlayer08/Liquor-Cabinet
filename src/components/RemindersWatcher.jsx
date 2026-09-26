// [v1.3 · item 7] Watches the party date/time from anywhere in the app and offers to
// re-schedule reminders that were set for an earlier time. It asks first — a small
// card above the tab bar once the new time has stopped changing — and renders
// nothing otherwise. "Keep" is remembered for that date/time, so it asks once.
import { useEffect, useState } from "react";
import { buildReminders, reminderSig, reminderState } from "../lib/reminderPlan.js";
import { scheduleReminders } from "../lib/reminders.js";
import { prettyWhen } from "../lib/when.js";
import { tap, buzz } from "../lib/order.js";
import { Icon } from "./Art.jsx";

const SETTLE_MS = 1500; // date/time inputs change on every keystroke

export default function RemindersWatcher({ party, city, customDry, reminders, setReminders, toast }) {
  const { ask, when } = reminderState(reminders, party);
  const [settled, setSettled] = useState(null); // `when` once it has held still
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setSettled(when), SETTLE_MS);
    return () => { clearTimeout(t); setSettled(null); };
  }, [ask, when]);

  if (!ask || settled !== when) return null;

  const move = async () => {
    if (busy) return;
    tap(); setBusy(true);
    const list = buildReminders(party, city, customDry);
    const enabled = reminders?.enabled || {};
    try {
      const res = await scheduleReminders(list, enabled);
      if (!res.native) {
        setReminders((r) => ({ ...r, scheduledFor: null, scheduledSig: null, keptFor: null }));
        toast("Reminders work in the phone app");
        return;
      }
      setReminders((r) => ({ ...r, scheduledFor: res.scheduled ? when : null, scheduledSig: res.scheduled ? reminderSig(list, enabled) : null, keptFor: null }));
      buzz();
      toast(res.scheduled ? `Reminders moved to ${prettyWhen(when)}` : "Those times have passed — no reminders to move");
    } catch (e) {
      toast(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const keep = () => { tap(); setReminders((r) => ({ ...r, keptFor: when })); };

  return (
    <div className="minicart share-ask" role="dialog" aria-label="Move reminders">
      <Icon.bell size={20} className="gold" />
      <div className="grow small">Party moved to <b>{prettyWhen(when)}</b> — move your reminders too?</div>
      <div className="share-ask-actions">
        <button className="btn btn-ghost btn-sm" onClick={keep}>Keep</button>
        <button className="btn btn-gold btn-sm" disabled={busy} onClick={move}>{busy ? <span className="spin">◌</span> : "Move them"}</button>
      </div>
    </div>
  );
}
