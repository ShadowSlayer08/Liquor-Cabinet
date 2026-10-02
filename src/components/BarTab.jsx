// ═══════════════════════════════════════════════════════════════════════════════
//  BAR — cocktails you can mix with the bottles in the cabinet, and mocktails for
//  the guests who aren't drinking (Cocktails | Mocktails; App owns the choice so
//  the Food tab's "Add a mocktail" link can land on Mocktails).
//  Drinks put on the party menu feed planParty(): cocktail servings replace the
//  default mixer for that spirit, mocktail servings replace plain soft drinks, and
//  their extras (mint, juices, ginger ale…) land on the Blinkit list in the Food tab.
//  "Picked for your party" ranks a few of each with lib/suggestDrinks.js.
// ═══════════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { FAMILIES, MOCKTAILS, MOCKTAIL_TAGS, TAGS, barList, makeable, menuSummary, mocktailList, withServings } from "../lib/cocktails.js";
import { suggestDrinks } from "../lib/suggestDrinks.js";
import { tap, buzz } from "../lib/order.js";
import CocktailSheet from "./CocktailSheet.jsx";
import { Icon } from "./Art.jsx";

const TAG_EMOJI = {
  classic: "🎩", easy: "👌", party: "🎉", refreshing: "🧊", fruity: "🍓", sweet: "🍬", sour: "🍋", strong: "💪", spicy: "🌶️",
  creamy: "🥛", warm: "☕", light: "🪶", brunch: "🥞", dessert: "🍰", "make-ahead": "⏳", desi: "🍛", festive: "✨",
};
const tagLabel = (t) => `${TAG_EMOJI[t] ? `${TAG_EMOJI[t]} ` : ""}${t[0].toUpperCase()}${t.slice(1).replace(/-/g, " ")}`;
const needsText = (c) => `needs ${c.missing.map((f) => FAMILIES[f]?.label || f).join(" + ")}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MOCKS = mocktailList();

// Cabinet hero chip → the Bar tab. Nothing while the cabinet can't make a cocktail.
export function MixableChip({ liquorCats = [], onClick }) {
  const n = makeable(liquorCats).filter((c) => c.can).length;
  if (!n) return null;
  return <button className="chip bar-chip" onClick={onClick}>🍸 {n} cocktail{n === 1 ? "" : "s"} you can make <Icon.chevron size={13} /></button>;
}

export default function BarTab({ liquorCats = [], cocktailMenu, setCocktailMenu, plan, party, toast, goCabinet, goFood, kind: kindProp, setKind: setKindProp }) {
  const [ownKind, setOwnKind] = useState("cocktails"); // only if App doesn't control it
  const kind = kindProp === "mocktails" || kindProp === "cocktails" ? kindProp : ownKind;
  const setKind = setKindProp || setOwnKind;
  const mock = kind === "mocktails";
  const [tag, setTag] = useState(null);
  const [open, setOpen] = useState(null); // drink id
  const catKey = liquorCats.join(","); // App passes a new array every render
  const cats = useMemo(() => (catKey ? catKey.split(",") : []), [catKey]);

  const all = useMemo(() => barList(cats), [cats]);
  const byId = useMemo(() => Object.fromEntries([...all, ...MOCKS].map((c) => [c.id, c])), [all]);
  const tags = mock ? MOCKTAIL_TAGS : TAGS;
  const activeTag = tags.includes(tag) ? tag : null;
  const shown = mock ? MOCKS : all;
  const list = activeTag ? shown.filter((c) => c.tags.includes(activeTag)) : shown;
  const ready = list.filter((c) => c.can), locked = list.filter((c) => !c.can);
  const canCount = all.filter((c) => c.can).length;

  const menu = useMemo(() => menuSummary(cocktailMenu), [cocktailMenu]);
  const onMenu = Object.fromEntries(menu.items.map((c) => [c.id, c.servings]));
  const notDrinking = plan.nonDrinkers ?? Math.max(0, plan.guests - plan.drinkers);
  const softPlanned = plan.soft?.planned ?? notDrinking * plan.perDrinker;
  const fill = plan.needed ? Math.min(1, menu.cocktails / plan.needed) : 0;
  const softFill = softPlanned ? Math.min(1, menu.mocktails / softPlanned) : menu.mocktails ? 1 : 0;

  const picks = useMemo(() => suggestDrinks({ liquorCats: cats, party, plan, cocktailMenu }), [cats, party, plan, cocktailMenu]);
  const pickRow = mock ? picks.mocktails : picks.cocktails;
  const why = useMemo(() => Object.fromEntries([...picks.cocktails, ...picks.mocktails].map((p) => [p.id, p.reasons])), [picks]);
  const openC = open && byId[open];

  const switchKind = (k) => {
    if (k === kind) return;
    tap();
    setKind(k);
    setTag(null);
  };
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
        <div>
          <div className="kicker">{mock ? `Mocktails · no bottle needed` : `Cocktails · ${canCount} you can make`}</div>
          <div className="h1" style={{ fontSize: 28 }}>The <em>bar</em></div>
        </div>
      </div>

      <div className="seg drk-seg">
        <button className={mock ? "" : "on"} onClick={() => switchKind("cocktails")}>🍸 Cocktails · {canCount}</button>
        <button className={mock ? "on" : ""} onClick={() => switchKind("mocktails")}>🍹 Mocktails · {MOCKTAILS.length}</button>
      </div>

      {/* ── Picked for your party ── */}
      {pickRow.length > 0 && (
        <>
          <div className="drk-picks-head">
            <span className="kicker"><Icon.sparkle size={12} /> Picked for your party</span>
            <span className="tiny dim">{mock ? `for the ${notDrinking} not drinking` : "from your cabinet"}</span>
          </div>
          <div className="scroll-x drk-picks">
            {pickRow.map((p, i) => {
              const c = byId[p.id];
              if (!c) return null;
              return (
                <button key={p.id} className="drk-pick fade-up" style={{ "--c": c.color, animationDelay: `${Math.min(i * 40, 200)}ms` }}
                  onClick={() => { tap(); setOpen(c.id); }}>
                  <span className="drk-pick-glow">{c.emoji}</span>
                  <span className="grow">
                    <span className="drk-pick-name ellipsis">{c.name}</span>
                    <span className="tiny muted clamp2">{p.reasons[0]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Party menu ── */}
      {menu.items.length > 0 && (
        <div className="card fade-up">
          <div className="card-title">
            <span className="kicker">Party menu</span>
            <span className="small">
              {menu.cocktails > 0 && <><b className="gold">{menu.cocktails}</b> <span className="muted">cocktail{menu.cocktails === 1 ? "" : "s"}</span></>}
              {menu.cocktails > 0 && menu.mocktails > 0 && <span className="muted"> · </span>}
              {menu.mocktails > 0 && <><b className="gold">{menu.mocktails}</b> <span className="muted">mocktail{menu.mocktails === 1 ? "" : "s"}</span></>}
            </span>
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

          {menu.cocktails > 0 && (
            <div className="drk-progress">
              <div className="progress">
                <div style={{ width: `${fill * 100}%`, background: menu.cocktails > plan.needed ? "var(--gold)" : "var(--grad-gold)" }} />
              </div>
              <div className="tiny muted">
                {!plan.needed ? "No drinkers in the plan yet — set guests and drinkers in the Food tab."
                  : menu.cocktails > plan.needed ? `That's ${menu.cocktails - plan.needed} more than the ${plan.needed} drinks planned for ${plural(plan.drinkers, "drinker")}.`
                    : menu.cocktails === plan.needed ? `All ${plan.needed} drinks planned will be cocktails.`
                      : `${menu.cocktails} of the ${plan.needed} drinks planned will be cocktails — the rest get the usual mixer.`}
              </div>
            </div>
          )}
          {(menu.mocktails > 0 || notDrinking > 0) && (
            <div className="drk-progress">
              <div className="progress drk-soft">
                <div style={{ width: `${softFill * 100}%` }} />
              </div>
              <div className="tiny muted">
                {!notDrinking ? "Everyone in the plan is drinking — these are extras for anyone taking a break."
                  : !menu.mocktails ? <>No mocktails yet for the {notDrinking} not drinking — they get soft drinks and juice. <button className="drk-link" onClick={() => switchKind("mocktails")}>Pick a mocktail ›</button></>
                    : menu.mocktails > softPlanned ? `That's ${menu.mocktails - softPlanned} more than the ${softPlanned} soft drinks planned for the ${notDrinking} not drinking.`
                      : menu.mocktails === softPlanned ? `All ${softPlanned} soft drinks for the ${notDrinking} not drinking will be mocktails.`
                        : `${menu.mocktails} of the ${softPlanned} soft drinks for the ${notDrinking} not drinking will be mocktails — the rest are soft drinks and juice.`}
              </div>
            </div>
          )}
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={goFood}>
            🛒 See their extras on the Blinkit list <Icon.chevron size={14} />
          </button>
        </div>
      )}

      {/* ── Empty cabinet ── */}
      {!mock && liquorCats.length === 0 && (
        <div className="card empty fade-up" style={{ padding: "30px 16px" }}>
          <div style={{ fontSize: 44 }}>🍸</div>
          <div className="t">Nothing to mix yet</div>
          <div className="small" style={{ marginBottom: 16 }}>Add a bottle or two to the cabinet and the cocktails you can make light up here. Mocktails need no bottle at all.</div>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <button className="btn btn-gold" onClick={goCabinet}><Icon.cabinet size={18} /> Browse the cabinet</button>
            <button className="btn btn-ghost" onClick={() => switchKind("mocktails")}>🍹 Mocktails</button>
          </div>
        </div>
      )}

      {/* ── Drinks ── */}
      <div className="chips" style={{ marginBottom: 6 }}>
        <button className={`chip ${!activeTag ? "on" : ""}`} onClick={() => setTag(null)}>All</button>
        {tags.map((t) => <button key={t} className={`chip ${activeTag === t ? "on" : ""}`} onClick={() => setTag(activeTag === t ? null : t)}>{tagLabel(t)}</button>)}
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
        <CocktailSheet key={openC.id} cocktail={openC} servings={onMenu[openC.id] || 0} plan={plan} reasons={why[openC.id]}
          suggested={openC.mocktail ? Math.max(1, (plan.soft?.drinks || 0) + (onMenu[openC.id] || 0)) : Math.max(1, plan.drinkers)}
          onSave={(n) => save(openC, n)} onRemove={() => remove(openC)} onClose={() => setOpen(null)}
          goCabinet={() => { setOpen(null); goCabinet(); }} />
      )}
    </div>
  );
}
