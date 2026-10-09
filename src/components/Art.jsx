// ═══════════════════════════════════════════════════════════════════════════════
//  ART — hand-drawn SVG bottles (category tiles, hero, placeholders) and the
//  app's line icons. Everything is vector, so it's crisp on every screen.
// ═══════════════════════════════════════════════════════════════════════════════
import { useId } from "react";

// Bottle silhouette per category "shape". Numbers are in a 60×120 box:
// nw neck width, nt neck top, ns shoulder start, bw body width, bt body top.
const SHAPES = {
  decanter:  { nw: 11, nt: 12, ns: 30, bw: 44, bt: 44, r: 7, cap: "cork", label: [16, 66, 28, 26] },
  wine:      { nw: 9,  nt: 6,  ns: 42, bw: 30, bt: 64, r: 6, cap: "foil", label: [17, 78, 26, 22] },
  champagne: { nw: 10, nt: 6,  ns: 40, bw: 34, bt: 66, r: 8, cap: "wire", label: [15, 80, 30, 20] },
  gin:       { nw: 12, nt: 14, ns: 30, bw: 40, bt: 40, r: 4, cap: "screw", label: [14, 62, 32, 30] },
  vodka:     { nw: 8,  nt: 4,  ns: 30, bw: 30, bt: 50, r: 5, cap: "screw", label: [17, 70, 26, 26] },
  tequila:   { nw: 12, nt: 26, ns: 52, bw: 42, bt: 64, r: 9, cap: "cork", label: [15, 78, 30, 22] },
  rum:       { nw: 11, nt: 10, ns: 36, bw: 38, bt: 56, r: 8, cap: "cork", label: [15, 72, 30, 24] },
  beer:      { nw: 8,  nt: 8,  ns: 44, bw: 28, bt: 66, r: 5, cap: "crown", label: [17, 82, 26, 18] },
  liqueur:   { nw: 10, nt: 16, ns: 40, bw: 40, bt: 60, r: 14, cap: "cork", label: [15, 76, 30, 20] },
  sake:      { nw: 10, nt: 14, ns: 34, bw: 38, bt: 70, r: 12, cap: "none", label: [16, 80, 28, 18] },
  can:       { can: true },
};

export const CAT_SHAPE = {
  malts: "decanter", worldwhisky: "decanter", scotch: "decanter", indian: "rum", brandy: "liqueur",
  gin: "gin", tequila: "tequila", rum: "rum", vodka: "vodka", beer: "beer",
  redwine: "wine", whitewine: "wine", rose: "wine", sparkling: "champagne", champagne: "champagne",
  liqueur: "liqueur", sake: "sake", rtd: "can",
};

function path({ nw, nt, ns, bw, bt, r }, bottom = 116) {
  const cx = 30, nl = cx - nw / 2, nr = cx + nw / 2, bl = cx - bw / 2, br = cx + bw / 2, mid = ns + (bt - ns) * 0.55;
  return `M${nl} ${nt} H${nr} V${ns} C${nr} ${mid} ${br} ${ns + (bt - ns) * 0.35} ${br} ${bt} V${bottom - r} Q${br} ${bottom} ${br - r} ${bottom} H${bl + r} Q${bl} ${bottom} ${bl} ${bottom - r} V${bt} C${bl} ${ns + (bt - ns) * 0.35} ${nl} ${mid} ${nl} ${ns} Z`;
}

export function Bottle({ shape = "decanter", color = "#e7a846", height = 96, glass = false }) {
  const id = useId().replace(/:/g, "");
  const s = SHAPES[shape] || SHAPES.decanter;
  const w = height / 2;
  if (s.can) {
    return (
      <svg width={w} height={height} viewBox="0 0 60 120" aria-hidden="true">
        <defs>
          <linearGradient id={`c${id}`} x1="0" x2="1"><stop offset="0" stopColor={color} /><stop offset=".45" stopColor="#fff" stopOpacity=".55" /><stop offset=".6" stopColor={color} /><stop offset="1" stopColor="#000" stopOpacity=".5" /></linearGradient>
        </defs>
        <rect x="13" y="22" width="34" height="94" rx="6" fill={color} />
        <rect x="13" y="22" width="34" height="94" rx="6" fill={`url(#c${id})`} opacity=".7" />
        <rect x="15" y="16" width="30" height="8" rx="3" fill="#d9d9d9" />
        <rect x="18" y="52" width="24" height="30" rx="3" fill="#fff" opacity=".85" />
        <rect x="21" y="60" width="18" height="3" rx="1.5" fill={color} /><rect x="23" y="67" width="14" height="2" rx="1" fill={color} opacity=".6" />
      </svg>
    );
  }
  const d = path(s);
  const [lx, ly, lw, lh] = s.label;
  return (
    <svg width={w} height={height} viewBox="0 0 60 120" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity={glass ? 0.55 : 1} />
          <stop offset=".5" stopColor={color} stopOpacity={glass ? 0.35 : 0.85} />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8e6" /><stop offset="1" stopColor="#f1ddb8" /></linearGradient>
        <clipPath id={`k${id}`}><path d={d} /></clipPath>
      </defs>
      <path d={d} fill={color} />
      <path d={d} fill={`url(#g${id})`} />
      <g clipPath={`url(#k${id})`}>
        <rect x={lx} y={ly} width={lw} height={lh} rx="2.5" fill={`url(#l${id})`} />
        <rect x={lx + 4} y={ly + lh * 0.3} width={lw - 8} height="2.4" rx="1.2" fill={color} />
        <rect x={lx + 7} y={ly + lh * 0.55} width={lw - 14} height="1.8" rx=".9" fill={color} opacity=".55" />
        <rect x={30 - s.bw / 2 + 4} y={s.bt + 4} width="4" height={112 - s.bt - 8} rx="2" fill="#fff" opacity=".32" />
        <rect x="0" y="0" width="60" height={s.nt + 2} fill="#000" opacity="0" />
      </g>
      {s.cap === "cork" && <rect x={30 - s.nw / 2 - 1} y={s.nt - 7} width={s.nw + 2} height="9" rx="2.5" fill="#c9924f" />}
      {s.cap === "foil" && <rect x={30 - s.nw / 2 - 0.5} y={s.nt - 1} width={s.nw + 1} height="16" rx="2" fill="#2a0f18" opacity=".9" />}
      {s.cap === "wire" && <rect x={30 - s.nw / 2 - 1} y={s.nt - 1} width={s.nw + 2} height="20" rx="3" fill="#e8c46a" />}
      {s.cap === "screw" && <rect x={30 - s.nw / 2 - 1} y={s.nt - 6} width={s.nw + 2} height="8" rx="1.5" fill="#d6d0c4" />}
      {s.cap === "crown" && <rect x={30 - s.nw / 2 - 1.5} y={s.nt - 4} width={s.nw + 3} height="5" rx="1" fill="#e2b93b" />}
    </svg>
  );
}

export const CatBottle = ({ cat, height }) => <Bottle shape={CAT_SHAPE[cat.id]} color={cat.color} height={height} glass={cat.id === "vodka" || cat.id === "gin"} />;

// ── Icons (24×24, stroke) ────────────────────────────────────────────────────
const I = ({ children, size = 22, sw = 1.8, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const Icon = {
  cabinet: (p) => <I {...p}><path d="M5 21V9a7 7 0 0 1 14 0v12z" /><path d="M5 14h14" /><path d="M9.5 14v-3.5c0-1 .6-1.4 1-1.8V6.5h1.5v2.2c.4.4 1 .8 1 1.8V14" /></I>,
  food: (p) => <I {...p}><path d="M4 11h16a8 8 0 0 1-16 0z" /><path d="M12 3v2" /><path d="M8.5 4.5l.8 1.6" /><path d="M15.5 4.5l-.8 1.6" /><path d="M2 21h20" /></I>,
  bag: (p) => <I {...p}><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></I>,
  // Out tab: a map pin holding a cocktail glass — the party somewhere else.
  out: (p) => <I {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><path d="M9.2 6.8h5.6L12 10z" /><path d="M12 10v2.4M10.6 12.4h2.8" /></I>,
  chart: (p) => <I {...p}><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></I>,
  pin: (p) => <I {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></I>,
  bolt: (p) => <I {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></I>,
  search: (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></I>,
  plus: (p) => <I sw={2.4} {...p}><path d="M12 5v14M5 12h14" /></I>,
  minus: (p) => <I sw={2.4} {...p}><path d="M5 12h14" /></I>,
  close: (p) => <I sw={2.2} {...p}><path d="M6 6l12 12M18 6L6 18" /></I>,
  chevron: (p) => <I sw={2.2} {...p}><path d="M9 6l6 6-6 6" /></I>,
  check: (p) => <I sw={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>,
  share: (p) => <I {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></I>,
  external: (p) => <I {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></I>,
  grid: (p) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></I>,
  list: (p) => <I {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></I>,
  bell: (p) => <I {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></I>,
  locate: (p) => <I {...p}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></I>,
  sparkle: (p) => <I {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></I>,
  glass: (p) => <I {...p}><path d="M6 4h12l-1.5 7a4.5 4.5 0 0 1-9 0z" /><path d="M12 15.5V20M8.5 20h7" /></I>,
  cocktail: (p) => <I {...p}><path d="M4 5h16l-8 8.5z" /><path d="M12 13.5V20M8.5 20h7" /><path d="M13.5 9.5L18 3.5" /><circle cx="15.2" cy="7.2" r="1.1" /></I>,
  clock: (p) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>,
  // v1.5 Out tab
  ticket: (p) => <I {...p}><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z" /><path d="M14.5 6.5v11" strokeDasharray="1.6 2" /></I>,
  phone: (p) => <I {...p}><path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" /></I>,
  route: (p) => <I {...p}><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" /></I>,
  users: (p) => <I {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.4a5.5 5.5 0 0 1 3.5 5.1" /></I>,
  calendar: (p) => <I {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></I>,
  idcard: (p) => <I {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.8 15.5a2.8 2.8 0 0 1 5.4 0M14 10h4.5M14 13.5h3" /></I>,
  star: (p) => <svg width={p?.size || 12} height={p?.size || 12} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4L2.8 9.5l6.4-.8z" /></svg>,
};

// Ring gauge (drinks coverage, budget).
export function Ring({ value, size = 96, stroke = 9, label, sub, color }) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} style={{ flexShrink: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color || "#fbe29a"} /><stop offset="1" stopColor={color || "#b9651b"} />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#r${id})`} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 6px rgba(231,168,70,.45))" }} />
      <text x={c} y={c + (sub ? -2 : 5)} textAnchor="middle" fill="#f8f0e3" fontSize={size * 0.22} fontWeight="700" fontFamily="Outfit Variable, system-ui">{label}</text>
      {sub && <text x={c} y={c + size * 0.16} textAnchor="middle" fill="#a39581" fontSize={size * 0.1} letterSpacing="1.5" fontFamily="Outfit Variable, system-ui">{sub}</text>}
    </svg>
  );
}

// ── Out tab: one illustration per outing type ───────────────────────────────
// Venues and events never show photos (no image hosts, and the owner's choice), so each
// card gets a small lit tile instead: a pint for bars, a mirror ball for club nights, a
// bottle and glass for BYOB, a ticket for food & drink events.
const VENUE_TINT = { bar: ["#c97a22", "#3a2008"], club: ["#8a3bb8", "#1d0a2b"], byob: ["#2f9e6a", "#0b2a1b"], events: ["#cc4762", "#33101a"] };

export function VenueArt({ kind = "bar", size = 56 }) {
  const id = useId().replace(/:/g, "");
  const [c1, c2] = VENUE_TINT[kind] || VENUE_TINT.bar;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        <radialGradient id={`h${id}`} cx=".5" cy=".28" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".26" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <clipPath id={`b${id}`}><circle cx="32" cy="34" r="15" /></clipPath>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#v${id})`} />
      <rect width="64" height="64" rx="16" fill={`url(#h${id})`} />
      {kind === "bar" && (
        <g>
          <path d="M40 28h4.5a4.5 4.5 0 0 1 4.5 4.5v6a4.5 4.5 0 0 1-4.5 4.5H40" fill="none" stroke="#fff3da" strokeWidth="3.4" />
          <rect x="17" y="23" width="24" height="28" rx="3.5" fill="#f2b33d" />
          <rect x="20.5" y="27" width="3" height="20" rx="1.5" fill="#fff" opacity=".35" />
          <circle cx="31" cy="40" r="1.3" fill="#fff6dc" opacity=".6" /><circle cx="35" cy="33" r="1" fill="#fff6dc" opacity=".6" /><circle cx="28" cy="45" r=".9" fill="#fff6dc" opacity=".6" />
          <circle cx="20.5" cy="22" r="5" fill="#fff8ea" /><circle cx="29" cy="19.5" r="6.2" fill="#fff8ea" /><circle cx="37.5" cy="22" r="5" fill="#fff8ea" />
          <rect x="16" y="21" width="26" height="4" fill="#fff8ea" />
        </g>
      )}
      {kind === "club" && (
        <g>
          <path d="M32 8v11" stroke="#efe4ff" strokeWidth="1.6" />
          <circle cx="32" cy="34" r="15" fill="#d8d2ec" />
          <g clipPath={`url(#b${id})`} stroke="#7d6fa6" strokeWidth="1" fill="none" opacity=".75">
            <path d="M17 27h30M17 34h30M17 41h30" />
            <ellipse cx="32" cy="34" rx="5.5" ry="15" /><ellipse cx="32" cy="34" rx="11" ry="15" />
          </g>
          <circle cx="32" cy="34" r="15" fill="none" stroke="#fff" strokeOpacity=".35" />
          <circle cx="26.5" cy="28" r="3.2" fill="#fff" opacity=".85" />
          <path d="M12 13l1.2 3.2 3.2 1.2-3.2 1.2L12 21.8l-1.2-3.2-3.2-1.2 3.2-1.2z" fill="#fff" opacity=".9" />
          <path d="M52 44l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#fff" opacity=".85" />
          <path d="M51 12l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#fff" opacity=".7" />
        </g>
      )}
      {kind === "byob" && (
        <g>
          <rect x="20" y="10" width="7" height="5" rx="1.2" fill="#c9924f" />
          <path d="M20 14.5h7V21c0 2 3 3.5 3 7.5V50a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V28.5c0-4 3-5.5 3-7.5z" fill="#3fbf83" />
          <path d="M20 14.5h7V21c0 2 3 3.5 3 7.5V50a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V28.5c0-4 3-5.5 3-7.5z" fill="#000" opacity=".18" />
          <rect x="18.5" y="33" width="10" height="11" rx="1.5" fill="#fff6e3" />
          <rect x="20.5" y="36.5" width="6" height="1.6" rx=".8" fill="#2f9e6a" />
          <rect x="19.5" y="24" width="2" height="24" rx="1" fill="#fff" opacity=".3" />
          <path d="M35 29h15c0 7.5-3.4 11.5-7.5 11.5S35 36.5 35 29z" fill="#e0567a" />
          <path d="M35 29h15c0 7.5-3.4 11.5-7.5 11.5S35 36.5 35 29z" fill="none" stroke="#fff3da" strokeWidth="1.4" />
          <path d="M42.5 40.5V50M38 50.5h9" stroke="#fff3da" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {kind === "events" && (
        <g transform="rotate(-12 32 32)">
          <path d="M11 21h42v7.5a3.5 3.5 0 0 0 0 7V43H11v-7.5a3.5 3.5 0 0 0 0-7z" fill="#ffe6b8" />
          <path d="M42 22.5v19" stroke="#cc4762" strokeWidth="1.4" strokeDasharray="2 2.2" />
          <path d="M26.5 25.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#cc4762" />
          <rect x="45" y="27" width="4" height="10" rx="1" fill="#cc4762" opacity=".35" />
        </g>
      )}
    </svg>
  );
}

export const VegMark = ({ veg }) => (veg === true ? <span className="vegmark veg" title="Veg" /> : veg === false ? <span className="vegmark nonveg" title="Non-veg" /> : null);
