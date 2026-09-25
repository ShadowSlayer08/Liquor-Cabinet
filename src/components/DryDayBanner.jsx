// Warns when the party falls on a dry day. National days and dry days you added are
// certain — shops are shut, so it says when to buy by. Festival and state days vary by
// state and year, so those only ask you to check (a search for that date and state).
// A certain dry day the day before the party gets a heads-up too: that's when most
// people would shop.
import { addDays, dryDayOn, lastShoppingDay, prettyDate, stateOf, confirmUrl, todayISO } from "../lib/drydays.js";
import { openUrl } from "../lib/order.js";

const certain = (d) => d && (d.level === "national" || d.level === "custom");
const dryName = (d) => (d.level === "custom" ? `a dry day${d.name !== "Dry day" ? ` (${d.name})` : ""}` : d.name);

export default function DryDayBanner({ date, city, customDry, compact = false, style }) {
  const custom = customDry || [];
  const dry = dryDayOn(date, city, custom);
  const eve = !dry && date ? addDays(date, -1) : null;
  const eveDry = eve && certain(dryDayOn(eve, city, custom)) ? dryDayOn(eve, city, custom) : null;
  if (!dry && !eveDry) return null;
  const today = todayISO();

  if (eveDry) {
    const before = lastShoppingDay(eve, city, custom);
    return (
      <div className={`note bar-dry note-warn ${compact ? "bar-dry-compact" : ""}`} style={style} role="status">
        <span className="bar-dry-icon" aria-hidden="true">⚠️</span>
        <span className="grow">
          <b>{prettyDate(eve)} is {dryName(eveDry)}</b> — shops are shut the day before the party. Buy {before >= today ? `by ${prettyDate(before)} or ` : ""}on the day.
        </span>
      </div>
    );
  }

  const shut = certain(dry);
  const buyBy = shut ? lastShoppingDay(date, city, custom) : null;
  const when = buyBy && buyBy < today ? "" : ` Buy by ${prettyDate(buyBy)}.`;  // party is today: too late for "buy by"
  return (
    <div className={`note bar-dry ${shut ? "bar-note-danger" : "note-warn"} ${compact ? "bar-dry-compact" : ""}`} style={style} role="status">
      <span className="bar-dry-icon" aria-hidden="true">{shut ? "🚫" : "⚠️"}</span>
      <span className="grow">
        {dry.level === "national" && <><b>{date === today ? "Today" : prettyDate(date)} is {dry.name}</b> — liquor shops are shut across India.{when}</>}
        {dry.level === "custom" && <><b>{date === today ? "Today" : prettyDate(date)} is {dryName(dry)}</b> — liquor shops are shut.{when}</>}
        {!shut && <><b>{dry.name}</b> is often a dry day in {stateOf(city) || "many states"} — check before you plan.</>}
      </span>
      {!shut && <button className="btn btn-xs btn-ghost" onClick={() => openUrl(confirmUrl(date, city))}>Check ↗</button>}
    </div>
  );
}
