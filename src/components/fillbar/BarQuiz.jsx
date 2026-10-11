// Fill my bar's five questions (lib/barQuiz.js holds the answers' shape and maths). Each step
// edits the draft answers; FillBarSheet owns the step order, Next / Skip and saving.
import { useEffect, useState } from "react";
import { Stepper } from "../Sheet.jsx";
import { COCKTAIL } from "../../lib/cocktails.js";
import { QUIZ_FAMILIES, STYLES, VIBES, ORIGINS, HEAD_AMOUNTS, cycleFamily, familySplit } from "../../lib/barQuiz.js";
import { fmt, fmtShort } from "../../lib/format.js";
import { tap } from "../../lib/order.js";

function Question({ title, help, children }) {
  return (
    <div className="quiz-step fade-up">
      <div className="h2 quiz-q">{title}</div>
      {help && <div className="small muted quiz-help">{help}</div>}
      {children}
    </div>
  );
}

// Q1 — chips cycle off → some → lots; "Not sure" is a mixed bar and stands alone.
export function FamiliesStep({ draft, setDraft, seedNote }) {
  const fam = draft.families || {};
  const split = familySplit(draft);
  const set = (families) => { tap(); setDraft({ ...draft, families }); };
  return (
    <Question title="What's everyone drinking?" help="Tap once for some, twice for lots.">
      <div className="quiz-chips">
        {QUIZ_FAMILIES.map((f) => {
          const n = fam[f.id] || 0;
          return (
            <button key={f.id} className={`chip ${n === 2 ? "on" : n === 1 ? "some" : ""}`} aria-pressed={n > 0} onClick={() => set(cycleFamily(draft.families, f.id))}>
              {n === 2 ? `★ ${f.label} · lots` : n === 1 ? `${f.emoji} ${f.label} · some` : `${f.emoji} ${f.label}`}
            </button>
          );
        })}
      </div>
      <div className="quiz-chips">
        <button className={`chip ${!draft.families ? "on" : ""}`} aria-pressed={!draft.families} onClick={() => set(null)}>🤷 Not sure — a mixed bar</button>
      </div>
      {split.length > 0 && (
        <div className="quiz-split" aria-label="How the drinks split">
          <div className="quiz-split-bar">{split.map((s) => <i key={s.id} style={{ width: `${s.pct}%`, background: s.color }} />)}</div>
          <div className="tiny muted">{split.map((s) => `${s.label} ${s.pct}%`).join(" · ")}</div>
        </div>
      )}
      {seedNote && <div className="tiny quiz-seed">{seedNote}</div>}
    </Question>
  );
}

// Q2 — how they drink: steers the bottle types (no single malt into cola, white rum for cocktails…).
export function StyleStep({ draft, setDraft, cocktailMenu, goBar }) {
  const on = (id) => draft.style.includes(id);
  const toggle = (id) => { tap(); setDraft({ ...draft, style: on(id) ? draft.style.filter((s) => s !== id) : [...draft.style, id] }); };
  const menu = (cocktailMenu || []).filter((m) => m?.servings > 0 && COCKTAIL[m.id] && !COCKTAIL[m.id].mocktail).map((m) => COCKTAIL[m.id].name);
  const fams = draft.families || {};
  return (
    <Question title="How do they drink it?" help="Pick all that fit.">
      <div className="quiz-chips">
        {STYLES.map((s) => <button key={s.id} className={`chip ${on(s.id) ? "on" : ""}`} aria-pressed={on(s.id)} onClick={() => toggle(s.id)}>{s.emoji} {s.label}</button>)}
      </div>
      {on("cocktails") && menu.length > 0 && (
        <div className="note note-info quiz-note">Your cocktail menu ({menu.slice(0, 3).join(", ")}{menu.length > 3 ? "…" : ""}) is covered first.</div>
      )}
      {on("cocktails") && !menu.length && (
        <div className="note note-info quiz-note opt-note">
          <span className="grow">No cocktail menu yet — the bar leans to white rum, vodka and gin.</span>
          {goBar && <button className="btn btn-xs btn-ghost" onClick={() => goBar("cocktails")}>Pick cocktails</button>}
        </div>
      )}
      {on("shots") && draft.families && !fams.tequila && !fams.vodka && <div className="note note-info quiz-note">Adds a bottle of tequila for shots.</div>}
    </Question>
  );
}

// Q3 — how fancy. `examples` = { tier: "Royal Stag ₹570 · Magic Moments ₹570" } from what's synced.
export function VibeStep({ draft, setDraft, examples = {} }) {
  return (
    <Question title="How fancy?">
      <div className="quiz-opts">
        {VIBES.map((v) => (
          <button key={v.id} className={`quiz-opt ${draft.tier === v.id ? "on" : ""}`} aria-pressed={draft.tier === v.id}
            onClick={() => { tap(); setDraft({ ...draft, tier: v.id }); }}>
            <b>{v.label}</b>
            <span className="tiny ellipsis">{v.line || `e.g. ${examples[v.id] || v.eg.join(" · ")}`}</span>
          </button>
        ))}
      </div>
    </Question>
  );
}

// Q4 — only asked where it changes something (lib/barQuiz.js stepsFor).
export function OriginStep({ draft, setDraft }) {
  return (
    <Question title="Indian or imported?" help="Scotch bottled in India, like Teacher's or Black Dog, counts as Indian here.">
      <div className="quiz-chips">
        {ORIGINS.map((o) => (
          <button key={o.id} className={`chip ${draft.origin === o.id ? "on" : ""}`} aria-pressed={draft.origin === o.id}
            onClick={() => { tap(); setDraft({ ...draft, origin: o.id }); }}>{o.emoji} {o.label}</button>
        ))}
      </div>
    </Question>
  );
}

// Q5 — the amount: what's left of the plan's budget, the chosen tier's whole bar, or per head.
export function BudgetStep({ draft, setDraft, amount, left, enough, enoughLabel, drinkers, drinks, setDrinks, gap }) {
  const [editDrinks, setEditDrinks] = useState(false);
  const kind = draft.money?.kind;
  // The box shows what a chip picked; while typing, what's typed (it may be empty for a moment).
  const [text, setText] = useState(amount > 0 ? String(amount) : "");
  useEffect(() => { if (kind !== "amount") setText(amount > 0 ? String(amount) : ""); }, [kind, amount]);
  const setMoney = (money) => { tap(); setDraft({ ...draft, money }); };
  const type = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setText(digits);
    setDraft({ ...draft, money: { kind: "amount", value: parseInt(digits, 10) || 0 } });
  };
  const head = kind === "head" ? draft.money.value : 1000;
  return (
    <Question title="What's the budget?" help={`${drinks} drinks · ${drinkers} drinking`}>
      <div className="opt-money quiz-money">
        <span aria-hidden="true">₹</span>
        <input className="input" inputMode="numeric" aria-label="Spend up to, in rupees" value={text} onChange={type} />
      </div>
      <div className="quiz-chips">
        {left > 0 && <button className={`chip ${kind === "left" ? "on" : ""}`} onClick={() => setMoney({ kind: "left" })}>Budget left · {fmtShort(left)}</button>}
        {enough > 0 && <button className={`chip ${kind === "enough" ? "on" : ""}`} onClick={() => setMoney({ kind: "enough" })}>Enough for {enoughLabel} · {fmtShort(enough)}</button>}
      </div>
      {drinkers > 0 && (
        <>
          <div className="quiz-chips">
            {HEAD_AMOUNTS.map((v, i) => (
              <button key={v} className={`chip ${kind === "head" && draft.money.value === v ? "on" : ""}`} onClick={() => setMoney({ kind: "head", value: v })}>
                {i === 0 ? `${fmt(v)} a head` : fmt(v)}
              </button>
            ))}
          </div>
          <div className="tiny dim quiz-head">= {fmtShort(head * drinkers)} for {drinkers} drinking{kind === "head" ? "" : ` at ${fmt(head)} a head`}</div>
        </>
      )}
      {left <= 0 && <div className="note note-warn quiz-note">{left < 0 ? `You're already ${fmt(-left)} over your budget.` : "Your budget is all spent."} Set an amount for this run.</div>}
      {!editDrinks ? (
        <button className="quiz-link small" onClick={() => setEditDrinks(true)}>{gap ? "Still to cover" : "Covers"} {drinks} drinks — <span className="gold">change</span></button>
      ) : (
        <div className="field quiz-drinks"><label>{gap ? "Drinks still to cover" : "Drinks to cover"}</label><Stepper value={drinks} onChange={setDrinks} min={1} max={2000} /></div>
      )}
    </Question>
  );
}
