// Legal notice & privacy — the README's "Data sources & legal notice" inside the app, for
// everyone who sideloads it and never sees the README. The wording lives in lib/legal.js.
// It also opens from the Welcome screen, so its overlay sits above it (.opt-legal in styles.css).
import Sheet from "./Sheet.jsx";
import { LEGAL_DATA, LEGAL_INTRO, LEGAL_POINTS, LEGAL_SERVICES, ISSUES_URL, REPO_URL } from "../lib/legal.js";
import { openUrl } from "../lib/order.js";
import { Icon } from "./Art.jsx";
import pkg from "../../package.json";

function Point({ id, children }) {
  const p = LEGAL_POINTS.find((x) => x.id === id);
  if (!p) return null;
  return (
    <div className="opt-legal-pt">
      <div className="h3">{p.title}</div>
      <p className="small soft">{p.text}</p>
      {children}
    </div>
  );
}

export default function LegalSheet({ onClose }) {
  return (
    <Sheet title="Legal notice & privacy" subtitle="Free · non-profit · personal use" onClose={onClose}>
      <div className="opt-legal">
        <div className="note note-info" style={{ marginBottom: 14 }}>{LEGAL_INTRO}</div>

        <div className="card">
          <div className="kicker" style={{ marginBottom: 6 }}>What the app connects to</div>
          {LEGAL_SERVICES.map((s) => (
            <div key={s.name} className="opt-svc">
              <b>{s.name}</b>
              <span className="small muted">{s.use}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="kicker" style={{ marginBottom: 8 }}>Your data</div>
          <ul className="opt-legal-list">{LEGAL_DATA.map((t) => <li key={t} className="small soft">{t}</li>)}</ul>
        </div>

        <div className="card">
          <Point id="affiliation" />
          <Point id="terms" />
          <Point id="prices" />
          <Point id="takedown">
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => openUrl(ISSUES_URL)}>
              Open an issue on GitHub <Icon.external size={14} />
            </button>
          </Point>
          <Point id="age" />
          <Point id="warranty" />
        </div>

        <button className="opt-legal-foot tiny dim" onClick={() => openUrl(REPO_URL)}>
          Liquor Cabinet v{pkg.version} · <span className="gold">Source on GitHub ↗</span>
        </button>
      </div>
    </Sheet>
  );
}
