// [v1.5 · Out] A venue's District page, read when you open it (lib/outSources.js fetchVenue):
// what District lists (BYOB, full bar, DJ, group seating…), the listed hours on the party's
// day, its offers as of now, the party's estimate, and the hand-offs — booking a table only
// where District takes bookings, else the venue page. If the page can't be read, the sheet
// still offers the place by name and opens it in District. A page already read this session
// (`initial`) shows at once while the read (usually from the cache) catches up.
import { useEffect, useState } from "react";
import Sheet, { Skeleton } from "../Sheet.jsx";
import DryDayBanner from "../DryDayBanner.jsx";
import ByobBlock from "./ByobBlock.jsx";
import { fetchVenue } from "../../lib/outSources.js";
import { venueUrl, bookUrl, closingTime } from "../../lib/parse/district.js";
import { usualClose } from "../../lib/age.js";
import {
  venuePick, venueKey, dayHours, hoursText, weekday, isByobTags, bigGroupTags, kmText, countText, offerText, costForTwoText, directionsUrl, timingText,
} from "../../lib/out.js";
import { prettyTime, clockOf } from "../../lib/when.js";
import { fmt, ageStr } from "../../lib/format.js";
import { openDistrict, openUrl, tap } from "../../lib/order.js";
import { Icon, VenueArt } from "../Art.jsx";

const telOf = (s) => String(s || "").replace(/[^\d+]/g, "");

export default function VenueSheet({ v, kind, city, party, out, setOut, liquorLines, customDry, openFill, toast, initial = null, onLoaded, onClose }) {
  const [state, setState] = useState(() => (initial ? { d: initial } : { loading: true }));
  const isPick = out.pick?.type === "venue" && venueKey(out.pick) === venueKey(v);
  // Corkage belongs to the picked venue: typed here it's kept for this place, and saved to
  // the plan straight away when this place is already the party.
  const [corkage, setCorkageHere] = useState(isPick ? out.corkage : null);
  const setCorkage = (c) => { setCorkageHere(c); if (isPick) setOut((o) => ({ ...o, corkage: c })); };
  const load = (force = false) => {
    setState((s) => (s.d ? s : { loading: true }));
    fetchVenue({ zcity: v.zcity, slug: v.slug }, { force })
      .then((d) => { if (!d) throw new Error("Nothing readable on the page"); setState({ d }); onLoaded?.(v, d); })
      .catch((e) => setState((s) => (s.d ? s : { error: e?.message || "Couldn't read the page" })));
  };
  useEffect(() => { load(false); }, [v.zcity, v.slug]);

  const d = state.d;
  const people = Math.max(1, party?.guests || 1);
  const cost = d?.costForTwo ?? v.costForTwo ?? null;
  const perHead = cost ? Math.round(cost / 2) : null;
  const cap = out.perHead;
  const tags = d?.amenities || [];
  const big = bigGroupTags(tags);
  const byob = kind === "byob" || isByobTags(tags);
  const page = v.zcity && v.slug ? venueUrl(v) : null;
  const rows = d ? dayHours(d.hours, party?.date) : [];
  const closes = d ? closingTime(d.hours, party?.date) : "";
  const usual = d && !d.hours?.length ? usualClose(city) : null; // the state's "usually", only without listed hours
  const phone = telOf(d?.phones?.[0] || d?.phone);
  const directions = directionsUrl(d?.lat ?? v.lat, d?.lon ?? v.lon);
  const asOf = d?.fetchedAt ? (Date.now() - d.fetchedAt < 12 * 3600000 ? prettyTime(clockOf(new Date(d.fetchedAt))) : ageStr(d.fetchedAt)) : "";

  const makeParty = () => {
    tap();
    const pick = venuePick(v, d, { kind, date: party?.date });
    setOut((o) => {
      const same = o.pick?.type === "venue" && venueKey(o.pick) === venueKey(v);
      return { ...o, active: true, pick, tickets: [], booked: same ? o.booked : false, corkage };
    });
    toast?.(`${pick.name} is the party`);
    onClose();
  };
  const fill = openFill ? () => { onClose(); openFill(); } : null;

  const subtitle = [v.locality || d?.locality, kmText(v.distanceKm)].filter(Boolean).join(" · ") || null;
  const rating = d?.rating ?? v.rating, votes = d?.votes ?? v.votes;
  return (
    <Sheet title={d?.name || v.name} subtitle={subtitle} onClose={onClose} footer={
      <div className="ot-foot">
        {d?.bookable && page
          ? <button className="btn ot-btn-district btn-block" onClick={() => { tap(); openDistrict({ web: bookUrl(v) }); }}>Book a table on District <Icon.external size={15} /></button>
          : page && <button className="btn ot-btn-district btn-block" onClick={() => { tap(); openDistrict({ web: page }); }}>Open in District <Icon.external size={15} /></button>}
        <div className="row">
          {directions && <button className="btn btn-ghost btn-sm" onClick={() => openUrl(directions)}><Icon.route size={15} /> Directions</button>}
          <button className={`btn btn-sm grow ${isPick ? "btn-ghost" : "btn-gold"}`} disabled={!!state.loading} onClick={makeParty}>
            {isPick ? <><Icon.check size={14} /> The party · refresh</> : "Make this the party"}
          </button>
        </div>
      </div>
    }>
      <div className="ot-sheet-hero">
        <VenueArt kind={byob ? "byob" : "bar"} size={64} />
        <div className="grow">
          <div className="h3">{costForTwoText(cost)}</div>
          <div className="tiny muted">
            {typeof rating === "number" && rating > 0 ? <>★ {rating.toFixed(1)}{votes ? ` (${countText(votes)})` : ""} · </> : null}
            {d?.address || v.locality || ""}
          </div>
          {timingText(v.timing) && <div className="tiny dim">{timingText(v.timing)}</div>}
        </div>
      </div>

      <DryDayBanner mode="bars" date={party?.date} city={city} customDry={customDry} compact style={{ marginBottom: 12 }} />

      {state.loading && <Skeleton h={90} n={3} />}

      {state.error && (
        <div className="empty" style={{ padding: "22px 8px" }}>
          <div className="t">Couldn't read this place on District</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}. {page ? "District's own page has everything." : ""}</div>
          {page && <button className="btn btn-ghost btn-sm" onClick={() => load(true)}>↻ Try again</button>}
        </div>
      )}

      {d && (
        <>
          {tags.length > 0 && (
            <div className="ot-sec">
              <div className="ot-sec-head"><span className="kicker">What's here</span><span className="tiny dim">as listed on District</span></div>
              <div className="ot-amen">{tags.map((t) => <span key={t} className={`chip ${/byob|large group|private dining/i.test(t) ? "ot-amen-hi" : ""}`}>{t}</span>)}</div>
            </div>
          )}

          <div className="ot-sec">
            <div className="ot-sec-head"><span className="kicker">Hours on {weekday(party?.date) || "the day"}</span><span className="tiny dim">listed hours</span></div>
            <div className="small soft">
              {rows.length ? hoursText(rows) : d.hours?.length ? `Closed on ${weekday(party?.date)}s, going by the listed hours.` : "Not listed — check in District."}
            </div>
            {closes && <div className="tiny muted" style={{ marginTop: 3 }}><Icon.clock size={11} className="out-inline-icon" /> Closes {prettyTime(closes)} that night (listed hours)</div>}
            {usual?.text && <div className="tiny muted" style={{ marginTop: 3 }}>{usual.text}</div>}
          </div>

          {d.offers?.length > 0 && (
            <div className="ot-sec">
              <div className="ot-sec-head"><span className="kicker">Offers</span>{asOf && <span className="tiny dim">as of {asOf}</span>}</div>
              {d.offers.map((o, i) => (
                <div key={i} className="ot-offer">
                  <b>{offerText(o.title) || "Offer"}</b>
                  {(o.subtitle || o.text) && <span className="tiny muted"> {[o.subtitle, o.text].filter(Boolean).join(" · ")}</span>}
                </div>
              ))}
              <div className="tiny dim" style={{ marginTop: 4 }}>Offers apply when you pay through District.</div>
            </div>
          )}
        </>
      )}

      <div className="ot-sec">
        <div className="ot-sec-head"><span className="kicker">For your party</span><span className="tiny dim">{people} people</span></div>
        {perHead ? (
          <>
            <div className="between">
              <span className="small soft">About {fmt(perHead)} a head</span>
              <b>≈ {fmt(perHead * people)}</b>
            </div>
            <div className="tiny muted">{fmt(cost)} for two is the venue's estimate — the bill is in District.</div>
            {cap > 0 && (
              <div className={`tiny ${perHead > cap ? "red" : "green"}`} style={{ marginTop: 3 }}>
                {perHead > cap ? `${fmt(perHead - cap)} a head over your ${fmt(cap)}` : `Within your ${fmt(cap)} a head`}
              </div>
            )}
          </>
        ) : <div className="small muted">The venue doesn't list a cost for two.</div>}
        <div className="tiny dim" style={{ marginTop: 6 }}>Free tables, how many a table takes and any cover charge: District shows these when you book.</div>
      </div>

      {(people > 15 || out.bigGroup) && (
        <div className="note note-info ot-big">
          <Icon.users size={18} />
          <span className="grow">
            {big.length ? <><b>{big.join(", ")}</b> — as listed. </> : null}
            District shows how many guests a table takes (we've seen 15–30). {people > 15 ? `For ${people}, call the venue.` : "For a bigger party, call the venue."}
          </span>
          {phone && <a className="btn btn-xs btn-ghost" href={`tel:${phone}`}><Icon.phone size={13} /> Call</a>}
        </div>
      )}

      {byob && <ByobBlock city={city} liquorLines={liquorLines} corkage={corkage} onCorkage={setCorkage} openFill={fill} />}
    </Sheet>
  );
}
