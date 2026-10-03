// [v1.5 · Out] A club night or food & drink event, read from its District page when you open it
// (lib/outSources.js fetchEvent): its shows (the party's night preselected), the organiser's
// door rules — kept apart from the state's legal age — and the tickets District sells, exact
// as of now, with what each name says (couple, group of 5…), cover vs entry fee and any gate
// cover the event's text mentions. You plan how many of each here; you buy them in District.
import { useEffect, useMemo, useState } from "react";
import Sheet, { Qty, Skeleton } from "../Sheet.jsx";
import DryDayBanner from "../DryDayBanner.jsx";
import { fetchEvent } from "../../lib/outSources.js";
import { eventUrl } from "../../lib/parse/district.js";
import { ageFor } from "../../lib/age.js";
import {
  showFor, alignParty, eventPick, eventWhenText, eventPriceText, doorRules, ticketKindLabel, serviceText, gateCoverText,
  ticketPeople, gateCoverTotal, planTicket, clampQty, feeText, ageLine, kmText, kmBetween, istDate, directionsUrl,
} from "../../lib/out.js";
import { prettyTime, clockOf } from "../../lib/when.js";
import { fmt, ageStr } from "../../lib/format.js";
import { openDistrict, openUrl, tap } from "../../lib/order.js";
import { Icon, VenueArt } from "../Art.jsx";

export default function EventSheet({ e, kind, city, party, setParty, origin, out, setOut, customDry, toast, onLoaded, onClose }) {
  const [state, setState] = useState({ loading: true });
  const [show, setShow] = useState(-1);
  const isPick = out.pick?.type === "event" && out.pick.slug === e.slug;
  const [qty, setQty] = useState(() => (isPick ? Object.fromEntries((out.tickets || []).map((t) => [t.id, t.qty])) : {}));

  const load = (force = false) => {
    setState({ loading: true });
    fetchEvent(e.slug, { force })
      .then((d) => {
        if (!d) throw new Error("Nothing readable on the page");
        setState({ d });
        setShow((cur) => (cur >= 0 && cur < (d.shows?.length || 0) ? cur : showFor(d.shows, party?.date)));
        onLoaded?.(e, d);
      })
      .catch((err) => setState({ error: err?.message || "Couldn't read the page" }));
  };
  useEffect(() => { load(false); }, [e.slug]);

  const d = state.d;
  const tickets = d?.tickets || [];
  const s = d?.shows?.[show] || null;
  const planned = useMemo(() => tickets.filter((t) => (qty[t.id] || 0) > 0).map((t) => planTicket(t, qty[t.id])), [tickets, qty]);
  const plannedCost = planned.reduce((sum, t) => sum + t.price * t.qty, 0);
  const plannedGate = planned.reduce((sum, t) => sum + gateCoverTotal(t), 0);
  const plannedHeads = planned.reduce((sum, t) => sum + ticketPeople(t) * t.qty, 0);
  const people = Math.max(1, party?.guests || 1);
  const place = { lat: d?.lat ?? e.lat, lon: d?.lon ?? e.lon };
  const km = e.km ?? kmBetween(origin, place);
  const directions = directionsUrl(place.lat, place.lon);
  const rules = doorRules(d?.rules);
  const legal = ageLine(ageFor(city));
  const move = s ? alignParty(s, party) : null;
  const asOf = d?.fetchedAt ? (Date.now() - d.fetchedAt < 12 * 3600000 ? prettyTime(clockOf(new Date(d.fetchedAt))) : ageStr(d.fetchedAt)) : "";

  const setQ = (t, want) => {
    const next = { ...qty, [t.id]: clampQty(t, want, qty[t.id] || 0) };
    setQty(next);
    tap();
    if (isPick) setOut((o) => ({ ...o, tickets: tickets.filter((x) => next[x.id] > 0).map((x) => planTicket(x, next[x.id])) }));
  };

  const makeParty = () => {
    tap();
    const pick = eventPick(e, d, s, { kind });
    setOut((o) => ({ ...o, active: true, pick, tickets: d ? planned : [], booked: isPick ? o.booked : false, corkage: null }));
    if (move) {
      setParty((p) => ({ ...p, ...move }));
      toast?.(`${pick.name} is the party — moved to ${eventWhenText(s.start, s.end)}`);
    } else toast?.(`${pick.name} is the party`);
    onClose();
  };

  return (
    <Sheet title={d?.name || e.name} subtitle={[d?.venue || e.venue, kmText(km)].filter(Boolean).join(" · ") || null} onClose={onClose} footer={
      <div className="ot-foot">
        <button className="btn ot-btn-district btn-block" onClick={() => { tap(); openDistrict({ web: eventUrl(e.slug) }); }}>
          Buy tickets on District <Icon.external size={15} />
        </button>
        <div className="row">
          {directions && <button className="btn btn-ghost btn-sm" onClick={() => openUrl(directions)}><Icon.route size={15} /> Directions</button>}
          <button className={`btn btn-sm grow ${isPick ? "btn-ghost" : "btn-gold"}`} disabled={state.loading} onClick={makeParty}>
            {isPick ? <><Icon.check size={14} /> The party · update</> : "Make this the party"}
          </button>
        </div>
      </div>
    }>
      <div className="ot-sheet-hero">
        <VenueArt kind={kind === "club" ? "club" : "events"} size={64} />
        <div className="grow">
          <div className="h3">{eventPriceText(d?.priceFrom ?? e.priceFrom)}</div>
          <div className="tiny muted">{d?.address || [e.venue, e.locality].filter(Boolean).join(", ")}</div>
          {km != null && <div className="tiny dim">{kmText(km)} from {origin?.label || "you"}</div>}
        </div>
      </div>

      {state.loading && <Skeleton h={80} n={3} />}

      {state.error && (
        <>
          <div className="small soft" style={{ marginBottom: 8 }}><Icon.calendar size={13} className="out-inline-icon" /> {eventWhenText(e.start, e.end)}</div>
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
            <div className="ot-sec-head"><span className="kicker">{(d.shows?.length || 0) > 1 ? "Pick a show" : "When"}</span>{s && istDate(s.start) === party?.date && <span className="tiny gold">your date</span>}</div>
            {(d.shows?.length || 0) > 1 ? (
              <div className="chips ot-shows">
                {d.shows.map((x, i) => (
                  <button key={`${x.start}-${i}`} className={`chip ${i === show ? "on" : ""}`} onClick={() => setShow(i)}>{eventWhenText(x.start, x.end)}</button>
                ))}
              </div>
            ) : <div className="small soft">{s ? eventWhenText(s.start, s.end) : eventWhenText(e.start, e.end) || "Date on District"}</div>}
            {move && <div className="tiny gold" style={{ marginTop: 6 }}>Not on your party date — making it the party moves the date to {eventWhenText(s.start, s.end)}.</div>}
          </div>

          <DryDayBanner mode="bars" date={move?.date || party?.date} city={city} customDry={customDry} style={{ marginBottom: 12 }} />

          {(rules.length > 0 || legal) && (
            <div className="ot-sec">
              <div className="ot-sec-head"><span className="kicker">At the door</span><span className="tiny dim">organiser's rules</span></div>
              {rules.length > 0 && <div className="ot-rules">{rules.map((r) => <span key={r} className="pill ot-pill-why">{r}</span>)}</div>}
              {legal && <div className="tiny muted" style={{ marginTop: 6 }}>{legal}</div>}
            </div>
          )}

          <div className="ot-sec">
            <div className="ot-sec-head"><span className="kicker">Tickets</span>{asOf && <span className="tiny dim">as of {asOf}</span>}</div>
            {!tickets.length && <div className="small muted">District doesn't show tickets for this one right now — open it in District.</div>}
            {tickets.map((t) => {
              const n = qty[t.id] || 0, kindLabel = ticketKindLabel(t);
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
                    {t.gateCover && <div className="tiny" style={{ color: "#f6d9a8" }}>{gateCoverText(t.gateCover)}</div>}
                    {!t.buyable && <div className="tiny red">Sold out or not on sale</div>}
                    {t.description && <div className="tiny dim clamp2">{t.description}</div>}
                  </div>
                  {t.buyable && (n > 0
                    ? <Qty value={n} onChange={(x) => setQ(t, x)} />
                    : <button className="btn btn-xs btn-ghost" onClick={() => setQ(t, 1)}><Icon.plus size={12} /> Plan</button>)}
                </div>
              );
            })}
            {planned.length > 0 && (
              <div className="ot-planned">
                <div className="between small"><span className="soft">Planned: {planned.reduce((x, t) => x + t.qty, 0)} ticket(s) · lets in {plannedHeads} of {people}</span><b>{fmt(plannedCost)}</b></div>
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
