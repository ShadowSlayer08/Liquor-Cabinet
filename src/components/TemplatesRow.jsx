// "Start from: Match night · Diwali · New Year's Eve …" at the top of the Food tab's party card.
// A tap shows what the template would change before anything happens; the carts are never
// touched, and the cocktail menu only changes when it's empty or the host asks (lib/templates.js).
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Sheet from "./Sheet.jsx";
import DryDayBanner from "./DryDayBanner.jsx";
import { applyTemplate, orderTemplates, templateChanges, templateToast } from "../lib/templates.js";
import { COCKTAIL } from "../lib/cocktails.js";
import { todayISO } from "../lib/drydays.js";
import { buzz, tap } from "../lib/order.js";
import { Icon } from "./Art.jsx";

export default function TemplatesRow({ party, setParty, cocktailMenu, setCocktailMenu, city, customDry, toast }) {
  const [open, setOpen] = useState(null); // the template being confirmed
  const today = todayISO();
  const order = useMemo(() => orderTemplates(today), [today]);

  return (
    <div className="opt-tpl">
      <div className="kicker" style={{ marginBottom: 8 }}>Start from</div>
      <div className="chips">
        {order.map((t) => (
          <button key={t.id} className={`chip ${party?.name === t.name ? "on" : ""}`} onClick={() => { tap(); setOpen(t); }}>
            <span aria-hidden="true">{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>
      {/* The party card animates in (.fade-up), which traps a fixed overlay inside it — so the sheet
          goes to <body>, like the sheets the rest of the app renders outside cards. */}
      {open && createPortal(
        <TemplateSheet tpl={open} party={party} setParty={setParty} cocktailMenu={cocktailMenu} setCocktailMenu={setCocktailMenu}
          city={city} customDry={customDry} toast={toast} today={today} onClose={() => setOpen(null)} />,
        document.body,
      )}
    </div>
  );
}

function TemplateSheet({ tpl, party, setParty, cocktailMenu, setCocktailMenu, city, customDry, toast, today, onClose }) {
  const hasMenu = (cocktailMenu || []).some((m) => m?.servings > 0 && COCKTAIL[m.id]);
  const [replace, setReplace] = useState(false);
  const useMenu = !hasMenu || replace;
  const next = useMemo(() => applyTemplate({ party, cocktailMenu, tpl, today, replaceMenu: useMenu }), [party, cocktailMenu, tpl, today, useMenu]);
  const tplMenu = useMemo(() => applyTemplate({ party, tpl, today, replaceMenu: true }).cocktailMenu, [party, tpl, today]);
  const changes = templateChanges(party, next.party);
  const menuText = tplMenu.map((m) => `${COCKTAIL[m.id].name} ×${m.servings}`).join(" · ");

  const apply = () => {
    setParty(next.party);
    if (useMenu && tplMenu.length) setCocktailMenu(next.cocktailMenu);
    buzz();
    toast(templateToast(next, city, customDry));
    onClose();
  };

  return (
    <Sheet title={`Set up ${tpl.what}?`} subtitle="Party details change; your carts stay." onClose={onClose}
      footer={(
        <div className="row">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold grow" onClick={apply}><Icon.check size={17} /> Set it up</button>
        </div>
      )}>
      <div className="opt-tpl-hero" aria-hidden="true">{tpl.emoji}</div>

      <div className="card">
        <div className="card-title"><span className="kicker">What changes</span><span className="tiny muted">{next.party.name}</span></div>
        {changes.length ? changes.map((c) => (
          <div key={c.key} className="opt-change">
            <span className="muted">{c.label}</span>
            <span className="grow" />
            <span className="dim opt-from">{c.from}</span>
            <span className="dim">→</span>
            <b>{c.to}</b>
          </div>
        )) : <div className="small muted">Your party already matches this template — only the name changes.</div>}
        <div className="tiny dim" style={{ marginTop: 10 }}>
          {changes.some((c) => c.key === "guests") ? "Host" : "Guests, host"}, UPI id, drivers and tastes stay as they are. Everything stays editable.
        </div>
      </div>

      {next.note && <div className="note note-warn" style={{ marginBottom: 12 }}>{next.note}.</div>}
      {next.party.date !== party?.date && <DryDayBanner date={next.party.date} city={city} customDry={customDry} style={{ marginBottom: 12 }} />}

      {tplMenu.length > 0 && (hasMenu ? (
        <button className="toggle" onClick={() => { tap(); setReplace(!replace); }}>
          <span className="grow"><span className="h3">Replace my cocktail menu</span><br /><span className="tiny muted">with {menuText}</span></span>
          <span className={`switch ${replace ? "on" : ""}`} />
        </button>
      ) : (
        <div className="card">
          <div className="kicker" style={{ marginBottom: 8 }}>Party menu</div>
          <div className="chips" style={{ marginBottom: -8 }}>
            {tplMenu.map((m) => (
              <span key={m.id} className="chip"><span aria-hidden="true">{COCKTAIL[m.id].emoji}</span> {COCKTAIL[m.id].name} <b className="gold">×{m.servings}</b></span>
            ))}
          </div>
          <div className="tiny dim" style={{ marginTop: 8 }}>Their extras go on your Blinkit list. Change them any time in the Bar tab.</div>
        </div>
      ))}
    </Sheet>
  );
}
