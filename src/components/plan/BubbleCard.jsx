// [v1.3 · item 10] Floating order checklist over other apps.
// Android asks for "Display over other apps" on its own settings screen, so turning the toggle
// on may take a trip there: the card explains first, then re-checks when the app comes back.
import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { bubbleAvailable, canDrawOverlay, requestOverlay, hideBubble } from "../../lib/bubble.js";
import { tap } from "../../lib/order.js";
import { isIOS } from "../../lib/http.js";

export default function BubbleCard({ bubble, setBubble, toast }) {
  const native = bubbleAvailable(), iphone = isIOS();
  const [granted, setGranted] = useState(null);  // null = not checked yet
  const [ask, setAsk] = useState(false);         // showing the "why" before opening settings
  const [waiting, setWaiting] = useState(false); // in Android settings, waiting for the user to come back

  // Permission can be switched off in Android settings at any time.
  useEffect(() => {
    if (!native) return;
    let alive = true;
    canDrawOverlay().then((ok) => { if (alive) setGranted(ok); });
    return () => { alive = false; };
  }, [native]);

  // Back from the settings screen → check again and switch on if allowed.
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const sub = CapApp.addListener("resume", async () => {
      const ok = await canDrawOverlay();
      if (!alive) return;
      setWaiting(false);
      setGranted(ok);
      if (ok) { setBubble(true); toast("Floating checklist is on"); }
      else toast("The bubble needs “Display over other apps” — it's off for Liquor Cabinet");
    });
    return () => { alive = false; sub.then((s) => s.remove()); };
  }, [waiting, setBubble, toast]);

  const openSettings = async () => {
    setAsk(false);
    setWaiting(true);
    if (!(await requestOverlay())) {
      setWaiting(false);
      toast("Couldn't open Android settings — allow “Display over other apps” for Liquor Cabinet there");
    }
  };

  const flip = async () => {
    tap();
    if (bubble) { setBubble(false); setAsk(false); hideBubble(); return; }
    const ok = await canDrawOverlay();
    setGranted(ok);
    if (ok) { setBubble(true); toast("Floating checklist is on — it pops up when you send an order"); }
    else setAsk(true);
  };

  return (
    <div className="card fade-up">
      <div className="card-title">
        <span className="kicker">Order checklist</span>
        {!native && <span className="pill nat-beta">{iphone ? "Not on iPhone" : "Android only"}</span>}
      </div>
      <button className="toggle" onClick={flip} disabled={!native} style={native ? undefined : { opacity: 0.5 }}>
        <span className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <span className="nat-bubble" aria-hidden="true">3</span>
          <span>
            <span className="h3">Floating checklist over other apps</span><br />
            <span className="tiny muted">Shows your order as a gold bubble on top of Zomato, Bistro and Blinkit — tap it to see the list and tick items off as you add them.</span>
          </span>
        </span>
        <span className={`switch ${bubble && native ? "on" : ""}`} />
      </button>

      {ask && (
        <div className="note note-warn" style={{ marginTop: 12 }}>
          Android needs your OK to draw over other apps. On the next screen find <b>Liquor Cabinet</b>, switch on <b>Allow display over other apps</b>, then come back.
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-gold btn-sm grow" onClick={openSettings}>Open Android settings</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAsk(false)}>Not now</button>
          </div>
        </div>
      )}
      {waiting && <div className="tiny muted" style={{ marginTop: 10 }}>Waiting for you to come back from Android settings…</div>}
      {native && bubble && granted === false && !ask && (
        <div className="note note-warn" style={{ marginTop: 12 }}>
          “Display over other apps” is off for Liquor Cabinet, so the bubble can't show.
          <button className="btn btn-gold btn-xs" style={{ marginLeft: 8 }} onClick={openSettings}>Allow again</button>
        </div>
      )}
      {!native && <div className="tiny dim" style={{ marginTop: 10 }}>{iphone
        ? "iPhone doesn't let apps float over other apps, so this one is Android-only — your order checklist notification comes along instead."
        : "The bubble floats over other Android apps, so it only works in the Android app."}</div>}
    </div>
  );
}
