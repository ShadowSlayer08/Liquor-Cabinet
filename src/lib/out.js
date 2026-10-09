// ═══════════════════════════════════════════════════════════════════════════════
//  OUT — the Out tab's thinking (v1.5): which places suit the party, which club
//  nights and food & drink events fall on its night, and what the night costs.
//
//  rankVenues    bars / BYOB places, best first, each with the reasons its card shows
//                (fits the budget a head, how far, BYOB, takes table bookings…)
//  eventsForDate events on the party's night first, nothing farther than maxKm
//  outingCost    the night out as cost lines, each tagged exact (a ticket price as of
//                when it was read), estimate (a venue's "for two", indicative bottle
//                prices, a gate cover from the event's text) or unknown (corkage
//                nobody has quoted yet) — the app never passes an estimate off as a price
//  nightTimes    "Leave by" and last call for the night-out card
//
//  District lists times in UTC. India has one time zone (+05:30, no DST), so dates
//  here are worked out in IST whatever the phone or the CI machine is set to.
//  "Leave by" and last call are lib/reminderPlan.js's (leaveBy, closesAt, lastCallFor),
//  so the card and the reminders always agree; the legal age is lib/age.js's ageLine.
//  Pure (no Capacitor), so node --test covers it. Shapes: lib/outModel.js.
// ═══════════════════════════════════════════════════════════════════════════════
import { kmBetween, travelMinutes, outSpend, slimVenue, slimEvent } from "./outModel.js";
import { venueUrl, eventUrl, closingTime, cleanOffer, ticketsForShow } from "./parse/district.js";
import { leaveBy, closesAt, lastCallFor } from "./reminderPlan.js";
import { prettyTime, partyStart } from "./when.js";
import { prettyDate } from "./drydays.js";
import { fmt } from "./format.js";

export { kmBetween, travelMinutes };

const IST = 330 * 60000;
const HOUR = 3600000;
const DAY = 24 * HOUR;

// ── Time ──────────────────────────────────────────────────────────────────────

// "2026-10-10T15:30:00Z" → "2026-10-10" / "21:00", in IST ("" when unreadable).
const istIso = (iso) => { const t = Date.parse(iso || ""); return Number.isNaN(t) ? "" : new Date(t + IST).toISOString(); };
export const istDate = (iso) => istIso(iso).slice(0, 10);
export const istClock = (iso) => istIso(iso).slice(11, 16);

// The party's night: 6 am on its date to 6 am the next morning. A club night that runs
// past midnight belongs to the evening it started, not to the next date.
export function nightWindow(date) {
  const t = Date.parse(`${date}T06:00:00+05:30`);
  return Number.isNaN(t) ? null : { from: t, to: t + DAY };
}

// An event's run; no (or a nonsense) end counts as four hours.
function span(start, end) {
  const s = Date.parse(start || "");
  if (Number.isNaN(s)) return null;
  const e = Date.parse(end || "");
  return { from: s, to: Number.isNaN(e) || e <= s ? s + 4 * HOUR : e };
}

// A run over several days — a weekly night District lists once for the season, a festival —
// rather than one night.
const isRun = (s) => !!s && s.to - s.from > DAY;

export function onNight(start, end, date) {
  const w = nightWindow(date), s = span(start, end);
  return !!(w && s && s.from < w.to && s.to > w.from);
}

// Google Maps directions to the pick (the Maps app on the phone, the website otherwise).
export const directionsUrl = (lat, lon) => (lat == null || lon == null ? null : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);

// ── Labels ────────────────────────────────────────────────────────────────────

// 0.83 → "850 m", 2.84 → "2.8 km", 12.4 → "12 km".
export function kmText(km) {
  if (km == null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(50, Math.round(km * 20) * 50)} m`;
  return `${km < 10 ? km.toFixed(1).replace(/\.0$/, "") : Math.round(km)} km`;
}

// Rating counts: 980 → "980", 1234 → "1.2k", 12000 → "12k".
export const countText = (n) => (!n ? "" : n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}k`);

// "Sat, 10 Oct · 9:00 pm" for one night; "7 Oct – 4 Nov" for a run over several days.
export function eventWhenText(start, end) {
  const s = span(start, end);
  if (!s) return "";
  const short = { day: "numeric", month: "short" };
  return isRun(s)
    ?`${prettyDate(istDate(start), short)} – ${prettyDate(istDate(new Date(s.to).toISOString()), short)}`
    : `${prettyDate(istDate(start))} · ${prettyTime(istClock(start))}`;
}

// Zomato and District shout their offers: "FLAT \n20% OFF" → "Flat 20% off".
export function offerText(s) {
  const t = cleanOffer(s);
  return t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

// Zomato's card timing: "Opens at 5pm" stays true, but a countdown ("Opens in 14 minutes")
// is stale within the 12 hours a list is kept, so that kind isn't shown.
export const timingText = (t) => {
  const s = String(t || "").trim();
  return /\bin\s+\d+\s*(?:mins?|minutes?|hrs?|hours?)\b/i.test(s) ? "" : s;
};

export const costForTwoText = (c) => (c ? `${fmt(c)} for two (estimate)` : "Cost not listed");
export const eventPriceText = (p) => (p === 0 ? "Free" : p != null ? `from ${fmt(p)}` : "Price on District");
const pctText = (f) => `${Math.round(f * 1000) / 10}%`;
export const feeText = (feePct) => (feePct > 0 ? `+ District fee up to ${pctText(feePct)} + GST where charged` : "+ any District fee and GST, shown at checkout");

// A note over the venue list, or "": outside Delhi NCR, Zomato's BYOB page is thin (a name
// match, not a BYOB tag), so it finds one or two places at most. `zcity` is the Zomato city
// segment the list was read for (lib/outSources.js fetchVenueList).
export function venueListNote({ kind, zcity } = {}) {
  return kind === "byob" && zcity && zcity !== "ncr" ? "Few BYOB places are listed for this city on Zomato." : "";
}

// ── Venues ────────────────────────────────────────────────────────────────────

// Venue details (lib/outSources.js fetchVenue) are kept by this key — the same <zcity>/<slug> District uses.
export const venueKey = (v) => (v?.zcity && v?.slug ? `${v.zcity}/${v.slug}` : String(v?.resId ?? ""));

export const isByobTags = (tags) => (tags || []).some((t) => /\bbyob\b/i.test(t));
const BIG = /large group|private dining/i;
export const bigGroupTags = (tags) => (tags || []).filter((t) => BIG.test(t));
// A BYOB night: a venue picked off the BYOB list (pick.kind — not the "Going to" chip, which
// moves on as you browse) or one District lists as BYOB. An event is never one.
export const isByobPick = (pick) => pick?.type === "venue" && (pick.kind === "byob" || isByobTags(pick.tags));

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const weekday = (iso) => { const t = Date.parse(`${iso}T12:00:00Z`); return Number.isNaN(t) ? "" : DAYS[new Date(t).getUTCDay()]; };

// The listed hours for the party's day as [{ opens, closes }] ("HH:MM"). District files the
// after-midnight part under the same day (Mon 13:00–23:59 and Mon 00:00–02:00), so that
// late row is joined onto the evening: 13:00–02:00.
export function dayHours(hours, isoDate) {
  const day = weekday(isoDate).toLowerCase();
  if (!day) return [];
  const rows = (hours || [])
    .filter((h) => h?.opens && h?.closes && String(h.day || "").toLowerCase().endsWith(day))
    .map((h) => ({ opens: String(h.opens).slice(0, 5), closes: String(h.closes).slice(0, 5) }))
    .sort((a, b) => a.opens.localeCompare(b.opens));
  const eve = rows.find((r) => r.opens !== "00:00" && (r.closes >= "23:59" || r.closes === "00:00"));
  const late = rows.find((r) => r.opens === "00:00" && r.closes <= "06:00");
  if (eve && late) { eve.closes = late.closes; rows.splice(rows.indexOf(late), 1); }
  return rows;
}
export const hoursText = (rows) => rows.map((r) => `${prettyTime(r.opens)} – ${prettyTime(r.closes)}`).join(", ");
// Listed hours exist, but none on that day.
export const closedOn = (hours, isoDate) => !!(hours?.length && weekday(isoDate) && !dayHours(hours, isoDate).length);

/**
 * Bars / BYOB places for the party, best first: open on the party's day, then (Big group)
 * places District lists with large-group seating or private dining, then within the budget
 * a head, then nearest, then best rated. Details (amenities, bookings, hours) are only known
 * for places whose District page has been opened — `details` maps venueKey → VenueDetails.
 * At a BYOB place (the BYOB list, or District lists it as BYOB — the same rule as the night's
 * cost lines), `extraPerHead` adds the bottles you bring to each head's share.
 * @returns {(import("./outModel.js").VenueListItem & { perHead: number|null, partyCost: number|null,
 *   fit: "fits"|"over"|"unknown"|null, byob: boolean, big: boolean, bookable: boolean|null, closed: boolean, reasons: string[] })[]}
 */
export function rankVenues(list, { budgetPerHead = null, people = 1, bigGroup = false, kind = "bar", details = {}, extraPerHead = 0, date = null, fitsOnly = false } = {}) {
  const cap = budgetPerHead > 0 ? budgetPerHead : null;
  const n = Math.max(1, Number(people) || 1);
  const rows = (list || []).filter(Boolean).map((v, i) => {
    const d = details?.[venueKey(v)] || null;
    const tags = d?.amenities || [];
    const cost = v.costForTwo ?? d?.costForTwo ?? null;
    const byob = kind === "byob" || isByobTags(tags);
    const perHead = cost ? Math.round(cost / 2) + (byob ? Math.round(extraPerHead || 0) : 0) : null;
    const fit = !cap ? null : perHead == null ? "unknown" : perHead <= cap ? "fits" : "over";
    const big = bigGroupTags(tags);
    const bookable = d ? !!d.bookable : null;
    const closed = !!(date && d && closedOn(d.hours, date));
    const reasons = [];
    if (bigGroup && big.length) reasons.push(big[0]);
    if (fit === "fits") reasons.push(`Fits ${fmt(cap)} a head`);
    if (v.distanceKm != null) reasons.push(kmText(v.distanceKm));
    if (byob) reasons.push("BYOB: bring your Cabinet");
    if (bookable) reasons.push("Takes table bookings");
    if (closed) reasons.push(`Closed on ${weekday(date)}s (listed hours)`);
    return { ...v, costForTwo: cost, perHead, partyCost: perHead != null ? perHead * n : null, fit, byob, big: big.length > 0, bookable, closed, reasons, _i: i };
  });
  const FIT = { fits: 0, unknown: 1, over: 2 };
  rows.sort((a, b) => (a.closed - b.closed)
    || (bigGroup ? b.big - a.big : 0)
    || ((FIT[a.fit] ?? 0) - (FIT[b.fit] ?? 0))
    || ((a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    || ((b.rating || 0) - (a.rating || 0))
    || (a._i - b._i));
  return rows.filter((r) => !fitsOnly || r.fit !== "over").map(({ _i, ...r }) => r);
}

// "Make this the party" for a venue: its list card (or the pick being refreshed), plus what
// its District page said. On top of slimVenue: `kind` (the outing type — reminderPlan's
// byobNight and the art read it), the listed `hours`, and `closes` ("HH:MM", district.js
// closingTime) for the night of `closesFor`, so a new party date can redo it (pickForDate).
export function venuePick(v, d, { kind = "bar", date = null } = {}) {
  const hours = d?.hours?.length ? d.hours : Array.isArray(v.hours) ? v.hours : [];
  const merged = {
    ...v, ...(d || {}),
    zcity: v.zcity || d?.zcity || "", slug: v.slug || d?.slug || "",
    locality: v.locality || d?.locality || "", name: d?.name || v.name,
    phone: d?.phones?.[0] || d?.phone || v.phone || "",
    resId: d?.resId ?? v.resId ?? null, costForTwo: d?.costForTwo ?? v.costForTwo ?? null, rating: d?.rating ?? v.rating ?? null,
    closes: date && hours.length ? closingTime(hours, date) : (v.closes || ""),
  };
  const url = merged.zcity && merged.slug ? venueUrl(merged) : v.url || "";
  return { ...slimVenue(merged, url), kind, hours, closesFor: date && hours.length ? date : (v.closesFor || null) };
}

// The pick, its closing time redone for a new party date from the hours it keeps — the same
// object when nothing changes (so App's setOut can bail out), or when it has no hours.
export function pickForDate(pick, date) {
  if (pick?.type !== "venue" || !date || pick.closesFor === date || !pick.hours?.length) return pick;
  return { ...pick, closes: closingTime(pick.hours, date), closesFor: date };
}

// cfg.out with that done, for setOut((o) => outForDate(o, party.date)) — the same object when
// nothing changes. Reminders read pick.closes, so this has to run whatever tab is open.
export const outForDate = (out, date) => {
  const pick = pickForDate(out?.pick, date);
  return pick === out?.pick ? out : { ...out, pick };
};

/**
 * The night-out card's times, from lib/reminderPlan.js so they match the reminders: when to
 * set off (leaveBy: start − travel time from `loc`, on a 5-minute mark), the venue's listed
 * closing time on the party's night and last call 45 min before it. Worked out as if the
 * party were out (a pick saved while the party is at home still shows them), with the closing
 * time redone for the party's date (pickForDate). `noLeave` says why there's no "Leave by":
 * "pin" (the pick has no map pin), "locate" (no location fix), "date" (no party date) or
 * "far" (the fix is too far off to be where you'll set off from).
 * @returns {{ go: { at: Date, minutes: number, km: number, place: string }|null, close: Date|null,
 *   lastCall: Date|null, noLeave: ""|"pin"|"locate"|"date"|"far" }}
 */
export function nightTimes(party, out, loc) {
  const pick = pickForDate(out?.pick, party?.date);
  if (!pick) return { go: null, close: null, lastCall: null, noLeave: "" };
  const asOut = { ...out, active: true, pick };
  const go = leaveBy(party, asOut, loc);
  const close = closesAt(party, pick.closes);
  const noLeave = go ? "" : pick.lat == null || pick.lon == null ? "pin" : loc?.lat == null || loc?.lon == null ? "locate" : !partyStart(party) ? "date" : "far";
  return { go, close, lastCall: close ? lastCallFor(party, asOut) : null, noLeave };
}

// ── Events ────────────────────────────────────────────────────────────────────

export const RUN_REASON = "Runs through your date: check its nights";

/**
 * District's listings are city-wide (all of NCR for Gurugram) and run weeks ahead: keep those
 * within `maxKm` of `origin` (events without a map pin stay; no origin = no cut) and drop the
 * ones already over. Single nights on the party's night come first (`onDate`) — within the
 * budget a head, then nearest. Runs over several days that take in the date follow (`onRun`):
 * District lists a weekly karaoke night as one item from October to December, which is most
 * likely on another weekday, so it isn't "on your date" until its page shows a show that is.
 * The other nights come last, soonest first.
 * @returns {(import("./outModel.js").EventListItem & { km: number|null, onDate: boolean, run: boolean,
 *   onRun: boolean, fit: "fits"|"over"|"unknown"|null, reasons: string[] })[]}
 */
export function eventsForDate(list, date, origin, maxKm = 25, { now = Date.now(), budgetPerHead = null } = {}) {
  const cap = budgetPerHead > 0 ? budgetPerHead : null;
  const rows = [];
  (list || []).forEach((e, i) => {
    if (!e) return;
    const s = span(e.start, e.end);
    if (s && now != null && s.to < now) return;
    const km = kmBetween(origin, e);
    if (km != null && maxKm != null && km > maxKm) return;
    const run = isRun(s);
    const that = !!date && onNight(e.start, e.end, date);
    const onDate = that && !run, onRun = that && run;
    const fit = !cap ? null : e.priceFrom == null ? "unknown" : e.priceFrom <= cap ? "fits" : "over";
    const reasons = [];
    if (onDate) reasons.push("On your date");
    else if (onRun) reasons.push(RUN_REASON);
    if (fit === "fits") reasons.push(e.priceFrom === 0 ? "Free" : `Fits ${fmt(cap)} a head`);
    else if (e.priceFrom === 0) reasons.push("Free");
    if (km != null) reasons.push(kmText(km));
    rows.push({ ...e, km, onDate, run, onRun, fit, reasons, _i: i, _t: s ? s.from : Infinity, _g: onDate ? 0 : onRun ? 1 : 2 });
  });
  const FIT = { fits: 0, unknown: 1, over: 2 };
  const near = (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9);
  rows.sort((a, b) => (a._g - b._g)
    || (a._g < 2 ? ((FIT[a.fit] ?? 0) - (FIT[b.fit] ?? 0)) || near(a, b) || (a._t - b._t) : (a._t - b._t) || near(a, b))
    || (a._i - b._i));
  return rows.map(({ _i, _t, _g, ...r }) => r);
}

// Which of an event's shows to preselect: the one already picked (`picked` = the pick's start),
// else the one on the party's night, else the next one still to come, else the first. -1 when
// it lists none.
export function showFor(shows, date, now = Date.now(), picked = "") {
  const list = shows || [];
  if (!list.length) return -1;
  const p = picked ? Date.parse(picked) : NaN;
  const k = Number.isNaN(p) ? -1 : list.findIndex((s) => Date.parse(s.start) === p);
  if (k >= 0) return k;
  const i = list.findIndex((s) => onNight(s.start, s.end, date));
  if (i >= 0) return i;
  const j = list.findIndex((s) => (span(s.start, s.end)?.to ?? 0) >= now);
  return j >= 0 ? j : 0;
}

// A show that has ended (no end given = four hours after it starts).
export function showOver(show, now = Date.now()) {
  const s = span(show?.start, show?.end);
  return !!s && s.to < now;
}

// Making a show the party moves the party to it — its date and its start time, so "Leave by"
// and the reminders count back from when the doors open: { date, time }. null when the party
// is set for it already, when it's a run over several days (a festival: keep the party's own
// day), or when it's over.
export function alignParty(show, party, now = Date.now()) {
  const s = span(show?.start, show?.end);
  if (!s || isRun(s) || s.to < now) return null;
  const at = { date: istDate(show.start), time: istClock(show.start) };
  return at.date === party?.date && at.time === party?.time ? null : at;
}

// "Make this the party" for an event (a show of it, when its page could be read). On top of
// slimEvent: `kind` (club | events) and District's fee, for the night-out sums.
export function eventPick(e, d, show, { kind = "club" } = {}) {
  const merged = { ...e, ...(d || {}), locality: e?.locality || d?.locality || "", slug: e?.slug || d?.slug || "" };
  if (show) { merged.start = show.start; merged.end = show.end || ""; }
  if (d?.rules) merged.rules = { ...d.rules, stag: stagText(d.rules) };
  return { ...slimEvent(merged, merged.slug ? eventUrl(merged.slug) : ""), kind, feePct: d?.feePct || e?.feePct || 0 };
}

// The picked event, refreshed from a newer read of its page — the chosen show stays.
export const freshEventPick = (pick, d) => (!d ? pick : {
  ...pick,
  name: d.name || pick.name, venue: d.venue || pick.venue, locality: pick.locality || d.locality || "",
  lat: d.lat ?? pick.lat, lon: d.lon ?? pick.lon, priceFrom: d.priceFrom ?? pick.priceFrom,
  ageEntry: d.rules?.ageEntry ?? pick.ageEntry, stag: stagText(d.rules) || pick.stag,
  feePct: d.feePct || pick.feePct || 0, fetchedAt: d.fetchedAt || Date.now(),
});

// What's off about the pick for the party's date, or "": an event whose show is another
// night (the date changed after picking it), or a venue whose listed hours skip that day.
export function pickNote(pick, date) {
  if (!pick || !date) return "";
  if (pick.type === "event" && pick.start && !onNight(pick.start, pick.end, date)) {
    return `This show is on ${eventWhenText(pick.start, pick.end)}, not the party's date. Open it to pick another show.`;
  }
  if (pick.type === "venue" && closedOn(pick.hours, date)) return `Closed on ${weekday(date)}s, going by its listed hours.`;
  return "";
}

// The organiser's door rules, ready to show (the legal age is shown separately).
const say = (label, re, x) => { const t = String(x || "").trim(); return !t ? "" : re.test(t) ? t : `${label}: ${t}`; };
// The stag policy: the organiser's words, else what District's flag says, else "".
export const stagText = (r) => (String(r?.stag || "").trim() ? say("Stag entry", /stag/i, r.stag)
  : r?.stagAllowed === false ? "Stag entry not allowed" : r?.stagAllowed === true ? "Stags allowed" : "");

export function doorRules(rules) {
  const r = rules || {};
  return [
    r.ageEntry ? `Entry ${r.ageEntry}+ (organiser's rule)` : "",
    stagText(r),
    say("ID", /\bid\b/i, r.id),
    say("Dress code", /dress/i, r.dress),
    say("Re-entry", /re-?entry/i, r.reentry),
  ].filter(Boolean);
}

// ── Tickets ───────────────────────────────────────────────────────────────────

const KIND = { stag: "Stag", male: "Male", female: "Female", couple: "Couple", group: "Group", guestlist: "Guestlist", table: "Table" };
export const ticketKindLabel = (t) => (t?.kind === "group" && t.groupSize ? `Group of ${t.groupSize}` : KIND[t?.kind] || "");
export const serviceText = (s) => (s === "cover" ? "Cover: redeemable on food & drinks" : s === "entry" ? "Entry fee" : "");
export const gateCoverText = (g) => (g?.amount
  ? `+ ${fmt(g.amount)} at the gate${g.per === "person" ? " a person" : g.per === "couple" ? " a couple" : ""} (event's text)`
  : "");

// People one ticket lets in: what its name says (couple 2, "Group of 5" 5), else one.
export const ticketPeople = (t) => Math.max(1, t?.groupSize || (t?.kind === "couple" ? 2 : 1));

// What the event's text says is paid at the gate on top, for this many tickets.
export function gateCoverTotal(t) {
  const g = t?.gateCover;
  if (!g?.amount || !(t.qty > 0)) return 0;
  const heads = ticketPeople(t);
  const per = g.per === "person" ? heads : g.per === "couple" ? Math.max(1, Math.floor(heads / 2)) : 1;
  return g.amount * per * t.qty;
}

// A planned ticket, as cfg.out.tickets keeps it (price as of when the event page was read).
export const planTicket = (t, qty) => ({
  id: t.id, name: t.name, price: t.price || 0, qty, kind: t.kind || "general",
  service: t.service ?? null, gateCover: t.gateCover ?? null, groupSize: t.groupSize ?? null,
});

// Tickets are matched by name and price, not by id. District gives each weekly show's ticket
// its own id, and district.js lists one ticket for all the shows under the first show's id, so
// once that show is over and drops off the page, the id changes. Name + price is what
// district.js merges them on, so it holds within a read and across reads. A plan keeps the
// name and the price, so its key needs no storing.
const nameKey = (t) => String(t?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
export const ticketKey = (t) => `${nameKey(t)}|${t?.price || 0}`;

// The ticket in `list` a planned one stands for: the same id, else the same name and price,
// else the only one with that name (its price moved since the plan was made). null if none.
export function matchTicket(p, list) {
  const l = (list || []).filter(Boolean);
  if (!p) return null;
  const byId = p.id != null ? l.find((t) => t.id === p.id) : null;
  if (byId) return byId;
  const k = ticketKey(p), byKey = l.find((t) => ticketKey(t) === k);
  if (byKey) return byKey;
  const same = l.filter((t) => nameKey(t) === nameKey(p));
  return same.length === 1 ? same[0] : null;
}

// The event sheet's quantities ({ [ticketKey]: qty }) for a saved plan, against the tickets of
// the show on screen. A planned ticket that show doesn't sell keeps its own key.
export function qtyFromPlan(showTickets, plan) {
  const q = {};
  for (const p of plan || []) {
    if (!(p?.qty > 0)) continue;
    q[ticketKey(matchTicket(p, showTickets) || p)] = p.qty;
  }
  return q;
}

// The plan for one show: its tickets (district.js ticketsForShow) that are on sale, with the
// quantities chosen in the sheet ({ [ticketKey]: qty }). A ticket another show sells drops out.
export const plannedTickets = (showTickets, qty) => (showTickets || [])
  .filter((t) => t?.buyable && (qty?.[ticketKey(t)] || 0) > 0).map((t) => planTicket(t, qty[ticketKey(t)]));

// The tickets District sells for the show starting at `start` (the pick's): [] when that show
// is no longer on the page; all of them when the page lists no shows.
export function ticketsForStart(d, start) {
  const shows = d?.shows || [];
  if (!shows.length) return d?.tickets || [];
  const t = Date.parse(start || "");
  const i = Number.isNaN(t) ? -1 : shows.findIndex((s) => Date.parse(s.start) === t);
  return i >= 0 ? ticketsForShow(d, i) : [];
}

// A qty stepper inside District's per-order limits: 0 (none), or min…max.
export function clampQty(t, want, cur = 0) {
  const min = Math.max(1, t?.min || 1), max = Math.max(min, t?.max || 10);
  if (!(want > 0)) return 0;
  if (want > cur) return cur === 0 ? min : Math.min(max, want);
  return want < min ? 0 : Math.min(max, want);
}

// Ticket prices (and ids) refreshed from a newer read of the event page — `fresh` = the picked
// show's tickets (ticketsForStart); one that can't be matched is kept as it was.
export function refreshTickets(planned, fresh) {
  return (planned || []).map((p) => { const t = matchTicket(p, fresh); return t ? planTicket(t, p.qty) : p; });
}

// ── The night out's cost ──────────────────────────────────────────────────────

export function bottlesOf(liquorLines) {
  let bottles = 0, total = 0;
  for (const l of liquorLines || []) { bottles += l?.qty || 0; total += (l?.item?.price || 0) * (l?.qty || 0); }
  return { bottles, total };
}

/**
 * The night out as cost lines: [{ id, label, amount, kind }] where kind is "exact" | "estimate" |
 * "unknown" (amount null), plus the total and the share a head (unknown lines count as 0).
 * Bottles you bring and corkage only count at a BYOB place; corkage only once the host typed
 * the venue's quote. `admits` = people the planned tickets let in (by their names), null when
 * none are planned — fewer than the party means the share a head is low.
 */
export function outingCost({ out, party, liquorLines = [] } = {}) {
  const people = Math.max(1, Number(party?.guests) || 1);
  const pick = out?.pick || null;
  const lines = [];
  let admits = null;
  if (pick) {
    const spend = outSpend({ ...out, active: true }, people);
    const tickets = (out.tickets || []).filter((t) => t?.qty > 0);
    if (tickets.length) admits = tickets.reduce((s, t) => s + ticketPeople(t) * t.qty, 0);
    if (pick.type === "venue") {
      lines.push(spend.venue != null
        ? { id: "venue", label: `About ${fmt(Math.round(pick.costForTwo / 2))} a head × ${people} (the venue's ${fmt(pick.costForTwo)} for two, an estimate)`, amount: spend.venue, kind: "estimate" }
        : { id: "venue", label: "The venue's bill (not listed)", amount: null, kind: "unknown" });
    }
    if (tickets.length) {
      const n = tickets.reduce((s, t) => s + t.qty, 0);
      lines.push({ id: "tickets", label: `${n} ticket${n === 1 ? "" : "s"} on District`, amount: spend.tickets, kind: "exact" });
      if (pick.feePct > 0 && spend.tickets > 0) {
        lines.push({ id: "fee", label: `District fee (up to ${pctText(pick.feePct)} + GST)`, amount: Math.round(spend.tickets * pick.feePct * 1.18), kind: "estimate" });
      }
      const gate = tickets.reduce((s, t) => s + gateCoverTotal(t), 0);
      if (gate > 0) lines.push({ id: "gate", label: "Paid at the gate (from the event's text)", amount: gate, kind: "estimate" });
    } else if (pick.type === "event") {
      lines.push(pick.priceFrom === 0
        ? { id: "tickets", label: "Entry (free on District)", amount: 0, kind: "exact" }
        : pick.priceFrom != null
          ? { id: "tickets", label: `Tickets from ${fmt(pick.priceFrom)} × ${people} (pick them in the event)`, amount: pick.priceFrom * people, kind: "estimate" }
          : { id: "tickets", label: "Tickets (price on District)", amount: null, kind: "unknown" });
    }
    if (isByobPick(pick)) {
      const { bottles, total } = bottlesOf(liquorLines);
      if (bottles > 0) {
        lines.push({ id: "bottles", label: `${bottles} bottle${bottles === 1 ? "" : "s"} you bring (indicative prices)`, amount: total, kind: "estimate" });
        lines.push(out.corkage != null
          ? { id: "corkage", label: `Corkage ${fmt(out.corkage)} × ${bottles} (the venue's quote)`, amount: out.corkage * bottles, kind: "estimate" }
          : { id: "corkage", label: "Corkage: set by the venue, ask when you book", amount: null, kind: "unknown" });
      }
    }
  }
  const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
  return { lines, total, perHead: Math.round(total / people), people, admits, unknown: lines.some((l) => l.kind === "unknown") };
}
