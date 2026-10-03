// Guests' tastes — "Guests like…" at the bottom of the Food tab's party card (party.prefs).
// Drink vibes steer the cocktail & mocktail picks in the Bar tab (lib/suggestDrinks.js);
// cuisines, spice, what nobody eats and Jain steer the dishes (lib/suggestFood.js).
// Closed by default so the party card stays short: one line says what's set.
import { useState } from "react";
import * as cocktails from "../lib/cocktails.js";
import { CUISINES, PROTEINS, SPICE } from "../lib/dishes.js";
import { DEFAULT_PREFS } from "../lib/food.js";
import { normalizePrefs, togglePref, hasPrefs, tagOptions, prefsSummary, AVOIDABLE } from "../lib/prefs.js";
import { tap } from "../lib/order.js";
import { Icon } from "./Art.jsx";

// The drink tastes guests can name (DRINK_TASTES), or every cocktail tag where that list
// doesn't exist — so tags added to lib/cocktails.js show up here on their own.
const TASTES = tagOptions(cocktails.DRINK_TASTES || cocktails.TAGS);

export default function GuestPrefs({ party, setParty }) {
  const [open, setOpen] = useState(false);
  const prefs = normalizePrefs(party?.prefs);
  const any = hasPrefs(prefs);

  // Functional update: every tap starts from the latest saved prefs.
  const change = (fn) => {
    tap();
    setParty((p) => ({ ...p, prefs: normalizePrefs(fn(normalizePrefs(p?.prefs))) }));
  };
  const toggle = (key, id) => change((p) => togglePref(p, key, id));

  // A picked taste the list no longer offers stays visible, so it can be unpicked.
  const tastes = [...TASTES, ...tagOptions(prefs.drinks.filter((id) => !TASTES.some((t) => t.id === id)))];
  const chip = (key, id, label, extra = "") => {
    const on = prefs[key].includes(id);
    return (
      <button key={id} className={`chip ${extra} ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(key, id)}>{label}</button>
    );
  };

  return (
    <div className={`pref ${open ? "open" : ""}`}>
      <button className="toggle pref-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="grow">
          <span className="h3">Guests like…</span>
          <span className={`tiny pref-sum ${any ? "gold" : "muted"}`}>{any ? prefsSummary(prefs, { tags: tastes }) : "Drinks, food & spice — tunes the suggestions"}</span>
        </span>
        <Icon.chevron size={16} className="pref-chev" />
      </button>

      {open && (
        <div className="pref-body fade-up">
          {tastes.length > 0 && (
            <div>
              <div className="pref-label"><span>Drinks they enjoy</span><span className="tiny dim">for the Bar tab's picks</span></div>
              <div className="pref-chips">{tastes.map((t) => chip("drinks", t.id, `${t.emoji ? `${t.emoji} ` : ""}${t.label}`))}</div>
            </div>
          )}
          <div>
            <div className="pref-label"><span>Food they love</span><span className="tiny dim">for the dishes below</span></div>
            <div className="pref-chips">{Object.entries(CUISINES).map(([id, c]) => chip("cuisines", id, `${c.emoji} ${c.label}`))}</div>
          </div>
          <div>
            <div className="pref-label"><span>Spice</span></div>
            <div className="seg">
              {Object.entries(SPICE).map(([k, s]) => (
                <button key={k} className={prefs.spice === k ? "on" : ""} aria-pressed={prefs.spice === k} onClick={() => prefs.spice !== k && change((p) => ({ ...p, spice: k }))}>{s.emoji} {s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="pref-label"><span>Nobody eats</span></div>
            <div className="pref-chips">
              {AVOIDABLE.map((id) => chip("avoid", id, `${prefs.avoid.includes(id) ? "🚫" : PROTEINS[id].emoji} ${PROTEINS[id].label}`, "pref-no"))}
            </div>
          </div>
          <button className="toggle" aria-pressed={prefs.jain} onClick={() => change((p) => ({ ...p, jain: !p.jain }))}>
            <span><span className="h3">Jain guests</span><br /><span className="tiny muted">No onion, garlic or root veg — only dishes that come in a Jain version</span></span>
            <span className={`switch ${prefs.jain ? "on" : ""}`} />
          </button>
          {any && <button className="pref-clear" onClick={() => change(() => DEFAULT_PREFS)}>Clear all</button>}
        </div>
      )}
    </div>
  );
}
