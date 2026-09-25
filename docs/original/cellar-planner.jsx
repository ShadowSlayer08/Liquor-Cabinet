import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
//  STORAGE  —  window.storage (artifact KV, persists across reloads)
// ═══════════════════════════════════════════════════════════════════════════════
const store = {
  async get(key) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); } catch(e) { console.warn("store.set", e); }
  },
  async list(prefix) {
    try { const r = await window.storage.list(prefix); return r?.keys || []; }
    catch { return []; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCRAPER
//  • Checks storage cache first (7-day TTL)
//  • Only calls API when stale/missing
//  • No x-api-key or extra headers — artifact injects auth automatically
//  • Handles web_search multi-block responses robustly
// ═══════════════════════════════════════════════════════════════════════════════
const MODEL    = "claude-sonnet-4-20250514";
const STALE_MS = 7 * 86400 * 1000;

const CATS_TO_SCRAPE = [
  { id:"malts",       label:"Single Malts",   slug:"single-malts"   },
  { id:"worldwhisky", label:"World Whisky",   slug:"world-whisky"   },
  { id:"scotch",      label:"Blended Scotch", slug:"blended-scotch" },
  { id:"gin",         label:"Gin",            slug:"gin"            },
  { id:"tequila",     label:"Tequila",        slug:"tequila"        },
  { id:"rum",         label:"Rum",            slug:"rum"            },
  { id:"vodka",       label:"Vodka",          slug:"vodka"          },
  { id:"beer",        label:"Beer",           slug:"beers"          },
  { id:"wine",        label:"Wine",           slug:"wine"           },
];

// Pull JSON array out of whatever the model returns
function extractItems(data) {
  // Collect every text block (there may be multiple after tool_use/tool_result)
  const allText = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  if (!allText.trim()) return [];

  // Strip markdown fences
  const clean = allText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // Strategy 1: full text is a valid JSON array
  try {
    const p = JSON.parse(clean);
    if (Array.isArray(p) && p.length) return p;
  } catch {}

  // Strategy 2: find outermost [ … ]
  const s = clean.indexOf("["), e = clean.lastIndexOf("]");
  if (s !== -1 && e > s) {
    try {
      const p = JSON.parse(clean.slice(s, e + 1));
      if (Array.isArray(p) && p.length) return p;
    } catch {}
  }

  // Strategy 3: collect all {...} objects and wrap in array
  const objs = [];
  let depth = 0, start = -1;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (clean[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try { objs.push(JSON.parse(clean.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  if (objs.length) return objs;

  return [];
}

async function scrapeCategory(city, cat, onLog, force = false) {
  const cacheKey = `price:${city}:${cat.id}`;

  // ── Cache check ──────────────────────────────────────────────────────────
  if (!force) {
    const cached = await store.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
      const h = Math.round((Date.now() - cached.fetchedAt) / 3600000);
      onLog(`✓ ${cat.label} — cache hit (${h}h old, ${cached.items.length} items)`, "ok");
      return { items: cached.items, fromCache: true, fetchedAt: cached.fetchedAt };
    }
  }

  // ── API fetch ─────────────────────────────────────────────────────────────
  onLog(`⟳ ${cat.label} — calling Livcheers via web search…`, "pending");

  const slug = city.toLowerCase().replace(/\s+/g, "-");
  const url  = `https://www.livcheers.com/${slug}/category/${cat.slug}`;
  const sys  = `You are a price data extractor. Search Livcheers.com and extract ALL product listings for "${cat.label}" in ${city}. Return ONLY a valid JSON array — no markdown, no explanation text, no code fences. Each item must follow this schema exactly: {"name": string, "brand": string, "sub": string, "vol": string, "price": integer (INR), "rating": number, "origin": string, "tier": "good"|"best"|"editors", "notes": string, "url": string}. Tier assignment: rating >= 4.7 AND well-known premium brand → "editors"; rating >= 4.4 → "best"; otherwise → "good". Include 15–30 items sorted by price ascending. Output the JSON array and nothing else.`;

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },   // ← only header needed in artifacts
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: sys,
        messages: [{
          role: "user",
          content: `Fetch and extract all ${cat.label} products from: ${url}\nAlso search: livcheers ${city} ${cat.label} price list 2026\nReturn JSON array only.`,
        }],
      }),
    });
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} — ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`API error: ${data.error.message}`);
  if (data.stop_reason === "max_tokens") onLog(`  ⚠ ${cat.label} — hit token limit, results may be partial`, "warn");

  const items = extractItems(data);

  if (!items.length) {
    // Log a snippet of what came back to help debug
    const snippet = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 200);
    onLog(`  ⚠ ${cat.label} — no JSON parsed. Response snippet: ${snippet || "(empty)"}`, "warn");
    return { items: [], fromCache: false, fetchedAt: Date.now() };
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const fetchedAt = Date.now();
  await store.set(cacheKey, { items, fetchedAt });
  onLog(`✓ ${cat.label} — ${items.length} items saved to cache`, "ok");
  return { items, fromCache: false, fetchedAt };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const CAT_META = {
  malts:       { label:"Single Malts",   emoji:"🥃", color:"#d4872a", glow:"#d4872a40", dim:"#1a0e00" },
  worldwhisky: { label:"World Whisky",   emoji:"🌍", color:"#b87c20", glow:"#b87c2040", dim:"#140c00" },
  scotch:      { label:"Scotch",         emoji:"🏴",  color:"#9a6a18", glow:"#9a6a1840", dim:"#100a00" },
  gin:         { label:"Gin",            emoji:"🌿", color:"#20c970", glow:"#20c97040", dim:"#001a0c" },
  tequila:     { label:"Tequila",        emoji:"🌵", color:"#e0c020", glow:"#e0c02040", dim:"#181200" },
  rum:         { label:"Rum",            emoji:"🍹", color:"#e03060", glow:"#e0306040", dim:"#1a0010" },
  vodka:       { label:"Vodka",          emoji:"❄️",  color:"#40a0f0", glow:"#40a0f040", dim:"#001020" },
  beer:        { label:"Beer",           emoji:"🍺", color:"#e89020", glow:"#e8902040", dim:"#181000" },
  wine:        { label:"Wine",           emoji:"🍷", color:"#c03878", glow:"#c0387840", dim:"#180018" },
};

const FLAGS = {
  India:"🇮🇳", Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", Ireland:"🇮🇪", USA:"🇺🇸", Japan:"🇯🇵", Mexico:"🇲🇽",
  France:"🇫🇷", England:"🇬🇧", Germany:"🇩🇪", Italy:"🇮🇹", Australia:"🇦🇺", Cuba:"🇨🇺",
  Venezuela:"🇻🇪", Guatemala:"🇬🇹", Chile:"🇨🇱", Argentina:"🇦🇷", "New Zealand":"🇳🇿",
  Belgium:"🇧🇪", Netherlands:"🇳🇱", Barbados:"🇧🇧", Sweden:"🇸🇪",
  "Dominican Republic":"🇩🇴", "Puerto Rico":"🇵🇷", Bhutan:"🇧🇹",
};

const TIER = {
  editors: { icon:"🏆", label:"Editor's Choice", bg:"#2a1500", fg:"#f0900a" },
  best:    { icon:"★",  label:"Best Pick",        bg:"#0a0a1e", fg:"#7090e8" },
  good:    { icon:"✓",  label:"Good Value",       bg:"#0a140a", fg:"#50904a" },
};

const CITIES = ["Gurgaon","Noida","Ghaziabad","Delhi","Mumbai","Bangalore","Hyderabad","Chennai","Pune","Kolkata"];

const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const ageStr = ms => {
  const d = Date.now() - ms;
  if (d < 60000)   return "just now";
  if (d < 3600000) return `${Math.round(d/60000)}m ago`;
  if (d < 86400000)return `${Math.round(d/3600000)}h ago`;
  return `${Math.round(d/86400000)}d ago`;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCRAPER PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function ScraperPanel({ city, onData, onClose }) {
  const [logs,    setLogs]    = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [phase,   setPhase]   = useState(0);
  const logRef = useRef(null);

  const addLog = (msg, type = "info") => {
    setLogs(p => [...p, { msg, type, ts: Date.now() }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = 99999; }, 40);
  };

  const run = async (force = false) => {
    setRunning(true); setDone(false); setLogs([]); setPhase(0);

    // Pre-classify: cached (instant) vs needs real API call
    const needsAPI = [], cached_cats = [];
    if (!force) {
      for (const cat of CATS_TO_SCRAPE) {
        const hit = await store.get("price:" + city + ":" + cat.id);
        if (hit && Date.now() - hit.fetchedAt < STALE_MS) cached_cats.push(cat);
        else needsAPI.push(cat);
      }
    } else {
      needsAPI.push(...CATS_TO_SCRAPE);
    }

    addLog(city + " — " + cached_cats.length + " instant (cache) + " + needsAPI.length + " need API", "info");

    let done_count = 0, apiHits = 0, cacheHits = 0, errors = 0;

    // Stream each result to parent + update progress counter immediately
    const handleResult = (cat, r) => {
      done_count++;
      setPhase(done_count);
      if (r.fromCache) cacheHits++; else apiHits++;
      onData({ [cat.id]: r });   // catalog updates live, no waiting
    };

    // Phase 1 — cache hits: sequential but ~instant, no API
    for (const cat of cached_cats) {
      try {
        const r = await scrapeCategory(city, cat, addLog, false);
        handleResult(cat, r);
      } catch(e) {
        addLog("ERR " + cat.label + ": " + e.message, "error");
        errors++; done_count++; setPhase(done_count);
      }
    }

    // Phase 2 — API fetches: batches of 3 in parallel (3x faster than sequential)
    const BATCH = 3;
    for (let i = 0; i < needsAPI.length; i += BATCH) {
      const batch = needsAPI.slice(i, i + BATCH);
      addLog("  Fetching: " + batch.map(c => c.label).join(", ") + "...", "pending");
      await Promise.allSettled(
        batch.map(cat =>
          scrapeCategory(city, cat, addLog, force)
            .then(r => handleResult(cat, r))
            .catch(e => {
              addLog("ERR " + cat.label + ": " + e.message, "error");
              errors++; done_count++; setPhase(done_count);
            })
        )
      );
    }

    addLog("Done! API:" + apiHits + " Cache:" + cacheHits + " Errors:" + errors, "ok");
    setRunning(false); setDone(true);
  };

  const pct = CATS_TO_SCRAPE.length ? phase / CATS_TO_SCRAPE.length : 0;
  const logColor = { ok:"#22c97a", error:"#e84040", warn:"#e8c030", pending:"#888", info:"#555", muted:"#2a2a2a" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", padding:16 }}>
      <div style={{ width:"100%", maxWidth:580, background:"#080808", border:"1px solid #282828", borderRadius:16, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,.8)" }}>

        {/* Header */}
        <div style={{ padding:"18px 22px 14px", borderBottom:"1px solid #141414", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:8, letterSpacing:4, color:"#555", marginBottom:3 }}>PRICE SCRAPER</div>
            <div style={{ fontSize:17, fontWeight:700, color:"#f0e8d0", fontFamily:"Georgia,serif" }}>
              Livcheers · {city}
            </div>
          </div>
          {!running && (
            <button onClick={onClose} style={{ background:"none", border:"1px solid #222", color:"#555", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>✕</button>
          )}
        </div>

        {/* Progress bar */}
        {(running || done) && (
          <div style={{ padding:"0 22px" }}>
            <div style={{ height:2, background:"#141414", borderRadius:1, margin:"12px 0 4px", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct*100}%`, background:"linear-gradient(90deg,#d4872a,#e8c030)", transition:"width .6s ease" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:7, color:"#333", marginBottom:10 }}>
              <span>{running ? `${phase} / ${CATS_TO_SCRAPE.length}` : "Complete"}</span>
              <span>{Math.round(pct*100)}%</span>
            </div>
          </div>
        )}

        {/* Terminal log */}
        <div ref={logRef} style={{ height:260, overflowY:"auto", padding:"10px 22px", fontFamily:"'Courier New',monospace", fontSize:11, lineHeight:1.9, background:"#050505", borderTop:"1px solid #0e0e0e", borderBottom:"1px solid #0e0e0e" }}>
          {logs.length === 0 && !running && (
            <div style={{ color:"#222", textAlign:"center", paddingTop:80 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>⚡</div>
              <div style={{ color:"#333" }}>Ready — {CATS_TO_SCRAPE.length} categories queued</div>
              <div style={{ fontSize:9, marginTop:6, color:"#1e1e1e" }}>Smart Sync uses cached data · Force Refresh ignores cache</div>
            </div>
          )}
          {logs.map((l, i) => (
            <div key={i} style={{ color: logColor[l.type] || "#555" }}>{l.msg}</div>
          ))}
          {running && <span style={{ color:"#d4872a" }}>▌</span>}
        </div>

        {/* Buttons */}
        <div style={{ padding:"14px 22px", display:"flex", gap:10 }}>
          {!running ? (
            <>
              <button onClick={() => run(false)} style={{ flex:1, background:"#d4872a", color:"#000", border:"none", borderRadius:8, padding:"11px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:.5 }}>
                ⚡ Smart Sync
              </button>
              <button onClick={() => run(true)} style={{ flex:1, background:"#111", color:"#666", border:"1px solid #252525", borderRadius:8, padding:"11px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                ↻ Force Refresh All
              </button>
              {done && (
                <button onClick={onClose} style={{ background:"#22c97a18", color:"#22c97a", border:"1px solid #22c97a40", borderRadius:8, padding:"11px 16px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                  Done ✓
                </button>
              )}
            </>
          ) : (
            <div style={{ flex:1, textAlign:"center", color:"#444", fontSize:11, padding:11 }}>Scraping in progress — please wait…</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUDGET RING
// ═══════════════════════════════════════════════════════════════════════════════
function BudgetRing({ spent, total }) {
  const pct   = Math.min(1, spent / total);
  const r     = 52, c = 64, circ = 2 * Math.PI * r;
  const color = pct > .92 ? "#e84040" : pct > .7 ? "#e8c030" : "#22c97a";
  const left  = total - spent;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="128" height="128" style={{ filter:`drop-shadow(0 0 10px ${color}50)`, overflow:"visible" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1a1a1a" strokeWidth={10}/>
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition:"stroke-dashoffset .9s cubic-bezier(.4,0,.2,1), stroke .4s" }}/>
        <text x={c} y={c-12} textAnchor="middle" fill={color} fontSize="21" fontWeight="700" fontFamily="Georgia,serif">{Math.round(pct*100)}%</text>
        <text x={c} y={c+3}  textAnchor="middle" fill="#444" fontSize="9"  fontFamily="Georgia,serif" letterSpacing="2">USED</text>
        <text x={c} y={c+19} textAnchor="middle" fill="#888" fontSize="11" fontWeight="600" fontFamily="Georgia,serif">{fmt(spent)}</text>
      </svg>
      <div style={{ textAlign:"center", marginTop:4 }}>
        <div style={{ fontSize:8, color:"#444", letterSpacing:1 }}>REMAINING</div>
        <div style={{ fontSize:14, fontWeight:700, color:left<5000?"#e84040":left<20000?"#e8c030":"#22c97a", transition:"color .4s" }}>
          {fmt(Math.max(0, left))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT CARD  (3-D flip on hover)
// ═══════════════════════════════════════════════════════════════════════════════
function ProductCard({ item, cat, qty, onAdd, onRem, budgetLeft }) {
  const [flipped, setFlipped] = useState(false);
  const cm = CAT_META[cat];
  const t  = TIER[item.tier] || TIER.good;
  const canAdd = item.price <= budgetLeft + qty * item.price;

  return (
    <div style={{ perspective:1000, height:224 }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}>
      <div style={{ position:"relative", width:"100%", height:"100%", transformStyle:"preserve-3d", transition:"transform .5s cubic-bezier(.4,0,.2,1)", transform:flipped?"rotateY(180deg)":"none" }}>

        {/* FRONT */}
        <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden",
          background:`linear-gradient(150deg,${cm.dim} 0%,#0a0a0a 100%)`,
          border:`1px solid ${qty>0?cm.color+"90":"#1e1e1e"}`,
          borderRadius:10, padding:14, display:"flex", flexDirection:"column",
          boxShadow:qty>0?`0 0 18px ${cm.glow}`:"none",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <span style={{ fontSize:7, padding:"2px 6px", borderRadius:3, background:t.bg, color:t.fg, fontWeight:700 }}>{t.icon} {t.label}</span>
            <span style={{ fontSize:9, color:"#444" }}>{FLAGS[item.origin]||"🌍"} {item.origin}</span>
          </div>
          <div style={{ fontSize:8, color:cm.color, letterSpacing:.5, marginBottom:1, opacity:.7 }}>{item.sub}</div>
          <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>{item.brand}</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#f0e8d0", lineHeight:1.2, flex:1 }}>{item.name}</div>
          <div style={{ fontSize:9, letterSpacing:1, margin:"6px 0" }}>
            {[1,2,3,4,5].map(i=><span key={i} style={{color:i<=Math.round(item.rating||0)?"#e8c030":"#222"}}>★</span>)}
            <span style={{color:"#444",fontSize:8,marginLeft:3}}>{item.rating}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <div>
              <div style={{ fontSize:19, fontWeight:700, color:cm.color }}>{fmt(item.price)}</div>
              <div style={{ fontSize:8, color:"#2a2a2a" }}>{item.vol}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }} onClick={e=>e.stopPropagation()}>
              {qty > 0 && <>
                <button onClick={onRem} style={{width:24,height:24,borderRadius:"50%",background:"#141414",border:"1px solid #2a2a2a",color:"#888",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
                <span style={{color:cm.color,fontWeight:700,fontSize:13,minWidth:16,textAlign:"center"}}>{qty}</span>
              </>}
              <button onClick={canAdd ? onAdd : undefined} style={{width:24,height:24,borderRadius:"50%",background:qty>0?cm.color:"#141414",border:`1px solid ${qty>0?cm.color:"#282828"}`,color:qty>0?"#000":canAdd?cm.color:"#2a2a2a",cursor:canAdd?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,opacity:!canAdd&&qty===0?.35:1,transition:"all .2s"}}>+</button>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", transform:"rotateY(180deg)",
          background:`linear-gradient(135deg,${cm.dim} 0%,#0f0f0f 60%,#080808 100%)`,
          border:`1px solid ${cm.color}40`, borderRadius:10, padding:16,
          display:"flex", flexDirection:"column", justifyContent:"space-between",
        }}>
          <div>
            <div style={{ fontSize:8, color:cm.color, letterSpacing:2, marginBottom:8 }}>TASTING NOTES</div>
            <div style={{ fontSize:12, color:"#e0d4c0", fontStyle:"italic", lineHeight:1.7 }}>"{item.notes}"</div>
          </div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#444", marginBottom:8 }}>
              <span>{item.vol}</span><span>⭑ {item.rating}/5</span>
            </div>
            <a href={item.url || `https://www.livcheers.com`} target="_blank" rel="noreferrer"
              style={{ display:"block", background:`${cm.color}18`, border:`1px solid ${cm.color}40`, borderRadius:5, padding:"7px", fontSize:9, color:cm.color, textDecoration:"none", textAlign:"center", letterSpacing:.5 }}>
              View on Livcheers ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [city,        setCity]       = useState("Gurgaon");
  const [budget,      setBudget]     = useState(80000);
  const [budgetDraft, setBDraft]     = useState("80000");
  const [editBudget,  setEditB]      = useState(false);
  const [catalog,     setCatalog]    = useState({});    // catId → items[]
  const [ages,        setAges]       = useState({});    // catId → fetchedAt
  const [activeCat,   setActiveCat]  = useState("malts");
  const [inv,         setInvState]   = useState({});
  const [batches,     setBatState]   = useState([{name:"Batch 1",items:{}}]);
  const [activeBatch, setAB]         = useState(0);
  const [showScraper, setScraper]    = useState(false);
  const [cartOpen,    setCartOpen]   = useState(false);
  const [showCity,    setShowCity]   = useState(false);
  const [tierF,       setTierF]      = useState("All");
  const [origF,       setOrigF]      = useState("All");
  const [sortF,       setSortF]      = useState("default");
  const [search,      setSearch]     = useState("");
  const [viewMode,    setViewMode]   = useState("grid");

  // ── Restore from storage on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Restore settings
      const city   = await store.get("cfg:city");
      const budget = await store.get("cfg:budget");
      const inv    = await store.get("cfg:inv");
      const bats   = await store.get("cfg:batches");
      if (city)   setCity(city);
      if (budget) { setBudget(Number(budget)); setBDraft(String(budget)); }
      if (inv)    setInvState(inv);
      if (bats)   setBatState(bats);

      // Restore cached prices for current city
      const c = city || "Gurgaon";
      const catMap = {}, ageMap = {};
      for (const cat of CATS_TO_SCRAPE) {
        const cached = await store.get(`price:${c}:${cat.id}`);
        if (cached?.items?.length) {
          catMap[cat.id] = cached.items;
          ageMap[cat.id] = cached.fetchedAt;
        }
      }
      setCatalog(catMap);
      setAges(ageMap);
    })();
  }, []);

  // ── Persist helpers ────────────────────────────────────────────────────────
  const saveInv  = v => { setInvState(v);  store.set("cfg:inv",     v); };
  const saveBats = v => { setBatState(v);  store.set("cfg:batches", v); };
  const saveCity = v => { setCity(v);      store.set("cfg:city",    v); };
  const saveBudget=v => { setBudget(v);    store.set("cfg:budget",  v); };

  // ── Cart ops ───────────────────────────────────────────────────────────────
  const ik   = (cat, idx) => `${cat}__${idx}`;
  const getQ = (cat, idx) => inv[ik(cat,idx)] || 0;

  const addItem = useCallback((cat, idx) => {
    const k = ik(cat, idx), n = {...inv, [k]:(inv[k]||0)+1};
    saveInv(n);
    saveBats(batches.map((b,i) => i===activeBatch ? {...b,items:{...b.items,[k]:(b.items[k]||0)+1}} : b));
  }, [inv, batches, activeBatch]);

  const remItem = useCallback((cat, idx) => {
    const k = ik(cat, idx), n = {...inv};
    if ((n[k]||0) <= 1) delete n[k]; else n[k]--;
    saveInv(n);
  }, [inv]);

  // ── Scraper callback ───────────────────────────────────────────────────────
  const handleScraperData = useCallback(results => {
    const cm = {}, am = {};
    Object.entries(results).forEach(([id,r]) => {
      if (r.items?.length) { cm[id] = r.items; am[id] = r.fetchedAt; }
    });
    setCatalog(p => ({...p,...cm}));
    setAges(p    => ({...p,...am}));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalSpent = useMemo(() =>
    Object.entries(inv).reduce((s,[id,q]) => {
      const [c,i] = id.split("__"); const it = (catalog[c]||[])[+i];
      return s + (it ? it.price*q : 0);
    }, 0), [inv, catalog]);

  const totalBtl = useMemo(() => Object.values(inv).reduce((s,q)=>s+q,0), [inv]);
  const left = budget - totalSpent;

  const catSpend = useMemo(() => {
    const m = {};
    Object.entries(inv).forEach(([id,q]) => {
      const [c,i] = id.split("__"); const it = (catalog[c]||[])[+i];
      if (it) m[c] = (m[c]||0) + it.price*q;
    }); return m;
  }, [inv, catalog]);

  const cartItems = useMemo(() => {
    const out = [];
    Object.entries(inv).forEach(([id,q]) => {
      if (!q) return;
      const [cat,idx] = id.split("__"); const it = (catalog[cat]||[])[+idx];
      if (it) out.push({...it, cat, idx:+idx, qty:q, key:id});
    }); return out;
  }, [inv, catalog]);

  const cm       = CAT_META[activeCat] || CAT_META.malts;
  const items    = catalog[activeCat] || [];
  const filtered = useMemo(() => {
    let r = [...items];
    if (tierF !== "All") r = r.filter(x => x.tier === tierF);
    if (origF === "India") r = r.filter(x => x.origin === "India");
    if (origF === "Intl")  r = r.filter(x => x.origin !== "India");
    if (search) { const q = search.toLowerCase(); r = r.filter(x => x.name?.toLowerCase().includes(q) || x.brand?.toLowerCase().includes(q)); }
    if (sortF === "price_asc")  r = [...r].sort((a,b) => a.price - b.price);
    if (sortF === "price_desc") r = [...r].sort((a,b) => b.price - a.price);
    if (sortF === "rating")     r = [...r].sort((a,b) => b.rating - a.rating);
    return r;
  }, [items, tierF, origF, search, sortF]);

  const pct      = Math.min(1, totalSpent/budget);
  const barColor = pct>.92?"#e84040":pct>.7?"#e8c030":"#22c97a";
  const staleCount = Object.entries(ages).filter(([,t]) => Date.now()-t>STALE_MS).length;
  const dbCount    = Object.keys(catalog).filter(id => catalog[id]?.length).length;

  const Btn = ({children, active, color="#c8902a", onClick, style={}}) => (
    <button onClick={onClick} style={{background:active?color:"transparent",color:active?"#000":"#444",border:`1px solid ${active?color:"#1a1a1a"}`,borderRadius:5,padding:"3px 9px",fontSize:9,fontFamily:"inherit",cursor:"pointer",transition:"all .15s",...style}}>{children}</button>
  );

  return (
    <div style={{fontFamily:"Georgia,serif",background:"#040404",minHeight:"100vh",color:"#e0d4c0"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#080808}
        ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        .card-row{animation:fadeUp .2s ease both}
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div style={{background:"#070707",borderBottom:"1px solid #141414",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1440,margin:"0 auto",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>

          <div style={{flexShrink:0,lineHeight:1.2}}>
            <div style={{fontSize:7,letterSpacing:5,color:"#282828"}}>CELLAR PLANNER</div>
            <div style={{fontSize:15,fontWeight:700,color:"#f0e8d0"}}>🥃 <span style={{color:"#d4872a"}}>Livcheers</span> Live</div>
          </div>

          {/* City */}
          <div style={{position:"relative"}}>
            <button onClick={() => setShowCity(!showCity)} style={{background:"#0e0e0e",border:"1px solid #282828",color:"#d0c8b8",borderRadius:6,padding:"5px 11px",fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
              📍 {city} <span style={{color:"#333",fontSize:9}}>▾</span>
            </button>
            {showCity && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,background:"#0e0e0e",border:"1px solid #222",borderRadius:8,overflow:"hidden",zIndex:300,minWidth:130,boxShadow:"0 12px 40px rgba(0,0,0,.8)"}}>
                {CITIES.map(c => (
                  <button key={c} onClick={() => { saveCity(c); setShowCity(false); setCatalog({}); setAges({}); }}
                    style={{display:"block",width:"100%",textAlign:"left",padding:"7px 14px",background:city===c?"#1a1a1a":"transparent",color:city===c?"#d4872a":"#777",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Budget */}
          <div style={{flex:1,minWidth:150}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#2a2a2a",marginBottom:3}}>
              <span style={{color:barColor}}>{fmt(totalSpent)} spent</span>
              <span style={{cursor:"pointer",textDecoration:"underline",color:"#333"}} onClick={() => setEditB(!editBudget)}>{fmt(budget)} budget</span>
            </div>
            <div style={{height:4,background:"#111",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:barColor,transition:"width .7s, background .3s"}}/>
            </div>
            {editBudget ? (
              <div style={{display:"flex",gap:4,marginTop:4}}>
                <input type="number" value={budgetDraft} onChange={e=>setBDraft(e.target.value)}
                  style={{background:"#111",border:"1px solid #333",borderRadius:4,padding:"2px 7px",color:"#f0e8d0",fontFamily:"inherit",fontSize:9,width:90,outline:"none"}}
                  onKeyDown={e=>e.key==="Enter"&&(saveBudget(Number(budgetDraft)||budget),setEditB(false))}/>
                <button onClick={() => {saveBudget(Number(budgetDraft)||budget);setEditB(false);}}
                  style={{background:"#d4872a",color:"#000",border:"none",borderRadius:4,padding:"2px 9px",fontSize:9,cursor:"pointer",fontWeight:700}}>✓</button>
              </div>
            ) : (
              <div style={{fontSize:7,color:"#1e1e1e",marginTop:1}}>{totalBtl} bottles · {fmt(left)} left</div>
            )}
          </div>

          {/* DB status pill */}
          <div style={{display:"flex",alignItems:"center",gap:5,background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:6,padding:"4px 9px"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:staleCount>0?"#e8c030":dbCount>0?"#22c97a":"#333",animation:staleCount>0?"pulse 2s infinite":"none"}}/>
            <span style={{fontSize:8,color:"#444"}}>{dbCount}/{CATS_TO_SCRAPE.length} cached</span>
            {staleCount > 0 && <span style={{fontSize:7,color:"#6a5020"}}>· {staleCount} stale</span>}
          </div>

          <button onClick={() => setScraper(true)} style={{background:"#d4872a",color:"#000",border:"none",borderRadius:6,padding:"6px 13px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5}}>
            ⚡ Scrape
          </button>

          <button onClick={() => setCartOpen(!cartOpen)} style={{background:cartOpen?"#d4872a":"#0e0e0e",color:cartOpen?"#000":"#888",border:`1px solid ${cartOpen?"#d4872a":"#222"}`,borderRadius:6,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,transition:"all .2s"}}>
            🛒{totalBtl>0&&<span style={{background:cartOpen?"#000":"#d4872a",color:cartOpen?"#d4872a":"#000",borderRadius:"50%",width:15,height:15,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700}}>{totalBtl}</span>}
          </button>
        </div>
      </div>

      <div style={{display:"flex",maxWidth:1440,margin:"0 auto"}}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <div style={{width:168,flexShrink:0,padding:"14px 10px",borderRight:"1px solid #0e0e0e",position:"sticky",top:57,height:"calc(100vh - 57px)",overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          <BudgetRing spent={totalSpent} total={budget}/>

          {Object.keys(catSpend).length > 0 && (
            <div>
              <div style={{fontSize:7,color:"#1e1e1e",letterSpacing:2,marginBottom:7,textTransform:"uppercase"}}>By Category</div>
              {Object.entries(CAT_META).filter(([id])=>catSpend[id]).map(([id,c]) => {
                const p = Math.min(100,(catSpend[id]||0)/budget*100);
                return <div key={id} style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"#333",marginBottom:2}}>
                    <span>{c.emoji} {c.label}</span>
                    <span style={{color:c.color}}>{fmt(catSpend[id])}</span>
                  </div>
                  <div style={{height:2,background:"#0e0e0e",borderRadius:1}}>
                    <div style={{height:"100%",width:`${p}%`,background:c.color,transition:"width .5s"}}/>
                  </div>
                </div>;
              })}
            </div>
          )}

          <div>
            <div style={{fontSize:7,color:"#1e1e1e",letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>Batches</div>
            {batches.map((b,i) => (
              <button key={i} onClick={() => setAB(i)} style={{display:"block",width:"100%",textAlign:"left",background:activeBatch===i?"#1a1a1a":"transparent",color:activeBatch===i?"#d4872a":"#2a2a2a",border:"none",borderRadius:4,padding:"4px 7px",fontSize:9,fontFamily:"inherit",cursor:"pointer",marginBottom:2}}>
                {activeBatch===i ? "▶ " : ""}{b.name}
                <span style={{float:"right",fontSize:7,color:"#1e1e1e"}}>{Object.values(b.items||{}).reduce((s,q)=>s+q,0)}</span>
              </button>
            ))}
            <button onClick={() => { const n=`Batch ${batches.length+1}`,nb=[...batches,{name:n,items:{}}]; saveBats(nb); setAB(batches.length); }}
              style={{display:"block",width:"100%",textAlign:"left",background:"transparent",color:"#181818",border:"1px dashed #141414",borderRadius:4,padding:"4px 7px",fontSize:9,fontFamily:"inherit",cursor:"pointer",marginTop:3}}>
              + New Batch
            </button>
          </div>

          {/* DB freshness */}
          <div style={{marginTop:"auto",fontSize:7,color:"#181818",lineHeight:2}}>
            {CATS_TO_SCRAPE.map(cat => {
              const t = ages[cat.id]; const c = CAT_META[cat.id]; if(!t||!c) return null;
              const stale = Date.now()-t > STALE_MS;
              return <div key={cat.id} style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:stale?"#4a3010":"#181818"}}>{c.emoji} {c.label}</span>
                <span style={{color:stale?"#6a4a20":"#181818"}}>{ageStr(t)}{stale?" ⚠":""}</span>
              </div>;
            })}
          </div>
        </div>

        {/* ── CATALOG ──────────────────────────────────────────────────── */}
        <div style={{flex:1,minWidth:0,padding:"12px 14px"}}>

          {/* Category tabs */}
          <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:8,marginBottom:10,scrollbarWidth:"none"}}>
            {Object.entries(CAT_META).map(([id,c]) => {
              const isActive = id===activeCat;
              const hasData  = !!(catalog[id]?.length);
              const stale    = ages[id] && Date.now()-ages[id]>STALE_MS;
              return (
                <button key={id} onClick={() => setActiveCat(id)} style={{
                  flexShrink:0,display:"flex",alignItems:"center",gap:4,
                  background:isActive?c.color:"#0c0c0c",
                  color:isActive?"#000":"#555",
                  border:`1px solid ${isActive?c.color:hasData?"#202020":"#141414"}`,
                  borderRadius:20,padding:"5px 12px",fontSize:10,fontFamily:"inherit",cursor:"pointer",
                  transition:"all .2s",boxShadow:isActive?`0 0 14px ${c.glow}`:"none",
                }}>
                  {c.emoji} {c.label}
                  {hasData && <span style={{fontSize:7,opacity:.45}}>{catalog[id].length}</span>}
                  {stale && !isActive && <span title="Stale" style={{fontSize:8,color:"#6a5020"}}>⚠</span>}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            {[["All","All"],["editors","🏆"],["best","★ Best"],["good","✓ Good"]].map(([k,l]) => (
              <Btn key={k} active={tierF===k} color="#333" onClick={() => setTierF(k)}>{l}</Btn>
            ))}
            <span style={{width:1,height:12,background:"#141414"}}/>
            {[["All","All"],["India","🇮🇳 India"],["Intl","🌍 Intl"]].map(([k,l]) => (
              <Btn key={k} active={origF===k} color="#333" onClick={() => setOrigF(k)}>{l}</Btn>
            ))}
            <span style={{width:1,height:12,background:"#141414"}}/>
            <select value={sortF} onChange={e=>setSortF(e.target.value)} style={{background:"#0c0c0c",border:"1px solid #1a1a1a",borderRadius:5,padding:"3px 8px",color:"#555",fontFamily:"inherit",fontSize:9,outline:"none",cursor:"pointer"}}>
              <option value="default">Sort: Default</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="rating">Rating ↓</option>
            </select>
            <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
              <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{background:"#0c0c0c",border:"1px solid #1a1a1a",borderRadius:5,padding:"4px 10px",color:"#e0d4c0",fontFamily:"inherit",fontSize:9,width:120,outline:"none"}}/>
              <button onClick={() => setViewMode(viewMode==="grid"?"table":"grid")} title="Toggle view"
                style={{background:"#0c0c0c",border:"1px solid #1a1a1a",borderRadius:5,padding:"4px 9px",color:"#555",cursor:"pointer",fontSize:12}}>
                {viewMode==="grid"?"☰":"⊞"}
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#1e1e1e",marginBottom:10}}>
            <span>{filtered.length} items · {cm.label}</span>
            {ages[activeCat] && (
              <span style={{color:Date.now()-ages[activeCat]>STALE_MS?"#5a4010":"#1e1e1e"}}>
                💾 {ageStr(ages[activeCat])}{Date.now()-ages[activeCat]>STALE_MS?" · stale":""}
              </span>
            )}
          </div>

          {/* Empty state */}
          {!catalog[activeCat] && (
            <div style={{textAlign:"center",padding:"70px 20px",color:"#2a2a2a"}}>
              <div style={{fontSize:40,marginBottom:12}}>{cm.emoji}</div>
              <div style={{fontSize:13,color:"#3a3a3a",marginBottom:6}}>No data for {cm.label} in {city}</div>
              <div style={{fontSize:10,color:"#222",marginBottom:18}}>Click <span style={{color:"#d4872a",fontWeight:700}}>⚡ Scrape</span> to fetch live prices from Livcheers</div>
              <button onClick={() => setScraper(true)} style={{background:"#d4872a",color:"#000",border:"none",borderRadius:8,padding:"9px 22px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⚡ Open Scraper</button>
            </div>
          )}

          {/* Grid */}
          {catalog[activeCat] && viewMode==="grid" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(215px,1fr))",gap:10}}>
              {filtered.map((item, fi) => {
                const realIdx = items.indexOf(item);
                return (
                  <div key={fi} className="card-row" style={{animationDelay:`${Math.min(fi*18,180)}ms`}}>
                    <ProductCard item={item} cat={activeCat} qty={getQ(activeCat,realIdx)}
                      onAdd={() => addItem(activeCat,realIdx)} onRem={() => remItem(activeCat,realIdx)}
                      budgetLeft={left}/>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          {catalog[activeCat] && viewMode==="table" && (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #0e0e0e"}}>
                    {["","Brand","Name","Type","Size","Price","Rating","Origin",""].map((h,i) => (
                      <th key={i} style={{padding:"5px 8px",textAlign:i>=7?"right":"left",color:"#222",fontWeight:400,fontSize:7,letterSpacing:1}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, fi) => {
                    const realIdx = items.indexOf(item), q = getQ(activeCat,realIdx), t = TIER[item.tier]||TIER.good;
                    return (
                      <tr key={fi} className="card-row" style={{borderBottom:"1px solid #080808",background:q>0?cm.color+"0a":"transparent",transition:"background .1s",animationDelay:`${Math.min(fi*12,120)}ms`}}
                        onMouseEnter={e=>e.currentTarget.style.background=cm.color+"14"}
                        onMouseLeave={e=>e.currentTarget.style.background=q>0?cm.color+"0a":"transparent"}>
                        <td style={{padding:"5px 8px"}}><span style={{fontSize:7,padding:"2px 5px",borderRadius:2,background:t.bg,color:t.fg}}>{t.icon}</span></td>
                        <td style={{padding:"5px 8px",color:"#555",fontSize:9}}>{item.brand}</td>
                        <td style={{padding:"5px 8px",color:q>0?"#f0e8d0":"#888",fontWeight:q>0?700:400}}>{item.name}</td>
                        <td style={{padding:"5px 8px",color:"#333",fontSize:9}}>{item.sub}</td>
                        <td style={{padding:"5px 8px",color:"#2a2a2a"}}>{item.vol}</td>
                        <td style={{padding:"5px 8px",color:cm.color,fontWeight:700}}>{fmt(item.price)}</td>
                        <td style={{padding:"5px 8px"}}>
                          {[1,2,3,4,5].map(i=><span key={i} style={{color:i<=Math.round(item.rating||0)?"#e8c030":"#1a1a1a",fontSize:10}}>★</span>)}
                        </td>
                        <td style={{padding:"5px 8px",color:"#333",fontSize:9}}>{FLAGS[item.origin]||"🌍"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                            {q>0&&<button onClick={()=>remItem(activeCat,realIdx)} style={{width:20,height:20,borderRadius:"50%",background:"#141414",border:"1px solid #222",color:"#888",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>}
                            {q>0&&<span style={{color:cm.color,fontWeight:700,fontSize:11,minWidth:12,textAlign:"center"}}>{q}</span>}
                            <button onClick={()=>addItem(activeCat,realIdx)} style={{width:20,height:20,borderRadius:"50%",background:q>0?cm.color:"#141414",border:`1px solid ${q>0?cm.color:"#222"}`,color:q>0?"#000":cm.color,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CART ─────────────────────────────────────────────────────── */}
        <div style={{width:cartOpen?272:0,flexShrink:0,overflow:"hidden",transition:"width .3s cubic-bezier(.4,0,.2,1)",borderLeft:"1px solid #0e0e0e",position:"sticky",top:57,height:"calc(100vh - 57px)"}}>
          <div style={{width:272,height:"100%",overflowY:"auto",padding:"13px 11px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#e0d4c0"}}>CART</div>
              {totalBtl>0&&<div style={{fontSize:8,color:"#555"}}>{totalBtl} btls · {fmt(totalSpent)}</div>}
            </div>

            {cartItems.length===0
              ? <div style={{color:"#1a1a1a",textAlign:"center",padding:"50px 0",fontSize:10}}>Cart is empty</div>
              : <>
                {Object.entries(CAT_META).filter(([id])=>cartItems.some(i=>i.cat===id)).map(([id,c]) => {
                  const ci  = cartItems.filter(i=>i.cat===id);
                  const tot = ci.reduce((s,i)=>s+i.price*i.qty,0);
                  return <div key={id} style={{marginBottom:12}}>
                    <div style={{fontSize:7,letterSpacing:2,color:c.color,borderBottom:`1px solid ${c.color}20`,paddingBottom:3,marginBottom:7,display:"flex",justifyContent:"space-between"}}>
                      <span>{c.emoji} {c.label}</span><span>{fmt(tot)}</span>
                    </div>
                    {ci.map(item => (
                      <div key={item.key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:10,color:"#d0c8b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                          <div style={{fontSize:7,color:"#333"}}>{item.vol} · {fmt(item.price)}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                          <button onClick={()=>remItem(item.cat,item.idx)} style={{width:17,height:17,borderRadius:"50%",background:"#141414",border:"1px solid #222",color:"#666",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                          <span style={{fontSize:10,fontWeight:700,color:c.color,minWidth:12,textAlign:"center"}}>{item.qty}</span>
                          <button onClick={()=>addItem(item.cat,item.idx)} style={{width:17,height:17,borderRadius:"50%",background:c.color,border:"none",color:"#000",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>;
                })}

                <div style={{borderTop:"1px solid #141414",paddingTop:10,marginTop:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:8,color:"#555"}}>Total</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#e8c030"}}>{fmt(totalSpent)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:8,color:"#555"}}>Budget left</span>
                    <span style={{fontSize:10,fontWeight:700,color:left<0?"#e84040":"#22c97a"}}>{fmt(Math.max(0,left))}</span>
                  </div>
                  <div style={{background:"#0a0a0a",border:"1px solid #141414",borderRadius:5,padding:"7px 9px",marginBottom:8}}>
                    <div style={{fontSize:7,color:"#2a2a2a",letterSpacing:1,marginBottom:3}}>ACTIVE BATCH</div>
                    <div style={{fontSize:10,color:"#777"}}>{batches[activeBatch]?.name}</div>
                    <div style={{fontSize:7,color:"#222",marginTop:2}}>{Object.values(batches[activeBatch]?.items||{}).reduce((s,q)=>s+q,0)} bottles</div>
                  </div>
                  <button onClick={() => saveInv({})} style={{width:"100%",background:"transparent",color:"#2a2a2a",border:"1px solid #141414",borderRadius:4,padding:"5px",fontSize:8,fontFamily:"inherit",cursor:"pointer"}}>Clear Cart</button>
                </div>
              </>
            }
          </div>
        </div>
      </div>

      {/* Scraper modal */}
      {showScraper && <ScraperPanel city={city} onData={handleScraperData} onClose={() => setScraper(false)}/>}
    </div>
  );
}
