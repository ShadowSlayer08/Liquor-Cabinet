// Warns when the party falls on a dry day. National days and dry days you added are
// certain — shops are shut, so it says when to buy by. Festival and state days vary by
// state and year, so those only ask you to check (a search for that date and state).
import { dryDayOn, lastShoppingDay, prettyDate, stateOf, confirmUrl } from "../lib/drydays.js";
import { openUrl } from "../lib/order.js";

export default function DryDayBanner({ date, city, customDry, compact = false, style }) {
  const dry = dryDayOn(date, city, customDry || []);
  if (!dry) return null;
  const shut = dry.level === "national" || dry.level === "custom";
  const buyBy = shut ? prettyDate(lastShoppingDay(date, city, customDry || [])) : null;
  return (
    <div className={`note bar-dry ${shut ? "bar-note-danger" : "note-warn"} ${compact ? "bar-dry-compact" : ""}`} style={style} role="status">
      <span className="bar-dry-icon" aria-hidden="true">{shut ? "🚫" : "⚠️"}</span>
      <span className="grow">
        {dry.level === "national" && <><b>{prettyDate(date)} is {dry.name}</b> — liquor shops are shut across India. Buy by {buyBy}.</>}
        {dry.level === "custom" && <><b>{prettyDate(date)} is a dry day{dry.name !== "Dry day" ? ` (${dry.name})` : ""}</b> — liquor shops are shut. Buy by {buyBy}.</>}
        {!shut && <><b>{dry.name}</b> is often a dry day in {stateOf(city) || "many states"} — check before you plan.</>}
      </span>
      {!shut && <button className="btn btn-xs btn-ghost" onClick={() => openUrl(confirmUrl(date, city))}>Check ↗</button>}
    </div>
  );
}
