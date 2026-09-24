import { fmt } from "../lib/format.js";

export default function BudgetRing({ spent, total, size = 132 }) {
  const pct = total > 0 ? Math.min(1, spent / total) : 0;
  const r = size * 0.4, c = size / 2, circ = 2 * Math.PI * r;
  const color = pct > 0.92 ? "#e84040" : pct > 0.7 ? "#e8c030" : "#22c97a";
  const left = total - spent;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} style={{ filter: `drop-shadow(0 0 10px ${color}50)`, overflow: "visible" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1a1510" strokeWidth={10} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.4,0,.2,1), stroke .4s" }} />
        <text x={c} y={c - 12} textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="Georgia,serif">{Math.round(pct * 100)}%</text>
        <text x={c} y={c + 4} textAnchor="middle" fill="#6a6055" fontSize="9" fontFamily="Georgia,serif" letterSpacing="2">USED</text>
        <text x={c} y={c + 21} textAnchor="middle" fill="#a89a85" fontSize="12" fontWeight="600" fontFamily="Georgia,serif">{fmt(spent)}</text>
      </svg>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div className="tiny muted" style={{ letterSpacing: 1 }}>REMAINING</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: left < 0 ? "#e84040" : left < total * 0.1 ? "#e8c030" : "#22c97a", transition: "color .4s" }}>
          {left < 0 ? `−${fmt(-left)}` : fmt(left)}
        </div>
      </div>
    </div>
  );
}
