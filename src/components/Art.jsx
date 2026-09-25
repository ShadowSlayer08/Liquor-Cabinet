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

export const VegMark = ({ veg }) => (veg === true ? <span className="vegmark veg" title="Veg" /> : veg === false ? <span className="vegmark nonveg" title="Non-veg" /> : null);
