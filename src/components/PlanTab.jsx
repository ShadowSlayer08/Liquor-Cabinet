import { useState } from "react";
import { CATEGORIES, cityName } from "../lib/parse/livcheers.js";
import { STALE_MS } from "../lib/sources.js";
import { fmt, fmtShort, ageStr } from "../lib/format.js";
import { Icon, Ring } from "./Art.jsx";
import InviteCard from "./plan/InviteCard.jsx";
import SplitCard from "./plan/SplitCard.jsx";
import RemindersCard from "./plan/RemindersCard.jsx";
import DryDaysCard from "./plan/DryDaysCard.jsx";
import ZomatoAccountCard from "./plan/ZomatoAccountCard.jsx";
import BubbleCard from "./plan/BubbleCard.jsx";

function Donut({ rows, size = 150, stroke = 20 }) {
  const total = rows.reduce((s, r) => s + r.v, 0) || 1;
  const r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={stroke} />
      {rows.map((row) => {
        const len = (row.v / total) * circ;
        const el = (
          <circle key={row.id} cx={c} cy={c} r={r} fill="none" stroke={row.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, len - 2)} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${c} ${c})`}
            style={{ transition: "stroke-dasharray .8s" }} />
        );
        offset += len;
        return el;
      })}
      <text x={c} y={c - 2} textAnchor="middle" fill="#f8f0e3" fontSize="20" fontWeight="700" fontFamily="Outfit Variable, system-ui">{fmtShort(total === 1 ? 0 : total)}</text>
      <text x={c} y={c + 16} textAnchor="middle" fill="#a39581" fontSize="10" letterSpacing="1.5" fontFamily="Outfit Variable, system-ui">PLANNED</text>
    </svg>
  );
}

export default function PlanTab({
  city, loc, locating, onLocate, budget, saveBudget, spent, catSpend, zomatoTotal, blinkitTotal, plan,
  batches, activeBatch, setActiveBatch, addBatch, ages, openScraper, clearCache, openCity,
  party, setParty, customDry, setCustomDry, cocktailMenu, liquorLines, liquorTotal, foodCart,
  reminders, setReminders, split, setSplit, bubble, setBubble, zomatoExact, setZomatoExact, toast,
}) {
  const [draft, setDraft] = useState(String(budget));
  const [editing, setEditing] = useState(false);
  const left = budget - spent;
  const pct = budget > 0 ? spent / budget : 0;

  const rows = [
    ...CATEGORIES.filter((c) => catSpend[c.id]).map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}`, color: c.color, v: catSpend[c.id] })),
    zomatoTotal ? { id: "zomato", label: "🍽️ Zomato food", color: "#e23744", v: zomatoTotal } : null,
    blinkitTotal ? { id: "blinkit", label: "🛒 Blinkit supplies", color: "#f8cb46", v: blinkitTotal } : null,
  ].filter(Boolean);
  const synced = CATEGORIES.filter((c) => ages[c.id]);

  return (
    <div>
      <div className="section-head" style={{ marginTop: 14 }}>
        <div><div className="kicker">{plan.guests} guests · {plan.hours} hours</div><div className="h1" style={{ fontSize: 28 }}>The <em>plan</em></div></div>
      </div>

      <div className="hero fade-up" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Ring value={pct} size={128} stroke={11} label={`${Math.round(pct * 100)}%`} sub="USED" color={pct > 0.92 ? "#ff5d62" : undefined} />
        <div className="grow" style={{ position: "relative", zIndex: 1 }}>
          <div className="kicker">Party budget</div>
          {editing ? (
            <div className="row" style={{ marginTop: 6 }}>
              <input className="input" inputMode="numeric" value={draft} autoFocus onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && (saveBudget(Number(draft) || budget), setEditing(false))} />
              <button className="icon-btn gold" onClick={() => { saveBudget(Number(draft) || budget); setEditing(false); }}><Icon.check size={18} /></button>
            </div>
          ) : (
            <button className="row" style={{ marginTop: 2 }} onClick={() => { setDraft(String(budget)); setEditing(true); }}>
              <span className="h1" style={{ fontSize: 30 }}>{fmt(budget)}</span><span className="gold small">✎</span>
            </button>
          )}
          <div className={`small ${left < 0 ? "red" : "green"}`} style={{ marginTop: 4 }}>{left < 0 ? `${fmt(-left)} over budget` : `${fmt(left)} left`}</div>
          <div className="tiny muted">≈ {fmt(spent / Math.max(1, plan.guests))} per guest</div>
        </div>
      </div>

      <div className="card fade-up">
        <div className="card-title"><span className="kicker">Where the money goes</span><span className="small b">{fmt(spent)}</span></div>
        {rows.length === 0 ? <div className="small muted">Nothing planned yet — add bottles and food.</div> : (
          <div className="row" style={{ gap: 18, alignItems: "center" }}>
            <Donut rows={rows} />
            <div className="grow">
              {rows.map((r) => (
                <div key={r.id} className="between small" style={{ padding: "4px 0" }}>
                  <span className="row ellipsis" style={{ gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flexShrink: 0 }} /><span className="ellipsis soft">{r.label}</span></span>
                  <b>{fmtShort(r.v)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <InviteCard party={party} setParty={setParty} city={city} loc={loc} plan={plan} cocktailMenu={cocktailMenu} liquorLines={liquorLines} foodCart={foodCart} toast={toast} />
      <SplitCard party={party} setParty={setParty} plan={plan} split={split} setSplit={setSplit}
        liquorTotal={liquorTotal} zomatoTotal={zomatoTotal} blinkitTotal={blinkitTotal} toast={toast} />
      <RemindersCard party={party} city={city} customDry={customDry} reminders={reminders} setReminders={setReminders} toast={toast} />
      <DryDaysCard party={party} city={city} customDry={customDry} setCustomDry={setCustomDry} toast={toast} />

      <div className="card fade-up">
        <div className="card-title"><span className="kicker">Location</span></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-btn gold"><Icon.pin size={20} /></div>
          <div className="grow">
            <div className="h3 ellipsis">{loc?.label || cityName(city)}</div>
            <div className="tiny muted">{loc ? `GPS · prices for ${cityName(city)}${loc.zomato ? ` · Zomato ${loc.zomato.cityName}` : ""}` : `Prices for ${cityName(city)} · GPS off`}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-gold btn-sm grow" disabled={locating} onClick={onLocate}>{locating ? <span className="spin">◌</span> : <Icon.locate size={16} />} Use my location</button>
          <button className="btn btn-ghost btn-sm grow" onClick={openCity}>Choose city</button>
        </div>
      </div>

      <div className="card fade-up">
        <div className="card-title"><span className="kicker">Shopping batches</span></div>
        {batches.map((b, i) => (
          <button key={i} className="between" onClick={() => setActiveBatch(i)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, marginBottom: 4, background: activeBatch === i ? "rgba(231,168,70,.12)" : "transparent", color: activeBatch === i ? "var(--gold)" : "var(--soft)" }}>
            <span>{activeBatch === i ? "● " : "○ "}{b.name}</span>
            <span className="small muted">{Object.values(b.items || {}).reduce((s, q) => s + q, 0)} bottles</span>
          </button>
        ))}
        <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6, borderStyle: "dashed" }} onClick={addBatch}><Icon.plus size={14} /> New batch</button>
        <div className="tiny dim" style={{ marginTop: 8 }}>Bottles you add go into the active batch — split one shopping run across stores or days.</div>
      </div>

      <ZomatoAccountCard loc={loc} zomatoExact={zomatoExact} setZomatoExact={setZomatoExact} foodCart={foodCart} toast={toast} />
      <BubbleCard bubble={bubble} setBubble={setBubble} toast={toast} />

      <div className="card fade-up">
        <div className="card-title"><span className="kicker">Price database · {cityName(city)}</span><button className="btn btn-xs btn-gold" onClick={openScraper}><Icon.bolt size={13} /> Sync</button></div>
        {synced.length === 0 && <div className="small muted">No prices synced for {cityName(city)} yet.</div>}
        {synced.map((c) => {
          const stale = Date.now() - ages[c.id] > STALE_MS;
          return (
            <div key={c.id} className="between small" style={{ padding: "4px 0" }}>
              <span className="soft">{c.emoji} {c.label}</span>
              <span style={{ color: stale ? "var(--gold)" : "var(--dim)" }}>{ageStr(ages[c.id])}{stale ? " · stale" : ""}</span>
            </div>
          );
        })}
        <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => { if (confirm("Delete all cached prices and menus? Your carts are kept.")) clearCache(); }}>Clear cached data</button>
      </div>

      <div className="card small soft" style={{ lineHeight: 1.65 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Where the data comes from</div>
        <div>🥃 <b className="gold">Livcheers</b> — liquor prices, ratings & tasting notes, read straight from livcheers.com.</div>
        <div>🍽️ <b style={{ color: "#ff8a92" }}>Zomato</b> — restaurants delivering to your GPS location, their menus and "cost for one" (exact prices once you sign in — beta).</div>
        <div>⚡ <b style={{ color: "var(--bistro)" }}>Bistro</b> — Blinkit's 10-minute kitchen; order opens in the Bistro app.</div>
        <div>🛒 <b style={{ color: "var(--blinkit)" }}>Blinkit</b> — mixers, ice & munchies at usual MRP, or the live price read from Blinkit on your phone (beta); each opens in Blinkit.</div>
        <div>🗓️ <b className="gold">Dry days</b> — national days are certain; festival and state days vary, so check your state's notice.</div>
        <div className="tiny dim" style={{ marginTop: 10 }}>Not affiliated with or endorsed by Livcheers, Zomato, Blinkit or Bistro.</div>
        <div className="tiny dim" style={{ marginTop: 4 }}>Liquor Cabinet v1.3 · Prices are indicative. Drink responsibly, and only where it's legal for you.</div>
      </div>
    </div>
  );
}
