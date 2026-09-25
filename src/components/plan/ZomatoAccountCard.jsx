// [v1.3 · item 8] Zomato account (beta) — sign in once in-app to see exact menu prices.
// Sign-in happens on Zomato's own page (lib/zomatoAccount.js); afterwards one
// menu is fetched again to confirm prices really show. Never tested with a real
// account, so everything here says "beta".
import { useEffect, useRef, useState } from "react";
import { isNative } from "../../lib/http.js";
import { buzz, tap } from "../../lib/order.js";
import {
  checkExactPrices, clearPending, dropCachedMenus, knownRestaurant, openZomatoSignIn, pendingSignIn, pricedSince, signOutOfZomato,
} from "../../lib/zomatoAccount.js";
import { Icon } from "../Art.jsx";

export default function ZomatoAccountCard({ loc, zomatoExact, setZomatoExact, foodCart, toast }) {
  const native = isNative();
  const [status, setStatus] = useState("idle"); // idle | checking | pending (no menu to check yet) | failed
  const alive = useRef(true);
  const stopListening = useRef(null);
  const latest = useRef({ loc, foodCart });      // the browserClosed callback outlives this render
  useEffect(() => { latest.current = { loc, foodCart }; }, [loc, foodCart]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stopListening.current?.(); stopListening.current = null; };
  }, []);
  const show = (s) => { if (alive.current) setStatus(s); };

  // Signed in earlier but not confirmed? A menu opened since (Food tab) may already show prices.
  useEffect(() => {
    if (zomatoExact) return;
    let live = true;
    (async () => {
      const at = await pendingSignIn();
      if (!at || !live) return;
      if (!(await pricedSince(at))) { if (live) setStatus("pending"); return; }
      if (!live) return;
      await clearPending();
      setZomatoExact(true);
      toast("✓ Exact Zomato prices on");
    })();
    return () => { live = false; };
  }, [zomatoExact]);

  const verify = async () => {
    show("checking");
    const { loc, foodCart } = latest.current;
    const r = await knownRestaurant(foodCart);
    if (!r) {
      show("pending");
      toast("No Zomato menu to check yet — open one in the Food tab and we'll confirm");
      return;
    }
    try {
      if (await checkExactPrices(r, loc)) {
        await clearPending();
        setZomatoExact(true);
        show("idle");
        buzz();
        toast("✓ Exact Zomato prices on");
      } else {
        await clearPending();
        setZomatoExact(false);
        show("failed");
        toast("Zomato still hides prices — the sign-in didn't stick");
      }
    } catch (e) {
      show("pending");
      toast(`Couldn't check a Zomato menu (${e.message}) — we'll check next time`);
    }
  };

  const signIn = async () => {
    tap();
    stopListening.current?.();
    try {
      stopListening.current = await openZomatoSignIn(async () => {
        stopListening.current = null;
        await dropCachedMenus();   // menus cached so far were fetched signed out
        verify();
      });
    } catch (e) {
      toast(`Couldn't open Zomato: ${e?.message || e}`);
    }
  };

  const signOut = async () => {
    tap();
    try { await signOutOfZomato(); } catch (e) { console.warn("signOutOfZomato", e); }
    setZomatoExact(false);
    show("idle");
    toast("Signed out of Zomato — menus show estimates again");
  };

  const busy = status === "checking";
  return (
    <div className="card fade-up">
      <div className="card-title">
        <span className="kicker">Zomato account</span>
        {zomatoExact ? <span className="pill data-on">✓ Exact prices on</span> : <span className="pill data-beta">Beta</span>}
      </div>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="logo logo-z">zomato</span>
        <div className="grow small muted">Zomato hides menu prices unless you're signed in, so dishes are estimated from each restaurant's "cost for one". Sign in once here and menus show their real prices.</div>
      </div>

      {busy && <div className="note note-info data-status"><span className="spin">◌</span> Checking a Zomato menu…</div>}
      {!busy && zomatoExact && <div className="note note-ok data-status">Signed in — Zomato menus show exact prices, and dishes you add use them.</div>}
      {!busy && !zomatoExact && status === "pending" && <div className="note note-info data-status">Signed in? We'll confirm the next time you open a Zomato menu in the Food tab.</div>}
      {!busy && !zomatoExact && status === "failed" && <div className="note note-warn data-status">Zomato still hides prices, so the sign-in didn't stick. Try again, and tap Done only once you can see your account.</div>}

      <div className="row wrap" style={{ marginTop: 12 }}>
        {zomatoExact ? (
          <button className="btn btn-ghost btn-sm grow" disabled={busy} onClick={verify}>↻ Check prices again</button>
        ) : (
          <button className="btn btn-zomato btn-sm grow" disabled={!native || busy} onClick={signIn}>Sign in to Zomato (beta) <Icon.external size={14} /></button>
        )}
        {!zomatoExact && (status === "pending" || status === "failed") && <button className="btn btn-ghost btn-sm" onClick={verify}>Check again</button>}
        {(zomatoExact || status === "pending") && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={signOut}>Sign out</button>}
      </div>
      {!native && <div className="tiny dim" style={{ marginTop: 8 }}>Works in the Android app.</div>}
      <div className="tiny dim" style={{ marginTop: 8 }}>Beta — couldn't be tested with a real Zomato account. You sign in on Zomato's own page; Liquor Cabinet never sees your password.</div>
    </div>
  );
}
