// [v1.5 · Out] A club night or food & drink event, read from its District page when you open it
// (lib/outSources.js fetchEvent): its shows (the picked one, else the party's night, preselected),
// the organiser's door rules — kept apart from the state's legal age — and the tickets District
// sells for the chosen show (district.js ticketsForShow: a weekly night lists each ticket once),
// exact as of now, with what each name says (couple, group of 5…), cover vs entry fee and any
// gate cover the event's text mentions. You plan how many of each here; you buy them in District.
// Shows are kept by their start and tickets by name + price (lib/out.js ticketKey), because a
// weekly night's ids and show list change as its past shows drop off the page.
import { useEffect, useMemo, useRef, useState } from "react";
import Sheet, { Qty, Skeleton } from "../Sheet.jsx";
import DryDayBanner from "../DryDayBanner.jsx";
import { fetchEvent } from "../../lib/outSources.js";
import { eventUrl, ticketsForShow } from "../../lib/parse/district.js";
import { ageLine } from "../../lib/age.js";
import {
  showFor, showOver, alignParty, eventPick, eventWhenText, eventPriceText, doorRules, ticketKindLabel, serviceText, gateCoverText,
  ticketPeople, gateCoverTotal, plannedTickets, qtyFromPlan, ticketKey, clampQty, feeText, kmText, kmBetween, onNight, directionsUrl,
} from "../../lib/out.js";
import { prettyTime, clockOf } from "../../lib/when.js";
import { fmt, ageStr } from "../../lib/format.js";
import { openDistrict, openUrl, tap } from "../../lib/order.js";
import { Icon, VenueArt } from "../Art.jsx";

export default function EventSheet({ e, kind, city, party, setParty, origin, out, setOut, customDry, toast, initial = null, onLoaded, onClose }) {
  const isPick = out.pick?.type === "event" && out.pick.slug === e.slug;
  const pickedStart = isPick ? out.pick.start : "";
  const [state, setState] = useState(() => (initial ? { d: initial } : { loading: true }));
  // The chosen show is kept by its start, not its place in the list: a newer read of a weekly
  // night has dropped the shows that are over, so the same index is another night.
  const [chosen, setChosen] = useState(pickedStart);   // "" = the party's night, else the next one
  const d = state.d;
  const shows = d?.shows || [];
  const show = d ? showFor(shows, party?.date, Date.now(), chosen) : -1;
  const s = shows[show] || null;
  const tickets = useMemo(() => (d ? ticketsForShow(d, show) : []), [d, show]);
  // Quantities by lib/out.js ticketKey (name + price) — ids change from show to show.
  const [qty, setQty] = useState(() => (isPick ? qtyFromPlan(tickets, out.tickets) : {}));
  const touched = useRef(false);

  const load = (force = false) => {
    setState((x) => (x.d ? x : { loading: true }));
    fetchEvent(e.slug, { force })
      .then((fresh) => {
        if (!fresh) throw new Error("Nothing readable on the page");
        setState({ d: fresh });
        onLoaded?.(e, fresh);
      })
      .catch((err) => setState((x) => (x.d ? x : { error: err?.message || "Couldn't read the page" })));
  };
  useEffect(() => { load(false); }, [e.slug]);
  // Each read of the page: the saved plan, matched to that read's tickets for the show on
  // screen — unless you've changed the quantities here already.
  useEffect(() => {
    if (d && isPick && !touched.current) setQty(qtyFromPlan(tickets, out.tickets));
  }, [d]);

  const planned = useMemo(() => plannedTickets(tickets, qty), [tickets, qty]);
  const plannedCost = planned.reduce((sum, t) => sum + t.price * t.qty, 0);
  const plannedGate = planned.reduce((sum, t) => sum + gateCoverTotal(t), 0);
  const plannedHeads = planned.reduce((sum, t) => sum + ticketPeople(t) * t.qty, 0);
  const plannedCount = planned.reduce((x, t) => x + t.qty, 0);
  const people = Math.max(1, party?.guests || 1);
  const place = { lat: d?.lat ?? e.lat, lon: d?.lon ?? e.lon };
  const km = e.km ?? kmBetween(origin, place);
  const directions = directionsUrl(place.lat, place.lon);
  const rules = doorRules(d?.rules);
  // The show the party would be: the chosen one. When the page couldn't be read: the picked
  // show if this is the party already, else the list card's own date.
  const fallback = isPick && out.pick.start ? out.pick : e;
  const at = s || (!d && fallback.start ? { start: fallback.start, end: fallback.end || "" } : null);
  const over = !!at && showOver(at);
  const move = at ? alignParty(at, party) : null;        // the party's new date and/or time, or null
  const moveDate = !!move && move.date !== party?.date;
  const soldOut = !!(s?.soldOut || (d?.soldOut && !tickets.some((t) => t.buyable)));
  const asOf = d?.fetchedAt ? (Date.now() - d.fetchedAt < 12 * 3600000 ? prettyTime(clockOf(new Date(d.fetchedAt))) : ageStr(d.fetchedAt)) : "";

  // Already the party, on the picked show: the plan follows the stepper straight away. On
  // another show it waits for "update", which moves the pick to that show too.
  const pickedShow = isPick && !!s && Date.parse(s.start) === Date.parse(out.pick.start);
  const setQ = (t, want) => {
    const k = ticketKey(t);
    const next = { ...qty, [k]: clampQty(t, want, qty[k] || 0) };
    touched.current = true;
    setQty(next);
    tap();
    if (pickedShow) setOut((o) => ({ ...o, tickets: plannedTickets(tickets, next) }));
  };

  // Unread page: the saved tickets stay. Another show: "Booked on District" was for the old one.
  const makeParty = () => {
    tap();
    const pick = eventPick(e, d, s || (!d ? at : null), { kind });
    const sameShow = isPick && !!at && Date.parse(at.start) === Date.parse(out.pick.start);
    setOut((o) => ({ ...o, active: true, pick, tickets: d ? planned : isPick ? o.tickets : [], booked: sameShow ? o.booked : false, corkage: null }));
    if (move) {
      setParty((p) => ({ ...p, ...move }));
      toast?.(`${pick.name} is the party — ${moveDate ? `moved to ${eventWhenText(at.start, at.end)}` : `starting ${prettyTime(move.time)}`}`);
    } else toast?.(`${pick.name} is the party`);
    onClose();
  };

  const where = d?.address || [d?.venue || e.venue, d?.locality || e.locality].filter(Boolean).join(", ");
  return (
    <Sheet title={d?.name || e.name} subtitle={[d?.venue || e.venue, kmText(km)].filter(Boolean).join(" · ") || null} onClose={onClose} footer={
      <div className="ot-foot">
        <button className="btn ot-btn-district btn-block" onClick={() => { tap(); openDistrict({ web: eventUrl(e.slug) }); }}>
          Buy tickets on District <Icon.external size={15} />
        </button>
        <div className="row">
          {directions && <button className="btn btn-ghost btn-sm" onClick={() => openUrl(directions)}><Icon.route size={15} /> Directions</button>}
          <button className={`btn btn-sm grow ${isPick ? "btn-ghost" : "btn-gold"}`} disabled={!!state.loading || over} onClick={makeParty}>
            {isPick ? <><Icon.check size={14} /> The party · update</> : "Make this the party"}
          </button>
        </div>
      </div>
    }>
      <div className="ot-sheet-hero">
        <VenueArt kind={kind === "club" ? "club" : "events"} size={64} />
        <div className="grow">
          <div className="h3">{eventPriceText(d?.priceFrom ?? e.priceFrom)}{soldOut && <span className="pill ot-pill-over ot-pill-inline">Sold out</span>}</div>
          {where && <div className="tiny muted">{where}</div>}
          {km != null && <div className="tiny dim">{kmText(km)} from {origin?.label || "you"}</div>}
          {d?.organizer && <div className="tiny dim">By {d.organizer}</div>}
        </div>
      </div>

      {state.loading && <Skeleton h={80} n={3} />}

      {state.error && (
        <>
          <div className="small soft" style={{ marginBottom: 8 }}><Icon.calendar size={13} className="out-inline-icon" /> {at ? eventWhenText(at.start, at.end) : "Date on District"}{over ? " · over" : ""}</div>
          <div className="empty" style={{ padding: "22px 8px" }}>
            <div className="t">Couldn't read this event on District</div>
            <div className="small" style={{ marginBottom: 14 }}>{state.error}. Its District page has the tickets.</div>
            <button className="btn btn-ghost btn-sm" onClick={() => load(true)}>↻ Try again</button>
          </div>
        </>
      )}

      {d && (
        <>
          <div className="ot-sec">
            <div className="ot-sec-head">
              <span className="kicker">{shows.length > 1 ? "Pick a show" : "When"}</span>
              {s && onNight(s.start, s.end, party?.date) && <span className="tiny gold">your date</span>}
            </div>
            {shows.length > 1 ? (
              <div className="chips ot-shows">
                {shows.map((x, i) => (
                  <button key={`${x.start}-${i}`} className={`chip ${i === show ? "on" : ""} ${x.soldOut ? "ot-show-out" : ""}`} onClick={() => { tap(); setChosen(x.start); }}>
                    {eventWhenText(x.start, x.end)}{x.soldOut ? " · sold out" : ""}
                  </button>
                ))}
              </div>
            ) : <div className="small soft">{s ? eventWhenText(s.start, s.end) : eventWhenText(e.start, e.end) || "Date on District"}</div>}
            {over ? <div className="tiny red" style={{ marginTop: 6 }}>This show is over{shows.length > 1 ? " — pick another one." : "."}</div>
              : moveDate ? <div className="tiny gold" style={{ marginTop: 6 }}>Not on your party date — making it the party moves the party to {eventWhenText(at.start, at.end)}.</div>
                : move ? <div className="tiny gold" style={{ marginTop: 6 }}>Starts at {prettyTime(move.time)} — making it the party sets the party's time to match.</div>
                  : null}
          </div>

          <DryDayBanner mode="bars" date={move?.date || party?.date} city={city} customDry={customDry} compact style={{ marginBottom: 12 }} />

          <div className="ot-sec">
            <div className="ot-sec-head"><span className="kicker">At the door</span>{rules.length > 0 && <span className="tiny dim">organiser's rules</span>}</div>
            {rules.length > 0
              ? <div className="ot-rules">{rules.map((r) => <span key={r} className="pill ot-pill-why">{r}</span>)}</div>
              : <div className="small muted">The organiser lists no door rules — the venue still decides entry.</div>}
            <div className="tiny muted" style={{ marginTop: 6 }}><Icon.idcard size={12} className="out-inline-icon" /> {ageLine(city)}</div>
          </div>

          <div className="ot-sec">
            <div className="ot-sec-head"><span className="kicker">Tickets</span>{asOf && <span className="tiny dim">as of {asOf}</span>}</div>
            {!tickets.length && <div className="small muted">District doesn't show tickets for this {shows.length > 1 ? "show" : "one"} right now — open it in District.</div>}
            {tickets.map((t) => {
              const n = qty[ticketKey(t)] || 0, kindLabel = ticketKindLabel(t);
              return (
                <div key={t.id} className={`ot-ticket ${t.buyable ? "" : "off"}`}>
                  <div className="grow">
                    <div className="ot-ticket-name">
                      <span className="small b">{t.name}</span>
                      {kindLabel && <span className="pill ot-pill-kind" title="Per the ticket name">{kindLabel}</span>}
                    </div>
                    <div className="small">
                      <b className="gold">{t.price ? fmt(t.price) : "Free"}</b>
                      {serviceText(t.service) && <span className="muted"> · {serviceText(t.service)}</span>}
                    </div>
                    {t.gateCover && <div className="tiny ot-gate">{gateCoverText(t.gateCover)}</div>}
                    {!t.buyable && <div className="tiny red">Sold out or not on sale</div>}
                    {t.description && <div className="tiny dim clamp2">{t.description}</div>}
                  </div>
                  {t.buyable && !over && (n > 0
                    ? <Qty value={n} onChange={(x) => setQ(t, x)} />
                    : <button className="btn btn-xs btn-ghost" onClick={() => setQ(t, 1)}><Icon.plus size={12} /> Plan</button>)}
                </div>
              );
            })}
            {planned.length > 0 && (
              <div className="ot-planned">
                <div className="between small"><span className="soft">Planned: {plannedCount} ticket{plannedCount === 1 ? "" : "s"} · lets in {plannedHeads} of {people}</span><b>{fmt(plannedCost)}</b></div>
                {plannedGate > 0 && <div className="between tiny"><span className="muted">+ at the gate (event's text)</span><span>{fmt(plannedGate)}</span></div>}
              </div>
            )}
            <div className="tiny dim" style={{ marginTop: 8 }}>{feeText(d.feePct)}. Kinds go by the ticket's name. You buy them in District; the plan here is just for your sums.</div>
          </div>

          {d.description && (
            <details className="ot-about">
              <summary className="small gold">About the event</summary>
              <div className="small soft">{d.description}</div>
            </details>
          )}
        </>
      )}
    </Sheet>
  );
}
