// Warns when the party falls on a dry day. National days and dry days you added are
// certain — shops are shut, so it says when to buy by. Festival and state days vary by
// state and year, so those only ask you to check (a search for that date and state).
// A certain dry day the day before the party gets a heads-up too: that's when most
// people would shop. Haryana's 26 Jan and 15 Aug are dry only until 5 pm, so those say so.
//
// mode="bars" (the Out tab) is about going out instead: bars don't always shut with the
// shops (Delhi's stay open on festival dry days), so it uses barsDryOn() — red when bars
// are shut, amber to check, green when only the shops are shut.
import { addDays, barsDryOn, barsDryText, clock, dryDayOn, lastShoppingDay, prettyDate, stateOf, confirmUrl, todayISO } from "../lib/drydays.js";
import { openUrl } from "../lib/order.js";

const certain = (d) => d && (d.level === "national" || d.level === "custom");
const dryName = (d) => (d.level === "custom" ? `a dry day${d.name !== "Dry day" ? ` (${d.name})` : ""}` : d.name);
const TONE = { danger: ["bar-note-danger", "🚫"], warn: ["note-warn", "⚠️"], ok: ["note-ok", "🍸"] };

function BarsBanner({ date, city, custom, compact, style }) {
  const t = barsDryText(barsDryOn(date, city, custom), date, city);
  if (!t) return null;
  const [cls, icon] = TONE[t.tone] || TONE.warn;
  return (
    <div className={`note bar-dry ${cls} ${compact ? "bar-dry-compact" : ""}`} style={style} role="status">
      <span className="bar-dry-icon" aria-hidden="true">{icon}</span>
      <span className="grow"><b>{t.lead}</b> — {t.text}</span>
      {t.check && <button className="btn btn-xs btn-ghost" onClick={() => openUrl(confirmUrl(date, city))}>Check ↗</button>}
    </div>
  );
}

export default function DryDayBanner({ date, city, customDry, compact = false, style, mode = "shops" }) {
  const custom = customDry || [];
  if (mode === "bars") return <BarsBanner date={date} city={city} custom={custom} compact={compact} style={style} />;
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
          {eveDry.until
            ? <><b>{prettyDate(eve)} is {dryName(eveDry)}</b> — shops are shut until {clock(eveDry.until)} the day before the party. Buy after {clock(eveDry.until)} that day, or on the day.</>
            : <><b>{prettyDate(eve)} is {dryName(eveDry)}</b> — shops are shut the day before the party. Buy {before >= today ? `by ${prettyDate(before)} or ` : ""}on the day.</>}
        </span>
      </div>
    );
  }

  const shut = certain(dry);
  const buyBy = shut ? lastShoppingDay(date, city, custom) : null;
  const when = buyBy && buyBy < today ? "" : ` Buy by ${prettyDate(buyBy)}.`;  // party is today: too late for "buy by"
  const day = date === today ? "Today" : prettyDate(date);
  return (
    <div className={`note bar-dry ${shut ? "bar-note-danger" : "note-warn"} ${compact ? "bar-dry-compact" : ""}`} style={style} role="status">
      <span className="bar-dry-icon" aria-hidden="true">{shut ? "🚫" : "⚠️"}</span>
      <span className="grow">
        {dry.level === "national" && !dry.until && <><b>{day} is {dry.name}</b> — liquor shops are shut across India.{when}</>}
        {dry.level === "national" && dry.until && <><b>{day} is {dry.name}</b> — liquor shops in {stateOf(city)} are shut until {clock(dry.until)}.{when ? ` Buy by ${prettyDate(buyBy)}, or after ${clock(dry.until)} on the day.` : ` Buy after ${clock(dry.until)}.`}</>}
        {dry.level === "custom" && <><b>{day} is {dryName(dry)}</b> — liquor shops are shut.{when}</>}
        {!shut && <><b>{dry.name}</b> is often a dry day in {stateOf(city) || "many states"} — check before you plan.</>}
      </span>
      {!shut && <button className="btn btn-xs btn-ghost" onClick={() => openUrl(confirmUrl(date, city))}>Check ↗</button>}
    </div>
  );
}
