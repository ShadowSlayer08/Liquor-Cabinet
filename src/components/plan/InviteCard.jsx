// [v1.3 · item 6] Invite card — a shareable 1080×1350 party invite, previewed live.
// The full-size canvas is kept for sharing; the card shows a small JPEG of it.
// v1.5: a party out names the venue (or event) and carries its District link (lib/invite.js).
// id="invite": the Out tab's shortcut scrolls here.
import { useEffect, useMemo, useRef, useState } from "react";
import { inviteData, inviteText, drawInvite } from "../../lib/invite.js";
import { isOut } from "../../lib/outModel.js";
import { previewUrl } from "../../lib/canvas.js";
import { shareImage } from "../../lib/shareImage.js";
import { tap, buzz } from "../../lib/order.js";
import { Icon } from "../Art.jsx";

export default function InviteCard({ party, setParty, city, loc, plan, cocktailMenu, liquorLines, foodCart, toast, out }) {
  const data = useMemo(() => inviteData({ party, city, loc, cocktailMenu, liquorLines, foodCart, out }), [party, city, loc, cocktailMenu, liquorLines, foodCart, out]);
  const away = isOut(out);
  const sig = JSON.stringify(data);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const drawn = useRef({ sig: null, canvas: null });

  // Redraw when what's on the invite changes — at once the first time, then once typing pauses.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const canvas = await drawInvite(JSON.parse(sig));
        if (!live) return;
        drawn.current = { sig, canvas };
        setPreview(previewUrl(canvas, 540));
      } catch (e) {
        console.warn("invite preview", e);
      }
    }, drawn.current.sig ? 500 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [sig]);

  const share = async () => {
    if (busy) return;
    tap(); setBusy(true);
    try {
      const canvas = drawn.current.sig === sig ? drawn.current.canvas : await drawInvite(data);
      const res = await shareImage(canvas, "party-invite.jpg", data.title, inviteText(data));
      if (res === "downloaded") toast("Invite saved as an image");
      else if (res === "shared") buzz();
    } catch (e) {
      toast(`Couldn't share the invite (${e?.message || e})`);
    } finally {
      setBusy(false);
    }
  };

  const hints = (away ? [
    "Date, time & place come from the Out tab.",
    data.url && "The District link goes in the message with the image.",
    data.bar.kind === "byob" && !data.bar.items.length && "Add bottles in the Cabinet to list what you're bringing.",
    !data.host && "Add your name under Split the bill to sign it.",
  ] : [
    "Date & time come from the Food tab.",
    !data.bar.items.length && !data.food.items.length && "Add cocktails in the Bar tab or dishes in Food to list them.",
    !data.host && "Add your name under Split the bill to sign it.",
  ]).filter(Boolean).join(" ");

  return (
    <div className="card fade-up" id="invite">
      <div className="card-title"><span className="kicker">Invite your guests</span><span className="tiny muted">{plan.guests} guests</span></div>
      <div className="share-invite">
        {preview ? <img className="share-invite-img" src={preview} alt={`Invite: ${data.title}`} /> : <div className="skel share-invite-img" />}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Party name</label>
        <input className="input" value={party?.name || ""} maxLength={60} placeholder={away ? "Night out" : "House party"}
          onChange={(e) => { const v = e.target.value; setParty((p) => ({ ...p, name: v })); }} />
      </div>
      <div className="tiny dim" style={{ marginTop: 8 }}>{hints}</div>
      <button className="btn btn-gold btn-block" style={{ marginTop: 12 }} disabled={busy} onClick={share}>
        {busy ? <span className="spin">◌</span> : <Icon.share size={17} />} Share invite
      </button>
    </div>
  );
}
