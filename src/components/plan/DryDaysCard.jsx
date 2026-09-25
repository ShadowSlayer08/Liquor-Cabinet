// [v1.3 · item 2] Dry days ahead for the party's state, plus dry days you add yourself
// (election bans and state notices the built-in list can't know about).
import { useState } from "react";
import { upcomingDryDays, prettyDate, stateOf, todayISO, addCustomDry, removeCustomDry, stateListUrl } from "../../lib/drydays.js";
import { cityName } from "../../lib/parse/livcheers.js";
import { openUrl, tap } from "../../lib/order.js";
import DryDayBanner from "../DryDayBanner.jsx";
import { Icon } from "../Art.jsx";

const LEVEL = {
  national: { label: "Closed", cls: "bar-pill-red" },
  custom: { label: "Your date", cls: "bar-pill-red" },
  state: { label: "Check", cls: "bar-pill-amber" },
  often: { label: "Check", cls: "bar-pill-amber" },
};

export default function DryDaysCard({ party, city, customDry, setCustomDry, toast }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const custom = customDry || [];
  const today = todayISO();
  const rows = upcomingDryDays(city, custom, today, 6);
  const state = stateOf(city);

  const add = () => {
    if (!date) { toast("Pick a date first"); return; }
    const next = addCustomDry(custom, date, name);
    if (next === custom) { toast("That dry day is already on the list"); return; }
    setCustomDry(next);
    tap();
    toast(`${prettyDate(date)} added as a dry day`);
    setDate(""); setName("");
  };
  const remove = (d) => { setCustomDry(removeCustomDry(custom, d.date, d.name)); tap(); };

  return (
    <div className="card fade-up">
      <div className="card-title"><span className="kicker">Dry days ahead</span><span className="tiny muted">{state || cityName(city)}</span></div>
      <DryDayBanner date={party?.date} city={city} customDry={custom} style={{ marginBottom: 12 }} />

      {rows.length === 0 && <div className="small muted">Nothing on our list for the coming months — your state may still notify some.</div>}
      {rows.map((d) => {
        const lv = LEVEL[d.level] || LEVEL.often;
        const mine = d.date === party?.date;
        const sameYear = d.date.slice(0, 4) === today.slice(0, 4);
        return (
          <div key={`${d.date}:${d.level}:${d.name}`} className={`bar-dry-row ${mine ? "party" : ""}`}>
            <div className="bar-dry-day"><b>{Number(d.date.slice(8, 10))}</b><span>{prettyDate(d.date, { month: "short" })}</span></div>
            <div className="grow">
              <div className="small b ellipsis">{d.name}</div>
              <div className="tiny muted">{prettyDate(d.date, { weekday: "long" })}{sameYear ? "" : `, ${d.date.slice(0, 4)}`}{mine ? <span className="gold"> · your party</span> : ""}</div>
            </div>
            <span className={`pill ${lv.cls}`}>{lv.label}</span>
            {d.level === "custom" && <button className="bar-x" onClick={() => remove(d)} aria-label={`Remove ${d.name}`}><Icon.close size={13} /></button>}
          </div>
        );
      })}

      <div className="kicker" style={{ margin: "16px 0 8px" }}>Add a dry day</div>
      <div className="bar-dry-form">
        <input type="date" className="input bar-date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input" value={name} maxLength={40} placeholder="e.g. Election" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-label="What it's for" />
        <button className="btn btn-ghost btn-sm" onClick={add}><Icon.plus size={14} /> Add</button>
      </div>

      <div className="tiny dim" style={{ marginTop: 12, lineHeight: 1.6 }}>
        Only 26 Jan, 15 Aug and 2 Oct are certain everywhere. {state || "Each state"} notifies the rest itself — often quarterly — plus election bans at short notice.{" "}
        <button className="gold" onClick={() => openUrl(stateListUrl(city))}>Check {state ? `${state}'s` : "your state's"} list ↗</button>
      </div>
    </div>
  );
}
