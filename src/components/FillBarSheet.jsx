// Fill my bar — five quick questions, then the bar (lib/barQuiz.js → lib/optimise.js). "I have
// ₹15k and 12 people, what do I buy?": popular bottles from the city's Livcheers prices that suit
// how the crowd drinks, cover the drinks and fit the amount, one tap into the cart and the active
// batch. The answers are remembered (cfg.barQuiz) and each one can be changed from the strip on
// top of the results; swaps and skipped spirits last for this visit. No sponsored picks.
import { useEffect, useMemo, useState } from "react";
import Sheet from "./Sheet.jsx";
import { CAT, cityName } from "../lib/parse/livcheers.js";
import { COCKTAIL, FAMILIES } from "../lib/cocktails.js";
import { fillBar, barCost, topPick, haveByFamily, joinLabels } from "../lib/optimise.js";
import { TIERS, TIER_IDS, familyContext, originChoice } from "../lib/barScore.js";
import {
  normalizeQuiz, seedQuiz, profileFromQuiz, stepsFor, quizSummary, resolveMoney, syncCatsFor, menuByFamily, templateLabel, shortName,
} from "../lib/barQuiz.js";
import { useBackHandler } from "../lib/back.js";
import { fmt, fmtShort } from "../lib/format.js";
import { tap } from "../lib/order.js";
import { Icon } from "./Art.jsx";
import { FamiliesStep, StyleStep, VibeStep, OriginStep, BudgetStep } from "./fillbar/BarQuiz.jsx";
import PickLine from "./fillbar/PickLine.jsx";

const VALUE_CATS = ["brandy"];   // not synced by default, and often the best value (Indian whisky has its own note)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const roundUp = (n) => Math.ceil(n / 100) * 100;
const sameFamilies = (a, b) => JSON.stringify(a?.families ?? null) === JSON.stringify(b?.families ?? null);

export default function FillBarSheet({ catalog, city, plan, party, budget, spent, cocktailMenu, batchName, addItems, toast, onClose,
  openScraper, openScraperWith, quiz, setQuiz, goBar }) {
  const left = budget - spent;
  const gap = plan.available > 0 && plan.shortfall > 0;
  const covered = plan.available > 0 && plan.shortfall === 0;
  const peg = party?.pegMl === 30 ? 30 : 60;
  const hasMenu = (cocktailMenu || []).some((m) => m?.servings > 0 && COCKTAIL[m.id] && !COCKTAIL[m.id].mocktail);
  const syncWith = (cats) => (openScraperWith ? openScraperWith(cats) : openScraper?.());

  // Answers: last time's, else pre-filled from the party template or the guests' tastes.
  const [seed] = useState(() => seedQuiz({ saved: quiz, party, cocktailMenu }));
  const [answers, setAnswers] = useState(seed.answers);
  const [view, setView] = useState(quiz ? "results" : "quiz");
  const [draft, setDraft] = useState(seed.answers);
  const [step, setStep] = useState(0);
  const [single, setSingle] = useState(null);   // one question opened from the answers strip
  const [drinks, setDrinks] = useState(() => Math.max(1, gap ? plan.shortfall : plan.needed));
  const [pins, setPins] = useState({});         // "family" | "family#1" → "cat:id" the host swapped in
  const [skip, setSkip] = useState([]);         // families the host doesn't want
  const [lock, setLock] = useState(null);       // the tier "auto" had when the host started changing picks
  const [open, setOpen] = useState(null);       // the line whose swap panel is open
  const [keepAuto, setKeepAuto] = useState(false);   // keep the tequila the quiz added for shots, even when money's tight
  // A template applied since the last answers re-seeded them: keep that (once, on open).
  useEffect(() => { if (seed.reseeded) setQuiz?.(seed.answers); }, [seed]);

  const have = useMemo(() => haveByFamily(plan.byCat), [plan.byCat]);
  const argsFor = (a) => {
    const p = profileFromQuiz(a);
    return { catalog, drinks, shares: p.shares, keep: p.keep, pegMl: peg, menu: cocktailMenu, have, profile: p.profile };
  };
  // What the whole bar costs at the tier they picked ("Let the budget decide" → Treat them).
  const enoughFor = (a) => { const t = a.tier === "auto" ? "premium" : a.tier; return { tier: t, cost: barCost(argsFor(a), t) }; };
  const moneyOf = (a, enough) => resolveMoney(a.money, { left, drinkers: plan.drinkers, enough });
  // Q4 is only asked where the city has well-known bottles both ways: what's synced says, else a guess.
  const choiceOf = (a) => Object.fromEntries(Object.keys(profileFromQuiz(a).shares)
    .filter((f) => FAMILIES[f]?.cats.some((c) => catalog?.[c]?.length)).map((f) => [f, originChoice(familyContext(catalog, f, peg))]));

  // ── The quiz ──
  const steps = useMemo(() => stepsFor(draft, { choice: choiceOf(draft) }), [draft, catalog, peg]);
  const at = Math.min(step, steps.length - 1);
  const stepId = single || steps[at];
  const last = !!single || at >= steps.length - 1;
  const draftEnough = useMemo(() => (view === "quiz" && stepId === "budget" ? enoughFor(draft) : { tier: "premium", cost: 0 }),
    [view, stepId, draft, catalog, drinks, peg, cocktailMenu, have]);
  const draftAmount = draft.money?.kind === "amount" ? draft.money.value : moneyOf(draft, draftEnough.cost);
  // "e.g. Royal Stag ₹570 · Magic Moments ₹570": the best bottle at each tier of the two biggest families.
  // Worked out from the top tier down, and a tier skips the bottle the tier above showed when it has
  // another one, so "Easy on the wallet" and "Crowd favourites" don't read the same.
  const examples = useMemo(() => {
    if (view !== "quiz" || stepId !== "vibe") return {};
    const p = profileFromQuiz(draft);
    const fams = Object.entries(p.shares).sort((a, b) => b[1] - a[1]).map(([f]) => f).filter((f) => FAMILIES[f]?.cats.some((c) => catalog?.[c]?.length)).slice(0, 2);
    const out = {}, above = {};
    for (const t of [...TIER_IDS].reverse()) {
      const picks = fams.map((family) => {
        const c = topPick({ catalog, family, profile: p.profile, tier: t, pegMl: peg, skip: above[family] });
        if (c) above[family] = new Set([c.key]);
        return c;
      }).filter(Boolean);
      if (picks.length) out[t] = picks.map((c) => `${shortName(c.item.name)} ${fmt(c.item.price)}`).join(" · ");
    }
    return out;
  }, [view, stepId, draft, catalog, peg]);

  // ── The bar ──
  const prof = useMemo(() => profileFromQuiz(answers), [answers]);
  const cats = useMemo(() => syncCatsFor(answers), [answers]);
  const synced = cats.some((c) => catalog?.[c]?.length);
  const ansEnough = useMemo(() => (view === "results" && synced ? enoughFor(answers) : { tier: "premium", cost: 0 }),
    [view, synced, answers, catalog, drinks, peg, cocktailMenu, have]);
  const money = moneyOf(answers, ansEnough.cost);
  const r = useMemo(() => fillBar({
    catalog, drinks, budget: money, shares: prof.shares, keep: prof.keep, pegMl: peg, menu: cocktailMenu, have, skip, pins,
    optional: keepAuto ? [] : prof.auto, profile: { ...prof.profile, tier: lock || prof.profile.tier },
  }), [catalog, drinks, money, prof, peg, cocktailMenu, have, skip, pins, lock, keepAuto]);
  const answerSteps = useMemo(() => stepsFor(answers, { choice: choiceOf(answers) }), [answers, catalog, peg]);
  const strip = quizSummary(answers, { amount: money, tier: r.tier, steps: answerSteps });
  const bottles = r.lines.reduce((s, l) => s + l.qty, 0);
  const changed = skip.length > 0 || Object.keys(pins).length > 0;
  const reasonCtx = { profile: prof.profile, menu: menuByFamily(cocktailMenu) };
  const pairs = new Set(r.lines.filter((l) => l.slot).map((l) => l.family));

  // ── Answers ──
  const resetPicks = () => { setPins({}); setSkip([]); setLock(null); setOpen(null); setKeepAuto(false); };
  const save = (a, { keepPicks = false } = {}) => {
    const n = normalizeQuiz(a);
    setAnswers(n); setQuiz?.(n);
    if (!keepPicks) resetPicks();
  };
  const finish = (a) => { save(a); setSingle(null); setView("results"); };
  const next = () => {
    tap();
    const d = { ...draft, answered: [...new Set([...(draft.answered || []), stepId])] };
    if (last) finish(d);
    else { setDraft(d); setStep(at + 1); }
  };
  const skipStep = () => { tap(); if (last) finish(draft); else setStep(at + 1); };   // keeps the pre-filled answer
  const back = () => { if (single) { setSingle(null); setView("results"); } else if (at > 0) setStep(at - 1); };
  useBackHandler(back, view === "quiz" && (!!single || at > 0));
  // "Pick cocktails" from Q2 leaves the sheet: keep what's answered so far.
  const toBar = goBar && ((kind) => { save({ ...draft, answered: [...new Set([...(draft.answered || []), "style"])] }, { keepPicks: true }); goBar(kind); });
  const editStep = (s) => { tap(); setDraft(answers); setSingle(s); setView("quiz"); };
  const redo = () => { tap(); setDraft(answers); setStep(0); setSingle(null); setView("quiz"); };
  const setAmount = (value) => { tap(); save({ ...answers, money: { kind: "amount", value } }); };

  // ── Picks ── once the host swaps or skips, "auto" stays at the tier it had (no surprise jumps).
  const hold = () => { if (!lock && prof.profile.tier === "auto" && r.tier) setLock(r.tier); };
  const pin = (id, key) => { tap(); hold(); setPins({ ...pins, [id]: key }); setOpen(null); };
  const drop = (f) => {
    tap(); hold();
    setSkip([...skip, f]);
    const rest = { ...pins }; delete rest[f]; delete rest[`${f}#1`];
    setPins(rest); setOpen(null);
  };
  // "Or their usual": pin the brand's best bottle and remember it; tap the starred one to forget.
  const brand = (l, b) => {
    tap();
    const favs = { ...answers.favs };
    const rest = { ...pins };
    if (favs[l.family] === b.key) { delete favs[l.family]; delete rest[l.family]; }
    else { favs[l.family] = b.key; hold(); rest[l.family] = b.pick; }
    setPins(rest); setOpen(null);
    save({ ...answers, favs }, { keepPicks: true });
  };
  const variety = (on) => { tap(); save({ ...answers, variety: on }, { keepPicks: true }); };
  const add = () => {
    if (!r.lines.length) return;
    addItems(r.lines.map((l) => ({ cat: l.cat, item: l.item, qty: l.qty })));
    toast(`Added ${plural(bottles, "bottle")} (≈${fmt(r.cost)}) to ${batchName || "your cart"}`);
    onClose();
  };

  // ── Footer ──
  let footer = null;
  if (view === "quiz") {
    const noMoney = stepId === "budget" && !(draftAmount > 0);
    footer = (
      <button className="btn btn-gold btn-block" disabled={noMoney} onClick={next}>
        {single ? <><Icon.check size={17} /> Done</> : last ? <><Icon.sparkle size={17} /> Show my bar</> : "Next"}
      </button>
    );
  } else if (synced) {
    footer = (
      <button className="btn btn-gold btn-block" disabled={!r.lines.length} onClick={add}>
        <Icon.plus size={17} /> {r.lines.length ? `Add ${plural(bottles, "bottle")} · ${fmt(r.cost)}` : "Nothing fits yet"}
      </button>
    );
  }

  const indianMissing = r.unsynced.includes("indian");
  const otherUnsynced = r.unsynced.filter((c) => c !== "indian");
  const otherLabels = otherUnsynced.map((c) => CAT[c]?.label);
  const next2 = r.nextTier;
  // Where the pre-filled answers came from (shown until the host changes them).
  const seedNote = seed.from === "template" ? `From your ${templateLabel(party)} template`
    : seed.from === "tastes" ? "From Guests like… on the Food tab" : seed.from === "saved" ? "Your answers from last time" : null;
  const subtitle = view === "quiz" ? (single ? "Change your answer" : `Question ${at + 1} of ${steps.length}`) : "Popular bottles that fit your budget";

  // .opt-fill lets the sync panel (rendered before this sheet in App) open on top of it.
  return (
    <Sheet title="Fill my bar" subtitle={subtitle} onClose={onClose} footer={footer}>
      <span className="opt-fill" hidden />
      {view === "quiz" ? (
        <>
          {/* On-screen Back too: iOS has no hardware back button */}
          <div className="quiz-top">
            {single ? (
              <button className="quiz-link small" onClick={() => { tap(); back(); }}>‹ Cancel</button>
            ) : (
              <>
                <div className="quiz-dots" aria-hidden="true">{steps.map((s, i) => <i key={s} className={i === at ? "on" : i < at ? "done" : ""} />)}</div>
                <div className="quiz-top-acts">
                  {at > 0 && <button className="quiz-link small dim" onClick={() => { tap(); back(); }}>‹ Back</button>}
                  <button className="quiz-link small" onClick={skipStep}>Skip</button>
                </div>
              </>
            )}
          </div>
          {stepId === "families" && (
            <FamiliesStep draft={draft} setDraft={setDraft} seedNote={!single && sameFamilies(draft, seed.answers) ? seedNote : null} />
          )}
          {stepId === "style" && <StyleStep draft={draft} setDraft={setDraft} cocktailMenu={cocktailMenu} goBar={toBar} />}
          {stepId === "vibe" && <VibeStep draft={draft} setDraft={setDraft} examples={examples} />}
          {stepId === "origin" && <OriginStep draft={draft} setDraft={setDraft} />}
          {stepId === "budget" && (
            <BudgetStep draft={draft} setDraft={setDraft} amount={draftAmount} left={left} enough={draftEnough.cost}
              enoughLabel={TIERS[draftEnough.tier]?.short || ""} drinkers={plan.drinkers} drinks={drinks} setDrinks={setDrinks} gap={gap} />
          )}
          {!single && at === 0 && <button className="quiz-link small dim quiz-skip-all" onClick={() => { tap(); finish(draft); }}>Skip the questions</button>}
        </>
      ) : (
        <>
          {/* ── What they told us — tap one to change it ── */}
          <div className="chips opt-strip">
            {strip.map((c) => <button key={c.step} className="chip" onClick={() => editStep(c.step)}>{c.label}</button>)}
            <button className="quiz-link small" onClick={redo}>Redo the questions</button>
          </div>

          {!synced ? (
            <div className="empty" style={{ padding: "24px 8px" }}>
              <div style={{ fontSize: 44 }}>🥃</div>
              <div className="t">Sync prices first</div>
              <div className="small" style={{ marginBottom: 18 }}>
                The bar is picked from Livcheers prices for {cityName(city)}: {joinLabels(cats.map((c) => CAT[c]?.label))}.
              </div>
              <button className="btn btn-gold" onClick={() => syncWith(cats)}><Icon.bolt size={18} /> Sync prices</button>
            </div>
          ) : (
            <>
              {r.lines.length > 0 && (
                <>
                  <div className="opt-sum fade-up">
                    <div><div className="v">{r.drinks}</div><div className="l">drinks</div></div>
                    <div><div className="v gold-text">{fmtShort(r.cost)}</div><div className="l">of {fmtShort(money)}</div></div>
                    <div><div className="v">{fmtShort(r.left)}</div><div className="l">left</div></div>
                    <div><div className="v">{bottles}</div><div className="l">{bottles === 1 ? "bottle" : "bottles"}</div></div>
                  </div>
                  <div className="progress opt-progress"><div style={{ width: `${Math.min(100, (r.cost / Math.max(1, money)) * 100)}%`, background: "var(--grad-gold)" }} /></div>
                </>
              )}

              {/* ── Notes ── */}
              {seed.reseeded && answers.seededMix === party?.mix && !answers.answered.includes("families") && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">Updated for your {templateLabel(party)} template.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => editStep("families")}>Change</button>
                </div>
              )}
              {r.legacy.length > 0 && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">Sync for better picks: {joinLabels(r.legacy.map((c) => CAT[c]?.label))} prices were saved before the app knew what's popular on Livcheers.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => syncWith(r.legacy)}><Icon.bolt size={13} /> Sync</button>
                </div>
              )}
              {indianMissing && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">Royal Stag and Blenders Pride are in Indian Whisky, which isn't synced yet.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => syncWith(["indian"])}><Icon.bolt size={13} /> Sync it</button>
                </div>
              )}
              {otherUnsynced.length > 0 && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">
                    {joinLabels(otherLabels)} {otherLabels.length === 1 ? "isn't" : "aren't"} synced yet.
                    {otherUnsynced.some((c) => VALUE_CATS.includes(c)) ? " They're often the best value." : ""}
                  </span>
                  <button className="btn btn-xs btn-ghost" onClick={() => syncWith(otherUnsynced)}><Icon.bolt size={13} /> Sync them</button>
                </div>
              )}
              {left <= 0 && answers.money.kind === "left" && (
                <div className="note note-warn quiz-note">{left < 0 ? `You're already ${fmt(-left)} over your budget.` : "Your budget is all spent."} Set an amount for this run.</div>
              )}
              {covered && <div className="note note-info quiz-note">Your cart already covers the {plan.needed} drinks planned. This plans {plural(drinks, "more drink")}.</div>}
              {r.tierShort && !lock && r.lines.length > 0 && (
                <div className="note note-warn opt-note quiz-note">
                  <span className="grow">{fmtShort(money)} is tight for “{TIERS[r.tierShort.tier].label}”, so these are {TIERS[r.tier]?.short}.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => setAmount(roundUp(r.tierShort.cost))}>Make it {fmtShort(roundUp(r.tierShort.cost))}</button>
                </div>
              )}
              {r.autoTier && !lock && next2 && next2.cost > money && next2.cost <= money * 1.5 && r.feasible && (
                <div className="note note-ok opt-note quiz-note">
                  <span className="grow">{fmtShort(money)} covers {TIERS[r.tier]?.short}. {TIERS[next2.tier].label} needs ≈ {fmtShort(next2.cost)}.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => setAmount(roundUp(next2.cost))}>Make it {fmtShort(roundUp(next2.cost))}</button>
                </div>
              )}
              {prof.profile.style.cocktails && !hasMenu && goBar && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">Pick cocktails in the Bar tab and the bar covers them.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => goBar("cocktails")}>Pick cocktails</button>
                </div>
              )}
              {r.fellBack && <div className="note note-info quiz-note">Nothing's synced for what they drink yet, so this is a mixed bar.</div>}
              {r.dropped.length > 0 && (
                <div className="note note-info opt-note quiz-note">
                  <span className="grow">No {joinLabels(r.dropped.map((f) => FAMILIES[f]?.label.toLowerCase()))} for shots: {fmtShort(money)} goes further without it.</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => { tap(); setKeepAuto(true); }}>Add it</button>
                </div>
              )}
              {!r.feasible && r.lines.length > 0 && (
                <div className="note note-warn quiz-note">
                  {fmt(money)} covers about <b>{r.drinks}</b> of {r.target} drinks. Raise the amount{peg === 60 ? " or switch to 30 ml pegs (Food tab)" : ""}.
                </div>
              )}
              {r.lines.length > 0 && r.target > drinks && (
                <div className="note note-info quiz-note">Your cocktail menu needs spirits the cart doesn't cover yet, so this plans {r.target} drinks.</div>
              )}
              {r.feasible && r.trimmed && <div className="note note-info quiz-note">{fmt(money)} is tight for everything they drink, so this sticks to fewer spirits.</div>}
              {!r.lines.length && (
                <div className="note note-warn quiz-note">
                  {money > 0 ? `${fmt(money)} doesn't buy a bottle from what's synced for ${cityName(city)}. Raise the amount.` : "Enter how much you'd like to spend."}
                </div>
              )}

              {/* ── The bar ── */}
              {r.lines.map((l) => {
                const pair = pairs.has(l.family);
                const onVariety = pair && l.slot ? () => variety(false)
                  : !pair && answers.variety === false && r.varietyFamily === l.family ? () => variety(true) : null;
                return (
                  <PickLine key={l.id} line={l} pair={pair} alts={r.alternatives[l.id] || []} brands={l.slot ? [] : r.brands[l.family] || []}
                    fav={answers.favs[l.family]} reasonCtx={reasonCtx} open={open === l.id} onToggle={() => { tap(); setOpen(open === l.id ? null : l.id); }}
                    onPin={(a) => pin(l.id, a.key)} onBrand={(b) => brand(l, b)} onSkip={() => drop(l.family)} onVariety={onVariety} />
                );
              })}

              {changed && (
                <div className="row wrap opt-skipped">
                  {skip.map((f) => (
                    <button key={f} className="chip" onClick={() => { tap(); setSkip(skip.filter((x) => x !== f)); }}>↺ {FAMILIES[f]?.label}</button>
                  ))}
                  <button className="quiz-link small gold" onClick={() => { tap(); resetPicks(); }}>Undo my changes</button>
                </div>
              )}

              <div className="tiny dim" style={{ marginTop: 12, lineHeight: 1.5 }}>
                Livcheers indicative prices for {cityName(city)}; shops may charge differently. Popularity and ratings from Livcheers. No sponsored picks.
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
