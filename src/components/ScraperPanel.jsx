import { useEffect, useRef, useState } from "react";
import { CATEGORIES, cityName } from "../lib/parse/livcheers.js";
import { scrapeCategory, priceKey, STALE_MS } from "../lib/sources.js";
import { store } from "../lib/store.js";
import { useBackHandler } from "../lib/back.js";

// ═══════════════════════════════════════════════════════════════════════════════
//  SCRAPER PANEL — fetches Livcheers category pages directly and parses them.
// ═══════════════════════════════════════════════════════════════════════════════
// `autoStart` runs a Smart Sync as soon as the panel opens (the liquorcabinet://sync link).
export default function ScraperPanel({ city, syncIds, setSyncIds, onData, onClose, autoStart = false }) {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [phase, setPhase] = useState(0);
  const [total, setTotal] = useState(0);
  const logRef = useRef(null);
  useBackHandler(() => { if (!running) onClose(); });

  const queue = CATEGORIES.filter((c) => syncIds.includes(c.id));

  const addLog = (msg, type = "info") => {
    setLogs((p) => [...p, { msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = 1e6; }, 40);
  };

  const run = async (force = false) => {
    if (!queue.length) return;
    setRunning(true); setDone(false); setLogs([]); setPhase(0); setTotal(queue.length);

    // Pre-classify: cached (instant) vs needs a network fetch
    const needsNet = [], cachedCats = [];
    if (!force) {
      for (const cat of queue) {
        const hit = await store.get(priceKey(city, cat.id));
        if (hit && Date.now() - hit.fetchedAt < STALE_MS) cachedCats.push(cat);
        else needsNet.push(cat);
      }
    } else needsNet.push(...queue);

    addLog(`${cityName(city)} — ${cachedCats.length} instant (cache) + ${needsNet.length} to fetch`, "info");

    let count = 0, net = 0, cache = 0, errors = 0, products = 0;
    const handle = (cat, r) => {
      count++; setPhase(count);
      if (r.fromCache) cache++; else net++;
      products += r.items.length;
      onData({ [cat.id]: r }); // catalog updates live, no waiting
    };
    const fail = (cat, e) => {
      addLog(`ERR ${cat.label}: ${e.message}`, "error");
      errors++; count++; setPhase(count);
    };

    for (const cat of cachedCats) {
      try { handle(cat, await scrapeCategory(city, cat, addLog, false)); } catch (e) { fail(cat, e); }
    }

    // Network fetches: 3 at a time
    const BATCH = 3;
    for (let i = 0; i < needsNet.length; i += BATCH) {
      const batch = needsNet.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map((cat) => scrapeCategory(city, cat, addLog, force).then((r) => handle(cat, r)).catch((e) => fail(cat, e)))
      );
    }

    addLog(`Done! ${products} products · fetched:${net} cache:${cache} errors:${errors}`, errors ? "warn" : "ok");
    setRunning(false); setDone(true);
  };
  const started = useRef(false); // once per open, even when React mounts twice in dev
  useEffect(() => { if (autoStart && !started.current) { started.current = true; run(false); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = total ? phase / total : 0;
  const logColor = { ok: "#22c97a", error: "#e84040", warn: "#e8c030", pending: "#8a8a8a", info: "#6a6055" };
  const toggle = (id) => setSyncIds(syncIds.includes(id) ? syncIds.filter((x) => x !== id) : [...syncIds, id]);

  return (
    <div className="overlay center" onClick={() => !running && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ padding: "16px 18px 12px", borderBottom: "1px solid #141210" }}>
          <div>
            <div className="tiny dim" style={{ letterSpacing: 4, marginBottom: 3 }}>PRICE SCRAPER</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Livcheers · {cityName(city)}</div>
          </div>
          {!running && <button className="xbtn" onClick={onClose}>✕</button>}
        </div>

        {!running && !done && (
          <div style={{ padding: "12px 18px 4px" }}>
            <div className="between tiny muted" style={{ marginBottom: 8, letterSpacing: 1 }}>
              <span>CATEGORIES TO SYNC ({queue.length})</span>
              <span>
                <button className="gold tiny" onClick={() => setSyncIds(CATEGORIES.map((c) => c.id))}>All</button>
                <span className="dim"> · </span>
                <button className="gold tiny" onClick={() => setSyncIds([])}>None</button>
              </span>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
              {CATEGORIES.map((c) => {
                const on = syncIds.includes(c.id);
                return (
                  <button key={c.id} className="chip" onClick={() => toggle(c.id)}
                    style={{ padding: "5px 10px", fontSize: 11, background: on ? c.color : undefined, color: on ? "#000" : undefined, borderColor: on ? c.color : undefined }}>
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(running || done) && (
          <div style={{ padding: "0 18px" }}>
            <div className="bar" style={{ height: 3, margin: "12px 0 4px" }}>
              <div style={{ width: `${pct * 100}%`, background: "linear-gradient(90deg,#d4872a,#e8c030)" }} />
            </div>
            <div className="between tiny dim" style={{ marginBottom: 10 }}>
              <span>{running ? `${phase} / ${total}` : "Complete"}</span>
              <span>{Math.round(pct * 100)}%</span>
            </div>
          </div>
        )}

        <div ref={logRef} className="terminal" style={{ marginTop: running || done ? 0 : 12 }}>
          {logs.length === 0 && !running && (
            <div style={{ textAlign: "center", paddingTop: 58, color: "#3a332c" }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>⚡</div>
              <div style={{ color: "#6a6055" }}>Ready — {queue.length} categories queued</div>
              <div style={{ fontSize: 10, marginTop: 6 }}>Smart Sync reuses data under 7 days old · Force Refresh re-downloads</div>
            </div>
          )}
          {logs.map((l, i) => <div key={i} style={{ color: logColor[l.type] || "#6a6055" }}>{l.msg}</div>)}
          {running && <span className="gold" style={{ animation: "pulse 1s infinite" }}>▌</span>}
        </div>

        <div className="row" style={{ padding: "14px 18px", gap: 10 }}>
          {!running ? (
            <>
              <button className="btn btn-gold grow" disabled={!queue.length} onClick={() => run(false)}>⚡ Smart Sync</button>
              <button className="btn btn-ghost grow" disabled={!queue.length} onClick={() => run(true)}>↻ Force Refresh</button>
              {done && <button className="btn" style={{ background: "#22c97a18", color: "#22c97a", border: "1px solid #22c97a40" }} onClick={onClose}>Done ✓</button>}
            </>
          ) : (
            <div className="grow small dim" style={{ textAlign: "center", padding: 10 }}>Scraping livcheers.com — please wait…</div>
          )}
        </div>
      </div>
    </div>
  );
}
