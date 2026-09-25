// ═══════════════════════════════════════════════════════════════════════════════
//  BAR — cocktails you can mix with the bottles in the cabinet.
//  Cocktails put on the party menu feed planParty(): their servings replace the
//  default mixer for that spirit, and their extras (mint, juices, ginger ale…)
//  land on the Blinkit list in the Food tab.
// ═══════════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { FAMILIES, TAGS, barList, makeable, menuSummary, withServings } from "../lib/cocktails.js";
import { tap, buzz } from "../lib/order.js";
import CocktailSheet from "./CocktailSheet.jsx";
import { Icon } from "./Art.jsx";

const TAG_EMOJI = { classic: "🎩", easy: "👌", strong: "💪", winter: "☕", refreshing: "🧊", party: "🎉", sweet: "🍬", "make-ahead": "⏳", light: "🪶", brunch: "🥞", dessert: "🍰" };
const tagLabel = (t) => `${TAG_EMOJI[t] ? `${TAG_EMOJI[t]} ` : ""}${t[0].toUpperCase()}${t.slice(1).replace(/-/g, " ")}`;
const needsText = (c) => `needs ${c.missing.map((f) => FAMILIES[f]?.label || f).join(" + ")}`;

// Cabinet hero chip → the Bar tab. Nothing while the cabinet can't make a cocktail.
export function MixableChip({ liquorCats = [], onClick }) {
  const n = makeable(liquorCats).filter((c) => c.can).length;
  if (!n) return null;
  return <button className="chip bar-chip" onClick={onClick}>🍸 {n} cocktail{n === 1 ? "" : "s"} you can make <Icon.chevron size={13} /></button>;
}

export default function BarTab({ liquorCats = [], cocktailMenu, setCocktailMenu, plan, toast, goCabinet, goFood }) {
  const [tag, setTag] = useState(null);
  const [open, setOpen] = useState(null); // cocktail id
  const catKey = liquorCats.join(","); // App passes a new array every render

  const all = useMemo(() => barList(catKey ? catKey.split(",") : []), [catKey]);
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all]);
  const list = tag ? all.filter((c) => c.tags.includes(tag)) : all;
  const ready = list.filter((c) => c.can), locked = list.filter((c) => !c.can);
  const canCount = all.filter((c) => c.can).length;

  const menu = useMemo(() => menuSummary(cocktailMenu), [cocktailMenu]);
  const onMenu = Object.fromEntries(menu.items.map((c) => [c.id, c.servings]));
  const fill = plan.needed ? Math.min(1, menu.total / plan.needed) : 0;
  const openC = open && byId[open];

  const save = (c, servings) => {
    const was = onMenu[c.id];
    setCocktailMenu((m) => withServings(m, c.id, servings));
    buzz();
    toast(was ? `${c.name} now ×${servings} on the menu` : `${c.name} ×${servings} on the menu — its extras are on your Blinkit list`);
    setOpen(null);
  };
  const remove = (c) => {
    setCocktailMenu((m) => withServings(m, c.id, 0));
    tap();
    toast(`${c.name} is off the menu`);
    setOpen(null);
  };

  const card = (c, i) => (
    <button key={c.id} className={`bar-card fade-up ${c.can ? "" : "off"} ${onMenu[c.id] ? "in" : ""}`}
      style={{ "--c": c.color, animationDelay: `${Math.min(i * 30, 240)}ms` }} onClick={() => { tap(); setOpen(c.id); }}>
      {onMenu[c.id] > 0 && <span className="pill bar-onmenu">on menu ×{onMenu[c.id]}</span>}
      <span className="bar-glow"><span className="bar-emoji">{c.emoji}</span></span>
      <span className="bar-name clamp2">{c.name}</span>
      <span className="tiny muted ellipsis">{c.glass} · {c.spirit}</span>
      {!c.can && <span className="pill bar-needs">{needsText(c)}</span>}
    </button>
  );

  return (
    <div>
      <div className="section-head" style={{ marginTop: 14 }}>
        <div><div className="kicker">Cocktails · {canCount} you can make</div><div className="h1" style={{ fontSize: 28 }}>The <em>bar</em></div></div>
      </div>

      {/* ── Party menu ── */}
      {menu.items.length > 0 && (
        <div className="card fade-up">
          <div className="card-title">
            <span className="kicker">Party menu</span>
            <span className="small"><b className="gold">{menu.total}</b> <span className="muted">cocktail{menu.total === 1 ? "" : "s"}</span></span>
          </div>
          {menu.items.map((c) => {
            const missing = byId[c.id] && !byId[c.id].can;
            return (
              <button key={c.id} className="line-item bar-menu-row" onClick={() => { tap(); setOpen(c.id); }}>
                <div className="emo" style={{ background: `color-mix(in srgb, ${c.color} 22%, transparent)` }}>{c.emoji}</div>
                <div className="grow">
                  <div className="h3 ellipsis">{c.name}</div>
                  <div className={`tiny ellipsis ${missing ? "red" : "muted"}`}>{missing ? needsText(byId[c.id]) : `${c.glass} · ${c.spirit}`}</div>
                </div>
                <span className="bar-serv">×{c.servings}</span>
                <Icon.chevron size={15} className="dim" />
              </button>
            );
          })}
          <div className="progress" style={{ marginTop: 12 }}>
            <div style={{ width: `${fill * 100}%`, background: menu.total > plan.needed ? "var(--gold)" : "var(--grad-gold)" }} />
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {!plan.needed ? "No drinkers in the plan yet — set guests and drinkers in the Food tab."
              : menu.total > plan.needed ? `That's ${menu.total - plan.needed} more than the ${plan.needed} drinks planned for ${plan.drinkers} ${plan.drinkers === 1 ? "drinker" : "drinkers"}.`
                : `${menu.total} of the ${plan.needed} drinks planned will be cocktails — the rest get the usual mixer.`}
          </div>
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={goFood}>
            🛒 See their extras on the Blinkit list <Icon.chevron size={14} />
          </button>
        </div>
      )}

      {/* ── Empty cabinet ── */}
      {liquorCats.length === 0 && (
        <div className="card empty fade-up" style={{ padding: "30px 16px" }}>
          <div style={{ fontSize: 44 }}>🍸</div>
          <div className="t">Nothing to mix yet</div>
          <div className="small" style={{ marginBottom: 16 }}>Add a bottle or two to the cabinet and the cocktails you can make light up here.</div>
          <button className="btn btn-gold" onClick={goCabinet}><Icon.cabinet size={18} /> Browse the cabinet</button>
        </div>
      )}

      {/* ── Cocktails ── */}
      <div className="chips" style={{ marginBottom: 6 }}>
        <button className={`chip ${!tag ? "on" : ""}`} onClick={() => setTag(null)}>All</button>
        {TAGS.map((t) => <button key={t} className={`chip ${tag === t ? "on" : ""}`} onClick={() => setTag(tag === t ? null : t)}>{tagLabel(t)}</button>)}
      </div>

      {ready.length > 0 && <div className="bar-grid">{ready.map(card)}</div>}

      {locked.length > 0 && (
        <>
          <div className="section-head">
            <div><div className="kicker">Add a bottle to unlock</div><div className="h2">More to <em>mix</em></div></div>
          </div>
          <div className="bar-grid">{locked.map(card)}</div>
        </>
      )}

      {openC && (
        <CocktailSheet key={openC.id} cocktail={openC} servings={onMenu[openC.id] || 0} suggested={Math.max(1, plan.drinkers)} plan={plan}
          onSave={(n) => save(openC, n)} onRemove={() => remove(openC)} onClose={() => setOpen(null)}
          goCabinet={() => { setOpen(null); goCabinet(); }} />
      )}
    </div>
  );
}
