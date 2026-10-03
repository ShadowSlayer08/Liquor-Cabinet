// Next steps under the Food tab's drinks check: fill the gap within budget (the optimiser),
// and drinks for the guests who aren't drinking (mocktails in the Bar tab).
import { COCKTAIL } from "../lib/cocktails.js";
import { Icon } from "./Art.jsx";

export default function GaugeActions({ plan, cocktailMenu, openFill, goBar }) {
  const notDrinking = plan.nonDrinkers ?? Math.max(0, plan.guests - plan.drinkers);
  const hasMocktail = (cocktailMenu || []).some((m) => COCKTAIL[m.id]?.mocktail);
  const short = plan.available === 0 || plan.shortfall > 0;
  if (!short && (!notDrinking || hasMocktail)) return null;
  return (
    <div className="gauge-actions">
      {short && (
        <button className="link" onClick={openFill}>
          <Icon.sparkle size={14} /> {plan.available === 0 ? "Fill my bar within budget" : "Fill the gap within budget"} ›
        </button>
      )}
      {notDrinking > 0 && !hasMocktail && (
        <button className="link" onClick={() => goBar("mocktails")}>
          🍹 Add a mocktail for the {notDrinking} not drinking ›
        </button>
      )}
    </div>
  );
}
