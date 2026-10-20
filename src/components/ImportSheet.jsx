// [v1.6 · Co-host] A plan from a co-host (a liquorcabinet://plan link, a pasted message or a
// file): preview it, then use theirs, add their items to mine, or keep it in Past parties.
// Everything here comes from another phone, so it's decoded (lib/planShare.js, size-capped),
// checked (restoreSnapshot) and fitted to this app (fitToApp: supplies' search words back,
// unknown cocktails out) before anything is shown, and nothing changes until a tap.
// A lighter QR carries no food: "Use their plan" then keeps my food and supplies.
// Props (App): input (link / text / file contents), mine (this plan, restoreSnapshot() shape),
// onApply(restored, "replace"|"merge"), onSave(restored), onClose, toast.
import { useMemo, useState } from "react";
import Sheet from "./Sheet.jsx";
import { decodePlan, fitToApp } from "../lib/planShare.js";
import { restoreSnapshot, snapshotSummary, hasPlan } from "../lib/planSnapshot.js";
import { prettyWhen } from "../lib/when.js";
import { todayISO } from "../lib/drydays.js";
import { cityName } from "../lib/parse/livcheers.js";
import { COCKTAIL } from "../lib/cocktails.js";
import { fmt, ageStr } from "../lib/format.js";
import { tap } from "../lib/order.js";
import { Icon } from "./Art.jsx";

const SHOW = 6; // lines per list before "+ N more"

function read(input) {
  try {
    const raw = decodePlan(input);
    const { plan, unknownCocktails } = fitToApp(restoreSnapshot(raw));
    return { plan, light: raw.light === true, skipped: Math.min(200, Math.max(0, Math.round(Number(raw.kitSkipped) || 0))), unknownCocktails, error: "" };
  } catch (e) {
    return { plan: null, light: false, skipped: 0, unknownCocktails: 0, error: e?.message || "Couldn't read that plan" };
  }
}

const plural = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const titleCase = (id) => String(id).replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// What mine has, in one line ("House party · 4 bottles · 2 dishes · ₹6,450").
function mineLine(m) {
  if (!m || !hasPlan(m)) return "Your plan is empty, so nothing of yours is lost.";
  const s = snapshotSummary(m);
  const bits = [s.bottles && plural(s.bottles, "bottle"), s.cocktails && plural(s.cocktails, "cocktail"), s.dishes && plural(s.dishes, "dish", "dishes"),
    s.supplies && plural(s.supplies, "supply", "supplies"), s.out && s.place].filter(Boolean);
  return `Yours now: ${[s.name, ...bits].join(" · ")}${s.total ? ` · ${fmt(s.total)}` : ""}`;
}

function Section({ title, right, children }) {
  return (
    <div className="ch-sec">
      <div className="between"><span className="kicker">{title}</span>{right && <span className="tiny muted">{right}</span>}</div>
      {children}
    </div>
  );
}

function More({ n }) {
  return n > 0 ? <div className="tiny dim ch-more">+ {n} more</div> : null;
}

export default function ImportSheet({ input, mine, onApply, onSave, onClose }) {
  const { plan, light, skipped, unknownCocktails, error } = useMemo(() => read(input), [input]);
  const [confirm, setConfirm] = useState(false);

  if (error) {
    return (
      <Sheet title="A plan from a co-host" onClose={onClose}
        footer={<button className="btn btn-ghost btn-block" onClick={onClose}>Close</button>}>
        <div className="ch-error">
          <div className="ch-error-icon"><Icon.close size={20} /></div>
          <div className="small soft b">{error}</div>
          <div className="tiny muted">Ask your co-host to send it again — the .lcplan.json file always carries the whole plan. In their app: Plan → Plan with a co-host.</div>
        </div>
      </Sheet>
    );
  }

  const s = snapshotSummary(plan);
  const p = plan.party;
  const when = prettyWhen(p);
  const passed = p.date && p.date < todayISO();
  const bottles = Object.values(plan.liquor).sort((a, b) => b.qty * b.item.price - a.qty * a.item.price);
  const dishes = plan.food.filter((l) => l.kind !== "blinkit");
  const supplies = plan.food.filter((l) => l.kind === "blinkit");
  const pick = plan.out?.pick;
  const otherCity = plan.city && mine?.city && plan.city !== mine.city;
  const something = hasPlan(plan);
  const mineHas = hasPlan(mine);

  // A lighter QR has no food: replacing keeps mine (theirs wasn't sent).
  const apply = (mode) => { tap(); onApply(light && mode === "replace" ? { ...plan, food: mine?.food || [] } : plan, mode); };
  const useTheirs = () => { if (mineHas && !confirm) { tap(); setConfirm(true); } else apply("replace"); };
  // What of mine "Use their plan" swaps out.
  const ms = snapshotSummary(mine);
  const goes = [ms.bottles && plural(ms.bottles, "bottle"), ms.cocktails && plural(ms.cocktails, "cocktail"),
    !light && ms.dishes && plural(ms.dishes, "dish", "dishes"), !light && ms.supplies && plural(ms.supplies, "supply", "supplies"), ms.out && "night out"].filter(Boolean);
  const goesText = goes.length > 1 ? `${goes.slice(0, -1).join(", ")} and ${goes[goes.length - 1]}` : goes[0] || "party details";

  const footer = confirm ? (
    <div className="ch-confirm">
      <div className="small soft">
        Replace your plan with theirs? Your {goesText} will be swapped for theirs.
        {light ? " Your food and supplies stay — this QR didn't carry theirs." : ""} Your name and UPI ID stay.
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-gold grow" onClick={() => apply("replace")}>Yes, use theirs</button>
        <button className="btn btn-ghost grow" onClick={() => { tap(); setConfirm(false); }}>Keep mine</button>
      </div>
    </div>
  ) : (
    <div className="ch-choices">
      <button className="btn btn-gold btn-block" onClick={useTheirs}>Use their plan</button>
      {mineHas && something && <button className="btn btn-ghost btn-block" onClick={() => apply("merge")}><Icon.plus size={15} /> Add their items to mine</button>}
      <div className="row">
        <button className="btn btn-ghost btn-sm grow" onClick={() => { tap(); onSave(plan); }}>Save to Past parties</button>
        <button className="btn btn-ghost btn-sm grow" onClick={onClose}>Cancel</button>
      </div>
      <div className="tiny dim">
        {mineHas && something ? "Add keeps your party details and adds their bottles, food, supplies and cocktails (the larger number where you both have one). " : ""}
        Nothing changes until you choose.
      </div>
    </div>
  );

  return (
    <Sheet title="A plan from a co-host" onClose={onClose} footer={footer}
      subtitle={[p.host && `From ${p.host}`, plan.savedAt && `as of ${ageStr(plan.savedAt)}`].filter(Boolean).join(" · ") || "Have a look before it changes yours"}>
      <div className="ch-imp-hero">
        <div className="h2 ch-imp-name">{s.name}</div>
        <div className="small soft">{[when || "No date yet", plural(p.guests, "guest")].join(" · ")}</div>
        {s.total > 0 && <div className="small"><b className="gold">About {fmt(s.total)}</b> <span className="muted">at their planned prices</span></div>}
      </div>

      {otherCity && <div className="note note-warn ch-note">Their plan is for {cityName(plan.city)}; yours is {cityName(mine.city)}. Using their plan switches the app to {cityName(plan.city)} prices.</div>}
      {passed && <div className="note note-info ch-note">Their date has passed, so using it moves the party to next Saturday.</div>}
      {light && <div className="note note-info ch-note">This QR code has the party, bottles and cocktails{pick ? " and the night out" : ""}. Ask for the file for their food and supplies.</div>}
      {skipped > 0 && <div className="note note-warn ch-note">{plural(skipped, "supply", "supplies")} from a newer Liquor Cabinet couldn't be read and {skipped === 1 ? "was" : "were"} left out.</div>}
      {unknownCocktails > 0 && <div className="note note-warn ch-note">{plural(unknownCocktails, "cocktail")} this app doesn't know (maybe from a newer Liquor Cabinet) {unknownCocktails === 1 ? "was" : "were"} left out.</div>}
      {!something && <div className="note note-info ch-note">There are no bottles, food or cocktails in it yet — just the party details.</div>}

      {bottles.length > 0 && (
        <Section title={`Bottles · ${s.bottles}`} right={fmt(s.bottleCost)}>
          {bottles.slice(0, SHOW).map((l) => (
            <div key={`${l.cat}:${l.item.id}`} className="ch-line">
              <span className="ch-qty">{l.qty}×</span>
              <span className="grow ellipsis">{l.item.name}{l.item.vol ? <span className="muted"> · {l.item.vol}</span> : null}</span>
              <span className="tiny muted">{fmt(l.item.price * l.qty)}</span>
            </div>
          ))}
          <More n={bottles.length - SHOW} />
        </Section>
      )}

      {plan.cocktailMenu.length > 0 && (
        <Section title={`Cocktails · ${plan.cocktailMenu.length}`}>
          <div className="ch-chips">
            {plan.cocktailMenu.slice(0, 12).map((c) => {
              const info = COCKTAIL[c.id]; // fitToApp kept only ids the app knows
              return <span key={c.id} className="chip">{info?.emoji || "🍸"} {info?.name || titleCase(c.id)} <span className="count">×{c.servings}</span></span>;
            })}
          </div>
          <More n={plan.cocktailMenu.length - 12} />
        </Section>
      )}

      {dishes.length > 0 && (
        <Section title={`Food · ${dishes.length}`} right={s.foodCost ? "Zomato estimates" : ""}>
          {dishes.slice(0, SHOW).map((l) => (
            <div key={l.key} className="ch-line">
              <span className="ch-qty">{l.qty}×</span>
              <span className="grow ellipsis">{l.name}<span className="muted"> · {l.kind === "bistro" ? "Bistro" : l.restaurant?.name}</span></span>
              {l.kind === "zomato" && l.unitPrice > 0 && <span className="tiny muted">{fmt(l.unitPrice * l.qty)}</span>}
            </div>
          ))}
          <More n={dishes.length - SHOW} />
        </Section>
      )}

      {supplies.length > 0 && (
        <Section title={`Supplies · ${supplies.length}`} right="typical MRP">
          <div className="ch-chips">
            {supplies.slice(0, 14).map((l) => <span key={l.key} className="chip">{l.emoji} {l.name} <span className="count">×{l.qty}</span></span>)}
          </div>
          <More n={supplies.length - 14} />
        </Section>
      )}

      {pick && (
        <Section title={plan.out.active ? "Party out" : "A place they saved"}>
          <div className="ch-line">
            <span className="ch-qty">{pick.type === "event" ? "🎟️" : "📍"}</span>
            <span className="grow ellipsis">{pick.name}{(pick.type === "event" ? pick.venue : pick.locality) ? <span className="muted"> · {pick.type === "event" ? pick.venue : pick.locality}</span> : null}</span>
          </div>
        </Section>
      )}

      <div className="ch-mine tiny muted">{mineLine(mine)}</div>
    </Sheet>
  );
}
