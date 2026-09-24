import { useBackHandler } from "../lib/back.js";

export default function Sheet({ title, subtitle, onClose, children, footer }) {
  useBackHandler(onClose);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-grip" />
          <div className="between">
            <div className="grow">
              <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
              {subtitle && <div className="small muted">{subtitle}</div>}
            </div>
            <button className="xbtn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1 }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper">
      <button onClick={() => set(value - step)}>−</button>
      <input inputMode="numeric" value={value}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange(Number.isNaN(n) ? min : Math.min(max, n)); }}
        onBlur={() => set(value)} />
      <button onClick={() => set(value + step)}>+</button>
    </div>
  );
}

export function Spinner({ label }) {
  return <div className="empty" style={{ padding: "36px 0" }}><div className="spin gold" style={{ fontSize: 24 }}>◌</div><div className="small" style={{ marginTop: 8 }}>{label}</div></div>;
}
