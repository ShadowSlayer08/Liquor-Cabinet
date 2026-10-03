// ═══════════════════════════════════════════════════════════════════════════════
//  OUT TAB — plan a party outside (v1.5): bars & pubs and BYOB places near you (from
//  Zomato's lists), club nights and food & drink events (from District's), each opened
//  from its District page and booked or bought in the District app — never here.
//  The plan card sets home or out, the kind of night and the budget a head; "Your night
//  out" sums up the pick. Props come from App.jsx; shapes in lib/outModel.js, ranking and
//  sums in lib/out.js, fetching and caching in lib/outSources.js. No photos anywhere.
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "./Sheet.jsx";
import OutPlanCard from "./out/OutPlanCard.jsx";
import NightOutCard from "./out/NightOutCard.jsx";
import VenueCard from "./out/VenueCard.jsx";
import EventCard from "./out/EventCard.jsx";
import VenueSheet from "./out/VenueSheet.jsx";
import EventSheet from "./out/EventSheet.jsx";
import { OUT_KIND } from "../lib/outModel.js";
import { fetchVenueList, fetchEventList } from "../lib/outSources.js";
import { eventListUrls } from "../lib/parse/district.js";
import { byobRule } from "../lib/age.js";
import { rankVenues, eventsForDate, venueKey, venuePick, freshEventPick, refreshTickets } from "../lib/out.js";
import { CITY_COORDS } from "../lib/location.js";
import { cityName } from "../lib/parse/livcheers.js";
import { prettyDate } from "../lib/drydays.js";
import { openDistrict, openUrl, tap } from "../lib/order.js";
import { ageStr } from "../lib/format.js";
import { Icon } from "./Art.jsx";

const MAX_KM = 25; // District's lists are city-wide (all of NCR for Gurugram)

export default function OutTab({
  city, loc, locating, onLocate, party, setParty, plan, out, setOut, liquorLines, liquorTotal, customDry, toast,
  openFill, goTab, goPlanCard,
}) {
  const kind = OUT_KIND[out?.kind] ? out.kind : "bar";
  const K = OUT_KIND[kind];
  const [state, setState] = useState({ loading: true });
  const [seen, setSeen] = useState({});          // venueKey → VenueDetails read this session (group seating, bookings, hours)
  const [venueOpen, setVenueOpen] = useState(null); // { v, kind }
  const [eventOpen, setEventOpen] = useState(null); // { e, kind }
  const [fitsOnly, setFitsOnly] = useState(false);
  const [wide, setWide] = useState(false);         // events farther than MAX_KM too
  const req = useRef(0);
  const zone = loc?.zomato?.entityId || null;
  const noPages = K.source === "district" && !eventListUrls(city, K.genres).length;

  // One list read per outing type, city and Zomato zone (cached by lib/outSources.js).
  const load = useCallback(async (force = false) => {
    const id = ++req.current;
    if (noPages) { setState({ events: { events: [], urls: [] } }); return; }
    setState({ loading: true });
    try {
      const data = K.source === "district"
        ? { events: await fetchEventList(K.genres, { city, force }) }
        : { venues: await fetchVenueList(kind, { city, loc, force }) };
      if (id === req.current) setState(data);
    } catch (e) {
      if (id === req.current) setState({ error: e?.message || String(e) });
    }
  }, [kind, city, zone, noPages]);
  useEffect(() => { load(false); }, [load]);

  const people = Math.max(1, party?.guests || 1);
  const venues = useMemo(() => rankVenues(state.venues?.venues || [], {
    budgetPerHead: out.perHead, people, bigGroup: out.bigGroup, kind, details: seen, date: party?.date, fitsOnly,
    extraPerHead: kind === "byob" ? (liquorTotal || 0) / people : 0,
  }), [state.venues, out.perHead, people, out.bigGroup, kind, seen, party?.date, fitsOnly, liquorTotal]);

  // Distances from you, or from the city's centre without GPS.
  const centre = CITY_COORDS[city];
  const origin = loc?.lat != null ? { lat: loc.lat, lon: loc.lon, label: "you" } : centre ? { lat: centre[0], lon: centre[1], label: `${cityName(city)}'s centre` } : null;
  const allEvents = useMemo(() => eventsForDate(state.events?.events || [], party?.date, origin, null, { budgetPerHead: out.perHead }),
    [state.events, party?.date, origin?.lat, origin?.lon, out.perHead]);
  const nearEvents = allEvents.filter((e) => e.km == null || e.km <= MAX_KM);
  const events = wide ? allEvents : nearEvents;
  const farCount = allEvents.length - nearEvents.length;
  const onDate = events.filter((e) => e.onDate).length;

  // Opening a place reads its District page: remember what it said, and refresh the pick's snapshot.
  const onVenueLoaded = useCallback((v, d) => {
    setSeen((s) => ({ ...s, [venueKey(v)]: d }));
    setOut((o) => (o.pick?.type === "venue" && venueKey(o.pick) === venueKey(v)
      ? { ...o, pick: venuePick({ ...o.pick, ...v }, d, { kind: o.pick.outKind || kind, date: party?.date }) }
      : o));
  }, [setOut, kind, party?.date]);
  const onEventLoaded = useCallback((e, d) => {
    setOut((o) => (o.pick?.type === "event" && o.pick.slug === e.slug
      ? { ...o, pick: freshEventPick(o.pick, d), tickets: refreshTickets(o.tickets, d.tickets) }
      : o));
  }, [setOut]);
  const openPick = (p) => {
    if (p.type === "venue") setVenueOpen({ v: p, kind: p.outKind || "bar" });
    else setEventOpen({ e: p, kind: p.outKind || "club" });
  };
  const pickedVenue = (v) => out.pick?.type === "venue" && venueKey(out.pick) === venueKey(v);
  const pickedEvent = (e) => out.pick?.type === "event" && out.pick.slug === e.slug;

  const listed = state.venues || state.events;
  const fresh = listed && (
    <button className="link" onClick={() => { tap(); load(true); }}>↻ {listed.fromCache ? ageStr(listed.fetchedAt) : "Refresh"}</button>
  );
  const rule = kind === "byob" ? byobRule(city) : null;
  const where = state.venues?.local && loc ? (loc.label || "you") : cityName(city);
  const bigHint = out.bigGroup && K.source === "zomato" && venues.length > 0 && !venues.some((v) => v.big);

  return (
    <div>
      <div className="section-head" style={{ marginTop: 14 }}>
        <div><div className="kicker">Bars · clubs · BYOB</div><div className="h1" style={{ fontSize: 28 }}>Party <em>out</em></div></div>
      </div>

      <OutPlanCard city={city} loc={loc} locating={locating} onLocate={onLocate} party={party} setParty={setParty} plan={plan}
        out={out} setOut={setOut} customDry={customDry} />

      {out.pick && (
        <NightOutCard out={out} setOut={setOut} party={party} loc={loc} locating={locating} onLocate={onLocate}
          liquorLines={liquorLines} goPlanCard={goPlanCard} onOpen={openPick} toast={toast} />
      )}

      <div className="section-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="kicker">{K.emoji} {K.label}</div>
          <div className="h2 ellipsis">
            {K.source === "zomato" ? <>Near <em>{where}</em></> : onDate ? <>{onDate} on <em>{prettyDate(party?.date)}</em></> : <>Coming <em>up</em></>}
          </div>
        </div>
        {fresh}
      </div>

      {rule?.text && <div className="note note-warn" style={{ marginBottom: 12 }}>{rule.text}</div>}

      {!state.loading && ((out.perHead > 0 && K.source === "zomato") || (K.source === "district" && farCount > 0)) && (
        <div className="ot-filters">
          {out.perHead > 0 && K.source === "zomato" && (
            <button className={`chip ${fitsOnly ? "on" : ""}`} onClick={() => { tap(); setFitsOnly((f) => !f); }}>Within budget only</button>
          )}
          {K.source === "district" && farCount > 0 && (
            <button className={`chip ${wide ? "on" : ""}`} onClick={() => { tap(); setWide((w) => !w); }}>
              {wide ? `All of ${cityName(city)}'s list` : `+ ${farCount} farther than ${MAX_KM} km`}
            </button>
          )}
        </div>
      )}

      {state.loading && <Skeleton h={104} n={4} />}

      {state.error && (
        <div className="empty">
          <div className="t">Couldn't reach {K.source === "district" ? "District" : "Zomato"}</div>
          <div className="small" style={{ marginBottom: 14 }}>{state.error}</div>
          <button className="btn btn-ghost" onClick={() => load(true)}>↻ Try again</button>
        </div>
      )}

      {K.source === "zomato" && state.venues && (
        <>
          {bigHint && <div className="tiny muted ot-hint">Open a few places — the ones District lists with group seating or private dining move up.</div>}
          {venues.map((v, i) => (
            <VenueCard key={venueKey(v) || i} v={v} kind={kind} picked={pickedVenue(v)} budget={out.perHead} delay={i}
              onOpen={(x) => { tap(); setVenueOpen({ v: x, kind }); }} />
          ))}
          {!venues.length && (
            <div className="empty">
              <div className="t">{fitsOnly && state.venues.venues?.length ? "Nothing within your budget" : "No places on this list"}</div>
              <div className="small">{fitsOnly && state.venues.venues?.length ? "Turn off “Within budget only” to see them all." : `Zomato didn't list any ${kind === "byob" ? "BYOB places" : "bars"} for ${where} just now.`}</div>
            </div>
          )}
          <div className="ot-list-foot">
            <span className="tiny dim">Costs are each venue's "for two" estimate. Offers apply when you pay through District.</span>
            {state.venues.url && <button className="btn btn-ghost btn-sm" onClick={() => { tap(); openUrl(state.venues.url); }}>More on Zomato <Icon.external size={14} /></button>}
          </div>
        </>
      )}

      {K.source === "district" && state.events && (
        noPages ? (
          <div className="empty">
            <div className="t">No {K.label.toLowerCase()} listed here</div>
            <div className="small" style={{ marginBottom: 14 }}>District doesn't list {K.label.toLowerCase()} for {cityName(city)} yet.</div>
            <button className="btn ot-btn-district" onClick={() => { tap(); openDistrict({}); }}>Open District <Icon.external size={15} /></button>
          </div>
        ) : (
          <>
            {events.map((e, i) => (
              <EventCard key={e.slug || i} e={e} kind={kind} picked={pickedEvent(e)} budget={out.perHead} delay={i}
                onOpen={(x) => { tap(); setEventOpen({ e: x, kind }); }} />
            ))}
            {!events.length && (
              <div className="empty">
                <div className="t">{farCount ? `Nothing within ${MAX_KM} km` : "Nothing listed right now"}</div>
                <div className="small">{farCount ? `District lists ${farCount} farther from ${origin?.label || "you"} — tap above to see them.` : "District's list for the city is empty. Try again later, or look in District."}</div>
              </div>
            )}
            <div className="ot-list-foot">
              <span className="tiny dim">"From" is the cheapest ticket District lists now; fees and GST come at checkout. Distances from {origin?.label || "the city"}.</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { tap(); openDistrict({ web: state.events.urls?.[0] }); }}>More in District <Icon.external size={14} /></button>
            </div>
          </>
        )
      )}

      {venueOpen && (
        <VenueSheet key={venueKey(venueOpen.v)} v={venueOpen.v} kind={venueOpen.kind} city={city} party={party} out={out} setOut={setOut}
          liquorLines={liquorLines} customDry={customDry} openFill={openFill} toast={toast} onLoaded={onVenueLoaded} onClose={() => setVenueOpen(null)} />
      )}
      {eventOpen && (
        <EventSheet key={eventOpen.e.slug} e={eventOpen.e} kind={eventOpen.kind} city={city} party={party} setParty={setParty} origin={origin}
          out={out} setOut={setOut} customDry={customDry} toast={toast} onLoaded={onEventLoaded} onClose={() => setEventOpen(null)} />
      )}
    </div>
  );
}
