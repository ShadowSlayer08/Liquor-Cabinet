import { useBackHandler } from "../lib/back.js";
import { Icon } from "./Art.jsx";

// Bottom sheet. `bare` drops the title row so content (e.g. a banner) can go edge to edge.
export default function Sheet({ title, subtitle, onClose, children, footer, bare = false }) {
  useBackHandler(onClose);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head" style={bare ? { paddingBottom: 0 } : undefined}>
          <div className="sheet-grip" />
          {!bare && (
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="h2">{title}</div>
                {subtitle && <div className="small muted" style={{ marginTop: 3 }}>{subtitle}</div>}
              </div>
              <button className="xbtn" onClick={onClose} aria-label="Close"><Icon.close size={18} /></button>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1 }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper">
      <button onClick={() => set(value - step)} aria-label="Less"><Icon.minus size={18} /></button>
      <input inputMode="numeric" value={value}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange(Number.isNaN(n) ? min : Math.min(max, n)); }}
        onBlur={() => set(value)} />
      <button onClick={() => set(value + step)} aria-label="More"><Icon.plus size={18} /></button>
    </div>
  );
}

export function Qty({ value, onChange, min = 0, color }) {
  return (
    <div className="qty" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Remove one"><Icon.minus size={15} /></button>
      <span className="n" style={color ? { color } : undefined}>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="Add one"><Icon.plus size={15} /></button>
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="empty" style={{ padding: "34px 0" }}>
      <div className="spin gold" style={{ fontSize: 26 }}>◌</div>
      <div className="small" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}

export function Skeleton({ h = 120, n = 3 }) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: h, marginBottom: 12 }} />);
}
